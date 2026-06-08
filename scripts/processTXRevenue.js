#!/usr/bin/env node
/**
 * Texas General Fund Revenue Loader — FY2022-2026
 *
 * Loads General Fund revenue data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'revenue').
 *
 * Revenue figures from Texas Comptroller annual revenue announcements
 * (comptroller.texas.gov) and Biennial Revenue Estimates.
 * FY2022-2025: confirmed actual figures from official Comptroller press releases.
 * FY2026: estimated from 2026-27 CRE ($85.29B year-end estimate, per monthly watch).
 *
 * Texas has NO personal income tax. No corporate income tax.
 * Primary revenue sources: Sales Tax, Oil & Gas Production Taxes,
 * Motor Vehicle Sales/Rental Tax, Franchise (Business) Tax, and others.
 *
 * Texas fiscal year ends August 31.
 * Biennial note: TX appropriates in 2-year cycles. Revenue tracking is annual.
 *
 * GR-Related Totals:
 *   FY2022=$76.47B  FY2023=$82.84B  FY2024=$83.78B
 *   FY2025=$86.08B  FY2026=$85.29B (CRE estimate)
 *
 * Sources:
 *   FY2022: comptroller.texas.gov/about/media-center/news/20220901-...
 *   FY2023: comptroller.texas.gov/about/media-center/news/20230901-...
 *   FY2024: comptroller.texas.gov/about/media-center/news/20240903-...
 *   FY2025: comptroller.texas.gov/about/media-center/news/20250903-...
 *   FY2026: comptroller.texas.gov/transparency/revenue/watch/general-revenue/
 *           (CRE FY estimate $85,289,975 thousand as of June 2026)
 *
 * Usage:
 *   node scripts/processTXRevenue.js              # load FY2022-2026
 *   node scripts/processTXRevenue.js --fy 2026    # single year
 *   node scripts/processTXRevenue.js --dry-run    # print tree, skip DB
 *   node scripts/processTXRevenue.js --dry-run --fy 2024
 */

import { createClient }     from '@supabase/supabase-js';
import { parseArgs }        from 'node:util';
import { readFileSync }     from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath }    from 'node:url';

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

const STATE_NAME = 'Texas';
const STATE_ABBR = 'TX';
const POPULATION = 29_145_505;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Revenue data ──────────────────────────────────────────────────────────────
// All amounts in dollars.
// Texas has no personal income tax (prohibited by TX Constitution until 2019 amendment;
// no income tax currently in effect). No corporate income tax (Franchise Tax is a
// margin-based business tax, not a net-income tax).
//
// "Other Revenue" category includes: insurance premium taxes, tobacco taxes,
// alcohol taxes, lottery proceeds, interest/investment income, fees, and
// non-recurring revenues.
//
// Data confidence:
//   FY2022-2025: confirmed — from Texas Comptroller official end-of-year announcements
//   FY2026: estimated — from 2026-27 CRE year-end estimate ($85.29B)
//
// Methodology for "Other Taxes & Revenue":
//   Computed as: GR total minus (Sales Tax + Motor Vehicle + Franchise + Oil + Natural Gas)
//   FY2022: $76.47B - $65.92B = $10.55B
//   FY2023: $82.84B - $69.50B = $13.34B
//   FY2024: $83.78B - $69.29B = $14.49B
//   FY2025: $86.08B - $71.08B = $15.00B
//   FY2026: $85.29B - $67.72B = $17.57B
//
// "Other Taxes & Revenue" line-item breakdown is approximate based on:
//   - Insurance premium taxes (~$2.5-3.5B/yr, 2026-27 BRE = 5.2% of GR)
//   - Lottery proceeds transferred to GR (~$1.3-1.9B/yr)
//   - Tobacco and alcoholic beverage taxes (~$1.2-1.5B/yr)
//   - Fees, interest, and other non-tax (~$3.5-9.0B/yr; large in recent years
//     due to higher interest income and one-time transfers)

const REVENUE = {
  // FY ending August 31, 2022 — confirmed actual
  2022: {
    total: 76_470_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Sales Tax',
        total: 42_970_000_000,
        lineItems: [
          { name: 'State Sales Tax',           amount: 42_970_000_000 },
        ],
      },
      {
        name: 'Other Taxes and Revenue',
        total: 10_550_000_000,
        lineItems: [
          { name: 'Insurance Premium Taxes',   amount: 2_650_000_000 },
          { name: 'Lottery Proceeds',          amount: 1_550_000_000 },
          { name: 'Tobacco and Alcohol Taxes', amount: 1_250_000_000 },
          { name: 'Fees and Other Revenue',    amount: 5_100_000_000 },
        ],
      },
      {
        name: 'Motor Vehicle Taxes',
        total: 6_450_000_000,
        lineItems: [
          { name: 'Motor Vehicle Sales Tax',   amount: 6_100_000_000 },
          { name: 'Motor Vehicle Rental Tax',  amount:   350_000_000 },
        ],
      },
      {
        name: 'Oil Production Tax',
        total: 6_360_000_000,
        lineItems: [
          { name: 'Oil Production Tax',        amount: 6_360_000_000 },
        ],
      },
      {
        name: 'Franchise (Business Margin) Tax',
        total: 5_670_000_000,
        lineItems: [
          { name: 'Franchise Tax',             amount: 5_670_000_000 },
        ],
      },
      {
        name: 'Natural Gas Production Tax',
        total: 4_470_000_000,
        lineItems: [
          { name: 'Natural Gas Production Tax', amount: 4_470_000_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2023 — confirmed actual
  2023: {
    total: 82_840_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Sales Tax',
        total: 46_580_000_000,
        lineItems: [
          { name: 'State Sales Tax',           amount: 46_580_000_000 },
        ],
      },
      {
        name: 'Other Taxes and Revenue',
        total: 13_340_000_000,
        lineItems: [
          { name: 'Insurance Premium Taxes',   amount: 3_100_000_000 },
          { name: 'Lottery Proceeds',          amount: 1_700_000_000 },
          { name: 'Tobacco and Alcohol Taxes', amount: 1_300_000_000 },
          { name: 'Fees and Other Revenue',    amount: 7_240_000_000 },
        ],
      },
      {
        name: 'Motor Vehicle Taxes',
        total: 6_820_000_000,
        lineItems: [
          { name: 'Motor Vehicle Sales Tax',   amount: 6_460_000_000 },
          { name: 'Motor Vehicle Rental Tax',  amount:   360_000_000 },
        ],
      },
      {
        name: 'Franchise (Business Margin) Tax',
        total: 6_820_000_000,
        lineItems: [
          { name: 'Franchise Tax',             amount: 6_820_000_000 },
        ],
      },
      {
        name: 'Oil Production Tax',
        total: 5_930_000_000,
        lineItems: [
          { name: 'Oil Production Tax',        amount: 5_930_000_000 },
        ],
      },
      {
        name: 'Natural Gas Production Tax',
        total: 3_350_000_000,
        lineItems: [
          { name: 'Natural Gas Production Tax', amount: 3_350_000_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2024 — confirmed actual
  2024: {
    total: 83_780_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Sales Tax',
        total: 47_160_000_000,
        lineItems: [
          { name: 'State Sales Tax',           amount: 47_160_000_000 },
        ],
      },
      {
        name: 'Other Taxes and Revenue',
        total: 14_490_000_000,
        lineItems: [
          { name: 'Insurance Premium Taxes',   amount: 3_200_000_000 },
          { name: 'Lottery Proceeds',          amount: 1_800_000_000 },
          { name: 'Tobacco and Alcohol Taxes', amount: 1_300_000_000 },
          { name: 'Fees and Other Revenue',    amount: 8_190_000_000 },
        ],
      },
      {
        name: 'Franchise (Business Margin) Tax',
        total: 6_860_000_000,
        lineItems: [
          { name: 'Franchise Tax',             amount: 6_860_000_000 },
        ],
      },
      {
        name: 'Motor Vehicle Taxes',
        total: 6_840_000_000,
        lineItems: [
          { name: 'Motor Vehicle Sales Tax',   amount: 6_480_000_000 },
          { name: 'Motor Vehicle Rental Tax',  amount:   360_000_000 },
        ],
      },
      {
        name: 'Oil Production Tax',
        total: 6_300_000_000,
        lineItems: [
          { name: 'Oil Production Tax',        amount: 6_300_000_000 },
        ],
      },
      {
        name: 'Natural Gas Production Tax',
        total: 2_130_000_000,
        lineItems: [
          { name: 'Natural Gas Production Tax', amount: 2_130_000_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2025 — confirmed actual
  2025: {
    total: 86_080_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Sales Tax',
        total: 49_060_000_000,
        lineItems: [
          { name: 'State Sales Tax',           amount: 49_060_000_000 },
        ],
      },
      {
        name: 'Other Taxes and Revenue',
        total: 15_000_000_000,
        lineItems: [
          { name: 'Insurance Premium Taxes',   amount: 3_400_000_000 },
          { name: 'Lottery Proceeds',          amount: 1_900_000_000 },
          { name: 'Tobacco and Alcohol Taxes', amount: 1_300_000_000 },
          { name: 'Fees and Other Revenue',    amount: 8_400_000_000 },
        ],
      },
      {
        name: 'Motor Vehicle Taxes',
        total: 7_080_000_000,
        lineItems: [
          { name: 'Motor Vehicle Sales Tax',   amount: 6_710_000_000 },
          { name: 'Motor Vehicle Rental Tax',  amount:   370_000_000 },
        ],
      },
      {
        name: 'Franchise (Business Margin) Tax',
        total: 7_080_000_000,
        lineItems: [
          { name: 'Franchise Tax',             amount: 7_080_000_000 },
        ],
      },
      {
        name: 'Oil Production Tax',
        total: 5_380_000_000,
        lineItems: [
          { name: 'Oil Production Tax',        amount: 5_380_000_000 },
        ],
      },
      {
        name: 'Natural Gas Production Tax',
        total: 2_480_000_000,
        lineItems: [
          { name: 'Natural Gas Production Tax', amount: 2_480_000_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2026 — estimated from 2026-27 CRE
  // Source: comptroller.texas.gov/transparency/revenue/watch/general-revenue/
  // CRE FY2026 year-end estimate: $85,289,975 thousand
  // Category splits derived from BRE 2026-27 biennial proportions (split evenly):
  //   Sales Tax: $94.24B biennial / 2 = $47.12B
  //   Motor Vehicle: $12.50B / 2 = $6.25B
  //   Oil Production: $11.80B / 2 = $5.90B
  //   Franchise: $11.50B / 2 = $5.75B
  //   Natural Gas: $5.40B / 2 = $2.70B
  //   Other (residual): $85.29B - $67.72B = $17.57B
  2026: {
    total: 85_290_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Sales Tax',
        total: 47_120_000_000,
        lineItems: [
          { name: 'State Sales Tax',           amount: 47_120_000_000 },
        ],
      },
      {
        name: 'Other Taxes and Revenue',
        total: 17_570_000_000,
        lineItems: [
          { name: 'Insurance Premium Taxes',   amount: 3_700_000_000 },
          { name: 'Lottery Proceeds',          amount: 2_000_000_000 },
          { name: 'Tobacco and Alcohol Taxes', amount: 1_300_000_000 },
          { name: 'Fees and Other Revenue',    amount: 10_570_000_000 },
        ],
      },
      {
        name: 'Oil Production Tax',
        total: 5_900_000_000,
        lineItems: [
          { name: 'Oil Production Tax',        amount: 5_900_000_000 },
        ],
      },
      {
        name: 'Franchise (Business Margin) Tax',
        total: 5_750_000_000,
        lineItems: [
          { name: 'Franchise Tax',             amount: 5_750_000_000 },
        ],
      },
      {
        name: 'Motor Vehicle Taxes',
        total: 6_250_000_000,
        lineItems: [
          { name: 'Motor Vehicle Sales Tax',   amount: 5_900_000_000 },
          { name: 'Motor Vehicle Rental Tax',  amount:   350_000_000 },
        ],
      },
      {
        name: 'Natural Gas Production Tax',
        total: 2_700_000_000,
        lineItems: [
          { name: 'Natural Gas Production Tax', amount: 2_700_000_000 },
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
    if (Math.abs(itemSum - cat.total) > 1_000_000) {
      console.error(`FY${fy} "${cat.name}": items $${itemSum.toLocaleString()} ≠ cat $${cat.total.toLocaleString()} (diff $${(itemSum - cat.total).toLocaleString()})`);
      ok = false;
    }
    catSum += cat.total;
  }

  if (Math.abs(catSum - total) > 10_000_000) {
    console.error(`FY${fy} category sum $${catSum.toLocaleString()} ≠ total $${total.toLocaleString()} (diff $${(catSum - total).toLocaleString()})`);
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

  const jsonTree = [{ n: 'Texas General Fund Revenue', a: total, c: children }];
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

  console.log(`${STATE_NAME} State Revenue Loader${dryRun ? ' (dry-run)' : ''}`);
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
      .eq('name', STATE_NAME).eq('state', STATE_ABBR).single();
    if (error || !muni) {
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedTXState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Texas General Fund Revenue',
      api_type:        'html',
      dataset_type:    'revenue',
      dataset_id:      'tx-gf-revenue',
      base_url:        'https://comptroller.texas.gov/transparency/revenue/watch/general-revenue/',
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
    console.log(`FY${fy} validation: PASS  (confidence: ${REVENUE[fy].confidence})`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    // Print summary table
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(36)} ${'Amount ($)'.padStart(18)}`);
    console.log('─'.repeat(56));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(34)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('─'.repeat(56));
    console.log(`${'TOTAL REVENUE'.padEnd(36)}${Math.round(total).toLocaleString().padStart(18)}`);
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
