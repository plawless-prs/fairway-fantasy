# CLAUDE.md

Guidance for working in the **Fairway Fantasy** codebase — a fantasy golf league manager.

## Overview

React + Vite SPA backed by Supabase (Postgres + Auth + RLS), deployed on Vercel.
Users create leagues, draft PGA golfers, manage rosters, and are scored against
real major-championship results pulled live from ESPN's public API.

The app is currently wired for **Lowball scoring over the four majors only** — this
is the primary/active scoring path even though a legacy "Classic" scoring engine
still exists in the code and database.

## Tech Stack

- **Frontend**: React 18, React Router v6, Tailwind CSS v3, `lucide-react` icons, `react-hot-toast`
- **Build**: Vite 5 (`npm run dev` / `build` / `preview`)
- **Backend**: Supabase — Postgres, Auth (email/password), Row Level Security, PostgREST client (`@supabase/supabase-js`)
- **Serverless**: Vercel functions in `api/` (`keep-alive.js`, `field.js`, `notify-waiver.js`)
- **Email**: Resend (waiver-claim notifications, via `api/notify-waiver.js`)
- **Hosting**: Vercel (SPA rewrite + cron in `vercel.json`)

## Running Locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Requires a `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. These are
also read by the serverless functions via `process.env` (note: the keep-alive
function uses the same `VITE_`-prefixed names, set them in Vercel project settings).

**Server-only env vars** (set in Vercel project settings, never `VITE_`-prefixed
so they stay off the client) — needed by `api/notify-waiver.js`:

- `SUPABASE_SERVICE_ROLE_KEY` — service role key; reads `auth.users` (the
  commissioner's email) and bypasses RLS. **Never expose client-side.**
- `RESEND_API_KEY` — Resend API key for sending the waiver email.
- `RESEND_FROM` — verified sender, e.g. `Fairway Fantasy <noreply@domain>`;
  defaults to Resend's `onboarding@resend.dev` sandbox sender (which can only
  email your own Resend account address until a domain is verified).

There is no test suite, linter config, or typechecker in this project. "Verifying"
a change means running `npm run dev` and exercising the flow in the browser.

**Dev gotcha — `api/` functions under `npm run dev`:** plain Vite does not run
the Vercel functions in `api/`. `vite.config.js` includes a dev-only plugin
(`devApiPlugin`) that serves `api/*.js` during `npm run dev` so `/api/field`
etc. work locally. It adapts a Node req/res to the `(req, res)` handler
signature. Changing `vite.config.js` requires a dev-server restart. (Without the
plugin — or under a stale server — `/api/field` returns nothing and the Free
Agents field filter silently disables itself, showing all players.)

## Architecture

```
src/
├── main.jsx              # React root
├── App.jsx               # Router + AuthProvider + Toaster; all routes defined here
├── hooks/                # Data-access layer (all Supabase calls live here)
│   ├── useAuth.jsx       # AuthContext provider + useAuth(); session, profile, sign in/up/out
│   ├── useLeague.jsx     # league CRUD, join, standings RPC
│   └── useRoster.jsx     # rosters, free agents, trades, waivers, golfers
├── lib/
│   ├── supabase.js       # singleton Supabase client
│   ├── scoring.js        # BOTH scoring engines (Classic + Lowball) + helpers
│   ├── espn.js           # ESPN leaderboard fetch, cut detection, name→golfer matching
│   ├── field.js          # /api/field client + name-match to flag golfers inField
│   ├── notify.js         # client trigger for server-side notifications (waiver email)
│   └── constants.js      # dropdown option lists, country flags, status labels
├── pages/                # route-level screens (one per URL)
│   ├── Home, Login, Dashboard, LeagueCreate, LeagueView,
│   │   MyTeam, FreeAgents, Draft, Commissioner
├── components/           # reusable UI (Layout, Navbar, PlayerCard, RosterSlot,
│   │                       Standings, TradeModal, DraftBoard, TournamentScoreboard)
└── styles/globals.css    # Tailwind layers + component classes (.card, .btn-*, .badge-*)

api/keep-alive.js         # Vercel cron target — pings Supabase to prevent free-tier pause
api/field.js              # field proxy — official major feed (The Open) → ESPN fallback
api/notify-waiver.js      # emails the commissioner (Resend) on a new waiver claim
supabase/migrations/      # 001_initial_schema.sql (see "Schema drift" caveat below)
```

### Data flow

- **All database access goes through the `hooks/` and `lib/` layers** — pages and
  components import `supabase` or a hook, never construct queries ad hoc elsewhere.
  When adding a data operation, put it in the relevant hook, not inline in a page.
- **Auth** is a React context (`AuthProvider` in `App.jsx`). `ProtectedRoute`
  gates authenticated routes and redirects to `/login`.
- **Routing** is entirely in `App.jsx`. League-scoped screens live under
  `/league/:id/...` (team, free-agents, draft, commissioner).
- **Security** is enforced by Postgres RLS policies (see the migration), not in
  the client. Assume the client is untrusted; policies restrict rows to league
  members, roster owners, and commissioners.

### Live scoring pipeline (the important part)

1. `TournamentScoreboard` calls `fetchESPNLeaderboard()` (`lib/espn.js`), which
   hits ESPN's public PGA scoreboard endpoint — **no API key**.
2. `espn.js` filters to **majors only** (Masters, PGA Championship, U.S. Open,
   Open Championship). Any non-major event returns an error and scoring is idle.
3. ESPN players are matched to the `golfers` table by name via
   `matchPlayersToGolfers()` (exact match, then unique last-name match). Unmatched
   ESPN players are auto-inserted into `golfers` with placeholder ranks (900+).
4. Each team's roster is scored with `calculateLowballTeamScore()` (`lib/scoring.js`).
5. The commissioner clicks **Save to Standings**, persisting a snapshot per team
   into `lowball_tournament_scores`. Cumulative standings and the "Past
   Tournaments" tab read back from that table (see `LeagueView.jsx`).

Scores are recomputed client-side on each load; the saved rows are point-in-time
snapshots including per-player breakdowns (`player_scores` JSON).

### Free Agents: field & roster filtering (`FreeAgents.jsx`)

The free-agent list is filtered against the **current major's field** so players
who aren't teeing it up don't clutter the claim list:

1. `fetchField()` (`lib/field.js`) calls the `api/field.js` proxy, which detects
   the current major (via ESPN) and returns the field — preferring the major's
   **own** feed (The Open's `scoring.theopen.com`), falling back to ESPN's
   competitor list. See the gotcha below.
2. `annotateFieldStatus()` name-matches the field to our `golfers` rows and tags
   each with `inField` (`true` / `false` / `null` when the field is unknown).
   Matching mirrors `espn.js`: accent-stripped exact full-name, then a
   unique-last-name match **only if the first names are compatible**
   (Matt/Matthew ok; Cam/Jordan not) — the loose version caused false positives.
3. **In-field players are claimable by default; non-field players are hidden.**
   A **"Show players not in field"** toggle reveals them greyed and unclaimable.
   When the field is unknown (between majors, or the feed is down), `inField` is
   `null` → nothing is hidden and a note says the field can't be verified.
4. A **"Show rostered players"** toggle appends golfers already on *other* teams
   (`useRoster.getLeagueRosters` — RLS lets any member read league rosters),
   shown greyed with an `On {team}` badge and no Claim button.

`PlayerCard` gained `muted` (dim + suppress actions) and `badge` props to render
these reference-only rows. On a successful **waiver** claim (not first-come),
`notifyWaiverClaim()` fires `api/notify-waiver.js` to email the commissioner.

## Lowball Scoring Rules

This is the live scoring format. Implemented in `src/lib/scoring.js`
(`calculateLowballPoints`, `calculateLowballTeamScore`) and configured per-league
via `scoring_mode: 'lowball'` and `lowball_counting_scores` (default 5).

**Lower total wins** (mirrors real golf — position is your score).

### Per-golfer scoring

- **Base points = finish position.** 1st = 1, 2nd = 2, T5 = 5, etc. Tie-aware
  positions come from `espn.js` (players sharing a to-par score share a position).
- **Missed cut** = `missedCutPosition` = *(tied position of the last player who
  made the cut) + 1*. Computed in `espn.js`. If nobody is cut yet, it's
  `fieldSize + 1`. A golfer **not in the field** at all is also treated as a
  missed cut for that team.
- **Bonus deductions** (subtracted, because lower is better) apply only to
  golfers who made the cut:

  | Finish     | Bonus | Label         |
  |------------|-------|---------------|
  | 1st        | −10   | `1st: -10`    |
  | 2nd–10th   | −5    | `Top 10: -5`  |
  | 11th–20th  | −3    | `Top 20: -3`  |
  | 21st–30th  | −2    | `Top 30: -2`  |
  | 31st+ (made cut) | −1 | `Made Cut: -1` |
  | Missed cut | 0     | `MC`          |

  Player total = `base + bonus`.

### Per-team scoring

- Uses **all rostered golfers** — there is **no starter/bench distinction** in
  lowball (the `slot_type` column exists but is ignored by this engine).
- Only the **best (lowest) N scores count** — N = `lowball_counting_scores`
  (default 5). Remaining players are marked `counting: false` and shown dimmed.
- **Tiebreaker** when two players have the same total (e.g. both at the missed-cut
  position): prefer the one who was actually **in the field** (`isPlaying`). This
  keeps a teed-off-but-cut player ahead of a no-show. (See commit `da37caf`.)
- Team total = sum of the counting players' totals. Teams sorted ascending.

### Bonus badge colors

`getBonusBadgeColor(bonus)` maps the bonus magnitude to Tailwind classes for the
UI badges — keep it in sync if the deduction tiers change.

## Classic Scoring (legacy)

`DEFAULT_SCORING` + `calculatePoints()` in `scoring.js`, mirrored by the
`scoring_config` JSONB column and the `get_league_standings` SQL function.
Higher points = better; position table plus eagle/ace/all-rounds-under-par
bonuses. **The active UI does not use this path** — live scoring and standings go
through the lowball engine and `lowball_tournament_scores`. Treat Classic as
dormant unless a task explicitly targets it, but don't delete it without checking.

## Database

Primary schema is `supabase/migrations/001_initial_schema.sql`. Key tables:
`profiles`, `leagues`, `league_members`, `golfers` (seeded top-60 OWGR), `rosters`,
`trades`, `waiver_claims`, `tournament_results`, `draft_picks`, `matchups`.
RLS is enabled on every table; `get_free_agents` and `get_league_standings` are
`security definer` SQL functions.

### ⚠️ Schema drift — read before touching the DB

Several things the code depends on are **NOT in the committed migration**:

- `leagues.scoring_mode` and `leagues.lowball_counting_scores` columns
  (used in `LeagueCreate.jsx`, `LeagueView.jsx`, `TournamentScoreboard.jsx`)
- the `lowball_tournament_scores` table (the live standings source of truth)
- the `keep_alive` table (pinged by `api/keep-alive.js`)

These were applied directly in the Supabase dashboard. If you add or change schema,
prefer writing a new numbered migration **and** note that the running DB may differ
from `001`. Don't assume the migration file is the complete schema.

## Coding Conventions

- **Language**: plain JavaScript + JSX (no TypeScript). ES modules (`"type": "module"`).
  Vite is configured to treat `.js` files as JSX too (`vite.config.js`), so JSX in
  `.js` is fine, but new components use `.jsx`.
- **Components**: function components with hooks only. Default-export one component
  per file; small private sub-components (e.g. `TournamentHistoryTeam` in
  `LeagueView.jsx`) live at the bottom of the same file.
- **Data hooks** wrap Supabase calls and return `{ data, error }` (or `{ error }`)
  — the Supabase convention. Callers check `error` and surface it via `toast`.
  Mutating hooks manage their own `loading` state.
- **Async in effects**: define an inner `async function load() {...}` and call it,
  or use `.then()` — don't make the effect callback itself async.
- **State**: local `useState` + Supabase; no Redux/Zustand. Auth is the only
  React context.
- **User feedback**: `react-hot-toast` (`toast.success` / `toast.error`) is the
  standard. Some older paths use `alert()` (e.g. save flow in
  `TournamentScoreboard.jsx`) — prefer toast for new code.
- **Styling**: Tailwind utility classes inline. Reuse the component classes from
  `globals.css` (`.card`, `.btn-primary/-secondary/-danger/-gold`, `.badge-*`,
  `.input-field`, `.select-field`, `.page-container`, `.table-header/-cell`,
  `.section-title`) instead of re-inventing them.
- **Design tokens** (`tailwind.config.js`): three custom palettes —
  `fairway` (green), `sand` (gold/accent), `clubhouse` (warm neutral/background).
  Dark theme throughout (`bg-clubhouse-950`). 1st place / highlights use `sand`.
  Fonts: `font-display` (Playfair serif), `font-body` (DM Sans), `font-mono`
  (JetBrains Mono, used for all numeric scores).
- **Icons**: `lucide-react`, imported by name, typically `size={14–16}`.
- **Constants over literals**: dropdown options, status labels, and country flags
  live in `lib/constants.js`. Add new option lists there.
- **Formatting**: 2-space indent, single quotes, semicolons, trailing commas in
  multiline literals. Match the surrounding file.

## External integrations & gotchas

- **ESPN API** (`lib/espn.js`) is undocumented/public and fragile. Cut detection
  is heuristic — it combines ESPN's reported round (`status.period`) with the max
  scored rounds across the field, and infers cuts from missing round-3+ scores.
  Read the extensive comments there before changing it; the current logic exists
  to fix specific real-world bugs (large cuts, live-round-3 false positives — see
  commits `0ab3a5b`, `da37caf`).
- **Majors-only gate** lives in `fetchESPNLeaderboard`. To track more events,
  change the `isMajor` check there. The **same gate is duplicated** in
  `api/field.js` (`isMajorName`) — keep the two in sync.
- **Field feed** (`api/field.js`) is a server-side proxy (avoids browser CORS on
  the official feeds). It prefers each major's own data feed and falls back to
  ESPN's competitor list. Only **The Open** is wired up so far, via
  `https://scoring.theopen.com/scoring?feedType=traditional` (public, no key,
  ~156 players with `firstName`/`lastName`, available before play starts). The
  other three majors (`OFFICIAL_FEEDS` in `api/field.js`) currently fall through
  to ESPN until their feeds are discovered during their event weeks. Event
  detection still goes through ESPN, so the field is only "known" during a major
  week; otherwise the Free Agents filter degrades to showing everyone.
- **Resend email** (`api/notify-waiver.js`) sends the commissioner a waiver-claim
  notification. Uses the Resend REST API via `fetch` (no SDK dependency) and the
  Supabase **service role** key to resolve the commissioner's email from
  `auth.users` (not stored in `profiles`). Requires `SUPABASE_SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`, and optionally `RESEND_FROM` (see Running Locally). It's
  fire-and-forget from the client — a failed email never blocks the claim.
- **Keep-alive cron** (`vercel.json` → `/api/keep-alive`, every 3 days) exists
  solely to keep the free-tier Supabase project from pausing. Don't remove it
  without a replacement (commit `29ff1b7`).
- **Vercel SPA rewrite** in `vercel.json` routes all paths to `/` for client-side
  routing — required for React Router deep links to work on refresh.

## Note on README vs. reality

`README.md` describes an aspirational feature set (H2H matchups, full draft/waiver
automation, classic scoring tables). The **shipped** app centers on lowball scoring
of majors with commissioner-saved standings. When docs and code disagree, the code
in `src/lib/scoring.js`, `src/lib/espn.js`, and `TournamentScoreboard.jsx` is
authoritative.
