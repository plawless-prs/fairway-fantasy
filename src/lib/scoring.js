/**
 * ═══════════════════════════════════════════════════════════
 * SCORING ENGINE — supports Classic and Lowball modes
 * ═══════════════════════════════════════════════════════════
 */

// ─── CLASSIC SCORING (original — higher is better) ─────────

export const DEFAULT_SCORING = {
  finish: {
    "1": 30, "2": 22, "3": 18, "4": 16, "5": 14,
    "6": 12, "7": 11, "8": 10, "9": 9, "10": 8,
    "11": 7, "12": 6, "13": 6, "14": 5, "15": 5,
    "16": 4, "17": 4, "18": 3, "19": 3, "20": 3,
    "21": 2, "22": 2, "23": 2, "24": 2, "25": 2,
    "26": 2, "27": 2, "28": 2, "29": 2, "30": 2,
  },
  bonus_eagle: 2,
  bonus_hole_in_one: 5,
  bonus_all_rounds_under_par: 3,
  missed_cut: 0,
  default_finish: 1,
};

export function calculatePoints(result, scoringConfig) {
  if (!result) return 0;
  const cfg = scoringConfig || DEFAULT_SCORING;
  let pts = 0;

  if (result.finish_position === null) {
    pts += cfg.missed_cut ?? 0;
  } else if (cfg.finish[String(result.finish_position)]) {
    pts += cfg.finish[String(result.finish_position)];
  } else if (result.finish_position > 30) {
    pts += cfg.default_finish ?? 1;
  }

  pts += (result.eagles || 0) * (cfg.bonus_eagle ?? 2);
  pts += (result.holes_in_one || 0) * (cfg.bonus_hole_in_one ?? 5);
  if (result.all_rounds_under_par) {
    pts += cfg.bonus_all_rounds_under_par ?? 3;
  }

  return pts;
}


// ─── LOWBALL SCORING (position = points, lower is better) ──

/**
 * Calculate lowball points for a single golfer in a tournament
 *
 * Base points = finish position (1st = 1pt, 2nd = 2pts, etc.)
 * Missed cut = last made cut position + 1
 *
 * Bonus deductions (subtracted because lower is better):
 *   1st place:    -10
 *   2nd-10th:      -5
 *   11th-20th:     -3
 *   21st-30th:     -2
 *   Made the cut:  -1
 *
 * Returns { base, bonus, total, bonusLabel, madeTheCut }
 */
export function calculateLowballPoints(finishPosition, madeTheCut, missedCutPosition) {
  let base = 0;
  let bonus = 0;
  let bonusLabel = '';

  if (!madeTheCut || finishPosition === null || finishPosition === undefined) {
    // Missed the cut
    base = missedCutPosition || 999;
    bonusLabel = 'MC';
    return { base, bonus: 0, total: base, bonusLabel, madeTheCut: false };
  }

  // Base points = finish position
  base = finishPosition;

  // Bonus deductions
  if (finishPosition === 1) {
    bonus = -10;
    bonusLabel = '1st: -10';
  } else if (finishPosition >= 2 && finishPosition <= 10) {
    bonus = -5;
    bonusLabel = 'Top 10: -5';
  } else if (finishPosition >= 11 && finishPosition <= 20) {
    bonus = -3;
    bonusLabel = 'Top 20: -3';
  } else if (finishPosition >= 21 && finishPosition <= 30) {
    bonus = -2;
    bonusLabel = 'Top 30: -2';
  } else {
    // Made the cut but finished 31st+
    bonus = -1;
    bonusLabel = 'Made Cut: -1';
  }

  return {
    base,
    bonus,
    total: base + bonus,
    bonusLabel,
    madeTheCut: true,
  };
}

/**
 * Calculate a team's lowball score for a tournament
 *
 * Rules:
 * - Uses ALL rostered golfers (no starter/bench distinction)
 * - Only count the best (lowest) 5 scores
 * - If fewer than 5 made the cut, fill remaining with missed-cut players
 * - Missed cut points = last made cut position + 1
 *
 * @param {Array} rosterResults - array of { golfer, finishPosition, madeTheCut }
 * @param {number} missedCutPosition - position assigned to missed cut players
 * @param {number} countingScores - how many scores count (default 5)
 * @returns { players: [...scored players], teamTotal, countingPlayers }
 */
export function calculateLowballTeamScore(rosterResults, missedCutPosition, countingScores = 5) {
  if (!rosterResults || rosterResults.length === 0) {
    return { players: [], teamTotal: 0, countingPlayers: [] };
  }

  // Score each player
  const scored = rosterResults.map(r => {
    const scoring = calculateLowballPoints(r.finishPosition, r.madeTheCut, missedCutPosition);
    return {
      ...r,
      ...scoring,
    };
  });

  // Sort by total (ascending — best scores first)
  scored.sort((a, b) => a.total - b.total);

  // Take the best N scores
  const countingPlayers = scored.slice(0, countingScores);
  const nonCountingPlayers = scored.slice(countingScores);

  // Mark counting vs non-counting
  countingPlayers.forEach(p => { p.counting = true; });
  nonCountingPlayers.forEach(p => { p.counting = false; });

  const teamTotal = countingPlayers.reduce((sum, p) => sum + p.total, 0);

  return {
    players: [...countingPlayers, ...nonCountingPlayers],
    teamTotal,
    countingPlayers,
  };
}


// ─── SHARED UTILITIES ──────────────────────────────────────

export function ordinal(n) {
  if (!n && n !== 0) return 'MC';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getPointsBreakdown(result, scoringConfig) {
  const cfg = scoringConfig || DEFAULT_SCORING;
  const parts = [];

  if (result.finish_position === null) {
    parts.push(`MC: ${cfg.missed_cut} pts`);
  } else {
    const fp = cfg.finish[String(result.finish_position)] ?? cfg.default_finish ?? 1;
    parts.push(`${ordinal(result.finish_position)}: ${fp} pts`);
  }

  if (result.eagles > 0) {
    parts.push(`${result.eagles} eagle${result.eagles > 1 ? 's' : ''}: +${result.eagles * cfg.bonus_eagle}`);
  }
  if (result.holes_in_one > 0) {
    parts.push(`${result.holes_in_one} ace${result.holes_in_one > 1 ? 's' : ''}: +${result.holes_in_one * cfg.bonus_hole_in_one}`);
  }
  if (result.all_rounds_under_par) {
    parts.push(`All rounds under par: +${cfg.bonus_all_rounds_under_par}`);
  }

  return parts.join(' | ');
}

/**
 * Get a color class for a bonus badge based on the bonus value
 */
export function getBonusBadgeColor(bonus) {
  if (bonus <= -10) return 'bg-sand-600/30 text-sand-300 border-sand-600/40';      // 1st
  if (bonus <= -5)  return 'bg-fairway-700/30 text-fairway-300 border-fairway-600/40'; // top 10
  if (bonus <= -3)  return 'bg-fairway-800/30 text-fairway-400 border-fairway-700/30'; // top 20
  if (bonus <= -2)  return 'bg-clubhouse-700/40 text-clubhouse-300 border-clubhouse-600/40'; // top 30
  if (bonus <= -1)  return 'bg-clubhouse-800/40 text-clubhouse-400 border-clubhouse-700/40'; // made cut
  return 'bg-red-900/30 text-red-400 border-red-800/40'; // missed cut
}
