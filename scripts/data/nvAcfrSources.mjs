/**
 * Nevada ACFR sources — every URL PROVED LIVE AND FIRST-PARTY on 2026-11-11.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⛔⛔ RENO'S OLD DOCUMENT ESTATE IS 404, AND SEARCH ENGINES STILL SERVE IT.
 *
 * The city migrated from CivicPlus to Revize in 2026. Every
 * `reno.gov/home/showpublisheddocument/<id>/<ticks>` URL — the shape a web
 * search still returns for Reno's ACFRs, and the shape used by Fremont,
 * Richardson, Cornelius and San Jose elsewhere in this repo — now answers
 * 404. Five were tested, five dead:
 *
 *     /home/showpublisheddocument/91519/638381646997030000   404
 *     /home/showpublisheddocument/91664/638417843594370000   404
 *     /home/showpublisheddocument/95342/639056480426000000   404
 *     /home/showpublisheddocument/85839/637499434841300000   404
 *     /home/showdocument?id=66129                            404
 *
 * ⭐ Citing from search results would have shipped nine dead links — the exact
 * defect `verify:source-urls` exists to catch, pre-made. Every URL below was
 * fetched and checked for `200 application/pdf` before being written here.
 *
 * ⚠ The live scheme carries a `?t=<timestamp>` cache-buster on the page, and
 * the URLs resolve WITHOUT it. The stable form is stored.
 *
 * ── WASHOE'S ARCHIVE IS DELINKED, NOT GONE ─────────────────────────────────
 *
 * The county's ACFR index lists only FY2024 and FY2025, but the per-year
 * directories answer 403 (exists, listing forbidden) for FY2019-FY2025 and
 * 404 (absent) for FY2015-FY2018. The older files are live and simply
 * unlinked — the City of Asheville pattern.
 *
 * ⚠⚠ FY2021 IS MISSING FROM THIS TABLE AND IS NOT A PUBLISHER GAP. Its
 * directory answers 403, so the file exists; its filename has not been
 * guessed and directory listing is forbidden. Do not record FY2021 as
 * unpublished. The honest route is a Wayback CDX query for the county's own
 * historical page to DISCOVER the address, then a fetch from the live host.
 *
 * ── TWO REISSUED / CORRECTED DOCUMENTS, BOTH CHECKED RATHER THAN ASSUMED ───
 *
 * Reno FY2021 ships `FY 2021 ACFR.pdf` and `FY2021 ACFR Corrected Page
 * Numbers.pdf`; Washoe FY2024 ships a 288pp revised file and a 319pp
 * "Reissued Printable Version". In BOTH cases the two variants were extracted
 * and produce IDENTICAL General Fund figures, so the choice is about which
 * document the publisher presents, not about the numbers:
 *
 *   Reno FY2021    the corrected file — the city's later publication
 *   Washoe FY2024  the Printable Version — the file the county's own ACFR
 *                  index links, so the one a reader actually reaches
 *
 * ⚠ Washoe FY2024 is a RESTATEMENT. Its Note 21 says management "became aware
 * of certain errors related to underreported federal grant revenues relating
 * to fiscal year 2024", an $11,654,076 adjustment. The original FY2024 ACFR is
 * no longer published, so the figures stored here are the county's corrected
 * ones. Recorded, not corrected — the Milledgeville rule.
 */

export const RENO_BASE =
  'https://reno.gov/Documents/Government/Departments/Finance/Financial%20Reports/Annual%20Comprehensive%20Financial%20Report';

export const WASHOE_BASE =
  'https://www.washoecounty.gov/comptroller/Annual%20Comprehensive%20Financial%20Report';

/** The page a reader should land on to find the whole series, per entity. */
export const SOURCE_PAGE = Object.freeze({
  reno: 'https://reno.gov/government/departments/finance/financial-reports.php',
  'washoe-county': `${WASHOE_BASE}/index.php`,
});

export const NV_ACFR_SOURCES = Object.freeze({
  reno: Object.freeze({
    2021: `${RENO_BASE}/FY2021%20ACFR%20Corrected%20Page%20Numbers.pdf`,
    2022: `${RENO_BASE}/City%20of%20Reno%20Nevada%202022%20Audit%20ACFR%20FS%20FINAL.pdf`,
    2023: `${RENO_BASE}/City%20of%20Reno%202023%20Audit%20ACFR%20FS%20%20Final.pdf`,
    2024: `${RENO_BASE}/City%20of%20Reno%20Nevada%202024%20ACFR%20Final%20Digital.pdf`,
    2025: `${RENO_BASE}/City%20of%20Reno%20ACFR%20June%2030%202025%20FINAL.pdf`,
  }),
  'washoe-county': Object.freeze({
    2019: `${WASHOE_BASE}/2019/2019%20CAFR%20COMPLETE.pdf`,
    2020: `${WASHOE_BASE}/2020/2020%20CAFR%20FINAL.pdf`,
    2022: `${WASHOE_BASE}/2022/2022%20ACFR%20-%20FINAL%20Revd%203-6-24.pdf`,
    2023: `${WASHOE_BASE}/2023/2023%20ACFR%20Final.pdf`,
    2024: `${WASHOE_BASE}/2024%20ACFR%20Reissued%20Printable%20Version.pdf`,
    2025: `${WASHOE_BASE}/2025/2025%20ACFR%20-%20Accessible%20Version.pdf`,
  }),
});

/**
 * Years readable today, per entity. Anything absent here is absent for a
 * stated reason — see KNOWN_DOCUMENT_GAPS.
 */
export const NV_WINDOWS = Object.freeze({
  reno: Object.freeze([2021, 2022, 2023, 2024, 2025]),
  'washoe-county': Object.freeze([2019, 2020, 2022, 2023, 2024, 2025]),
});

/**
 * ⚠ DECLARED, NEVER WRITTEN AS $0. Each of these is a document we have or can
 * reach, held back for a reason that is about US, not about the publisher.
 */
export const KNOWN_DOCUMENT_GAPS = Object.freeze([
  Object.freeze({
    entity: 'reno',
    fiscalYears: [2017, 2018, 2019, 2020],
    reason:
      'The statement spans TWO pages in this era (revenues and Current on page N, '
      + 'TOTAL EXPENDITURES on page N+1 under a "(Continued)" banner), and the '
      + 'coordinate reader qualifies a page by requiring both printed totals on it. '
      + 'The documents are downloaded and readable; extending the reader to span a '
      + 'statement is its own change, because it touches every coords-based entity.',
  }),
  Object.freeze({
    entity: 'washoe-county',
    fiscalYears: [2021],
    reason:
      'Directory answers 403 (exists, listing forbidden) so the file IS published; '
      + 'its filename has not been discovered. NOT a publisher gap.',
  }),
]);
