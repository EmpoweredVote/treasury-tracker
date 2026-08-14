# Seattle, WA + King County Onboarding — Design

**Date:** 2026-08-13
**Status:** Approved for planning
**Entities:** City of Seattle (city), King County (county)

## Goal

Seed Treasury Tracker with real, sourced General Fund finances for the City of
Seattle and King County, on the same basis as every existing TT city, so that
`treasurytracker.empowered.vote` can show `US → Washington → King County → Seattle`
with an icicle drill-down on both Money Out and Money In.

Washington already exists as a **state** node (12 ACFR rows, from v2.15). Neither
Seattle nor King County exists in `treasury.municipalities` today. This is a fresh
two-entity onboarding, not an edit.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Fund scope | **General Fund only** | Matches all 8 existing TT cities (Tucson, Bend, Sherwood, Tualatin, Beaverton, Hillsboro, Tigard, Cornelius). One comparable basis across the app. |
| Seattle window | **FY2009–FY2025** (17 years) | Full published archive. Deepest city in TT. |
| King County | **Node + its own finances**, FY2018–FY2025 (8 years) | User elected real county finances, not a nav-only node (which is the Pima/Dane precedent). FY2018 recovered from the Internet Archive — see the dig below. |
| Datasets | `operating` + `revenue` | Standard TT pair. |
| Source | Per-entity **ACFR (GAAP), free / no auth** | No usable WA statewide bulk source (see below). |

Expected volume: Seattle 17 × 2 = 34 rows, King County 8 × 2 = 16 rows, **~50 rows**.
Final window is whatever the tie gate accepts; excluded years are documented, never coerced.

## Source selection

**Rejected: WA SAO Financial Intelligence Tool** (`portal.sao.wa.gov/FIT/`). SAO
collects BARS-schedule annual filings from every WA local government and publishes
them through FIT, which is a JavaScript/Power-BI portal — a plain fetch returns an
empty shell with no bulk CSV/XLSX download and no documented API. It remains the
strongest lead for a future *all-Washington* milestone (it is the WA analogue of the
VA APA / NC LGC / FL DFS bulk sources) but it is not needed for, and should not
block, Seattle.

**Selected: per-entity ACFRs.** Both entities publish deep, cleanly-extractable
archives over plain HTTPS.

### Seattle

Base: `https://www.seattle.gov/documents/Departments/CityFinance/FinancialServices/CAFR/`

| FY | Filename | Fetch verified |
|---|---|---|
| 2025 | `2025 Annual Comprehensive Financial Report - City of Seattle.pdf` | ✅ 200, 5.58 MB |
| 2024 | `2024 Annual Rep - City of Seattle.pdf` | ✅ 200, 6.15 MB |
| 2023 | `2023 Annual Report - City of Seattle.pdf` | not yet |
| 2022 | *(different path)* `Departments/InvestorRelations/2023 Documents/2022 Annual Report Final Draft 2023-06-29.pdf` | not yet |
| 2021–2019, 2017–2009 | `comprehensive-annual-financial-report-<YYYY>.pdf` | 2019 ✅ 200, 2015 ✅ 200, 2009 ✅ 200 |
| 2018 | *(exception to the pattern)* `CAFR 2018 10-28.pdf` | not yet |

Filenames are inconsistent per era and **2022 lives on a different path entirely**.
Per the ACFR-recon rule, URLs are re-verified at load time; the recon table is a
starting point, not a contract.

### King County

Base: `https://cdn.kingcounty.gov/-/media/king-county/depts/executive-services/finance-business-operations/financial-management/financial-reports/acfr/`
Pattern: `<YYYY>-acfr-en.pdf` — the `rev=`/`hash=` query strings on the index page
are **not required**; the bare URL serves the PDF.

Verified: 2025 ✅ 200 (13.5 MB), 2024 ✅ 200 (5.6 MB), 2019 ✅ 200 (12.9 MB).
2018 / 2016 / 2014 return an honest **HTTP 404 with a 1,245-byte HTML body** —
distinguishable from a real document, so there is no Beaverton-style soft-404 trap
here.

#### FY2018 — Internet Archive (the only recoverable pre-2019 year)

```
https://web.archive.org/web/20201029080417id_/https://www.kingcounty.gov/~/media/depts/finance/financial-management-services/CAFR-2018/2018-comprehensive-annual-financial-report.ashx?la=en
```

Fetch with the `id_` suffix (raw bytes); cite the human-facing form without it.
Verified 275 pages, 670,846 characters of real digital text, statement on p43,
**both modes tie $0** — revenue `863,031`, expenditure `767,457 + 5 + 2,635 = 770,097`.

This is a **new provenance class for TT**: no existing row cites an archive. The
decision to accept it was explicit — the figure is audited and ties, and the snapshot
resolves today, where the issuer's own URL does not. TT has no field for provenance
class (that is `SRCSTD-01`'s job), so this is recorded here rather than in the schema.

#### The pre-2019 dig — do not repeat it

Six routes checked 2026-08-13; **FY2018 is the only recoverable year.**

| Route | Outcome |
|---|---|
| Live CDN | 2019–2025 only |
| `kingcounty.gov/en/legacy/.../acfr` | Same 2019–2025, no extra years |
| Retired Sitecore media URLs (`/~/media/depts/finance/financial-management-services/...ashx`), recovered from an archived index listing 2007–2018 | **All 404 live** — path fully decommissioned |
| Wayback | PDF bodies for only 2007, 2015, 2017, 2018 |
| WA SAO ReportSearch API | 20 ACFR filings FY2006–FY2025, but each is a **3-page auditor's opinion letter**, not the statements |
| BondLink (`kingcountybonds.com`) | 2025 only |

And the recovered files mostly disqualified themselves:

- **2007 — scan.** 3,239 text characters across 279 pages.
- **2015 — scan.** 38,551 characters across 238 pages.
- **2017 — truncated capture.** Exactly 1,048,576 bytes (2²⁰); `pdfinfo` cannot read a
  page count. A file size that is exactly a power of two is the tell.
- **2008–2014, 2016 — never captured anywhere reachable.**

Not OCR'ing 2007/2015 is deliberate, following the Sherwood FY2019 precedent.

**Useful by-product — the SAO ReportSearch API is now mapped** (worth keeping for a
future all-Washington milestone, and for `SRCSTD-01`, since the opinion letters are
exactly the audit-grade attestation that project wants):
- `https://portal.sao.wa.gov/ReportSearch/Home/GetEntities?NameStartsWith=<name>` → MCAG lookup
- `https://portal.sao.wa.gov/ReportSearch/Home/SearchReports?...` → report list.
  Params are `pageSize` + **`pageNumber`** (not `page`) + `MCAGList`, and it **500s
  unless all six booleans are present**: `HasFindings`, `StateGovernment`,
  `LocalGovernment`, `PerformanceAudits`, `SpecialInvestigations`,
  `UseOfDeadlyForceInvestigation`, plus `PoliceCertificationAudit`.
- `https://portal.sao.wa.gov/ReportSearch/Home/ViewReportFile?arn=<ARN>&isFinding=false&sp=false` → PDF
- **King County's MCAG is `0127`**, not `0300`.
- SAO bound full financial statements into its audit reports **pre-2008** and stopped —
  which is why the oldest King County report runs 153 pages and modern ones run 3.

## Fetching

Plain `curl` works for both hosts with a browser UA plus `Sec-Fetch-Mode: navigate`,
`Sec-Fetch-Dest: document`, `Upgrade-Insecure-Requests: 1`. **No WAF fight, no
`fetchViaBrowser.mjs`, no Chromium.** PDFs land in gitignored `docs/Seattle/` and
`docs/KingCounty/`.

## Source structure — what the probes actually found

Every figure below was read out of the real PDFs with `pdftotext -table`, and every
tie stated was computed by hand from the extracted components against the document's
own printed total.

### Seattle FY2024 (PDF p56) — ties $0 both modes

- **Revenue** — 11 sources sum to `2,272,762` = printed Total Revenues ✓
  `Taxes` is a **parent** with 5 children (Property / Sales / Business / Excise / Other),
  then 7 flat siblings.
- **Expenditures** — `Current` (8 functions) `2,303,760` + `Capital Outlay` (8) `86,815`
  = `2,390,575` = printed Total Expenditures ✓. `Debt Service` is $0 in the GF.

### Seattle format eras

| Era | Layout | Traps |
|---|---|---|
| **2009** | Statement **split over 2 pages**; GF column entirely on page 1, so the GF tie is self-contained | `-` dash-zero; label drift (`Parking Fees and Space Rent` vs later `Concessions, Parking Fees and Space Rent`); `Taxes` flat |
| **2015** | One page, 4 fund columns **+ two comparative-year columns (2015 and 2014)** | prior-year column is mistakable for a fund; wrapped label `Program Income, Interest, and Miscellaneous / Revenues`; `Taxes` flat; `Low-Income Housing` is a major fund that later disappears |
| **2024–25** | One page, 3 funds + total | `Taxes` becomes a parent with 5 children |

FY2015 GF revenue sums to `1,218,733` = printed total ✓.

The statement title **wraps** in older vintages (`...EXPENDITURES, AND CHANGES` /
`IN FUND BALANCES`), which is the Sherwood/Tualatin wrapped-title trap. It is tagged
**`B-4`** in every vintage checked (2009, 2015, 2019, 2024, 2025) — anchor on the
schedule ID, not the title.

### King County FY2024 (PDF p48–49) — ties $0 both modes

Statement splits over two pages; **the GF column is wholly on page 1**.

- **Revenue** — 9 sources sum to `1,202,912` = printed Total revenues ✓.
  `Taxes:` is a **parent** with 3 children (Property / Retail sales and use / Business and other).
- **Expenditures** — `Current:` (7 functions) `1,109,910` + `Debt service:` (2) `10,664`
  + `Capital outlay` (root leaf) `16,884` = `1,137,458` = printed Total ✓.

King County vocabulary differs from Seattle's — `Intergovernmental revenues` vs
`Grants, Shared Revenues, and Contributions`; `Investment gains` vs `Program Income,
Interest, and Miscellaneous Revenues`; `Law, safety and justice` — confirming the
Ohio-AOS lesson that county documents use their own taxonomy. Its expenditure tree is
the **Bend/Tualatin shape**: `parents=('current','debt service')`,
`root_leaves=('capital outlay',)`.

**King County FY2018 era differs from FY2024** — verify per era, do not assume:
- Totals are printed **UPPERCASE** (`TOTAL REVENUES` / `TOTAL EXPENDITURES`) vs
  title-case later. Matching must stay case-insensitive.
- An extra debt-service child, `Payment to escrow`, that FY2024 does not have.
- Fund columns differ (`Behavioral Health` / `Nonmajor Governmental` / `Total
  Governmental` in 2018 vs `Behavioral Health` / `Housing and Community Development`
  in 2024).
- `-table` output is **visibly ragged** in 2018 — some GF values render at an
  x-position closer to the neighbouring column. Nearest-anchor isolation recovers
  them correctly (the components sum to the printed GF total at $0), but this is the
  era most likely to break a naive fixed-column reader.

### ⚠ Both entities print **(IN THOUSANDS)**

This is new. Every existing TT city prints whole dollars, and `grep` confirms
`scripts/lib/acfrGF.py` has no unit handling whatsoever.

## Architecture

Reuse the proven pipeline; extend the shared library rather than forking it.

### 1. `scripts/lib/acfrGF.py` — three new config-driven capabilities

`CityConfig` today carries `parents`, `root_leaves`, `source_rounding`. Add:

- **`units`** — multiplier applied on the way out (`1000` for both new entities,
  default `1` so all eight existing cities are bit-for-bit unaffected).
- **multi-page statements** — accept a page *range* and concatenate before parsing,
  for 2009-era Seattle and every King County year.
- **comparative-column rejection** — when the header carries `Comparative Totals`,
  the trailing year columns are not funds and must not be reachable by the
  nearest-anchor GF column search.
- **schedule-ID anchoring** (`B-4`) as an alternative to title matching.

### 2. Extractors — thin config wrappers (~50 lines each)

- `scripts/extractSeattle.py` — `--mode operating|revenue`, per-era config
- `scripts/extractKingCounty.py` — same interface

Both stdlib-only, `pdftotext -table` via args-array, fail-loud `tie_delta` gate.

### 3. `scripts/seedWashingtonSeattle.js`

Idempotent. Creates Seattle (city) and King County (county) via
`treasury_ensure_municipality`, links Seattle → King County under the
NULL-or-same `county_id` guard, pins both populations from live Census
Vintage-2024 CSVs (never a remembered or estimated figure). Writes zero
`data_source` rows. Fails loudly.

### 4. `scripts/processSeattle.js` / `scripts/processKingCounty.js`

Load via **source-safe `treasury_sync_budget_tree` only** — never
`treasury_sync_city_budget`, which overwrites existing `(muni, fy, dataset)` rows and
keeps a stale `data_source` label. Stamp durable `source_url` + `source_date`
(the period end, not the fetch date). Ephemeral `data_sources` lifecycle, 0 residue.
Pre-load delete keyed on `(municipality_id, fiscal_year, dataset_type)`.
`processMode` wrapped in try/finally so cleanup always runs; per-FY hard failures
`throw` rather than `process.exit`.

### 5. `scripts/loadSeattleEnrichment.mjs` + `data/seattleEnrichment.mjs`

Category enrichment for every loaded key across both entities. Municipality-scoped,
**delete-then-insert** (the `category_enrichment` index is NULLS DISTINCT, so an
upsert on a NULL municipality inserts duplicates). Aborts on 0 live keys. $0 — no
paid AI. Must carry the fund-scope caveat below.

## Guardrails

Each is a response to a specific prior failure in this project.

1. **Fail-loud tie gate** — exit 1 on any non-zero `tie_delta`, per FY × mode.
   No year ships without an exact $0.
2. **Golden-diff on `lib/acfrGF.py`** — capture all existing extractor outputs
   *before* touching the module, diff byte-identical after. Eight loaded cities
   depend on that file.
3. **The ×1000 conversion must be verified against an oracle outside the tie.**
   The internal tie is unit-invariant — it reads $0 whether or not the multiplier is
   applied, so it cannot detect this defect. Two independent oracles:
   - **In-document narrative.** Seattle's FY2024 MD&A states the General Fund
     "reported an deficiency [sic] of revenues of $117.8 million in 2024". Extracted:
     `2,272,762 − 2,390,575 = −117,813` thousand = **−$117.813M** ✓.
   - **Per-capita plausibility band.** Seattle GF spend ≈ $2.39B over ≈780k
     residents ≈ **$3,065/resident**. A missing multiplier yields ≈$3.07/resident —
     absurd by three orders of magnitude. Assert a sane band in the loader.
4. **Eyeball every era's extracted label list.** A $0 tie proves arithmetic, never
   labels. Dash-zero (`-`) appears in 2009-era Seattle *and* all King County years —
   the exact Bend trap, where a `-` cell is read as a wrapped label and glued onto the
   next row while amounts, and therefore `tie_delta`, stay correct.
5. **Resolve nesting with `pdftotext -layout`**, which preserves the indentation
   `-table` flattens. Never infer a tree from a passing tie.
6. **Reject the comparative-year column explicitly**, with a test on FY2015.
7. `py -3` — bare `python` is a WindowsApps stub that exits 9009.
8. **Sequential, on `main`.** Worktrees are unsafe for this work: loaders need the
   gitignored `.env` and the gitignored `docs/` PDFs.

## Verification

1. **Independent re-derivation** — a from-scratch script with its own `pdftotext`
   pass that does **not** import the extractors, checked leaf-for-leaf and
   subtotal-for-subtotal against the live DB at exact $0, across every FY × mode.
   Analogues: `verify-phase130-rederive.mjs`, `rederiveWICMREB.py`.
2. **Source-chain audit** — every `source_url` non-null, correct-per-FY, resolving
   200 `application/pdf`; 0 `seattle%` / `king%` residue in `data_sources`; no stale
   labels; population provenance traceable to Census. The audit must **allow the
   `web.archive.org` host for King County FY2018 only** — and assert that no other row
   cites an archive, so the exception cannot silently spread.
3. **Unit audit** — oracle 3 above re-checked against loaded DB values, not against
   extractor output.
4. **Essentials tether** — fetch live `coverage.json` and mirror `matchEntityToCoverage`
   for Seattle (city) and King County (county) to predict icon presence. A gap is a
   cross-repo Essentials note, not a TT change.
5. **Chris UAT** at `treasurytracker.empowered.vote`.

## Known limitations — to be stated, not hidden

- **GF-only materially understates both entities.** Seattle GF spend is $2.39B
  against a city that also runs City Light, Seattle Public Utilities and a major
  Transportation fund — roughly a quarter of the whole. King County's Metro Transit
  and wastewater are likewise enterprise funds outside the GF. This is a deliberate
  comparability decision; it belongs in the enrichment text so a reader meets it
  rather than discovers it.
- **Asymmetric depth** — Seattle 17 years, King County 8. This is a hard ceiling, not
  a choice: King County's pre-2018 reports were checked across six routes and are
  either scans, a truncated capture, or were never archived at all. The gap
  (2008–2014, 2016, 2017) is a genuine public-web gap.
- **King County FY2018 is cited to the Internet Archive**, a provenance class no other
  TT row uses.
- **Seattle pre-2009** is not pursued.
- Seattle's `Low-Income Housing` major fund (2015 era) and `Transportation` fund are
  outside the GF and therefore outside these figures.
- Both entities' fiscal year is the **calendar year** (Dec 31 end), so `source_date`
  is `<FY>-12-31`.

## Out of scope

- Any all-Washington / WA SAO FIT statewide load.
- King County's enterprise funds; Seattle's enterprise funds.
- Employee compensation / salaries datasets for either entity.
- Any change to the frontend.
