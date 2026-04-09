import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { useRoster } from '../hooks/useRoster';
import RosterSlot from '../components/RosterSlot';
import TradeModal from '../components/TradeModal';
import toast from 'react-hot-toast';
import { Users, ArrowUpDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function MyTeam() {
  const { id: leagueId } = useParams();
  const { user } = useAuth();
  const { getLeague } = useLeague();
  const { getMyRoster, dropFromRoster, moveSlot } = useRoster();
  const [league, setLeague] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState({ open: false, targetMember: null });
  const [targetRoster, setTargetRoster] = useState([]);

  const myMembership = league?.league_members?.find(m => m.user_id === user?.id);

  useEffect(() => {
    async function load() {
      const { data: leagueData } = await getLeague(leagueId);
      setLeague(leagueData);

      if (leagueData) {
        const member = leagueData.league_members?.find(m => m.user_id === user?.id);
        if (member) {
          const { data: rosterData } = await getMyRoster(member.id);
          setRoster(rosterData || []);
        }
      }
      setLoading(false);
    }
    load();
  }, [leagueId, user]);

  const handleDrop = async (rosterEntry) => {
    if (!confirm(`Drop ${rosterEntry.golfers?.name}?`)) return;
    const { error } = await dropFromRoster(rosterEntry.id);
    if (error) {
      toast.error(error.message);
    } else {
      setRoster(prev => prev.filter(r => r.id !== rosterEntry.id));
      toast.success(`Dropped ${rosterEntry.golfers?.name}`);
    }
  };

  const handleMove = async (rosterEntry) => {
    const newSlot = rosterEntry.slot_type === 'starter' ? 'bench' : 'starter';

    // Check starter limit
    if (newSlot === 'starter') {
      const currentStarters = roster.filter(r => r.slot_type === 'starter').length;
      if (currentStarters >= (league?.roster_starters || 6)) {
        toast.error('Starter slots full — bench someone first');
        return;
      }
    }

    const { data, error } = await moveSlot(rosterEntry.id, newSlot);
    if (error) {
      toast.error(error.message);
    } else {
      setRoster(prev => prev.map(r => r.id === rosterEntry.id ? { ...r, slot_type: newSlot } : r));
      toast.success(`Moved to ${newSlot}`);
    }
  };

  const openTradeWith = async (member) => {
    const { data } = await supabase
      .from('rosters')
      .select('*, golfers(*)')
      .eq('league_member_id', member.id);
    setTargetRoster(data || []);
    setTradeModal({ open: true, targetMember: member });
  };

  const submitTrade = async ({ proposerGolfers, receiverGolfers, message }) => {
    const { error } = await supabase.from('trades').insert({
      league_id: leagueId,
      proposer_id: myMembership.id,
      receiver_id: tradeModal.targetMember.id,
      proposer_golfers: proposerGolfers,
      receiver_golfers: receiverGolfers,
      message: message || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Trade proposed!');
    }
  };

  const starters = roster.filter(r => r.slot_type === 'starter');
  const bench = roster.filter(r => r.slot_type === 'bench');
  const otherMembers = league?.league_members?.filter(m => m.user_id !== user?.id) || [];

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-clubhouse-800 rounded" />
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-clubhouse-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-clubhouse-50 tracking-tight">
            {myMembership?.team_name || 'My Team'}
          </h1>
          <p className="text-sm text-clubhouse-500 mt-1">
            {starters.length}/{league?.roster_starters || 6} starters · {bench.length}/{league?.roster_bench || 2} bench
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Roster */}
        <div className="lg:col-span-2 space-y-6">
          {/* Starters */}
          <div>
            <h2 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider mb-3">
              Starters ({starters.length}/{league?.roster_starters || 6})
            </h2>
            <div className="space-y-2">
              {starters.map((r, i) => (
                <div key={r.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <RosterSlot roster={r} slotLabel="Starter" editable
                    onDrop={handleDrop} onMove={handleMove} />
                </div>
              ))}
              {Array.from({ length: Math.max(0, (league?.roster_starters || 6) - starters.length) }).map((_, i) => (
                <RosterSlot key={`empty-s-${i}`} roster={null} slotLabel="Starter" />
              ))}
            </div>
          </div>

          {/* Bench */}
          <div>
            <h2 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider mb-3">
              Bench ({bench.length}/{league?.roster_bench || 2})
            </h2>
            <div className="space-y-2">
              {bench.map((r, i) => (
                <div key={r.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <RosterSlot roster={r} slotLabel="Bench" editable
                    onDrop={handleDrop} onMove={handleMove} />
                </div>
              ))}
              {Array.from({ length: Math.max(0, (league?.roster_bench || 2) - bench.length) }).map((_, i) => (
                <RosterSlot key={`empty-b-${i}`} roster={null} slotLabel="Bench" />
              ))}
            </div>
          </div>
        </div>

        {/* Trade sidebar */}
        <div>
          <h2 className="text-xs font-semibold text-clubhouse-400 uppercase tracking-wider mb-3">
            Propose a Trade
          </h2>
          <div className="space-y-2">
            {otherMembers.map(m => (
              <button key={m.id} onClick={() => openTradeWith(m)}
                className="w-full card-hover flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-full bg-clubhouse-800 flex items-center justify-center border border-clubhouse-700">
                  <Users size={13} className="text-clubhouse-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-clubhouse-200 truncate block">{m.team_name}</span>
                  <span className="text-xs text-clubhouse-500">{m.profiles?.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trade Modal */}
      <TradeModal
        isOpen={tradeModal.open}
        onClose={() => setTradeModal({ open: false, targetMember: null })}
        myRoster={roster}
        theirRoster={targetRoster}
        theirTeamName={tradeModal.targetMember?.team_name}
        onSubmit={submitTrade}
      />
    </div>
  );
}
