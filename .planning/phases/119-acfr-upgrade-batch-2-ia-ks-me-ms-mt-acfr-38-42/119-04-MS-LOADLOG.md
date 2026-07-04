# 119-04 — Mississippi (ACFR-41) Load Disposition

**State:** Mississippi (MS) — state node `ebec9e07-a79e-44b0-b5d5-2551625d4b8e`
**Phase:** 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42, Plan 04
**Source:** Mississippi Department of Finance and Administration (DFA), Office of Financial
Reporting — Annual Comprehensive Financial Report (ACFR), Governmental Funds Statement of
Revenues, Expenditures, and Changes in Fund Balances, GENERAL column (near-single-fund).
**Units:** Thousands (×1,000 to store dollars). **FY-end:** June 30.

---

## FYs loaded

**FY2003–FY2024 (22 years) — ZERO honest holes.** Every single one of the 22 candidate years
tied exactly ($0 diff) on the FIRST extraction pass, on BOTH the revenue and expenditure sides.
This is the cleanest large-window load encountered so far in the Batch-2 tranche (matching
Maine's zero-hole result from 119-03) — no wrapped labels, no OCR/font defects, no dual-
subsection collisions.

| FY range | Status |
|----------|--------|
| FY2003–FY2024 | LOADED — 22 years, operating + revenue, both tied $0 diff |
| FY2000–FY2002 | NOT PURSUED — recon's confirmed clean window starts at FY2003; the ACFR/CAFR
  folder on dfa.ms.gov/publications does not list FY2000–FY2002 filings at all (only Budget
  Book bb2000/bb2001/bb2002 are present under Supplement to ACFR, a different document).
  Consistent with the 117 recon's own scope (FY2003–FY2024 bookend-tied, not FY2000–FY2002). |
| FY1996–FY1999 | NOT PURSUED — present on the archive page but outside the recon's confirmed
  window; low priority per 117-BATCH2-SOURCES.md Section 6 gap log. |

## FYs skipped (honest holes)

| FY | Reason | Disposition |
|----|--------|--------------|
| **FY2025** | Re-checked `dfa.ms.gov/publications` at load time (2026-07-04). No FY2025 ACFR/CAFR
  filing found — the latest entry in the ACFR accordion is still FY2024's "FY24  ACFR
  Final.pdf" (confirmed by both a targeted `href` grep and a broader FY25/2025 text search
  across the fetched page). Matches the 117 recon's finding exactly (normal MS filing lag).
  | **ABSENT from the DB** — not loaded, not invented. Re-check on a future touch. |

No other FYs within the FY2003–FY2024 window were skipped — all 22 tied on the first pass.

## FY2024 P2-clamp exercise record

Mississippi's FY2024 General Fund revenue statement carries **two simultaneous negative
lines**:

| Category | FY2024 value (thousands) | Note |
|----------|---------------------------|------|
| Investment income | **−434,060** | Material negative — the recon-flagged clamp trigger |
| Rentals | **−338** | Immaterial negative — a second negative line, also clamped |

Both were transcribed **signed** into `ms_all.json` / the generated loader's `REVENUE` data
object. `validate()` ties the signed category sum against the printed total exactly
(`22,709,403` thousand, $0 diff). `buildTree()`'s `clampForRender()` renders BOTH negative
slices at **0** with the signed true magnitude carried in the category label
(`"Investment income (net refund/loss — shown at 0; actual: -434,060,000)"` and the same
pattern for Rentals) — the parent root node (`Mississippi General Fund Revenue`) carries the
printed total `total * UNITS = $22,709,403,000` directly (not a re-sum of the clamped
children), so the visible total still ties to the printed figure exactly.

**Confirmed via dry-run** (`node scripts/processMSRevenueAcfr.js --dry-run --fy 2024`):
```
Investment income (net refund/loss — shown at 0; a                 0
Rentals (net refund/loss — shown at 0; actual -338                 0
[Note: Investment income true value: -434,060,000 (clamped at render)]
[Note: Rentals true value: -338,000 (clamped at render)]
────────────────────────────────────────────────────────────────────────
TOTAL REVENUES                                          22,709,403,000
```
Both negative lines clamp, and the printed total still ties to $22,709,403,000 exactly.

**Confirmed live** (post-load DB query): FY2024 revenue row `total_budget = 22,709,403,000` —
identical to the dry-run figure, GAAP-labelled, source-stamped.

**Additional negative years found at load** (not flagged in the recon's two-bookend sample,
discovered by scanning all 22 years for negative lines before writing, per the plan's
instruction):

| FY | Negative line | Value (thousands) |
|----|-----------------|---------------------|
| FY2022 | Investment income | −267,988 |
| FY2023 | Rentals | −957 |

Both render through the same `clampForRender()` path with no loader changes required — the
P2 clamp mechanism is generic across every negative line in every year, not a one-off FY2024
special case.

## Bookend tie confirmations

| FY | GF Total revenues | Confirmed | Diff |
|----|---------------------|------------|------|
| **FY2024** | $22,709,403,000 | dry-run + live | $0 |
| **FY2003** | $9,707,864,000 | dry-run + live | $0 |

Both also confirmed on the expenditure side: FY2024 TOTAL EXPENDITURES $23,549,305,000; FY2003
TOTAL EXPENDITURES $9,958,757,000 — both $0 diff.

## NASBO-replacement confirmation

Pre-load baseline (live-confirmed, `data_source_id = null`, no revenue rows, no data_sources
rows — a clean node):

| FY | Pre-load NASBO operating total |
|----|-----------------------------------|
| FY2023 | $6,315,000,000 |
| FY2024 | $6,635,000,000 |

Both rows were **replaced in place** (same `treasury_sync_budget_tree` RPC key `(muni, fy,
'operating')` — the same underlying `budgets` row `id` was updated, not duplicated):

| FY | Post-load ACFR operating total | Post-load `data_source` label |
|----|-----------------------------------|-----------------------------------|
| FY2023 | $21,849,049,000 | "Mississippi State ACFR — General Fund (FY2023 actual, GAAP basis)" |
| FY2024 | $23,549,305,000 | "Mississippi State ACFR — General Fund (FY2024 actual, GAAP basis)" |

Post-load DB scan confirms **zero remaining "NASBO" labels** anywhere on the MS node, and
**exactly one operating row per (MS, fy)** across all 22 loaded years — no duplicates.

## Pre-load-NASBO-vs-loaded-ACFR ~3.42× accept-relabel divergence (PROMINENT)

| Basis | FY2024 figure |
|-------|-----------------|
| NASBO GF operating (pre-load, budgetary basis) | $6,635,000,000 |
| ACFR GF (post-load, GAAP basis, revenue side) | $22,709,403,000 |
| **Ratio** | **~3.42×** |

**Driver (accept-and-relabel, TX/AR precedent):** Mississippi's General Fund is effectively
the state's ONLY major governmental fund of consequence — the "Permanent" fund is negligible
(~$3.8M FY2024, confirmed as the small 2nd column in the near-single-fund layout). Federal
government revenue ($10,966,392K FY2024, ~48% of the GF's total revenues) flows **directly**
through the General column, unlike Iowa/Maine/Montana in the same batch where a meaningful
share of federal flows is diverted to a separate special-revenue major-fund column. This is
the **widest scope divergence in Batch 2**, matching the recon's own finding exactly. Recorded
here with prominence, and in the loader's `head_note` (SCOPE NOTE, ACFR-41) and in every
GAAP-basis `data_source` label stamped on the live rows — no downstream consumer can mistake
the $22.7B figure for a narrower NASBO-style budgetary concept.

## Idempotency re-run result

Re-ran the FY2024 clamp year live a **second time** (`node scripts/processMSAcfr.js --fy
2024` then `node scripts/processMSRevenueAcfr.js --fy 2024`, both with live Supabase writes,
not `--dry-run`):

- **0 net change**: post-re-run DB query confirms FY2024 operating total = $23,549,305,000
  (identical to the first live load) and FY2024 revenue total = $22,709,403,000 (identical,
  including the same clamped-negative rendering).
- **0 `data_sources` residue**: a query for `dataset_id IN ('ms-acfr-gf-operating',
  'ms-acfr-gf-revenue')` returns **0 rows** after the re-run — the ephemeral
  create-then-delete lifecycle (LOAD-01) leaves no orphaned row.
- Console printed "Loaded 0 rows" on both the first live load AND the re-run for every FY (an
  artifact of the RPC's `rows_inserted` reporting on upsert paths, not a discriminator between
  first-load and idempotent-rerun) — the DB-state comparison (not the console log) is the
  authoritative idempotency proof, and it confirms 0 net change.

## DB verification summary (all checks PASS)

| Check | Result |
|-------|--------|
| Total MS budgets rows | 44 (22 FY × 2 dataset types) |
| Every loaded FY has both operating + revenue rows | Confirmed, 0 FY with a missing pair |
| NASBO-labelled rows remaining | 0 |
| FY2025 rows in DB | 0 (honest hole, absent as required) |
| Pre-FY2003 rows in DB | 0 |
| Revenue rows (Money In auto-enable) | 22 (≥1 required — confirmed enabled) |
| `data_sources` residue for MS dataset_ids | 0 |
| Rows with null `source_url`/`source_date` | 0 |
| FY2024 revenue total (post idempotent re-run) | $22,709,403,000 (exact) |
| FY2003 revenue total | $9,707,864,000 (exact) |

## Cohort-untouched spot-check

| Node | Check | Result |
|------|-------|--------|
| Alaska (AK, `b268c415…`, 118-01) | FY2025 operating total | $12,373,317,000 — unchanged |
| Maine (ME, `53f26018…`, 119-03) | FY2025 revenue total | $6,194,288,000 — unchanged, matches 119-03-SUMMARY exactly |
| Nebraska (NE, un-upgraded NASBO state, Batch-3 candidate) | budgets rows | 2 rows, both still "NASBO Stat…" labelled, unchanged |

No write touched any state other than Mississippi.

---

**Overall disposition:** Mississippi (ACFR-41) is fully loaded on State-ACFR GAAP (GF
revenue-by-source + GAAP spending-by-function) across FY2003–FY2024 (22 years, zero honest
holes within the window; FY2025 absent by design). NASBO FY2023/FY2024 replaced in place.
FY2024's dual-negative-line P2 clamp exercised and confirmed still ties to the printed total.
Idempotent re-run proven with 0 net change and 0 residue. Money In auto-enabled. The
~3.42× accept-relabel divergence is recorded prominently against the pre-load NASBO baseline.
Ready for Phase 124's independent re-derivation + cohort audit + Chris UAT.
