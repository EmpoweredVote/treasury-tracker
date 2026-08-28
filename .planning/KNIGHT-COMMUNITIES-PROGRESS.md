# Knight Communities — Progress

Authoritative per-entity status for the campaign designed in
`.planning/KNIGHT-COMMUNITIES-SEEDING.md`. Updated at the end of every session,
in the same commit as that session's work.

**Roster:** Knight Foundation's official 26 communities + Nashville, TN = 27
primary entities, plus 16 parent counties = **43 entities**.

---

## Source-family audit-grade evidence

Per spec §3.5, a non-`unknown` grade requires evidence recorded here **and** a
`source_url` on the row. A family that does not verify gets no registry entry and
its rows stay `unknown`.

### Ohio Auditor of State Summarized Annual Financial Reports → `self_reported_unaudited`

**Verified 2026-08-28** by direct fetch of
`https://ohioauditor.gov/references/SummarizedAnnualFinancialReports`.

Verbatim, from the publisher's own download page:

> "Download **UNAUDITED** annual financial report information by filing year, or
> browse summarized data by entity type and accounting basis. Data is presented by
> entity type, filing year, and basis of accounting in accordance with Ohio
> Revised Code § 117.38"

Reinforced by: "To request a copy of an unaudited Hinkle System filing, email
HinkleSystem@ohioauditor.gov".

The publisher states the audit status in its own words, in capitals, on the page
the files are downloaded from. This is the strongest evidence of the three.

### CA State Controller — Cities Annual Report → `self_reported_unaudited`

**Verified 2026-08-28** from California Government Code § 53891(a), verbatim:

> "The officer of each local agency who has charge of the financial records shall
> furnish to the Controller a report of all the financial transactions of the
> local agency during the preceding fiscal year."

> "The report shall contain underlying data from audited financial statements
> prepared in accordance with generally accepted accounting principles, **if this
> data is available**."

⚠ **This is a genuinely mixed source and the grade is a judgment call, recorded
here so it can be challenged.** The statute directs agencies to draw on audited
statements, which puts SCO above a bare self-report — but two facts keep it out
of `compiled_from_audited`:

1. The audited-data requirement is **conditional** ("if this data is available"),
   so an unknown share of rows is not audit-derived and nothing in the dataset
   distinguishes them.
2. The report is **furnished by the agency's own finance officer**. SCO receives
   and compiles it; it does not audit it.

Per the vocabulary's own rule, a mixed source takes the **weaker** branch.

⚠ Do **not** reuse `scripts/data/basisRegistry.mjs` entry `ca-sco-city-exp` as
audit evidence. Its Modesto FY2024 reconciliation establishes that the figures are
closed-year *actuals*, which is a statement about basis, not about assurance.

### Minnesota OSA City/County Finances Report → `unknown` (NO REGISTRY ENTRY)

**Could not be verified 2026-08-28.** Three publisher pages checked:

- `https://www.osa.state.mn.us/reports-data-analysis/local-government/cities/`
- `https://www.osa.state.mn.us/reports-data-analysis/reports/local-government-finances-report/`
- `https://www.auditor.state.mn.us/reports-data-analysis/reports/local-government-finances-report/`

None states what the Finances Report is compiled **from**, nor its audit status.
The only related sentence is a general description of the office:

> "In addition to performing audits, the State Auditor's Office reviews the
> financial statements, audits, management letters, and financial reporting forms
> of all local governments under the Office's purview."

That describes what OSA reviews, not what populates this dataset.

**What is known but is NOT sufficient:** cities submit a Local Government
Financial Reporting Form through SAFES, and separately file a GAAP audit. Because
OSA receives both, "compiled from the self-reported form" is *likely* but not
stated. Guessing `self_reported_unaudited` here would be inference from plausibility
— exactly what spec §3.5 forbids.

⚠ `GAAPInd` in the raw data indicates **basis of accounting**, not audit status.
Do not read it as evidence of audit.

**Consequence:** Duluth, Saint Paul, Ramsey County and Saint Louis County stay
`unknown` — 4 of this session's 9 entities. **Resolving this is a live follow-up:**
the likely route is the methodology or notes section inside a `cired_*` report PDF,
or a direct question to OSA.


### City of Charlotte + Mecklenburg County ACFRs → `audited_gaap`

**Verified 2026-08-28** by reading the auditor's opinion in **all 36 documents**
(Charlotte FY2011–FY2025, Mecklenburg FY2005–FY2025).

Verbatim, Charlotte FY2023:

> "In our opinion, the financial statements referred to above present fairly, in
> all material respects, the respective financial position of the governmental
> activities, the business-type activities, the discretely presented component
> unit, **each major fund**, and the aggregate remaining fund information of the
> City, as of June 30, 2023 … in accordance with accounting principles generally
> accepted in the United States of America."

Mecklenburg FY2023 is the same form and adds "**and the budgetary comparison for
the general fund**".

The scope clause is what matters: the opinion names **each major fund**, and the
General Fund is a major fund in every one of these 36 reports. That is the §3.5
standard — an opinion covering the statement the figures were actually read from,
not a general assurance about the document.

⚠ **Eight of the 36 opinion pages are IMAGE-ONLY and were recovered by OCR** —
Charlotte FY2012/FY2024/FY2025 and Mecklenburg FY2005–FY2009. A text-layer search
finds "Independent Auditor" only in those documents' tables of contents, which
reads exactly like an unaudited report. All eight were rendered at 200dpi and
OCR'd; every one carries an unmodified "present fairly" opinion naming the major
funds, the General Fund and GAAP. **Without OCR these eight would have been
stamped `unknown` — a false negative on the two most current Charlotte years.**

---

## North Carolina — the recon gate (session 2)

### ⚠⚠ THE DESIGN'S ASSUMPTION WAS WRONG: NC LGC IS **NOT** AUDIT-DERIVED

Spec §4.3 sequenced North Carolina first because
`reference_audited_bulk_sources_and_fdta` flagged **NC LGC** as an *audit-derived*
bulk candidate that "would land at `compiled_from_audited`, a grade above what OH
and MN can offer." **Recon refutes this.** Risk **R2** fired exactly as written.

The NC Treasurer's own Data and Reports page describes the AFIR dataset as:

> "Data **self-reported** by counties and municipalities"

and the statute it is filed under, N.C.G.S. § 159-33.1, requires local units to
"**submit** a statement of financial information to the Secretary of the Local
Government Commission." The companion cash-and-taxes report is described the same
way — "based on data **reported by** local governments." The LGC receives and
compiles; it does not audit.

**Bulk availability is also partial and stale:**

| Era | Access |
|---|---|
| 1994–2011 | direct per-year downloads, county and municipal, free, no auth |
| 2012–present | `logos.nctreasurer.com`, a stateful reporting app with **no bulk export** — the Colorado DOLA shape |
| FY2024+ | submitted through a Power Apps portal |

**Recon outcome = ACFR, not BULK.** So Charlotte and Mecklenburg are read straight
from their own audited ACFRs — which lands them at **`audited_gaap`**, the
*highest* grade in the vocabulary and one step **above** the `compiled_from_audited`
the design hoped for. The campaign gets a better grade than planned, from a worse
source than planned.

⚠ **The 1994–2011 AFIR files are still a real, free, statewide bulk unlock** for
every NC county and municipality — at `self_reported_unaudited`, and stopping at
FY2011. Recorded as a follow-up, not done here.

### FAC census — the CA county blind spot does NOT apply to NC

`docs/fac/fac-local-fiscal-year-ends.csv` holds **422 NC municipality rows and 108
NC county rows**, so `censusGuard()` has something to check against for both
entities — unlike California, where zero county rows make the guard silently
vacuous. Both are confirmed July–June:

    NC,Charlotte,municipality,annual,7,,2000-2025
    NC,Charlotte City,municipality,annual,7,,1998-1999
    NC,Mecklenburg County,county,annual,7,,1998-2000 2002-2025

⚠ Charlotte appears under **two names** across the census era boundary
("Charlotte" 2000–2025, "Charlotte City" 1998–1999). A name-exact guard sees only
one of them — the `Saint Louis County` census-name-miss shape from session 1.

### Sources acquired — 36 documents, all first-party and live

| Entity | Window | Docs | Host |
|---|---|---|---|
| City of Charlotte | FY2011–FY2025 | 15 | `charlottenc.gov` (Akamai WAF) |
| Mecklenburg County | FY2005–FY2025 | 21 | `mecknc.widencollective.com` (Acquia/Widen DAM) |

⚠ **Charlotte's host rejects every non-browser client.** `curl` and PowerShell
both get an Akamai `403 Access Denied` on the HTML page *and* on the PDFs; a real
Chromium passes unchanged. The fetch is driven through Playwright for that reason
— the WAF fingerprints the client, not the request.

⚠ **Charlotte pre-FY2011 is retrievable but NOT loaded.** The retired
`charmeck.org` host served `fy10 cafr.pdf` and HTML pages for FY1998/2000/2001/
2002; that domain now 301s to `charlottenc.gov` and the files are gone, so they
survive only in the Internet Archive. Under the first-party `source_url` policy
set 2026-08-25 for City of Durham FY2004–FY2006, they stay unloaded. The FAC
census independently shows Charlotte audited from FY2000, so the gap is an
ACCESS fact, not an existence fact.

⚠ **Mecklenburg's DAM has no durable direct-file URL** — a provenance shape new to
TT. Bytes are served only from signed, expiring `orders-bb.us-east-1.widencdn.net`
links; `mcknc.widen.net/content/<external_id>/original` and every other public
Widen pattern 404s. The stable first-party citation is therefore the **portal
asset page**, `…/portals/y6kaiqln/FinancialReports/asset/<uuid>`, which is what the
manifest records — the same choice made for Asheville's Google Drive viewer URLs.
The asset list itself comes from a clean no-auth POST endpoint,
`/portals/api/assets/search/public/section/<sectionId>`.

### ⚠⚠ The issuer guard, as shipped, ACCEPTS two Charlotte impostors

Charlotte publishes **four** look-alike reports beside its ACFR — a PAFR, the
**Charlotte Douglas Airport** ACFR, a **Charlotte Water** annual financial report,
and a Building Code Enforcement report — and Charlotte-Mecklenburg Schools
publishes an ACFR naming *both* entities. Measured against the real files, not
reasoned about:

| Document | names entity | governing marker | verdict under the shipped guard |
|---|---|---|---|
| Charlotte ACFR (real) | ✓ | ✓ | accept ✓ |
| **Charlotte Water AFR** | ✓ | ✓ | **ACCEPT — WRONG** |
| **Charlotte PAFR** | ✓ | ✓ | **ACCEPT — WRONG** |
| Airport ACFR | ✗ | ✗ | reject ✓ |
| CMS (schools) ACFR | ✗ | ✗ | reject ✓ |

`assertIssuer` proves **who wrote** a document. It cannot tell a whole-government
ACFR from that same government's enterprise-fund or popular report, because the
City genuinely authored all three. This is the Buncombe lesson in a new axis:
the obvious guard accepts the impostor.

✅ **The fix is POSITIVE STRUCTURAL EVIDENCE, not a forbid-list:** the document
must contain a **governmental-funds balance sheet**
(`BALANCE SHEET … GOVERNMENTAL FUNDS`). An enterprise-fund report has no
governmental funds and a popular report has no statements, so both fail it, while
all 36 real reports pass. A forbid-list on "POPULAR ANNUAL" or "AVIATION" was
rejected deliberately — a hand-declared neighbour list is a standing bet the
issuer will not rename anything, which is what let the Buncombe impostor through.

**Result: 36/36 real documents pass; 8/8 adversary×entity combinations rejected.**
Fiscal year is asserted by **dominant year** rather than mere presence — Charlotte
FY2023 names "June 30, 2023" 248 times against 23 for FY2022 — so a comparative
prior-year column cannot satisfy the check.

### Two reader defects found, both fixed, both regression-proved

**1. A ghost text run (Mecklenburg FY2024/FY2025 revenue).** The sentence "The
accompanying notes are an integral part of this statement." is drawn a second time
at **0.10pt**, stacked on the `REVENUES` banner. pdfplumber merges the two into
`TRhe statement.EVENUES`, `REV_BANNER` matches nothing, and the reader fails
naming the PAGE HEADER as a row. ⚠ The **expenditure** side of the same page was
unaffected, so this presented as "revenue is broken for two years" — easy to read
as a Mecklenburg quirk rather than a reader bug. Fixed by dropping glyphs ≤1.0pt
before rows are assembled (`INK_MIN_HEIGHT` in `acfrPrintedTotal.py`); real
statement type is 8–11pt, so the threshold cannot reach printed content.

**2. A split root indent (Mecklenburg FY2005–FY2011 operating).** This era prints
`Current` about 2pt deeper than its own sibling headings `Debt Service` and
`Capital Outlay`, so `min(indents)` lands on the shallower pair and `Current`
reads as a child with no parent open. Measured across the era: root spread
1.82–2.90pt, root→child gap 3.67–4.08pt, so a valid tolerance is
**2.90 ≤ tol < 5.50**. The entity declares `indent_tol=4.0`. ⚠ Kept **per entity**,
not raised globally: El Paso County's root→child gap is 5.0pt, where a shared 4.0
would leave 1pt of margin instead of 3.5.

**Regression proof for the shared change** — the four NC entities already in TT
have **zero** sub-visible glyphs on any statement page, so they cannot be affected;
El Paso has 40, **every one a space character**, which
`extract_words(keep_blank_chars=False)` already discards. Re-running El Paso
FY2012/FY2013/FY2014 (the only affected years) with and without the filter gives
**6/6 byte-identical** outputs. `acfrGF.selftest.py` 166/166 and `npm test`
1,464/1,464 stay green.

### ⚠ The two entities print in DIFFERENT UNITS

**Charlotte is in THOUSANDS** — every statement page is captioned "(Dollar Amounts
in Thousands)". **Mecklenburg prints whole dollars.** A units error ties at $0
while being 1000× wrong, so neither value is checkable by the tie gate; both rest
on the caption and on the loader's per-capita guard. This is the Austin/Travis
shape — two entities, one milestone, opposite units — and the reason `units` is
declared per entity and never carried across.

Populations, US Census PEP Vintage 2024 (same program and vintage as the existing
four NC entities): **Charlotte 943,476** (`sub-est2024_37.csv`, SUMLEV=162,
PLACE=12000) · **Mecklenburg County 1,206,285** (`co-est2024-alldata.csv`,
SUMLEV=050, FIPS 37119). ⚠ Unlike Durham, Charlotte does **not** straddle counties
— its SUMLEV=157 Mecklenburg county-part row is also 943,476, so `county_id` is an
identity here.

### ⚠ Both entities need the COORDINATE reader — and a tie cannot detect why

Both issuers' text layers emit the LABEL column and the NUMERIC columns as
separate blocks, so every line-based reader pairs each label with the value of the
row **below** it. Charlotte FY2023, `pdftotext -layout`:

    Revenues:                    $426,942  $105,602 ... $553,217
       Property taxes            144,497   32,606   ...
       Other taxes               113,572   -        ...

`$426,942` sits on the `Revenues:` banner line but is Property taxes' figure.
⚠⚠ **This ties at $0 while being completely wrong**: the offset permutes the
label→value assignment without adding or removing a figure, so the component
multiset — and therefore the sum, the printed-total check and the leaf-multiset
check — is identical either way. Only glyph coordinates recover the true pairing.

⚠ **Neither entity can be corroborated by the `-table` reader**, unlike Durham
County and Asheville, where it cross-checks every year it can read. Here the
second reader is not merely unable to read the page — it reads it *confidently and
wrongly*. The independent oracle for these two is therefore the issuer's own
**printed total** on the statement (§5.2), not a second reader.

---

## Entity status

Legend — Status: `loaded` · `partial` · `pending`. Grade: as stamped on the rows.
FY month: the stored `fiscal_year_start_month` and whether the FAC census confirms it.

| Entity | State | Type | Status | Source | Grade | FY month | Session |
|---|---|---|---|---|---|---|---|
| Akron | OH | city | loaded | OH AOS | `self_reported_unaudited` | 1 · **FAC confirmed** | 1 |
| Summit County | OH | county | loaded | OH AOS | `self_reported_unaudited` | 1 · **FAC confirmed** | 1 |
| Long Beach | CA | city | loaded | CA SCO cities | `self_reported_unaudited` | 10 · **FAC confirmed** | 1 |
| Duluth | MN | city | loaded | MN OSA | `unknown` — source unverified | 1 · **FAC confirmed** | 1 |
| Saint Paul | MN | city | loaded | MN OSA | `unknown` — source unverified | 1 · **FAC confirmed** | 1 |
| Ramsey County | MN | county | loaded | MN OSA | `unknown` — source unverified | 1 · **FAC confirmed** | 1 |
| Saint Louis County | MN | county | loaded | MN OSA | `unknown` — source unverified | 1 · census name miss | 1 |
| Los Angeles County | CA | county | loaded | CA SCO **counties** | `unknown` — family unverified | 7 · no CA county census | 1 |
| Santa Clara County | CA | county | loaded | CA SCO **counties** | `unknown` — family unverified | 7 · no CA county census | 1 |
| San Jose | CA | city | **partial** | GF budget + publicpay | `unknown` | 7 · **FAC confirmed** | 1 |
| **Charlotte** | NC | city | loaded | **own ACFR** FY2011–25 | `audited_gaap` | 7 · **FAC confirmed** | 2 |
| **Mecklenburg County** | NC | county | loaded | **own ACFR** FY2005–25 | `audited_gaap` | 7 · **FAC confirmed** | 2 |

The 31 remaining entities are `pending` and are listed in spec §2.

⚠ **Session 1 loaded nothing** — it built the grade axis and verified what
already existed. **Session 2 is the campaign's first load**, and the first
`audited_gaap` rows in TT.

**Oracle, session 2.** Every one of the 72 rows ties **$0** against the issuer's
own printed total on the statement — the check external to the write path that
spec §5.2 requires, and NOT the tautological DB `total = Σ items`. The component
sum is computed by the reader and compared against a total it read separately
from the printed page.

⚠ **What the oracle does NOT cover here, stated plainly.** For Durham County and
Asheville the `-table` reader independently corroborates every year it can read.
**Neither Charlotte nor Mecklenburg can be corroborated that way**: both issuers'
text layers emit the label column and the numeric columns as separate blocks, so
`-table` does not fail on these pages — it reads them *confidently and wrongly*,
pairing every label with the row below. A second reader that is reliably wrong is
not a second opinion. The printed total is therefore the only independent oracle
for these two, and the label surfaces rest on the coordinate reader plus the
weld/indent evidence recorded above.

---

## Session 1 outcomes (2026-08-28)

**Shipped:** the `audit_grade` axis, end to end.

- `AUDIT_GRADE` vocabulary in `scripts/lib/budgetAxes.mjs`, reusing the existing
  `classifyAxis()` unchanged — the grade is a **third axis** alongside
  `fund_scope` and `basis`/`reporting_entity`, not new machinery.
- `scripts/data/auditGradeRegistry.mjs` — three entries, patterns anchored at both ends.
- Two CHECK constraints on `treasury.budgets`. The second,
  `budgets_graded_rows_need_a_source_url`, replaced a planned vitest guard that
  **turned out to be impossible**: this repo's test suite never touches the
  database (zero tests call `createClient`; CI runs `npm test` with no
  credentials). A constraint is strictly stronger — it holds on every write path
  and cannot be missed by a loader that forgets or a harness nobody runs.
- **27,520 rows across 820 entities** stamped `self_reported_unaudited`.
  TT went from 0% to **31.3%** graded. `sum_total` identical to the digit
  before and after; 0 graded rows lack a `source_url`.
- Test suite 1,382 → **1,427**, all passing.

**Scope decision, 2026-08-28:** the stamp was widened from the Knight 43 to every
row of a verified source family. `unknown` means "nobody has looked" — leaving
Columbus, OH ungraded after establishing that Ohio AOS is unaudited would make
the column lie by omission. Spec §3.6 should be read as *scoped by verified
source family*, not by entity.

**Not done, deliberately:**

- **San Jose's CA SCO series was NOT loaded.** It is not a defect. The exclusion
  is a recorded decision — `bulkLoadStateController.js:246` says "flagship
  custom-source cities (e.g. San Jose, Fresno, Bakersfield)… **(Chris decision:
  the 12 named custom cities get salaries+enrichment only, no SCO backfill.)**",
  implemented in `loadQuickWinCounties.sh` as `Santa Clara|San Jose`. Confirmed
  2026-08-28 to leave it alone.
  ⚠ **Worth revisiting separately:** the exclusion exists because "the
  never-overwrite guard alone can't protect the empty years," but SCOPE-02
  narrowed the collision check, and `fund_scope`/`basis`/`derivation` now keep
  the series distinct. **Long Beach already carries all three series at once**
  without harm. The policy may have outlived its reason — for all 12 cities, not
  just San Jose.
- **MN OSA left `unknown`** — see the evidence section above.
- **CA SCO *county* series left `unknown`.** The counties use a distinct family
  (`CA State Controller - County Expenditures` / `- County Revenues`, 2,376 rows)
  and Gov Code § 53891 does not cleanly settle it: subsection (b) excepts
  "cities, counties, and school districts" from the Controller's *accounting
  procedures*, which implies counties are local agencies but does not establish
  the (a) reporting duty for them. SCO publishes a separate Counties Annual
  Report with its own methodology. **Cheap follow-up: read that report's front
  matter.** Would grade LA County and Santa Clara County.

**Follow-ups opened:**

1. ~~⚠ The jammed frozen-figure invariant (below)~~ — ✅ **RESOLVED, PRs #106 +
   #107.** See the struck section below for what it was and what replaced it.
2. ⚠ The FAC census is blind to **all 54 CA counties** (below) — **now the
   highest-priority open item.** 16 counties are in this campaign's scope, so
   **check each state's census slice before trusting a county's month.**
3. MN OSA audit status — 4 Knight entities blocked on it. Cheap publisher read.
4. CA SCO counties audit status — 2 Knight entities blocked on it. Cheap
   publisher read.
5. The `--exclude-city` policy for 12 CA cities, possibly obsolete.
6. **What grade should a TT-derived row carry?** SCOPE-04 rows
   (`Treasury Tracker derived: Total Governmental (…)`, 857 CA county rows and
   more) have `derivation='derived'` and are currently `unknown`. Arguably they
   should inherit their parent source's grade. Not decided — out of session scope.
7. ev-accounts passthrough so the grade reaches the UI (spec §3.7). Until then
   the column is correct but invisible — the precise failure `sourceChipTypes.ts`
   documents, where `city` was missing from the chip set for months with every
   gate green.

---

## Known issues found during this campaign

### ✅ RESOLVED — the frozen-figure invariant was jammed (PRs #106 + #107)

> **Outcome, 2026-08-28.** All 154 unaccounted rows were **attributed exactly** —
> NC 138 + SF 4 + WeHo 12 — by using the digest itself as an oracle, and
> registered. `figures_frozen` was never regenerated. PR #106 added a correction
> **ledger** (`scripts/data/figureChanges.json`) so an authorised repair no longer
> destroys lineage, and split the two failure messages apart. PR #107 moved the
> computation **into the database** (`treasury.frozen_invariant_status()`, weekly
> `pg_cron` job) so one row crosses the wire instead of 87,880.
>
> **Verified green 2026-08-28:** 79,916 rows, database and repo agree.
>
> ⭐ **The habit this bought — after ANY load that inserts budget rows:**
> ```
> npm run verify:frozen      # 1.2s
> npm run register:rows -- --milestone <name> --match "<entity>"   # only on a deficit
> ```
> Three of the four times this broke, the cause was **rows created and never
> registered**. Doing it while you still know what you loaded is what makes it
> stick. See `reference_frozen_figure_invariant` in memory.
>
> The original diagnosis is kept below, unedited, because it is the record of how
> the 154 were found.

**Found 2026-08-28, before this session made any database write.**
`node scripts/verify-budget-axes.mjs` fails its final check:

```
✗ FROZEN FIGURE DIGEST MOVED — a row that existed at v2.24 changed or vanished
    expected 4cce9d6a8dfe9ac235dfd488f1903243892c7ebc4ac41b17dbd9022bfb068b9a
    got      c6e08b16db81224f487a85509230769e9b14e46b44b128deaee7ee45cd2056a5
```

Its other checks pass. **This is bookkeeping drift, not known corruption:**

| | rows |
|---|---|
| Live rows | 87,880 |
| Excluded (`scope02` 12 + `postV224` 148 + `scope04` 7,650) | 7,810 |
| Non-excluded, i.e. what gets hashed | **80,070** |
| `frozen_row_count` the hash was built from | **79,916** |
| **Unaccounted** | **154** |

154 rows created since v2.24 are in no exclusion file, so they are inside the
hash. **It therefore cannot match, whether or not any original figure changed** —
the harness can no longer distinguish "new rows leaked in" from "a figure moved."
This is the exact failure its own code comment records for v2.27–v2.29, recurring.

⚠ **The 154 cannot be localized from the database.** `created_at` is populated on
**19 of 87,880 rows**, newest timestamp 2026-03-24 — the RPC write path does not
set it. And the baseline stores only a count and a hash, never the ID set. So
drift here is detectable but not attributable.

⚠ **Do NOT regenerate `figures_frozen`.** The file forbids it, and doing so would
destroy the only evidence of what the 154 are.

Nothing runs this harness automatically — `npm test` is green and does not include
it — so it could have been failing for weeks unnoticed. ~~Needs its own session.~~
**It got one: PRs #106 + #107, same day. `npm test` still cannot check this —
the vitest suite never touches the database — which is why the two-command habit
above is manual and belongs in every load session.**

### Flaky guard test — `tests/listAllSources.test.mjs`

### ⚠ HIGH — the FAC census is blind to every California county

**Found 2026-08-28** while verifying the loaded entities' fiscal calendars.

`docs/fac/fac-local-fiscal-year-ends.csv` holds **549 CA rows, every one typed
`municipality`, and zero CA `county` rows** — against 3,489 county rows
nationally (MN alone has 93). The CA slice was built city-scoped, consistent with
PR #101's stated scope of "all 427 CA cities."

**Consequence:** `censusGuard()` returns `{ok: true}` when it cannot find an
entity — silence is not disagreement — so it passes **all 54 CA counties in TT**
without checking anything. Their `fiscal_year_start_month` values (all month 7)
have never been independently verified. That is the same class of unverified
assumption as the FYSM defect, and it fails silently because the column moves no
dollar.

`tests/knightFiscalCalendars.test.mjs` now pins the gap so it cannot go silent.

**Second, smaller gap:** `Saint Louis County, MN` cannot be matched by name. FAC
holds it as both `St Louis County` (1998-2004, 2021-2022) and `St. Louis County`
(2005-2020, 2023-2025); TT stores `Saint Louis County`. FAC's month is 1, which
is what TT stores — so this is a normalisation miss, not a discrepancy. A
"Saint"/"St." normalisation in `censusMonthFor` would close it.

⚠ **This matters for the campaign:** 16 counties are in scope across 14 states.
Wherever a state's census slice is city-only, county verification is vacuous.
**Check per state before trusting a county's month.**

### Flaky guard test — `tests/listAllSources.test.mjs`

Observed 2026-08-28: "has no live capped-RPC call anywhere in scripts/" failed
once in a full `npm test` run, then passed in isolation (13/13) and on an
immediate re-run (1,387/1,387).

**Mechanism:** the describe block calls `readdirSync('scripts')` once, then each
`it` calls `readFileSync` per path. Anything that creates or removes a file in
`scripts/` between those two moments makes the read throw.

Not caused by the Knight work. Recorded rather than fixed, because a guard that
intermittently fails erodes the exact signal it exists to provide, and the fix
(tolerating a vanished file) could equally mask a real problem. **Worth a
deliberate decision.**

---

## Session 2 outcomes (2026-08-28)

**North Carolina → City of Charlotte + Mecklenburg County.** The campaign's first
load, and the first `audited_gaap` rows in TT.

| | |
|---|---|
| Entities added | 2 (Charlotte `city` → Mecklenburg County; Mecklenburg County `county`) |
| Rows loaded | **72** — Charlotte 30 (FY2011–FY2025 × 2 datasets), Mecklenburg 42 (FY2005–FY2025 × 2) |
| Tie | **$0 on all 72**, against the issuer's own printed total |
| Grade | `audited_gaap` on all 72 — the first in the system |
| FY month | 7 on all 72, **actively confirmed** by the FAC census for both entities across their whole windows |
| Source documents | 36, all first-party and live, all provenance-verified |

**What the recon gate was for.** It cost one session-hour and it overturned the
design's sequencing premise before a loader existed. NC LGC is *self-reported*,
not audit-derived; had the campaign trusted `reference_audited_bulk_sources_and_fdta`
it would have built a bulk loader for a `self_reported_unaudited` source and
called it `compiled_from_audited`.

**Follow-ups opened:**

1. ⚠ **FL DFS is the other unverified "audit-derived" claim** in the same
   reference that was wrong about NC. **Verify it before session 3 sequences on
   it.** Same two questions: does the publisher state what it compiles from, and
   is there a free bulk download that is not a stateful app?
2. **The NC LGC AFIR 1994–2011 files are a real free statewide unlock** — every
   NC county and municipality, direct download, no auth — at
   `self_reported_unaudited` and stopping at FY2011. Worth its own milestone; it
   would give NC coverage far beyond the two Knight entities.
3. ⚠ **`assertReportType` is not yet wired into `fetchNorthCarolina.mjs`**, only
   into the new `fetchCharlotteMecklenburg.mjs`. The four original NC entities
   were fetched before the guard existed and are not re-verified by it. They are
   not at risk today — none of those four publishes an enterprise-fund ACFR under
   a colliding name — but the guard should be applied uniformly.
4. ⚠ **Charlotte pre-FY2011 is retrievable from the Internet Archive and was NOT
   loaded**, under the first-party `source_url` policy. FAC records the city as
   audited from FY2000, so eleven further years exist and are reachable only by
   changing that policy. Recorded, not re-litigated.
5. ⚠ **Mecklenburg's governing marker sits at character 14,073** of
   `assertIssuer`'s 20,000-character window. Pinned by a test; if the county's
   front matter grows, that test fails rather than every real year being rejected
   as the wrong issuer.
6. **The `-table` reader cannot corroborate either new entity** — it reads their
   pages confidently and wrongly. `verify-nc.mjs` covers the original four with a
   two-reader agreement check that structurally cannot extend here; the printed
   total is the oracle instead. If a second independent reader is ever wanted for
   these two, it has to be a genuinely different strategy, not `-table`.


7. ⚠ **A PRE-EXISTING partition-gate failure surfaced, unrelated to this load.**
   `basis/city-adopted-budget-doc` measured 165 rows on 2026-08-17 and now
   matches **169**. Verified not ours: the 169 contain **zero** Charlotte or
   Mecklenburg rows, and STRINGS (129) and ENTITIES (30) are unchanged, so no
   new source or government entered the family — only fiscal years. San
   Francisco now holds FY2025–**FY2028** under two strings, and its sync is
   enabled and rolls forward on its own;
   `project_sf_inverted_amounts_and_listing_cap` already records the hazard
   verbatim: "⚠ A new year arrives `basis=unknown`". FY2027 + FY2028 ×
   {operating, revenue} = exactly the 4. Re-measured to 169 with the evidence
   written into the registry.

   **The general lesson is worth more than the fix:** any enabled sync silently
   grows a family between milestones, so **a partition count is a measurement
   with a DATE, not a constant** — and the milestone that trips over it will be
   an unrelated one, as this was.

8. ⚠ **`register:rows` could not register this milestone at all** until
   `--match` was made repeatable. It assumed one entity per milestone; no single
   substring selects Charlotte AND Mecklenburg and nothing else. The only ways
   through would have been to file them under two milestone names — the
   shared/split-file bookkeeping that broke the invariant across v2.27–v2.29 —
   or to widen the match until it over-selected. The reconcile guard is
   unchanged: the UNION must still equal the deficit exactly. **Session 3 loads
   four Florida cities at once and would have hit the same wall.**

**Carried forward unchanged from session 1** (none of these were touched):
the FAC census blind spot for CA counties, MN OSA's audit status, the CA SCO
Counties report, and the ev-accounts passthrough that would make `audit_grade`
visible in the UI.
