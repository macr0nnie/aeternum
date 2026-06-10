-- =============================================================================
-- Aeternum — Initial Schema
-- =============================================================================
-- Design decisions:
--   stats, rewards, and stat_gains are JSONB rather than columns so that
--   adding new stats or reward fields in later phases requires no migration.
--
--   title_chronicle is a JSONB array so the full history of generated titles
--   is preserved without a separate junction table.
--
--   run_sessions.mode ('sync' | 'exploration') future-proofs Phase 2 GPS
--   tracking without any schema changes at that time.
--
--   RLS is enforced at the database level — even if Edge Functions are
--   compromised, a player cannot read or write another player's rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Players
-- ---------------------------------------------------------------------------
create table if not exists players (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text not null,
  rank                text not null default 'E',          -- E D C B A S Sovereign
  total_distance_km   numeric(10, 3) not null default 0,
  primary_element     text,
  secondary_element   text,
  stats               jsonb not null default '{
    "ATK": 10,
    "SPD": 10,
    "INT": 10,
    "LCK": 10,
    "DEF": 10,
    "END": 10,
    "PER": 10,
    "CHA": 10
  }',
  title               text not null default 'Unnamed Runner',
  title_chronicle     jsonb not null default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Run sessions
-- ---------------------------------------------------------------------------
create table if not exists run_sessions (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references players(id) on delete cascade,
  mode                text not null default 'sync',       -- 'sync' | 'exploration'
  distance_km         numeric(10, 3) not null,
  duration_seconds    integer not null,
  steps               integer not null,
  avg_heart_rate      integer,                            -- nullable — not all devices record HR
  started_at          timestamptz not null,
  ended_at            timestamptz not null,
  rewards             jsonb,                              -- populated after resolve-run
  stat_gains          jsonb,                              -- populated after resolve-run
  validated           boolean not null default false,
  flag_reason         text,                              -- populated if anti-cheat fires
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists run_sessions_player_id_idx
  on run_sessions(player_id);

create index if not exists run_sessions_started_at_idx
  on run_sessions(started_at desc);

-- ---------------------------------------------------------------------------
-- Updated-at trigger (players only — run_sessions are append-only)
-- ---------------------------------------------------------------------------
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger players_updated_at
  before update on players
  for each row execute function update_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Players can only read and write their own row.
-- Run sessions are owned by the player — the Edge Function uses the service
-- role key to INSERT after validation, so the player policy covers SELECT only.
-- ---------------------------------------------------------------------------
alter table players enable row level security;
alter table run_sessions enable row level security;

-- Players: full access to own row only
create policy "players_own_row"
  on players for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Run sessions: players can read their own runs
create policy "run_sessions_own_rows_select"
  on run_sessions for select
  using (auth.uid() = player_id);

-- Run sessions: players can insert their own runs (raw — Edge Function validates)
-- The Edge Function uses service_role for the final INSERT after validation.
-- This policy allows the client to submit a pending run if needed.
create policy "run_sessions_own_rows_insert"
  on run_sessions for insert
  with check (auth.uid() = player_id);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
alter table players
  add constraint players_rank_valid
  check (rank in ('E', 'D', 'C', 'B', 'A', 'S', 'Sovereign'));

alter table run_sessions
  add constraint run_sessions_mode_valid
  check (mode in ('sync', 'exploration'));

alter table run_sessions
  add constraint run_sessions_distance_positive
  check (distance_km > 0);

alter table run_sessions
  add constraint run_sessions_duration_positive
  check (duration_seconds > 0);

alter table run_sessions
  add constraint run_sessions_steps_positive
  check (steps >= 0);

alter table run_sessions
  add constraint run_sessions_time_order
  check (ended_at > started_at);
