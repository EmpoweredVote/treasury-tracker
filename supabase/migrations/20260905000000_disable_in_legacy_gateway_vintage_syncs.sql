-- Disable the nine legacy Indiana "Budget & Disbursements" Gateway-vintage syncs.
--
-- These are the Bloomington-era (2026-03) loaders that predate the Indiana
-- Gateway Annual Financial Report path shipped in PR #113. They read the WRONG
-- Gateway reports, and every figure they publish is either scope-mismatched or
-- attributed to the wrong government. Measured 2026-09-04/05 against the live
-- database before any change:
--
-- ── 1. Bean Blossom Township is a SCHOOL CORPORATION ────────────────────────
-- FY2021 operating $29,181,418 and revenue $50,512,061 for a rural township
-- whose own funds appear in that same tree as GENERAL $69,726 and TOWNSHIP
-- ASSISTANCE $20,200. The tree roots are EDUCATION $15.7M, OPERATIONS $7.4M,
-- DEBT SERVICE $5.8M, School Lunch — Richland-Bean Blossom Community School
-- Corporation, which exists separately in treasury.municipalities. The township
-- is published roughly 108x too high, in all five years.
--
-- ── 2. Ellettsville and Monroe County are scope-mismatched against themselves ─
-- The expenditure side is Gateway's "Disbursements by Fund and Department"
-- report, which Gateway's own explainer says covers only "counties (General
-- Fund and Motor Vehicle Highway Fund) and cities and towns (General Fund)":
--   Ellettsville  FY2021 operating = 1 root, "General", $3,140,654
--   Monroe County FY2021 operating = 2 roots, County General + Motor Vehicle
--                                    Highway, $43,283,121
-- The revenue side is all funds INCLUDING enterprise activity — Ellettsville's
-- roots carry Water Utility-Operating and Wastewater Utility-Operating — and for
-- Monroe County it also carries the property-tax Settlement pass-through
-- ($182M in FY2021, $228M in FY2024) plus other taxing units' funds (EDUCATION
-- FUND $78M). Ellettsville therefore reads as a 4.3x surplus and Monroe County
-- as 14.7x. scripts/lib/inGateway.mjs documents this exact trap in its header.
--
-- ── 3. FY2025 silently changed report shape ─────────────────────────────────
-- Monroe County operating goes 2 roots / $55,986,033 (FY2024) to 70 roots /
-- $345,064,922 (FY2025); Ellettsville 1 root / $3,706,504 to 14 roots /
-- $8,057,049. A reader sees 6.2x growth that did not happen.
--
-- ⚠ The expenditure side also appears to be ADOPTED BUDGET rather than actuals —
-- Clear Creek FY2024 roots are $279,350 / $205,000 / $154,100 / RAINY DAY $0
-- against non-round revenue ($274,653), and the source is named "Budget &
-- Disbursements". That matches the conclusion in the two stale repo artefacts,
-- scripts/bulkLoadGateway.js and docs/indiana_gateway_reference.md, which sampled
-- only Gateway's Budget branch. Recorded as strong indication, not proven.
--
-- ── Why `is_enabled = false` is a real stop ─────────────────────────────────
-- Both layers filter on it (verified against the live functions, PR #111):
--   * treasury_list_sources() has WHERE ds.is_enabled = true, so the source is
--     never enumerated — including by the weekly `force: true` cron (cron.job
--     6). `force` bypasses the due-date check, not the listing.
--   * treasury_get_data_source_config() also requires is_enabled = true, so an
--     explicit data_source_id call returns no config and logs a failure trace.
-- Left enabled these re-create `(fiscal_years || [thisYear]).slice(-2)` — here
-- FY2024 + FY2025 — on every run, indefinitely.
--
-- ── Blast radius ────────────────────────────────────────────────────────────
-- Five of the nine have produced the 45 rows deleted in the companion migration
-- 20260905000100. Four have produced none: Bloomington Township and Monroe
-- County Public Library have never synced, while Bloomington (Gateway) and MCCSC
-- synced on 2026-06-19 and 2026-06-14 and wrote nothing — an absence of error
-- that was not health. All four are the same defective loader and are stopped
-- for the same reason.
--
-- ⚠ TWO OF THE NINE WERE NEARLY MISSED. An unpaged read of treasury.data_sources
-- returned 1,000 of 1,814 rows and hid Bloomington (Gateway) and MCCSC — the two
-- most recently synced of the set. Count DISTINCT ids and assert the total.
--
-- NOT touched: `Bloomington Annual Compensation` (a different, working source)
-- and Bloomington's 41 open-data rows. `Bloomington Public Contracts` was
-- already disabled on 2026-08-27.
--
-- Reload path: scripts/loadIndianaGateway.mjs, the PR #113 write path, which
-- uses "Detailed Receipts" and "Disbursements by Fund" (both all-funds, shared
-- layout), whitelists ent_name = 'Governmental Activities', excludes the
-- settlement pass-through, and oracles every fund against the separate Cash and
-- Investments report.
-- ⚠ That path covers cities/towns and counties. The three townships are NOT
-- reloaded by it and will hold no rows until a township sweep is decided.

UPDATE treasury.data_sources
SET is_enabled      = false,
    sync_frequency  = 'manual',
    sync_status     = 'idle',
    last_error      = 'Disabled 2026-09-05 (migration 20260905000000): legacy '
                   || 'Bloomington-era Gateway loader. Reads the General-Fund-only '
                   || '"Disbursements by Fund and Department" report against all-funds '
                   || 'revenue including enterprise utilities and the Settlement '
                   || 'pass-through, and attributes Richland-Bean Blossom Community '
                   || 'School Corporation figures to Bean Blossom Township (~108x). '
                   || 'Superseded by scripts/loadIndianaGateway.mjs (AFR branch).'
WHERE id IN (
  '28773db6-10ef-4d4b-b0c7-bf5846e89bce',  -- Bean Blossom Township Budget & Disbursements
  '85855908-845f-4e19-9a56-3b983b3b2595',  -- Bloomington Budget & Disbursements (Gateway)
  '9b208052-0f8e-451e-86bc-045805df3c7c',  -- Bloomington Township Budget & Disbursements
  'cf3df434-d84e-4192-b7e0-94b5e7616d0a',  -- Clear Creek Township Budget & Disbursements
  '19eb3382-ca96-4899-a5a6-68ed7884d17d',  -- Ellettsville Budget & Disbursements
  '3469e532-c0f7-4f00-abdd-ca00de1bde18',  -- Indian Creek Township Budget & Disbursements
  'f9fc0e3b-5d0f-4c26-8d89-231abcc26af0',  -- MCCSC Budget & Disbursements
  'fc48516f-d9f8-45a5-a49f-a0707b12e62e',  -- Monroe County Budget & Disbursements
  'ae7231bf-3fbd-449d-bb54-5dcaadc8fcae'   -- Monroe County Library Budget & Disbursements
);

-- A migration that names nine rows and updates eight has excluded nothing.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM treasury.data_sources
  WHERE id IN (
    '28773db6-10ef-4d4b-b0c7-bf5846e89bce', '85855908-845f-4e19-9a56-3b983b3b2595',
    '9b208052-0f8e-451e-86bc-045805df3c7c', 'cf3df434-d84e-4192-b7e0-94b5e7616d0a',
    '19eb3382-ca96-4899-a5a6-68ed7884d17d', '3469e532-c0f7-4f00-abdd-ca00de1bde18',
    'f9fc0e3b-5d0f-4c26-8d89-231abcc26af0', 'fc48516f-d9f8-45a5-a49f-a0707b12e62e',
    'ae7231bf-3fbd-449d-bb54-5dcaadc8fcae')
    AND is_enabled = false;
  IF n <> 9 THEN
    RAISE EXCEPTION 'Expected 9 disabled Indiana legacy sources, found %', n;
  END IF;
END $$;
