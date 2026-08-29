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
