/**
 * Derive South Carolina's statewide COUNTY registry from the cached RFA workbook.
 *
 * NO SHEBANG — kept importable; tests import the pure builders below.
 *
 * Usage:
 *   node scripts/buildScStatewideEntities.mjs
 *   node scripts/buildScStatewideEntities.mjs --file _acfr-work/sc/xlsx/ScLgfReport_2024.xlsx
 *
 * Writes scripts/data/scStatewideEntities.mjs.
 *
 * ── ⚠⚠ COUNTIES ONLY, AND THAT IS A PROPERTY OF THE PUBLISHER ───────────────
 *
 * RFA's report publishes NO INDIVIDUAL MUNICIPALITY. Each county sheet's
 * "Total Revenues (Cities only)*" block is every city in the county summed
 * together — its own footnote says so. This registry therefore cannot and does
 * not contain a South Carolina city, and finishing it does NOT "do South
 * Carolina": the state's cities need their own ACFRs. See scKnightEntities.mjs,
 * which holds Columbia and Myrtle Beach on exactly that route.
 *
 * ── THREE JOINS, EACH ASSERTED RATHER THAN TRUSTED ──────────────────────────
 *
 * Unlike Pennsylvania — where DCED publishes the population on the same row as
 * the name, so a name structurally cannot carry another government's figure —
 * South Carolina needs three sources joined, and every one of them is a place a
 * wrong-but-plausible value could enter:
 *
 *   1. **The workbook** gives the sheet name and the `County Info` submission
 *      matrix. Driven from the SHEET side, never from `County Info`, because
 *      that sheet's last three rows are `Total Counties That Reported`,
 *      `Total Counties That Did Not Report` and `Percentage of Counties That
 *      Reported` — summary rows that a generator iterating the matrix would
 *      ingest as three counties.
 *   2. **The Census PEP** gives the population, matched on `<sheet> County`.
 *   3. **The federal audit record** gives the fiscal month.
 *
 * ⚠⚠ THE CENSUS FILE CONTAINS A COUNTY THAT IS NOT IN SOUTH CAROLINA.
 * `docs/fac/fac-local-fiscal-year-ends.csv` carries a row `SC,Bertie County` —
 * Bertie County is in NORTH CAROLINA, and it reaches the SC census because a
 * filer stamped the wrong state on its own Single Audit. Driving the join from
 * the workbook's 46 sheets makes it inert; driving it from the census would have
 * produced a 47th county with no sheet, no population and no money. This is the
 * same shape as the `SC,Columbia` / `MO,Columbia` trap recorded in
 * scKnightEntities.mjs: a name alone is never the key.
 *
 * ⚠ `McCormick` is spelled `Mccormick County` in the federal record. The
 * resolution is case-insensitive and the resolved string is WRITTEN OUT as
 * `censusName`, so the alias is visible in the registry rather than buried in a
 * matcher.
 *
 * ── ⚠ THE MONTH IS EVIDENCED PER COUNTY, NEVER DEFAULTED ────────────────────
 *
 * RFA says only "fiscal year end on or before June 30", which is not a claim of
 * uniformity, and `project_fysm_column_default_one_defect` is the entire reason
 * this file does not simply write 7. Every county is looked up individually and
 * carries a `monthStatus` recording how it was evidenced. All 46 happen to come
 * back `confirmed` at month 7 — but that is a MEASUREMENT reported by the
 * generator, not an assumption baked into it, and if a future edition adds a
 * county the census cannot cover, this will say so instead of guessing.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { readWorkbook, readCountyInfo, NON_COUNTY_SHEETS, SC_LOAD_FLOOR } from './lib/scRfa.mjs';
import { censusMonthFor, buildCensus } from './lib/facFiscalYearCensus.mjs';
import { SC_ENTITIES, SC_SOURCE, SC_LOAD_WINDOW } from './data/scKnightEntities.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FILE = path.join(ROOT, '_acfr-work/sc/xlsx/ScLgfReport_2024.xlsx');
const DEFAULT_POP = path.join(ROOT, 'cache/co-est2024-alldata.csv');
const OUT = path.join(ROOT, 'scripts/data/scStatewideEntities.mjs');

export const SC_STATE = 'SC';
export const SC_COUNTY_FIPS = '45';

/**
 * ⚠ The three `County Info` rows that are NOT counties.
 *
 * Declared by exact string and ASSERTED PRESENT below. A declared exclusion that
 * names nothing excludes nothing — Pennsylvania shipped one naming a real but
 * wrong government, and only reconciling the drop count found it.
 */
export const COUNTY_INFO_SUMMARY_ROWS = Object.freeze([
  'Total Counties That Reported',
  'Total Counties That Did Not Report',
  'Percentage of Counties That Reported',
]);

/** South Carolina has 46 counties. A count that is not 46 is a changed workbook. */
export const SC_COUNTY_COUNT = 46;

/** `Abbeville` -> `abbeville-county`. Must reproduce the two pre-existing keys. */
export function keyFor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** `Abbeville` -> `Abbeville County`, the display name and the database key. */
export function displayNameFor(sheet) {
  return `${sheet} County`;
}

/**
 * Read SUMLEV-050 populations for one state FIPS out of the Census PEP file.
 *
 * @returns {Map<string, {population: number, fips: string, ctyName: string}>}
 *          keyed by UPPER-CASED county name, so `McCormick` and `Mccormick`
 *          resolve to the same row.
 */
export function readPopulations(csvPath, stateFips = SC_COUNTY_FIPS) {
  const text = readFileSync(csvPath, 'latin1');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  const ix = (n) => {
    const i = head.indexOf(n);
    if (i < 0) throw new Error(`Population CSV has no column ${n}`);
    return i;
  };
  const [SUMLEV, STATE, COUNTY, CTYNAME, POP] = [
    ix('SUMLEV'), ix('STATE'), ix('COUNTY'), ix('CTYNAME'), ix('POPESTIMATE2024'),
  ];
  const out = new Map();
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    if (f[SUMLEV] !== '050' || f[STATE] !== stateFips) continue;
    const ctyName = f[CTYNAME].trim();
    const upper = ctyName.toUpperCase();
    if (out.has(upper)) throw new Error(`Duplicate county in population CSV: ${ctyName}`);
    const population = Number(f[POP]);
    if (!Number.isInteger(population) || population <= 0) {
      throw new Error(`Unusable population for ${ctyName}: ${JSON.stringify(f[POP])}`);
    }
    out.set(upper, { population, fips: `${stateFips}${f[COUNTY]}`, ctyName });
  }
  return out;
}

/**
 * Resolve one county's fiscal month against the federal audit record.
 *
 * ⚠ Case-insensitive, because the record spells McCormick `Mccormick County`.
 * The resolved key is returned so the caller can WRITE IT OUT rather than
 * re-derive it at load time.
 *
 * @returns {{censusName: string|null, month: number|null, status: string, note: string|null}}
 */
export function resolveMonth(displayName, censusIndex) {
  const hit = censusIndex.get(displayName.toUpperCase());
  if (!hit) {
    return {
      censusName: null,
      month: null,
      status: 'unverified',
      note: `${displayName}, ${SC_STATE} is not in the federal audit record — absence is not evidence`,
    };
  }
  const seen = censusMonthFor(SC_STATE, hit, undefined);
  if (seen.unknown) {
    return { censusName: hit, month: null, status: 'unverified', note: seen.unknown };
  }
  return { censusName: hit, month: seen.month, status: 'confirmed', note: null };
}

/**
 * Build the 46-county registry.
 *
 * @returns {{entities: object[], report: object}}
 */
export function buildEntities({ wb, populations, censusIndex }) {
  const sheets = [...wb.sheets.keys()].filter((n) => !NON_COUNTY_SHEETS.has(n));
  if (sheets.length !== SC_COUNTY_COUNT) {
    throw new Error(`Expected ${SC_COUNTY_COUNT} county sheets, found ${sheets.length}: ${sheets.join(', ')}`);
  }

  const countyInfo = readCountyInfo(wb.sheets.get('County Info'));
  const infoKeys = new Set([...countyInfo.keys()]);

  // ⚠ A declared exclusion that names nothing excludes nothing. Assert each
  // summary row is actually there before trusting that we excluded it.
  for (const row of COUNTY_INFO_SUMMARY_ROWS) {
    if (!infoKeys.has(row)) {
      throw new Error(`Declared County Info summary row is absent, so it excludes nothing: ${JSON.stringify(row)}`);
    }
  }
  const infoCounties = [...infoKeys].filter((k) => !COUNTY_INFO_SUMMARY_ROWS.includes(k));
  if (infoCounties.length !== SC_COUNTY_COUNT) {
    throw new Error(`County Info holds ${infoCounties.length} counties after excluding `
      + `${COUNTY_INFO_SUMMARY_ROWS.length} summary rows, expected ${SC_COUNTY_COUNT}`);
  }

  const entities = [];
  const unverified = [];
  for (const sheet of sheets) {
    // ⚠ `reportedYears()` silently treats a county ABSENT from County Info as
    // reported in every year. Every sheet must have a matrix row, or one of the
    // two disagreeing quality signals is quietly not being consulted at all.
    if (!infoKeys.has(sheet.trim())) {
      throw new Error(`Sheet ${sheet} has no County Info row — its submission signal would go unread`);
    }

    const name = displayNameFor(sheet);
    const pop = populations.get(name.toUpperCase());
    if (!pop) throw new Error(`No Census population row for ${name}`);

    const m = resolveMonth(name, censusIndex);
    if (m.status !== 'confirmed') unverified.push({ name, note: m.note });

    entities.push({
      key: keyFor(name),
      name,
      entityType: 'county',
      source: SC_SOURCE.RFA_COUNTY,
      fips: pop.fips,
      population: pop.population,
      sheet,
      countyInfoName: sheet.trim(),
      censusName: m.censusName,
      fiscalYearStartMonth: m.month,
      monthStatus: m.status,
      parentCountyKey: null,
    });
  }

  // Display names key the database. Two counties sharing one would silently
  // merge two governments' budgets onto one entity.
  const names = new Set();
  for (const e of entities) {
    if (names.has(e.name)) throw new Error(`Duplicate display name ${e.name}`);
    names.add(e.name);
  }

  assertOverlapMatchesKnightRegistry(entities);

  return {
    entities,
    report: {
      counties: entities.length,
      confirmed: entities.filter((e) => e.monthStatus === 'confirmed').length,
      unverified,
      months: [...new Set(entities.map((e) => e.fiscalYearStartMonth))].sort((a, b) => a - b),
    },
  };
}

/**
 * ⚠⚠ The two counties already in TT must be reproduced EXACTLY.
 *
 * `treasury_ensure_municipality` keys on (name, state, entity_type) — all three.
 * A drifted display name or entity type here does not update Richland County, it
 * CREATES A SECOND ONE, and the 26 rows already loaded would sit on the orphan
 * while the sweep wrote a parallel series next to them. Population is checked
 * too: it is written by the same RPC, so a drift would silently restate a figure
 * a reader sees.
 */
export function assertOverlapMatchesKnightRegistry(entities) {
  const byKey = new Map(entities.map((e) => [e.key, e]));
  const existing = SC_ENTITIES.filter((e) => e.source === SC_SOURCE.RFA_COUNTY);
  if (existing.length === 0) throw new Error('scKnightEntities.mjs declares no RFA county to reconcile against');

  for (const prior of existing) {
    const now = byKey.get(prior.key);
    if (!now) throw new Error(`Statewide registry lost the pre-existing county ${prior.key}`);
    for (const field of ['name', 'entityType', 'population', 'sheet', 'countyInfoName', 'fiscalYearStartMonth']) {
      if (now[field] !== prior[field]) {
        throw new Error(`${prior.key}.${field} drifted from scKnightEntities.mjs: `
          + `${JSON.stringify(prior[field])} -> ${JSON.stringify(now[field])}`);
      }
    }
  }
  return existing.length;
}

function render(entities, report) {
  const months = report.months.join(', ');
  return `/**
 * South Carolina statewide sweep — all ${SC_COUNTY_COUNT} counties of the RFA Local Government
 * Finance Report.
 *
 * ⚠⚠ GENERATED by scripts/buildScStatewideEntities.mjs. Do not hand-edit; change
 * the generator and re-run.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⚠⚠ COUNTIES ONLY. RFA publishes no individual municipality — each county
 * sheet's "Cities only" block is every city in that county summed together. South
 * Carolina's cities are in scKnightEntities.mjs on the ACFR route, and loading
 * this registry does NOT complete South Carolina.
 *
 * ⚠ \`sheet\` is the workbook tab (the bare county name) and \`countyInfoName\` is
 * the key in the \`County Info\` submission matrix. Both are READ from the
 * workbook and written out rather than derived, so a renamed tab in a future
 * edition fails loudly instead of matching nothing.
 *
 * ⚠ \`censusName\` is the entity name as spelled in the FEDERAL AUDIT RECORD,
 * which is not always the Census spelling — McCormick County is filed as
 * \`Mccormick County\`. Recorded, not re-derived.
 *
 * ⚠ \`fiscalYearStartMonth\` is evidenced PER COUNTY against that record, never
 * defaulted from a state norm. \`monthStatus\` says how: \`confirmed\` by the
 * entity's own Single Audit filings, or \`unverified\` where the record does not
 * cover it. Measured months in this edition: ${months}.
 *
 * ⚠ \`population\` is POPESTIMATE2024 from the Census PEP county file, joined on
 * \`<county> County\`; \`fips\` is the state+county FIPS from the same row, carried
 * so the join can be re-checked without re-deriving it.
 */

export const SC_STATEWIDE_STATE = '${SC_STATE}';

/** FY${SC_LOAD_WINDOW.first}-FY${SC_LOAD_WINDOW.last} — the floor is RFA's own bonds/leases and local
 * option sales tax definitional break at FY${SC_LOAD_FLOOR}, not a convenience. See
 * scripts/lib/scRfa.mjs. */
export const SC_STATEWIDE_LOAD_WINDOW = Object.freeze({ first: ${SC_LOAD_WINDOW.first}, last: ${SC_LOAD_WINDOW.last} });

/** ${report.counties} counties — ${report.confirmed} with a federally confirmed fiscal month. */
export const SC_STATEWIDE_ENTITIES = Object.freeze(${JSON.stringify(entities, null, 1)});

export function scStatewideByKey(key) {
  return SC_STATEWIDE_ENTITIES.find((e) => e.key === key) ?? null;
}
`;
}

export async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', default: DEFAULT_FILE },
      populations: { type: 'string', default: DEFAULT_POP },
    },
  });
  for (const [label, p] of [['workbook', values.file], ['population CSV', values.populations]]) {
    if (!existsSync(p)) throw new Error(`Missing ${label}: ${p}`);
  }

  const wb = await readWorkbook(values.file);
  const populations = readPopulations(values.populations);

  // Case-insensitive index over the federal record, so `Mccormick County`
  // resolves from `McCormick County` and the alias is recorded, not hidden.
  const censusIndex = new Map();
  for (const name of buildCensus(SC_STATE).keys()) censusIndex.set(name.toUpperCase(), name);

  const { entities, report } = buildEntities({ wb, populations, censusIndex });

  writeFileSync(OUT, render(entities, report), 'utf8');

  console.log(`${report.counties} counties -> ${path.relative(ROOT, OUT)}`);
  console.log(`  fiscal month: ${report.confirmed}/${report.counties} confirmed against the federal `
    + `audit record; months observed ${report.months.join(', ')}`);
  if (report.unverified.length) {
    console.log(`  ⚠ ${report.unverified.length} UNVERIFIED — a month was NOT written for these:`);
    for (const u of report.unverified) console.log(`      ${u.name}: ${u.note}`);
  }
  console.log(`  reconciled ${assertOverlapMatchesKnightRegistry(entities)} pre-existing counties `
    + 'against scKnightEntities.mjs, field for field');
  return entities;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('buildScStatewideEntities.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
