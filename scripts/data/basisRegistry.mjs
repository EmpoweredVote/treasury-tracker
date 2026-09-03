/**
 * SCOPE-02 source→basis registry.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * ⚠ MATCH PATTERNS ARE ANCHORED PER STRING. `/^CA State Controller/` looks
 * reasonable and is a bug — it also claims 7,682 publicpay.ca.gov compensation
 * rows that no reconciliation covers. That trap cost SCOPE-01 a task to find; do
 * not reintroduce it here.
 *
 * ⚠ An entry is created when its evidence is, never before.
 *
 * Spec: docs/superpowers/specs/2026-08-17-scope-02-design.md §1
 */

import { BASIS } from '../lib/budgetAxes.mjs';

/** @type {import('../lib/budgetAxes.mjs').AxisEntry[]} */
export const BASIS_REGISTRY = [
  {
    id: 'ca-sco-city-exp',
    match: /^CA State Controller - Expenditures$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Cities Annual Report; reconciled against City of Modesto FY2024 ACFR (SCOPE-01-RECON §2.1)',
      figures: 'Governmental $291,641,122 + enterprise/ISF $296,400,946 = $588,042,068 = SCO reported total, to the dollar. A closed-year reported actual, not an appropriation.',
    },
  },
  {
    id: 'ca-sco-city-rev',
    match: /^CA State Controller - Revenues$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Cities Annual Report; City of Modesto FY2024 ACFR p.81 (SCOPE-01-RECON §4.1)',
      figures: '$322,089,879 + $321,804,947 = $643,894,826 = SCO reported total, to the dollar.',
    },
  },
  {
    id: 'ca-sco-county-exp',
    match: /^CA State Controller - County Expenditures$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Counties Annual Report; County of Stanislaus FY2024 ACFR p.23 (SCOPE-01-RECON §4.2)',
      figures: '$1,401,372,422 derived vs $1,401,372,428 reported — $6 on $1.4bn.',
    },
  },
  {
    id: 'ca-sco-county-rev',
    match: /^CA State Controller - County Revenues$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Counties Annual Report; County of Stanislaus FY2024 ACFR p.23 (SCOPE-01-RECON §4.3)',
      figures: '0.547% residue decomposed across eight taxonomies with mixed signs (five SCO-higher, three SCO-lower); a missing fund would subtract in one direction only, so this is a taxonomy difference, not an absent fund.',
    },
  },
  // ── The sixteen entity-published city/state ACFR families ─────────────────
  // 260 rows. Evidence: ACFR-GF-CLASSIFICATION-RECON.md §2. Patterns and row
  // counts are identical to the fund-scope entries of the same ids; see those
  // for the per-family probe tables.
  //
  // Shared basis argument: every stored figure is the printed General Fund
  // column of a governmental-funds Statement of Revenues, Expenditures and
  // Changes in Fund Balances — a year-end GAAP actual, tying exactly across 54
  // coordinate-verified probes. These are NOT appropriations: the same documents
  // present budget against actual in a separate budgetary comparison SCHEDULE,
  // and both the loading path (acfrGF.py `_EXCLUDE`) and the verifying path
  // (acfrPrintedTotal.py) refuse any page whose title carries "Budgetary" or
  // "Budget and Actual", so the budget schedule is structurally unreachable.
  // Latest year in any family is FY2025, closed 2025-06-30 for all sixteen.
  {
    id: 'or-city-acfr-gf',
    match: /^City of (Bend|Sherwood|Beaverton|Hillsboro|Tualatin|Cornelius|Tigard) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Seven Oregon cities\' own ACFRs, 15 coordinate-verified entity-years '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'Every probe ties exactly to the printed General Fund column of the audited '
             + 'governmental-funds statement for a CLOSED fiscal year — e.g. Bend FY2006 '
             + '26,414,845 / 14,236,241 and Beaverton FY2025 84,105,297 / 83,828,091.',
    },
  },
  {
    id: 'az-muni-acfr-gf',
    match: /^(City of Tucson|Marana|Oro Valley|Sahuarita|South Tucson) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Five Arizona municipalities\' own ACFRs, 10 coordinate-verified entity-years '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'Every probe ties exactly — e.g. Tucson FY2024 773,493,270 / 648,657,363 and '
             + 'Sahuarita FY2019 17,760,711 / 15,763,375. All closed June-30 fiscal years.',
    },
  },
  {
    id: 'seattle-city-acfr-gf',
    match: /^City of Seattle ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Seattle ACFRs FY2024 and FY2025 (ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'FY2025 General Fund column 2,407,090 / 2,300,612 (thousands) ties exactly to the '
             + 'stored $2,407,090,000 / $2,300,612,000. Audited, closed calendar-year period.',
    },
  },
  {
    id: 'state-acfr-gf-by-name',
    match: /^State of (Minnesota|Ohio|Virginia) ACFR — General Fund/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Minnesota, Ohio and Virginia state ACFRs, two fiscal years each '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'Every probe ties exactly in thousands — Minnesota FY2025 35,478,861 / 35,114,726, '
             + 'Ohio FY2025 49,343,227 / 49,447,475, Virginia FY2025 31,593,096 / 34,099,267. Same '
             + 'document class and basis conclusion as the existing state-acfr-gf entry.',
    },
  },
  {
    // AUSTIN-TRAVIS-01. 76 rows, measured 2026-08-19. Anchored to the two entity
    // names — see the fund-scope entry of the same id for why a general
    // / ACFR — General Fund/ pattern would wrongly claim 260 unreconciled rows.
    id: 'tx-local-acfr-gf',
    match: /^(City of Austin|Travis County) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Austin FY2024 + FY2015 and Travis County FY2024 ACFRs — audited, '
              + 'unmodified opinion, closed fiscal years (AUSTIN-TRAVIS-01-SCOPE-RECON.md §2)',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances — a year-end GAAP '
             + 'actual, tying exactly on both sides in all three probes. NOT an appropriation: the '
             + 'same documents present budget and actual in separate columns of a budgetary '
             + 'comparison SCHEDULE, and acfrGF.py excludes any page whose title carries '
             + '"Budgetary" or "Budget and Actual", so the budget schedule is structurally '
             + 'unreachable. The whole window is closed — FY2025 ended 2025-09-30 and both FY2025 '
             + 'reports are published and audited.',
    },
  },
  {
    // CO-SPRINGS-EPC-01. 64 rows, measured 2026-08-21. Anchored to the two
    // entity names - see the fund-scope entry of the same id.
    id: 'co-local-acfr-gf',
    // ⚠ EXTENDED by Knight session 7b with City of Boulder and Boulder County.
    match: /^(City of Colorado Springs|El Paso County|City of Boulder|Boulder County) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Colorado Springs FY2024 + FY2016 and El Paso County FY2024 + FY2020 + '
              + 'FY2012 ACFRs - audited, unmodified opinion, closed fiscal years '
              + '(CO-SPRINGS-EPC-01-CLOSEOUT.md section 6)',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances - a year-end GAAP '
             + 'actual, tying exactly on both sides in all five probes. NOT an appropriation, and '
             + 'Colorado Springs is the reason to say so explicitly: its ACFR prints a SECOND '
             + 'statement with almost the same title - "GENERAL FUND / STATEMENT OF REVENUES, '
             + 'EXPENDITURES AND CHANGES IN FUND BALANCE / BUDGET AND ACTUAL" (Exhibit 6, four '
             + 'pages, Original | Final | Actual | Variance) - which IS budgetary basis. Loading '
             + 'that page instead would have put budget-basis figures under a GAAP-actual label '
             + 'with no arithmetic symptom. It is structurally unreachable: both readers exclude '
             + 'any page whose text carries "budget and actual" or "budgetary", and Exhibit 4 '
             + 'precedes Exhibit 6 in every year so the earliest-qualifying rule reaches it first. '
             + 'The whole window is closed - FY2025 ended 2025-12-31 and both FY2025 reports are '
             + 'published and audited.',
    },
  },
  {
    // Knight session 6a — South Carolina's first two cities.
    // ⚠ See the ambiguity warning on sc-local-acfr-gf in fundScopeRegistry.mjs:
    // `City of Columbia` names governments in at least seven states.
    // Knight session 6b — Tennessee's first local entity in TT.
    id: 'tn-local-acfr-gf',
    match: /^Metro Nashville ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[6-9]|2[0-5]) actual, GAAP basis\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'The Metropolitan Government of Nashville and Davidson County ACFRs FY2016-FY2025 '
              + '— audited, closed fiscal years. Every statement page states its own period, '
              + '"For the Year Ended June 30, <year>", and the live Federal Audit Clearinghouse '
              + 'record for auditee 0000193991 independently gives fy_end_date = June 30 in all '
              + 'ten audit years. '
              + '⚠ The month is NOT taken from the repo FAC census, which has no row for this '
              + 'entity at all — buildFacFiscalYearCensus.classifyAuditee() returns null for the '
              + 'name form "THE METROPOLITAN GOVERNMENT OF ...". That is a systematic blind spot '
              + 'for consolidated governments, filed as a follow-up.',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances — a year-end '
             + 'GAAP actual, tying at exactly $0 on both sides in all 20 rows. NOT an '
             + 'appropriation. Metro ALSO publishes a General Fund budgetary-comparison statement '
             + 'in the same document — its FY2025 opinion even names "the respective budgetary '
             + 'comparisons for the General Fund" — and loading that page instead would have put '
             + 'budget-basis figures under a GAAP-actual label with no arithmetic symptom. It is '
             + 'structurally unreachable: the reader excludes any page whose text carries "budget '
             + 'and actual" or "budgetary", and the fund statement precedes the budgetary '
             + 'schedule in every year.',
    },
  },
  {
    // ⚠ EXTENDED TWICE. Wave 1 added City of Charleston (FY2016-FY2025) and
    // Town of Mount Pleasant (FY2018-FY2025), +36 rows; wave 2 added City of
    // Rock Hill and City of Greenville (FY2016-FY2025 each), +40 rows.
    // 38 -> 74 -> 114.
    //
    // ⚠⚠ THE PATTERN HAD TO BE WIDENED IN THE SAME CHANGE. It anchors on the
    // entity name, so without this the 36 new rows would have sat unclaimed
    // while looking perfectly fine — Florida matched none of three registries
    // and Pennsylvania only one. Invisible at 38 rows; this load nearly doubles
    // the family.
    //
    // ⚠ `Town of` Mount Pleasant, not `City of`: it is a town in the Census
    // file and in its own filings, and entity_type is part of its identity.
    id: 'sc-local-acfr-gf',
    match: /^(City of Columbia|City of Myrtle Beach|City of Charleston|Town of Mount Pleasant|City of Rock Hill|City of Greenville) ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[6-9]|2[0-5]) actual, GAAP basis\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Columbia FY2016-FY2018 and FY2020-FY2025 and City of Myrtle Beach '
              + 'FY2016-FY2025 ACFRs — audited, closed fiscal years. Both cities close June 30, '
              + 'ACTIVELY confirmed per entity by the FAC census (SC,Columbia,municipality,'
              + 'annual,7 and SC,Myrtle Beach,municipality,annual,7) and by each statement\'s own '
              + '"Year Ended June 30" caption, so the whole window is closed. '
              + '⚠ The month is NOT assumed from the state: the SC RFA publisher warns that a '
              + 'city fiscal year ends "on or before June 30", so uniformity would have been a '
              + 'guess.',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances — a year-end '
             + 'GAAP actual, tying at exactly $0 on both sides in all 38 rows. NOT an '
             + 'appropriation. Both issuers ALSO publish a General Fund budgetary-comparison '
             + 'schedule in the same document, which IS budgetary basis; loading that page '
             + 'instead would have put budget-basis figures under a GAAP-actual label with no '
             + 'arithmetic symptom. It is structurally unreachable: the reader excludes any page '
             + 'whose text carries "budget and actual" or "budgetary", and the fund statement '
             + 'precedes the budgetary schedule in both issuers.',
    },
  },
  {
    // NC-DURHAM-AVL-01, measured 2026-08-24: City of Durham 32 + Durham County 42
    // + City of Asheville 28 + Buncombe County 36 = 138. A NEW family, so no
    // pre-existing count moved. (Asheville was 10 rows at first load; nine
    // DELINKED-but-not-deleted years were later recovered from Wayback
    // snapshots of the city's own page, and Buncombe was 32 until FY2009/FY2010
    // were found under a fourth naming convention on its own live host.)
    //
    // EXTENDED by the Knight campaign session 2, measured 2026-08-28:
    // + City of Charlotte 30 (FY2011-FY2025) + Mecklenburg County 42
    // (FY2005-FY2025) = 210. Same family on the merits — a General Fund column
    // read directly from each government's own audited ACFR — so the entry is
    // extended rather than duplicated.
    //
    // ⚠⚠ THE "Durham" COLLISION WARNING BELOW IS NO LONGER HYPOTHETICAL.
    // `Mecklenburg County` ALREADY EXISTS IN TT AS A VIRGINIA COUNTY, and so do
    // `Charlotte County, VA` and `Charlottesville, VA`. Checked 2026-08-28: all
    // three carry `data_source = 'Virginia APA Comparative Report'`, which this
    // anchored pattern cannot match, so nothing is mis-claimed today. But if a
    // Virginia ACFR load ever labels its rows `Mecklenburg County ACFR — General
    // Fund …` the string would be IDENTICAL to North Carolina's and this entry
    // would silently claim them. Split by municipality_id at that point; do not
    // widen the string.
    //
    // WARNING ANCHORED TO THE FOUR ENTITY NAMES, for the same reason
    // tx-local-acfr-gf and co-local-acfr-gf are: the general /ACFR - General
    // Fund/ pattern claims ~1,850 rows across families nobody has reconciled. A
    // future North Carolina ACFR load therefore lands `unknown` until it is
    // evidenced, which is the correct failure direction.
    //
    // WARNING this matches the DATA_SOURCE STRING, and "Durham" is also a town
    // in CONNECTICUT and NEW HAMPSHIRE - TT already carries CT entities. The
    // string written here is "City of Durham", which neither town would use,
    // and no such rows exist today; were they loaded later under a colliding
    // label they would need splitting by municipality_id rather than by this
    // string.
    id: 'nc-local-acfr-gf',
    match: /^(City of Durham|Durham County|City of Asheville|Buncombe County|City of Charlotte|Mecklenburg County) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Durham FY2024 + FY2012, Durham County FY2024 + FY2008, City of Asheville '
              + 'FY2024 + FY2022 and Buncombe County FY2024 + FY2015 ACFRs - audited, closed '
              + 'fiscal years. Every NC local unit closes June 30 (N.C.G.S. 159-8(b)) and FY2025 '
              + 'ended 2025-06-30, so the whole window is closed.',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances - a year-end GAAP '
             + 'actual, tying at exactly $0 on both sides in all 116 rows. NOT an appropriation. '
             + 'All four issuers ALSO publish a budgetary-comparison statement for the General '
             + 'Fund in the same document (Asheville describes its own: "four columns: 1) the '
             + 'original budget as adopted by the City Council, 2) ... as amended, 3) the actual '
             + 'resources ... and 4) the difference or variance"), which IS budgetary basis. '
             + 'Loading that page instead would have put budget-basis figures under a GAAP-actual '
             + 'label with no arithmetic symptom. It is structurally unreachable: every reader '
             + 'excludes any page whose text carries "budget and actual" or "budgetary", and the '
             + 'fund statement precedes the budgetary schedule in all four issuers so the '
             + 'earliest-qualifying rule reaches it first. '
             + 'A SECOND DECOY, specific to this milestone: all four issuers publish a POPULAR '
             + 'ANNUAL FINANCIAL REPORT alongside the ACFR - and Durham County publishes its real '
             + 'FY2020 ACFR under the PAFR-style filename "FY-2020-Financial-Report.pdf". The '
             + 'separation is by page count and by the presence of the fund statements, never by '
             + 'filename (scripts/lib/ncAcfrSources.mjs).',
    },
  },
  {
    id: 'wa-sao',
    match: /^WA State Auditor — /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'WA SAO annual financial reports; Spokane FY2019 and Tacoma FY2019 (SCOPE-01-RECON §4.6)',
      figures: 'Both tie exactly on both sides against the audited governmental-funds statement of a closed year.',
    },
  },
  {
    id: 'state-acfr-gf',
    match: / State ACFR — General Fund/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'State ACFRs; Utah FY2024 p.43 and Connecticut FY2024 p.36 (SCOPE-01-RECON §4.5)',
      figures: 'Both tie exactly on both sides. Every claimed row carries "GAAP basis" and "actual" in its own source string.',
    },
  },
  {
    id: 'mn-osa',
    match: /^Minnesota Office of the State Auditor/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'MN OSA cired_22_data.xlsx, Governmental Funds sheet (SCOPE-01-RECON §4.7)',
      figures: 'Bloomington FY2022 col 74 Total Revenues 148,267,637 and col 144 Total Expenditures 155,969,565 — year-end reported figures.',
    },
  },
  {
    id: 'oh-aos',
    match: /^Ohio Auditor of State/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Ohio AOS City_2024_GAAP_Summarized.XLSX, SOREACIFB_TotalGov tab (SCOPE-01-RECON §4.8)',
      figures: 'Columbus FY2024 revenue $2,166,549,000 / expenditures $2,477,440,000 = stored exactly. Hinkle-system year-end actuals (unaudited, which is a quality caveat, not a basis one).',
    },
  },
  {
    id: 'ca-sco-derived-tg',
    match: /^Treasury Tracker derived: Total Governmental \(CA State Controller/,
    value: BASIS.ACTUAL,
    // ⚠ Placed ABOVE the adopted-budget catch-all. That entry matches on
    // /(Operating|Revenue|...).*Budget.../i and the derived labels contain
    // "Revenues", so ordering is what guarantees they can never be read as
    // adopted. (Checked: the catch-all also requires "Budget" at the end, which
    // these labels do not have — so this is belt and braces, not the only guard.)
    evidence: {
      document: 'Inherited, not asserted. Every derived row is computed from a CA State '
              + 'Controller all_funds row, and all 7,664 eligible parents were MEASURED as '
              + 'basis=actual uniformly — the derivation sums a subset of a parent\'s own root '
              + 'categories, so it cannot change the basis of the figure.',
      figures: 'The SCO Annual Report publishes year-end ACTUALS for a closed fiscal year, not '
             + 'appropriations; era B is FY2017+ and every such year has closed. Corroborated '
             + 'against audited statements at Cerritos FY2017 (69,951,331) and Lakewood FY2017 '
             + '(57,831,166), both of which are audited year-end GAAP actuals and both of which '
             + 'the derived figures reproduce exactly. See SCOPE-04-RECON.md.',
    },
  },
  {
    // Knight campaign, session 4 — Georgia DCA Report of Local Government Finances.
    // ⚠ Placed ABOVE the adopted-budget catch-all for the same reason as the
    // Florida entry below: these labels contain "Revenue", and the RLGF is
    // emphatically a closed-year REPORT, not a budget.
    id: 'ga-dca-rlgf',
    match: /^Georgia DCA Report of Local Government Finances — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[6-9]|2[0-5]) actual, (?:self-reported|preparer-certified audited|audit status not stated)\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'The RLGF is a CLOSED-YEAR filing by rule. Ga. Comp. R. & Regs. 110-3-1 '
              + 'requires each local government to "complete a report annually and submit it to '
              + 'the Georgia Department of Community Affairs" covering "the revenues, '
              + 'expenditures, assets, and debts of all funds and agencies of the local '
              + 'government", within six months of the fiscal year end. The form '
              + 'itself is captioned for the "Fiscal Year Ended" and instructs "Use Audit '
              + 'figures if available" — an instruction that only makes sense for a year that '
              + 'has closed. Read 2026-08-29.',
      figures: 'Corroborated arithmetically, not taken on trust. Each filing carries its own '
             + 'printed subtotal and grand-total rows, and the parse reproduces every one of '
             + 'them: 684 of 684 oracle checks across all 38 loaded filings, 0 failed, 0 '
             + 'skipped — section subtotals, Part I / Part III / Own Source Revenues rollups, '
             + 'and Total Part V. A figure that reconciles to the year-end totals printed on '
             + 'the form itself is an actual, not an appropriation. ⚠ The form also carries a '
             + '`Audited` certification flag, which is about ASSURANCE, not basis, and is '
             + 'handled on the audit_grade axis instead.',
    },
  },
  {
    // Pennsylvania DCED form DCED-CLGS-30, both reports.
    //
    // ⚠ One entry covers both scopes: basis is a property of WHEN the figures
    // were struck, not of which funds they cover.
    id: 'pa-dced-clgs30',
    match: /^Pennsylvania DCED Municipal Annual Audit and Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[5-9]|2[0-5]) actual, cash basis, (?:all funds|governmental funds), excl\. financing sources\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Form DCED-CLGS-30 is a CLOSED-YEAR filing: it reports a completed fiscal year '
              + 'and DCED verifies it arithmetically against the prior year ending balance '
              + '(Section III: "DCED verifies that the ending cash/investments balance ... agrees '
              + 'to the calculated balance taking last year ending ... plus revenues minus '
              + 'expenditures"). A form reconciled against last year closing balance cannot be '
              + 'an adopted budget.',
      figures: '⚠⚠ THE ACCOUNTING BASIS IS CASH, AND THE PUBLISHER SAYS SO — "BALANCE SHEET '
             + '(CASH BASIS OF ACCOUNTING ONLY)" on the tip sheet and "Cash Basis - Elected '
             + 'Auditors Only" in Section III. That is why audited_gaap was never available to '
             + 'Pennsylvania regardless of who signs the filing, and why these rows cannot be '
             + 'tied to a GAAP ACFR. This axis records ACTUAL (as opposed to adopted); the '
             + 'cash-versus-GAAP fact lives in audit_grade and in the source string.',
    },
  },

  {
    // South Carolina RFA Local Government Finance Report, county blocks.
    //
    // ⚠ Added with the statewide sweep. The Knight session-6a load's 52 rows were
    // never claimed by a basis entry, so South Carolina sat in the `unknown`
    // bucket and nothing noticed — the same gap Pennsylvania carried until #133.
    // Invisible at 52 rows; not at 1,170.
    id: 'sc-rfa-lgf',
    match: /^South Carolina RFA Local Government Finance Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[2-9]|2[0-4]) actual, county only(?:, excl\. bond and lease proceeds)?\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'RFA\'s county submission form and its instructions. The form asks throughout for '
              + '"the most recently completed fiscal year" and is due 8.5 months after that year '
              + 'ends, so every figure is a closed-year actual and never an appropriation. '
              + 'Reinforced by the report\'s own Sources and Notes, which describe category '
              + 'changes taking effect in past filing years rather than budget cycles.',
      figures: '⚠ THIS AXIS IS ACTUALS-vs-APPROPRIATION, NOT THE ACCOUNTING BASIS. South '
             + 'Carolina explicitly REFUSES the audit — "We cannot accept financial audits as '
             + 'submissions. That is a separate reporting requirement with the State Treasurer\'s '
             + 'Office" — so the assurance fact lives on audit_grade as '
             + 'self_reported_unaudited, never here. ⚠ fund_scope stays `unknown` for this '
             + 'family ON PURPOSE and has no registry entry: RFA drops utility sales REVENUE '
             + 'from the report while keeping utility SPENDING (form line 970), so the two money '
             + 'columns are on different scopes by construction and RFA itself warns against '
             + 'relating them.',
    },
  },

  {
    // Knight campaign, session 3 — Florida DFS LOGERx Annual Financial Reports.
    // ⚠ Placed ABOVE the adopted-budget catch-all, on the `ca-sco-derived-tg`
    // precedent. That entry matches on /(Operating|Revenue|...).*Budget.../i and
    // these labels contain "Revenue"; they carry no "Budget" today, so ordering
    // is belt to the pattern's braces rather than the only thing standing
    // between a closed-year actual and an `adopted` stamp.
    id: 'fl-dfs-afr',
    match: /^Florida DFS Annual Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[2-9]|2[0-5]) actual, (?:audit-reconciled|DEW-reconciled|branch-unrecorded)\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Florida\'s Annual Financial Report is a CLOSED-YEAR filing by statute: '
              + 's. 218.32(1)(a), F.S. requires each local governmental entity to submit "a copy '
              + 'of its annual financial report FOR THE PREVIOUS FISCAL YEAR", and s. 218.32(1)(d) '
              + 'sets the deadline at 45 days after the audit report is completed, no later than '
              + 'nine months after the fiscal year ends. A report filed after the year closed and '
              + 'reconciled against that year\'s audited statements cannot be an adopted budget.',
      figures: 'Corroborated arithmetically rather than taken on trust. DFS separately publishes '
             + 'TOTALREVEXPDEBT per entity; TT\'s parse of the detail reports reproduces both '
             + 'Total Revenues and Total Expenditures to the cent for all 95 loaded entity-years '
             + '(e.g. City of Miami FY2023 expenditures $1,617,244,615 and revenues '
             + '$1,717,354,156). Every loaded year is FY2012-FY2025, all closed. The unclosed-year '
             + 'rule in stampBudgetAxes.mjs is the standing guard if that ever stops being true.',
    },
  },
  {
    // Knight campaign, session 7b — Kansas's first local entities.
    id: 'ks-local-acfr-gf',
    match: /^(City of Wichita|Sedgwick County) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Wichita FY2000-FY2025 and Sedgwick County FY2006-FY2024 ACFRs, each '
              + 'carrying an unmodified independent auditor\'s opinion on the basic financial '
              + 'statements for a CLOSED fiscal year ending December 31. Verified per document '
              + 'by scripts/verifyCoKsOpinions.py.',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances — a year-end '
             + 'GAAP actual, tying exactly on both faces in all 54 entity-years. '
             + '⚠ NOT an appropriation, and both issuers are a reason to say so explicitly: each '
             + 'ACFR also prints a General Fund "Budget and Actual" schedule on the BUDGETARY '
             + 'basis (Sedgwick County FY2019 carries twelve such pages). Loading one would put '
             + 'budget-basis figures under a GAAP-actual label — the Colorado Springs hazard '
             + 'recorded on co-local-acfr-gf, in a second state.',
    },
  },
  {
    // Knight campaign, session 7a — Michigan Treasury Form F-65.
    // ⚠ Placed ABOVE the adopted-budget catch-all for the same reason as the
    // Florida entry: these labels contain the word "Revenue", and one of the two
    // scopes is a DERIVED row, which is exactly the shape `ca-sco-derived-tg`
    // had to guard.
    //
    // ⚠⚠ THE F-65 PUBLISHES A BUDGET COLUMN IN THE SAME TABLE AS THE ACTUALS —
    // `General Fund Final Amended Budget` is a `group` like any other, sitting
    // beside `General Fund`. The loader reads ONLY the groups it names, so no
    // appropriation can reach an actuals row; this entry records that the
    // distinction was made deliberately rather than survived by luck.
    id: 'mi-treasury-f65',
    match: /^Michigan Treasury Form F-65 Annual Local Unit Fiscal Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[0-9]|2[0-5]) actual, (?:general fund|governmental funds), excl\. financing sources and uses\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'The F-65 is a CLOSED-YEAR filing by construction and by instruction. Michigan '
              + 'Treasury\'s "Instructions for Michigan Form F-65" require the unit to "Report '
              + 'the final adjusted balances of all revenues received and expenditures made by '
              + 'fund type", drawn "directly from your audit report where possible" or, failing '
              + 'that, from "your year-end trial balance". Both are post-close artefacts; '
              + 'neither is an appropriation. The form is filed after the fiscal year ends '
              + 'under Public Act 2 of 1968 (MCL 141.424).',
      figures: 'Corroborated by the source\'s OWN separation of the two. Each filing carries a '
             + 'distinct `General Fund Final Amended Budget` group ALONGSIDE the `General Fund` '
             + 'actuals group, and the two differ: Detroit FY2024 Income Tax reads 666,247,119 '
             + 'as final amended budget and 692,923,583 as actual. TT loads the actuals group '
             + 'and never the budget group, so the basis is read from the publisher\'s own '
             + 'column labelling rather than inferred from the fiscal year being closed. '
             + 'All 32 loaded entity-years are FY2010-FY2025, every one closed.',
    },
  },
  {
    // Adopted budget documents. 169 rows / 129 strings / 30 entities,
    // RE-MEASURED 2026-08-28 (was 165 rows, measured 2026-08-17).
    // Placed LAST so a more specific source above always wins.
    //
    // ⚠⚠ THE +4 IS THE CRON SYNC, NOT A PATTERN BUG — and the partition gate is
    // right to have stopped for it. Evidence for re-measuring rather than
    // rewriting the pattern:
    //   * STRINGS (129) and ENTITIES (30) are UNCHANGED, so no new source name
    //     and no new government entered the family. Only fiscal YEARS grew.
    //   * San Francisco now holds 8 rows across FY2025-FY2028 under 2 strings.
    //     Its sync is enabled and rolls forward on its own, and
    //     `project_sf_inverted_amounts_and_listing_cap` already records the
    //     hazard in as many words: "⚠ A new year arrives basis=unknown".
    //     FY2027 + FY2028 x {operating, revenue} = exactly the 4.
    //   * The Knight session-2 load that surfaced this added ONLY
    //     `... ACFR — General Fund ... (FYnnnn actual, GAAP basis)` rows, none of
    //     which this pattern can match; it was verified that 0 of the 169 belong
    //     to Charlotte or Mecklenburg County.
    //
    // ⚠ This is the shape to expect again. Any enabled sync silently grows a
    // family between milestones, so a partition count is a MEASUREMENT WITH A
    // DATE, not a constant — and the next unrelated milestone will be the one
    // that trips over it. The gate's own instruction ("fix the pattern, do NOT
    // edit the expected number") holds for a pattern that claims the wrong
    // rows; it is not a bar on re-measuring when the rows are right and there
    // are simply more of them.
    id: 'city-adopted-budget-doc',
    match: /(Operating|Revenue|General Fund|General Purpose Fund).*Budget( FY\d{4})?$|Budget FY\d{4}$/i,
    value: BASIS.ADOPTED,
    evidence: {
      document: 'The source documents themselves are adopted budgets — e.g. "Long Beach General Fund Operating Budget FY2025", "Oakland General Purpose Fund Operating Budget FY2024".',
      figures: 'Several carry FY2026, a fiscal year that has not closed, so they cannot be actuals. This is half of the -75% Long Beach seam: an adopted GF budget drawn as the continuation of an all-funds actuals series.',
    },
  },
];
