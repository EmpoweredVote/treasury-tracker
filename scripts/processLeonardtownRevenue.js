#!/usr/bin/env node
/**
 * Leonardtown, MD General Fund Revenue Loader — FY2023 + FY2024 + FY2025
 *
 * Loads approved General Fund revenue into treasury database using the
 * treasury_sync_budget_tree RPC (p_dataset_type = 'revenue').
 *
 * Fund balance appropriation is excluded — only true revenue sources are loaded.
 *
 * Data sources:
 *   FY2023: leonardtown.somd.com/pdf/Budget-FY2023.pdf (text PDF)
 *   FY2024: leonardtown.somd.com/pdf/BudgetFY2024.pdf (scanned PDF, read from page images)
 *   FY2025: leonardtown.somd.com/pdf/BudgetFY2025.pdf (scanned PDF, read from page images)
 *
 * True revenue totals (excluding fund balance appropriation):
 *   FY2023: $2,430,580   FY2024: $2,487,335   FY2025: $2,683,356
 *
 * Usage:
 *   node scripts/processLeonardtownRevenue.js              # load FY2023 + FY2024 + FY2025
 *   node scripts/processLeonardtownRevenue.js --fy 2023    # single year
 *   node scripts/processLeonardtownRevenue.js --fy 2024
 *   node scripts/processLeonardtownRevenue.js --fy 2025
 *   node scripts/processLeonardtownRevenue.js --dry-run    # parse + print, no DB
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const POPULATION   = 4_563;

// ── Revenue data ────────────────────────────────────────────────────────────────
// All amounts are Approved budget figures from the Town of Leonardtown's official
// budget documents.  Fund balance appropriation is NOT included here.
//
// FY2024 PDF is a scanned document; values extracted from page images.
// FY2023 PDF is a text PDF; values cross-checked against FY2024 PDF's FY23 column.

const REVENUE = {
  2023: {
    total: 2_430_580,
    categories: [
      {
        name: 'Local Property Taxes',
        total: 794_500,
        lineItems: [
          { name: 'Real Estate Full Year and Half Year',  amount: 770_000 },
          { name: 'Public Utilities',                     amount:  21_000 },
          { name: 'Penalties and Interest',               amount:   3_500 },
        ],
      },
      {
        name: 'Local Other Taxes',
        total: 1_000_000,
        lineItems: [
          { name: 'Income Tax',                           amount: 1_000_000 },
        ],
      },
      {
        name: 'State Shared Taxes',
        total: 224_373,
        lineItems: [
          { name: 'Highway User Revenue',                 amount: 224_373 },
        ],
      },
      {
        name: 'Licenses and Permits',
        total: 102_900,
        lineItems: [
          { name: 'Beer, Wine and Liquor License',        amount:  14_000 },
          { name: 'Traders License',                      amount:  14_000 },
          { name: 'Building, Occupancy and Sign Permits', amount:  44_900 },
          { name: 'CATV Franchise Fee',                   amount:  30_000 },
        ],
      },
      {
        name: 'Intergovernmental Revenues',
        total: 147_736,
        lineItems: [
          { name: 'County Payments in Lieu of Taxes',     amount:  70_929 },
          { name: 'Accommodation Tax',                    amount:  40_150 },
          { name: 'Law Enforcement Grants',               amount:  36_657 },
        ],
      },
      {
        name: 'Charges for Services',
        total: 3_000,
        lineItems: [
          { name: 'Event Fees',                           amount:   2_000 },
          { name: 'Zoning and Subdivision Fees',          amount:   1_000 },
        ],
      },
      {
        name: 'Miscellaneous Revenue',
        total: 158_071,
        lineItems: [
          { name: 'Interest',                             amount:   4_000 },
          { name: 'Restricted Grants',                    amount: 151_571 },
          { name: 'Other Income',                         amount:   2_500 },
        ],
      },
    ],
  },

  2024: {
    total: 2_487_335,
    categories: [
      {
        name: 'Local Property Taxes',
        total: 861_500,
        lineItems: [
          { name: 'Real Estate Full Year and Half Year',  amount: 790_000 },
          { name: 'Public Utilities',                     amount:  68_000 },
          { name: 'Penalties and Interest',               amount:   3_500 },
        ],
      },
      {
        name: 'Local Other Taxes',
        total: 1_000_050,
        lineItems: [
          { name: 'Income Tax',                           amount: 1_000_000 },
          { name: 'Admissions and Amusement Tax',         amount:        50 },
        ],
      },
      {
        name: 'State Shared Taxes',
        total: 279_068,
        lineItems: [
          { name: 'Highway User Revenue',                 amount: 279_068 },
        ],
      },
      {
        name: 'Licenses and Permits',
        total: 80_800,
        lineItems: [
          { name: 'Beer, Wine and Liquor License',        amount:  16_800 },
          { name: 'Traders License',                      amount:  14_000 },
          { name: 'Building, Occupancy and Sign Permits', amount:  30_000 },
          { name: 'CATV Franchise Fee',                   amount:  20_000 },
        ],
      },
      {
        name: 'Intergovernmental Revenues',
        total: 135_136,
        lineItems: [
          { name: 'County Payments in Lieu of Taxes',     amount:  72_786 },
          { name: 'Accommodation Tax',                    amount:  40_150 },
          { name: 'Law Enforcement Grants (SAPP)',         amount:  22_200 },
        ],
      },
      {
        name: 'Charges for Services',
        total: 3_000,
        lineItems: [
          { name: 'Event Fees',                           amount:   2_000 },
          { name: 'Zoning and Subdivision Fees',          amount:   1_000 },
        ],
      },
      {
        name: 'Miscellaneous Revenue',
        total: 127_781,
        lineItems: [
          { name: 'Interest',                             amount:   4_000 },
          { name: 'Restricted Grants',                    amount: 121_281 },
          { name: 'Other Income',                         amount:   2_500 },
        ],
      },
    ],
  },

  2025: {
    total: 2_683_356,
    categories: [
      {
        name: 'Local Property Taxes',
        total: 862_500,
        lineItems: [
          { name: 'Real Estate Full Year and Half Year',  amount: 800_000 },
          { name: 'Public Utilities',                     amount:  60_000 },
          { name: 'Penalties and Interest',               amount:   2_500 },
        ],
      },
      {
        name: 'Local Other Taxes',
        total: 1_100_100,
        lineItems: [
          { name: 'Income Tax',                           amount: 1_100_000 },
          { name: 'Admissions and Amusement Tax',         amount:       100 },
        ],
      },
      {
        name: 'State Shared Taxes',
        total: 342_620,
        lineItems: [
          { name: 'Highway User Revenue',                 amount: 342_620 },
        ],
      },
      {
        name: 'Licenses and Permits',
        total: 74_950,
        lineItems: [
          { name: 'Beer, Wine and Liquor License',        amount:  16_800 },
          { name: 'Traders License',                      amount:  12_000 },
          { name: 'Building, Occupancy and Sign Permits', amount:  21_150 },
          { name: 'CATV Franchise Fee',                   amount:  25_000 },
        ],
      },
      {
        name: 'Intergovernmental Revenues',
        total: 147_686,
        lineItems: [
          { name: 'County Payments in Lieu of Taxes',     amount:  72_795 },
          { name: 'Accommodation Tax',                    amount:  52_000 },
          { name: 'Law Enforcement Grants (SAPP)',         amount:  22_891 },
        ],
      },
      {
        name: 'Charges for Services',
        total: 4_000,
        lineItems: [
          { name: 'Event Fees',                           amount:   2_000 },
          { name: 'Zoning and Subdivision Fees',          amount:   2_000 },
        ],
      },
      {
        name: 'Miscellaneous Revenue',
        total: 151_500,
        lineItems: [
          { name: 'Interest',                             amount:  55_000 },
          { name: 'Restricted Grants',                    amount:  95_000 },
          { name: 'Private Contributions',                amount:   1_500 },
        ],
      },
    ],
  },
};

// ── Validate hardcoded amounts ─────────────────────────────────────────────────
function validate(fy) {
  const { total, categories } = REVENUE[fy];
  let ok = true;

  let catSum = 0;
  for (const cat of categories) {
    const itemSum = cat.lineItems.reduce((s, li) => s + li.amount, 0);
    if (itemSum !== cat.total) {
      console.error(`FY${fy} "${cat.name}": items $${itemSum.toLocaleString()} ≠ cat $${cat.total.toLocaleString()}`);
      ok = false;
    }
    catSum += cat.total;
  }
  if (catSum !== total) {
    console.error(`FY${fy} category sum $${catSum.toLocaleString()} ≠ total $${total.toLocaleString()}`);
    ok = false;
  }

  return ok;
}

// ── Build JSON tree ────────────────────────────────────────────────────────────
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];

  const children = categories
    .filter(cat => cat.total > 0)
    .map(cat => ({
      n: cat.name,
      a: cat.total,
      i: cat.lineItems
        .filter(li => li.amount > 0)
        .map(li => ({
          d: li.name,
          a: li.amount,
          aa: null,
          f: 'General Fund',
          e: null,
        })),
    }));
  children.sort((a, b) => b.a - a.a);

  const jsonTree = [{
    n: 'General Fund Revenue',
    a: total,
    c: children,
  }];

  const rowCount = categories.length;
  return { jsonTree, total, rowCount };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'fy':      { type: 'string'  },
    },
    strict: false,
  });

  const dryRun   = opts['dry-run'];
  const targetFY = opts['fy'] ? parseInt(opts['fy'], 10) : null;
  const years    = targetFY ? [targetFY] : [2023, 2024, 2025];

  if (!SUPABASE_KEY && !dryRun) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }

  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

  let muniId;
  if (!dryRun) {
    const { data: muni, error: muniErr } = await supabase.schema('treasury')
      .from('municipalities').select('id, name')
      .eq('name', 'Leonardtown').eq('state', 'MD').single();
    if (muniErr || !muni) {
      console.error('Leonardtown not found:', muniErr?.message);
      console.error('Run insertLeonardtownMunicipality.js first.');
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  const PDF_URLS = {
    2023: 'https://leonardtown.somd.com/pdf/Budget-FY2023.pdf',
    2024: 'https://leonardtown.somd.com/pdf/BudgetFY2024.pdf',
    2025: 'https://leonardtown.somd.com/pdf/BudgetFY2025.pdf',
  };

  for (const fy of years) {
    if (!REVENUE[fy]) { console.error(`No revenue data for FY${fy}`); continue; }

    console.log(`\n── FY${fy} ─────────────────────────────────────────────────`);

    if (!validate(fy)) { console.error(`FY${fy} validation failed — aborting`); process.exit(2); }
    console.log(`FY${fy} data validation: PASS`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    // Summary
    console.log(`\n${'Category'.padEnd(38)} ${'Approved ($)'.padStart(14)}`);
    console.log('─'.repeat(53));
    for (const dept of jsonTree) {
      for (const cat of (dept.c ?? [])) {
        console.log(`  ${cat.n.padEnd(36)}${Math.round(cat.a).toLocaleString().padStart(14)}`);
      }
    }
    console.log('─'.repeat(53));
    console.log(`${'TOTAL REVENUE'.padEnd(38)}${Math.round(total).toLocaleString().padStart(14)}`);
    console.log(`Per-capita: $${Math.round(total / POPULATION).toLocaleString()}/person\n`);

    if (dryRun) { console.log(`(dry-run — skipping DB writes for FY${fy})`); continue; }

    // Upsert data_source
    const srcPayload = {
      name:            `Leonardtown Operating Budget FY${fy}`,
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      `fy${fy}`,
      base_url:        PDF_URLS[fy],
      fiscal_years:    [fy],
      municipality_id: muniId,
      column_mapping:  {
        url_path: new URL(PDF_URLS[fy]).pathname,
        pdf_type: fy >= 2024 ? 'scanned' : 'text',
      },
    };

    const { data: existing } = await supabase.schema('treasury').from('data_sources')
      .select('id')
      .eq('municipality_id', muniId)
      .eq('api_type', 'pdf_download')
      .eq('dataset_id', `fy${fy}`)
      .eq('dataset_type', 'revenue')
      .maybeSingle();

    let ds;
    if (existing?.id) {
      const { data } = await supabase.schema('treasury').from('data_sources')
        .update(srcPayload).eq('id', existing.id).select().single();
      ds = data;
      console.log(`data_source updated: ${ds.id}`);
    } else {
      const { data, error } = await supabase.schema('treasury').from('data_sources')
        .insert(srcPayload).select().single();
      if (error) { console.error('data_source insert failed:', error.message); process.exit(2); }
      ds = data;
      console.log(`data_source created: ${ds.id}`);
    }

    // Clear prior revenue rows for this FY
    await supabase.schema('treasury').from('budgets')
      .delete().eq('data_source_id', ds.id).eq('fiscal_year', fy);

    // Load
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year:    fy,
      p_dataset_type:   'revenue',
      p_total:          total,
      p_tree:           jsonTree,
      p_row_count:      rowCount,
      p_triggered_by:   'bulk_load',
    });

    if (rpcErr)           { console.error('RPC error:', rpcErr.message); process.exit(2); }
    if (rpcResult?.error) { console.error('RPC error:', rpcResult.error); process.exit(2); }

    const inserted = rpcResult?.rows_inserted ?? rowCount;
    console.log(`Loaded ${inserted} rows for FY${fy} (total $${Math.round(total).toLocaleString()})`);

    await supabase.schema('treasury').from('data_sources')
      .update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
    console.log(`last_synced_at updated`);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
