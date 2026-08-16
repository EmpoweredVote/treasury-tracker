# WA-CITIES-01 — Recon Findings

Plan: `docs/superpowers/plans/2026-08-15-wa-cities-01.md`
Spec: `docs/superpowers/specs/2026-08-15-wa-cities-01-design.md`

---

## Cohort-wide findings

### 1. MCAGs — all twelve resolved live, and every county guess in the plan was wrong

Resolved against `GetEntities` on 2026-08-15. The plan drafted the four county
MCAGs from guesswork; **all four were wrong**, which is why the plan carried a
verification step before seeding.

| Entity | Pinned MCAG | Plan's guess | Verdict |
|---|---|---|---|
| Tacoma | `0610` | `0610` (probed) | ✅ |
| Spokane | `0724` | `0724` (probed) | ✅ |
| Vancouver | `0247` | `0247` (probed) | ✅ |
| Bellevue | `0374` | `0374` (probed) | ✅ |
| Kent | `0401` | `0401` (probed) | ✅ |
| Everett | `0664` | `0664` (probed) | ✅ |
| Pierce County | **`0152`** | `0620` | ❌ guess wrong |
| Spokane County | **`0166`** | `0730` | ❌ guess wrong |
| Clark County | **`0103`** | `0240` | ❌ guess wrong |
| Snohomish County | **`0162`** | `0660` | ❌ guess wrong |

### 2. Two decoy layers, both able to load the wrong government's money

**Entity level.** `GetEntities` matches on a name prefix:

- `Spokane` → City of Spokane (0724), **City of Spokane Valley (2781)** — a
  genuinely different municipality of ~103k — and City of Spokane
  Transportation Benefit District *(Inactive)* (3062).
- `Kent` → City of Kent (0401), City of Kent Economic Development Corporation
  *(Inactive)* (0662), City of Kent Special Events Center Public Facilities
  District (3003).
- Every county repeats the pattern: cemetery districts under Clark and Spokane,
  a diking district and a public hospital district under Snohomish, two
  development corporations under Pierce.

Guarded by `selectExactCity()` + `assertMcag()` in `scripts/lib/waRoster.mjs`.

**Report level — new, and specific to large cities.** One MCAG carries reports
for more than one reporting entity. Tacoma's 0610 returns **182 reports**, of
which only **116 are titled "City of Tacoma"**:

| Count | ReportTitle |
|---|---|
| 116 | City of Tacoma |
| 43 | Tacoma Employees' Retirement System |
| 23 | Tacoma Power / Tacoma Public Utilities energy-compliance reports (many title spellings) |

A pension-system statement would parse cleanly and tie at $0 while reporting
the wrong entity's money. **Filter on `ReportTitle` before selecting an ARN.**
Neither v2.22 entity exposed this: Bainbridge and Kitsap have no separately
reporting pension system.

### 3. The type-name inversion holds below FY2014 — measured, not assumed

The spec flagged this as unknown and asked recon to record it. Classified at
both ends of Tacoma's span:

| FY | ARN | Type name | Pages | Verdict |
|---|---|---|---|---|
| 2025 | 1040162 | Annual Comprehensive Financial Report | 5 | opinion letter |
| 2024 | 1037700 | Annual Comprehensive Financial Report | 6 | opinion letter |
| 2024 | 1038208 | Financial and Federal | 188 | **statements** |
| 2015 | 1017553 | Financial and Federal | 131 | **statements** |
| 2010 | 1006397 | Financial and Federal | 120 | **statements** |
| 2005 | 71446 | Financial and Federal | 88 | **statements** |
| 2003 | 68092 | Financial and Federal | 87 | **statements** |

The inversion is consistent across the whole FY2003–FY2024 span for this
issuer. **Selection remains by CONTENT regardless** — this is recorded as a
finding for the next WA milestone, not as something to start relying on.

### 4. Populations — WA OFM has advanced to the April 1, 2026 edition

Read from `ofm_april1_population_final.xlsx`, sheet `Population`, Filter=4 city
rows. The file now carries both a 2025 and a 2026 estimate column.

| City | Line | 2025 estimate (**used**) | 2026 estimate |
|---|---|---|---|
| Tacoma | 295 | **228,400** | 231,000 |
| Spokane | 359 | **234,700** | 235,900 |
| Vancouver | 48 | **205,100** | 207,000 |
| Bellevue | 146 | **158,000** | 158,300 |
| Kent | 160 | **140,100** | 140,400 |
| Everett | 330 | **114,700** | 114,900 |
| | | **1,081,000 total** | 1,087,500 |

**The cohort is deliberately kept on the 2025 column** so all eight WA entities
share one denominator year and per-capita figures stay comparable across
cities — Bainbridge (25,530) and Kitsap (288,900) were loaded on 2025. The 2026
values are recorded here for a future whole-cohort refresh: **refresh all eight
together or not at all.**

---

## Tacoma (MCAG 0610)

**Verdict: LOADABLE. The milestone's largest open risk is retired for this city.**

The spec named it as the biggest unknown — whether the SAO holds statements for
a city this size, or only an opinion letter, as it does for self-publishing
Seattle. Tacoma holds **statements for 22 consecutive years**.

### Content-guard window: FY2003–FY2024, all 22 years pass

Every year is the "Financial and Federal" report titled exactly *City of
Tacoma*, fetched and passed through `classifyReport()`:

| FY | ARN | Pages | Size |
|---|---|---|---|
| 2024 | 1038208 | 188 | 6.6 MB |
| 2023 | 1036023 | 184 | 13.1 MB |
| 2022 | 1033428 | 183 | 5.7 MB |
| 2021 | 1031332 | 171 | 11.2 MB |
| 2020 | 1029959 | 154 | 3.5 MB |
| 2019 | 1027087 | 146 | 3.8 MB |
| 2018 | 1024781 | 159 | 3.0 MB |
| 2017 | 1022333 | 153 | 2.6 MB |
| 2016 | 1019851 | 139 | 2.6 MB |
| 2015 | 1017553 | 131 | 7.0 MB |
| 2014 | 1015203 | 115 | 3.9 MB |
| 2013 | 1012677 | 122 | 2.6 MB |
| 2012 | 1010562 | 124 | 1.3 MB |
| 2011 | 1008324 | 118 | 9.9 MB |
| 2010 | 1006397 | 120 | 1.8 MB |
| 2009 | 1004324 | 107 | 2.1 MB |
| 2008 | 1002279 | 105 | 1.1 MB |
| 2007 | 75229 | 92 | 0.8 MB |
| 2006 | 73774 | 95 | 0.8 MB |
| 2005 | 71446 | 88 | 0.9 MB |
| 2004 | 69481 | 79 | 0.9 MB |
| 2003 | 68092 | 87 | 0.9 MB |

**No isolated failures and no consecutive failures** — the floor rule's
stopping conditions never fired within the available filings. The window is
bounded by what the SAO publishes, not by what the guard rejects.

### Excluded years

| FY | Reason |
|---|---|
| 2025 | **Source timing, not a defect.** The only City of Tacoma filings are a 5pp opinion letter (ARN 1040162) and five Contracted CPA reports. The financial audit is not yet released. Re-check after the SAO publishes it. |
| pre-2003 | No filings returned by SearchReports for MCAG 0610. |

### ⚠ This is a CONTENT-guard window, not an EXTRACTION window

`classifyReport()` proves a statement exists and is text-bearing. It does **not**
prove the General Fund column parses, nor that one extractor config reaches all
22 years. Per the floor rule, the window ends at the first year needing more
than a value change in the config — an era split ends it. **The extractor task
settles the real floor and may shorten this list.** Bainbridge is the cautionary
case: its filings looked available back to FY2004, and the usable window still
came out at 18 of 22 years across two configs.

### Notes for the extractor task

- Tacoma is a **large** city and its filings are 79–188pp, versus Bainbridge's
  ~50–90pp. The governmental-funds statement may span two pages, as Kitsap's
  does — page-2 continuation handling is likely to matter.
- Units are unknown until read off the page. Seattle and King County print
  **in thousands**; Bainbridge and Kitsap print **whole dollars**. Read it, do
  not assume — the tie is unit-invariant either way.
- `sanityMax` is provisionally 5,000,000,000 in the roster; revisit once the
  real magnitude is known.

---

## Spokane (MCAG 0724)

**Verdict: LOADABLE. 20 years on one extractor config, all tying at exactly $0.**

### Content-guard window: FY2004–FY2024, all 21 years pass

Every year is the "Financial and Federal" report titled exactly *City of
Spokane*, fetched and passed through `classifyReport()`:

| FY | ARN | Pages | Size |
|---|---|---|---|
| 2024 | 1038150 | 212 | 6.3 MB |
| 2023 | 1035593 | 199 | 4.3 MB |
| 2022 | 1033337 | 192 | 4.8 MB |
| 2021 | 1031211 | 186 | 4.3 MB |
| 2020 | 1029500 | 186 | 3.9 MB |
| 2019 | 1027407 | 176 | 3.6 MB |
| 2018 | 1024654 | 174 | 3.6 MB |
| 2017 | 1022245 | 187 | 4.8 MB |
| 2016 | 1019601 | 175 | 31.9 MB |
| 2015 | 1017591 | 160 | 6.7 MB |
| 2014 | 1015900 | 153 | 7.3 MB |
| 2013 | 1012701 | 188 | 2.5 MB |
| 2012 | 1010571 | 158 | 6.7 MB |
| 2011 | 1008352 | 105 | 1.7 MB |
| 2010 | 1006365 | 106 | 1.5 MB |
| 2009 | 1004307 | 114 | 14.0 MB |
| 2008 | 1002267 | 115 | 9.6 MB |
| 2007 | 75383 | 115 | 3.5 MB |
| 2006 | 73792 | 110 | 3.4 MB |
| 2005 | 71922 | 108 | 1.0 MB |
| 2004 | 69912 | 91 | 1.0 MB |

No failures at all, so the floor rule's stopping conditions never fired. The
span is bounded by what the SAO publishes: `SearchReports` returns nothing for
MCAG 0724 below FY2004.

### Extraction window: 20 years — FY2012 excluded

| FY | Reason |
|---|---|
| 2012 | **Source-document defect.** The statement pages carry no text layer at all: `pdftotext` returns only the SAO page furniture ("Washington State Auditor's Office  Page 55") for every page in the statement range. The report passes the fetch-time content guard only because the auditor's opinion letter, which IS text-bearing, names the statements in prose. FY2011 and FY2013 both extract cleanly, so this is an ISOLATED year and the walk continues. |
| 2025 | **Source timing, not a defect.** The only FY2025 City of Spokane filing is a Contracted CPA report (ARN 1039996). The financial audit is not yet released. |
| pre-2004 | No filings returned by SearchReports for MCAG 0724. |

All 20 remaining years tie at exactly **$0 on ONE config**, with **zero**
source-rounding residues.

### The report-level decoy layer is milder here than on Tacoma

MCAG 0724 returns 81 reports, of which 72 are titled *City of Spokane*. The
other 9 are statewide performance audits that merely mention the city
("Open Public Records Practices at 30 Government Entities", "Allocating
Overhead Costs"). **There is no separately reporting pension system on this
MCAG**, so nothing here could parse cleanly as the wrong government's money the
way Tacoma's Employees' Retirement System could. The title filter is applied
anyway.

### The type-name inversion holds for this issuer too

Classified at both ends of the span. Every *Annual Comprehensive Financial
Report*-named filing is an opinion letter:

| FY | ARN | Type name | Pages | Verdict |
|---|---|---|---|---|
| 2024 | 1038168 | Annual Comprehensive Financial Report | 5 | opinion letter |
| 2015 | 1017609 | Annual Comprehensive Financial Report | 3 | opinion letter |
| 2008 | 1002268 | Annual Comprehensive Financial Report | 2 | opinion letter |
| 2006 | 73819 | Annual Comprehensive Financial Report | 2 | opinion letter |

Two data points to Tacoma's; the inversion now holds on both cities across
FY2006–FY2024. Selection remains by CONTENT regardless.

### ⚠ A wrong-page trap that would tie at $0

Spokane publishes a supplementary **Schedule of General Fund Accounts** that
breaks the General Fund into sub-accounts (Code Enforcement, Library, Housing
Trust, EMS) with an Eliminations column and a **Total column that EQUALS the
basic statement's General Fund column**. It carries the same "Statement of
Revenues, Expenditures, and Changes in Fund Balances" title and its own Total
Revenues / Total Expenditures rows, so it parses cleanly and would tie at $0.

`find_statement_page` avoids it only by taking the EARLIEST qualifying page
(FY2024: basic statement p.48, schedule p.200) — the thin invariant this repo
has been burned by before. What actually rules it out is that its caption does
not say **"Governmental Funds"**, and `verify-wa-rederive.mjs` asserts that
independently on all 40 rows: 40/40 land on exactly one candidate page.

### ⚠ `pdftotext -table` form feeds are NOT page breaks — found here

The single most consequential finding of this task, and it is a **tooling**
finding rather than a Spokane one.

`pdftotext -table <pdf> -` emits at least one form feed per page and sometimes
extra ones *within* a page. Four Spokane documents drift badly:

| FY | PDF pages | `-table` chunks | Statement chunk | Statement REAL page |
|---|---|---|---|---|
| 2018 | 174 | 276 | 40 | 40 |
| 2019 | 176 | **455** | 63 | **37** |
| 2020 | 186 | 256 | 40 | 40 |
| 2022 | 192 | 260 | 35 | 35 |

Both harnesses had been treating the chunk index as a page number. In
`verify-wa-rederive.mjs` that number is passed to
`pdftotext -lineprinter -f N -l N` for the geometric reading, so FY2019 would
have been read against PDF page 63 — an investment-policy table in the notes —
instead of page 37.

Fixed in both harnesses: the chunk count is compared against `pdfinfo`'s page
count, and when they disagree the pages are re-extracted one at a time, where
`-f N -l N` makes the number true by construction. Extra feeds can only ever
ADD chunks, so the discrepancy is self-detecting.

**`scripts/lib/acfrGF.py` is NOT fixed and does not need to be.** It splits on
`\f` the same way, so its emitted `statement_page` is a chunk index (FY2019
reports 63). That number is never persisted — there is no `budgets.statement_page`
column — and `parse_fy` uses the page TEXT rather than its number, so no money
is affected. Recorded here so the next reader is not surprised by a
disagreement between the extractor's JSON and the audit's `(h)` line.

### Notes for the extractor task — what Spokane actually needed

- **Whole dollars** (`units=1`), the OPPOSITE of Tacoma in the same milestone.
  No "(in thousands)" caption in any year.
- **`column_strategy='positional'`.** FY2005 prints two expenditure rows with a
  blank cell and FY2007 one. Same trap Tacoma FY2023 sprang; Spokane sprang it
  first, in FY2005.
- **`Capital outlay` is a ROOT PEER**, and only FY2004 says so. FY2015 onward
  print every label at the same x with no indentation at all, so those eras
  cannot answer the nesting question on their own. FY2004 still indents:
  `Current:` and `Debt service:` at x=39 with children at x=41, and
  `Capital outlay` at x=39. Guessing the other way still ties at $0.
- Two spelling drifts one config absorbs: `Capital outlay`/`Capital outlays`
  (root_leaves are prefixes) and `Current:`/`Current` (the library matches
  parents colon-stripped). Neither is an era split.
- **FY2007 carries both SAO page-furniture artifacts on one page**: the footer
  page number `41` at column 0 of the `Debt service:` heading (the library
  recovers it) and the rotated "Washington State Auditor's Office" credit welded
  onto the `Physical environment` label (repaired with an exact `label_fixes`
  entry, keyed on the WHITESPACE-COLLAPSED label that `label_of()` emits).
- **FY2018 and FY2022 render their period sentence as "For the Fiscal `<ear`
  Ended December 31, 20XX"** — a mis-mapped glyph ate the Y. Both harnesses'
  `assertPageYear` now anchors on `ended december 31, <year>` without requiring
  the word "year".
- `-layout` is unusable for column pairing here exactly as on Tacoma: it emits
  labels and values on different output lines.

### Measured spread and bands

40 combinations: **$384.88/resident** (FY2005 operating) to **$1,144.95**
(FY2024 revenue). Loader band `[200, 2500]`; harness band `[300, 1400]`.

Copying Tacoma's `[300, 3000]` would have passed every Spokane year — which is
exactly why the band is re-derived rather than inherited. A band that passes by
accident guards nothing.

## Vancouver (MCAG 0247)

**Verdict: LOADABLE. 19 years on one extractor config; two adjudicated $1
residues, both in FY2008.**

### Content-guard window: FY2004–FY2024, all 21 years pass

Every year is the "Financial and Federal" report titled exactly *City of
Vancouver*:

| FY | ARN | Pages | Size |  | FY | ARN | Pages | Size |
|---|---|---|---|---|---|---|---|---|
| 2024 | 1038527 | 142 | 1.8 MB | | 2013 | 1012264 | 86 | 1.4 MB |
| 2023 | 1035588 | 129 | 4.2 MB | | 2012 | 1010510 | 86 | 1.3 MB |
| 2022 | 1033340 | 125 | 2.8 MB | | 2011 | 1008186 | 82 | 1.2 MB |
| 2021 | 1031732 | 127 | 2.2 MB | | 2010 | 1006111 | 77 | 1.9 MB |
| 2020 | 1028998 | 101 | 2.3 MB | | 2009 | 1004022 | 78 | 1.5 MB |
| 2019 | 1027245 | 115 | 2.9 MB | | 2008 | 1001962 | 85 | 1.2 MB |
| 2018 | 1024608 | 115 | 2.5 MB | | 2007 | 75387 | 76 | 0.7 MB |
| 2017 | 1021894 | 110 | 3.3 MB | | 2006 | 73293 | 78 | 1.0 MB |
| 2016 | 1019604 | 100 | 10.1 MB | | 2005 | 71348 | 73 | 0.8 MB |
| 2015 | 1017115 | 102 | 3.3 MB | | 2004 | 69265 | 69 | 3.9 MB |
| 2014 | 1014700 | 88 | 1.7 MB | | | | | |

### Extraction window: 19 years — FY2005 to FY2023

Both exclusions sit at the **ends** of the span, so no year inside the window is
skipped.

| FY | Reason |
|---|---|
| 2004 | **Image-only scan.** Every statement page returns nothing but the SAO page furniture ("Washington State Auditor's Office / 19"); only the table of contents and front matter carry text. Same class as Spokane FY2012 and Bainbridge FY2006. |
| 2024 | **The worst text layer in this milestone.** Three defects coexist — see below. The money digits are absent from the statement. |
| 2025 | **Source timing.** The SAO holds *no* City of Vancouver filing for FY2025 at all — not even the Contracted CPA report Tacoma and Spokane have. |
| pre-2004 | No filings returned by SearchReports for MCAG 0247. |

### ⚠ FY2024: three text-layer defects in one document

Worth describing because it is **not** the familiar +29 shift alone:

1. **A glyph map that drops characters outright.** `f`, `w`, `x`, `j`, `z` and
   the fi/fl/ff ligatures vanish: "rom operations", "Foreitures", "hich",
   "cityide", "proects", "groth", "Ependitures", "nancial statements".
2. **The +29 byte shift** on other runs: `34!4%-%.4/&2%6%.5%3` is
   "STATEMENTOFREVENUES".
3. **The money digits are absent.** On the governmental-funds statement the
   General Fund's Property taxes row renders as `$ ,,` — the thousands
   separators survive and every digit is gone.

v2.22 established that a bounded, self-validating decode of this cipher class
does not recover money digits (Bainbridge FY2010, Kitsap FY2017–FY2019), and
here there is nothing to decode: the digits were never emitted. FY2023 extracts
cleanly, so FY2024 is documented and skipped.

### The report-level decoy layer

62 of the MCAG's 68 reports are titled *City of Vancouver*. The other six
include a **"Vancouver City Examination Report GASB 68"** — a pension-liability
examination, not the city's own statements — and five statewide performance
audits that merely mention Vancouver ("Use of Impact Fees in Federal Way,
Olympia, Maple Valley, Redmond and Vancouver"). The title filter excludes all
six.

### ⚠ FY2021 spans TWO pages, and page 2 nearly qualified

FY2021's governmental-funds statement runs across p.45 and p.46. Page 46
carries the **identical** title and `GOVERNMENTAL FUNDS` scope line and its own
REVENUES / Total rows, but has **no General Fund column at all** — its columns
are American Rescue Plan Act / General Obligation Debt / Non-Major Governmental
/ Total.

It qualified as a statement page purely on the word "General" inside **"General
Obligation Debt"**, which made the page AMBIGUOUS — and ambiguity is a blocker
in `verify-wa-rederive.mjs` precisely because resolving it by document order is
the assumption that harness refuses to make. Both harnesses' `GF_CAPTION_RE`
now excludes `obligation` alongside the existing `government`:
a General Obligation *debt* fund is no more a General Fund column than the
General Government expenditure function is. The exclusion is per-occurrence, so
a caption carrying both a real General Fund column and a General Obligation one
still matches on the first.

Unlike Kitsap, whose page 2 declares itself "Page 2 of 2", Vancouver's page 46
declares nothing.

### TWO ADJUDICATED $1 RESIDUES, both FY2008

FY2008 p.28 (bound page 25) prints a total **one dollar below** the sum of its
own printed components on **both** sides of the statement. Adjudicated by
rendering the page at 200 dpi and re-adding every component off the image, not
off the text layer:

| Side | Components sum | Page prints | Registered delta |
|---|---|---|---|
| Expenditures | 86,087,540 | 86,087,539 | `(2008, 'operating'): 1` |
| Revenues | 124,656,107 | 124,656,106 | `(2008, 'revenue'): 1` |

The loaded value is the component sum in both cases, so each row still ties at
$0 against its own line items. Full component lists are in
`scripts/extractVancouver.py`.

### Notes for the extractor task — what Vancouver actually needed

- **Whole dollars** (`units=1`), like Spokane, unlike Tacoma.
- **The tree shape is printed.** Vancouver keeps its indentation in *both*
  eras, so the capital-line question answers itself: FY2005 p.23 puts `Current`
  and `Debt service` at x=43 with functions at x=48 and **`Capital projects` at
  x=43**; FY2023 p.33 does the same at x=47/51 with **`Capital outlay` at
  x=47**. A root peer either way. Spokane needed its oldest era to settle the
  same question; Vancouver never lost the evidence.
- **Two spellings, one prefix.** `Capital projects` (FY2005–FY2014) →
  `Capital outlay` (FY2015–FY2023), covered by `root_leaves=('capital ',)`.
- `Current` and `Debt service` print **without colons** in every year; the
  library matches parents colon-stripped.
- **Every row is fully populated** — dashes where a fund has no activity — so
  none of the blank-cell traps Tacoma and Spokane sprang arise here.
- FY2021 is the one drift document (127 pages → 138 `-table` chunks), handled
  by the page-exact `tablePages` added in Task 7.

### Measured spread and bands

38 combinations: **$348.74/resident** (FY2005 operating) to **$1,163.89**
(FY2023 revenue). Loader band `[175, 2500]`; harness band `[275, 1400]`.

## Bellevue (MCAG 0374)

**Verdict: LOADABLE, but the WORST DOCUMENT SET in this milestone. 12 of 21
filings are readable; eleven $1 residues; and the tree shape is inverted.**

### Content-guard window: FY2004–FY2024, all 21 years pass

Every year is the "Financial and Federal" report titled exactly *City of
Bellevue*. **All 21 pass `classifyReport()` and only 12 have a readable
statement** — the widest gap between the fetch guard and the extraction window
seen so far, and a reminder that the content guard proves a statement exists,
not that it parses.

The report-level decoy is `Bellevue, City of  GASB 68 Examination Report` — a
pension-liability examination. Note the name is **inverted**, so a prefix filter
on "City of Bellevue" excludes it but a "contains Bellevue" filter would not.

### Extraction window: 12 years — FY2008–FY2023 less FY2011, FY2014, FY2017, FY2019

| FY | Reason |
|---|---|
| 2004–2007 | **Image-only scans.** No statement page carries any text; the only money-bearing page in each document is the Schedule of Expenditures of Federal Awards. **Four CONSECUTIVE unreadable years — this is what ends the window at FY2008** under the floor rule. |
| 2011, 2017, 2019, 2024 | **No usable text layer** — statement pages carry no digits. FY2024 is the plainest: its text renders as consonant soup (`ZtZ`, `'Zt^Z`, `&Zz`) with no numerals at all. Each is ISOLATED, so the walk continues. |
| 2014 | **A DIFFERENT DEFECT, and the digits ARE present.** The text layer both collapses spaces and INJECTS them inside words *and numbers*: `Ca s h&equi tyi npool edi nves tments`, and critically `$1 5,205` — one cell rendered as two numbers. Recovering it needs a de-spacing heuristic, which `acfrGF.py` explicitly refuses to have because rejoining single spaces would corrupt legitimate multi-word labels. `label_fixes` cannot help: the damage is in the MONEY, not the labels. Isolated, so skipped. |
| 2025 | **Source timing** — the SAO holds no City of Bellevue filing. |

### ⚠ THE TREE SHAPE IS INVERTED

Tacoma, Spokane and Vancouver all print `Capital outlay` as a valued **root
leaf** beside `Current:` and `Debt service:`. Bellevue prints it as a **PARENT
with its own function children**:

```
Expenditures:
  Current:          General government / Public safety / Physical environment /
                    Transportation / Economic environment / Health & human
                    services / Culture & recreation
  Debt service:     Principal / Interest & fiscal charges
  Capital outlay:   General government / Public safety / Physical environment /
                    Transportation / Economic environment / Culture & recreation
```

So all three GASB characters are parents and `root_leaves=()`. This is the
Hillsboro arrangement the library's `CityConfig` docstring warns about. Reading
it the other way still ties at $0 — it would take the first capital child as the
whole capital line and strand the remaining five.

Note the **same function name appears under two different parents**. The tree
keys leaves by parent-and-label, so they stay distinct; a reader keying on the
label alone would silently collapse them.

### ⚠ `column_strategy='ordinal'`, not the library default

FY2008 and FY2009 render the General Fund column in **disjoint horizontal
zones** under `-table` — the Taxes figure at one x, Licenses far to its right,
Intergovernmental elsewhere again, while the neighbouring LEOFF I Reserve column
stays put. No x-range anchored on the totals row encloses them, so the
positional reader found an empty band and computed a General Fund total of
**ZERO** against a printed 143,577. Same `-table` pathology v2.22 documented on
Kitsap FY2004–FY2016.

Ordinal is safe here only because **no Bellevue row is ever short**: every data
row in all twelve loaded years exposes exactly as many cells as its totals row.

### ELEVEN ADJUDICATED $1 RESIDUES — and why a thousands issuer produces them

Bellevue registers more source-rounding cases than any other entity in this
repo. Six of the twelve loaded years land a dollar off on one side or both.

This **retires an assumption Tacoma's config made explicit**: that a
thousands-denominated issuer "cannot" produce residues because its components
are already rounded to the thousand. Tacoma's zero was an empirical fact about
Tacoma, not a law about the denomination. Rounding each component independently
to the nearest thousand is *exactly* where a one-unit disagreement with the
separately-rounded printed total arises.

Every one was adjudicated by rendering the page at 200 dpi and re-adding the
General Fund column off the image:

| FY | Side | Components | Page prints | Delta |
|---|---|---|---|---|
| 2008 | exp | 143,576 | 143,577 | −1000 |
| 2008 | rev | 147,336 | 147,335 | +1000 |
| 2009 | exp | 149,604 | 149,605 | −1000 |
| 2009 | rev | 142,850 | 142,849 | +1000 |
| 2012 | exp | 160,950 | 160,949 | +1000 |
| 2012 | rev | 165,115 | 165,114 | +1000 |
| 2013 | rev | 171,887 | 171,886 | +1000 |
| 2015 | exp | 185,914 | 185,915 | −1000 |
| 2015 | rev | 195,315 | 195,316 | −1000 |
| 2016 | exp | 181,767 | 181,768 | −1000 |
| 2016 | rev | 192,706 | 192,705 | +1000 |

Deltas are in the SCALED domain (`units=1000`), so a one-dollar-in-thousands
disagreement registers as 1000. FY2013's expenditure side ties exactly, which is
why only its revenue side is registered.

### Three harness fixes Bellevue forced

1. **"Twelve Months ENDING".** FY2008–FY2012 caption their statements *"For the
   Twelve Months Ending December 31, 2008"*, not *"Year Ended"*. `assertPageYear`
   now anchors on `end(ed|ing) december 31, <year>`.
2. **A section whose header the issuer omitted.** FY2015 and FY2016 print no
   `Expenditures:` row at all — the statement runs straight from `Total
   revenues` into `Current:`. `sectionOf` now falls back to the revenue Total
   row, which is the document's own statement of where the revenue section ends.
   Only consulted when the heading is genuinely absent.
3. **⚠ THE AUDIT'S HIERARCHY CHECK WAS APP-WIDE BY NAME.** Treasury Tracker
   already holds a **Bellevue, OHIO**. Check (f) selected municipalities on NAME
   ALONE, so it reported a duplicate that is not one and then compared the *Ohio*
   row's `county_id` against King County. Now scoped to `state='WA'`.

   This is v2.21's scoping lesson in a third costume. What (f) is actually for is
   the Utah phantom-row defect — a second row of the same name with a different
   `entity_type` — and that duplicate is always in the same state. **Kent is the
   next name in this cohort with the same exposure.**

### Measured spread and bands

24 combinations: **$904.11/resident** (FY2009 revenue) to **$2,011.32** (FY2023
revenue) — the richest per resident in the WA cohort. Loader band `[400, 4500]`;
harness band `[700, 2400]`. Copying Spokane's or Vancouver's band would have
rejected a correct load outright.

## Kent (MCAG 0401)

> **⚠ STATUS: LOADED BUT NOT INDEPENDENTLY VERIFIED.** 36 rows are live and pass
> every loader gate, but `verify-wa-rederive.mjs` cannot yet read 21 of them and
> `verify-wa-audit.mjs` check (e) false-positives on all of them. **Three harness
> gaps are open — see "Harness gaps" below.** No disagreement between the loaded
> data and the source PDFs has been found. Task 10 is INCOMPLETE.

**Verdict: LOADABLE. 18 years on one config, every combination tying at exactly
$0, zero residues.**

### Content-guard window: FY2004–FY2024, all 21 filings pass

Every year is the "Financial and Federal" report titled exactly *City of Kent*.
58 of the MCAG's 62 reports are the city's own; the rest are statewide
performance audits. Kent's decoys are at the ENTITY level rather than the report
level — `GetEntities` also returns City of Kent Economic Development Corporation
*(Inactive)* (0662) and City of Kent Special Events Center Public Facilities
District (3003).

### Extraction window: 18 years — FY2004–FY2024 less FY2019, FY2020, FY2023

| FY | Reason |
|---|---|
| 2019, 2020 | **No usable text layer**, and CONSECUTIVE. Both are the +29 shift with the money digits absent; FY2019 has **zero** money-bearing pages in the entire document. |
| 2023 | **No usable text layer.** Statement p.43 renders as `67$7(0(172)5(9(18(6...` with nothing after `3URSHUW\`. Isolated. |
| 2025 | **Source timing** — the SAO holds no City of Kent filing. |

### ⚠ APPROVED DEVIATION FROM THE FLOOR RULE

FY2019 and FY2020 are **consecutive** unreadable years, and the Global
Constraints say two consecutive years **end the window** — which would have
stopped Kent at FY2021 and published **three years / six rows**.

**The window below the gap was taken instead**, as an explicit deviation
approved by Chris on 2026-08-16 before any extractor work was done.

The reason: the rule's own stated purpose is *"never extend a window by doing
not-easy work to make the row count look better"*, and reading below FY2019
required **no work at all** — no era split, no second config, no font recovery,
no different source. The fifteen years below the gap parse on the **same config**
as the three above it, which is the test the rule actually cares about. The gap
is a property of two documents, not a boundary in the statements.

**This was measured, not assumed**: all 36 combinations tie at exactly $0 on one
config, with zero source-rounding residues.

### The richest revenue tree in the cohort — five parents

Read off the FY2024 indentation (parents at x=51, children at x=53):

```
REVENUES
  Taxes:                      Property / Sales and use / Utility /
                              Business & occupation / Real estate excise tax /
                              Lodging / Other
  Licenses and permits:       Building permits / Other licenses and permits
  Intergovernmental revenue:  Federal grants / State grants /
                              State shared revenues / Other governments
  Charges for services:       Park and recreation fees / Other fees and charges
  Fines and forfeitures       <- the ONE ungrouped source, back at x=51
  Miscellaneous revenue:      Special assessments / Interest income /
                              Rent/Leases income / Contributions and donations /
                              Other miscellaneous revenue
```

Two `revenue_group_members` entries are deliberately narrower than they look:
`miscellaneous revenue` rather than a bare `revenue`, because **FY2012 prints
`Intergovernmental revenue` as a VALUED LEAF** and a bare `revenue` suffix would
have kept it inside the still-open Licenses group — same dollars, wrong shape,
$0 tie.

`column_strategy='positional'`: Kent's statements are full of blank cells —
FY2004 revenue rows carry one to four numbers against a four-column totals row,
FY2006/FY2008 the same against seven.

FY2004–FY2008 weld the SAO page-footer credit onto the `Fire District #` label,
repaired with an exact `label_fixes` entry as on Spokane FY2007.

### Harness gaps — the reason Task 10 is incomplete

All three are defects in the harnesses' own readers. **None is a disagreement
with the loaded data.** 15 of Kent's 36 rows already re-derive clean; the other
21 block.

1. **Revenue-group indentation lookup uses the wrap-accumulated label.**
   `buildRevenue` calls `indentOf(full, …)` where `full` includes carried-over
   `pending` text, so it looks up `"Real estate excise tax Lodging Other"` or
   `"Intergovernmental revenue Federal grants"` in a `-layout` map keyed by the
   row's own label. Affects the revenue side of ~13 years. Likely small: look up
   `r.label`, not `full`.

2. **No complete data row exists to corroborate the column bands.** Kent's
   operating sections are made ENTIRELY of incomplete rows, so the Task 6 safety
   check — bands must reproduce the ordinal reading on a complete row before
   being trusted — can never be satisfied. Affects the operating side of ~8
   years. Needs a design decision: the natural answer is to corroborate against
   the **revenue** section's complete rows on the same page, since both sections
   share the page's column geometry, but that changes the trust argument and
   deserves its own tests.

3. **Audit check (e) false-positives on legitimate `Other …` labels.** Kent's
   `Taxes:` group has a child named literally **`Other`**, and the same statement
   carries `Other licenses and permits`, `Other fees and charges`,
   `Other governments` and `Other miscellaneous revenue`. The dash-zero grafting
   heuristic flags any leaf whose label has another label as a strict prefix, so
   it fires on all of them — 45 findings, every one spurious.

   Refining it is not trivial: the obvious tightening (require the remainder to
   be a sibling label too) still fires here, because `Licenses and permits` IS a
   category name in the same tree.

### Measured spread and bands

36 combinations: **$440.33/resident** (FY2004 operating) to **$931.30** (FY2024
revenue). Loader band `[220, 2000]`; harness band `[350, 1150]`. Kent prints
WHOLE DOLLARS.

## Everett (MCAG 0664) — not yet reconned
