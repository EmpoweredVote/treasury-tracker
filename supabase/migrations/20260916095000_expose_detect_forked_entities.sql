-- Expose the fork check to PostgREST.
--
-- `assertNoNewForks()` in scripts/lib/ensureMunicipality.mjs calls this by RPC
-- at the end of every load, and PostgREST only exposes functions in the
-- `public` schema. The rule itself stays in `treasury`; this is a thin wrapper
-- so there is still exactly ONE implementation.
--
-- ⚠ SECURITY DEFINER because the `treasury` schema is not reachable by the
-- caller's role directly — the same reason treasury_ensure_municipality is a
-- definer function.

CREATE OR REPLACE FUNCTION public.detect_forked_entities()
RETURNS SETOF treasury.municipality_fork_pair
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $$
  SELECT * FROM treasury.detect_forked_entities();
$$;

COMMENT ON FUNCTION public.detect_forked_entities() IS
  'PostgREST-facing wrapper for treasury.detect_forked_entities(). Called by assertNoNewForks() at the end of every load.';

GRANT EXECUTE ON FUNCTION public.detect_forked_entities() TO service_role;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE wrapper_rows int; inner_rows int; bad int := 0;
BEGIN
  SELECT count(*) INTO wrapper_rows FROM public.detect_forked_entities();
  SELECT count(*) INTO inner_rows   FROM treasury.detect_forked_entities();

  -- The wrapper must agree with the rule it wraps, or the loaders and the
  -- .sql file are checking different things.
  IF wrapper_rows <> inner_rows THEN
    bad := bad + 1;
    RAISE WARNING 'wrapper returned % row(s), inner function returned %',
      wrapper_rows, inner_rows;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'expose_detect_forked_entities: % checks failed', bad;
  END IF;
  RAISE NOTICE 'OK — public wrapper agrees with treasury.detect_forked_entities (% rows)', wrapper_rows;
END $$;
