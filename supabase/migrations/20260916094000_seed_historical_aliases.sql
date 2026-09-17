-- Alias the spelling that was merged away.
--
-- ⚠⚠ THIS CLOSES A HOLE THAT IS OPEN RIGHT NOW, IT IS NOT TIDYING.
--
-- PR #185 DELETED a row whose name the publisher HAS ALREADY PRINTED. If the
-- Minnesota Office of the State Auditor republishes any FY2012-2020 figure
-- under "Birchwood", today's loader finds no match and CREATES THE ENTITY
-- AGAIN — re-forking the city that was merged yesterday, and severing its
-- history a second time.
--
-- ── ⚠ WHY MARINE ON SAINT CROIX GETS NO ALIAS ──────────────────────────────
--
-- The first draft of this migration also aliased "Marine On Saint Croix" (the
-- capital-O spelling deleted by 20260914000000). The alias guard REFUSED it,
-- correctly: a name is either an entity or an alias, never both, and that guard
-- compares case-insensitively.
--
-- The refusal was right and the alias was unnecessary. Marine's two spellings
-- differed ONLY IN CASE, and #182 made the lookup itself case-insensitive — so
-- the old capitalisation already resolves to the survivor with no alias at all.
-- Measured before writing this: treasury_ensure_municipality('Marine On Saint
-- Croix', 'MN', 'city') returns bcfbf138-d255-49a7-ac51-100de65b2172, the
-- surviving entity.
--
-- ⭐ THE DISTINCTION WORTH KEEPING: the alias table is for renames that change
-- MORE than case. A case-only change is already handled one layer down, and
-- adding an alias for it would be dead configuration that looks load-bearing.
-- Birchwood -> Birchwood Village added a whole word, which is exactly what
-- #182 cannot absorb.
--
-- The id is resolved by name rather than hardcoded, so this fails loudly if the
-- survivor is not where it is expected, instead of aliasing the wrong city.

DO $$
DECLARE
  birchwood_id uuid;
BEGIN
  SELECT id INTO STRICT birchwood_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';

  INSERT INTO treasury.municipality_aliases
    (municipality_id, alias_name, state, entity_type, source, note)
  VALUES
    (birchwood_id, 'Birchwood', 'MN', 'city',
     'Minnesota Office of the State Auditor City/County Finances Report',
     'OSA published this spelling through FY2020; merged into Birchwood Village by PR #185. Without this alias a republished FY2012-2020 figure would create a second entity again.')
  ON CONFLICT DO NOTHING;
END $$;

-- ── Self-verification: the hole is actually closed ────────────────────────
DO $$
DECLARE
  v_id uuid; expect_id uuid; marine_id uuid; marine_expect uuid;
  rows_before int; rows_after int; bad int := 0;
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;

  SELECT id INTO expect_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';

  -- 1. The old spelling must resolve to the survivor...
  v_id := public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863);
  IF v_id IS DISTINCT FROM expect_id THEN
    bad := bad + 1;
    RAISE WARNING '"Birchwood" resolved to %, expected %', v_id, expect_id;
  END IF;

  -- 2. ...and must create NOTHING. This is the assertion that proves the
  -- re-fork is closed rather than merely unlikely.
  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1;
    RAISE WARNING 'the old spelling CREATED % row(s) — the re-fork is still open',
      rows_after - rows_before;
  END IF;

  -- 3. Marine's case-only variant resolves WITHOUT an alias, which is why it
  -- does not get one. If this ever fails, the case-insensitive match (#182)
  -- has regressed and Marine needs an alias after all.
  SELECT id INTO marine_expect FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'marine on saint croix';
  marine_id := public.treasury_ensure_municipality('Marine On Saint Croix', 'MN', 'city', 704);
  IF marine_id IS DISTINCT FROM marine_expect THEN
    bad := bad + 1;
    RAISE WARNING 'the case-only variant did NOT resolve without an alias (got %, expected %)',
      marine_id, marine_expect;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'historical aliases: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — a republished "Birchwood" resolves to Birchwood Village and creates nothing; Marine needs no alias';
END $$;
