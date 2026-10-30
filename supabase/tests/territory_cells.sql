-- Self-check for 011_territory_cells.sql. Runs in a transaction and rolls back.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/territory_cells.sql
BEGIN;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
INSERT INTO players (id, username) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'ronnie'), ('00000000-0000-0000-0000-00000000000b', 'rival');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
INSERT INTO territories (owner_id, lat, lng, name)
VALUES ('00000000-0000-0000-0000-00000000000b', 51.501234, -0.141987, 'Rival keep');

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
DO $$ DECLARE t territories; n int; r record; BEGIN
  INSERT INTO territories (owner_id, lat, lng, name)
  VALUES (auth.uid(), 51.51, -0.13, 'Mine') RETURNING * INTO t;
  ASSERT t.cell_key = (territory_cell(51.51, -0.13)).cell_key
     AND t.lat = (territory_cell(51.51, -0.13)).lat, 'claims are snapped to the cell centre';

  BEGIN
    INSERT INTO territories (owner_id, lat, lng, name) VALUES (auth.uid(), 51.5011, -0.1421, 'Same cell');
    ASSERT false, 'two territories in one cell';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  SELECT count(*) INTO n FROM territories;
  ASSERT n = 1, format('direct reads return only your own territory, got %s', n);

  SELECT * INTO r FROM territories_near(51.5012, -0.1420) WHERE name = 'Rival keep';
  ASSERT FOUND, 'rival territory is listed nearby';
  ASSERT r.owner_id IS NULL AND r.shield_until IS NULL AND r.warded, 'rival owner and ward end are hidden';
  ASSERT abs(r.lat - 51.501234) > 0.00001, 'rival position is the cell centre, not the claim point';

  SELECT * INTO r FROM territories_near(51.5012, -0.1420) WHERE name = 'Mine';
  ASSERT FOUND AND r.owner_id = auth.uid() AND r.shield_until IS NOT NULL, 'your own territory keeps owner and ward end';

  SELECT count(*) INTO n FROM territories_near(52.5, -0.13);
  ASSERT n = 0, 'nothing is returned far from the point';
END $$;

SELECT 'territory cells: ok';
ROLLBACK;
