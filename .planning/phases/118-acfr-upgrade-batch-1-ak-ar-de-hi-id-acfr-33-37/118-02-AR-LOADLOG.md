# 118-02 AR — Arkansas ACFR Load Log (ACFR-34)

**Status:** COMPLETE — AR live on full State-ACFR GAAP, FY2003–FY2024 (22 contiguous years), $0 spend.
**Node:** Arkansas `5efd2f95-6deb-4118-a07a-9f48cdca681c` · **Units:** thousands (UNITS=1000) · **FY-end:** June 30.

## Load Disposition
- **Window loaded:** FY2003–FY2024 (22 contiguous years), operating + revenue = **44 rows**, every FY tie-verified at $0 diff.
- **Bookends:** FY2024 GF Total revenues **$24,045,611K** ✅; FY2003 **$9,434,421K** ✅ (both recon match).
- **SINGLE-fund state:** the whole "Statement of Revenues, Expenditures, and Changes in Fund Balance / Governmental Fund" (singular) IS the General Fund; GF is the sole column.
- **FY2025 honest hole:** `2025-Arkansas-ACFR.pdf` is Type-3-font garbled (no ToUnicode CMap) — NOT loaded (KY FY2023 precedent). Window ends FY2024 (satisfies recency floor).
- **NASBO replaced in place:** FY2023 $6,xxx NASBO → ACFR operating $22,856,229K; FY2024 NASBO $6,075,000K → ACFR operating $22,159,960K. 0 NASBO labels remain; one operating row per (AR, fy).
- **Scope (ACFR-34):** ~**3.96×** NASBO — the WIDEST divergence in the entire cohort (single reported GF folds in ~$11.2B intergovernmental/federal). Accept-and-relabel honest, prominent basis note in the loader header. GAAP basis label on every row.
- **P2 clamp:** Investment earnings positive at both bookends; clamp wired as safety net.
- **Idempotency:** FY2024 re-run → AR still 44 rows, no net change. **0 `data_sources` residue** (LOAD-01). **Money In** auto-enabled (22 rev rows).

### Tooling generalizations added this load (reusable, in gitignored _acfr-work/)
- `extract_gf.py` now detects **singular** "governmental fund" (single-fund states) and **space-tolerant section headers** (AR letter-spaces "Re ve nue s :" in ~10 years). Both backward-compatible — AK re-verified unaffected.

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue | GF Spending (operating) |
|-------------|-----------|--------------------------|
| FY2003 | $9,434,421,000 | $9,017,879,000 |
| FY2004 | $10,327,672,000 | $9,376,679,000 |
| FY2005 | $11,285,100,000 | $10,348,606,000 |
| FY2006 | $11,907,985,000 | $10,870,071,000 |
| FY2007 | $12,318,533,000 | $11,135,487,000 |
| FY2008 | $12,680,212,000 | $11,740,656,000 |
| FY2009 | $13,097,507,000 | $12,159,384,000 |
| FY2010 | $14,025,583,000 | $13,213,284,000 |
| FY2011 | $14,699,674,000 | $14,034,917,000 |
| FY2012 | $14,719,520,000 | $14,146,911,000 |
| FY2013 | $14,715,155,000 | $14,154,278,000 |
| FY2014 | $15,530,914,000 | $14,958,973,000 |
| FY2015 | $16,893,127,000 | $16,182,838,000 |
| FY2016 | $17,333,233,000 | $16,398,766,000 |
| FY2017 | $17,915,395,000 | $17,290,490,000 |
| FY2018 | $17,966,567,000 | $17,175,826,000 |
| FY2019 | $18,527,679,000 | $17,238,444,000 |
| FY2020 | $19,761,471,000 | $18,083,907,000 |
| FY2021 | $22,391,839,000 | $20,557,148,000 |
| FY2022 | $24,464,227,000 | $22,390,660,000 |
| FY2023 | $25,280,362,000 | $22,856,229,000 |
| FY2024 | $24,045,611,000 | $22,159,960,000 |

Loaders: `scripts/processARAcfr.js` + `scripts/processARRevenueAcfr.js` (gen_state.py `CONFIGS['AR']`, `rev_boundary='Intergovernmental'`).
