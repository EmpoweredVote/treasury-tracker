# MA-01 — Massachusetts DLS Reconciliation: Evidence of Record

**Status:** Recon complete for expenditures; revenue rule OPEN. No production writes.
**Measured:** 2026-08-18, against the live `treasury.budgets` table (79,939 rows).
**Purpose:** establish what the 16,816 MA rows actually are, so
`FUND_SCOPE_REGISTRY` can classify them with the evidence SCOPE-01 requires.

---

## Bottom line

The framing "one MA ACFR unblocks 16,816 rows" is right in shape but wrong in
mechanism. The MA rows are **four sources, not one**; one of the four is
**mislabelled as a different fund type**; and the DLS figure equals **neither** of
the two totals an ACFR reports. It is a **third basis**, and the relationship is
now pinned to the dollar for expenditures.

`validateRegistry` requires `evidence.document` **and** `evidence.figures`, so a
taxonomy-only citation cannot pass. This document is the figures half.

---

## 1. The 16,816 rows are FOUR sources

| rows | munis | dataset | years | `data_source` label |
|---:|---:|---|---|---|
| 6,843 | 351 | operating | FY2002–2025 | `<Town> — MA General Fund Expenditures` |
| 6,663 | 351 | revenue | FY2002–2020 | `<Town> — MA General Fund Revenues` |
| 1,750 | 350 | revenue | FY2021–2025 | `<Town> — MA DLS General Fund Revenue by Source` |
| 1,560 | 336 | operating | FY2021–2025 | `<Town> — MA DLS Schedule A — Special Revenue Funds` |

6,843 + 6,663 + 1,750 + 1,560 = **16,816**. Every town sampled carries all four,
48 rows, FY2002–2025 — the structure is uniform statewide, so one town's
reconciliation evidences the taxonomy for all 351.

**Not in this bucket:** Cambridge (`cambridge-open-data`, 18 rows FY2021–2026) is
the one MA city loaded from its own portal. It **cannot** evidence DLS.

## 2. ⚠ The `Special Revenue Funds` label on 1,560 rows is WRONG

Those rows take over the operating series at FY2021. If the label were accurate,
the figures would collapse — special revenue funds run a small fraction of a
general fund. Measured across every municipality present in both years:

| | operating | revenue |
|---|---|---|
| municipalities compared | 350 | 350 |
| median FY2020→FY2021 ratio | **1.021** | 1.040 |
| mean | 1.025 | 1.045 |
| within ±25% | 345 / 350 | 346 / 350 |
| **below 0.5** | **0** | **0** |

Continuity at ~1.0 proves these are **General Fund figures carrying a wrong
source label**. The figures are sound; the audit trail is not.

**Why nothing caught it:** every MA row is `fund_scope = unknown`, so a source
change produces no scope seam — `detectSeams` compares scopes, and `unknown` on
both sides is not a change. **The `unknown` bucket hides source changes by
construction.** Worth carrying into any future seam work.

## 3. THE KEY FINDING — MA DLS is a third basis

Natick FY2021 General Fund has three different "General Fund" totals:

| basis | revenues | expenditures |
|---|---:|---:|
| ACFR **GAAP** (governmental funds statement) | $180,554,368 | $182,405,937 |
| ACFR **budgetary** (UMAS, non-GAAP), incl. encumbrances | $154,137,719 | $167,375,942 |
| **our MA DLS row** | **$160,383,112** | **$157,667,368** |

The ACFR's own budgetary-to-GAAP reconciliation note lists the bridging items.
The largest is **MTRS on-behalf payments, $25,099,907** — the Commonwealth pays
teacher pensions on the town's behalf; GAAP records them as both a revenue and an
expenditure, the budgetary basis excludes them. **This is why the evidence town
had to run its own schools:** the schools line is where the bases diverge most,
and a regional-district town would not exercise it.

### The rule, for expenditures

> **MA DLS Schedule A operating = the ACFR's General Fund budgetary-basis (UMAS,
> non-GAAP) ACTUAL total expenditures — the `Actual` column, EXCLUDING
> encumbrances and continuing appropriations.**

Confirmed by reading the labelled statement, not by pattern-matching. FY2024:

```
TOTAL EXPENDITURES..  196,075,913 | 197,642,755 | 185,379,535 | 10,922,891 | 1,340,329
                       Original       Final        ACTUAL       Encumbrances   Variance
```
our DLS FY2024 operating = **185,379,533** → **$2 apart**.

FY2021, same schedule, right-hand block:
```
157,458,088 | 9,917,854 | 167,375,942 | 3,350,322
  ACTUAL      Encumbr.    Actual+Enc.    Variance
```
our DLS FY2021 = 157,667,368 → 0.133%. Note the *note*'s $167,375,942 is the
Actual **+ encumbrances** column; DLS follows `Actual`.

### Verification across Natick's audited years

Method: take our DLS figure, search the ACFR text for the closest number, then
read the surrounding statement. ⚠ Closest-number matching is **suggestive, not
proof** — a large document contains many numbers. Rows marked **✔** are those
where the containing statement and column were confirmed by reading them.

| FY | our DLS operating | ACFR match | diff | confirmed |
|---|---:|---:|---:|---|
| 2006 | 90,943,398 | 91,102,675 | 0.175% | |
| 2007 | 90,481,268 | 90,552,520 | 0.079% | |
| 2008 | 100,614,053 | 100,572,515 | 0.041% | |
| 2009 | 97,976,552 | 97,767,341 | 0.214% | |
| 2010 | 100,269,889 | 100,593,033 | 0.322% | |
| 2011 | 103,346,509 | 103,250,690 | 0.093% | |
| 2012 | 108,794,351 | 108,724,737 | 0.064% | |
| 2013 | 113,746,055 | 113,715,791 | 0.027% | |
| 2014 | 119,454,674 | 119,430,856 | 0.020% | |
| 2015 | 124,222,531 | 124,239,903 | 0.014% | |
| **2016** | 125,986,233 | 125,986,232 | **$1** | **✔** |
| 2017 | 131,971,767 | 131,904,451 | 0.051% | |
| 2018 | — | — | — | scanned PDF, no text layer |
| **2019** | 145,388,452 | 145,377,129 | 0.008% | **✔** |
| 2020 | 154,570,500 | 154,363,020 | 0.134% | |
| **2021** | 157,667,368 | 157,458,088 | 0.133% | **✔** |
| 2022 | 165,972,327 | 166,090,303 | 0.071% | |
| 2023 | 174,709,588 | 174,663,992 | 0.026% | |
| **2024** | 185,379,533 | 185,379,535 | **$2** | **✔** |

**18 of 19 years land within 0.33%; two are exact to the dollar.** FY2018 is a
scanned image with no text layer and was not verified — recorded, not glossed.

## 4. ⚠ OPEN — the revenue rule is NOT pinned

Revenue matches are looser (0.002%–1.73%) and several "best matches" proved to be
coincidences on unrelated lines (`Buildings`, `Net Position - Beginning of Year`,
and in FY2016 the *expenditure* Actual+Encumbrances total). **No revenue tie has
been confirmed by reading its statement.** Natick FY2021: DLS $160,383,112 vs
budgetary actual revenues $154,137,719 — a $6,245,393 gap. Transfers In actual
was $5,816,508, which nearly closes it but not exactly ($428,885 short).

Do not classify the two revenue sources (8,413 rows) until this is pinned the way
expenditures now are.

## 5. The fetch route

The 403 wall is **narrow, not statewide**. With the full browser header set from
`.planning/OREGON-CITIES-RECON.md` (`Sec-Fetch-Mode`, `Sec-Fetch-Dest`,
`Upgrade-Insecure-Requests` are the load-bearing ones):

- **403:** Newton, Arlington, Brockton
- **200:** Cambridge, Worcester, Somerville, Framingham, Lowell, Springfield,
  Lexington, Natick, Winchester, Andover, Marblehead

All 19 Natick PDFs downloaded with that header set. `pdftotext -table` reads the
fund columns; **`-layout` scrambles them** and must not be used here.

Andover's `/224/Financial-Reports` returns **zero document links** to a plain
fetch — the CivicPlus client-side-injection case documented for Beaverton. It
needs the cached Playwright Chromium route
(`--headless=new --dump-dom`, see OREGON-CITIES-RECON §Obstacle 1).

## 6. Next steps

1. **Second-town confirmation** (Lexington / Andover / Winchester) via the
   headless-render route — the expenditure rule is pinned on one town only.
2. **Pin the revenue rule**, or leave the 8,413 revenue rows `unknown` and
   classify only the 8,403 operating rows. Honest partial beats a guess.
3. **Correct the 1,560 mislabelled `Special Revenue Funds` labels.** Production
   write; label only, so `figures_frozen` must NOT move. Needs its own go-ahead
   (SCOPE-02 Ruling 3 pattern).
4. **Registry entries** with `evidence.document` = the Natick ACFR URL + page, and
   `evidence.figures` = the FY2024 `$185,379,535 / $185,379,533` pair.
5. FY2018 could be OCR'd if a 19th year is wanted; not required.

## Appendix — reproduce

- MA source taxonomy: filter `fetchScopeRows()` to `state === 'MA'`, strip the
  `<Town> — ` prefix from `data_source`, group.
- Handover ratio: per municipality, FY2021 ÷ FY2020 by `dataset_type`.
- Natick documents: `https://www.natickma.gov/171/Financial-Statements-Audit-Related-Docum`
  → `/DocumentCenter/View/<id>/Basic-Financial-Statements---FY<year>-Audit-PDF`
  (FY2024 id 21443, FY2021 id 13656, FY2016 id 5113, FY2019 id 10488).
