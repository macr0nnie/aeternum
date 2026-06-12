-- =============================================================================
-- 007_traits.sql — Behavioral trait fingerprint for each player
-- =============================================================================
-- Traits are accumulated automatically from in-game actions (dungeons, world
-- events, run syncs). Players never set these directly. The client stores the
-- full JSONB object and overwrites it on each debounced save.
-- =============================================================================

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS traits JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Index for future server-side archetype queries / leaderboards by trait score
CREATE INDEX IF NOT EXISTS idx_players_traits ON players USING gin (traits);

COMMENT ON COLUMN players.traits IS
  'Accumulated behavioral trait scores: endurance, strength, exploration, '
  'conquest, gathering, consistency, mastery. Written by the client on change.';
