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

## Florida — the recon gate (session 3)

### ✅ THE DESIGN'S ASSUMPTION WAS RIGHT HERE — FL DFS **IS** AUDIT-DERIVED

Session 2 refuted the `compiled_from_audited` prediction for NC LGC and left the
same claim for **FL DFS** explicitly unverified, with instructions to check it the
same way before sequencing. **Verified 2026-08-29 — and unlike NC, it holds.**

The chain of evidence, in the order it was gathered, because the first two steps
alone would have produced the *wrong* answer:

**1. The statute reads like a self-report.** § 218.32(1)(a), F.S., verbatim:

> "Each local governmental entity ... shall **submit to the department** a copy of
> its annual financial report for the previous fiscal year in a format prescribed
> by the department. ... The chair of the governing body and the chief financial
> officer of each local governmental entity shall **sign** the annual financial
> report submitted pursuant to this subsection **attesting to the accuracy** of
> the information included in the report."

**2. The rule confirms the AFR and the audit are two separate artifacts.**
Rule 69I-51.003, F.A.C., verbatim:

> (2) "The following government entities shall **complete and electronically
> submit** the annual financial report to the Department through the LOGER
> program..."
>
> (3) "The annual financial report **and either a copy of the government entity's
> audited financial statements or the Auditor General's Data Element Worksheet**
> shall be submitted to the Department..."

⚠⚠ **Stopping here would have graded Florida `self_reported_unaudited` — the NC
answer — and it would have been WRONG.** The entity does prepare and attest the
AFR, and the audit is a separate accompanying document. What that misses is what
the Department then *does* with the pair.

**3. The publisher states it reconciles the two.** DFS, *Local Government
Electronic Reporting in XBRL (LOGERx)* manual, **Revised 11/2025, page 13**,
verbatim:

> "When you certify and submit your AFR, the status becomes **Certified by
> Entity**. After Department staff **reconciles the AFR to the provided audited
> financial statements** or Data Element Worksheet, the status will become
> **Verified by DFS**. If the AFR **does not reconcile** to the audited financial
> statements or Data Element Worksheet, the AFR will be placed in **Returned by
> DFS** status until the data can be corrected."

That is § 3.5's standard met in the agency's own words: DFS does not merely
receive the figures, it **agrees them to the audited financial statements** and
refuses to publish them as verified until they tie. This is the distinction that
separates `compiled_from_audited` from `self_reported_unaudited`, and Florida is
on the correct side of it.

Source: `https://www.myfloridacfo.com/docs-sf/accounting-and-auditing-libraries/manuals/local-government/logerx-manual-2025.pdf`

### ⚠ It is a MIXED source — but the branch is identifiable PER ENTITY PER YEAR

The reconciliation is against "the audited financial statements **or** Data
Element Worksheet." The DEW branch is the one taken when **no audit was
performed** — small entities below the § 218.39 thresholds. So the dataset spans
both grades, which is the Colorado DOLA shape § 3.5 warns about:

> "Where a source is mixed ... the grade reflects the weaker branch **unless the
> specific entity's filing can be identified.**"

**Here it can be identified, publicly, per entity per year.** The public
`PUBLICCOMPLIANTGOVS` system report carries `AFR Received Date`, **`Audit Received
Date`** and **`Audit Completion Date`** columns. An entity with an audit date for
that year reconciled against an audit; one without took the DEW branch.

All seven session-3 targets carry both audit dates for FY2023:

    100013 County Miami-Dade   9/30  audit recd 2024-06-28  completed 2024-06-26
    100037 County Leon         9/30  audit recd 2024-06-10  completed 2024-05-22
    100041 County Manatee      9/30  audit recd 2024-03-07  completed 2024-02-16
    100050 County Palm Beach   9/30  audit recd 2024-06-14  completed 2024-03-26
    200037 City   Bradenton    9/30  audit recd 2024-06-27  completed 2024-03-15
    200239 City   Miami        9/30  audit recd 2024-04-15  completed 2024-03-29
    200359 City   Tallahassee  9/30  audit recd 2024-06-10  completed 2024-04-26

⚠ **The audit flag must be checked per entity PER YEAR, not once.** It is a
property of a filing, not of a government — exactly the reason `audit_grade` is a
per-row column (§ 3.3) and the reason Madison is the vocabulary's proof case.
**A loader that grades the whole state `compiled_from_audited` off one year's
compliance report would be making the § 3.4 mistake in a new place.**

### Recon outcome = **BULK**, and the access is the cleanest TT has seen

Free, no auth, no API key, no ToS gate, no stateful session. One anonymous
`POST` returns a statewide workbook:

    POST https://logerx.myfloridacfo.gov/api/document/systemReport
    {"afrYear":2023,"reportFormat":"EXCEL","reportName":"REVENUEDETAILREPORT"}
    -> {"mimeType":"application/vnd...sheet","content":"<base64 xlsx>"}

Public (`adminOnly:false`) reports that matter:

| `reportName` | Contents | From |
|---|---|---|
| `REVENUEDETAILREPORT` | Revenue by account × fund, all entities | FY2012 |
| `EXPENDITUREDETAILREPORT` | Expenditure by function × object × fund | FY2012 |
| `BALANCESHEETDETAILREPORT` | Balance sheet by account × fund | FY2022 |
| `TOTALREVEXPDEBT` | Totals + long-term debt | FY2012 |
| `REVACCOUNTS` / `EXPENDACCOUNTS` | The account-code taxonomy itself | FY2012 |
| `PUBLICCOMPLIANTGOVS` | AFR + **audit** receipt dates, and `FYE` | FY2012 |

⚠ The API is **anonymous for admin-flagged reports too** — `adminOnly` is a UI
flag, not an access control. The `*UNCERTIFIED` variants ("includes unverified
data") were deliberately **not** harvested. TT loads the public, verified reports;
that is both the right data and the right boundary.

### Granularity — icicle-grade, with `fund_scope` falling out of the source

`EXPENDITUREDETAILREPORT` FY2023: **30,185 rows, 1,871 entities** (409 cities, 66
counties, 1,377 special districts, 19 other). The shape:

    Code   | Name  | Account              | Object Code             | 12 fund columns
    200239 | Miami | 511.00 - Legislative | 10 - Personnel Services | General, Special
                                                                      Revenue, Debt
                                                                      Service, Capital
                                                                      Projects, Permanent,
                                                                      Enterprise, Internal
                                                                      Service, Custodial,
                                                                      Pension, Trust,
                                                                      Private Purpose,
                                                                      Component Units

A **two-level tree** (function → object code) on the expenditure side and
account → dwelling/fee type on the revenue side, with the **funds as columns**.
⚠ This means `fund_scope` is **read from the source, not inferred** — the General
column is `general_fund` and the governmental columns sum to `total_governmental`,
which is the SCOPE-04 derivation done by the publisher rather than by TT. That is
better provenance than most sources TT holds.

Per-entity depth, FY2023: Miami-Dade 220 rows, Manatee 158, Palm Beach 156, Leon
131, Miami 78, Tallahassee 75, Bradenton 57.

### ⚠⚠ Traps found during recon, before any loader exists

1. **Florida is an OCTOBER state.** `FYE` is `9/30` for **all 262 cities and 49
   counties** in the FY2023 compliance report, so `fiscal_year_start_month = 10`.
   **NC was 7. Do not carry the month across** — `project_fysm_column_default_one_defect`
   is precisely this failure. It must still be resolved **per row** from the FAC
   census (§ 4.6), not from this column. 11 entities file 6/30, 7 file 12/31 and
   1 files 4/30 — all non-city/county, but proof the state is not uniform.
2. **FY2025 is INCOMPLETE and looks complete.** 1,281 entities filed vs 1,918 for
   FY2024, and **only 4 of the 7 targets are present** (Manatee, Palm Beach,
   Miami, Tallahassee — Miami-Dade, Leon and Bradenton are absent). The workbook
   for a partial year is a well-formed workbook. **Check presence per entity per
   year; never infer a year is whole from the file downloading successfully.**
3. **`Palm Beach` is TWO governments.** Code `100050` is Palm Beach *County*;
   code `200287` is the *Town of* Palm Beach. A name-based match silently
   collides. Join on `Code`, never on `Name`. (Same family: `Miami` 200239 vs
   `Miami Beach`, `North Miami`, `Miami Gardens`, `Miami Lakes`,
   `Miami Shores Village`, `Miami Springs`, `South Miami`, `West Miami`.)
4. **The entity roster endpoint returns `id: null` for every row** —
   `GET /api/entity/all` (3,299 entities, no auth) is authoritative for `code`,
   `name`, `status`, but its `id` field is nulled, and the `/visualization/*`
   endpoints want that internal id. Use `code`; do not build on `/visualization/*`.
5. `www.myfloridacfo.com` **refuses port 80** — the `http://` links on DFS's own
   manuals page time out. Rewrite to `https://` before fetching.

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
| **Miami** | FL | city | loaded | **FL DFS** FY2012–25 | `compiled_from_audited` | 10 · **FAC confirmed** | 3 |
| **Tallahassee** | FL | city | loaded | **FL DFS** FY2012–25 | `compiled_from_audited` | 10 · **FAC confirmed** | 3 |
| **Bradenton** | FL | city | loaded | **FL DFS** FY2012–24 | `compiled_from_audited` | 10 · confirmed exc. FY14/15/17 | 3 |
| **Palm Beach County** | FL | county | loaded | **FL DFS** FY2012–25 | `compiled_from_audited` | 10 · confirmed exc. FY21–24 | 3 |
| **Miami-Dade County** | FL | county | loaded | **FL DFS** FY2012–24 | `compiled_from_audited` | 10 · confirmed FY23–24 only | 3 |
| **Leon County** | FL | county | loaded | **FL DFS** FY2012–24 | `compiled_from_audited` | 10 · **FAC confirmed** | 3 |
| **Manatee County** | FL | county | loaded | **FL DFS** FY2012–25 | `compiled_from_audited` | 10 · **FAC confirmed** | 3 |
| **Macon-Bibb County** | GA | **city** | loaded | **GA DCA RLGF** FY2016–25 exc. FY24 | `self_reported_unaudited` | 7 · census absent | 4 |
| **Columbus-Muscogee** | GA | **city** | loaded | **GA DCA RLGF** FY2016–25 | `self_reported_unaudited` | 7 · census absent | 4 |
| **Milledgeville** | GA | city | loaded | **GA DCA RLGF** FY2016–25 exc. FY18 | `self_reported_unaudited` | 7 · **FAC confirmed** | 4 |
| **Baldwin County** | GA | county | loaded | **GA DCA RLGF** FY2016–25 | `self_reported_unaudited` | 1 · **FAC confirmed** | 4 |
| **Philadelphia** | PA | **city** | loaded | **PA DCED** FY2015–24 | `self_reported_unaudited` | **7** · **FAC confirmed** | 5 |
| **State College** | PA | municipality | loaded | **PA DCED** FY2015–24 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Centre County** | PA | county | loaded | **PA DCED** FY2015–24 exc. FY16 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Fort Wayne** | IN | city | loaded | **IN Gateway** FY2015–24 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Gary** | IN | city | loaded | **IN Gateway** FY2016–24 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Allen County** | IN | county | loaded | **IN Gateway** FY2015–24 | `self_reported_unaudited` | 1 · confirmed exc. FY15 | 5 |
| **Lake County** | IN | county | loaded | **IN Gateway** FY2015–24 | `self_reported_unaudited` | 1 · confirmed exc. FY19 | 5 |
| **Richland County** | SC | county | loaded | **SC RFA LGF** FY2012–24 | `self_reported_unaudited` | 7 · **FAC confirmed** | 6a |
| **Horry County** | SC | county | loaded | **SC RFA LGF** FY2012–24 | `self_reported_unaudited` | 7 · **FAC confirmed** | 6a |
| **Columbia** | SC | city | loaded | **own ACFR** FY2016–25 exc. FY19 | `audited_gaap` | 7 · **FAC confirmed** | 6a |
| **Myrtle Beach** | SC | city | loaded | **own ACFR** FY2016–25 | `audited_gaap` | 7 · **FAC confirmed** | 6a |
| **Nashville-Davidson** | TN | **city** (consolidated) | loaded | **own ACFR** FY2016–25 | `audited_gaap` | 7 · ACFR + live FAC | 6b |
| **Detroit** | MI | city | loaded | **MI Treasury F-65** FY2010–25 | `self_reported_unaudited` | **7** · **FAC confirmed** (1998–2025) | 7a |
| **Wayne County** | MI | county | loaded | **MI Treasury F-65** FY2010–25 | `self_reported_unaudited` | **10** · filing + FAC 1999–2005; **window UNCOVERED** | 7a |
| **City of Boulder** | CO | city | loaded | **own ACFR via FAC** FY2016–22 | `audited_gaap` | 1 · **FAC confirmed** | 7b |
| **Boulder County** | CO | county | loaded | **own ACFR** FY2021–25 | `audited_gaap` | 1 · **FAC confirmed** | 7b |
| **City of Wichita** | KS | city | loaded | **own ACFR** FY2000–25 exc. **FY01, FY08** | `audited_gaap` | 1 · confirmed exc. FY2022 | 7b |
| **Sedgwick County** | KS | county | loaded | **own ACFR** FY2006–24 exc. **FY19** | `audited_gaap` | 1 · **FAC confirmed** | 7b |

**COUNTED FROM THE TABLE ABOVE, 2026-08-30 after session 7b: 41 rows — 40
`loaded` + 1 `partial` (San Jose). 23 primary entities + 18 parent counties.**

The remaining entities are `pending`: **4 primaries** (Aberdeen SD, Biloxi MS,
Grand Forks ND, Lexington-Fayette KY) and **3 counties** (Brown SD, Harrison MS,
Grand Forks ND) = **7**. All seven are session 8's "orphans" slice.

⚠⚠ **THE ROSTER TOTAL OF 43 DOES NOT RECONCILE, AND SESSION 7a WAS THE FIRST TO
COUNT IT RATHER THAN CARRY IT.** Spec §2 states "Total entity target: 43
(27 primary + 16 counties)", but 18 counties are ALREADY LOADED and three more are
still pending, so the campaign has **21 parent counties, not 16**. The arithmetic
that reconciles is 27 primary + 21 counties = **48**, and 41 + 7 = 48 exactly.
The undercount is explained by the five CONSOLIDATED primaries that have no
separate county (Macon-Bibb, Columbus-Muscogee, Philadelphia, Nashville-Davidson,
Lexington-Fayette) — subtracting them from 21 gives the 16 in §2, which appears
to have counted "new counties to create" rather than "counties in the roster".
⚠ **Percentages quoted in earlier sessions were computed against 43** and are
therefore optimistic: **41 of 48 is 85%**, where the same count against 43 would
read 95%. Left as a flagged
discrepancy for Chris rather than silently restated — the headline number is a
scoping decision, not a bookkeeping one. **Count the table; never carry a total
forward** — the same rule that caught session 4's missing Georgia rows.

⚠ **Detroit and Wayne County are on DIFFERENT fiscal calendars** — a city and its
own parent county, month 7 against month 10. Both are read per filing from the
F-65's own `fiscalendmonth` field and both are constant across all sixteen years.
Michigan's counties split **72 January / 29 October / 1 July** in the FAC census
and Wayne is in the 29, so no state-wide default would have been safe.

⚠ **Wayne County's FAC census coverage stops at 2005**, before the load window
opens, so its month is reported as UNCOVERED for all 16 loaded years rather than
confirmed. The month is nonetheless read from every filing and agrees with the
pre-2005 census. Detroit's 16 years are all actively confirmed.

⚠ The three Florida windows ending FY2024 are NOT gaps in the source — Miami-Dade,
Leon and Bradenton had simply not filed FY2025 when the workbooks were fetched.
FY2025 is still filling statewide (1,281 filers against 1,918 for FY2024).

⚠ **Session 1 loaded nothing** — it built the grade axis and verified what
already existed. **Session 2 is the campaign's first load**, and the first
`audited_gaap` rows in TT. **Session 3 is the first BULK state**, the first
`compiled_from_audited` rows, and the first source in TT whose icicle actually
drills down.

**Session 4 is the first source TT reads TWICE by different routes**, and the
first where the publisher's own machine extract turned out to be defective.

**Session 5 is the first session where a passing oracle hid a scope error** — see
its section below.

**Session 6a is the first session that needed BOTH routes for one state** — a
statewide bulk source for the counties and one-off ACFRs for the cities, because
South Carolina's otherwise-excellent statewide source structurally cannot produce
a municipality. It is also the session that found the **Federal Audit
Clearinghouse serves complete audited ACFR PDFs**, free and unauthenticated —
the access route session 2 needed and did not have.

**Running total: 29 fully loaded + 1 partial (San Jose) + 13 pending = 43.**
**30 of 43 entities (70%) now carry data.**

⚠ The table above is the arithmetic: 10 (s1) + 2 (s2) + 7 (s3) + 4 (s4) + 7 (s5)
= 30 rows. Session 4's four Georgia entities were **missing from this table until
2026-08-30** — the narrative recorded them but the authoritative per-entity table
did not, so earlier running totals were counted by hand and drifted. Count the
table, do not carry the previous line forward.

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

---

## Session 3 outcomes (2026-08-29)

**Florida DFS → Miami, Tallahassee, Bradenton, Palm Beach County, Miami-Dade,
Leon and Manatee Counties.** Florida's FIRST local entities in TT — the state
previously held only its state node — and the campaign's first
`compiled_from_audited` rows.

| | |
|---|---|
| Entities added | **7** — 3 cities + 4 counties (Palm Beach County is itself the Knight community) |
| Rows loaded | **190** = 95 entity-years × 2 datasets, FY2012–FY2025 |
| Oracle | **$0 drift on all 95 entity-years, both money columns**, against DFS's separately published `TOTALREVEXPDEBT` |
| Second reader | **18/18 exact** — an independently written openpyxl reader vs the database |
| Grade | `compiled_from_audited` on all 190 — **the first in TT** |
| Scope | `total_governmental` · `basis=actual` · `reporting_entity=primary_government` on all 190; `source_url` on all 190 |
| FY month | 10 on all 190; **77 of 95 entity-years actively census-CONFIRMED**, 18 uncovered and reported as such |
| Frozen invariant | 190 registered, digest **unchanged** — $0 moved |
| Tests | 1,482 → **1,528**, all passing. Build green. |
| UAT | **9/9** — 8 entity-year pages + the two-level drill-down |

### The oracle, and what it deliberately does not cover

DFS publishes `TOTALREVEXPDEBT` — per-entity Total Revenues and Total
Expenditures — computed outside the detail reports TT parses. That is the check
external to the write path spec §5.2 requires, and NOT the tautological DB
`total = Σ items`.

⚠ **The loaded total is deliberately BELOW the oracle, and that gap is a
feature.** DFS's headline includes expenditure object code 90 and revenue
accounts 38x/39x, both of which the publisher itself defines as interfund
transfers rather than spending or revenue. So the oracle runs over the FULL
parse — every account, every object code, over the eight non-fiduciary fund
columns — which proves every figure was read from the right cell; the loaded
tree is then a documented subset of a verified parse. `scripts/verifyFloridaDFS.mjs`
prints the excluded amount per entity-year so the difference is a number on the
page rather than a mystery. **Never widen the tree to close it.**

For scale, FY2023: Miami-Dade excludes $1.57B of object-90 transfers and $916M
of 38x/39x other sources; Palm Beach County $387M and $626M. These are not
rounding.

### A SECOND READER WAS AVAILABLE HERE, AND IT MATTERED

Session 2 could not corroborate Charlotte or Mecklenburg with a second reader —
`-table` read those pages *confidently and wrongly*. A bulk XLSX source has no
such problem, so 18 entity-year figures were re-derived with **openpyxl in
Python** — a different language, a different library, and a reader written from
the workbook layout rather than from the loader — and compared against what is
actually stored in the database. 18/18 byte-exact. Combined with the DFS oracle
that is two independent confirmations of the same 190 rows.

### ⚠ THE FIRST PARSE RETURNED ZERO ROWS AND THE VERIFIER CALLED IT GREEN

The most useful defect of the session, and it was ours.

`readDetailRows` passed ExcelJS **`Cell` objects** into a coercion helper that
expected `.value`. An ExcelJS `Cell` carries a `result` property (undefined
unless the cell holds a formula), so `'result' in cell` is true for *every*
cell, the `{result: n}` branch returned `undefined`, and 30,189 real rows parsed
to nothing.

⚠⚠ **What made it dangerous was not the bug, it was the report.** The verifier
found no rows for any entity, wrote "not filed" seven times — which is a
*legitimate* state for FY2025 — counted zero checks, and printed
**"Oracle green"**. A gate that passes because it measured nothing is the
CA-county `censusGuard()` shape exactly: silence read as agreement.

Both halves are now pinned. `assertParsed()` refuses a zero-row detail workbook,
and the verifier exits non-zero on **zero checks**. `tests/floridaDfs.test.mjs`
uses a worksheet stub whose `getCell()` returns a Cell-shaped object *with* a
`result` property, because a stub returning bare values would not have caught
this.

### The traps, confirmed against the real data

* **Florida is OCTOBER; North Carolina, one session earlier, is JULY.** All 190
  rows carry month 10, resolved per row through `censusGuard()` and never
  carried from the previous session.
* **`Miami Dade County` — FAC drops the hyphen.** `floridaKnightEntities.mjs`
  carries a `censusName` for exactly this. Without it `censusGuard()` would
  return `{ok:true}` for an entity it never found, on all 13 of that county's
  entity-years. The `Saint Louis County` shape, third occurrence.
* **18 of 95 entity-years are census HOLES, not confirmations** — Miami-Dade
  FY2012–2022, Palm Beach County FY2021–2024, Bradenton FY2014/2015/2017. The
  loader reports CONFIRMED and unverified as different words and never
  conflates them.
* **FY2025 is genuinely partial** — Miami-Dade, Leon and Bradenton had not
  filed. 190 rows, not 196.
* **Palm Beach is two governments** (county `100050`, Town `200287`); every
  join is on `code`, and the oracle report — which carries no code at all — is
  keyed on (Unit Type, Unit Name) together.

### ⚠ Rounding is the ISSUER's, not ours

Miami-Dade, Manatee and Tallahassee file figures rounded to the nearest
thousand; Miami, Leon, Palm Beach and Bradenton file to the dollar. Both are
whole dollars — this is NOT the Charlotte/Austin units trap. The per-capita
guard confirms it: every entity lands in the $800–$2,700 band
(Leon $802, Tallahassee $1,639, Miami $2,703, Manatee $2,567), where a 1000×
slip would put them near $1–$3.

### UAT — 9 of 9

Driven through a real Chromium against the production API, 2026-08-29.

Eight entity-year pages render with correct totals, per-capita figures,
breadcrumbs (`United States / Florida / Miami-Dade County / Miami / Budget` —
the `county_id` linkage works), and a source chip naming the exact filing:
*"Florida DFS Annual Financial Report — Expenditure by Function (FY2023 actual,
audit-reconciled) · as of 2026-08-29"*. `Total Governmental` and `Actuals` both
render as scope chips.

⭐ **The drill-down works, and Florida is the first bulk source in TT where it
does.** Clicking `521.00 - Law Enforcement` on Miami FY2023 opens its object
codes — Personnel Services $295.2M (87.8%), Operating $36.9M, Capital Outlay
$4.0M, Grants and Aids $86,292. Ohio AOS and the other flat sources dim to an
empty panel on a leaf click (`project_flat_source_icicle_limitation`); this one
has a real second level.

⚠ **`audit_grade` STILL DOES NOT RENDER** — the ev-accounts passthrough
(follow-up 7, spec §3.7) is unchanged. TT now holds its first
`compiled_from_audited` rows and a reader cannot see that they are. The column
is correct and invisible, which is the precise failure `sourceChipTypes.ts`
documents.

### ⚠⚠ A PRE-EXISTING 2-ROW INVARIANT DEFICIT, FOUND BEFORE THIS LOAD WROTE ANYTHING

`npm run verify:frozen` was run BEFORE the Florida load — which is the only
reason the 190 could be attributed cleanly afterwards — and it was already
failing by 2 rows.

**Attributed EXACTLY, by two independent routes that agree:**

1. **The digest as an oracle** (the session-2 technique). Excluding
   `804fd360-8d0e-4ed2-ad17-3d4c67ad9e0f` (FY2025, $19,340,363,947.28) and
   `9d9205b9-f920-43c7-9452-a5b958df6e35` (FY2026, $20,853,668,993.02)
   reproduces `figures_frozen` byte-for-byte; no other pair does.
2. **The `basis` partition gate**, arriving from the opposite direction:
   `city-adopted-budget-doc` measured 169 on 2026-08-28 and matched 171.

Both name the same rows: **`Los Angeles Operating Budget` FY2025 + FY2026**,
created by that source's enabled cron sync at 03:07 UTC on 2026-08-29 — hours
after session 2 verified the invariant green. Registered under their own
milestone, `scripts/data/laOperatingCronDriftCreatedIds.json`, so they are NOT
filed under Florida's name.

⚠ **This is the second enabled-sync drift in two days** (San Francisco on
2026-08-28, Los Angeles on 2026-08-29) and it confirms the standing lesson
rather than adding a new one: **a partition count is a measurement with a date,
and the milestone that trips over the drift is always an unrelated one.** The
habit that made it cheap was running `verify:frozen` *before* writing, not only
after.

⚠ **OPEN, NOT FIXED HERE: those two rows are the series v2.28 deliberately
severed, growing back.** `project_la_city_series_severed` records why LA's
Socrata operating series was cut away from the SCO actuals. The sync that
created them is still enabled. They are honestly `fund_scope: unknown` /
`basis: unknown`, so nothing is currently drawn wrong — but this will recur every
time the sync rolls a year, and each time it will surface inside somebody else's
milestone.

### The account-code prefix was STRIPPED from labels (Chris, 2026-08-29)

Follow-up 5 below was decided rather than carried: `521.00 - Law Enforcement`
now displays as **Law Enforcement**, `10 - Personnel Services` as **Personnel
Services**. The plain-language sentence reads as English again — *"The biggest
share was Law Enforcement (26% of the budget), followed by Fire Control (17%)"*.

⚠ **Why this is not a breach of the transcribe-verbatim rule.** That rule exists
because a *rewritten* label can drift from the source it claims to quote.
Dropping a machine code is deterministic, reversible from the source workbook,
and leaves the publisher's own words untouched. `stripAccountCode()` records the
reasoning next to the regex.

**MEASURED BEFORE IT WAS APPLIED, across all 14 published years:**

| | distinct labels | collisions |
|---|---|---|
| Expenditure (function + object) | 170 | **0** |
| Revenue (account) | 320 | **7 pairs** |

Every revenue collision is the same category filed under two codes — a
`.900`/`.xxx` catch-all pair, or two adjacent codes with identical names
(`324.720`/`324.920` Impact Fees - Commercial - Other; `319.900`/`319.xxx` Other
General Taxes; `335.380`/`335.390` State Revenue Sharing - Other Physical
Environment, and four more). A collision **merges and sums**, which is right on
the merits and cannot move a total — and the tree builders return a `merged`
list so it is never silent. ⚠ **None of the seven entities triggers one**: no
colliding pair co-occurs in the same entity-year with a non-zero governmental
amount. The statewide sweep will hit them.

**Proof nothing moved.** The re-run wrote all 190 rows and afterwards the table
holds the same 190 ids and an identical `id|total_budget` digest
(`0dbc420307b2ccdff951503972d94bf5`) — so no row was created or destroyed and no
figure changed. Frozen invariant digest unchanged. Oracle still $0 on 95/95.

### ⚠⚠ THE RE-RUN WOULD HAVE INSERTED 190 DUPLICATES — a latent loader bug

`treasury_sync_city_budget` finds its target by **(municipality, fiscal_year,
dataset_type, fund_scope, basis)**, and both axis parameters default to
`'unknown'`. The first Florida load omitted them, which was harmless *only*
because the rows did not exist yet. Once the stampers had written
`total_governmental` / `actual`, a re-run would have matched nothing and taken
the RPC's INSERT branch — silently duplicating every row.

Caught by reading the RPC definition before re-running, not by the re-run.
`loadFloridaDFS.mjs` now passes `p_fund_scope`, `p_basis` and `p_derivation`
explicitly, which also means a row is born correctly classified instead of
waiting for a stamper. **This is `project_sync_city_budget_not_source_safe` in a
new axis: the guard people remember is `data_source`, and the key that actually
decides insert-vs-update is the axis pair.**

### ⚠ SIDE EFFECT: the strip opted Florida into category enrichment

Stripping the codes changed `link_key`, and 11 of Florida's 336 depth-0 labels
now match **universal** (`municipality_id IS NULL`) enrichment rows — so reader
pages gained explainer copy and the category search box that were not there
before: *law enforcement, fire control, parks and recreation, executive,
legislative, airports, information systems, other public safety, special events,
other federal grants, interest.*

Checked rather than assumed:

* **No state-specific bleed.** Zero of the matched rows contain Indiana,
  California, Bloomington or Los Angeles text — the failure
  `project_enrichment_scoping_fix` repaired. These are in the 22 records that
  memory records as "genuinely generic".
* **Object codes CANNOT be enriched, which matters here.** Depth-1 nodes key on a
  composite `parent|name` (`law enforcement|capital outlay`), so the universal
  `personnel services` row — which reads "Hiring, benefits, and employee
  relations", an HR *department*, not Florida's object code 10 **payroll** — can
  never attach. Had depth-1 keys been plain names, that explainer would have
  rendered under every function of every Florida entity and been wrong.
* ⚠ **9 of the 11 are `source='ai'` with no `source_url`.** That is the
  uncited-explainer policy question SRCSTD-01 already carries
  (`project_srcstd01_scoping`), not something this session introduced — but the
  strip extended its reach to 7 new entities, so it is recorded here rather than
  discovered later.

### Follow-ups opened

1. ⚠ **The LA Operating Budget cron sync re-creates rows in a severed series**
   (above). Decide whether to disable it, scope it, or accept and register the
   drift on a schedule.
2. **The statewide Florida unlock is REAL and was deliberately not taken.** The
   same loader reaches **409 cities and 66 counties** with no new extraction
   work — the marginal cost is verification, not code. Scoped out of this
   session by decision (Chris, 2026-08-29) so the session could end whole per
   §4.4; filed as its own milestone. ⚠ It would also be TT's first large
   `compiled_from_audited` population, and the **DEW branch must be handled
   deliberately** — `loadFloridaDFS.mjs` refuses those rows without
   `--allow-dew` precisely so that decision cannot be made by accident.
3. **`BALANCESHEETDETAILREPORT` (FY2022+) and `TOTALREVEXPDEBT`'s `Total Debt`
   column are unused.** TT has no balance-sheet or debt dataset today; Florida
   publishes both, free and bulk, for every local government.
4. ⚠ **`censusMonthFor`'s "outside the audited years" message prints a min–max
   RANGE, not the actual coverage.** Bradenton FY2014 reports "observed month
   10: 1998-2025", which reads as though 2014 is inside the range that just
   rejected it. The verdict is right and the explanation is misleading. Cheap
   fix, in `scripts/lib/facFiscalYearCensus.mjs`.
5. ~~**Labels carry the publisher's account codes**~~ ✅ **DECIDED AND DONE**
   (Chris, 2026-08-29) — stripped. See the section above for the collision
   measurement, the proof that no figure moved, and the enrichment side effect.
6. ⚠ **The seven entities have no `geo_id` or `hero_image_url`** — consistent
   with every entity seeded since Tucson, noted so it is a known gap rather
   than an oversight.
7. ⚠ **Universal enrichment now reaches Florida** — 11 depth-0 labels, 9 of them
   `source='ai'` with no `source_url`. No state-specific bleed, and object codes
   are structurally immune, but this is SRCSTD-01's uncited-explainer question
   arriving on 7 new entities. A policy call, not a defect.
8. ~~⚠ **Audit the other loaders**~~ ✅ **DONE 2026-08-29** — see the audit
   section at the end of this file. 30,786 rows across 4 families were exposed;
   all five call sites fixed and verified live, the cron path proved safe, and
   `tests/syncCityBudgetAxisKey.test.mjs` now blocks a regression.

---


## Session 4 outcomes — Georgia (2026-08-29)

**Recon gate: BULK.** Georgia DCA's Report of Local Government Finances covers
**721 local governments, FY2009–2025**, free, no-auth, at genuine icicle grade.
Full recon in `.planning/GA-RLGF-RECON.md`.

**Loaded: 4 entities, 76 rows, FY2016–2025** — Georgia's first locals. Macon-Bibb
County, Columbus-Muscogee, Milledgeville and Baldwin County. 38 filings × 2
datasets; the 38 are not 4×10 because DCA's own listing has no Macon-Bibb FY2024
and no Milledgeville FY2018.

**Frozen invariant: registered 76, digest UNCHANGED at `90f009fe…` — $0 moved.**

### The audit grade: neither the NC answer nor the FL answer

Three sessions, three shapes:

| | publisher's position | grade |
|---|---|---|
| NC LGC | says "self-reported" | went to ACFRs → `audited_gaap` |
| FL DFS | RECONCILES to the audit | `compiled_from_audited` |
| **GA DCA** | **DISCLAIMS, and nobody checks** | **`self_reported_unaudited`** |

Rule 110-3-1: *"This information does not have to be audited."* The form: *"DCA
cannot certify the accuracy of the report figures submitted."* CVIOG: *"may or
may not be audited amounts or may be reported... using an accounting basis other
than that used in the local government's financial reports."*

⚠⚠ **But the form carries a PER-YEAR audited flag that flips within one entity** —
Milledgeville answered YES, YES, NO ×6, then YES again. Chris's call: all
branches grade `self_reported_unaudited`, because a preparer's own YES adds no
independent assurance; the branch is recorded in the `data_source` string so it
stays re-gradable without a reload. **The strongest evidence yet that this axis
must live per ROW.**

### ⚠⚠ THE MILLEDGEVILLE RULE — established this session

Milledgeville FY2025 reports **Rents and Royalties = $7,176,532,550.32** for a
city of 16,664. It passes every internal oracle, because DCA's subtotals carry it
through.

**It is LOADED, as published.** Chris: *"it is not our job to hide bad data"* —
suppressing a verified outlier would create a blind spot for legitimate fraud. I
had proposed refusing it; that was reversed. The register is
`scripts/data/gaRlgfAnomalies.mjs`, and **nothing in it is withheld from the
product.**

⚠ **Every flag is corroborated by independent agents before being recorded** — a
standing requirement from this session. Two agents, neutral prompts, raw files.
They confirmed the figure is a literal `NUMBER` record at `Page 2!J49` (raw BIFF8
walk), reproduced it from a separate publisher pipeline (TED), and independently
reached the same benign explanation: `7176532550` is exactly ten digits, the
signature of a phone or account number in a dollar cell. No allegation is made.

### ⚠⚠ The publisher's machine extract is defective — and it hid as data

`LOAD1` is a formula layer over the printed pages. Where a form row was
renumbered, the reference snapped to `#REF!` and its neighbour picked up the
displaced value, attaching real money to the WRONG UCOA account. Two independent
agents converged on this from 18,801 and 3,154 comparisons respectively.

* **10 disagreements, each paired 1:1 with a `#REF!`.** $29,041,043.53
  misattributed; $2,026,961.00 vanishes from the extract entirely.
* **Largest: $18.13M of Macon-Bibb jail spending filed under "Prisoner Custody"
  instead of "Jail Operations".**
* ⚠⚠ **`LOAD1`'s `TTL_*` subtotals stay CORRECT even where its line items are
  wrong**, so a control-total check passes over misattributed detail. Three cases
  disturb no subtotal at all. **Subtotal ties are necessary but demonstrably not
  sufficient.**
* The `33_1000C` break repeats identically in three consecutive Macon-Bibb years
  — a property of the template, not a keystroke.

**So the design is inverted from the obvious one: the PRINTED FORM is primary and
the extract is the corroborating read.** The printed detail reconciles to the
form's own subtotals in 1,672 of 1,672 tests; `LOAD1` fails 10.

⚠ **`LOAD1` is largely DERIVED from the pages by cell reference (`tRef3d`)**, so
page/extract AGREEMENT is not independent corroboration — they agree by
construction. Only the disagreements carry information.

### ⚠⚠ An Excel error cell reads as a small plausible dollar amount

xlrd reports an error cell as its error CODE: `#REF!` is **23**, `#DIV/0!` 7,
`#VALUE!` 15, `#N/A` 42. TT's converter was copying those through as numbers.
**This corpus holds 1,851 error cells across 37 of 58 workbooks.** Now written as
error TEXT and asserted by `--check`; the parser treats them as ABSENT, never 0.

### ⚠⚠ A write that reported success and wrote nothing

`treasury_sync_city_budget` ends with `EXCEPTION WHEN OTHERS THEN RETURN
jsonb_build_object('error', SQLERRM)`, so a constraint violation arrives as
`data.error` while PostgREST's `error` is null. The loader printed **"Wrote 76
budget rows"** having written none — all 76 refused by `budgets_derivation_check`.
Only querying the table afterwards caught it. **Counting attempts is not counting
writes.**

⚠ `loadFloridaDFS.mjs` has the same blindness. It has never fired there.

### Verification

* **684 of 684 oracle checks**, 0 failed, 0 skipped, across all 38 filings —
  section subtotals, Part I / Part III / Own Source rollups, and Total Part V,
  every one against the publisher's OWN printed figure.
* 76 rows, **0 duplicate slots**, 0 null `source_url`, 7 roots with real children.
* **Re-ran the loader end to end: still 76 rows, still 0 duplicates, digest
  unchanged** — proving the axis pair updates in place rather than duplicating.
* 1,592 tests green (34 new).

### Fiscal calendars

⚠ **Georgia is not a uniform-month state** — the FAC GA slice splits 225 July /
212 January / 60 October. Baldwin County is month **1**; the other three are 7.

⚠⚠ **Two of the four are ABSENT from the FAC census** — Columbus-Muscogee has no
row under any name, and Macon-Bibb appears only as the pre-consolidation `Macon`
and `Bibb County`. `censusGuard()` returns ok when it cannot find an entity, so
both would pass unchecked. Recorded honestly as `censusConfirms: false` rather
than claiming a confirmation that was never made.

⚠ **Baldwin County changed its calendar** — month 7 through 2008, month 1 from
2011, with a 9-month stub in 2010. The FY2016+ window is clear of it; it is a
live trap for the FY2009–2015 follow-up.

### Modelling decisions, all revisitable

* ~~**Consolidated governments are typed `county`.**~~ ⚠⚠ **CORRECTED 2026-08-30
  — RETYPED TO `city`.** The premise was wrong: these were NOT TT's first
  consolidated governments. **San Francisco has been typed `city` with
  `county_id` NULL since long before this campaign**, so session 4 set no
  precedent — it diverged from one. Session 5 found it by checking the live
  database rather than reasoning from the filings, Philadelphia went in as
  `city`, and these two were retyped to match. Census confirmation of
  coterminousness (157,056 and 201,830 exact) still stands and is equally true
  of San Francisco — which is the point: it justifies a `consolidated` type, not
  `county` specifically. $0 moved; the frozen digest was byte-identical either
  side. See "Retyped the two GA consolidated governments" below.
* **`fund_scope` is `unknown`, deliberately.** Part V excludes debt service, so
  these understate a true `total_governmental` by ~5.5%. Claiming that scope
  would assert a comparability the rows do not have — the WeHo precedent.

### Follow-ups filed

1. **FY2009–2015** — a different form generation (`Exportable Data`, 1,219 keys).
   ⚠ It carries **1,393 `#REF!` cells** and no `LOAD1` layer: MORE error-ridden
   than the window loaded here, not less.
2. **The statewide sweep** — 721 governments on the same URL pattern and schema.
3. **`loadFloridaDFS.mjs` ignores the RPC's return payload**, as this loader did.
4. **`reporting_entity` is `unknown` on all 76.** The form has a Part XIV
   "Dependent Entities" question that would settle it; not yet read.
5. **TED (`ted.cviog.uga.edu/FileExport`) is a second, genuinely independent
   access path** to the same data — the right cross-check for any future GA
   figure, and a candidate for the sweep.
6. **Macon-Bibb FY2016 Part XII**: the printed form's own total formula
   contradicts its own caption ("excl. Held Prev. Yr" but includes it),
   overstating by $99,304,981. Outside the loaded trees, but it is the one
   measured case where the PRINTED FORM is wrong.

---

## ⚠⚠ AUDIT: `treasury_sync_city_budget` callers and the axis lookup key (2026-08-29)

Prompted by the Florida relabel, which would have inserted 190 duplicates. The
audit was driven from the DATA as well as the code, per the a/aa inversion
lesson — the code pattern alone would have over-reported by five families.

### The mechanism

`treasury_sync_city_budget` finds its target with:

```
WHERE municipality_id = p_municipality_id
  AND fiscal_year     = p_fiscal_year
  AND dataset_type    = p_dataset_type
  AND fund_scope      = p_fund_scope   -- DEFAULT 'unknown'
  AND basis           = p_basis        -- DEFAULT 'unknown'
```

A caller that omits the pair is asking for the row whose axes are *still*
`unknown`. That is correct on a first load and becomes a duplicate-generator the
moment the stampers classify the family. The RPC returns `status: success`.

⚠ **The guard everyone remembers is the wrong one.** `project_sync_city_budget_not_source_safe`
trained us to think about `data_source`, and `findConflictingBudget` checks
exactly that — but `data_source` is **not in the lookup key**. A loader can pass
every source-safety check and still duplicate.

### Proven read-only, before anything was changed

For Columbus, OH FY2024 operating: the omitted-params lookup matched **0** rows;
the passed-params lookup matched **1**. Real, not theoretical — and provable
without writing a byte.

**And it had never fired: 0 duplicate `(municipality, fiscal_year, dataset_type,
data_source)` groups in all 88,144 rows.** Latent exposure, not live corruption.

### EXPOSED — omitted the pair AND the family is 100% stamped

| Family | Rows | Axes | Caller(s) | Fixed |
|---|---|---|---|---|
| MN OSA | **21,794** | `total_governmental` / `actual` | `loadMNOSA.js` | ✅ |
| Ohio AOS | **6,616** | `total_governmental` / `actual` | `loadOhioAOS.js` | ✅ |
| CA SCO County Expenditures | 1,188 | `all_funds` / `actual` | `loadCountyBudget.js`, `loadLACountyOperating.js` | ✅ |
| CA SCO County Revenues | 1,188 | `all_funds` / `actual` | `loadCountyBudget.js`, `loadLACountyRevenue.js` | ✅ |
| **Total at risk** | **30,786** | | | |

⚠ **The asymmetry is the interesting part.** `bulkLoadStateController.js` — the
CITY State Controller loader — always passed the pair. The COUNTY loaders for
the same publisher never did. Nothing distinguished them but the person who
wrote them.

**Verified live, not reasoned about:** `loadOhioAOS.js` was re-run for Columbus
FY2024 after the fix. The operating row kept id
`146f91f5-9366-4eb9-aca3-763508fd1942`, two rows exist rather than four, the axes
survived, and the totals still match the figures quoted in `basisRegistry`'s own
evidence string ($2,477,440,000 / $2,166,549,000). Frozen digest unchanged.

### NOT exposed — the family is still `unknown`/`unknown`, so the defaults match

`loadCASalaries.js` + `sweepCASalaries.js` + `sweepOCSalaries.js` (publicpay,
7,682 rows) · `loadVAComparativeReport.js` (608) · `loadUtahTransparency.js`
(539) · `loadWICMREB.js` (20) · `loadLACountySalaries.js` (1).

⚠⚠ **These must NOT be "fixed".** Passing real values to a caller whose family is
unstamped is the INVERSE defect — the lookup would stop matching and it would
duplicate in the other direction. The rule is not *always pass*; it is **pass
exactly what the family's rows carry**. Each is exempted in the guard with the
measurement that justifies it, and must be revisited if its family is stamped.

### The cron path is SAFE, and it is worth knowing why

`treasury_sync_budget_tree` — **256 call sites**, including the Socrata edge
functions that run unattended — keys on `(municipality, fiscal_year,
dataset_type, period_label, data_source)`. It takes **no `p_fund_scope` at all**,
and writes `basis = COALESCE(p_basis, basis)` so a silent caller cannot reset it
either. The two RPCs key differently, and only the MANUAL one puts the axes in
its key. The automated, highest-volume path was never at risk.

### The guard

`tests/syncCityBudgetAxisKey.test.mjs` enumerates every caller under `scripts/`
and requires each to be explicitly REQUIRED (passes the pair) or EXEMPT (family
measured unstamped, with the measurement). A new caller fails the suite until
someone measures its family. It also asserts it found at least 14 call sites, so
it cannot pass by matching nothing — the "Oracle green" failure from earlier in
this same session.

---

## Session 5 outcomes — Pennsylvania + Indiana (2026-08-30)

**7 entities / 136 rows / FY2015–2024.** Pennsylvania's FIRST local entities in
TT; Indiana's first outside the Monroe County set. **30 of 43 entities (70%).**
Recon detail lives in `.planning/PA-IN-RECON.md`.

Both states cleared the §4.2 gate as **BULK**, so the session unlocked two more
statewide sources rather than two cities.

| | Pennsylvania | Indiana |
|---|---|---|
| Source | DCED Municipal Statistics, form DCED-CLGS-30 | Gateway (IFI / DLGF / SBOA) |
| Access | anonymous ASP.NET POST → `.xls` | anonymous ASP.NET POST → pipe-delimited |
| Reach | 2,572 municipalities + 67 counties, **1996–2024** | all cities/towns + 92 counties, **2011–2025** |
| Grade | `self_reported_unaudited` | `self_reported_unaudited` |
| Basis | cash (publisher's word) | regulatory (publisher's word) |
| Oracle | Philadelphia's own ACFR, **$0** | Gateway's Cash and Investments report, **11,283/11,283** |

### ⚠⚠ THE HEADLINE LESSON: A PASSING ORACLE HID A $735M SCOPE ERROR

Lake County's settlement fund carries Gateway `Fund_code` 106000 in every year of
the window **except FY2022, where Gateway renumbers it 900334** — same name, same
magnitude, sitting neatly between its neighbours.

A code-only exclusion missed it, and **all 11,283 fund-level oracle checks still
passed.** Lake County FY2022 would have shipped at $1.51B against ~$800M either
side. It was caught by reading the series for continuity, not by any gate.

> **The oracle proves the READ. It cannot prove the SCOPE.**

This is Georgia's "a tie is necessary but not sufficient" in its most expensive
form so far, and it is now a test.

### ⚠⚠ Name-based rules failed in BOTH directions, three times

* `Settlement` (Lake) vs `TAX SETTLEMENT` (Allen) — same fund, different spelling.
* `Transfer In` vs the actual `Transfers In` — a pattern missed **$789,783,682**.
* **`d704` in lowercase** beside `D704`, worth $455,000.
* And over-matching: `Monsanto Class Action Settlement` and `Wheel Tax Bond Road
  Improvement` ($4M) are real revenue any substring rule would have dropped.

The settlement rule is now code **OR** exact name, corroborated per entity-year by
`assertSettlementIsPassThrough()` — what comes in must go back out. Lake FY2023
received $799,271,207.07 and disbursed $799,270,607.06: **$600 apart on $799M.**

### ⚠⚠ The expenditure report that is not the revenue report's counterpart

Gateway's "Disbursements by Fund and **Department**" is **General Fund only** —
Fort Wayne FY2023 carries ONE fund ($129,840,788) against 105 funds and
$523,127,046 on the receipts side. Pairing them files General Fund spending
against all-fund revenue, a 4x scope mismatch that ties against its own subtotals
the whole way. The loader uses "Disbursements by **Fund**" instead.

⚠ Gateway serves **four different column orders** across its AFR reports, and one
uses lowercase `fund_code`. Everything is parsed by header name.

### ⚠⚠ A published subtotal that does not sum its own columns

PA's `Governmental Funds- Total Miscellaneous Revenues` is NOT the sum of the
columns beneath it. `Charges for Service` is a **sibling**, not a child, despite
appearing above the subtotal — $13,312,294 for Centre County FY2023. Reading the
columns positionally misparents it **while the grand total still ties.** Verified
across all 63 approved county rows, zero exceptions.

⚠ Separately, `Total Taxes Revenues` disagrees with its own detail in **139 of
2,395** approved municipal rows (5.8%). Neither loaded entity is affected — checked,
not assumed — and it is now asserted per row.

### Philadelphia: the coterminous question, resolved by the DB not by argument

Chris asked whether San Francisco is called a city despite being a consolidated
city-county. It is: **SF is typed `city` with `county_id` NULL in TT, and that
predates session 4.** So Georgia's `county` typing is the outlier, and following
DCED (which files Philadelphia in the MUNICIPAL extract, typed `City`, leaving an
empty `PHILADELPHIA  COUNTY` placeholder) agrees with TT's own older convention.

Census corroborates coterminousness independently: Philadelphia city (SUMLEV 162)
and Philadelphia County (SUMLEV 050) are both **1,573,916**.

⚠ **FOLLOW-UP: Macon-Bibb and Columbus-Muscogee are now inconsistent** with SF and
Philadelphia. Retyping moves $0 but edits merged session-4 work.
**Nashville-Davidson (session 6) and Lexington-Fayette (session 8) are still
coming — settle the rule before those land, not after.**

### The audit grade: a FOURTH distinct answer in four states

```
NC LGC  publisher says "self-reported"           -> ACFRs instead, audited_gaap
FL DFS  publisher RECONCILES to the audit        -> compiled_from_audited
GA DCA  publisher DISCLAIMS, nobody checks       -> self_reported_unaudited
PA DCED AN AUDITOR FILES IT — for some classes   -> self_reported_unaudited
IN SBOA a real auditor, but AFTERWARDS           -> self_reported_unaudited
```

**Indiana**, verbatim from Gateway's own explainer (`LearnMoreAFR.pdf`, rev.
11/3/2022): *"These reports, as submitted by the units … **are unaudited**. The
State Board of Accounts (SBOA) uses these Gateway submissions as part of their
required auditing of these units."* ⚠ SBOA genuinely audits these units — but
afterwards, on a cycle, and Gateway publishes the pre-audit submission. **An audit
existing somewhere in the process is not the published figures being
audit-derived.**

**Pennsylvania** is the first case where the grade UNDERSTATES what TT knows.
DCED-CLGS-30 §IV: *"Cities: Director of Accounts and Finance / Boroughs: Elected
Auditors, Independent Auditor, or Controller"* — so **State College's filing is
auditor-signed and Philadelphia's is not**, the opposite way round from what size
suggests. DCED's own verification is arithmetic (*"agrees to the calculated
balance taking last year's ending … plus revenues minus expenditures"*), never
against an audited statement — so PA is **not** `compiled_from_audited`. The
auditor-type branch appears in none of the 71 published columns, so §3.5's
weaker-branch rule applies. **FOLLOW-UP: find a per-entity auditor-type source and
PA becomes Florida-shaped.**

### Scope decisions, all Chris's, all recorded

1. **Settlement funds excluded** (SBOA: *"Only used for settlement"*; disbursements
   are `Distributions to Other Governmental Entities`; nets to $600 on $799M).
   ⚠ 60 of 92 counties report it and 32 do not, so loading it as published would
   make Lake look far richer than Allen for presentation reasons alone.
   Payroll Clearing and Clerk Trust are deliberately left IN — the
   Gateway-code-to-SBOA-class mapping for those is inference, not the publisher's word.
2. **Everything normalised to OPERATING flows.** PA municipal `Total Revenues`
   INCLUDES financing sources (14.5% — Philadelphia $1,785,924,110); PA county
   does NOT; Indiana includes transfers ($789.8M), debt proceeds ($675.6M) and
   investment churn ($522.6M). Session 3 already excluded FL's 384 Debt Proceeds,
   so loading as published would have made this campaign's own entities
   incomparable. Excluded by SBOA code, never by name.
3. **PA municipal is `all_funds`, PA county is `total_governmental`** — both READ
   from the source. The municipal report folds enterprise in with no removable
   subtotal (Philadelphia: Water $478,492,062, Sewer $343,180,320), so §2.3's
   exclusion cannot be applied. The WeHo precedent: record the scope honestly
   rather than force a comparability the rows do not have.

### Fiscal calendars — PA's single most dangerous trap

**611 of the 643 PA rows in the FAC census are month 1. Philadelphia is one of
thirteen that are not — it is month 7.** A loader resolving "PA = January" once
mislabels its entire series.

⚠⚠ And DCED's form contradicts the census on its face: it is calendar-framed
throughout (*"Fund Balance/Retained Earnings 12/31"*) while Philadelphia's year
ends June 30. **Resolved by oracle, not argument:**

```
DCED  Total Taxes Revenues, Reporting Year 2023        $5,160,574,000
ACFR  governmental funds, FY ended June 30 2023,
      Tax Revenue  $5,160,574 thousand              =  $5,160,574,000
                                                       ------------- $0
```

An exact match to the dollar against a different publisher's document. FY2022 ties
exactly too; FY2021 and FY2015 differ by 0.006% and 0.18% — later restatements in
ACFR Table 4. **This settled the period AND supplied the independent oracle.**

### Verification

* **Indiana: 11,283 / 11,283** fund-level checks tie against Gateway's separate
  Cash and Investments report — a different report, not a self-tie.
  ⚠ Its `r_bal`/`d_bal` are *net of investment transactions*, so the oracle
  compares like with like; the two initial mismatches were `Sale of Investments`
  ($400,000) and `Purchase of Investments` ($760,817.76), to the cent.
* **Pennsylvania: 105 / 105** in-file checks across 29 entity-years.
* **1,642 tests pass** (1,592 baseline + 50 new).
* **Frozen invariant: count reconciles at 79,916**, all 136 rows registered.
  The digest was **byte-identical before and after the load** — this load moved $0.
* 0 duplicate `(entity, fiscal_year, dataset_type)` rows; 0 graded rows lacking a
  `source_url`.

### Gaps, reported rather than hidden

* **Gary FY2015 was never filed** — absent from BOTH the receipts and
  disbursements extracts while 2011–2014 and 2016–2024 are present. The loader
  distinguishes "not filed" (skip, report) from "parse broke" (fail loudly);
  a year missing from only ONE side is a defect, not a gap.
* **Centre County FY2016 is `status=P`** (pending, not approved). Reported and
  withheld — never written as $0.
* Census-UNCOVERED years reported as uncovered, never as confirmation: Allen
  FY2015, Lake FY2019.

### ⚠⚠ Found BEFORE the load: the v2.33 predicted drift fired

`verify:frozen` was green at session start (79,916 / `90f009fe…`) and red before
the load, with the **count reconciling** — a surviving row's figure had moved. Four
enabled sources cron-synced at 04:13–04:16 UTC that day: LA City Checkbook, Dallas
Revenue Budget, Dallas Operating Budget, Bloomington Annual Compensation. All seven
of their rows are inside the frozen set.

**This is exactly the risk recorded at the v2.33 rebase**, verbatim: *"7,688 of the
79,916 frozen rows (9.6%) belong to ENABLED, cron-syncing sources … the sync
rewrites total_budget and this digest moves with no human involved — a drift source
no ledger can capture."* The prescribed fix is already written there: **scope the
digest to the 72,228 rows NOT under live sync.**

⚠ It could not be attributed to a single row — no per-row baseline exists, and
`budgets.updated_at` is not stamped by the RPC. Structurally the likeliest mover is
**LA City Checkbook**: the only *weekly* source, and a `transactions` dataset that
accumulates by design.

⭐ **Running `verify:frozen` BEFORE the load is what proved this load innocent** —
the database digest is byte-identical before and after the 136 rows landed.

### Follow-ups filed

1. **Implement the v2.33 prescribed fix** — scope the frozen digest to rows not
   under live sync. Until then `verify:frozen` reports FIGURE CHANGED for a
   pre-existing, unattributable, non-TT cause. **This is the highest-value item.**
2. ✅ **DONE 2026-08-30 — Macon-Bibb and Columbus-Muscogee retyped to `city`**,
   so TT now holds ONE convention for consolidated governments. See the section
   below.
3. **Hunt for PA's per-entity auditor-type field.** If found, PA becomes
   Florida-shaped and State College grades above Philadelphia.
4. **The PA statewide sweep** — 2,572 municipalities + 67 counties, FY1996–2024,
   no new extraction work. **The IN statewide sweep** — all cities/towns + 92
   counties, FY2011–2025. Both filed the way session 3 filed the Florida sweep.
5. **Extend the windows**: PA reaches back to 1996 and IN to 2011; this session
   took an aligned FY2015–2024 decade so it would end whole.
6. Payroll Clearing (105100) and Clerk Trust (100006) remain IN the Indiana
   figures. Deciding them needs a Gateway-code-to-SBOA-class mapping TT does not
   have.

---

## Retyped the two GA consolidated governments — 2026-08-30

**Macon-Bibb County and Columbus-Muscogee: `county` -> `city`.** Chris's call,
executed the same day session 5 surfaced the inconsistency.

TT now holds **one** convention for consolidated city-counties:

| Entity | State | type | `county_id` | since |
|---|---|---|---|---|
| San Francisco | CA | `city` | NULL | pre-dates the campaign |
| Philadelphia | PA | `city` | NULL | session 5 |
| Macon-Bibb County | GA | `city` | NULL | **this correction** |
| Columbus-Muscogee | GA | `city` | NULL | **this correction** |

### Why session 4 got it wrong, and why that is worth recording

Session 4 believed it was **setting** TT's precedent for consolidated
governments. It was not — **TT already carried San Francisco as `city`**, and
nobody looked. The session-4 reasoning was sound on its own terms (Census
coterminousness, county functions in the RLGF filings, the legal name
"Macon-Bibb County"); it was simply answering the question in isolation.

⚠ **Every one of those arguments is equally true of San Francisco.** They justify
a distinct `consolidated` type, not `county` specifically. The lesson is the
campaign's own recurring one, in a new place: **check the live database before
declaring a precedent.**

⚠ Pennsylvania's publisher independently agrees with `city`: DCED files
Philadelphia in the MUNICIPAL extract typed `City`, leaving an empty
`PHILADELPHIA  COUNTY` placeholder that never files.

### Safety, measured rather than assumed

* `entity_type` lives on `municipalities`, **not** `budgets`, so the frozen digest
  — which hashes `(budget id | total_budget)` — cannot move. Confirmed: the
  digest was **byte-identical** before and after.
* The **38 budget rows** on the two entities are untouched, summing to
  $11,131,004,635.38 before and after.
* Checked BEFORE the change: **nothing pointed at either as its `county_id`**
  (Milledgeville's parent is Baldwin County), so no parent/child link broke.
* `city` is in `SOURCE_CHIP_ENTITY_TYPES`, so provenance keeps rendering.
* The **NAME "Macon-Bibb County" is deliberately unchanged** — it is the
  government's legal name. Only the type moved.
* 1,644 tests pass; `tests/gaRlgf.test.mjs` now asserts `city` **and** that no
  second row exists for the county half.

### ⚠ What this does NOT settle

Whether TT should have a distinct `consolidated` entity type at all. It was
rejected in session 4 because UI and rollup code switches on the existing values
and an unknown type would drop these entities out of both — still true. That is a
UI/rollup question, filed separately, and **Nashville-Davidson (session 6) and
Lexington-Fayette (session 8) now have an unambiguous convention to follow either
way.**

---

## Session 6a outcomes — South Carolina (2026-08-30)

**4 entities / 90 rows. 34 of 43 entities carry data (79%).** South Carolina's
FIRST local entities in TT — the live table held exactly one SC row before this
session, the state node.

| | |
|---|---|
| Entities added | **4** — Richland County, Horry County, Columbia, Myrtle Beach |
| Rows loaded | **90** = 52 county (RFA bulk, FY2012–24 × 2 datasets) + 38 city (own ACFRs) |
| Counties | `self_reported_unaudited` · `unknown` scope · `actual` · month 7 |
| Cities | **`audited_gaap`** · `general_fund` · `actual` · month 7 |
| Frozen invariant | digest **BYTE-IDENTICAL** before and after BOTH loads — $0 moved |
| Tests | 1,664 → **1,717**, all passing. Build green. |

### ⚠⚠ THE SESSION'S HEADLINE — ONE STATE NEEDED BOTH ROUTES

Session 6 was planned as "SC + TN → 3 primary entities + counties" and recon
broke that in two directions at once, so it was split and SC taken alone.

**South Carolina has an excellent statewide source that CANNOT PRODUCE A CITY.**
RFA's Local Government Finance Report is free, no-auth, icicle-grade and reaches
FY93–FY24 across 46 county sheets — and it publishes each county's municipalities
only as a **combined "Cities only" block**. The footnote says so outright:

> "*Cities Include: Arcadia Lakes, Blythewood, **Columbia**, Eastover, and Forest
> Acres."

Reading Columbia out of that block would have handed five governments' money to
one of them **and tied against every internal check while doing so.** The counties
are therefore BULK and the cities are ACFR, recorded in the roster as `source` so
the two routes can never be confused.

⚠ **Tennessee was split out for the mirror-image reason** and is session 6b. The
Comptroller's TAG export is fund/account/object-level for all 95 counties,
FY2007–2025, prepared by the division that AUDITS 91 of them — potentially the
strongest grade TT has seen — and **Davidson is one of the four CPA-audited
exceptions, present at TOTAL ONLY**: one revenue row and one expenditure row per
year, no tree. The TN bulk unlock serves **zero** session-6 entities.
⚠⚠ And Davidson's single row hides a scope break: through FY2024 the `PRI` total
runs $1.72B → $4.00B, then FY2025 reads $2.41B with a separate `SCH` row at
$1.56B. Loading the `PRI` series would render a fake $1.4B collapse. The
session-5 Lake County trap in a new costume.

### ⚠⚠ THE ORACLE PROVED THE READ AND MISSED A REAL DEFECT — AGAIN

Horry County's `Local Option Sales Tax` reads **$0 for eleven straight years
(FY2012–FY2022), then 133,451,553 in FY2023, then BYTE-IDENTICAL 133,451,553 in
FY2024.**

Every gate passed over it:

* 208/208 in-file checks (parent = Σ children at every depth) — pass
* statewide oracle, Σ all 46 county sheets vs RFA's own `State Summary`, both
  money columns, all 13 years — **$0**
* independent second reader (xlrd over the original .xls) vs the database — 52/52

It passes because **RFA's own aggregation propagates the same defective cell**:
county 133,451,553 + cities 3,883,307 + school 0 = the combined block's
137,334,860, exactly. The arithmetic is consistent around a county figure that
did not move between years while the cities figure did.

**Horry County's own audited FY2024 ACFR shows no Local Option Sales Tax at all**
— it reports a Capital Projects Sales Tax (RIDE II/III) and a Hospitality Fee.
SC's LOST (§4-10-10) is a distinct tax Horry has never adopted, which is what the
eleven years of $0 were telling us.

**Loaded as published and flagged, per the Milledgeville rule.** It is ~14% of
that entity-year ($133.5M of $943.0M). Suppressing it would hide a publisher
data-quality defect that a reader of TT should be able to see.

### ⚠⚠ THE WORKBOOK'S TWO QUALITY SIGNALS CONTRADICT EACH OTHER

A year can be marked not-reported in the column header (`FY 23*`) or in the
`County Info` Y/N matrix, and **neither is a superset of the other**:

| County | header asterisk | `County Info` |
|---|---|---|
| Clarendon, Jasper | FY23, FY24 | all `Y` |
| Kershaw | FY21 | all `Y` |
| Allendale | none | `N` FY20, FY21, FY24 |
| Hampton / Orangeburg / Williamsburg | none | `N` FY22–24 |

A county-year is trustworthy only when BOTH agree, so `reportedYears()`
intersects them. Richland and Horry are clean on both across the whole window.

⚠ A naive `FY \d{2}` match SILENTLY DROPS a starred column; stripping the
asterisk SILENTLY LOADS a year the county never reported. Neither is acceptable.

⚠ This matters because before the 2023 edition a non-reporting county's missing
year was **backfilled with the prior year's data**.

### A FIFTH DISTINCT AUDIT-GRADE ANSWER IN FIVE STATES

| | publisher's position | grade |
|---|---|---|
| NC LGC | says "self-reported" | went to ACFRs → `audited_gaap` |
| FL DFS | statute says self-report; MANUAL says DFS reconciles to audited statements | `compiled_from_audited` |
| GA DCA | rule says audit optional; per-year flag flips within one entity | `self_reported_unaudited` |
| PA DCED | form is titled "AUDIT" and an auditor really does sign some classes | `self_reported_unaudited` |
| **SC RFA** | **explicitly REFUSES the audit as a submission** | `self_reported_unaudited` |

Verbatim, the county form instructions:

> "NOTE: **We cannot accept financial audits as submissions.** That is a separate
> reporting requirement with the State Treasurer's Office."

The cleanest evidence in the arc. There is no reconciliation step of any kind,
which is exactly what earned Florida its higher grade.

⚠ **One column family has different provenance and is still not audited:**
"Property tax sections have been removed to reduce duplication of effort. RFA
uses the Department of Revenue's Local Government Report from county auditors
instead." A second self-reporting channel — grade unchanged, provenance recorded.

### ⭐⭐ THE TRANSFERABLE FIND — FAC SERVES COMPLETE AUDITED ACFRs, FREE

    https://app.fac.gov/dissemination/report/pdf/<report_id>

**No API key, no auth, no WAF, back to at least FY2016**, and the bytes are the
auditee's own submission filed under federal penalty. (The metadata API at
`api.fac.gov` DOES need `X-Api-Key: DEMO_KEY`; the PDF endpoint needs nothing.)

⚠ **This is the route session 2 needed and did not have.** It bypasses
charlottenc.gov's Akamai WAF (which required a real Chromium), Mecklenburg's
Widen DAM (which has NO durable file URL), and Richland County's own site here,
which 403s curl AND PowerShell. Its ids also do not rot the way a city CMS path
does — `charmeck.org` losing Charlotte's pre-FY2011 reports is the failure this
avoids. **Worth revisiting the NC access gap with this.**

⚠ FAC stores whatever the auditee uploaded, so quality varies — see below.

### ⚠⚠ NINE OF NINETEEN OPINIONS WOULD HAVE READ AS UNAUDITED

Session 2 found 8 of 36 opinion pages image-only. This corpus is worse — 9 of 19,
in **two distinct failure modes**:

* **7 image-only opinion pages**, recovered by OCR at 200dpi (Columbia
  FY2020–FY2023; Myrtle Beach FY2017, FY2021, FY2024). A text search finds
  "Independent Auditor" only in the table of contents.
* **2 text layers that lost their spaces** (Myrtle Beach FY2022, FY2025), which
  render `eachmajorfundandtheaggregateremainingfundinformation` and `fmancial`.
  The phrase is present and unsearchable; found only by collapsing all whitespace.

All 19 carry an unmodified GAAP opinion naming **"each major fund"**, and the
General Fund is a major fund in every one — the §3.5 standard.

⚠ **The first "In our opinion" on a page is not necessarily the right one.**
Myrtle Beach FY2022 p21 carries an in-relation-to opinion on the COMBINING AND
INDIVIDUAL FUND STATEMENTS. Grading on it would have been grading the wrong
sentence.

⚠ **Myrtle Beach FY2025 is a MIXED document** — OCR-damaged opinion pages,
born-digital statement pages that extract cleanly. Do not infer one section's
quality from another's.

### ⚠⚠ AN OCR'D STATEMENT MISSED THE TIE BY EXACTLY $1

Myrtle Beach FY2018's FAC copy is a scan. Its OCR layer renders `Stonn Water
Fees`, `Local Option Touris1n Taxes` and `Jntergovernmental`, and **fuses four
revenue line items into a single row** — and computes 64,439,897 against a
printed 64,439,896.

**A "small delta" tolerance would have shipped it with four categories
destroyed.** This is precisely why `acfrGF.py`'s `source_rounding` is an
exact-delta registry and NOT a tolerance. Replaced with the city's own copy,
which ties at $0 with clean labels; its CDN 403s a bare curl and serves the file
to browser `Sec-Fetch-*` headers plus a Referer (the Oregon workaround).

⚠ **Columbia FY2019 is NOT LOADED and that is a decision.** Both surviving copies
are scans — FAC's OCR renders `20 ,775,337` and `Slate government`, and the
city's own copy has no text layer at all (1,900 characters across 169 pages).
Reported as a gap, never written as $0. The statistical section of a later ACFR
carries ten years of General Fund figures and would cover it, but that section is
OUTSIDE the auditor's opinion, so those rows could not be graded `audited_gaap`.

### ⚠ `-layout` AND `-table` DISAGREED, AND THE TIE COULD NOT ARBITRATE

Columbia's `-layout` output emits the label column and the numeric columns as
separate blocks, pairing `34,353,509` with `Local option sales tax` when it
belongs to `Licenses and permits` — the Charlotte defect. **Both pairings tie at
exactly $0**, because the offset permutes the multiset without changing it.

Settled by running `scripts/acfrGfComponents.py` (pdfplumber glyph
x-coordinates, which never see the character grid) over the same page: the glyph
reader agrees with `-table`, including three dash-zeros. So `-table` is sound
here and Columbia stays on the standard reader. **Choosing `-table` because it
tied would have been curve-fitting** — the error that got the LA-01 scope verdict
retracted.

### Scope decisions, all read from the publisher

* **FY2012 floor.** RFA's notes record bonds/leases becoming separately reported
  and county local option sales tax changing definition at exactly FY2012.
  Loading across it renders a definitional change as a trend.
* **Bonds & Leases excluded** — "proceeds from general obligation bonds" and
  "proceeds from capital leases" (form lines 861/862). The class TT already
  excludes in FL and PA, and the one v2.28 exists because of.
* **`fund_scope` = `unknown` on the county rows, deliberately.** The report drops
  utility sales REVENUE while keeping utility SPENDING (form line 970, "Public
  Works (Utility Systems, Public Transit)"), so the two money columns are on
  different scopes by construction — which is mechanically why RFA warns the data
  must not be used to relate revenues to expenditures.

⚠ **AN ASYMMETRY WORTH CHRIS'S ATTENTION, FLAGGED NOT HIDDEN.** Excluding bond
proceeds normalises the REVENUE side to operating flows, but the expenditure
side's `Debt Service & Interest on Debt` still contains the principal repayment
of those same notes and has no removable subtotal. Richland runs a Transportation
Penny programme on **Bond Anticipation Notes**, which are rolled over yearly, so
its debt service tracks its bond proceeds almost exactly (FY2019 $187M proceeds /
$279M service; FY2022 $44M / $51M; FY2023 $0.01M / $40M). This follows TT's
established convention in three prior states, and it is reversible if you prefer
symmetry.

### Corroboration of the largest figure

Richland County FY2024 `State Grants` reads **$330,077,746**, against $11.4M in
FY2022 — a 29x rise. Corroborated first-party from the county's own audited MD&A:

> "Revenues from governmental activities grew by 48.1% in 2024, largely due to a
> **$322.8 million grant for Scout**"

(Scout Motors' $2B EV plant in Blythewood.) Real and explained, not an outlier.
FAC independently corroborates the federal column too — $31.1M of federal awards
expended against RFA's $29.6M of federal revenue.

### Open follow-ups from this session

1. **Session 6b = Tennessee / Nashville-Davidson**, from Metro's own ACFR
   (`nashville.gov`, direct PDFs, FY2014+ at least, no WAF seen). ⚠ Consolidated
   → `city` with `county_id` NULL, per the settled convention.
2. **Nashville-Davidson is ABSENT from the TN FAC census slice** — every other TN
   county is there at month 7. Its month must come from the ACFR itself
   ("For the Year Ended June 30"), which is first-party and stronger anyway.
3. **The TN TAG statewide unlock** — 95 counties, FY2007–2025, fund/account/object
   detail, from the division that audits 91 of them. A filed, ready milestone
   that serves no Knight entity. ⚠ `SCH` and lowercase `Sch` both appear in the
   fund prefix column — the session-5 `d704`/`D704` case hazard.
4. **The SC statewide sweep** — the same loader reaches all 46 counties with no
   new extraction work; the marginal cost is verification. ⚠ It must handle the
   asterisk/`County Info` disagreement above, and Beaufort's 3 empty trailing
   columns.
5. **Re-examine the NC access gap with FAC** — Charlotte pre-FY2011 was ruled out
   as Wayback-only under the first-party policy; FAC may serve it first-party.
6. **Columbia FY2019** stays out unless someone decides OCR'd money is acceptable.

---

## Session 6b outcomes — Tennessee / Nashville-Davidson (2026-08-30)

**1 entity / 20 rows. 35 of 43 entities carry data (81%).** Tennessee's FIRST
local entity in TT — the live table held exactly one TN row before this session,
the state node.

| | |
|---|---|
| Entity | **Nashville-Davidson**, `city`, `county_id` NULL (consolidated) |
| Rows | **20** = FY2016–FY2025 × 2 datasets, all from Metro's own ACFRs |
| Axes | `audited_gaap` · `general_fund` · `actual` · month 7 |
| Tie | **$0 on all 20**, against each year's printed General Fund total |
| Frozen invariant | digest **BYTE-IDENTICAL** before and after — $0 moved |
| Tests | 1,717 → **1,734** vitest, plus 166 → **170** ACFR selftests. Build green. |

Nashville is **not** a Knight community — it was added independently because EV
Essentials seeded it and TT had no Tennessee locals at all (spec §2).

### ⚠⚠ THE STATEWIDE BULK SOURCE IS EXCELLENT AND USELESS HERE

The TN Comptroller's TAG export is fund/account/object-level for all 95 counties,
FY2007–2025, free and unauthenticated, prepared by the Division of Local
Government Audit — **which audits 91 of the 95 counties itself.** On paper it is
the strongest grade TT has ever been offered.

**Davidson is one of the four audited by a CPA firm instead** (with Hamilton,
Knox and Shelby), and it appears in TAG at **TOTAL ONLY**: exactly one revenue
row and one expenditure row per year, no tree at all. So the state's best source
serves zero Knight entities, and Metro comes from its own ACFRs.

⚠⚠ **And that single row hides a scope break.** Through FY2024 the `PRI` total
runs $1.72B → $4.00B; FY2025 reads **$2.41B** with a separate `SCH` row at
$1.56B. The school department was inside the primary-government total until
FY2025 and split out afterwards. **Loading the `PRI` series would have rendered a
fake $1.4B collapse** — the session-5 Lake County trap in a third costume, and
again invisible to every gate.

⭐ **The refused source still earned its keep as an ORACLE.** TAG's Davidson total
is an independently published Total Governmental figure, and it matches the
ACFR's own exactly where they can be compared — FY2024 both read
**3,999,358,895**. It became the denominator for the fund-scope probes, which no
other entry in `fundScopeRegistry` can say. And recombining the FY2025 split
(`PRI` + `SCH` = 3,960,617,961, continuous with FY2024) independently confirmed
the diagnosis above.

### ⚠⚠ THE FAC CENSUS BLIND SPOT IS SYSTEMATIC, AND NOW DIAGNOSED

Session 6a recorded "Nashville-Davidson is ABSENT from the TN FAC census slice".
The cause is now known, and it is **not** that FAC lacks the entity — the live
API has all ten years under auditee `0000193991`. It is that
`buildFacFiscalYearCensus.classifyAuditee()` returns **null** for the name:

    CITY OF PHILADELPHIA                          -> municipality  ✅
    CITY AND COUNTY OF SAN FRANCISCO / DENVER     -> municipality  ✅
    THE METROPOLITAN GOVERNMENT OF NASHVILLE …    -> null          ❌
    MACON-BIBB COUNTY                             -> null          ❌
    COLUMBUS CONSOLIDATED GOVERNMENT              -> null          ❌
    LEXINGTON-FAYETTE URBAN COUNTY GOVERNMENT     -> null          ❌

**Consolidated governments are dropped unless their legal name happens to start
"City of" or "City and County of".** This explains the "census absent" notes on
Macon-Bibb and Columbus-Muscogee that sessions 4 and 5 recorded without
diagnosing, and **it predicts a fourth for Lexington-Fayette in session 8.**

⚠ `censusGuard()` returns `{ok:true}` when it cannot find an entity, so every one
of these passes WITHOUT BEING CHECKED. This is the same failure shape as the CA
county blind spot, with a second, name-based cause.

**NOT fixed here** — the classifier governs 33,932 already-censused rows and
changing it is its own milestone. `tests/tnNashville.test.mjs` PINS the current
behaviour so a future fix fails the test loudly rather than closing the gap
unnoticed. The month for this entity instead comes from two first-party sources,
both stronger than the census: every statement page prints "For the Year Ended
June 30, <year>", and the live FAC record gives `fy_end_date` = June 30 in all
ten audit years.

### ⚠⚠ EVERY POSITIVE AMOUNT CARRIES A STRAY TRAILING `)`

Metro's text layer renders every amount on the statement pages as
`835,727,083)` — **all 79 money tokens on the FY2024 page, positives included.**
The same document also uses ordinary accounting negatives with a LEADING paren,
`(213,716,851)`.

A reader keying "negative" off a trailing paren would **flip all 79 positives**;
one stripping every paren would flip the genuine negatives. Either is a
whole-entity SIGN INVERSION with no arithmetic symptom, because the tie is
computed from the same mis-signed numbers —
`project_adopted_budget_inversion_sweep` had to sweep that class across 106
sources.

`acfrGF.parse_money` already distinguishes them correctly: `_MONEY` alternates a
fully bracketed `\((?:\d[\d,]*)\)` against a bare `\$?\s*\d[\d,]*`, so the stray
paren is never captured and `neg` is set only by a LEADING `(`. **Verified
empirically rather than by reading the regex**, and pinned by four new cases in
`scripts/lib/acfrGF.selftest.py`.

### ⚠ THE TREE SHAPE CHANGES BY YEAR, AND THAT IS THE DOCUMENT, NOT THE PARSER

The operating roots vary — 1 category in FY2016–FY2019, 2 in FY2020 and FY2022,
3 from FY2023. A tie proves arithmetic and never structure, so this was checked
against the printed pages rather than accepted:

* **FY2016** — `Principal retirement`, `Interest` and `Capital outlay` all print
  `-` in the General Fund column (that year's $63M of debt service sits in
  Education Services). Metro's General Fund genuinely had no debt service and no
  capital outlay.
* **FY2022** — `Principal retirement` is `-` but `Capital outlay` is 10,615,724.

Every omitted line is REPORTED in the extractor's `zero_rows`, never silently
dropped: FY2016 lists `["Education","Principal retirement","Interest","Fiscal
charges","Capital outlay"]`.

### ⚠ POPULATION — CONSOLIDATED, BUT NOT COTERMINOUS THE WAY PHILADELPHIA IS

Census vintage 2024 gives **three** numbers for this one government:

| series | 2024 |
|---|---|
| Davidson County (SUMLEV 050) | 729,505 |
| Nashville-Davidson metropolitan government (SUMLEV **170**) | 729,505 |
| Nashville-Davidson metro government **(balance)** (SUMLEV 162) | 704,963 |

**729,505 is correct.** The "(balance)" figure excludes six independent satellite
cities inside Davidson County that never merged — Belle Meade, Berry Hill,
Forest Hills, Goodlettsville, Oak Hill and Ridgetop. Metro's General Services
District covers the whole county, and the General Fund is a GSD fund.

⚠ **This differs from Philadelphia**, where session 5 proved coterminousness by
finding place (162) and county (050) both at 1,573,916. Here 162 ≠ 050 and only
170 matches. **Do not carry the Philadelphia method forward without checking
which SUMLEV actually agrees.**

### Scope and grade

`fund_scope = general_fund`, evidenced by ten probes — one per year — showing the
General Fund at a stable **38.8%–41.6%** of total governmental revenue, plus
33.8% on the FY2024 expenditure side read directly from the statement. ⚠ Metro's
General Fund sits ALONGSIDE separate `General Purpose School` and `Education
Services` major funds rather than containing them, which is why a consolidated
government's General Fund is a smaller share than a plain city's.

`audit_grade = audited_gaap`. All ten opinions name **"each major fund"**, and
the General Fund is a major fund in every one.

⚠ **A welcome contrast with session 6a**: every one of these ten documents has a
born-digital text layer and the opinion is found by a plain search, where nine of
South Carolina's nineteen needed OCR or whitespace-collapsing. **Document quality
is a property of the ISSUER and must be re-checked per entity**, never assumed
from the previous session.

⚠ FY2025's opinion reads "based on our audit **and the reports of other
auditors**". That is a group-audit division of responsibility, NOT a scope
limitation — the opinion itself is unmodified. Reading it as a qualification
would have understated the grade.

### Access

Metro serves its own PDFs from `nashville.gov` with **no WAF**, so unlike session
6a's South Carolina cities the Federal Audit Clearinghouse was not needed for the
bytes. FAC report ids are still recorded per year as a second route and as the
fiscal-period evidence. ⚠ The URLs are NOT derivable — the naming changes three
times across the decade (`CAFR2016.pdf`, `ACFRFY21_01_21_2022_Upload.pdf`,
`2022_Annual_Comprehensive_Financial_Report_Final_Published_06062023.pdf`) —
which is exactly why `acfrGfLoad` reads a manifest instead of rebuilding a URL.

### Open follow-ups from this session

1. ⭐ **Fix the FAC census classifier for consolidated governments**, or add an
   explicit alias list. Four campaign entities are affected and one
   (Lexington-Fayette) has not been loaded yet. `tests/tnNashville.test.mjs`
   pins the current behaviour.
2. **The TN TAG statewide unlock** — 95 counties, FY2007–2025, fund/account/object
   detail, from the division that audits 91 of them. Still a filed, ready
   milestone; it just cannot serve Davidson. ⚠ `SCH` and lowercase `Sch` both
   appear in the fund-prefix column (the session-5 `d704`/`D704` hazard), and
   FY2025 splits the school department out of `PRI`.
3. **Nashville pre-FY2016** sits behind an "Archive for Previous Years" page and
   is not loaded, under the first-party `source_url` policy.
4. **Session 7 = MI + CO + KS** — Detroit, Boulder, Wichita + counties.

---

## ✅ Session 7a (MICHIGAN) — 2026-08-30

**2 entities / 128 rows. Michigan's FIRST local entities** — the table held one
MI row before this, the state node. Detroit (a Knight *resident* community) and
Wayne County, **FY2010–FY2025 with no gaps: sixteen years, the deepest unbroken
reach in this campaign.** Frozen digest **byte-identical** before the load, after
the load, and after both axis stampers. Tests 1,734 → 1,768.

| | Michigan |
|---|---|
| Source | Treasury Form F-65, Annual Local Unit Fiscal Report |
| Access | `data.michigan.gov` Socrata — anonymous GET, no key, no terms gate |
| Reach | all 1,856 cities/villages/townships/counties, FY2010–2025 |
| Grade | `self_reported_unaudited` |
| Scopes | `general_fund` (published) **and** `total_governmental` (derived) |

### Recon outcomes for all three session-7 states

* **MI = BULK.** Icicle-grade, and the fund scope is *published per column*.
* **CO = ACFR.** DOLA is the documented trap (stateful PrimeFaces/JSF app, terms
  gate, ToS discouraging automation) — **and** its scope is `total_governmental`,
  so it could not have extended the existing `co-local-acfr-gf` General Fund
  series for Colorado Springs even if access were free.
* **KS = ACFR.** The Kansas Department of Administration publishes **adopted
  budgets only** (2022–2026), per-entity PDFs browsed by county, no bulk
  download, no API, and **no actuals**.

### ⚠⚠ THE HEADLINE — THE SAME COLLAPSE SIGNATURE, AND THIS TIME IT IS REAL

Wayne County's Total Governmental revenue drops **$1,511,273,000 → $915,641,000
at FY2014, −39%**, while its General Fund runs smoothly across the same boundary
($536.6M → $565.2M). That is *verbatim* the signature of session 5's Lake County
renumbered fund and session 6b's Davidson `PRI`/`SCH` split — **both of which
were defects that would have rendered a fake collapse.**

Here it is a real governmental reorganisation. The entire step is one line,
`TOTAL STATE GRANTS` in All Other Governmental Funds, $784.5M → $166.4M; every
other category is smooth. **Michigan Public Acts 375 and 376 of 2012** required
Wayne County to establish its community mental health services programme as an
independent entity "separate and distinct from Wayne County functions",
**effective 1 October 2013 — the exact first day of Wayne County's FY2014.** The
Detroit-Wayne County Community Mental Health Agency became the Detroit Wayne
Mental Health Authority and took its state Medicaid funding out of the county's
books. Loaded as published and flagged, per the Milledgeville rule.

⭐ **The transferable lesson: the signature does not tell you which it is.** A
39% one-year step with a smooth General Fund underneath looked identical in all
three sessions. Only external evidence — a statute, a grant award, a fund
renumbering — separates the real reorganisation from the parse defect. Reading
the series finds the *question*; it never answers it.

### ⚠⚠ A FORMATTED-CURRENCY FILING THAT WOULD HAVE LOADED AS $0, GREEN

**Detroit FY2020 — and only that filing, 517 of its 537 rows** — publishes
`field_data` as `"$290,017,002.00"` where every other filing in the corpus emits
a bare `"290017002.00"`. Wayne FY2020 is clean, so it is a one-off defect in a
single upload rather than an era.

`parseFloat` returns NaN; **`Number(x) || 0` returns ZERO, and the zero is the
dangerous one** — the whole entity-year would load as $0 and *every* internal
check would still pass, because a sum of zeros ties a total of zero. This is
session 3's zero-row parse ("any gate that can measure nothing must fail, not
pass") in a new costume. `parseAmount()` accepts `$`, commas and a leading minus,
treats an empty cell as an explicit null, and **throws** on anything else.

⚠ Negatives here are a LEADING minus (290 observed), never parentheses —
checked empirically after Nashville's trailing-paren sign inversion.

### ⚠⚠ A SUBTOTAL THAT IS CORRECT WHILE ITS OWN LINE ITEMS ARE NOT

Detroit's FY2015 filing writes three values onto **two account lines each** while
its own subtotal counts each once — an exact 2.000 ratio in all three:

| Face | Root | Value duplicated across |
|---|---|---|
| Revenue | `TOTAL CHARGES FOR SERVICES` | `626-637` and `638-642, 651, 653, 654` |
| Expenditure | `TOTAL HEALTH AND WELFARE` | `601, 605, 610, 611` and `600-699 Except Above` |
| Expenditure | `TOTAL RECREATION AND CULTURE` | `751-752, …` and `803-805` |

This is **Georgia's LOAD1 defect class** — real money on the wrong account while
the subtotal stays right — and it is **invisible to any grand-total check**,
because the grand total sums the (correct) subtotals. Only asserting each root
against its OWN leaves finds it. Session 4 proved subtotal ties are necessary but
not sufficient; **this is the mirror image, and the same assertion catches both.**

⚠ Which line of each pair is the stray copy **cannot** be determined from the
extract. In each case the specific line looks plausible and the catch-all
duplicate does not — but *looks plausible* is not evidence, and dropping whichever
makes the arithmetic work is the curve-fitting error that LA-01 and session 6a's
reader choice both warn about. **The verified subtotal is loaded and the
contradicted detail is suppressed**, declared in `KNOWN_DUPLICATED_DETAIL` as an
**exact registry, never a tolerance**: the entry must name the entity, year,
category, root, published figure *and* observed leaf total, and any undeclared
mismatch still stops the load. ⭐ Detroit's own FY2015 ACFR would arbitrate all
three — a filed follow-up.

### The audit grade — a SIXTH distinct answer in six states

`self_reported_unaudited`, and it is the closest any source has come to a higher
grade without earning it. Michigan **instructs** the filer to use audited numbers:

> "If you are required to have an audit for the 2015-2016 fiscal year, please use
> the audited numbers."
> "Take information directly from your audit report where possible."

And in the same document disclaims the form and names the fallback:

> "The Form F-65 does not satisfy other statutory requirements for audited
> financial statements required by Public Act 2 of 1968…"
> "If you are not being audited for the current year, you still are required to
> file. Prepare Form F-65 based on your year-end trial balance."

**This is the California SCO shape stated more explicitly** — audited data
directed *conditionally*, filed by the unit's own officers — so §3.5's
mixed-source rule takes the weaker branch. ⚠⚠ **And crucially there is no
reconciliation step**, which is exactly what earned Florida its
`compiled_from_audited`: Michigan's own *Audit Manual for Local Units of
Government* mentions the F-65 **exactly once**, only to cite MCL 141.424.

⚠ **Second case where the grade UNDERSTATES what TT knows** (Pennsylvania was the
first). Detroit and Wayne County are far above every Michigan audit threshold and
both file Single Audits annually, so their figures *are* audit-derived in fact —
but the branch appears in no published column, and a grade TT cannot read from
the data is a grade TT must not assert.

### Fund scope — TT's first two-series family

`general_fund` is column a, read. `total_governmental` is column a + column b —
and **the publisher defines that partition**, enumerating column b as permanent,
special revenue, debt service and capital project funds. So it is exactly GASB's
governmental-funds set; the form simply publishes no subtotal of it, which is why
those rows carry `derivation='derived'`.

⚠⚠ **The form's own `Total` is NOT this scope.** It is a+b+c+d and folds in
enterprise, internal service **and discretely presented component units**.
Verified line by line on Detroit FY2024: All Other Federal Aid Grants,
governmental+CU 112,631,465 + enterprise 56,516,497 = the published 169,147,962.
Loading column e would have overstated the government itself.

⚠⚠ **Financing is removed from BOTH faces, and Michigan can do symmetrically what
South Carolina structurally could not** (see the asymmetry acknowledged in PR
#115). For `total_governmental` this is *arithmetic*, not convention: a transfer
from the General Fund to a special revenue fund is an expenditure in column a AND
a revenue in column b — both inside the same scope. Wayne County FY2023 alone
moves **$330,326,239** that way.

### ⚠⚠ Two calendars, one state, a city against its own parent county

Detroit starts **month 7**; Wayne County starts **month 10**. Both are read per
filing from the F-65's `fiscalendmonth` and both are constant across all sixteen
years. Michigan's counties split **72 January / 29 October / 1 July** in the FAC
census and **Wayne is in the 29** — the dominant month would have been wrong by
nine months on every Wayne row while moving $0 and passing every tie test.

⚠⚠ **Fifth Saint-Louis-County near-miss, and the sharpest yet.** Michigan's census
slice carries four rows matching `/Detroit|Wayne/`:

    MI,Detroit,municipality,annual,7,,1998-2025      <- the city
    MI,Wayne,municipality,annual,7,,1998-2013        <- THE CITY OF WAYNE, MI
    MI,Wayne County,county,annual,10,,1999-2005      <- the county
    MI,Wayne Township,township,annual,4,,2015

The City of Wayne is a real government *inside* Wayne County at a **different
fiscal month**. A bare `Wayne` lookup returns month 7 and `censusGuard()` would
then have **confirmed a wrong month enthusiastically**. `censusName` is exact and
a test pins it.

⚠ Wayne County's census coverage stops at **2005**, before the window opens, so
its sixteen years are reported **UNCOVERED — never as confirmed** (the Florida
rule). Detroit's sixteen are all actively confirmed.

### The structure is published, not inferred

`notes` states each row's role (`Number` / `Total` / `Summary - Number`) and
`field_name` is the printed form's own grid coordinate `T{table}R{row}C{column}`,
so the leaf/subtotal split is **read**, and ordering never depends on Socrata's
row order. Two independent signals agree on every row checked: `notes='Number'`
iff `account_number` is non-blank.

⚠⚠ **`Summary - Number` rows have a blank `account_number` and are NOT
subtotals** — they are fund balances. A "blank means subtotal" rule would have
filed Detroit FY2024's **$1,197,106,602** opening fund balance as an expenditure
category. Both signals are required, which is why neither is trusted alone.

⚠ **Column numbers in `field_name` are table-relative** and must never be keyed
on: `General Fund` is C2 in the Revenue table (where the budget column occupies
C1) and C1 in the Expenditure table.

⚠⚠ **A BUDGET COLUMN SITS IN THE SAME TABLE AS THE ACTUALS** —
`General Fund Final Amended Budget` is a `group` like any other, beside
`General Fund`. Detroit FY2024 Income Tax reads 666,247,119 as final amended
budget and 692,923,583 as actual. The loader reads only the groups it names, so
no appropriation can reach an actuals row.

### ⚠ A row-count collapse that was NOT a data break

FY2010–2015 filings carry exactly **1,172 rows each — identical for a city and a
county, six years running** — then FY2016 reads 424. That is a fixed template
emitting every form cell whether or not it holds data (~765 zero rows per
filing); **non-zero** content runs 373–402 against 479–537 later, continuous. The
"64% collapse" is a template change. Checked before it was explained away — the
session-6b rule that a varying shape is not automatically a bug.

### Verification

* **1,145 / 1,145** in-file checks across 32 entity-years, 0 skipped. Every root
  asserted against its own leaves, and `operating + financing = the publisher's
  own grand total` on all 32.
* Frozen digest `62654 rows 3a48ac28…` **byte-identical** before the load, after
  the load, and after both axis stampers. Deficit at registration was **exactly
  128**, union exactly 128. `verify:live-sync` reports **0** unprotected rows.
* Both partition gates green: `mi-treasury-f65-gf` 64 / `mi-treasury-f65-tg` 64;
  `mi-treasury-f65` 128 basis + 128 reporting_entity.

### Open follow-ups from this session

1. ⭐ **Detroit's own FY2015 ACFR would arbitrate the three duplicated lines**,
   converting three suppressed breakdowns back into published detail.
2. ⭐⭐ **The Michigan statewide sweep is a filed, ready milestone** — the same
   loader reaches **all 1,856 Michigan local units** across FY2010–2025 with no
   new extraction work; the marginal cost is verification. Scoped out of 7a by
   decision so the session would end whole.
3. **Wayne County's FAC census gap** (coverage stops at 2005) means sixteen
   loaded years rest on the filing's own `fiscalendmonth`. A live FAC API lookup
   — the route session 6b used for Nashville — would close it.
4. ⚠ **The roster total of 43 does not reconcile** — see the note under the
   per-entity table. 37 + 11 = 48.
5. **Session 7b = CO + KS** — Boulder + Boulder County, Wichita + Sedgwick
   County, both by the ACFR route. Recon is already done (above); CO must
   **extend** `co-local-acfr-gf` rather than duplicate it, and KS needs a new
   `ks-local-acfr-gf` family with its five registrations.

---

## ✅ Session 7b (COLORADO + KANSAS) — 2026-08-30

**4 entities / 108 rows / 54 entity-years. KANSAS'S FIRST LOCAL ENTITIES** — the
table held one KS row before this, the state node. Colorado **EXTENDS** the
existing `co-local-acfr-gf` family (Colorado Springs + El Paso County, v2.29)
rather than duplicating it. Frozen digest **byte-identical** before and after —
and unchanged across *both* session-7 loads. Tests 1,768 → 1,793.

| Entity | Route | Window | Yrs | Rows |
|---|---|---|---|---|
| City of Boulder | **FAC** by report_id | FY2016–2022 | 7 | 14 |
| Boulder County | county's own PDFs | FY2021–2025 | 5 | 10 |
| City of Wichita | city archive by ADID | FY2000–2025 exc. FY01/FY08 | 24 | 48 |
| Sedgwick County | county media library | FY2006–2024 exc. FY19 | 18 | 36 |

Both recon outcomes were **ACFR**: Colorado's DOLA is the documented trap *and*
publishes at `total_governmental`, so it could not have extended TT's General
Fund series regardless; Kansas's statewide source publishes **adopted budgets
only** (2022–2026), no actuals.

### ⚠⚠ SEVENTEEN OF FIFTY-SEVEN OPINIONS ARE INVISIBLE TO A TEXT SEARCH

Wichita FY2000–2010 and Sedgwick County FY2006–2011 are born-digital in the
statements and **image-only on the auditor's page**. In every one of them a plain
text search finds "Independent Auditor" exactly once — **in the TABLE OF
CONTENTS** — which reads precisely like an unaudited report. Grading on the text
layer alone would have shipped all seventeen as `unknown`.

This is session 2's lesson (8 of 36 Charlotte/Mecklenburg opinion pages were
image-only) in its **third occurrence**. `scripts/verifyCoKsOpinions.py` OCRs the
front matter at 200dpi and recovers every one — **40 found in the text layer, 17
by OCR, 0 NOT FOUND.** Wichita FY2005 reads, over the signature of Allen, Gibbs &
Houlik, L.C.:

> "In our opinion, the financial statements referred to above present fairly, in
> all material respects … in conformity with accounting principles generally
> accepted in the United States of America."

⚠ **The first "In our opinion" is not necessarily the right one** — every one of
these reports also carries an in-relation-to paragraph about the combining
schedules ("…we express no opinion on such information"). The primary opinion is
identified *positively* instead, by pairing a fair-presentation phrase with a
GAAP conformity phrase.

### ⚠⚠ AND THAT GATE'S FIRST VERSION INVERTED ITS OWN SIGNAL

Its modified-opinion pattern matched a collapsed `qualifiedopinion` — which also
matches **inside `UNqualifiedopinion`, the opposite meaning**. It flagged 20
documents, and the flags were sentences like Wichita FY2005's "issued an
**unqualified** opinion on the City of Wichita's financial statements" and
Sedgwick County FY2009's "a reasonable basis for rendering **unqualified**
opinions". *Evidence of a clean opinion, reported as a possible defect.*

Fixed with a negative lookbehind and pinned by six cases. ⚠ A `\b` cannot do this
job — whitespace is already collapsed, so there is no non-word character between
"un" and "qualified" to anchor to.

⚠ The one surviving true positive is real and benign: Wichita FY2021 carries a
genuine **"Qualified Opinion on the Water Infrastructure Finance and Innovation
Act (WIFIA) Program"** — a *federal program compliance* opinion in the Single
Audit, whose own summary reads "Unmodified for all major federal programs …
except for 66.958". Not an opinion on the financial statements. **This is exactly
why the pattern reports and never downgrades.**

### ⚠⚠ FOUR DOCUMENTS, FOUR STRUCTURES — THREE OF THE DIFFERENCES SILENT

Boulder city and Boulder County sit twenty miles apart, load into the *same*
registry family in the *same* session, and disagree on every fact the extractor
config exists to declare:

| | Boulder city | Boulder County |
|---|---|---|
| units | `(Amounts in 000's)` | **whole dollars** |
| debt parent | `Debt service payments:` | **`Service on long-term obligations:`** |
| revenue total | `Total revenues` | **`Total revenue`** (singular) |
| revenue section | `Revenues` | **`Revenue`** (singular) |

1. **A units error is invisible to the tie** — every figure on a statement scales
   together. Carrying the city's `units=1000` across would have shipped the
   county 1000× too large with a $0 delta. The Charlotte/Mecklenburg pairing, one
   session after Detroit/Wayne.
2. **The debt parent is not called "Debt service"** on Boulder County. A config
   copied from the city — or from Wichita or Sedgwick County, which both say
   `Debt service:` — would not match it, and Principal and Interest would
   silently reparent **while the statement still tied to the cent**.
3. **The revenue section header is singular**, and with the plural hard-coded the
   section reader matched *nothing*: the revenue tree came back EMPTY while the
   printed total was still found, so the tie gate **failed loudly at the full
   −283,438,244** rather than shipping a wrong shape. That loud failure is the
   design working. Fixed by a new `CityConfig.revenue_section_header` — the same
   class of fact as `revenue_total_labels`, which was added for Bainbridge's
   "Total Operating Revenues". ⚠ The expenditure side needs no equivalent: every
   document in this corpus prints `Expenditures` plural, **including Boulder
   County**, which is exactly why only one of the two is configurable.

⚠ **And a fourth, self-inflicted:** setting `revenue_parents` without
`revenue_group_members` closed Boulder's tax group after its FIRST child, leaving
`Taxes` at 81,136 with one child and five tax lines standing as root categories —
**and it tied at $170,917,000**, because the multiset was unchanged and only the
parenting moved. The library documents this failure in as many words; it still
had to be read.

### ⚠⚠ FOUR DOCUMENT GAPS, THREE DISTINCT CAUSES

| Document | Cause |
|---|---|
| Wichita FY2001, FY2008 | **image-only scans** — 30 and 20 chars/page against 1,301–1,973 for every other year; FY2001's PDF producer is literally `eCopy, Inc.` |
| Sedgwick County FY2005 | **HTTP 404** — a dead link in the county's *own* archive listing |
| Sedgwick County FY2019 | **a third defect class** (below) |

Sedgwick FY2019 is born-digital yet unreadable: its statement page is set in a
font subset with a **custom encoding and no ToUnicode map**, so `pdftotext` emits
a uniform −29 byte shift — `6('*:,&. &2817< .$16$6` is "SEDGWICK COUNTY,
KANSAS", `3URSHUW\ WD[HV` is "Property taxes". **The shift is uniform and
therefore trivially reversible, which is precisely the trap: every numeric column
extracts EMPTY.** Decoding the labels would produce a perfectly readable
statement with no money in it. The same document also emits **411 form-feed
chunks across 175 real pages**, fragmenting the statement so no single chunk
carries all the page-qualifying markers — either fault alone would have blocked
it. ⭐ FAC lists a 2019 filing for this auditee: a recovery route, blocked only by
the DEMO_KEY rate limit.

⚠ Neighbouring years are clean in every case, so none of these is an era. All
four are declared in `scripts/extractCoKsAll.mjs` and **none is written as $0**.

### The series read — both ≥20% moves explained from the issuer's own words

**Boulder County FY2024, +22.1%.** The county's own audited MD&A: *"revenues
exceeded expenditures by $41.4 million, which was mainly attributed to an increase
in investment earnings and property tax revenue, and **reimbursements received
from FEMA related to the county's 2013 flood recovery efforts**."* Eleven-year-old
flood money finally landing; Intergovernmental runs 14.2M → 35.0M → 10.1M.
⭐ **That sentence is also an independent oracle**: the extraction's
283,438,244 − 242,050,192 = **41,388,052** matches the narrative "$41.4 million"
exactly, confirming *both* totals at once.

**Wichita FY2023, +20.6%.** A $44.9M swing on a single line — investment earnings
going from a −$7.8M loss (FY2022 bond market) to a +$37.1M gain.

⚠ **FLAGGED, NOT NORMALISED.** Wichita prints that line under **three labels**
across 24 years: `Interest earnings` (15 yrs), `Interest and investment earnings`
(6), and `Interest and investment earnings (loss)` (3). The `(loss)` variant
appears on **positive** years — FY2018 +6,903,511 and FY2020 +5,409,173 — so it
carries no information and is arguably captioning drift. It is nonetheless the
issuer's own wording, and normalising it would be TT inferring intent, so all
three are loaded as published. A `label_fixes` normalisation is a decision for
Chris, not for the loader.

### ⚠⚠ Sixth Saint-Louis-County near-miss

The FAC census carries **`KS,Sedgwick,municipality`** beside `KS,Sedgwick
County,county`. The City of Sedgwick is a real government of about 1,600 people
in **Harvey County** — not even inside Sedgwick County. `censusName` is exact and
a test pins it. (Also avoided: **Boulder City, NEVADA**, which surfaced in this
campaign's own searches; and FAC's Boulder Community Health, Boulder Housing
Partners, Boulder Valley School District, Wichita State University, Wichita
Public Schools USD 259, **Wichita County** Health Center, and the Sedgwick County
Zoological Society.)

⚠ **The auditee name is not stable across years** either: the same governments
file as `BOULDER COUNTY, COLORADO` → `Boulder County` → `County of Boulder`, and
`SEDGWICK COUNTY` → `SEDGWICK COUNTY, KS` → `Sedgwick County, KS`.

### ⚠ Wichita's archive ids are not ordered by year

FY2018 is ADID 56 while FY2017 is 57; FY2016 is 54 while FY2015 is 55 — two
adjacent inversions. Deriving an id from a year would load one year's money under
another year's label and **every tie would still pass**, because each document is
internally consistent. Every mapping was verified against the fiscal year printed
on the document's own cover: **24 of 26 confirmed**, the two exceptions being the
scans, which have no cover text at all.

### Access notes

* **Boulder city comes from FAC** because bouldercolorado.gov publishes only the
  two most recent ACFRs directly and every earlier year sits in a Laserfiche
  archive that is unreachable to a plain client — `documents.bouldercolorado.gov`
  serves an **incomplete TLS chain** (curl exit 60, the Ohio AOS shape).
  PowerShell reaches it, but the page is a JS viewer shell with no document link.
* ⚠ The FAC **PDF endpoint needs no key**, which is what made Boulder loadable at
  all: the census-era id shape `<FY>-12-CENSUS-0000134815` was probed directly
  and verified year by year off each cover page. It **404s from FY2023**, where
  FAC migrated to GSAFAC ids — so FY2023/24 are recorded as a gap, not guessed.
* ⚠ The FAC **metadata API** rate-limits `DEMO_KEY` hard. A real key would close
  both the Boulder FY2023/24 gap and the Sedgwick FY2019 gap.
* ⚠ Colorado's Census place file is `sub-est2024_8.csv`, **not `_08`** —
  single-digit state FIPS drop the leading zero, where Kansas is `_20`.

### Verification

* **108 trees, every one tying at 0** against the issuer's own printed General
  Fund total. **161/161** loader checks across 54 entity-years.
* **53 of 54 entity-years FAC-census confirmed.** The one exception is Wichita
  FY2022, reported UNCOVERED — and it matches the census's own recorded gap
  (`1998-2021 2023-2025`) exactly.
* Frozen digest `62654 rows 3a48ac28…` byte-identical before and after; deficit
  at registration exactly **108**, union exactly 108 across four entity matches.
  `verify:live-sync` 0 unprotected.
* Partition gates green: `co-local-acfr-gf` **64 → 88** (extended; the
  pre-existing 64 did not move), `ks-local-acfr-gf` **84**, both basis and
  reporting_entity likewise.
* 20 ACFR selftests still pass — the `acfrGF.py` library change is
  regression-clean.

### ⚠ The pre-existing Colorado rows are deliberately left `unknown`

Colorado Springs and El Paso County have had **no `auditGradeRegistry` entry
since v2.29**, and this session's entry is anchored to the four entities whose
opinions it actually read. Widening it to the whole `co-local-acfr-gf` family
would grade 64 merged rows off evidence nobody gathered — and "it is an ACFR, so
it is audited" is the exact assumption North Carolina punished in session 2.
⭐ Filed as a follow-up, and a cheap one: `verifyCoKsOpinions.py` would do it
unchanged.

### Open follow-ups from this session

1. ⭐ **Grade Colorado Springs and El Paso County** — 64 rows, one script run.
2. ⭐ **A real FAC API key** would recover Boulder city FY2023–24 and very likely
   Sedgwick County FY2019.
3. **Wichita's three interest-earnings labels** — normalise via `label_fixes`, or
   leave as published. Chris's call.
4. **Wichita FY2001 / FY2008** are scans; the city may hold better copies.
5. **Session 8 = the orphans** — Aberdeen SD, Biloxi MS, Grand Forks ND,
   Lexington-Fayette KY + Brown, Harrison and Grand Forks counties = the last 7.
   ⚠⚠ **Lexington-Fayette is one of the four consolidated governments the FAC
   census classifier silently drops** — fix that before session 8 loads it.
