# 104 — Deepening Gap Log

**Phase:** 104-deepen-the-4-pilots (DEEP-01, RECON-05, ACFR-08)
**Created:** 2026-06-30
**Status:** Wave 1 complete (NY FY2003-FY2014, CA FY2008-FY2019, FL FY2021) — dry-run verified

This log records any FY that was skipped during the Phase 104 deepening because it failed to
cleanly `pdftotext -table`-extract, returned a 404/bad HTTP, or did not tie exactly to the
ACFR printed General-column total (D-02 skip+log / D-03 exact-tie-else-skip policy).
Holes are allowed; a skipped FY is simply absent from SOURCES/years and listed here.

**Wave 1 headline: 0 gaps across all three states — every added FY tied exactly (25/25 added FYs retained).**

---

## NY (New York) — FY2003-FY2014 deepening (Plan 104-01)

| FY | URL | HTTP | Tie check | Disposition |
|----|-----|------|-----------|-------------|
| FY2003 | `comprehensive-annual-financial-report-2003.pdf` | 200 (2.1 MB) | PASS — Revenue 29,250M = $29,250,000,000 (bookend ✓); Expenditures 40,910M = $40,910,000,000 | LOADED |
| FY2004 | `comprehensive-annual-financial-report-2004.pdf` | 200 (2.7 MB) | PASS — Revenue 32,489M; Expenditures 43,386M | LOADED |
| FY2005 | `comprehensive-annual-financial-report-2005.pdf` | 200 (3.0 MB) | PASS — Revenue 35,929M; Expenditures 45,104M | LOADED |
| FY2006 | `comprehensive-annual-financial-report-2006.pdf` | 200 (1.1 MB) | PASS — Revenue 41,091M; Expenditures 48,321M | LOADED |
| FY2007 | `comprehensive-annual-financial-report-2007.pdf` | 200 (3.4 MB) | PASS — Revenue 44,259M; Expenditures 51,936M | LOADED |
| FY2008 | `comprehensive-annual-financial-report-2008.pdf` | 200 (2.9 MB) | PASS — Revenue 45,423M; Expenditures 54,540M | LOADED |
| FY2009 | `comprehensive-annual-financial-report-2009.pdf` | 200 (1.6 MB) | PASS — Revenue 40,228M; Expenditures 56,630M | LOADED |
| FY2010 | `comprehensive-annual-financial-report-2010.pdf` | 200 (2.2 MB) | PASS — Revenue 44,883M; Expenditures 54,129M | LOADED |
| FY2011 | `comprehensive-annual-financial-report-2011.pdf` | 200 (2.3 MB) | PASS — Revenue 47,069M; Expenditures 55,090M | LOADED |
| FY2012 | `comprehensive-annual-financial-report-2012.pdf` | 200 (3.2 MB) | PASS — Revenue 48,344M; Expenditures 57,911M | LOADED |
| FY2013 | `comprehensive-annual-financial-report-2013.pdf` | 200 (2.8 MB) | PASS — Revenue 50,798M; Expenditures 59,796M | LOADED |
| FY2014 | `comprehensive-annual-financial-report-2014.pdf` | 200 (4.0 MB) | PASS — Revenue 48,459M; Expenditures 59,782M | LOADED |

**Result: 0 gaps — all 12 added NY years retained (FY2003-FY2014 all PASS exact tie).**

All PDFs resolved via `https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-{YYYY}.pdf` (fy<=2021 branch in nyUrl(), unchanged). Extraction: `pdftotext -table`, GENERAL column (first numeric column). Units = millions (UNITS=1_000_000). No negative GF revenue or expenditure categories found in any FY2003-FY2014 year.

### Structural note: category names changed between FY2012 and FY2013

FY2003-FY2012 use the older ACFR expenditure category format:
- Local assistance grants: Social services / Education / Mental hygiene / General purpose / Health and environment / Transportation / Criminal justice / Miscellaneous
- Departmental operations: Personal service / Non-personal service / Pension contribution(s) / Other fringe benefits

FY2013-FY2014 and FY2015+ use the newer format:
- Local assistance: Education / Public health / Public welfare / Public safety / Transportation / Environment and recreation / Support and regulate business / General government
- State operations: Personal service / Non-personal service / Pension contributions / Other fringe benefits

All category names in the loaders are verbatim from the ACFR printed statement.

---

## CA (California) — FY2008-FY2019 deepening (Plan 104-02)

**Disposition summary:** All 12 added years (FY2008–FY2019) successfully downloaded, extracted, and tie exactly. No gaps for CA. Zero soft-404s.

| FY | PDF size | Rev total ($K) | Exp total ($K) | Rev tie | Exp tie | Notes |
|----|----------|----------------|----------------|---------|---------|-------|
| 2008 | 2,838,074 B | 97,774,378 | 98,975,042 | PASS | PASS | Recon bookend anchor — ties exactly |
| 2009 | 1,054,100 B | 84,202,979 | 92,605,222 | PASS | PASS | |
| 2010 | 1,134,257 B | 85,129,367 | 87,247,026 | PASS | PASS | |
| 2011 | 1,180,372 B | 93,479,815 | 90,431,674 | PASS | PASS | |
| 2012 | 6,178,966 B | 86,536,015 | 88,281,652 | PASS | PASS | Motor vehicle excise taxes line added (=0) |
| 2013 | 3,446,583 B | 99,379,153 | 90,114,980 | PASS | PASS | |
| 2014 | 3,254,174 B | 104,182,125 | 95,337,085 | PASS | PASS | |
| 2015 | 3,069,920 B | 116,777,374 | 107,163,567 | PASS | PASS | |
| 2016 | 2,733,925 B | 117,573,422 | 111,804,448 | PASS | PASS | Category names change to FY2020+ schema; Motor vehicle excise taxes = 113,000K |
| 2017 | 7,809,518 B | 125,121,644 | 116,260,039 | PASS | PASS | Managed care organization enrollment tax added (=0) |
| 2018 | 7,823,847 B | 135,625,020 | 124,239,316 | PASS | PASS | |
| 2019 | 5,384,062 B | 140,503,627 | 129,113,153 | PASS | PASS | |

**Result: 0 gaps — all 12 added CA years retained.** All 12 URLs responded with `Content-Type: application/pdf` and multi-MB payloads (no HTML/soft-404). Resolved via `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf` (distinct from the existing `/Files-ARD/ACFR/` FY2020+ entries). Units = thousands. No negative categories in this window. FY2002-FY2007 not pursued (deferred per D-01).

---

## FL (Florida) — FY2021 deepening (Plan 104-03)

**Disposition summary:** FY2021 successfully downloaded, extracted, and ties exactly. No gap.

| FY | Rev total | Exp total | Rev tie | Exp tie | Notes |
|----|-----------|-----------|---------|---------|-------|
| 2021 | $46,989,188,000 | $37,277,963,000 | PASS | PASS | Recon bookend ✓. Negative "Investment earnings (losses)" −$398,287K → P2 clamp fires (rendered 0, "(net loss — shown at 0)", root total preserves net) — ACFR-08 |

**Result: 0 gaps — FY2021 retained.** Resolved via the existing `fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf` pattern. Units = thousands. FY≤2020 not durably sourceable at this path (deferred).

---

*Wave 1 (dry-run) complete 2026-06-30. Wave 2 (104-04) live loads complete 2026-06-30.*

---

## Load Disposition — Wave 2 Live Loads (Plan 104-04, 2026-06-30)

### NY — FY2003-FY2014

| FY | Operating loaded | Revenue loaded | Skipped | Notes |
|----|-----------------|----------------|---------|-------|
| FY2003 | YES — $40,910,000,000 | YES — $29,250,000,000 | — | data_source: "New York State ACFR — General Fund (FY2003 actual, GAAP basis)" |
| FY2004 | YES — $43,386,000,000 | YES — $32,489,000,000 | — | |
| FY2005 | YES — $45,104,000,000 | YES — $35,929,000,000 | — | |
| FY2006 | YES — $48,321,000,000 | YES — $41,091,000,000 | — | |
| FY2007 | YES — $51,936,000,000 | YES — $44,259,000,000 | — | |
| FY2008 | YES — $54,540,000,000 | YES — $45,423,000,000 | — | |
| FY2009 | YES — $56,630,000,000 | YES — $40,228,000,000 | — | |
| FY2010 | YES — $54,129,000,000 | YES — $44,883,000,000 | — | |
| FY2011 | YES — $55,090,000,000 | YES — $47,069,000,000 | — | |
| FY2012 | YES — $57,911,000,000 | YES — $48,344,000,000 | — | |
| FY2013 | YES — $59,796,000,000 | YES — $50,798,000,000 | — | Newer category names (FY2013+ format) |
| FY2014 | YES — $59,782,000,000 | YES — $48,459,000,000 | — | Newer category names (FY2013+ format) |

**0 FYs skipped. 24 rows live (12 FYs × 2 dataset_types). validate() PASS on every run.**

**Idempotency re-run (NY --fy 2003, second run):** Loader output "Loaded 0 rows" — RPC found no net change. Source stamp re-applied with identical values. PASS.

### CA — FY2008-FY2019

| FY | Operating loaded | Revenue loaded | Skipped | Notes |
|----|-----------------|----------------|---------|-------|
| FY2008 | YES — $98,975,042,000 | YES — $97,774,378,000 | — | data_source: "California State ACFR — General Fund (FY2008 actual, GAAP basis)" |
| FY2009 | YES — $92,605,222,000 | YES — $84,202,979,000 | — | |
| FY2010 | YES — $87,247,026,000 | YES — $85,129,367,000 | — | |
| FY2011 | YES — $90,431,674,000 | YES — $93,479,815,000 | — | |
| FY2012 | YES — $88,281,652,000 | YES — $86,536,015,000 | — | |
| FY2013 | YES — $90,114,980,000 | YES — $99,379,153,000 | — | |
| FY2014 | YES — $95,337,085,000 | YES — $104,182,125,000 | — | |
| FY2015 | YES — $107,163,567,000 | YES — $116,777,374,000 | — | |
| FY2016 | YES — $111,804,448,000 | YES — $117,573,422,000 | — | Category names shift to FY2020+ schema |
| FY2017 | YES — $116,260,039,000 | YES — $125,121,644,000 | — | |
| FY2018 | YES — $124,239,316,000 | YES — $135,625,020,000 | — | |
| FY2019 | YES — $129,113,153,000 | YES — $140,503,627,000 | — | |

**0 FYs skipped. 24 rows live (12 FYs × 2 dataset_types). validate() PASS on every run.**

**Idempotency re-run (CA --fy 2008, second run):** Loader output "Loaded 0 rows" — RPC found no net change. Source stamp re-applied with identical values. PASS.

### FL — FY2021

| FY | Operating loaded | Revenue loaded | Skipped | Notes |
|----|-----------------|----------------|---------|-------|
| FY2021 | YES — $37,277,963,000 | YES — $46,989,188,000 | — | P2 clamp fires on "Investment earnings (losses)" −$398,287K → rendered 0 with "(net loss — shown at 0)" label; root total $46,989,188,000 preserves the net (ACFR-08 confirmed) |

**0 FYs skipped. 2 rows live (1 FY × 2 dataset_types). validate() PASS.**

**Idempotency re-run (FL --fy 2021, second run):** Loader output "Loaded 0 rows" — RPC found no net change. P2 clamp re-applied with identical values. PASS.

### Summary

| State | Added FYs loaded | Skipped | Idempotency | Existing pilot rows |
|-------|-----------------|---------|-------------|---------------------|
| NY | 12 (FY2003-FY2014), 24 DB rows | 0 | PASS (FY2003 second run → 0 net change) | FY2015-FY2024 unchanged |
| CA | 12 (FY2008-FY2019), 24 DB rows | 0 | PASS (FY2008 second run → 0 net change) | FY2020-FY2025 unchanged |
| FL | 1 (FY2021), 2 DB rows | 0 | PASS (FY2021 second run → 0 net change) | FY2022-FY2024 unchanged |

**Total: 25 added FYs live, 50 new DB rows, 0 gaps, 0 skipped. All GAAP-basis labelled. All source_url non-null.**

**Other states (spot-checked):** TX — ACFR rows FY2015-FY2024 untouched. PA — 2 NASBO rows (FY2023-24) untouched. IL — 2 NASBO rows (FY2023-24) untouched. MN — ACFR rows untouched.

**DB query (2026-06-30):** 24 NY added rows + 24 CA added rows + 2 FL added rows = 50 rows all present with GAAP-basis data_source labels and non-null source_url/source_date. Zero null source_urls on any added row confirmed by explicit null-check query.
