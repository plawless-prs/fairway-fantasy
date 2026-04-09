import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getFlag } from '../lib/constants';
import { Clock, Zap, Check } from 'lucide-react';

export default function DraftBoard({ league, memberId, members = [] }) {
  const [golfers, setGolfers] = useState([]);
  const [picks, setPicks] = useState([]);
  const [search, setSearch] = useState('');
  const [timer, setTimer] = useState(90);
  const [loading, setLoading] = useState(true);

  const totalRounds = (league?.roster_starters || 6) + (league?.roster_bench || 2);
  const totalPicks = totalRounds * members.length;

  // Determine current pick info based on snake draft
  const currentPickNum = picks.length + 1;
  const currentRound = Math.ceil(currentPickNum / members.length);
  const isReversed = currentRound % 2 === 0;
  const posInRound = ((currentPickNum - 1) % members.length);
  const draftOrder = isReversed ? members.length - 1 - posInRound : posInRound;
  const sortedMembers = [...members].sort((a, b) => (a.draft_position || 0) - (b.draft_position || 0));
  const onTheClock = sortedMembers[draftOrder];
  const isMyPick = onTheClock?.id === memberId;

  // Fetch golfers and existing picks
  useEffect(() => {
    async function load() {
      const [gRes, pRes] = await Promise.all([
        supabase.from('golfers').select('*').order('owgr_rank'),
        supabase.from('draft_picks').select('*, golfers(name, owgr_rank, country), league_members(team_name)')
          .eq('league_id', league.id).order('pick_num'),
      ]);
      setGolfers(gRes.data || []);
      setPicks(pRes.data || []);
      setLoading(false);
    }
    load();

    // Realtime subscription for draft picks
    const channel = supabase.channel(`draft-${league.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'draft_picks', filter: `league_id=eq.${league.id}` },
        (payload) => {
          setPicks(prev => [...prev, payload.new]);
          setTimer(90);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [league.id]);

  // Draft timer countdown
  useEffect(() => {
    if (picks.length >= totalPicks) return;
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          // Auto-pick would trigger here
          return 90;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [picks.length, totalPicks]);

  const pickedGolferIds = new Set(picks.map(p => p.golfer_id));
  const availableGolfers = golfers.filter(g =>
    !pickedGolferIds.has(g.id) &&
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const makePick = async (golferId) => {
    if (!isMyPick) return;
    const { error } = await supabase.from('draft_picks').insert({
      league_id: league.id,
      member_id: memberId,
      golfer_id: golferId,
      round_num: currentRound,
      pick_num: currentPickNum,
    });
    if (!error) {
      // Also add to roster
      const slotType = picks.filter(p => p.member_id === memberId).length < (league.roster_starters || 6)
        ? 'starter' : 'bench';
      await supabase.from('rosters').insert({
        league_member_id: memberId,
        golfer_id: golferId,
        slot_type: slotType,
      });
    }
  };

  const isDraftComplete = picks.length >= totalPicks;

  if (loading) {
    return <div className="text-center py-12 text-clubhouse-400 animate-pulse">Loading draft board...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Draft status bar */}
      <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-clubhouse-100">
            {isDraftComplete ? '✅ Draft Complete' : `Round ${currentRound} — Pick ${currentPickNum}`}
          </h2>
          <p className="text-sm text-clubhouse-400 mt-1">
            {isDraftComplete
              ? 'All rosters have been filled. Head to your team page!'
              : `${onTheClock?.team_name || 'Unknown'} is on the clock`}
          </p>
        </div>
        {!isDraftComplete && (
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold
              ${timer <= 15 ? 'bg-red-900/40 text-red-300 border border-red-800/50' :
                'bg-clubhouse-800 text-clubhouse-200 border border-clubhouse-700'}`}>
              <Clock size={16} />
              {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
            </div>
            {isMyPick && (
              <span className="badge-green flex items-center gap-1">
                <Zap size={12} /> Your Pick!
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available golfers */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="section-title text-lg">Available Golfers</h3>
            <span className="text-xs text-clubhouse-500">{availableGolfers.length} available</span>
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search golfers..." className="input-field" />
          <div className="card p-0 max-h-[500px] overflow-y-auto divide-y divide-clubhouse-800/50">
            {availableGolfers.map(g => (
              <div key={g.id}
                className={`flex items-center justify-between px-4 py-3 transition-colors
                  ${isMyPick ? 'hover:bg-clubhouse-800/50 cursor-pointer' : 'opacity-60'}`}
                onClick={() => isMyPick && makePick(g.id)}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-clubhouse-500 w-6 text-right">
                    {g.owgr_rank}
                  </span>
                  <span>{getFlag(g.country)}</span>
                  <span className="text-sm font-medium text-clubhouse-200">{g.name}</span>
                </div>
                {isMyPick && (
                  <button className="btn-primary text-xs px-3 py-1"
                    onClick={(e) => { e.stopPropagation(); makePick(g.id); }}>
                    Draft
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pick history */}
        <div className="space-y-3">
          <h3 className="section-title text-lg">Pick History</h3>
          <div className="card p-0 max-h-[560px] overflow-y-auto">
            {picks.length === 0 ? (
              <div className="p-6 text-center text-sm text-clubhouse-500">No picks yet</div>
            ) : (
              <div className="divide-y divide-clubhouse-800/50">
                {[...picks].reverse().map((pick, i) => (
                  <div key={pick.id || i} className="px-4 py-2.5 flex items-center gap-3 animate-slide-in">
                    <span className="font-mono text-xs text-clubhouse-500 w-6 shrink-0">
                      {pick.pick_num}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-clubhouse-200 truncate block">
                        {pick.golfers?.name || `Golfer #${pick.golfer_id}`}
                      </span>
                      <span className="text-xs text-clubhouse-500">
                        {pick.league_members?.team_name || 'Team'} — Rd {pick.round_num}
                      </span>
                    </div>
                    <Check size={14} className="text-fairway-500 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
