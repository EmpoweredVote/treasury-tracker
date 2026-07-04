# 118-05 ID — Idaho ACFR Load Log (ACFR-37)

**Status:** COMPLETE — ID live on full State-ACFR GAAP, FY2004–FY2025 (22 years), $0 spend.
**Node:** Idaho `247ca2d0-44bc-4ef0-bc0d-4875758bae5e` · **Units:** thousands stored (FY2004 normalized from whole dollars) · **FY-end:** June 30.

## Load Disposition
- **Window loaded:** FY2004–FY2025 (22 contiguous years), operating + revenue = **44 rows**, every FY tie-verified ($0, FY2004 within tolerance-10 after normalization).
- **Bookends:** FY2025 GF Total revenues **$6,658,024K** ✅ (recon match); FY2004 **$2,314,491,978 whole dollars** → normalized to $2,314,492K (≈$2,314,492,000 stored, ~$22 rounding vs recon, within tolerance).
- **GENERAL column** = 1st of 3-4 (General | Health and Welfare | Transportation | [Public School Endowment]).

### MIXED UNITS — the ID trap, resolved
- FY2004 statement is in **whole dollars**; FY2005–FY2025 are in **thousands**. The transition is **FY2004→FY2005 only** (a single boundary, not a range).
- **Per-year units override implemented at the JSON-assembly layer:** `build_state.py units_by_year={2004:1}` divides FY2004 by 1000 so all 22 years are uniform thousands, and the generated loader keeps a single `UNITS=1000`. (Cleaner than a per-year multiplier in every loader; the reusable override lives in the assembler.)
- **Magnitude continuity confirmed:** FY2004 $2.31B → FY2005 $2.53B — no 1000× discontinuity across the transition.

### 3-way filename naming (all durable at www.sco.idaho.gov/CAFRDocuments/, %20 spaces)
- FY2024–2025: `{YYYY} Annual Comprehensive Financial Report.pdf`
- FY2021–2023: `{YYYY} Annual Comprehensive Financial Review.pdf` ("Review")
- FY2004–2020: `{YYYY} Comprehensive Annual Financial Report.pdf`

- **NASBO replaced in place:** FY2023 → ACFR operating $4,947,639K; FY2024 NASBO $5,020,000K → ACFR operating $5,132,563K. 0 NASBO labels remain; one operating row per (ID, fy).
- **Scope (ACFR-37):** ~**1.33×** NASBO (Health and Welfare / Medicaid federal match reported separately). Accept-relabel honest; GAAP basis on every row.
- **P2 clamp:** "Investment Income (Loss)" positive at both bookends; clamp wired for any negative interior year.
- **Idempotency:** FY2025 re-run → ID still 44 rows, no net change. **0 `data_sources` residue** (LOAD-01). **Money In** auto-enabled (22 rev rows).

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue | GF Spending (operating) |
|-------------|-----------|--------------------------|
| FY2004 | $2,314,492,000 | $1,670,288,000 |
| FY2005 | $2,534,075,000 | $1,739,575,000 |
| FY2006 | $2,719,702,000 | $1,841,927,000 |
| FY2007 | $3,134,419,000 | $2,198,918,000 |
| FY2008 | $3,151,399,000 | $2,341,608,000 |
| FY2009 | $2,678,305,000 | $2,437,982,000 |
| FY2010 | $2,511,307,000 | $2,120,536,000 |
| FY2011 | $2,677,830,000 | $2,149,928,000 |
| FY2012 | $2,818,616,000 | $2,094,986,000 |
| FY2013 | $3,088,773,000 | $2,218,220,000 |
| FY2014 | $3,110,675,000 | $2,321,300,000 |
| FY2015 | $3,363,385,000 | $2,433,752,000 |
| FY2016 | $3,479,632,000 | $2,575,745,000 |
| FY2017 | $3,721,225,000 | $2,782,390,000 |
| FY2018 | $4,122,658,000 | $2,999,015,000 |
| FY2019 | $4,175,241,000 | $3,177,232,000 |
| FY2020 | $4,508,489,000 | $3,401,163,000 |
| FY2021 | $5,657,401,000 | $3,517,193,000 |
| FY2022 | $6,682,274,000 | $4,162,154,000 |
| FY2023 | $6,513,059,000 | $4,947,639,000 |
| FY2024 | $7,130,418,000 | $5,132,563,000 |
| FY2025 | $6,658,024,000 | $5,196,087,000 |

Loaders: `scripts/processIDAcfr.js` + `scripts/processIDRevenueAcfr.js` (gen_state.py `CONFIGS['ID']`).
