# CO-SPRINGS-EPC-01 — City of Colorado Springs + El Paso County onboarding (CLOSEOUT)

**Date:** 2026-08-21
**Branch:** `feat/colorado-springs-el-paso-onboarding`
**Status:** SHIPPED to the database — 64 rows, live on the production API.

Colorado's first LOCAL entities. Before this, the state had only its state node
(3 fiscal years from the state-ACFR arc).

---

## 1. What landed

| Entity | Type | FY window | Years | Rows | Units |
|---|---|---|---|---|---|
| Colorado Springs, CO | `city` (county_id → El Paso County) | FY2012–FY2025 | 14 | 28 | whole dollars |
| El Paso County, CO | `county` | FY2005 + FY2009–FY2025 | 18 | 36 | whole dollars |

Both entities: `operating` (GF expenditure-by-function) + `revenue` (GF
revenue-by-source), General Fund only, ACFR **GAAP actuals**, read from the
General Fund column of each year's governmental-funds *Statement of Revenues,
Expenditures and Changes in Fund Balances*.

Population (Census PEP Vintage 2024, same program `loadTXPopulation.js` uses):
Colorado Springs **493,554**, El Paso County **752,772**. The city's whole-place
(SUMLEV 162) and county-part (SUMLEV 157) figures are BOTH 493,554, so unlike
Austin the `county_id` link is an identity rather than a predominance claim.

`fiscal_year_start_month = 1` and `source_date = <FY>-12-31` on every row — both
entities run the **calendar year**, which is what made the shared loader's
Texas-only hardcoding a problem (§4.1).

All 64 rows are `general_fund / actual / primary_government` via the new
evidenced `co-local-acfr-gf` registry entries (§6).

---

## 2. Source discovery — two hosts, two different traps

**Colorado Springs publishes 27 reports (FY1999–FY2025) and NONE of the
published links is a file.** Every href on the ACFR index page ends in `.pdf`
and returns HTTP 200 with `Content-Type: text/html` — a ~27KB pdf.js viewer
shell. A naive `curl -o x.pdf` writes an HTML page named `.pdf`, 27 times. This
is the Austin/Widen trap from AUSTIN-TRAVIS-01 in a different CMS.

The real bytes are named by a `data-src` attribute inside the shell, and the
paths are **not derivable** — the 27 files sit under five Drupal conventions:

```
FY1999-2014  /system/files/finance/Accounting/cafrs/2010cafr.pdf
                                              ...2005_cafr.pdf   (underscore)
                                              ...2007-cafr.pdf   (hyphen)
                                              ...cafr2009final.pdf (reordered)
FY2015-2017  /system/files/2016_cafr_final.pdf
FY2018-2020  /system/files/inline-images/2019_co_springs_cafr_final.pdf
FY2021       /system/files/2021_acfr_co_springs.pdf
FY2022-2025  /system/files/2025-07/2024%20CO%20Springs%20ACFR_Final.pdf
```

That last convention embeds the **upload month**, which no rule can predict.
So the only hardcoded fact is the viewer slug published on the index page, and
the asset URL is RESOLVED at fetch time out of the shell.

**El Paso County publishes 26 reports (FY2000–FY2025)** as real PDFs, but the
current index page lists only four years and the filenames drift three ways: the
GFOA "Comprehensive Annual" → "Annual Comprehensive" rename at FY2021; a `-1`
suffix on **exactly FY2011 and FY2019** and nothing else (both 404 without it —
they were initially recorded as "not published" until a variant probe found
them); and FY2023–FY2025 moving out of the `/ACFR/` subdirectory.

Both corpora are downloaded by `scripts/fetchColorado.mjs` into gitignored
`docs/ColoradoSprings/` and `docs/ElPasoCounty/`, each with a `manifest.json`
recording the URL that actually served each file plus its sha256. All 53 files
passed all four guards (`%PDF` magic bytes, minimum size, minimum page count,
fiscal-year assertion).

---

## 3. Excluded years — 21 of 53, every one diagnosed

### Colorado Springs FY1999–FY2011 (13 years) — image-only scans

`pdftotext` returns **zero characters** for FY1999–FY2008 across the entire
document, 9,213 for FY2009 and 4,683 for FY2010 (on 243- and 251-page reports).
FY2011 has a partial text layer (185,590 chars) but no page that qualifies as
the governmental-funds statement — its financial-statement pages are among the
scanned ones.

There is no text layer to parse. This is an upstream publishing fact, not an
extraction failure, and no config value reaches it. Recovering the era needs
OCR, which is a decision about putting a transcription step into a provenance
chain that is currently byte-exact — deliberately not attempted here.

### El Paso County FY2000–FY2004 (5 years) — image-only scans

Same: `pdftotext` returns zero characters for all five.

### El Paso County FY2006–FY2008 (3 years) — a different statement

These years title it **"Statement of Revenues and Changes in Fund Balances"** —
no "Expenditures" — and split the fund columns **horizontally across two pages**
(General / Road and Bridge / Human Services on one, Capital Projects / Other /
Total on the next). The page also letter-spaces its own column headers
("S e r v ic e s"). Both the page-qualifying rule and the single-page column
model are wrong for that era; it is a separate build, not a config change.
FY2005 is a third shape again, and it reads cleanly.

---

## 4. Six real defects found and fixed

Every one produced *plausible* output. Four of them tied at exactly $0 while
being wrong.

### 4.1 The shared loader hardcoded Texas's fiscal calendar

`scripts/lib/txAcfrLoad.mjs` (renamed to `acfrGfLoad.mjs`) hardcoded
`source_date: ${fy}-09-30` and `fiscal_year_start_month: 10`. Reused as-is, it
would have stamped a **September period end and an October start month onto
Colorado rows that close December 31** — no dollar figure would change, so
nothing downstream would have noticed. That is the defect class
`fixAcfrFiscalYearStartMonth.mjs` had to sweep 1,719 rows to undo.

Fixed by making `state`, `fyEndMonthDay` and `fiscalYearStartMonth` **required**
config fields asserted by `assertConfig`, never defaulted, with a cross-check
that the two calendar facts agree (a year ending in month 12 must start in month
1). Both Texas drivers now state their values explicitly. Covered by 5 tests.

### 4.2 Colorado Springs' statement title is unmatchable

The city prints its own name down the RIGHT MARGIN of the statement heading, and
`pdftotext -table` interleaves it into the title:

```
GOVERNMENTAL FUNDS                              CITY OF COLORADO SPRINGS
STATEMENT OF REVENUES, EXPENDITURES                             COLORADO
AND CHANGES IN FUND BALANCES                                   Exhibit 4
```

So "EXPENDITURES" and "AND CHANGES" are separated by the word COLORADO, not by
whitespace, and the shared `_TITLE` regex fails on **all 27 years** — reported as
"primary GF statement not found". Fixed with a `statement_anchor` (the documented
wrap case, same mechanism Seattle's FY2009 era needs). Anchored on the wrapped
TITLE, deliberately not on "Exhibit 4": an exhibit number can be renumbered
between years.

**This is not a scope loophole.** Verified page-by-page on FY2012 and FY2024:
exactly one page survives per year, and every other page the anchor reaches is
still rejected by `_EXCLUDE` — the five combining special-revenue statements by
`'combining'`, and **Exhibit 6** by `'budget and actual'`.

### 4.3 Colorado Springs prints a budgetary-basis decoy

Exhibit 6 is titled "GENERAL FUND / STATEMENT OF REVENUES, EXPENDITURES AND
CHANGES IN FUND BALANCE / **BUDGET AND ACTUAL**", runs four pages, and mentions
the General Fund. Loading it would have put **budget-basis figures under a
GAAP-actual label** with no arithmetic symptom at all. It is structurally
unreachable (§4.2), and Exhibit 4 precedes it in every year so the
earliest-qualifying rule reaches the right one first.

### 4.4 El Paso defeats BOTH acfrGF column strategies

Neither `-table` strategy reads this corpus, each for a mechanically identified
reason, and both were confirmed by arithmetic that lands on the dollar:

* **positional** — `-table` renders the General Fund column at **two character
  offsets**; rows whose later cells are dashes sit ~20 characters right and get
  filed under Road and Bridge. FY2020's four dropped rows sum to
  `748,294 + 1,937,380 + 2,527,617 + 2,548,205 = 7,761,496`, which **is** the
  reported tie delta. (Austin FY2002–FY2009 fails identically.)
* **ordinal** — the county prints its **TABOR refund inside the revenue label**
  ("Sales taxes net of $4,477,783 TABOR limitation"), and that embedded figure
  IS the first column slot. FY2024's delta is exactly
  `122,194,544 − 4,477,783 = 117,716,761`. Where the label WRAPS (FY2016,
  FY2022) the positional reader counts the same figure as an extra revenue
  component and its delta equals the TABOR figure to the dollar (+15,174,442
  and +31,551,234).

**Selecting per-year whichever strategy happened to tie $0 would have been
curve-fitting** — the error that got the LA-01 scope verdict retracted. Instead
a coordinate reader was built (§5) and used throughout, and the `-table` readers
were kept as the cross-check.

Worth recording: **wherever a strategy ties $0, it also agrees with the
coordinate reader component-for-component.** The tie gate produced no false
positives on this corpus — which is why the two signals can be trusted together
in §7.

### 4.5 Wrapped TABOR labels published as fragments (tied at $0)

The coordinate reader's first version read each clustered row independently, so
on the years where the TABOR label wraps, the money landed on the SECOND line and
the published category was literally named **`limitation)`** (FY2016),
**`limitation`** (FY2022) and **`$15,174,442`** (FY2017) — while the amounts were
correct and the tie stayed at exactly $0. The Kent wrapped-label defect class: a
tie proves arithmetic, never labels.

Fixed with an **opt-in** weld (`weld='disclosure'`; the default welds nothing and
reports a dangling fragment as an error). Two coordinate guards separate a wrap
from a group heading and from a genuinely-empty line item — and the second guard
exists because the first was not enough:

* **GUARD 1 — the prefix must not occupy the column grid.** A real line item with
  an empty General Fund cell still prints cells in the OTHER funds. Without this,
  `Highway user taxes` and `Public works` were welded forward, publishing
  **`Highway user taxes Intergovernmental`** and **`Public works Health and
  welfare`** — two complete labels fused into one, tying $0.
* **GUARD 2 — the wrap must carry an embedded disclosure figure.** `Outside
  agencies` is a real line item blank in EVERY column, so guard 1 cannot see it;
  it was welded onto `Auxiliary services`. Every genuine multi-line label in this
  corpus is a TABOR disclosure and carries a printed figure.

A group heading is never welded because it sits **shallower** than its children
by a measured 5.0pt (`Current:` at x0=69.8, children at 74.8).

### 4.6 A fixed label boundary truncated the issuer's own labels

The label/column cut started as a fixed 95pt guess, which **silently dropped the
trailing words of long labels**: "Sales taxes net of $4,477,783 TABOR limitation"
published as "Sales taxes net of $4,477,783". Amount right, tie $0, label
misquoting the county. Fixed by DERIVING the boundary — the smallest x0 of any
cell actually found on the column edge (`column_left`). A lone `$` glyph, which
falls on the label side, is stripped so labels read "Property taxes" and not
"Property taxes $".

Also normalized: a **trailing colon** (`Current:` → `Current`), punctuation only,
because the county prints it inconsistently across years and `acfrGF` already
ignores it.

---

## 5. New tool: `scripts/acfrGfComponents.py`

A coordinate oracle that reads **every** General Fund component row, not just the
printed total. This closes the follow-up AUSTIN-TRAVIS-01 left open:

> "acfrPrintedTotal.py already reads these pages correctly, so the remaining work
> is extracting COMPONENTS, not just totals."

It shares no code or strategy with `scripts/lib/acfrGF.py` — it never sees the
`-table` character grid, so the grid's artifacts cannot reach it.

**How the General Fund column is identified** — not by "the leftmost number on
the row", which is sound only for a TOTAL row and precisely wrong for component
rows. The column is located by its EDGE, derived from the two printed total rows
**independently of each other**: if both share a right edge it is right-aligned,
else if both share a left edge it is left-aligned, else the page is REFUSED
rather than guessed. Alignment genuinely varies in this corpus (Seattle
left-aligns money, King County right-aligns), so it is derived per document.
The test is evidence rather than a fit because it comes from two different rows
that must agree, and is taken BEFORE any component is read.

`scripts/extractElPasoCountyCoords.py` wraps it to emit acfrGF's JSON contract,
and reads the **expenditure nesting off the printed indentation** — so it needs
no hand-declared `parents` / `root_leaves` at all. The document states its own
hierarchy; that matters because a tie proves arithmetic and never structure.

---

## 6. Classification — evidence of record

All 64 rows: `general_fund / actual / primary_government`, via three new
`co-local-acfr-gf` registry entries anchored to the two entity names (the general
`/ ACFR — General Fund/` pattern would wrongly claim ~1,850 unreconciled rows).
Note "El Paso County" is **also a Texas county**; the pattern matches the
data_source string this loader writes, and no Texas El Paso rows exist.

Both gates green: `classifyFundScope.mjs` and `stampBudgetAxes.mjs` each report
`co-local-acfr-gf` claiming exactly **64 rows / 64 strings**, with the partition
gate passing and **no pre-existing count moved**.

**Fund scope — five probes, read by `acfrPrintedTotal.py`** (printed TOTAL cell
only, from glyph coordinates, sharing no code with either loader). In every probe
the stored figure is column 0 and **all fund columns sum exactly** to the Total
Governmental column:

| Probe | GF revenue | GF expenditure | % of Total Governmental |
|---|---|---|---|
| Springs FY2024 | 371,035,085 | 422,363,896 | 60.5% / 63.8% |
| Springs FY2016 | 233,693,029 | 246,212,379 | 60.2% / 61.5% |
| El Paso FY2024 | 308,220,434 | 289,511,043 | 64.4% / 63.0% |
| El Paso FY2020 | 358,327,750 | 322,185,041 | 74.0% / 65.3% |
| El Paso FY2012 | 118,451,903 | 123,652,632 | 49.9% / 49.8% |

Every figure matches the stored row EXACTLY. `total_governmental` is rejected by
35–50 percentage points — El Paso's early years are the clearest discriminator,
where the General Fund is barely half. `all_funds` is further still: **Colorado
Springs Utilities, a ~$1B enterprise operation in the same ACFR, is entirely
outside the governmental-funds statement**, so an all_funds reading of this city
would be off by a multiple rather than a margin.

**Basis — actual**, not appropriation: §4.3 is the reason to say so explicitly.

**Reporting entity — primary_government.** El Paso states it outright: "Each
discretely presented component unit ... is reported in a single column in the
government-wide financial statements" (its one discrete unit is El Paso County
Public Health). Colorado Springs states the counterpart and presents its units in
their own combining exhibits. On the BLENDED units, neither is the General Fund:
Colorado Springs blends exactly two (General Improvement Districts → special
revenue and debt service funds; Public Authority for Colorado Energy →
proprietary), and El Paso blends exactly two (the Retirement Plan, a
cost-sharing DB plan and therefore **fiduciary**, excluded from the
governmental-funds statement altogether; and the Facilities Corporation, a
lease-financing nonprofit). Arithmetic corroboration: the fund columns sum
exactly to Total Governmental in all five probes, so no component-unit column is
inside the General Fund figure.

---

## 7. Verification

`node scripts/verify-colorado.mjs` → **64 rows checked, ALL CHECKS PASSED**,
**58 corroborated by a second implementation**.

The two entities are cross-checked in **opposite directions**, because they were
loaded by different readers:

| | loaded by | checked by |
|---|---|---|
| Colorado Springs | `extractColoradoSprings.py` → `acfrGF.py` (`-table` grid) | `acfrGfComponents.py` (glyph coordinates) |
| El Paso County | `extractElPasoCountyCoords.py` (glyph coordinates) | `extractElPasoCounty.py` + `…Ordinal.py` (`-table`, both strategies) + `acfrPrintedTotal.py` on every row |

Nine checks: (1) stored total == independently-read printed total, exactly;
(2) component multiset agreement; (3) row inventory exact; (4) provenance present
and `source_date == <FY>-12-31`; (5) `fiscal_year_start_month == 1`; (6) no
`data_sources` residue; (7) Springs is a `city` linked to El Paso County with no
duplicate row (the Utah phantom-row defect); (8) all three classification axes,
because both stampers write the column default `unknown` on a FRESH row — so
re-running a loader would silently un-classify these rows without this check;
(9) **no published label is a fragment**, which is the check that catches §4.5.

**The 6 single-reader rows are reported by name, not folded into the pass
count** — El Paso FY2009/FY2010/FY2011/FY2016/FY2017/FY2022 revenue, which
neither `-table` strategy can read. They rest on the coordinate reader plus
`acfrPrintedTotal.py` (which ran on every El Paso row and matched). They were
additionally corroborated **by hand against a third rendering** (`pdftotext
-layout`): FY2009 `Total revenues 106,269,411`, FY2010 `104,671,784`, FY2011
`111,664,551` read directly off the statement page, and for the three wrapped
TABOR years the disputed sales-tax cells read `61,837,624` (FY2016),
`87,623,080` (FY2017) and `101,557,566` (FY2022) — matching what was loaded, and
confirming the TABOR figure went into the label rather than the amount.

**Regression:** `node scripts/verify-austin-travis.mjs` → **76 rows, ALL CHECKS
PASSED**, so the shared-lib refactor (§4.1) moved nothing. Both TX drivers
re-run clean under the new required-config contract.

**Repo gates:** `npm test` **504 passed** (33 files, 16 new),
`acfrGF.selftest.py` **166 passed**, `npm run build` clean.

**Live API** (`ev-accounts-api.onrender.com`) serves both entities with the full
windows, all three axes on every dataset, and a `data_source_info.url` pointing
at the **resolved asset** (`/system/files/2025-07/2024%20CO%20Springs%20ACFR_Final.pdf`)
rather than the viewer shell — so the source chip links to the real PDF.

---

## 8. Follow-ups (not done, deliberately)

1. **El Paso FY2006–FY2008 (3 years).** Needs a two-page horizontal-split column
   model and a widened page-qualifying rule (§3). `acfrGfComponents.py` is the
   right foundation.
2. **The two scanned eras (18 years).** Colorado Springs FY1999–FY2011 and
   El Paso FY2000–FY2004 need OCR. This is a policy decision about provenance,
   not an extraction problem.
3. **Austin FY2002–FY2009 (8 years, 16 rows).** The AUSTIN-TRAVIS-01 follow-up is
   now unblocked: its failure mode is exactly §4.4's `positional` defect, and
   `acfrGfComponents.py` reads components in coordinate space. A
   `extractAustinCoords.py` on this milestone's pattern should close it.
4. **API response encoding (different repo).** `data_source` is stored correctly
   as U+2014 in the database, but the API serves it double-encoded
   (`â€"`) — verified identical for Colorado Springs AND Austin, so this is
   **pre-existing and global**, affecting every em-dash label including the 1,448
   state-ACFR rows. Fix belongs in `C:\EV-Accounts`.
5. **Colorado statewide source.** Colorado DOLA publishes a Local Government
   Financial database covering all CO local governments. Not needed for these two
   entities, but it is the obvious route to the rest of the state and would be a
   bulk-source milestone rather than a per-entity one.
6. **UAT not run.** No tag cut. `main` is branch-protected on the `build` check,
   so this ships as a PR.
