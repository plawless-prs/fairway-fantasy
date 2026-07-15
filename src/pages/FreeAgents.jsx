import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { useRoster } from '../hooks/useRoster';
import { fetchField, annotateFieldStatus } from '../lib/field';
import { notifyWaiverClaim } from '../lib/notify';
import PlayerCard from '../components/PlayerCard';
import toast from 'react-hot-toast';
import { Search, UserPlus } from 'lucide-react';

export default function FreeAgents() {
  const { id: leagueId } = useParams();
  const { user } = useAuth();
  const { getLeague } = useLeague();
  const { getFreeAgents, getLeagueRosters, addToRoster, getMyRoster, submitWaiverClaim } = useRoster();
  const [league, setLeague] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [rosteredPlayers, setRosteredPlayers] = useState([]);
  const [field, setField] = useState(null);
  const [myRoster, setMyRoster] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dropTarget, setDropTarget] = useState(null);
  const [showRostered, setShowRostered] = useState(false);
  const [showNotInField, setShowNotInField] = useState(false);

  const myMembership = league?.league_members?.find(m => m.user_id === user?.id);
  const rosterFull = myRoster.length >= ((league?.roster_starters || 6) + (league?.roster_bench || 2));

  // Whether we could determine the field at all. When false (between majors, or
  // the feed is down), we can't tell who's in the field — so we don't hide or
  // block anyone and show a note instead.
  const fieldKnown = !!(field?.isMajor && field?.players?.length);

  useEffect(() => {
    async function load() {
      const { data: leagueData } = await getLeague(leagueId);
      setLeague(leagueData);

      const [faRes, rosterRes, fieldData] = await Promise.all([
        getFreeAgents(leagueId),
        getLeagueRosters(leagueId),
        fetchField(),
      ]);

      setField(fieldData);
      setFreeAgents(annotateFieldStatus(faRes.data || [], fieldData));

      // Flatten rostered rows into golfer objects carrying the owning team name.
      const rostered = (rosterRes.data || [])
        .filter(r => r.golfers)
        .map(r => ({ ...r.golfers, ownerTeam: r.league_members?.team_name || 'Another team' }));
      setRosteredPlayers(annotateFieldStatus(rostered, fieldData));

      if (leagueData) {
        const member = leagueData.league_members?.find(m => m.user_id === user?.id);
        if (member) {
          const { data: rosterData } = await getMyRoster(member.id);
          setMyRoster(rosterData || []);
        }
      }
      setLoading(false);
    }
    load();
  }, [leagueId, user]);

  const handlePickup = async (golfer) => {
    if (!myMembership) return;

    if (rosterFull && !dropTarget) {
      toast.error('Roster full — select a player to drop first');
      return;
    }

    const waiverMode = league?.waiver_type !== 'first_come';

    if (waiverMode) {
      // Submit waiver claim
      const { data, error } = await submitWaiverClaim({
        league_id: leagueId,
        member_id: myMembership.id,
        add_golfer_id: golfer.id,
        drop_golfer_id: dropTarget?.golfer_id || null,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Waiver claim submitted for ${golfer.name}`);
        // Notify the commissioner by email (fire-and-forget).
        if (data?.id) notifyWaiverClaim(data.id);
      }
    } else {
      // Direct pickup
      if (dropTarget) {
        const { supabase } = await import('../lib/supabase');
        await supabase.from('rosters').delete().eq('id', dropTarget.id);
      }

      const slotType = myRoster.filter(r => r.slot_type === 'starter').length < (league?.roster_starters || 6)
        ? 'starter' : 'bench';

      const { data, error } = await addToRoster(myMembership.id, golfer.id, slotType);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Added ${golfer.name} to your roster!`);
        setFreeAgents(prev => prev.filter(g => g.id !== golfer.id));
        setMyRoster(prev => {
          const filtered = dropTarget ? prev.filter(r => r.id !== dropTarget.id) : prev;
          return [...filtered, data];
        });
        setDropTarget(null);
      }
    }
  };

  // ── Build the displayed list ──
  // Free agents are claimable when they're in the field (or the field is
  // unknown). Rostered players and not-in-field players are shown for reference
  // only — dimmed, badged, and without a Claim button — behind their filters.
  const claimable = g => !g.rostered && g.inField !== false;

  let displayed = freeAgents.map(g => ({ ...g, rostered: false }));
  if (showRostered) {
    displayed = displayed.concat(rosteredPlayers.map(g => ({ ...g, rostered: true })));
  }
  // Global not-in-field filter (has no effect when the field is unknown).
  displayed = displayed.filter(g => showNotInField || g.inField !== false);
  // Search
  const term = search.toLowerCase();
  displayed = displayed.filter(g =>
    g.name.toLowerCase().includes(term) || g.country?.toLowerCase().includes(term)
  );
  displayed.sort((a, b) => (a.owgr_rank || 999) - (b.owgr_rank || 999));

  const availableCount = freeAgents.filter(claimable).length;

  const badgeFor = (g) => {
    if (g.rostered) return { label: `On ${g.ownerTeam}`, className: 'badge-gold' };
    if (g.inField === false) return { label: 'Not in field', className: 'badge-gray' };
    return null;
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-clubhouse-800 rounded" />
          <div className="h-10 bg-clubhouse-800 rounded-lg" />
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-clubhouse-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-clubhouse-50 tracking-tight">Free Agents</h1>
          <p className="text-sm text-clubhouse-500 mt-1">
            {availableCount} available{fieldKnown ? ' in the field' : ''} · Waiver: {league?.waiver_type?.replace('_', ' ')}
          </p>
        </div>
      </div>

      {/* Field source note */}
      {fieldKnown ? (
        <p className="text-xs text-clubhouse-500 mb-3">
          Field for <span className="text-clubhouse-300">{field.eventName}</span>
          {field.source === 'espn' ? ' (via ESPN)' : ''} · {field.players.length} players
        </p>
      ) : (
        <p className="text-xs text-sand-400/80 mb-3">
          No major in progress — can’t verify the field right now, so all players are shown and claimable.
        </p>
      )}

      {/* Drop target selector */}
      {rosterFull && (
        <div className="card mb-4 border-sand-700/30 bg-sand-900/10">
          <h3 className="text-sm font-semibold text-sand-300 mb-3">
            Roster full — select a player to drop:
          </h3>
          <div className="flex flex-wrap gap-2">
            {myRoster.map(r => (
              <button key={r.id}
                onClick={() => setDropTarget(dropTarget?.id === r.id ? null : r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${dropTarget?.id === r.id
                    ? 'bg-red-900/30 border-red-700/50 text-red-300'
                    : 'bg-clubhouse-800 border-clubhouse-700 text-clubhouse-300 hover:border-clubhouse-600'}`}>
                {r.golfers?.name} #{r.golfers?.owgr_rank}
              </button>
            ))}
          </div>
          {dropTarget && (
            <p className="text-xs text-red-400 mt-2">
              Will drop: {dropTarget.golfers?.name}
            </p>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clubhouse-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or country..."
          className="input-field pl-10" />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterToggle
          active={showRostered}
          onClick={() => setShowRostered(v => !v)}
          label="Show rostered players"
        />
        <FilterToggle
          active={showNotInField}
          onClick={() => setShowNotInField(v => !v)}
          label="Show players not in field"
          disabled={!fieldKnown}
        />
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {displayed.map((golfer, i) => {
          const canClaim = claimable(golfer);
          return (
            <div key={`${golfer.rostered ? 'r' : 'f'}-${golfer.id}`} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <PlayerCard golfer={golfer}
                muted={!canClaim}
                badge={badgeFor(golfer)}
                actions={canClaim ? [
                  {
                    label: league?.waiver_type !== 'first_come' ? 'Claim' : 'Add',
                    variant: 'add',
                    icon: <UserPlus size={13} />,
                    onClick: () => handlePickup(golfer),
                  }
                ] : []} />
            </div>
          );
        })}
        {displayed.length === 0 && (
          <div className="card text-center py-10 text-clubhouse-500">
            {search ? 'No golfers match your search' : 'No free agents available'}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterToggle({ active, onClick, label, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
        ${disabled
          ? 'bg-clubhouse-900 border-clubhouse-800 text-clubhouse-600 cursor-not-allowed'
          : active
            ? 'bg-fairway-900/40 border-fairway-700/50 text-fairway-300'
            : 'bg-clubhouse-800 border-clubhouse-700 text-clubhouse-400 hover:border-clubhouse-600'}`}>
      {label}
    </button>
  );
}
