/**
 * Colorado ACFR source manifests — City of Colorado Springs, El Paso County.
 * NO SHEBANG — library module under scripts/lib/ (`tests/coAcfrLoad.test.mjs`
 * imports it, and `tests/waSao.test.mjs` forbids a test from importing any
 * module that starts with a shebang: a CRLF checkout turns the interpreter
 * line into an unresolvable path).
 *
 * Two hosts, two completely different retrieval problems.
 *
 * -- COLORADO SPRINGS: THE LINK IS NOT THE FILE ------------------------------
 * Every link on the city's ACFR index page looks like a PDF and is not one:
 *
 *   https://coloradosprings.gov/document/2024-co-springs-acfrfinal.pdf
 *     -> HTTP 200, Content-Type: text/html, ~27KB pdf.js viewer shell
 *
 * A naive `curl -o x.pdf` writes an HTML page named `.pdf` for all 27 years.
 * This is the Austin/Widen trap from AUSTIN-TRAVIS-01 in a different CMS, and
 * it is why the `%PDF` magic-byte guard is non-negotiable in the fetcher.
 *
 * The real bytes are named by a `data-src` attribute inside that shell, and the
 * paths are NOT DERIVABLE — the 27 files sit under five different Drupal
 * conventions with inconsistent filenames:
 *
 *   FY1999-2014  /system/files/finance/Accounting/cafrs/2010cafr.pdf
 *                                                   ...2005_cafr.pdf  (underscore)
 *                                                   ...2007-cafr.pdf  (hyphen)
 *                                                   ...cafr2009final.pdf (reordered)
 *   FY2015-2017  /system/files/2016_cafr_final.pdf
 *   FY2018-2020  /system/files/inline-images/2019_co_springs_cafr_final.pdf
 *   FY2021       /system/files/2021_acfr_co_springs.pdf
 *   FY2022-2025  /system/files/2023-06/2023_co_springs_acfr_final.pdf
 *                /system/files/2025-07/2024%20CO%20Springs%20ACFR_Final.pdf
 *
 * That last convention embeds the UPLOAD MONTH, which no rule can predict and
 * which changes if the city re-uploads a file. So the only hardcoded fact here
 * is the VIEWER SLUG published on the index page, and the asset URL is RESOLVED
 * at fetch time out of the shell. The manifest then records the URL that
 * actually served the bytes, so `budgets.source_url` names what was parsed.
 *
 * -- EL PASO COUNTY: DIRECT FILES, IRREGULAR NAMES ---------------------------
 * The county serves real PDFs, but the current index page lists only the last
 * four years; FY2000-FY2021 live on in the asset host. Names drift three ways:
 *
 *   - "Comprehensive-Annual-Financial-Report" (FY2000-FY2020) vs
 *     "Annual-Comprehensive-Financial-Report" (FY2021+) — the GFOA rename.
 *   - a `-1` SUFFIX on exactly FY2011 and FY2019, and on nothing else. Both
 *     years 404 without it, which is how they were first recorded as "not
 *     published" before the variant probe found them.
 *   - FY2023-FY2025 moved OUT of the `/ACFR/` subdirectory to the uploads root,
 *     and FY2024 is `2024-ACFR-FINAL-reduced-size.pdf`.
 *
 * So `epcUrls` returns an ORDERED CANDIDATE LIST per year rather than one URL:
 * the probed winner first, then the other shapes. Hardcoding a single boundary
 * ("-1 after 2010") would silently drop a year the moment the county renamed
 * one file, and every candidate still has to pass the fetcher's guards.
 */

// -- Colorado Springs --------------------------------------------------------
/**
 * `{ fiscal_year: viewer-page slug }`, transcribed from the hrefs published on
 * the city's ACFR index page — 27 reports, FY1999 through FY2025. Transcribed,
 * never pattern-generated: the slugs are irregular (`2007-cafr`,
 * `cafr2009final`, `final2014cafrupdated`, `2015finalcafr`, `2016cafrfinal`).
 */
export const CS_VIEWER_SLUGS = {
  1999: '1999cafr.pdf',
  2000: '2000cafr.pdf',
  2001: '2001cafr.pdf',
  2002: '2002cafr.pdf',
  2003: '2003cafr.pdf',
  2004: '2004cafr.pdf',
  2005: '2005cafr.pdf',
  2006: '2006cafr.pdf',
  2007: '2007-cafr.pdf',
  2008: '2008cafr.pdf',
  2009: 'cafr2009final.pdf',
  2010: '2010cafr.pdf',
  2011: '2011cafr.pdf',
  2012: '2012cafr.pdf',
  2013: 'final2013cafr.pdf',
  2014: 'final2014cafrupdated.pdf',
  2015: '2015finalcafr.pdf',
  2016: '2016cafrfinal.pdf',
  2017: '2017cospringscafrfinal.pdf',
  2018: '2018cospringscafrfinal.pdf',
  2019: '2019cospringscafrfinal.pdf',
  2020: '2020acfrcosprings.pdf',
  2021: '2021acfrcosprings.pdf',
  2022: '2022acfrcosprings.pdf',
  2023: '2023cospringsacfrfinal.pdf',
  2024: '2024-co-springs-acfrfinal.pdf',
  2025: '2025-co-springs-acfrfinal.pdf',
};

export const CS_HOST = 'https://coloradosprings.gov';
export const CS_INDEX_URL = `${CS_HOST}/accounting/page/annual-comprehensive-financial-report-acfr`;

/** The VIEWER page for a fiscal year — HTML, not the report. Null off-manifest. */
export function csViewerUrl(fy) {
  const slug = CS_VIEWER_SLUGS[fy];
  return slug ? `${CS_HOST}/document/${slug}` : null;
}

function decodeEntities(s) { return s.replace(/&amp;/g, '&'); }

function absolutize(u) {
  if (/^https?:\/\//i.test(u)) return u;
  return `${CS_HOST}${u.startsWith('/') ? '' : '/'}${u}`;
}

/**
 * Pull the real asset URL out of a viewer shell.
 *
 * The shell names the file twice — once as `data-src` on the download element
 * and once URL-encoded inside the pdf.js `?file=` query. `data-src` is read
 * first because it is already a plain absolute URL; the `?file=` form is the
 * fallback for a shell that renders only the iframe.
 *
 * Returns null rather than guessing when neither is present, so the fetcher
 * reports a MISS instead of inventing a path. Relative hrefs resolve against
 * CS_HOST.
 */
export function csAssetUrlFromShell(html) {
  const direct = /data-src="([^"]+?\.pdf[^"]*)"/i.exec(html);
  if (direct) return absolutize(decodeEntities(direct[1]));
  const viaViewer = /viewer\.html\?file=([^"&]+)/i.exec(html);
  if (viaViewer) {
    const decoded = decodeURIComponent(decodeEntities(viaViewer[1]));
    if (/\.pdf($|[?#])/i.test(decoded)) return absolutize(decoded);
  }
  return null;
}

// -- El Paso County ----------------------------------------------------------
export const EPC_ASSET_HOST = 'https://epc-assets.elpasoco.com/wp-content/uploads/sites/2';
export const EPC_INDEX_URL = 'https://admin.elpasoco.com/financial-services/budget-finance/annual-comprehensive-financial-reports/';

/**
 * FY2000-FY2025, twenty-six published reports. FY1999 and earlier 404 on every
 * name shape probed — an upstream absence, not an extraction failure.
 */
export const EPC_FYS = Array.from({ length: 26 }, (_, i) => 2000 + i);

/**
 * The exact filename observed to serve a real PDF for each year, recorded from
 * the source-discovery probe. Used as the FIRST candidate only — `epcUrls`
 * always appends the other shapes, so a re-published file under a different
 * name is still found rather than reported missing.
 */
const EPC_OBSERVED = {
  2011: '2011-Comprehensive-Annual-Financial-Report-1.pdf',
  2019: '2019-Comprehensive-Annual-Financial-Report-1.pdf',
  2023: '2023-Annual-Comprehensive-Financial-Report.pdf',
  2024: '2024-ACFR-FINAL-reduced-size.pdf',
  2025: '2025-Annual-Comprehensive-Financial-Report.pdf',
};

/** Years whose file sits in the uploads ROOT rather than the `/ACFR/` subdir. */
const EPC_ROOT_DIR_FYS = new Set([2023, 2024, 2025]);

/**
 * Ordered candidate URLs for a fiscal year. Every candidate is tried by the
 * fetcher, which keeps the first that passes ALL its guards and records that
 * URL in the manifest.
 */
export function epcUrls(fy) {
  const dirs = EPC_ROOT_DIR_FYS.has(fy)
    ? [EPC_ASSET_HOST, `${EPC_ASSET_HOST}/ACFR`]
    : [`${EPC_ASSET_HOST}/ACFR`, EPC_ASSET_HOST];
  const names = [
    // GFOA's 2021 rename, both orders, plus the `-1` re-upload suffix.
    `${fy}-Comprehensive-Annual-Financial-Report.pdf`,
    `${fy}-Annual-Comprehensive-Financial-Report.pdf`,
    `${fy}-Comprehensive-Annual-Financial-Report-1.pdf`,
    `${fy}-Annual-Comprehensive-Financial-Report-1.pdf`,
    `${fy}-ACFR-FINAL-reduced-size.pdf`,
  ];
  const observed = EPC_OBSERVED[fy];
  const ordered = observed ? [observed, ...names.filter((n) => n !== observed)] : names;
  const urls = [];
  for (const n of ordered) for (const d of dirs) urls.push(`${d}/${n}`);
  return urls;
}
