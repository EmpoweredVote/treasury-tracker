/**
 * Build the Indiana COUNTY ACFR roster from the Federal Audit Clearinghouse.
 *
 * NO SHEBANG — kept importable; tests import ROSTER_FILE and the helpers.
 *
 * Usage:
 *   node scripts/buildInCountyFacRoster.mjs            # report only
 *   node scripts/buildInCountyFacRoster.mjs --write    # write the roster JSON
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Gateway's AFR is an all-funds treasury cash report, and for a county auditor
 * that includes custodial money collected and remitted for every other taxing
 * unit in the county. Marion County FY2023 loads 3.3x the county's OWN audited
 * governmental-funds revenue for exactly that reason, and a true own-funds scope
 * is NOT derivable from the Gateway extract — see
 * `scripts/data/inGatewayAnomalies.mjs` and project_indiana_own_funds_scope.
 *
 * Chris's call, 2026-09-08: the counties come from their own audited ACFRs. FAC
 * serves those as complete PDFs, free and unauthenticated, which is the route SC
 * cities already use (reference_sc_city_acfr_route).
 *
 * ── ⚠⚠ THE JOIN IS (EIN + fiscal-year-end + report_id), RECORDED PER YEAR ───
 *
 * Never the EIN alone and never the name. Both halves of that rule were learned
 * the hard way in South Carolina, and INDIANA BREAKS THE EIN RULE IN THE
 * OPPOSITE DIRECTION:
 *
 *   SC   ONE EIN -> TWO GOVERNMENTS (Rock Hill city + its housing authority),
 *        so an EIN join MERGES two entities' statements into one series.
 *   IN   ONE GOVERNMENT -> TWO EINs. Measured here:
 *          Clinton   356000134 (FY2018-2023) -> 356000135 (FY2024)
 *          Monroe    351732465 (FY2016)      -> 351732462 (FY2017-2024)
 *          Sullivan  366000200 (FY2021-2023) -> 356000200 (FY2024)
 *          Fayette   356000143 (FY2018-2023) -> 873842728 (FY2024)
 *        so an EIN join SPLITS one county's series into two.
 *
 * ⚠ Identity therefore anchors on the ROSTER COUNTY (the 92 the Gateway sweep
 * already established), and the EIN is recorded as an attribute of each filing
 * rather than used as a key.
 *
 * ⚠⚠ AND THE NAME IS NOT SAFE EITHER. FAC records SC's Rock Hill FY2024
 * `auditee_name` as `Drew Cooper` — a person. Indiana's own near-miss: matching
 * on a name normaliser that did not strip PERIODS reported `St. Joseph` as
 * having no filings at all, when it has eight. A coverage figure measures the
 * matcher and the publisher, never the year.
 */

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

import { ROSTER_FILE as GATEWAY_ROSTER } from './buildInStatewideRoster.mjs';

/** ⚠ Gitignored 269 MB bulk download; never read this from a test. */
export const FAC_BULK_CSV = 'cache/fac-general.csv';
export const FAC_BULK_URL = 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv';
export const ROSTER_FILE = 'scripts/data/inCountyFacRoster.json';

/** `app.fac.gov` serves the complete audited ACFR as a PDF, free, no key. */
export const pdfUrlFor = (reportId) => `https://app.fac.gov/dissemination/report/pdf/${reportId}`;

/**
 * Reduce a county name — from either side — to a comparable base.
 * ⚠ STRIPS PERIODS. `St. Joseph County` vs FAC's `ST JOSEPH` differ only by one,
 * and without this the county reads as never having filed.
 */
export function countyKey(name) {
  let s = String(name ?? '')
    .toUpperCase()
    // ⚠ PERIODS TOO. `St. Joseph County` vs FAC's `ST JOSEPH` differ by one, and
    // without this the county reads as never having filed. It has eight.
    .replace(/[.,']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // ⚠⚠ THE STATE NAME COMES OFF BEFORE THE COUNTY SUFFIX, and the order matters.
  // FAC writes `MARION COUNTY, INDIANA`; strip ` COUNTY$` first and the trailing
  // ` INDIANA` blocks the match, so Marion — the county this entire route was
  // justified by — reads as having filed nothing. It has ten.
  s = s.replace(/^STATE OF INDIANA(?= |$)/, '').replace(/(?:^| )INDIANA$/, '').trim();
  s = s.replace(/^(?:THE )?COUNTY OF\s+/, '');
  s = s.replace(/\s+COUNTY(?: GOVERNMENT)?$/, '');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Is this FAC row plausibly a county GOVERNMENT rather than a school
 * corporation, housing authority or non-profit that merely has a county in its
 * name? Deliberately conservative: the roster does the real work, this only
 * keeps obvious impostors out of the unmatched report.
 */
export function looksLikeCountyGovernment(auditeeName) {
  const n = String(auditeeName ?? '').toUpperCase();
  // ⚠⚠ CASE-INSENSITIVE, and this was a real defect. An uppercase-only character
  // class silently rejected every mixed-case row, which is how the newer
  // GSAFAC-era filings are written (`Marion County, Indiana`). The roster then
  // reported 88 of 92 counties covered and FY2023 as THREE filings instead of 66,
  // with Marion — a county whose ACFR had already been read in this very session
  // — absent altogether. It looked entirely plausible. A coverage figure measures
  // the MATCHER before it measures the publisher.
  if (!/^[A-Za-z .,'-]+$/.test(String(auditeeName ?? '').trim())) return false;
  for (const bad of ['SCHOOL', 'CORPORATION', 'AUTHORITY', 'LIBRARY', 'TOWNSHIP',
    'HOSPITAL', 'AIRPORT', 'HOUSING', 'UTILITIES', 'FOUNDATION', 'INC']) {
    if (n.includes(bad)) return false;
  }
  return true;
}

/** Parse one CSV line, honouring quoted fields containing commas. */
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function countyNamesFromGatewayRoster(file = GATEWAY_ROSTER) {
  const roster = JSON.parse(readFileSync(file, 'utf8'));
  const counties = (roster.entities ?? []).filter((e) => e.entityType === 'county');
  if (counties.length !== 92) {
    throw new Error(`REFUSING: expected 92 Indiana counties in ${file}, found ${counties.length}`);
  }
  return counties.map((c) => ({ key: c.key, name: c.name, countyCode: c.countyCode }));
}

/** Stream the FAC bulk CSV and collect Indiana local-government filings. */
async function collectFilings(counties) {
  if (!existsSync(FAC_BULK_CSV)) {
    throw new Error(`REFUSING: ${FAC_BULK_CSV} is missing. Fetch it with\n`
      + `    curl -L -o ${FAC_BULK_CSV} "${FAC_BULK_URL}"\n`
      + '  ⚠ It 302-redirects to a presigned S3 URL valid for 30 SECONDS, so follow '
      + 'redirects and use GET — a HEAD request is signed differently and 403s.');
  }
  const byKey = new Map(counties.map((c) => [countyKey(c.name), c]));
  const hits = new Map();   // countyKey -> filings[]
  const unmatched = new Map();

  const rl = createInterface({
    input: createReadStream(FAC_BULK_CSV, 'utf8'), crlfDelay: Infinity,
  });
  let ix = null;
  const need = (name) => {
    const i = ix.get(name);
    if (i === undefined) throw new Error(`FAC column not found: ${name}`);
    return i;
  };
  for await (const line of rl) {
    if (ix === null) {
      ix = new Map(splitCsvLine(line).map((h, i) => [h.trim().toLowerCase(), i]));
      continue;
    }
    const f = splitCsvLine(line);
    if ((f[need('auditee_state')] ?? '').trim().toUpperCase() !== 'IN') continue;
    if ((f[need('entity_type')] ?? '').trim().toLowerCase() !== 'local') continue;
    const name = (f[need('auditee_name')] ?? '').trim();
    if (!looksLikeCountyGovernment(name)) continue;
    const k = countyKey(name);
    const rec = {
      auditYear: Number((f[need('audit_year')] ?? '').trim()),
      reportId: (f[need('report_id')] ?? '').trim(),
      ein: (f[need('auditee_ein')] ?? '').trim(),
      fyEndDate: (f[need('fy_end_date')] ?? '').trim().slice(0, 10),
      auditeeName: name,
    };
    if (!byKey.has(k)) {
      unmatched.set(k, (unmatched.get(k) ?? 0) + 1);
      continue;
    }
    if (!hits.has(k)) hits.set(k, []);
    hits.get(k).push(rec);
  }
  return { hits, unmatched };
}

export async function buildRoster() {
  const counties = countyNamesFromGatewayRoster();
  const { hits, unmatched } = await collectFilings(counties);

  const entities = counties.map((c) => {
    const k = countyKey(c.name);
    const filings = (hits.get(k) ?? []).slice()
      .sort((a, b) => a.auditYear - b.auditYear || a.reportId.localeCompare(b.reportId));
    const byYear = new Map();
    for (const f of filings) {
      if (!byYear.has(f.auditYear)) byYear.set(f.auditYear, []);
      byYear.get(f.auditYear).push(f);
    }
    return {
      ...c,
      facKey: k,
      // ⚠ Every EIN this county has ever filed under, recorded as an attribute.
      // NOT a key: one Indiana county can carry two EINs across its series.
      eins: [...new Set(filings.map((f) => f.ein))].sort(),
      // ⚠⚠ A YEAR CAN HAVE MORE THAN ONE ACCEPTED FILING. Kept as an array so
      // the choice is explicit and visible rather than silently first-wins.
      years: [...byYear.entries()].sort((a, b) => a[0] - b[0])
        .map(([year, fs]) => ({ year, filings: fs })),
      filingCount: filings.length,
    };
  });

  return { entities, unmatched: [...unmatched.entries()].sort((a, b) => b[1] - a[1]) };
}

async function main() {
  const { entities, unmatched } = await buildRoster();
  const withFilings = entities.filter((e) => e.filingCount > 0);
  const without = entities.filter((e) => e.filingCount === 0);

  console.log(`Indiana counties: ${entities.length}`);
  console.log(`  with at least one FAC filing: ${withFilings.length}`);
  console.log(`  with NO FAC filing at all:    ${without.length}`
    + `${without.length ? ` — ${without.map((e) => e.name).join(', ')}` : ''}`);
  console.log('  ⚠ Absence here means the county expended under the $750k Single Audit '
    + 'threshold, NOT that it publishes no ACFR.');
  console.log('');

  const perYear = new Map();
  let multiFilingYears = 0;
  for (const e of entities) {
    for (const y of e.years) {
      perYear.set(y.year, (perYear.get(y.year) ?? 0) + 1);
      if (y.filings.length > 1) multiFilingYears++;
    }
  }
  console.log('counties filing per audit year:');
  for (const y of [...perYear.keys()].sort()) {
    console.log(`  FY${y}  ${String(perYear.get(y)).padStart(3)}`);
  }
  console.log('  ⚠⚠ COVERAGE VARIES BY YEAR and peaks in FY2020, when federal relief '
    + 'pushed more counties over the audit threshold. Never assert a year without '
    + 'measuring it.');
  console.log('');
  console.log(`county-years with MORE THAN ONE accepted filing: ${multiFilingYears}`);
  for (const e of entities) {
    for (const y of e.years.filter((x) => x.filings.length > 1)) {
      console.log(`  ${e.name} FY${y.year}: ${y.filings.map((f) => f.reportId).join('  ')}`);
    }
  }
  console.log('');
  const multiEin = entities.filter((e) => e.eins.length > 1);
  console.log(`counties carrying MORE THAN ONE EIN: ${multiEin.length}`);
  for (const e of multiEin) console.log(`  ${e.name}: ${e.eins.join(', ')}`);
  console.log('');
  if (unmatched.length) {
    console.log(`county-shaped names that matched no roster county (${unmatched.length}), top 8:`);
    for (const [n, c] of unmatched.slice(0, 8)) console.log(`  ${String(c).padStart(3)}  ${n}`);
  }

  if (process.argv.includes('--write')) {
    const payload = {
      _what: 'Indiana county ACFR filings on the Federal Audit Clearinghouse. Built by '
        + 'scripts/buildInCountyFacRoster.mjs from the FAC bulk CSV.',
      _join: 'Identity is the ROSTER COUNTY. (ein, fyEndDate, reportId) identify a FILING; '
        + 'the ein is an attribute, never a key — one Indiana county can carry two.',
      builtFrom: FAC_BULK_URL,
      counties: entities.length,
      withFilings: withFilings.length,
      entities,
    };
    writeFileSync(ROSTER_FILE, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\nwrote ${ROSTER_FILE}`);
  } else {
    console.log('\nReport only. Pass --write to update the roster JSON.');
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`
    || process.argv[1]?.endsWith('buildInCountyFacRoster.mjs')) {
  await main();
}
