// NO SHEBANG — see scripts/lib/nyOsc.mjs.
/**
 * NY fund letter -> fund type, from OSC's Accounting and Reporting Manual
 * chapter 4, "Funds and Supplemental Schedules".
 *
 * ⚠⚠ EVERY ENTRY IS READ FROM THE ARM, never inferred from what the fund
 * spends on. `docs/NY/osc-accounting-and-reporting-manual-2021.pdf` is the
 * evidence of record; delete it and none of these claims has a basis.
 *
 * ⚠ Prefixes the ARM defines for TOWNS and COUNTIES only -- B, D/DA/DB/DM, CN
 * and the S_ special-district family -- are deliberately ABSENT. They do not
 * occur anywhere in the city archive. If one appears, the file changed, and
 * classifyPrefix() returning null is the alarm.
 *
 * ⚠⚠ `CS` IS DELIBERATELY ABSENT, and the obvious fix has already been tried
 * and disproved. Do not add it without new evidence. What is known:
 *
 *   - It appears FY1995-FY2000 ONLY, in 28 cities, then stops dead.
 *   - Its content looks like self-insurance: Judgements, Compensation for
 *     Loss, Medical Insurance, Worker's Compensation, Unemployment Insurance.
 *   - The 2021 Chart of Accounts has 120 `MS` codes and ZERO `CS` codes.
 *
 * That suggests CS was renamed to MS (Self-Insurance) in FY2001, which would
 * make it proprietary and excluded. ⚠ TESTED AND FALSE: only 7 of the 18
 * cities carrying CS in FY2000 have MS in FY2001, and City of Oswego carried
 * BOTH in FY2000 with different content (CS = judgements/operations/admin;
 * MS = medical insurance/transfers). They are distinct funds.
 *
 * What remains is inference -- either "C_ means Miscellaneous Funds, therefore
 * special revenue, therefore governmental" or "the content is self-insurance,
 * therefore proprietary". The registry does not accept inference: an entry is
 * created when its evidence is. So CS stays out, and the 231 affected
 * total_governmental cells (7.01% of FY1995-2021, all in FY1995-2000) publish
 * `unknown` rather than a total that is silently short or silently inflated.
 * general_fund is unaffected -- those cities keep full GF coverage.
 *
 * See spec §5.4.
 */

const ARM = 'OSC Accounting and Reporting Manual ch. 4, Funds and Supplemental Schedules';

export const NY_FUND_PREFIXES = Object.freeze({
  // ── Governmental ────────────────────────────────────────────────────────
  A: {
    type: 'general',
    name: 'General Fund',
    citation: `${ARM}: "General Fund (A) — the principal operating fund of a local government."`,
  },

  CB: {
    type: 'special_revenue',
    name: 'Housing Authority',
    citation: `${ARM}: "Miscellaneous Funds (C_) include Housing Authority (CB)…"`,
  },
  CD: {
    type: 'special_revenue',
    name: 'Special Grant',
    citation: `${ARM}: "Special Grant Fund (CD) — accounts for federal and State grants such as Community Development Block Grants…"`,
  },
  CL: {
    type: 'special_revenue',
    name: 'Refuse and Garbage',
    citation: `${ARM}: "Miscellaneous Funds (C_) include … Refuse and Garbage (CL)"`,
  },
  CM: {
    type: 'special_revenue',
    name: 'Miscellaneous',
    citation: `${ARM}: "Miscellaneous Funds (C_) include … Miscellaneous (CM)"`,
  },
  CP: {
    type: 'special_revenue',
    name: 'Parking',
    citation: `${ARM}: "Miscellaneous Funds (C_) include … Parking (CP)"`,
  },
  CR: {
    type: 'special_revenue',
    name: 'Recreation',
    citation: `${ARM}: "Miscellaneous Funds (C_) include … Recreation (CR)"`,
  },
  CT: {
    type: 'special_revenue',
    name: 'Transportation',
    citation: `${ARM}: "Miscellaneous Funds (C_) include … Transportation (CT)"`,
  },
  CU: {
    type: 'special_revenue',
    name: 'Urban Renewal',
    citation: `${ARM}: "Miscellaneous Funds (C_) include … Urban Renewal (CU)"`,
  },
  FX: {
    type: 'special_revenue',
    name: 'Water',
    citation: `${ARM}: water fund, listed under Special Revenue Funds — "a city or village water fund"; "Water operations may also be accounted for using an enterprise fund."`,
  },
  G: {
    type: 'special_revenue',
    name: 'Sewer',
    citation: `${ARM}: sewer fund, listed under Special Revenue Funds — "town special districts, and sewer funds) should be reported as special revenue funds"; "Sewer operations may also be accounted for using an enterprise fund."`,
  },
  L: {
    type: 'special_revenue',
    name: 'Library',
    citation: `${ARM}: library fund, Education Law §259 — "all moneys received from taxes or other public sources for library purposes shall be kept in a separate fund."`,
  },

  H: {
    type: 'capital_projects',
    name: 'Capital Projects',
    citation: `${ARM}: "the capital projects fund (H)"; "A capital projects fund must be used if the acquisition or construction is financed in whole or in part from the proceeds of obligations."`,
  },
  V: {
    type: 'debt_service',
    name: 'Debt Service',
    citation: `${ARM}: "A single debt service fund will be maintained to account for and report the payment of long-term debt."`,
  },
  PN: {
    type: 'permanent',
    name: 'Permanent',
    citation: `${ARM}: "only earnings, not principal, may be used for purposes that benefit the local government or its residents. For example, a library fund or a cemetery fund."`,
  },

  // ── Proprietary — EXCLUDED from total_governmental ───────────────────────
  EA: {
    type: 'enterprise',
    name: 'Airports',
    citation: `${ARM}: "Enterprise Funds (E_) include Airports (EA), Electric Utilities (EE)…"`,
  },
  EE: {
    type: 'enterprise',
    name: 'Electric Utilities',
    citation: `${ARM}: "Enterprise Funds (E_) include Airports (EA), Electric Utilities (EE)…"`,
  },
  EF: {
    type: 'enterprise',
    name: 'Health Related Facilities',
    citation: `${ARM}: "Enterprise Funds (E_) include … Health Related Facilities (EF)"`,
  },
  EH: {
    type: 'enterprise',
    name: 'Hospitals',
    citation: `${ARM}: "Enterprise Funds (E_) include … Hospitals (EH)"`,
  },
  EI: {
    type: 'enterprise',
    name: 'Infirmaries',
    citation: `${ARM}: "Enterprise Funds (E_) include … Infirmaries (EI)"`,
  },
  EL: {
    type: 'enterprise',
    name: 'Refuse and Garbage',
    citation: `${ARM}: "Enterprise Funds (E_) include … Refuse and Garbage (EL)"`,
  },
  EM: {
    type: 'enterprise',
    name: 'Miscellaneous',
    citation: `${ARM}: "Enterprise Funds (E_) include … Miscellaneous (EM)"`,
  },
  EP: {
    type: 'enterprise',
    name: 'Parking',
    citation: `${ARM}: "Enterprise Funds (E_) include … Parking (EP)"`,
  },
  ER: {
    type: 'enterprise',
    name: 'Recreation',
    citation: `${ARM}: "Enterprise Funds (E_) include … Recreation (ER)"`,
  },
  ES: {
    type: 'enterprise',
    name: 'Sewer',
    citation: `${ARM}: "Enterprise Funds (E_)…"; "Sewer operations may also be accounted for using an enterprise fund."`,
  },
  ET: {
    type: 'enterprise',
    name: 'Transportation',
    citation: `${ARM}: "Enterprise Funds (E_) include … Transportation (ET)"`,
  },
  EW: {
    type: 'enterprise',
    name: 'Water',
    citation: `${ARM}: "Enterprise Funds (E_)…"; "Water operations may also be accounted for using an enterprise fund."`,
  },

  M: {
    type: 'internal_service',
    name: 'Internal Service',
    citation: `${ARM}: internal service fund — "revenues of the internal service fund and as expenditures/expenses of the reimbursing or insured fund"; "In lieu of this fund, an internal service fund (M) may be used for machinery."`,
  },
  MS: {
    type: 'internal_service',
    name: 'Self-Insurance',
    citation: 'OSC Accounting and Reporting Manual ch. 2, Types of Funds: "Self-Insurance funds '
      + 'account for insurance coverage when the governing body has decided to have a self-insurance '
      + 'program on an actuarial basis." Printed inside the "Proprietary funds account for a '
      + 'government\'s ongoing activities that are similar to those found in the private sector" '
      + 'block, between Internal service funds and Fiduciary funds. Corroborated in the data: MS rows '
      + 'report Net Position, not fund balance.',
  },

  // ── Fiduciary — EXCLUDED ─────────────────────────────────────────────────
  TA: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM}: "Fiduciary funds are provided to account for moneys received by the local government which must be held…"`,
  },
  TC: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM}: Fiduciary Funds — "moneys received by the local government which must be held…"`,
  },
  TE: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM}: Fiduciary Funds — "moneys received by the local government which must be held…"`,
  },
  TN: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM}: Fiduciary Funds — "moneys received by the local government which must be held…"`,
  },
  TX: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM}: Fiduciary Funds — "moneys received by the local government which must be held…"`,
  },

  // ── Not funds at all — EXCLUDED ──────────────────────────────────────────
  K: {
    type: 'schedule',
    name: 'Schedule of Non-Current Governmental Assets',
    citation: `${ARM}: "be accounted for and reported in the Schedule of Non-Current Governmental Assets."`,
  },
  W: {
    type: 'schedule',
    name: 'Schedule of Non-Current Governmental Liabilities',
    citation: `${ARM}: "reported in the Schedule of Non-Current Governmental Liabilities."`,
  },
});

/** The fund types that make up `total_governmental`. */
export const GOVERNMENTAL_TYPES = Object.freeze(new Set([
  'general', 'special_revenue', 'capital_projects', 'debt_service', 'permanent',
]));
