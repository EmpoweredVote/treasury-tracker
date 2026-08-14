#!/usr/bin/env node
/**
 * Downloads Seattle + King County ACFRs into gitignored docs/ directories.
 *
 * King County FY2018 is served from the Internet Archive: the issuer's own URL
 * is dead (the Sitecore /~/media/ path was decommissioned) and FY2018 is the
 * ONLY pre-2019 year that is recoverable at all -- 2007 and 2015 are scans and
 * 2017's capture is truncated at exactly 2^20 bytes. Fetch with the `id_`
 * suffix, which returns the raw bytes rather than the archive's wrapper page.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Upgrade-Insecure-Requests': '1',
};

const S = 'https://www.seattle.gov/documents/Departments/CityFinance/FinancialServices/CAFR';
export const SEATTLE_URLS = {
  2025: `${S}/2025%20Annual%20Comprehensive%20Financial%20Report%20-%20City%20of%20Seattle.pdf`,
  2024: `${S}/2024%20Annual%20Rep%20-%20City%20of%20Seattle.pdf`,
  2023: `${S}/2023%20Annual%20Report%20-%20City%20of%20Seattle.pdf`,
  2022: 'https://www.seattle.gov/documents/Departments/InvestorRelations/2023%20Documents/2022%20Annual%20Report%20Final%20Draft%202023-06-29.pdf',
  2021: `${S}/comprehensive-annual-financial-report-2021.pdf`,
  2020: `${S}/comprehensive-annual-financial-report-2020.pdf`,
  2019: `${S}/comprehensive-annual-financial-report-2019.pdf`,
  2018: `${S}/CAFR%202018%2010-28.pdf`,
  2017: `${S}/comprehensive-annual-financial-report-2017.pdf`,
  2016: `${S}/comprehensive-annual-financial-report-2016.pdf`,
  2015: `${S}/comprehensive-annual-financial-report-2015.pdf`,
  2014: `${S}/comprehensive-annual-financial-report-2014.pdf`,
  2013: `${S}/comprehensive-annual-financial-report-2013.pdf`,
  2012: `${S}/comprehensive-annual-financial-report-2012.pdf`,
  2011: `${S}/comprehensive-annual-financial-report-2011.pdf`,
  2010: `${S}/comprehensive-annual-financial-report-2010.pdf`,
  2009: `${S}/comprehensive-annual-financial-report-2009.pdf`,
};

const K = 'https://cdn.kingcounty.gov/-/media/king-county/depts/executive-services/finance-business-operations/financial-management/financial-reports/acfr';
export const KING_COUNTY_URLS = {
  2025: `${K}/2025-acfr-en.pdf`, 2024: `${K}/2024-acfr-en.pdf`,
  2023: `${K}/2023-acfr-en.pdf`, 2022: `${K}/2022-acfr-en.pdf`,
  2021: `${K}/2021-acfr-en.pdf`, 2020: `${K}/2020-acfr-en.pdf`,
  2019: `${K}/2019-acfr-en.pdf`,
  2018: 'https://web.archive.org/web/20201029080417id_/https://www.kingcounty.gov/~/media/depts/finance/financial-management-services/CAFR-2018/2018-comprehensive-annual-financial-report.ashx?la=en',
};

async function fetchOne(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 100_000) return 'cached';
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) return `HTTP ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  // Both hosts answer a miss with a ~1,245-byte HTML page, not a 404 body only,
  // so the magic-number check -- not the status code -- is the real gate.
  if (buf.subarray(0, 4).toString() !== '%PDF') return `not a PDF (${buf.length}B)`;
  // A capture truncated to an exact power of two is the Wayback failure mode
  // that produced an unreadable 2017 file. Reject it rather than load it.
  if ((buf.length & (buf.length - 1)) === 0) return `suspect truncation (${buf.length}B)`;
  writeFileSync(dest, buf);
  return `${(buf.length / 1e6).toFixed(1)} MB`;
}

const sets = [
  ['docs/Seattle', SEATTLE_URLS, 'seattle'],
  ['docs/KingCounty', KING_COUNTY_URLS, 'kingcounty'],
];
// Cross-platform entry-point check: file://${argv[1]} loses a slash on Windows
// (argv[1] "C:/..." vs. import.meta.url "file:///C:/..."), so pathToFileURL is
// used instead of a manual string join.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [dir, urls, prefix] of sets) {
    mkdirSync(dir, { recursive: true });
    for (const fy of Object.keys(urls).map(Number).sort((a, b) => b - a)) {
      const dest = `${dir}/${prefix}-${fy}-acfr.pdf`;
      let r; try { r = await fetchOne(urls[fy], dest); } catch (e) { r = `ERROR ${e.message}`; }
      console.log(`${prefix} FY${fy}: ${r}`);
    }
  }
}
