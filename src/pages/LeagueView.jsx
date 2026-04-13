import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';
import { useRoster } from '../hooks/useRoster';
import { supabase } from '../lib/supabase';
import { LEAGUE_STATUS_LABELS, TRADE_STATUS_LABELS } from '../lib/constants';
import { ordinal, getBonusBadgeColor } from '../lib/scoring';
import { getFlag } from '../lib/constants';
import TournamentScoreboard from '../components/TournamentScoreboard';
import toast from 'react-hot-toast';
import {
  BarChart3, Users, ArrowLeftRight, ClipboardList, Settings,
  Copy, UserPlus, Swords, Shield, Trophy, History, ChevronDown, ChevronUp
} from 'lucide-react';

const TABS = [
  { key: 'standings', label: 'Standings', icon: <Trophy size={15} /> },
  { key: 'tournament', label: 'Live Tournament', icon: <BarChart3 size={15} /> },
  { key: 'history', label: 'Past Tournaments', icon: <History size={15} /> },
  { key: 'members', label: 'Teams', icon: <Users size={15} /> },
  { key: 'trades', label: 'Trades', icon: <ArrowLeftRight size={15} /> },
];

export default function LeagueView() {
  const { id } = useParams();
  const { user } = useAuth();
  const { getLeague } = useLeague();
  const { getTradesForLeague, respondToTrade, executeTrade } = useRoster();
  const [league, setLeague] = useState(null);
  const [trades, setTrades] = useState([]);
  const [tab, setTab] = useState('standings');
  const [loading, setLoading] = useState(true);

  // Standings from saved tournament scores
  const [standings, setStandings] = useState([]);
  const [savedTournaments, setSavedTournaments] = useState([]);
  const [expandedTournament, setExpandedTournament] = useState(null);
  const [tournamentDetails, setTournamentDetails] = useState({});

  const isCommissioner = league?.commissioner_id === user?.id;
  const myMembership = league?.league_members?.find(m => m.user_id === user?.id);

  useEffect(() => {
    async function load() {
      const { data } = await getLeague(id);
      setLeague(data);
      if (data) {
        const { data: tradesData } = await getTradesForLeague(id);
        setTrades(tradesData || []);
        await loadStandings(id);
        await loadSavedTournaments(id);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const loadStandings = async (leagueId) => {
    // Aggregate saved tournament scores by team
    const { data: scores } = await supabase
      .from('lowball_tournament_scores')
      .select('member_id, team_total, tournament_name, league_members(team_name, user_id, profiles(display_name))')
      .eq('league_id', leagueId)
      .order('created_at');

    if (!scores || scores.length === 0) {
      setStandings([]);
      return;
    }

    // Group by member and sum totals
    const memberMap = new Map();
    for (const s of scores) {
      if (!memberMap.has(s.member_id)) {
        memberMap.set(s.member_id, {
          member_id: s.member_id,
          team_name: s.league_members?.team_name || 'Unknown',
          display_name: s.league_members?.profiles?.display_name || '',
          total_points: 0,
          tournaments_played: 0,
        });
      }
      const entry = memberMap.get(s.member_id);
      entry.total_points += s.team_total;
      entry.tournaments_played += 1;
    }

    // Sort by total (ascending for lowball)
    const sorted = Array.from(memberMap.values());
    sorted.sort((a, b) => a.total_points - b.total_points);

    setStandings(sorted);
  };

  const loadSavedTournaments = async (leagueId) => {
    // Get distinct tournaments
    const { data } = await supabase
      .from('lowball_tournament_scores')
      .select('tournament_espn_id, tournament_name, season_year, created_at')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });

    if (!data) return;

    // Deduplicate by tournament
    const seen = new Set();
    const tournaments = [];
    for (const row of data) {
      if (!seen.has(row.tournament_espn_id)) {
        seen.add(row.tournament_espn_id);
        tournaments.push(row);
      }
    }
    setSavedTournaments(tournaments);
  };

  const loadTournamentDetails = async (tournamentEspnId) => {
    if (tournamentDetails[tournamentEspnId]) return; // already loaded

    const { data } = await supabase
      .from('lowball_tournament_scores')
      .select('*, league_members(team_name, profiles(display_name))')
      .eq('league_id', id)
      .eq('tournament_espn_id', tournamentEspnId)
      .order('team_total');

    setTournamentDetails(prev => ({ ...prev, [tournamentEspnId]: data || [] }));
  };

  const toggleTournament = async (tournamentEspnId) => {
    if (expandedTournament === tournamentEspnId) {
      setExpandedTournament(null);
    } else {
      setExpandedTournament(tournamentEspnId);
      await loadTournamentDetails(tournamentEspnId);
    }
  };

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
  const isLowball = league.scoring_mode === 'lowball';

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

      {/* ════════ Standings Tab ════════ */}
      {tab === 'standings' && (
        <div className="space-y-4">
          {standings.length === 0 ? (
            <div className="card text-center py-10 text-clubhouse-500">
              No standings yet. {isCommissioner ? 'Save tournament results from the Live Tournament tab to populate standings.' : 'Standings will appear once the commissioner saves tournament results.'}
            </div>
          ) : (
            <>
              <div className="card p-3">
                <p className="text-xs text-clubhouse-500">
                  {isLowball ? 'Lowball scoring — lowest total wins' : 'Classic scoring — highest total wins'}
                  {' · '}{savedTournaments.length} tournament{savedTournaments.length !== 1 ? 's' : ''} scored
                </p>
              </div>
              <div className="card overflow-hidden p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-clubhouse-800 bg-clubhouse-900/50">
                      <th className="table-header w-12">#</th>
                      <th className="table-header">Team</th>
                      <th className="table-header text-right">Tournaments</th>
                      <th className="table-header text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((team, idx) => (
                      <tr key={team.member_id}
                        className={`border-b border-clubhouse-800/50 hover:bg-clubhouse-800/30 transition-colors
                          ${idx === 0 ? 'bg-sand-900/10' : ''}`}>
                        <td className="table-cell">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                            ${idx === 0 ? 'bg-sand-600 text-white' :
                              idx === 1 ? 'bg-clubhouse-500 text-white' :
                              idx === 2 ? 'bg-sand-800 text-sand-300' :
                              'bg-clubhouse-800 text-clubhouse-400'}`}>
                            {idx === 0 ? <Trophy size={12} /> : idx + 1}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="font-semibold text-clubhouse-100">{team.team_name}</span>
                          <span className="text-xs text-clubhouse-500 ml-2">{team.display_name}</span>
                        </td>
                        <td className="table-cell text-right">
                          <span className="text-sm text-clubhouse-400">{team.tournaments_played}</span>
                        </td>
                        <td className="table-cell text-right">
                          <span className={`font-mono text-lg font-bold ${idx === 0 ? 'text-sand-400' : 'text-clubhouse-200'}`}>
                            {team.total_points}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════ Live Tournament Tab ════════ */}
      {tab === 'tournament' && (
        <TournamentScoreboard league={league} isCommissioner={isCommissioner} />
      )}

      {/* ════════ Past Tournaments Tab ════════ */}
      {tab === 'history' && (
        <div className="space-y-3">
          {savedTournaments.length === 0 ? (
            <div className="card text-center py-10 text-clubhouse-500">
              No past tournaments yet. Results will appear here once the commissioner saves them.
            </div>
          ) : savedTournaments.map(t => {
            const isExpanded = expandedTournament === t.tournament_espn_id;
            const details = tournamentDetails[t.tournament_espn_id] || [];

            return (
              <div key={t.tournament_espn_id} className="card p-0 overflow-hidden">
                <button onClick={() => toggleTournament(t.tournament_espn_id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-clubhouse-800/30 transition-colors text-left">
                  <div>
                    <h3 className="font-display text-lg font-bold text-clubhouse-100">{t.tournament_name}</h3>
                    <p className="text-xs text-clubhouse-500 mt-0.5">{t.season_year}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-clubhouse-500" /> :
                    <ChevronDown size={16} className="text-clubhouse-500" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-clubhouse-800">
                    {details.length === 0 ? (
                      <div className="p-4 text-center text-sm text-clubhouse-500 animate-pulse">Loading...</div>
                    ) : details.map((team, rank) => (
                      <TournamentHistoryTeam key={team.id} team={team} rank={rank} isLowball={isLowball} league={league} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════════ Members Tab ════════ */}
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

      {/* ════════ Trades Tab ════════ */}
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


// ─── Past Tournament Team Detail ─────────────────────────────
function TournamentHistoryTeam({ team, rank, isLowball, league }) {
  const [expanded, setExpanded] = useState(false);
  const players = team.player_scores || [];

  return (
    <div className="border-b border-clubhouse-800/50 last:border-b-0">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-clubhouse-800/20 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${rank === 0 ? 'bg-sand-600 text-white' :
              rank === 1 ? 'bg-clubhouse-500 text-white' :
              rank === 2 ? 'bg-sand-800 text-sand-300' :
              'bg-clubhouse-800 text-clubhouse-400'}`}>
            {rank === 0 ? <Trophy size={11} /> : rank + 1}
          </div>
          <div>
            <span className="font-semibold text-clubhouse-100 text-sm">{team.league_members?.team_name}</span>
            <span className="text-xs text-clubhouse-500 ml-2">{team.league_members?.profiles?.display_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-lg font-bold ${rank === 0 ? 'text-sand-400' : 'text-clubhouse-200'}`}>
            {team.team_total}
          </span>
          {expanded ? <ChevronUp size={14} className="text-clubhouse-600" /> :
            <ChevronDown size={14} className="text-clubhouse-600" />}
        </div>
      </button>

      {expanded && players.length > 0 && (
        <div className="px-5 pb-3">
          <div className="flex items-center px-2 py-1.5 text-[10px] font-semibold text-clubhouse-500 uppercase tracking-wider">
            <span className="w-6"></span>
            <span className="flex-1">Player</span>
            <span className="w-14 text-center">Finish</span>
            <span className="w-12 text-center">Base</span>
            <span className="w-18 text-center">Bonus</span>
            <span className="w-12 text-right">Total</span>
          </div>
          {players.map((p, i) => (
            <div key={i}
              className={`flex items-center px-2 py-1.5 rounded text-sm
                ${p.counting ? '' : 'opacity-40'}`}>
              <div className="w-6">
                {p.counting ? (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-fairway-500" />
                ) : (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-clubhouse-700" />
                )}
              </div>
              <span className={`flex-1 truncate ${p.counting ? 'text-clubhouse-200' : 'text-clubhouse-500'}`}>
                {p.golfer_name}
              </span>
              <span className="w-14 text-center text-xs font-mono text-clubhouse-400">
                {p.made_the_cut ? (p.display_position || ordinal(p.finish_position)) : 'MC'}
              </span>
              <span className="w-12 text-center text-xs font-mono text-clubhouse-400">
                {p.base}
              </span>
              <span className="w-18 flex justify-center">
                {p.bonus !== 0 ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${getBonusBadgeColor(p.bonus)}`}>
                    {p.bonus_label}
                  </span>
                ) : (
                  <span className="text-[10px] text-clubhouse-600">—</span>
                )}
              </span>
              <span className={`w-12 text-right text-xs font-mono font-bold ${p.counting ? 'text-clubhouse-100' : 'text-clubhouse-600'}`}>
                {p.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
