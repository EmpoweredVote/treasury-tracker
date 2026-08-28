/**
 * Rebuild the per-state fiscal-calendar evidence extracts under `docs/<STATE>/`
 * from the Federal Audit Clearinghouse bulk download.
 *
 *     node scripts/buildFacFiscalYearCensus.mjs --download        # fetch + build
 *     node scripts/buildFacFiscalYearCensus.mjs --input path.csv  # build from a local copy
 *     node scripts/buildFacFiscalYearCensus.mjs --input path.csv --check
 *
 *     # …and the 1998-2015 half, which lives in a separate archive:
 *     curl -L -o census.zip https://app.fac.gov/dissemination/public-data/census/csv/census-1998-2015.zip
 *     unzip -q census.zip -d census/        # 413 MB, yields <year>/ELECAUDITHEADER.csv
 *     node scripts/buildFacFiscalYearCensus.mjs --input general.csv --historic-dir census/
 *
 * ⚠ BOTH HALVES OR NEITHER. The extracts are rebuilt wholesale, so running with
 * `--input` alone rewrites them WITHOUT the historic years and silently throws
 * away 1998-2015. The builder refuses to write a smaller extract than the one
 * already committed unless `--shrink` is passed.
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
  // ⚠ "CITY OF HOPE AND AFFILIATES" is the cancer research centre, not a city,
  // and it entered the census as one the moment the HISTORIC half was merged —
  // that archive carries NO entity type, so the name is the only filter there.
  // A municipality is never consolidated with "affiliates" or incorporated.
  'AND AFFILIATES', '\\bINC\\b', '\\bLLC\\b', 'FOUNDATION',
].join('|'), 'i');

/**
 * A parenthetical naming the GOVERNING BODY is the same government —
 * "CITY OF ROCKVILLE (MAYOR AND COUNCIL)" is Rockville. ⚠ Left alone it split
 * Rockville into THREE entities ("Rockville", "…(mayor & Council)",
 * "…(mayor And Council)"), each holding part of the history.
 *
 * Any OTHER parenthetical names a DIFFERENT body — "CITY OF EASTON (THE EASTON
 * UTILITIES COMMISION)", whose misspelling slips past the COMMISSION filter —
 * and is rejected rather than silently merged into the town.
 */
const GOVERNING_BODY_PAREN = /\s*\((?:THE\s+)?(?:MAYOR\s*(?:AND|&)\s*(?:CITY\s*)?COUNCIL|CITY\s*COUNCIL|TOWN\s*COUNCIL|COUNTY\s*COMMISSIONERS|COMMISSIONERS)\)\s*$/i;

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
  const cleaned = rawName.replace(/\s+/g, ' ').trim().replace(/^"|"$/g, '').replace(/\.$/, '').trim()
    .replace(GOVERNING_BODY_PAREN, '');
  const name = cleaned.replace(STATE_SUFFIX[stateCode], '').trim().replace(/,$/, '').trim();
  // A parenthetical that survived names a DIFFERENT body, not this government.
  if (/[()]/.test(name)) return null;
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

/**
 * The Census-era (1998-2015) archive uses different column names and a coded
 * period field. ⚠ It also carries NO usable entity type — `ENTITY_TYPE` is
 * blank and `TYPEOFENTITY` is an undocumented numeric code — so the name and
 * ZIP filters are the ONLY thing separating governments from everything else in
 * that half. They are the same filters, which is why they are tested.
 */
export const PERIOD_FROM_CENSUS = { A: 'annual', B: 'biennial', O: 'other' };

/**
 * ⚠⚠ THE HISTORIC HALF STATES A STUB'S LENGTH OUTRIGHT, and the modern half
 * does not. `PERIODCOVERED='O'` with `NUMBERMONTHS=9` is a fiscal-year
 * changeover announcing itself — Fort Bend County's nine months to 2002-09-30,
 * Corpus Christi's fourteen to 2014-09-30. In the 2016+ data every stub is
 * still labelled "annual" (Huntington Beach's nine-month FY2018 among them), so
 * there the changeover has to be inferred. Keep `number_months`.
 */
async function readHistoric(dir, rows, counts) {
  const years = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name)).map((d) => d.name).sort();
  if (years.length === 0) throw new Error(`no <year>/ directories under ${dir}`);
  for (const year of years) {
    const file = path.join(dir, year, 'ELECAUDITHEADER.csv');
    if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
    const rl = readline.createInterface({
      input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity,
    });
    let idx = null;
    let pending = '';
    for await (const raw of rl) {
      // Census-era rows contain embedded newlines inside quoted fields; join
      // until the quotes balance rather than dropping the row.
      const line = pending + raw;
      if ((line.match(/"/g) ?? []).length % 2 === 1) { pending = `${line}\n`; continue; }
      pending = '';
      const f = splitCsv(line);
      if (idx === null) {
        idx = {};
        for (const c of ['AUDITEENAME', 'STATE', 'ZIPCODE', 'AUDITYEAR', 'FYENDDATE',
          'FYSTARTDATE', 'PERIODCOVERED', 'NUMBERMONTHS']) {
          idx[c] = f.indexOf(c);
          if (idx[c] < 0) throw new Error(`${file} is missing the "${c}" column`);
        }
        continue;
      }
      const state = (f[idx.STATE] ?? '').trim().toUpperCase();
      if (!TARGETS[state]) continue;
      counts.seen += 1;
      if (!inStateZip(f[idx.ZIPCODE], state)) continue;
      const cls = classifyAuditee(f[idx.AUDITEENAME], state);
      if (!cls) continue;
      const period = PERIOD_FROM_CENSUS[(f[idx.PERIODCOVERED] ?? '').trim().toUpperCase()];
      if (!period) continue;
      const rec = {
        entity: cls.entity,
        kind: cls.kind,
        audit_year: (f[idx.AUDITYEAR] ?? '').trim(),
        fy_start_date: (f[idx.FYSTARTDATE] ?? '').slice(0, 10),
        fy_end_date: (f[idx.FYENDDATE] ?? '').slice(0, 10),
        audit_period_covered: period,
        number_months: (f[idx.NUMBERMONTHS] ?? '').trim(),
      };
      if (!/^\d{4}$/.test(rec.audit_year)) continue;
      rows[state].set(`${rec.entity}|${rec.audit_year}|${rec.fy_end_date}`, rec);
    }
  }
  return years;
}

async function build(inputPath, historicDir, check, shrink) {
  const wanted = Object.keys(TARGETS);
  const rows = Object.fromEntries(wanted.map((s) => [s, new Map()]));
  const counts = { seen: 0 };
  let historicYears = [];
  if (historicDir) historicYears = await readHistoric(historicDir, rows, counts);

  if (inputPath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),  // ⚠ strict UTF-8
    crlfDelay: Infinity,
  });
  let header = null;
  let idx = {};
  for await (const line of rl) {
    if (header === null) {
      header = splitCsv(line);
      for (const f of ['auditee_name', 'auditee_state', 'auditee_zip', 'entity_type', 'audit_year',
        'fy_start_date', 'fy_end_date', 'audit_period_covered', 'number_months']) {
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
    counts.seen += 1;
    if (!inStateZip(f[idx.auditee_zip], state)) continue;
    const cls = classifyAuditee(f[idx.auditee_name], state);
    if (!cls) continue;
    const rec = {
      entity: cls.entity, kind: cls.kind, audit_year: f[idx.audit_year],
      fy_start_date: f[idx.fy_start_date], fy_end_date: f[idx.fy_end_date],
      audit_period_covered: f[idx.audit_period_covered],
      number_months: (f[idx.number_months] ?? '').trim(),
    };
    rows[state].set(`${rec.entity}|${rec.audit_year}|${rec.fy_end_date}`, rec);
  }
  }
  const seen = counts.seen;
  if (historicYears.length) console.log(`historic years read: ${historicYears[0]}-${historicYears[historicYears.length - 1]}`);

  let changed = false;
  for (const state of wanted) {
    const out = [...rows[state].values()]
      .sort((a, b) => (a.entity === b.entity
        ? a.audit_year.localeCompare(b.audit_year)
        : a.entity.localeCompare(b.entity)));
    const csv = ['entity,kind,audit_year,fy_start_date,fy_end_date,audit_period_covered,number_months']
      .concat(out.map((r) => [r.entity, r.kind, r.audit_year, r.fy_start_date, r.fy_end_date,
        r.audit_period_covered, r.number_months ?? ''].join(',')))
      .join('\n') + '\n';
    const dest = path.join(ROOT, TARGETS[state].file);
    const existing = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    const entities = new Set(out.map((r) => r.entity)).size;
    // ⚠ The extracts are rebuilt WHOLESALE. Running without --historic-dir would
    // silently drop 1998-2015 — a smaller extract is a data loss, not an update.
    const existingRecords = existing ? existing.trim().split('\n').length - 1 : 0;
    if (!check && existingRecords > out.length && !shrink) {
      console.error(`FATAL: ${state} would shrink from ${existingRecords} to ${out.length} records. `
        + 'Both halves or neither — re-run with --historic-dir, or pass --shrink if you mean it.');
      process.exit(1);
    }
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
  const shrink = argv.includes('--shrink');
  const historicDir = argv.includes('--historic-dir') ? argv[argv.indexOf('--historic-dir') + 1] : null;
  let input = argv.includes('--input') ? argv[argv.indexOf('--input') + 1] : null;
  if (argv.includes('--download')) {
    input = path.join(ROOT, '.fac-general.csv');
    console.log(`Downloading ${BULK_URL} …`);
    const res = await fetch(BULK_URL, { redirect: 'follow' });
    if (!res.ok) { console.error(`FATAL: download failed with HTTP ${res.status}`); process.exit(1); }
    fs.writeFileSync(input, Buffer.from(await res.arrayBuffer()));
    console.log(`  saved ${(fs.statSync(input).size / 1e6).toFixed(0)} MB`);
  }
  if (!input && !historicDir) {
    console.error('Give --download, or --input <FAC bulk general.csv>, and/or --historic-dir <unzipped census-1998-2015>.');
    process.exit(1);
  }
  await build(input, historicDir, check, shrink);
}

if (process.argv[1]?.endsWith('buildFacFiscalYearCensus.mjs')) await main();
