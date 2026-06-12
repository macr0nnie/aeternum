-- =============================================================================
-- Migration 004 — Territory Expansion System
-- =============================================================================

-- Territories (owned map tiles)
CREATE TABLE IF NOT EXISTS public.territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  name text NOT NULL DEFAULT 'Territory',
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now()
);

-- Resource nodes (physical harvest points on the map)
CREATE TABLE IF NOT EXISTS public.resource_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('iron','crystal','mana','herbs','gold')),
  richness integer NOT NULL DEFAULT 1 CHECK (richness BETWEEN 1 AND 3),
  last_harvested_at timestamptz,
  last_harvested_by uuid REFERENCES public.players(id),
  created_at timestamptz DEFAULT now()
);

-- Territory attack log
CREATE TABLE IF NOT EXISTS public.territory_attacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id uuid REFERENCES public.players(id) NOT NULL,
  defender_id uuid REFERENCES public.players(id) NOT NULL,
  territory_id uuid REFERENCES public.territories(id) ON DELETE CASCADE NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('win','loss')),
  atk_power integer NOT NULL,
  def_power integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Player resources & influence
CREATE TABLE IF NOT EXISTS public.player_resources (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  influence integer NOT NULL DEFAULT 0,
  iron integer NOT NULL DEFAULT 0,
  crystal integer NOT NULL DEFAULT 0,
  mana_res integer NOT NULL DEFAULT 0,
  herbs integer NOT NULL DEFAULT 0,
  gold_res integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Fortress (base buildings per player)
CREATE TABLE IF NOT EXISTS public.fortress (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  barracks_level integer NOT NULL DEFAULT 0,
  walls_level integer NOT NULL DEFAULT 0,
  forge_level integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.territories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_nodes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortress         ENABLE ROW LEVEL SECURITY;

-- Territories: all authenticated users can read; owner manages own
CREATE POLICY "territories_select" ON public.territories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "territories_insert" ON public.territories
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "territories_update" ON public.territories
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "territories_delete" ON public.territories
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Resource nodes: all read; any authenticated user may update (harvest)
CREATE POLICY "resource_nodes_select" ON public.resource_nodes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "resource_nodes_update" ON public.resource_nodes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "resource_nodes_insert" ON public.resource_nodes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Attacks: attacker/defender can read; attacker inserts
CREATE POLICY "attacks_select" ON public.territory_attacks
  FOR SELECT TO authenticated
  USING (attacker_id = auth.uid() OR defender_id = auth.uid());
CREATE POLICY "attacks_insert" ON public.territory_attacks
  FOR INSERT TO authenticated WITH CHECK (attacker_id = auth.uid());

-- Player resources: own row only
CREATE POLICY "resources_all" ON public.player_resources
  FOR ALL TO authenticated USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

-- Fortress: own row only
CREATE POLICY "fortress_all" ON public.fortress
  FOR ALL TO authenticated USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
