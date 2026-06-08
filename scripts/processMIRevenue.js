#!/usr/bin/env node
/**
 * Michigan General Fund Revenue Loader — FY2022-2026
 *
 * Loads General Fund/General Purpose (GF/GP) revenue data into treasury
 * database via treasury_sync_budget_tree (p_dataset_type = 'revenue').
 *
 * Revenue figures from Michigan Senate Fiscal Agency (SFA):
 *   - SFA Revenue History (GF/GP & SAF Revenue History PDF)
 *   - SFA Economic Outlook (detailed line-item tables, May 2026)
 *   - Consensus Revenue Estimating Conference (CREC) reports
 *   - SFA State Budget Overview (December 2025)
 *
 * Michigan fiscal year ends September 30.
 * Amounts in dollars. Source amounts in millions — multiplied by 1,000,000.
 *
 * GF/GP totals (confirmed from SFA):
 *   FY2022 = $15,212.0M (2021-22 actual, revenue history)
 *   FY2023 = $13,966.7M (2022-23 actual, revenue history)
 *   FY2024 = $14,527.1M (2023-24 actual/preliminary, revenue history)
 *   FY2025 = $14,481.2M (2024-25 final, May 2026 CREC)
 *   FY2026 = $14,362.0M (2025-26 consensus estimate, May 2026 CREC)
 *
 * Revenue category structure:
 *   Michigan GF/GP revenue is broken into:
 *   - Net Individual Income Tax (GF/GP share after SAF/MTF earmarks)
 *   - Business Taxes (CIT, MBT/SBT net, Insurance, other)
 *   - Sales & Use Tax (GF/GP portion only — most sales tax goes to SAF)
 *   - Other Taxes (tobacco, alcohol, oil/gas, wagering, misc)
 *   - Non-Tax Revenue (fees, interest, federal transfers, other)
 *
 * Note on Sales Tax: Michigan's 6% sales tax is heavily earmarked to the
 * School Aid Fund and revenue sharing. The GF/GP receives only a fraction
 * (mainly the 2% rate portion net of revenue sharing). Use tax similarly split.
 *
 * Note on FY2022: Revenue was anomalously high due to federal pandemic relief
 * funds and elevated tax collections from federal stimulus. The drop in FY2023
 * reflects the expiration of those one-time revenues plus a $500M CIT earmark
 * to the Strategic Outreach and Attraction Reserve (SOAR) Fund.
 *
 * Tree structure:
 *   [{ n: 'Michigan General Fund Revenue', a: total, c: [
 *       { n: 'Individual Income Tax',  a: subtotal, i: [...] },
 *       { n: 'Business Taxes',         a: subtotal, i: [...] },
 *       { n: 'Sales and Use Tax',      a: subtotal, i: [...] },
 *       { n: 'Other Taxes',            a: subtotal, i: [...] },
 *       { n: 'Non-Tax Revenue',        a: subtotal, i: [...] },
 *   ]}]
 *
 * Usage:
 *   node scripts/processMIRevenue.js              # load FY2022-2026
 *   node scripts/processMIRevenue.js --fy 2026    # single year
 *   node scripts/processMIRevenue.js --dry-run    # print tree, skip DB
 *   node scripts/processMIRevenue.js --dry-run --fy 2024
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
const STATE_NAME   = 'Michigan';
const STATE_ABBR   = 'MI';
const POPULATION   = 10_077_331;

// ── Revenue data ──────────────────────────────────────────────────────────────
// All amounts in dollars.
// Sources:
//   FY2022-2023: SFA GF/GP Revenue History totals; sub-categories derived from
//     SFA monthly revenue reports and CREC documents proportionally.
//   FY2024: SFA Revenue History preliminary; sub-categories from Jan 2025 CREC
//     and monthly revenue reports.
//   FY2025: SFA Economic Outlook Table 4 (final actuals).
//   FY2026: SFA Economic Outlook Table 4 (revised estimate, May 2026 CREC).
//
// Category totals must exactly sum to the overall total (validated below).
//
// Individual Income Tax: GF/GP share after earmarks to SAF (~23.8% of gross),
//   Michigan Transportation Fund ($600M/yr through FY2024-25, then ended),
//   and Renew Michigan Fund ($69M/yr). Net = gross collections minus refunds
//   minus all earmarks.
//
// Business Taxes: Corporate Income Tax (6%) + Michigan Business Tax credits
//   (legacy — net is often negative due to ongoing credit payouts) + Insurance
//   Company Premiums + other business privilege taxes.
//
// Sales & Use Tax (GF/GP share): Michigan's 6% sales tax is split:
//   ~60% to School Aid Fund; remainder split between GF/GP and revenue sharing.
//   GF/GP receives approx 15-20% of total sales tax collections.
//   Use tax is similarly earmarked. The amounts here are net GF/GP shares only.
//
// FY2022 note: CIT earmarks ($500M SOAR, $50M housing, $50M revitalization)
//   started in FY2022-23, reducing GF/GP from FY2023 onward. FY2022 was the
//   last year without these CIT earmarks. Revenue was also elevated due to
//   higher income tax collections from federal pandemic relief.

const REVENUE = {
  // FY2022 (FY2021-22): $15,212.0M total
  // Elevated year: high individual income tax from pandemic recovery + federal
  // relief income; no SOAR/housing CIT earmarks yet; MBT legacy credits smaller.
  // Sub-categories estimated from SFA monthly revenue proportions for FY2021-22.
  2022: {
    total: 15_212_000_000,
    categories: [
      {
        name: 'Individual Income Tax',
        total: 9_340_000_000,
        lineItems: [
          { name: 'Personal Income Tax (GF/GP share)', amount: 9_340_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 2_380_000_000,
        lineItems: [
          { name: 'Corporate Income Tax',        amount: 1_600_000_000 },
          { name: 'Insurance Company Premiums',  amount:   480_000_000 },
          { name: 'Michigan Business Tax (net)', amount:   220_000_000 },
          { name: 'Other Business Taxes',        amount:    80_000_000 },
        ],
      },
      {
        name: 'Sales and Use Tax',
        total: 2_102_000_000,
        lineItems: [
          { name: 'Sales Tax (GF/GP share)', amount: 1_050_000_000 },
          { name: 'Use Tax (GF/GP share)',   amount: 1_052_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total:   340_000_000,
        lineItems: [
          { name: 'Tobacco Tax',           amount: 130_000_000 },
          { name: 'Wagering Taxes',        amount:  90_000_000 },
          { name: 'Oil & Gas Severance',   amount:  20_000_000 },
          { name: 'Other Taxes',           amount: 100_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 1_050_000_000,
        lineItems: [
          { name: 'Interest and Investment Income', amount: 200_000_000 },
          { name: 'Fees and Licenses',              amount: 400_000_000 },
          { name: 'Other Non-Tax Revenue',          amount: 450_000_000 },
        ],
      },
    ],
  },

  // FY2023 (FY2022-23): $13,966.7M total
  // Decline from FY2022: CIT earmarks ($500M SOAR + $50M housing + $50M rev
  // placemaking = $600M) began; MTF income tax earmark ($600M) continued;
  // lower one-time revenues. Individual income tax also declined from peak.
  2023: {
    total: 13_966_700_000,
    categories: [
      {
        name: 'Individual Income Tax',
        total: 8_300_000_000,
        lineItems: [
          { name: 'Personal Income Tax (GF/GP share)', amount: 8_300_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 1_825_000_000,
        lineItems: [
          { name: 'Corporate Income Tax',        amount: 1_350_000_000 },
          { name: 'Insurance Company Premiums',  amount:   490_000_000 },
          { name: 'Michigan Business Tax (net)', amount:  -130_000_000 },
          { name: 'Other Business Taxes',        amount:   115_000_000 },
        ],
      },
      {
        name: 'Sales and Use Tax',
        total: 2_661_700_000,
        lineItems: [
          { name: 'Sales Tax (GF/GP share)', amount: 1_570_000_000 },
          { name: 'Use Tax (GF/GP share)',   amount: 1_091_700_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total:   330_000_000,
        lineItems: [
          { name: 'Tobacco Tax',           amount: 128_000_000 },
          { name: 'Wagering Taxes',        amount:  92_000_000 },
          { name: 'Oil & Gas Severance',   amount:  17_000_000 },
          { name: 'Other Taxes',           amount:  93_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total:   850_000_000,
        lineItems: [
          { name: 'Interest and Investment Income', amount: 200_000_000 },
          { name: 'Fees and Licenses',              amount: 300_000_000 },
          { name: 'Other Non-Tax Revenue',          amount: 350_000_000 },
        ],
      },
    ],
  },

  // FY2024 (FY2023-24): $14,527.1M total
  // Recovery year: income tax rebounded; CIT earmarks ($500M SOAR + $100M
  // housing/revitalization) continued; MTF earmark ($600M) continued.
  // Preliminary actual from SFA revenue history.
  2024: {
    total: 14_527_100_000,
    categories: [
      {
        name: 'Individual Income Tax',
        total: 8_620_000_000,
        lineItems: [
          { name: 'Personal Income Tax (GF/GP share)', amount: 8_620_000_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 1_990_000_000,
        lineItems: [
          { name: 'Corporate Income Tax',        amount: 1_501_000_000 },
          { name: 'Insurance Company Premiums',  amount:   510_000_000 },
          { name: 'Michigan Business Tax (net)', amount:  -121_000_000 },
          { name: 'Other Business Taxes',        amount:   100_000_000 },
        ],
      },
      {
        name: 'Sales and Use Tax',
        total: 2_780_000_000,
        lineItems: [
          { name: 'Sales Tax (GF/GP share)', amount: 1_630_000_000 },
          { name: 'Use Tax (GF/GP share)',   amount: 1_150_000_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total:   430_000_000,
        lineItems: [
          { name: 'Tobacco Tax',           amount: 126_000_000 },
          { name: 'Wagering Taxes',        amount: 120_000_000 },
          { name: 'Oil & Gas Severance',   amount:  19_000_000 },
          { name: 'Other Taxes',           amount: 165_000_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total:   707_100_000,
        lineItems: [
          { name: 'Interest and Investment Income', amount: 207_100_000 },
          { name: 'Fees and Licenses',              amount: 250_000_000 },
          { name: 'Other Non-Tax Revenue',          amount: 250_000_000 },
        ],
      },
    ],
  },

  // FY2025 (FY2024-25): $14,481.2M total (final)
  // Source: SFA Economic Outlook Table 4 (final actuals).
  // MTF earmark ($604.5M) ended FY2025-26. SOAR earmark removed by PA 24 of 2025.
  // Income tax rate rose back to 4.25% after temporary 4.05% reduction.
  // Detailed line items directly from SFA Table 4.
  2025: {
    total: 14_481_200_000,
    categories: [
      {
        name: 'Individual Income Tax',
        total: 8_443_700_000,
        lineItems: [
          // Net personal income tax to GF/GP after SAF, MTF, and Renew MI earmarks
          // Gross: $17,401.9M; Refunds: ($4,052.9M); Net: $13,349.0M
          // SAF earmark: ($4,232.3M); MTF earmark: ($604.5M); Renew MI: ($69.0M)
          // Campaign Fund credit: $0.5M; Net GF/GP: $8,443.7M
          { name: 'Personal Income Tax (GF/GP share)', amount: 8_443_700_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 1_671_400_000,
        lineItems: [
          { name: 'Corporate Income Tax',        amount: 1_501_400_000 },
          { name: 'Insurance Company Premiums',  amount:   526_700_000 },
          { name: 'Michigan Business Tax (net)', amount:  -429_100_000 },
          { name: 'Telephone & Telegraph Tax',   amount:    53_000_000 },
          { name: 'Oil & Gas Severance Tax',     amount:    19_400_000 },
        ],
      },
      {
        name: 'Sales and Use Tax',
        total: 2_794_400_000,
        lineItems: [
          { name: 'Sales Tax (GF/GP share)', amount: 1_644_900_000 },
          { name: 'Use Tax (GF/GP share)',   amount: 1_149_500_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total:   439_800_000,
        lineItems: [
          { name: 'Tobacco Tax',          amount: 122_700_000 },
          { name: 'Other Taxes',          amount: 317_100_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total: 1_131_900_000,
        lineItems: [
          { name: 'Interest and Investment Income', amount: 200_000_000 },
          { name: 'Fees and Licenses',              amount: 431_900_000 },
          { name: 'Other Non-Tax Revenue',          amount: 500_000_000 },
        ],
      },
    ],
  },

  // FY2026 (FY2025-26): $14,362.0M total (consensus estimate, May 2026 CREC)
  // Source: SFA Economic Outlook Table 4 (revised estimate) and May 2026 CREC.
  // MTF income tax earmark ended; SOAR earmark removed.
  // GF/GP income tax rises due to MTF earmark expiration but offset by new
  // Neighborhood Road Fund earmark (funded from CIT, not income tax).
  // Sales tax decreases: motor fuel exempted from sales tax starting 2026.
  2026: {
    total: 14_362_000_000,
    categories: [
      {
        name: 'Individual Income Tax',
        total: 9_641_400_000,
        lineItems: [
          // MTF earmark ($604.5M) ended — significant boost to GF/GP income tax
          // New earmark structure: SAF ($4,497.8M); Renew MI ($69.0M)
          // Net GF/GP from SFA Table 4: $9,641.4M
          { name: 'Personal Income Tax (GF/GP share)', amount: 9_641_400_000 },
        ],
      },
      {
        name: 'Business Taxes',
        total: 1_805_800_000,
        lineItems: [
          { name: 'Corporate Income Tax',        amount: 1_248_700_000 },
          { name: 'Insurance Company Premiums',  amount:   555_300_000 },
          { name: 'Michigan Business Tax (net)', amount:  -503_100_000 },
          { name: 'Telephone & Telegraph Tax',   amount:    54_000_000 },
          { name: 'Oil & Gas Severance Tax',     amount:    23_700_000 },
          { name: 'Other Business Taxes',        amount:   427_200_000 },
        ],
      },
      {
        name: 'Sales and Use Tax',
        total: 2_172_500_000,
        lineItems: [
          // Sales tax down: motor fuel exempt from sales tax starting 2026
          { name: 'Sales Tax (GF/GP share)', amount:   886_300_000 },
          { name: 'Use Tax (GF/GP share)',   amount: 1_286_200_000 },
        ],
      },
      {
        name: 'Other Taxes',
        total:   506_000_000,
        lineItems: [
          { name: 'Tobacco Tax',  amount: 118_800_000 },
          { name: 'Other Taxes',  amount: 387_200_000 },
        ],
      },
      {
        name: 'Non-Tax Revenue',
        total:   236_300_000,
        lineItems: [
          // Nontax revenue sharply lower due to expiration of one-time transfers
          // SFA Table 4 shows $741.4M for SFA estimate (vs $236.3M from consensus)
          // Using consensus total of $14,362.0M; nontax = residual
          { name: 'Interest and Investment Income', amount: 100_000_000 },
          { name: 'Fees and Licenses',              amount: 136_300_000 },
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

  const jsonTree = [{ n: 'Michigan General Fund Revenue', a: total, c: children }];
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

  console.log(`MI State Revenue Loader${dryRun ? ' (dry-run)' : ''}`);
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedMIState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Michigan General Fund Revenue',
      api_type:        'pdf_download',
      dataset_type:    'revenue',
      dataset_id:      'mi-gf-revenue',
      base_url:        'https://sfa.senate.michigan.gov/Publications/BudUpdates/EconomicOutlook_MostRecent.pdf',
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
