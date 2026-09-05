-- Delete the 45 legacy Indiana Gateway-vintage budget rows.
--
-- Companion to 20260905000000, which disables the nine syncs that made them.
-- That migration carries the full diagnosis; in short, every one of these rows
-- is wrong in at least one of three ways:
--
--   * Bean Blossom Township's 9 rows are Richland-Bean Blossom Community School
--     Corporation's figures (EDUCATION / OPERATIONS / DEBT SERVICE / School
--     Lunch), roughly 108x the township's own budget.
--   * Ellettsville's and Monroe County's pair a General-Fund-only expenditure
--     report against all-funds revenue that includes enterprise utilities and,
--     for Monroe County, the property-tax Settlement pass-through — 4.3x and
--     14.7x scope mismatches that tie against their own subtotals throughout.
--   * FY2025 silently switched report shape, so the series jumps 6.2x (Monroe)
--     and 2.2x (Ellettsville) with no signal a reader can see.
--
-- Clear Creek and Indian Creek Townships measured internally plausible, but they
-- come from the same loader and the same two mixed reports, so they go with it
-- rather than being left as the one unexplained survivor.
--
-- ⚠ THIS IS NOT THE MILLEDGEVILLE CASE. That rule protects a VERIFIED figure
-- that merely looks outlandish. These figures are not verified and not the
-- entity's: Bean Blossom's tree names another government's funds outright.
--
-- ── Backup, proven not assumed ──────────────────────────────────────────────
-- .planning/backups/in-legacy-gateway/in-legacy-gateway-rows-fy2021-2025.json.gz
--   45 budgets · 5,320 categories · 4,050 line items · root-sum ties 45/45
-- Dry-run through scripts/la02RestoreBackup.mjs before this migration was
-- written: all 45 parse and every root set sums to its stored total.
--
-- ── Cascade footprint, checked first ────────────────────────────────────────
--   treasury.budget_categories   5,320 rows  ON DELETE CASCADE
--   treasury.enrichment_queue      581 rows  ON DELETE CASCADE
--   treasury.transactions            0 rows  (NO ACTION — would have blocked)
--
-- ── Gates ───────────────────────────────────────────────────────────────────
-- ⚠⚠ FROZEN INVARIANT: NOT NEUTRAL. 35 of the 45 were already outside the digest,
-- but TEN WERE INSIDE IT, and the digest moved 62654 / 3a48ac28 -> 62644 /
-- 332a8fda on this delete. The accounting reconciles exactly: 62654 - 10 = 62644,
-- and no other row could have moved because the only writes between the two
-- measurements were this migration and 20260905000000 (which touches
-- data_sources only).
--
-- ⚠⚠ WHY THOSE TEN, AND WHY `verify:live-sync` SAID 0 UNPROTECTED. All ten carry
-- `data_source = 'Indiana Gateway'` — the bare legacy string. Their owning
-- sources are named `Ellettsville Budget & Disbursements` and `Monroe County
-- Budget & Disbursements`, and BOTH the live-sync snapshot and the exposure
-- report in verify-budget-axes.mjs identify a row's source by matching
-- `budgets.data_source` against `data_sources.name`:
--
--     const liveNames = new Set(live.map(d => d.name));
--     rows.filter(r => !excludedSet.has(r.id) && liveNames.has(r.data_source))
--
-- A sync that writes rows under a data_source string other than its own name is
-- therefore invisible to that check. These ten met the live-sync exclusion's own
-- definition — "rows owned by an ENABLED data source, which can be rewritten by a
-- cron sync with no human involved and so were never meaningfully frozen" — and
-- were counted as frozen anyway. This is the exclusion-side twin of
-- `treasury_sync_city_budget` keying on fund_scope+basis rather than data_source.
--
-- ⚠ `budgets.data_source_id` CANNOT be used to fix the join: it is NULL on
-- 269,062 rows and DANGLING on all 939 that have it (11 distinct ids, none
-- resolving to a data_sources row). The free-text column is the only link there is.
--
-- stampBudgetAxes: NEUTRAL. All 45 are `unknown` on all three axes, so no
-- claimed partition counts them; only the unclaimed remainder changes.
-- Re-run --dry-run after applying to confirm.
-- scripts/lib/calendarYearLocalVerify.mjs: MOVED in the same commit. Its
-- Indiana baseline is re-measured — see that file's comment.

-- Refuse if the population is not the 45 that were surveyed and archived.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM treasury.budgets b
  JOIN treasury.municipalities m ON m.id = b.municipality_id
  WHERE m.state = 'IN'
    AND (b.data_source = 'Indiana Gateway'
         OR b.data_source LIKE '%Budget & Disbursements');
  IF n <> 45 THEN
    RAISE EXCEPTION 'Expected exactly 45 legacy Indiana rows to delete, found %', n;
  END IF;
END $$;

DELETE FROM treasury.budgets WHERE id IN (
  '3ef0c899-0061-4af3-a97e-ef5ac42a0eb7', -- Bean Blossom Township FY2021 operating $  29,181,418  (18 cats)
  '91da235f-e05c-43a4-8e4b-f595f5f7e9f6', -- Bean Blossom Township FY2021 revenue   $  50,512,061  (235 cats)
  '836ad91e-1385-487c-8cc2-103d52b912d2', -- Bean Blossom Township FY2022 operating $  31,531,092  (18 cats)
  'cea818f7-5069-4fea-baf5-84d4c46d0377', -- Bean Blossom Township FY2022 revenue   $  54,224,518  (221 cats)
  '07ac3e91-0c10-4394-9734-96e3b3b28ff2', -- Bean Blossom Township FY2023 operating $  38,533,671  (18 cats)
  '22dda4ce-a305-4449-8dc1-845b039623f7', -- Bean Blossom Township FY2023 revenue   $  53,918,521  (232 cats)
  'ee1c8b4c-0ce0-4afc-812c-c3612fd1a75f', -- Bean Blossom Township FY2024 operating $  39,712,837  (18 cats)
  'aa593310-ac5c-44ff-bb62-4c619d4cdc7a', -- Bean Blossom Township FY2024 revenue   $     263,667  (29 cats)
  '49df1c2b-bd88-4b59-957d-26b89c0ef629', -- Bean Blossom Township FY2025 operating $  40,672,268  (18 cats)
  '1a55e32e-fb41-4766-9d0e-e2be317f92d6', -- Clear Creek Township  FY2021 operating $     468,660  (8 cats)
  'e5367f9d-b7da-4a37-bd80-e02d2ee6154d', -- Clear Creek Township  FY2021 revenue   $     354,059  (16 cats)
  '0e018a5e-2a73-4f9f-887a-477dad008c7b', -- Clear Creek Township  FY2022 operating $     517,660  (8 cats)
  '92b5e92e-fc7d-4571-857c-8e9c613aacf6', -- Clear Creek Township  FY2022 revenue   $     371,098  (19 cats)
  '8a5b59f8-5c9a-4735-8805-7ef79bfde8f7', -- Clear Creek Township  FY2023 operating $     486,860  (8 cats)
  '1b442dc2-8ee2-4c9c-8560-777b5779b139', -- Clear Creek Township  FY2023 revenue   $     460,398  (19 cats)
  '213eae62-5e38-4996-8ed9-6b08c5a2284e', -- Clear Creek Township  FY2024 operating $     638,450  (8 cats)
  'cf42f690-140b-496f-9efe-509e9368649e', -- Clear Creek Township  FY2024 revenue   $     437,129  (18 cats)
  'f2f9e15e-84e0-4314-a6fa-edebeb8eaaed', -- Clear Creek Township  FY2025 operating $     605,100  (8 cats)
  'aa4d1838-2998-4a19-b512-72eedc4ae0be', -- Ellettsville          FY2021 operating $   3,140,654  (19 cats)
  'ba10a620-a8e9-4f07-9149-98a867edd50b', -- Ellettsville          FY2021 revenue   $  13,468,454  (150 cats)
  '43373e8a-dd5c-468b-89b0-2fc789c2cfe5', -- Ellettsville          FY2022 operating $   3,499,206  (20 cats)
  'a35c0283-215e-47f9-9771-3d44710789b9', -- Ellettsville          FY2022 revenue   $  14,204,064  (150 cats)
  'f2e2e521-eed5-4c18-8b40-a8f9367f14cb', -- Ellettsville          FY2023 operating $   3,233,709  (18 cats)
  '72d69323-1c46-468d-bda7-6447e1dbb67d', -- Ellettsville          FY2023 revenue   $  17,009,040  (155 cats)
  '6ca5c0c5-27f9-4cb3-b5dd-d38e5ffd9e82', -- Ellettsville          FY2024 operating $   3,706,504  (19 cats)
  '138a8ce5-2cdf-45fa-8e42-6f4b01e9bb14', -- Ellettsville          FY2024 revenue   $  22,600,749  (148 cats)
  '3b25f1c7-01b1-4e17-9713-38ea0e6e0bc6', -- Ellettsville          FY2025 operating $   8,057,049  (28 cats)
  '98d70ee6-25a5-4d56-97d5-6cd1bca8664b', -- Indian Creek Township FY2021 operating $     130,590  (8 cats)
  '8e9b6aaa-4ea4-449c-8f64-7a0068e3df63', -- Indian Creek Township FY2021 revenue   $     102,430  (15 cats)
  '7d37bb76-7856-4e37-91b7-17440b664fcd', -- Indian Creek Township FY2022 operating $     133,790  (8 cats)
  '51cebb32-8baf-48b2-8384-3ebfd207f23a', -- Indian Creek Township FY2022 revenue   $      97,351  (16 cats)
  'a4e3ac81-22ea-4416-9741-2a32d96ee158', -- Indian Creek Township FY2023 operating $     133,790  (8 cats)
  '49648fed-3957-40d5-a59f-a6a1615a5d95', -- Indian Creek Township FY2023 revenue   $      97,834  (16 cats)
  '629ef82b-1da5-49f8-ab80-87786a198a3c', -- Indian Creek Township FY2024 operating $     123,075  (8 cats)
  '93c8a3aa-2228-497a-94e3-b50e776a60fe', -- Indian Creek Township FY2024 revenue   $     103,676  (17 cats)
  'd40514d2-72cb-4545-acb7-6cd053efe3a5', -- Indian Creek Township FY2025 operating $     123,000  (8 cats)
  '91ade821-cd91-450b-891b-37c57d040ed1', -- Monroe County         FY2021 operating $  43,283,121  (133 cats)
  'cdcf513d-fd25-40d6-9ff0-4251c6c6de2b', -- Monroe County         FY2021 revenue   $ 634,688,575  (768 cats)
  '4350856e-5164-49ec-995f-216e99ab24e9', -- Monroe County         FY2022 operating $  44,598,938  (131 cats)
  '10e4c3a0-4a24-4ee3-aef2-1862521e3a81', -- Monroe County         FY2022 revenue   $ 668,530,249  (782 cats)
  '87fd6483-6aaa-4596-8025-02b3f4fd5d78', -- Monroe County         FY2023 operating $  48,586,930  (121 cats)
  '2e5f3706-9e36-48ba-9d8d-3d07993bca02', -- Monroe County         FY2023 revenue   $ 747,090,471  (784 cats)
  '3cbc027f-4a39-427c-a997-bfb891092521', -- Monroe County         FY2024 operating $  55,986,033  (126 cats)
  '42b94a6c-6d2b-4d95-9a3d-e8cc200f7c84', -- Monroe County         FY2024 revenue   $ 565,713,527  (605 cats)
  'c55e9fa6-6523-49f0-adea-7577447febac'  -- Monroe County         FY2025 operating $ 345,064,922  (140 cats)
);

-- A delete that names 45 rows and removes 44 has left one behind.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM treasury.budgets b
  JOIN treasury.municipalities m ON m.id = b.municipality_id
  WHERE m.state = 'IN'
    AND (b.data_source = 'Indiana Gateway'
         OR b.data_source LIKE '%Budget & Disbursements');
  IF n <> 0 THEN
    RAISE EXCEPTION 'Expected 0 legacy Indiana Gateway-vintage rows to remain, found %', n;
  END IF;
END $$;
