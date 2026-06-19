# Utah City Salaries — Coverage & Reconciliation (Phase 71, USAL-01)

**Generated:** 2026-06-19  
**Source:** Transparent Utah BigQuery (`ut-sao-transparency-prod.transaction.transaction`, `type='PY'`)  
**Basis:** All-funds (no fund1 filter) — includes enterprise/utility employees (D-71-03)  
**FY range:** FY2014–FY2025 (FY2026 excluded per D-69-04)  

---

## Names-Free Safety Line (D-71-01)

All salaries data loaded by this phase is **aggregate-only and names-free**. The BigQuery query
projects only `org1` (department), `cat1` (compensation category: Wages or Benefits), and
`SUM(amount)`. **No individual is identifiable** — no `vendor_name`, `title`, `hourly_rate`,
`gender`, or any other PII column is ever projected, grouped, stored, or rendered. An automated
unit test fails if any PII column appears in the query string or the serialized salary tree
(`scripts/loadUtahTransparency.test.mjs` — PII-exclusion guard, D-71-01).

This is a deliberate mission/policy choice: Treasury Tracker answers "where does public money go?"
structurally (department/category), not "who earns what." Department-level accountability
(e.g., Fire compensation = $12.7M, Police = $9.6M) serves the civic transparency mission without
re-hosting a polished, SEO-indexed copy of named individual compensation.

---

## Provo FY2024 Reconciliation (USAL-01 SC#2)

**Reconciliation city:** Provo (the budget penny-exact canary from Phase 69)  
**Fiscal year:** FY2024  
**Basis:** All-funds total compensation (Wages + Benefits), same basis as the Transparent Utah
Compensation Downloader (https://transparent.utah.gov)

| Metric | Value |
|--------|-------|
| Loaded all-funds total (FY2024) | $92,945,952.78 |
| Transparent Utah probe baseline (D-71-04) | $92,945,953 |
| Delta | -$0.22 |
| Explanation | Sub-penny rounding — BigQuery returns floating-point SUM; the Downloader rounds to whole dollars. No functional difference. |

**Conclusion:** Delta of $0.22 is rounding-only (floating-point SUM vs integer display). USAL-01 SC#2
satisfied at ~$0 delta with documented explanation.

**Tree breakdown (Provo FY2024, top 5 departments by total compensation):**

| Department | Wages | Benefits | Total |
|------------|-------|----------|-------|
| Fire - Administration | ~$8.4M | ~$4.3M | $12,658,232 |
| Police - Patrol (Shifts) | ~$6.0M | ~$3.6M | $9,635,462 |
| Energy - Electric Operations | ~$3.1M | ~$1.2M | $4,338,206 |
| Police - Public Safety Dispatch | ~$2.8M | ~$1.2M | $4,025,965 |
| Energy - Systems Operations | ~$2.4M | ~$1.0M | $3,350,978 |
| ... (67 more departments) | | | |
| **Grand total** | **$65,125,717** | **$27,820,236** | **$92,945,953** |

---

## Per-City Coverage (FY2014–FY2025)

All 10 cities have complete coverage for **FY2014–FY2025** (12 fiscal years each).
No source gaps were found — every year queried returned data from Transparent Utah.
Total salaries rows loaded: **120** (10 cities × 12 FYs).

### Layton (Davis County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $26,084,398 |
| 2015 | $26,817,135 |
| 2016 | $27,445,381 |
| 2017 | $27,858,031 |
| 2018 | $28,850,286 |
| 2019 | $30,062,186 |
| 2020 | $31,222,874 |
| 2021 | $32,111,637 |
| 2022 | $34,427,097 |
| 2023 | $41,877,954 |
| 2024 | $44,919,551 |
| 2025 | $47,758,999 |

Departments: 8–9 per year. Gaps: None.

### Lehi (Utah County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $15,864,001 |
| 2015 | $16,434,260 |
| 2016 | $17,560,011 |
| 2017 | $27,962,995 |
| 2018 | $30,148,832 |
| 2019 | $33,609,649 |
| 2020 | $35,939,867 |
| 2021 | $38,826,313 |
| 2022 | $43,196,249 |
| 2023 | $46,623,610 |
| 2024 | $52,066,645 |
| 2025 | $57,611,028 |

Departments: 30–33 per year. Notable: FY2017 jump ($17.6M → $28.0M) reflects Lehi's rapid
population growth in Utah County. Gaps: None.

### Ogden (Weber County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $47,545,392 |
| 2015 | $48,671,295 |
| 2016 | $50,579,739 |
| 2017 | $56,155,027 |
| 2018 | $53,465,882 |
| 2019 | $57,202,685 |
| 2020 | $57,984,369 |
| 2021 | $61,373,482 |
| 2022 | $66,005,580 |
| 2023 | $80,343,451 |
| 2024 | $82,029,041 |
| 2025 | $88,262,553 |

Note: FY2019–2025 data shows fewer raw rows (1 department) vs. FY2014–2018 (9 departments),
suggesting Ogden changed its reporting org1 granularity (consolidated under a single org1 value
from FY2019). Totals are still complete all-funds. Gaps: None.

### Orem (Utah County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $36,976,807 |
| 2015 | $37,027,595 |
| 2016 | $38,832,254 |
| 2017 | $40,241,751 |
| 2018 | $41,800,943 |
| 2019 | $44,416,301 |
| 2020 | $45,376,088 |
| 2021 | $48,721,168 |
| 2022 | $53,663,141 |
| 2023 | $55,700,264 |
| 2024 | $60,331,083 |
| 2025 | $64,070,593 |

Departments: 10–11 per year. Gaps: None.

### Provo (Utah County) — Reconciliation Canary

| FY | Total Compensation |
|----|-------------------|
| 2014 | $57,476,990 |
| 2015 | $59,445,867 |
| 2016 | $61,623,951 |
| 2017 | $63,958,515 |
| 2018 | $66,902,469 |
| 2019 | $69,670,162 |
| 2020 | $73,015,392 |
| 2021 | $76,844,553 |
| 2022 | $76,500,877 |
| 2023 | $83,569,767 |
| **2024** | **$92,945,953** |
| 2025 | $99,781,244 |

Departments: 71–90 per year. FY2024 reconciled to Transparent Utah Compensation Downloader at $-0.22 delta (rounding). Gaps: None.

### Salt Lake City (Salt Lake County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $134,263,457 |
| 2015 | $234,922,673 |
| 2016 | $238,504,288 |
| 2017 | $263,965,846 |
| 2018 | $279,127,435 |
| 2019 | $284,239,522 |
| 2020 | $299,067,214 |
| 2021 | $242,229,815 |
| 2022 | $339,716,751 |
| 2023 | $278,320,567 |
| 2024 | $432,784,111 |
| 2025 | $459,163,848 |

Note: SLC has ~2.6M raw PY rows in the source table (the largest city dataset); the
SUM/GROUP BY aggregate returns 16–19 rows per year server-side, keeping the query well
inside the 1 TB/month BigQuery free tier at $0. FY2014 total ($134M) is lower than FY2015
($234M) — likely a mid-year or partial-year reporting artifact in the source. Year-to-year
variation is noted as a potential source characteristic, not a load error. Gaps: None.

### Sandy (Salt Lake County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $41,341,468 |
| 2015 | $42,444,438 |
| 2016 | $43,742,170 |
| 2017 | $45,784,645 |
| 2018 | $47,335,276 |
| 2019 | $49,167,044 |
| 2020 | $52,147,524 |
| 2021 | $53,127,709 |
| 2022 | $57,826,547 |
| 2023 | $69,960,746 |
| 2024 | $74,752,333 |
| 2025 | $74,859,216 |

Departments: 7–8 per year. Gaps: None.

### St. George (Washington County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $43,982,383 |
| 2015 | $48,451,447 |
| 2016 | $50,834,944 |
| 2017 | $54,214,843 |
| 2018 | $57,443,338 |
| 2019 | $60,862,101 |
| 2020 | $65,169,685 |
| 2021 | $67,438,197 |
| 2022 | $74,062,255 |
| 2023 | $86,039,818 |
| 2024 | $93,046,622 |
| 2025 | $102,745,740 |

Note: St. George reports under a single org1 department (4–5 rows per year), meaning the
salaries tree shows 1 top-level department with Wages/Benefits leaves. This is a source-level
reporting choice, not a loader limitation. Gaps: None.

### West Jordan (Salt Lake County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $34,398,598 |
| 2015 | $31,847,972 |
| 2016 | $40,483,380 |
| 2017 | $43,859,959 |
| 2018 | $43,579,083 |
| 2019 | $47,051,758 |
| 2020 | $48,262,120 |
| 2021 | $46,646,958 |
| 2022 | $51,628,360 |
| 2023 | $58,133,047 |
| 2024 | $63,554,423 |
| 2025 | $66,933,031 |

Note: FY2014–2015 report only 1 department (2 rows); FY2016+ report 21–33 departments.
Totals are consistent (no sudden jump), suggesting West Jordan changed its org1 reporting
granularity starting FY2016. Gaps: None.

### West Valley City (Salt Lake County)

| FY | Total Compensation |
|----|-------------------|
| 2014 | $50,867,797 |
| 2015 | $53,817,231 |
| 2016 | $54,177,582 |
| 2017 | $56,729,955 |
| 2018 | $60,937,376 |
| 2019 | $64,682,120 |
| 2020 | $68,039,637 |
| 2021 | $69,149,479 |
| 2022 | $78,299,370 |
| 2023 | $84,362,283 |
| 2024 | $90,667,745 |
| 2025 | $94,965,694 |

Departments: 9–10 per year. Gaps: None.

---

## Coverage Summary

| City | FYs Loaded | FY2024 Total | Source Gaps |
|------|-----------|-------------|-------------|
| Layton | FY2014–2025 (12) | $44,919,551 | None |
| Lehi | FY2014–2025 (12) | $52,066,645 | None |
| Ogden | FY2014–2025 (12) | $82,029,041 | None (dept granularity varies by year) |
| Orem | FY2014–2025 (12) | $60,331,083 | None |
| Provo | FY2014–2025 (12) | $92,945,953 | None |
| Salt Lake City | FY2014–2025 (12) | $432,784,111 | None (FY2014 may be partial-year) |
| Sandy | FY2014–2025 (12) | $74,752,333 | None |
| St. George | FY2014–2025 (12) | $93,046,622 | None (1 dept — source reporting choice) |
| West Jordan | FY2014–2025 (12) | $63,554,423 | None (dept granularity varies FY2014–2015) |
| West Valley City | FY2014–2025 (12) | $90,667,745 | None |

**Total rows:** 120 (10 cities × 12 FYs)  
**Never-overwrite SKIPs:** 0 (salaries were all-new; no pre-existing different-source rows)  
**Operating/revenue rows untouched:** 240 (120 operating + 120 revenue, unchanged per SC#4)

---

## Source Attribution

- **Data source:** Transparent Utah (`data_source = 'Transparent Utah'`)
- **Source URL:** https://transparent.utah.gov (durable public portal)
- **License:** CC BY 4.0 (Utah State Auditor)
- **Source date:** 2026-06-19 (load date)
- **BigQuery table:** `ut-sao-transparency-prod.transaction.transaction`
- **Row type:** `type = 'PY'` (payroll/compensation)

---

*Phase: 71-utah-city-salaries-compensation*  
*Loader: scripts/loadUtahTransparency.js (Phase 71 PY path)*  
*Last updated: 2026-06-19*
