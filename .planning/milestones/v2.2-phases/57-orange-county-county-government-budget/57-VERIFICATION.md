---
phase: 57-orange-county-county-government-budget
verified: 2026-06-15T00:00:00Z
status: passed
score: 8/8 must-haves verified; Chris signed off live-app UAT items 1-6 (2026-06-15); SourceChip (item 7) deferred to EV-Accounts API follow-up
overrides_applied: 0
human_verification:
  - test: "Live-app OC county page UAT (items 1-5): navigate to Orange County on https://treasurytracker.empowered.vote"
    expected: "OC county page renders a budget icicle/summary (not a blank directory page), per-capita ($/resident) is non-zero, and 34 OC cities are listed in the Cities-in-County panel below the budget"
    why_human: "Browser navigation and visual confirmation of rendered UI cannot be verified programmatically"
  - test: "Federal page regression check: confirm federal page still shows Lens/Scale toggles and SourceChip; no county chip visible on the federal page"
    expected: "Federal page identical to pre-phase-57 behavior — Lens/Scale toggles present, federal SourceChip present, no county-type chip"
    why_human: "Visual layout correctness requires human review"
  - test: "Sample city regression check: navigate to a sample OC city (e.g. Irvine) and confirm no regression — no duplicate chips, no county-level data bleeding in"
    expected: "Irvine page unchanged; city-level data source shown, no county data source chip"
    why_human: "Visual regression requires human review"
  - test: "ACFR cross-check review: confirm the documented FY2010 delta (~$655M) between SCO all-governmental-funds ($3.007B) and ACFR governmental-activities (~$2.35B) is classified as a basis variance, not a load error"
    expected: "The delta is consistent with the all-governmental-funds vs governmental-activities definitional difference (Phase 56 finding); SCO total is the loaded value; delta is documented variance"
    why_human: "Requires human to open OC ACFR FY2009-10 PDF and add up governmental + business-type + internal-service fund expenditure columns to confirm basis; delta classification requires human judgment"
  - test: "SourceChip on OC county page (pending EV-Accounts API follow-up): after the EV-Accounts backend change ships, confirm chip renders with source name, fetch date, and link to the SCO ByTheNumbers county page"
    expected: "SourceChip shows 'CA State Controller - County Expenditures · fetched 2026-06-15' linking to https://bythenumbers.sco.ca.gov/d/uctr-c2j8"
    why_human: "Chip is code-complete but dormant — EV-Accounts backend must be updated to construct data_source_info from source_url/source_date/data_source for non-federal rows; not testable until that API change ships"
---

# Phase 57: Orange County County-Government Budget — Verification Report

**Phase Goal:** Load Orange County's county-government operating + revenue budget from a sourced published document and attach it to the existing OC county entity, so the OC county page shows real budget data (icicle/summary + per-capita) instead of a directory-only page.
**Verified:** 2026-06-15
**Status:** passed — 8/8 must-haves verified; Chris signed off live-app UAT items 1-6 on 2026-06-15 (icicle/summary, per-capita, 34 cities, federal/city no-regression, ACFR basis-variance accepted); SourceChip (item 7) deferred to EV-Accounts API follow-up
**Re-verification:** No — initial authoritative verification

---

## Goal Achievement

The core phase goal is observably achieved: the OC county entity (id=65e7c643) has 44 budget rows (22 operating + 22 revenue, FY2003-2024) confirmed live in the production DB. The `isCountyDirectoryOnly` gate in App.tsx lifts when `available_datasets.length > 0`, so the icicle/summary + year selector + per-capita render automatically. The county page is no longer directory-only. What remains is human visual confirmation (UAT items 1-5) and the ACFR cross-check review.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OC county entity has operating budget rows from a sourced published document (SCO ByTheNumbers uctr-c2j8) | VERIFIED | DB probe: 22 operating rows, source_url=/d/uctr-c2j8, source_date=2026-06-15 |
| 2 | OC county entity has revenue budget rows from a sourced published document (SCO ByTheNumbers emxv-k8xv) | VERIFIED | DB probe: 22 revenue rows, source_url=/d/emxv-k8xv, source_date=2026-06-15 |
| 3 | Every county budget row carries a durable /d/<id> source_url (not /resource/*.json) and a non-null source_date | VERIFIED | DB probe 57-02-03: 0 non-durable rows, 0 missing dates |
| 4 | OC county entity has non-zero population so per-capita works | VERIFIED | DB probe 57-02-04: population=3,150,835 (per-year from SCO feed) |
| 5 | A sampled FY total matches the SCO source figure within rounding | VERIFIED | DB probe 57-02-05: FY2024 operating=$6,424,119,390; delta=$0 |
| 6 | The 34 OC city budget rows are unchanged — county load wrote only to county entity | VERIFIED | DB probe 57-02-06: Irvine FY2024 data_source="CA State Controller - Expenditures" (cities label, not county label) |
| 7 | A reusable scripts/loadCountyBudget.js exists generalizing the LA County loaders | VERIFIED | File exists, substantive (441 lines), datasets map uctr-c2j8+emxv-k8xv, entity-type=county lookup, treasury_sync_city_budget with p_source_url+p_source_date+p_data_source_name |
| 8 | REQUIREMENTS.md marks OCB-01 and OCB-02 [x] | VERIFIED | DB probe 57-02-07: both [x]; traceability rows = Complete |
| 9 | OC county page renders icicle/summary + per-capita (not directory-only) | UNCERTAIN (human) | App.tsx isCountyDirectoryOnly gate at line 615 lifts when available_datasets.length>0; 44 rows in DB satisfies this; visual confirmation requires UAT |
| 10 | 34 OC cities still listed in CitiesInCountyPanel on county page | UNCERTAIN (human) | CitiesInCountyPanel at App.tsx:1220 is independent of budget data and always renders for county pages; visual confirmation requires UAT |
| 11 | Federal and city pages have no regression | UNCERTAIN (human) | Federal block (App.tsx:945-984) is byte-for-byte unchanged; county chip is in a separate block (App.tsx:995-1005) with entity_type==='county' guard; visual confirmation requires UAT |
| 12 | SourceChip renders on OC county page when county has budget data | PARTIAL | Code wired at App.tsx:995-1005 guarded by dataSourceInfo non-null; chip is DORMANT because EV-Accounts API returns data_source_info=null for non-federal rows; no blank chip ships; EV-Accounts follow-up required |

**Score:** 8/8 automated truths verified; 3 truths require human visual confirmation; 1 truth (SourceChip rendering) is partially satisfied — code complete, dormant by design

---

## OCB-02 SourceChip Assessment

**Must-have (57-02-PLAN):** "The OC county page renders a SourceChip (source name + fetched date + link to the durable SCO ByTheNumbers county dataset page) when the county has budget data (D-03)"

**Finding:** The SourceChip code is present in App.tsx (lines 986-1005), correctly guarded, and wired with the right props (`datasetUrl || url` priority for durable-page link). The chip is DORMANT because the EV-Accounts production API returns `data_source_info: null` for all non-federal budget rows (it only constructs that object via the `data_source_id → source_registry` FK, which only federal rows have). No blank chip ships.

**Is OCB-02 satisfied?** Yes, at the requirement level. REQUIREMENTS.md OCB-02 reads: "The OC county page renders the loaded county budget (icicle/summary) with working per-capita and still lists the 34 cities; a `verify-phase57.mjs` probe confirms coverage + source attribution (exit 0)." The icicle/summary auto-renders (44 rows in DB), per-capita works (population=3,150,835), 34 cities panel is independent of budget data, and the probe exits 0. The SourceChip is a plan D-03 detail beyond the requirement text.

**Threat model alignment:** T-57-02 in the plan explicitly anticipated this case and mandated the follow-up path over shipping a blank chip. The dormant chip is a deliberate design outcome, not a silent failure.

**EV-Accounts follow-up required:** The `getCityBudgets()` handler in the EV-Accounts backend must construct a `data_source_info` object from `source_url`, `source_date`, and `data_source` columns when `data_source_id` is null. When that ships, the county chip renders with zero additional frontend changes.

---

## Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/verify-phase57.mjs` | `node scripts/verify-phase57.mjs` | Exit 0, 7/7 PASS | PASS |

**Probe output (live run, 2026-06-15):**

```
  [PASS] 57-02-01: OC county entity has 22 operating budget row(s) (OCB-01)
  [PASS] 57-02-02: OC county entity has 22 revenue budget row(s) (OCB-01)
  [PASS] 57-02-03: All county budget rows have durable /d/<id> source_url and non-null source_date (OCB-01)
  [PASS] 57-02-04: OC county entity ("Orange County", entity_type=county) population = 3,150,835 > 0 (per-capita denominator, D-06)
  [PASS] 57-02-05: OC county FY2024 operating = $6,424,119,390 (expected $6,424,119,390, delta = $0)
  [PASS] 57-02-06: Irvine FY2024 operating retains its original data_source="CA State Controller - Expenditures" — county load did not overwrite city rows (T-57-01)
  [PASS] 57-02-07: REQUIREMENTS.md shows OCB-01 [x] and OCB-02 [x] (traceability complete)
  7 passed, 0 failed (of 7 gap checks)
PASS — All Phase 57 automated gap checks satisfied
```

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/loadCountyBudget.js` | Reusable county-government budget loader (D-07) | VERIFIED | 441 lines; datasets map with uctr-c2j8+emxv-k8xv and /d/<id> pageUrls; entity_type=county lookup exits 1 if absent; never-overwrite pre-pass; treasury_sync_city_budget with p_source_url+p_source_date+p_data_source_name; --dry-run; --county/--entity/--fy/--type/--population/--source-date args |
| `scripts/verify-phase57.mjs` | DB probe, exit 0, 7 assertions | VERIFIED | 362 lines; all 7 assertions pass in live run |
| `src/App.tsx` county SourceChip block | Separate block from federal, guarded by entity_type=county AND dataSourceInfo non-null | VERIFIED | Lines 986-1005; separate from federal block at 945-984; correct guard; datasetUrl OR url priority; dormant by design |
| `.planning/REQUIREMENTS.md` | OCB-01 and OCB-02 marked [x] Complete | VERIFIED | Both [x] in requirements section; traceability rows = Complete |
| `.planning/phases/57-orange-county-county-government-budget/57-VERIFICATION.md` | Coverage, basis, ACFR cross-check, population source, probe result, UAT checklist | VERIFIED | All sections present; UAT checklist items 1-6 with sign-off line |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `loadCountyBudget.js` | Supabase treasury.budgets | `treasury_sync_city_budget` RPC with p_source_url + p_source_date | WIRED | Confirmed in code (line 276); 44 rows written to DB as verified by probe |
| `loadCountyBudget.js` | SCO Socrata county datasets | fetch with $where entity_name='<county>' AND fiscal_year=<fy> | WIRED | Confirmed in code (line 152-163) |
| `App.tsx` county SourceChip block | `SourceChip` component | `selectedEntity?.entity_type === 'county' && budgetData.metadata.dataSourceInfo` guard | PARTIAL-WIRED | Code correct; dataSourceInfo guard prevents blank chip; dormant because API returns null; no regression to federal/city |
| `App.tsx` `isCountyDirectoryOnly` | budget display | `selectedEntity.available_datasets.length === 0` gate lifts | WIRED | Gate at line 615-617; lifts with 44 rows in DB |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| OC county budget display (App.tsx) | `budgetData` / `isCountyDirectoryOnly` | treasury.budgets via EV-Accounts API for entity 65e7c643 | Yes — 22 operating + 22 revenue rows in DB, source_date=2026-06-15 | FLOWING |
| Per-capita denominator | `entity.population` | treasury.municipalities.population for 65e7c643 | Yes — 3,150,835 (SCO per-year feed) | FLOWING |
| County SourceChip | `budgetData.metadata.dataSourceInfo` | EV-Accounts API getCityBudgets() handler | No — API returns null for non-federal rows | HOLLOW (by design; guard prevents blank chip) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OCB-01 | 57-01 | OC county-government operating + revenue budget loaded from sourced document, basis documented, source attribution durable | SATISFIED | 22+22 rows in DB; /d/uctr-c2j8 + /d/emxv-k8xv source_urls; source_date=2026-06-15; all-governmental-funds basis documented in loader and verification doc |
| OCB-02 | 57-02 | OC county page renders loaded budget (icicle/summary) with working per-capita, 34 cities listed; verify-phase57.mjs probe exit 0 | SATISFIED | Probe exit 0 confirmed live; isCountyDirectoryOnly gate lifts with 44 rows; population=3,150,835; CitiesInCountyPanel independent of budget data; visual confirmation via UAT pending |

No orphaned requirements — REQUIREMENTS.md maps only OCB-01 and OCB-02 to Phase 57, both claimed by plans, both verified.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/App.tsx` | 992 | `TODO (EV-Accounts follow-up, Phase 57): populate data_source_info...` | INFO | In a JSX comment block; documents the EV-Accounts backend gap; references "Phase 57" and names the specific work (not an unresolved blocker — no TBD/FIXME/XXX); chip guard prevents any blank or broken render |

No TBD, FIXME, or XXX markers found in phase-modified files. The TODO at App.tsx:992 is warning-level, cross-referenced to a named follow-up, and does not represent unauditable completion.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Probe exits 0, 7/7 PASS | `node scripts/verify-phase57.mjs` | Exit 0 | PASS |
| Loader script prints usage when --county missing | `node scripts/loadCountyBudget.js` (no args) | Prints usage, exits 0 | PASS (confirmed by code inspection: line 313-326 prints usage and exits 0 when county missing) |
| App.tsx compiles without type errors | `npx tsc --noEmit` | 0 errors (per 57-02-SUMMARY) | PASS (per executor claim; executor ran this; no type errors to independently verify without running) |

---

## Human Verification Required

### 1. OC County Page — Budget Icicle/Summary

**Test:** Navigate to https://treasurytracker.empowered.vote, open Orange County page.
**Expected:** Budget icicle/summary renders (not a blank "Cities in Orange County" directory page); colored category bars visible.
**Why human:** Browser navigation + visual confirmation of rendered React UI.

### 2. Per-Capita Display

**Test:** On the OC county page, verify per-capita ($/resident) is visible and non-zero.
**Expected:** "$/resident" metric shown; value consistent with population ~3.15M denominator.
**Why human:** Visual confirmation of rendered metric.

### 3. 34 Cities Still Listed

**Test:** Scroll down on the OC county page to the Cities-in-County panel.
**Expected:** 34 OC city tiles visible below the budget visualization.
**Why human:** Visual confirmation of CitiesInCountyPanel render.

### 4. Federal Page Regression

**Test:** Navigate to the federal budget page.
**Expected:** Lens/Scale toggles present, federal SourceChip shows, no county-type chip anywhere on the page.
**Why human:** Visual regression check; App.tsx county block is separate but human confirmation is the gate.

### 5. Sample City Regression

**Test:** Navigate to a sample OC city (e.g. Irvine).
**Expected:** City page renders as before; no county-load data source shown; no duplicate chips.
**Why human:** Visual regression check.

### 6. ACFR Cross-Check Review

**Test:** Review the FY2010 cross-check in 57-VERIFICATION.md (executor-authored doc): SCO all-governmental-funds $3,007,166,924 vs OC ACFR governmental-activities ~$2.35B; delta ~$655M.
**Expected:** Delta is consistent with the all-governmental-funds basis (internal service + proprietary funds explain the gap per Phase 56 finding); delta is classified as a documented basis variance, not a load error; SCO remains the loaded value.
**Why human:** Verification of ACFR figure requires opening the OC FY2009-10 ACFR PDF; basis-matching judgment requires human.

### 7. SourceChip — After EV-Accounts API Change Ships

**Test:** After the EV-Accounts backend is updated to construct data_source_info from source_url/source_date/data_source for non-federal rows, navigate to the OC county page.
**Expected:** SourceChip renders: "CA State Controller - County Expenditures · fetched 2026-06-15" linking to https://bythenumbers.sco.ca.gov/d/uctr-c2j8.
**Why human:** Cannot test until EV-Accounts backend change ships; chip code is complete and waiting.

---

## Gaps Summary

No blocking gaps. The phase goal is achieved: the OC county entity has 44 sourced budget rows (22 operating + 22 revenue, FY2003-2024) confirmed by live DB probe (exit 0, 7/7 PASS). The county page transitions from directory-only to budget-rendering automatically via the `isCountyDirectoryOnly` gate.

The SourceChip is code-complete but dormant, pending an EV-Accounts backend change. This is a deliberate, documented design outcome (T-57-02 threat model; no blank chip ships; guard is correct). It does not block the core goal or OCB-02. A follow-up is required in the EV-Accounts backend.

Human UAT (items 1-5) is the remaining gate before phase closure.

---

_Verified: 2026-06-15_
_Verifier: Claude (gsd-verifier)_
