# 108-02 — Massachusetts ACFR Load Log

**State:** Massachusetts (node `fd6b008f-4d35-4665-8c6a-0429de5a4e1f`) — **IN-PLACE upgrade**, no duplicate node
**Loaders:** `scripts/processMAAcfr.js` (operating), `scripts/processMARevenueAcfr.js` (revenue), shared parser `scripts/maAcfrExtract.mjs`
**Window loaded:** 17 of 25 attempted (FY2007–2025 with 2 interior holes) — **8 honest holes**
**Units:** thousands (UNITS=1000). **Spend:** $0 (free macomptroller.org PDFs, pdftotext -table, no paid AI)

---

## Approach deviation — PARSER (Chris-approved)

Recon (107-BATCH1-SOURCES.md) described MA as "3 columns, simple." **Reality:** MA's Governmental
Funds Statement of Rev/Exp/Changes has a **variable number of fund columns** (FY2025: General |
Lotteries | MSBA | Federal Grants | Other Governmental | Total) and expenditures are
**department/secretariat-level (~25–44 line items/year)**, not ~10 functions. Hand-transcribing
~1,100 expenditure values × 25 years is impractical + error-prone, so — with Chris's approval — MA
uses a **programmatic parser** (`maAcfrExtract.mjs`) that reads the pdftotext `-table` output and
extracts the GENERAL FUND (1st numeric) column. Every FY is gated by an exact GF-column total-tie;
non-tying years are **skipped + logged** (honest hole), never mis-loaded.

Also discovered at load: the `acfr_fy-{YYYY}.pdf` URL pattern resolves **all** of FY2001–FY2025
(FY2017 = `acfr_fy2017.pdf`), not just FY2018+ as recon indicated.

## Load Disposition

| FY | Rev total ($) | Exp total ($) | tie | disposition |
|----|---------------|---------------|-----|-------------|
| 2007 | 26,002,237,000 | 24,149,079,000 | $0 | loaded |
| 2008 | 27,520,209,000 | 25,328,716,000 | $0 | loaded |
| 2009 | 26,494,905,000 | 26,014,881,000 | $0 | loaded |
| 2010 | 27,747,983,000 | 26,287,063,000 | $0 | loaded |
| 2011 | 29,764,415,000 | 27,011,883,000 | $0 | loaded |
| 2012 | 29,431,736,000 | 28,024,676,000 | $0 | loaded |
| 2013 | 30,694,266,000 | 29,147,780,000 | $0 | loaded |
| 2015 | 35,029,512,000 | 34,084,046,000 | $0 | loaded (old-end bookend ✅) |
| 2016 | 36,690,392,000 | 35,530,773,000 | $0 | loaded |
| 2017 | 37,396,174,000 | 36,507,105,000 | $0 | loaded (FY2017 no-hyphen URL) |
| 2018 | 40,468,609,000 | 37,798,290,000 | $0 | loaded |
| 2019 | 42,843,978,000 | 38,853,014,000 | $0 | loaded |
| 2020 | 43,151,305,000 | 41,249,138,000 | $0 | loaded |
| 2022 | 55,383,569,000 | 48,686,379,000 | $0 | loaded |
| 2023 | 56,705,297,000 | 53,773,441,000 | rev $0 / exp +$2K | loaded (GAAP thousands rounding) |
| 2024 | 57,723,619,000 | 52,754,896,000 | rev +$1K / exp +$1K | loaded (GAAP thousands rounding) |
| 2025 | 61,907,573,000 | 58,604,191,000 | $0 | loaded (latest bookend ✅) |

Both recon bookends reproduced exactly: FY2025 rev 61,907,573K ✅, FY2015 35,029,512K ✅.
TOL = 5 thousand absorbs only documented GAAP rounding (line-items-rounded vs total-rounded); the
FY2023/FY2024 $1–$2K diffs are logged, not hidden.

## Honest holes (8) — recoverable in a follow-up deepening pass

| FY | Reason |
|----|--------|
| 2001–2006 | Older MA statement format (combined revenues + other financing; different layout) — generic parser doesn't isolate the GF column. Pre-2007, lower priority. |
| 2014 | `-table` extraction of that year's statement doesn't yield the clean REVENUES/Total-revenues anchors the parser needs (interior hole). |
| 2021 | Same — `-table` column merge on the FY2021 file breaks the anchor detection (interior hole). |

Per D-01 (full window = best-effort attempt) + D-04 (holes allowed + logged). Result is still a deep
**17-year** window (FY2007–2025) covering both bookends + the recency floor (FY2023/FY2024 present).

## In-place upgrade (RECON-07) — confirmed

Pre-load probe: MA state node held ONLY 2 NASBO operating rows (FY2023 $34,287M, FY2024 $35,720M),
NO revenue, NO pre-existing ACFR rows, ZERO `ma-%` data_sources. The v1.8 DLS loaders
(`processMA.js`/`processMARevenue.js`/`scrapeMaDLS.js`) are **city-level** and untouched.
Post-load: exactly **1** MA state node (no duplicate); 17 operating + 17 revenue rows, all
GAAP-labelled + sourced; **0 NASBO labels remain**. Fresh data_sources `ma-acfr-gf-operating`
(dd1bd6d7…), `ma-acfr-gf-revenue` (29d1f884…).

## Accept-and-relabel divergence (ACFR-19)
MA ACFR GF ~**1.73× NASBO** — "Federal grants and reimbursements" (~$16.2B FY2025) inside the GAAP
GF that NASBO's budgetary concept excludes. Relabelled honestly via the GAAP basis label.

## P2 clamp (ACFR-20)
MA embeds investment income in "Miscellaneous" — no standalone negative revenue line; clamp wired as
a safety net, not triggered.

## Idempotency
Re-ran MA --fy 2025 (op + rev) → same totals, no duplicate rows, RPC keyed (muni, fy, dataset_type)
UPDATE-in-place. Idempotent.

## Money In
17 revenue rows → auto-enabled on MA (data-driven, no frontend change).

## Cohort untouched (RECON-08)
Post-load spot-check: NJ 12 rows, CA 36 rows unchanged; Georgia still 2 NASBO (108-04 not yet run);
exactly 1 MA node. MA loaders resolve only `name='Massachusetts'`. RECON-08 holds. Phase 110 runs the
authoritative full audit.

## Deferred
- MA FY2001–2006 + FY2014 + FY2021 (8 honest holes) — recoverable with per-year parser handling in a
  future deepening pass.
