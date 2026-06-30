---
phase: 104-deepen-the-4-pilots
plan: 04
subsystem: state-acfr-data
tags: [live-load, acfr, deepening, ny, ca, fl, idempotency, p2-clamp]
dependency_graph:
  requires: [104-01, 104-02, 104-03]
  provides: [deepened-pilot-rows-live, load-disposition-finalized]
  affects: [treasury.budgets, treasury.data_sources, 104-DEEPEN-GAPLOG.md]
tech_stack:
  added: []
  patterns: [treasury_sync_budget_tree-RPC, per-FY-scoped-live-run, GAAP-source-stamp, P2-clamp]
key_files:
  created: [.planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-04-SUMMARY.md]
  modified: [.planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-DEEPEN-GAPLOG.md]
decisions:
  - Per-FY --fy scoping enforced on all 50 live runs — never ran without --fy (T-104-04-A mitigation)
  - Idempotency proven via second run of representative FY per state (0 net change confirmed)
  - No gap-log skips: all 25 added FYs loaded (0 absent from DB)
  - FL FY2021 P2 clamp confirmed live in DB (root total preserves net, negative category at 0)
metrics:
  duration: 35min
  completed: 2026-06-30
  tasks_completed: 4
  files_modified: 1
---

# Phase 104 Plan 04: Live Load 25 Deepened FYs + Load Disposition Summary

**One-liner:** Live-loaded 25 added pilot FYs (NY FY2003-14, CA FY2008-19, FL FY2021) into treasury.budgets with per-FY ACFR GAAP-basis source stamps; idempotency proven (0-change re-runs); P2 clamp persists on FL FY2021 negative investment category.

---

## What Was Built

Wave 2 (live load) of Phase 104: flipped the switch on the extraction work Wave 1 dry-run-verified. Per-FY scoped runs using `--fy` to restrict blast radius to the added years only.

### Loaded FYs

**NY FY2003-FY2014 (12 FYs, 24 rows)**

| FY | Operating total | Revenue total | data_source label |
|----|----------------|---------------|-------------------|
| FY2003 | $40,910,000,000 | $29,250,000,000 | New York State ACFR — General Fund (FY2003 actual, GAAP basis) |
| FY2004 | $43,386,000,000 | $32,489,000,000 | ... FY2004 ... |
| FY2005 | $45,104,000,000 | $35,929,000,000 | ... FY2005 ... |
| FY2006 | $48,321,000,000 | $41,091,000,000 | ... FY2006 ... |
| FY2007 | $51,936,000,000 | $44,259,000,000 | ... FY2007 ... |
| FY2008 | $54,540,000,000 | $45,423,000,000 | ... FY2008 ... |
| FY2009 | $56,630,000,000 | $40,228,000,000 | ... FY2009 ... |
| FY2010 | $54,129,000,000 | $44,883,000,000 | ... FY2010 ... |
| FY2011 | $55,090,000,000 | $47,069,000,000 | ... FY2011 ... |
| FY2012 | $57,911,000,000 | $48,344,000,000 | ... FY2012 ... |
| FY2013 | $59,796,000,000 | $50,798,000,000 | ... FY2013 ... |
| FY2014 | $59,782,000,000 | $48,459,000,000 | ... FY2014 ... |

Source: `https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-{YYYY}.pdf`. Units: millions (UNITS=1,000,000). 0 null source_urls.

**CA FY2008-FY2019 (12 FYs, 24 rows)**

| FY | Operating total | Revenue total | data_source label |
|----|----------------|---------------|-------------------|
| FY2008 | $98,975,042,000 | $97,774,378,000 | California State ACFR — General Fund (FY2008 actual, GAAP basis) |
| FY2009 | $92,605,222,000 | $84,202,979,000 | ... FY2009 ... |
| FY2010 | $87,247,026,000 | $85,129,367,000 | ... FY2010 ... |
| FY2011 | $90,431,674,000 | $93,479,815,000 | ... FY2011 ... |
| FY2012 | $88,281,652,000 | $86,536,015,000 | ... FY2012 ... |
| FY2013 | $90,114,980,000 | $99,379,153,000 | ... FY2013 ... |
| FY2014 | $95,337,085,000 | $104,182,125,000 | ... FY2014 ... |
| FY2015 | $107,163,567,000 | $116,777,374,000 | ... FY2015 ... |
| FY2016 | $111,804,448,000 | $117,573,422,000 | ... FY2016 ... |
| FY2017 | $116,260,039,000 | $125,121,644,000 | ... FY2017 ... |
| FY2018 | $124,239,316,000 | $135,625,020,000 | ... FY2018 ... |
| FY2019 | $129,113,153,000 | $140,503,627,000 | ... FY2019 ... |

Source: `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf` (different directory from FY2020+ /ACFR/). Units: thousands. 0 null source_urls.

**FL FY2021 (1 FY, 2 rows) — P2 clamp applied**

| FY | Operating total | Revenue total | P2 clamp | data_source label |
|----|----------------|---------------|----------|-------------------|
| FY2021 | $37,277,963,000 | $46,989,188,000 | YES — "Investment earnings (losses)" -$398,287,000 → rendered 0 with "(net loss — shown at 0)" label; root total $46,989,188,000 preserves net | Florida State ACFR — General Fund Revenue (FY2021 actual, GAAP basis) |

Source: `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-2021-state-of-florida-annual-comprehensive-financial-report.pdf`. Units: thousands.

---

## Idempotency Verification

Second run of representative added FY per state (live, no --dry-run):

| State | Re-run FY | Operating result | Revenue result |
|-------|-----------|-----------------|----------------|
| NY | FY2003 | "Loaded 0 rows" + source re-stamp identical | "Loaded 0 rows" + source re-stamp identical |
| CA | FY2008 | "Loaded 0 rows" + source re-stamp identical | "Loaded 0 rows" + source re-stamp identical |
| FL | FY2021 | "Loaded 0 rows" + source re-stamp identical | "Loaded 0 rows" + P2 clamp unchanged |

**Result: PASS.** The `treasury_sync_budget_tree` RPC is keyed (municipality_id, fiscal_year, dataset_type) — a re-run with identical data produces no net inserts/updates.

---

## Existing Rows Unchanged (RECON-05)

Spot-checked via DB queries:

| State | Existing rows checked | Result |
|-------|----------------------|--------|
| NY FY2015-FY2024 | FY2015 op $60,612,000,000 / FY2024 op $115,828,000,000 — totals and data_source labels unchanged | PASS |
| CA FY2020-FY2025 | FY2020 op $138,516,673,000 / FY2025 op $221,826,907,000 — unchanged | PASS |
| FL FY2022-FY2024 | All 6 rows present and labeled "GAAP basis" — unchanged | PASS |
| TX FY2015+ | FY2015 op $91,547,516,000 — unchanged | PASS |
| PA | 2 NASBO rows (FY2023-24) — unchanged | PASS |
| IL | 2 NASBO rows (FY2023-24) — unchanged | PASS |
| MN (un-upgraded ACFR state) | FY2008+ ACFR rows — unchanged | PASS |

---

## DB Verification Results

- **Added row count:** 24 NY + 24 CA + 2 FL = 50 rows exactly matching expected (25 FYs × 2 dataset_types).
- **Null source_url check:** 0 null source_urls on any added row (explicit query confirmed).
- **GAAP-basis labels:** All 50 rows carry "... actual, GAAP basis" in data_source.
- **FL FY2021 P2 clamp:** total_budget = 46,989,188,000 (net including negative investment loss); revenue loader confirmed "Investment earnings (losses) (net loss — shown at 0)" = 0 in tree output.

---

## Deviations from Plan

None. Plan executed exactly as written.

---

## Known Stubs

None. All 50 loaded rows are wired to real ACFR data with per-year source URLs.

---

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. Writes were scoped to the added FYs only, using the existing RPC keyed on (municipality_id, fiscal_year, dataset_type).

---

## Self-Check

**Files exist:**
- `.planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-DEEPEN-GAPLOG.md` — Load Disposition section appended
- `.planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-04-SUMMARY.md` — this file

**Commits:**
- `5b977ca`: feat(104-04): live-load 25 added FYs + append Load Disposition to gap log

**DB (live):** 50 new rows confirmed in treasury.budgets; 0 null source_urls; existing rows unchanged.

## Self-Check: PASSED
