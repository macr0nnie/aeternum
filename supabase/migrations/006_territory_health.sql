-- =============================================================================
-- 006 — Territory health & defense
-- =============================================================================
-- Territories now have HP. Enemy attacks reduce HP; at 0 HP a territory becomes
-- vulnerable to capture. Owners repair by spending harvested resources.
-- max_health scales with territory level (set in app logic on upgrade).
-- =============================================================================

ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS health     integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_health integer NOT NULL DEFAULT 100;

-- Keep health within [0, max_health] at the DB level as a safety net.
ALTER TABLE public.territories
  DROP CONSTRAINT IF EXISTS territories_health_range;
ALTER TABLE public.territories
  ADD CONSTRAINT territories_health_range
  CHECK (health >= 0 AND health <= max_health);
