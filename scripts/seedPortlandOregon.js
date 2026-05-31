#!/usr/bin/env node
/**
 * Portland, Oregon Municipality Seeder (Phase 17)
 *
 * Creates (or updates) the rows needed to drive the Portland budget loader:
 *
 *   Municipality:
 *     - Portland, OR (population 635749, year 2024)
 *
 *   Data source (1 operating — revenue is out of scope per D-03):
 *     - 'Portland Operating Budget' — pdf_download, fiscal_years [2025, 2026]
 *
 * Idempotent: safe to re-run. Looks up rows by name and updates them in-place;
 * inserts only when the row does not exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedPortlandOregon.js
 *
 * Population source: Census sub-est2024_41.csv, SUMLEV=162, 2024 vintage
 * PDF URLs confirmed working: 2026-05-31 (RESEARCH Pitfall 2 — URLs can change)
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Municipality payload ─────────────────────────────────────────────────
// Population from Census sub-est2024_41.csv, SUMLEV=162, "Portland city" → 635749
const PORTLAND = {
  name: 'Portland',
  state: 'OR',
  entity_type: 'city',
  population: 635749,
  population_year: 2024,
};

// ── PDF URLs confirmed working 2026-05-31 ────────────────────────────────
// FY2025-26 URL was different from research (CMS changed path); corrected here.
// RESEARCH Pitfall 2: Portland CMS URLs are unstable — verify before re-running.
const PDF_URL_FY2026 =
  'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download';
const PDF_URL_FY2025 =
  'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-1-city-portland-city-summaries-and-bureau/download';

// ── Data source factory ──────────────────────────────────────────────────
// Revenue is out of scope for Phase 17 (D-03). processPortland.js (Plan 02)
// creates per-fiscal-year data_source rows; this seeder establishes a base
// operating source row for the municipality.
function PORTLAND_OPERATING(municipalityId) {
  return {
    name: 'Portland Operating Budget',
    api_type: 'pdf_download',
    dataset_type: 'operating',
    base_url: PDF_URL_FY2026,             // FY2025-26 Vol 1 as the canonical URL
    dataset_id: 'portland_adopted_budget_vol1',
    fiscal_years: [2025, 2026],
    municipality_id: municipalityId,
  };
}

// ── Idempotent upsert for municipality: select by name+state → insert or update ──
async function upsertMunicipality(m) {
  const { data: existing, error: selectErr } = await supabase
    .schema('treasury')
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
      .schema('treasury')
      .from('municipalities')
      .update(m)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing municipality row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
      .schema('treasury')
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

// ── Idempotent upsert for data_source: select by name → insert or update ──
async function upsertDataSourceByName(src) {
  const { data: existingByName, error: selectErrByName } = await supabase
    .schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('name', src.name)
    .maybeSingle();

  if (selectErrByName) {
    console.error(`  ERROR selecting "${src.name}": ${selectErrByName.message}`);
    process.exit(1);
  }

  const existingId = existingByName?.id;
  let data, error;

  if (existingId) {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update(src)
      .eq('id', existingId)
      .select());
    if (!error) console.log(`  (updated existing row ${existingId})`);
  } else {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .insert(src)
      .select());
    if (!error) console.log(`  (inserted new row)`);
  }

  if (error) {
    console.error(`  ERROR writing "${src.name}": ${error.message}`);
    process.exit(1);
  }

  return data?.[0];
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Portland, OR (Phase 17) — municipality + operating data_source...\n');

  // ── Step 1: Upsert Portland municipality ─────────────────────────────
  console.log(`Upserting municipality: ${PORTLAND.name}, ${PORTLAND.state}`);
  const muniId = await upsertMunicipality(PORTLAND);
  console.log(`  id: ${muniId}\n`);

  // ── Step 2: Upsert operating data_source ─────────────────────────────
  const src = PORTLAND_OPERATING(muniId);
  console.log(`Upserting data_source: ${src.name}`);
  const row = await upsertDataSourceByName(src);
  if (!row) {
    console.error(`  ERROR: no row returned for "${src.name}"`);
    process.exit(1);
  }
  console.log(
    `  id=${row.id}  api_type=${row.api_type}  dataset_type=${row.dataset_type}  fiscal_years=${JSON.stringify(row.fiscal_years)}\n`
  );

  // ── Step 3: Verification via treasury_list_source_ids ────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) { console.error(`  ERROR: ${listErr.message}`); process.exit(1); }

  const expectedNames = ['Portland Operating Budget'];
  let allFound = true;

  for (const name of expectedNames) {
    const hit = (listing || []).filter(r => r.name === name);
    if (hit.length === 1) {
      console.log(`  OK: ${name} (api_type=${hit[0].api_type}, type=${hit[0].dataset_type})`);
    } else if (hit.length === 0) {
      console.log(`  MISSING: ${name}`);
      allFound = false;
    } else {
      console.log(`  DUPLICATE (${hit.length} rows): ${name} — idempotency check failed`);
      allFound = false;
    }
  }

  if (!allFound) {
    console.error(`\nERROR: one or more expected sources not found or duplicated`);
    process.exit(1);
  }

  // ── Step 4: Verify municipality row population ────────────────────────
  const { data: muniCheck, error: muniCheckErr } = await supabase
    .schema('treasury')
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
