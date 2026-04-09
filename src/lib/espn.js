/**
 * ESPN PGA Tour API integration
 * Uses ESPN's public scoreboard endpoints (no API key needed)
 *
 * Actual ESPN competitor structure:
 * {
 *   id: "9938",
 *   order: 1,                          // <-- leaderboard position
 *   athlete: { displayName, fullName, shortName, flag: { alt } },
 *   score: "-5",                        // <-- to-par score string
 *   linescores: [ { value: 67, period: 1, ... }, { period: 2 } ],
 *   statistics: []
 * }
 *
 * - `order` = current leaderboard ranking (1 = leader)
 * - A completed round has `linescores[n].value` as the stroke total
 * - A future/incomplete round has just `{ period: N }` with no value
 * - After the cut, players who miss have `score` like "CUT" or may
 *   not appear. We detect cut by checking if later rounds are absent
 *   after a cut round.
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga';

/**
 * Fetch current/recent tournament scoreboard from ESPN
 */
export async function fetchESPNLeaderboard(tournamentId = null) {
  try {
    const url = tournamentId
      ? `${ESPN_BASE}/scoreboard?event=${tournamentId}`
      : `${ESPN_BASE}/scoreboard`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
    const data = await res.json();

    if (!data.events || data.events.length === 0) {
      return { error: 'No active tournament found', tournament: null, leaderboard: [], missedCutPosition: 0 };
    }

    const event = data.events[0];
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];

    // Figure out tournament status from the competition object
    const statusObj = competition?.status || {};
    const statusType = statusObj?.type || {};

    const tournament = {
      id: event.id,
      name: event.name || event.shortName || 'PGA Tournament',
      shortName: event.shortName || '',
      startDate: event.date,
      endDate: event.endDate,
      status: statusType.description || statusType.detail || statusObj.detail || 'In Progress',
      isComplete: statusType.completed || false,
      currentRound: statusObj.period || 0,
      venue: event.courses?.[0]?.name || '',
      location: event.courses?.[0]?.address?.city
        ? `${event.courses[0].address.city}, ${event.courses[0].address.state || event.courses[0].address.country || ''}`
        : '',
    };

    // Determine how many rounds have been completed for the tournament
    // (useful for detecting cut — typically after round 2)
    const totalRounds = 4; // Standard PGA event

    // Parse each competitor
    const leaderboard = competitors.map(c => {
      const athlete = c.athlete || {};
      const name = athlete.displayName || athlete.fullName || 'Unknown';
      const country = athlete.flag?.alt || '';
      const scoreStr = c.score || '';
      const order = c.order || 999;

      // Determine completed rounds from linescores
      const completedRounds = (c.linescores || []).filter(ls => ls.value !== undefined && ls.value !== null);
      const totalCompletedRounds = completedRounds.length;

      // Parse the score string
      let toPar = 0;
      if (scoreStr === 'E') {
        toPar = 0;
      } else if (scoreStr === 'CUT' || scoreStr === 'MC' || scoreStr === 'WD' || scoreStr === 'DQ') {
        toPar = null;
      } else {
        const parsed = parseInt(scoreStr);
        if (!isNaN(parsed)) toPar = parsed;
      }

      // Detect if player missed the cut
      // Indicators: score string is "CUT"/"MC", or type contains cut info
      const isCut = scoreStr === 'CUT' || scoreStr === 'MC' ||
                    c.status?.type?.name === 'cut' ||
                    c.status?.type?.description === 'Cut';
      const isWithdrawn = scoreStr === 'WD' || c.status?.type?.description === 'Withdrawn';
      const isDisqualified = scoreStr === 'DQ' || c.status?.type?.description === 'Disqualified';
      const madeTheCut = !isCut && !isWithdrawn && !isDisqualified;

      return {
        espnId: c.id || athlete.id,
        name,
        country,
        position: order,
        displayPosition: String(order),
        score: scoreStr,
        toPar,
        totalCompletedRounds,
        madeTheCut,
        isCut,
        isWithdrawn,
        isDisqualified,
        rounds: completedRounds.map(ls => ({
          round: ls.period,
          strokes: ls.value,
          displayScore: ls.displayValue || String(ls.value),
        })),
      };
    });

    // Sort by order (leaderboard position)
    leaderboard.sort((a, b) => a.position - b.position);

    // ── Calculate tie-aware positions ──
    // Players with the same score share the same position
    // e.g., if 3 players are tied at -5 starting at order 1, they all get position 1 (T1)
    // The next group starts at position 4
    const activePlayers = leaderboard.filter(p => p.madeTheCut);
    let currentTiePosition = 1;
    for (let i = 0; i < activePlayers.length; i++) {
      if (i === 0) {
        currentTiePosition = 1;
      } else if (activePlayers[i].score !== activePlayers[i - 1].score) {
        // Different score than previous player — position = i + 1
        currentTiePosition = i + 1;
      }
      // else: same score as previous — keep currentTiePosition
      activePlayers[i].tiedPosition = currentTiePosition;

      const playersAtThisScore = activePlayers.filter(p => p.score === activePlayers[i].score);
      activePlayers[i].isTied = playersAtThisScore.length > 1;
      activePlayers[i].displayPosition = activePlayers[i].isTied
        ? `T${currentTiePosition}`
        : String(currentTiePosition);
    }

    // For cut/WD/DQ players, tiedPosition stays as their order (doesn't matter for scoring)
    leaderboard.filter(p => !p.madeTheCut).forEach(p => {
      p.tiedPosition = p.position;
      p.isTied = false;
    });

    // Calculate missed cut position
    // = the tied position of the last player who made the cut, + 1
    let lastMadeCutPosition = 0;
    for (const player of leaderboard) {
      if (player.madeTheCut && (player.tiedPosition || player.position) > lastMadeCutPosition) {
        lastMadeCutPosition = player.tiedPosition || player.position;
      }
      }
    
    // If nobody has been cut yet (e.g., round 1), missedCutPosition = total players + 1
    const anyoneCut = leaderboard.some(p => p.isCut);
    const missedCutPosition = anyoneCut
      ? lastMadeCutPosition + 1
      : leaderboard.length + 1;

    return {
      tournament,
      leaderboard,
      missedCutPosition,
      error: null,
    };
  } catch (err) {
    console.error('ESPN fetch error:', err);
    return { error: err.message, tournament: null, leaderboard: [], missedCutPosition: 0 };
  }
}

/**
 * Match ESPN leaderboard players to our golfers database by name
 * Uses fuzzy matching: exact match first, then last-name match
 * Returns { matches, unmatched } where unmatched are ESPN players not in our DB
 */
export function matchPlayersToGolfers(leaderboard, golfers) {
  const matches = [];
  const unmatched = [];
  const matched = new Set();

  for (const espnPlayer of leaderboard) {
    const espnName = espnPlayer.name.toLowerCase().trim();

    // Exact match
    let golfer = golfers.find(g =>
      !matched.has(g.id) && g.name.toLowerCase().trim() === espnName
    );

    // Last name match (if ESPN name has a last name that matches)
    if (!golfer) {
      const espnParts = espnName.split(' ');
      const espnLast = espnParts[espnParts.length - 1];
      if (espnLast.length > 2) {
        const candidates = golfers.filter(g => {
          if (matched.has(g.id)) return false;
          const gParts = g.name.toLowerCase().split(' ');
          const gLast = gParts[gParts.length - 1];
          return gLast === espnLast;
        });
        // Only use if exactly one candidate to avoid false matches
        if (candidates.length === 1) golfer = candidates[0];
      }
    }

    if (golfer) {
      matched.add(golfer.id);
      matches.push({ golfer, espnPlayer });
    } else {
      unmatched.push(espnPlayer);
    }
  }

  return { matches, unmatched };
}
