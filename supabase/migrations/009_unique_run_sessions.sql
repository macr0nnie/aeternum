-- =============================================================================
-- 009 — One run_sessions row per player per workout
-- =============================================================================
-- resolve-run checked for an existing run, then inserted. Two syncs at once
-- (launch auto-sync + tapping Sync) both passed the check and doubled rewards.
-- The index makes the second insert fail; resolve-run maps that to a 409.
-- If this fails on existing duplicates, delete the extra rows first.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS run_sessions_player_started_at_key
  ON public.run_sessions (player_id, started_at);
