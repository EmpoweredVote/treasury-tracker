# 105-PA-IL-LOADLOG.md — PA + IL Live Load Disposition

**Generated:** 2026-06-30 (Wave 2, Plan 105-03)
**Loaders:** processPAAcfr.js, processPARevenueAcfr.js, processILAcfr.js, processILRevenueAcfr.js
**DB:** treasury.budgets (live writes via treasury_sync_budget_tree RPC)

---

## Load Disposition

### Pennsylvania (PA) State Node

**Municipality ID:** `d4a4aadc-f91e-45e4-852f-2cf21e177de5`

#### Pre-Load NASBO Baseline

PA had 2 NASBO operating rows prior to Wave 1's accidental early load (105-01 deviation):
- FY2023: ~$40,800,000,000 (NASBO State Expenditure Report — General Fund)
- FY2024: ~$44,864,000,000 (NASBO State Expenditure Report — General Fund)

These were replaced in place by the Wave 1 accidental `processPAAcfr.js` run (105-01 SUMMARY, deviation noted).

#### PA Operating Rows Loaded (processPAAcfr.js)

All 10 FY loaded in Wave 1 (accidental early load, confirmed idempotent in Wave 2):

| FY | Total Expenditures ($) | Status |
|----|------------------------|--------|
| 2016 | 56,135,869,000 | LOADED (Wave 1, re-run idempotent in Wave 2) |
| 2017 | 61,606,897,000 | LOADED |
| 2018 | 61,607,586,000 | LOADED |
| 2019 | 65,677,284,000 | LOADED |
| 2020 | 71,839,247,000 | LOADED |
| 2021 | 76,524,883,000 | LOADED |
| 2022 | 87,003,182,000 | LOADED |
| 2023 | 89,473,087,000 | LOADED (NASBO FY2023 replaced in place) |
| 2024 | 89,446,895,000 | LOADED (NASBO FY2024 replaced in place) |
| 2025 | 94,758,255,000 | LOADED |

**No honest holes.** All 10 FY tie to $0 diff vs printed ACFR General Fund total (validated at extraction in 105-01).

**NASBO-replacement confirmed:** Both FY2023 and FY2024 NASBO operating rows were replaced in place. DB check confirms zero NASBO labels on PA node. Exactly 1 operating row per (PA, FY), all labelled `"Pennsylvania State ACFR — General Fund (FY{fy} actual, GAAP basis)"`.

#### PA Revenue Rows Loaded (processPARevenueAcfr.js) — Wave 2

All 10 FY loaded in Wave 2 (2026-06-30), net-new (NASBO had no revenue rows):

| FY | Total Revenues ($) | Status |
|----|--------------------|--------|
| 2016 | 56,741,506,000 | LOADED |
| 2017 | 60,738,926,000 | LOADED |
| 2018 | 61,695,790,000 | LOADED |
| 2019 | 65,803,730,000 | LOADED |
| 2020 | 70,717,513,000 | LOADED |
| 2021 | 81,825,525,000 | LOADED |
| 2022 | 98,210,961,000 | LOADED |
| 2023 | 95,231,042,000 | LOADED (bookend confirmed) |
| 2024 | 91,293,027,000 | LOADED (bookend confirmed) |
| 2025 | 92,414,817,000 | LOADED |

**Bookend verification:**
- FY2024: 91,293,027,000 — CONFIRMED (matches 103-PA-IL-SOURCES.md)
- FY2023: 95,231,042,000 — CONFIRMED (matches 103-PA-IL-SOURCES.md)

**Negative categories:** None found in PA FY2016-FY2025 revenue (all investment income positive). P2 clamp path wired but no fire required.

#### PA Accept-and-Relabel Divergence (D-04)

| FY | NASBO GF Operating | PA ACFR GF Operating | Ratio | ACFR GF Revenue |
|----|-------------------|----------------------|-------|-----------------|
| 2023 | ~$40,800,000,000 | $89,473,087,000 | ~2.19× | $95,231,042,000 |
| 2024 | ~$44,864,000,000 | $89,446,895,000 | ~1.99× | $91,293,027,000 |

**Mechanism (D-04):** PA ACFR GAAP General Fund is ~2.0× the NASBO budgetary GF because
federal/intergovernmental (~$42.3B) sits inside the GAAP General Fund. NASBO's budgetary
concept reports these separately (outside the GF). This is the same TX-trap mechanism.
Accept-and-relabel honestly via the GAAP basis label on every row.

---

### Illinois (IL) State Node

**Municipality ID:** `ac8b3dee-b431-48d0-9f59-deea46c85948`

#### Pre-Load NASBO Baseline

IL had 2 NASBO operating rows before Wave 2:
- FY2023: $43,693,000,000 (NASBO State Expenditure Report — General Fund (FY2023 actual, budgetary basis))
- FY2024: $48,563,000,000 (NASBO State Expenditure Report — General Fund (FY2024 actual, budgetary basis))

#### IL Operating Rows Loaded (processILAcfr.js) — Wave 2

| FY | Total Expenditures ($) | Status |
|----|------------------------|--------|
| 2021 | 59,523,406,000 | LOADED (net-new) |
| 2022 | 62,089,769,000 | LOADED (net-new) |
| 2023 | 68,661,594,000 | LOADED (NASBO FY2023 replaced in place) |
| 2024 | 71,610,582,000 | LOADED (NASBO FY2024 replaced in place) |
| 2025 | 75,456,922,000 | LOADED (net-new) |

**No honest holes.** All 5 FY tie at $0 diff vs printed ACFR GF total (validated in 105-02).

**NASBO-replacement confirmed:** Both FY2023 and FY2024 NASBO operating rows were replaced in place. DB check confirms zero NASBO labels on IL node. Exactly 1 operating row per (IL, FY), all labelled `"Illinois State ACFR — General Fund (FY{fy} actual, GAAP basis)"`.

#### IL Revenue Rows Loaded (processILRevenueAcfr.js) — Wave 2

| FY | Total Revenues ($) | Status | Notes |
|----|--------------------|--------|-------|
| 2021 | 63,136,008,000 | LOADED (net-new) | |
| 2022 | 73,204,339,000 | LOADED (net-new) | P2 clamp fired (see below) |
| 2023 | 73,827,795,000 | LOADED (net-new, bookend confirmed) | |
| 2024 | 74,749,262,000 | LOADED (net-new) | |
| 2025 | 78,342,927,000 | LOADED (net-new, bookend confirmed) | |

**Bookend verification:**
- FY2025: 78,342,927,000 — CONFIRMED (matches 103-PA-IL-SOURCES.md)
- FY2023: 73,827,795,000 — CONFIRMED (matches 103-PA-IL-SOURCES.md)

#### IL FY2022 P2 Clamp Confirmation (ACFR-08)

FY2022 "Interest and other investment income" = -197,857 thousands (−$197,857,000).

**In the live DB (budget_categories):**
- Category name: `"Interest and other investment income (net loss — shown at 0)"`
- Stored `amount`: 0 (rendered area clamped to 0)
- Root total (Illinois General Fund Revenue): 73,204,339,000 (carries the signed net — the printed total already nets the negative)

**P2 clamp confirmed live in treasury.budget_categories.**

#### IL Accept-and-Relabel Divergence (D-04)

| FY | NASBO GF Operating | IL ACFR GF Operating | Ratio | ACFR GF Revenue |
|----|-------------------|----------------------|-------|-----------------|
| 2023 | $43,693,000,000 | $68,661,594,000 | ~1.57× | $73,827,795,000 |
| 2024 | $48,563,000,000 | $71,610,582,000 | ~1.48× | $74,749,262,000 |

**Mechanism (D-04):** IL ACFR GAAP General Fund is ~1.5× the NASBO budgetary GF because the
GAAP GF consolidates federal intergovernmental revenue (~$22.1B in FY2025 per the "Federal
government" line item). Accept-and-relabel honestly via the GAAP basis label + visible
"Federal government" line in the icicle.

---

## Idempotency Re-Run Results (Task 3)

Second live run of representative FYs — all confirmed 0 net change:

| Loader | FY | Re-run Result |
|--------|-----|--------------|
| processPAAcfr.js | 2024 | "Loaded 0 rows" — 0 net change (idempotent) |
| processPARevenueAcfr.js | 2024 | "Loaded 0 rows" — 0 net change (idempotent) |
| processILAcfr.js | 2025 | "Loaded 0 rows" — 0 net change (idempotent) |
| processILRevenueAcfr.js | 2025 | "Loaded 0 rows" — 0 net change (idempotent) |

**Never-overwrite confirmed.** treasury_sync_budget_tree RPC keyed (muni, fy, dataset_type) — re-running with identical data replaces categories in place, total_budget unchanged, source stamp unchanged.

---

## DB Verification Results (Task 3)

### PA Final State

| Check | Result |
|-------|--------|
| Operating rows | 10/10 (FY2016-FY2025) |
| Revenue rows | 10/10 (FY2016-FY2025) |
| NASBO labels remaining | 0 |
| FY2024 revenue total | 91,293,027,000 (PASS) |
| FY2023 revenue total | 95,231,042,000 (PASS) |
| All rows source_url SET | CONFIRMED |
| Exactly 1 operating row per FY | CONFIRMED |

### IL Final State

| Check | Result |
|-------|--------|
| Operating rows | 5/5 (FY2021-FY2025) |
| Revenue rows | 5/5 (FY2021-FY2025) |
| NASBO labels remaining | 0 |
| FY2025 revenue total | 78,342,927,000 (PASS) |
| FY2023 revenue total | 73,827,795,000 (PASS) |
| FY2022 P2 clamp in budget_categories | CONFIRMED (amount=0, label includes "net loss") |
| All rows source_url SET | CONFIRMED |
| Exactly 1 operating row per FY | CONFIRMED |
| FYs outside 2021-2025 window | 0 (no out-of-window rows) |

### Money In Auto-Enable

| State | Revenue rows | Auto-enabled |
|-------|-------------|--------------|
| PA | 10 | YES |
| IL | 5 | YES |

### Cohort-Untouched Verification

| State | Check | Result |
|-------|-------|--------|
| CA (ACFR FY2020-25) | Operating rows | 18 — UNCHANGED |
| CA | Revenue rows | 18 — UNCHANGED |
| CA | FY2024 data_source | "California State ACFR — General Fund (FY2024 actual, GAAP ba" — UNCHANGED |
| TX (ACFR FY2015-24) | Operating rows | 10 — UNCHANGED |
| TX | Revenue rows | 10 — UNCHANGED |
| TX | FY2024 data_source | "Texas State ACFR — General Revenue Fund (FY2024 actual, GAAP" — UNCHANGED |
| NY (ACFR FY2015-24) | Total rows | 44 — UNCHANGED |
| NY | FY2024 revenue data_source | "New York State ACFR — General Fund Revenue (FY2024 actual, G" — UNCHANGED |
| FL (ACFR FY2022-24) | Total rows | 8 — UNCHANGED |
| FL | FY2024 operating data_source | "Florida State ACFR — General Fund (FY2024 actual, GAAP basis" — UNCHANGED |
| GA (NASBO - un-upgraded) | Total rows | 2 — UNCHANGED |
| GA | NASBO labels | 2 — NASBO intact, untouched |
| GA | FY2024 data_source | "NASBO State Expenditure Report — General Fund (FY2024 actual" — UNCHANGED |
| OH (prior ACFR state) | State-node rows | 12 — UNCHANGED |
| OH | FY2024 data_source | "State of Ohio ACFR — General Fund (FY2024 actual, GAAP basis" — UNCHANGED |

**T-105-03-B confirmed:** No accidental writes to any state other than PA + IL.

---

## Honest Holes

**PA:** None. All 10 FY (2016-2025) transcribed and loaded.
**IL:** None. All 5 FY (2021-2025) transcribed and loaded.

FYs outside the tied windows are absent from the DB (confirmed above).
