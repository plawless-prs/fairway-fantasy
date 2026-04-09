import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { useRoster } from '../hooks/useRoster';
import PlayerCard from '../components/PlayerCard';
import toast from 'react-hot-toast';
import { Search, UserPlus, Filter } from 'lucide-react';

export default function FreeAgents() {
  const { id: leagueId } = useParams();
  const { user } = useAuth();
  const { getLeague } = useLeague();
  const { getFreeAgents, addToRoster, getMyRoster, submitWaiverClaim } = useRoster();
  const [league, setLeague] = useState(null);
  const [freeAgents, setFreeAgents] = useState([]);
  const [myRoster, setMyRoster] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dropTarget, setDropTarget] = useState(null);

  const myMembership = league?.league_members?.find(m => m.user_id === user?.id);
  const rosterFull = myRoster.length >= ((league?.roster_starters || 6) + (league?.roster_bench || 2));

  useEffect(() => {
    async function load() {
      const { data: leagueData } = await getLeague(leagueId);
      setLeague(leagueData);

      const { data: faData } = await getFreeAgents(leagueId);
      setFreeAgents(faData || []);

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
      const { error } = await submitWaiverClaim({
        league_id: leagueId,
        member_id: myMembership.id,
        add_golfer_id: golfer.id,
        drop_golfer_id: dropTarget?.golfer_id || null,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Waiver claim submitted for ${golfer.name}`);
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

  const filtered = freeAgents.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.country?.toLowerCase().includes(search.toLowerCase())
  );

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
            {freeAgents.length} golfers available · Waiver: {league?.waiver_type?.replace('_', ' ')}
          </p>
        </div>
      </div>

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

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clubhouse-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or country..."
          className="input-field pl-10" />
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {filtered.map((golfer, i) => (
          <div key={golfer.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
            <PlayerCard golfer={golfer} actions={[
              {
                label: league?.waiver_type !== 'first_come' ? 'Claim' : 'Add',
                variant: 'add',
                icon: <UserPlus size={13} />,
                onClick: () => handlePickup(golfer),
              }
            ]} />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-clubhouse-500">
            {search ? 'No golfers match your search' : 'No free agents available'}
          </div>
        )}
      </div>
    </div>
  );
}
