-- =============================================================================
-- Aeternum — Migration 003: Party System + Co-op Gates
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Party invites — bidirectional connection requests
-- ---------------------------------------------------------------------------

create table if not exists party_invites (
  id             uuid primary key default gen_random_uuid(),
  from_player_id uuid not null references players(id) on delete cascade,
  to_player_id   uuid not null references players(id) on delete cascade,
  status         text not null default 'pending'
                   check (status in ('pending', 'accepted', 'declined')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Prevent duplicate requests in the same direction
  unique (from_player_id, to_player_id),
  -- Prevent self-invites
  check (from_player_id <> to_player_id)
);

-- RLS: players can only see invites they sent or received
alter table party_invites enable row level security;

create policy "party_invites_select" on party_invites
  for select using (
    auth.uid() = from_player_id or auth.uid() = to_player_id
  );

create policy "party_invites_insert" on party_invites
  for insert with check (auth.uid() = from_player_id);

create policy "party_invites_update" on party_invites
  for update using (
    -- Receiver can accept/decline; sender can cancel (set to declined)
    auth.uid() = to_player_id or auth.uid() = from_player_id
  );

-- Index for fast lookup of all invites for a player
create index if not exists party_invites_to_idx   on party_invites(to_player_id, status);
create index if not exists party_invites_from_idx on party_invites(from_player_id, status);

-- ---------------------------------------------------------------------------
-- 2. Co-op gate sessions
-- ---------------------------------------------------------------------------

create table if not exists co_op_sessions (
  id              uuid primary key default gen_random_uuid(),
  gate_id         text not null,                          -- matches DUNGEON_ENTRIES id
  host_id         uuid not null references players(id) on delete cascade,
  participant_ids uuid[] not null default '{}',           -- includes host
  status          text not null default 'resolved'
                    check (status in ('resolved', 'failed')),
  pooled_stats    jsonb,                                  -- stats used for resolution
  win_probability numeric(5,4),                          -- 0.0000–1.0000
  outcome         jsonb,                                  -- per-player rewards + stat_gains
  created_at      timestamptz not null default now()
);

alter table co_op_sessions enable row level security;

-- Participants can read their own sessions
create policy "co_op_sessions_select" on co_op_sessions
  for select using (
    auth.uid() = host_id or auth.uid() = any(participant_ids)
  );

-- Only the edge function (service role) inserts — no direct client insert
-- (service role bypasses RLS)

create index if not exists co_op_sessions_host_idx         on co_op_sessions(host_id);
create index if not exists co_op_sessions_participants_idx on co_op_sessions using gin(participant_ids);

-- ---------------------------------------------------------------------------
-- 3. Public player info view — safe for party search (no private data)
-- ---------------------------------------------------------------------------

create or replace view player_public as
  select
    id,
    username,
    rank,
    primary_element,
    total_distance_km,
    -- Aggregate stat total for display (no individual stat values exposed)
    (
      (stats->>'ATK')::int +
      (stats->>'SPD')::int +
      (stats->>'INT')::int +
      (stats->>'LCK')::int +
      (stats->>'DEF')::int +
      (stats->>'END')::int +
      (stats->>'PER')::int +
      (stats->>'CHA')::int
    ) as total_stat_power
  from players;

-- Allow any authenticated user to search the public view
grant select on player_public to authenticated;
