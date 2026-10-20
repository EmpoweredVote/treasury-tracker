// NO SHEBANG — tests import this module.
/**
 * FAC report ids for the New York COUNTIES reconciled against their own
 * audited ACFRs — the independent oracle of
 * docs/superpowers/specs/2026-10-19-ny-towns-villages-counties-design.md §11.1,
 * and the county analogue of #272's school-district reconciliation.
 *
 * Source: the FAC bulk CSV `general.csv`, snapshot 2026-09-03
 * (https://app.fac.gov/dissemination/public-data/gsa/full/general.csv — no API
 * key, no rate limit). The PDF endpoint
 * https://app.fac.gov/dissemination/report/pdf/<report_id> needs no key either,
 * so this route is unauthenticated end to end.
 *
 * ⚠⚠ SELECTED BY EIN, NEVER BY NAME — the same rule the districts pass learned
 * the hard way, and New York's counties re-prove it:
 *
 *   - 322 NY auditees have "COUNTY" in their name and only 90 look like a
 *     government at all. The rest are BOCES, Cornell Cooperative Extension
 *     associations, Industrial Development Agencies and nonprofits
 *     ("CHILD AND FAMILY SERVICES OF ERIE COUNTY").
 *   - ONE government files under TWO name forms: `COUNTY OF FULTON` and
 *     `COUNTY OF FULTON NEW YORK` are both EIN 146002626, and
 *     `CHENANGO COUNTY` / `COUNTY OF CHENANGO` are both EIN 156000451.
 *   - An EIN is NOT sufficient on its own either: a county and its Industrial
 *     Development Agency can share one, so the name must still match a
 *     government form.
 *
 * ⚠ A duplicate (EIN, audit_year) is a RESUBMISSION, not two audits. Albany
 * FY2023 carries 2023-12-GSAFAC-0000057283 and 2023-12-GSAFAC-0000344591; the
 * later id supersedes and is the one kept.
 *
 * ⚠ Every filing here is a 12-31 year end, which `fy_end_date` confirms
 * independently of the id — matching the month-1 fiscal calendar TT loaded for
 * all 57 counties.
 *
 * ⚠⚠ FAC BEGINS AT AUDIT YEAR 2016. TT loads FY1995-FY2025, so TWENTY-ONE of
 * the thirty-one loaded years have NO audit route here and are not claimed as
 * checked. A county is also only here if it EXPENDED $750k of federal awards
 * that year — 33 of New York's 57 counties never appear at all.
 *
 * ⚠ GENERATED. Four counties spanning the size range, so a discrepancy can be
 * told apart from a scale effect.
 */
export const NY_COUNTY_FAC_REPORTS = Object.freeze([
  {
    municipalCode: "010100000000",
    auditeeEin: "146002563",
    auditeeName: "County of Albany",
    displayName: "Albany",
    reports: {
      2016: "2016-12-CENSUS-0000158354",
      2017: "2017-12-CENSUS-0000158354",
      2018: "2018-12-CENSUS-0000158354",
      2019: "2019-12-CENSUS-0000158354",
      2020: "2020-12-CENSUS-0000158354",
      2021: "2021-12-CENSUS-0000158354",
      2022: "2022-12-CENSUS-0000158354",
      2023: "2023-12-GSAFAC-0000344591",
      2024: "2024-12-GSAFAC-0000379661"
    },
  },
  {
    municipalCode: "330100000000",
    auditeeEin: "146002567",
    auditeeName: "County of Orange",
    displayName: "Orange",
    reports: {
      2016: "2016-12-CENSUS-0000158391",
      2017: "2017-12-CENSUS-0000158391",
      2018: "2018-12-CENSUS-0000158391",
      2019: "2019-12-CENSUS-0000158391",
      2020: "2020-12-CENSUS-0000158391",
      2021: "2021-12-CENSUS-0000158391",
      2022: "2022-12-CENSUS-0000158391",
      2023: "2023-12-GSAFAC-0000058463",
      2024: "2024-12-GSAFAC-0000381170"
    },
  },
  {
    municipalCode: "500100000000",
    auditeeEin: "156000469",
    auditeeName: "County of Tompkins",
    displayName: "Tompkins",
    reports: {
      2016: "2016-12-CENSUS-0000158411",
      2017: "2017-12-CENSUS-0000158411",
      2018: "2018-12-CENSUS-0000158411",
      2019: "2019-12-CENSUS-0000158411",
      2020: "2020-12-CENSUS-0000158411",
      2021: "2021-12-CENSUS-0000158411",
      2022: "2022-12-CENSUS-0000158411",
      2023: "2023-12-GSAFAC-0000054931",
      2024: "2024-12-GSAFAC-0000380960"
    },
  },
  {
    municipalCode: "440100000000",
    auditeeEin: "156000466",
    auditeeName: "County of Schuyler",
    displayName: "Schuyler",
    reports: {
      2016: "2016-12-CENSUS-0000188477",
      2017: "2017-12-CENSUS-0000188477",
      2018: "2018-12-CENSUS-0000188477",
      2019: "2019-12-CENSUS-0000188477",
      2020: "2020-12-CENSUS-0000188477",
      2021: "2021-12-CENSUS-0000188477",
      2022: "2022-12-CENSUS-0000188477",
      2023: "2023-12-GSAFAC-0000050477",
      2024: "2024-12-GSAFAC-0000377424"
    },
  },
]);

export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf';
