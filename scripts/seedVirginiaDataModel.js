#!/usr/bin/env node
/**
 * Virginia Data Model Seeder (v2.7 Phase 81-02 — VALINK-01)
 *
 * Performs two idempotent operations:
 *   1. Seed the Virginia STATE navigation node — a municipalities row with
 *      entity_type='state', name='Virginia', state='VA', and population from
 *      the 2020 U.S. Census (8,631,393). No budget datasets — this is a
 *      navigation hub only (CONTEXT 81 D-08). Mirrors how MA/CA state nodes exist.
 *
 *   2. Link every loaded VA town to its parent county via county_id — reads
 *      data/vaTownCounties.json, resolves each county by name+state+entity_type,
 *      and sets the town's county_id only when it differs (idempotent UPDATE).
 *      - Skips towns not yet loaded in the DB (with a warning — not an abort).
 *      - Skips towns whose county is missing from the DB (Warren County is absent
 *        from Phase 80 load — Front Royal will be skipped here and linked when
 *        Warren County is loaded in a future run).
 *      - Leaves independent cities (entity_type='city') untouched — county_id=NULL.
 *      - Leaves county rows untouched — county_id=NULL.
 *
 * Supports --dry-run: resolves + reports all operations, zero writes.
 *
 * Usage:
 *   node scripts/seedVirginiaDataModel.js --dry-run
 *   node scripts/seedVirginiaDataModel.js          # live (needs .env SUPABASE_SERVICE_KEY)
 *
 * Source for population: U.S. Census Bureau, 2020 Decennial Census,
 *   Virginia (FIPS 51) total population = 8,631,393
 *   https://data.census.gov/table/DECENNIALPL2020.P1?g=040XX00US51
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Virginia 2020 U.S. Census total population.
 * Source: https://data.census.gov/table/DECENNIALPL2020.P1?g=040XX00US51
 * Retrieved: 2026-06-23
 */
const VA_POPULATION_2020 = 8_631_393;
const VA_POPULATION_YEAR = 2020;

// ── .env loader ───────────────────────────────────────────────────────────────

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

// ── Supabase factory ──────────────────────────────────────────────────────────

async function getSupabase() {
  loadEnv();
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY env var. Use --dry-run for a no-write resolve.');
    process.exit(1);
  }
  return createClient(url, key);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean' } },
    strict: false,
  });
  const dryRun = values['dry-run'] ?? false;

  console.log('Virginia Data Model Seeder — Phase 81-02');
  console.log('─'.repeat(55));
  if (dryRun) console.log('[DRY RUN] No writes will be performed.\n');

  // Load the town→county map
  const mapPath = resolve(__dirname, '..', 'data', 'vaTownCounties.json');
  const townCountyMap = JSON.parse(readFileSync(mapPath, 'utf8'));
  const towns = townCountyMap.towns;
  const townNames = Object.keys(towns);
  console.log(`Loaded vaTownCounties.json — ${townNames.length} town entries`);
  console.log(`Map source: ${townCountyMap._meta.source} (retrieved ${townCountyMap._meta.retrieved})\n`);

  const supabase = dryRun ? null : await getSupabase();

  // ── Step 1: Virginia state navigation node ───────────────────────────────────

  console.log('Step 1: Virginia state navigation node');

  let virginiaNodeId = null;

  if (dryRun) {
    // Dry-run: check what's already in DB to report accurately
    const sbDry = await getSupabase();
    const { data: existing } = await sbDry
      .schema('treasury').from('municipalities')
      .select('id, name, state, entity_type, population')
      .eq('name', 'Virginia').eq('state', 'VA').eq('entity_type', 'state')
      .limit(1);
    if (existing && existing[0]) {
      virginiaNodeId = existing[0].id;
      console.log(`  [DRY RUN] Virginia state node already exists: id=${virginiaNodeId}`);
      console.log(`    name=${existing[0].name} | state=${existing[0].state} | entity_type=${existing[0].entity_type} | population=${existing[0].population}`);
    } else {
      console.log(`  [DRY RUN] Would create: name='Virginia', state='VA', entity_type='state', population=${VA_POPULATION_2020.toLocaleString('en-US')} (2020 Census)`);
      virginiaNodeId = '<new-state-node-id>';
    }
  } else {
    const { data: nodeId, error: nodeErr } = await supabase.rpc('treasury_ensure_municipality', {
      p_name: 'Virginia',
      p_state: 'VA',
      p_entity_type: 'state',
      p_population: VA_POPULATION_2020,
    });
    if (nodeErr) {
      console.error('  ERROR: Failed to ensure Virginia state node:', nodeErr.message);
      process.exit(1);
    }
    virginiaNodeId = nodeId;
    console.log(`  Virginia state node ensured: id=${virginiaNodeId}`);
    console.log(`  population=${VA_POPULATION_2020.toLocaleString('en-US')} (2020 Census)`);
  }

  // ── Step 2: Resolve county id map from DB ────────────────────────────────────

  console.log('\nStep 2: Resolve county municipality IDs from DB');

  const sbResolve = dryRun ? await getSupabase() : supabase;
  const { data: countyRows, error: countyErr } = await sbResolve
    .schema('treasury').from('municipalities')
    .select('id, name')
    .eq('state', 'VA')
    .eq('entity_type', 'county');

  if (countyErr) {
    console.error('  ERROR: Failed to fetch VA county rows:', countyErr.message);
    process.exit(1);
  }

  const countyIdByName = {};
  for (const row of (countyRows || [])) {
    countyIdByName[row.name] = row.id;
  }
  console.log(`  Loaded ${Object.keys(countyIdByName).length} VA county municipality IDs from DB`);

  // ── Step 3: Resolve town municipality IDs from DB ───────────────────────────

  console.log('\nStep 3: Resolve town municipality IDs from DB');

  const { data: townRows, error: townErr } = await sbResolve
    .schema('treasury').from('municipalities')
    .select('id, name, county_id')
    .eq('state', 'VA')
    .eq('entity_type', 'town');

  if (townErr) {
    console.error('  ERROR: Failed to fetch VA town rows:', townErr.message);
    process.exit(1);
  }

  const townByName = {};
  for (const row of (townRows || [])) {
    townByName[row.name] = row;
  }
  console.log(`  Loaded ${Object.keys(townByName).length} VA town municipality rows from DB`);

  // ── Step 4: Link towns to their parent counties ──────────────────────────────

  console.log('\nStep 4: Link towns → parent counties via county_id');

  let linked = 0;
  let alreadyLinked = 0;
  let skippedNoTown = 0;
  let skippedNoCounty = 0;
  const skips = [];

  for (const townName of townNames) {
    const countyDisplayName = towns[townName];
    const countyId = countyIdByName[countyDisplayName];
    const townRow = townByName[townName];

    if (!townRow) {
      // Town not yet loaded in DB (Big Stone Gap, Clifton Forge, Vinton absent from APA report)
      skippedNoTown += 1;
      skips.push(`  SKIP (town not in DB): ${townName} → ${countyDisplayName}`);
      continue;
    }

    if (!countyId) {
      // County not loaded in DB (Warren County absent from Phase 80 load — Front Royal)
      skippedNoCounty += 1;
      skips.push(`  SKIP (county not in DB): ${townName} → ${countyDisplayName}`);
      continue;
    }

    if (townRow.county_id === countyId) {
      // Already linked — idempotent, no write needed
      alreadyLinked += 1;
      console.log(`  = ${townName.padEnd(20)} → ${countyDisplayName} (already set)`);
      continue;
    }

    if (dryRun) {
      console.log(`  + ${townName.padEnd(20)} → ${countyDisplayName} (id=${countyId})`);
      linked += 1;
    } else {
      const sbLink = supabase;
      const { error: updateErr } = await sbLink
        .schema('treasury').from('municipalities')
        .update({ county_id: countyId })
        .eq('id', townRow.id);

      if (updateErr) {
        console.error(`  ERROR updating ${townName}: ${updateErr.message}`);
        skips.push(`  ERROR: ${townName} — ${updateErr.message}`);
        continue;
      }
      console.log(`  + ${townName.padEnd(20)} → ${countyDisplayName} (id=${countyId})`);
      linked += 1;
    }
  }

  // Print skips after the successful links
  if (skips.length > 0) {
    console.log('');
    for (const s of skips) console.log(s);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(55));
  console.log('Summary');
  console.log(`  Virginia state node id : ${virginiaNodeId}`);
  console.log(`  Towns linked           : ${linked}${dryRun ? ' (dry-run — no writes)' : ''}`);
  console.log(`  Towns already linked   : ${alreadyLinked}`);
  console.log(`  Skipped (town not in DB) : ${skippedNoTown}${skippedNoTown > 0 ? ' (Big Stone Gap, Clifton Forge, Vinton — absent from all published XLSX)' : ''}`);
  console.log(`  Skipped (county not in DB): ${skippedNoCounty}${skippedNoCounty > 0 ? ' (Front Royal → Warren County absent from Phase 80 load)' : ''}`);

  if (!dryRun) {
    console.log('\nVirginia data model seed complete.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
