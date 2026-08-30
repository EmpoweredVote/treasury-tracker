/**
 * Colorado + Kansas ACFRs — per-year document provenance (Knight session 7b).
 *
 * NO SHEBANG — tests import this module.
 *
 * Four entities, and THREE DIFFERENT ACCESS ROUTES, because each publisher is
 * different. Recon 2026-08-30; every route below was proved by a real fetch.
 *
 *   Wichita          own site, ArchiveCenter/ViewFile/Item/<ADID>   FY2000-2025
 *   Sedgwick County  own site, /media/<id>/<slug>.pdf               FY2005-2024
 *   Boulder County   own site, assets.bouldercounty.gov             FY2021-2025
 *   Boulder city     FEDERAL AUDIT CLEARINGHOUSE by report_id       FY2016-2024
 *
 * ── ⚠⚠ WHY BOULDER CITY COMES FROM FAC ─────────────────────────────────────
 *
 * bouldercolorado.gov publishes only the two most recent ACFRs directly; every
 * earlier year sits in a Laserfiche WebLink archive that REQUIRES COOKIES
 * ("Cookies must be enabled in order to sign in to WebLink") and whose
 * DocView/DocDownload/Electronic.aspx shapes all fail to a plain client. That is
 * the Colorado DOLA trap in miniature. FAC serves the complete audited package
 * as a PDF, free, with no key and no WAF:
 *
 *     https://app.fac.gov/dissemination/report/pdf/<report_id>
 *
 * ⚠ The bytes are the auditee's OWN submission, filed under federal penalty, so
 * this is a first-party document. `source_url` still cites the city's own
 * publication page, because that is where a reader goes; the report_id records
 * exactly which file was parsed so any figure can be reproduced later.
 *
 * ── ⚠⚠ NEVER JOIN BY NAME — FAC'S CO/KS ROWS ARE FULL OF NEAR-MISSES ───────
 *
 * A name query over FAC returns, for these three strings alone: Boulder
 * Community Health, Boulder Housing Partners, Boulder County Housing Authority,
 * Boulder Valley School District, Boulder Shelter for the Homeless, Mental
 * Health Center of Boulder County, Wichita State University, Wichita Public
 * Schools USD 259, The Wichita Children's Home, Wichita Family Crisis Center,
 * Sedgwick County Zoological Society, and USD 265 Sedgwick County. Session 2's
 * `assertIssuer` lesson: name-plus-marker ACCEPTS the wrong document.
 *
 * ⚠⚠ AND THE AUDITEE NAME IS NOT STABLE ACROSS YEARS. The same government files
 * under three different renderings:
 *     BOULDER COUNTY, COLORADO / Boulder County / County of Boulder
 *     SEDGWICK COUNTY / SEDGWICK COUNTY, KS / Sedgwick County, KS
 *     CITY OF BOULDER / City of Boulder
 * The EIN is the stable key; the report_id is the join.
 *
 * ── ⚠⚠ WICHITA'S ADIDs ARE NOT ORDERED BY YEAR ─────────────────────────────
 *
 * Read from the archive listing, never rebuilt from the year. FY2018 is ADID 56
 * while FY2017 is ADID 57, and FY2016 is 54 while FY2015 is 55 — two adjacent
 * INVERSIONS. Deriving an id from a year would silently swap two fiscal years
 * and every downstream tie would still pass, because each document is internally
 * consistent. The same hazard as Michigan's non-derivable Socrata dataset ids
 * and Nashville's three URL naming conventions.
 * ⚠ Every mapping below is VERIFIED against the fiscal year printed on the
 * document's own cover page after fetching — see scripts/verifyCoKsAcfrYears.mjs.
 *
 * ── ⚠ WICHITA FY2000-FY2003 PREDATE GASB 34 ────────────────────────────────
 *
 * GASB 34 phased in for governments of Wichita's size around FY2002. The General
 * Fund statement of revenues, expenditures and changes in fund balance is a
 * GOVERNMENTAL FUNDS statement and exists on both sides of that boundary, but
 * the surrounding presentation differs and the pre-34 reports are titled
 * "Comprehensive Annual Financial Report" with a different statement ordering.
 * Treated as a distinct extraction regime, never assumed to parse like FY2004+.
 */

/** ⚠ Read from the publisher's own archive listing, NOT derived from the year. */
export const WICHITA_ADID = Object.freeze({
  2000: 96, 2001: 95, 2002: 98, 2003: 99, 2004: 100, 2005: 102, 2006: 101,
  2007: 103, 2008: 97, 2009: 47, 2010: 48, 2011: 52, 2012: 51, 2013: 50,
  2014: 53, 2015: 55, 2016: 54, 2017: 57, 2018: 56, 2019: 58, 2020: 59,
  2021: 60, 2022: 11346, 2023: 10513, 2024: 12761, 2025: 15281,
});

/** Sedgwick County's own media library. Paths are opaque; read from the listing. */
export const SEDGWICK_MEDIA = Object.freeze({
  2005: '28020/2005_cafr.pdf',
  2006: '28019/2006-sedgwick-county-cafr.pdf',
  2007: '28018/2007-sedgwick-county-cafr.pdf',
  2008: '28017/2008-sedgwick-county-cafr.pdf',
  2009: '28016/2009-sedgwick-county-cafr.pdf',
  2010: '28015/2010-sedgwick-county-cafr.pdf',
  2011: '28014/2011-sedgwick-county-cafr.pdf',
  2012: '28013/2012-sedgwick-county-cafr.pdf',
  2013: '28012/2013_cafr.pdf',
  2014: '28022/2014_cafr.pdf',
  2015: '28021/2015_cafr.pdf',
  2016: '30096/cafr.pdf',
  2017: '39501/2017-cafr.pdf',
  2018: '55286/cafr.pdf',
  2019: '57160/2019-final-cafr.pdf',
  2020: '59306/2020-audited-financials.pdf',
  2021: '61884/2021-acfr-final-bookmarked.pdf',
  2022: '64435/final-acfr-2022-bookmarked-updated-71123.pdf',
  2023: '66655/2023-acfr-as-of-6324-bookmarked.pdf',
  2024: '69438/sedgwick-county-2024-acfr-final-as-of-62725.pdf',
});

/** Boulder County publishes direct PDFs under a dated upload path. */
export const BOULDER_COUNTY_URL = Object.freeze({
  2021: 'https://assets.bouldercounty.gov/wp-content/uploads/2023/01/annual-comprehensive-financial-report-2021-final.pdf',
  2022: 'https://assets.bouldercounty.gov/wp-content/uploads/2023/08/annual-comprehensive-financial-report-2022.pdf',
  2023: 'https://assets.bouldercounty.gov/wp-content/uploads/2024/08/annual-comprehensive-financial-report-2023.pdf',
  2024: 'https://assets.bouldercounty.gov/wp-content/uploads/2025/07/annual-comprehensive-financial-report-2024.pdf',
  2025: 'https://assets.bouldercounty.gov/wp-content/uploads/2026/06/annual-comprehensive-financial-report-2025.pdf',
});

/**
 * Boulder city — FAC report ids. EIN 846000566.
 * ⚠ FY2016-2019 use the census-era id shape `<FY>-12-CENSUS-0000134815`;
 * later years use the GSAFAC shape and are NOT derivable. Filled in by recon.
 */
export const BOULDER_CITY_FAC = Object.freeze({
  2016: '2016-12-CENSUS-0000134815',
  2017: '2017-12-CENSUS-0000134815',
  2018: '2018-12-CENSUS-0000134815',
  2019: '2019-12-CENSUS-0000134815',
  2020: '2020-12-CENSUS-0000134815',
  2021: '2021-12-CENSUS-0000134815',
  2022: '2022-12-CENSUS-0000134815',
  // ⚠ FY2023 and FY2024 are NOT here. The census-era id shape 404s from FY2023
  // (FAC migrated to GSAFAC ids), and the city's own Laserfiche archive is
  // unreachable to a plain client — documents.bouldercolorado.gov serves an
  // INCOMPLETE TLS CHAIN (curl exit 60, the Ohio AOS shape; PowerShell reaches
  // it but the page is a JS viewer shell with no document link). Recorded as a
  // GAP rather than guessed. ⚠ The FY2020-2022 ids above were confirmed the
  // same way every id here is: by fetching the PDF and reading the fiscal year
  // off its own cover page, never by trusting the pattern.
});

export const WICHITA_BASE = 'https://www.wichita.gov/ArchiveCenter/ViewFile/Item/';
export const SEDGWICK_BASE = 'https://www.sedgwickcounty.org/media/';
export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf/';

/** The reader-facing publication page for each entity — used as `source_url`. */
export const SOURCE_PAGE = Object.freeze({
  'boulder': 'https://bouldercolorado.gov/annual-comprehensive-financial-report-popular-annual-financial-report',
  'boulder-county': 'https://bouldercounty.gov/government/budget-and-finance/financial-reports/certified-annual-financial-report/',
  'wichita': 'https://www.wichita.gov/Archive.aspx?AMID=36',
  'sedgwick-county': 'https://www.sedgwickcounty.org/finance/financial-reports/comprehensive-annual-financial-reports/',
});

/** Resolve the fetch URL for one entity-year. */
export function documentUrlFor(entityKey, fiscalYear) {
  const fy = Number(fiscalYear);
  switch (entityKey) {
    case 'wichita': {
      const adid = WICHITA_ADID[fy];
      return adid ? `${WICHITA_BASE}${adid}` : null;
    }
    case 'sedgwick-county': {
      const path = SEDGWICK_MEDIA[fy];
      return path ? `${SEDGWICK_BASE}${path}` : null;
    }
    case 'boulder-county':
      return BOULDER_COUNTY_URL[fy] ?? null;
    case 'boulder': {
      const rid = BOULDER_CITY_FAC[fy];
      return rid ? `${FAC_PDF_BASE}${rid}` : null;
    }
    default:
      return null;
  }
}

/** Every entity-year this session intends to load. */
export const CO_KS_WINDOWS = Object.freeze({
  'boulder': Object.freeze(Object.keys(BOULDER_CITY_FAC).map(Number).sort()),
  'boulder-county': Object.freeze(Object.keys(BOULDER_COUNTY_URL).map(Number).sort()),
  'wichita': Object.freeze(Object.keys(WICHITA_ADID).map(Number).sort()),
  'sedgwick-county': Object.freeze(Object.keys(SEDGWICK_MEDIA).map(Number).sort()),
});
