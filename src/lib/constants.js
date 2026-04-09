export const ROSTER_LOCK_OPTIONS = [
  { value: 'round_start', label: 'Lock at Round Start' },
  { value: 'tournament_start', label: 'Lock at Tournament Start' },
  { value: 'none', label: 'No Lock' },
];

export const TRADE_REVIEW_OPTIONS = [
  { value: 'commissioner', label: 'Commissioner Approval' },
  { value: 'league_vote', label: 'League Vote' },
  { value: 'instant', label: 'Instant (No Review)' },
];

export const WAIVER_OPTIONS = [
  { value: 'inverse_standings', label: 'Inverse Standings Priority' },
  { value: 'first_come', label: 'First Come, First Served' },
  { value: 'faab', label: 'Free Agent Acquisition Budget (FAAB)' },
];

export const FORMAT_OPTIONS = [
  { value: 'season_long', label: 'Season Long (Cumulative Points)' },
  { value: 'head_to_head', label: 'Head-to-Head (Weekly Matchups)' },
];

export const SCORING_MODE_OPTIONS = [
  { value: 'classic', label: 'Classic (Higher Points = Better)' },
  { value: 'lowball', label: 'Lowball (Lower Points = Better, Top 5 Count)' },
];

export const DRAFT_OPTIONS = [
  { value: 'snake', label: 'Snake Draft' },
  { value: 'auction', label: 'Auction Draft' },
  { value: 'autopick', label: 'Auto-Pick (by OWGR)' },
];

// Country code → flag emoji
const COUNTRY_FLAGS = {
  USA: '🇺🇸', NIR: '🇬🇧', SWE: '🇸🇪', ESP: '🇪🇸', JPN: '🇯🇵',
  NOR: '🇳🇴', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', IRL: '🇮🇪', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', KOR: '🇰🇷',
  CHI: '🇨🇱', CAN: '🇨🇦', AUT: '🇦🇹', AUS: '🇦🇺', GER: '🇩🇪',
  RSA: '🇿🇦', BEL: '🇧🇪', FRA: '🇫🇷', ITA: '🇮🇹', COL: '🇨🇴',
  ARG: '🇦🇷', MEX: '🇲🇽', CHN: '🇨🇳', IND: '🇮🇳', THA: '🇹🇭',
  WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', FIN: '🇫🇮', DEN: '🇩🇰', NED: '🇳🇱', NZL: '🇳🇿',
};

export function getFlag(country) {
  return COUNTRY_FLAGS[country] || '🏳️';
}

export const LEAGUE_STATUS_LABELS = {
  setup: 'Setting Up',
  drafting: 'Drafting',
  active: 'Active',
  completed: 'Completed',
};

export const TRADE_STATUS_LABELS = {
  proposed: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  vetoed: 'Vetoed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
