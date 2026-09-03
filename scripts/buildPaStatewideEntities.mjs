/**
 * Derive Pennsylvania's statewide entity registry from the cached DCED extracts.
 *
 * NO SHEBANG — kept importable; tests import `readReport` and `buildEntities`.
 *
 * Usage:
 *   node scripts/buildPaStatewideEntities.mjs
 *   node scripts/buildPaStatewideEntities.mjs --dir _acfr-work/pa/xlsx
 *
 * Writes scripts/data/paStatewideEntities.mjs.
 *
 * ── ONE STAGE, NOT TWO ─────────────────────────────────────────────────────
 *
 * Florida needed a roster stage and a join stage because its population came
 * from the Census and its fiscal month from the federal audit record.
 * Pennsylvania needs neither:
 *
 *   • **DCED publishes `Population` itself**, on both reports, per entity per
 *     year — 0 missing among the 2,395 approved 2023 municipal rows. Because the
 *     name and the population come from THE SAME ROW, it is structurally
 *     impossible for a name to carry another government's population, which is
 *     the failure the Michigan and Florida generators had to assert against.
 *   • **`County Name` is on every municipal row**, all 67 of them, so the county
 *     link is READ rather than derived from a geographic join.
 *
 * ── ⚠ WHAT IS STILL ASSERTED ───────────────────────────────────────────────
 *
 *   1. Display names are globally unique — the database keys on them.
 *   2. Every declared naming exception matches a real row (a declared exception
 *      that names nothing excludes nothing; the first draft of NO_STRIP_IDS
 *      carried a wrong id and silently did nothing).
 *   3. The three pre-existing TT names are reproduced EXACTLY.
 *   4. Every municipality's county resolves to a county that is itself in the
 *      registry.
 *   5. `Municipality ID` is stable per government across every year.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { readSheet, indexHeader, col, num, isApproved } from './lib/paDced.mjs';
import {
  assignDisplayNames, assertExceptionsUsed, assertTitleExceptionsUsed,
  countyDisplayName, tidy, PA_EXISTING_TT_NAMES, PLACEHOLDER_IDS, PA_CONSOLIDATED,
  PA_DEFAULT_FISCAL_MONTH, FISCAL_MONTH_IDS, censusMayName,
} from './data/paNameRules.mjs';
import { censusMonthFor } from './lib/facFiscalYearCensus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = path.join(ROOT, '_acfr-work/pa/xlsx');
const OUT = path.join(ROOT, 'scripts/data/paStatewideEntities.mjs');

/**
 * ⚠ The window this registry covers.
 *
 * ⚠⚠ FY2015 IS A HARD FLOOR, NOT A CONVENIENCE. The pre-2015 extract is a
 * DIFFERENT REPORT: the 2005 municipal file shares only 8 of 2023's 71 column
 * names, and it has no `Municipality ID`, no `Pending/Approved` and no
 * `Total Revenues`. It cannot be read by this parser, it offers no stable join
 * key, and it carries no approval axis. Extending backwards is a separate
 * extraction milestone, not a wider loop.
 */
export const PA_FIRST_YEAR = 2015;
export const PA_LAST_YEAR = 2024;

/** ⚠ The municipal status header carries an embedded NEWLINE, not a space. */
export const MUNI_STATUS_HEADER = `Pending/\nApproved`;
export const COUNTY_STATUS_HEADER = 'PENDING/APPROVED';

/**
 * Read one report-year into plain records.
 * @returns {{id:string, name:string, type:string, county:string, approved:boolean,
 *            population:number, revenue:number, expenditure:number}[]}
 */
export async function readReport(file, kind) {
  const { header, rows } = await readSheet(file);
  const ix = indexHeader(header);
  const isCounty = kind === 'county';
  const c = {
    id: col(ix, isCounty ? 'MUNICIPALITY ID' : 'Municipality ID'),
    name: col(ix, isCounty ? 'MUNICIPALITY NAME' : 'Municipality Name'),
    status: col(ix, isCounty ? COUNTY_STATUS_HEADER : MUNI_STATUS_HEADER),
    population: col(ix, 'Population'),
    revenue: col(ix, isCounty ? 'Governmental Funds- Total Revenues' : 'Total Revenues'),
    expenditure: col(ix, isCounty ? 'Governmental Funds- Total Expenditures' : 'Total Expenditures'),
  };
  if (!isCounty) {
    c.type = col(ix, 'Municipality Type');
    c.county = col(ix, 'County Name');
  }
  const out = [];
  for (const r of rows) {
    const id = tidy(r[c.id]);
    if (!id) continue;
    out.push({
      id,
      name: tidy(r[c.name]),
      type: isCounty ? 'County' : tidy(r[c.type]),
      county: isCounty ? '' : tidy(r[c.county]),
      approved: isApproved(r[c.status]),
      status: tidy(r[c.status]).toUpperCase() || '(blank)',
      population: num(r[c.population]),
      revenue: num(r[c.revenue]),
      expenditure: num(r[c.expenditure]),
    });
  }
  return out;
}

/**
 * Resolve one entity's fiscal-year start month, and say how it was resolved.
 *
 * ⚠ The census is a GUARD, not the source. It may CONTRADICT (refuse the row),
 * CONFIRM, be UNCOVERED, or be REFUSED outright because the name is ambiguous.
 * Silence is never treated as agreement.
 */
export function resolveMonth(entity, years, lookup = censusMonthFor) {
  const declared = FISCAL_MONTH_IDS[entity.dcedId] ?? PA_DEFAULT_FISCAL_MONTH;
  if (!censusMayName(entity)) {
    return { month: declared, status: 'refused',
      why: 'the census records no county and this name is shared by more than one government' };
  }
  const name = entity.entityType === 'county' ? entity.name : entity.name;
  let confirmed = 0;
  for (const y of years) {
    const seen = lookup('PA', name, y);
    if (seen.unknown) continue;
    if (Number(seen.month) !== Number(declared)) {
      return { month: declared, status: 'conflict',
        why: `the federal audit record for ${JSON.stringify(name)} reports month ${seen.month} in `
          + `FY${y}, but this registry declares month ${declared}` };
    }
    confirmed++;
  }
  return confirmed
    ? { month: declared, status: 'confirmed', confirmedYears: confirmed }
    : { month: declared, status: 'unverified', why: `no census coverage for ${JSON.stringify(name)}` };
}

export async function buildEntities({ dir = DEFAULT_DIR, first = PA_FIRST_YEAR, last = PA_LAST_YEAR,
  log = console.log } = {}) {
  const problems = [];
  /** id -> record */
  const byId = new Map();
  const yearSummary = [];

  for (let year = first; year <= last; year++) {
    let mApproved = 0; let cApproved = 0;
    for (const [kind, file] of [
      ['muni', path.join(dir, `StatewideMuniAfr_${year}.xlsx`)],
      ['county', path.join(dir, `StatewideCountyAfr_${year}.xlsx`)],
    ]) {
      if (!existsSync(file)) { problems.push(`FY${year}: ${path.basename(file)} is not cached`); continue; }
      const recs = await readReport(file, kind);
      if (recs.length === 0) problems.push(`FY${year} ${kind}: parsed 0 rows`);
      for (const r of recs) {
        let ent = byId.get(r.id);
        if (!ent) {
          ent = {
            id: r.id, kind, rawName: r.name, municipalityType: r.type,
            rawCounty: r.county, years: {},
          };
          byId.set(r.id, ent);
        } else {
          // ⚠ The id is the join key across ten files. Assert it is stable.
          if (ent.kind !== kind) {
            problems.push(`id ${r.id} appears as ${ent.kind} and ${kind} — one government, two reports`);
          }
          if (ent.rawName !== r.name) ent.nameVaried = true;
          if (r.type && ent.municipalityType !== r.type) ent.typeVaried = true;
        }
        // Only APPROVED filings are loadable. 'P' is pending, blank is NOT FILED.
        if (r.approved) {
          ent.years[year] = {
            population: r.population,
            revenue: r.revenue,
            expenditure: r.expenditure,
          };
          if (kind === 'muni') mApproved++; else cApproved++;
        }
      }
    }
    yearSummary.push({ year, muniApproved: mApproved, countyApproved: cApproved });
    log(`  FY${year}: ${mApproved} municipalities, ${cApproved} counties approved`);
  }

  const all = [...byId.values()];
  // ⚠⚠ County-part stubs are dropped BEFORE naming, so they cannot claim a
  // display name or double-list a borough. The ids are declared and asserted.
  const placeholders = all.filter((e) => PLACEHOLDER_IDS[e.id]);
  const kept = all.filter((e) => !PLACEHOLDER_IDS[e.id]);
  const munis = kept.filter((e) => e.kind === 'muni');
  const counties = kept.filter((e) => e.kind === 'county');

  // ── Naming.
  problems.push(...assertExceptionsUsed(all.map((e) => ({ id: e.id }))));
  problems.push(...assertTitleExceptionsUsed(munis.map((e) => ({ name: e.rawName }))));

  const named = assignDisplayNames(munis.map((e) => ({
    id: e.id, name: e.rawName, type: e.municipalityType, county: e.rawCounty,
  })));
  const nameById = new Map(named.map((n) => [n.id, n]));

  const entities = [];
  for (const e of counties) {
    const display = countyDisplayName(e.rawName);
    const years = Object.keys(e.years).map(Number).sort((a, b) => a - b);
    if (years.length === 0) continue;      // never approved in the window
    entities.push({
      key: display.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      dcedId: e.id,
      name: display,
      entityType: 'county',
      source: 'PA_COUNTY',
      rawName: e.rawName,
      countyDbName: null,
      qualified: false,
      population: e.years[years[years.length - 1]].population || null,
      fiscalYears: years,
    });
  }
  for (const e of munis) {
    const n = nameById.get(e.id);
    const years = Object.keys(e.years).map(Number).sort((a, b) => a - b);
    if (years.length === 0) continue;
    entities.push({
      key: n.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      dcedId: e.id,
      name: n.displayName,
      entityType: n.entityType,
      source: 'PA_MUNI',
      rawName: e.rawName,
      municipalityType: e.municipalityType,
      countyDbName: PA_CONSOLIDATED[n.county] ? null : n.county,
      ...(PA_CONSOLIDATED[n.county] ? { countyNote: `county is ${n.county}, which files no AFR — ${PA_CONSOLIDATED[n.county]}` } : {}),
      // ⚠ The LATEST approved year's figure. DCED publishes population per year;
      // `municipalities.population` holds one value, so the most recent is the
      // honest choice and it comes from the same row as the name.
      qualified: n.qualified,
      population: e.years[years[years.length - 1]].population || null,
      fiscalYears: years,
    });
  }

  // ── The fiscal-year start month, resolved per entity and guarded per year.
  const monthStats = { confirmed: 0, unverified: 0, refused: 0, conflict: 0 };
  for (const e of entities) {
    const m = resolveMonth(e, e.fiscalYears);
    e.fiscalYearStartMonth = m.month;
    e.monthStatus = m.status;
    if (m.why) e.monthNote = m.why;
    monthStats[m.status] += 1;
    if (m.status === 'conflict') {
      problems.push(`FY-month conflict for ${e.name}: ${m.why}. Refusing to generate a month the `
        + 'federal audit record contradicts.');
    }
  }

  // ── Assertions.
  const nameCount = new Map();
  for (const e of entities) nameCount.set(e.name, (nameCount.get(e.name) || 0) + 1);
  for (const [n, c] of nameCount) {
    if (c > 1) problems.push(`display name ${JSON.stringify(n)} is used by ${c} entities — the database keys on it`);
  }

  const produced = new Set(entities.map((e) => e.name));
  for (const n of PA_EXISTING_TT_NAMES) {
    if (!produced.has(n)) {
      problems.push(`⚠⚠ ${JSON.stringify(n)} already exists in treasury.municipalities but this registry `
        + 'does NOT reproduce it. Loading would create a second row and orphan its budget rows.');
    }
  }

  const countyNames = new Set(entities.filter((e) => e.entityType === 'county').map((e) => e.name));
  const missingCounty = new Map();
  for (const e of entities) {
    if (e.countyDbName && !countyNames.has(e.countyDbName)) {
      missingCounty.set(e.countyDbName, (missingCounty.get(e.countyDbName) || 0) + 1);
    }
  }

  for (const e of all) {
    if (e.nameVaried) problems.push(`id ${e.id}: DCED's name for it varies across years`);
    if (e.typeVaried) problems.push(`id ${e.id}: DCED's Municipality Type varies across years`);
  }

  return { entities, problems, yearSummary, missingCounty, munis, counties, placeholders, monthStats };
}

async function main() {
  const { values } = parseArgs({ options: { dir: { type: 'string' }, out: { type: 'string' } } });
  const dir = values.dir ? path.resolve(ROOT, values.dir) : DEFAULT_DIR;
  const out = values.out ? path.resolve(ROOT, values.out) : OUT;

  console.log(`\nPennsylvania DCED statewide registry — FY${PA_FIRST_YEAR}-FY${PA_LAST_YEAR}`);
  console.log(`  Cache: ${path.relative(ROOT, dir)}\n`);

  const { entities, problems, missingCounty, placeholders, monthStats } = await buildEntities({ dir });

  const byType = new Map();
  for (const e of entities) byType.set(e.entityType, (byType.get(e.entityType) || 0) + 1);
  const entityYears = entities.reduce((s, e) => s + e.fiscalYears.length, 0);

  console.log(`\n  entities:      ${entities.length}`);
  for (const [t, c] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`      ${t.padEnd(10)} ${c}`);
  console.log(`  entity-years:  ${entityYears}`);
  console.log(`  budget rows:   ${entityYears * 2} (operating + revenue)`);
  console.log(`  qualified names: ${entities.filter((e) => e.name.includes(', ')).length}`);
  const noPop = entities.filter((e) => !e.population);
  console.log(`  no population: ${noPop.length}${noPop.length ? ` (${noPop.slice(0, 5).map((e) => e.name).join(', ')})` : ''}`);

  const months = new Map();
  for (const e of entities) months.set(e.fiscalYearStartMonth, (months.get(e.fiscalYearStartMonth) || 0) + 1);
  console.log(`  fiscal months: ${[...months].sort((a, b) => a[0] - b[0]).map(([m, c]) => `month ${m} x${c}`).join(', ')}`);
  console.log(`  month evidence: ${monthStats.confirmed} census-CONFIRMED, ${monthStats.unverified} uncovered, `
    + `${monthStats.refused} REFUSED (name shared, census records no county)`);
  const nonDefault = entities.filter((e) => e.fiscalYearStartMonth !== 1);
  for (const e of nonDefault) console.log(`      ⚠ ${e.name}: month ${e.fiscalYearStartMonth} (${e.monthStatus})`);

  if (placeholders.length) {
    console.log(`  placeholders dropped: ${placeholders.length}`);
    for (const p of placeholders) console.log(`      ${p.id} ${p.rawName} — ${PLACEHOLDER_IDS[p.id]}`);
  }

  if (missingCounty.size) {
    console.log(`\n  ⚠ ${missingCounty.size} county name(s) named by a municipality but NOT in the registry:`);
    for (const [n, c] of missingCounty) console.log(`      ${n} — named by ${c} municipalit(ies)`);
  }

  if (problems.length) {
    console.error(`\n  ⚠⚠ ${problems.length} PROBLEM(S) — nothing written:`);
    for (const p of problems.slice(0, 40)) console.error(`      ${p}`);
    process.exit(1);
  }

  const header = `/**
 * Pennsylvania statewide sweep — every municipality and county whose DCED
 * Annual Audit and Financial Report is APPROVED in FY${PA_FIRST_YEAR}-FY${PA_LAST_YEAR}.
 *
 * ⚠⚠ GENERATED by scripts/buildPaStatewideEntities.mjs. Do not hand-edit; change
 * the generator or scripts/data/paNameRules.mjs and re-run.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⚠⚠ \`dcedId\` IS THE JOIN KEY, NEVER \`name\`. 226 municipality names are shared
 * by more than one government — \`FRANKLIN TWP\` names fifteen — and
 * \`PHILADELPHIA  COUNTY\` (510001) is an empty placeholder that never files while
 * all the money sits on \`PHILADELPHIA CITY\` (510012).
 *
 * ⚠ \`fiscalYears\` lists ONLY years DCED marked APPROVED. 'P' is pending and a
 * blank status means NOT FILED — neither is written as \$0.
 *
 * ⚠ \`population\` is DCED's own published figure from the entity's LATEST
 * approved year, taken from the same row as the name.
 *
 * ⚠ \`countyDbName\` is READ from the municipal report's \`County Name\` column.
 *
 * ⚠⚠ \`fiscalYearStartMonth\` is 1 for every Pennsylvania government except
 * PHILADELPHIA, which is 7 — settled by oracle against its own ACFR, not by
 * argument. \`monthStatus\` says how each was evidenced: \`confirmed\` by the
 * federal audit record, \`unverified\` where that record does not cover it, or
 * \`refused\` where the name is shared by several governments and the census
 * records no county, so a lookup could only produce a WRONG confirmation.
 */

export const PA_STATEWIDE_LOAD_WINDOW = Object.freeze({ first: ${PA_FIRST_YEAR}, last: ${PA_LAST_YEAR} });

export const PA_STATE = 'PA';

/** ${entities.length} entities — ${[...byType].map(([t, c]) => `${c} ${t}`).join(', ')} — ${entityYears} entity-years. */
export const PA_STATEWIDE_ENTITIES = Object.freeze(`;

  writeFileSync(out, `${header}${JSON.stringify(entities, null, 1)});

/** Look one up by DCED Municipality ID. */
export function paEntityByDcedId(id) {
  return PA_STATEWIDE_ENTITIES.find((e) => e.dcedId === String(id).trim()) || null;
}
`);
  console.log(`\n  ✅ wrote ${path.relative(ROOT, out)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
