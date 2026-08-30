/**
 * Knight campaign — source→audit_grade registry.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * ⚠ MATCH PATTERNS ARE ANCHORED AT BOTH ENDS. `/^CA State Controller/` looks
 * reasonable and is a bug: it also claims the publicpay.ca.gov compensation rows,
 * which no audit evidence covers. That trap cost SCOPE-01 a task, and it fired
 * again during this campaign's own scoping — a `like 'CA State Controller%'`
 * query counted San Jose's 16 publicpay rows and hid the fact that its entire
 * SCO series was missing. tests/auditGradeRegistry.test.mjs pins it.
 *
 * ⚠ AN ENTRY IS CREATED WHEN ITS EVIDENCE IS, NEVER BEFORE. A family whose audit
 * status could not be established has NO entry here and its rows stay `unknown`.
 * That is the correct outcome, not a gap to be filled in later by guessing.
 *
 * ⚠ DELIBERATELY ABSENT: the Minnesota OSA City/County Finances Report. Three
 * publisher pages were checked on 2026-08-28 and none states what that report is
 * compiled from or whether it is audited. Cities are known to submit a Local
 * Government Financial Reporting Form via SAFES *and* to file a GAAP audit, so
 * "self-reported" is plausible — but plausible is not evidence. Duluth, Saint
 * Paul, Ramsey County and Saint Louis County stay `unknown` until OSA says.
 *
 * Spec:     .planning/KNIGHT-COMMUNITIES-SEEDING.md §3.5
 * Evidence: .planning/KNIGHT-COMMUNITIES-PROGRESS.md
 */

import { AUDIT_GRADE, AUDIT_GRADE_VALUES, classifyAxis } from '../lib/budgetAxes.mjs';

/**
 * The CA SCO judgment, stated once and referenced by both SCO entries.
 *
 * Government Code § 53891(a) directs agencies to draw on audited statements,
 * which puts SCO above a bare self-report — but the requirement is CONDITIONAL
 * ("if this data is available") and the report is furnished by the agency's own
 * finance officer, not audited by SCO. A mixed source takes the WEAKER branch.
 */
const CA_SCO_EVIDENCE = {
  document: 'California Government Code § 53891(a), the statute compelling the Cities Annual Report '
    + '(verified verbatim 2026-08-28). SCO receives and compiles these reports; it does not audit them.',
  figures: 'Verbatim: "The officer of each local agency who has charge of the financial records shall '
    + 'furnish to the Controller a report of all the financial transactions of the local agency during '
    + 'the preceding fiscal year." And: "The report shall contain underlying data from audited financial '
    + 'statements prepared in accordance with generally accepted accounting principles, IF THIS DATA IS '
    + 'AVAILABLE." The condition means an unknown share of rows is not audit-derived and nothing in the '
    + 'dataset distinguishes them, so the weaker branch applies.',
};

/**
 * The North Carolina ACFR judgment, stated once and referenced by both entries.
 *
 * These rows are read DIRECTLY from each government's own audited ACFR, so they
 * are `audited_gaap` rather than any compiled grade. ⚠ The design (§4.3) expected
 * North Carolina to arrive at `compiled_from_audited` via the LGC's Annual
 * Financial Information Report; recon on 2026-08-28 REFUTED that — the NC
 * Treasurer describes AFIR as "Data self-reported by counties and municipalities"
 * — so the state was loaded from ACFRs instead and landed a grade HIGHER than
 * planned. See .planning/KNIGHT-COMMUNITIES-PROGRESS.md.
 */
const NC_ACFR_EVIDENCE = {
  document: 'The independent auditor\'s report bound into each Annual Comprehensive '
    + 'Financial Report, read in ALL 36 documents (City of Charlotte FY2011-FY2025, '
    + 'Mecklenburg County FY2005-FY2025) on 2026-08-28. ⚠ Eight of the 36 opinion pages '
    + 'are IMAGE-ONLY — Charlotte FY2012/FY2024/FY2025 and Mecklenburg FY2005-FY2009 — '
    + 'and were recovered by OCR at 200dpi; a text-layer search finds "Independent '
    + 'Auditor" only in those documents\' tables of contents, which reads exactly like an '
    + 'unaudited report.',
  figures: 'Verbatim, Charlotte FY2023: "In our opinion, the financial statements referred '
    + 'to above present fairly, in all material respects, the respective financial position '
    + 'of the governmental activities, the business-type activities, the discretely presented '
    + 'component unit, EACH MAJOR FUND, and the aggregate remaining fund information of the '
    + 'City, as of June 30, 2023 ... in accordance with accounting principles generally '
    + 'accepted in the United States of America." Mecklenburg FY2023 is the same form and '
    + 'adds "and the budgetary comparison for the general fund". The SCOPE clause is what '
    + 'qualifies these rows: the opinion covers EACH MAJOR FUND, and the General Fund is a '
    + 'major fund in every one of the 36 reports — so it covers the very statement the '
    + 'figures were read from, which is the §3.5 standard.',
};

/** @type {import('../lib/budgetAxes.mjs').AxisEntry[]} */
export const AUDIT_GRADE_REGISTRY = [
  {
    id: 'oh-aos-summarized',
    match: /^Ohio Auditor of State Summarized Annual Financial Reports$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: 'Ohio Auditor of State, Summarized Annual Financial Reports download page '
        + '(https://ohioauditor.gov/references/SummarizedAnnualFinancialReports), fetched 2026-08-28. '
        + 'The publisher states the audit status in its own words, in capitals, on the page the files '
        + 'are downloaded from.',
      figures: 'Verbatim: "Download UNAUDITED annual financial report information by filing year, or '
        + 'browse summarized data by entity type and accounting basis. Data is presented by entity type, '
        + 'filing year, and basis of accounting in accordance with Ohio Revised Code § 117.38." '
        + 'Reinforced by: "To request a copy of an unaudited Hinkle System filing, email '
        + 'HinkleSystem@ohioauditor.gov". Entities self-file via the Hinkle System under ORC § 117.38.',
    },
  },
  {
    id: 'nc-charlotte-acfr',
    // ⚠ ANCHORED AT BOTH ENDS and pinned to the exact FY window that was read.
    // `^City of Charlotte ACFR` alone would also claim any future Charlotte ACFR
    // series — including years whose opinion nobody has looked at — which is the
    // `^CA State Controller` trap in a new place.
    match: /^City of Charlotte ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[1-9]|2[0-5]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: NC_ACFR_EVIDENCE,
  },
  {
    id: 'nc-mecklenburg-acfr',
    match: /^Mecklenburg County ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY20(?:0[5-9]|1\d|2[0-5]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: NC_ACFR_EVIDENCE,
  },
  {
    // ⚠⚠ TT'S FIRST `compiled_from_audited` SOURCE — and the design predicted
    // the WRONG state for it. §4.3 named NC LGC and FL DFS as the two
    // audit-derived candidates; session 2 refuted NC, and session 3 confirms FL.
    //
    // ⚠ THE PATTERN MATCHES ONLY THE `audit-reconciled` BRANCH. Florida is a
    // MIXED source: DFS reconciles the AFR to "the provided audited financial
    // statements OR Data Element Worksheet", and the DEW branch is taken when no
    // audit was performed. There is deliberately NO entry for `DEW-reconciled`
    // here — no such row has been loaded, and §3.5's rule is that an entry is
    // created when its evidence is. `scripts/loadFloridaDFS.mjs` refuses to
    // write a DEW-branch row without an explicit `--allow-dew`, so the two can
    // never be conflated by accident.
    id: 'fl-dfs-afr-audited',
    match: /^Florida DFS Annual Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[2-9]|2[0-5]) actual, audit-reconciled\)$/,
    value: AUDIT_GRADE.COMPILED_FROM_AUDITED,
    evidence: {
      document: 'Florida Department of Financial Services, "Local Government Electronic Reporting '
        + 'in XBRL (LOGERx)" manual, Revised 11/2025, page 13 — the publisher\'s own description '
        + 'of what it does with a filing '
        + '(https://www.myfloridacfo.com/docs-sf/accounting-and-auditing-libraries/manuals/'
        + 'local-government/logerx-manual-2025.pdf), read 2026-08-29. '
        + '⚠ THE STATUTE AND THE RULE ALONE WOULD HAVE PRODUCED THE WRONG ANSWER. '
        + 's. 218.32(1)(a), F.S. has the entity "submit to the department a copy of its annual '
        + 'financial report", signed by the chair and CFO "attesting to the accuracy" of it, and '
        + 'Rule 69I-51.003(3), F.A.C. treats the AFR and the audited statements as two SEPARATE '
        + 'submissions. Read that far, Florida looks exactly like North Carolina — self-reported. '
        + 'What both miss is what the Department then does with the pair.',
      figures: 'Verbatim, LOGERx manual p.13: "When you certify and submit your AFR, the status '
        + 'becomes Certified by Entity. After Department staff RECONCILES THE AFR TO THE PROVIDED '
        + 'AUDITED FINANCIAL STATEMENTS or Data Element Worksheet, the status will become Verified '
        + 'by DFS. If the AFR DOES NOT RECONCILE to the audited financial statements or Data '
        + 'Element Worksheet, the AFR will be placed in Returned by DFS status until the data can '
        + 'be corrected." DFS agrees the figures to the audit and refuses to publish them as '
        + 'verified until they tie — the §3.5 standard for a state agency compiling from audited '
        + 'statements, in the agency\'s own words. '
        + 'WHICH BRANCH APPLIED IS PUBLIC PER FILING, which is what keeps this out of the '
        + '"mixed source takes the weaker branch" rule that holds CA SCO down: the public '
        + 'PUBLICCOMPLIANTGOVS and PUBLICNONCOMPLIANTGOVS reports carry Audit Received Date and '
        + 'Audit Completion Date per entity per year. All 95 loaded entity-years across the seven '
        + 'session-3 governments carry both — e.g. City of Miami FY2023, audit received '
        + '2024-04-15, audit completed 2024-03-29. '
        + '⚠ BOTH compliance reports must be read: the compliant one lists only filers inside the '
        + 'nine-month deadline, and 571 late-but-audited entities appear in the other for FY2023 '
        + 'alone. Reading one would grade every late filer down.',
    },
  },
  {
    // ⚠⚠ Knight session 4 — Georgia is NEITHER the NC answer NOR the FL answer,
    // and the difference is worth stating because the campaign has now hit all
    // three shapes in three consecutive sessions.
    //
    // NC LGC: publisher says "self-reported"        -> ACFRs instead, audited_gaap
    // FL DFS: publisher RECONCILES to the audit     -> compiled_from_audited
    // GA DCA: publisher DISCLAIMS, and no one checks -> self_reported_unaudited
    //
    // ⚠ THE PATTERN MATCHES ALL THREE AUDIT BRANCHES ON PURPOSE. Unlike Florida
    // — where only the `audit-reconciled` branch earns its grade and the DEW
    // branch is deliberately unregistered — every Georgia branch grades the
    // same, because a preparer's own YES adds no independent assurance. The
    // branch is still carried in the source string so the distinction stays
    // visible and re-gradable WITHOUT a reload if that judgement ever changes.
    id: 'ga-dca-rlgf',
    match: /^Georgia DCA Report of Local Government Finances — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[6-9]|2[0-5]) actual, (?:self-reported|preparer-certified audited|audit status not stated)\)$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: 'Georgia Department of Community Affairs, Report of Local Government Finances, '
        + 'and the Ga. Comp. R. & Regs. 110-3-1 that governs it '
        + '(https://rules.sos.ga.gov/gac/110-3-1 and '
        + 'https://dca.georgia.gov/community-assistance/government-authority-reporting/'
        + 'report-local-government-finance-rlgf), read 2026-08-29. '
        + 'THERE IS NO RECONCILIATION STEP — which is precisely what earned Florida DFS its '
        + 'compiled_from_audited grade one session earlier. DCA receives the form and '
        + 'publishes it.',
      figures: 'Verbatim, Rule 110-3-1: "This information does not have to be audited but the '
        + 'use of audited data is encouraged if the audit is available." '
        + 'Verbatim, the form itself, Page 1: "DCA cannot certify the accuracy of the report '
        + 'figures submitted." '
        + 'Verbatim, the UGA Carl Vinson Institute of Government, which publishes the data '
        + 'portal for the General Assembly (https://ted.cviog.uga.edu): "The data on revenues '
        + 'and expenditures collected by DCA may or may not be audited amounts or may be '
        + 'reported on the RLGF using an accounting basis other than that used in the local '
        + 'government’s financial reports." '
        + 'The publisher therefore disclaims BOTH the audit and the accounting basis. '
        + '⚠ THE FORM DOES CARRY A PER-YEAR CERTIFICATION FLAG (Part XV, "Report uses '
        + 'AUDITED Figures"), and it flips WITHIN a single entity: Milledgeville answered YES '
        + 'in FY2016-17, NO in FY2019-24, then YES again in FY2025, while Columbus-Muscogee '
        + 'answered YES in all ten years and Macon-Bibb NO in all but two, which it left '
        + 'blank. That is a first-party claim with nothing behind it, so it does not lift the '
        + 'grade (Chris’s call, 2026-08-29) — but it is the strongest evidence yet '
        + 'that this axis must live per ROW and not per source.',
    },
  },
  {
    // ⚠⚠ Knight session 5 — Indiana is the NC answer arrived at HONESTLY, and it
    // is worth stating why it is not the Florida answer, because it looks like
    // it should be. Indiana HAS a real state auditor (SBOA) that genuinely
    // audits these units. But the audit happens AFTERWARDS, on a cycle, and what
    // Gateway publishes is the pre-audit submission. An audit existing somewhere
    // in the process is not the published figures being audit-derived.
    id: 'in-gateway-afr',
    match: /^Indiana Gateway Annual Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[5-9]|2[0-5]) actual, unaudited, excl\. settlement funds\)$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: 'Indiana Gateway for Government Units (IFI / DLGF / SBOA), "Learn more about … '
        + 'The Annual Financial Report (AFR)", rev. 11/3/2022 '
        + '(https://gateway.ifionline.org/guides/about/LearnMoreAFR.pdf), read 2026-08-29. '
        + 'This is the publisher\'s own explainer, and it states the audit status in one '
        + 'sentence — no inference, no reading of the statute required.',
      figures: 'Verbatim: "Indiana state law requires that the state examiner (State Board of '
        + 'Accounts) receive annual financial reports from counties, cities, towns, townships, '
        + 'schools, libraries, utilities and special districts and that they submit those reports '
        + 'via the collection systems of Gateway (see IC 5-11-1-4). These reports, as submitted by '
        + 'the units, are made available via Gateway to the public soon after the deadline for '
        + 'submission (60 days after year end) or earlier. THESE REPORTS, HOWEVER, ARE UNAUDITED. '
        + 'The State Board of Accounts (SBOA) uses these Gateway submissions as part of their '
        + 'required auditing of these units." '
        + 'Basis is stated in the same document: "Units are required to use a REGULATORY BASIS of '
        + 'accounting which complies with the financial reporting provisions of a government '
        + 'regulatory agency (in this case, SBOA)." Not GAAP, so audited_gaap was never available.',
    },
  },
  {
    // ⚠⚠ Knight session 5 — Pennsylvania is a FOURTH shape, and the campaign has
    // now hit four distinct answers in four consecutive states:
    //
    //   NC LGC: publisher says "self-reported"          -> ACFRs, audited_gaap
    //   FL DFS: publisher RECONCILES to the audit       -> compiled_from_audited
    //   GA DCA: publisher DISCLAIMS, nobody checks      -> self_reported_unaudited
    //   PA DCED: AN AUDITOR FILES IT — for some classes -> self_reported_unaudited
    //            of government, and the finance office     (weaker branch; the
    //            for others, and the branch is not         branch is not
    //            in the published extract                  identifiable)
    //
    // ⚠ THIS IS THE FIRST TIME THE GRADE UNDERSTATES WHAT TT ACTUALLY KNOWS.
    // State College is a Borough, so its filing is signed by elected auditors, an
    // independent auditor, or a controller. Philadelphia is a City, so its
    // Director of Accounts and Finance self-reports it. Those are genuinely
    // different levels of assurance and the four-value vocabulary cannot say so.
    // Chris's call 2026-08-29: take §3.5's weaker branch now, and hunt for a
    // per-entity auditor-type field as its own follow-up. If that field is found,
    // Pennsylvania becomes Florida-shaped and State College would grade ABOVE
    // Philadelphia — which is why the nuance is recorded here rather than lost.
    id: 'pa-dced-clgs30',
    match: /^Pennsylvania DCED Municipal Annual Audit and Financial Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[5-9]|2[0-5]) actual, cash basis, (?:all funds|governmental funds), excl\. financing sources\)$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: 'Pennsylvania DCED, Municipal Annual Audit and Financial Report, form DCED-CLGS-30 '
        + '(12/2023), read in full 2026-08-29 '
        + '(https://dced.pa.gov/download/dced-clgs-30-2023-municipal-annual-audit-and-financial-report/), '
        + 'together with its Tip Sheet. '
        + '⚠ THE FORM\'S TITLE CONTAINS THE WORD "AUDIT" AND THAT PROVES NOTHING — the North '
        + 'Carolina lesson. What settles it is that DCED\'s own verification is ARITHMETIC, not '
        + 'evidentiary: it reconciles the form to ITSELF, never to an audited statement. That is '
        + 'exactly the step Florida DFS performs and Pennsylvania does not, so PA is not '
        + 'compiled_from_audited.',
      figures: 'Verbatim, Section III: "DCED verifies that the ending cash/investments balance '
        + '(accounts 100-120) agrees to the calculated balance taking last year\'s ending '
        + 'cash/investments balance and adding the current year\'s revenues and subtracting the '
        + 'current year\'s expenditures." A roll-forward footing check. '
        + 'Verbatim, Section IV, on who files: "Cities: Director of Accounts and Finance / '
        + 'Boroughs: Elected Auditors, Independent Auditor, or Controller / First Class Townships: '
        + 'Elected Auditors, Independent Auditor, or Controller / Second Class Townships: Elected '
        + 'Auditors or Independent Auditor / Home Rule Communities: In accordance with charter." '
        + 'So the source is MIXED, and it splits our two municipalities the opposite way round '
        + 'from what size suggests — an auditor signs State College\'s filing; Philadelphia\'s '
        + 'finance office signs its own. '
        + 'The auditor-type selection ("Elected Auditor" / "Appointed Auditor/CPA") is captured in '
        + 'the online form but appears in NONE of the 71 columns of the statewide extract, so '
        + 'unlike Florida the branch cannot be identified per entity per year. §3.5: the grade '
        + 'reflects the weaker branch. '
        + 'Basis is stated by the publisher and it is CASH, not GAAP: "BALANCE SHEET (CASH BASIS '
        + 'OF ACCOUNTING ONLY)" (Tip Sheet) and "Cash Basis - Elected Auditors Only" (Section III), '
        + 'so audited_gaap was never available regardless of who signed.',
    },
  },
  {
    id: 'sc-city-acfr',
    match: /^(City of Columbia|City of Myrtle Beach) ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[6-9]|2[0-5]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'The independent auditor\'s report, read in ALL NINETEEN loaded documents '
        + '(City of Columbia FY2016-FY2018 and FY2020-FY2025, City of Myrtle Beach FY2016-FY2025) '
        + 'on 2026-08-30. '
        + '⚠⚠ NINE OF THE NINETEEN WOULD HAVE READ AS UNAUDITED ON A PLAIN TEXT SEARCH, a worse '
        + 'rate than session 2\'s eight-of-thirty-six, and in TWO DISTINCT WAYS. Seven have an '
        + 'IMAGE-ONLY opinion page and were recovered by OCR at 200dpi (Columbia FY2020-FY2023, '
        + 'Myrtle Beach FY2017, FY2021, FY2024); a text search finds "Independent Auditor" only '
        + 'in the table of contents, which reads exactly like an unaudited report. TWO MORE have '
        + 'a text layer that has LOST ITS SPACES (Myrtle Beach FY2022 and FY2025 render '
        + '"eachmajorfundandtheaggregateremainingfundinformation" and "fmancial" for "financial"), '
        + 'so the phrase is present and unsearchable — found only by collapsing all whitespace '
        + 'before matching. Neither failure is visible to any arithmetic gate. '
        + '⚠ Myrtle Beach FY2025 is a MIXED document: its opinion pages are OCR-damaged while its '
        + 'statement pages are born-digital and extract cleanly. Do not infer the quality of one '
        + 'section from another.',
      figures: 'Verbatim, City of Columbia FY2020 (recovered by OCR): "In our opinion, the '
        + 'financial statements referred to above present fairly, in all material respects, the '
        + 'respective financial position of the governmental activities, the business-type '
        + 'activities, the aggregate discretely presented component units, EACH MAJOR FUND, and '
        + 'the aggregate remaining fund information of the City as of June 30, 2020 ... in '
        + 'accordance with accounting principles generally accepted in the United States of '
        + 'America." Myrtle Beach FY2017 is the same form, naming "the City of Myrtle Beach, '
        + 'South Carolina". '
        + 'The scope clause is what matters and it is the same §3.5 standard session 2 applied to '
        + 'Charlotte: the opinion names EACH MAJOR FUND, and the General Fund is a major fund in '
        + 'every one of these nineteen reports — so the opinion covers the statement the figures '
        + 'were actually read from, not merely the document containing it. '
        + '⚠ The one opinion that does NOT support this grade was also found and set aside: '
        + 'Myrtle Beach FY2022 page 21 carries an "In our opinion" on the COMBINING AND '
        + 'INDIVIDUAL FUND STATEMENTS AND SCHEDULES "in relation to the basic financial '
        + 'statements as a whole", which is in-relation-to assurance and NOT an opinion on the '
        + 'General Fund. That year\'s grade rests on its PRIMARY opinion, found separately in the '
        + 'whitespace-collapsed text layer. A search that stopped at the first "In our opinion" '
        + 'would have graded it on the wrong sentence.',
    },
  },
  {
    id: 'sc-rfa-lgf-county',
    match: /^South Carolina RFA Local Government Finance Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[2-9]|2[0-4]) actual, county only(?:, excl\. bond and lease proceeds)?\)$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: 'S.C. Revenue and Fiscal Affairs Office, "FY 2025 Annual County Financial Report '
        + 'Instructions" (revised December 2025, https://rfa.sc.gov/media/11436), read in full '
        + '2026-08-30, together with the "About the Report" and "Sources and Notes" sheets of the '
        + 'FY 2023-24 Local Government Finance Report itself (revised 2026-05-12). '
        + '⚠ A FIFTH DISTINCT ANSWER IN FIVE STATES, AND THE CLEANEST ONE YET: where North '
        + 'Carolina had to be inferred from a "self-reported" note, Florida turned on a '
        + 'reconciliation buried in a manual, Georgia on a rule saying audit was optional and '
        + 'Pennsylvania on who signs the form, SOUTH CAROLINA EXPLICITLY REFUSES THE AUDIT AS A '
        + 'SUBMISSION. There is no reconciliation step of any kind, which is precisely what earned '
        + 'Florida DFS its higher grade.',
      figures: 'Verbatim, the instructions, under the filing rules: "NOTE: We cannot accept '
        + 'financial audits as submissions. That is a separate reporting requirement with the '
        + 'State Treasurer\'s Office." '
        + 'Verbatim, About the Report: "we request the revenue and expenditure information needed '
        + 'for our analyses based upon the local governments audited annual financial reports IF '
        + 'THE AUDIT IS COMPLETE BEFORE THE SURVEY IS DUE" — conditional, the same shape as CA '
        + 'Government Code § 53891(a)\'s "if this data is available", so an unknown share of rows '
        + 'is not audit-derived and nothing in the dataset distinguishes them. '
        + 'Verbatim, About the Report: "This report is not intended to replace audited financial '
        + 'statements or reflect an opinion on the overall financial status of a local political '
        + 'subdivision." '
        + 'Verbatim, Sources and Notes: "County Data: S.C. counties annually submit a form to RFA" '
        + 'and "Note: RFA does not modify data unless otherwise noted." The agency receives and '
        + 'compiles; it does not verify, not even arithmetically the way Pennsylvania DCED does. '
        + 'The form is signed by the county\'s own officer: "Certification: ... Name of Responsible '
        + 'Officer". Submission is compelled by S.C. Code § 6-1-50 on pain of withholding ten '
        + 'percent of state aid — a filing duty, not an assurance. '
        + '⚠ ONE COLUMN FAMILY HAS A DIFFERENT PROVENANCE AND IT IS STILL NOT AUDITED: property '
        + 'tax figures do not come from this form at all. Verbatim: "NOTE: Property tax sections '
        + 'have been removed to reduce duplication of effort. RFA uses the Department of Revenue\'s '
        + 'Local Government Report from county auditors instead." A second self-reporting channel, '
        + 'so the grade is unchanged, but the mixed provenance is recorded because it makes the '
        + 'property-tax rows non-independent of SCDOR rather than of the county.',
    },
  },
  {
    id: 'ca-sco-city-exp',
    match: /^CA State Controller - Expenditures$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: CA_SCO_EVIDENCE,
  },
  {
    id: 'ca-sco-city-rev',
    match: /^CA State Controller - Revenues$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: CA_SCO_EVIDENCE,
  },
];

/**
 * Grade one `data_source` string.
 *
 * Returns `{value: 'unknown', entryId: null}` for every failure path — no match,
 * no evidence, an illegal value, a throwing matcher, a null input. The
 * destructive direction here is "assert a grade", never "skip".
 *
 * @param {string|null|undefined} dataSource
 * @returns {{value: string, entryId: string|null}}
 */
export function gradeFor(dataSource) {
  return classifyAxis(dataSource, AUDIT_GRADE_REGISTRY, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN);
}
