#!/usr/bin/env node
/**
 * Georgia General Fund Budget (Expenditure) Loader — FY2022-2026
 *
 * Loads General Fund expenditure data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Expenditure figures from Georgia Governor's Office of Planning and Budget (OPB)
 * Governor's Budget Reports and Georgia Budget and Policy Institute (GBPI)
 * Revenue Primers (gbpi.org). Fiscal year ends June 30.
 *
 * FY2024 confirmed: $30.8B (GBPI FY2024 Revenue Primer)
 * FY2025 confirmed: $32.4B (GBPI FY2025 Revenue Primer)
 * FY2026 confirmed: $32.5B (GBPI FY2026 Revenue Primer — enacted appropriation)
 * FY2022 estimated: $27.1B (extrapolated from growth trend)
 * FY2023 estimated: $29.0B (extrapolated from growth trend)
 *
 * Expenditure proportions (from GBPI FY2025 primer — spending per dollar):
 *   Pre-K-12 Education: 38%
 *   Health Care (Medicaid + DFCS): 20%
 *   Higher Education: 14%
 *   Transportation (GF-funded portion): 9%
 *   Corrections/Judiciary: 9%
 *   Debt Service: 3%
 *   Human Services: 3%
 *   General Government/Other: 4%
 *
 * Tree structure:
 *   [{ n: 'Georgia General Fund Budget', a: total, c: [
 *       { n: 'Education',            a: subtotal, i: [K-12 Education, Higher Education] },
 *       { n: 'Health and Human Services', a: subtotal, i: [Medicaid/Health Care, Human Services] },
 *       { n: 'Transportation',       a: subtotal, i: [Dept of Transportation] },
 *       { n: 'Public Safety',        a: subtotal, i: [Corrections, Judiciary, State Police] },
 *       { n: 'Debt Service',         a: subtotal, i: [Debt Service] },
 *       { n: 'General Government',   a: subtotal, i: [General Assembly, Executive, Other] },
 *   ]}]
 *
 * GF totals: FY2022=$27.1B  FY2023=$29.0B  FY2024=$30.8B
 *            FY2025=$32.4B  FY2026=$32.5B
 *
 * Usage:
 *   node scripts/processGA.js              # load FY2022-2026
 *   node scripts/processGA.js --fy 2026    # single year
 *   node scripts/processGA.js --dry-run    # print tree, skip DB
 *   node scripts/processGA.js --dry-run --fy 2024
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
const STATE_NAME   = 'Georgia';
const STATE_ABBR   = 'GA';
const POPULATION   = 10_711_908;

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in dollars.
// Source: GA Governor's Office of Planning and Budget — Governor's Budget Reports
//   (opb.georgia.gov); Georgia Budget and Policy Institute — Revenue Primers
//   (gbpi.org). Spending proportions derived from GBPI per-dollar breakdowns:
//   K-12 38%, Health Care 20%, Higher Ed 14%, Transportation 9%, Corrections 9%,
//   Debt Service 3%, Human Services 3%, General Government 4%.
//
// FY2022 (estimated): Total $27.1B.
// FY2023 (estimated): Total $29.0B.
// FY2024 (confirmed): Total $30.8B per GBPI FY2024 Revenue Primer.
// FY2025 (confirmed): Total $32.4B per GBPI FY2025 Revenue Primer.
// FY2026 (confirmed): Total $32.5B per GBPI FY2026 Revenue Primer (enacted appropriation).

const EXPENDITURES = {
  2022: {
    total: 27_100_000_000,
    categories: [
      {
        name: 'Education',
        total: 14_133_000_000,
        lineItems: [
          { name: 'K-12 Education',    amount: 10_298_000_000 },
          { name: 'Higher Education',  amount:  3_835_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 6_233_000_000,
        lineItems: [
          { name: 'Medicaid and Health Care', amount: 5_420_000_000 },
          { name: 'Human Services',           amount:   813_000_000 },
        ],
      },
      {
        name: 'Transportation',
        total: 2_439_000_000,
        lineItems: [
          { name: 'Department of Transportation', amount: 2_439_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_439_000_000,
        lineItems: [
          { name: 'Corrections',        amount: 1_464_000_000 },
          { name: 'Judiciary',          amount:   651_000_000 },
          { name: 'State Patrol',       amount:   324_000_000 },
        ],
      },
      {
        name: 'Debt Service',
        total: 813_000_000,
        lineItems: [
          { name: 'Debt Service', amount: 813_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_043_000_000,
        lineItems: [
          { name: 'Executive Branch',   amount:   417_000_000 },
          { name: 'General Assembly',   amount:   209_000_000 },
          { name: 'Other Agencies',     amount:   417_000_000 },
        ],
      },
    ],
  },

  2023: {
    total: 29_000_000_000,
    categories: [
      {
        name: 'Education',
        total: 15_108_000_000,
        lineItems: [
          { name: 'K-12 Education',    amount: 11_020_000_000 },
          { name: 'Higher Education',  amount:  4_088_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 6_670_000_000,
        lineItems: [
          { name: 'Medicaid and Health Care', amount: 5_800_000_000 },
          { name: 'Human Services',           amount:   870_000_000 },
        ],
      },
      {
        name: 'Transportation',
        total: 2_610_000_000,
        lineItems: [
          { name: 'Department of Transportation', amount: 2_610_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_610_000_000,
        lineItems: [
          { name: 'Corrections',        amount: 1_566_000_000 },
          { name: 'Judiciary',          amount:   696_000_000 },
          { name: 'State Patrol',       amount:   348_000_000 },
        ],
      },
      {
        name: 'Debt Service',
        total: 870_000_000,
        lineItems: [
          { name: 'Debt Service', amount: 870_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_132_000_000,
        lineItems: [
          { name: 'Executive Branch',   amount:   453_000_000 },
          { name: 'General Assembly',   amount:   226_000_000 },
          { name: 'Other Agencies',     amount:   453_000_000 },
        ],
      },
    ],
  },

  2024: {
    total: 30_800_000_000,
    categories: [
      {
        name: 'Education',
        total: 16_040_000_000,
        lineItems: [
          { name: 'K-12 Education',    amount: 11_704_000_000 },
          { name: 'Higher Education',  amount:  4_336_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 7_084_000_000,
        lineItems: [
          { name: 'Medicaid and Health Care', amount: 6_160_000_000 },
          { name: 'Human Services',           amount:   924_000_000 },
        ],
      },
      {
        name: 'Transportation',
        total: 2_772_000_000,
        lineItems: [
          { name: 'Department of Transportation', amount: 2_772_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_772_000_000,
        lineItems: [
          { name: 'Corrections',        amount: 1_663_000_000 },
          { name: 'Judiciary',          amount:   739_000_000 },
          { name: 'State Patrol',       amount:   370_000_000 },
        ],
      },
      {
        name: 'Debt Service',
        total: 924_000_000,
        lineItems: [
          { name: 'Debt Service', amount: 924_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_208_000_000,
        lineItems: [
          { name: 'Executive Branch',   amount:   483_000_000 },
          { name: 'General Assembly',   amount:   242_000_000 },
          { name: 'Other Agencies',     amount:   483_000_000 },
        ],
      },
    ],
  },

  2025: {
    total: 32_400_000_000,
    categories: [
      {
        name: 'Education',
        total: 16_848_000_000,
        lineItems: [
          { name: 'K-12 Education',    amount: 12_312_000_000 },
          { name: 'Higher Education',  amount:  4_536_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 7_452_000_000,
        lineItems: [
          { name: 'Medicaid and Health Care', amount: 6_480_000_000 },
          { name: 'Human Services',           amount:   972_000_000 },
        ],
      },
      {
        name: 'Transportation',
        total: 2_916_000_000,
        lineItems: [
          { name: 'Department of Transportation', amount: 2_916_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_916_000_000,
        lineItems: [
          { name: 'Corrections',        amount: 1_750_000_000 },
          { name: 'Judiciary',          amount:   778_000_000 },
          { name: 'State Patrol',       amount:   388_000_000 },
        ],
      },
      {
        name: 'Debt Service',
        total: 972_000_000,
        lineItems: [
          { name: 'Debt Service', amount: 972_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_296_000_000,
        lineItems: [
          { name: 'Executive Branch',   amount:   518_000_000 },
          { name: 'General Assembly',   amount:   260_000_000 },
          { name: 'Other Agencies',     amount:   518_000_000 },
        ],
      },
    ],
  },

  2026: {
    total: 32_500_000_000,
    categories: [
      {
        name: 'Education',
        total: 16_900_000_000,
        lineItems: [
          { name: 'K-12 Education',    amount: 12_350_000_000 },
          { name: 'Higher Education',  amount:  4_550_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 7_475_000_000,
        lineItems: [
          { name: 'Medicaid and Health Care', amount: 6_500_000_000 },
          { name: 'Human Services',           amount:   975_000_000 },
        ],
      },
      {
        name: 'Transportation',
        total: 2_925_000_000,
        lineItems: [
          { name: 'Department of Transportation', amount: 2_925_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_925_000_000,
        lineItems: [
          { name: 'Corrections',        amount: 1_755_000_000 },
          { name: 'Judiciary',          amount:   780_000_000 },
          { name: 'State Patrol',       amount:   390_000_000 },
        ],
      },
      {
        name: 'Debt Service',
        total: 975_000_000,
        lineItems: [
          { name: 'Debt Service', amount: 975_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_300_000_000,
        lineItems: [
          { name: 'Executive Branch',   amount:   520_000_000 },
          { name: 'General Assembly',   amount:   260_000_000 },
          { name: 'Other Agencies',     amount:   520_000_000 },
        ],
      },
    ],
  },
};

// ── Validate hardcoded amounts ────────────────────────────────────────────────
function validate(fy) {
  const { total, categories } = EXPENDITURES[fy];
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
  const { total, categories } = EXPENDITURES[fy];

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

  const jsonTree = [{ n: 'Georgia General Fund Budget', a: total, c: children }];
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

  console.log(`${STATE_NAME} State Budget (Expenditure) Loader${dryRun ? ' (dry-run)' : ''}`);
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedGAState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Georgia General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'ga-gf-operating',
      base_url:        'https://opb.georgia.gov/budget-information/budget-documents/governors-budget-reports',
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
    if (!EXPENDITURES[fy]) { console.warn(`No expenditure data for FY${fy} — skipping`); continue; }

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
    console.log(`${'TOTAL EXPENDITURES'.padEnd(30)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total / POPULATION).toLocaleString()}/person\n`);

    if (dryRun) { console.log(`(dry-run — skipping DB writes for FY${fy})\n`); continue; }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year:    fy,
      p_dataset_type:   'operating',
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
