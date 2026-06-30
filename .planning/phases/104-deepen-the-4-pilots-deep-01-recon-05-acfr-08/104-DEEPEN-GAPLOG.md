# 104 — Deepening Gap Log

**Phase:** 104-deepen-the-4-pilots (DEEP-01, RECON-05, ACFR-08)
**Created:** 2026-06-30
**Status:** Plan 104-01 complete (NY FY2003-FY2014)

This log records any FY that was skipped during the Phase 104 deepening because it failed to
cleanly `pdftotext -table`-extract, returned a 404/bad HTTP, or did not tie exactly to the
ACFR printed General-column total (D-02 skip+log / D-03 exact-tie-else-skip policy).
Holes are allowed; a skipped FY is simply absent from SOURCES/years and listed here.

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

## CA — TBD (Plan 104-02)

_Not yet started._

---

## FL — TBD (Plan 104-03)

_Not yet started._
