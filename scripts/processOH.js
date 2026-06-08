#!/usr/bin/env node
/**
 * Ohio General Fund Operating Budget Loader — FY2022-2026
 *
 * Loads General Fund (GRF) expenditure data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Expenditure figures from Ohio Legislative Service Commission (LSC)
 * HB 33 Budget-in-Brief (135th GA, FY2024-2025) and HB 96 Budget-in-Brief
 * (136th GA, FY2026-2027), and OBM Popular Annual Financial Reports.
 * Source: https://www.lsc.ohio.gov/budget/
 * Amounts in dollars; FY = fiscal year ending June 30 of that calendar year.
 *
 * Ohio GRF (General Revenue Fund) = primary state operating fund.
 * Major spending: K-12 Education, Medicaid/Health & Human Services,
 *   Higher Education, Corrections/Public Safety, and General Government.
 *
 * GRF expenditure totals (state + federal GRF appropriations):
 *   FY2022: ~$38.4B (actual)  FY2023: ~$40.5B (actual)
 *   FY2024: $41.42B (enacted/actual)  FY2025: $44.74B (enacted)
 *   FY2026: ~$43.7B (enacted HB 96)
 *
 * Key sources:
 *   - HB 33 Budget-in-Brief (FY2024-2025), 135th GA
 *   - HB 96 Budget-in-Brief (FY2026-2027), 136th GA
 *   - LSC Budget Footnotes FY2024 (May 2024)
 *   - OBM Popular Annual Financial Report FY2023
 *
 * K-12 Education includes: foundation formula, community schools, STEM schools,
 *   joint vocational school districts, and other K-12 GRF appropriations.
 * Medicaid includes state AND federal GRF-funded Medicaid spending.
 * Higher Education includes: Share of Instruction (SSI), Ohio Tuition Trust,
 *   and other higher ed GRF appropriations.
 * Public Safety includes: Dept of Rehabilitation and Correction (DRC),
 *   Attorney General, Adjutant General, and judiciary.
 * General Government includes: OBM, tax administration, debt service,
 *   economic development, and other agency GRF spending.
 *
 * Usage:
 *   node scripts/processOH.js              # load FY2022-2026
 *   node scripts/processOH.js --fy 2026    # single year
 *   node scripts/processOH.js --dry-run    # print tree, skip DB
 *   node scripts/processOH.js --dry-run --fy 2024
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
const STATE_NAME   = 'Ohio';
const STATE_ABBR   = 'OH';
const POPULATION   = 11_799_448;

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in dollars.
//
// Sources:
//   LSC HB 33 Budget-in-Brief (FY2024-25, as enacted 135th GA):
//     FY2024 total GRF = $41.42B; FY2025 = $44.74B
//     K-12 FY2024 = $10.60B; K-12 FY2025 = $10.99B
//     State Medicaid GRF share FY2024 = $6.96B; FY2025 = $8.03B
//   LSC HB 96 Budget-in-Brief (FY2026-27, 136th GA):
//     Total GRF FY2026 (state+federal) ~$43.7B; State GRF only = $29.84B
//   FY2022 actual and FY2023 estimated from HB 33 Budget-in-Brief comparison columns.
//
// Medicaid: Ohio GRF Medicaid = state share + federal FMAP match credited to GRF.
//   Federal Medicaid FMAP ~62-65% of total Medicaid.
//   Total GRF Medicaid: FY2024 = ~$21.0B (state $6.96B + federal ~$14.0B)
//   For expenditure tree we use total GRF Medicaid (state+federal GRF).
//
// Confidence: FY2024 = confirmed; FY2025 = confirmed (enacted); FY2022, FY2023 = estimated; FY2026 = estimated.

const EXPENDITURES = {
  2022: {
    confidence: 'estimated',
    total: 38_400_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 17_500_000_000,
        lineItems: [
          { name: 'Medicaid',                     amount: 15_200_000_000 },
          { name: 'Job and Family Services',       amount:  1_600_000_000 },
          { name: 'Developmental Disabilities',    amount:    500_000_000 },
          { name: 'Mental Health and Addiction',   amount:    200_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 12_200_000_000,
        lineItems: [
          { name: 'K-12 Foundation Formula',       amount:  9_200_000_000 },
          { name: 'Higher Education (SSI)',         amount:  2_200_000_000 },
          { name: 'Other K-12 and Education',      amount:    800_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_800_000_000,
        lineItems: [
          { name: 'Dept of Rehabilitation and Correction', amount: 1_900_000_000 },
          { name: 'Attorney General',              amount:    450_000_000 },
          { name: 'Adjutant General',              amount:    180_000_000 },
          { name: 'Other Public Safety',           amount:    270_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 5_900_000_000,
        lineItems: [
          { name: 'Debt Service',                  amount:  1_800_000_000 },
          { name: 'Economic Development',          amount:    900_000_000 },
          { name: 'Executive and Administrative',  amount:    700_000_000 },
          { name: 'Natural Resources',             amount:    500_000_000 },
          { name: 'Other Agencies',                amount:  2_000_000_000 },
        ],
      },
    ],
  },

  2023: {
    confidence: 'estimated',
    total: 40_500_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 18_400_000_000,
        lineItems: [
          { name: 'Medicaid',                     amount: 16_000_000_000 },
          { name: 'Job and Family Services',       amount:  1_600_000_000 },
          { name: 'Developmental Disabilities',    amount:    550_000_000 },
          { name: 'Mental Health and Addiction',   amount:    250_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 12_800_000_000,
        lineItems: [
          { name: 'K-12 Foundation Formula',       amount:  9_700_000_000 },
          { name: 'Higher Education (SSI)',         amount:  2_300_000_000 },
          { name: 'Other K-12 and Education',      amount:    800_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_900_000_000,
        lineItems: [
          { name: 'Dept of Rehabilitation and Correction', amount: 1_950_000_000 },
          { name: 'Attorney General',              amount:    480_000_000 },
          { name: 'Adjutant General',              amount:    190_000_000 },
          { name: 'Other Public Safety',           amount:    280_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 6_400_000_000,
        lineItems: [
          { name: 'Debt Service',                  amount:  1_900_000_000 },
          { name: 'Economic Development',          amount:  1_000_000_000 },
          { name: 'Executive and Administrative',  amount:    800_000_000 },
          { name: 'Natural Resources',             amount:    500_000_000 },
          { name: 'Other Agencies',                amount:  2_200_000_000 },
        ],
      },
    ],
  },

  2024: {
    confidence: 'confirmed',
    total: 41_420_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 21_010_000_000,
        lineItems: [
          { name: 'Medicaid',                     amount: 18_800_000_000 },
          { name: 'Job and Family Services',       amount:  1_350_000_000 },
          { name: 'Developmental Disabilities',    amount:    610_000_000 },
          { name: 'Mental Health and Addiction',   amount:    250_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 13_040_000_000,
        lineItems: [
          { name: 'K-12 Foundation Formula',       amount: 10_600_000_000 },
          { name: 'Higher Education (SSI)',         amount:  1_700_000_000 },
          { name: 'Other K-12 and Education',      amount:    740_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 2_970_000_000,
        lineItems: [
          { name: 'Dept of Rehabilitation and Correction', amount: 2_000_000_000 },
          { name: 'Attorney General',              amount:    500_000_000 },
          { name: 'Adjutant General',              amount:    200_000_000 },
          { name: 'Other Public Safety',           amount:    270_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 4_400_000_000,
        lineItems: [
          { name: 'Debt Service',                  amount:  1_500_000_000 },
          { name: 'Economic Development',          amount:    800_000_000 },
          { name: 'Executive and Administrative',  amount:    700_000_000 },
          { name: 'Natural Resources',             amount:    500_000_000 },
          { name: 'Other Agencies',                amount:    900_000_000 },
        ],
      },
    ],
  },

  2025: {
    confidence: 'confirmed',
    total: 44_740_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 23_630_000_000,
        lineItems: [
          { name: 'Medicaid',                     amount: 21_200_000_000 },
          { name: 'Job and Family Services',       amount:  1_500_000_000 },
          { name: 'Developmental Disabilities',    amount:    680_000_000 },
          { name: 'Mental Health and Addiction',   amount:    250_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 13_510_000_000,
        lineItems: [
          { name: 'K-12 Foundation Formula',       amount: 10_990_000_000 },
          { name: 'Higher Education (SSI)',         amount:  1_800_000_000 },
          { name: 'Other K-12 and Education',      amount:    720_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 3_100_000_000,
        lineItems: [
          { name: 'Dept of Rehabilitation and Correction', amount: 2_100_000_000 },
          { name: 'Attorney General',              amount:    520_000_000 },
          { name: 'Adjutant General',              amount:    210_000_000 },
          { name: 'Other Public Safety',           amount:    270_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 4_500_000_000,
        lineItems: [
          { name: 'Debt Service',                  amount:  1_500_000_000 },
          { name: 'Economic Development',          amount:    900_000_000 },
          { name: 'Executive and Administrative',  amount:    700_000_000 },
          { name: 'Natural Resources',             amount:    500_000_000 },
          { name: 'Other Agencies',                amount:    900_000_000 },
        ],
      },
    ],
  },

  2026: {
    confidence: 'estimated',
    total: 43_700_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 22_700_000_000,
        lineItems: [
          { name: 'Medicaid',                     amount: 20_300_000_000 },
          { name: 'Job and Family Services',       amount:  1_500_000_000 },
          { name: 'Developmental Disabilities',    amount:    650_000_000 },
          { name: 'Mental Health and Addiction',   amount:    250_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 13_400_000_000,
        lineItems: [
          { name: 'K-12 Foundation Formula',       amount: 10_900_000_000 },
          { name: 'Higher Education (SSI)',         amount:  1_800_000_000 },
          { name: 'Other K-12 and Education',      amount:    700_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 3_000_000_000,
        lineItems: [
          { name: 'Dept of Rehabilitation and Correction', amount: 2_000_000_000 },
          { name: 'Attorney General',              amount:    530_000_000 },
          { name: 'Adjutant General',              amount:    200_000_000 },
          { name: 'Other Public Safety',           amount:    270_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 4_600_000_000,
        lineItems: [
          { name: 'Debt Service',                  amount:  1_500_000_000 },
          { name: 'Economic Development',          amount:    950_000_000 },
          { name: 'Executive and Administrative',  amount:    750_000_000 },
          { name: 'Natural Resources',             amount:    500_000_000 },
          { name: 'Other Agencies',                amount:    900_000_000 },
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
          f:  'General Revenue Fund',
          e:  null,
        })),
    }));
  children.sort((a, b) => b.a - a.a);

  const jsonTree = [{ n: 'Ohio General Fund Budget', a: total, c: children }];
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

  console.log(`${STATE_NAME} State Operating Budget Loader${dryRun ? ' (dry-run)' : ''}`);
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedOHState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Ohio General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'oh-gf-operating',
      base_url:        'https://www.lsc.ohio.gov/budget/',
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

    console.log(`── FY${fy} (${EXPENDITURES[fy].confidence}) ${'─'.repeat(50)}`);

    if (!validate(fy)) { console.error(`FY${fy} validation failed — aborting`); process.exit(2); }
    console.log(`FY${fy} validation: PASS`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    // Print summary table
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(35)} ${'Amount ($)'.padStart(18)}`);
    console.log('─'.repeat(55));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(33)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('─'.repeat(55));
    console.log(`${'TOTAL EXPENDITURES'.padEnd(35)}${Math.round(total).toLocaleString().padStart(18)}`);
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
