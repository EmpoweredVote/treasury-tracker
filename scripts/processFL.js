#!/usr/bin/env node
/**
 * Florida General Revenue Fund Operating Budget Loader — FY2022-2026
 *
 * Loads General Fund expenditure data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Expenditure figures from Florida Senate General Appropriations Act (GAA)
 * bill summaries (flsenate.gov) and Florida TaxWatch budget guides.
 * Amounts in dollars; FY = fiscal year ending June 30 of that calendar year.
 *
 * General Revenue Fund totals (GRF only — not all-funds):
 *   FY2022 (2021-22): $36.3B  (enacted; 2021 legislative session, SB 2500)
 *   FY2023 (2022-23): $43.7B  (enacted; 2022 legislative session, SB 5001)
 *   FY2024 (2023-24): $46.5B  (enacted; 2023 legislative session, SB 2500)
 *   FY2025 (2024-25): $49.4B  (enacted; 2024 legislative session, SB 5001)
 *   FY2026 (2025-26): $50.3B  (enacted post-veto; 2025 legislative session)
 *
 * Note on FY2025: floridapolicy.org reports $48.6B post-veto; flsenate.gov
 *   SB 5001 summary shows $49.4B pre-veto. Using $49.4B (enacted/appropriated).
 *
 * Tree structure:
 *   [{ n: 'Florida General Fund Budget', a: total, c: [
 *       { n: 'Education',                 a: subtotal, i: [...] },
 *       { n: 'Health and Human Services', a: subtotal, i: [...] },
 *       { n: 'Criminal and Civil Justice', a: subtotal, i: [...] },
 *       { n: 'General Government',        a: subtotal, i: [...] },
 *       { n: 'Transportation and Economic Development', a: subtotal, i: [...] },
 *   ]}]
 *
 * Usage:
 *   node scripts/processFL.js              # load FY2022-2026
 *   node scripts/processFL.js --fy 2026    # single year
 *   node scripts/processFL.js --dry-run    # print tree, skip DB
 *   node scripts/processFL.js --dry-run --fy 2024
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
const STATE_NAME   = 'Florida';
const STATE_ABBR   = 'FL';
const POPULATION   = 21_538_187;

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in dollars.
// Source: Florida Senate General Appropriations Act bill summaries
//   (flsenate.gov) — official enacted appropriations by agency/program.
//   Florida TaxWatch Taxpayer's Guide to the State Budget (supplemental).
//
// Major spending categories:
//   Education: K-12 FEFP state share + colleges + universities + early learning.
//   Health & Human Services: Medicaid (AHCA) + DCF + APD + DOH + Elder Affairs.
//   Criminal & Civil Justice: DOC (corrections) + courts + FDLE + AG + DJJ.
//   General Government: Revenue + Financial Services + Agriculture + admin.
//   Transportation & Economic Development: DOT GRF + Commerce + Military + State.
//   Other Programs: Environmental protection, housing, workforce, capital outlay.
//
// FY2022 (2021-22): Post-COVID recovery year; GRF $36.3B.
// FY2023 (2022-23): GRF rose to $43.7B; significant increases across all sectors.
// FY2024 (2023-24): GRF $46.5B; education and HHS growth continued.
// FY2025 (2024-25): GRF $49.4B (pre-veto enacted); further HHS/education growth.
// FY2026 (2025-26): GRF $50.3B; modest growth with continued investment in
//   education and Medicaid.

const EXPENDITURES = {
  2022: {
    // Total GRF: $36.3B — from 2021 session SB 2500 (FY2021-22)
    // Source: flsenate.gov bill summary
    total: 36_300_000_000,
    categories: [
      {
        name: 'Education',
        total: 17_700_000_000,
        lineItems: [
          { name: 'K-12 Education (FEFP)',            amount: 13_500_000_000 },
          { name: 'State University System',           amount:  3_000_000_000 },
          { name: 'Florida College System',            amount:  1_200_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 12_100_000_000,
        lineItems: [
          { name: 'Agency for Health Care Administration', amount: 8_500_000_000 },
          { name: 'Dept of Children and Families',        amount: 2_000_000_000 },
          { name: 'Agency for Persons with Disabilities', amount:   750_000_000 },
          { name: 'Department of Health',                 amount:   600_000_000 },
          { name: 'Department of Elder Affairs',          amount:   250_000_000 },
        ],
      },
      {
        name: 'Criminal and Civil Justice',
        total: 4_900_000_000,
        lineItems: [
          { name: 'Department of Corrections',            amount: 2_900_000_000 },
          { name: 'Judicial Branch',                      amount:   850_000_000 },
          { name: 'Florida Dept of Law Enforcement',      amount:   400_000_000 },
          { name: 'Department of Juvenile Justice',       amount:   500_000_000 },
          { name: 'Attorney General',                     amount:   250_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 768_000_000,
        lineItems: [
          { name: 'Department of Revenue',                amount:   300_000_000 },
          { name: 'Department of Financial Services',     amount:   130_000_000 },
          { name: 'Agriculture and Consumer Services',    amount:   200_000_000 },
          { name: 'Executive Office of the Governor',     amount:   138_000_000 },
        ],
      },
      {
        name: 'Transportation and Economic Development',
        total: 274_000_000,
        lineItems: [
          { name: 'Department of Commerce',               amount:   150_000_000 },
          { name: 'Department of State',                  amount:    74_000_000 },
          { name: 'Department of Military Affairs',       amount:    50_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 558_000_000,
        lineItems: [
          { name: 'Environmental Protection',             amount:   250_000_000 },
          { name: 'Housing and Community Development',    amount:   158_000_000 },
          { name: 'Other Agencies and Programs',          amount:   150_000_000 },
        ],
      },
    ],
  },

  2023: {
    // Total GRF: $43.7B — from 2022 session SB 5001 (FY2022-23)
    // Source: flsenate.gov bill summary
    total: 43_700_000_000,
    categories: [
      {
        name: 'Education',
        total: 18_700_000_000,
        lineItems: [
          { name: 'K-12 Education (FEFP)',                amount: 13_500_000_000 },
          { name: 'State University System',               amount:  3_000_000_000 },
          { name: 'Florida College System',                amount:  1_300_000_000 },
          { name: 'Early Learning Services',               amount:   610_000_000 },
          { name: 'Student Financial Aid',                 amount:   290_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 14_700_000_000,
        lineItems: [
          { name: 'Agency for Health Care Administration', amount: 10_200_000_000 },
          { name: 'Dept of Children and Families',         amount:  2_500_000_000 },
          { name: 'Agency for Persons with Disabilities',  amount:   912_000_000 },
          { name: 'Department of Health',                  amount:   750_000_000 },
          { name: 'Department of Elder Affairs',           amount:   208_000_000 },
          { name: 'Department of Veterans Affairs',        amount:    71_000_000 },
          { name: 'Other HHS Programs',                    amount:    59_000_000 },
        ],
      },
      {
        name: 'Criminal and Civil Justice',
        total: 6_000_000_000,
        lineItems: [
          { name: 'Department of Corrections',             amount:  3_750_000_000 },
          { name: 'Judicial Branch',                       amount:    850_000_000 },
          { name: 'Florida Dept of Law Enforcement',       amount:    226_000_000 },
          { name: 'Department of Juvenile Justice',        amount:    900_000_000 },
          { name: 'Attorney General',                      amount:     77_000_000 },
          { name: 'Other Justice Programs',                amount:    197_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_500_000_000,
        lineItems: [
          { name: 'Agriculture and Consumer Services',     amount:   800_000_000 },
          { name: 'Department of Revenue',                 amount:   500_000_000 },
          { name: 'Department of Financial Services',      amount:   400_000_000 },
          { name: 'Environmental Protection',              amount:   500_000_000 },
          { name: 'Executive Office of the Governor',      amount:   300_000_000 },
        ],
      },
      {
        name: 'Transportation and Economic Development',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Department of Commerce',                amount:   500_000_000 },
          { name: 'Department of Transportation (GRF)',    amount:   300_000_000 },
          { name: 'Department of State',                   amount:   200_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 800_000_000,
        lineItems: [
          { name: 'Housing and Community Development',     amount:   400_000_000 },
          { name: 'Other Agencies and Programs',           amount:   400_000_000 },
        ],
      },
    ],
  },

  2024: {
    // Total GRF: $46.5B — from 2023 session SB 2500 (FY2023-24)
    // Source: flsenate.gov bill summary
    total: 46_500_000_000,
    categories: [
      {
        name: 'Education',
        total: 20_300_000_000,
        lineItems: [
          { name: 'K-12 Education (FEFP)',                amount: 14_500_000_000 },
          { name: 'State University System',               amount:  3_500_000_000 },
          { name: 'Florida College System',                amount:  1_400_000_000 },
          { name: 'Early Learning Services',               amount:   600_000_000 },
          { name: 'Student Financial Aid',                 amount:   300_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 15_200_000_000,
        lineItems: [
          { name: 'Agency for Health Care Administration', amount: 10_700_000_000 },
          { name: 'Dept of Children and Families',         amount:  2_600_000_000 },
          { name: 'Agency for Persons with Disabilities',  amount:  1_000_000_000 },
          { name: 'Department of Health',                  amount:   650_000_000 },
          { name: 'Department of Elder Affairs',           amount:   150_000_000 },
          { name: 'Other HHS Programs',                    amount:   100_000_000 },
        ],
      },
      {
        name: 'Criminal and Civil Justice',
        total: 5_700_000_000,
        lineItems: [
          { name: 'Department of Corrections',             amount:  3_500_000_000 },
          { name: 'Judicial Branch',                       amount:    900_000_000 },
          { name: 'Florida Dept of Law Enforcement',       amount:    300_000_000 },
          { name: 'Department of Juvenile Justice',        amount:    700_000_000 },
          { name: 'Attorney General',                      amount:    180_000_000 },
          { name: 'Other Justice Programs',                amount:    120_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_828_000_000,
        lineItems: [
          { name: 'Agriculture and Consumer Services',     amount:   600_000_000 },
          { name: 'Department of Revenue',                 amount:   500_000_000 },
          { name: 'Department of Financial Services',      amount:   400_000_000 },
          { name: 'Environmental Protection',              amount:   900_000_000 },
          { name: 'Executive Office of the Governor',      amount:   428_000_000 },
        ],
      },
      {
        name: 'Transportation and Economic Development',
        total: 472_000_000,
        lineItems: [
          { name: 'Department of Commerce',                amount:   200_000_000 },
          { name: 'Department of Military Affairs',        amount:   100_000_000 },
          { name: 'Department of State',                   amount:   172_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 2_000_000_000,
        lineItems: [
          { name: 'Housing and Community Development',     amount:   800_000_000 },
          { name: 'Capital Outlay and Debt Service',       amount:   700_000_000 },
          { name: 'Other Agencies and Programs',           amount:   500_000_000 },
        ],
      },
    ],
  },

  2025: {
    // Total GRF: $49.4B — from 2024 session SB 5001 (FY2024-25, pre-veto enacted)
    // Source: flsenate.gov bill summary
    total: 49_400_000_000,
    categories: [
      {
        name: 'Education',
        total: 22_600_000_000,
        lineItems: [
          { name: 'K-12 Education (FEFP)',                amount: 15_500_000_000 },
          { name: 'State University System',               amount:  4_300_000_000 },
          { name: 'Florida College System',                amount:  1_470_000_000 },
          { name: 'Early Learning Services',               amount:   609_000_000 },
          { name: 'Student Financial Aid',                 amount:   721_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 16_200_000_000,
        lineItems: [
          { name: 'Agency for Health Care Administration', amount: 11_100_000_000 },
          { name: 'Dept of Children and Families',         amount:  2_800_000_000 },
          { name: 'Agency for Persons with Disabilities',  amount:  1_100_000_000 },
          { name: 'Department of Health',                  amount:   948_000_000 },
          { name: 'Department of Elder Affairs',           amount:   180_000_000 },
          { name: 'Other HHS Programs',                    amount:    72_000_000 },
        ],
      },
      {
        name: 'Criminal and Civil Justice',
        total: 6_300_000_000,
        lineItems: [
          { name: 'Department of Corrections',             amount:  3_500_000_000 },
          { name: 'Judicial Branch',                       amount:    950_000_000 },
          { name: 'Florida Dept of Law Enforcement',       amount:    322_000_000 },
          { name: 'Department of Juvenile Justice',        amount:    581_000_000 },
          { name: 'Attorney General',                      amount:    122_000_000 },
          { name: 'Other Justice Programs',                amount:    825_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_200_000_000,
        lineItems: [
          { name: 'Agriculture and Consumer Services',     amount:   315_000_000 },
          { name: 'Department of Revenue',                 amount:   336_000_000 },
          { name: 'Department of Financial Services',      amount:   131_000_000 },
          { name: 'Environmental Protection',              amount:   800_000_000 },
          { name: 'Executive Office of the Governor',      amount:   618_000_000 },
        ],
      },
      {
        name: 'Transportation and Economic Development',
        total: 930_000_000,
        lineItems: [
          { name: 'Department of Commerce',                amount:   361_000_000 },
          { name: 'Department of Military Affairs',        amount:   104_000_000 },
          { name: 'Department of State',                   amount:   208_000_000 },
          { name: 'Other Economic Development',            amount:   257_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 1_170_000_000,
        lineItems: [
          { name: 'Housing and Community Development',     amount:   500_000_000 },
          { name: 'Capital Outlay and Debt Service',       amount:   400_000_000 },
          { name: 'Other Agencies and Programs',           amount:   270_000_000 },
        ],
      },
    ],
  },

  2026: {
    // Total GRF: $50.3B — from 2025 session (FY2025-26 enacted post-veto)
    // Source: Florida Policy Institute; NASBO Florida budget page
    total: 50_300_000_000,
    categories: [
      {
        name: 'Education',
        total: 23_000_000_000,
        lineItems: [
          { name: 'K-12 Education (FEFP)',                amount: 15_800_000_000 },
          { name: 'State University System',               amount:  4_400_000_000 },
          { name: 'Florida College System',                amount:  1_500_000_000 },
          { name: 'Early Learning Services',               amount:   620_000_000 },
          { name: 'Student Financial Aid',                 amount:   680_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 16_700_000_000,
        lineItems: [
          { name: 'Agency for Health Care Administration', amount: 11_400_000_000 },
          { name: 'Dept of Children and Families',         amount:  2_900_000_000 },
          { name: 'Agency for Persons with Disabilities',  amount:  1_150_000_000 },
          { name: 'Department of Health',                  amount:   980_000_000 },
          { name: 'Department of Elder Affairs',           amount:   200_000_000 },
          { name: 'Other HHS Programs',                    amount:    70_000_000 },
        ],
      },
      {
        name: 'Criminal and Civil Justice',
        total: 6_500_000_000,
        lineItems: [
          { name: 'Department of Corrections',             amount:  3_600_000_000 },
          { name: 'Judicial Branch',                       amount:  1_000_000_000 },
          { name: 'Florida Dept of Law Enforcement',       amount:    340_000_000 },
          { name: 'Department of Juvenile Justice',        amount:    600_000_000 },
          { name: 'Attorney General',                      amount:    130_000_000 },
          { name: 'Other Justice Programs',                amount:    830_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_200_000_000,
        lineItems: [
          { name: 'Agriculture and Consumer Services',     amount:   320_000_000 },
          { name: 'Department of Revenue',                 amount:   350_000_000 },
          { name: 'Department of Financial Services',      amount:   140_000_000 },
          { name: 'Environmental Protection',              amount:   800_000_000 },
          { name: 'Executive Office of the Governor',      amount:   590_000_000 },
        ],
      },
      {
        name: 'Transportation and Economic Development',
        total: 900_000_000,
        lineItems: [
          { name: 'Department of Commerce',                amount:   370_000_000 },
          { name: 'Department of Military Affairs',        amount:   110_000_000 },
          { name: 'Department of State',                   amount:   210_000_000 },
          { name: 'Other Economic Development',            amount:   210_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Housing and Community Development',     amount:   450_000_000 },
          { name: 'Capital Outlay and Debt Service',       amount:   350_000_000 },
          { name: 'Other Agencies and Programs',           amount:   200_000_000 },
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

  const jsonTree = [{ n: 'Florida General Fund Budget', a: total, c: children }];
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

  console.log(`FL State Budget Loader${dryRun ? ' (dry-run)' : ''}`);
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedFLState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Florida General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'fl-gf-operating',
      base_url:        'https://www.flsenate.gov/Session/Appropriations',
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
