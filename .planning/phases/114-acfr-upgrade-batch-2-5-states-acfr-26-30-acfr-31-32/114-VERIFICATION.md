---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
verified: 2026-07-03T04:15:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 114: ACFR Upgrade — Batch 2 (5 states) Verification Report

**Phase Goal:** The remaining ~5 roster states (SC, KY, UT, AL, LA) are upgraded NASBO→ACFR GAAP on the same standard as batch 1.
**Verified:** 2026-07-03T04:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This verification queried the **live production Supabase database directly** (via `@supabase/supabase-js` with the service key from `.env`, schema `treasury`) rather than relying on SUMMARY.md/LOADLOG.md self-reports. All dollar totals, row counts, source labels, NASBO-replacement state, `data_sources` residue, and P2-clamp rendering below were read fresh from `treasury.budgets`, `treasury.budget_categories`, `treasury.budget_line_items`, and `treasury.data_sources`. A `--dry-run` re-execution of `scripts/processSCAcfr.js` was also run live during this verification to confirm the loader's own tie-check still passes independent of the LOADLOG narrative.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC node fully ACFR-sourced FY2002–FY2025, ties to printed GF totals | ✓ VERIFIED | DB: 24 operating + 24 revenue rows. FY2025 revenue = $20,731,521,000, FY2002 = $5,763,261,000 — exact match to plan-pinned bookends. `data_source` = "South Carolina State ACFR — General Fund (...GAAP basis)". Live `--dry-run` re-run during this verification printed "FY2024 validation: PASS" and reproduced LOADLOG's $18,569,778,000 FY2024 operating total exactly. |
| 2 | KY node fully ACFR-sourced FY2002–FY2025 (FY2023 documented honest hole), ties to printed totals | ✓ VERIFIED | DB: 24 operating rows (23 ACFR-labelled + 1 remaining NASBO for FY2023), 23 revenue rows (FY2023 correctly absent). FY2024 revenue = $15,456,606,000, FY2002 = $6,510,474,000 — exact match. KY FY2023 operating row confirmed still labelled "NASBO State Expenditure Report..." ($14,350,000,000) — matches the documented, expected honest hole (broken font/ToUnicode CMap in the FY2023 source PDF). |
| 3 | UT node fully ACFR-sourced FY2019–FY2025, GF-alone scope decision honored, ties to printed totals | ✓ VERIFIED | DB: 7 operating + 7 revenue rows. FY2025 revenue = $11,404,950,000, FY2019 = $6,509,587,000 — exact match. No Income Tax/Education fund amount folded into any total (verified via category breakdown: children sum to the GF total, no synthetic composite). |
| 4 | AL node fully ACFR-sourced FY2002–FY2025, Sep-30 FY-end honored, GF-alone scope decision honored | ✓ VERIFIED | DB: 24 operating + 24 revenue rows. FY2024 revenue = $3,262,681,000, FY2002 = $1,094,623,000 — exact match. Spot-checked 3 additional middle years (FY2010/2015/2020) against LOADLOG — all exact matches, not just bookends. `source_date` for all AL operating rows ends `-09-30` (0 rows deviate). |
| 5 | LA node fully ACFR-sourced FY2002–FY2025, GF-alone + ~99%-federal composition honestly documented | ✓ VERIFIED | DB: 24 operating + 24 revenue rows. FY2025 revenue = $22,780,529,000, FY2002 = $5,807,699,000 — exact match. FY2025 category breakdown confirms "Intergovernmental Revenues" = $22,482,784,000 of $22,780,529,000 total (98.7% ≈ claimed ~99%), category-level evidence of the composition finding, not just a narrative claim. |
| 6 | NASBO operating rows replaced in place per state-FY (not duplicated) across all 5 states | ✓ VERIFIED | DB query for `data_source LIKE '%NASBO%'` across all 5 nodes returns exactly 1 row (KY FY2023, the documented exception). SC/UT/AL/LA: 0 NASBO rows remain. No duplicate operating rows per (state, fy) found in any node. |
| 7 | Idempotent never-overwrite with 0 `data_sources` residue across all 5 states | ✓ VERIFIED | `SELECT count(*) FROM treasury.data_sources WHERE dataset_id LIKE '{sc,ky,ut,al,la}-acfr-%'` returns 0 for all 5 prefixes, confirming the ephemeral create/RPC/delete lifecycle left no residue. Code review (114-REVIEW.md) independently re-executed all 10 loaders with `--dry-run` (118 state-years) with exit 0 across the board. |
| 8 | P2 clamp fires correctly (clamp to 0, signed magnitude in label, parent total preserved) where negative categories occur (ACFR-32) | ✓ VERIFIED | Queried `budget_categories`/`budget_line_items` directly (not just self-reported labels): UT FY2022 "Investment Income (Loss) (net refund/loss — shown at 0; actual -4,304,000)" = 0; LA FY2013 "Use of Money and Property (...actual -80,800,000)" = 0; KY FY2012 two negative investment lines both clamped to 0 with signed labels. **Parent-total preservation independently confirmed**: UT FY2022 `total_budget` = $10,798,468,000 = (sum of rendered/clamped children $10,802,772,000) − $4,304,000 (the clamped negative) — the root total carries the true signed net, not the clamped-child sum. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/processSCAcfr.js` | SC operating loader, `treasury_sync_budget_tree` | ✓ VERIFIED | Exists, 38KB, dry-run confirmed PASS live |
| `scripts/processSCRevenueAcfr.js` | SC revenue loader, `clampForRender` | ✓ VERIFIED | Exists, 40KB |
| `scripts/processKYAcfr.js` / `processKYRevenueAcfr.js` | KY loaders | ✓ VERIFIED | Exist, 37KB/35KB |
| `scripts/processUTAcfr.js` / `processUTRevenueAcfr.js` | UT loaders | ✓ VERIFIED | Exist, 20KB/17KB |
| `scripts/processALAcfr.js` / `processALRevenueAcfr.js` | AL loaders, Sep-30 FY-end | ✓ VERIFIED | Exist, 34KB/27KB |
| `scripts/processLAAcfr.js` / `processLARevenueAcfr.js` | LA loaders | ✓ VERIFIED | Exist, 61KB/27KB |
| `114-01-SC-LOADLOG.md` … `114-05-LA-LOADLOG.md` | Per-FY load disposition | ✓ VERIFIED | All 5 present, contain "Load Disposition" section, figures cross-checked against live DB (see truths above) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| 5 loader pairs | `treasury.budgets` (5 state nodes) | `treasury_sync_budget_tree` RPC | ✓ WIRED | Confirmed live: all 5 nodes carry rows keyed by the correct node UUIDs from the plans; RPC's ephemeral `data_sources` lifecycle leaves 0 residue |
| SOURCES maps | State-government PDF archives | per-year explicit/enumerated URLs | ✓ WIRED | `source_url` non-null on every loaded row across all 5 states (0 null-source rows found in DB scan) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| 5 state nodes' `revenue`/`operating` budgets rows | `total_budget`, `budget_categories`/`budget_line_items` | Live DB query (not loader self-report) | Yes — bookend + spot-checked middle-year totals match plan-pinned figures exactly; category-level breakdowns are populated (7–24 categories per year, not empty trees) | ✓ FLOWING |
| Money In auto-enable | `dataset_type='revenue'` row presence | `treasury.budgets` | Yes — all 5 states now have ≥7 (UT) to ≥24 (SC/AL/LA) revenue rows; the existing `available_datasets`/period-selector logic (`src/utils/period.ts`) is confirmed data-driven off this same table, unchanged this phase | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SC operating loader dry-run tie-check reproducible | `node scripts/processSCAcfr.js --dry-run --fy 2024` | "FY2024 validation: PASS", total $18,569,778,000 matching LOADLOG | ✓ PASS |
| AL mid-window totals match LOADLOG exactly (not just bookends) | Direct DB query FY2010/2015/2020 | revenue/operating totals identical to LOADLOG table to the dollar | ✓ PASS |
| P2 clamp renders 0 with signed label, preserves parent total | Direct query of `budget_categories`/`budget_line_items` for UT FY2022, LA FY2013, KY FY2012 | Clamp label present, category amount = 0, parent total = true signed net | ✓ PASS |

### Probe Execution

No dedicated `scripts/*/tests/probe-*.sh` files declared for this phase or found in the repository; none of the PLAN/SUMMARY files reference a probe script. Step 7c: SKIPPED (no probes declared for this phase — verification instead used direct live-DB queries, which are a stronger evidence class than a probe script for this data-loading phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ACFR-26 | 114-01 | South Carolina ACFR upgrade | ✓ SATISFIED | DB-verified, 24/24 years, $0-tied bookends |
| ACFR-27 | 114-02 | Kentucky ACFR upgrade | ✓ SATISFIED | DB-verified, 23/24 years (FY2023 documented honest hole per environment notes) |
| ACFR-28 | 114-03 | Utah ACFR upgrade | ✓ SATISFIED | DB-verified, 7/7 years, GF-alone scope decision honored |
| ACFR-29 | 114-04 | Alabama ACFR upgrade (substituted for OK) | ✓ SATISFIED | DB-verified, 24/24 years, Sep-30 FY-end honored |
| ACFR-30 | 114-05 | Louisiana ACFR upgrade | ✓ SATISFIED | DB-verified, 24/24 years, ~99% federal composition confirmed at category level |
| ACFR-31 | 114-01..05 | Honest scope-divergence relabelling | ✓ SATISFIED | Each LOADLOG documents its divergence driver (SC basis-consolidation, KY near-parity, UT/AL narrower-GAAP-earmark, LA federal-composition); LA's category breakdown independently confirms the ~99% claim |
| ACFR-32 | 114-01..05 | P2 clamp for negative categories | ✓ SATISFIED | Directly queried and confirmed live in UT/LA/KY (3 states exercised the clamp path); SC/AL had no negative years (clamp wired but unexercised, consistent with claim) |

**Note on REQUIREMENTS.md traceability table:** The requirement checkboxes (lines 30–36) are correctly marked `[x]` for ACFR-26 through ACFR-32, but the "Traceability" table at the bottom of REQUIREMENTS.md (lines 78–80) still reads "Pending" / "114 pending" for ACFR-26..30/31/32. This is a stale-documentation lag (the checkbox section is authoritative and correct; the traceability table appears not to have been synced), not a functional gap — flagged as informational only.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/processUTAcfr.js` | 111 | Trailing-space category name ("Health and Environmental Quality ") inconsistent with other years | Info (from 114-REVIEW.md WR-01) | Cosmetic cross-year name-key mismatch; does not affect totals or GAAP-basis-labelling must-haves |
| `scripts/processALAcfr.js` | 297,308,...375 | "Charges"→"Changes" label drift FY2018+ (suspected transcription defect, unverified against source) | Info (from 114-REVIEW.md WR-02) | Category label accuracy concern flagged by code review; does not affect the tie-out totals (ties are to $0 diff regardless of label text) — does not falsify any must_have truth per environment-notes guidance |
| All 10 loader files | various | WR-04–WR-07 (error-path `data_sources` residue risk on abort, `strict:false` flag typo tolerance, mid-run partial-load risk, swallowed select error) | Warning (advisory, from 114-REVIEW.md) | Structural robustness gaps shared with the entire loader fleet (including all Phase-113 predecessors already live); did not manifest in this phase's actual runs (0 residue, 0 partial loads observed in DB) — advisory per environment notes, not a phase-114-specific regression |

No debt markers (`TBD`/`FIXME`/`XXX`) found requiring a blocker per the debt-marker gate — 114-REVIEW.md's `critical: 0` finding is consistent with what this independent DB-based verification found.

### Human Verification Required

None. This phase is fully data/backend (no frontend changes — consistent with the milestone's explicit "Frontend / UI work" out-of-scope declaration). Live-app UAT across the upgraded states (source chips, Money In view rendering, year-selector reach) is explicitly scoped to Phase 116 (VER-08) per ROADMAP.md, not this phase — its absence here is a deferred item, not a gap.

### Gaps Summary

No gaps. All 8 derived observable truths (covering the phase's 3 ROADMAP success criteria plus per-state detail) were independently verified against the live production database — not the SUMMARY.md/LOADLOG.md narratives alone. Bookend and several mid-window dollar totals were re-derived directly from `treasury.budgets`/`budget_categories` and matched the plans' pinned figures exactly. The P2 clamp (ACFR-32) was traced at the category/line-item level and confirmed to preserve the true signed parent total while rendering the clamped child at 0 with a signed-magnitude label — the most failure-prone must-have in this class of phase, and it holds. NASBO replacement is complete across SC/UT/AL/LA with the single documented, expected exception (KY FY2023 honest hole, consistent with environment notes). `data_sources` residue is 0 across all 5 states. The code-review-flagged label defects (WR-01/WR-02) and template robustness gaps (WR-04–WR-07) are real but advisory — they do not falsify any must-have truth for this phase and are appropriately tracked as review findings rather than verification blockers.

---

_Verified: 2026-07-03T04:15:00Z_
_Verifier: Claude (gsd-verifier)_
