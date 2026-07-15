# ⛳ Fairway Fantasy — Fantasy Golf League Manager

A fantasy golf league app built with React + Vite, Supabase, and deployed on Vercel.
Draft PGA golfers, manage rosters, and get scored against real **major-championship**
results pulled live from ESPN.

> **Current focus:** the app is wired for **Lowball scoring over the four majors**
> (Masters, PGA Championship, U.S. Open, The Open). That's the live, default
> experience. Some options in the UI (auction drafts, FAAB, head-to-head, classic
> scoring) exist as settings or legacy code but are **not fully wired up** — see
> [Feature status](#-feature-status) below so you know what actually works.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS v3 (`lucide-react` icons, `react-hot-toast`)
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime + Row Level Security)
- **Live scores**: ESPN public PGA scoreboard API (no key required)
- **Hosting**: Vercel (SPA rewrite + one cron function)

---

## 🚀 Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/fairway-fantasy.git
cd fairway-fantasy
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/migrations/001_initial_schema.sql`.
3. ⚠️ The committed migration is **not the complete schema** — see
   [Database & schema drift](#-database--schema-drift). You'll also need the
   `scoring_mode` / `lowball_counting_scores` columns on `leagues`, and the
   `lowball_tournament_scores`, `keep_alive` tables, plus the
   `commissioner_create_member` RPC. These were applied directly in the Supabase
   dashboard and are not yet captured as migration files.
4. Under **Settings → API**, copy your `Project URL` and `anon public` key.

### 3. Environment Variables

Create a `.env` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

The Vercel cron function (`api/keep-alive.js`) reads these **same** `VITE_`-prefixed
names from `process.env`, so set them in your Vercel project settings too.

### 4. Run Locally

```bash
npm run dev      # http://localhost:5173
```

There is no test suite, linter, or typechecker configured — verifying a change
means running the dev server and exercising the flow in the browser.

### 5. Deploy to Vercel

1. Push to GitHub and import the repo at [vercel.com](https://vercel.com).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in project settings.
3. Deploy — Vercel auto-detects Vite. `vercel.json` handles the SPA rewrite and
   registers the keep-alive cron.

---

## 📁 Project Structure

```
fairway-fantasy/
├── api/
│   └── keep-alive.js          # Vercel cron target — pings Supabase to avoid free-tier pause
├── public/
├── src/
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── Navbar.jsx
│   │   ├── PlayerCard.jsx
│   │   ├── RosterSlot.jsx
│   │   ├── Standings.jsx
│   │   ├── TradeModal.jsx
│   │   ├── DraftBoard.jsx
│   │   └── TournamentScoreboard.jsx   # live ESPN scoring + save-to-standings
│   ├── hooks/                 # data-access layer — all Supabase calls live here
│   │   ├── useAuth.jsx        # AuthContext provider + useAuth()
│   │   ├── useLeague.jsx      # league CRUD, join, standings
│   │   └── useRoster.jsx      # rosters, free agents, trades, waivers, golfers
│   ├── lib/
│   │   ├── supabase.js        # singleton Supabase client
│   │   ├── scoring.js         # Lowball + (legacy) Classic scoring engines
│   │   ├── espn.js            # ESPN leaderboard fetch, cut detection, name matching
│   │   └── constants.js       # dropdown options, country flags, status labels
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── LeagueCreate.jsx
│   │   ├── LeagueView.jsx     # standings / live tournament / past tournaments / teams / trades
│   │   ├── MyTeam.jsx
│   │   ├── FreeAgents.jsx
│   │   ├── Draft.jsx
│   │   └── Commissioner.jsx
│   ├── styles/globals.css
│   ├── App.jsx                # router + AuthProvider + Toaster (all routes here)
│   └── main.jsx
├── supabase/migrations/
│   └── 001_initial_schema.sql
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

---

## ✅ Feature Status

Honest accounting of what's built. **Note:** this is JavaScript/JSX with no
TypeScript, tests, or linter.

### Working

- **Auth** — email/password sign-up & sign-in via Supabase; profiles auto-created on signup.
- **Leagues** — create leagues (2–20 teams), join by invite code, configurable
  roster size (starters + bench), scoring mode, and season lifecycle
  (setup → drafting → active → completed).
- **Snake draft** — live draft board (`DraftBoard`) with Supabase Realtime pick
  updates, a 90-second pick clock, and snake ordering. Picks add to the roster
  automatically.
- **Rosters** — add/drop, starter/bench slots.
- **Free agents & direct pickups** — pick up available golfers, drop to make room.
- **Waiver claims** — submit a claim (add/optional drop); commissioner approves or
  denies from the Commissioner panel.
- **Trades** — propose, accept, reject, and (commissioner) veto/approve. Instant
  trades execute automatically; commissioner-review trades wait for approval.
- **Live tournament scoring** — pulls the current major's leaderboard from ESPN,
  matches players to your golfer pool, and computes Lowball team scores in real time.
- **Standings & history** — commissioner saves a tournament snapshot; cumulative
  standings and a per-tournament breakdown are read back from `lowball_tournament_scores`.
- **Commissioner panel** — edit settings, add/remove members, **create accounts**
  for players and auto-add them, **edit any team's roster**, randomize draft order,
  change league status, and permanently delete the league.

### Partial / not wired up

- **Auto-pick** — the draft clock counts down but **does not auto-pick** when it
  hits zero (the timer just resets; there's a `// Auto-pick would trigger here` stub).
- **Auction draft** — selectable in settings, but only the **snake** board exists.
- **Trade counter-offers** — not implemented (propose/accept/reject/veto only).
- **Trade deadline** — column exists; not enforced in the UI.
- **Roster lock** — configurable, but not enforced during scoring.
- **Waiver priority & FAAB** — priority ordering and FAAB budgets are stored but
  **not processed**; claims are approved manually by the commissioner regardless of
  priority or bid.
- **Head-to-head format** — a `matchups` table and a `get_league_standings` SQL
  function exist, but no H2H matchup UI is wired in; live standings use
  cumulative Lowball totals.
- **Classic scoring** — a full Classic engine exists in code and the DB
  (`scoring_config`), but the active UI scores with Lowball. Treat Classic as legacy.

---

## 🏌️ Scoring

Scoring mode is chosen per league (`scoring_mode`). The app defaults to **Lowball**,
which is the only mode the live scoreboard and standings currently use.

### Lowball (default, active)

**Lower total wins** — like real golf, your position is your score. Implemented in
`src/lib/scoring.js`.

**Per golfer:**
- **Base points = finish position** (1st = 1, T5 = 5, …), tie-aware.
- **Missed cut** = (position of the last player to make the cut) + 1. A golfer not
  in the field at all is treated as a missed cut for that team.
- **Bonus deductions** (subtracted, since lower is better) for made-cut golfers:

  | Finish            | Bonus |
  |-------------------|-------|
  | 1st               | −10   |
  | 2nd–10th          | −5    |
  | 11th–20th         | −3    |
  | 21st–30th         | −2    |
  | 31st+ (made cut)  | −1    |
  | Missed cut        | 0     |

**Per team:**
- Uses **all rostered golfers** — there is **no starter/bench distinction** in Lowball.
- Only the **best (lowest) N scores count** (N = `lowball_counting_scores`, default 5).
- Tiebreaker on equal totals: prefer the golfer who was actually in the field.

### Classic (legacy)

Higher points = better. A position → points table plus bonuses (Eagle +2,
Hole-in-One +5, all rounds under par +3), stored in the `scoring_config` JSONB
column and computed by `calculatePoints()` / the `get_league_standings` SQL
function. **Not used by the live UI** — kept for reference.

---

## 📡 Live Scoring & ESPN

- `src/lib/espn.js` fetches ESPN's public PGA scoreboard (no API key).
- It **only tracks the four majors** — any other event returns an error and scoring
  stays idle. To broaden this, change the `isMajor` check in `fetchESPNLeaderboard`.
- Cut detection is heuristic (combines ESPN's reported round with per-player scored
  rounds). Read the comments in `espn.js` before changing it — the current logic
  fixes specific real-world edge cases.
- ESPN players are matched to the `golfers` table by name; unmatched players are
  auto-inserted with placeholder OWGR ranks.

---

## 🗄️ Database & Schema Drift

Primary schema: `supabase/migrations/001_initial_schema.sql` — `profiles`, `leagues`,
`league_members`, `golfers` (seeded top-60 OWGR), `rosters`, `trades`,
`waiver_claims`, `tournament_results`, `draft_picks`, `matchups`. RLS is enabled on
every table.

⚠️ **The migration is not the full schema.** Several things the app depends on were
applied directly in the Supabase dashboard and are **not** in a migration file:

- `leagues.scoring_mode` and `leagues.lowball_counting_scores` columns
- the `lowball_tournament_scores` table (source of truth for live standings)
- the `keep_alive` table (pinged by the cron)
- the `commissioner_create_member` RPC (used by the "Create Accounts" tab)

If you change the schema, prefer writing a new numbered migration, and don't assume
`001` matches the running database.

---

## 🔐 Security

Data access is enforced by Supabase Row Level Security (not the client):

- Users can only modify their own rosters.
- Only commissioners can modify league settings, edit other teams, and process
  waivers/trades.
- League data is visible only to members.
- Auth via Supabase (email/password).
