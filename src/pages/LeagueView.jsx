import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { useRoster } from '../hooks/useRoster';
import { LEAGUE_STATUS_LABELS, TRADE_STATUS_LABELS } from '../lib/constants';
import Standings from '../components/Standings';
import TournamentScoreboard from '../components/TournamentScoreboard';
import toast from 'react-hot-toast';
import {
  BarChart3, Users, ArrowLeftRight, ClipboardList, Settings,
  Copy, UserPlus, Swords, Shield
} from 'lucide-react';

const TABS = [
  { key: 'standings', label: 'Standings', icon: <BarChart3 size={15} /> },
  { key: 'tournament', label: 'Live Tournament', icon: <BarChart3 size={15} /> },
  { key: 'members', label: 'Teams', icon: <Users size={15} /> },
  { key: 'trades', label: 'Trades', icon: <ArrowLeftRight size={15} /> },
];

export default function LeagueView() {
  const { id } = useParams();
  const { user } = useAuth();
  const { getLeague, getStandings } = useLeague();
  const { getTradesForLeague, respondToTrade, executeTrade } = useRoster();
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [trades, setTrades] = useState([]);
  const [tab, setTab] = useState('standings');
  const [loading, setLoading] = useState(true);

  const isCommissioner = league?.commissioner_id === user?.id;
  const myMembership = league?.league_members?.find(m => m.user_id === user?.id);

  useEffect(() => {
    async function load() {
      const { data } = await getLeague(id);
      setLeague(data);
      if (data) {
        const { data: standingsData } = await getStandings(id);
        setStandings(standingsData || []);
        const { data: tradesData } = await getTradesForLeague(id);
        setTrades(tradesData || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(league?.invite_code || '');
    toast.success('Invite code copied!');
  };

  const handleTradeAction = async (trade, action) => {
    const status = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'vetoed';
    await respondToTrade(trade.id, status, user?.id);
    if (status === 'accepted' && league?.trade_review === 'instant') {
      await executeTrade(trade);
      toast.success('Trade completed!');
    } else if (status === 'accepted') {
      toast.success('Trade accepted — awaiting commissioner approval');
    } else {
      toast.success(`Trade ${status}`);
    }
    // Refresh trades
    const { data } = await getTradesForLeague(id);
    setTrades(data || []);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-clubhouse-800 rounded" />
          <div className="h-4 w-40 bg-clubhouse-800 rounded" />
          <div className="h-64 bg-clubhouse-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="page-container text-center py-20">
        <p className="text-clubhouse-400">League not found</p>
      </div>
    );
  }

  const statusBadge = {
    setup: 'badge-gray', drafting: 'badge-gold', active: 'badge-green', completed: 'badge-gray',
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-clubhouse-50 tracking-tight">{league.name}</h1>
            <span className={statusBadge[league.status]}>{LEAGUE_STATUS_LABELS[league.status]}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-clubhouse-500">
            <span>{league.league_members?.length || 0} / {league.max_teams} teams</span>
            <span className="flex items-center gap-1.5 cursor-pointer hover:text-clubhouse-300" onClick={copyInviteCode}>
              <Copy size={13} /> Code: <code className="text-sand-400">{league.invite_code}</code>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {myMembership && (
            <>
              <Link to={`/league/${id}/team`} className="btn-primary text-sm flex items-center gap-1.5">
                <ClipboardList size={14} /> My Team
              </Link>
              <Link to={`/league/${id}/free-agents`} className="btn-secondary text-sm flex items-center gap-1.5">
                <UserPlus size={14} /> Free Agents
              </Link>
            </>
          )}
          {league.status === 'drafting' && (
            <Link to={`/league/${id}/draft`} className="btn-gold text-sm flex items-center gap-1.5">
              <Swords size={14} /> Draft Room
            </Link>
          )}
          {isCommissioner && (
            <Link to={`/league/${id}/commissioner`} className="btn-secondary text-sm flex items-center gap-1.5">
              <Shield size={14} /> Settings
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-clubhouse-800 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              ${tab === t.key
                ? 'border-fairway-500 text-clubhouse-100'
                : 'border-transparent text-clubhouse-500 hover:text-clubhouse-300'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'standings' && (
        <Standings standings={standings} format={league.format} scoringMode={league.scoring_mode} />
      )}

      {tab === 'tournament' && (
        <TournamentScoreboard league={league} />
      )}

      {tab === 'members' && (
        <div className="grid gap-3">
          {(league.league_members || []).map((m, i) => (
            <div key={m.id} className="card flex items-center justify-between animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-clubhouse-800 flex items-center justify-center border border-clubhouse-700 text-sm font-bold text-clubhouse-400">
                  {i + 1}
                </div>
                <div>
                  <span className="font-semibold text-clubhouse-100">{m.team_name}</span>
                  <span className="text-xs text-clubhouse-500 ml-2">{m.profiles?.display_name}</span>
                  {m.user_id === league.commissioner_id && (
                    <span className="badge-gold ml-2 text-[10px]">Commissioner</span>
                  )}
                </div>
              </div>
              {m.user_id !== user?.id && myMembership && (
                <Link to={`/league/${id}/team?trade=${m.id}`}
                  className="text-xs text-clubhouse-400 hover:text-sand-400 transition-colors">
                  Propose Trade
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'trades' && (
        <div className="space-y-3">
          {trades.length === 0 ? (
            <div className="card text-center py-10 text-clubhouse-500">No trades yet</div>
          ) : trades.map((trade, i) => {
            const isReceiver = trade.receiver?.user_id === user?.id;
            const isPending = trade.status === 'proposed';
            const canApprove = isCommissioner && trade.status === 'accepted' && league.trade_review === 'commissioner';

            return (
              <div key={trade.id} className="card animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight size={14} className="text-sand-400" />
                    <span className="text-sm font-semibold text-clubhouse-200">
                      {trade.proposer?.team_name} → {trade.receiver?.team_name}
                    </span>
                  </div>
                  <span className={`badge ${
                    trade.status === 'proposed' ? 'badge-gold' :
                    trade.status === 'completed' ? 'badge-green' :
                    trade.status === 'accepted' ? 'badge-green' : 'badge-red'
                  }`}>
                    {TRADE_STATUS_LABELS[trade.status]}
                  </span>
                </div>
                {trade.message && (
                  <p className="text-xs text-clubhouse-500 italic mb-3">"{trade.message}"</p>
                )}
                <div className="flex items-center gap-4">
                  {isPending && isReceiver && (
                    <>
                      <button onClick={() => handleTradeAction(trade, 'accept')} className="btn-primary text-xs px-3 py-1.5">
                        Accept
                      </button>
                      <button onClick={() => handleTradeAction(trade, 'reject')} className="btn-danger text-xs px-3 py-1.5">
                        Reject
                      </button>
                    </>
                  )}
                  {canApprove && (
                    <>
                      <button onClick={async () => { await executeTrade(trade); await respondToTrade(trade.id, 'completed', user.id); toast.success('Trade completed!'); const { data } = await getTradesForLeague(id); setTrades(data || []); }}
                        className="btn-primary text-xs px-3 py-1.5">
                        Approve & Execute
                      </button>
                      <button onClick={() => handleTradeAction(trade, 'veto')} className="btn-danger text-xs px-3 py-1.5">
                        Veto
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
