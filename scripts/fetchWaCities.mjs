#!/usr/bin/env node
/**
 * Downloads WA SAO bound financial statements for the WA-CITIES-01 cities
 * into gitignored docs/ directories.
 *
 * (Shebang is correct HERE -- this is an entry-point script with a main guard.
 * It would NOT be correct in scripts/lib/, where it breaks the Vite transform
 * on a CRLF checkout; see tests/waSao.test.mjs.)
 *
 * ARNs are resolved by probing SearchReports per MCAG and pinned here so a
 * load is reproducible and reviewable. Every downloaded file is passed through
 * classifyReport() -- an ARN that turns out to be an opinion letter or a scan
 * fails LOUDLY at fetch time rather than yielding an empty extraction later.
 *
 * ── TWO DECOY LAYERS, BOTH OBSERVED, BOTH ABLE TO LOAD THE WRONG MONEY ──────
 *
 * 1. ENTITY level. `GetEntities` matches on a name prefix: "Spokane" also
 *    returns City of Spokane VALLEY, a genuinely different municipality.
 *    Guarded by selectExactCity() + assertMcag() in scripts/lib/waRoster.mjs.
 *
 * 2. REPORT level, and this one is specific to large cities. A single MCAG
 *    carries reports for more than one reporting entity. Tacoma's MCAG 0610
 *    returns 182 reports, of which only 116 are titled "City of Tacoma" -- the
 *    rest are the Tacoma Employees' Retirement System (43) and a long tail of
 *    Tacoma Power energy-compliance reports. **Filter on ReportTitle before
 *    selecting an ARN.** A pension-system statement would parse cleanly and
 *    tie at $0 while reporting the wrong entity's money.
 *
 * ── THE TYPE-NAME INVERSION HOLDS BELOW FY2014 (measured, not assumed) ──────
 * Confirmed on Tacoma 2026-08-15 by classifying candidates at both ends of the
 * span: the type literally named "Annual Comprehensive Financial Report" is a
 * 5-6 page opinion letter (FY2024 ARN 1037700 = 6pp, FY2025 ARN 1040162 = 5pp),
 * while "Financial and Federal" carries 79-188pp of statements in EVERY year
 * from FY2003 to FY2024. The spec flagged the sub-FY2014 behaviour as unknown;
 * it is now known for this issuer. Selection is still by CONTENT regardless.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { fetchReportPdf, classifyReport } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

/**
 * Tacoma, MCAG 0610. Every ARN below is the "Financial and Federal" report
 * titled exactly "City of Tacoma" for that audit period, and every one has
 * been fetched and passed classifyReport().
 *
 * FY2025 is absent deliberately: its only City of Tacoma filings are a 5pp
 * opinion letter (1040162) and five Contracted CPA reports. The financial
 * audit is not yet released -- this is a source timing gap, not a defect.
 */
export const TACOMA_ARNS = {
  2003: 68092,   2004: 69481,   2005: 71446,   2006: 73774,   2007: 75229,
  2008: 1002279, 2009: 1004324, 2010: 1006397, 2011: 1008324, 2012: 1010562,
  2013: 1012677, 2014: 1015203, 2015: 1017553, 2016: 1019851, 2017: 1022333,
  2018: 1024781, 2019: 1027087, 2020: 1029959, 2021: 1031332, 2022: 1033428,
  2023: 1036023, 2024: 1038208,
};

// Filled by each city's recon task, in the same shape as TACOMA_ARNS.
export const SPOKANE_ARNS = {};
export const VANCOUVER_ARNS = {};
export const BELLEVUE_ARNS = {};
export const KENT_ARNS = {};
export const EVERETT_ARNS = {};

export const ARNS_BY_CITY = {
  Tacoma: TACOMA_ARNS,
  Spokane: SPOKANE_ARNS,
  Vancouver: VANCOUVER_ARNS,
  Bellevue: BELLEVUE_ARNS,
  Kent: KENT_ARNS,
  Everett: EVERETT_ARNS,
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const only = process.argv[2] || null;
  let failures = 0;
  let fetched = 0;
  for (const [city, arns] of Object.entries(ARNS_BY_CITY)) {
    if (only && city !== only) continue;
    const years = Object.keys(arns).map(Number).sort((a, b) => b - a);
    if (!years.length) { console.log(`${city}: no ARNs pinned yet — skipping`); continue; }
    const e = getEntity(city);
    mkdirSync(e.pdfDir, { recursive: true });
    for (const fy of years) {
      const dest = `${e.pdfDir}/${e.pdfPrefix}-${fy}-acfr.pdf`;
      try {
        console.log(`${e.pdfPrefix} FY${fy}: ${await fetchOne(arns[fy], dest)}`);
        fetched++;
      } catch (err) {
        failures++;
        console.error(`${e.pdfPrefix} FY${fy}: FAILED — ${err.message}`);
      }
    }
  }
  console.log(`\n${fetched} file(s) passed the content guard.`);
  if (failures) { console.error(`${failures} file(s) FAILED.`); process.exit(1); }
}
