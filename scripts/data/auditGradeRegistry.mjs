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
