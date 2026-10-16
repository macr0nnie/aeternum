-- Self-check for 010_territory_battles.sql. Runs in a transaction and rolls back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/territory_battles.sql
-- Prints "territory battles: ok" or stops at the first failed ASSERT.
BEGIN;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000d');
INSERT INTO players (id, username, stats) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'atk', '{"ATK":20,"SPD":10,"LCK":4}'),
  ('00000000-0000-0000-0000-00000000000d', 'def', '{"DEF":10,"END":5}');
INSERT INTO territories (id, owner_id, lat, lng, name, level, health, max_health) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000d', 1, 1, 'Home', 5, 999, 999),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000d', 1.01, 1, 'Outpost', 1, 100, 100);

DO $$ BEGIN
  ASSERT (SELECT level = 1 AND max_health = 100 AND shield_until > now() + interval '23 hours'
          FROM territories WHERE name = 'Home'), 'new claims start at L1 with a 24 h shield';
END $$;

-- Act as the attacker.
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

DO $$ DECLARE n int; BEGIN
  UPDATE territories SET owner_id = auth.uid() WHERE name = 'Outpost';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'clients can no longer write owner_id directly';

  BEGIN
    PERFORM raid_territory('00000000-0000-0000-0000-0000000000f2');
    ASSERT false, 'shielded territory was raided';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%shielded%', SQLERRM;
  END;
END $$;

RESET role;
UPDATE territories SET shield_until = NULL;
SET LOCAL role authenticated;

DO $$ DECLARE t territories; p record; BEGIN
  SELECT * INTO p FROM territory_battle_preview('00000000-0000-0000-0000-0000000000f2');
  -- atk 20*2+10+4/2 = 52; def 10*2+5+1*8 = 33
  ASSERT p.atk = 52 AND p.def = 33, format('powers %s/%s', p.atk, p.def);

  t := raid_territory('00000000-0000-0000-0000-0000000000f2');
  -- round(100 * 0.36 * 52/85) = 22
  ASSERT t.health = 78, format('raid left %s HP', t.health);

  BEGIN
    PERFORM raid_territory('00000000-0000-0000-0000-0000000000f2');
    ASSERT false, 'raid cooldown not enforced';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%regrouping%', SQLERRM;
  END;

  BEGIN
    PERFORM capture_territory('00000000-0000-0000-0000-0000000000f2');
    ASSERT false, 'captured above 30%% HP';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE '%30%%', SQLERRM;
  END;

  BEGIN
    PERFORM upgrade_territory('00000000-0000-0000-0000-0000000000f2');
    ASSERT false, 'non-owner upgraded a territory';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;

-- Defender fortifies: walls 5 + Iron Golem; outpost weakened to 30%.
RESET role;
INSERT INTO fortress (player_id, walls_level, defense_slots)
VALUES ('00000000-0000-0000-0000-00000000000d', 5, '[{"slot_index":0,"skill_id":"bsk_iron_golem"}]');
UPDATE territories SET health = 30 WHERE name = 'Outpost';
DELETE FROM territory_attacks;
SET LOCAL role authenticated;

DO $$ DECLARE t territories; p record; BEGIN
  SELECT * INTO p FROM territory_battle_preview('00000000-0000-0000-0000-0000000000f2');
  ASSERT p.def = 33 + 20 + 20, format('walls + golem def %s', p.def);

  t := capture_territory('00000000-0000-0000-0000-0000000000f2');
  ASSERT t.owner_id = auth.uid() AND t.health = t.max_health
     AND t.shield_until > now() + interval '11 hours', 'capture moves ownership, refills HP, shields 12 h';

  t := upgrade_territory('00000000-0000-0000-0000-0000000000f2');
  ASSERT t.level = 2 AND t.max_health = 150 AND t.health = 150, 'new owner can upgrade';
END $$;

-- The defender's last territory can be raided but not taken.
RESET role;
UPDATE territories SET shield_until = NULL, health = 0 WHERE name = 'Home';
SET LOCAL role authenticated;

DO $$ BEGIN
  PERFORM capture_territory('00000000-0000-0000-0000-0000000000f1');
  ASSERT false, 'last territory was captured';
EXCEPTION WHEN raise_exception THEN
  ASSERT SQLERRM LIKE '%last territory%', SQLERRM;
END $$;

-- Fortress levels are clamped.
RESET role;
DO $$ BEGIN
  UPDATE fortress SET walls_level = 99;
  ASSERT false, 'walls_level 99 accepted';
EXCEPTION WHEN check_violation THEN NULL;
END $$;

SELECT 'territory battles: ok';
ROLLBACK;
