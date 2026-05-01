#!/usr/bin/env node
/**
 * Collin County, TX — Municipality Seeder
 *
 * Diffs the canonical Collin County municipality roster against
 * `treasury.municipalities` and inserts any missing rows.
 *
 * Idempotent: safe to re-run; re-running inserts nothing.
 *
 * Multi-county note:
 *   Dallas, Garland, Richardson, Royse City, and Sachse are partially
 *   located in Collin County but are seated in other counties (Dallas Co.,
 *   Rockwall Co.). They may already exist in the DB from prior imports.
 *   The script checks before inserting and will skip any that are already
 *   present — no duplicates will be created.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedCollinCountyMunicipalities.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

// ── Canonical Collin County, TX municipality roster ───────────────────────────
// Incorporated cities/towns whose boundaries lie wholly or partly in Collin County.
// Source: Collin County government + Texas Comptroller incorporated places list.

const COLLIN_COUNTY_TX = [
  'Allen', 'Anna', 'Blue Ridge', 'Celina', 'Fairview', 'Farmersville',
  'Frisco', 'Josephine', 'Lavon', 'Lowry Crossing', 'Lucas', 'McKinney',
  'Melissa', 'Murphy', 'Nevada', 'New Hope', 'Parker', 'Plano',
  'Princeton', 'Prosper', 'St. Paul', 'Weston', 'Wylie',
  // Multi-county cities — included because they have residents/budget activity in Collin Co.
  'Dallas', 'Garland', 'Richardson', 'Royse City', 'Sachse',
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Collin County, TX — Municipality Seeder');
  console.log('─'.repeat(50));

  // 1. Fetch all existing TX municipalities in one round-trip.
  const { data: existing, error: fetchError } = await supabase
    .from('municipalities')
    .select('id, name, state')
    .eq('state', 'TX');

  if (fetchError) {
    console.error('Failed to fetch existing municipalities:', fetchError.message);
    process.exit(1);
  }

  // Build a Set of lowercase names for O(1) lookup.
  const existingNames = new Set((existing || []).map(m => m.name.toLowerCase()));

  // 2. Diff roster vs. existing.
  const alreadyPresent = COLLIN_COUNTY_TX.filter(name => existingNames.has(name.toLowerCase()));
  const missing = COLLIN_COUNTY_TX.filter(name => !existingNames.has(name.toLowerCase()));

  // 3. Print pre-insert report.
  console.log(`\nAlready in DB (${alreadyPresent.length}):`);
  if (alreadyPresent.length > 0) {
    console.log(' ', alreadyPresent.join(', '));
  } else {
    console.log('  (none)');
  }

  console.log(`\nWill insert (${missing.length}):`);
  if (missing.length > 0) {
    console.log(' ', missing.join(', '));
  } else {
    console.log('  (none)');
  }

  // 4. Insert missing rows (single batch).
  if (missing.length === 0) {
    console.log('\nNothing to insert — Collin County already fully seeded.');
    return;
  }

  console.log('\nInserting...');
  const toInsert = missing.map(name => ({ name, state: 'TX', entity_type: 'municipality' }));

  const { data: inserted, error: insertError } = await supabase
    .from('municipalities')
    .insert(toInsert)
    .select('id, name');

  if (insertError) {
    console.error('Insert failed:', insertError.message);
    process.exit(1);
  }

  // 5. Success summary.
  console.log(`\nInserted ${inserted.length} rows:`);
  for (const row of inserted) {
    console.log(`  [${row.id}] ${row.name}`);
  }
  console.log(`\nDone. Total TX municipalities in DB: ${(existing?.length ?? 0) + inserted.length}`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
