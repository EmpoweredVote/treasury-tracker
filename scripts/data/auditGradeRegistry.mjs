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
    id: 'tn-nashville-acfr',
    match: /^Metro Nashville ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[6-9]|2[0-5]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'The independent auditor\'s report, read in ALL TEN loaded documents '
        + '(The Metropolitan Government of Nashville and Davidson County ACFRs FY2016-FY2025) '
        + 'on 2026-08-30. '
        + '⚠ A WELCOME CONTRAST WITH SESSION 6a: every one of these ten carries a born-digital '
        + 'text layer and the opinion is found by a plain search. Nine of South Carolina\'s '
        + 'nineteen needed OCR or whitespace-collapsing. Document quality is a property of the '
        + 'ISSUER, not of the campaign, and must be re-checked per entity rather than assumed '
        + 'from the previous session.',
      figures: 'Verbatim, FY2025: "In our opinion, based on our audit and the reports of other '
        + 'auditors, the financial statements referred to above present fairly, in all material '
        + 'respects, the respective financial position of the governmental activities, the '
        + 'business-type activities, the aggregate discretely presented component units, EACH '
        + 'MAJOR FUND, and the aggregate remaining fund information of The Metropolitan '
        + 'Government of Nashville and Davidson County, Tennessee, as of June 30, 2025 ... and '
        + 'the respective budgetary comparisons for the General Fund". FY2016 is the same form. '
        + 'The scope clause is the §3.5 standard: the opinion names EACH MAJOR FUND, and the '
        + 'General Fund is a major fund in every one of these ten reports — so it covers the '
        + 'statement the figures were read from, not merely the document containing it. '
        + '⚠ "BASED ON OUR AUDIT AND THE REPORTS OF OTHER AUDITORS" IS NOT A QUALIFICATION. It '
        + 'is a group-audit division of responsibility — component auditors reported on parts of '
        + 'the reporting entity — and the opinion itself is unmodified. Reading it as a scope '
        + 'limitation would understate the grade. '
        + '⚠ Metro is audited by a CPA FIRM, not by the Tennessee Comptroller\'s Division of '
        + 'Local Government Audit, which audits 91 of the state\'s 95 counties itself. That is '
        + 'why Davidson is one of the four counties absent from the detail of the Comptroller\'s '
        + 'TAG export, and it is also why the figures here are read from the ACFR directly. '
        + 'The grade is unaffected: an independent auditor\'s opinion is an independent '
        + 'auditor\'s opinion.',
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
  {
    // Knight campaign, session 7b — the four Colorado + Kansas ACFR entities.
    //
    // ⚠⚠ ANCHORED TO THE FOUR ENTITIES WHOSE OPINIONS THIS SESSION ACTUALLY
    // READ, not to the whole `co-local-acfr-gf` family. Widening this pattern
    // would have graded rows off evidence nobody gathered. §3.5 requires
    // evidence PER DOCUMENT, and "it is an ACFR, so it is audited" is exactly
    // the assumption North Carolina punished in session 2.
    //
    // ✅ The follow-up this comment used to name — Colorado Springs and El Paso
    // County, `unknown` since v2.29 — was done on 2026-08-31 and has its OWN
    // entry below (`co-springs-epc-acfr-gf`) with its own evidence. It is a
    // separate entry rather than a widened pattern for the same reason this one
    // was narrow: the documents were read separately, so they are attested
    // separately.
    id: 'co-ks-local-acfr-gf',
    match: /^(City of Boulder|Boulder County|City of Wichita|Sedgwick County) ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:20[0-2][0-9]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'The 54 loaded ACFRs themselves, each carrying an independent auditor\'s report '
        + 'on the basic financial statements: City of Boulder FY2016-FY2022 (fetched from the '
        + 'Federal Audit Clearinghouse by report_id), Boulder County FY2021-FY2025, City of '
        + 'Wichita FY2000-FY2025 less FY2001/FY2008, and Sedgwick County FY2006-FY2024 less '
        + 'FY2005/FY2019. Verified per document by scripts/verifyCoKsOpinions.py, which is '
        + 'committed alongside this entry and re-runnable.',
      figures: '⚠⚠ SEVENTEEN OF THESE OPINIONS ARE INVISIBLE TO A PLAIN TEXT SEARCH, and grading '
        + 'on the text layer alone would have shipped City of Wichita FY2000-FY2010 and Sedgwick '
        + 'County FY2006-FY2011 as `unknown`. Those documents are born-digital in the statements '
        + 'and IMAGE-ONLY on the auditor\'s page, so a text search finds "Independent Auditor" '
        + 'exactly ONCE — in the TABLE OF CONTENTS — which reads precisely like an unaudited '
        + 'report. This is session 2\'s lesson (8 of 36 Charlotte/Mecklenburg opinion pages were '
        + 'image-only) in its third occurrence. OCR at 200dpi recovers them; Wichita FY2005 reads '
        + '"In our opinion, the financial statements referred to above present fairly, in all '
        + 'material respects ... in conformity with accounting principles generally accepted in '
        + 'the United States of America" over the signature of Allen, Gibbs & Houlik, L.C. '
        + '⚠ THE FIRST "IN OUR OPINION" IS NOT NECESSARILY THE RIGHT ONE — every one of these '
        + 'reports also carries an IN-RELATION-TO paragraph about the combining schedules '
        + '("...we express no opinion on such information"). The primary opinion is identified '
        + 'positively instead, by pairing a fair-presentation phrase with a GAAP conformity '
        + 'phrase, so a document can never be graded off the supplementary-information paragraph. '
        + '⚠ A modified-opinion WORD is not a modified opinion: "qualified opinion" and "adverse '
        + 'opinion" appear in the Single Audit compliance report and in standard boilerplate in '
        + 'several of these documents. Those occurrences are reported for review and never used '
        + 'to downgrade automatically. '
        + '⚠ The four unloadable documents are NOT graded because they are not loaded — they are '
        + 'declared gaps in scripts/extractCoKsAll.mjs, never written as $0.',
    },
  },
  {
    // Colorado Springs + El Paso County — the follow-up session 7b filed and
    // deliberately did not take. Loaded in v2.29 (PR #47), `unknown` until now.
    //
    // ⚠⚠ THE GATE THAT PROVES AN OPINION EXISTS CANNOT PROVE IT IS CLEAN, and
    // this entry is the first in the campaign to say so out loud.
    // verifyCoKsOpinions.py identifies the primary opinion by pairing "present
    // fairly, in all material respects" with a GAAP conformity phrase — and a
    // QUALIFIED opinion contains BOTH, because its sentence reads "except for
    // the effects of ..., the financial statements present fairly, in all
    // material respects". Harrison County MS is the proof: ten loaded rows pass
    // that gate and are NOT clean. So a second implementation was written —
    // scripts/checkOpinionType.py — which reads the opinion PARAGRAPH rather
    // than the document and reports any modifier inside it. Both were run over
    // all 32 documents and both are re-runnable.
    //
    // ⚠ ANCHORED AT BOTH ENDS and pinned to the years actually loaded. Note the
    // NAME COLLISION this guards against: El Paso County, TEXAS is a real
    // county TT does not yet hold. If it is ever onboarded with this same label
    // shape, this pattern WOULD claim it — the registry sees `data_source` and
    // nothing else. Re-check this entry before loading any Texas El Paso.
    id: 'co-springs-epc-acfr-gf',
    // ⚠ The year alternation is EXACTLY the loaded set — FY2005, FY2009 and
    // FY2010-FY2025 — not a decade wildcard. A looser `20[1-2][0-9]` would
    // auto-grade a FY2026 ACFR the moment it loaded, off an opinion nobody had
    // read. It also excludes El Paso FY2006-FY2008, which are published but
    // declined as unparseable, so the gap stays visible as `unknown`.
    match: /^(City of Colorado Springs|El Paso County) ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:200[59]|201[0-9]|202[0-5]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'All 32 loaded ACFRs, read on 2026-08-31: City of Colorado Springs FY2012-FY2025 '
        + '(14 documents) and El Paso County, Colorado FY2005 and FY2009-FY2025 (18 documents), '
        + 'each fetched from the `source_url` already stored on the rows it grades — so the '
        + 'document attested here is the same one the reader is offered. Every one carries an '
        + 'independent auditor\'s report on the basic financial statements. Verified twice: '
        + 'scripts/verifyCoKsOpinions.py (opinion PRESENT: 19 in the text layer, 13 recovered by '
        + 'OCR, 0 not found) and scripts/checkOpinionType.py (opinion UNMODIFIED: 32 clean, 0 '
        + 'modified, 0 unreadable).',
      figures: '⚠⚠ THIRTEEN OF THE 32 OPINIONS ARE INVISIBLE TO A PLAIN TEXT SEARCH — the fourth '
        + 'occurrence of this failure mode in the campaign, and the proportion is worse here '
        + 'than in 7b (13 of 32 against 17 of 57). Colorado Springs is image-only on the '
        + 'auditor\'s page for EVERY year FY2018-FY2025, and El Paso County for FY2005, '
        + 'FY2009-FY2011 and FY2020. Grading on the text layer alone would have shipped all '
        + 'thirteen as `unknown`. OCR at 200dpi recovers them; Colorado Springs FY2024 reads, '
        + 'under the heading "Opinions", "In our opinion, based on our audit and the report of '
        + 'the other auditors, the accompanying financial statements referred to above present '
        + 'fairly, in all material respects, the respective financial position of the '
        + 'governmental activities ... as of December 31, 2024" over the signature of '
        + 'ForvisMazars. El Paso County FY2005 reads the same over the reports of other auditors. '
        + '⚠ "Based on our audit AND THE REPORTS OF OTHER AUDITORS" appears in most of these and '
        + 'is NOT a modification — it is the standard group-audit reference to component units '
        + 'audited by someone else. Reading it as a qualification would downgrade 30 clean '
        + 'opinions. '
        + '⚠ The heading over the opinion is "Opinions", never "Unmodified Opinion" — the AU-C '
        + '700 format does not label a clean opinion, it labels only a modified one. So the '
        + 'clean verdict rests on a POSITIVE fair-presentation sentence plus the ABSENCE of any '
        + 'modifier within 1,200 characters of it, which is what checkOpinionType.py measures. '
        + 'Four opinion sentences were additionally read by eye (Springs FY2012 and FY2024, El '
        + 'Paso FY2005 and FY2019) and none carries an "except for". '
        + '⚠ The excluded years are NOT graded because they are not loaded: Springs FY1999-FY2011 '
        + 'and El Paso FY2000-FY2004 are image-only scans, and El Paso FY2006-FY2008 is a '
        + 'differently-titled statement split across two pages. See '
        + '[[project_co_springs_el_paso_onboarding]].',
    },
  },
  {
    // Knight campaign, session 7a — Michigan Treasury Form F-65.
    //
    // ⚠⚠ A SIXTH DISTINCT ANSWER IN SIX STATES, and the one that most nearly
    // earned a higher grade without doing so:
    //
    //   NC LGC:  publisher says "self-reported"           -> ACFRs, audited_gaap
    //   FL DFS:  publisher RECONCILES to the audit        -> compiled_from_audited
    //   GA DCA:  publisher DISCLAIMS, nobody checks       -> self_reported_unaudited
    //   PA DCED: AN AUDITOR FILES IT for some classes     -> self_reported_unaudited
    //   SC RFA:  publisher REFUSES to accept the audit    -> self_reported_unaudited
    //   MI F-65: publisher INSTRUCTS "use the audited     -> self_reported_unaudited
    //            numbers" — and never checks that you did
    //
    // ⚠ ANCHORED AT BOTH ENDS and pinned to the years actually loaded, and the
    // scope phrase is enumerated rather than wildcarded, so a future Michigan
    // family at a third scope cannot be silently swallowed by this entry.
    id: 'mi-treasury-f65',
    match: /^Michigan Treasury Form F-65 Annual Local Unit Fiscal Report — (?:Expenditure by Function|Revenue by Source) \(FY20(?:1[0-9]|2[0-5]) actual, (?:general fund|governmental funds), excl\. financing sources and uses\)$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: 'Michigan Department of Treasury, "Instructions for Michigan Form F-65 '
        + '(Form No. 3965), Annual Local Unit Fiscal Report", read in full 2026-08-30 '
        + '(https://www.michigan.gov/-/media/Project/Websites/treasury/Property/'
        + '20152016_F65_Instructions.pdf), together with the Department\'s "Audit Manual for '
        + 'Local Units of Government in Michigan". '
        + '⚠ michigan.gov\'s WWW host is behind a WAF that 403s a plain fetch AND WebFetch (the '
        + 'Charlotte/Akamai shape); browser headers plus Sec-Fetch-* and a Referer retrieve it. '
        + '⚠⚠ THE INSTRUCTION TO USE AUDITED NUMBERS IS THE STRONGEST THIS CAMPAIGN HAS READ, '
        + 'AND IT IS STILL NOT ENOUGH — because it is CONDITIONAL, the filer is the local unit '
        + 'itself, and NO ONE RECONCILES THE RESULT. That reconciliation is precisely what '
        + 'earned Florida its higher grade. Michigan\'s own Audit Manual mentions the F-65 '
        + 'EXACTLY ONCE, and only to cite the filing requirement at MCL 141.424. Treasury '
        + 'collects the form; it does not check it against the audit.',
      figures: 'Verbatim, from the instructions. Directing audited data: "If you are required to '
        + 'have an audit for the 2015-2016 fiscal year, please use the audited numbers." And: '
        + '"Report the final adjusted balances of all revenues received and expenditures made by '
        + 'fund type ... in accordance with the official state Uniform Chart of Accounts and '
        + 'your annual financial audit report. Take information directly from your audit report '
        + 'where possible." And: "in accordance with your unit\'s audited financial statements '
        + '(or year-end trial balance if your unit is not subject to an audit requirement)". '
        + 'Disclaiming the form\'s standing and naming the unaudited fallback: "The Form F-65 '
        + 'does not satisfy other statutory requirements for audited financial statements '
        + 'required by Public Act 2 of 1968 or the Single Audit Act Amendments of 1996." And: '
        + '"If you are not being audited for the current year, you still are required to file. '
        + 'Prepare Form F-65 based on your year-end trial balance." '
        + 'This is the CALIFORNIA SCO shape stated more explicitly — audited data directed '
        + 'CONDITIONALLY, filed by the unit\'s own officers — so §3.5\'s mixed-source rule takes '
        + 'the weaker branch. '
        + '⚠ SECOND CASE WHERE THE GRADE UNDERSTATES WHAT TT KNOWS (Pennsylvania was the first). '
        + 'Detroit and Wayne County are far above every Michigan audit threshold and both file '
        + 'Single Audits every year, so for THESE TWO ENTITIES the "required to have an audit" '
        + 'branch is certainly true and their figures are audit-derived in fact. But the F-65 '
        + 'carries no audited flag in any published column, so the branch is not identifiable '
        + 'per entity per year the way Florida\'s is — and a grade TT cannot read from the data '
        + 'is a grade TT must not assert.',
    },
  },
  {
    // Knight campaign, session 8 — South Dakota, and TT's FIRST `audited_ocboa`.
    //
    // ⚠⚠ THE ONLY NON-GAAP AUDITED FAMILY IN THE CAMPAIGN. Every other audited
    // family here is `audited_gaap`. Brown County is audited to the same
    // standard and measured on a different basis, and before session 8 the
    // vocabulary could not say so: `audited_gaap` asserts a basis the document
    // denies, `unknown` claims nobody looked, `self_reported_unaudited` denies
    // the audit. `audited_ocboa` was added for exactly this row set.
    //
    // ⚠ The match is anchored on the `modified cash basis` label the loader
    // writes into the data_source, so it CANNOT claim the GAAP-basis sources of
    // any other entity — including the City of Aberdeen, twelve miles away and
    // in this same state family, whose label reads `GAAP basis`.
    // Knight session 8 — the four GAAP families. Every opinion below was
    // verified per document by scripts/verifyCoKsOpinions.py run over
    // `_acfr-work/s8`: 61 found in the text layer, 5 recovered by OCR.
    //
    // ⚠⚠ FOUR LFUCG YEARS ARE DELIBERATELY EXCLUDED — see the ky entry.
    id: 's8-sd-aberdeen-acfr-gf',
    match: /^City of Aberdeen ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:20[0-2][0-9]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'The nine loaded City of Aberdeen reports (FY2016-FY2024), each bearing an '
        + 'independent auditor\'s report from Eide Bailly LLP. Fetched from the Federal Audit '
        + 'Clearinghouse by report_id (EIN 466000010, auditee id 0000170919).',
      figures: 'Opinions located in the TEXT layer of all nine by scripts/verifyCoKsOpinions.py, '
        + 'which requires a fair-presentation phrase PAIRED with a GAAP conformity phrase so a '
        + 'document can never be graded off the in-relation-to paragraph about supplementary '
        + 'information. FAC records `unmodified_opinion` on all nine independently. '
        + '⚠ NOT Aberdeen, MARYLAND, which publishes its own ACFR at aberdeenmd.gov. '
        + '⚠ Aberdeen is GAAP and whole dollars; BROWN COUNTY, its own parent county twelve '
        + 'miles away and audited in the same town, is MODIFIED CASH and prints cents. Neither '
        + 'fact may be carried between them.',
    },
  },
  {
    id: 's8-ms-local-acfr-gf',
    match: /^(?:City of Biloxi|Harrison County) ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:20[0-2][0-9]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'Mississippi\'s first locals in TT. City of Biloxi FY2002-FY2022 (city\'s own '
        + 'publications page and FAC) and Harrison County FY2016-FY2023 (FAC, EIN 646000425), '
        + 'each bearing an independent auditor\'s report. Opinions located per document by '
        + 'scripts/verifyCoKsOpinions.py.',
      figures: '⚠⚠ EVERY LOADED HARRISON COUNTY YEAR CARRIES A **QUALIFIED OPINION ON THE '
        + 'GENERAL FUND** — the exact opinion unit these rows come from. Read from each '
        + 'document\'s own Summary of Auditors\' Results and opinion paragraphs, not inferred: '
        + 'FY2016 "Governmental Activities Qualified / Discretely presented component unit '
        + 'ADVERSE / General Fund Qualified / Other major funds Unmodified"; FY2017 the same '
        + 'less the adverse; FY2021-FY2023 "Qualified Opinions on Governmental Activities and '
        + 'the General Fund". The cause is identical every year — the County did not maintain '
        + 'an accurate aging of fines receivable of the Circuit and Justice Courts '
        + '($8,230,286 at FY2016), a SCOPE limitation on a receivable, not a basis departure. '
        + 'The FY2016 ADVERSE opinion is on the discretely presented component unit (the '
        + 'Mississippi Coast Coliseum Commission, omitted from the reporting entity) and does '
        + 'NOT touch the General Fund. '
        + '⚠ The statements are GAAP and independently opined on, so `audited_gaap` is true — '
        + 'but it does not distinguish a qualified opinion from a clean one, and this family is '
        + 'the campaign\'s first where that matters. Filed for review. '
        + '⚠ Biloxi\'s own opinions are unmodified; its excluded years are excluded for '
        + 'DOCUMENT QUALITY (FY2023 is a catastrophic scan at all three publishers), never for '
        + 'opinion reasons.',
    },
  },
  {
    id: 's8-nd-local-acfr-gf',
    match: /^(?:City of Grand Forks|Grand Forks County) ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:20[0-2][0-9]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'North Dakota\'s first locals in TT. City of Grand Forks FY2016-FY2025 (EIN '
        + '456002085) and Grand Forks County FY2016-FY2024 (EIN 456002215), from the Federal '
        + 'Audit Clearinghouse by report_id. Opinions located per document by '
        + 'scripts/verifyCoKsOpinions.py; FAC records `unmodified_opinion` on every filing.',
      figures: '⚠ Grand Forks COUNTY was flagged by the verifier as containing modified-opinion '
        + 'WORDS in FY2021 and REVIEWED BY HAND: every occurrence is "QUALIFIED ZONE ACADEMY '
        + 'BONDS", a US debt instrument created by the Taxpayer Relief Act of 1997, not an '
        + 'opinion. This is exactly the false positive the verifier reports rather than acts '
        + 'on. The opinion itself is unmodified. '
        + '⚠ The county changed auditor at FY2022 (ND Office of the State Auditor -> Brady '
        + 'Martz) and its MONEY FORMAT changed with it — the state-auditor era prints CENTS. '
        + 'That is an extraction fact, not an assurance one, and does not affect this grade. '
        + '⚠ City FY2025 is filed at FAC under `auditee_state = MN`; it is North Dakota, '
        + 'confirmed on its own cover page.',
    },
  },
  {
    // ⚠⚠ FOUR YEARS ARE ABSENT FROM THIS PATTERN ON PURPOSE: FY2017, FY2018,
    // FY2019 and FY2020 are NOT graded and stay `unknown`.
    //
    // LFUCG files a package titled "Single Audit Report in Accordance with
    // Uniform Guidance". It BUNDLES the complete governmental-funds statements
    // — which is why the data loads — but in those four years it contains NO
    // OPINION ON THE BASIC FINANCIAL STATEMENTS. Measured on FY2018: the phrase
    // "present fairly" appears ZERO times, and the only two "In our opinion"
    // paragraphs are the COMPLIANCE opinion on major federal programs and the
    // IN-RELATION-TO opinion on the Schedule of Expenditures of Federal Awards.
    // The financial-statement opinion lives in LFUCG's separate ACFR, which FAC
    // does not hold for those years.
    //
    // ⚠ This is the mirror of the lesson that the package's cover title must
    // not be used to reject its DATA. The title is wrong about the statements
    // and right about the opinion, and each has to be checked on its own.
    // Recovering those four grades means enumerating LFUCG's Google Drive
    // archive — a filed follow-up, not a guess.
    id: 's8-ky-lfucg-acfr-gf',
    match: /^Lexington-Fayette Urban County Government ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:2016|202[1-5]) actual, GAAP basis\)$/,
    value: AUDIT_GRADE.AUDITED_GAAP,
    evidence: {
      document: 'Kentucky\'s first local entity in TT, a consolidated city-county. FY2016 '
        + '(titled as the CAFR) and FY2021-FY2025, from the Federal Audit Clearinghouse by '
        + 'report_id, EIN 610858140.',
      figures: 'FY2016\'s opinion is IMAGE-ONLY and was recovered by OCR at 200dpi; FY2021-FY2025 '
        + 'are in the text layer. All six located by scripts/verifyCoKsOpinions.py, which pairs '
        + 'a fair-presentation phrase with a GAAP conformity phrase. FAC records '
        + '`unmodified_opinion` for every year. '
        + '⚠⚠ FY2017-FY2020 ARE DELIBERATELY UNGRADED — the documents contain no '
        + 'financial-statement opinion at all (see the comment above). Their DATA is loaded and '
        + 'ties at $0; only the grade is withheld, which is what §3.5 requires when evidence is '
        + 'absent. '
        + '⚠ FIVE SIBLING GOVERNMENTS share this name (transit authority, housing authority, '
        + 'health department, airport board, community action council) and the auditee name '
        + 'loses its hyphen at FY2022. EIN 610858140 is the government; the report_id is the '
        + 'join. '
        + '⚠ NOT Lexington County, SOUTH CAROLINA.',
    },
  },
  {
    id: 'sd-dla-county-ocboa',
    match: /^Brown County ACFR — General Fund (?:Expenditure by Function|Revenue by Source) \(FY(?:20[0-2][0-9]) actual, modified cash basis\)$/,
    value: AUDIT_GRADE.AUDITED_OCBOA,
    evidence: {
      document: 'The four loaded Brown County audit reports themselves (FY2016, FY2020, FY2023, '
        + 'FY2024), each bearing an independent auditor\'s report from the SOUTH DAKOTA '
        + 'DEPARTMENT OF LEGISLATIVE AUDIT issued under Government Auditing Standards. '
        + 'FY2016/FY2020/FY2023 were fetched from the Federal Audit Clearinghouse by report_id; '
        + 'FY2024 from SD DLA\'s own current-reports listing at '
        + 'legislativeaudit.sd.gov/reports/County/Brown%20County%202024.pdf.',
      figures: 'Every statement is titled "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN '
        + 'FUND BALANCES - MODIFIED CASH BASIS", and the auditor\'s report states verbatim: '
        + '"the financial statements are prepared on the modified cash basis of accounting, '
        + 'which is a basis of accounting other than accounting principles generally accepted '
        + 'in the United States of America". ⚠ CORROBORATED INDEPENDENTLY: FAC records '
        + '`gaap_results = not_gaap` on all three of its filings for EIN 466000011, so the '
        + 'grade does not rest on reading the PDF alone. '
        + '⚠ ASSURANCE IS NOT COMPARABILITY — these figures are audited, and they are NOT '
        + 'comparable line-for-line with the GAAP General Funds of the other six session-8 '
        + 'entities. That is the whole reason this value exists rather than reusing '
        + '`audited_gaap`. '
        + '⚠ All eight extractions (4 years x 2 modes) tie to the printed total at EXACTLY $0, '
        + 'verified in integer cents before conversion to dollars.',
    },
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
