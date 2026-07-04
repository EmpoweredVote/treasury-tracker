# 118-03 DE — Delaware ACFR Load Log (ACFR-35)

**Status:** COMPLETE — DE live on full State-ACFR GAAP, FY2004 + FY2006–FY2025 (21 years), $0 spend.
**Node:** Delaware `a7854fa3-8e68-4a0e-b92a-415bad6bccd2` · **Units:** thousands (UNITS=1000) · **FY-end:** June 30.

## Load Disposition
- **Window loaded:** FY2004 + FY2006–FY2025 (21 years), operating + revenue = **42 rows**, every FY tie-verified at $0 diff.
- **Bookends:** FY2025 GF Total revenues **$7,475,243K** ✅; FY2004 **$3,055,310K** ✅ (recon match).
- **GENERAL column** = 1st of 5 (General | Federal | Local School Districts | Capital Projects | Total).
- **Referer WAF handled:** all PDFs fetched with `Referer: https://accounting.delaware.gov/...`; %PDF-magic + size guards would reject the 245-byte "Request Rejected" soft-404. No soft-404 slipped through (every downloaded file was a real PDF and tied).
- **Hole:** FY2005 (HTTP 404 — not published). Naming: `{YYYY}acfr.pdf` FY2021–2025, `{YYYY}cafr.pdf` FY2004–2020.
- **NASBO replaced in place:** FY2023 → ACFR operating $6,593,342K; FY2024 NASBO $6,232,000K → ACFR operating $7,272,339K. 0 NASBO labels remain; one operating row per (DE, fy).
- **Scope (ACFR-35):** ~**1.20×** NASBO — smallest in the batch (Federal grants in DE's own major-fund column). Accept-relabel honest; GAAP basis on every row.
- **P2 clamp:** Interest/Investment Income positive both bookends; clamp wired as safety net.
- **Idempotency:** FY2025 re-run → DE still 42 rows, no net change. **0 `data_sources` residue** (LOAD-01). **Money In** auto-enabled (21 rev rows).

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue | GF Spending (operating) |
|-------------|-----------|--------------------------|
| FY2004 | $3,055,310,000 | $3,051,408,000 |
| FY2006 | $3,552,457,000 | $3,739,864,000 |
| FY2007 | $3,680,628,000 | $3,985,529,000 |
| FY2008 | $3,513,679,000 | $4,035,516,000 |
| FY2009 | $3,381,380,000 | $3,936,401,000 |
| FY2010 | $3,457,800,000 | $3,744,652,000 |
| FY2011 | $3,735,337,000 | $3,963,426,000 |
| FY2012 | $3,834,771,000 | $4,258,070,000 |
| FY2013 | $4,093,235,000 | $4,354,137,000 |
| FY2014 | $3,994,433,000 | $4,580,601,000 |
| FY2015 | $4,343,966,000 | $4,688,506,000 |
| FY2016 | $4,367,923,000 | $5,050,104,000 |
| FY2017 | $4,557,880,000 | $5,253,057,000 |
| FY2018 | $4,873,533,000 | $4,765,371,000 |
| FY2019 | $5,115,632,000 | $5,157,148,000 |
| FY2020 | $5,109,350,000 | $5,022,388,000 |
| FY2021 | $6,074,174,000 | $5,976,943,000 |
| FY2022 | $6,630,050,000 | $5,812,310,000 |
| FY2023 | $7,014,739,000 | $6,593,342,000 |
| FY2024 | $7,145,545,000 | $7,272,339,000 |
| FY2025 | $7,475,243,000 | $7,971,129,000 |

Loaders: `scripts/processDEAcfr.js` + `scripts/processDERevenueAcfr.js` (gen_state.py `CONFIGS['DE']`).
