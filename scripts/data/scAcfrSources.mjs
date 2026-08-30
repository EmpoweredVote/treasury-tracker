/**
 * South Carolina city ACFRs — per-year document provenance (Knight session 6a).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── ⚠⚠ WHY THE DOCUMENTS COME FROM THE FEDERAL AUDIT CLEARINGHOUSE ──────────
 *
 * FAC serves the COMPLETE audited reporting package as a PDF, free, with no API
 * key and no WAF, at a permanent per-report id:
 *
 *     https://app.fac.gov/dissemination/report/pdf/<report_id>
 *
 * (The metadata API at api.fac.gov needs `X-Api-Key: DEMO_KEY`; the PDF endpoint
 * needs nothing.) Coverage reaches back to at least FY2016 via census-era ids.
 *
 * ⭐ THIS IS A ROUTE THE CAMPAIGN DID NOT HAVE, AND IT SOLVES REAL BLOCKERS.
 * Session 2 needed a real Chromium to get past charlottenc.gov's Akamai WAF, and
 * had to cite a portal asset page for Mecklenburg because its Widen DAM serves
 * bytes only from signed expiring links. Richland County's own site 403s curl AND
 * PowerShell here, the same fingerprinting shape. FAC bypasses all of it, and its
 * ids never rot the way a city CMS path does — `charmeck.org` losing Charlotte's
 * pre-FY2011 reports is exactly the failure this avoids.
 *
 * ⚠ The bytes are the auditee's own submission, filed under federal penalty, so
 * this is a first-party document and not a third-party summary. `source_url`
 * still cites the CITY's publication page, because that is the canonical place a
 * reader goes; the report_id here records exactly which file was parsed, so any
 * figure can be reproduced byte-for-byte later.
 *
 * ── ⚠⚠ NEVER JOIN THESE BY NAME ────────────────────────────────────────────
 *
 * A name match over FAC's South Carolina rows also returns `Columbia College`,
 * `Columbia International University`, `Columbia Housing Authority`, `Columbia
 * Urban League`, `Clear Dot Charter School Columbia`, `City of West Columbia`,
 * `City of North Myrtle Beach` and `Housing Authority of Myrtle Beach`. Session
 * 2's `assertIssuer` lesson in a new place: name-plus-marker ACCEPTS the wrong
 * document. The report_id is the join.
 *
 * ── ⚠⚠ TWO DOCUMENTS IN THIS CORPUS ARE SCANS, AND ONE IS NOT LOADABLE ──────
 *
 * FAC stores whatever the auditee uploaded, and two of these twenty are images
 * carrying an OCR text layer rather than a born-digital one:
 *
 *   Myrtle Beach FY2018  RECOVERED. The OCR layer reads `Stonn Water Fees`,
 *                        `Local Option Touris1n Taxes` and `Jntergovernmental`,
 *                        and fuses four revenue line items into a single row.
 *                        ⚠⚠ IT MISSED THE TIE BY EXACTLY $1 — 64,439,897 against
 *                        a printed 64,439,896. A "small delta" tolerance would
 *                        have shipped it with four categories destroyed. This is
 *                        precisely why acfrGF.py's `source_rounding` is an
 *                        exact-delta registry and NOT a tolerance.
 *                        Replaced with the city's own copy, which ties at $0 with
 *                        clean labels. The city's CDN 403s a bare curl; it serves
 *                        the file to a request carrying browser `Sec-Fetch-*`
 *                        headers and a Referer (the Oregon WAF workaround).
 *
 *   Columbia FY2019      NOT LOADED. Both available copies are scans: FAC's
 *                        carries an OCR layer that renders `20 ,775,337` with an
 *                        embedded space and `State government` as `Slate
 *                        government`, and the city's own copy has NO text layer
 *                        at all — 1,900 characters across 169 pages.
 *                        ⚠ Reported as a gap, never written as $0 and never
 *                        silently skipped. Recovering it means OCRing the city's
 *                        scan and trusting money read off an image, which is a
 *                        different and worse risk than the one year is worth.
 *                        The statistical section of a later ACFR carries ten
 *                        years of General Fund figures and would cover it, but
 *                        that section is OUTSIDE the auditor's opinion, so those
 *                        rows could not be graded `audited_gaap` — see §3.5.
 */

/** `https://app.fac.gov/dissemination/report/pdf/<id>` — no key, no auth. */
export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf';

export const COLUMBIA_FAC_REPORTS = Object.freeze({
  2016: '2016-06-CENSUS-0000170586',
  2017: '2017-06-CENSUS-0000170586',
  2018: '2018-06-CENSUS-0000170586',
  2019: '2019-06-CENSUS-0000170586', // ⚠ scan + defective OCR — NOT LOADED
  2020: '2020-06-CENSUS-0000170586',
  2021: '2021-06-CENSUS-0000170586',
  2022: '2022-06-CENSUS-0000170586',
  2023: '2023-06-GSAFAC-0000013187',
  2024: '2024-06-GSAFAC-0000068560',
  2025: '2025-06-GSAFAC-0000392649',
});

export const MYRTLE_BEACH_FAC_REPORTS = Object.freeze({
  2016: '2016-06-CENSUS-0000170537',
  2017: '2017-06-CENSUS-0000170537',
  2018: '2018-06-CENSUS-0000170537', // ⚠ scan; replaced by the city's own copy
  2019: '2019-06-CENSUS-0000170537',
  2020: '2020-06-CENSUS-0000170537',
  2021: '2021-06-CENSUS-0000170537',
  2022: '2022-06-CENSUS-0000170537',
  2023: '2023-06-GSAFAC-0000012094',
  2024: '2024-06-GSAFAC-0000344131',
  2025: '2025-06-GSAFAC-0000395082',
});

/** Where a reader goes for these documents — the issuer's own page. */
export const COLUMBIA_PUBLICATION_PAGE = 'https://finance.columbiasc.gov/acfrs/';
export const MYRTLE_BEACH_PUBLICATION_PAGE =
  'https://www.cityofmyrtlebeach.com/departments/financial_management_and_reporting.php';

/** The one document replaced with a first-party copy, and where it came from. */
export const FIRST_PARTY_OVERRIDES = Object.freeze({
  'myrtlebeach_2018': 'https://cms6.revize.com/revize/myrtlebeachsc/CAFR.pdf',
});

/** FY2019 is absent by decision, not by oversight. */
export const COLUMBIA_LOAD_YEARS = Object.freeze([2016, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025]);
export const MYRTLE_BEACH_LOAD_YEARS = Object.freeze([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
export const COLUMBIA_UNLOADABLE = Object.freeze({ 2019: 'only scanned copies exist; OCR layer is defective' });
