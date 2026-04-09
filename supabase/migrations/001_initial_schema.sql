-- ============================================================
-- Fairway Fantasy — Supabase Migration 001
-- Run this in Supabase SQL Editor to create all tables & RLS
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
-- Extends Supabase auth.users with display info
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── LEAGUES ─────────────────────────────────────────────────
create type league_status as enum ('setup', 'drafting', 'active', 'completed');
create type league_format as enum ('head_to_head', 'season_long');
create type draft_type as enum ('snake', 'auction', 'autopick');

create table public.leagues (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  commissioner_id uuid references public.profiles(id) not null,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  status league_status default 'setup',
  format league_format default 'season_long',
  draft_type draft_type default 'snake',
  max_teams int not null default 10 check (max_teams >= 2 and max_teams <= 20),
  roster_starters int not null default 6,
  roster_bench int not null default 2,
  trade_deadline timestamptz,
  roster_lock_type text default 'round_start' check (roster_lock_type in ('round_start', 'tournament_start', 'none')),
  trade_review text default 'commissioner' check (trade_review in ('commissioner', 'league_vote', 'instant')),
  waiver_type text default 'inverse_standings' check (waiver_type in ('inverse_standings', 'first_come', 'faab')),
  faab_budget int default 100,
  scoring_config jsonb default '{
    "finish": {"1":30,"2":22,"3":18,"4":16,"5":14,"6":12,"7":11,"8":10,"9":9,"10":8,"11":7,"12":6,"13":6,"14":5,"15":5,"16":4,"17":4,"18":3,"19":3,"20":3,"21":2,"22":2,"23":2,"24":2,"25":2,"26":2,"27":2,"28":2,"29":2,"30":2},
    "bonus_eagle": 2,
    "bonus_hole_in_one": 5,
    "bonus_all_rounds_under_par": 3,
    "missed_cut": 0,
    "default_finish": 1
  }'::jsonb,
  current_tournament text,
  season_year int default extract(year from now()),
  created_at timestamptz default now()
);

alter table public.leagues enable row level security;

create policy "Leagues visible to members"
  on public.leagues for select using (
    id in (select league_id from public.league_members where user_id = auth.uid())
    or commissioner_id = auth.uid()
  );

create policy "Commissioner can update league"
  on public.leagues for update using (commissioner_id = auth.uid());

create policy "Any authenticated user can create a league"
  on public.leagues for insert with check (auth.uid() = commissioner_id);


-- ─── LEAGUE MEMBERS ──────────────────────────────────────────
create table public.league_members (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  team_name text not null,
  team_logo text,
  draft_position int,
  waiver_priority int,
  is_active boolean default true,
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

alter table public.league_members enable row level security;

create policy "Members visible to league members"
  on public.league_members for select using (
    league_id in (select league_id from public.league_members where user_id = auth.uid())
  );

create policy "Users can join leagues"
  on public.league_members for insert with check (auth.uid() = user_id);

create policy "Users can update own membership"
  on public.league_members for update using (
    user_id = auth.uid()
    or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  );

create policy "Commissioner can remove members"
  on public.league_members for delete using (
    league_id in (select id from public.leagues where commissioner_id = auth.uid())
  );


-- ─── GOLFERS (OWGR Pool) ────────────────────────────────────
create table public.golfers (
  id serial primary key,
  name text not null,
  owgr_rank int not null,
  country text,
  avg_score numeric(4,2),
  photo_url text,
  updated_at timestamptz default now()
);

-- Seed top 60 OWGR golfers
insert into public.golfers (name, owgr_rank, country, avg_score) values
  ('Scottie Scheffler', 1, 'USA', -4.2),
  ('Xander Schauffele', 2, 'USA', -3.8),
  ('Rory McIlroy', 3, 'NIR', -3.5),
  ('Collin Morikawa', 4, 'USA', -3.3),
  ('Ludvig Åberg', 5, 'SWE', -3.1),
  ('Jon Rahm', 6, 'ESP', -3.0),
  ('Hideki Matsuyama', 7, 'JPN', -2.9),
  ('Wyndham Clark', 8, 'USA', -2.8),
  ('Viktor Hovland', 9, 'NOR', -2.7),
  ('Patrick Cantlay', 10, 'USA', -2.6),
  ('Tommy Fleetwood', 11, 'ENG', -2.5),
  ('Shane Lowry', 12, 'IRL', -2.5),
  ('Sahith Theegala', 13, 'USA', -2.4),
  ('Matt Fitzpatrick', 14, 'ENG', -2.4),
  ('Brooks Koepka', 15, 'USA', -2.3),
  ('Tony Finau', 16, 'USA', -2.3),
  ('Brian Harman', 17, 'USA', -2.2),
  ('Justin Thomas', 18, 'USA', -2.2),
  ('Robert MacIntyre', 19, 'SCO', -2.1),
  ('Russell Henley', 20, 'USA', -2.1),
  ('Tyrrell Hatton', 21, 'ENG', -2.0),
  ('Cameron Young', 22, 'USA', -2.0),
  ('Keegan Bradley', 23, 'USA', -1.9),
  ('Sungjae Im', 24, 'KOR', -1.9),
  ('Tom Kim', 25, 'KOR', -1.8),
  ('Joaquin Niemann', 26, 'CHI', -1.8),
  ('Byeong Hun An', 27, 'KOR', -1.7),
  ('Corey Conners', 28, 'CAN', -1.7),
  ('Max Homa', 29, 'USA', -1.6),
  ('Sam Burns', 30, 'USA', -1.6),
  ('Sepp Straka', 31, 'AUT', -1.5),
  ('Jason Day', 32, 'AUS', -1.5),
  ('Si Woo Kim', 33, 'KOR', -1.4),
  ('Min Woo Lee', 34, 'AUS', -1.4),
  ('Denny McCarthy', 35, 'USA', -1.3),
  ('Taylor Moore', 36, 'USA', -1.3),
  ('Akshay Bhatia', 37, 'USA', -1.2),
  ('Chris Kirk', 38, 'USA', -1.2),
  ('Cam Davis', 39, 'AUS', -1.1),
  ('Stephan Jaeger', 40, 'GER', -1.1),
  ('Billy Horschel', 41, 'USA', -1.0),
  ('Adam Scott', 42, 'AUS', -1.0),
  ('Cameron Smith', 43, 'AUS', -0.9),
  ('Dustin Johnson', 44, 'USA', -0.9),
  ('Harris English', 45, 'USA', -0.8),
  ('Jordan Spieth', 46, 'USA', -0.8),
  ('Eric Cole', 47, 'USA', -0.7),
  ('Nick Taylor', 48, 'CAN', -0.7),
  ('Taylor Pendrith', 49, 'CAN', -0.6),
  ('Austin Eckroat', 50, 'USA', -0.6),
  ('Christiaan Bezuidenhout', 51, 'RSA', -0.5),
  ('Thomas Detry', 52, 'BEL', -0.5),
  ('Will Zalatoris', 53, 'USA', -0.4),
  ('Davis Thompson', 54, 'USA', -0.4),
  ('Adam Hadwin', 55, 'CAN', -0.3),
  ('Keith Mitchell', 56, 'USA', -0.3),
  ('Mackenzie Hughes', 57, 'CAN', -0.2),
  ('Jake Knapp', 58, 'USA', -0.2),
  ('J.T. Poston', 59, 'USA', -0.1),
  ('Matthieu Pavon', 60, 'FRA', -0.1);

-- No RLS on golfers — public read
alter table public.golfers enable row level security;
create policy "Golfers are publicly readable" on public.golfers for select using (true);


-- ─── ROSTERS ─────────────────────────────────────────────────
create type roster_slot_type as enum ('starter', 'bench');

create table public.rosters (
  id uuid default uuid_generate_v4() primary key,
  league_member_id uuid references public.league_members(id) on delete cascade not null,
  golfer_id int references public.golfers(id) not null,
  slot_type roster_slot_type default 'starter',
  acquired_at timestamptz default now(),
  unique(league_member_id, golfer_id)
);

alter table public.rosters enable row level security;

-- Everyone in the league can see rosters
create policy "Rosters visible to league"
  on public.rosters for select using (
    league_member_id in (
      select lm.id from public.league_members lm
      where lm.league_id in (
        select league_id from public.league_members where user_id = auth.uid()
      )
    )
  );

-- Users can only modify their own roster
create policy "Users manage own roster"
  on public.rosters for insert with check (
    league_member_id in (
      select id from public.league_members where user_id = auth.uid()
    )
  );

create policy "Users update own roster"
  on public.rosters for update using (
    league_member_id in (
      select id from public.league_members where user_id = auth.uid()
    )
  );

create policy "Users drop from own roster"
  on public.rosters for delete using (
    league_member_id in (
      select id from public.league_members where user_id = auth.uid()
    )
  );


-- ─── TRADES ──────────────────────────────────────────────────
create type trade_status as enum ('proposed', 'accepted', 'rejected', 'vetoed', 'completed', 'cancelled');

create table public.trades (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  proposer_id uuid references public.league_members(id) not null,
  receiver_id uuid references public.league_members(id) not null,
  proposer_golfers int[] not null default '{}',   -- golfer IDs offered
  receiver_golfers int[] not null default '{}',   -- golfer IDs requested
  status trade_status default 'proposed',
  message text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.trades enable row level security;

create policy "Trades visible to involved parties and commissioner"
  on public.trades for select using (
    league_id in (select league_id from public.league_members where user_id = auth.uid())
  );

create policy "Members can propose trades"
  on public.trades for insert with check (
    proposer_id in (select id from public.league_members where user_id = auth.uid())
  );

create policy "Involved parties and commissioner can update trades"
  on public.trades for update using (
    proposer_id in (select id from public.league_members where user_id = auth.uid())
    or receiver_id in (select id from public.league_members where user_id = auth.uid())
    or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  );


-- ─── WAIVER CLAIMS ───────────────────────────────────────────
create type waiver_status as enum ('pending', 'approved', 'denied', 'processed');

create table public.waiver_claims (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  member_id uuid references public.league_members(id) not null,
  add_golfer_id int references public.golfers(id) not null,
  drop_golfer_id int references public.golfers(id),
  faab_bid int default 0,
  priority int,
  status waiver_status default 'pending',
  processed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.waiver_claims enable row level security;

create policy "Members see own waivers"
  on public.waiver_claims for select using (
    member_id in (select id from public.league_members where user_id = auth.uid())
    or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  );

create policy "Members create own waivers"
  on public.waiver_claims for insert with check (
    member_id in (select id from public.league_members where user_id = auth.uid())
  );

create policy "Members cancel own waivers"
  on public.waiver_claims for update using (
    member_id in (select id from public.league_members where user_id = auth.uid())
    or league_id in (select id from public.leagues where commissioner_id = auth.uid())
  );


-- ─── TOURNAMENT SCORES (for scoring) ────────────────────────
create table public.tournament_results (
  id uuid default uuid_generate_v4() primary key,
  tournament_name text not null,
  tournament_week int not null,
  season_year int not null,
  golfer_id int references public.golfers(id) not null,
  finish_position int,                           -- null = missed cut
  eagles int default 0,
  holes_in_one int default 0,
  all_rounds_under_par boolean default false,
  total_score int,                               -- relative to par
  created_at timestamptz default now(),
  unique(tournament_name, golfer_id)
);

alter table public.tournament_results enable row level security;
create policy "Tournament results are public" on public.tournament_results for select using (true);
create policy "Commissioner can insert results"
  on public.tournament_results for insert with check (
    auth.uid() in (select commissioner_id from public.leagues limit 1)
  );


-- ─── DRAFT PICKS ─────────────────────────────────────────────
create table public.draft_picks (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  member_id uuid references public.league_members(id) not null,
  golfer_id int references public.golfers(id) not null,
  round_num int not null,
  pick_num int not null,
  is_auto_pick boolean default false,
  picked_at timestamptz default now(),
  unique(league_id, golfer_id),
  unique(league_id, round_num, pick_num)
);

alter table public.draft_picks enable row level security;

create policy "Draft picks visible to league"
  on public.draft_picks for select using (
    league_id in (select league_id from public.league_members where user_id = auth.uid())
  );

create policy "Members make own picks"
  on public.draft_picks for insert with check (
    member_id in (select id from public.league_members where user_id = auth.uid())
  );


-- ─── MATCHUPS (for H2H format) ──────────────────────────────
create table public.matchups (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  week int not null,
  team_a_id uuid references public.league_members(id) not null,
  team_b_id uuid references public.league_members(id) not null,
  team_a_score numeric(6,1) default 0,
  team_b_score numeric(6,1) default 0,
  is_final boolean default false,
  created_at timestamptz default now()
);

alter table public.matchups enable row level security;

create policy "Matchups visible to league"
  on public.matchups for select using (
    league_id in (select league_id from public.league_members where user_id = auth.uid())
  );

create policy "Commissioner manages matchups"
  on public.matchups for all using (
    league_id in (select id from public.leagues where commissioner_id = auth.uid())
  );


-- ─── HELPFUL VIEWS ───────────────────────────────────────────

-- Free agents: golfers not on any roster in a given league
create or replace function public.get_free_agents(p_league_id uuid)
returns setof public.golfers as $$
  select g.* from public.golfers g
  where g.id not in (
    select r.golfer_id from public.rosters r
    join public.league_members lm on lm.id = r.league_member_id
    where lm.league_id = p_league_id
  )
  order by g.owgr_rank asc;
$$ language sql security definer;


-- League standings with total points
create or replace function public.get_league_standings(p_league_id uuid, p_season_year int default extract(year from now())::int)
returns table (
  member_id uuid,
  team_name text,
  user_id uuid,
  display_name text,
  total_points numeric,
  wins int,
  losses int
) as $$
  select
    lm.id as member_id,
    lm.team_name,
    lm.user_id,
    p.display_name,
    coalesce(sum(
      case
        when tr.finish_position is null then (l.scoring_config->>'missed_cut')::numeric
        when tr.finish_position <= 30 then (l.scoring_config->'finish'->>tr.finish_position::text)::numeric
        else (l.scoring_config->>'default_finish')::numeric
      end
      + tr.eagles * (l.scoring_config->>'bonus_eagle')::numeric
      + tr.holes_in_one * (l.scoring_config->>'bonus_hole_in_one')::numeric
      + case when tr.all_rounds_under_par then (l.scoring_config->>'bonus_all_rounds_under_par')::numeric else 0 end
    ), 0) as total_points,
    coalesce((select count(*) from public.matchups m where (m.team_a_id = lm.id and m.team_a_score > m.team_b_score and m.is_final) or (m.team_b_id = lm.id and m.team_b_score > m.team_a_score and m.is_final))::int, 0) as wins,
    coalesce((select count(*) from public.matchups m where (m.team_a_id = lm.id and m.team_a_score < m.team_b_score and m.is_final) or (m.team_b_id = lm.id and m.team_b_score < m.team_a_score and m.is_final))::int, 0) as losses
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  join public.leagues l on l.id = lm.league_id
  left join public.rosters r on r.league_member_id = lm.id
  left join public.tournament_results tr on tr.golfer_id = r.golfer_id and tr.season_year = p_season_year
  where lm.league_id = p_league_id and lm.is_active = true
  group by lm.id, lm.team_name, lm.user_id, p.display_name
  order by total_points desc;
$$ language sql security definer;
