#!/usr/bin/env node
/**
 * United States Federal Entity Seeder (Phase 44, Plan 01)
 *
 * Performs (idempotent):
 *   A. Fetch US national population from Census Vintage 2024 estimates
 *      (NST-EST2024-ALLDATA.csv, SUMLEV=010 row, POPESTIMATE2024 column).
 *      NEVER hardcoded — v2.0 ground rule: no unsourced data.
 *      NOTE: the file lives under /state/totals/ (the /national/totals/ path 404s).
 *   B. Upsert municipality row: name='United States', state='US',
 *      entity_type='federal', population=<fetched>, population_year=2024.
 *
 * The entity stays INVISIBLE in the app until a treasury.budgets row exists
 * (getCities HAVING filter) — first write is gated by the 44-03 checkpoint.
 *
 * Usage:
 *   node scripts/seedUSFederal.js            # live
 *   node scripts/seedUSFederal.js --dry-run  # fetch + report, no DB writes
 *
 * Security (T-44-01): population sanity band 300M-400M; halt outside it.
 * Security (T-44-02): service key via loadEnv(); never logged.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading (seedMACountyLinks.js pattern — inline comment stripping, WR-03) ──
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore missing files */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const CENSUS_URL =
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/state/totals/NST-EST2024-ALLDATA.csv';
const POP_YEAR = 2024;
const POP_MIN = 300_000_000; // T-44-01 sanity band
const POP_MAX = 400_000_000;

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = opts['dry-run'];

// ── Fetch US population (SUMLEV=010 row) ─────────────────────────────────────
async function fetchUSPopulation() {
  console.log(`Fetching: ${CENSUS_URL}`);
  const res = await fetch(CENSUS_URL);
  if (!res.ok) throw new Error(`Census fetch failed: HTTP ${res.status}`);
  const text = await res.text();

  const lines = text.split('\n');
  const header = lines[0].split(',');
  const sumlevIdx = header.indexOf('SUMLEV');
  const nameIdx = header.indexOf('NAME');
  const popIdx = header.indexOf('POPESTIMATE2024');
  if (sumlevIdx === -1 || popIdx === -1) throw new Error('Census CSV header missing SUMLEV/POPESTIMATE2024');

  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    if (cols[sumlevIdx] === '010') {
      const pop = Number(cols[popIdx]);
      console.log(`  ${cols[nameIdx]}: POPESTIMATE2024 = ${pop.toLocaleString()}`);
      if (!Number.isInteger(pop) || pop < POP_MIN || pop > POP_MAX) {
        throw new Error(`Population ${pop} outside sanity band ${POP_MIN}-${POP_MAX} — halting (T-44-01)`);
      }
      return pop;
    }
  }
  throw new Error('No SUMLEV=010 (United States) row found in Census CSV');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const population = await fetchUSPopulation();

  if (dryRun) {
    console.log('[dry-run] Would upsert: United States / US / federal /', population.toLocaleString(), `/ ${POP_YEAR}`);
    return;
  }

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY env var'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: existing, error: selErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, population')
    .eq('name', 'United States').eq('entity_type', 'federal').maybeSingle();
  if (selErr) { console.error('Select failed:', selErr.message); process.exit(1); }

  let id;
  if (existing?.id) {
    const { error } = await supabase.schema('treasury').from('municipalities')
      .update({ population, population_year: POP_YEAR, state: 'US' })
      .eq('id', existing.id);
    if (error) { console.error('Update failed:', error.message); process.exit(1); }
    id = existing.id;
    console.log(`Updated existing federal entity: ${id}`);
  } else {
    const { data, error } = await supabase.schema('treasury').from('municipalities')
      .insert({ name: 'United States', state: 'US', entity_type: 'federal', population, population_year: POP_YEAR })
      .select('id').single();
    if (error) { console.error('Insert failed:', error.message); process.exit(1); }
    id = data.id;
    console.log(`Inserted federal entity: ${id}`);
  }

  // Verify exactly one federal row
  const { count, error: cntErr } = await supabase.schema('treasury')
    .from('municipalities').select('id', { count: 'exact', head: true })
    .eq('entity_type', 'federal');
  if (cntErr) { console.error('Verify failed:', cntErr.message); process.exit(1); }
  if (count !== 1) { console.error(`Expected exactly 1 federal row, found ${count}`); process.exit(1); }

  console.log(`Verified: 1 federal municipality (id ${id}, pop ${population.toLocaleString()}, vintage ${POP_YEAR})`);
  console.log('Entity remains app-invisible until a treasury.budgets row exists (44-03 checkpoint gates that).');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
