#!/usr/bin/env node
/**
 * LA County Budget Cleanup Script
 *
 * Performs scoped cleanup of stale LA County operating/revenue data before
 * reload from the correct CA State Controller county-government datasets.
 *
 * Operations (in order):
 *   1. Delete stale data_source rows (city-aggregate datasets ju3w-4gxp, rrtv-rsj9)
 *   2. Delete operating + revenue budget rows for FY2021-2024 (scoped — never touches salaries)
 *   3. Optionally delete FY2025 operating row (--delete-fy2025-operating flag)
 *   4. Fix LA County population to 10014009, population_year 2020 (D-03)
 *
 * Usage:
 *   node scripts/cleanLACountyBudget.js --dry-run
 *   node scripts/cleanLACountyBudget.js --delete-fy2025-operating
 *   node scripts/cleanLACountyBudget.js --delete-fy2025-operating --dry-run
 *
 * Env vars:
 *   SUPABASE_URL         Supabase project URL
 *   SUPABASE_SERVICE_KEY Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL env var'); process.exit(1); }
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// LA County municipality ID (verified via DB query)
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';

// Stale city-aggregate data_source rows to delete (not county-government data)
const STALE_SOURCE_IDS = [
  'c68cc1d2-0274-40c7-9953-aa6f9d41f33c', // City Expenditures (ju3w-4gxp)
  '1f2e2694-571d-445b-86f5-3b35d4b0efc3', // City Revenues (rrtv-rsj9)
];

// FY scope for operating/revenue delete — NEVER includes FY2025 or salaries
const FYS_TO_DELETE = [2021, 2022, 2023, 2024];

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run':                 { type: 'boolean' },
      'delete-fy2025-operating': { type: 'boolean' },
    },
    strict: false,
  });

  const dryRun          = values['dry-run'] ?? false;
  const deleteFY2025Op  = values['delete-fy2025-operating'] ?? false;

  console.log('\nLA County Budget Cleanup Script');
  console.log(`  Dry run                    : ${dryRun}`);
  console.log(`  Delete FY2025 operating    : ${deleteFY2025Op}`);
  console.log(`  Municipality ID            : ${LA_COUNTY_ID}`);
  console.log(`  FY scope (operating/revenue): ${FYS_TO_DELETE.join(', ')}\n`);

  // ── Operation 1: Delete stale data_source rows ────────────────────────────
  console.log('Op 1: Delete stale data_source rows (city-aggregate dataset references)');
  console.log(`  Stale IDs: ${STALE_SOURCE_IDS.join(', ')}`);

  if (dryRun) {
    console.log('  [dry-run] Would DELETE from treasury.data_sources WHERE id IN (stale IDs)\n');
  } else {
    const { error, count } = await supabase
      .schema('treasury')
      .from('data_sources')
      .delete({ count: 'exact' })
      .in('id', STALE_SOURCE_IDS);

    if (error) {
      console.error('  ERROR deleting stale data_sources:', error.message);
      process.exit(1);
    }
    console.log(`  Deleted ${count ?? 'unknown'} stale data_source row(s)\n`);
  }

  // ── Operation 2: Delete operating + revenue budget rows FY2021-2024 ───────
  console.log('Op 2: Delete operating + revenue budget rows for FY2021-2024');
  console.log(`  Scope: municipality_id=${LA_COUNTY_ID}, dataset_type IN (operating, revenue), fiscal_year IN (${FYS_TO_DELETE.join(', ')})`);
  console.log('  NOTE: salaries rows are NOT included in this delete');

  if (dryRun) {
    console.log('  [dry-run] Would DELETE from treasury.budgets WHERE municipality_id=LA_COUNTY_ID AND dataset_type IN (operating, revenue) AND fiscal_year IN (2021, 2022, 2023, 2024)\n');
  } else {
    const { error, count } = await supabase
      .schema('treasury')
      .from('budgets')
      .delete({ count: 'exact' })
      .eq('municipality_id', LA_COUNTY_ID)
      .in('dataset_type', ['operating', 'revenue'])
      .in('fiscal_year', FYS_TO_DELETE);

    if (error) {
      console.error('  ERROR deleting operating/revenue budget rows:', error.message);
      process.exit(1);
    }
    console.log(`  Deleted ${count ?? 'unknown'} operating/revenue budget row(s)\n`);
  }

  // ── Operation 3: FY2025 operating disposition ─────────────────────────────
  if (deleteFY2025Op) {
    console.log('Op 3: Delete FY2025 operating row (--delete-fy2025-operating flag set)');
    console.log(`  Scope: municipality_id=${LA_COUNTY_ID}, dataset_type=operating, fiscal_year=2025`);

    if (dryRun) {
      console.log('  [dry-run] Would DELETE from treasury.budgets WHERE municipality_id=LA_COUNTY_ID AND dataset_type=operating AND fiscal_year=2025\n');
    } else {
      const { error, count } = await supabase
        .schema('treasury')
        .from('budgets')
        .delete({ count: 'exact' })
        .eq('municipality_id', LA_COUNTY_ID)
        .eq('dataset_type', 'operating')
        .eq('fiscal_year', 2025);

      if (error) {
        console.error('  ERROR deleting FY2025 operating row:', error.message);
        process.exit(1);
      }
      console.log(`  Deleted ${count ?? 'unknown'} FY2025 operating row(s)\n`);
    }
  } else {
    console.log('Op 3: FY2025 operating left intact per user decision (--delete-fy2025-operating not set)\n');
  }

  // ── Operation 4: Fix population ────────────────────────────────────────────
  console.log('Op 4: Fix LA County population (D-03)');
  console.log(`  Set population=10014009, population_year=2020 for municipality ${LA_COUNTY_ID}`);

  if (dryRun) {
    console.log('  [dry-run] Would UPDATE treasury.municipalities SET population=10014009, population_year=2020 WHERE id=LA_COUNTY_ID\n');
  } else {
    const { error } = await supabase
      .schema('treasury')
      .from('municipalities')
      .update({ population: 10014009, population_year: 2020 })
      .eq('id', LA_COUNTY_ID);

    if (error) {
      console.error('  ERROR updating population:', error.message);
      process.exit(1);
    }
    console.log('  Population updated to 10014009 (2020 Census)\n');
  }

  console.log(dryRun ? 'Dry run complete — no changes made.\n' : 'Cleanup complete.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
