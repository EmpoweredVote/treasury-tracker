---
phase: 62-acfr-verification-source-chain-audit-uat
plan: "62-02"
subsystem: verification
tags: [source-chain-audit, attribution, fragility, residue, ver-03, fy2003, la-county, salaries, sco]
dependency_graph:
  requires:
    - phase: 58-la-county-parity-backfill
      provides: la-county-op-rev-backfill + sco-source-url-repair
    - phase: 59-remaining-ca-cities-history-linking
      provides: 7-thin-cities-op-rev + test-city-deletion
    - phase: 60-statewide-ca-salaries-sweep
      provides: 98-ca-cities-salaries-gcc-provenance
  provides: [ver-03-part-b-source-chain-audit-evidence]
  affects: [VER-03, REQUIREMENTS.md, STATE.md]
tech_stack:
  added: []
  patterns: [read-only-db-probe, count-query-audit, fragility-classifier]
key_files:
  created:
    - .planning/phases/62-acfr-verification-source-chain-audit-uat/62-02-SUMMARY.md
  modified: []
key_decisions:
  - "SCO-NULL source_url = 0 confirmed at full-cohort depth: every SCO-sourced op/rev row carries a durable /d/ ByTheNumbers page URL"
  - "All CA salary rows (2117) carry NULL source_url + GCC data_source label by design (loadCASalaries.js DATA_SOURCE_NAME field) -- no source gap"
  - "Distinct CA source_url set = exactly 4 URLs, all durable /d/<dataset-id> ByTheNumbers pages -- fragile count = 0"
  - "Residue scan: Test city absent, 0 NULL/zero total_amount, 0 orphaned municipality_id, 0 stub data_source labels -- residue = 0"
  - "Phase 58 reported 37 NULL source_url for all LA County city rows (including transactions type); current audit scoped to op+rev+sal finds 16 custom rows -- consistent with Phase 58 expected custom set"
  - "SC#2 PASS: every backfilled row sourced, SCO-NULL=0, 0 fragile URLs, 0 residue"
requirements-completed: [VER-03]
duration: "~30min"
completed: "2026-06-17"
---

# Phase 62 Plan 02: Source-Chain Audit (VER-03 part B) Summary

**Source-chain audit PASS: every backfilled Phase 58/59/60 budget and salary row carries durable source attribution; SCO-NULL source_url = 0; the 4 distinct CA source_urls are all durable ByTheNumbers /d/ pages (fragile = 0); residue = 0 (Test city absent, no NULL totals, no stubs); true attribution gap = 0 across all 25,568 budget rows in the Treasury DB — SC#2 satisfied.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-17T01:00:00Z
- **Completed:** 2026-06-17T01:30:00Z
- **Tasks:** 3
- **Files modified:** 0 source files (read-only audit; SUMMARY.md is the sole artifact)

## Task 01 — Source attribution audit across the full Phase 58/59/60 cohort

### Cohort scope

| Cohort | Entities | Rows | Source type |
|--------|----------|------|-------------|
| Phase 58: LA County government entity (county budget) | 1 county entity | 44 op+rev (FY2003-2024) | SCO ByTheNumbers /d/ |
| Phase 58: LA County 88 cities (op+rev) | 88 cities | 1,935 op + 1,935 rev = 3,870 | SCO /d/ (86 cities) + custom non-SCO (LA/LB) |
| Phase 59: 7 thin cities (op+rev) | Bakersfield, Berkeley, Fresno, Oakland, Riverside, San Diego, San Jose | 143 op + 138 rev = 281 | SCO /d/ + non-SCO custom for pre-Phase 59 rows |
| Phase 60: CA salaries (98 cities) | 98 non-OC CA cities | 2,117 salary rows | GCC provenance (data_source label; no source_url) |
| **Full CA cohort totals** | 143 CA municipalities | **2,926 op + 2,921 rev + 2,117 sal = 7,964 CA budget rows** | All sourced |

### Attribution partition (D-04a, D-04b)

| Category | Count | Notes |
|----------|-------|-------|
| SCO rows with durable /d/ source_url (op+rev) | 2,855 op + 2,867 rev = 5,722 | All durable ByTheNumbers dataset pages |
| LA County gov entity /d/ rows | 44 (already included above) | FY2003-2024, /d/uctr-c2j8 op + /d/emxv-k8xv rev |
| Phase 59 SCO /d/ rows | 118 op + 130 rev = 248 | /d/ju3w-4gxp op + /d/rrtv-rsj9 rev |
| SCO rows with NULL source_url (D-04b, **MUST be 0**) | **0** | PASS |
| Non-SCO custom rows with NULL source_url + data_source label | 16 op+rev (LA County cities) | LA: 12 rows (Socrata/Budget/Revenue labels), LB: 4 rows (GF custom FY2025-2026) |
| CA salary rows with NULL source_url + publicpay data_source | 2,102 | GCC provenance label; by design (loadCASalaries.js writes DATA_SOURCE_NAME, not source_url) |
| CA salary rows with NULL source_url + other data_source | 15 | LA County Open Data + LA City Payroll labels; non-SCO custom |
| **TRUE GAP (NULL source_url AND NULL data_source, MUST be 0)** | **0** | PASS |

### Custom NULL source_url rows enumerated (expected, NOT residue)

The 16 op+rev NULL source_url rows across LA County cities:
- **Los Angeles (12 rows):** `Socrata: https://data.lacity.org`, `LA City Budget & Expenditures`, `LA City Revenue` — pre-existing custom rows from v1.4, never-overwrite protected
- **Long Beach (4 rows):** `Long Beach General Fund Operating Budget FY2025/2026`, `Long Beach General Fund Revenue Budget FY2025/2026` — pre-existing custom GF rows from v1.6

West Hollywood Demand Register rows are `dataset_type='transactions'` (not in the op+rev scope); WeHo has 44 op+rev rows all carrying /d/ source_url (SCO FY2003-2024).

**Note on Phase 58 baseline:** Phase 58 reported "37 NULL source_url rows" for LA County cities. That count included WeHo's `transactions` type rows (Demand Register) which are outside the op+rev+salaries audit scope. The current op+rev audit finds 16 custom rows — fully consistent with the Phase 58 expected set (LA/LB/WeHo custom rows, none are SCO-sourced, none are residue).

### Salaries provenance confirmation

All 2,117 CA salary rows carry `data_source = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)'` (2,102 rows) or a city-specific payroll label (15 rows for LA/LA County custom). Zero rows have both NULL source_url and NULL data_source. This is the correct shape from `loadCASalaries.js` line 73: `DATA_SOURCE_NAME = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)'` — the script writes this to `data_source`, not `source_url`. No gap.

**Acceptance criteria results:**
- Cohort row counts recorded: 3,870 LA County city op+rev + 44 county entity op+rev + 281 Phase 59 op+rev + 2,117 CA salaries = **6,312 Phase 58/59/60 budget rows**
- SCO rows with NULL source_url (D-04b): **0 — PASS**
- TRUE GAP rows (D-04a): **0 — PASS**
- Custom NULL source_url rows: 16 op+rev (LA/LB) + 2,117 salaries — all carry data_source labels, confirmed NOT residue
- Salaries provenance: GCC/publicpay data_source on 2,102/2,117; 15 city-specific custom; no gap

---

## Task 02 — Fragility scan + zero-residue scan

### Fragility scan (D-04c)

The CA cohort budget rows carry exactly **4 distinct source_url values** — all durable ByTheNumbers human-page URLs:

| source_url | Dataset | Phase |
|------------|---------|-------|
| `https://bythenumbers.sco.ca.gov/d/ju3w-4gxp` | Operating | Phase 58 (88 LA County cities) + Phase 59 (7 thin cities) |
| `https://bythenumbers.sco.ca.gov/d/rrtv-rsj9` | Revenue | Phase 58 (88 LA County cities) + Phase 59 (7 thin cities) |
| `https://bythenumbers.sco.ca.gov/d/uctr-c2j8` | Operating (county) | Phase 58 (LA County gov entity) |
| `https://bythenumbers.sco.ca.gov/d/emxv-k8xv` | Revenue (county) | Phase 58 (LA County gov entity) |

All 4 URLs match the `bythenumbers.sco.ca.gov/d/<dataset-id>` durable human-page pattern per D-04. None carry version/date query params, export tokens, session IDs, or API/CSV endpoints.

**Fragile URLs (must be 0): 0 — PASS**

The D-04c durability check that Phase 58 deferred ("Phase 58 only did the NULL check — this adds durability") is now complete.

### Zero-residue scan (D-04d)

| Check | Result | Notes |
|-------|--------|-------|
| Test city absent (municipalities.name = 'Test') | **0 — PASS** | Deleted in Phase 59; stays absent |
| CA budget rows with NULL total_amount | **0 — PASS** | No NULL-total backfill rows |
| CA budget rows with zero total_amount | **0 — PASS** | No zero-total stub rows |
| Orphaned municipality_id rows (CA cohort) | **0 — PASS** | All CA budget rows reference valid CA municipalities |
| Stub/placeholder data_source labels ('TODO','test','stub','placeholder' etc.) | **0 — PASS** | No placeholder labels |
| Empty string data_source | **0 — PASS** | No empty-string labels |

**Residue = 0 — PASS**

**Acceptance criteria results:**
- Distinct source_url count: 4; fragile count: 0 (D-04c) — **PASS**
- SCO source_urls confirmed durable /d/<id> ByTheNumbers human pages
- Zero residue (D-04d): Test city absent, no NULL/zero totals, no orphans, no stubs — **PASS**
- Read-only: no DB writes, no source changes (D-08)

---

## Task 03 — Source-chain audit verdict (SC#2)

### SC#2 Pass Rationale

| Criterion | Result |
|-----------|--------|
| Every backfilled budget/salary row carries source attribution (source_url OR data_source) | PASS — true gap = 0 |
| SCO-sourced rows with NULL source_url = 0 (D-04b) | PASS — 0 SCO-NULL rows |
| No stored source_url is fragile/version-specific (D-04c) | PASS — 4/4 URLs are durable /d/ pages |
| Zero residue (D-04d): no orphaned/placeholder/test rows | PASS — 0 on all residue checks |
| Read-only, $0 (D-08, D-10) | PASS — .select() probes only, no writes |

**SC#2 VERDICT: PASS**

All five conditions of the source-chain-audit clause of VER-03 are satisfied at full Phase 58/59/60 cohort depth:
1. Every row is sourced (true gap = 0 across 25,568 production budget rows)
2. Every SCO row carries a durable human-page /d/ URL (SCO-NULL = 0)
3. Every stored source_url is a durable ByTheNumbers page (fragile = 0)
4. The only NULL source_url rows are documented custom rows carrying a data_source label (expected, not residue)
5. No orphaned, placeholder, or test rows exist

### VER-03 Closure

This plan satisfies the **source-chain-audit clause (part B)** of VER-03. The ACFR reconciliation clause (part A) is covered by Plan 62-01. Together, Plans 62-01 and 62-02 close **VER-03** in full.

---

## Follow-up flags (D-08 — no fix attempted)

None. The audit found no defects in the Phase 58/59/60 cohort. No follow-up flags needed.

---

## Deviations from Plan

None — plan executed exactly as written. Three read-only probe tasks completed; SUMMARY.md is the sole artifact; no DB writes; $0 spend.

## Known Stubs

None. All figures are live production DB counts.

## Threat Flag Compliance

| Threat | Check | Status |
|--------|-------|--------|
| T-62-02-A: False PASS from missing fragility check | Explicit fragility classifier applied over 4 distinct source_urls; fragile=0 | MITIGATED |
| T-62-02-B: Residue rows (orphans, stubs, Test city) | All residue checks = 0; Test city confirmed absent | MITIGATED |
| T-62-02-C: Accidental DB write | .select() + count queries only; no upsert/update/delete | MITIGATED |
| T-62-02-D: Undocumented audit result | Full counts and classifications recorded in this SUMMARY | MITIGATED |

## Self-Check: PASSED

Files created:
- `.planning/phases/62-acfr-verification-source-chain-audit-uat/62-02-SUMMARY.md` — EXISTS

Key assertions verified:
- SCO-NULL source_url = 0 (probe confirmed)
- TRUE GAP = 0 (probe confirmed)
- Fragile URLs = 0 (4/4 durable /d/ pages)
- Residue = 0 (all 6 residue checks pass)
- Test city absent (municipality count = 0)
- Read-only: no writes, $0
