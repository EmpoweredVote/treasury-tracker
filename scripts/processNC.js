#!/usr/bin/env node
/**
 * North Carolina General Fund Budget (Expenditures) Loader — FY2022-2026
 *
 * Loads General Fund expenditure data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Expenditure figures from NC Office of State Budget and Management (OSBM)
 * certified budgets, Governor's budget recommendations, and NASBO.
 * Amounts in dollars; FY = fiscal year ending June 30 of that calendar year.
 *
 * Sources:
 *   FY2026: NASBO / Governor Stein recommended budget ($33.3B GF appropriations)
 *     https://www.nasbo.org/resources/northcarolina-budget
 *   FY2024-FY2025: OSBM certified budget (2023-25 biennium) / FRD Fiscal Brief 2024
 *     https://www.osbm.nc.gov/budget/certified-budget
 *     https://sites.ncleg.gov/frd/wp-content/uploads/sites/7/2025/03/Budget_and_Fiscal_Policy_Highlights_2024.pdf
 *   FY2022-FY2023: OSBM certified budget (2021-23 biennium)
 *     https://www.osbm.nc.gov/budget/certified-budget
 *
 * NC General Fund functional categories (from OSBM certified budget structure):
 *   Education (largest — K-12 DPI + UNC System + community colleges)
 *   Health and Human Services (Medicaid + social services + mental health)
 *   Justice and Public Safety (corrections, judiciary, SBI, state crime lab)
 *   General Government (administration, commerce, environment, agriculture)
 *   Natural and Economic Resources (agriculture, commerce, environment, labor)
 *   Transportation (highway fund supplemental GF transfers; small share)
 *   Reserves and Debt Service (statewide reserves, OPEB, capital)
 *
 * GF expenditure totals (appropriations):
 *   FY2022 = $27,900,000,000  (estimated — 2021-23 biennium first year)
 *   FY2023 = $29,800,000,000  (estimated — 2021-23 biennium second year)
 *   FY2024 = $30,900,000,000  (estimated — 2023-25 biennium first year)
 *   FY2025 = $32,100,000,000  (estimated — 2023-25 biennium second year)
 *   FY2026 = $33,300,000,000  (estimated — Governor's recommended; NASBO)
 *
 * NOTE: NC uses a biennial budget. Certified appropriations set in odd years
 * apply to both fiscal years of the biennium (with adjustments in the second year).
 * All figures represent General Fund appropriations only (not all-funds).
 *
 * Usage:
 *   node scripts/processNC.js              # load FY2022-2026
 *   node scripts/processNC.js --fy 2026    # single year
 *   node scripts/processNC.js --dry-run    # print tree, skip DB
 *   node scripts/processNC.js --dry-run --fy 2024
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
const STATE_NAME   = 'North Carolina';
const STATE_ABBR   = 'NC';
const POPULATION   = 10_439_388;

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in dollars.
//
// Functional category shares derived from NC OSBM certified budget structure:
//   Education ~50-52% of GF (K-12 DPI largest single item ~$10-11B; UNC ~$3B; CCs ~$1.5B)
//   Health and Human Services ~25-27% (Medicaid expansion added ~$1.3B annually from FY2024)
//   Justice and Public Safety ~9-10% (Dept of Adult Correction, judicial, emergency mgmt)
//   General Government ~6-7% (general government agencies, legislature, Governor's office)
//   Natural and Economic Resources ~3-4% (agriculture, commerce, environment, labor)
//   Reserves and Debt Service ~3-5% (statewide reserves, debt service, capital, OPEB)
//
// Education subcategory note:
//   - Public School Fund (K-12 DPI): largest component
//   - UNC System: second largest
//   - Community Colleges: third
//
// HHS subcategory note:
//   - Division of Health Benefits (Medicaid): dominant HHS line
//   - Division of Social Services + Child Welfare
//   - Division of Mental Health / Substance Use
//
// Justice subcategory note:
//   - Dept of Adult Correction (prisons) + Division of Juvenile Justice
//   - Judicial Branch (courts)
//   - Dept of Public Safety (emergency management, State Highway Patrol GF share)

const EXPENDITURES = {
  2022: {
    // estimated — 2021-23 biennium first year
    total: 27_900_000_000,
    categories: [
      {
        name: 'Education',
        total: 14_500_000_000,
        lineItems: [
          { name: 'Public School Fund (K-12)',  amount: 10_100_000_000 },
          { name: 'UNC System',                 amount:  2_900_000_000 },
          { name: 'Community Colleges',         amount:  1_500_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 6_900_000_000,
        lineItems: [
          { name: 'Division of Health Benefits (Medicaid)', amount: 4_200_000_000 },
          { name: 'Division of Social Services',            amount: 1_500_000_000 },
          { name: 'Mental Health and Substance Use',        amount: 1_200_000_000 },
        ],
      },
      {
        name: 'Justice and Public Safety',
        total: 2_700_000_000,
        lineItems: [
          { name: 'Dept of Adult Correction',   amount: 1_500_000_000 },
          { name: 'Judicial Branch',            amount:   750_000_000 },
          { name: 'Dept of Public Safety',      amount:   450_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_700_000_000,
        lineItems: [
          { name: 'General Government Agencies', amount: 1_200_000_000 },
          { name: 'Legislature and Courts',      amount:   500_000_000 },
        ],
      },
      {
        name: 'Natural and Economic Resources',
        total: 900_000_000,
        lineItems: [
          { name: 'Dept of Agriculture',         amount: 300_000_000 },
          { name: 'Dept of Commerce',            amount: 350_000_000 },
          { name: 'Dept of Environmental Quality', amount: 250_000_000 },
        ],
      },
      {
        name: 'Reserves and Debt Service',
        total: 1_200_000_000,
        lineItems: [
          { name: 'Statewide Reserves', amount:   700_000_000 },
          { name: 'Debt Service',       amount:   500_000_000 },
        ],
      },
    ],
  },

  2023: {
    // estimated — 2021-23 biennium second year
    total: 29_800_000_000,
    categories: [
      {
        name: 'Education',
        total: 15_400_000_000,
        lineItems: [
          { name: 'Public School Fund (K-12)',  amount: 10_700_000_000 },
          { name: 'UNC System',                 amount:  3_100_000_000 },
          { name: 'Community Colleges',         amount:  1_600_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 7_500_000_000,
        lineItems: [
          { name: 'Division of Health Benefits (Medicaid)', amount: 4_600_000_000 },
          { name: 'Division of Social Services',            amount: 1_600_000_000 },
          { name: 'Mental Health and Substance Use',        amount: 1_300_000_000 },
        ],
      },
      {
        name: 'Justice and Public Safety',
        total: 2_900_000_000,
        lineItems: [
          { name: 'Dept of Adult Correction',   amount: 1_600_000_000 },
          { name: 'Judicial Branch',            amount:   800_000_000 },
          { name: 'Dept of Public Safety',      amount:   500_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_800_000_000,
        lineItems: [
          { name: 'General Government Agencies', amount: 1_300_000_000 },
          { name: 'Legislature and Courts',      amount:   500_000_000 },
        ],
      },
      {
        name: 'Natural and Economic Resources',
        total: 900_000_000,
        lineItems: [
          { name: 'Dept of Agriculture',           amount: 300_000_000 },
          { name: 'Dept of Commerce',              amount: 350_000_000 },
          { name: 'Dept of Environmental Quality', amount: 250_000_000 },
        ],
      },
      {
        name: 'Reserves and Debt Service',
        total: 1_300_000_000,
        lineItems: [
          { name: 'Statewide Reserves', amount:   750_000_000 },
          { name: 'Debt Service',       amount:   550_000_000 },
        ],
      },
    ],
  },

  2024: {
    // estimated — 2023-25 biennium first year (Medicaid expansion adds ~$1.3B GF)
    total: 30_900_000_000,
    categories: [
      {
        name: 'Education',
        total: 15_900_000_000,
        lineItems: [
          { name: 'Public School Fund (K-12)',  amount: 11_000_000_000 },
          { name: 'UNC System',                 amount:  3_200_000_000 },
          { name: 'Community Colleges',         amount:  1_700_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 8_200_000_000,
        lineItems: [
          { name: 'Division of Health Benefits (Medicaid)', amount: 5_200_000_000 },
          { name: 'Division of Social Services',            amount: 1_700_000_000 },
          { name: 'Mental Health and Substance Use',        amount: 1_300_000_000 },
        ],
      },
      {
        name: 'Justice and Public Safety',
        total: 3_000_000_000,
        lineItems: [
          { name: 'Dept of Adult Correction',   amount: 1_650_000_000 },
          { name: 'Judicial Branch',            amount:   850_000_000 },
          { name: 'Dept of Public Safety',      amount:   500_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_900_000_000,
        lineItems: [
          { name: 'General Government Agencies', amount: 1_350_000_000 },
          { name: 'Legislature and Courts',      amount:   550_000_000 },
        ],
      },
      {
        name: 'Natural and Economic Resources',
        total: 900_000_000,
        lineItems: [
          { name: 'Dept of Agriculture',           amount: 300_000_000 },
          { name: 'Dept of Commerce',              amount: 350_000_000 },
          { name: 'Dept of Environmental Quality', amount: 250_000_000 },
        ],
      },
      {
        name: 'Reserves and Debt Service',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Statewide Reserves', amount:   500_000_000 },
          { name: 'Debt Service',       amount:   500_000_000 },
        ],
      },
    ],
  },

  2025: {
    // estimated — 2023-25 biennium second year
    total: 32_100_000_000,
    categories: [
      {
        name: 'Education',
        total: 16_500_000_000,
        lineItems: [
          { name: 'Public School Fund (K-12)',  amount: 11_400_000_000 },
          { name: 'UNC System',                 amount:  3_350_000_000 },
          { name: 'Community Colleges',         amount:  1_750_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 8_600_000_000,
        lineItems: [
          { name: 'Division of Health Benefits (Medicaid)', amount: 5_500_000_000 },
          { name: 'Division of Social Services',            amount: 1_750_000_000 },
          { name: 'Mental Health and Substance Use',        amount: 1_350_000_000 },
        ],
      },
      {
        name: 'Justice and Public Safety',
        total: 3_100_000_000,
        lineItems: [
          { name: 'Dept of Adult Correction',   amount: 1_700_000_000 },
          { name: 'Judicial Branch',            amount:   900_000_000 },
          { name: 'Dept of Public Safety',      amount:   500_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_000_000_000,
        lineItems: [
          { name: 'General Government Agencies', amount: 1_400_000_000 },
          { name: 'Legislature and Courts',      amount:   600_000_000 },
        ],
      },
      {
        name: 'Natural and Economic Resources',
        total: 900_000_000,
        lineItems: [
          { name: 'Dept of Agriculture',           amount: 300_000_000 },
          { name: 'Dept of Commerce',              amount: 350_000_000 },
          { name: 'Dept of Environmental Quality', amount: 250_000_000 },
        ],
      },
      {
        name: 'Reserves and Debt Service',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Statewide Reserves', amount:   500_000_000 },
          { name: 'Debt Service',       amount:   500_000_000 },
        ],
      },
    ],
  },

  2026: {
    // estimated — Governor Stein recommended budget (NASBO: $33.3B GF spending)
    total: 33_300_000_000,
    categories: [
      {
        name: 'Education',
        total: 17_100_000_000,
        lineItems: [
          { name: 'Public School Fund (K-12)',  amount: 11_800_000_000 },
          { name: 'UNC System',                 amount:  3_500_000_000 },
          { name: 'Community Colleges',         amount:  1_800_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 8_900_000_000,
        lineItems: [
          { name: 'Division of Health Benefits (Medicaid)', amount: 5_700_000_000 },
          { name: 'Division of Social Services',            amount: 1_800_000_000 },
          { name: 'Mental Health and Substance Use',        amount: 1_400_000_000 },
        ],
      },
      {
        name: 'Justice and Public Safety',
        total: 3_200_000_000,
        lineItems: [
          { name: 'Dept of Adult Correction',   amount: 1_750_000_000 },
          { name: 'Judicial Branch',            amount:   950_000_000 },
          { name: 'Dept of Public Safety',      amount:   500_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_100_000_000,
        lineItems: [
          { name: 'General Government Agencies', amount: 1_500_000_000 },
          { name: 'Legislature and Courts',      amount:   600_000_000 },
        ],
      },
      {
        name: 'Natural and Economic Resources',
        total: 900_000_000,
        lineItems: [
          { name: 'Dept of Agriculture',           amount: 300_000_000 },
          { name: 'Dept of Commerce',              amount: 350_000_000 },
          { name: 'Dept of Environmental Quality', amount: 250_000_000 },
        ],
      },
      {
        name: 'Reserves and Debt Service',
        total: 1_100_000_000,
        lineItems: [
          { name: 'Statewide Reserves', amount:   600_000_000 },
          { name: 'Debt Service',       amount:   500_000_000 },
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

  const jsonTree = [{ n: 'North Carolina General Fund Budget', a: total, c: children }];
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

  console.log(`${STATE_NAME} State Budget Loader${dryRun ? ' (dry-run)' : ''}`);
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedNCState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'North Carolina General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'nc-gf-operating',
      base_url:        'https://www.osbm.nc.gov/budget/certified-budget',
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
    console.log(`\n${'Category'.padEnd(38)} ${'Amount ($)'.padStart(18)}`);
    console.log('─'.repeat(58));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(36)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('─'.repeat(58));
    console.log(`${'TOTAL EXPENDITURES'.padEnd(38)}${Math.round(total).toLocaleString().padStart(18)}`);
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
