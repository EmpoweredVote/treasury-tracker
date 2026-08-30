# Pennsylvania + Indiana recon — Knight session 5 (§4.2 gate)

**Date:** 2026-08-29
**Baseline:** `main` @ `00f4031`, frozen invariant verified BEFORE any work
(79,916 rows, digest `90f009fe396d20dcd211258e534ea81c237aa0bddd3d2412680c1dcce3af76fe`)
**Gate question (§4.2):** *Is there a free, no-auth, machine-readable statewide
source at icicle grade?*

## Outcome

| State | Verdict | Entities unlocked this session | Statewide reach |
|---|---|---|---|
| **Pennsylvania** | **BULK** | Philadelphia, State College Boro, Centre County | 2,572 municipalities + 67 counties |
| **Indiana** | **BULK** | Fort Wayne, Gary, Allen County, Lake County | all cities/towns + 92 counties |

Both states cleared the gate. Neither needed a fallback to ACFR-for-one-city.
**No recon time cap was hit.**

---

## 1. Pennsylvania — DCED Municipal Statistics

### ⚠⚠ It looks EXACTLY like the Colorado DOLA trap and it is not — again

`apps.dced.pa.gov/munstats-public/` is ASP.NET WebForms carrying `__VIEWSTATE`
and an embedded **Microsoft SSRS `ReportViewer` WebForms control** (v12.0.2402.20).
Every framework signal says stateful-app-behind-a-gate.

It is not. **`btnDisplay` streams a file directly.** The POST response is
`application/vnd.ms-excel`, `Content-Disposition: attachment;
filename=StatewideMuniAfr817.xls`, magic bytes `d0cf11e0a1b11ae1` (OLE2).
There is no report session, no `ExecutionID`, no export handshake.

**This is the second consecutive session where an ASP.NET/ViewState app was NOT
the trap its framework suggested** (Georgia's was a navigator over static `.xls`).
Georgia's rule holds and is now doubly earned: **probe before classifying an app
by its framework.**

⚠ **A first probe read the response as text and destroyed it** — `writeFileSync`
of a UTF-8-decoded binary turns every high byte into U+FFFD. The corruption was
silent; the file was still 1.5 MB and still "looked" like a page. Only `od -c`
on the first bytes revealed OLE2. **Always fingerprint magic bytes before
parsing, never infer format from Content-Type alone.**

### Access (no key, no ToS gate, no auth)

```
POST https://apps.dced.pa.gov/munstats-public/ReportInformation2.aspx?report=<REPORT>
  __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION   (scraped from the GET)
  ctl00$ContentPlaceHolder1$ddREPORTING_YEAR = <year>
  ctl00$ContentPlaceHolder1$btnDisplay       = Display
```

| `report=` | Content | 2023 size |
|---|---|---|
| `StatewideMuniAfr` | 2,572 municipalities × 71 columns | 1.44 MB `.xls` |
| `StatewideCountyAfr` | 67 counties × 128 columns | 0.08 MB `.xls` |
| `AFR_Year_LineItem` | returned HTML — needs different params, NOT probed further | — |

**Year coverage: 1996–2024** (29 years) in `ddREPORTING_YEAR`. Legacy OLE2 `.xls`,
readable by `xlrd` 2.x. **Zero `XL_CELL_ERROR` cells** in either 2023 file — the
Georgia `#REF!`-reads-as-23 hazard is checked for and absent, but the check must
stay in the loader.

### ⚠⚠ R4 fired: the county layout is NOT the municipal layout

Ohio's lesson repeats in Pennsylvania. The two files are different reports:

* **Municipal:** 71 cols, `'Municipality Name'`, `'Total Revenues'`
* **County:** 128 cols, `'MUNICIPALITY NAME'` (uppercase), and revenue/expenditure
  columns explicitly prefixed **`'Governmental Funds- '`**

They cannot share a parser. Verify the county layout independently — as §2.2 requires.

### ⚠⚠ The two PA entities differ in fund scope, and it is READ not inferred

* **Municipal file = ALL FUNDS.** Enterprise activity is folded into
  `Total Revenues`, with line items proving it: State College carries Sewer
  $6,700,203 / Solid Waste $4,755,865 / Parking $4,183,708; Philadelphia carries
  Water $478,492,062 / Sewer $343,180,320. **The source does not separate
  enterprise into a removable total**, so §2.3's exclusion cannot be applied —
  PA municipal rows are all-funds or nothing.
* **County file = GOVERNMENTAL FUNDS**, stated in the column names.

So one state yields **two different `fund_scope` values**, and neither is
comparable to the other. This is the WeHo situation (`fund_scope` recorded
honestly rather than forced to match its neighbours), not a defect.

### ⚠ The totals tie, and that tie is nearly tautological

Σ(detail revenue cols) = `Total Revenues` at **$0** for both State College
($66,661,778) and Philadelphia ($12,282,867,999); same for expenditures. But both
sides come from the same e-filed form, so per `project_austin_travis_onboarding`
**this is not an oracle.** A genuinely independent oracle is still required —
Philadelphia's own ACFR is the obvious one, and it does double duty (below).

### Granularity — icicle grade, 2 levels

Revenues: `Total Revenues` → 28 detail columns (taxes broken to 10 kinds,
intergovernmental split federal/state/local, charges for services, licences,
fines, interest). Expenditures: `Total Expenditures` → 20 detail columns
(General Government, Police, Fire, Public Works, Culture & Recreation, Libraries,
Debt Service…). Also carries `Population`, per-capita ratios, four debt columns
and `Fund Balance/Retained Earnings 12/31`.

Wide format — one row per entity-year, figures in columns. The
`project_weho_wide_format_and_budget_row_key` shape. ⚠ **The budget-row key must
include the SOURCE**, or the rows silently relabel.

### `Pending/Approved` is a real status axis

Column 5 carries `'A'` (approved) / `'P'` / blank. Blank means **not filed** —
`NEW PHILADELPHIA BORO` has empty revenue, expenditure and status for 2023. A
loader must refuse blank-status rows rather than write $0.

---

## 2. Pennsylvania audit status — a THIRD answer, and it splits our two entities

The form is titled **"Municipal Annual AUDIT and Financial Report"**
(DCED-CLGS-30). On the NC precedent that title alone proves nothing, so the form
itself was read (2023 edition, 28 pages).

### The filer depends on the entity class — and it inverts the intuition

> "Following is a listing of the entities that are required to file the Annual
> Audit and Financial Report:
> * **Cities: Director of Accounts and Finance**
> * **Boroughs: Elected Auditors, Independent Auditor, or Controller**
> * First Class Townships: Elected Auditors, Independent Auditor, or Controller
> * Second Class Townships: Elected Auditors or Independent Auditor
> * Home Rule Communities: In accordance with charter"
>
> — DCED-CLGS-30 (12/2023), Section IV

> "Appointed independent auditors should attach their own **opinion** in the
> 'Final Review' step of the online form."

⚠⚠ **This puts our two PA municipalities on opposite branches, the opposite way
round from what size would suggest:**

* **State College Boro** is a Borough → filed by elected auditors, an independent
  auditor, or a controller. An auditor signs it.
* **Philadelphia** is a City (and home rule) → filed by the **Director of Accounts
  and Finance**. The finance office self-reports it.

### DCED's verification is ARITHMETIC, not evidentiary

> "DCED verifies that the ending cash/investments balance (accounts 100-120)
> agrees to the calculated balance taking last year's ending cash/investments
> balance and adding the current year's revenues and subtracting the current
> year's expenditures."
>
> — DCED-CLGS-30 (12/2023), Section III

This is a roll-forward footing check. **It is NOT what earned Florida its grade** —
FL DFS "reconciles the AFR to the provided audited financial statements"
(LOGERx manual p.13). PA reconciles the form to *itself*. **PA is therefore NOT
`compiled_from_audited`.**

### Basis is stated, and it is CASH

> "BALANCE SHEET (**CASH BASIS OF ACCOUNTING ONLY**)" — DCED-CLGS-30 tip sheet
>
> "Cash Basis - Elected Auditors Only" — Section III balancing worksheet

So `basis = cash`, read from the publisher. Not GAAP, so `audited_gaap` is
unavailable regardless of who signed.

### ⚠⚠ The branch is NOT identifiable from the bulk file — unlike Florida

The auditor-type dropdown ("Elected Auditor" / "Appointed Auditor/CPA") is
captured in the online form, but **none of the 71 statewide columns expose it.**
Florida escaped the mixed-source rule precisely because its branch *was*
identifiable per entity per year from a public report. Pennsylvania's is not.

Under §3.5 — *"where a source is mixed the grade reflects the weaker branch
unless the specific entity's filing can be identified"* — **PA lands at
`self_reported_unaudited`.**

⚠ **OPEN — this is a decision for Chris, recorded not resolved.** PA fits the
four-value vocabulary badly: a cash-basis report signed by a municipality's
independent auditor is genuinely stronger than an Ohio/Indiana self-report, and
the vocabulary cannot say so. Three honest options: (a) grade the state
`self_reported_unaudited` and record the nuance here; (b) find a per-entity
source for the auditor type and treat PA as Florida-shaped; (c) extend the
vocabulary. **No row is stamped until this is decided.**

---

## 3. Indiana — Gateway (IFI / DLGF / SBOA)

### ⚠ The existing repo loader is STALE — verified, not assumed

`scripts/bulkLoadGateway.js` and `docs/indiana_gateway_reference.md`
(generated 2026-03-27) both exist and both describe Gateway. **Neither was
trusted.** The download page was re-probed live and the dropdowns re-read from
the served HTML. The ViewState mechanics still work; the *reference doc's
conclusion was wrong in a way that matters* (below).

### Access (no key, no ToS gate, no auth)

```
POST https://gateway.ifionline.org/public/download.aspx
  __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION
  ctl00$ContentPlaceHolder1$RadComboBox1        = Annual Financial Reports
  ctl00$ContentPlaceHolder1$RadComboBox2        = Detailed Receipts | Disbursements by Fund and Department
  ctl00$ContentPlaceHolder1$DropDownListUnitType= City/Town | County | All
  ctl00$ContentPlaceHolder1$DropDownListYear    = 2012..2026 | All
  ctl00$ContentPlaceHolder1$button_download1    = Download
```

Returns `application/text`, pipe-delimited, e.g.
`detailedReceipts_City/Town2023.txt` — 8.57 MB / 42,735 lines.
`DropDownListYear` offers **2012–2026 and `All`**.

### ⚠⚠ Q1 IN THE SPEC WAS WRONG — Indiana has ACTUALS, not just adopted budgets

Open question Q1 concluded Indiana was "presumptively BULK" but warned the basis
was *adopted budget* ("Budget form 4A", "Adopted revenue budgets"), so rows would
land `basis='adopted'` and not be comparable to the OH/MN actuals series.

**That conclusion came from a doc that only sampled the Budget Data branch.**
`RadComboBox1` has four values, and **`Annual Financial Reports` is a separate
branch** carrying Detailed Receipts, Disbursements by Fund and Department,
Disbursements by Fund, Cash and Investments, Debt, Capital Assets, Leases,
Pensions, OPEB. These are **filed actuals**, not budgets.

The 2026-03 doc recorded `detailedReceipts_2025.csv` as *"Empty — Data Not
Available"* and inferred the dataset was unavailable. It was empty because
**FY2025 had not been filed yet** (deadline is 60 days after year end), not
because the series does not exist. FY2023 returns 8.57 MB.

⚠ **This is the "never sequence on a recalled claim about a source" rule, in the
form of a repo document rather than a memory.** A tracked reference doc five
months old was wrong about the most important property of the source.

### Granularity — icicle grade, and it DRILLS DOWN

Receipts: `fund_name` → `Receipt_Class_Name` → `receipt_name`.
Disbursements: `unit_fund_name` → `department_name` → `disburse_class_name` → `disburse_name`.
Three levels on the revenue side, four on the spending side.

### ⚠ Receipts and disbursements have DIFFERENT COLUMN ORDER

```
receipts:      year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id|...
disbursements: year|cnty_description|cnty_cd|budget_unit_type|unit_code|unit_name|sboa_id|...
```

`cnty_cd` and `cnty_description` are **transposed** between the two files, and
`unit_name` moves. **Parse by header name, never by position.** A positional
parser would silently swap a county code for a county name and still "work".

### R4 checked: county and city receipt layouts are IDENTICAL

`head -1` of the City/Town and County receipts files are byte-identical. Unlike
Pennsylvania, Indiana's county extract shares the municipal layout. **Checked,
not assumed** — Ohio's lesson applies to every state independently.

### `fund_scope` is READ per row

`ent_name` separates governmental from proprietary activity:

| Entity | FY2023 `Governmental Activities` receipts | Separated enterprise |
|---|---|---|
| Fort Wayne | **$523,127,045.92** | Wastewater $290.2M, Water $106.0M, Storm Water $22.1M, Solid Waste $16.1M, Parking Garages $3.6M, Yard Waste $0.6M |
| Gary | **$180,427,030.82** | GSD $40.7M, Storm Water Management District $2.9M |

So §2.3's enterprise exclusion **is** applicable in Indiana — the source separates
them — and rows can land `total_governmental`.

⚠ The enterprise labels are free text and inconsistent (`WATER` / `Water` /
`WATER UTILITY`; `WASTEWATER` / `Wastewater`). **Whitelist
`ent_name = 'Governmental Activities'` exactly. Never blacklist.**

---

## 4. Indiana audit status — settled in the publisher's own words

Gateway's own explainer, **`gateway.ifionline.org/guides/about/LearnMoreAFR.pdf`,
rev. 11/3/2022**:

> "Indiana state law requires that the state examiner (State Board of Accounts)
> receive annual financial reports from counties, cities, towns, townships,
> schools, libraries, utilities and special districts and that they submit those
> reports via the collection systems of Gateway (see IC 5-11-1-4).
>
> These reports, as submitted by the units, are made available via Gateway to the
> public soon after the deadline for submission (60 days after year end) or
> earlier. **These reports, however, are unaudited.** The State Board of Accounts
> (SBOA) uses these Gateway submissions as part of their required auditing of
> these units."

**→ `self_reported_unaudited`.** Unambiguous, first-party, dated. No inference.

⚠ **Note how close this came to reading like Florida.** SBOA is a real state
auditor and it *does* audit these units — but the audit happens *after*, on a
cycle, and the published figures are the pre-audit submission. **An audit
existing somewhere in the process is not the same as the published figures being
audit-derived.** That distinction is the whole of the NC/FL/GA arc.

Basis is also stated:

> "Units are required to use a **regulatory basis of accounting** which complies
> with the financial reporting provisions of a government regulatory agency (in
> this case, SBOA). In Indiana, fund accounting is used…"

So `basis` is regulatory cash (receipts/disbursements), read not inferred.

---

## 5. Fiscal calendars — the FAC census, and PA's single most dangerous trap

All six entities are covered by `docs/fac/fac-local-fiscal-year-ends.csv`.
**Pennsylvania is NOT a census blind spot** (643 rows: 74 county, 325
municipality, 244 township) and neither is Indiana (877 rows).

| Entity | State | `start_month` | Census years |
|---|---|---|---|
| **Philadelphia** | PA | **7 — JULY** | 1998–2024 |
| State College | PA | 1 | 1998–2025 |
| Centre County | PA | 1 | 1999–2024 |
| Fort Wayne | IN | 1 | 1998–2025 |
| Gary | IN | 1 | 1998–2024 |
| Allen County | IN | 1 | 2003, 2008–2011, 2013–2014, 2016–2024 |
| Lake County | IN | 1 | 1998–2018, 2020–2024 |

### ⚠⚠ 611 of 643 PA entities are January. Philadelphia is one of 13 that are not.

This is `project_fysm_column_default_one_defect` waiting to happen: a loader that
resolves "PA = month 1" once and carries it across the state mislabels
Philadelphia's **entire series**. §4.6's rule — *resolve the month per row, never
per state* — is not optional here.

### ⚠⚠ AND it raises a substantive question the census cannot answer

DCED's form is **calendar-year framed** throughout — "ending cash balance … as of
December 31", "Fund Balance/Retained Earnings **12/31**". Philadelphia's fiscal
year ends **June 30**. So what period does Philadelphia's `Reporting Year 2023`
row actually cover?

**This must be resolved before Philadelphia is loaded**, or $12.28B lands under
the wrong fiscal year. The resolution and the independent oracle are the same
artefact: **Philadelphia's own ACFR for the year ended June 30, 2023.** If DCED's
$12,282,867,999 reconciles to it, both questions close together.

### ⚠ Uncovered entity-years must be reported as uncovered

Allen County is missing 2004–2007, 2012, 2015; Lake County is missing 2019. Per
session 3's discipline these are **UNCOVERED, never confirmed** — the census
`ok:true`-when-absent shape (`censusGuard()`) makes silence look like agreement.

### ⚠⚠ Name collisions — the Saint-Louis-County shape, fourth occurrence

The census carries **six** `Lake County` rows (CO, FL, IL, IN, MI, MN — with
**FL's at month 10 and MT's at month 7**), **three** `Philadelphia` rows (PA
month 7, MS month 10, NY month 6) and **two** `Gary` rows (IN, MN). A substring
match on `PHILADELPHIA` in the PA municipal file also hits `NEW PHILADELPHIA
BORO`. **Join on state + Municipality ID / county code, never on name.**

---

## 6. Consolidated governments — Philadelphia, and the Georgia precedent

Philadelphia is coterminous with Philadelphia County (§4.5 → one entity). **The
publisher resolves which side carries the data, unprompted:**

| File | Row | Data |
|---|---|---|
| `StatewideMuniAfr` | `PHILADELPHIA CITY`, ID `510012`, type **`City`** | FY2023 revenues $12,282,867,999; expenditures $11,963,320,000; status `A` |
| `StatewideCountyAfr` | `PHILADELPHIA  COUNTY`, ID `510001` | **entirely empty** — no AFR ID, no status, no figures |

DCED keeps a placeholder county row that never files. All the money is on the
**city** row, and DCED types it `City`.

### ✅ RESOLVED 2026-08-29 — `city`, and GEORGIA IS THE OUTLIER

Raised by Chris: *"Don't we refer to San Francisco as a city when it is also a
county?"* — checked against the live DB rather than reasoned about:

| Entity | `entity_type` in TT | `county_id` |
|---|---|---|
| **San Francisco, CA** (consolidated city-county) | **`city`** | NULL |
| Macon-Bibb, GA | `county` | NULL |
| Columbus-Muscogee, GA | `county` | NULL |

**TT's pre-existing convention is `city`,** and it predates session 4. Georgia's
`county` typing is the divergence, not Philadelphia's. So following the DCED
publisher and following TT's own older precedent give the SAME answer, and the
session-4 handoff's "revisit on purpose" is what surfaced it.

**Decision: Philadelphia is `entity_type = 'city'`, `county_id = NULL`.**

⚠ The one thing all three rows already agree on is `county_id = NULL` — a
consolidated government is not *inside* a county. That part is consistent and
stays.

⚠⚠ **FOLLOW-UP, NOT DONE HERE: Macon-Bibb and Columbus-Muscogee are now
inconsistent with SF and Philadelphia.** Retyping them moves $0 (`entity_type`
is on `municipalities`, not `budgets`, so the frozen invariant is untouched) but
it edits merged, verified session-4 work and is its own small piece of work.
**Two more consolidated governments are coming** — Lexington-Fayette (session 8)
and Nashville-Davidson (session 6) — so the rule should be settled before those
land, not after.

⚠ Note `PHILADELPHIA  COUNTY` contains a **double space**. Never key on the name.

---

## 7. Decisions — ALL THREE ANSWERED 2026-08-29 by Chris

1. **Philadelphia's `entity_type` → `city`.** Follow the publisher, which also
   matches TT's pre-existing San Francisco precedent. See §6. **Georgia's two
   consolidated governments are now the inconsistency**, filed as a follow-up.
2. **Pennsylvania's `audit_grade` → `self_reported_unaudited` (weaker branch),
   hunt later.** §3.5's mixed-source rule applied as written, because the
   auditor-type branch is not in the bulk file. The nuance — that State College's
   report is auditor-signed and Philadelphia's is not — is recorded in §2 and
   **must not be lost**; the vocabulary simply cannot express it today.
   **FOLLOW-UP:** look for a per-entity auditor-type source (the per-municipality
   AFR report or the Final Review data). If found, PA becomes Florida-shaped and
   State College would grade above Philadelphia.
3. **PA municipal `fund_scope` → load as published, all-funds, flagged.** The
   WeHo precedent: record the scope honestly rather than forcing comparability
   with the PA county rows (governmental) or the IN rows (governmental) sitting
   beside it. **No derived governmental subtotal** — the six enterprise columns
   may not exhaust proprietary funds, and a confidently wrong "governmental"
   total is worse than an honest all-funds one.

## 8. Scope proposed for the load half of session 5

* **Indiana** — Fort Wayne, Gary, Allen County, Lake County; receipts +
  disbursements; `ent_name = 'Governmental Activities'`; `total_governmental`;
  `basis` regulatory-cash; `audit_grade = self_reported_unaudited` (evidence
  above); month 1 per row from the census, uncovered years reported.
* **Pennsylvania** — State College Boro + Centre County from the two statewide
  files; Philadelphia **only after** its ACFR reconciles the July-vs-December
  question and provides the independent oracle.
* **Not in scope:** the PA statewide sweep (2,572 munis + 67 counties) and the IN
  statewide sweep. Both are now *ready* milestones with no new extraction work —
  filed the way session 3 filed the Florida sweep, so this session ends whole.
