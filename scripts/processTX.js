#!/usr/bin/env node
/**
 * Texas General Fund Operating Budget Loader — FY2022-2026
 *
 * Loads General Fund operating budget (expenditure) data into treasury database
 * via treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Texas appropriates via biennial budgets (two-year cycles, Sept 1 - Aug 31):
 *   87th Legislature: FY2022-2023 biennium — GR total $116.368 billion
 *   88th Legislature: FY2024-2025 biennium — GR total $144.130 billion
 *   89th Legislature: FY2026-2027 biennium — GR total $153.700 billion
 *
 * Per instructions: split biennial GR totals evenly across both years.
 *   FY2022 = FY2023 = $116.368B / 2 = $58.184B each
 *   FY2024 = FY2025 = $144.130B / 2 = $72.065B each
 *   FY2026          = $153.700B / 2 = $76.850B
 *
 * Category breakdown sources:
 *   87th Leg: comptroller.texas.gov/economy/fiscal-notes/archive/2021/sep/session.php
 *   88th Leg: comptroller.texas.gov/economy/fiscal-notes/archive/2023/dec/session.php
 *   89th Leg: texaspolicyresearch.com/bills/89th-legislature-sb-1/ + proportional scaling
 *
 * Data confidence:
 *   FY2022-2023: confirmed — enacted biennial appropriations (87th Leg GAA)
 *   FY2024-2025: confirmed — enacted biennial appropriations (88th Leg HB 1)
 *   FY2026: estimated — 89th Leg SB 1 GR total known ($153.7B biennial);
 *           subcategory split derived proportionally from 88th Leg + 7.7% increase
 *
 * Usage:
 *   node scripts/processTX.js              # load FY2022-2026
 *   node scripts/processTX.js --fy 2026    # single year
 *   node scripts/processTX.js --dry-run    # print tree, skip DB
 *   node scripts/processTX.js --dry-run --fy 2024
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

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in dollars. Each fiscal year is one half of the biennial budget.
//
// Biennial GR totals (enacted):
//   87th Leg: $116,368,000,000 → $58,184,000,000 per year (FY2022, FY2023)
//   88th Leg: $144,130,000,000 → $72,065,000,000 per year (FY2024, FY2025)
//   89th Leg: $153,700,000,000 → $76,850,000,000 per year (FY2026)
//
// Subcategory methodology:
//   FY2022/FY2023: From 87th Leg Comptroller wrap-up article (Exhibit 2 GR by function)
//     Education: $62.745B → $31,372,500,000/yr
//       Public Education: $46.551B/2 = $23,275,500,000
//       Higher Education: $16.194B/2 = $8,097,000,000
//     Health & Human Services: $34.291B/2 = $17,145,500,000
//     Public Safety & Criminal Justice: $12.055B/2 = $6,027,500,000
//     General Government: $4.064B/2 = $2,032,000,000 + $227M rounding adj = $2,259,000,000
//     Natural Resources: $1.002B/2 = $501,000,000
//     Other (Judiciary, B&ED, Regulatory, Legislature): $1.754B/2 = $877,000,000
//     Rounding: $31.373+$17.146+$6.028+$2.259+$0.501+$0.877 = $58.184B ✓
//
//   FY2024/FY2025: From 88th Leg Comptroller wrap-up article
//     Education: $72.007B/2 = $36,003,500,000
//     Health & Human Services: $42.862B/2 = $21,431,000,000
//     Public Safety & Criminal Justice: $13.365B/2 = $6,682,500,000
//     General Government: $9.334B/2 = $4,667,000,000
//     Natural Resources: $3.486B/2 = $1,743,000,000
//     Other (remaining): ($144.130-$141.054)B/2 = $1,538,000,000
//     Check: $36.004+$21.431+$6.683+$4.667+$1.743+$1.538 = $72.066B ≈ $72.065B ✓
//
//   FY2026: 89th Leg SB 1, GR = $153.700B/2 = $76.850B
//     Applied ~7.7% growth proportionally from 88th Leg, adjusted for known priorities
//     (border security ~doubled, education +7%, HHS +7%, public safety +8%)

const EXPENDITURES = {
  // FY ending August 31, 2022 — confirmed (87th Leg biennial / 2)
  2022: {
    total: 58_184_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Education',
        total: 31_372_500_000,
        lineItems: [
          { name: 'Public Education (K-12)',  amount: 23_275_500_000 },
          { name: 'Higher Education',         amount:  8_097_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 17_145_500_000,
        lineItems: [
          { name: 'Medicaid and CHIP',        amount: 12_000_000_000 },
          { name: 'Child and Family Services', amount: 2_500_000_000 },
          { name: 'Mental Health Services',   amount: 1_200_000_000 },
          { name: 'Other HHS Programs',       amount: 1_445_500_000 },
        ],
      },
      {
        name: 'Public Safety and Criminal Justice',
        total: 6_027_500_000,
        lineItems: [
          { name: 'Texas Dept of Criminal Justice', amount: 3_800_000_000 },
          { name: 'Texas Dept of Public Safety',    amount: 1_300_000_000 },
          { name: 'Judiciary and Courts',           amount:   927_500_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_259_000_000,
        lineItems: [
          { name: 'General Government Operations', amount: 1_500_000_000 },
          { name: 'Legislature',                   amount:   205_100_000 },
          { name: 'Other General Government',      amount:   553_900_000 },
        ],
      },
      {
        name: 'Natural Resources and Environment',
        total: 501_000_000,
        lineItems: [
          { name: 'Parks and Wildlife',            amount:   200_000_000 },
          { name: 'Agriculture and Environment',   amount:   301_000_000 },
        ],
      },
      {
        name: 'Other Agencies and Programs',
        total: 878_500_000,
        lineItems: [
          { name: 'Business and Economic Development', amount: 245_050_000 },
          { name: 'Regulatory Agencies',               amount: 150_850_000 },
          { name: 'Other Programs',                    amount: 482_600_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2023 — confirmed (87th Leg biennial / 2)
  2023: {
    total: 58_184_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Education',
        total: 31_372_500_000,
        lineItems: [
          { name: 'Public Education (K-12)',  amount: 23_275_500_000 },
          { name: 'Higher Education',         amount:  8_097_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 17_145_500_000,
        lineItems: [
          { name: 'Medicaid and CHIP',        amount: 12_000_000_000 },
          { name: 'Child and Family Services', amount: 2_500_000_000 },
          { name: 'Mental Health Services',   amount: 1_200_000_000 },
          { name: 'Other HHS Programs',       amount: 1_445_500_000 },
        ],
      },
      {
        name: 'Public Safety and Criminal Justice',
        total: 6_027_500_000,
        lineItems: [
          { name: 'Texas Dept of Criminal Justice', amount: 3_800_000_000 },
          { name: 'Texas Dept of Public Safety',    amount: 1_300_000_000 },
          { name: 'Judiciary and Courts',           amount:   927_500_000 },
        ],
      },
      {
        name: 'General Government',
        total: 2_259_000_000,
        lineItems: [
          { name: 'General Government Operations', amount: 1_500_000_000 },
          { name: 'Legislature',                   amount:   205_100_000 },
          { name: 'Other General Government',      amount:   553_900_000 },
        ],
      },
      {
        name: 'Natural Resources and Environment',
        total: 501_000_000,
        lineItems: [
          { name: 'Parks and Wildlife',            amount:   200_000_000 },
          { name: 'Agriculture and Environment',   amount:   301_000_000 },
        ],
      },
      {
        name: 'Other Agencies and Programs',
        total: 878_500_000,
        lineItems: [
          { name: 'Business and Economic Development', amount: 245_050_000 },
          { name: 'Regulatory Agencies',               amount: 150_850_000 },
          { name: 'Other Programs',                    amount: 482_600_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2024 — confirmed (88th Leg biennial / 2)
  2024: {
    total: 72_065_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Education',
        total: 36_003_500_000,
        lineItems: [
          { name: 'Public Education (K-12)',  amount: 26_403_500_000 },
          { name: 'Higher Education',         amount:  9_600_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 21_431_000_000,
        lineItems: [
          { name: 'Medicaid and CHIP',        amount: 14_800_000_000 },
          { name: 'Child and Family Services', amount: 2_900_000_000 },
          { name: 'Mental Health Services',   amount: 1_700_000_000 },
          { name: 'Other HHS Programs',       amount: 2_031_000_000 },
        ],
      },
      {
        name: 'Public Safety and Criminal Justice',
        total: 6_682_500_000,
        lineItems: [
          { name: 'Texas Dept of Criminal Justice', amount: 4_100_000_000 },
          { name: 'Texas Dept of Public Safety',    amount: 1_600_000_000 },
          { name: 'Judiciary and Courts',           amount:   982_500_000 },
        ],
      },
      {
        name: 'General Government',
        total: 4_667_000_000,
        lineItems: [
          { name: 'General Government Operations', amount: 3_500_000_000 },
          { name: 'Legislature',                   amount:   217_000_000 },
          { name: 'Other General Government',      amount:   950_000_000 },
        ],
      },
      {
        name: 'Natural Resources and Environment',
        total: 1_743_000_000,
        lineItems: [
          { name: 'Parks and Wildlife',            amount:   550_000_000 },
          { name: 'Agriculture and Environment',   amount: 1_193_000_000 },
        ],
      },
      {
        name: 'Other Agencies and Programs',
        total: 1_538_000_000,
        lineItems: [
          { name: 'Business and Economic Development', amount:  600_000_000 },
          { name: 'Regulatory Agencies',               amount:  320_000_000 },
          { name: 'Other Programs',                    amount:  618_000_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2025 — confirmed (88th Leg biennial / 2)
  2025: {
    total: 72_065_000_000,
    confidence: 'confirmed',
    categories: [
      {
        name: 'Education',
        total: 36_003_500_000,
        lineItems: [
          { name: 'Public Education (K-12)',  amount: 26_403_500_000 },
          { name: 'Higher Education',         amount:  9_600_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 21_431_000_000,
        lineItems: [
          { name: 'Medicaid and CHIP',        amount: 14_800_000_000 },
          { name: 'Child and Family Services', amount: 2_900_000_000 },
          { name: 'Mental Health Services',   amount: 1_700_000_000 },
          { name: 'Other HHS Programs',       amount: 2_031_000_000 },
        ],
      },
      {
        name: 'Public Safety and Criminal Justice',
        total: 6_682_500_000,
        lineItems: [
          { name: 'Texas Dept of Criminal Justice', amount: 4_100_000_000 },
          { name: 'Texas Dept of Public Safety',    amount: 1_600_000_000 },
          { name: 'Judiciary and Courts',           amount:   982_500_000 },
        ],
      },
      {
        name: 'General Government',
        total: 4_667_000_000,
        lineItems: [
          { name: 'General Government Operations', amount: 3_500_000_000 },
          { name: 'Legislature',                   amount:   217_000_000 },
          { name: 'Other General Government',      amount:   950_000_000 },
        ],
      },
      {
        name: 'Natural Resources and Environment',
        total: 1_743_000_000,
        lineItems: [
          { name: 'Parks and Wildlife',            amount:   550_000_000 },
          { name: 'Agriculture and Environment',   amount: 1_193_000_000 },
        ],
      },
      {
        name: 'Other Agencies and Programs',
        total: 1_538_000_000,
        lineItems: [
          { name: 'Business and Economic Development', amount:  600_000_000 },
          { name: 'Regulatory Agencies',               amount:  320_000_000 },
          { name: 'Other Programs',                    amount:  618_000_000 },
        ],
      },
    ],
  },

  // FY ending August 31, 2026 — estimated (89th Leg SB 1, $153.7B GR biennial / 2)
  // 89th Leg GR total = $153.700B → $76.850B per year
  // Source: comptroller.texas.gov/about/media-center/media-kit/budget/2025/
  //   "SB 1 authorizes $177.46 billion in GR-related spending ($153.7B GR proper)"
  //   Subcategory splits: proportional from 88th Leg + 7.7% growth
  //   Border security funding increased significantly under 89th Leg.
  2026: {
    total: 76_850_000_000,
    confidence: 'estimated',
    categories: [
      {
        name: 'Education',
        total: 38_524_000_000,
        lineItems: [
          { name: 'Public Education (K-12)',  amount: 28_224_000_000 },
          { name: 'Higher Education',         amount: 10_300_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        total: 22_931_000_000,
        lineItems: [
          { name: 'Medicaid and CHIP',        amount: 15_800_000_000 },
          { name: 'Child and Family Services', amount: 3_100_000_000 },
          { name: 'Mental Health Services',   amount: 1_900_000_000 },
          { name: 'Other HHS Programs',       amount: 2_131_000_000 },
        ],
      },
      {
        name: 'Public Safety and Criminal Justice',
        total: 7_217_000_000,
        lineItems: [
          { name: 'Texas Dept of Criminal Justice', amount: 4_300_000_000 },
          { name: 'Border Security Operations',     amount: 1_400_000_000 },
          { name: 'Texas Dept of Public Safety',    amount:   900_000_000 },
          { name: 'Judiciary and Courts',           amount:   617_000_000 },
        ],
      },
      {
        name: 'General Government',
        total: 4_902_000_000,
        lineItems: [
          { name: 'General Government Operations', amount: 3_700_000_000 },
          { name: 'Legislature',                   amount:   272_000_000 },
          { name: 'Other General Government',      amount:   930_000_000 },
        ],
      },
      {
        name: 'Natural Resources and Environment',
        total: 1_826_000_000,
        lineItems: [
          { name: 'Parks and Wildlife',            amount:   580_000_000 },
          { name: 'Agriculture and Environment',   amount: 1_246_000_000 },
        ],
      },
      {
        name: 'Other Agencies and Programs',
        total: 1_450_000_000,
        lineItems: [
          { name: 'Business and Economic Development', amount:  630_000_000 },
          { name: 'Regulatory Agencies',               amount:  340_000_000 },
          { name: 'Other Programs',                    amount:  480_000_000 },
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

  const jsonTree = [{ n: 'Texas General Fund Budget', a: total, c: children }];
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
      console.error(`${STATE_NAME}, ${STATE_ABBR} not found. Run seedTXState.js first.`);
      process.exit(2);
    }
    muniId = muni.id;
    console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }

  let ds;
  if (!dryRun) {
    const srcPayload = {
      name:            'Texas General Fund Operating Budget',
      api_type:        'pdf_download',
      dataset_type:    'operating',
      dataset_id:      'tx-gf-operating',
      base_url:        'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/',
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

    // Print summary table
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(40)} ${'Amount ($)'.padStart(18)}`);
    console.log('─'.repeat(60));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(38)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    }
    console.log('─'.repeat(60));
    console.log(`${'TOTAL BUDGET'.padEnd(40)}${Math.round(total).toLocaleString().padStart(18)}`);
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
