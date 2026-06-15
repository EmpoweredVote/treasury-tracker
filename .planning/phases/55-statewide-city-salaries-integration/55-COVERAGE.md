# Phase 55 OC Salaries Coverage Report

**Generated:** 2026-06-14  
**Source:** CA State Controller — Government Compensation in California (gcc.sco.ca.gov)  
**Loader:** scripts/sweepOCSalaries.js (Phase 55-03)  
**City set:** 34 OC cities read from treasury.municipalities WHERE county_id = '65e7c643-5829-4821-9537-f8595bce61ab' (Orange County entity, Phase 54)  
**Year range:** 2009–2024 (16 calendar years, full GCC available range per D-04)  
**Strategy:** 16 ZIP downloads total (one per year); all 34 cities processed per download (efficient)

---

## Summary Totals

| Metric | Value |
|--------|-------|
| Total OC cities in DB | 34 |
| Cities covered (salaries loaded) | **34** |
| Cities with gaps (no salaries) | **0** |
| Total salaries DB rows written | **544** (34 cities × 16 years) |
| Total employee-position records processed | **313,085** |
| Year span loaded | 2009–2024 |
| ZIP downloads | 16 (one per year — efficient, not per-city) |

---

## SC-4 Sampled Reconciliation (SAL-03 / D-05.3)

**Sampled city/year:** City of Irvine, Calendar Year 2024

| Metric | Stored in DB | Published on gcc.sco.ca.gov | Delta |
|--------|-------------|----------------------------|-------|
| Total Wages | (component) | $150,535,676 | — |
| Total Benefits | (component) | $39,890,607 | — |
| **Total Compensation** | **$190,426,283** | **$190,426,283** | **$0 (0.00%)** |
| Employee count | 2,193 records | 2,193 | 0 |

**Reconciliation verdict: PASS** — Stored total exactly matches the GCC published figure.  
Published source URL: https://gcc.sco.ca.gov/Reports/Cities/City.aspx?entityid=302&year=2024

---

## Per-City Coverage Table

All 34 OC cities are **COVERED** (no gaps). Every city appears in all 16 GCC annual files.

| City | Status | Years Loaded | Employee Records | 16-Year Total Compensation |
|------|--------|-------------|-----------------|---------------------------|
| Aliso Viejo | COVERED | 2009–2024 (16 yrs) | 608 | $48,903,291 |
| Anaheim | COVERED | 2009–2024 (16 yrs) | 54,945 | $4,796,058,771 |
| Brea | COVERED | 2009–2024 (16 yrs) | 8,413 | $693,639,960 |
| Buena Park | COVERED | 2009–2024 (16 yrs) | 8,177 | $559,162,916 |
| Costa Mesa | COVERED | 2009–2024 (16 yrs) | 12,379 | $1,240,672,043 |
| Cypress | COVERED | 2009–2024 (16 yrs) | 4,151 | $289,604,445 |
| Dana Point | COVERED | 2009–2024 (16 yrs) | 1,663 | $123,517,758 |
| Fountain Valley | COVERED | 2009–2024 (16 yrs) | 4,923 | $494,439,644 |
| Fullerton | COVERED | 2009–2024 (16 yrs) | 13,942 | $1,137,618,718 |
| Garden Grove | COVERED | 2009–2024 (16 yrs) | 13,108 | $1,406,090,512 |
| Huntington Beach | COVERED | 2009–2024 (16 yrs) | 26,465 | $2,283,475,323 |
| Irvine | COVERED | 2009–2024 (16 yrs) | 28,504 | $2,027,280,540 |
| La Habra | COVERED | 2009–2024 (16 yrs) | 8,732 | $484,508,363 |
| La Palma | COVERED | 2009–2024 (16 yrs) | 1,810 | $107,387,881 |
| Laguna Beach | COVERED | 2009–2024 (16 yrs) | 10,149 | $656,390,456 |
| Laguna Hills | COVERED | 2009–2024 (16 yrs) | 1,106 | $69,892,537 |
| Laguna Niguel | COVERED | 2009–2024 (16 yrs) | 2,980 | $130,911,765 |
| Laguna Woods | COVERED | 2009–2024 (16 yrs) | 291 | $14,962,026 |
| Lake Forest | COVERED | 2009–2024 (16 yrs) | 2,963 | $136,269,208 |
| Los Alamitos | COVERED | 2009–2024 (16 yrs) | 2,454 | $111,507,130 |
| Mission Viejo | COVERED | 2009–2024 (16 yrs) | 4,860 | $258,293,083 |
| Newport Beach | COVERED | 2009–2024 (16 yrs) | 20,189 | $1,841,797,142 |
| Orange | COVERED | 2009–2024 (16 yrs) | 14,368 | $1,430,310,971 |
| Placentia | COVERED | 2009–2024 (16 yrs) | 4,351 | $285,319,190 |
| Rancho Santa Margarita | COVERED | 2009–2024 (16 yrs) | 671 | $49,245,302 |
| San Clemente | COVERED | 2009–2024 (16 yrs) | 7,085 | $349,118,306 |
| San Juan Capistrano | COVERED | 2009–2024 (16 yrs) | 1,725 | $169,532,208 |
| Santa Ana | COVERED | 2009–2024 (16 yrs) | 29,328 | $2,827,459,481 |
| Seal Beach | COVERED | 2009–2024 (16 yrs) | 3,744 | $247,465,635 |
| Stanton | COVERED | 2009–2024 (16 yrs) | 1,291 | $63,930,807 |
| Tustin | COVERED | 2009–2024 (16 yrs) | 6,882 | $575,387,174 |
| Villa Park | COVERED | 2009–2024 (16 yrs) | 245 | $10,579,421 |
| Westminster | COVERED | 2009–2024 (16 yrs) | 6,509 | $503,037,672 |
| Yorba Linda | COVERED | 2009–2024 (16 yrs) | 4,074 | $213,927,302 |

---

## Irvine Year-by-Year Detail (Reconciliation Reference City)

| Year | Employee Records | Total Compensation |
|------|-----------------|-------------------|
| 2009 | 1,555 | $88,026,676 |
| 2010 | 1,503 | $84,532,732 |
| 2011 | 1,513 | $100,658,124 |
| 2012 | 1,570 | $104,616,084 |
| 2013 | 1,600 | $106,666,625 |
| 2014 | 1,650 | $112,381,859 |
| 2015 | 1,733 | $116,442,241 |
| 2016 | 1,812 | $127,088,189 |
| 2017 | 1,900 | $136,174,842 |
| 2018 | 1,945 | $129,942,178 |
| 2019 | 1,966 | $134,716,055 |
| 2020 | 1,721 | $132,283,680 |
| 2021 | 1,847 | $139,293,445 |
| 2022 | 1,936 | $146,290,335 |
| 2023 | 2,060 | $177,741,192 |
| 2024 | 2,193 | $190,426,283 |
| **16-yr total** | **28,504** | **$2,027,280,540** |

---

## Additive Write Confirmation (Non-Salaries Rows Untouched)

Anaheim and Santa Ana custom operating/revenue rows verified UNCHANGED after the salaries load:

| City | Dataset | FY | Total (unchanged) |
|------|---------|----|--------------------|
| Anaheim | operating | FY2025 | $490,937,159 |
| Anaheim | revenue | FY2025 | $649,457,438 |
| Anaheim | operating | FY2026 | $530,352,785 |
| Anaheim | revenue | FY2026 | $644,677,022 |
| Santa Ana | operating | FY2023 | $403,596,760 |
| Santa Ana | revenue | FY2023 | $392,884,798 |
| Santa Ana | operating | FY2024 | $414,022,680 |
| Santa Ana | revenue | FY2024 | $400,947,213 |
| Santa Ana | operating | FY2025 | $406,773,060 |
| Santa Ana | revenue | FY2025 | $406,527,340 |
| Santa Ana | operating | FY2026 | $424,230,150 |
| Santa Ana | revenue | FY2026 | $413,790,950 |

Salaries load wrote ONLY dataset_type='salaries'. No operating/revenue rows modified.

---

## Gap Documentation (D-06)

**No gaps.** All 34 OC cities appear in every year's GCC raw export (2009–2024).  
The GCC statewide city dataset includes comprehensive Orange County coverage across the full available range.

No salaries rows were fabricated for any city or year — data is loaded only where the GCC source provides it.

---

## Data Integrity Notes

- **D-01 (no names):** GCC City CSV contains no employee name columns. Position is always the deepest leaf. Confirmed by spike (55-SPIKE-FINDINGS.md §2.5).
- **D-02 (Total Compensation):** Loaded as TotalWages + TotalRetirementAndHealthContribution for each employee row, then summed per position.
- **D-03 (wages/benefits split):** Each position node carries avgBase, avgOvertimeOther, avgBenefits metadata for drill-down.
- **D-04 (full year range):** All 16 available GCC years (2009–2024) loaded per city.
- **D-06 (honest gaps):** No gaps found; gap protocol was ready (skip + document) but not needed.
- **Zero-comp skip:** Records where TotalWages + TotalBenefits = 0 were skipped (unpaid board members, partial-year officials), consistent with D-02 and the LA County loader pattern.

---

## Gap closure — department label readability (2026-06-15)

The live-app verification gate found department segments rendering as the terse codes cities self-report to the State Controller (e.g. Irvine's `Pw Sust`, `Hum Res`, `City Cnl`). Decision (operator-approved): expand only a small, auditable set of **high-confidence, unambiguous** abbreviation tokens and leave genuinely ambiguous codes exactly as-reported — no fabrication (D-01).

- **Expanded (conservative):** `Pw`→Public Works, `Sust`→Sustainability, `Trsp`→Transportation, `Hum`→Human, `Res`→Resources, `Cnl`→Council, `Admin`→Administrative; smart Title Case preserves acronyms and roman numerals.
- **Left as-reported (ambiguous):** e.g. `Com Eng`, `Pd Sustainability`, `Citycnl2`, `Citycnl4`.
- **Implementation:** `normalizeDeptLabel` in `scripts/loadCASalaries.js` (the SAL-02 deliverable), imported by `scripts/sweepOCSalaries.js` — single source of truth. Frontend salaries copy now notes department names are shown as each entity reports them to the State Controller.
- **Re-sweep:** all 34 OC cities × 2009–2024 re-loaded (544 rows, idempotent RPC). Totals unchanged — e.g. Irvine 2024 = $190,426,283, 14 departments (no merging). SC-4 reconciliation still holds ($0 delta).
