/**
 * FAC report ids for the NY school districts reconciled against their own
 * audited ACFRs — spec §11.1's independent oracle.
 *
 * Source: the FAC bulk CSV, `general.csv`, snapshot 2026-09-03
 * (https://app.fac.gov/dissemination/public-data/gsa/full/general.csv —
 * no API key, no rate limit). The PDF endpoint
 * `https://app.fac.gov/dissemination/report/pdf/<report_id>` needs no key either,
 * so this route is unauthenticated end to end.
 *
 * ⚠⚠ SELECTED BY EIN, NEVER BY NAME. Two name traps bit this directly:
 *
 *   1. BUFFALO'S DISTRICT FILES AS "BOARD OF EDUCATION, CITY OF BUFFALO".
 *      A search for `buffalo.*school` returns SEVEN Buffalo charter schools and
 *      four out-of-state districts, and NOT the district itself — so the first
 *      pass concluded Buffalo does not file a Single Audit at all. It files all
 *      ten years, under EIN 166001554.
 *   2. FOUR DIFFERENT GOVERNMENTS ARE NAMED "CITY OF BUFFALO" (NY, MN, MO, TX).
 *
 *   The same district also spells itself three ways across ten years
 *   ("...,  NEW YORK" / bare / "..., NY"), which is why the name is a display
 *   field here and the EIN is the key.
 *
 * ⚠ `audit_year` maps 1:1 to TT's fiscal year for both districts: every filing
 * is a 06-30 year end, which `fy_end_date` confirms independently of the id.
 *
 * ⚠ FAC BEGINS AT AUDIT YEAR 2016. FY1995–FY2015 — nineteen of the thirty-one
 * loaded years — have NO audit route here and are not claimed as checked.
 */

/** Rochester City School District — OSC municipal code 260548000000. */
export const ROCHESTER_CSD = {
  municipalCode: '260548000000',
  auditeeEin: '166002010',
  auditeeName: 'Rochester City School District',
  reports: {
    2016: '2016-06-CENSUS-0000228272',
    2017: '2017-06-CENSUS-0000228272',
    2018: '2018-06-CENSUS-0000228272',
    2019: '2019-06-CENSUS-0000228272',
    2020: '2020-06-CENSUS-0000228272',
    2021: '2021-06-CENSUS-0000228272',
    2022: '2022-06-CENSUS-0000228272',
    2023: '2023-06-GSAFAC-0000008617',
    2024: '2024-06-GSAFAC-0000068238',
    2025: '2025-06-GSAFAC-0000392038',
  },
};

/**
 * Buffalo City School District — OSC municipal code 140507000000.
 *
 * ⚠ Files federally as the BOARD OF EDUCATION, and its own ACFR is titled
 * "(A Component Unit of the City of Buffalo, New York)". The City of Buffalo's
 * ACFR (EIN 166002533) presents the Board as a DISCRETELY PRESENTED component
 * unit, which appears only in the government-wide statements — so the city's
 * document carries no General Fund column for the district and cannot be used
 * as a substitute oracle.
 */
export const BUFFALO_BOE = {
  municipalCode: '140507000000',
  auditeeEin: '166001554',
  auditeeName: 'Board of Education, City of Buffalo, New York',
  reports: {
    2016: '2016-06-CENSUS-0000180960',
    2017: '2017-06-CENSUS-0000180960',
    2018: '2018-06-CENSUS-0000180960',
    2019: '2019-06-CENSUS-0000180960',
    2020: '2020-06-CENSUS-0000180960',
    2021: '2021-06-CENSUS-0000180960',
    2022: '2022-06-CENSUS-0000180960',
    2023: '2023-06-GSAFAC-0000007611',
    2024: '2024-06-GSAFAC-0000062850',
    2025: '2025-06-GSAFAC-0000385991',
  },
};

export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf';
export const FAC_FIRST_AUDIT_YEAR = 2016;

export const NY_SCHOOL_FAC_DISTRICTS = [ROCHESTER_CSD, BUFFALO_BOE];
