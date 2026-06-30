---
phase: 99-california-texas-acfr-upgrade
plan: 01
subsystem: state-acfr-loaders
tags: [acfr, california, texas, general-fund, gaap, loader, dry-run]
requires: [98-ACFR-SOURCES, processMN.js, processOHRevenueAcfr.js, loadStateGF.mjs]
provides: [processCA.js, processCARevenueAcfr.js, processTX.js, processTXRevenueAcfr.js, cleanupStaleStateGFDataSources.mjs]
affects: []  # NO DB writes in this plan — Wave 2 (99-02 CA, 99-03 TX) does the live loads
tech-stack:
  added: []   # no new packages — copies existing scripts + vendored @supabase/supabase-js + system pdftotext
  patterns: [pdftotext-table-extraction, per-FY-tie-check-gate, P2-negative-clamp, idempotent-RPC-replace, 0-row-delete-assertion]
key-files:
  created: [scripts/processCARevenueAcfr.js, scripts/processTXRevenueAcfr.js, scripts/cleanupStaleStateGFDataSources.mjs]
  modified: [scripts/processCA.js, scripts/processTX.js]  # overwrote stale v1.7 city-level loaders with GAAP ACFR state loaders
decisions: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-09, D-10, D-15]
metrics:
  completed: 2026-06-29
  tasks: 3
  files: 5
  fys_ca: 6
  fys_tx: 10
---

# Phase 99 Plan 01: California + Texas ACFR Loaders (build + dry-run) Summary

Built four hand-transcribed, checksum-verified GAAP ACFR General Fund loaders (CA + TX, operating + revenue) plus a 0-row-gated stale-`data_sources` cleanup script, all proven via `--dry-run` with a hard per-FY tie-to-printed-total gate — **zero production DB writes, $0 spend (pdftotext only)**.

## What was built

- **scripts/processCA.js** — CA GF operating (spend-by-function), FY2020–2025, GENERAL column, thousands→dollars; node id `e1007bf5-…` fixed (D-01); control = printed "Total expenditures".
- **scripts/processCARevenueAcfr.js** — CA GF revenue-by-source, FY2020–2025, P2 clamp wired (no negatives in window); control = printed "Total revenues".
- **scripts/processTX.js** — TX GF operating, FY2015–2024 (incl. recovered FY2016), GENERAL REVENUE FUND column, honestly labelled (D-06); control = printed "Total Expenditures".
- **scripts/processTXRevenueAcfr.js** — TX GF revenue-by-source, FY2015–2024, P2 clamp **triggers on FY2022** (Interest & Other Investment Income −122,684k); control = printed "Total Revenues".
- **scripts/cleanupStaleStateGFDataSources.mjs** — DRY-RUN-by-default delete of the 4 stale non-NASBO 0-row `data_sources`, gated behind a per-row 0-budgets assertion; `--apply` + `--state` flags; NASBO/other-state hard guard.

## Per-FY tie-check results (control total vs transcribed category sum)

### California (FY2020–2025) — all tie to **0 diff**, all PASS

| FY | Revenue control | rev sum diff | Operating control | exp sum diff |
|----|-----------------|--------------|-------------------|--------------|
| 2020 | 155,923,876k ✅ anchor | 0 | 138,516,673k | 0 |
| 2021 | 196,987,037k | 0 | 146,375,674k | 0 |
| 2022 | 199,159,368k | 0 | 191,119,860k | 0 |
| 2023 | 192,452,181k | 0 | 191,010,618k | 0 |
| 2024 | 195,343,696k | 0 | 190,318,638k | 0 |
| 2025 | 221,591,201k ✅ anchor | 0 | 221,826,907k | 0 |

CA bookends reproduced **exactly**. CA has **no** negative GF categories in this window.

### Texas (FY2015–2024) — all PASS (rev 0 diff; exp residuals ≤$31k ≪ $10M gate)

| FY | Revenue control | rev diff | Operating control | exp diff (ACFR rounding) |
|----|-----------------|----------|-------------------|--------------------------|
| 2015 | 95,574,830k ✅ anchor | 0 | 91,547,516k | 0 |
| 2016 | 96,239,551k | 0 | 96,969,189k | 0 |
| 2017 | 97,845,444k | 0 | 96,028,761k | 0 |
| 2018 | 104,971,891k | 0 | 100,562,405k | 0 |
| 2019 | 108,457,222k | 0 | 100,119,146k | −11k |
| 2020 | 114,453,985k | 0 | 110,209,722k | −1k |
| 2021 | 135,544,186k | 0 | 127,124,061k | −2k |
| 2022 | 177,811,724k (P2) | 0 | 149,657,222k | −1k |
| 2023 | 168,071,483k | 0 | 141,704,325k | −20k |
| 2024 | 161,416,562k ✅ anchor | 0 | 151,740,650k | −31k |

TX bookends reproduced **exactly**. The tiny TX operating residuals (≤$31k) are ACFR printed-subtotal rounding on the General-column debt-service Interest line (0 for FY2019–2024), far inside the $10M tie tolerance. The tie-gate was negative-tested: a $20M corrupted CA value correctly triggered `≠` and `process.exit(2)` (refused to load).

## FYs transcribed / dropped

- **CA: 6/6 transcribed** (FY2020, 2021, 2022, 2023, 2024, 2025). None dropped.
- **TX: 10/10 transcribed** (FY2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024). None dropped.
- **TX FY2016 RECOVERED** (not dropped): the standard `…/2016/96-471.pdf` 404s, but the full FY2016 ACFR is published one level deeper at `…/2016/docs/96-471.pdf` (14.8 MB, real PDF, tie-confirmed: rev 96,239,551k, exp 96,969,189k). The alternate URL is recorded in both TX loaders' `SOURCES` map. The plan's planned-drop fallback was therefore not needed.

## P2 negative-category clamp (ACFR-05)

- **TX revenue FY2022**: "Interest and Other Investment Income" GENERAL column = **−122,684k**. Dry-run prints `[Note: Interest and Other Investment Income true value: -122,684,000 (net loss — shown at 0)]`; rendered area clamped to 0; root total carries the net (which already nets the negative). Confirmed firing.
- CA (all years) + TX (all other years) have no negative GF categories; the clamp is wired and dormant.

## Cleanup script dry-run output

```
Targets (4): ca-lao-gf-operating, ca-dof-gf-revenue, tx-gf-operating, tx-gf-revenue
  [ca-lao-gf-operating] api_type=xlsx_download backs 0 budgets rows → 0-row assertion PASS  → WOULD DELETE
  [ca-dof-gf-revenue]   api_type=pdf_download  backs 0 budgets rows → 0-row assertion PASS  → WOULD DELETE
  [tx-gf-operating]     api_type=pdf_download  backs 0 budgets rows → 0-row assertion PASS  → WOULD DELETE
  [tx-gf-revenue]       api_type=html          backs 0 budgets rows → 0-row assertion PASS  → WOULD DELETE
Dry-run summary: 4 would-delete, 0 already-gone, 0 deleted.
```

All 4 stale ids found, each asserted to back **0 budgets rows**, no NASBO/other-state row named, **0 deletes performed** (DRY-RUN, exit 0). The dry-run executed a read-only `count(head:true)` query against the live table (no writes).

## Extraction method (D-09)

`pdftotext -table` (NOT `-layout`) on local gitignored PDFs in `_acfr-tmp/{ca,tx}/`. Statement page auto-located per file (CA PDF pp.64–66; TX PDF pp.46–57). CA soft-404 guard applied on download (all CA FY2020–2025 verified `application/pdf` >1 MB; the legacy `ca-acfr-2008.pdf` 11,561-byte HTML soft-404 left untouched/unused). All downloaded PDFs + extracted statement `.txt` are gitignored (not committed).

## Deviations from Plan

### Auto-fixed / resolved

**1. [Rule 3 - Blocking resolved] TX FY2016 recovered instead of dropped.**
- **Found during:** Task 2.
- **Issue:** Plan anticipated possibly dropping FY2016 (`96-471.pdf` 404).
- **Resolution:** Located the alternate path `…/2016/docs/96-471.pdf` on the archive page; downloaded, extracted, tie-confirmed. FY2016 is included (no gap). The `docs/` URL is recorded in both TX `SOURCES` maps.

**2. [Pre-existing file overwrite — intended] processCA.js + processTX.js replaced.**
- Both paths held stale v1.7 city/biennial-budget loaders (LAO XLSX / biennial GR splits). The plan's `files_modified` lists both, so they were overwritten with the new GAAP ACFR state loaders. This is the planned NASBO/v1.7 → ACFR upgrade, not an accidental deletion.

## Things needing your attention before Wave 2 (99-02 / 99-03)

1. **TX node total will visibly ~3× jump** on the live load (FY2024 General Revenue Fund operating ≈$151.7B / revenue ≈$161.4B vs the current NASBO ~$50.5B GF). This is correct + sourced per D-06; the loaders label the fund honestly as "General Revenue Fund". Confirm you're ready for the visible node-total change before 99-03 runs live.
2. **CA operating total > revenue total** for most CA years (e.g. FY2025 exp 221.8B > rev 221.6B) — that is the ACFR's own General-column figures (the GF runs a small operating deficit covered by transfers/fund balance). Not an error; both tie to their own printed control.
3. **TX operating residual rounding (≤$31k)** is inherent ACFR printed-subtotal rounding (well inside the $10M gate). No action needed; flagged for transparency.
4. **Stale-`data_sources` deletes are NOT yet applied** — `cleanupStaleStateGFDataSources.mjs --apply` runs in 99-02 (CA) / 99-03 (TX). NY/FL carry analogous stale rows (Phase 100), out of scope here.

## Self-Check: PASSED

- Files exist: processCA.js, processCARevenueAcfr.js, processTX.js, processTXRevenueAcfr.js, cleanupStaleStateGFDataSources.mjs — all FOUND.
- All four loaders `--dry-run` exit 0 with every FY PASS; tie-gate negative-tested to exit 2.
- Zero DB writes (loaders use a null client in dry-run; cleanup ran read-only, no `--apply`).
