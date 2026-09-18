-- Which entities a publisher's keys do NOT cover yet.
--
-- ⚠⚠ A BACKFILL THAT ONLY COUNTS WHAT IT WROTE MEASURES ITSELF. The number
-- that matters is the opposite one: the cities still identified by NAME ALONE
-- after the pass, because those are the ones a rename can still fork. Without
-- this door the registration script could report "851 registered" while ten
-- cities sat unprotected and unnamed.
--
-- ⚠ PostgREST only reaches `public`, and `treasury` is not exposed to the
-- caller's role, so the residual cannot be queried from a script directly —
-- the same reason detect_forked_entities() has a wrapper.
--
-- Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md

CREATE OR REPLACE FUNCTION public.treasury_unkeyed_entities(
  p_source      text,
  p_state       text,
  p_entity_type text DEFAULT 'city'
)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $$
  SELECT m.id, m.name
    FROM treasury.municipalities m
   WHERE m.state = p_state
     AND m.entity_type = p_entity_type
     AND NOT EXISTS (
       SELECT 1 FROM treasury.municipality_source_keys k
        WHERE k.municipality_id = m.id
          AND k.source = p_source
     )
   ORDER BY m.name;
$$;

COMMENT ON FUNCTION public.treasury_unkeyed_entities(text, text, text) IS
  'Entities of a state/type that carry NO stable key from the given publisher — i.e. those still identified by name alone, and still forkable by a rename.';

GRANT EXECUTE ON FUNCTION public.treasury_unkeyed_entities(text, text, text) TO service_role;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE
  bv_id uuid; total int; unkeyed_before int; unkeyed_after int; bad int := 0;
  src text := '__selftest_coverage__';
BEGIN
  SELECT count(*) INTO total FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city';

  SELECT count(*) INTO unkeyed_before
    FROM public.treasury_unkeyed_entities(src, 'MN', 'city');

  -- 1. With no keys registered, EVERY entity is unkeyed. A residual that reads
  -- zero because the query is wrong would be the worst possible result here.
  IF unkeyed_before <> total THEN
    bad := bad + 1;
    RAISE WARNING 'with no keys, % of % entities reported unkeyed', unkeyed_before, total;
  END IF;

  -- 2. Registering one key removes exactly that one from the residual.
  SELECT id INTO bv_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';
  PERFORM treasury.attach_source_key(bv_id, src, '168', 'Birchwood Village');

  SELECT count(*) INTO unkeyed_after
    FROM public.treasury_unkeyed_entities(src, 'MN', 'city');
  IF unkeyed_after <> unkeyed_before - 1 THEN
    bad := bad + 1;
    RAISE WARNING 'one registration moved the residual by %, expected 1',
      unkeyed_before - unkeyed_after;
  END IF;
  IF EXISTS (SELECT 1 FROM public.treasury_unkeyed_entities(src, 'MN', 'city') WHERE id = bv_id) THEN
    bad := bad + 1; RAISE WARNING 'a keyed entity still reported as unkeyed';
  END IF;

  DELETE FROM treasury.municipality_source_keys WHERE source = src;

  IF bad > 0 THEN
    RAISE EXCEPTION 'unkeyed_entities: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — the residual counts what is NOT protected, and shrinks by exactly one per key';
END $$;
