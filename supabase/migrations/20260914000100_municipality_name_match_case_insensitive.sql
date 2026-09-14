-- Match municipalities case-insensitively, and make the duplicate impossible.
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────────
--
-- `treasury_ensure_municipality` looked an entity up with an EXACT name match:
--
--     WHERE name = p_name AND state = p_state AND entity_type = p_entity_type
--     IF NOT FOUND THEN INSERT ...
--
-- So a publisher that changed its own capitalisation produced a SECOND entity
-- rather than matching the first, and a city's history was silently severed at
-- whichever year the spelling changed. That is exactly what happened to Marine
-- on Saint Croix, MN: the Office of the State Auditor wrote "on" through FY2013
-- and "On" from FY2014, and TT ended up holding one city as two — 18 budgets on
-- one row, 4 on the other, and both producing the SAME slug so only one was
-- reachable by `?entity=` at all. See the merge in the preceding migration.
--
-- ⚠⚠ THIS WAS NEVER AN MN PROBLEM. This RPC is called from 51 files. Every
-- loader in the repo carried the identical trap; MN is simply where a publisher
-- happened to change its mind about a capital letter.
--
-- ── THE FIX, IN TWO PARTS ──────────────────────────────────────────────────
--
-- 1. The lookup matches on `lower(name)`.
--
--    ⚠ It deliberately does NOT rewrite the stored name to the incoming
--    casing. First writer wins. Updating it would let a publisher's
--    capitalisation churn rename the entity on every load — and because the
--    `?entity=` slug derives from `name`, a rename silently invalidates every
--    link ever shared to that city. Matching is a lookup concern; the display
--    name is TT's.
--
-- 2. A UNIQUE INDEX on (lower(name), state, entity_type).
--
--    The RPC is the polite path, not the only one. A loader that INSERTs
--    directly could still split a city, and nothing would notice until a
--    verifier happened to check. The index makes the duplicate impossible from
--    ANY path: a future load that tries it FAILS LOUDLY instead of quietly
--    creating a second government.
--
--    ⚠ This index could not have been created before today — it would have
--    failed on the Marine on Saint Croix pair. Verified afterwards: zero
--    case-insensitive collisions across all 8,183 rows.

CREATE OR REPLACE FUNCTION public.treasury_ensure_municipality(
  p_name text,
  p_state text,
  p_entity_type text DEFAULT 'city'::text,
  p_population integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  -- ⚠ lower(name), not name: a publisher changing "on" to "On" must resolve to
  -- the SAME city, not a new one. See the header of migration
  -- 20260914000100 for what happened when this was an exact match.
  SELECT id INTO v_id
    FROM treasury.municipalities
   WHERE lower(name) = lower(p_name)
     AND state = p_state
     AND entity_type = p_entity_type;

  -- ⚠ When found, the stored name is left ALONE even if the casing differs.
  -- The `?entity=` slug derives from `name`, so rewriting it here would
  -- invalidate every shared link to this city on every load.
  IF NOT FOUND THEN
    INSERT INTO treasury.municipalities (name, state, entity_type, population)
    VALUES (p_name, p_state, p_entity_type, p_population)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$function$;

-- The hard guard. Not reachable around, unlike the RPC.
CREATE UNIQUE INDEX IF NOT EXISTS municipalities_name_ci_state_type_uniq
  ON treasury.municipalities (lower(name), state, entity_type);

COMMENT ON INDEX treasury.municipalities_name_ci_state_type_uniq IS
  'One government per (name, state, entity_type), case-insensitively. Exists because a publisher changing its own capitalisation used to create a second entity and sever a city''s history — see Marine on Saint Croix, MN.';

-- ── Self-verification: prove the behaviour, do not assert it ───────────────
DO $$
DECLARE
  probe_id uuid;
  probe_name text;
  probe_state text;
  probe_type text;
  returned_id uuid;
  rows_before int;
  rows_after int;
  bad int := 0;
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;

  -- Use a real existing entity as the probe; never invent one.
  SELECT id, name, state, entity_type
    INTO probe_id, probe_name, probe_state, probe_type
    FROM treasury.municipalities
   WHERE entity_type = 'city' AND name = initcap(name)
   ORDER BY id LIMIT 1;

  -- 1. The same name in a different case must return the SAME id...
  returned_id := public.treasury_ensure_municipality(
    upper(probe_name), probe_state, probe_type, 0);
  IF returned_id IS DISTINCT FROM probe_id THEN
    bad := bad + 1;
    RAISE WARNING 'case-variant lookup returned %, expected %', returned_id, probe_id;
  END IF;

  -- 2. ...and must not have created anything.
  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1;
    RAISE WARNING 'a case-variant call created % row(s)', rows_after - rows_before;
  END IF;

  -- 3. The stored name must be untouched — a load must never rename a city.
  IF (SELECT name FROM treasury.municipalities WHERE id = probe_id) <> probe_name THEN
    bad := bad + 1;
    RAISE WARNING 'the stored name was rewritten by a lookup';
  END IF;

  -- 4. A direct INSERT of a case variant must be REJECTED by the index.
  BEGIN
    INSERT INTO treasury.municipalities (name, state, entity_type, population)
    VALUES (upper(probe_name), probe_state, probe_type, 0);
    bad := bad + 1;
    RAISE WARNING 'the unique index did NOT reject a direct case-variant insert';
    DELETE FROM treasury.municipalities
     WHERE name = upper(probe_name) AND state = probe_state AND entity_type = probe_type
       AND id <> probe_id;
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  IF bad > 0 THEN
    RAISE EXCEPTION 'case-insensitive municipality match: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK — a case variant resolves to the existing city, creates nothing, renames nothing, and a direct duplicate insert is rejected';
END $$;
