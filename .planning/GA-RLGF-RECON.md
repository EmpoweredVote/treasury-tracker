# Georgia recon — Knight session 4 (§4.2 gate)

**Date:** 2026-08-29. **Question:** is there a free, no-auth, machine-readable
statewide source at icicle grade, and what does the PUBLISHER say about its
audit status?

**Outcome: BULK.** Georgia yields a statewide source covering 721 local
governments, FY2009–2025, at genuine icicle grade — but it is
`self_reported_unaudited`, and the publisher says so in its own words.

---

## 1. The source

**Georgia DCA — Report of Local Government Finances (RLGF)**, required annually
of every local government by O.C.G.A. § 36-81-8 and Rule 110-3-1.

* Listing app: `https://apps.dca.ga.gov/RLGF/Default.aspx`
* Files: `https://apps.dca.ga.gov/development/Research/programs/documents/RLGF/{CICOID}_{FY}_RLGF_{Name}.xls`

### ⚠ The app LOOKS like the Colorado DOLA trap, and is not

`Default.aspx` is a stateful ASP.NET postback (`__VIEWSTATE`,
`__EVENTVALIDATION`, one dropdown `ctl00$bodyContent$ddlGovs` with 721 options).
`reference_colorado_dola_compendium` is the standing warning about exactly this
shape, and §4.2 says to answer ACFR and move on when recon hits that wall.

**It is not that wall.** The postback is only a NAVIGATOR: it returns plain
`<a href>` links to STATIC `.xls` files whose URLs are fully predictable from
`(CICOID, fiscal year, name)`. One postback per entity enumerates its years; the
files themselves need no session, no cookie, and no terms acceptance.
**Probe before classifying an app by its framework.**

### ⚠ CORRECTION — TED has a working bulk File Export

Recon recorded TED (`ted.cviog.uga.edu`) as copy-paste only, on the strength of
its `LocalGovernmentIncomeItem` page saying *"Text may be copied and pasted from
above table to Excel."* **That was wrong.** A corroborating agent reached
`https://ted.cviog.uga.edu/FileExport` and pulled Milledgeville's full FY2016-2025
revenue series, plus peer cities, as real workbook exports.

TED is therefore a SECOND independent access path to the same RLGF data, and a
genuinely independent one — it is a different publisher pipeline, not a
re-serving of the DCA `.xls`. It was used to corroborate the Milledgeville
anomaly below and it confirmed the figure.

⚠ Not adopted as this loader's source: the DCA workbooks carry the full printed
form (function x object detail = the icicle), and TED's export is flatter. But
**TED is the right cross-check for any future GA figure**, and a candidate for
the statewide sweep. Its own site warns users to validate its data against
alternate sources.

### Entity codes

`CICOID` encodes type + county: `1`=county, `2`=municipality, `3`=consolidated,
then a 3-digit county number and a sequence. Verified:

| Entity | CICOID | Files |
|---|---|---|
| Macon-Bibb County (consolidated) | `3011011` | FY2014–2023, 2025 (⚠ no 2024) |
| Columbus/Muscogee CG (consolidated) | `3106002` | FY2012–2025 |
| Milledgeville City | `2005001` | FY2009–2025 (⚠ no 2011, 2018) |
| Baldwin County | `1005005` | FY2009–2025 complete |

### ⚠⚠ NAME-COLLISION TRAPS IN THE DROPDOWN

Four of the 721 options are near-misses for this session's targets and are
DIFFERENT GOVERNMENTS:

* **`Macon County` (`1096096`)** is not Macon-Bibb. A separate county.
* **`Bibb City` (`2106001`)** is not in Bibb County — the `106` is MUSCOGEE. It
  is a former mill village in Columbus.
* **`Baldwin City` (`2068002`)** is unrelated to Baldwin County (`1005005`).
* **`Macon City` (`2011001`)** and **`Bibb County` (`1011011`)** are the
  PRE-CONSOLIDATION governments, which is why Macon-Bibb's series starts FY2014.

**Select by CICOID, never by name.**

### ⚠ One junk file

`2005001_YEAR_RLGF_Milledgeville.xls` — a literal `YEAR` placeholder in the
fiscal-year position. Any loader globbing the listing must refuse a non-numeric
year rather than coerce it.

---

## 2. Audit status — neither the NC answer nor the FL answer

**The publisher disclaims it, twice, in its own words.**

Rule 110-3-1, verbatim: *"This information does not have to be audited but the
use of audited data is encouraged if the audit is available."*

TED / Carl Vinson Institute of Government (UGA), which publishes the data portal
for the General Assembly, verbatim: *"The data on revenues and expenditures
collected by DCA may or may not be audited amounts or may be reported on the
RLGF using an accounting basis other than that used in the local government's
financial reports."*

The form itself, Page 1: *"DCA cannot certify the accuracy of the report figures
submitted."* And the Part I header instructs: *"Use Audit figures if available."*

**There is no DCA reconciliation step.** This is the decisive difference from
Florida: FL DFS earned `compiled_from_audited` because staff *"reconciles the AFR
to the provided audited financial statements"* and refuses to publish otherwise.
GA has no equivalent — nobody checks.

### ⚠⚠ But the form carries a PER-ENTITY, PER-YEAR audited flag

Part XV certification, machine key `Audited` in the `LOAD1` sheet:
`Report uses AUDITED Figures (Enter Yes or No)`.

| Entity | FY2016–2025 |
|---|---|
| Columbus-Muscogee | **YES** every year |
| Macon-Bibb | NO ×7, **blank** FY2019 + FY2020 |
| Milledgeville | YES, YES, then NO ×6, then **YES** (FY2025) |
| Baldwin County | NO ×8, **YES** FY2018, **blank** FY2019 |

It flips within one source name and within one entity — the strongest
confirmation yet of session 1's finding that **the grade must be per row**, and
the same shape as Madison WI.

**DECISION (Chris, 2026-08-29): both branches grade `self_reported_unaudited`.**
The flag is a first-party claim with no verification step behind it, and CVIOG
says the figures may not even share the financial statements' accounting basis.
The branch is still recorded per row, encoded in the `data_source` string
(the Florida pattern), so it stays visible and re-gradable later without a reload.

⚠ **`Audited` is dirty**: observed `YES`, `NO`, `Yes`, `No`, and `0.0`. Parse
case-insensitively, and treat `0.0`/blank as NOT STATED — never coerce to "No".
An early label-scraping pass read one blank as `NO` by scanning the row for any
YES/NO token; the machine key is authoritative.

---

## 3. Granularity — icicle grade, with a machine extract

Two form generations, both machine-readable:

| Years | Extract sheet | Keys |
|---|---|---|
| FY2016–2025 | `LOAD1` | 924 (921 for Macon-Bibb FY2016 — variant, unexplained) |
| FY2009–2015 | `Exportable Data` + `Data` | 1,219–1,220 |

`LOAD1` is DCA's own normalised extract: `CICOID`/`Fyear`-keyed header+value row
pairs in 18 blocks (`_R1`–`_R3` revenue, `_E1`–`_E9` expenditure, `_D1`–`_D5`
debt/cash/equity, `_LOG1` metadata), with UCOA codes as keys and computed
subtotals (`TTL_1A`, `TTL_5D_A`, `TTL_PART5_A`).

**Expenditures (Part V)** are a real two-level tree: 7 sections → 77 functions,
each with 4 object columns (`A` current operations, `B` property, `C` machinery
and equipment, `D` intangibles).

**`_LOG1` carries the fiscal calendar first-hand**: `FYEmonth`, `MosRptd`
(months reported — stub years), `MoChng` (calendar change), plus `Government`
and the `Audited` flag.

### ⚠ Structure traps found

* **Page 3 and Page 4 hold the SAME expenditure table at DIFFERENT column
  offsets** (current operations is col 2 on Page 3, col 3 on Page 4). Verified by
  summing: section totals reconcile to `Total Part V` exactly only when the
  offset is applied per page. The Ohio county-vs-city layout lesson, inside one
  workbook.
* **Bare UCOA codes are NOT unique.** `31_3900` appears 3× on Page 1 (MOST /
  O-LOST / MARTA) and `31_4200`/`31_4300` twice each. Only the LOAD1 suffixed
  keys (`31_3900A/B/C/D`) are unique. ⚠ **LOAD1 key order is not page order** —
  `31_3900D` sits between `31_1320` and `31_1340` — so the mapping cannot be
  derived positionally.
* **The UCOA code column is numeric in places** and renders as `4,400` / `4,510`.
  Strip separators before matching.
* **Part boundaries must reset the section tracker.** A naive scrape carried
  "Section B -- OTHER REVENUES" across into Part IV and mislabelled 17 enterprise
  line items as governmental revenue.

---

## 4. Fiscal calendars

Georgia is **not** a uniform-month state — the FAC census GA slice (538 rows)
splits 225 July / 212 January / 60 October / 41 other.

| Entity | Month | Evidence |
|---|---|---|
| Baldwin County | **1** | `FYEmonth` = "December 31" AND FAC census month 1 for 2011–2023 — two independent sources agreeing |
| Milledgeville | 7 | `FYEmonth` = "June 30" AND FAC census month 7 |
| Macon-Bibb | 7 | `FYEmonth` = "June 30" only — ⚠ census-ABSENT under the consolidated name |
| Columbus-Muscogee | 7 | `FYEmonth` = "June 30" only — ⚠ census-ABSENT entirely |

### ⚠⚠ Two census blind spots, the `censusGuard()` shape again

`docs/fac/fac-local-fiscal-year-ends.csv` has **no row for Columbus or Muscogee
at all**, and Macon-Bibb appears only as the pre-consolidation `Macon`
(municipality, 1998–2013) and `Bibb County` (2000–2013). `censusGuard()` returns
`{ok: true}` when it cannot find an entity, so **both consolidated governments
would pass the calendar check without anything being checked** — the same
failure the campaign already filed for the 54 CA counties.

### ⚠ Baldwin County CHANGED its fiscal calendar

FAC census: month **7** for 1998–2001 and 2005–2008, month **1** for 2011–2023,
with a **9-month "other" period in 2010** — the transition stub. Its RLGF files
span FY2009–2025, straddling the change.

**The FY2016+ window is clear of it**: `MosRptd` = 12 and `MoChng` = "No" on
every modern filing. The change is a live trap for the FY2009–2015 follow-up,
not for this session. ⚠ Baldwin FY2020's `FYEmonth` is the unfilled placeholder
string `"MONTH"` — resolve from the census, never parse the placeholder.

---

## 5. Reading the files

These are **legacy BIFF8 `.xls`** (magic `d0cf11e0`). **ExcelJS — the reader
every other TT loader uses — cannot open them at all.**

Rather than add an npm XLS dependency, `scripts/tools/xlsToXlsx.py` converts at
the fetch stage, the same way TT already shells out to `pdftotext` and
`tesseract`. `--check` re-reads every written cell and diffs it against the
source. All **423,907 cells** across the 58 GA workbooks round-trip.

⚠⚠ **The converter found a silent-corruption class worth carrying to any future
xlsx writer:** openpyxl infers a FORMULA from any string starting with `=`, so a
text cell holding `='Page 1'!F22` is written as a formula and reads back as
`None` under `data_only=True` — **the value disappears with no error anywhere**.
Three such cells exist in the FY2014 `Exportable Data` sheets. Fixed by forcing
`data_type = "s"`, not by widening the tolerance.

Two difference classes ARE tolerated, both verified benign: prose-cell newline
normalisation (openpyxl rewrites each CRLF as two LFs), and float repr at ~1e-8
on already-fractional values, seen only in Part VII capital-asset rows.
⚠ The float guard must accept `int` as well as `float` — openpyxl reads a
whole-number cell back as an int, and an `isinstance(v, float)` test rejects a
2e-9 difference as material.

---

## 6. Scope taken this session

**FY2016–2025, the `LOAD1` form generation, 4 entities, 38 entity-years.**

Deferred, filed as follow-ups:

1. **FY2009–2015** (`Exportable Data`, 1,219 keys) — a different key set, so a
   second mapping. Smaller than it first looked: that generation is also
   machine-readable, not a page scrape.
2. **The statewide unlock** — 721 governments on the same URL pattern and the
   same `LOAD1` schema. Marginal cost is verification, not code. The Florida
   sweep shape.
3. **Macon-Bibb FY2016's 921-key variant** (vs 924) — unexplained; that year is
   parsed only if its key set covers the loaded tree.
4. **Macon-Bibb FY2024 is absent from DCA's own listing** — not a fetch failure.

---

# Wave 2 — Atlanta, Fulton and DeKalb (2026-10-17)

**Scope: FY2016–2025, the same `LOAD1` form generation, 3 entities, 27
entity-years.** No new parsing: the wave-1 loader read all 27 workbooks
unchanged. This wave is not a Knight community — it is the first use of the GA
route as an ordinary onboarding path, which is why
`scripts/data/georgiaKnightEntities.mjs` was renamed `georgiaRlgfEntities.mjs`.

## 1. Identity

| Entity | CICOID | DCA's own listing | Loaded |
|---|---|---|---|
| Atlanta City | `2060002` | FY2009–2025 (17) | FY2016–2025 (10) |
| Fulton County | `1060060` | FY2009–2024 (16) | FY2016–2024 (9) |
| DeKalb County | `1044044` | FY2009–2023 (15) | FY2016–2023 (8) |

⚠ **NAME-COLLISION TRAP, the wave-1 shape one metro over:** `South Fulton City`
(`2060505`) is a DIFFERENT government — a city incorporated in 2017, neither
part of Atlanta nor part of Fulton County. **Select by CICOID, never by name.**

⚠ **The CICOID independently corroborates Atlanta's parent county.** The middle
three digits are DCA's county number: Atlanta's `2060002` carries `060` =
Fulton (`1060060`), not `044` = DeKalb (`1044044`).

## 2. ⚠⚠ A STATUS CODE IS NOT EVIDENCE A FILING EXISTS

DCA serves a **1,245-byte HTML 404 page** for an absent year, and a *ranged*
request for that page returns **`206 Partial Content`**. A status-code probe
therefore reports **every year of every entity as present**, including the three
that do not exist.

The gaps above were found only by reading the **first four bytes**:

* a real filing is OLE2/BIFF8 → `d0cf11e0`
* the error page → `3c21444f` (`"<!DO"`)

Confirmed independently by driving the `Default.aspx` postback navigator, which
returns each entity's true `<a href>` list. Both routes agree exactly on all
three gaps. **Probe the bytes; let the converter's `--check` be the second gate.**

## 3. Fiscal calendars — the trap is inside one metro

| Entity | Start month | Form `FYEmonth` | FAC census |
|---|---|---|---|
| Atlanta | **7** | June 30 | month 7, 2011–2024 — CONFIRMS |
| Fulton County | **1** | December 31 | month 1, 1998–2021 — confirms, ⚠ list ends 2021 |
| DeKalb County | **1** | December 31 | month 1, 2003–2024 — CONFIRMS |

⚠⚠ **A city and both of its own counties disagree.** A loader resolving a month
once per state, or carrying one across a city/county boundary, would be wrong on
three of three. All 27 filings report `MosRptd` = 12 with no calendar change.

⚠ **Atlanta changed its fiscal calendar** — the Baldwin shape again. FAC: month
1 for 1999–2001 and 2003–2005, a **6-month "other" stub in 2006**, then month 7
from 2007. Entirely before the load window; a live trap for the FY2009–2015
follow-up.

⚠ **Fulton's FAC audit-year list ends at 2021**, so FY2022–2024 rest on the
filing's own `FYEmonth` alone. Weaker than two-source agreement, recorded as
such. It is NOT the Columbus-Muscogee case, where no census row exists at all.

## 4. Atlanta straddles a county line

Census Vintage 2024 splits the city's **520,070** people across two SUMLEV=157
county parts: **Fulton 477,903 (91.9%)** and **DeKalb 42,167 (8.1%)**, which sum
to the whole-place figure exactly.

TT's `county_id` is single-valued, so `parentCountyKey` is **Fulton — an
APPROXIMATION**, the same one Durham carries, not an identity like
Milledgeville's. DeKalb is loaded as a full entity in its own right and is
simply not reachable as Atlanta's parent. That is a limitation of the column,
recorded rather than papered over by calling a 91.9% share exact.

## 5. Audit branch

All three branches appear, and all three still grade `self_reported_unaudited`
(the wave-1 decision — DCA reconciles nothing):

* **Atlanta** — `YES` ×8, **not stated ×2** (FY2021, FY2022 carry raw `"0"`)
* **Fulton** — `YES` ×7, `NO` ×2 (FY2019, FY2024)
* **DeKalb** — `YES` ×7, not stated ×1 (FY2017)

⚠ Raw `"0"` is **NOT STATED**, never "No" — the wave-1 lesson, live again here.

## 6. ⚠⚠ The printed form's own total contradicts its own line items

**DeKalb County FY2020, Part V Section B (Judicial).** The first measured case
where **the printed form is wrong INSIDE the loaded Parts I–V scope**. Recorded
in `GA_FORM_TOTAL_DEFECTS` (`scripts/data/gaRlgfAnomalies.mjs`).

| | |
|---|---|
| Printed `Total Section 5B` | **$76,597,267.89** |
| Its own fourteen line rows sum to | **$86,076,708.72** |
| Shortfall | **$9,479,440.83** = UCOA 2800 Public Defender Administration, exactly |

### The stored formula, not an inference

Disassembling the BIFF8 token stream of that total row:

| Column | Stored range | A1 | Covers |
|---|---|---|---|
| **(a)** | `tArea (29,2)..(41,2)` | **`SUM(C30:C42)`** | 2100 … **2750** |
| (b) | `tArea (29,3)..(42,3)` | `SUM(D30:D43)` | 2100 … 2800 |
| (c) | `tArea (29,4)..(42,4)` | `SUM(E30:E43)` | 2100 … 2800 |
| (d) | `tArea (29,5)..(42,5)` | `SUM(F30:F43)` | 2100 … 2800 |

Column (a) stops one row short of its own siblings. In **FY2016–2019 and
FY2021–2023 all four columns span `(29,c)..(42,c)`** — FY2020 column (a) is the
sole outlier in eight years.

⚠ **It is invisible on the printed page because columns (b), (c) and (d) are all
$0.00** — the short range and the correct ranges produce identical visible
output. Only the arithmetic, or the token stream, shows it.

### The same gesture broke LOAD1 twice more

`2200A` (District Attorney) is a `tRefErr3d` **`#REF!`**; `2800A` is a `tRef3d`
pointing at **Page 3 row 33 — the District Attorney's row, not row 42**. So the
Public Defender's money is carried by **no LOAD1 key at all** and the DA's
figure appears twice. Summing the broken extract reproduces the short printed
total **exactly**: `56,261,497.44 + 20,335,770.45 = 76,597,267.89`.

The identical fingerprint appears in **Part IV** of the same workbook
(`34_4160` orphaned, `34_4130` re-pointed to Page 2 row 63) — one editing pass
touched both pages.

### What TT does

**The line items load; the broken total does not.** Both figures are the
government's and the document contradicts itself, so this is neither the
Milledgeville case (a verified figure that merely looks wrong) nor a
read-fidelity failure (TT reproduces both numbers exactly). When a document
disagrees with itself, the sum of its own detail is the better reading — and
both numbers are recorded so the choice stays visible and reversible.

⚠ **The gate is not weakened.** `loadGeorgiaRLGF.mjs` still refuses any filing
whose sections do not tie, unless a registry entry pins **the form's total, the
items' total AND the shortfall, all to the cent**. A different size, section,
year or entity still refuses. The Part V grand total is explained only as the
**sum** of explained section shortfalls, never on its own. Nine tests in
`tests/gaRlgf.test.mjs` hold that line.

### Corroboration

Two independent agents, neutral prompts, raw sources, neither told the
conclusion nor shown the other's work:

* one audited the arithmetic of all eight DeKalb filings in `Decimal` and
  disassembled the BIFF8 formula tokens — **223 of 224 section-column checks
  tie**; all 10,750 numeric cells agree between the `.xls` and TT's `.xlsx`;
  the LOAD1 Part V key set is a perfect bijection with the page key set in
  every year.
* one read DeKalb's own CAFRs — **Public defender actual $11,038K (2020)**,
  $9,447K / $10,355K / $9,979K / $12,447K across 2018–2022. A real, material,
  recurring line, so a Judicial total excluding it is understated.

⚠ No allegation is made or implied. This is routine spreadsheet mechanics on a
hand-maintained form, it understates rather than inflates, and DeKalb's other
seven years are internally flawless.

## 7. Open follow-ups from wave 2

1. ✅ **DeKalb FY2018 — CORROBORATED AND FLAGGED 2026-10-17.** See §8 below.
2. **FY2009–2015 for all three wave-2 entities** (`Exportable Data`, 1,219
   keys). ⚠ Atlanta changed its fiscal calendar inside that range — month 1
   through 2005, a 6-month stub in 2006, month 7 from 2007.
3. **Fulton FY2025 and DeKalb FY2024/FY2025** do not exist yet; re-check the
   listing rather than assuming a fetch failure.

---

## 8. ✅ DeKalb FY2018 — corroborated, flagged, and still loaded

The §7 observation was put to **two independent agents, neutral prompts, neither
told the conclusion nor shown the other's work**, approached differently: one
characterised the eight filings from the **raw workbooks only**, one read
**external published sources only**. They converged.

### What the filing says, and what the county says

| | |
|---|---|
| RLGF FY2018 Part V (what TT loads) | **$92,044,262** |
| DeKalb's own AUDITED CAFR, governmental funds, same calendar year | **$654,486,000** |
| The filing reports | **14.1%** of the audited figure |

DeKalb additionally books **enterprise/utility spending inside Part V**, so the
truly comparable figure is higher still.

### It is pervasive, not sectional

Restricted to the 47 lines non-zero in 2017, 2018 **and** 2019: FY2018 is
**0.102** of the two-year average, per-line **median 0.0867**, with **34 of 47
lines (72%) between 1/14 and 1/8**. The external agent measured the same thing
through a different channel and got a **median 11.4x** shortfall over 56 lines.
Two methods, no contact, same order of magnitude.

| Line | 2017 | **2018** | 2019 |
|---|---|---|---|
| Police Protection | 79,199,817 | **6,458,448** | 77,561,454 |
| Fire Protection | 52,256,028 | **4,318,276** | 53,825,220 |
| Jail Operations | 50,202,147 | **3,468,510** | 54,842,841 |

⚠⚠ **The REVENUE side of the same filing is a full twelve months** — Parts I–III
$921,906,986, median line ratio 0.965. Revenue intact, expenditure at ~1/12.

### Why it is a real defect and not a real year

* **The audited control total has never been restated.** The 2018 column is
  reprinted unchanged in the 2019, 2020, 2021 and 2022 ACFRs, and the printed
  "excess of revenues over expenditures" row (+$44,458K) ties exactly.
* **The audited series is monotonic**: $591,662K → $620,072K → **$654,486K
  (+5.6%)** → $717,066K → $834,890K. 2018 is not an outlier in DeKalb's real
  finances.
* **Triple-sourced inside the file** — LOAD1, the printed pages and a direct
  `xlrd` read of the BIFF8 original agree to the dollar.
* **Reproduced through a second publisher pipeline** — UGA's TED export returns
  the identical $92,044,262. ⚠ TED republishes the same DCA survey, so it is an
  independent **access path**, not an independent **measurement**; what it proves
  is that the defect is in the filing **as submitted**.
* **Entity-specific, measured twice.** TT's Fulton and Atlanta run smooth through
  FY2018; pulled the same way from TED, Fulton, Cobb, Gwinnett, Clayton and
  Chatham all sit in line with their own neighbours. No statewide FY2018 problem.
* **The form offers no explanation.** `MosRptd` = 12, `MoChng` = No, Part XV
  certifies "uses AUDITED Figures = YES" (approved 2019-06-28), and the
  DCA-provided note sheet is the blank template.

**Leading benign explanation:** a **partial-period extract** — the expenditure
side of the GL query run for a single accounting period while revenue was pulled
year-to-date. A ~1/12 ratio across every function with ordinary per-line
lumpiness is exactly that shape. FY2018 is also the only DeKalb year with the
**preparer-name block blank**, fitting a draft filed and never amended.
⚠ **Ruled out:** a units error (would be 0.001 and uniform) and a narrower fund
scope (would remove whole functions, not shave every one alike).

### ⚠⚠ TT LOADS $92,044,262 — the Milledgeville Rule

The figure stays exactly as filed and is flagged. TT does **not** substitute the
county's audited $654,486,000: that would assert a figure this publisher never
reported, which is the Dallas-$0 / LA-TRAN failure mode, not this one. The
source said exactly this, so it loads and it gets flagged.

### A second, differently-shaped defect in the same entity

**FY2017 omits the utility lines.** Storm Drainage, Wastewater, Water, Solid
Waste Administration and Solid Waste Collection are **all $0** in FY2017, while
the non-utility 5D lines are ordinary full-year figures — so this is a
**category omission**, not the FY2018 scaling.

| UCOA | 2016 | **2017** | 2019 |
|---|---|---|---|
| 4250 Storm Drainage | 10,727,035 | **0** | 12,780,368 |
| 4400 Water | 155,071,343 | **0** | 141,615,361 |
| 4510 Solid Waste Admin | 41,513,503 | **0** | 43,798,568 |

FY2017 reports $336,041,721 of Part IV enterprise revenue and **$0** of Part VI
enterprise expense, so ~$230M of enterprise cost appears nowhere.

⚠⚠ **The wider consequence matters more than the one year: DeKalb books
enterprise/utility spending INSIDE Part V** (Water alone runs $141M–$201M). So
TT's DeKalb operating series is **gross** of utility operations in most years and
**net** of them in FY2017 — not year-over-year comparable, and not comparable to
an entity that reports utilities in Part VI. This is exactly why these rows carry
`fund_scope = unknown`.

### ⚠ Still open after this

* **The flags are repo-only.** `GA_FIGURE_FLAGS` is read by no UI code — grep
  confirms nothing under `src/` consumes it. Memory is explicit that *"an anomaly
  flag is evidence to publish, not a reason to withhold; surfacing it to readers
  is the goal, a registry in the repo is the minimum."* **TT is at the minimum.**
  Surfacing these to readers is its own piece of work.
* **Fulton FY2021 section 5F** is $622,851 against $31M–$44M in every other
  Fulton year — the FY2017-DeKalb shape, **inside the loaded scope**, noticed in
  passing and **NOT corroborated**. An open observation, not a finding.
* **FY2018 revenue categories** are not comparable either, though the total is in
  trend: General Business Licenses $0 in FY2018, and the sanitation/water/sewer
  service-charge categories re-mapped that year.
