# 118-04 HI — Hawaii ACFR Load Log (ACFR-36)

**Status:** COMPLETE — HI live on full State-ACFR GAAP (GF-alone), FY2005–FY2025 (21 years), $0 spend.
**Node:** Hawaii `bf5b7221-9c8e-4df7-961d-e9c020ca733e` · **Units:** thousands (UNITS=1000) · **FY-end:** June 30.

## Load Disposition
- **Window loaded:** FY2005–FY2025 (21 contiguous years), operating + revenue = **42 rows**, every FY tie-verified at $0 diff.
- **Bookends:** FY2025 GF Total revenues **$10,607,306K** ✅; FY2005 **$4,198,123K** ✅ (recon match).
- **GENERAL FUND column** = always the 1st column; total column count grows 4 (FY2005) → 8 (FY2025) as special-revenue funds are broken out. Position-anchor handled it without per-year config.
- **GF-ALONE DECISION (ACFR-36, UT precedent):** loaded the printed GENERAL FUND column ALONE, NOT a GF+Med-Quest composite. Med-Quest (Medicaid, $2.45B FY2025) is a separate major-fund column, so HI GAAP GF is ~**0.95× NASBO (NARROWER)**. Honest narrower label, node not carved to match NASBO. **FLAGGED FOR CHRIS UAT at Phase 124.**
- **Enumerated URLs:** WordPress upload-date folders (non-derivable), read off the archive page + pinned per year (durable, no Wayback).
- **Hole:** FY2000–FY2004 — scanned image-only PDFs (zero embedded fonts, no text layer). Not loadable via pdftotext. Window starts FY2005.
- **NASBO replaced in place:** FY2023 → ACFR operating $7,695,802K; FY2024 NASBO $11,222,000K → ACFR operating $9,285,436K. 0 NASBO labels remain; one operating row per (HI, fy).
- **P2 clamp:** Net increase in fair value of investments positive at both bookends; clamp wired.
- **Idempotency:** FY2025 re-run → HI still 42 rows, no net change. **0 `data_sources` residue** (LOAD-01). **Money In** auto-enabled (21 rev rows).

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue | GF Spending (operating) |
|-------------|-----------|--------------------------|
| FY2005 | $4,198,123,000 | $3,653,792,000 |
| FY2006 | $4,641,395,000 | $3,985,907,000 |
| FY2007 | $4,853,012,000 | $4,458,995,000 |
| FY2008 | $4,845,895,000 | $4,785,562,000 |
| FY2009 | $4,376,108,000 | $4,949,414,000 |
| FY2010 | $4,436,799,000 | $4,225,892,000 |
| FY2011 | $4,928,104,000 | $4,154,924,000 |
| FY2012 | $5,303,611,000 | $4,624,748,000 |
| FY2013 | $5,784,004,000 | $4,640,278,000 |
| FY2014 | $5,619,145,000 | $5,047,585,000 |
| FY2015 | $6,000,204,000 | $5,266,450,000 |
| FY2016 | $6,401,885,000 | $5,601,616,000 |
| FY2017 | $6,652,418,000 | $6,027,463,000 |
| FY2018 | $7,067,502,000 | $6,576,615,000 |
| FY2019 | $7,487,440,000 | $6,540,669,000 |
| FY2020 | $7,300,610,000 | $6,889,438,000 |
| FY2021 | $7,366,965,000 | $7,178,404,000 |
| FY2022 | $9,009,521,000 | $6,579,047,000 |
| FY2023 | $10,701,443,000 | $7,695,802,000 |
| FY2024 | $10,053,608,000 | $9,285,436,000 |
| FY2025 | $10,607,306,000 | $8,728,004,000 |

Loaders: `scripts/processHIAcfr.js` + `scripts/processHIRevenueAcfr.js` (gen_state.py `CONFIGS['HI']`).
