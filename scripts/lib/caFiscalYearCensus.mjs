/**
 * The California view of the FAC fiscal-calendar census, plus the CA-specific
 * facts that have no home in the generic module.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * The mechanics — parsing, month inference, changeover detection — live in
 * `scripts/lib/facFiscalYearCensus.mjs` and are shared with Texas and Maryland.
 * What is California's alone lives here.
 *
 * ⚠⚠ THE CHARTER-CITY SCOPE WAS WRONG, AND THIS CENSUS IS WHAT PROVED IT. The
 * audit was scoped to the 121 CA charter cities on the reasoning that only a
 * charter city may set its own fiscal year. Of the five municipalities running a
 * non-July calendar, TWO ARE GENERAL-LAW CITIES — South Lake Tahoe (October
 * throughout) and El Segundo (October through FY2021). Neither would ever have
 * been examined. Do not re-scope a California fiscal-calendar question to
 * charter cities.
 *
 * ⚠ CA COUNTIES ARE NOT CENSUSED, on purpose: Cal. Gov. Code § 29001(e),
 * "'Budget year' means the fiscal year (July 1 through June 30)", settles them
 * by statute, and that citation already lives in `loaderFiscalCalendars.mjs`.
 */

import {
  STATES, WINDOW as FAC_WINDOW, readEvidence as facReadEvidence, buildCensus as facBuildCensus,
  exceptions as facExceptions, changeoverYears, censusMonthFor,
} from './facFiscalYearCensus.mjs';

export { changeoverYears };

/** The committed FAC extract this census is derived from. */
export const EVIDENCE_CSV = STATES.CA.csv;

/** The audit years the extract covers. A finding outside this range is unproven. */
export const WINDOW = FAC_WINDOW;

/**
 * Measured when the census was built. A refreshed extract that moves these is
 * not a silent improvement — it means the federal record changed and the
 * non-July set must be re-read.
 */
export const BASELINE = { ...STATES.CA.baseline, nonJulyCities: STATES.CA.baseline.exceptions };

export const readEvidence = () => facReadEvidence('CA');
export const buildCensus = (records) => facBuildCensus('CA', records);
export const nonJulyCities = (census) => facExceptions('CA', census);
export const monthForCityInCensus = (city, fiscalYear) => censusMonthFor('CA', city, fiscalYear);

/**
 * The one charter city with no evidence of any kind.
 *
 * ⚠ It sits at month 7 in the database and is LEFT there — moving an unevidenced
 * row is exactly the failure this arc exists to prevent. It is named so the gap
 * stays visible.
 */
export const UNEVIDENCED = [
  {
    name: 'Sand City', state: 'CA', charter: true, storedMonth: 7,
    why: 'Files no Single Audit (population ~350, far below the $750k federal '
      + 'threshold); publishes no audited financial statements online; '
      + 'codepublishing.com and municipal.codes both refuse automated fetches. '
      + 'Its own FY 24-25 budget uses split-year labelling and reports balances '
      + '"as of June 30, 2024", which SUGGESTS July–June but does not state it.',
  },
];
