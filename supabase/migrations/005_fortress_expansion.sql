-- =============================================================================
-- Migration 005 — Fortress Expansion
-- Defense loadout slots · Passive crop generation · Element affinity
-- =============================================================================

-- Add element + defense_slots columns to fortress
ALTER TABLE public.fortress
  ADD COLUMN IF NOT EXISTS element text,
  ADD COLUMN IF NOT EXISTS defense_slots jsonb NOT NULL DEFAULT '[]';

-- Passive crop generation (separate table — time-based state needs precise querying)
CREATE TABLE IF NOT EXISTS public.fortress_crops (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  slot_index   integer NOT NULL CHECK (slot_index BETWEEN 0 AND 3),
  crop_type    text NOT NULL CHECK (crop_type IN ('herb_garden','iron_mine','mana_pool','crystal_vein','gold_deposit')),
  planted_at   timestamptz NOT NULL DEFAULT now(),
  last_harvested_at timestamptz,
  UNIQUE (player_id, slot_index)
);

-- Player skills (unlocked abilities — stored per-player so progress is server-side)
CREATE TABLE IF NOT EXISTS public.player_skills (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  skill_id   text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('player','base')),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, skill_id)
);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.fortress_crops  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skills   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crops_all" ON public.fortress_crops
  FOR ALL TO authenticated
  USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

CREATE POLICY "skills_all" ON public.player_skills
  FOR ALL TO authenticated
  USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
