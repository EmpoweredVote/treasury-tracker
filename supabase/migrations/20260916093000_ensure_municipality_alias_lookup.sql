-- Resolve a known rename to the entity it renamed.
--
-- ⚠⚠ ADDING PARAMETERS CREATES AN OVERLOAD, IT DOES NOT REPLACE.
-- `CREATE OR REPLACE FUNCTION` matches on the argument list, so the 4-argument
-- function would survive alongside the 6-argument one and PostgREST could
-- resolve to either — a coin flip on every load. Drop the old signature
-- explicitly. Callers pass NAMED parameters, so the existing 30 call sites
-- resolve against the new function's defaults with no edit.
DROP FUNCTION IF EXISTS public.treasury_ensure_municipality(text, text, text, integer);

CREATE OR REPLACE FUNCTION public.treasury_ensure_municipality(
  p_name              text,
  p_state             text,
  p_entity_type       text    DEFAULT 'city',
  p_population        integer DEFAULT 0,
  p_source            text    DEFAULT NULL,
  p_source_entity_key text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  -- 1. ⭐ Approach C: the publisher's own stable key wins when supplied. This is
  -- the only path here that makes a rename a non-event rather than something to
  -- be caught afterwards.
  IF p_source IS NOT NULL AND p_source_entity_key IS NOT NULL THEN
    SELECT municipality_id INTO v_id
      FROM treasury.municipality_aliases
     WHERE source = p_source AND source_entity_key = p_source_entity_key;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  -- 2. Today's behaviour: case-insensitive name match (#182).
  --
  -- ⚠ When found, the stored name is left ALONE even if the casing differs.
  -- The `?entity=` slug derives from `name`, so rewriting it here would
  -- invalidate every link ever shared to this city, on every load.
  SELECT id INTO v_id
    FROM treasury.municipalities
   WHERE lower(name) = lower(p_name)
     AND state = p_state
     AND entity_type = p_entity_type;
  IF FOUND THEN RETURN v_id; END IF;

  -- 3. New: a known rename resolves to the entity it renamed.
  -- ⚠ The same rule applies — resolving through an alias must NEVER rename.
  SELECT municipality_id INTO v_id
    FROM treasury.municipality_aliases
   WHERE lower(alias_name) = lower(p_name)
     AND state = p_state
     AND entity_type = p_entity_type;
  IF FOUND THEN RETURN v_id; END IF;

  -- 4. Create. An unknown rename still creates a second entity here; it is
  -- caught at the END of the load by treasury.detect_forked_entities(), which
  -- needs the budget rows this row does not have yet.
  INSERT INTO treasury.municipalities (name, state, entity_type, population)
  VALUES (p_name, p_state, p_entity_type, p_population)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE
  probe_id uuid; probe_name text; probe_state text; probe_type text;
  returned_id uuid; rows_before int; rows_after int; bad int := 0;
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;

  SELECT id, name, state, entity_type
    INTO probe_id, probe_name, probe_state, probe_type
    FROM treasury.municipalities WHERE entity_type = 'city' ORDER BY id LIMIT 1;

  -- 1. No regression on #182: a case variant still resolves to the same city.
  returned_id := public.treasury_ensure_municipality(
    upper(probe_name), probe_state, probe_type, 0);
  IF returned_id IS DISTINCT FROM probe_id THEN
    bad := bad + 1; RAISE WARNING 'case-variant lookup regressed (#182)';
  END IF;

  -- 2. An alias resolves to its entity...
  INSERT INTO treasury.municipality_aliases
    (municipality_id, alias_name, state, entity_type, note)
  VALUES (probe_id, probe_name || ' Selftest Alias', probe_state, probe_type, 'self-test');

  returned_id := public.treasury_ensure_municipality(
    probe_name || ' Selftest Alias', probe_state, probe_type, 0);
  IF returned_id IS DISTINCT FROM probe_id THEN
    bad := bad + 1;
    RAISE WARNING 'alias lookup returned %, expected %', returned_id, probe_id;
  END IF;

  -- 3. ...and does NOT rename it.
  IF (SELECT name FROM treasury.municipalities WHERE id = probe_id) <> probe_name THEN
    bad := bad + 1; RAISE WARNING 'resolving through an alias RENAMED the entity';
  END IF;

  DELETE FROM treasury.municipality_aliases
   WHERE municipality_id = probe_id AND alias_name = probe_name || ' Selftest Alias';

  -- 4. No lookup created anything.
  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'lookups created % row(s)', rows_after - rows_before;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'alias lookup: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — aliases resolve, case match intact, nothing renamed, nothing created';
END $$;
