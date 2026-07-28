#!/usr/bin/env node
/**
 * Repair implausible Ohio county populations (follow-up found during v2.20 Phase 136).
 *
 * THE BUG: 18 of Ohio's 88 county rows carry a money-like figure in `population`
 * — Ottawa County 106,432,166; Madison County 100,151,375; Highland County
 * 80,576,108; and so on. These are financial amounts, not people. Every affected
 * row also has `population_year IS NULL`.
 *
 * CAUSE (consistent with auto-memory project_ohio_aos_county_vs_city_layout:
 * "County workbooks use a different header row/cols/vocab than cities"): the
 * OI_Demographics column offsets loadOhioAOS.js uses do not line up on the county
 * workbooks, so a dollar column was read as the population column. The other 70
 * counties escaped, which is why it never looked like a systemic failure.
 *
 * THE FIX HERE IS DATA-ONLY, and deliberately narrow:
 *   - Only rows whose population is IMPLAUSIBLE are touched. Ohio's largest
 *     county is Franklin at ~1.36M, so anything above IMPLAUSIBLE_MIN cannot be a
 *     county population.
 *   - The other 70 counties are LEFT ALONE. They are plausible but a mixed, older
 *     vintage (Delaware 194,000 and Ross 77,000 are suspiciously round), and
 *     restating them would silently shift per-capita figures across Ohio. That is
 *     a separate decision, recorded as a follow-up rather than taken here.
 *   - Populations are not typed in by hand: this script downloads the Census
 *     county estimates file and reads POPESTIMATE2024 straight out of it, so
 *     there is no transcription step to get wrong.
 *
 * SOURCE: Census Bureau Vintage 2024 county population estimates —
 * https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv
 * STATE=39 (Ohio), COUNTY<>'000', field POPESTIMATE2024. Same file
 * seedTucsonArizona.js cites for Pima County, so the vintage is consistent with
 * the most recent county seeding in this repo.
 *
 * Usage:
 *   node scripts/fixOhioCountyPopulations.mjs            # dry-run, no writes
 *   node scripts/fixOhioCountyPopulations.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const [k, ...v] = l.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* rely on the environment */ }
}

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

export const CENSUS_URL = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv';
export const CENSUS_LABEL = 'US Census Bureau, Vintage 2024 county population estimates (co-est2024-alldata.csv), POPESTIMATE2024';
/** Ohio's largest county is Franklin at ~1.36M. Anything above this is not a population. */
export const IMPLAUSIBLE_MIN = 1_500_000;

/** Minimal CSV splitter: this file is plain comma-separated with no quoted commas. */
export function parseCensusCsv(text, stateFips = '39') {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  const iState = head.indexOf('STATE');
  const iCounty = head.indexOf('COUNTY');
  const iName = head.indexOf('CTYNAME');
  const iPop = head.indexOf('POPESTIMATE2024');
  if ([iState, iCounty, iName, iPop].some((i) => i < 0)) {
    throw new Error('Census CSV layout changed — expected STATE, COUNTY, CTYNAME, POPESTIMATE2024');
  }
  const out = new Map();
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    if (f[iState] !== stateFips || f[iCounty] === '000') continue;
    out.set(f[iName], Number(f[iPop]));
  }
  return out;
}

async function main() {
  console.log(`Ohio county population repair${APPLY ? '' : ' (dry-run)'}\n`);

  const { data: counties, error } = await db.from('municipalities')
    .select('id, name, population, population_year')
    .eq('state', 'OH').eq('entity_type', 'county');
  if (error) { console.error(`  read failed: ${error.message}`); process.exit(1); }

  const broken = counties.filter((c) => Number(c.population) > IMPLAUSIBLE_MIN);
  console.log(`  ${counties.length} Ohio counties; ${broken.length} with an implausible population ` +
    `(> ${IMPLAUSIBLE_MIN.toLocaleString()})`);
  if (!broken.length) { console.log('  nothing to repair.'); return; }

  console.log(`\n  fetching ${CENSUS_URL}`);
  const res = await fetch(CENSUS_URL);
  if (!res.ok) { console.error(`  Census download failed: HTTP ${res.status}`); process.exit(1); }
  const census = parseCensusCsv(await res.text());
  console.log(`  parsed ${census.size} Ohio county rows from the Census file\n`);

  const plan = [];
  for (const c of broken.sort((a, b) => Number(b.population) - Number(a.population))) {
    const pop = census.get(c.name);
    if (pop === undefined) {
      console.error(`  NO CENSUS MATCH for "${c.name}" — skipping rather than guessing`);
      process.exitCode = 1;
      continue;
    }
    if (!(pop > 0) || pop > IMPLAUSIBLE_MIN) {
      console.error(`  REFUSING "${c.name}": Census value ${pop} is itself implausible`);
      process.exitCode = 1;
      continue;
    }
    plan.push({ ...c, newPop: pop });
    console.log(`  ${c.name.padEnd(20)} ${Number(c.population).toLocaleString().padStart(13)} -> ${pop.toLocaleString().padStart(9)}`);
  }

  if (!APPLY) {
    console.log(`\n[dry-run] would update ${plan.length} rows (population + population_year=2024). No writes.`);
    return;
  }

  let n = 0;
  for (const p of plan) {
    const { error: uErr } = await db.from('municipalities')
      .update({ population: p.newPop, population_year: 2024 }).eq('id', p.id);
    if (uErr) { console.error(`  update failed for ${p.name}: ${uErr.message}`); process.exit(1); }
    n++;
  }
  console.log(`\n  updated ${n} rows.`);

  // Verify from the database rather than trusting the loop.
  const { data: after } = await db.from('municipalities')
    .select('name, population, population_year').eq('state', 'OH').eq('entity_type', 'county');
  const stillBroken = after.filter((c) => Number(c.population) > IMPLAUSIBLE_MIN);
  const stamped = after.filter((c) => c.population_year === 2024).length;
  console.log(`  verified: ${stillBroken.length} implausible remaining, ${stamped} rows stamped population_year=2024`);
  if (stillBroken.length) { console.error(`  STILL BROKEN: ${stillBroken.map((c) => c.name).join(', ')}`); process.exitCode = 1; }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
