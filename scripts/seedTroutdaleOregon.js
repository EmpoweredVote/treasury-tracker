#!/usr/bin/env node
/**
 * Troutdale, Oregon Municipality Seeder (Phase 22)
 *
 * Creates (or updates) the municipality row for Troutdale, OR.
 * NOTE: data_source rows are owned by processTroutdale.js (one per fiscal year:
 * 'Troutdale Operating Budget FY2023' through 'Troutdale Operating Budget FY2026').
 * This seeder intentionally does NOT create data_source rows to avoid
 * dataset_id collisions between a base seeder row and the per-FY loader rows.
 * Run processTroutdale.js --dry-run to verify data_source rows after loading.
 *
 * Idempotent: safe to re-run. Looks up rows by name and updates them in-place;
 * inserts only when the row does not exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedTroutdaleOregon.js
 *
 * Population source: Census sub-est2024_41.csv, SUMLEV=162, "Troutdale city" (2024)
 * NOTE: ~17,000 is an estimate; actual Census 2024 figure is 15,749.
 */

import { createClient } from '@supabase/supabase-js';

import { listAllSourcesResult } from './lib/listAllSources.mjs';
// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

// ── Municipality payload ─────────────────────────────────────────────────
// Population from Census sub-est2024_41.csv, SUMLEV=162, "Troutdale city" → 15749
const TROUTDALE = {
  name: 'Troutdale',
  state: 'OR',
  entity_type: 'city',
  population: 15749,
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
  console.log('Seeding Troutdale, OR (Phase 22) — municipality only...\n');
  console.log('NOTE: data_source rows are created by processTroutdale.js (one per FY).\n');

  // ── Step 1: Upsert Troutdale municipality ──────────────────────────────
  console.log(`Upserting municipality: ${TROUTDALE.name}, ${TROUTDALE.state}`);
  const muniId = await upsertMunicipality(TROUTDALE);
  console.log(`  id: ${muniId}\n`);

  // ── Step 2: Verification via listAllSources (paged) ────────────────
  // data_source rows are created by processTroutdale.js; check for them here
  // as a post-load confirmation (they may not exist yet before first load).
  // NOTE: the source listing is paged from treasury.data_sources; call it via
  // a public-schema client (init-option schema only affects .from() calls).
  console.log('Verifying via listAllSources (paged, cap-proof)...');
  const publicClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: listing, error: listErr } = await listAllSourcesResult(publicClient);
  if (listErr) {
    // Non-fatal: RPC may not exist if this is a fresh DB. Log and continue.
    console.log(`  NOTE: source listing not available (${listErr.message})`);
    console.log('        This is expected before processTroutdale.js creates data_source rows.');
  }

  if (listing) {
    const expectedNames = [
      'Troutdale Operating Budget FY2023',
      'Troutdale Operating Budget FY2024',
      'Troutdale Operating Budget FY2025',
      'Troutdale Operating Budget FY2026',
    ];
    let anyFound = false;

    for (const name of expectedNames) {
      const hit = (listing || []).filter(r => r.name === name);
      if (hit.length === 1) {
        console.log(`  OK: ${name} (api_type=${hit[0].api_type}, type=${hit[0].dataset_type})`);
        anyFound = true;
      } else if (hit.length === 0) {
        console.log(`  NOT YET: ${name} — run processTroutdale.js to create data_source rows`);
      } else {
        console.log(`  DUPLICATE (${hit.length} rows): ${name} — idempotency check failed`);
      }
    }

    if (!anyFound) {
      console.log('\nNOTE: No Troutdale data_source rows found yet — this is expected before');
      console.log('      first run of processTroutdale.js. Municipality seed is complete.');
    }
  }

  // ── Step 3: Verify municipality row population ────────────────────────
  const { data: muniCheck, error: muniCheckErr } = await supabase
    .from('municipalities')
    .select('id, population, population_year')
    .eq('name', 'Troutdale')
    .eq('state', 'OR');

  if (muniCheckErr) { console.error(`  ERROR: ${muniCheckErr.message}`); process.exit(1); }
  if (muniCheck.length !== 1) {
    console.error(`  ERROR: expected 1 Troutdale, OR row, found ${muniCheck.length}`);
    process.exit(1);
  }
  const mc = muniCheck[0];
  console.log(`  OK: Troutdale, OR municipality (id=${mc.id}, population=${mc.population}, population_year=${mc.population_year})`);

  if (mc.population !== 15749) {
    console.error(`  WARNING: expected population 15749, got ${mc.population}`);
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
