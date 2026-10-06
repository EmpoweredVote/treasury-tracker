# Redmond + Duvall onboarding, and the accounting-basis axis

**Date:** 2026-10-06
**Status:** design, approved in chat 2026-10-06
**Branch:** `feat/redmond-duvall-accounting-basis`

Onboard two King County, WA cities and add the schema axis the second one
forces: **Redmond** (GAAP, the existing WA SAO path) and **Duvall** (cash-basis
BARS, TT's first Washington OCBOA filer).

Everything below about the two documents was **measured during the 2026-10-06
probe**, not inferred. Nothing here is carried from another entity.

---

## 1. Why this is three pieces, not two

Redmond is a repeat of Bellevue/Kent/Everett. Duvall is not a GAAP filer at
all, and loading it alongside Redmond would let TT draw a cash-basis General
Fund against a GAAP one with nothing but a chip to tell them apart. So:

1. **Redmond** — per-entity config over `scripts/lib/acfrGF.py`.
2. **Duvall** — per-entity config over the same library, `audited_ocboa`.
3. **`accounting_basis`** — a new axis on `treasury.budgets`, plus a
   comparability rule that refuses a GAAP-vs-cash comparison.

Piece 3 is the only one that touches shared code. It also retroactively covers
Brown County SD and Aberdeen SD, which have this exposure in production today.

---

## 2. Redmond, WA — MCAG 0425

King County. Source: `portal.sao.wa.gov` ReportSearch, the same single host as
every other WA entity in TT, so every row cites a State Auditor report.

**Whole dollars** (`units=1`), confirmed by `unitsOf()` on every readable year.
Not thousands — Tacoma and Bellevue are the thousands issuers; never carry that
setting here.

The report-type inversion holds exactly as `scripts/lib/waSao.mjs` documents:
all 14 reports typed `Annual Comprehensive Financial Report` are 2–5 page
opinion letters, and the statements live in `Financial and Federal` /
`Financial`. Select by `classifyReport()`, never by type name.

### 2.1 Measured year-by-year disposition

All 21 filings FY2004–FY2024 pass `classifyReport()` (≥40pp with a governmental
funds anchor). Page identity is where they diverge. **15 of 21 resolve to
exactly one candidate page** — no ambiguity anywhere, which matters because
ambiguous page identity is fatal, not a warning.

| Years | Finding | Disposition |
|---|---|---|
| FY2004, FY2005 | CCITT stencil scans, 300dpi, 1–2 money tokens in the entire document | **Exclude** — image-only |
| FY2006 | Caption reads `Changes in Fund Balance`, **singular** | Load — `statement_anchor` |
| FY2007–FY2010 | Statement **split across two pages** (`Page 1 of 2`) | Load — `multipage=True` |
| FY2011–FY2016 | Clean, single page, one candidate | Load — no special config |
| FY2017, FY2018, FY2019 | **Ciphered text, digits absent** (§2.2) | **Exclude** — unreadable |
| FY2020–FY2024 | Clean, single page, one candidate | Load — no special config |
| FY2025 | Not released by SAO | Excluded, source timing |

**Expected load: 16 years** — FY2006–FY2016 and FY2020–FY2024.
`manifestSpan: [2004, 2025]`, with five `excludedYears` plus FY2025.

The two-page split is **not** a new defect class. `CityConfig.multipage` /
`multipage_max` already exist, added for Brown County SD whose statement spans
four pages. Redmond needs `multipage=True`; `multipage_max` stays at its default
of 6.

### 2.2 The FY2017–FY2019 cipher — why these are exclusions, not bugs

The statement page is present and its labels are intact, but shifted by a
constant 29 bytes:

```
&,7<2)5('021'              -> CITY OF REDMOND
67$7(0(172)5(9(18(6        -> STATEMENT OF REVENUES
$1'&+$1*(6,1)81'%$/$1&(6   -> AND CHANGES IN FUND BALANCES
```

Decoding is trivial (`chr(b + 29)`) and recovers every label and every column
header. **It does not recover a single digit.** Under this shift an original
`'0'`–`'9'` would land on bytes `0x13`–`0x1C`; the extracted page contains
**zero bytes in that range**. The year is missing from `FOR THE YEAR ENDED
DECEMBER` for the same reason.

This is the Bainbridge FY2010 outcome repeating: labels decode, money does not,
because the digits are absent from the text stream rather than encoded. A
decode that returns a complete tree of correctly-named rows and no money is not
a partial success — there is nothing to load.

⚠ These are the **same fiscal years** Kitsap was excluded for
(`font defect, digits absent`, FY2017–FY2019). That is now two WA entities,
independently audited, losing exactly FY2017–FY2019 to a digit-level text
defect. Treat it as an SAO-side production-era defect and **probe FY2017–FY2019
first on any future WA entity** — it is the cheapest year range to rule out.

⚠ Do not record this as "FY2017–FY2019 are scans". They are not. FY2004/FY2005
are scans (CCITT stencils, no text layer); FY2017–FY2019 have a rich text layer
with no digits in it. The two need different probes to detect.

### 2.3 Still to be derived during recon

- **ARNs** are pinned in §6 and were resolved against the live registry.
- **Population** — read from `ofm_april1_population_final.xlsx`, sheet
  `Population`, the **2025** column, `Filter=4` city rows, and record the line
  number in `populationNote`. The WA cohort shares the 2025 denominator so
  per-capita stays comparable; do not use the 2026 column for one entity.
- **`perCapitaBand`** — derive from the loaded spread, never inherited. Kent's
  band would have rejected Everett outright and they are neighbours by size.
  Loader band ≈ 0.5×min .. 2×max; harness band tighter.
- **`parents` / `root_leaves`** — determine with `pdftotext -layout` across all
  16 loadable years. The tree shape is per-city and can invert: Bellevue prints
  `Capital outlay` as a PARENT where five other WA cities print it as a valued
  root leaf. Guessing produces a $0 tie with a wrong tree.
- **`column_strategy`** — probe for incomplete rows. No incomplete rows in any
  year ⇒ ordinal is safe; otherwise positional.

---

## 3. Duvall, WA — MCAG 0391

King County, ~10 miles from Redmond, and **not a GAAP filer**.

### 3.1 What the documents actually are

18 filings FY2004–FY2025. **Zero pass `classifyReport()`**, and this is correct
behaviour rather than a gap to close: most are under the 40pp threshold and
none carry a GAAP governmental-funds statement, because none exists. The
auditor says so outright:

> "...the financial statements are prepared by the City using accounting
> practices prescribed by the BARS Manual, which is a basis of accounting other
> than GAAP... Government-wide statements, as defined in GAAP, are not
> presented."

The opinion is split and both halves matter: **unmodified on the regulatory
(BARS) basis, adverse on U.S. GAAP.** Duvall is genuinely audited. It is simply
not measured the way Redmond is.

What it does publish, every year, is *Fund Resources and Uses Arising from Cash
Transactions*, carrying a `001 General Fund` column beside a
`Total for All Funds (Memo Only)` column, on the Washington BARS chart of
accounts:

```
310  Taxes                        320  Licenses and Permits
330  Intergovernmental Revenues   340  Charges for Goods and Services
510  General Government           520  Public Safety
530  Utilities                    540  Transportation
```

### 3.2 Why this needs no new extractor

`acfrGF.py` reads statements; it is not GAAP-specific. The shape Duvall prints
is already covered:

- **`leading_account_code=True`** — added for Aberdeen SD, which prints the
  South Dakota chart of accounts (`310 Taxes`, `335.01 Bank franchise tax`).
  Duvall prints the same shape. Without it `_MONEY` reads `310` as a value, every
  group heading becomes a ~$310 leaf, no group opens, and the tree comes back
  flat while the total is only slightly over — small enough to look plausible.
- **`target_column`** — selects `001 General Fund` past the memo column.
  ⚠ The memo column is **first**, so a `target_column=0` default would load
  all-funds money under a General Fund label and tie at $0 while doing it.
- **`units=1`** — whole dollars, confirmed on the FY2023 statement.
- **`revenue_section_header` / `revenue_total_labels`** — BARS names its
  sections differently (`Total Revenues:`, `Total Expenditures:`, with trailing
  colons). Set from the document.

Precedent for the whole approach is `scripts/extractBrownCountySD.py`: an OCBOA
filer, read by this same library, in **134 lines**.

### 3.3 Grading and scope

- **`audit_grade = 'audited_ocboa'`.** The value exists for exactly this case —
  equivalent assurance, different measurement basis. `audited_gaap` would be a
  false public claim; `self_reported_unaudited` denies a real audit; `unknown`
  claims nobody looked.
- **`accounting_basis = 'cash'`** (§4). Brown County SD is `modified_cash`;
  these are different bases and must not be merged into one value.
- **`fund_scope = 'general_fund'`**, with a caveat to verify at recon: Duvall's
  own notes state *"The 002 Contingency Fund and 103 Strategic Fund are rolled
  up into the 001 General Fund."* That is the city's own definition of its
  General Fund, so `general_fund` is right — but it must be recorded, because it
  is a real difference from a city that reports those separately.
- Every row needs a `source_url`; a non-`unknown` `audit_grade` without one is
  rejected by the database.

### 3.4 Year disposition

All 18 own-titled financial filings are candidates. Gaps exist in the SAO
record at FY2010, FY2012, FY2014, FY2022 — **verify at recon whether these are
genuinely absent or covered by a two-year audit period**, since small WA cities
are commonly audited biennially and `EndAuditPeriod` would then name only the
later year. Do not record a gap as an exclusion until that is checked.

---

## 4. The `accounting_basis` axis

### 4.1 The problem

Today the GAAP/non-GAAP distinction exists **only as text inside the
`data_source` string** (`'modified cash basis'` vs `'GAAP basis'`), matched by
regex in `scripts/data/auditGradeRegistry.mjs`. That is precisely the pattern
`scripts/lib/fundScope.mjs` was written to forbid: *"Read a loader's actual
input before believing what its source string calls itself."* A `special_revenue`
scope was once added on the strength of a source string and later removed as
wrong.

`treasury.budgets.basis` cannot carry this. It is constrained to
`('actual','adopted','unknown')` and means **closed-year actual vs adopted
budget** — a different axis that already earns its keep. Overloading it would
destroy both meanings.

### 4.2 The column

```sql
ALTER TABLE treasury.budgets
  ADD COLUMN accounting_basis text NOT NULL DEFAULT 'unknown'
    CONSTRAINT budgets_accounting_basis_check
      CHECK (accounting_basis IN ('gaap','modified_cash','cash','unknown'));
```

- **Additive and safe.** No existing row is read or changed; every current row
  becomes `unknown`, which is the honest value for a row nobody has adjudicated.
- **`unknown` is a correct outcome, not a shortfall** — same discipline as
  `fund_scope`, `basis` and `audit_grade`. Nothing is classified by absence.
- **Stamped per source from evidence**, through a registry entry carrying the
  document it was read from — mirroring `auditGradeRegistry.mjs`. An unevidenced
  entry must be structurally incapable of classifying.
- **Orthogonal to `audit_grade` on purpose.** An unaudited cash-basis source is
  describable; deriving basis from `audited_ocboa` would make it invisible and
  would re-encode the confusion the OCBOA migration was written to escape.

The four values are grounded in documents TT already holds or is loading — GAAP
(Redmond, Aberdeen SD), modified cash (Brown County SD), cash (Duvall) — plus
`unknown`. No speculative values.

### 4.3 The comparability rule

> **Refuse a comparison only when both bases are known and different.**
> `unknown` on either side preserves today's behaviour exactly.

This is the load-bearing decision. The inverse rule — *comparable only if both
are known and equal* — would be defensible in the abstract and catastrophic in
practice: the column starts at 100% `unknown` and will stay mostly `unknown` for
a long time, exactly as `audit_grade` is 68% `unknown` today. That rule would
switch off cross-entity comparison across nearly the whole site on the day it
shipped.

So the gate fires only on a **proven** mismatch — Duvall vs Redmond, Brown
County SD vs Aberdeen SD — and is otherwise invisible. This is the same
failure-direction discipline `fundScope.mjs` already applies, pointed at the
other error: there, never declare two figures comparable without evidence; here,
never declare them *in*comparable without evidence either.

Implementation goes beside `isComparableScope()` in `scripts/lib/fundScope.mjs`,
which already keeps its non-comparable set as a list behind a function for this
kind of extension. It stays pure — no DB, no network — so the rule deciding
whether two governments' figures may be charted together is testable without a
database.

### 4.4 Reader-facing

`src/components/ScopeLabel.tsx` already renders `audited_ocboa` and already
shares one colour across every graded value, deliberately: colour is a ranking
whether or not you intend it, and these values are not a ranking. The
accounting-basis chip follows the same rule — **the words carry the
distinction, never the palette.**

⚠ `bg-ev-gray-050`, not `-50`. A bad Tailwind colour class is dropped silently.

### 4.5 Backfill

Stamp from the registry only, for sources whose documents have actually been
read:

| Source | Value | Evidence |
|---|---|---|
| Redmond SAO GF | `gaap` | statements titled per GAAP, unmodified opinion |
| Duvall SAO BARS | `cash` | adverse GAAP opinion, BARS manual cited |
| Brown County SD | `modified_cash` | statements titled `- MODIFIED CASH BASIS`; FAC `gaap_results = not_gaap` |
| Aberdeen SD | `gaap` | GAAP basis, already labelled so in its loader |

Everything else stays `unknown`. **No bulk `gaap` backfill** — assuming GAAP for
every unexamined row is the same unevidenced assertion this axis exists to
prevent, and it would silently mark ~60k rows with a claim nobody checked.

---

## 5. Verification

Per-entity harnesses follow the established WA pattern — blind re-derivation,
audit checks, tether — with the additions this work forces:

1. **Blind re-derivation at $0** for all 16 Redmond years and every loaded
   Duvall year, re-derived from the PDF independently of the loader.
2. **Label-surface assertions.** A label defect is invisible to every arithmetic
   gate: Bainbridge shipped a category named `____…____ Interest and Investment
   Revenue` to production with a correct figure and a $0 tie. Assert the strings.
3. **Per-entity consistency**, not a shared whitelist.
4. **Exclusion assertions.** Each of Redmond's five excluded years must have
   **zero rows**. Every exclusion is a deliberate refusal to publish; a row
   quietly appearing for FY2017 would mean unadjudicated money shipped.
5. **The cipher probe**, as a test: assert FY2017–FY2019 yield no digits, so a
   future library change that appears to "fix" them has to prove it recovered
   real money rather than decoded zeros.
6. **`accounting_basis` constraint parity** — a test asserting the JS vocabulary
   and the SQL CHECK constraint are the same set, as `SCOPE_VALUES` already does.
   A value in one and not the other is a write that fails in production.
7. **The comparability rule is mutation-tested.** A gate that cannot be shown to
   fail is a gate that passes vacuously forever.
8. **sha256 of every PDF pinned.** Check for mismatches *before* re-recording;
   `--record-sha` would otherwise silently bless a changed file.

---

## 6. Pinned ARNs (resolved against the live registry, 2026-10-06)

**Redmond, MCAG 0425** — loadable years only:

```
2006: 73631     2007: 75373     2008: 1002098   2009: 1003929
2010: 1006714   2011: 1008494   2012: 1010466   2013: 1012425
2014: 1014930   2015: 1017176   2016: 1019544   2020: 1029176
2021: 1031765   2022: 1035798   2023: 1038568   2024: 1040508
```

Excluded: FY2004 `69504`, FY2005 `71153` (scans); FY2017 `1021971`,
FY2018 `1024295`, FY2019 `1027556` (cipher).

**Duvall, MCAG 0391** — candidates, to be confirmed at recon:

```
2004: 69662     2005: 71025     2006: 73981     2007: 1000252
2008: 1002034   2009: 1004186   2011: 1009156   2013: 1013701
2015: 1018682   2016: 1019869   2017: 1023192   2018: 1025265
2019: 1027182   2020: 1029480   2021: 1032480   2023: 1036127
2024: 1038791   2025: 1040405
```

⚠ MCAGs are **strings**; leading zeros are significant. Both were resolved
against the live SAO registry, not inferred — `0425` returned
`City of Redmond` and `0391` returned `City of Duvall`.

---

## 7. Out of scope

- **Other WA BARS cities.** Duvall is the first, and most small WA cities file
  this way, so the config built here is a template for a large class. That
  expansion is its own project with its own recon.
- **Backfilling `accounting_basis` beyond the four sources in §4.5.**
- **Banner assets.** Neither city is assumed to have one; check the bucket and
  fall through to the Wikipedia default rather than inferring a credit from a
  filename.
- **Essentials tether.** The live catalog answers; do not assert coverage.

---

## 8. Things that will bite

- **`py` and `python` on PATH are Microsoft Store stubs.** Use
  `scripts/lib/pythonBin.mjs` `resolvePython()`, never a hardcoded path.
- **`docs/*` is gitignored** — specs and plans are force-added (`git add -f`).
- **Never bulk-edit a source file with PowerShell + `Set-Content -Encoding
  utf8`** — it adds a BOM and rewrites every line ending. Use Edit.
- **No shebang on anything under `scripts/lib/`.** A test guards it; a `#!` plus
  CRLF breaks the whole Vite suite with an error naming no file.
- **`treasury_sync_city_budget` keys on fund_scope+basis, not data_source.**
  Omitting a key on a re-run duplicates rows.
- **A new fiscal year arrives `basis=unknown`** and must be stamped.
- **Branch and open a PR.** Never push directly to `main`.
