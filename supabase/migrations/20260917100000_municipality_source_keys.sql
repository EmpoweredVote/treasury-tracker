-- A publisher's own stable unit id for a municipality — approach C.
--
-- ── WHY ────────────────────────────────────────────────────────────────────
--
-- Identity by published NAME is what forked Birchwood and Marine on Saint
-- Croix: the publisher re-spelled the name, the lookup missed, a second entity
-- was created, and the city's history was severed at that boundary with
-- nothing failing. Aliases absorb a rename ONCE IT IS KNOWN, and
-- treasury.detect_forked_entities() catches an unknown one at the END of a
-- load. Neither PREVENTS the fork.
--
-- A publisher's own id does. MN OSA's city workbook carries `GovEntityID`, and
-- it is PROVEN stable across the rename that caused the incident:
--
--   FY2020   "Birchwood"          GovEntityID=168   pop 863
--   FY2022   "Birchwood Village"  GovEntityID=168   pop 851
--             ^^^^ name changed                ^^^^ id did not
--
-- Keying on (source, source_entity_key) makes that rename a NON-EVENT.
--
-- ── ⚠⚠ WHY THIS IS A NEW TABLE AND NOT `municipality_aliases` ──────────────
--
-- The design predicted approach C would land in the alias table "with no
-- further schema work". That was wrong, and two constraints already in the
-- database say so — both measured before this migration was written:
--
--   1. The `municipality_aliases_not_an_entity` trigger REFUSES a row whose
--      alias_name matches a municipality. Registering Minneapolis's id means
--      writing a row named "Minneapolis", so every one of the 851 city
--      registrations would be refused. Keys are not aliases; the common case
--      is a key for a name that has never changed.
--   2. `UNIQUE (source, source_entity_key)` there allows ONE row per key, so
--      after a rename the table cannot hold both the key and the new spelling.
--
-- Separating them lets each keep its own invariant: this table says WHICH
-- GOVERNMENT the publisher means, `municipality_aliases` says WHAT IT HAS BEEN
-- CALLED. A rename writes one row in each.
--
-- Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md

CREATE TABLE IF NOT EXISTS treasury.municipality_source_keys (
  source            text        NOT NULL,
  source_entity_key text        NOT NULL,
  municipality_id   uuid        NOT NULL REFERENCES treasury.municipalities(id) ON DELETE CASCADE,
  first_seen_name   text        NOT NULL,   -- the spelling printed when the key was registered
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_entity_key)
);

CREATE INDEX IF NOT EXISTS municipality_source_keys_municipality_idx
  ON treasury.municipality_source_keys (municipality_id);

-- ⚠ One publisher, one id, one government — IN BOTH DIRECTIONS. The primary
-- key stops one id meaning two cities; this stops one city carrying two ids
-- from the same publisher. The second shape is how id churn would look, and it
-- must fail loudly rather than quietly pick a winner.
CREATE UNIQUE INDEX IF NOT EXISTS municipality_source_keys_one_per_source_uniq
  ON treasury.municipality_source_keys (source, municipality_id);

COMMENT ON TABLE treasury.municipality_source_keys IS
  'A publisher''s own stable unit id for a municipality (approach C). Consulted FIRST by treasury_ensure_municipality, so a re-spelling by that publisher never creates a second government. Written by treasury.attach_source_key().';

GRANT SELECT ON treasury.municipality_source_keys TO service_role;

-- ── The one door that writes a key ─────────────────────────────────────────
--
-- Both callers go through here — treasury_ensure_municipality during a load,
-- and treasury_register_source_key during a backfill — so the conflict rules
-- cannot drift between them.
CREATE OR REPLACE FUNCTION treasury.attach_source_key(
  p_municipality_id   uuid,
  p_source            text,
  p_source_entity_key text,
  p_seen_name         text
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'treasury', 'public'
AS $$
DECLARE
  v_owner uuid;
  v_existing_key text;
  v_owner_name text;
BEGIN
  IF p_source IS NULL OR p_source_entity_key IS NULL OR p_municipality_id IS NULL THEN
    RETURN;
  END IF;

  -- Already registered to this entity? Nothing to do — registration is
  -- idempotent, because every load re-asserts the same key.
  SELECT municipality_id INTO v_owner
    FROM treasury.municipality_source_keys
   WHERE source = p_source AND source_entity_key = p_source_entity_key;

  IF FOUND THEN
    IF v_owner <> p_municipality_id THEN
      SELECT name INTO v_owner_name FROM treasury.municipalities WHERE id = v_owner;
      RAISE EXCEPTION
        'source key %/% already identifies "%" (%) — it cannot also identify % without merging two governments',
        p_source, p_source_entity_key, v_owner_name, v_owner, p_municipality_id;
    END IF;
    RETURN;
  END IF;

  -- ⚠ The other direction: this entity already carries a DIFFERENT id from the
  -- same publisher. That is id churn, and it breaks the premise this mechanism
  -- rests on. Fail, naming both ids, instead of storing a second one.
  SELECT source_entity_key INTO v_existing_key
    FROM treasury.municipality_source_keys
   WHERE source = p_source AND municipality_id = p_municipality_id;

  IF FOUND AND v_existing_key <> p_source_entity_key THEN
    SELECT name INTO v_owner_name FROM treasury.municipalities WHERE id = p_municipality_id;
    RAISE EXCEPTION
      '"%" already carries source key %/% — publisher % now prints % for it, so its id is NOT stable',
      v_owner_name, p_source, v_existing_key, p_source, p_source_entity_key;
  END IF;

  INSERT INTO treasury.municipality_source_keys
    (source, source_entity_key, municipality_id, first_seen_name)
  VALUES
    (p_source, p_source_entity_key, p_municipality_id, p_seen_name);
END $$;

COMMENT ON FUNCTION treasury.attach_source_key(uuid, text, text, text) IS
  'Register a publisher''s stable unit id for a municipality. Idempotent; raises when the key already means a different government, or when the government already carries a different key from the same publisher.';

-- ── Self-verification: prove the behaviour, do not assert it ───────────────
-- ⚠ CI runs no database (reference_ci_and_io_test_timeouts) — this block IS
-- the test, and it rolls back everything it creates.
DO $$
DECLARE
  a_id uuid; b_id uuid; a_name text; b_name text;
  rows_before int; rows_after int; bad int := 0;
  raised boolean;
  src text := '__selftest_publisher__';
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipality_source_keys;

  SELECT id, name INTO a_id, a_name FROM treasury.municipalities
   WHERE entity_type = 'city' ORDER BY id LIMIT 1;
  SELECT id, name INTO b_id, b_name FROM treasury.municipalities
   WHERE entity_type = 'city' AND id <> a_id ORDER BY id LIMIT 1;

  -- 1. A key registers.
  PERFORM treasury.attach_source_key(a_id, src, '168', a_name);
  IF NOT EXISTS (SELECT 1 FROM treasury.municipality_source_keys
                  WHERE source = src AND source_entity_key = '168' AND municipality_id = a_id) THEN
    bad := bad + 1; RAISE WARNING 'the key did not register';
  END IF;

  -- 2. Re-registering the same pairing is a no-op, not an error. Every load
  -- re-asserts the key it already wrote.
  BEGIN
    PERFORM treasury.attach_source_key(a_id, src, '168', a_name);
  EXCEPTION WHEN others THEN
    bad := bad + 1; RAISE WARNING 'idempotent re-registration RAISED: %', SQLERRM;
  END;

  -- 3. The same key pointed at a different government is REFUSED.
  raised := false;
  BEGIN
    PERFORM treasury.attach_source_key(b_id, src, '168', b_name);
  EXCEPTION WHEN others THEN raised := true;
  END;
  IF NOT raised THEN
    bad := bad + 1; RAISE WARNING 'one key was allowed to identify TWO governments';
  END IF;

  -- 4. A second key from the same publisher for the same government is
  -- REFUSED — this is the id-churn shape.
  raised := false;
  BEGIN
    PERFORM treasury.attach_source_key(a_id, src, '999', a_name);
  EXCEPTION WHEN others THEN raised := true;
  END;
  IF NOT raised THEN
    bad := bad + 1; RAISE WARNING 'one government was allowed TWO ids from one publisher';
  END IF;

  DELETE FROM treasury.municipality_source_keys WHERE source = src;

  SELECT count(*) INTO rows_after FROM treasury.municipality_source_keys;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'self-test left % row(s) behind', rows_after - rows_before;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'municipality_source_keys: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — keys register idempotently; one key cannot mean two cities, one city cannot carry two keys';
END $$;
