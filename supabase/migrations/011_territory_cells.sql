-- =============================================================================
-- 011 — Territory cells & private territory reads
-- =============================================================================
-- Fixes the home-location leak (see "Turf Wars privacy risks"):
--   * the world is cut into ~250 m cells; a claim is snapped to its cell's
--     centre and the player's real GPS point is never stored;
--   * one territory per cell (cell_key is unique);
--   * players can no longer SELECT other players' territories. They see
--     nearby cells through territories_near(), which hides who owns a rival
--     territory and when its ward ends.
-- =============================================================================

-- ~250 m cells. Columns are widened by 1/cos(lat) so cells stay roughly square.
-- Mirrors territoryCell() in src/lib/worldMap.ts. shortcut: kept in sync by hand.
CREATE OR REPLACE FUNCTION public.territory_cell(
  p_lat double precision, p_lng double precision,
  OUT cell_key text, OUT lat double precision, OUT lng double precision
) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  step constant double precision := 0.00225;
  r bigint := floor(p_lat / step);
  lng_step double precision;
  c bigint;
BEGIN
  lat := (r + 0.5) * step;
  lng_step := step / greatest(cos(radians(lat)), 0.01);
  c := floor(p_lng / lng_step);
  lng := (c + 0.5) * lng_step;
  cell_key := r || ':' || c;
END $$;

ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS cell_key text;

-- Snap existing territories to their cell centre.
UPDATE public.territories t
SET (cell_key, lat, lng) = (SELECT c.cell_key, c.lat, c.lng FROM public.territory_cell(t.lat, t.lng) c)
WHERE t.cell_key IS NULL;

-- The old automatic starter was named after the player; drop the username.
UPDATE public.territories t
SET name = 'Outpost'
FROM public.players p
WHERE p.id = t.owner_id AND t.name = p.username || '''s Outpost';

-- Fails (and rolls back the migration) if two existing territories share a
-- cell. That is deliberate: pick which to keep rather than deleting silently.
ALTER TABLE public.territories ALTER COLUMN cell_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS territories_cell_key_key ON public.territories (cell_key);

-- New claims: L1, full HP, 24 h ward (from 010), snapped to the cell centre.
CREATE OR REPLACE FUNCTION public.territories_new_claim()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.territory_cell(NEW.lat, NEW.lng);
  NEW.cell_key := c.cell_key;
  NEW.lat := c.lat;
  NEW.lng := c.lng;
  NEW.level := 1;
  NEW.health := 100;
  NEW.max_health := 100;
  NEW.shield_until := now() + interval '24 hours';
  RETURN NEW;
END $$;

-- Only your own territories are readable directly.
DROP POLICY IF EXISTS "territories_select" ON public.territories;
DROP POLICY IF EXISTS "territories_select_own" ON public.territories;
CREATE POLICY "territories_select_own" ON public.territories
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- Territories within ~1.5 km of a point. Rivals come back without owner or
-- ward end time; `warded` says whether they can be attacked right now.
CREATE OR REPLACE FUNCTION public.territories_near(p_lat double precision, p_lng double precision)
RETURNS TABLE (
  id uuid, cell_key text, lat double precision, lng double precision, name text,
  level integer, health integer, max_health integer,
  owner_id uuid, warded boolean, shield_until timestamptz, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.cell_key, t.lat, t.lng, t.name, t.level, t.health, t.max_health,
         CASE WHEN t.owner_id = auth.uid() THEN t.owner_id END,
         coalesce(t.shield_until > now(), false),
         CASE WHEN t.owner_id = auth.uid() THEN t.shield_until END,
         t.created_at
  FROM territories t
  WHERE auth.uid() IS NOT NULL
    AND t.lat BETWEEN p_lat - 0.0135 AND p_lat + 0.0135
    AND t.lng BETWEEN p_lng - 0.0135 / greatest(cos(radians(p_lat)), 0.01)
                  AND p_lng + 0.0135 / greatest(cos(radians(p_lat)), 0.01)
  LIMIT 200
$$;

REVOKE ALL ON FUNCTION public.territories_near(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.territories_near(double precision, double precision) TO authenticated;
