# Phase 104 — Deepening Gap Log

Per-FY disposition log for skipped or non-tying years across the 4-pilot deepening.
Holes in the window are allowed (D-02). Each entry records state, FY, and reason.

---

## CA — FY2008–FY2019 deepening (plan 104-02)

**Disposition summary:** All 12 added years (FY2008–FY2019) successfully downloaded, extracted, and tie exactly. No gaps for CA.

| State | FY | Disposition | Reason |
|-------|----|-------------|--------|
| CA | (none) | — | All FY2008–FY2019 PDFs resolved to real multi-MB PDFs, extracted with `pdftotext -table`, and tied EXACTLY to the printed General-column Total. Zero soft-404s. Zero tie failures. No negative categories in this window. |

### FY-by-FY results

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

### Soft-404 check results

All 12 URLs responded with `Content-Type: application/pdf` and multi-MB payloads. No HTML responses.

---

*Populated by plan 104-02 (wave 1, 2026-06-30). Other pilots (NY, FL) will append sections below.*
