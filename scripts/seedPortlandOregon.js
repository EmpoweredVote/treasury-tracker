#!/usr/bin/env node
/**
 * Portland, Oregon Municipality Seeder (Phase 17)
 *
 * Creates (or updates) the rows needed to drive the Portland budget loader:
 *
 *   Municipality:
 *     - Portland, OR (population 635749, year 2024)
 *
 * NOTE: data_source rows are owned by processPortland.js (one per fiscal year:
 * 'Portland Operating Budget FY2025', 'Portland Operating Budget FY2026').
 * This seeder intentionally does NOT create data_source rows to avoid
 * dataset_id collisions between a base seeder row and the per-FY loader rows.
 * Run processPortland.js --dry-run to verify data_source rows after loading.
 *
 * Idempotent: safe to re-run. Looks up rows by name and updates them in-place;
 * inserts only when the row does not exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedPortlandOregon.js
 *
 * Population source: Census sub-est2024_41.csv, SUMLEV=162, 2024 vintage
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

// ── Municipality payload ─────────────────────────────────────────────────
// Population from Census sub-est2024_41.csv, SUMLEV=162, "Portland city" → 635749
const PORTLAND = {
  name: 'Portland',
  state: 'OR',
  entity_type: 'city',
  population: 635749,
  population_year: 2024,
};

// ── Idempotent upsert for municipality: select by name+state → insert or update ──
async function upsertMunicipality(m) {
  const { data: existing, error: selectErr } = await supabase
    .from('municipalities')
    .select('id')
    .eq('name', m.name)
    .eq('state', m.state)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting municipality "${m.name}, ${m.state}": ${selectErr.message}`);
    process.exit(1);
  }

  let data, error;

  if (existing?.id) {
    ({ data, error } = await supabase
      .from('municipalities')
      .update(m)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
      .from('municipalities')
      .insert(m)
      .select());
    if (!error) console.log(`  (inserted new municipality row)`);
  }

  if (error) {
    console.error(`  ERROR writing municipality "${m.name}": ${error.message}`);
    process.exit(1);
  }

  const row = data?.[0];
  if (!row) {
    console.error(`  ERROR: no row returned for municipality "${m.name}"`);
    process.exit(1);
  }

  return row.id;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Portland, OR (Phase 17) — municipality only...\n');
  console.log('NOTE: data_source rows are created by processPortland.js (one per FY).\n');

  // ── Step 1: Upsert Portland municipality ─────────────────────────────
  console.log(`Upserting municipality: ${PORTLAND.name}, ${PORTLAND.state}`);
  const muniId = await upsertMunicipality(PORTLAND);
  console.log(`  id: ${muniId}\n`);

  // ── Step 2: Verification via treasury_list_source_ids ────────────────
  // data_source rows are created by processPortland.js; check for them here
  // as a post-load confirmation (they may not exist yet before first load).
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) { console.error(`  ERROR: ${listErr.message}`); process.exit(1); }

  const expectedNames = ['Portland Operating Budget FY2025', 'Portland Operating Budget FY2026'];
  let anyFound = false;

  for (const name of expectedNames) {
    const hit = (listing || []).filter(r => r.name === name);
    if (hit.length === 1) {
      console.log(`  OK: ${name} (api_type=${hit[0].api_type}, type=${hit[0].dataset_type})`);
      anyFound = true;
    } else if (hit.length === 0) {
      console.log(`  NOT YET: ${name} — run processPortland.js to create data_source rows`);
    } else {
      console.log(`  DUPLICATE (${hit.length} rows): ${name} — idempotency check failed`);
    }
  }

  if (!anyFound) {
    console.log('\nNOTE: No Portland data_source rows found yet — this is expected before');
    console.log('      first run of processPortland.js. Municipality seed is complete.');
  }

  // ── Step 3: Verify municipality row population ────────────────────────
  const { data: muniCheck, error: muniCheckErr } = await supabase
    .from('municipalities')
    .select('id, population, population_year')
    .eq('name', 'Portland')
    .eq('state', 'OR');

  if (muniCheckErr) { console.error(`  ERROR: ${muniCheckErr.message}`); process.exit(1); }
  if (muniCheck.length !== 1) {
    console.error(`  ERROR: expected 1 Portland, OR row, found ${muniCheck.length}`);
    process.exit(1);
  }
  const mc = muniCheck[0];
  console.log(`  OK: Portland, OR municipality (id=${mc.id}, population=${mc.population}, population_year=${mc.population_year})`);

  if (mc.population !== 635749) {
    console.error(`  WARNING: expected population 635749, got ${mc.population}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
