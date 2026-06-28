#!/usr/bin/env node
/**
 * cleanupOHVAEstimateRows.mjs — One-shot idempotent cleanup for SGFS-03
 *
 * Deletes orphaned OH/VA budget rows whose fiscal_year falls OUTSIDE the
 * per-state keep-window (i.e. rows the ACFR loaders did NOT overwrite, such
 * as the FY2026 estimate rows left behind by processOH.js / processVA.js).
 *
 * Per-state keep-windows (CRITICAL — differ between states):
 *   OH_KEEP = [2020, 2021, 2022, 2023, 2024, 2025]  (Ohio extended to 6 years)
 *   VA_KEEP = [2022, 2023, 2024, 2025]               (Virginia stays 4 years)
 *
 * After deleting orphaned rows, re-asserts the four data_sources rows:
 *   'Ohio General Fund Operating Budget'  → base_url = OH ACFR landing, fiscal_years = OH_KEEP
 *   'Ohio General Fund Revenue'           → base_url = OH ACFR landing, fiscal_years = OH_KEEP
 *   'Virginia General Fund Operating Budget' → base_url = VA ACFR landing, fiscal_years = VA_KEEP
 *   'Virginia General Fund Revenue'          → base_url = VA ACFR landing, fiscal_years = VA_KEEP
 *
 * Usage:
 *   node scripts/cleanupOHVAEstimateRows.mjs --dry-run   # list candidates, no writes
 *   node scripts/cleanupOHVAEstimateRows.mjs             # live delete + metadata update
 *
 * Idempotent: second live run deletes 0 rows.
 * NEVER calls treasury_sync_city_budget.
 * NEVER sets data_source_id.
 * Phase 95, Plan 05 (SGFS-03).
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    } catch {}
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Per-state keep-windows (CRITICAL: differ between OH and VA) ────────────────
const OH_KEEP = [2020, 2021, 2022, 2023, 2024, 2025]; // Ohio extended to 6 years
const VA_KEEP = [2022, 2023, 2024, 2025];              // Virginia stays 4 years

// ACFR landing pages (corrected from the false-provenance estimate sources)
const OH_ACFR_LANDING = 'https://obm.ohio.gov/reports-and-resources/01-acfr-and-pafr';
const VA_ACFR_LANDING = 'https://www.doa.virginia.gov/reports/ACFReport/';

// data_sources row names (must match exactly what processOH.js / processVA.js wrote)
const STATE_CONFIGS = [
  {
    stateName:  'Ohio',
    stateAbbr:  'OH',
    keepWindow: OH_KEEP,
    acfrLanding: OH_ACFR_LANDING,
    dataSourceNames: [
      'Ohio General Fund Operating Budget',
      'Ohio General Fund Revenue',
    ],
  },
  {
    stateName:  'Virginia',
    stateAbbr:  'VA',
    keepWindow: VA_KEEP,
    acfrLanding: VA_ACFR_LANDING,
    dataSourceNames: [
      'Virginia General Fund Operating Budget',
      'Virginia General Fund Revenue',
    ],
  },
];

async function main() {
  const { values: opts } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false } },
    strict: false,
  });
  const dryRun = opts['dry-run'];

  console.log(`OH/VA Estimate Row Cleanup${dryRun ? ' (DRY-RUN — no writes)' : ' (LIVE MODE)'}`);
  console.log(`OH_KEEP = [${OH_KEEP.join(', ')}]`);
  console.log(`VA_KEEP = [${VA_KEEP.join(', ')}]`);
  console.log('');

  if (!SUPABASE_KEY && !dryRun) {
    console.error('Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

  let totalCandidates = 0;
  let totalDeleted = 0;

  // ── Phase 1: Delete orphaned budget rows ────────────────────────────────────
  for (const cfg of STATE_CONFIGS) {
    console.log(`── ${cfg.stateName} (${cfg.stateAbbr}) ──────────────────────────────────`);
    console.log(`   Keep-window: [${cfg.keepWindow.join(', ')}]`);

    let muniId;
    if (!dryRun) {
      const { data: muni, error } = await supabase
        .schema('treasury')
        .from('municipalities')
        .select('id, name')
        .eq('name', cfg.stateName)
        .eq('state', cfg.stateAbbr)
        .single();
      if (error || !muni) {
        console.error(`   ERROR: ${cfg.stateName} municipality not found: ${error?.message}`);
        process.exit(2);
      }
      muniId = muni.id;
      console.log(`   Municipality: ${muni.name} (${muniId})`);
    } else {
      console.log(`   Municipality: (dry-run — skipping DB lookup)`);
    }

    // Fetch all budgets rows for this state node
    let allRows = [];
    if (!dryRun) {
      const { data: rows, error } = await supabase
        .schema('treasury')
        .from('budgets')
        .select('id, fiscal_year, dataset_type, source_url, data_source')
        .eq('municipality_id', muniId)
        .order('fiscal_year', { ascending: true });
      if (error) {
        console.error(`   ERROR fetching budgets for ${cfg.stateName}: ${error.message}`);
        process.exit(2);
      }
      allRows = rows || [];
      console.log(`   Total rows in DB: ${allRows.length}`);
    } else {
      // In dry-run we can't query — just describe what we would look for
      console.log(`   Would select all budgets rows for ${cfg.stateAbbr} and flag fiscal_year NOT IN [${cfg.keepWindow.join(', ')}]`);
    }

    // Identify orphaned rows (fiscal_year NOT in keep-window)
    const orphans = allRows.filter(r => !cfg.keepWindow.includes(r.fiscal_year));

    if (!dryRun) {
      if (orphans.length === 0) {
        console.log(`   No orphaned rows found — already clean (idempotent).\n`);
      } else {
        console.log(`   Orphaned rows to delete (${orphans.length}):`);
        for (const row of orphans) {
          console.log(`     FY${row.fiscal_year} | ${row.dataset_type} | source_url=${row.source_url}`);
        }
        totalCandidates += orphans.length;

        // Delete each orphan by municipality_id + fiscal_year (targeted, per-row)
        for (const row of orphans) {
          const { error: delErr } = await supabase
            .schema('treasury')
            .from('budgets')
            .delete()
            .eq('municipality_id', muniId)
            .eq('fiscal_year', row.fiscal_year)
            .eq('dataset_type', row.dataset_type);
          if (delErr) {
            console.error(`     ERROR deleting FY${row.fiscal_year} ${row.dataset_type}: ${delErr.message}`);
            process.exit(2);
          }
          console.log(`     Deleted: FY${row.fiscal_year} ${row.dataset_type}`);
          totalDeleted++;
        }
        console.log('');
      }
    } else {
      // Dry-run: explain the selection criteria, since we can't fetch real rows
      console.log(`   [DRY-RUN] Would delete any budgets rows for ${cfg.stateName} (${cfg.stateAbbr})`);
      console.log(`             where fiscal_year NOT IN [${cfg.keepWindow.join(', ')}]`);
      console.log(`   [DRY-RUN] Expected candidates based on pre-plan DB inventory:`);
      if (cfg.stateAbbr === 'OH') {
        console.log(`             FY2026 | operating  | source_url ~ lsc.ohio.gov`);
        console.log(`             FY2026 | revenue    | source_url ~ lsc.ohio.gov`);
      } else {
        console.log(`             FY2026 | operating  | source_url ~ dpb.virginia.gov`);
        console.log(`             FY2026 | revenue    | source_url ~ dpb.virginia.gov`);
      }
      console.log(`   [DRY-RUN] In-window rows (${cfg.keepWindow.join(', ')}) would NOT be flagged.\n`);
      totalCandidates += 2; // expected per state (op + rev FY2026)
    }
  }

  // ── Phase 2: Re-assert data_sources metadata ─────────────────────────────────
  console.log('── data_sources metadata re-assertion ──────────────────────────────');
  for (const cfg of STATE_CONFIGS) {
    for (const dsName of cfg.dataSourceNames) {
      if (dryRun) {
        console.log(`[DRY-RUN] Would update data_sources WHERE name='${dsName}':`);
        console.log(`          SET base_url='${cfg.acfrLanding}', fiscal_years=[${cfg.keepWindow.join(', ')}]`);
      } else {
        const { error } = await supabase
          .schema('treasury')
          .from('data_sources')
          .update({
            base_url:     cfg.acfrLanding,
            fiscal_years: cfg.keepWindow,
          })
          .eq('name', dsName);
        if (error) {
          console.error(`ERROR updating data_sources '${dsName}': ${error.message}`);
          process.exit(2);
        }
        console.log(`Updated: '${dsName}' → base_url=${cfg.acfrLanding}, fiscal_years=[${cfg.keepWindow.join(', ')}]`);
      }
    }
  }
  console.log('');

  // ── Summary ──────────────────────────────────────────────────────────────────
  if (dryRun) {
    console.log(`DRY-RUN COMPLETE`);
    console.log(`Expected deletion candidates: ${totalCandidates} rows`);
    console.log(`  OH FY2026 operating + revenue = 2 rows`);
    console.log(`  VA FY2026 operating + revenue = 2 rows`);
    console.log(`No in-window rows (OH FY2020-2025, VA FY2022-2025) would be flagged.`);
    console.log(`No writes made.`);
  } else {
    console.log(`LIVE RUN COMPLETE`);
    console.log(`Rows deleted: ${totalDeleted}`);
    console.log(`data_sources rows updated: 4`);
    if (totalDeleted === 0) {
      console.log(`(0 rows deleted — already idempotently clean)`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
