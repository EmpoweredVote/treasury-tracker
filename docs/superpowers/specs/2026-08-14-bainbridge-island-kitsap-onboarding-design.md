# Bainbridge Island, WA + Kitsap County Onboarding — Design

**Date:** 2026-08-14
**Status:** Approved for planning
**Entities:** City of Bainbridge Island (city), Kitsap County (county)

## Goal

Seed Treasury Tracker with real, sourced General Fund finances for the City of
Bainbridge Island and Kitsap County, on the same basis as every existing TT city, so
that `treasurytracker.empowered.vote` can show `US → Washington → Kitsap County →
Bainbridge Island` with an icicle drill-down on both Money Out and Money In.

Washington already exists as a **state** node (12 ACFR rows, v2.15), and Seattle +
King County were onboarded in v2.21. Neither Bainbridge Island nor Kitsap County
exists in `treasury.municipalities` today — verified 2026-08-14, the only WA rows are
Seattle, King County and the Washington state node. This is a fresh two-entity
onboarding, not an edit.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Fund scope | **General Fund only** | Matches every existing TT city. One comparable basis across the app. |
| Bainbridge window | **FY2004–FY2025**, less FY2006 and FY2009 (20 years) | Full statements-bearing SAO archive, less the FY2006 scan and the FY2009 font-recovery attempt (Task 6, dropped — see Known limitations). Deepest city in TT — Seattle has 17. |
| Kitsap County | **Node + its own finances**, FY2004–FY2024 less FY2017–FY2019 (**18 years**) | User elected real county finances, not a nav-only node (the Pima/Dane precedent). FY2025 is not yet audited; FY2017–FY2019 have no digits in the PDF text layer (see Known limitations). |
| Datasets | `operating` + `revenue` | Standard TT pair. |
| Source | **WA SAO bound financial statements** (GAAP), free / no auth, one host for both entities | See "Source selection". |
| Early-year effort | Clean years, plus a **bounded** FY2009 font-map recovery | User elected "recover what's cheap": no OCR of the FY2006 scan, no pre-GASB-34 work. |

Expected volume, before the FY2009 recovery attempt was resolved (historical): Bainbridge
21 × 2 = 42 rows, Kitsap **18** × 2 = **36** rows, **78 rows** — or 76 if the FY2009
recovery did not tie. Final window is whatever the tie gate accepts; excluded years
are documented, never coerced.

**Task 6 outcome: FY2009 recovery attempted and DROPPED.** The bounded six-window
contiguous-substitution decoder (`scripts/decodeSaoFont2009.py`) found the statement
pages genuinely digit-bearing (54 comma-grouped cipher tokens present, e.g.
`,$+%($&&'` — this is content, not the Kitsap FY2017–2019 image-page case), but none
of the six candidate windows produced a self-consistent tie, and the two
highest-yield candidates decoded to structurally malformed numbers (stray un-mapped
cipher characters left inside supposedly-decoded figures). No candidate reached the
visual-confirmation gate. **The milestone ships 76 rows.**

## Source selection

**Selected: WA SAO ReportSearch bound financial statements**, for *both* entities.

v2.21 recorded that "WA SAO does not publish local-government financial statements",
based on King County, whose modern SAO "Annual Comprehensive Financial Report" is a
3–4 page auditor's opinion letter. That finding was correct about King County and
**too general**. The accurate rule, established by probing both entities here:

> SAO issues an **opinion letter only** for large GAAP filers that publish their own
> ACFR, but **binds the government's full audited statements** into its report for
> everyone else — including a county the size of Kitsap.

This is the more useful and more general fact, and it is what makes a single-source
pipeline possible. Every row in this milestone will cite a document that is literally
the State Auditor's report, which is audit-attested provenance on all 76 rows.

**Rejected: the city's own DocumentCenter** (`bainbridgewa.gov`). It links only
FY2023–FY2024, and the FY2021 ACFR URL surfaced by search returns HTTP 404 with an
HTML body. It is strictly worse than SAO for coverage and stability. It is retained
as a cross-check oracle for FY2023–24 only.

**Retained as an oracle, not a source: `kitsap.gov`.** Kitsap's own archive runs
1999–2024 (single PDFs from FY2018, sectioned before that). FY2024 fetches cleanly at
310 pages. Its value here is that it is a *physically different document from a
different host containing the same statements* — see "Verification".

**Not re-litigated: the SAO Financial Intelligence Tool** (`portal.sao.wa.gov/FIT/`),
already rejected in v2.21 as a JS/Power-BI portal with no bulk export and no
documented API. It remains the lead for a future all-Washington milestone. Do not
re-dig it for two entities.

## Source structure — what the probes actually found

### API contract

- `portal.sao.wa.gov/ReportSearch/Home/GetEntities?NameStartsWith=<name>` → MCAG lookup.
  **City of Bainbridge Island = MCAG `0461`. Kitsap County = MCAG `0132`.**
- `portal.sao.wa.gov/ReportSearch/Home/SearchReports?MCAGList=<mcag>&pageNumber=1&...`
  — **`pageNumber`, not `page`**, and the endpoint **500s unless all seven of**
  `HasFindings`, `StateGovernment`, `LocalGovernment`, `PerformanceAudits`,
  `SpecialInvestigations`, `UseOfDeadlyForceInvestigation`, `PoliceCertificationAudit`
  are present.
- `portal.sao.wa.gov/ReportSearch/Home/ViewReportFile?arn=<ARN>&isFinding=false&sp=false` → PDF.
- Dates arrive as `/Date(<epoch-ms>)/` and need decoding, not string-slicing.
- Plain `curl` + browser UA suffices. No WAF fight, no Chromium.

### The report-type inversion

For FY2014+ each fiscal year has **two** SAO reports, and the names are misleading:

| SAO `AuditTypeName` | Contents |
|---|---|
| `Annual Comprehensive Financial Report` | **Opinion letter only**, 4–5 pages |
| `Financial and Federal` / `Financial` | **Full bound statements**, 50–91 pages |

Selection must therefore be **by content, not by type name**. See "Guardrails".

### Bainbridge Island (MCAG 0461) — all 22 filings probed

Every year FY2004–FY2025 has a statements-bearing report. Probe results:

| FY | ARN | Pages | Chars | Revenue labels | Verdict |
|---|---|---|---|---|---|
| 2004 | 69788 | 50 | 247,757 | 11 | OK |
| 2005 | 72209 | 51 | 242,936 | 12 | OK |
| 2006 | 73415 | 52 | 36,698 | **0** | **SCAN — excluded** |
| 2007 | 1000370 | 57 | 253,030 | 11 | OK |
| 2008 | 1002863 | 54 | 278,219 | 14 | OK |
| 2009 | 1004976 | 50 | 218,436 | **5** | **Font-corrupted — recovery attempted, DROPPED (Task 6)** |
| 2010 | 1006518 | 72 | 252,474 | 8 | OK |
| 2011 | 1008424 | 76 | 256,889 | 9 | OK |
| 2012 | 1010907 | 62 | 233,610 | 11 | OK |
| 2013 | 1012614 | 75 | 270,630 | 7 | OK |
| 2014 | 1014609 | 73 | 301,381 | — | OK |
| 2015 | 1017006 | 85 | 312,491 | — | OK |
| 2016 | 1019388 | 82 | 328,485 | — | OK |
| 2017 | 1021673 | 81 | 286,553 | — | OK |
| 2018 | 1024177 | 84 | 278,541 | — | OK |
| 2019 | 1026890 | 84 | 286,772 | 9 | OK |
| 2020 | 1029122 | 87 | 289,531 | — | OK |
| 2021 | 1030857 | 91 | 310,382 | — | OK |
| 2022 | 1032975 | 88 | 301,142 | — | OK |
| 2023 | 1035299 | 74 | 273,979 | — | OK |
| 2024 | 1037954 | 85 | 293,190 | — | OK |
| 2025 | 1040282 | 76 | 281,954 | 10 | OK |

"Revenue labels" counts lines beginning `Taxes` / `Licenses and permits` /
`Intergovernmental`. A dash means the column-level check was not run in recon and is
a load-time step, not a known problem — the page and character counts already rule
out both the scan and opinion-letter failure modes for those years.

**FY2006** extracts 36,698 characters across 52 pages with zero readable revenue
labels: an image-only scan. Excluded, per the Sherwood FY2019 precedent.

**FY2009** has intact narrative text but its *statement pages* carry a broken font
encoding with no usable ToUnicode CMap — digits render as punctuation
(`,$+%($&&'`). Task 6 confirmed the corruption is a genuine substitution (54
comma-grouped cipher tokens present on the statement pages, not an image and not the
Kitsap FY2017–2019 all-labels-no-digits case), attempted the bounded six-window
contiguous-offset decode, and found no window ties — see "Known limitations".
FY2009 is **dropped**.

FY2025 statement, verified by hand from `pdftotext -layout -table`: whole dollars,
no thousands marker, single page, GF is the first money column, flat structure with
`Debt Service - Principal` / `Debt Service - Interest` / `Capital Outlay` as flat
leaves under a `Current` group header. `Transportation` is a **dash-zero**.

### Kitsap County (MCAG 0132)

SAO holds statements-bearing reports FY2004–FY2024. Three probed:

| FY | ARN | Pages | Chars | Revenue labels |
|---|---|---|---|---|
| 2005 | 71281 | 71 | 267,969 | 18 |
| 2013 | 1012226 | 131 | 506,272 | 16 |
| 2024 | 1038058 | 156 | 491,321 | 10 |

The remaining eighteen ARNs are listed below and are **assumed, not verified** —
each must clear the content guard at load:

`2004 69287 · 2006 73517 · 2007 75398 · 2008 1001808 · 2009 1004318 · 2010 1006489 ·
2011 1008368 · 2012 1010062 · 2014 1014660 · 2015 1017209 · 2016 1019584 ·
2017 1021897 · 2018 1024403 · 2019 1027313 · 2020 1029638 · 2021 1031693 ·
2022 1033213 · 2023 1035480`

FY2024 statement, verified by hand: whole dollars, **splits over two pages with the
GF column wholly on page 1** (the King County shape). County vocabulary differs from
city vocabulary — `Retail Sales & Use Taxes`, `Fines & Forfeits`,
`Intergovernmental Service`, ampersands throughout — which is the Ohio-AOS
county-vs-city lesson holding again. `Transportation`, `Health & Human Services` and
`Economic Environment` are **dash-zeros** in the GF column.

Kitsap's extracted text **collapses spaces** in some headings
(`KitsapCounty,Washington`, `FortheYearEndedDecember31,2024`).

### Hand-verified ties, and two $1 residues

| Entity | FY | Dataset | Sum of leaves | Printed total | Residue |
|---|---|---|---|---|---|
| Bainbridge | 2025 | revenue | 24,379,173 | 24,379,173 | **$0** |
| Bainbridge | 2025 | operating | 20,801,296 | 20,801,297 | **$1** |
| Kitsap | 2024 | revenue | 125,581,124 | 125,581,123 | **$1** |
| Kitsap | 2024 | operating | 128,230,878 | 128,230,878 | **$0** |

Two independent issuers, residues on opposite sides, both exactly $1. That reads as
genuine rounding in the printed statements rather than an extraction defect — but it
is a hypothesis, not a finding, and is resolved per-case at load. Bainbridge FY2025's
printed total is internally consistent with its own printed excess-of-revenues line
(24,379,173 − 20,801,297 = 3,577,876, as printed), which is evidence for the rounding
reading.

## Architecture

Three scripts, mirroring the v2.21 shape so the repo stays legible.

**`scripts/fetchWASao.mjs`** — MCAG → report list → PDF, generic over any WA local
government. Encodes the API contract above once, with a self-test. Records for every
downloaded file: ARN, audit period, `AuditTypeName`, URL, page count, sha256.

**`scripts/extractWASao.py`** — per-entity config layered over the existing
`scripts/lib/acfrGF.py`. **No fork of the shared library** — but see the amendment
immediately below. Per-entity config covers
the fund-column layout (Bainbridge single-page / Kitsap two-page), the tree shape,
and the label vocabulary.

**AMENDMENT — 2026-08-14, during Task 4, by Chris's ruling.** "No fork" stands, but
one *additive, defaulted* parameter is authorised on `acfrGF.py`, because four
Bainbridge years cannot be read without it.

FY2004, FY2005, FY2007 and FY2008 print **`Total Operating Revenues`** as the revenue
subtotal on the governmental-funds statement, while FY2010+ print `Total REVENUES` /
`Total Revenues`. The library hard-codes `startswith('total revenues')` in two places
— `acfrGF.py:432` inside `find_statement_page`, and `:917` selecting `rev_line` —
with no config override. (The `Total Revenues` strings found elsewhere in those same
documents belong to the MD&A summary table on a different page, printed in thousands.
They are not the statement, and matching them would load the wrong numbers.)

The authorised change is a `CityConfig` parameter `revenue_total_labels`, defaulting
to `('total revenues',)` so all ten shipped entities keep byte-identical behaviour.
Bainbridge sets `('total revenues', 'total operating revenues')`. **The expenditure
side stays hard-coded.** The existing page-level guard — which requires BOTH a
revenue total AND `total expenditures` on the same page — is what keeps the
proprietary-funds statement (`Total Operating Revenues` + `Total Operating
EXPENSES`) from matching.

Because ten shipped entities depend on this library, the change ships only with:
the full `npm run test:acfr` suite passing, plus re-run Seattle and King County
extractions demonstrating their totals and ties are unchanged.

The declined alternative was dropping those four years, which would have cut
Bainbridge from 21 years to 17 and the milestone from 84 rows to 76 (the totals as they
stood before Kitsap FY2017–FY2019 were later dropped) — and would have
left Bainbridge tied with Seattle rather than TT's deepest-history city.

**SECOND AMENDMENT — 2026-08-14, also during Task 4, by Chris's ruling.** A second
and larger library change was authorised, and unlike the first it is **neither
additive nor defaulted** — it changes `classify()`, the row-classification path all
ten shipped entities run through.

The defect: `pdftotext -table` places a bare page-footer page number in the label
column of exactly one data row per early Bainbridge year, the label resolves to
empty, and `acfrGF.py` **silently dropped the row**. Each missing row accounted for
its year's tie failure to the dollar — FY2004 `Transportation` 75, FY2005
`Transportation` 7,270, FY2007 `Economic environment` 2,323,355, FY2008
`Health and human services` 452,200. No `CityConfig` mechanism could reach it:
`label_fixes`, `parents` and `root_leaves` all require a label to already exist.

**This never shipped wrong data.** A dropped row breaks the tie, which is how it was
found — the $0 gate did its job. It was a robustness gap, not a correctness failure
in any shipped entity.

The authorised fix has two halves: (a) recover the label past a bare page-number
token, narrowly enough not to corrupt a legitimate label such as `911 Dispatch` or
`4Culture`; and (b) make a row that carries **values but no usable label** fail
loudly rather than vanish, while a genuinely blank, spacer or rule row with **no
values** still skips quietly. That boundary is the highest-consequence line in the
milestone: drawn one way it resurrects the silent drop, drawn the other it crashes a
shipped entity on a blank row.

Evidence required and delivered: the full selftest suite (105 tests), Seattle and
King County unchanged, and a sweep of every library-backed extractor against every
ACFR on disk — 162 combinations across nine entities, zero uncaught exceptions.
Independently at review, all 79 statement pages those nine entities select were
scanned for the new recovery pattern: one line matches, in Seattle FY2025, and an
A/B run with the recovery disabled produced byte-identical output.

Declined alternatives: dropping the operating dataset for those four years (which
would have shown Money In with no Money Out — a reader would reasonably misread that
as the city having spent nothing), or dropping the four years entirely.

**`scripts/loadBainbridgeKitsap.mjs`** — writes via `treasury_sync_budget_tree`
**only**. Never `treasury_sync_city_budget`, which overwrites existing
`(muni, fy, dataset)` rows and keeps a stale `data_source` label. `data_sources`
rows follow the ephemeral lifecycle established by the WR-05 fix in Ph111.

**`scripts/decodeSaoFont2009.py`** — throwaway, bounded, used once. See "Guardrails".

## Guardrails

**Content guard on report selection.** Never select by `AuditTypeName`. For each
fiscal year, require page count ≥ 40 **and** a located governmental-funds statement
anchor; abort that year loudly otherwise. This is the check that would have caught
King County's opinion-letter trap in v2.21 mechanically rather than by hand.

**Statement anchoring.** Anchor on "Statement of Revenues, Expenditures" +
"Governmental Funds", **rejecting any line containing "Reconciliation"** — there are
at least two such decoys per report, plus a table-of-contents hit. Do not anchor on
the wrapped title alone (the Sherwood/Tualatin trap).

**Column alignment — read twice, require agreement.** v2.21 established that column
alignment differs by issuer (Seattle left-aligns money columns, King County
right-aligns them), so neither edge of a number is a stable column key; keying on the
right edge silently drops 1–2 digit values. Read **centre-in-band and ordinal**,
require both to agree, and flag every disagreement. Built in from the start here
rather than discovered by the audit harness.

**Dash-zero gets its own assertion.** Present in both issuers. It corrupts labels
while `tie_delta` stays $0, so the tie can never detect this class of bug (the Bend
trap). Leaf labels are asserted against the printed labels independently.

**Whitespace-insensitive label matching**, for Kitsap's collapsed headings.

**Unit assertion outside the tie.** Both entities are confirmed whole dollars, but
**the internal tie is unit-invariant and reads $0 either way**, so it can never prove
units — the single most dangerous lesson from v2.21. A per-capita band check runs
outside the tie: Bainbridge GF ≈ $833/resident, Kitsap ≈ $460/resident, against
≈ $0.83 and ≈ $0.46 if a ×1000 were ever missing.

**Residue policy: the gate stays at $0.** No widened tolerance. Any year/dataset with
a residue is adjudicated individually against the rendered statement page and either
(a) fixed as an extraction bug, or (b) recorded as a documented source-rounding
exception carrying its exact amount and citation. Never silently absorbed — quietly
swallowing a dollar is how a real extraction bug hides.

**FY2009 recovery is bounded and self-validating.** Build the substitution map from
the corrupted glyphs; the decoded statement must tie at **$0 against its own printed
totals** to be accepted. If it does not tie, FY2009 drops and the milestone ships 76
rows. The tie gate validates the decoder, so there is no path to talking ourselves
into a bad recovery. **Outcome (Task 6): dropped** — none of the six bounded
contiguous-offset candidates tied; see "Known limitations".

**Structural-break check.** Twenty-two years will contain real discontinuities —
GASB 54 rolled eleven funds into Kitsap's General Fund, and Bainbridge's fund lineup
shifts across the span. Flag large YoY jumps for narrative adjudication against the
MD&A, as Seattle's FY2018 education-fund conversion was handled. A flagged jump is
resolved by citing the ACFR's own words or it is not resolved.

**Population from the authority.** WA OFM April 1, 2025 official estimates, for both
city and county. Third-party figures for Bainbridge span 24,046–24,963, which is too
wide to guess at.

**Entity typing.** The county load runs with the county entity type; assert no
phantom city row is created (the Utah lesson).

## Verification

Three re-runnable harnesses, each exiting 0, following the v2.21 pattern.

**`scripts/verify-bainbridge-rederive.mjs`** — blind re-derivation of all 76 rows to
$0, **importing none of the extractor code**. Leaf *and* subtotal, so a compensating
pair of errors cannot pass.

**`scripts/verify-bainbridge-audit.mjs`** —
(a) year coverage matches the manifest, with no year silently missing;
(b) every `tie_delta` is $0, or on the documented-exception list with its exact amount;
(c) every row cites a resolvable SAO URL with ARN and page, and every PDF's sha256 is
recorded and re-verifiable;
(d) per-capita band holds for both entities;
(e) label integrity — no dash-zero corruption, leaf labels match printed labels;
(f) `Bainbridge.county_id` → Kitsap, and no phantom entity row exists;
(g) enrichment rows are scoped to a `municipality_id` and none is NULL.

**`scripts/verify-bainbridge-tether.mjs`** — both entities COVERED.

**Scoping rule for any count.** Any assertion counting sources, archives or
provenance classes is **scoped to a `municipality_id`**. v2.21's scoping doc claimed
archive citation was a new app-wide provenance class and was false, because New
Hampshire already had sixteen such rows. App-wide claims of that shape are wrong by
default.

**The independent oracle — new capability in this milestone.** Kitsap's own
310-page ACFR on `kitsap.gov` is a physically different document, from a different
host, containing the same statements. Kitsap's re-derivation therefore runs against a
genuinely independent source rather than a second read of the same bytes — stronger
than anything available in v2.21. Bainbridge gets the same treatment for FY2023–24,
the two years its own site still serves. **Where the two documents disagree, that is
a finding, not a rounding.**

**`npm run lint` is a broken gate in this repo** and has never exited 0. It is
excluded from the definition of done; verification rests on the harnesses.

Chris's UAT gates the ship.

## Known limitations — to be stated, not hidden

**General Fund only understates both entities.** Bainbridge's FY2025 GF spend of
$20.8M sits inside $31.7M across all governmental funds, and its water and sewer
utilities sit outside that again. Kitsap's sanitary sewer, solid waste and surface
water utilities are likewise excluded. This is the same deliberate comparability
trade v2.21 made, and it must appear in enrichment text rather than be left for a
reader to discover.

**FY2006 Bainbridge is absent** because the only available document is a scan. Stated,
not silently skipped.

**FY2009 Bainbridge is absent.** Its statement pages carry a broken embedded font
with no usable ToUnicode CMap — digits render as punctuation (`,$+%($&&'`), and
the pages carry 54 comma-grouped cipher tokens, confirming real content is present
(unlike the Kitsap FY2017–2019 case below, where the digits are simply not in the
text layer at all). Task 6 attempted the bounded, self-validating recovery specified
for exactly this situation: build a monoalphabetic substitution map assuming the
font's glyph order is preserved and only the base offset over the contiguous
`!"#$%&'()*+,-./` run is lost, which yields six candidate windows (not the 10.9
billion permutations of an unconstrained search). None of the six windows produced a
decoded statement whose line items tied to their own printed total; the two
highest-yield candidates additionally decoded to structurally malformed figures
(stray un-mapped cipher characters left inside the "numbers"). No candidate reached
the visual-confirmation gate. Per the bounded, no-iterate-indefinitely mandate for
this task, FY2009 is dropped rather than pursued further (e.g. per-embedded-font
glyph analysis or OCR, both out of scope). Stated, not silently skipped.

**Bainbridge FY2010 and FY2011 are absent** — discovered at load, in Task 8.
FY2010's GAAP governmental-funds statement (p28) is font-ciphered and its money
columns are empty in the text stream; FY2011's statement pages (pp25–26) are CCITT
stencil scans carrying only the SAO footer. **Both filings DO contain a readable
revenue-and-expenditure page — a Budgetary Comparison Schedule (FY2010 p68,
FY2011 p71).** Those are budget-basis, single-fund schedules. Loading them would have
reached the planned row count while silently mixing budgetary-basis figures into a
GAAP series, under a source label reading "General Fund, Revenue by Source" — a
provenance falsehood, not a rounding call. They were refused. Bainbridge therefore
covers 18 years, and the milestone ships **72 rows**, not 76.

**Kitsap FY2017, FY2018 and FY2019 are absent.** Their statement pages carry
labels but **no digits at all** in the PDF text layer — 24 / 114 / 193 extractable
comma-grouped numbers per document, against ~2,556 in FY2016 and ~2,828 in FY2020.
The labels are recoverable (a +29 letter shift: `7RWDOUHYHQXHV` is `Total revenues`)
but the amounts simply are not present, so there is nothing to decode; only OCR could
recover them, and OCR is out of scope by standing ruling — the same call already made
for the Bainbridge FY2006 scan. Stated, not silently skipped.

**Kitsap stops at FY2024** because FY2025 is not yet audited. It should be added when
SAO releases it.

**Kitsap's own 1999–2003 reports go unused.** They are pre-GASB-34 and use a
different fund-statement model.

**Enrichment text is AI-written and uncited**, the standing app-wide condition that
SRCSTD-01 exists to address. Not changed here.

## Out of scope

- Any fund beyond the General Fund.
- OCR of the FY2006 scan.
- Pre-GASB-34 statements for either entity.
- A generalised all-Washington SAO harness. The MCAG-generic fetcher built here is a
  natural seed for one, but building that is a separate milestone, not this one.
- Any change to the Washington state node, Seattle, or King County.
