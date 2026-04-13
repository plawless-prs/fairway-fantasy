import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchESPNLeaderboard, matchPlayersToGolfers } from '../lib/espn';
import { calculateLowballTeamScore, ordinal, getBonusBadgeColor } from '../lib/scoring';
import { getFlag } from '../lib/constants';
import { RefreshCw, Trophy, ChevronDown, ChevronUp, Minus, AlertCircle, Save, Check } from 'lucide-react';

export default function TournamentScoreboard({ league, isCommissioner = false }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [missedCutPosition, setMissedCutPosition] = useState(0);
  const [teamScores, setTeamScores] = useState([]);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadScoreboard = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch ESPN leaderboard
      const espnData = await fetchESPNLeaderboard();
      if (espnData.error) {
        setError(espnData.error);
        setLoading(false);
        return;
      }

      setTournament(espnData.tournament);
      setLeaderboard(espnData.leaderboard);
      setMissedCutPosition(espnData.missedCutPosition);

      // Fetch all golfers from our DB
      const { data: golfers } = await supabase
        .from('golfers')
        .select('*')
        .order('owgr_rank');

      // Fetch all rosters for this league
      const { data: members } = await supabase
        .from('league_members')
        .select('*, profiles(display_name), rosters(*, golfers(*))')
        .eq('league_id', league.id)
        .eq('is_active', true);

      if (!members || !golfers) {
        setError('Could not load league data');
        setLoading(false);
        return;
      }

      // Match ESPN players to our golfers
      const matchMap = new Map();
      const { matches, unmatched } = matchPlayersToGolfers(espnData.leaderboard, golfers || []);

      // Auto-add unmatched ESPN players to our golfers table
      if (unmatched.length > 0) {
        const newGolfers = unmatched.map((ep, i) => ({
          name: ep.name,
          owgr_rank: 900 + i, // placeholder rank for non-seeded players
          country: ep.country || null,
          avg_score: null,
        }));

        const { data: inserted } = await supabase
          .from('golfers')
          .upsert(newGolfers, { onConflict: 'name', ignoreDuplicates: true })
          .select();

        // Re-fetch golfers and re-match after insert
        const { data: updatedGolfers } = await supabase
          .from('golfers')
          .select('*')
          .order('owgr_rank');

        const rematch = matchPlayersToGolfers(espnData.leaderboard, updatedGolfers || []);
        // Use the updated matches
        rematch.matches.forEach(m => matchMap.set(m.golfer.id, m.espnPlayer));
      } else {
        matches.forEach(m => matchMap.set(m.golfer.id, m.espnPlayer));
      }

      // Calculate each team's score
      const scores = members.map(member => {
        const rosterGolfers = (member.rosters || []).map(r => {
          const espnPlayer = matchMap.get(r.golfer_id);
          const isPlaying = !!espnPlayer;

          return {
            golfer: r.golfers,
            rosterId: r.id,
            slotType: r.slot_type,
            // If player is in the tournament, use their leaderboard position
            // If not playing this week, treat as missed cut
            finishPosition: isPlaying ? (espnPlayer.tiedPosition || espnPlayer.position) : null,
            displayPosition: isPlaying ? espnPlayer.displayPosition : null,
            madeTheCut: isPlaying ? espnPlayer.madeTheCut : false,
            toPar: isPlaying ? espnPlayer.toPar : null,
            score: isPlaying ? espnPlayer.score : 'N/A',
            status: isPlaying
              ? (espnPlayer.isCut ? 'Cut' : espnPlayer.isWithdrawn ? 'WD' : 'Active')
              : 'Not in Field',
            isPlaying,
          };
        });

        const teamResult = calculateLowballTeamScore(
          rosterGolfers,
          espnData.missedCutPosition,
          league.lowball_counting_scores || 5
        );

        return {
          member,
          ...teamResult,
        };
      });

      // Sort by team total (ascending — lowest wins)
      scores.sort((a, b) => a.teamTotal - b.teamTotal);

      setTeamScores(scores);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadScoreboard();
  }, [league.id]);

  // Check if this tournament has already been saved
  useEffect(() => {
    if (tournament?.id) {
      supabase
        .from('lowball_tournament_scores')
        .select('id')
        .eq('league_id', league.id)
        .eq('tournament_espn_id', tournament.id)
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) setSaved(true);
        });
    }
  }, [tournament?.id, league.id]);

  const saveTournamentResults = async () => {
    if (!tournament || teamScores.length === 0) return;
    setSaving(true);

    try {
      const rows = teamScores.map(team => ({
        league_id: league.id,
        member_id: team.member.id,
        tournament_espn_id: tournament.id,
        tournament_name: tournament.name,
        season_year: new Date().getFullYear(),
        team_total: team.teamTotal,
        missed_cut_position: missedCutPosition,
        player_scores: team.players.map(p => ({
          golfer_id: p.golfer?.id,
          golfer_name: p.golfer?.name || 'Unknown',
          finish_position: p.finishPosition,
          display_position: p.displayPosition,
          base: p.base,
          bonus: p.bonus,
          bonus_label: p.bonusLabel,
          total: p.total,
          made_the_cut: p.madeTheCut,
          counting: p.counting,
          score: p.score,
        })),
      }));

      const { error: saveError } = await supabase
        .from('lowball_tournament_scores')
        .upsert(rows, { onConflict: 'league_id,member_id,tournament_espn_id' });

      if (saveError) {
        console.error('Save error:', saveError);
        alert('Error saving results: ' + saveError.message);
      } else {
        setSaved(true);
        alert('Tournament results saved to standings!');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card animate-pulse">
          <div className="h-6 w-48 bg-clubhouse-800 rounded mb-3" />
          <div className="h-4 w-64 bg-clubhouse-800 rounded" />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-16 bg-clubhouse-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-800/30 bg-red-900/10 text-center py-8">
        <AlertCircle size={24} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-300 text-sm mb-2">Could not load tournament data</p>
        <p className="text-red-400/60 text-xs mb-4">{error}</p>
        <button onClick={loadScoreboard} className="btn-secondary text-xs">
          <RefreshCw size={13} className="inline mr-1" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tournament header */}
      {tournament && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-clubhouse-100">
                {tournament.name}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-clubhouse-500">
                {tournament.venue && <span>{tournament.venue}</span>}
                {tournament.location && <span>· {tournament.location}</span>}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                  ${tournament.isComplete ? 'bg-clubhouse-800 text-clubhouse-400' :
                    'bg-fairway-900/40 text-fairway-400'}`}>
                  {tournament.isComplete ? 'Final' : tournament.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isCommissioner && (
                <button onClick={saveTournamentResults}
                  disabled={saving || saved}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${saved ? 'bg-fairway-900/30 text-fairway-400 border border-fairway-700/40' :
                      'btn-gold'}`}
                  title={saved ? 'Results already saved' : 'Save results to standings'}>
                  {saved ? <Check size={13} /> : <Save size={13} />}
                  {saving ? 'Saving...' : saved ? 'Saved' : 'Save to Standings'}
                </button>
              )}
              <button onClick={loadScoreboard}
                className="p-2 text-clubhouse-500 hover:text-white rounded-lg hover:bg-clubhouse-800 transition-colors"
                title="Refresh scores">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          {lastUpdated && (
            <p className="text-[10px] text-clubhouse-600 mt-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* Scoring legend */}
      <div className="card py-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold text-clubhouse-500 uppercase tracking-wider">Bonus Key</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: '1st: -10', bonus: -10 },
            { label: 'Top 10: -5', bonus: -5 },
            { label: 'Top 20: -3', bonus: -3 },
            { label: 'Top 30: -2', bonus: -2 },
            { label: 'Made Cut: -1', bonus: -1 },
            { label: 'Missed Cut', bonus: 0 },
          ].map(b => (
            <span key={b.label}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getBonusBadgeColor(b.bonus)}`}>
              {b.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-clubhouse-600 mt-2">
          Best 5 scores count · Position = Base Points · Lower total wins
        </p>
      </div>

      {/* Team standings */}
      {teamScores.length === 0 ? (
        <div className="card text-center py-10 text-clubhouse-500">
          No teams to score. Make sure rosters are set up.
        </div>
      ) : teamScores.map((team, rank) => {
        const isExpanded = expandedTeam === team.member.id;

        return (
          <div key={team.member.id} className="card p-0 overflow-hidden">
            {/* Team summary row */}
            <button onClick={() => setExpandedTeam(isExpanded ? null : team.member.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-clubhouse-800/30 transition-colors text-left">
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${rank === 0 ? 'bg-sand-600 text-white' :
                    rank === 1 ? 'bg-clubhouse-500 text-white' :
                    rank === 2 ? 'bg-sand-800 text-sand-300' :
                    'bg-clubhouse-800 text-clubhouse-400'}`}>
                  {rank === 0 ? <Trophy size={13} /> : rank + 1}
                </div>

                <div>
                  <span className="font-semibold text-clubhouse-100">{team.member.team_name}</span>
                  <span className="text-xs text-clubhouse-500 ml-2">{team.member.profiles?.display_name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-clubhouse-600">
                      {team.countingPlayers.length} counting · {team.players.length} total
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`font-mono text-xl font-bold
                  ${rank === 0 ? 'text-sand-400' : 'text-clubhouse-200'}`}>
                  {team.teamTotal}
                </span>
                {isExpanded ? <ChevronUp size={16} className="text-clubhouse-500" /> :
                  <ChevronDown size={16} className="text-clubhouse-500" />}
              </div>
            </button>

            {/* Expanded player breakdown */}
            {isExpanded && (
              <div className="border-t border-clubhouse-800">
                {/* Column headers */}
                <div className="flex items-center px-5 py-2 bg-clubhouse-900/50 text-[10px] font-semibold text-clubhouse-500 uppercase tracking-wider">
                  <span className="w-8 shrink-0"></span>
                  <span className="flex-1">Player</span>
                  <span className="w-16 text-center">Finish</span>
                  <span className="w-14 text-center">Base</span>
                  <span className="w-20 text-center">Bonus</span>
                  <span className="w-14 text-right">Total</span>
                </div>

                {team.players.map((p, i) => (
                  <div key={p.golfer?.id || i}
                    className={`flex items-center px-5 py-2.5 border-t border-clubhouse-800/40 transition-colors
                      ${p.counting ? 'bg-transparent' : 'bg-clubhouse-900/40 opacity-50'}`}>

                    {/* Counting indicator */}
                    <div className="w-8 shrink-0">
                      {p.counting ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-fairway-500" title="Counting" />
                      ) : (
                        <Minus size={10} className="text-clubhouse-700" />
                      )}
                    </div>

                    {/* Player name */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {p.golfer && <span className="text-xs">{getFlag(p.golfer.country)}</span>}
                      <span className={`text-sm truncate ${p.counting ? 'text-clubhouse-200 font-medium' : 'text-clubhouse-500'}`}>
                        {p.golfer?.name || 'Unknown'}
                      </span>
                      {p.isPlaying && p.score && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
                          ${p.toPar < 0 ? 'bg-fairway-900/30 text-fairway-400' :
                            p.toPar > 0 ? 'bg-red-900/20 text-red-400' :
                            'bg-clubhouse-800 text-clubhouse-400'}`}>
                          {p.score}
                        </span>
                      )}
                      {!p.isPlaying && (
                        <span className="text-[9px] text-clubhouse-600 shrink-0">NOT IN FIELD</span>
                      )}
                      {!p.counting && p.isPlaying && (
                        <span className="text-[9px] text-clubhouse-600 shrink-0">NOT COUNTING</span>
                      )}
                    </div>

                    {/* Finish position */}
                    <div className="w-16 text-center">
                      {!p.isPlaying ? (
                        <span className="text-[10px] text-clubhouse-600">N/A</span>
                      ) : !p.madeTheCut ? (
                        <span className="text-xs font-mono text-red-400">MC</span>
                      ) : (
                        <span className="text-xs font-mono text-clubhouse-300">
                          {p.displayPosition || ordinal(p.finishPosition)}
                        </span>
                      )}
                    </div>

                    {/* Base points */}
                    <div className="w-14 text-center">
                      <span className="text-xs font-mono text-clubhouse-400">{p.base}</span>
                    </div>

                    {/* Bonus badge */}
                    <div className="w-20 flex justify-center">
                      {p.bonus !== 0 ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getBonusBadgeColor(p.bonus)}`}>
                          {p.bonusLabel}
                        </span>
                      ) : (
                        <span className="text-[10px] text-red-400/60">—</span>
                      )}
                    </div>

                    {/* Total */}
                    <div className="w-14 text-right">
                      <span className={`text-sm font-mono font-bold
                        ${p.counting ? 'text-clubhouse-100' : 'text-clubhouse-600'}`}>
                        {p.total}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Team total footer */}
                <div className="flex items-center justify-between px-5 py-3 bg-clubhouse-900/60 border-t border-clubhouse-700/50">
                  <span className="text-xs font-semibold text-clubhouse-400">
                    Team Total (Best {league.lowball_counting_scores || 5})
                  </span>
                  <span className="font-mono text-lg font-bold text-clubhouse-100">
                    {team.teamTotal}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
