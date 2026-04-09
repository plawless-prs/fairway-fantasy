# ⛳ Fairway Fantasy — Fantasy Golf League Manager

A full-featured fantasy golf application built with React + Vite, Supabase, and deployed on Vercel.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS v3
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime + Row Level Security)
- **Hosting**: Vercel
- **Source Control**: GitHub

--- 

## 🚀 Setup Instructions

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/fairway-fantasy.git
cd fairway-fantasy
npm install
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the Supabase dashboard, go to **SQL Editor** and run the migration file:
   - Copy the contents of `supabase/migrations/001_initial_schema.sql` and execute it.
3. Go to **Settings → API** and copy your:
   - `Project URL` (e.g., `https://xxxxx.supabase.co`)
   - `anon public` key

### 3. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 5. Deploy to Vercel

1. Push your repo to GitHub.
2. Go to [vercel.com](https://vercel.com), import the GitHub repo.
3. Add your environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Vercel project settings.
4. Deploy — Vercel auto-detects Vite.

---

## 📁 Project Structure

```
fairway-fantasy/
├── public/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Layout.jsx
│   │   ├── Navbar.jsx
│   │   ├── PlayerCard.jsx
│   │   ├── RosterSlot.jsx
│   │   ├── Standings.jsx
│   │   ├── TradeModal.jsx
│   │   └── DraftBoard.jsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useLeague.js
│   │   └── useRoster.js
│   ├── lib/              # Utilities & Supabase client
│   │   ├── supabase.js
│   │   ├── scoring.js
│   │   └── constants.js
│   ├── pages/            # Route-level page components
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── LeagueCreate.jsx
│   │   ├── LeagueView.jsx
│   │   ├── MyTeam.jsx
│   │   ├── FreeAgents.jsx
│   │   ├── Draft.jsx
│   │   └── Commissioner.jsx
│   ├── styles/
│   │   └── globals.css
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env                  # (create locally, not committed)
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── vercel.json
└── README.md
```

---

## ✅ Features

### Commissioner Controls (Priority 1)
- Create leagues with configurable team count (4–20 teams)
- Set roster size (starters + bench)
- Choose scoring format
- Set roster lock times (per-round or per-tournament)
- Approve/veto trades
- Add/remove league members
- Reset or end seasons

### Scoring & Leaderboard (Priority 2)
- Points-based scoring tied to tournament finish position
- Bonus points for eagles, holes-in-one, top-10 finishes
- Real-time league standings
- Weekly matchup results (H2H mode) or cumulative (season-long)
- Historical scoring breakdowns per team

### Trades & Waivers (Priority 3)
- Propose trades to other teams
- Accept / reject / counter trade offers
- Free agent pickup & drop system
- Waiver priority (inverse of standings)
- Trade deadline support

### Draft System (Priority 4)
- Snake draft with configurable order
- Live draft board with pick timer
- Auto-pick if timer expires
- Pre-draft rankings from OWGR

---

## 🏌️ Scoring System (Default)

| Finish Position | Points |
|-----------------|--------|
| 1st             | 30     |
| 2nd             | 22     |
| 3rd             | 18     |
| 4th             | 16     |
| 5th             | 14     |
| 6th–10th        | 12–8   |
| 11th–20th       | 7–3    |
| 21st–30th       | 2      |
| 31st+           | 1      |
| Missed Cut       | 0      |

**Bonuses**: Eagle (+2), Hole-in-One (+5), 4 Rounds Under Par (+3)

---

## 🔐 Security

All data access is protected by Supabase Row Level Security (RLS):
- Users can only edit their own team rosters
- Only commissioners can modify league settings
- Trade proposals are visible only to involved parties
- Auth via Supabase (email/password or OAuth)
