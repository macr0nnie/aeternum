-- =============================================================================
-- 010 — Server-decided territory battles
-- =============================================================================
-- Until now the client computed raid damage and wrote health / owner_id
-- straight into `territories` (008 opened UPDATE to every player). Any modded
-- client could take any territory. This migration:
--   * removes direct UPDATE on territories — every change goes through the
--     SECURITY DEFINER functions below, which decide the outcome server-side;
--   * resolves raids from the attacker's and defender's stored stats plus the
--     defender's fortress (walls, Iron Golem / Frost Barrier defense slots);
--   * adds shields (turf-wars-design.md §3/§4): 24 h after a claim, 12 h after
--     a capture, and a player's last territory can never be captured.
--
-- Battle numbers mirror src/types/index.ts (attackPower / territoryDefense /
-- raidDamage / territoryMaxHealth). shortcut: mirrored by hand because SQL
-- can't import app code; change both together.
-- =============================================================================

ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS shield_until timestamptz;

-- Building levels feed battles, so clamp what a client can write to its own row.
ALTER TABLE public.fortress
  DROP CONSTRAINT IF EXISTS fortress_building_levels;
ALTER TABLE public.fortress
  ADD CONSTRAINT fortress_building_levels CHECK (
    barracks_level BETWEEN 0 AND 5 AND walls_level BETWEEN 0 AND 5 AND forge_level BETWEEN 0 AND 5
  ) NOT VALID;

DROP POLICY IF EXISTS "territories_update_owner" ON public.territories;
DROP POLICY IF EXISTS "territories_update_attacker" ON public.territories;

-- New claims always start at L1 / full HP with a 24 h shield, whatever the client sent.
CREATE OR REPLACE FUNCTION public.territories_new_claim()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.level := 1;
  NEW.health := 100;
  NEW.max_health := 100;
  NEW.shield_until := now() + interval '24 hours';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS territories_new_claim ON public.territories;
CREATE TRIGGER territories_new_claim
  BEFORE INSERT ON public.territories
  FOR EACH ROW EXECUTE FUNCTION public.territories_new_claim();

-- -----------------------------------------------------------------------------
-- Battle math
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.territory_battle_powers(p_attacker uuid, t public.territories)
RETURNS TABLE (atk integer, def integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a_stats jsonb; d_stats jsonb;
  barracks integer; walls integer; slots jsonb;
BEGIN
  SELECT stats INTO a_stats FROM players WHERE id = p_attacker;
  SELECT stats INTO d_stats FROM players WHERE id = t.owner_id;
  SELECT coalesce(barracks_level, 0) INTO barracks FROM fortress WHERE player_id = p_attacker;
  SELECT coalesce(walls_level, 0), coalesce(defense_slots, '[]') INTO walls, slots
    FROM fortress WHERE player_id = t.owner_id;

  atk := coalesce((a_stats->>'ATK')::int, 0) * 2
       + coalesce((a_stats->>'SPD')::int, 0)
       + coalesce((a_stats->>'LCK')::int, 0) / 2
       + coalesce(barracks, 0) * 4;
  def := coalesce((d_stats->>'DEF')::int, 0) * 2
       + coalesce((d_stats->>'END')::int, 0)
       + t.level * 8
       + coalesce(walls, 0) * 4;

  IF slots @> '[{"skill_id":"bsk_iron_golem"}]' THEN def := def + 20; END IF;
  -- Frost Barrier: -20% attacker SPD.
  IF slots @> '[{"skill_id":"bsk_frost_barrier"}]' THEN
    atk := atk - coalesce((a_stats->>'SPD')::int, 0) / 5;
  END IF;
  RETURN NEXT;
END $$;

-- What the attack screen shows before you commit: both powers + shield state.
CREATE OR REPLACE FUNCTION public.territory_battle_preview(p_territory_id uuid)
RETURNS TABLE (atk integer, def integer, shield_until timestamptz, last_territory boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE t territories;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to attack territory.'; END IF;
  SELECT * INTO t FROM territories WHERE id = p_territory_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Territory not found.'; END IF;
  SELECT p.atk, p.def INTO atk, def FROM territory_battle_powers(auth.uid(), t) p;
  shield_until := t.shield_until;
  last_territory := NOT EXISTS (SELECT 1 FROM territories WHERE owner_id = t.owner_id AND id <> t.id);
  RETURN NEXT;
END $$;

-- -----------------------------------------------------------------------------
-- Raid: lowers HP. One raid per attacker per territory per minute stops a
-- scripted client from looping it; stamina (client-side) gates normal play.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.raid_territory(p_territory_id uuid)
RETURNS public.territories
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  t territories; p record; dmg integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to attack territory.'; END IF;
  SELECT * INTO t FROM territories WHERE id = p_territory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Territory not found.'; END IF;
  IF t.owner_id = me THEN RAISE EXCEPTION 'You can''t raid your own territory.'; END IF;
  IF t.shield_until > now() THEN RAISE EXCEPTION 'This territory is shielded.'; END IF;
  IF EXISTS (
    SELECT 1 FROM territory_attacks
    WHERE attacker_id = me AND territory_id = t.id AND created_at > now() - interval '1 minute'
  ) THEN
    RAISE EXCEPTION 'Your troops are regrouping. Try again in a minute.';
  END IF;

  SELECT * INTO p FROM territory_battle_powers(me, t);
  dmg := greatest(8, round(t.max_health * 0.36 * greatest(p.atk, 0)::numeric / greatest(p.atk + p.def, 1)));

  INSERT INTO territory_attacks (attacker_id, defender_id, territory_id, outcome, atk_power, def_power)
  VALUES (me, t.owner_id, t.id, 'win', p.atk, p.def);

  UPDATE territories SET health = greatest(0, health - dmg) WHERE id = t.id RETURNING * INTO t;
  RETURN t;
END $$;

-- -----------------------------------------------------------------------------
-- Capture: needs HP at or below 30%. Ownership moves, HP refills, 12 h shield.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.capture_territory(p_territory_id uuid)
RETURNS public.territories
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  t territories;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to capture territory.'; END IF;
  SELECT * INTO t FROM territories WHERE id = p_territory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Territory not found.'; END IF;
  IF t.owner_id = me THEN RAISE EXCEPTION 'You already own this territory.'; END IF;
  IF t.shield_until > now() THEN RAISE EXCEPTION 'This territory is shielded.'; END IF;
  IF t.health > t.max_health * 0.3 THEN
    RAISE EXCEPTION 'Weaken it to 30%% before capturing.';
  END IF;
  -- Never wipe a player out: everyone keeps a home base (design §4).
  IF NOT EXISTS (SELECT 1 FROM territories WHERE owner_id = t.owner_id AND id <> t.id) THEN
    RAISE EXCEPTION 'This is their last territory. It can be raided but not taken.';
  END IF;

  INSERT INTO territory_attacks (attacker_id, defender_id, territory_id, outcome, atk_power, def_power)
  SELECT me, t.owner_id, t.id, 'win', p.atk, p.def FROM territory_battle_powers(me, t) p;

  UPDATE territories
  SET owner_id = me, health = max_health, shield_until = now() + interval '12 hours'
  WHERE id = t.id RETURNING * INTO t;
  RETURN t;
END $$;

-- -----------------------------------------------------------------------------
-- Owner actions. Resource costs are still paid client-side like the rest of
-- the economy; these only stop a client from skipping levels or inflating HP.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upgrade_territory(p_territory_id uuid)
RETURNS public.territories
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t territories;
BEGIN
  UPDATE territories
  SET level = level + 1, max_health = 100 + level * 50, health = 100 + level * 50
  WHERE id = p_territory_id AND owner_id = auth.uid() AND level < 5
  RETURNING * INTO t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Can''t upgrade this territory.'; END IF;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.repair_territory(p_territory_id uuid)
RETURNS public.territories
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t territories;
BEGIN
  UPDATE territories SET health = max_health
  WHERE id = p_territory_id AND owner_id = auth.uid()
  RETURNING * INTO t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Can''t repair this territory.'; END IF;
  RETURN t;
END $$;

REVOKE ALL ON FUNCTION public.territory_battle_powers(uuid, public.territories) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.territory_battle_preview(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.raid_territory(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.capture_territory(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upgrade_territory(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.repair_territory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.territory_battle_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.raid_territory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_territory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upgrade_territory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_territory(uuid) TO authenticated;
