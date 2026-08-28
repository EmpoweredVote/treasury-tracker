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
