---
phase: 55-statewide-city-salaries-integration
plan: "55-02"
subsystem: data-loader
tags: [gcc, publicpay, salaries, supabase, rpc, zip, csv, california, city-budget]

# Dependency graph
requires:
  - phase: 55-statewide-city-salaries-integration/55-01
    provides: GATE:PASS — GCC download URL, User-Agent, field mapping, Irvine 2024 reconciliation
  - phase: 53-orange-county-operating-revenue-load
    provides: OC city municipality rows in treasury.municipalities (resolve target)
  - phase: 54-orange-county-entity-linking-enrichment
    provides: Linked OC entity records; salaries explicitly deferred here

provides:
  - "scripts/loadCASalaries.js — reusable statewide CA city-salaries loader (SAL-02)"
  - "Irvine FY2024 salaries row in treasury.budgets (dataset_type=salaries, $190,426,283)"
  - "Department → Position tree in treasury.budget_categories (14 depts, 386 positions, 0 name-leaf items)"

affects: [55-03-OC-sweep, future-non-OC-salaries]

# Tech tracking
tech-stack:
  added: [curl-via-execSync (workaround for Node 24 Cloudflare TLS fingerprint block)]
  patterns:
    - "GCC statewide ZIP download: curl execSync with browser UA — not Node fetch (blocked by Cloudflare)"
    - "In-memory ZIP extraction: inflateRawSync from node:zlib, no npm package"
    - "D-01: Position is always the leaf — no individual name columns in GCC source"
    - "D-02: TotalComp = TotalWages + TotalRetirementAndHealthContribution"
    - "D-03: per-position metadata avgBase/avgOvertimeOther/avgBenefits/count"
    - "treasury_ensure_municipality: resolve existing OC city, never duplicate"

key-files:
  created:
    - scripts/loadCASalaries.js
  modified: []

key-decisions:
  - "Use curl via execSync instead of Node fetch: Node 24's undici gets HTTP 403 from gcc.sco.ca.gov (Cloudflare TLS fingerprint); curl with identical browser UA returns 200. Same URL, same UA, $0 cost, no new npm package."
  - "Multi-employer-row handling: case-insensitive exact match on EmployerName; all matching rows aggregated into one Dept→Position tree per city/year."
  - "Position leaf node has NO `i` array and NO employee names (D-01 upheld): GCC source has no name columns by design — confirmed by spike and DB probe."
  - "Zero-comp skip: records where TotalWages + TotalRetirementAndHealthContribution = 0 are excluded (mirrors LA County loader)."

patterns-established:
  - "GCC Loader Pattern: curl execSync + inflateRawSync + CSV parser + buildTree + treasury_sync_city_budget"
  - "Salaries tree is 2-level only: Dept (depth=0) → Position leaf (depth=1); no `i` items"

requirements-completed: [SAL-02]

# Metrics
duration: 45min
completed: 2026-06-14
---

# Phase 55 Plan 02: CA Statewide City Salaries Loader Summary

**Reusable loader scripts/loadCASalaries.js fetches GCC ZIP for any CA city, builds a Department->Position Total Compensation tree (TotalWages + employer benefits), and writes a salaries budgets row — proven on Irvine 2024 with $0 delta against the published $190,426,283 figure.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-14T00:00:00Z (approx)
- **Completed:** 2026-06-14
- **Tasks:** 3
- **Files modified:** 1 (scripts/loadCASalaries.js created)

## Accomplishments

- Reusable statewide CA city-salaries loader (SAL-02) created at `scripts/loadCASalaries.js`
- Loader generalizes loadLACountySalaries.js from LA-specific ArcGIS to statewide GCC ZIP source
- Irvine 2024 proven end-to-end: dry-run + real DB load; loaded total $190,426,283 reconciles to $0 delta with published GCC figure (SC-4 PASS)
- D-01 upheld: 0 individual-name leaf items in stored tree (confirmed via DB probe on budget_categories)
- Operating/revenue rows for Irvine untouched — salaries is additive (different dataset_type)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold loadCASalaries.js (CLI + GCC fetch layer)** - `3c7d5a7` (feat)
2. **Task 2+3: buildTree, RPC write, curl fix, proof on Irvine 2024** - `c4ceeb8` (feat)

Note: Task 2 (buildTree + syncYear) was implemented in the same file as Task 1 (front-loaded for completeness); the curl blocking-issue fix and Task 3 proof run were committed together as `c4ceeb8`.

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `scripts/loadCASalaries.js` - Reusable statewide CA city-salaries loader. Fetches `{YEAR}_City.zip` from gcc.sco.ca.gov via curl, extracts CSV in-memory with inflateRawSync, filters by --city, builds Department -> Position n/a/c tree, writes via treasury_sync_city_budget RPC.

## Decisions Made

1. **curl via execSync instead of Node fetch** — Node 24's undici (native fetch) gets HTTP 403 from gcc.sco.ca.gov due to Cloudflare TLS fingerprinting. curl with the same browser UA returns 200. No new npm package; same tool available on all developer machines; $0 cost. (Rule 3 auto-fix.)

2. **Multi-employer-row handling** — Case-insensitive exact match on EmployerName column (index 2). All rows passing the filter are aggregated into one Department → Position tree per city/year. No special handling for duplicate employer names needed (GCC statewide file uses consistent city names).

3. **Zero-comp skip** — Records where TotalWages + TotalRetirementAndHealthContribution === 0 are excluded. Mirrors the LA County loader's `if (comp === 0) continue` pattern. Affects unpaid board members and partial-year Elected Officials.

4. **Position count note (301 vs 386)** — The spike reported 301 unique position titles; the loader shows 386 position nodes. This is because the loader groups by Dept + Position (department-scoped position nodes), not just Position globally. Multiple departments can have the same job title, creating separate position nodes per department. Total compensation is identical ($190,426,283).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node 24 native fetch blocked by Cloudflare TLS fingerprinting on gcc.sco.ca.gov**
- **Found during:** Task 3 (initial dry-run attempt)
- **Issue:** `fetch(url, { headers: { 'User-Agent': GCC_UA } })` returns HTTP 403. The spike confirmed curl with the same UA returns 200 — difference is undici's TLS fingerprint (Node 24 uses a non-browser TLS ClientHello).
- **Fix:** Replaced `fetch()` call with `execSync('curl -s -A "..." "..."')` in `fetchCityRows`. Same URL, same User-Agent, 100 MB buffer, 120 s timeout. Added a ZIP magic-number check (0x04034b50) to detect non-ZIP responses (HTML error pages).
- **Files modified:** `scripts/loadCASalaries.js`
- **Verification:** curl command returns 8.2 MB ZIP; ZIP magic check passes; CSV extracted successfully; 2,193 Irvine rows filtered; dry-run total $190,426,283.
- **Committed in:** `c4ceeb8`

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required for the loader to work at all. No scope change; same source, same data, no new npm packages. The spike used curl and noted the browser UA worked — the fix aligns the Node loader with that confirmed method.

## Reconciliation (SC-4)

| Metric | Computed (loader) | Published (GCC site) | Delta |
|--------|------------------|----------------------|-------|
| Total Wages | $150,535,676 | $150,535,676 | $0 |
| Total Benefits | $39,890,607 | $39,890,607 | $0 |
| Total Compensation | $190,426,283 | $190,426,283 | $0 |
| Employee count | 2,193 | 2,193 | 0 |

**SC-4 Verdict: PASS** — Exact match, 0.00% delta.

## DB Probe Results

```
budget_id: b586d54d-7cbb-4046-b138-621a8b9e5dd2
municipality_id: 17f0abc4-751f-4609-adcd-d6274ed33269  (Irvine, CA)
dataset_type: salaries
fiscal_year: 2024
total_budget: $190,426,283

budget_categories:
  depth=0 (departments): 14 rows
  depth=1 (position leaves): 386 rows
  Total: 400 rows
  item_count on all position leaves: 0  (D-01 upheld — no name items)
```

## Issues Encountered

- Node 24 fetch blocked by Cloudflare (see Deviations above). Resolved via curl execSync.
- `rows_inserted: 0` from treasury_sync_city_budget RPC — this is the expected upsert behavior when the row already exists from a prior run. The DB probe confirmed the row was present with the correct total.
- `position count (386) > unique position titles (301 in spike)` — expected; see Decision #4 above.

## Threat Model Verification

| Threat | Status |
|--------|--------|
| T-55-02-01: Name/PII in leaf items | MITIGATED — 0 name-leaf items confirmed by DB probe; GCC source has no name columns |
| T-55-02-02: Wrong municipality_id | MITIGATED — treasury_ensure_municipality resolved existing Irvine row (17f0abc4); loader never hard-codes IDs |
| T-55-02-03: Overwriting operating/revenue | MITIGATED — only p_dataset_type='salaries' written; operating/revenue rows verified untouched |
| T-55-02-04: Wrong column mapping/aggregation | MITIGATED — SC-4 reconciliation: $0 delta against published GCC figures |
| T-55-02-05: Building before gate passed | MITIGATED — GATE: PASS confirmed in 55-SPIKE-FINDINGS.md before Task 1 proceeded |

## Next Phase Readiness

- `scripts/loadCASalaries.js` is ready for the full OC sweep (Plan 55-03)
- Usage: `node scripts/loadCASalaries.js --city "<city>" --fy 2024 [--fy 2023 ...] [--dry-run]`
- All 34 OC cities exist in treasury.municipalities (Phase 53/54)
- Gaps (cities not reporting for a given year) produce no salaries row (D-06 design)
- The `salaries` tab appears automatically in the app once a budgets row exists (no frontend work)

## Known Stubs

None — the loaded Irvine 2024 salaries row is real data with a real tree. No placeholder or hardcoded values.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Loader reads from a public government source and writes to existing treasury.budgets + treasury.budget_categories tables via established RPCs.

## Self-Check: PASSED

- [x] `scripts/loadCASalaries.js` exists at C:\treasury-tracker\scripts\loadCASalaries.js
- [x] Commit `3c7d5a7` exists (Task 1 — scaffold)
- [x] Commit `c4ceeb8` exists (Tasks 2+3 — buildTree + proof)
- [x] DB row confirmed: treasury.budgets id=b586d54d... dataset_type=salaries fiscal_year=2024 total_budget=190426283
- [x] DB tree confirmed: 400 budget_categories rows, 0 item_count on depth=1 leaves (D-01)
- [x] Reconciliation: $190,426,283 computed = $190,426,283 published (delta $0)

---
*Phase: 55-statewide-city-salaries-integration*
*Plan: 55-02*
*Completed: 2026-06-14*
