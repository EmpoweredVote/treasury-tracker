/**
 * Give Indiana's 660 governments their populations, from Census PEP 2024.
 *
 * NO SHEBANG — kept importable by tests.
 *
 * Usage:
 *   node scripts/loadIndianaPopulations.mjs --dry-run
 *   node scripts/loadIndianaPopulations.mjs --commit
 *
 * Input, both free bulk downloads with no key:
 *   cache/sub-est2024_18.csv        Indiana subcounty places
 *   cache/co-est2024-alldata.csv    every county in the country
 *
 * ── ⚠⚠ WHY THIS IS AN UPDATE AND NOT PART OF THE LOADER ────────────────────
 *
 * `treasury_ensure_municipality` is SELECT-then-INSERT-IF-NOT-FOUND with NO
 * UPDATE branch, so the Gateway sweep could only ever create these rows at
 * population 0 — it cannot raise them afterwards, and it cannot clobber a
 * population that is already right. That is why 641 of Indiana's 660
 * governments sit at 0 after a complete, correct load. This script is the only
 * thing that moves the column.
 *
 * ── ⚠⚠ UNIGOV ─────────────────────────────────────────────────────────────
 *
 * There is NO Indianapolis government in the roster: Gateway files the
 * consolidated city-county as MARION COUNTY, so Marion takes the COUNTY
 * population and the census row `Indianapolis city (balance)` is deliberately
 * unclaimed. The separately incorporated places inside Marion County — Beech
 * Grove, Lawrence, Southport, Speedway, Clermont, Cumberland — are their own
 * roster entities and take their own place populations. None of that is
 * inferred; it is read off the roster.
 *
 * ── WHAT THIS REFUSES ──────────────────────────────────────────────────────
 *
 * Anything it cannot account for. An unmatched government with no declared
 * alias or absence, an ambiguous name the county cannot resolve, a census row
 * claimed by two governments, a stale registry entry, or a non-positive
 * population all FAIL the run before a single row is written. See
 * scripts/lib/inPopulation.mjs for why each of those exists.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { readPepCsv, SUMLEV } from './lib/censusPep.mjs';
import { joinIndianaPopulations } from './lib/inPopulation.mjs';
import { IN_POPULATION_ALIASES, IN_POPULATION_NO_CENSUS_PLACE } from './data/inPopulationAliases.mjs';
import { ROSTER_FILE } from './buildInStatewideRoster.mjs';

export const PLACES_CSV = 'cache/sub-est2024_18.csv';
export const COUNTIES_CSV = 'cache/co-est2024-alldata.csv';
export const IN_STATE = 'IN';
export const IN_FIPS = '18';
export const VINTAGE = 'Census PEP POPESTIMATE2024';

export async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      commit: { type: 'boolean', default: false },
    },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    process.exit(1);
  }

  const roster = JSON.parse(readFileSync(ROSTER_FILE, 'utf8')).entities ?? [];
  if (!roster.length) throw new Error(`REFUSING: ${ROSTER_FILE} holds no entities`);

  const placeRows = readPepCsv(PLACES_CSV);
  const countyRows = readPepCsv(COUNTIES_CSV)
    .filter((r) => r.SUMLEV === SUMLEV.county && r.STATE === IN_FIPS);
  // ⚠ A GATE THAT CAN MEASURE NOTHING MUST FAIL, NOT PASS.
  if (!placeRows.length) throw new Error(`REFUSING: ${PLACES_CSV} parsed 0 rows`);
  if (countyRows.length !== 92) {
    throw new Error(`REFUSING: expected 92 Indiana counties in ${COUNTIES_CSV}, got ${countyRows.length}`);
  }

  const { matched, problems, declaredAbsent } = joinIndianaPopulations({
    roster,
    placeRows,
    countyRows,
    aliases: IN_POPULATION_ALIASES,
    absent: IN_POPULATION_NO_CENSUS_PLACE,
  });

  console.log(`Indiana populations — ${VINTAGE}`);
  console.log(`roster ${roster.length}  matched ${matched.length}  declared absent ${declaredAbsent.length}`);

  if (problems.length) {
    console.error(`\n✗ REFUSING — ${problems.length} unexplained:`);
    for (const p of problems) console.error(`    ${p}`);
    process.exit(1);
  }
  if (matched.length + declaredAbsent.length !== roster.length) {
    console.error(`\n✗ REFUSING: ${matched.length} + ${declaredAbsent.length} != ${roster.length}. `
      + 'Every government must be accounted for, matched or declared.');
    process.exit(1);
  }

  const byType = new Map();
  for (const m of matched) byType.set(m.entityType, (byType.get(m.entityType) ?? 0) + 1);
  console.log('by entity_type:', JSON.stringify([...byType].sort()));

  // ⭐ A FREE EXACT CHECK, AND IT COSTS NOTHING TO ASSERT. The county file
  // carries a SUMLEV-040 state row, so the 92 county populations this script is
  // about to write must sum to Indiana's published total — a figure derived
  // INDEPENDENTLY of the join. It catches a wrong county row, a duplicate, and a
  // missing one, none of which the name match can see. (The Michigan lesson:
  // "a name that states a fact is a free exact check — look for these".)
  const stateRow = readPepCsv(COUNTIES_CSV)
    .find((r) => r.SUMLEV === SUMLEV.state && r.STATE === IN_FIPS);
  if (!stateRow) throw new Error(`REFUSING: no SUMLEV-040 state row for Indiana in ${COUNTIES_CSV}`);
  const total = matched.filter((m) => m.entityType === 'county').reduce((a, m) => a + m.population, 0);
  const published = Number(stateRow.POPESTIMATE2024);
  if (total !== published) {
    throw new Error(`REFUSING: the 92 county populations sum to ${total.toLocaleString()}, `
      + `but the census state row publishes ${published.toLocaleString()} `
      + `(delta ${(published - total).toLocaleString()}). The county join is wrong.`);
  }
  console.log(`county populations sum to ${total.toLocaleString()} — EXACTLY the published state total`);

  console.log('\nsmallest five:');
  for (const m of [...matched].sort((a, b) => a.population - b.population).slice(0, 5)) {
    console.log(`    ${String(m.population).padStart(8)}  ${m.name} (${m.entityType}, ${m.countyName}) <- ${m.via}`);
  }
  console.log('largest five:');
  for (const m of [...matched].sort((a, b) => b.population - a.population).slice(0, 5)) {
    console.log(`    ${String(m.population).padStart(8)}  ${m.name} (${m.entityType}, ${m.countyName}) <- ${m.via}`);
  }
  if (declaredAbsent.length) console.log(`\ndeclared absent, staying at 0: ${declaredAbsent.join(', ')}`);

  if (!values.commit) {
    console.log('\nDry run — nothing written.');
    return;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  // ⚠ Match the DB row by (name, state, entity_type) — all three, the key
  // `treasury_ensure_municipality` itself uses. Name alone would let a city and
  // a county of the same name collide, and Indiana has Marion/Marion County and
  // Lawrence/Lawrence County.
  let written = 0; let unchanged = 0; let missing = 0;
  for (const m of matched) {
    const { data: rows, error: selErr } = await db.schema('treasury').from('municipalities')
      .select('id, population')
      .eq('state', IN_STATE).eq('name', m.name).eq('entity_type', m.entityType);
    if (selErr) throw new Error(`lookup ${m.name}: ${selErr.message}`);
    if (!rows?.length) { missing++; continue; }
    if (rows.length > 1) {
      throw new Error(`REFUSING: ${rows.length} municipalities match (${m.name}, IN, ${m.entityType})`);
    }
    if (Number(rows[0].population) === m.population) { unchanged++; continue; }
    const { error: updErr } = await db.schema('treasury').from('municipalities')
      .update({ population: m.population }).eq('id', rows[0].id);
    if (updErr) throw new Error(`update ${m.name}: ${updErr.message}`);
    written++;
  }

  console.log(`\nwrote ${written}, already correct ${unchanged}, not in the database ${missing}.`);
  if (written === 0 && unchanged === 0) {
    console.error('REFUSING: nothing was measured, so nothing is verified.');
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadIndianaPopulations.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
