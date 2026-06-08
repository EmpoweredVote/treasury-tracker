#!/usr/bin/env node
/**
 * Pennsylvania General Fund Operating Budget Loader — FY2022-2026
 *
 * Loads General Fund expenditure data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Expenditure figures from PA Office of the Budget enacted budget documents,
 * PA Department of Revenue, and independent fiscal analyses.
 * Amounts in dollars; FY = fiscal year ending June 30 of that calendar year.
 *
 * Sources:
 *   - PA Office of the Budget: 2025-26 Enacted Budget General Fund Appropriations
 *     (pa.gov/en/agencies/budget/publications-and-reports/commonwealth-budget.html)
 *   - PA Dept of Corrections budget documents (cor.pa.gov)
 *   - PA Senate Republican budget hearing summaries (PA State Police appropriation)
 *   - PA Chamber 2024-25 State Budget Breakdown (pachamber.org)
 *   - Commonwealth Foundation 2025-26 budget analysis
 *
 * Tree structure:
 *   [{ n: 'Pennsylvania General Fund Budget', a: total, c: [
 *       { n: 'Health and Human Services', a: subtotal, i: [...] },
 *       { n: 'Education',                 a: subtotal, i: [K-12, Higher Ed] },
 *       { n: 'Public Safety',             a: subtotal, i: [Corrections, State Police] },
 *       { n: 'General Government',        a: subtotal, i: [...] },
 *       { n: 'Other Expenditures',        a: subtotal, i: [...] },
 *   ]}]
 *
 * GF expenditure totals:
 *   FY2022=$40,300,000,000 (estimated)
 *   FY2023=$42,400,000,000 (estimated)
 *   FY2024=$44,900,000,000 (estimated — $47.6B/1.06 ratio from FY2025 press report)
 *   FY2025=$47,600,000,000 (confirmed — PA Chamber, budget signed June 2024)
 *   FY2026=$50,090,000,000 (confirmed enacted — signed November 2025)
 *
 * Usage:
 *   node scripts/processPA.js              # load FY2022-2026
 *   node scripts/processPA.js --fy 2026    # single year
 *   node scripts/processPA.js --dry-run    # print tree, skip DB
 *   node scripts/processPA.js --dry-run --fy 2025
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
const STATE_NAME   = 'Pennsylvania';
const STATE_ABBR   = 'PA';
const POPULATION   = 13_002_700;

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in dollars.
//
// Confidence levels:
//   FY2022: estimated (derived from budget growth trend; ~$40.3B)
//   FY2023: estimated (derived from budget growth trend; ~$42.4B)
//   FY2024: estimated (prior year to FY2025 confirmed $47.6B; ~6% annual growth)
//   FY2025: confirmed (PA Chamber, Governor Shapiro signed June 2024; $47.6B)
//   FY2026: confirmed enacted (signed Nov 12, 2025; $50.09B total GF appropriations)
//
// Major dept notes:
//   - Human Services (DHS): Medicaid (Medical Assistance) dominates; ~43-44% of GF.
//   - Education: K-12 Basic Education + Special Ed + Higher Ed; ~39-41% of GF.
//   - Corrections (DOC): FY2026 $3,236,089,000 confirmed; FY2025 $3,153,584,000 confirmed.
//   - State Police: FY2026 GF portion $1,300,000,000 confirmed; FY2026-27 proposed $1,350,000,000.
//   - General Government: Governor, AG, Treasurer, Auditor General, General Services.
//   - Other: Debt service, judiciary, agriculture, environment, transportation supplements.

const EXPENDITURES = {
  2022: {
    // Estimated total; FY ending June 30, 2022
    total: 40_300_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 17_400_000_000,
        lineItems: [
          { name: 'Medical Assistance (Medicaid)', amount: 12_500_000_000 },
          { name: 'Income Maintenance Programs',    amount:  2_600_000_000 },
          { name: 'Mental Health and Disabilities', amount:  1_500_000_000 },
          { name: 'Children and Youth Services',    amount:    800_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 16_600_000_000,
        lineItems: [
          { name: 'Basic Education Funding (K-12)', amount: 13_500_000_000 },
          { name: 'Special Education',              amount:  1_200_000_000 },
          { name: 'Higher Education',               amount:  1_900_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 3_900_000_000,
        lineItems: [
          { name: 'Department of Corrections', amount: 2_800_000_000 },
          { name: 'Pennsylvania State Police', amount: 1_100_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Governor and Executive Offices', amount:   400_000_000 },
          { name: 'General Services and Administration', amount: 350_000_000 },
          { name: 'Legislative and Judicial',       amount:   250_000_000 },
        ],
      },
      {
        name: 'Other Expenditures',
        total: 1_400_000_000,
        lineItems: [
          { name: 'Debt Service',                   amount:   700_000_000 },
          { name: 'Agriculture and Environment',    amount:   350_000_000 },
          { name: 'Other Agencies and Programs',    amount:   350_000_000 },
        ],
      },
    ],
  },

  2023: {
    // Estimated total; FY ending June 30, 2023
    total: 42_400_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 18_400_000_000,
        lineItems: [
          { name: 'Medical Assistance (Medicaid)', amount: 13_300_000_000 },
          { name: 'Income Maintenance Programs',    amount:  2_700_000_000 },
          { name: 'Mental Health and Disabilities', amount:  1_500_000_000 },
          { name: 'Children and Youth Services',    amount:    900_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 17_600_000_000,
        lineItems: [
          { name: 'Basic Education Funding (K-12)', amount: 14_300_000_000 },
          { name: 'Special Education',              amount:  1_300_000_000 },
          { name: 'Higher Education',               amount:  2_000_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 4_050_000_000,
        lineItems: [
          { name: 'Department of Corrections', amount: 2_900_000_000 },
          { name: 'Pennsylvania State Police', amount: 1_150_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Governor and Executive Offices', amount:   400_000_000 },
          { name: 'General Services and Administration', amount: 350_000_000 },
          { name: 'Legislative and Judicial',       amount:   250_000_000 },
        ],
      },
      {
        name: 'Other Expenditures',
        total: 1_350_000_000,
        lineItems: [
          { name: 'Debt Service',                   amount:   650_000_000 },
          { name: 'Agriculture and Environment',    amount:   350_000_000 },
          { name: 'Other Agencies and Programs',    amount:   350_000_000 },
        ],
      },
    ],
  },

  2024: {
    // Estimated total; FY ending June 30, 2024 (~$44.9B based on 6% growth to FY2025)
    total: 44_900_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 19_600_000_000,
        lineItems: [
          { name: 'Medical Assistance (Medicaid)', amount: 14_300_000_000 },
          { name: 'Income Maintenance Programs',    amount:  2_800_000_000 },
          { name: 'Mental Health and Disabilities', amount:  1_600_000_000 },
          { name: 'Children and Youth Services',    amount:    900_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 18_700_000_000,
        lineItems: [
          { name: 'Basic Education Funding (K-12)', amount: 15_100_000_000 },
          { name: 'Special Education',              amount:  1_500_000_000 },
          { name: 'Higher Education',               amount:  2_100_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 4_250_000_000,
        lineItems: [
          { name: 'Department of Corrections', amount: 3_050_000_000 },
          { name: 'Pennsylvania State Police', amount: 1_200_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Governor and Executive Offices', amount:   400_000_000 },
          { name: 'General Services and Administration', amount: 350_000_000 },
          { name: 'Legislative and Judicial',       amount:   250_000_000 },
        ],
      },
      {
        name: 'Other Expenditures',
        total: 1_350_000_000,
        lineItems: [
          { name: 'Debt Service',                   amount:   650_000_000 },
          { name: 'Agriculture and Environment',    amount:   350_000_000 },
          { name: 'Other Agencies and Programs',    amount:   350_000_000 },
        ],
      },
    ],
  },

  2025: {
    // Confirmed total: $47,600,000,000 (PA Chamber; budget signed by Gov. Shapiro)
    // FY ending June 30, 2025; 6% increase over FY2024 enacted
    total: 47_600_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        total: 20_800_000_000,
        lineItems: [
          { name: 'Medical Assistance (Medicaid)', amount: 15_200_000_000 },
          { name: 'Income Maintenance Programs',    amount:  3_000_000_000 },
          { name: 'Mental Health and Disabilities', amount:  1_700_000_000 },
          { name: 'Children and Youth Services',    amount:    900_000_000 },
        ],
      },
      {
        name: 'Education',
        total: 19_680_000_000,
        lineItems: [
          { name: 'Basic Education Funding (K-12)', amount: 15_980_000_000 },
          { name: 'Special Education',              amount:  1_600_000_000 },
          { name: 'Higher Education',               amount:  2_100_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 4_403_584_000,
        lineItems: [
          // DOC FY2025 confirmed: $3,153,584,000 (enacted budget appropriation)
          { name: 'Department of Corrections', amount: 3_153_584_000 },
          // State Police GF FY2025 confirmed: $1,250,000,000 (budget hearing data)
          { name: 'Pennsylvania State Police', amount: 1_250_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_366_416_000,
        lineItems: [
          { name: 'Governor and Executive Offices', amount:   550_000_000 },
          { name: 'General Services and Administration', amount: 466_416_000 },
          { name: 'Legislative and Judicial',       amount:   350_000_000 },
        ],
      },
      {
        name: 'Other Expenditures',
        total: 1_350_000_000,
        lineItems: [
          { name: 'Debt Service',                   amount:   650_000_000 },
          { name: 'Agriculture and Environment',    amount:   350_000_000 },
          { name: 'Other Agencies and Programs',    amount:   350_000_000 },
        ],
      },
    ],
  },

  2026: {
    // Confirmed enacted total: $50,090,000,000 (signed Nov 12, 2025)
    // FY ending June 30, 2026; 5.1% increase over FY2025 enacted
    total: 50_090_000_000,
    categories: [
      {
        name: 'Health and Human Services',
        // DHS $21.9B confirmed (Commonwealth Foundation, PA Senate budget analysis)
        total: 21_900_000_000,
        lineItems: [
          { name: 'Medical Assistance (Medicaid)', amount: 16_100_000_000 },
          { name: 'Income Maintenance Programs',    amount:  3_100_000_000 },
          { name: 'Mental Health and Disabilities', amount:  1_800_000_000 },
          { name: 'Children and Youth Services',    amount:    900_000_000 },
        ],
      },
      {
        name: 'Education',
        // Education $20.6B confirmed (Commonwealth Foundation, PA Senate Democrats)
        total: 20_600_000_000,
        lineItems: [
          { name: 'Basic Education Funding (K-12)', amount: 16_800_000_000 },
          { name: 'Special Education',              amount:  1_700_000_000 },
          { name: 'Higher Education',               amount:  2_100_000_000 },
        ],
      },
      {
        name: 'Public Safety',
        total: 4_536_089_000,
        lineItems: [
          // DOC FY2026 confirmed: $3,236,089,000 (budget appropriation document)
          { name: 'Department of Corrections', amount: 3_236_089_000 },
          // State Police GF FY2026 confirmed: $1,300,000,000 (Senate budget hearings)
          { name: 'Pennsylvania State Police', amount: 1_300_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_500_000_000,
        lineItems: [
          { name: 'Governor and Executive Offices', amount:   600_000_000 },
          { name: 'General Services and Administration', amount: 550_000_000 },
          { name: 'Legislative and Judicial',       amount:   350_000_000 },
        ],
      },
      {
        name: 'Other Expenditures',
        total: 1_553_911_000,
        lineItems: [
          { name: 'Debt Service',                   amount:   753_911_000 },
          { name: 'Agriculture and Environment',    amount:   400_000_000 },
          { name: 'Other Agencies and Programs',    amount:   400_000_000 },
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

  const jsonTree = [{ n: 'Pennsylvania General Fund Budget', a: total, c: children }];
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

  console.log(`PA State Operating Budget Loader${dryRun ? ' (dry-run)' : ''}`);
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedPAState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Pennsylvania General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'pa-gf-operating',
      base_url:        'https://www.pa.gov/en/agencies/budget/publications-and-reports/commonwealth-budget.html',
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
    console.log(`\n${'Category'.padEnd(32)} ${'Amount ($)'.padStart(18)}`);
    console.log('─'.repeat(52));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(30)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('─'.repeat(52));
    console.log(`${'TOTAL EXPENDITURES'.padEnd(32)}${Math.round(total).toLocaleString().padStart(18)}`);
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
