#!/usr/bin/env node
/**
 * New York General Fund Revenue Loader — FY2022-2026
 *
 * Loads General Fund revenue data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'revenue').
 *
 * Revenue figures from NYS Division of the Budget enacted financial plan tables
 * (openbudget.ny.gov — machine-readable Excel format, tables T-2, T-57, T-60, T-68).
 *
 * New York State fiscal year ends March 31.
 * FY2022 = SFY 2021-22 (ended March 31, 2022) — ACTUALS
 * FY2023 = SFY 2022-23 (ended March 31, 2023) — ACTUALS
 * FY2024 = SFY 2023-24 (ended March 31, 2024) — ACTUALS
 * FY2025 = SFY 2024-25 (ended March 31, 2025) — ACTUALS
 * FY2026 = SFY 2025-26 (ending March 31, 2026) — PROJECTED (enacted budget)
 *
 * The General Fund receipts include:
 *   - Direct tax receipts (PIT, Consumption/Use, Business, Other Taxes)
 *   - Transfers from Other Funds (bond debt service excess flows back to GF)
 *   - Miscellaneous Receipts (investment income, fees, abandoned property)
 *   - Federal Receipts (limited GF federal share)
 *
 * Revenue categories are consolidated as:
 *   1. Personal Income Tax  — GF direct PIT + GF direct PTET + PIT/PTET excess transfers
 *   2. Business Taxes       — Corporate franchise, bank tax, insurance, other business
 *   3. Sales and Use Taxes  — Consumption/Use direct + Sales Tax excess transfers
 *   4. Other Taxes          — Real estate transfer, other taxes
 *   5. Miscellaneous Receipts — Investment income, abandoned property, fees
 *   6. Federal Receipts     — Federal grants flowing through General Fund
 *
 * GF totals (millions):
 *   FY2022=$112,810M  FY2023=$103,197M  FY2024=$102,997M
 *   FY2025=$119,261M  FY2026=$113,515M
 *
 * Usage:
 *   node scripts/processNYRevenue.js              # load FY2022-2026
 *   node scripts/processNYRevenue.js --fy 2025    # single year
 *   node scripts/processNYRevenue.js --dry-run    # print tree, skip DB
 *   node scripts/processNYRevenue.js --dry-run --fy 2024
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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATE_NAME   = 'New York';
const STATE_ABBR   = 'NY';
const POPULATION   = 20_201_249;

// ── Revenue data ──────────────────────────────────────────────────────────────
// All amounts in DOLLARS (source publishes in millions; multiplied by 1,000,000).
//
// Source: NYS Division of the Budget — Enacted Budget Financial Plan Tables
//   openbudget.ny.gov/historicalFP/fy26/en/fy26fp-en.xlsx (tabs T-57, T-68)
//   openbudget.ny.gov/historicalFP/fy25/en/fy25fp-en.xlsx (tabs T-57, T-60)
//   openbudget.ny.gov/historicalFP/fy23/en/fy23fp-en.xlsx (tab T-2)
//
// Revenue structure follows the cash financial plan cashflow tables.
// "Personal Income Tax" consolidates: direct GF PIT receipts + PIT in excess of
//   Revenue Bond Debt Service transfers + PTET in excess of Revenue Bond transfers.
// "Sales and Use Taxes" consolidates: direct Consumption/Use Taxes +
//   Sales Tax in excess of LGAC Bond Debt Service + Sales Tax in excess of
//   Revenue Bond Debt Service.
// "Other Taxes" consolidates: Other Taxes (direct) + Real Estate Taxes in excess
//   of CW/CA Debt Service.
// "Miscellaneous Receipts" consolidates: Abandoned Property, ABC License Fees,
//   Investment Income, Licenses/Fees, Motor Vehicle Fees, Reimbursements,
//   Extraordinary Settlements, Other Transactions, All Other transfers.
// "Federal Receipts" = Federal Receipts line in GF cashflow.
//
// FY2022 (SFY 2021-22): Strong PIT driven by capital gains/high-income taxpayers;
//   new PTET election boosted transfers; elevated federal receipts from ARPA.
// FY2023 (SFY 2022-23): PIT declined from record highs; business taxes remained
//   elevated; PTET credits reduced net PIT.
// FY2024 (SFY 2023-24): Further PIT softness; modest recovery in sales taxes;
//   business taxes moderated.
// FY2025 (SFY 2024-25): Strong rebound across all tax types; PIT surged 13.7%
//   due to financial market gains and bonus season.
// FY2026 (SFY 2025-26): Projected enacted budget; modest growth from FY2025.

const REVENUE = {
  // ── FY2022 (SFY 2021-22) — ACTUALS ────────────────────────────────────────
  // Source: FY23 enacted plan T-2 (FY2021 vs FY2022 actuals comparison)
  // Total Receipts $112,810M from T-2
  2022: {
    total: 112_810_000_000,
    categories: [
      {
        name: 'Personal Income Tax',
        // Direct GF PIT: $33,464M + PIT excess transfer: $26,055M + PTET excess: $8,215M
        total: 67_734_000_000,
        lineItems: [
          { name: 'Personal Income Tax (Direct)',               amount: 33_464_000_000 },
          { name: 'PIT Excess of Revenue Bond Debt Service',   amount: 26_055_000_000 },
          { name: 'PTET Excess of Revenue Bond Debt Service',  amount:  8_215_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        // Consumption/Use direct: $4,721M + LGAC excess: $4,121M + Revenue Bond excess: $5,572M
        total: 14_414_000_000,
        lineItems: [
          { name: 'Consumption and Use Tax (Direct)',           amount:  4_721_000_000 },
          { name: 'Sales Tax Excess of LGAC Bond Debt Service', amount: 4_121_000_000 },
          { name: 'Sales Tax Excess of Revenue Bond Debt Service', amount: 5_572_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        // Direct GF business taxes
        total: 16_697_000_000,
        lineItems: [
          { name: 'Corporate Franchise and Business Taxes',    amount: 16_697_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        // Other Taxes direct: $1,407M + Real Estate Tax excess: $1,479M
        total: 2_886_000_000,
        lineItems: [
          { name: 'Other State Taxes',                         amount:  1_407_000_000 },
          { name: 'Real Estate Taxes Excess of CW/CA Debt Service', amount: 1_479_000_000 },
        ],
      },
      {
        name: 'Miscellaneous Receipts',
        // Misc Receipts direct: $2,325M + All Other transfers: $4,254M
        total: 6_579_000_000,
        lineItems: [
          { name: 'Miscellaneous Receipts (Direct)',            amount:  2_325_000_000 },
          { name: 'All Other Transfers from Other Funds',      amount:  4_254_000_000 },
        ],
      },
      {
        name: 'Federal Receipts',
        total: 4_500_000_000,
        lineItems: [
          { name: 'Federal Grants and Receipts',               amount:  4_500_000_000 },
        ],
      },
    ],
  },

  // ── FY2023 (SFY 2022-23) — ACTUALS ────────────────────────────────────────
  // Source: FY25 enacted plan T-57 (FY2023 actuals)
  // Total Receipts $103,197M
  2023: {
    total: 103_197_000_000,
    categories: [
      {
        name: 'Personal Income Tax',
        // Direct GF PIT: $27,607M + PIT excess: $20,899M + PTET excess: $7,472M
        total: 55_978_000_000,
        lineItems: [
          { name: 'Personal Income Tax (Direct)',               amount: 27_607_000_000 },
          { name: 'PIT Excess of Revenue Bond Debt Service',   amount: 20_899_000_000 },
          { name: 'PTET Excess of Revenue Bond Debt Service',  amount:  7_472_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        // Consumption/Use direct: $7,239M + LGAC excess: $2,198M + Revenue Bond excess: $7,291M
        total: 16_728_000_000,
        lineItems: [
          { name: 'Consumption and Use Tax (Direct)',           amount:  7_239_000_000 },
          { name: 'Sales Tax Excess of LGAC Bond Debt Service', amount: 2_198_000_000 },
          { name: 'Sales Tax Excess of Revenue Bond Debt Service', amount: 7_291_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 17_856_000_000,
        lineItems: [
          { name: 'Corporate Franchise and Business Taxes',    amount: 17_856_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        // Other Taxes direct: $2,204M + Real Estate excess: $1,180M
        total: 3_384_000_000,
        lineItems: [
          { name: 'Other State Taxes',                         amount:  2_204_000_000 },
          { name: 'Real Estate Taxes Excess of CW/CA Debt Service', amount: 1_180_000_000 },
        ],
      },
      {
        name: 'Miscellaneous Receipts',
        // Misc Receipts direct: $3,609M + All Other transfers: $3,291M
        total: 6_900_000_000,
        lineItems: [
          { name: 'Miscellaneous Receipts (Direct)',            amount:  3_609_000_000 },
          { name: 'All Other Transfers from Other Funds',      amount:  3_291_000_000 },
        ],
      },
      {
        name: 'Federal Receipts',
        total: 2_351_000_000,
        lineItems: [
          { name: 'Federal Grants and Receipts',               amount:  2_351_000_000 },
        ],
      },
    ],
  },

  // ── FY2024 (SFY 2023-24) — ACTUALS ────────────────────────────────────────
  // Source: FY25 enacted plan T-60 (FY2024 actuals)
  // Total Receipts $102,997M
  2024: {
    total: 102_997_000_000,
    categories: [
      {
        name: 'Personal Income Tax',
        // Direct GF PIT: $25,312M + PIT excess: $21,748M + PTET excess: $6,978M
        total: 54_038_000_000,
        lineItems: [
          { name: 'Personal Income Tax (Direct)',               amount: 25_312_000_000 },
          { name: 'PIT Excess of Revenue Bond Debt Service',   amount: 21_748_000_000 },
          { name: 'PTET Excess of Revenue Bond Debt Service',  amount:  6_978_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        // Consumption/Use direct: $9,872M + LGAC excess: $0M + Revenue Bond excess: $7,839M
        total: 17_711_000_000,
        lineItems: [
          { name: 'Consumption and Use Tax (Direct)',           amount:  9_872_000_000 },
          { name: 'Sales Tax Excess of LGAC Bond Debt Service', amount:          0 },
          { name: 'Sales Tax Excess of Revenue Bond Debt Service', amount: 7_839_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 17_425_000_000,
        lineItems: [
          { name: 'Corporate Franchise and Business Taxes',    amount: 17_425_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        // Other Taxes direct: $1,876M + Real Estate excess: $877M
        total: 2_753_000_000,
        lineItems: [
          { name: 'Other State Taxes',                         amount:  1_876_000_000 },
          { name: 'Real Estate Taxes Excess of CW/CA Debt Service', amount:   877_000_000 },
        ],
      },
      {
        name: 'Miscellaneous Receipts',
        // Misc Receipts direct: $4,878M + All Other transfers: $3,942M
        total: 8_820_000_000,
        lineItems: [
          { name: 'Miscellaneous Receipts (Direct)',            amount:  4_878_000_000 },
          { name: 'All Other Transfers from Other Funds',      amount:  3_942_000_000 },
        ],
      },
      {
        name: 'Federal Receipts',
        total: 2_250_000_000,
        lineItems: [
          { name: 'Federal Grants and Receipts',               amount:  2_250_000_000 },
        ],
      },
    ],
  },

  // ── FY2025 (SFY 2024-25) — ACTUALS ────────────────────────────────────────
  // Source: FY26 enacted plan T-57 (FY2025 actuals)
  // Total Receipts $119,261M
  2025: {
    total: 119_261_000_000,
    categories: [
      {
        name: 'Personal Income Tax',
        // Direct GF PIT: $29,152M + PIT excess: $28,078M + PTET excess: $8,890M + ECEP: $7M
        total: 66_127_000_000,
        lineItems: [
          { name: 'Personal Income Tax (Direct)',               amount: 29_152_000_000 },
          { name: 'PIT Excess of Revenue Bond Debt Service',   amount: 28_078_000_000 },
          { name: 'PTET Excess of Revenue Bond Debt Service',  amount:  8_890_000_000 },
          { name: 'ECEP Excess of Revenue Bond Debt Service',  amount:      7_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        // Consumption/Use direct: $10,057M + LGAC excess: $0M + Revenue Bond excess: $8,636M
        total: 18_693_000_000,
        lineItems: [
          { name: 'Consumption and Use Tax (Direct)',           amount: 10_057_000_000 },
          { name: 'Sales Tax Excess of LGAC Bond Debt Service', amount:          0 },
          { name: 'Sales Tax Excess of Revenue Bond Debt Service', amount: 8_636_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 19_059_000_000,
        lineItems: [
          { name: 'Corporate Franchise and Business Taxes',    amount: 19_059_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        // Other Taxes direct: $1,322M + Real Estate excess: $969M
        total: 2_291_000_000,
        lineItems: [
          { name: 'Other State Taxes',                         amount:  1_322_000_000 },
          { name: 'Real Estate Taxes Excess of CW/CA Debt Service', amount:   969_000_000 },
        ],
      },
      {
        name: 'Miscellaneous Receipts',
        // Misc Receipts direct: $5,168M + All Other transfers: $4,273M
        total: 9_441_000_000,
        lineItems: [
          { name: 'Miscellaneous Receipts (Direct)',            amount:  5_168_000_000 },
          { name: 'All Other Transfers from Other Funds',      amount:  4_273_000_000 },
        ],
      },
      {
        name: 'Federal Receipts',
        total: 3_650_000_000,
        lineItems: [
          { name: 'Federal Grants and Receipts',               amount:  3_650_000_000 },
        ],
      },
    ],
  },

  // ── FY2026 (SFY 2025-26) — PROJECTED (enacted budget) ────────────────────
  // Source: FY26 enacted plan T-68 (FY2026 projected)
  // Total Receipts $113,515M
  2026: {
    total: 113_515_000_000,
    categories: [
      {
        name: 'Personal Income Tax',
        // Direct GF PIT: $29,370M + PIT excess: $29,723M + PTET excess: $7,692M + ECEP: $8M
        total: 66_793_000_000,
        lineItems: [
          { name: 'Personal Income Tax (Direct)',               amount: 29_370_000_000 },
          { name: 'PIT Excess of Revenue Bond Debt Service',   amount: 29_723_000_000 },
          { name: 'PTET Excess of Revenue Bond Debt Service',  amount:  7_692_000_000 },
          { name: 'ECEP Excess of Revenue Bond Debt Service',  amount:      8_000_000 },
        ],
      },
      {
        name: 'Sales and Use Taxes',
        // Consumption/Use direct: $10,316M + LGAC excess: $0M + Revenue Bond excess: $9,646M
        total: 19_962_000_000,
        lineItems: [
          { name: 'Consumption and Use Tax (Direct)',           amount: 10_316_000_000 },
          { name: 'Sales Tax Excess of LGAC Bond Debt Service', amount:          0 },
          { name: 'Sales Tax Excess of Revenue Bond Debt Service', amount: 9_646_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 17_848_000_000,
        lineItems: [
          { name: 'Corporate Franchise and Business Taxes',    amount: 17_848_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        // Other Taxes direct: $1,460M + Real Estate excess: $990M
        total: 2_450_000_000,
        lineItems: [
          { name: 'Other State Taxes',                         amount:  1_460_000_000 },
          { name: 'Real Estate Taxes Excess of CW/CA Debt Service', amount:   990_000_000 },
        ],
      },
      {
        name: 'Miscellaneous Receipts',
        // Misc Receipts direct: $4,011M + All Other transfers: $2,451M
        total: 6_462_000_000,
        lineItems: [
          { name: 'Miscellaneous Receipts (Direct)',            amount:  4_011_000_000 },
          { name: 'All Other Transfers from Other Funds',      amount:  2_451_000_000 },
        ],
      },
      {
        name: 'Federal Receipts',
        total: 0,
        lineItems: [
          { name: 'Federal Grants and Receipts',               amount:  0 },
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
    const tolerance = 1_000_000; // $1M line-item tolerance
    if (Math.abs(itemSum - cat.total) > tolerance) {
      console.error(`FY${fy} "${cat.name}": items $${itemSum.toLocaleString()} ≠ cat $${cat.total.toLocaleString()} (diff ${(itemSum - cat.total).toLocaleString()})`);
      ok = false;
    }
    catSum += cat.total;
  }

  const catTolerance = 10_000_000; // $10M cross-category tolerance
  if (Math.abs(catSum - total) > catTolerance) {
    console.error(`FY${fy} category sum $${catSum.toLocaleString()} ≠ total $${total.toLocaleString()} (diff ${(catSum - total).toLocaleString()})`);
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

  const jsonTree = [{ n: 'New York General Fund Revenue', a: total, c: children }];
  return { jsonTree, total, rowCount: categories.filter(c => c.total > 0).length };
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

  console.log(`${STATE_NAME} (${STATE_ABBR}) General Fund Revenue Loader${dryRun ? ' (dry-run)' : ''}`);
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedNYState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'New York General Fund Revenue',
      api_type:        'xlsx_download',
      dataset_type:    'revenue',
      dataset_id:      'ny-gf-revenue',
      base_url:        'https://openbudget.ny.gov/historicalFP/fy26/en/fy26fp-en.xlsx',
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
    console.log(`\n${'Category'.padEnd(35)} ${'Amount ($)'.padStart(20)}`);
    console.log('─'.repeat(57));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(33)}${Math.round(cat.a).toLocaleString().padStart(20)}`);
    }
    console.log('─'.repeat(57));
    console.log(`${'TOTAL REVENUE'.padEnd(35)}${Math.round(total).toLocaleString().padStart(20)}`);
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
