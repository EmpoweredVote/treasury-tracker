---
phase: 71-utah-city-salaries-compensation
verified: 2026-06-19T00:00:00Z
status: human_needed
score: 6/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live-app salaries view renders names-free Department→Wages/Benefits for a spot-checked city (SC#3)"
    expected: "Provo and 1–2 other Utah cities show a Salaries/Compensation tab with a Department-topped icicle, Wages/Benefits leaves, plausible total (Provo FY2024 ≈ $92.9M), a Transparent Utah source chip, and no individual names or titles visible anywhere"
    why_human: "UI rendering, names-free visual check, and source attribution presence cannot be verified programmatically — the Task 4 checkpoint recorded operator approval in the SUMMARY but this is a human-attestation, not an automated artifact; full UAT is Phase 73"
---

# Phase 71: Utah City Salaries / Compensation Verification Report

**Phase Goal:** Load names-free employee compensation (PY→salaries) for all 10 Utah cities for available FYs as Department→category total-comp trees, reconcile ≥1 city, document coverage/gaps, and protect pre-existing operating/revenue rows (USAL-01).
**Verified:** 2026-06-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | PY query SELECTs ONLY org1, cat1, SUM(amount) — no PII column projected (D-71-01) | VERIFIED | `SALARY_QUERY` (lines 95–99) contains only `org1`, `cat1`, `SUM(amount)` with no PII token; test suite asserts all 11 blocklist tokens absent from the query string (48/48 pass) |
| 2 | Automated unit test FAILs if any PII column appears in the query or emitted tree (D-71-01 guard) | VERIFIED | `scripts/loadUtahTransparency.test.mjs` PII-exclusion guard group: 15 tests assert blocklist tokens absent from both SALARY_QUERY string and `JSON.stringify(buildSalaryTree(pii_laden_fixture).tree)`; tests pass live (48/48 confirmed by running `node --test`) |
| 3 | 2-level buildSalaryTree (Department→Wages/Benefits) — NOT the 3-level fund builder (D-71-02) | VERIFIED | `buildSalaryTree` (lines 184–212) groups by `org1` → `cat1` only; emits `{n,a,c:[{n,a}]}` with no `i`/`m`; shape test asserts no `i` key on children; `importEntityData` branches on `datasetType === 'salaries'` at line 303 |
| 4 | All 10 Utah cities carry dataset_type='salaries' rows for FY2014–FY2025 (all-funds, D-71-03), every row Transparent Utah sourced with non-null source_url | VERIFIED | DB confirmed by orchestrator: 120 salaries rows = 10 cities × 12 FYs (FY2014–2025), 0 FY2026, all `data_source='Transparent Utah'` with non-null `source_url`, 0 bad-source rows; per-city table in `docs/utah-salaries-coverage.md` lists each city FY2014–2025 with FY2024 totals |
| 5 | Provo FY2024 reconciles to the Transparent Utah Compensation Downloader at ~$0/explained delta (USAL-01 SC#2) | VERIFIED | `docs/utah-salaries-coverage.md` records: loaded $92,945,952.78 vs Downloader $92,945,953; delta −$0.22 (sub-penny floating-point rounding); Wages $65,125,717 + Benefits $27,820,236 matches the phase context baseline exactly |
| 6 | Never-overwrite guard protected pre-existing operating + revenue rows (SC#4) | VERIFIED | DB confirmed by orchestrator: 240 op+rev rows unchanged; SUMMARY records 0 never-overwrite SKIPs (salaries were all-new); `findConflictingBudget` path unchanged in loader (lines 281–294) |
| 7 | Salaries view renders for a spot-checked city with coverage/gaps documented (SC#3) | UNCERTAIN — human needed | `docs/utah-salaries-coverage.md` exists and documents all 10 cities (automated half verified); live-app visual render requires human confirmation (see Human Verification section) |

**Score:** 6/7 truths verified (truth #7 pending human confirmation of live-app render)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/loadUtahTransparency.js` | PY→salaries path: SALARY_QUERY + buildSalaryTree + PY skip removed | VERIFIED | File exists, 404 lines, exports `SALARY_QUERY` (line 95) and `buildSalaryTree` (line 184); no `console.warn.*PY` skip present; `node --check` exits 0 |
| `scripts/loadUtahTransparency.test.mjs` | PII-exclusion guard + buildSalaryTree shape tests | VERIFIED | File exists; imports `buildSalaryTree` and `SALARY_QUERY`; PII-exclusion guard group (15 tests) + shape group (9 tests); 48/48 pass confirmed by live run |
| `docs/utah-salaries-coverage.md` | Per-city FYs + Provo FY2024 reconciliation + names-free safety statement | VERIFIED | File exists, 300 lines; lists all 10 cities with FY2014–2025 per-FY totals, reconciliation table with delta −$0.22 explanation, names-free safety line section |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `loadUtahTransparency.js --type PY` | `treasury_sync_city_budget(p_dataset_type='salaries')` | `fetchFromBigQuery PY branch → buildSalaryTree → importEntityData RPC write` | VERIFIED | `fetchFromBigQuery` PY branch (lines 221–235) uses `SALARY_QUERY`; `importEntityData` (line 303) branches on `datasetType === 'salaries'` → `buildSalaryTree`; RPC call at line 305 passes `p_dataset_type: datasetType` |
| `Utah salaries tree {n,a,c:[{n,a}]}` | `app dataset_type='salaries' renderer` | `same 2-level Department→leaf compact JSON loadCASalaries.js writes` | UNCERTAIN | Shape is structurally correct per test + code inspection; live render confirmed by operator attestation in SUMMARY (Task 4 checkpoint), but requires human re-confirmation under this verification |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `loadUtahTransparency.js` | `rows` (from BigQuery) | `fetchFromBigQuery → SALARY_QUERY on BQ table` | Yes — parameterized live query; DB has 120 loaded rows confirmed by orchestrator | FLOWING |
| `buildSalaryTree` | `tree, total` | `rows` from BigQuery fetch | Yes — real dept/cat aggregation; Provo FY2024 $92.9M matches external baseline | FLOWING |
| `importEntityData` | `result` from `treasury_sync_city_budget` RPC | `buildSalaryTree` output | Yes — 120 rows in DB, 0 SKIPs, 240 op+rev rows untouched | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Loader syntax-checks cleanly | `node --check scripts/loadUtahTransparency.js` | exit 0 | PASS |
| 48/48 tests pass (PII guard + shape tests) | `node --test scripts/loadUtahTransparency.test.mjs` | 48 pass, 0 fail | PASS |
| PY skip is gone | `grep -c "console.warn.*PY" scripts/loadUtahTransparency.js` | 0 matches | PASS |
| SALARY_QUERY and buildSalaryTree are exported | grep for `export const SALARY_QUERY` and `export function buildSalaryTree` | both present at lines 95 and 184 | PASS |
| SALARY_QUERY contains no PII column or fund1 in the SQL string | automated via test suite | all 12 guard assertions pass | PASS |
| All three task commits exist | `git log --oneline 554d0ad 0739b2e e9d3616` | all three found | PASS |

---

## Probe Execution

No `probe-*.sh` files declared or conventional. Step 7c: SKIPPED (BigQuery live-load probe requires ADC — not runnable in this verification session; data presence confirmed via orchestrator DB query).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| USAL-01 | 71-01-PLAN.md | Names-free PY→salaries for all 10 cities, ≥1 city reconciled to Compensation Downloader at ~$0 delta | SATISFIED | SC#1 (120 rows, 10 cities × 12 FYs), SC#2 (Provo −$0.22 rounding), SC#4 (240 op+rev untouched); SC#3 pending live-app human confirm |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/loadUtahTransparency.js` | 16 | Stale docstring: "PY→salaries deferred to Phase 71" (Phase 71 is now complete) | WARNING (WR-03) | Misleads future maintainers; could trigger accidental "restore" of the skip |
| `scripts/loadUtahTransparency.js` | 109 | Stale JSDoc: "PY deferred to Phase 71" on `typeToDataset` (contradicts `case 'PY': return 'salaries'` immediately below) | WARNING (WR-03) | Same misleading-comment risk |
| `scripts/loadUtahTransparency.test.mjs` | 60, 65 | Test description: "PY deferred" / "out of scope this phase" (PY is fully wired) | WARNING (WR-04) | Test documentation lies about feature status; could mask future PY regression |
| `scripts/loadUtahTransparency.js` | 228–234 | Runtime row-mapper `rows.map((r) => ({org1, cat1, amount, …}))` is the actual PII gate at runtime but is untested directly (no exported `projectSalaryRow`) | WARNING (WR-01) | A spread `...r` edit would pass all tests while leaking PII; guard is static-string + tree-shape only |
| `scripts/loadUtahTransparency.js` | 184–212 | `buildSalaryTree` emits `row.org1` / `row.cat1` VALUES verbatim with no content validation; a source-data anomaly placing a personal name in an org1 string would be published undetected | WARNING (WR-02) | Value-blind guarantee; no blocker for current data (Transparent Utah org1 values are structural department strings), but residual risk for future entities |

**Debt marker gate:** No `TBD`, `FIXME`, or `XXX` markers found in phase-modified files.

---

## Human Verification Required

### 1. Live-app salaries view renders names-free for spot-checked city (SC#3)

**Test:** Open treasurytracker.empowered.vote, navigate to Provo, then 1–2 other Utah cities (e.g. Salt Lake City, Ogden). Confirm:
1. A Salaries / Compensation dataset tab or view appears.
2. The view renders a Department-topped icicle whose leaves are Wages / Benefits (2-level tree).
3. Totals are plausible — Provo FY2024 ≈ $92.9M.
4. View is names-free — no individual names, titles, hourly rates, or person-level rows visible anywhere.
5. A "Transparent Utah" source chip / attribution is present on the salaries view.
6. The city's operating (Money Out) and revenue (Money In) views still render exactly as before.

**Expected:** All 6 checks pass — salaries render names-free, source chip present, operating/revenue unaffected.

**Why human:** UI rendering, visual names-free check, and source chip presence cannot be verified by code inspection. The Task 4 operator checkpoint in the SUMMARY records approval, but this verifier cannot independently confirm live-app state.

---

## Carried-Forward Code-Review Warnings (from 71-REVIEW.md)

The 71-REVIEW.md identified 0 blockers and 4 warnings. None block USAL-01 delivery, but they represent residual technical debt:

**WR-01 (names-free runtime gate untested):** The actual PII firewall at runtime is the `rows.map((r) => ({org1, cat1, amount, …}))` mapper in `fetchFromBigQuery`, not just the `SALARY_QUERY` string. A future `...r` spread would pass all tests while leaking PII. Recommended fix: extract an exported `projectSalaryRow()` function and test it directly. This is advisory — the current code is correct and the DB contents confirmed names-free by the orchestrator.

**WR-02 (value-blind guarantee):** The names-free guarantee suppresses PII column names but passes org1/cat1 VALUES verbatim. If a source entity ever stores a personal name in an org1 department string, it would be published. No detection exists. Current Transparent Utah org1 values are structural department strings (confirmed by coverage doc). Recommended fix: add a runtime warning if cat1 is outside the expected small set (`{Wages, Benefits, General}`), and document this residual risk explicitly in the coverage doc.

**WR-03/WR-04 (stale docstrings):** Three comment locations in the loader and one test description still say "PY deferred to Phase 71" after Phase 71 implemented PY. These are maintenance debt, not functional bugs.

These four warnings are acceptable residual risk for USAL-01 delivery. Full verification/UAT is Phase 73. The Phase 73 scope should include addressing WR-01 (exported row-mapper test) and WR-02 (value-blind residual risk documentation) before the final sign-off.

---

## Gaps Summary

No structural gaps. The phase delivered all code, data, and documentation artifacts required by USAL-01. The one open item (SC#3 live-app render) is a human verification requirement, not a code defect — the stored data and tree shape are confirmed correct; only the visual render in the live app cannot be verified programmatically.

The four code-review warnings (WR-01 through WR-04) are noted but do not block USAL-01 acceptance. They are recommended for Phase 73 before final sign-off.

---

_Verified: 2026-06-19_
_Verifier: Claude (gsd-verifier)_
