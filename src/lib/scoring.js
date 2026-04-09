/**
 * Calculate fantasy points for a single golfer's tournament result
 */
export function calculatePoints(result, scoringConfig) {
  if (!result) return 0;

  const cfg = scoringConfig || DEFAULT_SCORING;
  let pts = 0;

  // Finish position points
  if (result.finish_position === null) {
    pts += cfg.missed_cut ?? 0;
  } else if (cfg.finish[String(result.finish_position)]) {
    pts += cfg.finish[String(result.finish_position)];
  } else if (result.finish_position > 30) {
    pts += cfg.default_finish ?? 1;
  }

  // Bonuses
  pts += (result.eagles || 0) * (cfg.bonus_eagle ?? 2);
  pts += (result.holes_in_one || 0) * (cfg.bonus_hole_in_one ?? 5);
  if (result.all_rounds_under_par) {
    pts += cfg.bonus_all_rounds_under_par ?? 3;
  }

  return pts;
}

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

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export function ordinal(n) {
  if (!n) return 'MC';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Points breakdown label
 */
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
