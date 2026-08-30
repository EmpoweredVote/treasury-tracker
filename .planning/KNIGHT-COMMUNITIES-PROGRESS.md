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
| **Philadelphia** | PA | **city** | loaded | **PA DCED** FY2015–24 | `self_reported_unaudited` | **7** · **FAC confirmed** | 5 |
| **State College** | PA | municipality | loaded | **PA DCED** FY2015–24 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Centre County** | PA | county | loaded | **PA DCED** FY2015–24 exc. FY16 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Fort Wayne** | IN | city | loaded | **IN Gateway** FY2015–24 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Gary** | IN | city | loaded | **IN Gateway** FY2016–24 | `self_reported_unaudited` | 1 · **FAC confirmed** | 5 |
| **Allen County** | IN | county | loaded | **IN Gateway** FY2015–24 | `self_reported_unaudited` | 1 · confirmed exc. FY15 | 5 |
| **Lake County** | IN | county | loaded | **IN Gateway** FY2015–24 | `self_reported_unaudited` | 1 · confirmed exc. FY19 | 5 |

The 17 remaining entities are `pending` and are listed in spec §2.

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

**Running total: 30 of 43 entities loaded (70%), 1 partial, 12 pending.**

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

* **Consolidated governments are typed `county`.** Macon-Bibb and
  Columbus-Muscogee are TT's first, so this sets precedent for Philadelphia,
  Lexington-Fayette and Nashville-Davidson. Census confirms both are coterminous
  with their counties (157,056 and 201,830 match exactly).
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
2. **Retype Macon-Bibb and Columbus-Muscogee to `city`** for consistency with SF
   and Philadelphia — before Nashville-Davidson (session 6) lands.
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
