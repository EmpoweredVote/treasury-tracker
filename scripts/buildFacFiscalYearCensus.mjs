/**
 * Rebuild the per-state fiscal-calendar evidence extracts under `docs/<STATE>/`
 * from the Federal Audit Clearinghouse bulk download.
 *
 *     node scripts/buildFacFiscalYearCensus.mjs --download        # fetch + build
 *     node scripts/buildFacFiscalYearCensus.mjs --input path.csv  # build from a local copy
 *     node scripts/buildFacFiscalYearCensus.mjs --input path.csv --check
 *
 * ⚠ NO SHEBANG, even though this file is executable. `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`, and
 * `tests/facCensusBuilder.test.mjs` imports the classification rules from here.
 * Run it with `node scripts/buildFacFiscalYearCensus.mjs`.
 *
 * ── Why this script is committed ────────────────────────────────────────────
 * The extracts are EVIDENCE, and evidence that cannot be regenerated is a
 * screenshot. Every filter below exists because something real got through it,
 * and each one is a pure exported function with tests
 * (`tests/facCensusBuilder.test.mjs`) — the classification is where all the
 * defects in this work actually lived:
 *
 *   • `auditee_state` is SELF-REPORTED AND SOMETIMES WRONG. A CA query returned
 *     "CITY OF GROTON, CONNECTICUT"; TX returned Alamogordo NM, Santa Fe NM and
 *     Tulsa OK. ⚠ Santa Fe is the dangerous one — there is also a Santa Fe,
 *     TEXAS, and the New Mexico rows made the Texas city look like it had
 *     changed its fiscal year. The ZIP prefix settles it.
 *   • Institutions arrive shaped like governments: housing commissions, MHMR
 *     authorities, community-supervision departments and appraisal districts all
 *     end in "… County" and would enter a county census as counties.
 *   • The SAME entity appears as "ANDERSON COUNTY" and "Anderson County" across
 *     years, and as "CITY OF X" and "CITY OF X, TEXAS". Without normalisation
 *     one entity becomes two, each with half its history.
 *
 * ⚠ Read the bulk file as STRICT UTF-8. Reading it with a replacement-character
 * fallback silently corrupted "St. Mary's County" into "St. Mary?s County",
 * which then split that county in two.
 *
 * The bulk file needs no API key and has no rate limit (~266 MB, ~413k rows,
 * audit years 2016+). It 302-redirects to a presigned S3 URL valid for 30
 * seconds, so follow redirects and use GET — HEAD is signed differently and 403s.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

export const BULK_URL = 'https://app.fac.gov/dissemination/public-data/gsa/full/general.csv';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
);

/**
 * Per-state extract targets.
 *
 * ⚠ CA COUNTIES ARE DELIBERATELY EXCLUDED — Cal. Gov. Code § 29001(e) fixes them
 * at July–June by statute and that citation already lives in
 * `scripts/lib/loaderFiscalCalendars.mjs`. TX and MD have no such statute, so
 * their counties are censused.
 */
export const TARGETS = {
  CA: { file: 'docs/CA/fac-ca-city-fiscal-year-ends.csv', kinds: ['municipality'], zip: [[900, 961]] },
  TX: { file: 'docs/TX/fac-tx-local-fiscal-year-ends.csv', kinds: ['municipality', 'county'], zip: [[750, 799], [885, 885]] },
  MD: { file: 'docs/MD/fac-md-local-fiscal-year-ends.csv', kinds: ['municipality', 'county'], zip: [[206, 219]] },
};

/** Words that mean "this is an institution, not a general-purpose government". */
export const NOT_A_GOVERNMENT = new RegExp([
  'HOUSING', 'SUCCESSOR AGENCY', 'FINANCING', 'DEPARTMENT', '\\bDEPT\\b', 'WATER', 'POWER',
  'SEWER', '\\bDISTRICT\\b', '\\bAUTHORITY\\b', '\\bISD\\b', 'SCHOOL', 'COLLEGE', 'HOSPITAL',
  'LIBRARY', 'TRANSIT', 'APPRAISAL', 'CENTER', 'CENTRE', 'COUNCIL OF GOVERNMENTS', '\\bBOARD\\b',
  'EMERGENCY', 'UTILITY', 'SUPERVISION', 'HEALTH', 'COMMISSION\\b', '\\bMHMR\\b', 'REDEVELOPMENT',
  'RETIREMENT', 'PENSION', 'CHAMBER', 'ASSOCIATION', 'CORPORATION', '\\bFUND\\b', '\\bMUD\\b',
].join('|'), 'i');

const MUNI = /^(?:THE COMMISSIONERS OF|CITY AND COUNTY OF|CITY OF|TOWN OF|VILLAGE OF)\s+(.+)$/i;

/**
 * Counties file under four shapes, and missing one SILENTLY UNDER-COUNTS the
 * census rather than failing:
 *
 *   "TRAVIS COUNTY"                       — the common form
 *   "COUNTY COMMISSIONERS OF KENT COUNTY" — Maryland's governing-body form
 *   "COUNTY OF EL PASO, TEXAS"            — 43 Texas counties file this way and
 *                                           were dropped by an earlier version
 *                                           of this file, which recognised only
 *                                           names ENDING in "County"
 *   "BOWIE, COUNTY OF"                    — inverted, and real
 */
const CNTY_TRAILING = /^(?:THE\s+)?(?:COUNTY OF COMMISSIONERS OF\s+|COUNTY COMMISSIONERS OF\s+|COMMISSIONERS OF\s+|COUNTY OF\s+)?([A-Za-z][A-Za-z.' ]+?)\s+COUNTY$/i;
const CNTY_LEADING = /^(?:THE\s+)?COUNTY OF\s+([A-Za-z][A-Za-z.' ]+)$/i;
const CNTY_INVERTED = /^([A-Za-z][A-Za-z.' ]+?),\s*COUNTY OF$/i;
const STATE_SUFFIX = {
  CA: /,?\s*(CALIFORNIA|CA)$/i, TX: /,?\s*(TEXAS|TX)$/i, MD: /,?\s*(MARYLAND|MD)$/i,
};

/** Title Case that survives apostrophes and periods: "ST. MARY'S" -> "St. Mary's". */
export function titleize(s) {
  const lower = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return lower.replace(/(^|[\s.\-'])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/'S\b/g, "'s");
}

/** Is this ZIP inside the state? The check that unmasked Santa Fe NM vs Santa Fe TX. */
export function inStateZip(zip, stateCode) {
  const prefix = String(zip ?? '').trim().slice(0, 3);
  if (!/^\d{3}$/.test(prefix)) return false;
  const n = Number(prefix);
  return TARGETS[stateCode].zip.some(([lo, hi]) => n >= lo && n <= hi);
}

/**
 * Classify one auditee name into `{ kind, entity }`, or null if it is not a
 * general-purpose local government of that state.
 */
export function classifyAuditee(rawName, stateCode) {
  if (typeof rawName !== 'string' || rawName.trim() === '') return null;
  if (NOT_A_GOVERNMENT.test(rawName)) return null;
  const cleaned = rawName.replace(/\s+/g, ' ').trim().replace(/^"|"$/g, '').replace(/\.$/, '').trim();
  const name = cleaned.replace(STATE_SUFFIX[stateCode], '').trim().replace(/,$/, '').trim();
  const m = MUNI.exec(name);
  const c = CNTY_TRAILING.exec(name) ?? CNTY_LEADING.exec(name) ?? CNTY_INVERTED.exec(name);
  let kind; let entity;
  if (m) { kind = 'municipality'; entity = m[1]; } else if (c) { kind = 'county'; entity = `${c[1]} County`; } else return null;
  entity = titleize(entity).replace(/\.$/, '').trim();
  // "Mhmr Of Tarrant County" and friends: a county name never contains " Of ".
  if (/ Of /.test(entity)) return null;
  if (!TARGETS[stateCode].kinds.includes(kind)) return null;
  if (entity.includes(',') || entity.includes('"')) return null;
  return { kind, entity };
}

async function build(inputPath, check) {
  const wanted = Object.keys(TARGETS);
  const rows = Object.fromEntries(wanted.map((s) => [s, new Map()]));
  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),  // ⚠ strict UTF-8
    crlfDelay: Infinity,
  });
  let header = null;
  let idx = {};
  let seen = 0;
  for await (const line of rl) {
    if (header === null) {
      header = splitCsv(line);
      for (const f of ['auditee_name', 'auditee_state', 'auditee_zip', 'entity_type', 'audit_year',
        'fy_start_date', 'fy_end_date', 'audit_period_covered']) {
        idx[f] = header.indexOf(f);
        if (idx[f] < 0) throw new Error(`bulk file is missing the "${f}" column`);
      }
      continue;
    }
    const f = splitCsv(line);
    const state = f[idx.auditee_state];
    if (!wanted.includes(state)) continue;
    const type = (f[idx.entity_type] ?? '').trim();
    if (type !== 'local' && type !== 'local government') continue;
    seen += 1;
    if (!inStateZip(f[idx.auditee_zip], state)) continue;
    const cls = classifyAuditee(f[idx.auditee_name], state);
    if (!cls) continue;
    const rec = {
      entity: cls.entity, kind: cls.kind, audit_year: f[idx.audit_year],
      fy_start_date: f[idx.fy_start_date], fy_end_date: f[idx.fy_end_date],
      audit_period_covered: f[idx.audit_period_covered],
    };
    rows[state].set(`${rec.entity}|${rec.audit_year}|${rec.fy_end_date}`, rec);
  }

  let changed = false;
  for (const state of wanted) {
    const out = [...rows[state].values()]
      .sort((a, b) => (a.entity === b.entity
        ? a.audit_year.localeCompare(b.audit_year)
        : a.entity.localeCompare(b.entity)));
    const csv = ['entity,kind,audit_year,fy_start_date,fy_end_date,audit_period_covered']
      .concat(out.map((r) => [r.entity, r.kind, r.audit_year, r.fy_start_date, r.fy_end_date, r.audit_period_covered].join(',')))
      .join('\n') + '\n';
    const dest = path.join(ROOT, TARGETS[state].file);
    const existing = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    const entities = new Set(out.map((r) => r.entity)).size;
    if (check) {
      const same = existing === csv;
      if (!same) changed = true;
      console.log(`${state}: ${out.length} records, ${entities} entities — ${same ? 'unchanged' : '⚠ DIFFERS from the committed extract'}`);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, csv);
      console.log(`${state}: wrote ${out.length} records, ${entities} entities -> ${TARGETS[state].file}`);
    }
  }
  console.log(`(${seen} local-government records read for these states)`);
  if (check && changed) {
    console.error('\nThe federal record has moved. Re-read the exceptions before committing: a NEW');
    console.error('non-dominant entity is a fiscal calendar nobody has acted on.');
    process.exit(1);
  }
}

/** Minimal CSV field splitter — handles the quoted, comma-bearing auditee names. */
export function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  let input = argv.includes('--input') ? argv[argv.indexOf('--input') + 1] : null;
  if (argv.includes('--download')) {
    input = path.join(ROOT, '.fac-general.csv');
    console.log(`Downloading ${BULK_URL} …`);
    const res = await fetch(BULK_URL, { redirect: 'follow' });
    if (!res.ok) { console.error(`FATAL: download failed with HTTP ${res.status}`); process.exit(1); }
    fs.writeFileSync(input, Buffer.from(await res.arrayBuffer()));
    console.log(`  saved ${(fs.statSync(input).size / 1e6).toFixed(0)} MB`);
  }
  if (!input) {
    console.error('Give --download, or --input <path to the FAC bulk general.csv>.');
    process.exit(1);
  }
  await build(input, check);
}

if (process.argv[1]?.endsWith('buildFacFiscalYearCensus.mjs')) await main();
