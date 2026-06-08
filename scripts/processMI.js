#!/usr/bin/env node
/**
 * Michigan General Fund Operating Budget Loader — FY2022-2026
 *
 * Loads General Fund/General Purpose (GF/GP) operating expenditure data into
 * treasury database via treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Source: Michigan Senate Fiscal Agency (SFA) State Budget Overview (Dec 2025)
 *   sfa.senate.michigan.gov/Publications/BudUpdates/StateBudgetOverviewDec2025.pdf
 *
 * Michigan fiscal year ends September 30.
 * GF/GP is Michigan's primary discretionary fund (~$13-15B, distinct from the
 * School Aid Fund which funds K-12 and is ~$18B separately).
 *
 * Key structural notes:
 *   - K-12 education is primarily School Aid Fund (SAF), NOT GF/GP.
 *     GF/GP funds higher education and some supplemental K-12 support.
 *   - Medicaid (DHHS) is the single largest GF/GP expenditure (~38-40%).
 *   - Michigan does NOT have a pension crisis line like IL — legacy costs
 *     are within department budgets (mostly DTMB and state employee retirement).
 *
 * GF/GP totals (estimated from SFA State Budget Overview Dec 2025):
 *   FY2022 = $13,000M  (estimated — pre-SFA detail for this year)
 *   FY2023 = $13,500M  (estimated)
 *   FY2024 = $14,800M  (estimated — significant Whitmer initiative spending)
 *   FY2025 = $14,500M  (estimated from enacted appropriations)
 *   FY2026 = $14,400M  (estimated — SFA Dec 2025 consensus)
 *
 * Data confidence: all years estimated — proportional allocation from SFA
 * department-level category totals.
 *
 * Usage:
 *   node scripts/processMI.js              # load FY2022-2026
 *   node scripts/processMI.js --fy 2026    # single year
 *   node scripts/processMI.js --dry-run    # print tree, skip DB
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

const STATE_NAME = 'Michigan';
const STATE_ABBR = 'MI';
const POPULATION = 10_077_331;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in dollars. Confidence: estimated for all years.
//
// Category breakdown methodology:
//   DHHS/Health (~38-40%): Medicaid GF/GP match + all other DHHS programs.
//     Michigan Medicaid is jointly funded; GF/GP pays the state match (~$4B+).
//   Higher Education (~15-17%): 15 public universities + community colleges +
//     student financial aid (Michigan Competitive Scholarship, tuition grants).
//   Corrections (~14-16%): Dept of Corrections full GF/GP appropriation.
//     Michigan has ~33,000 prisoners; MDOC is ~$2.1B GF/GP.
//   General Government (~8-10%): Executive Office, DTMB (IT), Treasury,
//     AG, SOS, civil service, judiciary, legislature.
//   K-12 Supplemental (~7-8%): GF/GP contribution to K-12 (above SAF).
//     Includes special education support, at-risk pupil funding, career-tech.
//   Other (~9-11%): MEDC economic development, Environment (EGLE),
//     Agriculture (MDA), Natural Resources (DNR), Transportation (GF portion).
//
// FY2022-2023 computed from SFA proportional estimates.
// FY2024 reflects jump from large supplemental appropriations (Road/Infrastructure).
// FY2025-2026 from SFA State Budget Overview December 2025.

const EXPENDITURES = {
  2022: {
    total: 13_000_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Health and Human Services',
        total: 5_200_000_000,
        lineItems: [
          { name: 'Medicaid (GF/GP match)',       amount: 3_600_000_000 },
          { name: 'Child and Family Services',    amount:   900_000_000 },
          { name: 'Mental Health and Substance Use', amount: 400_000_000 },
          { name: 'Other DHHS Programs',          amount:   300_000_000 },
        ],
      },
      {
        name: 'Higher Education',
        total: 2_100_000_000,
        lineItems: [
          { name: 'University Operations',        amount: 1_650_000_000 },
          { name: 'Community Colleges',           amount:   300_000_000 },
          { name: 'Student Financial Aid',        amount:   150_000_000 },
        ],
      },
      {
        name: 'Corrections',
        total: 2_000_000_000,
        lineItems: [
          { name: 'Dept of Corrections Operations', amount: 1_700_000_000 },
          { name: 'Probation and Field Operations',  amount:   200_000_000 },
          { name: 'Other Corrections',               amount:   100_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_200_000_000,
        lineItems: [
          { name: 'Executive Office and Departments', amount: 600_000_000 },
          { name: 'Judiciary and Courts',             amount: 350_000_000 },
          { name: 'Legislature',                      amount: 150_000_000 },
          { name: 'Other General Government',         amount: 100_000_000 },
        ],
      },
      {
        name: 'K-12 Education Support',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Special Education (GF/GP)',    amount: 500_000_000 },
          { name: 'At-Risk Pupil Programs',       amount: 300_000_000 },
          { name: 'Career and Technical Education', amount: 200_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 1_500_000_000,
        lineItems: [
          { name: 'Economic Development (MEDC)',  amount: 400_000_000 },
          { name: 'Environment (EGLE)',           amount: 350_000_000 },
          { name: 'Natural Resources (DNR)',      amount: 300_000_000 },
          { name: 'Agriculture and Other',        amount: 450_000_000 },
        ],
      },
    ],
  },

  2023: {
    total: 13_500_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Health and Human Services',
        total: 5_400_000_000,
        lineItems: [
          { name: 'Medicaid (GF/GP match)',       amount: 3_750_000_000 },
          { name: 'Child and Family Services',    amount:   950_000_000 },
          { name: 'Mental Health and Substance Use', amount: 400_000_000 },
          { name: 'Other DHHS Programs',          amount:   300_000_000 },
        ],
      },
      {
        name: 'Higher Education',
        total: 2_200_000_000,
        lineItems: [
          { name: 'University Operations',        amount: 1_730_000_000 },
          { name: 'Community Colleges',           amount:   310_000_000 },
          { name: 'Student Financial Aid',        amount:   160_000_000 },
        ],
      },
      {
        name: 'Corrections',
        total: 2_000_000_000,
        lineItems: [
          { name: 'Dept of Corrections Operations', amount: 1_700_000_000 },
          { name: 'Probation and Field Operations',  amount:   200_000_000 },
          { name: 'Other Corrections',               amount:   100_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_350_000_000,
        lineItems: [
          { name: 'Executive Office and Departments', amount: 700_000_000 },
          { name: 'Judiciary and Courts',             amount: 350_000_000 },
          { name: 'Legislature',                      amount: 150_000_000 },
          { name: 'Other General Government',         amount: 150_000_000 },
        ],
      },
      {
        name: 'K-12 Education Support',
        total: 1_000_000_000,
        lineItems: [
          { name: 'Special Education (GF/GP)',    amount: 500_000_000 },
          { name: 'At-Risk Pupil Programs',       amount: 300_000_000 },
          { name: 'Career and Technical Education', amount: 200_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 1_550_000_000,
        lineItems: [
          { name: 'Economic Development (MEDC)',  amount: 420_000_000 },
          { name: 'Environment (EGLE)',           amount: 360_000_000 },
          { name: 'Natural Resources (DNR)',      amount: 320_000_000 },
          { name: 'Agriculture and Other',        amount: 450_000_000 },
        ],
      },
    ],
  },

  2024: {
    total: 14_800_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Health and Human Services',
        total: 6_000_000_000,
        lineItems: [
          { name: 'Medicaid (GF/GP match)',       amount: 4_200_000_000 },
          { name: 'Child and Family Services',    amount: 1_000_000_000 },
          { name: 'Mental Health and Substance Use', amount: 500_000_000 },
          { name: 'Other DHHS Programs',          amount:   300_000_000 },
        ],
      },
      {
        name: 'Higher Education',
        total: 2_500_000_000,
        lineItems: [
          { name: 'University Operations',        amount: 1_960_000_000 },
          { name: 'Community Colleges',           amount:   360_000_000 },
          { name: 'Student Financial Aid',        amount:   180_000_000 },
        ],
      },
      {
        name: 'Corrections',
        total: 2_100_000_000,
        lineItems: [
          { name: 'Dept of Corrections Operations', amount: 1_790_000_000 },
          { name: 'Probation and Field Operations',  amount:   210_000_000 },
          { name: 'Other Corrections',               amount:   100_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_500_000_000,
        lineItems: [
          { name: 'Executive Office and Departments', amount: 800_000_000 },
          { name: 'Judiciary and Courts',             amount: 380_000_000 },
          { name: 'Legislature',                      amount: 170_000_000 },
          { name: 'Other General Government',         amount: 150_000_000 },
        ],
      },
      {
        name: 'K-12 Education Support',
        total: 1_200_000_000,
        lineItems: [
          { name: 'Special Education (GF/GP)',    amount: 580_000_000 },
          { name: 'At-Risk Pupil Programs',       amount: 370_000_000 },
          { name: 'Career and Technical Education', amount: 250_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 1_500_000_000,
        lineItems: [
          { name: 'Economic Development (MEDC)',  amount: 380_000_000 },
          { name: 'Environment (EGLE)',           amount: 370_000_000 },
          { name: 'Natural Resources (DNR)',      amount: 300_000_000 },
          { name: 'Agriculture and Other',        amount: 450_000_000 },
        ],
      },
    ],
  },

  2025: {
    total: 14_500_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Health and Human Services',
        total: 5_800_000_000,
        lineItems: [
          { name: 'Medicaid (GF/GP match)',       amount: 4_050_000_000 },
          { name: 'Child and Family Services',    amount: 1_000_000_000 },
          { name: 'Mental Health and Substance Use', amount: 500_000_000 },
          { name: 'Other DHHS Programs',          amount:   250_000_000 },
        ],
      },
      {
        name: 'Higher Education',
        total: 2_400_000_000,
        lineItems: [
          { name: 'University Operations',        amount: 1_880_000_000 },
          { name: 'Community Colleges',           amount:   350_000_000 },
          { name: 'Student Financial Aid',        amount:   170_000_000 },
        ],
      },
      {
        name: 'Corrections',
        total: 2_100_000_000,
        lineItems: [
          { name: 'Dept of Corrections Operations', amount: 1_790_000_000 },
          { name: 'Probation and Field Operations',  amount:   210_000_000 },
          { name: 'Other Corrections',               amount:   100_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_500_000_000,
        lineItems: [
          { name: 'Executive Office and Departments', amount: 800_000_000 },
          { name: 'Judiciary and Courts',             amount: 380_000_000 },
          { name: 'Legislature',                      amount: 170_000_000 },
          { name: 'Other General Government',         amount: 150_000_000 },
        ],
      },
      {
        name: 'K-12 Education Support',
        total: 1_200_000_000,
        lineItems: [
          { name: 'Special Education (GF/GP)',    amount: 580_000_000 },
          { name: 'At-Risk Pupil Programs',       amount: 370_000_000 },
          { name: 'Career and Technical Education', amount: 250_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 1_500_000_000,
        lineItems: [
          { name: 'Economic Development (MEDC)',  amount: 380_000_000 },
          { name: 'Environment (EGLE)',           amount: 370_000_000 },
          { name: 'Natural Resources (DNR)',      amount: 300_000_000 },
          { name: 'Agriculture and Other',        amount: 450_000_000 },
        ],
      },
    ],
  },

  2026: {
    total: 14_400_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Health and Human Services',
        total: 5_750_000_000,
        lineItems: [
          { name: 'Medicaid (GF/GP match)',       amount: 4_000_000_000 },
          { name: 'Child and Family Services',    amount: 1_000_000_000 },
          { name: 'Mental Health and Substance Use', amount: 500_000_000 },
          { name: 'Other DHHS Programs',          amount:   250_000_000 },
        ],
      },
      {
        name: 'Higher Education',
        total: 2_350_000_000,
        lineItems: [
          { name: 'University Operations',        amount: 1_840_000_000 },
          { name: 'Community Colleges',           amount:   340_000_000 },
          { name: 'Student Financial Aid',        amount:   170_000_000 },
        ],
      },
      {
        name: 'Corrections',
        total: 2_100_000_000,
        lineItems: [
          { name: 'Dept of Corrections Operations', amount: 1_790_000_000 },
          { name: 'Probation and Field Operations',  amount:   210_000_000 },
          { name: 'Other Corrections',               amount:   100_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 1_450_000_000,
        lineItems: [
          { name: 'Executive Office and Departments', amount: 770_000_000 },
          { name: 'Judiciary and Courts',             amount: 380_000_000 },
          { name: 'Legislature',                      amount: 170_000_000 },
          { name: 'Other General Government',         amount: 130_000_000 },
        ],
      },
      {
        name: 'K-12 Education Support',
        total: 1_200_000_000,
        lineItems: [
          { name: 'Special Education (GF/GP)',    amount: 580_000_000 },
          { name: 'At-Risk Pupil Programs',       amount: 370_000_000 },
          { name: 'Career and Technical Education', amount: 250_000_000 },
        ],
      },
      {
        name: 'Other Programs',
        total: 1_550_000_000,
        lineItems: [
          { name: 'Economic Development (MEDC)',  amount: 400_000_000 },
          { name: 'Environment (EGLE)',           amount: 380_000_000 },
          { name: 'Natural Resources (DNR)',      amount: 320_000_000 },
          { name: 'Agriculture and Other',        amount: 450_000_000 },
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

  const jsonTree = [{ n: 'Michigan General Fund Budget', a: total, c: children }];
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedMIState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Michigan General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'mi-gf-operating',
      base_url:        'https://sfa.senate.michigan.gov/Publications/BudUpdates/StateBudgetOverviewDec2025.pdf',
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
    console.log(`FY${fy} validation: PASS  (confidence: ${EXPENDITURES[fy].confidence})`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(36)} ${'Amount ($)'.padStart(18)}`);
    console.log('─'.repeat(56));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(34)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('─'.repeat(56));
    console.log(`${'TOTAL BUDGET'.padEnd(36)}${Math.round(total).toLocaleString().padStart(18)}`);
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
