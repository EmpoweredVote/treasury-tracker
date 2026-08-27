#!/usr/bin/env node
/**
 * Dallas Data Sources Seeder
 *
 * Creates (or updates) the two treasury.data_sources rows that drive
 * Dallas budget loading via bulkLoadBudget.js (Plan 05-02).
 *
 * Idempotent: safe to re-run. Looks up existing rows by name and updates
 * them in-place; inserts only when the row does not exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedDallasDataSources.js
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seedDallasDataSources.js
 */

import { createClient } from '@supabase/supabase-js';
import { DALLAS_SOURCES } from './lib/dallasSources.mjs';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Source definitions (single source of truth, unit-tested) ───────────
// Both column_mapping dialects live in scripts/lib/dallasSources.mjs; see the
// header there for why Dallas rendered $0 until 2026-08-26.
const SOURCES = DALLAS_SOURCES;

// ── Idempotent upsert: select by name → insert or update ────────────────
async function upsertByName(src) {
  // Check if a row with this name already exists
  const { data: existing, error: selectErr } = await supabase
    .schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('name', src.name)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting "${src.name}": ${selectErr.message}`);
    process.exit(1);
  }

  let data, error;

  if (existing?.id) {
    // Row exists — update it in-place (preserves id, created_at, etc.)
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update(src)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing row ${existing.id})`);
  } else {
    // Row does not exist — insert it
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

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding Dallas data_sources rows...\n');

  for (const src of SOURCES) {
    console.log(`Upserting: ${src.name}`);

    const row = await upsertByName(src);

    if (!row) {
      console.error(`  ERROR: no row returned for "${src.name}"`);
      process.exit(1);
    }

    console.log(`  id:           ${row.id}`);
    console.log(`  api_type:     ${row.api_type}`);
    console.log(`  dataset_type: ${row.dataset_type}`);
    console.log(`  dataset_id:   ${row.dataset_id}`);
    console.log(`  fiscal_years: ${JSON.stringify(row.fiscal_years)}`);
    console.log('');
  }

  // ── Verification via treasury_list_source_ids RPC ─────────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');

  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');

  if (listErr) {
    console.error(`  ERROR calling treasury_list_source_ids: ${listErr.message}`);
    process.exit(1);
  }

  const dallasBudgetRows = (listing || []).filter(
    r =>
      r.api_type === 'socrata' &&
      ['operating', 'revenue'].includes(r.dataset_type) &&
      r.name?.startsWith('Dallas')
  );

  if (dallasBudgetRows.length !== 2) {
    console.error(
      `  ERROR: expected 2 Dallas budget source(s), got ${dallasBudgetRows.length}`
    );
    console.error('  Rows found:', JSON.stringify(dallasBudgetRows, null, 2));
    process.exit(1);
  }

  console.log(
    `  Verification: treasury_list_source_ids returns ${dallasBudgetRows.length} Dallas budget source(s).`
  );
  for (const r of dallasBudgetRows) {
    console.log(`  - ${r.name} (${r.dataset_type}) id=${r.id}`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
