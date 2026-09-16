-- Merge the two "Birchwood, MN" rows into one city.
--
-- ── WHAT WENT WRONG ────────────────────────────────────────────────────────
--
-- This is ONE city that TT holds as TWO entities, split by a NAME CHANGE in the
-- publisher's own files:
--
--   fb5e4112…  "Birchwood"          18 budgets, FY2012-2020, pop 863, geoid NULL
--   b7291e76…  "Birchwood Village"   6 budgets, FY2021-2023, pop 898, geoid 2706058
--
-- Same state, same single source (Minnesota Office of the State Auditor
-- City/County Finances Report), contiguous non-overlapping year ranges. The OSA
-- began publishing the city's full legal name — Birchwood Village, which is also
-- what Census calls it (place 2706058, "Birchwood Village city") — between its
-- FY2020 and FY2021 reports. The loader matches entities BY NAME, so the new
-- spelling did not match the existing row and created a second one. Every year
-- from 2021 forward went to the new entity and the city's history was severed at
-- the 2020/2021 boundary.
--
-- ⚠⚠ NOTHING FAILED AND NO FIGURE IS WRONG. Both rows carry honest OSA data.
-- The damage is that each half LOOKS COMPLETE AND IS NOT: a reader opening
-- Birchwood sees 2012-2020 and no hint that 2021-2023 exists, or the reverse.
-- Same shape as Marine on Saint Croix (20260914000000) and the severed LA city
-- series.
--
-- ⚠ UNLIKE MARINE, THESE TWO DO NOT COLLIDE ON SLUG — `birchwood-mn` and
-- `birchwood-village-mn` are different, so no reader has ever landed on the
-- wrong city. That is why nothing surfaced this until the geoid work: PR #184
-- found "Birchwood" resolving to 2706058, which "Birchwood Village" already
-- held, and refused to write a duplicate.
--
-- ⚠ THIS IS THE SECOND TIME THE NAME-MATCHING LOADER HAS FORKED A CITY, both
-- from the SAME publisher, one day apart. #182 made the match
-- case-insensitive, which would NOT have caught this one: "on" -> "On" is a
-- case change, but "Birchwood" -> "Birchwood Village" is a whole added word.
-- Expect more MN OSA renames. The durable fix is matching on a stable key
-- rather than on the published name; that is not this migration.
--
-- ── WHICH ROW SURVIVES, AND WHY IT IS THE OPPOSITE CHOICE FROM MARINE ───────
--
-- Marine kept the row with the LARGER, CURRENT series because lowercase "on"
-- was the city's actual name. Here the larger series (18 rows) is on the row
-- being REMOVED, and that is still correct:
--
--   "Birchwood Village" is the city's legal name and the Census name
--   it already holds the geoid (2706058) and the county_id
--   it holds the CURRENT series, so future OSA loads land on it unchanged
--
-- Keeping "Birchwood" instead would mean re-pointing the current series onto a
-- row with the wrong name, no geoid and no county, and every future load would
-- fork again. The 18 older budgets are repointed forward.
--
-- ⚠ CONSEQUENCE: `?entity=birchwood-mn` stops resolving. Since PR #158 an
-- unknown slug renders a not-found state naming what was asked for, rather than
-- silently showing Bloomington, Indiana's budget — so this degrades to an
-- honest miss, not a wrong city.
--
-- ⚠⚠ POPULATION CANNOT BE THE SAME-CITY PROOF HERE, AND IT WAS FOR MARINE.
-- Marine's two rows both read 704 and the migration asserted equality. These
-- read 863 and 898 — different vintages of the same small city, because the
-- rows were last touched by loads nine years apart. Asserting equality would
-- refuse a correct merge. The checks below substitute a 10% population band
-- plus same-state, single-shared-source and zero-year-overlap. That is weaker,
-- and it is stated rather than hidden.

DO $$
DECLARE
  keep_id  uuid := 'b7291e76-2c08-4719-925f-93c7f952149a';  -- "Birchwood Village"
  drop_id  uuid := 'fb5e4112-6cfc-4d89-b894-c6b786a26cff';  -- "Birchwood"
  money_before  numeric;
  money_after   numeric;
  budgets_before int;
  budgets_after  int;
  pop_keep int;
  pop_drop int;
  n int;
  queue_union int;
  bad int := 0;
BEGIN
  -- ── Pre-flight ───────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM treasury.municipalities WHERE id = keep_id) THEN
    RAISE EXCEPTION 'survivor % not found — already merged?', keep_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM treasury.municipalities WHERE id = drop_id) THEN
    RAISE NOTICE 'OK — % already absent; nothing to merge', drop_id;
    RETURN;
  END IF;

  -- Same state, or they are not the same city.
  IF (SELECT count(DISTINCT state) FROM treasury.municipalities
        WHERE id IN (keep_id, drop_id)) <> 1 THEN
    RAISE EXCEPTION 'the two rows disagree on state — not the same city';
  END IF;

  -- Population within 10%. See the header: equality is unavailable here.
  SELECT population INTO pop_keep FROM treasury.municipalities WHERE id = keep_id;
  SELECT population INTO pop_drop FROM treasury.municipalities WHERE id = drop_id;
  IF pop_keep IS NULL OR pop_drop IS NULL THEN
    RAISE EXCEPTION 'a population is NULL — cannot corroborate same-city';
  END IF;
  IF abs(pop_keep - pop_drop)::numeric / greatest(pop_keep, pop_drop) > 0.10 THEN
    RAISE EXCEPTION 'populations % and % differ by more than 10%% — not obviously the same city',
      pop_drop, pop_keep;
  END IF;

  -- Both halves must come from the SAME publisher. Two genuinely different
  -- governments would not share one source across a clean year split.
  IF (SELECT count(DISTINCT data_source) FROM treasury.budgets
        WHERE municipality_id IN (keep_id, drop_id)) <> 1 THEN
    RAISE EXCEPTION 'the two rows do not share a single data_source';
  END IF;

  -- ⚠ A repoint collides if both rows hold the same (year, dataset, scope,
  -- basis). Measured: they do not — 2012-2020 vs 2021-2023 — but assert it
  -- rather than trust it, because a collision would abort mid-migration.
  SELECT count(*) INTO n
  FROM treasury.budgets a JOIN treasury.budgets b
    ON a.fiscal_year = b.fiscal_year AND a.dataset_type = b.dataset_type
   AND a.fund_scope IS NOT DISTINCT FROM b.fund_scope
   AND a.basis IS NOT DISTINCT FROM b.basis
  WHERE a.municipality_id = drop_id AND b.municipality_id = keep_id;
  IF n > 0 THEN
    RAISE EXCEPTION '% overlapping budget rows — merge would collide', n;
  END IF;

  -- ⚠⚠ Every child table that is NOT repointed below must be empty for the row
  -- being deleted. The four CASCADE tables (category_enrichment, data_sources,
  -- org_financial_summary, program_details) are the dangerous ones: a non-empty
  -- CASCADE child disappears without a word.
  SELECT
    (SELECT count(*) FROM treasury.category_enrichment WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.data_sources         WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.org_financial_summary WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.program_details      WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.department_aliases   WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.gateway_expenditures WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.gateway_grants       WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.gateway_revenue      WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.gateway_school_eca   WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.gateway_tax_distributions WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.operating_budgets    WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.revenue_budgets      WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.salaries             WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.vendors              WHERE municipality_id = drop_id)
  + (SELECT count(*) FROM treasury.municipalities       WHERE county_id = drop_id)
  INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION '% rows in child tables still reference % — repoint them first', n, drop_id;
  END IF;

  -- ── Capture the oracle: money and row count across BOTH entities ─────────
  SELECT coalesce(sum(total_budget), 0), count(*)
    INTO money_before, budgets_before
    FROM treasury.budgets WHERE municipality_id IN (keep_id, drop_id);

  -- ── The merge ────────────────────────────────────────────────────────────
  UPDATE treasury.budgets SET municipality_id = keep_id WHERE municipality_id = drop_id;

  -- ⚠ enrichment_queue is UNIQUE on (municipality_id, name_key) and a blanket
  -- repoint aborts: both rows hold pending jobs for the same categories,
  -- because they are the same city. Carry over only the name_keys the survivor
  -- lacks, drop the redundant ones, and assert below that the survivor ends up
  -- with the UNION of both sets rather than either half.
  SELECT count(*) INTO queue_union
  FROM (SELECT DISTINCT name_key FROM treasury.enrichment_queue
         WHERE municipality_id IN (keep_id, drop_id)) u;

  UPDATE treasury.enrichment_queue q SET municipality_id = keep_id
   WHERE q.municipality_id = drop_id
     AND NOT EXISTS (SELECT 1 FROM treasury.enrichment_queue k
                      WHERE k.municipality_id = keep_id AND k.name_key = q.name_key);
  DELETE FROM treasury.enrichment_queue WHERE municipality_id = drop_id;

  DELETE FROM treasury.municipalities WHERE id = drop_id;

  -- ── Assert ───────────────────────────────────────────────────────────────
  SELECT coalesce(sum(total_budget), 0), count(*)
    INTO money_after, budgets_after
    FROM treasury.budgets WHERE municipality_id = keep_id;

  IF money_after <> money_before THEN
    bad := bad + 1;
    RAISE WARNING 'MONEY MOVED: % before, % after (delta %)',
      money_before, money_after, money_after - money_before;
  END IF;
  IF budgets_after <> budgets_before THEN
    bad := bad + 1;
    RAISE WARNING 'budget rows lost: % before, % after', budgets_before, budgets_after;
  END IF;
  IF EXISTS (SELECT 1 FROM treasury.municipalities WHERE id = drop_id) THEN
    bad := bad + 1; RAISE WARNING 'the duplicate row still exists';
  END IF;
  IF (SELECT count(*) FROM treasury.municipalities
        WHERE state = 'MN' AND lower(name) LIKE 'birchwood%') <> 1 THEN
    bad := bad + 1; RAISE WARNING 'still more than one Birchwood in MN';
  END IF;
  -- the survivor must be the named, geoid-bearing row
  IF (SELECT geoid FROM treasury.municipalities WHERE id = keep_id) <> '2706058' THEN
    bad := bad + 1; RAISE WARNING 'survivor does not carry geoid 2706058';
  END IF;
  -- the defect that surfaced this: no geoid may be claimed twice, anywhere
  IF EXISTS (SELECT geoid FROM treasury.municipalities
              WHERE geoid IS NOT NULL GROUP BY geoid HAVING count(*) > 1) THEN
    bad := bad + 1; RAISE WARNING 'a duplicate geoid still exists somewhere in the table';
  END IF;
  -- ⭐ THE POINT OF THE MERGE: one continuous series, 2012-2023, no gap.
  SELECT count(DISTINCT fiscal_year) INTO n
    FROM treasury.budgets WHERE municipality_id = keep_id;
  IF n <> 12 THEN
    bad := bad + 1; RAISE WARNING 'expected 12 distinct fiscal years, found %', n;
  END IF;
  IF EXISTS (
    SELECT 1 FROM generate_series(2012, 2023) y
     WHERE NOT EXISTS (SELECT 1 FROM treasury.budgets
                        WHERE municipality_id = keep_id AND fiscal_year = y)
  ) THEN
    bad := bad + 1; RAISE WARNING 'the merged series has a hole between 2012 and 2023';
  END IF;
  -- the survivor must hold the UNION of both queues, not either half
  SELECT count(DISTINCT name_key) INTO n
    FROM treasury.enrichment_queue WHERE municipality_id = keep_id;
  IF n <> queue_union THEN
    bad := bad + 1;
    RAISE WARNING 'enrichment queue lost work: % distinct name_keys, expected the union of %',
      n, queue_union;
  END IF;
  IF EXISTS (SELECT 1 FROM treasury.enrichment_queue WHERE municipality_id = drop_id) THEN
    bad := bad + 1; RAISE WARNING 'queue rows still point at the removed entity';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'Birchwood merge: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK — merged into one city: % budget rows, $% unchanged, FY2012-2023 continuous',
    budgets_after, money_after;
END $$;
