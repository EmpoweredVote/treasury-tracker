/**
 * Turn the derived roster into the loadable Michigan statewide entity module.
 *
 * NO SHEBANG — kept importable.
 *
 * Usage:
 *   node scripts/buildMiStatewideEntities.mjs --roster _acfr-work/mi-sweep/roster.json
 *
 * Writes scripts/data/miStatewideEntities.mjs.
 *
 * ── ⚠⚠ NAME AND POPULATION COME FROM THE SAME CENSUS ROW ───────────────────
 *
 * The display name is the CENSUS name, not the F-65's. Two reasons, and the
 * second is the load-bearing one:
 *
 *  1. The F-65 spells the same unit differently across years (`Detroit` /
 *     `City of Detroit`) and inconsistently between units (`St. Joseph` with a
 *     period, `St Clair` without).
 *  2. `treasury_ensure_municipality` keys on NAME. Taking the name and the
 *     population from ONE Census row makes it impossible for TT to show a name
 *     matched to a different government's population — the failure that would
 *     otherwise pair the city of St. Joseph (7,930) with St. Joseph County
 *     (61,171) while moving $0.
 *
 * ⚠ Detroit and Wayne County already exist in TT under exactly these names, so
 * the sweep re-uses their rows rather than creating duplicates. The generator
 * ASSERTS that, because a silent rename would orphan 142 existing rows.
 *
 * ── ⚠⚠ UNITS WHOSE MONTH THE FEDERAL AUDIT RECORD CONTRADICTS ──────────────
 *
 * `scripts/auditMiF65FiscalMonths.mjs` measured the F-65's self-reported
 * `fiscalendmonth` against the FAC census: 2,141 entity-years agree, 27
 * conflict, 3,634 are uncovered. 98.8% where measurable — but the 27 are real
 * disagreements with the units' own Single Audit filings, and Lapeer County is
 * the sharpest: the census reports month 1 for 1998-2025 while the F-65 claims
 * month 10 from FY2022.
 *
 * Those entity-years are EXCLUDED, per year and not per unit, and declared. A
 * wrong fiscal month moves $0 and passes every tie test, which is exactly why
 * this project has shipped that defect more often than any other.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { parse } from 'node:path';

import { MI_CENSUS_ALIASES, displayFromCensusName } from './data/miCensusAliases.mjs';
import { censusMonthFor } from './lib/facFiscalYearCensus.mjs';

const PLACES_CSV = '_acfr-work/mi-sweep/sub-est2024_26.csv';
const COUNTIES_CSV = '_acfr-work/co-est2024-alldata.csv';
const OUT = 'scripts/data/miStatewideEntities.mjs';

function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    // These two files have no quoted commas in the columns used here.
    const cells = l.split(',');
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

export function loadCensus() {
  const places = new Map();
  for (const r of readCsv(PLACES_CSV)) {
    if (r.SUMLEV !== '162') continue;
    places.set(r.NAME.trim(), Number(r.POPESTIMATE2024));
  }
  const counties = new Map();
  for (const r of readCsv(COUNTIES_CSV)) {
    if (r.SUMLEV !== '050' || r.STNAME !== 'Michigan') continue;
    counties.set(r.CTYNAME.trim(), Number(r.POPESTIMATE2024));
  }
  return { places, counties };
}

/**
 * Resolve one roster unit to its Census row.
 * @returns {{censusName: string, name: string, population: number}|null}
 */
export function resolveCensus(unit, { places, counties }) {
  const alias = MI_CENSUS_ALIASES[unit.name];
  if (unit.entityType === 'county') {
    const key = alias ?? unit.name;
    if (!counties.has(key)) return null;
    return { censusName: key, name: key, population: counties.get(key) };
  }
  if (alias) {
    if (!places.has(alias)) return null;
    return { censusName: alias, name: displayFromCensusName(alias), population: places.get(alias) };
  }
  for (const suffix of [' city', ' village']) {
    const key = `${unit.name}${suffix}`;
    if (places.has(key)) {
      return { censusName: key, name: displayFromCensusName(key), population: places.get(key) };
    }
  }
  return null;
}

/**
 * ⚠ Per YEAR, not per unit. A unit with one contradicted year keeps its other
 * fifteen; excluding the whole unit would throw away good data to punish a bad
 * row, and excluding nothing would publish a period the audited record denies.
 */
export function excludedYears(unit) {
  const out = [];
  for (const [fyStr, month] of Object.entries(unit.monthsByYear ?? {})) {
    const fy = Number(fyStr);
    const seen = censusMonthFor('MI', unit.censusName ?? unit.name, fy);
    if (seen?.unknown) continue;
    if (Number(month) !== Number(seen?.month)) out.push({ fiscalYear: fy, f65: Number(month), census: Number(seen?.month) });
  }
  return out;
}

/**
 * ⚠⚠ Entity-years excluded for a reason OTHER than the fiscal-month audit.
 *
 * Marysville FY2016's published subtotals disagree with its own leaves by
 * amounts that are not a duplication: TOTAL STATE GRANTS is 1.0278x (999,832 vs
 * 972,812) and TOTAL GENERAL GOVERNMENT is 1.3952x (1,277,429 vs 915,606). The
 * other twelve subtotal defects in the sweep are all EXACTLY 2.000x and are
 * declared in lib/michiganF65.mjs, which keeps the verified subtotal and
 * suppresses the contradicted detail. That handling rests on the leaves being a
 * duplicate of each other, which is visibly untrue here.
 *
 * So the year is dropped rather than explained. Marysville keeps its other 15.
 *
 * ⚠ Found by scripts/surveyMiF65Defects.mjs, which ran all 5,775 filings before
 * anything was loaded — 5,768 clean, 99.88%.
 */
export const EXCLUDED_ENTITY_YEARS = Object.freeze([
  Object.freeze({
    municode: '742030', fiscalYear: 2016, name: 'Marysville',
    why: 'published subtotals disagree with their own leaves at 1.0278x and 1.3952x. '
      + 'Its 316 keys are each present ONCE, so this is not the duplicate-filing case — '
      + 'the filing simply does not add up, and nothing here can say which figure is wrong',
  }),
  // ⚠⚠ Emitted TWICE by the portal, like four other filings — but unlike them,
  // some keys carry DIFFERENT amounts in the two copies. dedupeFilingRows()
  // throws rather than pick one, because no basis exists for preferring either.
  Object.freeze({
    municode: '632055', fiscalYear: 2018, name: 'Farmington Hills',
    why: 'duplicate filing whose copies disagree on 3 of 264 keys',
  }),
  Object.freeze({
    municode: '420000', fiscalYear: 2016, name: 'Keweenaw County',
    why: 'duplicate filing whose copies disagree on 21 of 246 keys',
  }),
  // ⚠ Filed the Expenditure table and NO Revenue table at all — 130 rows, every
  // one T2. TT's model pairs a revenue and an expenditure series per year, and
  // there is no revenue here to pair.
  //
  // ⚠ This drops a perfectly good expenditure series to avoid publishing a
  // revenue one that does not exist. The alternative — teaching the loader to
  // write a single face — is a real change for one entity-year in 5,772, and
  // writing $0 revenue is not an alternative at all: it would state that Auburn
  // received nothing in FY2019.
  Object.freeze({
    municode: '092010', fiscalYear: 2019, name: 'Auburn',
    why: 'the filing contains no Revenue table — 130 rows, all T2 (Expenditure)',
  }),
]);

export function keyFor(name, entityType) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return entityType === 'county' ? slug : slug;
}

function main() {
  const { values } = parseArgs({
    options: { roster: { type: 'string', default: '_acfr-work/mi-sweep/roster.json' } },
  });
  const roster = JSON.parse(readFileSync(values.roster, 'utf8'));
  const census = loadCensus();

  const entities = [];
  const unresolved = [];
  const excluded = [];
  const seenKeys = new Map();

  for (const unit of roster) {
    const res = resolveCensus(unit, census);
    if (!res) { unresolved.push(unit); continue; }
    const withCensus = { ...unit, censusName: res.name };
    const drops = excludedYears(withCensus);
    const dropSet = new Set(drops.map((d) => d.fiscalYear));
    for (const x of EXCLUDED_ENTITY_YEARS) {
      if (x.municode === unit.municode) dropSet.add(x.fiscalYear);
    }
    if (drops.length) excluded.push({ municode: unit.municode, name: res.name, drops });

    const years = (unit.fiscalYears ?? []).filter((y) => !dropSet.has(y));
    if (years.length === 0) continue;

    const key = keyFor(res.name, unit.entityType);
    if (seenKeys.has(key)) {
      throw new Error(`duplicate entity key ${key}: ${seenKeys.get(key)} and ${unit.municode}`);
    }
    seenKeys.set(key, unit.municode);

    entities.push({
      key,
      name: res.name,
      municode: unit.municode,
      unitType: unit.unitType,
      entityType: unit.entityType,
      censusName: res.name,
      population: res.population,
      fiscalYears: years,
      monthsByYear: Object.fromEntries(
        Object.entries(unit.monthsByYear).filter(([y]) => !dropSet.has(Number(y)))),
    });
  }

  // ⚠⚠ Detroit and Wayne County already hold 142 rows in TT under these exact
  // names. A rename here would orphan them behind a duplicate entity.
  for (const [municode, expected] of [['822050', 'Detroit'], ['820000', 'Wayne County']]) {
    const e = entities.find((x) => x.municode === municode);
    if (!e) throw new Error(`the session-7a entity ${municode} fell out of the roster`);
    if (e.name !== expected) {
      throw new Error(`${municode} would be renamed ${expected} -> ${e.name}, orphaning its existing rows`);
    }
  }

  const totalYears = entities.reduce((n, e) => n + e.fiscalYears.length, 0);
  const body = `${HEADER}
export const MI_STATEWIDE_LOAD_WINDOW = Object.freeze({ first: 2010, last: 2025 });

/** ${entities.length} units — ${entities.filter((e) => e.entityType === 'city').length} cities, `
    + `${entities.filter((e) => e.entityType === 'county').length} counties — ${totalYears} entity-years. */
export const MI_STATEWIDE_ENTITIES = Object.freeze(${JSON.stringify(entities, null, 1)}.map(Object.freeze));

export function entityByMunicode(municode) {
  const key = String(municode ?? '').trim().padStart(6, '0');
  return MI_STATEWIDE_ENTITIES.find((e) => e.municode === key) ?? null;
}

export function entityByKey(key) {
  return MI_STATEWIDE_ENTITIES.find((e) => e.key === key) ?? null;
}
`;
  writeFileSync(OUT, body);

  console.log(`roster units      : ${roster.length}`);
  console.log(`entities written  : ${entities.length}  (${totalYears} entity-years)`);
  console.log(`unresolved (no Census match, EXCLUDED): ${unresolved.length}`);
  for (const u of unresolved) console.log(`  ⚠ ${u.municode} ${u.entityType} ${u.name}`);
  console.log(`units with EXCLUDED years (census contradicts the F-65): ${excluded.length}`);
  for (const e of excluded) {
    console.log(`  ⚠ ${e.municode} ${e.name}: dropped FY`
      + e.drops.map((d) => `${d.fiscalYear}(F-65 ${d.f65} vs census ${d.census})`).join(', '));
  }
  console.log(`\nwrote ${OUT}`);
  if (entities.length === 0) { console.error('REFUSING: no entities.'); return 1; }
  return 0;
}

const HEADER = `/**
 * Michigan statewide sweep — every CITY and COUNTY that filed an F-65 in
 * FY2010-FY2025, with the entity-years the federal audit record contradicts
 * already removed.
 *
 * ⚠⚠ GENERATED by scripts/buildMiStatewideEntities.mjs. Do not hand-edit; change
 * the generator or scripts/data/miCensusAliases.mjs and re-run.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⚠⚠ \`municode\` IS THE JOIN KEY AND IT IS ZERO-PADDED TO SIX. The F-65 emits it
 * as a NUMBER in fifteen of the sixteen City datasets and as a STRING in FY2020,
 * so Harrisville is \`12010\` everywhere except FY2020, where it is \`012010\`.
 * Joining on the raw value splits 18 cities into a 15-year entity and a phantom
 * FY2020 twin.
 *
 * ⚠⚠ \`monthsByYear\` IS PER YEAR because four units changed fiscal calendar
 * mid-series. Write the month for the year being loaded, never one constant per
 * unit — a wrong month moves $0 and passes every tie test.
 *
 * ⚠ \`name\` and \`population\` come from the SAME Census PEP Vintage 2024 row, so
 * a name can never be paired with another government's population. See
 * scripts/data/miCensusAliases.mjs for the twelve units whose F-65 spelling
 * differs, and the St. Joseph city/county trap it exists to avoid.
 */
`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(main());
}
