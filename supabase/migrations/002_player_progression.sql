-- =============================================================================
-- Aeternum — Migration 002: Player Progression Columns
-- =============================================================================
-- Changes:
--   1. Fix default stats from 10 → 0 (new players start unawakened)
--   2. Fix default title from 'Unnamed Runner' → 'Unawakened'
--   3. Add completed_quest_ids + cleared_dungeon_ids (server-persisted progress)
--   4. Add inventory + equipped JSONB columns (Phase 2 gear system)
--   5. Add username length constraint
-- =============================================================================

-- 1. Fix default stats — existing rows are unaffected; only new inserts change
alter table players
  alter column stats set default '{
    "ATK": 0, "SPD": 0, "INT": 0, "LCK": 0,
    "DEF": 0, "END": 0, "PER": 0, "CHA": 0
  }';

-- 2. Fix default title
alter table players
  alter column title set default 'Unawakened';

-- 3. Quest + dungeon progress — stored as JSON arrays of string IDs
alter table players
  add column if not exists completed_quest_ids  jsonb not null default '[]';

alter table players
  add column if not exists cleared_dungeon_ids  jsonb not null default '[]';

-- 4. Inventory + equipped loadout
alter table players
  add column if not exists inventory jsonb not null default '{
    "gear":        [],
    "materials":   {},
    "consumables": {},
    "relics":      []
  }';

alter table players
  add column if not exists equipped jsonb not null default '{
    "weapon": null,
    "armor":  null,
    "ring":   null,
    "relic":  null
  }';

-- 5. Username length constraint (2–20 characters)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'players_username_length'
  ) then
    alter table players
      add constraint players_username_length
      check (char_length(username) >= 2 and char_length(username) <= 20);
  end if;
end $$;

-- Index for fast inventory queries when trading system ships
create index if not exists players_rank_idx on players(rank);
create index if not exists players_element_idx on players(primary_element);
