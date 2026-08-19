/**
 * Where the two Texas ACFR corpora live. NO SHEBANG — library module under
 * scripts/lib/, imported by both `scripts/fetchAustinTravis.mjs` and
 * `tests/txAcfrLoad.test.mjs`.
 *
 * (A shebang here would fail `tests/waSao.test.mjs`'s guard, which asserts that
 * no module a test imports starts with one — CRLF checkout turns `#!/usr/bin/env
 * node\r` into an unresolvable interpreter path. Same reason `scripts/lib/waSao.mjs`
 * holds the WA SAO client while `fetchBainbridgeKitsap.mjs` stays a thin driver.)
 *
 * ── TWO HOSTS, TWO TRAPS ────────────────────────────────────────────────────
 *
 * 1. City of Austin publishes through a **Widen DAM** (`austin.widen.net`), not
 *    from austintexas.gov. The legacy
 *    `austintexas.gov/sites/default/files/.../CAFR/*.pdf` paths that older search
 *    indexes still return are ALL 404 — the city migrated. The links ON
 *    `austintexas.gov/page/financial-reports` are VIEWER pages
 *    (`/view/pdf/<id>/<name>.pdf`) that serve `text/html`: a naive
 *    `curl -o file.pdf` on one writes a 24KB pdf.js HTML shell with a `.pdf`
 *    name. The downloadable asset is `/content/<id>/pdf/<name>.pdf` — same id,
 *    different path — which is what `austinUrl` builds.
 *
 * 2. Travis County publishes flat files from `tctransparency.traviscountytx.gov`.
 *    Note the host: `financialtransparency.traviscountytx.gov` is what a
 *    summarizing model produces when asked for these URLs — it did exactly that
 *    while this milestone was being scoped — and it 404s on every path. The
 *    filename suffix ALSO changes with the GFOA rename: `fy<YYYY>-cafr.pdf`
 *    through FY2018, `fy<YYYY>-acfr.pdf` from FY2019. `travisUrls` returns BOTH
 *    spellings rather than hardcoding the boundary, so a county that relabels an
 *    old file does not silently drop a year.
 */

/**
 * Austin manifest: FY -> [widen content id, asset filename].
 *
 * Harvested from the RAW HTML of austintexas.gov/page/financial-reports, not
 * from a summarizer (see trap 2 above for why that distinction is load-bearing).
 * FY2025 is published behind a `/s/<shortlink>/` viewer whose asset id is
 * h3cvp5mlxi.
 */
export const AUSTIN_ASSETS = Object.freeze({
  1998: ['ugkudhqozk', 'comprehensive_annual_financial_report_1998.pdf'],
  1999: ['6kzol1l0wq', 'comprehensive_annual_financial_report_1999.pdf'],
  2000: ['9m90awwhxl', 'comprehensive_annual_financial_report_2000.pdf'],
  2001: ['n87bywwvu4', 'comprehensive_annual_financial_report_2001.pdf'],
  2002: ['drxiizoa9z', 'comprehensive_annual_financial_report_2002.pdf'],
  2003: ['fjrp9nmerb', 'comprehensive_annual_financial_report_2003.pdf'],
  2004: ['9fuswc6txl', 'comprehensive_annual_financial_report_2004.pdf'],
  2005: ['x9xhov94qw', 'comprehensive_annual_financial_report_2005.pdf'],
  2006: ['xmzs6cgzys', 'comprehensive_annual_financial_report_2006.pdf'],
  2007: ['9ictjygnxa', 'comprehensive_annual_financial_report_2007.pdf'],
  2008: ['eikwhvpbx1', 'comprehensive_annual_financial_report_2008.pdf'],
  2009: ['n0qxhiwm1h', 'comprehensive_annual_financial_report_2009.pdf'],
  2010: ['d9hywcnbhl', 'comprehensive_annual_financial_report_2010.pdf'],
  2011: ['dpgb4emuij', 'comprehensive_annual_financial_report_2011.pdf'],
  2012: ['f7ibfpf4do', 'comprehensive_annual_financial_report_2012.pdf'],
  2013: ['knbwnv40iq', 'comprehensive_annual_financial_report_2013.pdf'],
  2014: ['b4kf8zwsjw', 'comprehensive_annual_financial_report_2014.pdf'],
  2015: ['zqqsdx5rtj', 'comprehensive_annual_financial_report_2015.pdf'],
  2016: ['dxkojhgxai', 'comprehensive_annual_financial_report_2016.pdf'],
  2017: ['3hvyz83ghk', 'comprehensive_annual_financial_report_2017.pdf'],
  2018: ['yoy7g3l3oj', 'comprehensive_annual_financial_report_2018.pdf'],
  2019: ['mybpjagxpf', 'comprehensive_annual_financial_report_2019.pdf'],
  2020: ['jbc7n4ga9u', 'comprehensive_annual_financial_report_2020.pdf'],
  2021: ['hp0lghlmvz', 'annual_comprehensive_financial_report_2021.pdf'],
  2022: ['xu2sucurlm', 'annual_comprehensive_financial_report_2022.pdf'],
  2023: ['s4wwfnr06r', 'AnnualComprehensivelFinancialReport2023.pdf'],
  2024: ['etv0g3zthq', 'FY2024-City-of-Austin-ACFR.pdf'],
  2025: ['h3cvp5mlxi', 'FY2025-Annual-Comprehensive-Financial-Report.pdf'],
});

/** Travis publishes FY2004 onward; FY2003 and earlier 404 in both spellings. */
export const TRAVIS_FYS = Object.freeze(Array.from({ length: 22 }, (_, i) => 2004 + i));

export const AUSTIN_INDEX_URL = 'https://www.austintexas.gov/page/financial-reports';
export const TRAVIS_INDEX_URL = 'https://tctransparency.traviscountytx.gov/FinancialDocuments';

/** Downloadable Widen asset URL for an Austin fiscal year, or null if unpublished. */
export function austinUrl(fy) {
  const entry = AUSTIN_ASSETS[fy];
  if (!entry) return null;
  const [id, name] = entry;
  return `https://austin.widen.net/content/${id}/pdf/${encodeURI(name)}`;
}

/** Both filename spellings for a Travis fiscal year, newest convention first. */
export function travisUrls(fy) {
  const base = 'https://tctransparency.traviscountytx.gov/Reports/FinancialDocuments';
  return [`${base}/fy${fy}-acfr.pdf`, `${base}/fy${fy}-cafr.pdf`];
}
