---
phase: 71-utah-city-salaries-compensation
plan: 01
subsystem: database
tags: [bigquery, utah, salaries, transparent-utah, loader, pii-guard, compensation]

# Dependency graph
requires:
  - phase: 69-utah-city-budgets-load
    provides: "10 Utah city municipality rows + EX/RV budget rows; loadUtahTransparency.js loader + never-overwrite guard"
  - phase: 70-utah-county-budgets-linking
    provides: "County budget rows + entity-type flag; confirmed cities untouched by county loads"
provides:
  - "names-free PY salaries path in scripts/loadUtahTransparency.js (SALARY_QUERY + buildSalaryTree)"
  - "PII-exclusion guard test in scripts/loadUtahTransparency.test.mjs"
  - "120 salaries rows: 10 Utah cities × 12 FYs (FY2014–FY2025), dataset_type='salaries', Transparent Utah sourced"
  - "Provo FY2024 reconciliation: loaded $92,945,952.78 vs baseline $92,945,953 (delta −$0.22, rounding-only)"
  - "docs/utah-salaries-coverage.md: per-city coverage table, reconciliation, names-free safety statement"
affects: [72-utah-county-salaries, 73-utah-parity-verification, phase-summary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PY→salaries branch in loadUtahTransparency.js: separate SALARY_QUERY (org1/cat1/SUM only, no PII) + buildSalaryTree (2-level dept→leaf, no fund1)"
    - "Automated PII-exclusion guard: test asserts PII tokens absent from query string AND from JSON.stringify(tree) even when fixture rows carry PII keys"
    - "2-level salary tree shape {n,a,c:[{n,a}]}: matches CA GCC salaries renderer (same shape as loadCASalaries.js buildTree output)"

key-files:
  created:
    - docs/utah-salaries-coverage.md
  modified:
    - scripts/loadUtahTransparency.js
    - scripts/loadUtahTransparency.test.mjs

key-decisions:
  - "D-71-01: PY query projects ONLY org1/cat1/SUM(amount) — no PII column (vendor_name, title, hourly_rate, gender, etc.) ever projected, grouped, stored, or rendered; automated guard test enforces this"
  - "D-71-02: 2-level buildSalaryTree (Department→Wages/Benefits) — NOT the 3-level fund/org1/cat1 budget builder; top node = org1 full string, c children = cat1 leaves {n,a}, no `i` array"
  - "D-71-03: All-funds basis — GROUP BY org1, cat1 with no fund1 filter; includes enterprise/utility employees"
  - "Provo FY2024 delta of −$0.22 accepted as rounding-only (BigQuery floating-point SUM vs Downloader integer display); USAL-01 SC#2 satisfied"

patterns-established:
  - "PII-free aggregate pattern: separate query path for PY type projecting only structural columns (org1/cat1) + amount; tree builder strips any extra keys from source rows"
  - "Test-guarded PII exclusion: import the query string + tree builder into the test suite and assert blocklist tokens absent from both"

requirements-completed: [USAL-01]

# Metrics
duration: ~3h (across 4 tasks including operator checkpoint)
completed: 2026-06-19
---

# Phase 71 Plan 01: Utah City Salaries (PY) — Names-Free Loader + USAL-01 Sweep Summary

**Names-free aggregate PY→salaries path added to loadUtahTransparency.js; all 10 Utah cities loaded FY2014–FY2025 (120 rows, Transparent Utah), Provo FY2024 reconciled at −$0.22 rounding delta, live app renders Department→Wages/Benefits icicle with source chip (operator-approved)**

## Performance

- **Duration:** ~3 hours (Tasks 1–3 automated; Task 4 operator checkpoint approved)
- **Started:** 2026-06-19T00:00:00Z
- **Completed:** 2026-06-19
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify)
- **Files modified:** 3 (scripts/loadUtahTransparency.js, scripts/loadUtahTransparency.test.mjs, docs/utah-salaries-coverage.md)

## Accomplishments

- Added the names-free PY→salaries path to `scripts/loadUtahTransparency.js`: a new `SALARY_QUERY` (exports org1/cat1/SUM(amount) only, parameterized @entity/@fy/@type, no fund1, no PII) and `buildSalaryTree()` (2-level Department→Wages/Benefits tree in the CA-GCC salaries shape `{n,a,c:[{n,a}]}`).
- Added an automated PII-exclusion guard test in `scripts/loadUtahTransparency.test.mjs`: asserts the query string contains none of the 11-token PII blocklist and that `JSON.stringify(buildSalaryTree(pii_laden_fixture).tree)` also contains none (48/48 tests pass).
- Live-loaded all 10 Utah cities for FY2014–FY2025 (12 FYs each, 120 rows total); 0 never-overwrite SKIPs (salaries were all-new); 240 pre-existing operating + revenue rows untouched (SC#4).
- Reconciled Provo FY2024: loaded $92,945,952.78 vs Transparent Utah Compensation Downloader $92,945,953 — delta −$0.22 (floating-point SUM rounding); USAL-01 SC#2 satisfied.
- Operator confirmed live-app salaries view renders Department→Wages/Benefits icicle with Transparent Utah source chip; operating/revenue views unaffected (SC#3, SC#4).

## Task Commits

Each task was committed atomically:

1. **Task 1: Names-free PY→salaries path + PII guard test** - `554d0ad` (feat)
2. **Task 2: Live-load all 10 UT cities PY salaries FY2014–FY2025** - `0739b2e` (chore)
3. **Task 3: Provo FY2024 reconciliation + per-city coverage doc** - `e9d3616` (docs)
4. **Task 4: Live-app checkpoint** - operator-approved (no commit — verification only)

## Files Created/Modified

- `scripts/loadUtahTransparency.js` - Added `SALARY_QUERY` (exported, PII-free), `buildSalaryTree()` (exported, 2-level), PY branch in `fetchFromBigQuery`, salaries branch in `importEntityData`, removed PY skip from `main`
- `scripts/loadUtahTransparency.test.mjs` - Added PII-exclusion guard test group + buildSalaryTree shape test group (48/48 pass)
- `docs/utah-salaries-coverage.md` - Per-city FY table (10 cities × 12 FYs), Provo FY2024 reconciliation, names-free safety statement, coverage summary table

## Decisions Made

- **PY query projects only org1/cat1/SUM(amount) (D-71-01):** Aggregate-only query is both the technical design and the mission/policy choice — department-level accountability (Fire $12.7M, Police $9.6M) without re-hosting a named-individual salary database. Automated test enforces the guarantee on every future change to the query string.
- **2-level tree, not 3-level (D-71-02):** Salaries have no fund dimension; using the existing 3-level budget builder would produce fund names at the top level instead of departments. `buildSalaryTree` mirrors the CA GCC `loadCASalaries.js` output shape so the app's existing salaries renderer works with zero UI changes.
- **All-funds basis (D-71-03):** No fund1 filter — enterprise/utility employees (e.g. Energy - Electric Operations in Provo) are included. This matches the Compensation Downloader basis and produces the correct all-funds total for reconciliation.
- **Provo FY2024 −$0.22 delta accepted:** BigQuery returns a floating-point SUM; the Downloader displays integer dollars. The delta is sub-penny and rounding-only, not a data error. Documented in coverage doc.

## Deviations from Plan

None — plan executed exactly as written.

## Per-City Coverage (FY2014–FY2025)

All 10 cities loaded with complete coverage. 0 source gaps.

| City | FYs Loaded | FY2024 Total Comp | Source Notes |
|------|-----------|-------------------|--------------|
| Layton | FY2014–2025 (12) | $44,919,551 | 8–9 depts/year |
| Lehi | FY2014–2025 (12) | $52,066,645 | 30–33 depts; FY2017 jump reflects rapid growth |
| Ogden | FY2014–2025 (12) | $82,029,041 | FY2019+ consolidated to 1 dept (source reporting change) |
| Orem | FY2014–2025 (12) | $60,331,083 | 10–11 depts/year |
| **Provo** | FY2014–2025 (12) | **$92,945,953** | **71–90 depts; reconciliation canary** |
| Salt Lake City | FY2014–2025 (12) | $432,784,111 | ~2.6M raw rows aggregated server-side; FY2014 may be partial-year |
| Sandy | FY2014–2025 (12) | $74,752,333 | 7–8 depts/year |
| St. George | FY2014–2025 (12) | $93,046,622 | 1 top-level dept (source reporting choice) |
| West Jordan | FY2014–2025 (12) | $63,554,423 | FY2014–2015 = 1 dept; FY2016+ = 21–33 depts |
| West Valley City | FY2014–2025 (12) | $90,667,745 | 9–10 depts/year |

**Total rows loaded:** 120  
**Never-overwrite SKIPs:** 0 (salaries were all-new)  
**Operating/revenue rows untouched:** 240 (SC#4 — never-overwrite honored)

## Provo FY2024 Reconciliation (USAL-01 SC#2)

| Metric | Value |
|--------|-------|
| Loaded all-funds total | $92,945,952.78 |
| Transparent Utah Downloader baseline | $92,945,953 |
| Delta | −$0.22 |
| Explanation | Sub-penny rounding — BigQuery floating-point SUM vs Downloader integer display |

## Names-Free Safety Line (D-71-01)

All loaded salaries data is aggregate-only. The BigQuery PY query projects only `org1` (department), `cat1` (Wages/Benefits), and `SUM(amount)`. No individual is identifiable. The `buildSalaryTree` emitter carries only org1/cat1/amount keys — no vendor_name, title, hourly_rate, gender, or other PII column is ever projected, grouped, stored, or rendered. An automated unit test (48/48 pass) guards this guarantee on every future code change.

## Live-App Verification (SC#3 — Operator Approved)

The operator confirmed on 2026-06-19 via the live app (treasurytracker.empowered.vote):
- Provo and spot-checked cities render a Salaries/Compensation view with a Department-topped icicle, Wages/Benefits leaves, plausible totals (Provo FY2024 ≈ $92.9M).
- View is names-free — no individual names, titles, or hourly rates visible.
- Transparent Utah source chip/attribution present.
- Operating (Money Out) and revenue (Money In) views unaffected (SC#4).

## Success Criteria Status

| Criterion | Status |
|-----------|--------|
| USAL-01 SC#1: Names-free PY salaries loaded for all 10 cities (available FYs as dept/category trees) | SATISFIED — 120 rows, 10 cities × 12 FYs |
| USAL-01 SC#2: ≥1 city reconciled at ~$0/explained delta | SATISFIED — Provo FY2024, delta −$0.22 (rounding) |
| USAL-01 SC#3: Salaries view renders for spot-checked city with coverage/gaps documented | SATISFIED — operator-approved live app render |
| USAL-01 SC#4: Never-overwrite guard protected pre-existing data | SATISFIED — 0 SKIPs, 240 op+rev rows untouched |
| D-71-01: Aggregate-only names-free query + automated PII-exclusion guard | COMPLETE |
| D-71-02: 2-level buildSalaryTree (Department→Wages/Benefits) | COMPLETE |
| D-71-03: All-funds basis | COMPLETE |

## Issues Encountered

None.

## Next Phase Readiness

- All 10 Utah cities now carry operating (EX), revenue (RV), and salaries (PY) datasets at full CA parity — ready for Phase 72 (county salaries) or Phase 73 (Utah parity verification/UAT).
- The `buildSalaryTree` + `SALARY_QUERY` exports are reusable for county (Phase 72) with only the entity_type flag change.
- PII guard test is regression-proof — any future loader edit that accidentally leaks a PII column will cause test failure before it reaches the DB.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The PY path uses the same `treasury_sync_city_budget` RPC and Supabase service key as existing EX/RV paths. All STRIDE mitigations confirmed deployed (T-71-01 through T-71-06 per plan threat register).

## Self-Check: PASSED

Files exist:
- `docs/utah-salaries-coverage.md` — FOUND (read above)
- `scripts/loadUtahTransparency.js` — FOUND (modified in Task 1)
- `scripts/loadUtahTransparency.test.mjs` — FOUND (modified in Task 1)

Commits exist:
- `554d0ad` — FOUND (feat(71-01): add names-free PY→salaries path)
- `0739b2e` — FOUND (chore(71-01): live-load all 10 UT cities PY salaries)
- `e9d3616` — FOUND (docs(71-01): Provo FY2024 reconciliation + per-city coverage)

---
*Phase: 71-utah-city-salaries-compensation*
*Completed: 2026-06-19*
