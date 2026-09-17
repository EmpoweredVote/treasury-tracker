-- Register a publisher's stable id for an entity TT already holds — the
-- backfill door, exposed to PostgREST.
--
-- ⚠⚠ WITHOUT A BACKFILL, PREVENTION WAITS FOR A LOAD. treasury_ensure_
-- municipality learns a key while writing budgets, so a city is protected only
-- from the next time a load touches it — and MN's loads run as rare statewide
-- batches. A rename published in between would fork the city exactly as
-- before. This function lets scripts/registerMnOsaEntityKeys.mjs register all
-- 851 ids from the published workbook in one pass, writing no budget rows.
--
-- ⚠ IT NEVER CREATES AN ENTITY. That is the whole difference from
-- treasury_ensure_municipality: a registration pass reads a published roster,
-- and a name in that roster which TT does not hold is a FINDING to report, not
-- a city to invent. It returns NULL and the caller prints it.
--
-- Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md

CREATE OR REPLACE FUNCTION public.treasury_register_source_key(
  p_source            text,
  p_source_entity_key text,
  p_name              text,
  p_state             text,
  p_entity_type       text DEFAULT 'city'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_source IS NULL OR p_source_entity_key IS NULL OR p_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
    FROM treasury.municipalities
   WHERE lower(name) = lower(p_name)
     AND state = p_state
     AND entity_type = p_entity_type;

  IF NOT FOUND THEN
    -- A spelling already adjudicated as a rename resolves here, which is how
    -- the historical "Birchwood" row gets its key attached to the survivor.
    SELECT municipality_id INTO v_id
      FROM treasury.municipality_aliases
     WHERE lower(alias_name) = lower(p_name)
       AND state = p_state
       AND entity_type = p_entity_type;
  END IF;

  IF v_id IS NULL THEN
    RETURN NULL;   -- not ours to invent — the caller reports it
  END IF;

  PERFORM treasury.attach_source_key(v_id, p_source, p_source_entity_key, p_name);
  RETURN v_id;
END;
$function$;

COMMENT ON FUNCTION public.treasury_register_source_key(text, text, text, text, text) IS
  'Attach a publisher''s stable unit id to an entity TT already holds. Returns NULL — and creates nothing — when the published name matches no municipality or alias.';

GRANT EXECUTE ON FUNCTION public.treasury_register_source_key(text, text, text, text, text) TO service_role;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE
  bv_id uuid; returned_id uuid; rows_before int; rows_after int; bad int := 0;
  src text := '__selftest_register__';
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;

  SELECT id INTO bv_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';

  -- 1. A known name registers and returns its id.
  returned_id := public.treasury_register_source_key(src, '168', 'Birchwood Village', 'MN', 'city');
  IF returned_id IS DISTINCT FROM bv_id THEN
    bad := bad + 1; RAISE WARNING 'registration returned %, expected %', returned_id, bv_id;
  END IF;

  -- 2. ⭐ A spelling the publisher retired resolves through its ALIAS to the
  -- same government — so a roster from an older file keys the survivor rather
  -- than reporting a miss.
  DELETE FROM treasury.municipality_source_keys WHERE source = src;
  returned_id := public.treasury_register_source_key(src, '168', 'Birchwood', 'MN', 'city');
  IF returned_id IS DISTINCT FROM bv_id THEN
    bad := bad + 1; RAISE WARNING 'the alias path returned %, expected %', returned_id, bv_id;
  END IF;

  -- 3. ⚠ An unknown name returns NULL and CREATES NOTHING.
  returned_id := public.treasury_register_source_key(src, '99999', 'Zzz Selftest Nowhere', 'MN', 'city');
  IF returned_id IS NOT NULL THEN
    bad := bad + 1; RAISE WARNING 'an unknown name returned % instead of NULL', returned_id;
  END IF;

  DELETE FROM treasury.municipality_source_keys WHERE source = src;

  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'registration created % municipality row(s)', rows_after - rows_before;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'register_source_key: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — known names and retired spellings register; an unknown name returns NULL and creates nothing';
END $$;
