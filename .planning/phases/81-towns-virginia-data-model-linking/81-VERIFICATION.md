---
phase: 81-towns-virginia-data-model-linking
verified: 2026-06-22T00:00:00Z
status: passed
score: 4/4 must-haves verified
human_sign_off: "Chris approved 2026-06-23 — VA navigation, town breadcrumb/per-capita confirmed; WR-05 (legacy GF rows) accepted, deferred to Phase 83"
overrides_applied: 0
human_verification:
  - test: "Select Virginia from the picker and confirm navigation model in the live app"
    expected: "Virginia appears in State Governments list; clicking it opens a hub page with a Counties panel (93 available, filterable) and a Cities/Towns panel; clicking a county shows its towns; a town's breadcrumb reads US → Virginia → <County> → <Town>"
    why_human: "Browser navigation flow — breadcrumb render, panel interaction, and picker UX cannot be verified by grep or DB query; milestone-wide UAT is Phase 83 but this navigation path is new in Phase 81"
  - test: "Open a VA county page (e.g. Fairfax County or Loudoun County) and verify towns are listed"
    expected: "Fairfax County shows Herndon and Vienna in its localities panel; Loudoun County shows Leesburg and Purcellville; no CA/MA county regressions"
    why_human: "CitiesInCountyPanel rendering with real DB data requires browser inspection to confirm the town tags appear and are clickable"
  - test: "Confirm the Virginia state budget dashboard UX is acceptable (WR-05 deviation)"
    expected: "Virginia hub shows the CountiesInStatePanel and CitiesInStatePanel. The pre-v2.7 General Fund budget rows (10 rows, FY2022-2026, null source_url) cause the PlainLanguageSummary and DatasetTabs to render above the navigation panels. Verify this is cosmetically acceptable or flag for immediate fix before Phase 83."
    why_human: "WR-05 (code review): isCountyDirectoryOnly guard is scoped to entity_type='county' only — a budget-less state hub was the CONTEXT D-08 intent, but the pre-existing 10 rows mean Virginia actually has data. Human must confirm the rendered page is coherent, not broken/misleading."
gaps: []
deferred:
  - truth: "Virginia state node carries no budget datasets (CONTEXT D-08 navigation-hub-only intent)"
    addressed_in: "Phase 83"
    evidence: "Phase 83 success criteria include full-cohort source-chain audit. Pre-v2.7 VA General Fund rows (10 rows, data_source='Virginia General Fund Operating Budget/Revenue', source_url=NULL, FY2022-2026) were not created by Phase 81 and are out of scope for this phase. Flagged as WR-05 in code review. Resolution: backfill source_url or remove if source cannot be authenticated."
---

# Phase 81: Towns + Virginia Data Model & Linking — Verification Report

**Phase Goal:** All reporting towns are loaded and the VA navigation model is in place — Virginia state node, standalone cities, county nodes, and towns linked to their county.
**Verified:** 2026-06-22
**Status:** human_needed
**Re-verification:** No — initial independent verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All reportable towns loaded with same datasets/granularity, every row sourced | VERIFIED | 34 towns in DB (entity_type='town', state='VA'); 126 budget rows (63 operating + 63 revenue); 0 NULL source_url; uniform data_source='Virginia APA Comparative Report'; FY2023 and FY2024 present; all 34 towns have population > 0 (Exhibit A fallback). The 3 absent towns (Big Stone Gap, Clifton Forge, Vinton) are multi-year-overdue late filers absent from ALL published XLSX years — not a loader failure, matches the adjusted benchmark of 34 loadable. |
| 2 | Virginia state node exists; US → Virginia → locality navigation works | VERIFIED (with noted deviation) | Virginia state node confirmed in DB: id=c9b21975-bcc2-41d8-9dd8-fd9dcde32506, entity_type='state', state='VA', population=8,631,393. EntitySwitcher withData filter verified to include state/federal bypass. CountiesInStatePanel created and rendered on state pages. 93 VA counties + 34 VA cities + 34 VA towns are reachable from the hub. Deviation: node has 10 pre-v2.7 General Fund budget rows (null source_url) — budget dashboard renders; deferred to Phase 83. Navigation goal is unblocked. |
| 3 | Cities standalone, counties standalone, towns show county breadcrumb and appear in county panel | VERIFIED | Alexandria (city): county_id=NULL confirmed. Fairfax County: county_id=NULL confirmed. Vienna → Fairfax County: county_id=227feaad confirmed. Leesburg → Loudoun County: county_id=decc382b confirmed. Front Royal: county_id=NULL (Warren County absent from Phase 80 — expected documented gap). CitiesInCountyPanel filter verified as `entity_type === 'city' || entity_type === 'town'`. App.tsx confirmed to render CountiesInStatePanel + CitiesInStatePanel on state pages. |
| 4 | Loads remain idempotent | VERIFIED | 34 VA town municipalities, 126 budget rows — counts stable. Seeder idempotency confirmed by 81-02 SUMMARY: re-run produced 0 writes, 33 "already set". never-overwrite guard in importLocality prevents duplicate budget rows. TypeScript build passes (0 errors, tsc -b --noEmit). |

**Score:** 4/4 truths verified

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | VA state node budget rows have null source_url (10 pre-v2.7 General Fund rows) | Phase 83 | Phase 83 goal: "full-cohort source-chain audit shows every row durably sourced (0 NULL / fragile / residue)" — VAVER-01 |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/loadVAComparativeReportBatch.js` | Town branch in work-list builder | VERIFIED | Contains `entityTypes.includes('town')` block pushing `{matchName: name, displayName: name, entityType: 'town', sectionIndex: 2}` for each of 37 towns. Commits c9f090f. |
| `scripts/loadVAComparativeReport.js` | localityPopulation extended with Exhibit A fallback | VERIFIED | `townPopulationFromExhibitA` helper exported; `localityPopulation` falls through to it when Exhibit H returns null. Cities/counties unchanged on Exhibit H primary path. Commit 431c508. |
| `scripts/loadVAComparativeReport.test.mjs` | Town tests (18 total) | VERIFIED | 18 test blocks confirmed: 12 prior + 6 new (roster count=37, Exhibit A population, Exhibit H unchanged, absent=null, bare-name safety, Orange town/county distinct). All sample-dependent tests skip when recon XLSX absent (IN-02 — known limitation). |
| `data/vaTownCounties.json` | 37-entry sourced town→county map with _meta | VERIFIED | 37 keys confirmed, all values end in " County", _meta.source=Census 2020 Geographic Relationship Files URL, _meta.retrieved=2026-06-23. All 3 absent towns included for future auto-link. |
| `scripts/seedVirginiaDataModel.js` | Idempotent seeder: VA state node + town county_id linking | VERIFIED | Creates/ensures Virginia state node via treasury_ensure_municipality; reads vaTownCounties.json; sets county_id only when differing. --dry-run supported (WR-01: dry-run still requires service key for DB reads — doc mismatch, not a correctness bug). |
| `src/components/EntitySwitcher.tsx` | withData filter relaxed for state/federal | VERIFIED | Lines 72-77 confirmed: `(m.available_datasets && m.available_datasets.length > 0) || m.entity_type === 'state' || m.entity_type === 'federal'`. totalCount unchanged. Commit 96b2b75. |
| `src/components/CitiesInCountyPanel.tsx` | Filter includes entity_type='town' | VERIFIED | Line 17: `m.county_id === county.id && (m.entity_type === 'city' || m.entity_type === 'town')`. Commit 018a768. |
| `src/components/CountiesInStatePanel.tsx` | New component: counties for state hub | VERIFIED | 123-line component created. Filters `m.state === state.state && m.entity_type === 'county'`. Available/coming-soon split. Filter box shown when counties > 24 (FILTER_THRESHOLD). Commit d9018af. |
| `src/App.tsx` | Renders CountiesInStatePanel on state pages | VERIFIED | Import at line 37; renders at lines 1290-1297 with guard `navigationPath.length === 0 && selectedEntity?.entity_type === 'state'`. Preceding CitiesInCountyPanel at lines 1282-1288. Commit d9018af. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| VA APA Comparative Report §5 towns + Exhibit A population | 34 town municipalities with op+rev trees + per-capita, FY2023+FY2024 | loadVAComparativeReportBatch.js `--entity-type town` → importLocality (sectionIndex=2) + townPopulationFromExhibitA | WIRED | DB confirmed: 34 towns, 126 rows, 0 null source_url, all 34 have population. Abingdon FY2024 operating=$18,032,009 matches published report. |
| data/vaTownCounties.json (town → county display name) | town municipalities.county_id → parent county municipality id | seedVirginiaDataModel.js resolves county by name+state+entity_type, sets county_id set-if-different | WIRED | DB confirmed: 33/34 towns have county_id set. Vienna→Fairfax County (id=227feaad), Leesburg→Loudoun County (id=decc382b). Front Royal NULL (Warren County absent from Phase 80 — expected). |
| Census VA state total | Virginia state navigation node (entity_type='state', no new datasets) | treasury_ensure_municipality name='Virginia' state='VA' entity_type='state' | WIRED | DB confirmed: 1 Virginia state node, population=8,631,393. |
| Virginia state node (no new APA datasets) + linked towns/cities/counties | US → Virginia → locality navigation: pickable hub + reachable entities + town breadcrumb | EntitySwitcher withData relaxation / CountiesInStatePanel / CitiesInStatePanel / CitiesInCountyPanel / jurisdictionParents | WIRED (code verified; live browser navigation = human check) | Code changes verified. DB has 93 counties, 34 cities, 34 towns all state='VA'. App.tsx renders both panels on state pages. county_id links set for breadcrumb resolver. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CountiesInStatePanel.tsx` | `counties` (municipalities filtered by state+county) | `municipalities` prop from App.tsx → Supabase municipalities table | Yes — 93 VA counties in DB | FLOWING |
| `CitiesInCountyPanel.tsx` | `cities` (municipalities filtered by county_id + entity_type city\|town) | `municipalities` prop from App.tsx | Yes — 33 towns have county_id set | FLOWING |
| `EntitySwitcher.tsx` `stateEntities` | `stateEntities` (filtered from municipalities) | `municipalities` prop | Yes — Virginia node in DB with entity_type='state' | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 34 VA town municipalities exist in DB | DB query: municipalities WHERE entity_type='town' AND state='VA' | 34 rows | PASS |
| 0 NULL source_url on town budget rows | DB query: budgets WHERE municipality_id IN (VA towns) AND source_url IS NULL | 0 rows | PASS |
| 126 total town budget rows (63 op + 63 rev) | DB query: budgets grouped by dataset_type | operating: 63, revenue: 63, total: 126 | PASS |
| All 34 loaded towns have population > 0 | DB query: municipalities WHERE entity_type='town' AND state='VA' AND population > 0 | 34 rows | PASS |
| 33/34 towns have county_id set (Front Royal excepted) | DB query: municipalities WHERE entity_type='town' AND state='VA' | 33 SET, 1 NULL (Front Royal) | PASS |
| Vienna → Fairfax County link | DB: Vienna.county_id → municipalities.name | Fairfax County | PASS |
| Leesburg → Loudoun County link | DB: Leesburg.county_id → municipalities.name | Loudoun County | PASS |
| Alexandria (city) county_id = NULL | DB query: municipalities WHERE name='Alexandria' AND entity_type='city' AND state='VA' | county_id: null | PASS |
| Fairfax County county_id = NULL | DB query: municipalities WHERE name='Fairfax County' AND entity_type='county' AND state='VA' | county_id: null | PASS |
| Warren County NOT in DB | DB query: municipalities WHERE name='Warren County' AND entity_type='county' AND state='VA' | 0 rows | PASS |
| Virginia state node is unique | DB query: municipalities WHERE name='Virginia' AND entity_type='state' | 1 row, id=c9b21975 | PASS |
| Abingdon FY2024 operating = $18,032,009 | DB: budgets WHERE municipality=Abingdon AND fy=2024 AND dataset_type=operating | 18032009 | PASS |
| Leesburg FY2024 operating = $67,499,273 / pop=48,250 | DB: budgets + population | 67499273 / 48250 = $1,399/resident | PASS |
| vaTownCounties.json has 37 keys, all "X County" format | File parse | 37 keys, allEndInCounty=true | PASS |
| TypeScript build passes | tsc -b --noEmit | 0 errors | PASS |
| No TBD/FIXME/XXX in modified files | grep across 7 modified files | 0 matches | PASS |

---

### Probe Execution

No probe scripts declared for this phase. Step 7c: SKIPPED (no probe-*.sh files in scripts/tests/ for Phase 81).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VALOAD-03 | 81-01-PLAN.md | All reporting VA towns (~41) loaded with same datasets and granularity | SATISFIED | 34/37 towns loaded (37 in APA §5 roster; 3 absent from ALL published XLSX years — documented source gaps, not loader failures). 126 budget rows, 0 null source_url, all FYs present, per-capita proven (Leesburg $1,399/resident). |
| VALINK-01 | 81-02-PLAN.md, 81-03-PLAN.md | VA state node exists; cities standalone; counties standalone; towns linked to parent county with breadcrumb + county panel | SATISFIED | State node confirmed. 33/34 town county_id links set (Front Royal excepted — Warren County absent from Phase 80, documented). EntitySwitcher shows VA in picker. CountiesInStatePanel + updated CitiesInCountyPanel + App.tsx render wiring verified in code and DB. |

Both Phase 81 requirement IDs are satisfied. No orphaned requirements: REQUIREMENTS.md Traceability table maps VALOAD-03 and VALINK-01 to Phase 81 and both show "Complete".

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/seedVirginiaDataModel.js` | 21-25, 67-77 | `--dry-run` docs say "zero writes, resolves" but still requires SUPABASE_SERVICE_KEY and exits on missing key (WR-01) | Warning | Developer UX mismatch — not a data correctness bug. Dry-run still needs key for DB reads; the messaging is misleading. No Phase 81 goal impact. |
| `scripts/seedVirginiaDataModel.js` | 100, 110, 144 | Two Supabase client instances created in dry-run (WR-02) | Info | Wasteful but harmless. Redundant client creation, not incorrect behavior. |
| `scripts/seedVirginiaDataModel.js` | 193-237 | Per-row UPDATE with no transaction; partial failure leaves mixed state until re-run (WR-03) | Warning | ~34 rows, idempotent on re-run. Acceptable for Phase 81 but a robustness gap. No blocker. |
| `src/App.tsx` | 630-632, 934 | `isCountyDirectoryOnly` guard covers entity_type='county' only; a budget-less state node would render an empty dashboard — but Virginia has 10 pre-v2.7 rows so it renders real (if unsourced) data (WR-05) | Warning | Budget dashboard renders for Virginia with pre-v2.7 null-source_url General Fund rows. Navigation panels (CountiesInStatePanel, CitiesInStatePanel) still appear. Deferred to Phase 83. Human check requested. |
| `scripts/loadVAComparativeReport.test.mjs` | 28, 55+ | All substantive tests skip when recon XLSX is absent — CI effectively runs only 2 tests (WR-02 as IN-02) | Info | No CI coverage of town roster/population/tree logic without the gitignored fixture. Deferred improvement. |

**Debt marker gate:** Zero TBD/FIXME/XXX markers found in any Phase 81 modified file. Gate: PASSED.

---

### Human Verification Required

#### 1. Virginia picker and hub navigation (live browser)

**Test:** Open the app at treasurytracker.empowered.vote. Open the jurisdiction picker. Look under "State Governments." Select "Virginia."
**Expected:** Virginia appears in the State Governments section (data-less nav node). Its hub page shows a "Counties in Virginia" panel with ~93 counties (filterable — VA has 93 with data), and a Cities/Towns panel. Clicking Fairfax County navigates to the county page. Clicking Loudoun County shows its page with Leesburg and Purcellville in the localities panel.
**Why human:** Browser navigation, picker rendering, and the Counties/Cities panel display require a running app. DB and code changes are verified; the end-to-end flow with real rendered state is not programmatically testable here.

#### 2. Town breadcrumb navigation (live browser)

**Test:** From the Virginia hub, navigate to a county (e.g. Loudoun County), then click a town (e.g. Leesburg).
**Expected:** Leesburg shows breadcrumb: US → Virginia → Loudoun County → Leesburg. Leesburg shows operating and revenue budget data for FY2024 and FY2023 with per-capita visible (~$1,399/resident operating FY2024). Front Royal (if accessible) shows no breadcrumb county level (Warren County absent).
**Why human:** Breadcrumb rendering and per-capita display require the running app; the jurisdictionParents logic has not been changed by Phase 81 but depends on county_id values that were newly set.

#### 3. Virginia state page — budget dashboard UX (WR-05 assessment)

**Test:** Navigate to the Virginia hub page. Observe whether a budget dashboard (YearSelector, PlainLanguageSummary, DatasetTabs) renders above the Counties and Cities panels.
**Expected:** If the pre-v2.7 General Fund rows are still present, the dashboard will render showing "Virginia General Fund" budget data for FY2022-2026 with no source URLs. The CountiesInStatePanel and CitiesInStatePanel should still appear below. Determine whether this is cosmetically acceptable or needs the `isCountyDirectoryOnly` guard extended to cover budget-less state hubs (WR-05 fix).
**Why human:** This is a UX judgment call about a pre-existing data deviation. The navigation goal is technically met (panels render, localities reachable), but the rendered budget dashboard for the state node with null source_urls may be confusing to users. Needs product decision: fix before Phase 82 or defer to Phase 83.

---

### Gaps Summary

No gaps found. All 4 success criteria are verified in the codebase and database. The phase goal — all reporting towns loaded + VA navigation model in place — is achieved.

The only open items are:
1. **Three human browser tests** (navigation flow, breadcrumb, WR-05 UX decision) that cannot be verified programmatically.
2. **Pre-v2.7 VA state budget rows** (10 rows, null source_url) — deferred to Phase 83 source-chain audit per the phase instructions.
3. **Front Royal** county_id=NULL — documented and accepted; Warren County was absent from Phase 80, vaTownCounties.json has the correct entry for auto-link on future re-run.

The `human_needed` status is set because the human verification items include a UX judgment call (WR-05) and a live navigation flow that require the running app. All automated checks passed.

---

_Verified: 2026-06-22_
_Verifier: Claude (gsd-verifier, goal-backward, independent assessment)_
_Method: DB probes (live Supabase), code review of all 9 modified/created files, git commit verification, TypeScript build check_
