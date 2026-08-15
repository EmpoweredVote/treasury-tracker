#!/usr/bin/env node
/**
 * Downloads WA SAO bound financial statements for Bainbridge Island (MCAG 0461)
 * and Kitsap County (MCAG 0132) into gitignored docs/ directories.
 *
 * ARNs were resolved by probing SearchReports for each MCAG and are pinned here
 * so a load is reproducible and reviewable. Every downloaded file is passed
 * through classifyReport() -- an ARN that turns out to be an opinion letter or
 * a scan fails loudly rather than yielding an empty extraction later.
 *
 * Bainbridge FY2006 is deliberately absent: its only filing (ARN 73415) is an
 * image-only scan (36,698 chars over 52 pages, zero readable revenue labels).
 * Kitsap stops at FY2024 because FY2025 is not yet audited.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fetchReportPdf, classifyReport } from './lib/waSao.mjs';

// MCAG 0461 -- City of Bainbridge Island. FY2006 (ARN 73415) excluded: scan.
export const BAINBRIDGE_ARNS = {
  2004: 69788,   2005: 72209,   2007: 1000370, 2008: 1002863, 2009: 1004976,
  2010: 1006518, 2011: 1008424, 2012: 1010907, 2013: 1012614, 2014: 1014609,
  2015: 1017006, 2016: 1019388, 2017: 1021673, 2018: 1024177, 2019: 1026890,
  2020: 1029122, 2021: 1030857, 2022: 1032975, 2023: 1035299, 2024: 1037954,
  2025: 1040282,
};

// MCAG 0132 -- Kitsap County. Only FY2005/2013/2024 were probed during scoping;
// every other ARN is unverified and must clear the content guard below.
export const KITSAP_ARNS = {
  2004: 69287,   2005: 71281,   2006: 73517,   2007: 75398,   2008: 1001808,
  2009: 1004318, 2010: 1006489, 2011: 1008368, 2012: 1010062, 2013: 1012226,
  2014: 1014660, 2015: 1017209, 2016: 1019584, 2017: 1021897, 2018: 1024403,
  2019: 1027313, 2020: 1029638, 2021: 1031693, 2022: 1033213, 2023: 1035480,
  2024: 1038058,
};

function pageCount(pdfPath) {
  const out = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const m = /^Pages:\s+(\d+)/m.exec(out);
  if (!m) throw new Error(`pdfinfo gave no page count for ${pdfPath}`);
  return Number(m[1]);
}

function pdfText(pdfPath) {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

async function fetchOne(arn, dest) {
  if (!(existsSync(dest) && statSync(dest).size > 100_000)) {
    writeFileSync(dest, await fetchReportPdf(arn));
  }
  const verdict = classifyReport(pageCount(dest), pdfText(dest));
  if (!verdict.ok) throw new Error(`ARN ${arn} rejected: ${verdict.reason}`);
  return `${(statSync(dest).size / 1e6).toFixed(1)} MB — ${verdict.reason}`;
}

const SETS = [
  ['docs/BainbridgeIsland', BAINBRIDGE_ARNS, 'bainbridge'],
  ['docs/KitsapCounty',     KITSAP_ARNS,     'kitsap'],
];

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failures = 0;
  for (const [dir, arns, prefix] of SETS) {
    mkdirSync(dir, { recursive: true });
    for (const fy of Object.keys(arns).map(Number).sort((a, b) => b - a)) {
      const dest = `${dir}/${prefix}-${fy}-acfr.pdf`;
      try { console.log(`${prefix} FY${fy}: ${await fetchOne(arns[fy], dest)}`); }
      catch (e) { failures++; console.error(`${prefix} FY${fy}: FAILED — ${e.message}`); }
    }
  }
  if (failures) { console.error(`\n${failures} file(s) failed the content guard.`); process.exit(1); }
}
