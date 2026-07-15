/**
 * Client helpers for the current major's field.
 *
 * Talks to the /api/field serverless proxy (see api/field.js), which prefers
 * each major's official feed and falls back to ESPN. Provides name-matching to
 * annotate our `golfers` rows with whether they're in the field — mirroring the
 * exact-then-unique-last-name approach in lib/espn.js (matchPlayersToGolfers).
 */

export async function fetchField() {
  try {
    const res = await fetch('/api/field');
    if (!res.ok) throw new Error(`Field API error: ${res.status}`);
    // { eventName, isMajor, source, players, error }
    return await res.json();
  } catch (err) {
    console.error('fetchField error:', err);
    return {
      eventName: null,
      isMajor: false,
      source: null,
      players: [],
      error: err.message,
    };
  }
}

// Lowercase, strip accents, collapse whitespace — so "Nicolás" == "Nicolas".
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

// Build lookup structures from the field player list.
function buildFieldIndex(players) {
  const fullNames = new Set();
  const byLastName = new Map(); // last name -> [first name, ...]
  for (const p of players) {
    const full = norm(p.name);
    if (full) fullNames.add(full);
    const parts = full.split(' ');
    const last = norm(p.lastName) || parts[parts.length - 1];
    const first = norm(p.firstName) || parts[0];
    if (last) {
      if (!byLastName.has(last)) byLastName.set(last, []);
      byLastName.get(last).push(first);
    }
  }
  return { fullNames, byLastName };
}

// First names are "compatible" if equal or one is a prefix of the other, so
// nickname/abbreviation forms match (Matt/Matthew, Nick/Nicholas) but genuinely
// different names (Cam/Jordan) do not.
function firstNamesCompatible(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 3 && longer.startsWith(shorter);
}

// Decide whether a single golfer is in the field:
// exact full-name match, then a last-name match only when that last name is
// unique in the field AND the first names are compatible (avoids matching a
// different person who happens to share a surname, e.g. Cam vs Jordan Davis).
function golferInField(golfer, index) {
  const full = norm(golfer.name);
  if (index.fullNames.has(full)) return true;
  const parts = full.split(' ');
  const last = parts[parts.length - 1];
  const first = parts[0];
  if (last && last.length > 2) {
    const firsts = index.byLastName.get(last);
    if (firsts && firsts.length === 1 && firstNamesCompatible(first, firsts[0])) {
      return true;
    }
  }
  return false;
}

/**
 * Annotate golfers with an `inField` boolean.
 * If the field is unknown (fetch failed, not a major, or empty), returns every
 * golfer with `inField = null` so callers can treat field-filtering as
 * unavailable rather than hiding everyone.
 */
export function annotateFieldStatus(golfers, field) {
  const players = field?.players || [];
  if (!field || !field.isMajor || players.length === 0) {
    return golfers.map((g) => ({ ...g, inField: null }));
  }
  const index = buildFieldIndex(players);
  return golfers.map((g) => ({ ...g, inField: golferInField(g, index) }));
}
