#!/usr/bin/env node
/**
 * California General Fund Revenue Loader — FY2022-2026
 *
 * Loads General Fund revenue data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'revenue').
 *
 * Revenue figures from CA Department of Finance (DOF) Finance Bulletins
 * and Governor's Budget Revenue Estimates (ebudget.ca.gov).
 * Amounts in dollars; FY = fiscal year ending June 30 of that calendar year.
 *
 * Tree structure:
 *   [{ n: 'General Fund Revenue', a: total, c: [
 *       { n: 'Income Taxes',        a: subtotal, i: [PIT, Corp Tax] },
 *       { n: 'Sales and Use Taxes', a: subtotal, i: [Sales Tax, Use Tax] },
 *       { n: 'Other Taxes',         a: subtotal, i: [Insurance, Beverage, Tobacco, Other] },
 *       { n: 'Non-Tax Revenue',     a: subtotal, i: [Transfers, Interest, Other] },
 *   ]}]
 *
 * GF totals: FY2022=$234.3B  FY2023=$200.2B  FY2024=$183.0B
 *            FY2025=$208.2B  FY2026=$213.8B
 *
 * Usage:
 *   node scripts/processCARevenue.js              # load FY2022-2026
 *   node scripts/processCARevenue.js --fy 2026    # single year
 *   node scripts/processCARevenue.js --dry-run    # print tree, skip DB
 *   node scripts/processCARevenue.js --dry-run --fy 2024
 */

import { createClient }              from '@supabase/supabase-js';
import { parseArgs }                 from 'node:util';
import { readFileSync }              from 'node:fs';
import { resolve, dirname }          from 'node:path';
import { fileURLToPath }             from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch {}
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const POPULATION   = 39_500_000;

// ── Revenue data ──────────────────────────────────────────────────────────────
// All amounts in dollars.
// Source: CA Dept of Finance — Finance Bulletins, Governor's Budget Revenue
//   Estimates (ebudget.ca.gov). Figures represent enacted budget estimates and
//   prior-year actuals for the General Fund.
//
// FY2022 (FY2021-22): Historic high driven by capital gains distributions.
// FY2023 (FY2022-23): Sharp decline; PIT fell as market valuations unwound.
// FY2024 (FY2023-24): Continued weakness; contributed to the $45B+ budget gap.
// FY2025 (FY2024-25): Recovery from stock market rebound and wage growth.
// FY2026 (FY2025-26): Continued recovery; enacted budget projection.
//
// Non-Tax Revenue includes: federal funds transfers, Lottery Proceeds (GF
//   share), Unclaimed Property Fund transfers, interest earnings, and other
//   non-recurring revenues.

const REVENUE = {
  2022: {
    total: 234_300_000_000,
    categories: [
      {
        name: 'Income Taxes',
        total: 173_386_000_000,
        lineItems: [
          { name: 'Personal Income Tax', amount: 143_968_000_000 },
          { name: 'Corporation Tax',     amount:  29_418_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 35_721_000_000,
        lineItems: [
          { name: 'Retail Sales Tax', amount: 33_599_000_000 },
          { name: 'Use Tax',          amount:  2_122_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 5_097_000_000,
        lineItems: [
          { name: 'Insurance Tax',          amount: 3_521_000_000 },
          { name: 'Alcoholic Beverage Tax', amount:   398_000_000 },
          { name: 'Tobacco Tax',            amount:   154_000_000 },
          { name: 'Other Taxes',            amount: 1_024_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 20_096_000_000,
        lineItems: [
          { name: 'Transfers from Other Funds',     amount: 15_271_000_000 },
          { name: 'Interest and Investment Income', amount:  1_850_000_000 },
          { name: 'Other Non-Tax Revenue',          amount:  2_975_000_000 },
        ],
      },
    ],
  },

  2023: {
    total: 200_200_000_000,
    categories: [
      {
        name: 'Income Taxes',
        total: 130_139_000_000,
        lineItems: [
          { name: 'Personal Income Tax', amount: 108_571_000_000 },
          { name: 'Corporation Tax',     amount:  21_568_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 37_828_000_000,
        lineItems: [
          { name: 'Retail Sales Tax', amount: 35_654_000_000 },
          { name: 'Use Tax',          amount:  2_174_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 5_661_000_000,
        lineItems: [
          { name: 'Insurance Tax',          amount: 3_912_000_000 },
          { name: 'Alcoholic Beverage Tax', amount:   416_000_000 },
          { name: 'Tobacco Tax',            amount:   151_000_000 },
          { name: 'Other Taxes',            amount: 1_182_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 26_572_000_000,
        lineItems: [
          { name: 'Transfers from Other Funds',     amount: 21_822_000_000 },
          { name: 'Interest and Investment Income', amount:  1_350_000_000 },
          { name: 'Other Non-Tax Revenue',          amount:  3_400_000_000 },
        ],
      },
    ],
  },

  2024: {
    total: 183_000_000_000,
    categories: [
      {
        name: 'Income Taxes',
        total: 125_705_000_000,
        lineItems: [
          { name: 'Personal Income Tax', amount: 104_924_000_000 },
          { name: 'Corporation Tax',     amount:  20_781_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 35_481_000_000,
        lineItems: [
          { name: 'Retail Sales Tax', amount: 33_941_000_000 },
          { name: 'Use Tax',          amount:  1_540_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 5_517_000_000,
        lineItems: [
          { name: 'Insurance Tax',          amount: 3_921_000_000 },
          { name: 'Alcoholic Beverage Tax', amount:   420_000_000 },
          { name: 'Tobacco Tax',            amount:   148_000_000 },
          { name: 'Other Taxes',            amount: 1_028_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 16_297_000_000,
        lineItems: [
          { name: 'Transfers from Other Funds',     amount: 11_822_000_000 },
          { name: 'Interest and Investment Income', amount:  1_975_000_000 },
          { name: 'Other Non-Tax Revenue',          amount:  2_500_000_000 },
        ],
      },
    ],
  },

  2025: {
    total: 208_200_000_000,
    categories: [
      {
        name: 'Income Taxes',
        total: 154_169_000_000,
        lineItems: [
          { name: 'Personal Income Tax', amount: 131_045_000_000 },
          { name: 'Corporation Tax',     amount:  23_124_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 36_516_000_000,
        lineItems: [
          { name: 'Retail Sales Tax', amount: 34_516_000_000 },
          { name: 'Use Tax',          amount:  2_000_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 5_584_000_000,
        lineItems: [
          { name: 'Insurance Tax',          amount: 4_002_000_000 },
          { name: 'Alcoholic Beverage Tax', amount:   420_000_000 },
          { name: 'Tobacco Tax',            amount:   145_000_000 },
          { name: 'Other Taxes',            amount: 1_017_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 11_931_000_000,
        lineItems: [
          { name: 'Transfers from Other Funds',     amount:  8_231_000_000 },
          { name: 'Interest and Investment Income', amount:  2_000_000_000 },
          { name: 'Other Non-Tax Revenue',          amount:  1_700_000_000 },
        ],
      },
    ],
  },

  2026: {
    total: 213_800_000_000,
    categories: [
      {
        name: 'Income Taxes',
        total: 160_512_000_000,
        lineItems: [
          { name: 'Personal Income Tax', amount: 136_286_000_000 },
          { name: 'Corporation Tax',     amount:  24_226_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 37_846_000_000,
        lineItems: [
          { name: 'Retail Sales Tax', amount: 35_146_000_000 },
          { name: 'Use Tax',          amount:  2_700_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 5_242_000_000,
        lineItems: [
          { name: 'Insurance Tax',          amount: 3_697_000_000 },
          { name: 'Alcoholic Beverage Tax', amount:   427_000_000 },
          { name: 'Tobacco Tax',            amount:   141_000_000 },
          { name: 'Other Taxes',            amount:   977_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 10_200_000_000,
        lineItems: [
          { name: 'Transfers from Other Funds',     amount:  7_000_000_000 },
          { name: 'Interest and Investment Income', amount:  1_700_000_000 },
          { name: 'Other Non-Tax Revenue',          amount:  1_500_000_000 },
        ],
      },
    ],
  },
};

// ── Validate hardcoded amounts ────────────────────────────────────────────────
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

// ── Build JSON tree ───────────────────────────────────────────────────────────
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
          d:  li.name,
          a:  li.amount,
          aa: null,
          f:  'General Fund',
          e:  null,
        })),
    }));
  children.sort((a, b) => b.a - a.a);

  const jsonTree = [{ n: 'General Fund Revenue', a: total, c: children }];
  return { jsonTree, total, rowCount: categories.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      fy:        { type: 'string' },
    },
    strict: false,
  });

  const dryRun   = opts['dry-run'];
  const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years    = targetFY ? [targetFY] : [2022, 2023, 2024, 2025, 2026];

  console.log(`CA State Revenue Loader${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Fiscal years: ${years.join(', ')}\n`);

  if (!SUPABASE_KEY && !dryRun) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }

  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury')
      .from('municipalities').select('id, name')
      .eq('name', 'California').eq('state', 'CA').single();
    if (error || !muni) {
      console.error('California, CA not found. Run seedCAState.js first.');
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'California General Fund Revenue',
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      'ca-dof-gf-revenue',
      base_url:        'https://www.ebudget.ca.gov/',
      fiscal_years:    [2022, 2023, 2024, 2025, 2026],
      municipality_id: muniId,
    };

    const { data: existing } = await supabase.schema('treasury').from('data_sources')
      .select('id').eq('name', srcPayload.name).maybeSingle();

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
    console.log('');
  }

  for (const fy of years) {
    if (!REVENUE[fy]) { console.warn(`No revenue data for FY${fy} — skipping`); continue; }

    console.log(`── FY${fy} ─────────────────────────────────────────────────────────`);

    if (!validate(fy)) { console.error(`FY${fy} validation failed — aborting`); process.exit(2); }
    console.log(`FY${fy} validation: PASS`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    // Print summary table
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(30)} ${'Amount ($)'.padStart(18)}`);
    console.log('─'.repeat(50));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(28)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('─'.repeat(50));
    console.log(`${'TOTAL REVENUE'.padEnd(30)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total / POPULATION).toLocaleString()}/person\n`);

    if (dryRun) { console.log(`(dry-run — skipping DB writes for FY${fy})\n`); continue; }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year:    fy,
      p_dataset_type:   'revenue',
      p_total:          total,
      p_tree:           jsonTree,
      p_row_count:      rowCount,
      p_triggered_by:   'bulk_load',
    });

    if (rpcErr)           { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (rpcResult?.error) { console.error(`RPC error: ${rpcResult.error}`); process.exit(2); }

    const inserted = rpcResult?.rows_inserted ?? rowCount;
    console.log(`Loaded ${inserted} rows for FY${fy} ($${Math.round(total).toLocaleString()})\n`);

    await supabase.schema('treasury').from('data_sources')
      .update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }

  console.log('Done.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
