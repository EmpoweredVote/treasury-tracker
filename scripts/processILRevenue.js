#!/usr/bin/env node
/**
 * Illinois General Fund Revenue Loader — FY2022-2026
 *
 * Loads General Fund revenue data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'revenue').
 *
 * Revenue figures from Illinois Governor's Office of Management and Budget
 * (GOMB) enacted budget documents, Civic Federation of Chicago budget
 * analyses, and IL Commission on Government Forecasting and Accountability
 * (CGFA) reports. Amounts in dollars; FY = fiscal year ending June 30
 * of that calendar year.
 *
 * Tree structure:
 *   [{ n: 'Illinois General Fund Revenue', a: total, c: [
 *       { n: 'Income Taxes',        a: subtotal, i: [Personal Income Tax, Corporate Income Tax] },
 *       { n: 'Sales and Use Taxes', a: subtotal, i: [Sales Tax, Use Tax] },
 *       { n: 'Other Taxes',         a: subtotal, i: [Public Utility Tax, Cigarette Tax, Liquor Tax, Other Taxes] },
 *       { n: 'Non-Tax Revenue',     a: subtotal, i: [Federal Sources, Lottery Transfers, Other Non-Tax] },
 *   ]}]
 *
 * GF totals: FY2022=$47,700,000,000  FY2023=$46,400,000,000  FY2024=$50,400,000,000
 *            FY2025=$53,300,000,000  FY2026=$54,800,000,000
 *
 * Sources:
 *   - Illinois GOMB: budget.illinois.gov (enacted budget highlights FY2023–FY2026)
 *   - Civic Federation: civicfed.org (FY2022–FY2026 enacted budget analyses)
 *   - CGFA: cgfa.illinois.gov (revenue estimation reports)
 *
 * FY2022 (enacted actuals): Strong individual income tax collections.
 * FY2023 (enacted actuals): Slight decline from FY2022 base receipts.
 * FY2024 (enacted): Individual income tax recovered; corporate declined 12%.
 * FY2025 (enacted): Continued growth driven by income taxes.
 * FY2026 (proposed/enacted): $55.2B GF spending plan; revenues $54.8B per GOMB.
 *
 * Usage:
 *   node scripts/processILRevenue.js              # load FY2022-2026
 *   node scripts/processILRevenue.js --fy 2026    # single year
 *   node scripts/processILRevenue.js --dry-run    # print tree, skip DB
 *   node scripts/processILRevenue.js --dry-run --fy 2024
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
const STATE_NAME   = 'Illinois';
const STATE_ABBR   = 'IL';
const POPULATION   = 12_812_508;

// ── Revenue data ──────────────────────────────────────────────────────────────
// All amounts in dollars.
// Illinois General Fund fiscal year ends June 30.
//
// Revenue composition notes:
//   Individual Income Tax rate: flat 4.95% (personal), 7% (corporate) since 2017.
//   Sales Tax: state rate 6.25%, of which ~5% flows to GF; remainder to local/transit.
//   Public Utility Tax: includes telecommunications excise, electric, gas taxes.
//   Lottery Transfers: net lottery proceeds remitted to GF.
//   Federal Sources: federal matching and block grants credited to GF.
//
// FY2022: Enacted actuals — elevated income tax collections; $47.7B GF total.
// FY2023: Enacted actuals — $46.4B GF; base receipts $50.7B includes ARPA one-time
//         federal funds; GF proper excludes non-recurring ARPA.
// FY2024: Enacted — $50.4B total GF; individual income tax recovered ~$2B;
//         corporate income tax declined ~$712M (-12%).
// FY2025: Enacted — $53.3B; income taxes +$1.7B from FY2024.
// FY2026: Proposed/enacted — $54.8B per GOMB five-year fiscal report.
//
// Category proportions derived from CGFA revenue reports and Civic Federation
// annual enacted budget analyses (FY2022–FY2026).

const REVENUE = {
  2022: {
    total: 47_700_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Income Taxes',
        total: 30_228_000_000,
        lineItems: [
          { name: 'Personal Income Tax',   amount: 24_418_000_000 },
          { name: 'Corporate Income Tax',  amount:  5_810_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 9_305_000_000,
        lineItems: [
          { name: 'Sales Tax',  amount: 8_605_000_000 },
          { name: 'Use Tax',    amount:   700_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 4_267_000_000,
        lineItems: [
          { name: 'Public Utility Tax',  amount: 1_650_000_000 },
          { name: 'Cigarette Tax',       amount:   700_000_000 },
          { name: 'Liquor Tax',          amount:   217_000_000 },
          { name: 'Other Taxes',         amount: 1_700_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 3_900_000_000,
        lineItems: [
          { name: 'Federal Sources',   amount: 2_100_000_000 },
          { name: 'Lottery Transfers', amount:   800_000_000 },
          { name: 'Other Non-Tax',     amount: 1_000_000_000 },
        ],
      },
    ],
  },

  2023: {
    total: 46_400_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Income Taxes',
        total: 29_340_000_000,
        lineItems: [
          { name: 'Personal Income Tax',   amount: 23_730_000_000 },
          { name: 'Corporate Income Tax',  amount:  5_610_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 9_185_000_000,
        lineItems: [
          { name: 'Sales Tax',  amount: 8_510_000_000 },
          { name: 'Use Tax',    amount:   675_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 4_105_000_000,
        lineItems: [
          { name: 'Public Utility Tax',  amount: 1_600_000_000 },
          { name: 'Cigarette Tax',       amount:   680_000_000 },
          { name: 'Liquor Tax',          amount:   215_000_000 },
          { name: 'Other Taxes',         amount: 1_610_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 3_770_000_000,
        lineItems: [
          { name: 'Federal Sources',   amount: 2_000_000_000 },
          { name: 'Lottery Transfers', amount:   800_000_000 },
          { name: 'Other Non-Tax',     amount:   970_000_000 },
        ],
      },
    ],
  },

  2024: {
    total: 50_400_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Income Taxes',
        total: 32_220_000_000,
        lineItems: [
          { name: 'Personal Income Tax',   amount: 27_480_000_000 },
          { name: 'Corporate Income Tax',  amount:  4_740_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 9_600_000_000,
        lineItems: [
          { name: 'Sales Tax',  amount: 8_870_000_000 },
          { name: 'Use Tax',    amount:   730_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 4_380_000_000,
        lineItems: [
          { name: 'Public Utility Tax',  amount: 1_680_000_000 },
          { name: 'Cigarette Tax',       amount:   660_000_000 },
          { name: 'Liquor Tax',          amount:   220_000_000 },
          { name: 'Other Taxes',         amount: 1_820_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 4_200_000_000,
        lineItems: [
          { name: 'Federal Sources',   amount: 2_300_000_000 },
          { name: 'Lottery Transfers', amount:   800_000_000 },
          { name: 'Other Non-Tax',     amount: 1_100_000_000 },
        ],
      },
    ],
  },

  2025: {
    total: 53_300_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Income Taxes',
        total: 34_200_000_000,
        lineItems: [
          { name: 'Personal Income Tax',   amount: 29_100_000_000 },
          { name: 'Corporate Income Tax',  amount:  5_100_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 10_050_000_000,
        lineItems: [
          { name: 'Sales Tax',  amount: 9_300_000_000 },
          { name: 'Use Tax',    amount:   750_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 4_600_000_000,
        lineItems: [
          { name: 'Public Utility Tax',  amount: 1_750_000_000 },
          { name: 'Cigarette Tax',       amount:   640_000_000 },
          { name: 'Liquor Tax',          amount:   225_000_000 },
          { name: 'Other Taxes',         amount: 1_985_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 4_450_000_000,
        lineItems: [
          { name: 'Federal Sources',   amount: 2_450_000_000 },
          { name: 'Lottery Transfers', amount:   800_000_000 },
          { name: 'Other Non-Tax',     amount: 1_200_000_000 },
        ],
      },
    ],
  },

  2026: {
    total: 54_800_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Income Taxes',
        total: 35_210_000_000,
        lineItems: [
          { name: 'Personal Income Tax',   amount: 30_000_000_000 },
          { name: 'Corporate Income Tax',  amount:  5_210_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        total: 10_360_000_000,
        lineItems: [
          { name: 'Sales Tax',  amount: 9_585_000_000 },
          { name: 'Use Tax',    amount:   775_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total: 4_730_000_000,
        lineItems: [
          { name: 'Public Utility Tax',  amount: 1_800_000_000 },
          { name: 'Cigarette Tax',       amount:   620_000_000 },
          { name: 'Liquor Tax',          amount:   230_000_000 },
          { name: 'Other Taxes',         amount: 2_080_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 4_500_000_000,
        lineItems: [
          { name: 'Federal Sources',   amount: 2_500_000_000 },
          { name: 'Lottery Transfers', amount:   800_000_000 },
          { name: 'Other Non-Tax',     amount: 1_200_000_000 },
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
      console.error(`FY${fy} "${cat.name}": items $${itemSum.toLocaleString()} != cat $${cat.total.toLocaleString()}`);
      ok = false;
    }
    catSum += cat.total;
  }

  if (catSum !== total) {
    console.error(`FY${fy} category sum $${catSum.toLocaleString()} != total $${total.toLocaleString()}`);
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

  const jsonTree = [{ n: 'Illinois General Fund Revenue', a: total, c: children }];
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedILState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Illinois General Fund Revenue',
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      'il-gf-revenue',
      base_url:        'https://budget.illinois.gov/budget-books.html',
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
    if (!REVENUE[fy]) { console.warn(`No revenue data for FY${fy} -- skipping`); continue; }

    console.log(`-- FY${fy} ---------------------------------------------------------------`);

    if (!validate(fy)) { console.error(`FY${fy} validation failed -- aborting`); process.exit(2); }
    console.log(`FY${fy} validation: PASS`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    // Print summary table
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(30)} ${'Amount ($)'.padStart(18)}`);
    console.log('-'.repeat(50));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(28)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('-'.repeat(50));
    console.log(`${'TOTAL REVENUE'.padEnd(30)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total / POPULATION).toLocaleString()}/person\n`);

    if (dryRun) { console.log(`(dry-run -- skipping DB writes for FY${fy})\n`); continue; }

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
