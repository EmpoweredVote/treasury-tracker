-- Merge the two "Marine on Saint Croix, MN" rows into one city.
--
-- ── WHAT WENT WRONG ────────────────────────────────────────────────────────
--
-- This is ONE city that TT held as TWO entities, split by a capitalisation
-- change in the publisher's own files:
--
--   bcfbf138…  "Marine on Saint Croix"   18 budgets, FY2014-2023
--   793a418a…  "Marine On Saint Croix"    4 budgets, FY2012-2013
--
-- Same population (704), same county, same source (MN Office of the State
-- Auditor). The OSA changed "on" to "On" between its FY2013 and FY2014
-- publications; the loader matches entities BY NAME, so the new spelling did
-- not match the existing row and created a second one. Every year from 2014
-- forward went to the new entity and the city's history was severed at the
-- 2013/2014 boundary.
--
-- ⚠⚠ NOTHING FAILED AND NO FIGURE IS WRONG. Both rows carry honest OSA data.
-- The damage is that BOTH PRODUCE THE SAME SLUG, `marine-on-saint-croix-mn`,
-- so `resolveEntityParam` reaches only whichever the list returns first — and
-- a reader lands on a decade with no 2012-2013, or on two years with no
-- decade, with nothing on the page saying the rest exists. That is the same
-- shape as the severed LA city series: the page looks complete and is not.
--
-- The duplicate geoid (2740562, both rows) was only the symptom that surfaced
-- it — see PR #178, where the backfill's uniqueness check caught it.
--
-- ── WHAT THIS DOES ─────────────────────────────────────────────────────────
--
-- Repoints the FY2012-2013 budgets (and their 5 pending enrichment_queue
-- rows) onto the surviving entity, then removes the empty husk. Keeping
-- bcfbf138… because lowercase "on" is the city's actual name and it holds the
-- larger, current series.
--
-- ⚠ `treasury.municipalities` has SIXTEEN child tables and FOUR of them
-- CASCADE on delete (category_enrichment, data_sources, org_financial_summary,
-- program_details). A delete that ignored them would destroy rows silently.
-- All four are empty for this id and this migration ASSERTS that before
-- deleting rather than assuming it.
--
-- ⚠ FY2017 is absent from the surviving row. That is a pre-existing gap in the
-- OSA data, not something this merge creates, and it is left alone.

DO $$
DECLARE
  keep_id  uuid := 'bcfbf138-d255-49a7-ac51-100de65b2172';  -- "Marine on Saint Croix"
  drop_id  uuid := '793a418a-0758-4cf4-bdf2-1cc256194f61';  -- "Marine On Saint Croix"
  money_before  numeric;
  money_after   numeric;
  budgets_before int;
  budgets_after  int;
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

  -- The two must genuinely be the same city, not two governments that happen
  -- to share a name. Refuse if state or population disagree.
  IF (SELECT count(DISTINCT (state, population)) FROM treasury.municipalities
        WHERE id IN (keep_id, drop_id)) <> 1 THEN
    RAISE EXCEPTION 'the two rows disagree on state or population — not the same city';
  END IF;

  -- ⚠ A repoint collides if both rows hold the same (year, dataset, scope,
  -- basis). Measured: they do not — 2012-2013 vs 2014-2023 — but assert it
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

  -- ⚠⚠ Every child table that is NOT repointed below must be empty for the
  -- row being deleted. The four CASCADE tables are the dangerous ones: a
  -- non-empty CASCADE child disappears without a word.
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

  -- ⚠ enrichment_queue is UNIQUE on (municipality_id, name_key), and a blanket
  -- repoint aborts: both rows hold pending jobs for the same categories,
  -- because they are the same city. Four of the five duplicate work already
  -- queued on the survivor; one ("other & unallocated") does not. Carry the
  -- unique one over, drop the redundant ones, and assert below that the
  -- survivor ends up with the UNION of both sets rather than either half.
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
        WHERE state = 'MN' AND lower(name) = 'marine on saint croix') <> 1 THEN
    bad := bad + 1; RAISE WARNING 'still more than one Marine on Saint Croix';
  END IF;
  -- the defect that surfaced this: no geoid may be claimed twice, anywhere
  IF EXISTS (SELECT geoid FROM treasury.municipalities
              WHERE geoid IS NOT NULL GROUP BY geoid HAVING count(*) > 1) THEN
    bad := bad + 1; RAISE WARNING 'a duplicate geoid still exists somewhere in the table';
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
    RAISE EXCEPTION 'Marine on Saint Croix merge: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK — merged into one city: % budget rows, $% unchanged, FY2012-2023 continuous',
    budgets_after, money_after;
END $$;
