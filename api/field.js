/**
 * Serverless proxy that returns the field (list of players) for the current major.
 *
 * Prefers each major's OWN official data feed for accuracy, falling back to
 * ESPN's competitor list. Runs server-side to avoid browser CORS restrictions
 * on the official feeds (mirrors the api/keep-alive.js pattern).
 *
 * Response shape (always HTTP 200 so the client can read the payload):
 *   { eventName, isMajor, source: 'theopen'|'espn'|null, players: [{name, firstName, lastName}], error }
 */

const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

// Official per-major field feeds. Each major runs its own (undocumented) feed;
// only The Open is wired up so far — the others fall through to the ESPN
// fallback until their feeds are discovered during their event weeks.
const OFFICIAL_FEEDS = [
  {
    key: 'theopen',
    // Matches "The Open" / "Open Championship" but NOT "U.S. Open".
    matches: (name) =>
      /open championship|the open/.test(name) && !/u\.?s\.? open/.test(name),
    async fetchField() {
      const res = await fetch(
        'https://scoring.theopen.com/scoring?feedType=traditional',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Origin: 'https://www.theopen.com',
            Referer: 'https://www.theopen.com/',
          },
        }
      );
      if (!res.ok) throw new Error(`The Open feed error: ${res.status}`);
      const data = await res.json();
      const players = (data.players || [])
        .filter((p) => p.firstName && p.lastName)
        .map((p) => ({
          firstName: p.firstName,
          lastName: p.lastName,
          name: `${p.firstName} ${p.lastName}`.trim(),
        }));
      if (players.length === 0) throw new Error('The Open feed returned no players');
      return players;
    },
  },
];

// Same majors-only gate used in src/lib/espn.js — keep in sync.
function isMajorName(name) {
  const n = (name || '').toLowerCase();
  return (
    n.includes('masters') ||
    n.includes('pga championship') ||
    n.includes('u.s. open') ||
    n.includes('us open') ||
    n.includes('open championship') ||
    n.includes('the open')
  );
}

export default async function handler(req, res) {
  try {
    // 1. Detect the current event via ESPN (also our fallback field source).
    const espnRes = await fetch(ESPN_SCOREBOARD);
    if (!espnRes.ok) throw new Error(`ESPN API error: ${espnRes.status}`);
    const espn = await espnRes.json();

    const event = espn.events?.[0];
    if (!event) {
      return res.status(200).json({
        eventName: null,
        isMajor: false,
        source: null,
        players: [],
        error: 'No active tournament',
      });
    }

    const eventName = event.name || event.shortName || '';
    if (!isMajorName(eventName)) {
      return res.status(200).json({
        eventName,
        isMajor: false,
        source: null,
        players: [],
        error: 'Current event is not a major',
      });
    }

    // 2. Prefer the major's official feed when we have one wired up.
    const feed = OFFICIAL_FEEDS.find((f) => f.matches(eventName.toLowerCase()));
    if (feed) {
      try {
        const players = await feed.fetchField();
        return res.status(200).json({
          eventName,
          isMajor: true,
          source: feed.key,
          players,
          error: null,
        });
      } catch (err) {
        // Official feed failed — fall through to the ESPN competitor list.
        console.error('Official feed failed, falling back to ESPN:', err.message);
      }
    }

    // 3. Fallback: ESPN competitor list for the current major.
    const competitors = event.competitions?.[0]?.competitors || [];
    const players = competitors
      .map((c) => {
        const a = c.athlete || {};
        const name = a.displayName || a.fullName || '';
        return name
          ? { name, firstName: a.firstName || '', lastName: a.lastName || '' }
          : null;
      })
      .filter(Boolean);

    return res.status(200).json({
      eventName,
      isMajor: true,
      source: 'espn',
      players,
      error: null,
    });
  } catch (err) {
    console.error('field.js error:', err);
    return res.status(200).json({
      eventName: null,
      isMajor: false,
      source: null,
      players: [],
      error: err.message,
    });
  }
}
