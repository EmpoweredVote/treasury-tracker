---
phase: 55-statewide-city-salaries-integration
verified: 2026-06-15T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
operator_live_app_approval:
  approved: true
  date: 2026-06-15
  note: "Operator verified the salaries tab in the live app (Irvine) this session. First pass surfaced cryptic department labels (gap-closure: normalizeDeptLabel + re-sweep); operator re-verified after the fix and approved. This closes 55-03 Task 3 and SC-3/SAL-03. The human_verification items below were satisfied in-session."
human_verification:
  - test: "Salaries tab renders correctly for covered OC cities in the live app"
    expected: "A covered OC city (e.g. Irvine, Anaheim) shows a Salaries tab with a Department → Position tree, no individual employee names, wages/benefits split visible per position, and year selector offering 2009–2024"
    why_human: "The salaries frontend rendering (DatasetTabs SALARIES_CARD, hasSalaries flag, year range display) cannot be verified without loading the live app. The DB rows are confirmed present; front-end rendering requires a browser."
  - test: "Gap city shows no Salaries tab (no error, no fabricated data)"
    expected: "A gap city (per 55-COVERAGE.md — though all 34 OC cities are covered, so this applies to a non-OC city or future use) shows no salaries tab, not an error state"
    why_human: "No gap cities exist in OC (all 34 covered), but the live-app Task 3 human checkpoint from 55-03-PLAN.md was explicitly never completed — the operator has not yet confirmed the app renders correctly."
  - test: "Anaheim and Santa Ana custom operating/revenue figures unchanged after salaries load"
    expected: "Anaheim FY2025/26 and Santa Ana FY2023–26 operating and revenue totals are unaltered; figures match those in 55-COVERAGE.md additive write confirmation table"
    why_human: "DB confirmation was noted in 55-COVERAGE.md but the live-app human checkpoint (55-03 Task 3) that closes the SAL-03 gate has not been operator-approved."
---

# Phase 55: Statewide City Salaries Integration — Verification Report

**Phase Goal:** Confirm the CA Government Compensation source covers OC cities (spike-first), build a reusable statewide city-salaries loader, and load Orange County salaries.
**Verified:** 2026-06-15
**Status:** passed (operator approved live-app gate in-session — see `operator_live_app_approval` frontmatter)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

The ROADMAP defines 4 success criteria (SC). PLAN frontmatter defines 10 must-have truths across the 3 plans. All are evaluated below. The must-haves from frontmatter are subsumed into the SC groupings.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Spike confirms publicpay.ca.gov coverage and depth for OC cities, documented (gates the build) | VERIFIED | 55-SPIKE-FINDINGS.md exists; Section 1 documents `/RawExport/{YEAR}_City.zip` reachability (HTTP 200, browser UA, no paywall); Section 2 has the full 29-column field mapping; Section 4 confirms all 34 OC cities in the 2024 file; `GATE: PASS` present at line 252, machine-greppable |
| SC-2 | A reusable statewide city-salaries loader imports compensation for any CA city from the confirmed source | VERIFIED | `scripts/loadCASalaries.js` exists, syntax-valid (node --check exits 0); `--city` is a required CLI argument with no OC city names hard-coded; curl-based GCC ZIP download using the spike-documented URL and UA; `buildTree` builds n/a/c Department → Position tree; `treasury_sync_city_budget` RPC called with `p_dataset_type:'salaries'`; `treasury_ensure_municipality` used for city resolution; `--dry-run` and repeatable `--fy` both implemented |
| SC-3 | OC cities show an employee-compensation (salaries) dataset wherever the source provides it | PARTIAL — data present; live-app render unconfirmed | 55-COVERAGE.md confirms 544 salaries rows written for all 34 OC cities across 2009–2024 (34 × 16 = 544); 55-03-SUMMARY.md records no gaps and additive-only write; DatasetTabs.tsx wiring exists (`hasSalaries`, `SALARIES_CARD`). BUT: 55-03 Task 3 (blocking human checkpoint) has not been completed — operator has not confirmed the salaries tab renders in the live app |
| SC-4 | Salary figures for a sampled city/year match the published source | VERIFIED | Irvine 2024: computed $190,426,283 = GCC published $190,426,283 (delta $0, 0.00%); verified at spike stage (55-SPIKE-FINDINGS.md §3.4), at single-city load stage (55-02-SUMMARY.md reconciliation table), and post-sweep (55-COVERAGE.md SC-4 section); all three independently confirm exact match |
| SAL-01-T1 | GCC source programmatically reachable for OC cities (no paywall/bot-block) | VERIFIED | Confirmed under SC-1; static ZIP URLs bypass Cloudflare managed challenge; curl with browser UA returns HTTP 200; confirmed in spike and replicated in loader |
| SAL-01-T2 | Schema supports Department → Position / Total Compensation tree | VERIFIED | Confirmed under SC-1; 29-column mapping documented; DepartmentOrSubdivision → Position tree; TotalWages + TotalRetirementAndHealthContribution = Total Compensation |
| SAL-02-T3 | Position is always the leaf — no individual names | VERIFIED | GCC source has no name columns (55-SPIKE-FINDINGS.md §2.5: "The GCC City raw CSV contains NO individual employee name columns"); `buildTree` in `loadCASalaries.js:360` pushes position nodes with no `i` array; DB probe in 55-02-SUMMARY confirms 0 item_count on depth=1 leaves |
| SAL-02-T4 | Per-position metadata carries wages/benefits split (D-03) | VERIFIED | `buildTree` lines 352–359: metadata object with `avgBase`, `avgOvertimeOther`, `avgBenefits`, `count` attached to every position leaf; sourced from RegularPay, OvertimePay+LumpSumPay+OtherPay, TotalRetirementAndHealthContribution |
| SAL-03-T5 | Every covered OC city has salaries for full available year range | VERIFIED | 55-COVERAGE.md per-city table: all 34 OC cities show 2009–2024 (16 yrs) COVERED; 0 gaps; sweepOCSalaries.js uses year-outer/city-inner loop reading `GCC_YEARS = [2009...2024]` |
| SAL-03-T6 | Gaps documented honestly; no fabrication | VERIFIED | D-06 honored: zero gap cities found; coverage doc states "No salaries rows were fabricated"; sweep marks cities with no source rows as gaps (not phantom rows); no rows written for absent cities |
| SAL-03-T7 | Citizen sees salaries tab with no frontend work needed | UNCERTAIN (human) | DatasetTabs.tsx has `SALARIES_CARD`, `hasSalaries = available.includes('salaries')`, and conditional 3-col layout at lines 38–93; the salaries tab logic is wired and will render once rows exist; but the live-app render has not been operator-confirmed (Task 3 blocking gate outstanding) |

**Score: 6/7 truths fully VERIFIED** (SC-3 / T7 requires human confirmation of live-app render)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/loadCASalaries.js` | Reusable statewide CA city-salaries loader (SAL-02 deliverable) | VERIFIED | File exists, 491 lines, syntax-valid; `--city` (required), repeatable `--fy`, `--dry-run`; GCC fetch layer using `gcc.sco.ca.gov` URL; `buildTree` → n/a/c shape; `treasury_sync_city_budget` RPC call with `p_dataset_type:'salaries'`; `normalizeDeptLabel` exported for import by sweepOCSalaries.js |
| `.planning/phases/55-statewide-city-salaries-integration/55-SPIKE-FINDINGS.md` | Auditable gate decision document | VERIFIED | File exists; contains Section 1 (Access), Section 2 (Schema/Field Mapping), Section 3 (Sample Reconciliation), Section 4 (OC Coverage Note); machine-greppable `GATE: PASS` line confirmed at line 252 |
| `.planning/phases/55-statewide-city-salaries-integration/55-COVERAGE.md` | Honest covered/gap record for 34 OC cities | VERIFIED | File exists; per-city table with all 34 rows showing COVERED / 2009–2024; summary totals (34 covered, 0 gaps, 544 rows, 313,085 records); SC-4 reconciliation (Irvine 2024, $0 delta); additive write confirmation table for Anaheim/Santa Ana |
| `scripts/sweepOCSalaries.js` | Efficient OC sweep script (auto-added deviation) | VERIFIED | File exists, 399 lines, syntax-valid; year-outer/city-inner loop; reads city list from DB via `county_id = OC_COUNTY_ID`; imports `normalizeDeptLabel` from `loadCASalaries.js`; `p_dataset_type:'salaries'` only |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/loadCASalaries.js` | `treasury.budgets` (salaries row) | `treasury_sync_city_budget` RPC with `p_dataset_type:'salaries'` | VERIFIED | Line 400–408: RPC called with `p_dataset_type:'salaries'`, `p_total`, `p_tree`, `p_row_count`, `p_data_source_name`; DB probe in 55-02-SUMMARY confirms row written with correct total |
| `scripts/loadCASalaries.js` | `treasury.municipalities` | `treasury_ensure_municipality` (city resolution) | VERIFIED with WARNING | Line 450–462: RPC called to resolve municipality; returns id; null-guarded with `process.exit(1)`. WARNING: CR-01 from code review — `ensure_*` semantics may create a phantom municipality on typo input. The OC sweep (sweepOCSalaries.js) bypasses this by reading city IDs directly from DB, so loaded OC data is unaffected. Latent risk for future single-city loader invocations only. |
| `treasury.budgets` (salaries rows for OC cities) | `DatasetTabs` salaries card (frontend) | `available.includes('salaries')` → `hasSalaries` → SALARIES_CARD | WIRED (code); human-unconfirmed (render) | `src/components/datasets/DatasetTabs.tsx` lines 38–93: `SALARIES_CARD` defined; `hasSalaries = available.includes('salaries')`; conditional 3-col grid when `hasSalaries`; `salariesTotal` bound at line 88. Code wiring is substantive. Live render unconfirmed. |
| `scripts/sweepOCSalaries.js` | `treasury.municipalities` (OC city IDs) | `supabase.from('municipalities').eq('county_id', OC_COUNTY_ID)` | VERIFIED | Lines 286–292: DB query reads OC cities by `county_id = '65e7c643-...'` (Phase 54 entity); not hard-coded; cities ordered by name |
| `normalizeDeptLabel` | `scripts/sweepOCSalaries.js` (shared normalization) | `import { normalizeDeptLabel } from './loadCASalaries.js'` | VERIFIED | Line 32 of sweepOCSalaries.js: named import; used at line 183; single source of truth for dept label expansion |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DatasetTabs.tsx` — salaries card | `salariesTotal`, `available` (includes 'salaries') | `loadBudgetData(…, 'salaries', …)` fetching from `treasury.budgets` | Yes — 544 real salaries rows written to DB (confirmed by 55-COVERAGE.md and 55-03-SUMMARY.md) | FLOWING (data in DB); render unconfirmed by human |
| `scripts/loadCASalaries.js` — `buildTree` | `rows` (GCC CSV filtered by city) | `fetchCityRows(year, city)` → `curl execSync` → ZIP extract → CSV parse → city filter | Yes — real GCC source, no static fallback; Irvine 2024 2,193 rows confirmed | FLOWING |
| `scripts/sweepOCSalaries.js` — `buildTree` | `rows` (per-city slice from year map) | `downloadAndIndexYear(year, cacheDir)` → curl → ZIP → CSV → `cityMap.get(cityKey)` | Yes — same GCC source; 313,085 records across 34 cities × 16 years | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| loadCASalaries.js syntax valid | `node --check scripts/loadCASalaries.js` | Exit 0 | PASS |
| sweepOCSalaries.js syntax valid | `node --check scripts/sweepOCSalaries.js` | Exit 0 | PASS |
| GATE line machine-greppable | `grep -n "GATE:" 55-SPIKE-FINDINGS.md` | Line 252: `GATE: PASS — authorize SAL-02 loader build` | PASS |
| loadCASalaries.js exports normalizeDeptLabel | `grep "export function normalizeDeptLabel" loadCASalaries.js` | Line 105 | PASS |
| sweepOCSalaries.js imports from loadCASalaries.js | `grep "import.*normalizeDeptLabel.*loadCASalaries" sweepOCSalaries.js` | Line 32 | PASS |
| --city required; no OC-specific city names hard-coded | `grep -n "Irvine\|Anaheim\|Santa Ana" loadCASalaries.js` | 0 hard-coded OC city names found | PASS |
| Live app salaries tab render | Requires browser at https://treasurytracker.empowered.vote | Not runnable in this context | SKIP (human needed) |

### Probe Execution

No conventional probe scripts (`scripts/*/tests/probe-*.sh`) exist for this phase. No phase-declared probes in PLAN.md. Spot-checks above serve as the runnable verification layer.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SAL-01 | 55-01-PLAN.md | GCC source confirmed to cover OC cities, documented (spike gates build) | SATISFIED | 55-SPIKE-FINDINGS.md exists; GATE: PASS at line 252; all 3 D-05 conditions documented with evidence; Irvine 2024 reconciliation $0 delta |
| SAL-02 | 55-02-PLAN.md | Reusable statewide city-salaries loader for any CA city | SATISFIED | scripts/loadCASalaries.js exists, syntax-valid, city-parameterized, no OC hard-coding; proven on Irvine 2024 with $0 delta reconciliation |
| SAL-03 | 55-03-PLAN.md | Citizen can view employee compensation for OC cities | SATISFIED (data) / HUMAN-NEEDED (live render) | 544 salaries rows in DB for all 34 OC cities 2009–2024; DatasetTabs wiring verified in code; live-app render unconfirmed (Task 3 human gate outstanding) |

No orphaned requirements: SAL-01, SAL-02, SAL-03 are the only Phase 55 requirements per REQUIREMENTS.md traceability table. All three are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/loadCASalaries.js` | 450 | `treasury_ensure_municipality` called with free-form `--city` input — "ensure" semantics can create phantom municipality on typo | WARNING (CR-01 from code review) | Latent data-integrity risk for future single-city invocations; OC sweep uses direct DB city IDs so loaded OC data is unaffected. Not a blocker for the current phase output. |
| `scripts/loadCASalaries.js` | 306–317 | `parseFloat(row[...]) || 0` — silently truncates on thousands-separated values | WARNING (WR-01) | Could produce understated totals if GCC ever ships formatted numbers; current CSV format uses unformatted numerics (confirmed by reconciliation) |
| `scripts/sweepOCSalaries.js` | 134–137 | Cache-hit path skips ZIP integrity validation | WARNING (WR-02) | Risk on interrupted run only; ZIP would re-validate on next full download |
| `scripts/loadCASalaries.js` | 410–413 | Fetch/RPC failures swallowed with `continue`/`return`; process exits 0 on partial failure | WARNING (WR-05) | No false-success signal risk for completed OC load; operator would need to check logs for partial failures on future runs |
| `scripts/sweepOCSalaries.js` | 185–192 | Same `parseFloat` pattern (WR-01 duplicate) | WARNING | Same as above |

No `TBD`, `FIXME`, or `XXX` markers found in either script file (verified by grep). No debt-marker blockers.

### Human Verification Required

#### 1. Salaries Tab Renders for Covered OC Cities

**Test:** Open https://treasurytracker.empowered.vote, navigate to a covered OC city such as Irvine or Anaheim.
**Expected:**
- A "Salaries" tab appears in the dataset tabs panel (3-column layout alongside Operating and Revenue)
- The salaries view shows a Department → Position tree summing on Total Compensation
- No individual employee names appear anywhere in the tree
- Each position node shows employee count and wages/benefits split (avg base, avg overtime+other, avg benefits)
- The year selector offers 2009–2024 (16 years)

**Why human:** Frontend rendering and UX cannot be confirmed by static code analysis. The DatasetTabs.tsx wiring is confirmed by code inspection, but whether the salaries tab actually appears and renders correctly requires a browser. This is the 55-03 Task 3 blocking human checkpoint that was never closed.

#### 2. Gap City Behavior (Future-proofing)

**Test:** Navigate to a non-OC California city (if available) or confirm that the "no salaries tab" path renders cleanly with no error state.
**Expected:** A city with no salaries rows shows no Salaries tab — not an error, just the 2-column Operating + Revenue layout.
**Why human:** All 34 OC cities are covered (no gaps in this phase), so the gap path cannot be demonstrated with OC cities. Visual confirmation that the conditional `hasSalaries` logic suppresses the tab gracefully requires a browser.

#### 3. Anaheim / Santa Ana Operating and Revenue Figures Unchanged

**Test:** Navigate to Anaheim (FY2025 and FY2026) and Santa Ana (FY2023–FY2026) in the live app and confirm their operating and revenue totals match the figures in 55-COVERAGE.md (e.g., Anaheim FY2025 operating $490,937,159, Santa Ana FY2023 operating $403,596,760).
**Expected:** All custom-sourced operating/revenue figures unchanged after the salaries load.
**Why human:** DB-level confirmation was recorded in 55-COVERAGE.md, but the operator approval of the additive-write-only constraint is best confirmed by reading the live app for the custom-sourced cities.

### Gaps Summary

No automated gaps block the phase goal. The single outstanding item is the live-app human verification (55-03 Task 3 blocking checkpoint). All automated truths pass:

- SC-1 (spike): VERIFIED — 55-SPIKE-FINDINGS.md is substantive, GATE: PASS is machine-greppable, 3-part D-05 conditions all evidenced.
- SC-2 (loader): VERIFIED — `scripts/loadCASalaries.js` is a real, working, city-parameterized statewide loader with no OC hard-coding.
- SC-4 (reconciliation): VERIFIED three times (spike, single-city proof, post-sweep) — all return $0 delta.
- SAL-01, SAL-02: SATISFIED per requirements.
- SAL-03 data side: SATISFIED — 544 DB rows confirmed in 55-COVERAGE.md.

The code-review CR-01 (`treasury_ensure_municipality` can create phantom municipalities on typo input) is a latent risk in the standalone loader. The OC sweep itself bypasses this by reading city IDs directly from DB, so all 544 loaded rows target correct municipalities. CR-01 does not block the phase goal but should be addressed before the loader is used for new (non-OC) cities.

---

_Verified: 2026-06-15_
_Verifier: Claude (gsd-verifier)_
