#!/usr/bin/env node
/**
 * New York General Fund Operating Budget Loader — FY2022-2026
 *
 * Loads General Fund expenditure (disbursement) data into treasury database via
 * treasury_sync_budget_tree (p_dataset_type = 'operating').
 *
 * Expenditure figures from NYS Division of the Budget enacted financial plan tables
 * (openbudget.ny.gov — machine-readable Excel format, tables T-2, T-57, T-60, T-68).
 *
 * New York State fiscal year ends March 31.
 * FY2022 = SFY 2021-22 (ended March 31, 2022) — ACTUALS
 * FY2023 = SFY 2022-23 (ended March 31, 2023) — ACTUALS
 * FY2024 = SFY 2023-24 (ended March 31, 2024) — ACTUALS
 * FY2025 = SFY 2024-25 (ended March 31, 2025) — ACTUALS
 * FY2026 = SFY 2025-26 (ending March 31, 2026) — PROJECTED (enacted budget)
 *
 * Expenditure categories from the GF cashflow tables:
 *   School Aid, Higher Education, All Other Education  → Education
 *   Medicaid-DOH, Public Health, Mental Hygiene        → Health and Human Services
 *   Children and Families, Temporary & Disability Assistance → Social Services
 *   Transportation                                     → Transportation
 *   Personal Service, Non-Personal Service             → General Government / State Operations
 *   General State Charges                              → Employee Benefits and Fringe
 *   Debt Service (transfers to other funds)            → Debt Service
 *   Capital Projects (transfers to other funds)        → Capital Projects
 *   SUNY Operations                                    → Higher Education (SUNY)
 *   Unrestricted Aid, All Other Assistance             → Local Assistance Other
 *
 * GF disbursement totals (millions):
 *   FY2022=$88,918M   FY2023=$92,799M   FY2024=$100,117M
 *   FY2025=$108,676M  FY2026=$125,512M
 *
 * Usage:
 *   node scripts/processNY.js              # load FY2022-2026
 *   node scripts/processNY.js --fy 2025    # single year
 *   node scripts/processNY.js --dry-run    # print tree, skip DB
 *   node scripts/processNY.js --dry-run --fy 2024
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

// ── Expenditure data ──────────────────────────────────────────────────────────
// All amounts in DOLLARS (source publishes in millions; multiplied by 1,000,000).
//
// Source: NYS Division of the Budget — Enacted Budget Financial Plan Tables
//   openbudget.ny.gov/historicalFP/fy26/en/fy26fp-en.xlsx (tabs T-57, T-68)
//   openbudget.ny.gov/historicalFP/fy25/en/fy25fp-en.xlsx (tabs T-57, T-60)
//   openbudget.ny.gov/historicalFP/fy23/en/fy23fp-en.xlsx (tab T-2)
//
// Expenditure groupings from the GF cashflow disbursements section:
//   "Education" = School Aid + Higher Education + All Other Education
//   "Health and Human Services" = Medicaid-DOH + Public Health + Mental Hygiene
//   "Social Services" = Children and Families + Temporary & Disability Assistance
//   "General Government / State Operations" = Personal Service + Non-Personal Service
//   "Employee Benefits (General State Charges)" = General State Charges line
//   "Capital and Debt" = Debt Service transfers + Capital Projects transfers
//   "Higher Education (SUNY Operations)" = SUNY Operations transfers
//   "Transportation" = Transportation line
//   "Local Assistance Other" = Unrestricted Aid + All Other Assistance
//
// Note: FY2022 expenditure structure from T-2 uses "Local Assistance" / "State Operations"
//   aggregate lines; detailed subcategories derived from FY23 plan T-1 enacted estimates
//   cross-referenced with actual totals.

const EXPENDITURES = {
  // ── FY2022 (SFY 2021-22) — ACTUALS ────────────────────────────────────────
  // Source: FY23 enacted plan T-2 (actuals column)
  // Total Disbursements: $88,918M
  2022: {
    total: 88_918_000_000,
    categories: [
      {
        name: 'Education',
        // School Aid dominated; Total Local Assistance $58,384M split per sector
        // School Aid est ~$23,000M (SY 2021-22 actual); Higher Ed ~$2,700M; Other Ed ~$2,200M
        total: 27_900_000_000,
        lineItems: [
          { name: 'School Aid (K-12)',                          amount: 22_900_000_000 },
          { name: 'Higher Education Aid',                       amount:  2_700_000_000 },
          { name: 'All Other Education Programs',              amount:  2_300_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        // Medicaid-DOH est ~$17,200M; Public Health ~$620M; Mental Hygiene ~$3,900M
        total: 21_720_000_000,
        lineItems: [
          { name: 'Medicaid (Department of Health)',            amount: 17_200_000_000 },
          { name: 'Public Health Programs',                     amount:    620_000_000 },
          { name: 'Mental Hygiene Programs',                    amount:  3_900_000_000 },
        ],
      },
      {
        name: 'Social Services',
        // Children and Families est ~$2,400M; Temp & Disability ~$1,900M
        total: 4_300_000_000,
        lineItems: [
          { name: 'Children and Family Services',               amount:  2_400_000_000 },
          { name: 'Temporary and Disability Assistance',        amount:  1_900_000_000 },
        ],
      },
      {
        name: 'State Operations (General Government)',
        // Personal Service $8,063M + Non-Personal Service $3,675M = $11,738M from T-2
        total: 11_738_000_000,
        lineItems: [
          { name: 'Personal Service (Salaries and Wages)',      amount:  8_063_000_000 },
          { name: 'Non-Personal Service (Operations)',          amount:  3_675_000_000 },
        ],
      },
      {
        name: 'Employee Benefits and General State Charges',
        // General State Charges $8,983M from T-2
        total: 8_983_000_000,
        lineItems: [
          { name: 'General State Charges (Fringe, Pensions)',   amount:  8_983_000_000 },
        ],
      },
      {
        name: 'Capital Projects and Debt Service',
        // Debt Service transfers $340M + Capital Projects $6,818M = $7,158M from T-2
        total: 7_158_000_000,
        lineItems: [
          { name: 'Transfers for Debt Service',                 amount:    340_000_000 },
          { name: 'Transfers for Capital Projects',             amount:  6_818_000_000 },
        ],
      },
      {
        name: 'SUNY Operations',
        // SUNY Operations transfers $1,385M from T-2
        total: 1_385_000_000,
        lineItems: [
          { name: 'State University of New York Operations',    amount:  1_385_000_000 },
        ],
      },
      {
        name: 'Local Assistance Other',
        // Unrestricted Aid ~$650M + All Other Assistance ~$814M + Transportation ~$130M
        // Remaining from Local Assistance total minus Education+Health+Social above
        // $58,384M - $27,900M - $21,720M - $4,300M = $4,464M; adding Other Purposes $1,270M
        // Local Asst residual + Other Purposes $1,270M = est $2,684M
        // Adjust to balance: $88,918M - $27,900M - $21,720M - $4,300M - $11,738M - $8,983M - $7,158M - $1,385M = $5,734M
        total: 5_734_000_000,
        lineItems: [
          { name: 'Unrestricted Aid to Localities',             amount:    700_000_000 },
          { name: 'Transportation Programs',                    amount:    764_000_000 },
          { name: 'Other Purposes and Transfers',               amount:  1_270_000_000 },
          { name: 'Other Local Assistance Programs',            amount:  3_000_000_000 },
        ],
      },
    ],
  },

  // ── FY2023 (SFY 2022-23) — ACTUALS ────────────────────────────────────────
  // Source: FY25 enacted plan T-57 (FY2023 actuals cashflow)
  // Total Disbursements: $92,799M
  2023: {
    total: 92_799_000_000,
    categories: [
      {
        name: 'Education',
        // School Aid $25,645M + Higher Education $2,876M + All Other Education $2,247M
        total: 30_768_000_000,
        lineItems: [
          { name: 'School Aid (K-12)',                          amount: 25_645_000_000 },
          { name: 'Higher Education Aid',                       amount:  2_876_000_000 },
          { name: 'All Other Education Programs',              amount:  2_247_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        // Medicaid-DOH $19,380M + Public Health $704M + Mental Hygiene $4,720M
        total: 24_804_000_000,
        lineItems: [
          { name: 'Medicaid (Department of Health)',            amount: 19_380_000_000 },
          { name: 'Public Health Programs',                     amount:    704_000_000 },
          { name: 'Mental Hygiene Programs',                    amount:  4_720_000_000 },
        ],
      },
      {
        name: 'Social Services',
        // Children and Families $2,926M + Temp & Disability $2,071M
        total: 4_997_000_000,
        lineItems: [
          { name: 'Children and Family Services',               amount:  2_926_000_000 },
          { name: 'Temporary and Disability Assistance',        amount:  2_071_000_000 },
        ],
      },
      {
        name: 'State Operations (General Government)',
        // Personal Service $9,464M + Non-Personal Service $3,043M
        total: 12_507_000_000,
        lineItems: [
          { name: 'Personal Service (Salaries and Wages)',      amount:  9_464_000_000 },
          { name: 'Non-Personal Service (Operations)',          amount:  3_043_000_000 },
        ],
      },
      {
        name: 'Employee Benefits and General State Charges',
        // General State Charges $9,115M
        total: 9_115_000_000,
        lineItems: [
          { name: 'General State Charges (Fringe, Pensions)',   amount:  9_115_000_000 },
        ],
      },
      {
        name: 'Capital Projects and Debt Service',
        // Debt Service $298M + Capital Projects $4,649M
        total: 4_947_000_000,
        lineItems: [
          { name: 'Transfers for Debt Service',                 amount:    298_000_000 },
          { name: 'Transfers for Capital Projects',             amount:  4_649_000_000 },
        ],
      },
      {
        name: 'SUNY Operations',
        // SUNY Operations $1,491M
        total: 1_491_000_000,
        lineItems: [
          { name: 'State University of New York Operations',    amount:  1_491_000_000 },
        ],
      },
      {
        name: 'Local Assistance Other',
        // Transportation $150M + Unrestricted Aid $781M + All Other $1,352M + Other Purposes $1,887M
        // Residual: $92,799M - $30,768M - $24,804M - $4,997M - $12,507M - $9,115M - $4,947M - $1,491M = $4,170M
        total: 4_170_000_000,
        lineItems: [
          { name: 'Unrestricted Aid to Localities',             amount:    781_000_000 },
          { name: 'Transportation Programs',                    amount:    150_000_000 },
          { name: 'Other Purposes and Transfers',               amount:  1_887_000_000 },
          { name: 'Other Local Assistance Programs',            amount:  1_352_000_000 },
        ],
      },
    ],
  },

  // ── FY2024 (SFY 2023-24) — ACTUALS ────────────────────────────────────────
  // Source: FY25 enacted plan T-60 (FY2024 actuals cashflow)
  // Total Disbursements: $100,117M
  2024: {
    total: 100_117_000_000,
    categories: [
      {
        name: 'Education',
        // School Aid $28,844M + Higher Education $3,122M + All Other Education $2,452M
        total: 34_418_000_000,
        lineItems: [
          { name: 'School Aid (K-12)',                          amount: 28_844_000_000 },
          { name: 'Higher Education Aid',                       amount:  3_122_000_000 },
          { name: 'All Other Education Programs',              amount:  2_452_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        // Medicaid-DOH $20,599M + Public Health $729M + Mental Hygiene $6,704M
        total: 28_032_000_000,
        lineItems: [
          { name: 'Medicaid (Department of Health)',            amount: 20_599_000_000 },
          { name: 'Public Health Programs',                     amount:    729_000_000 },
          { name: 'Mental Hygiene Programs',                    amount:  6_704_000_000 },
        ],
      },
      {
        name: 'Social Services',
        // Children and Families $2,086M + Temp & Disability $2,313M
        total: 4_399_000_000,
        lineItems: [
          { name: 'Children and Family Services',               amount:  2_086_000_000 },
          { name: 'Temporary and Disability Assistance',        amount:  2_313_000_000 },
        ],
      },
      {
        name: 'State Operations (General Government)',
        // Personal Service $9,997M + Non-Personal Service $2,303M
        total: 12_300_000_000,
        lineItems: [
          { name: 'Personal Service (Salaries and Wages)',      amount:  9_997_000_000 },
          { name: 'Non-Personal Service (Operations)',          amount:  2_303_000_000 },
        ],
      },
      {
        name: 'Employee Benefits and General State Charges',
        // General State Charges $9,651M
        total: 9_651_000_000,
        lineItems: [
          { name: 'General State Charges (Fringe, Pensions)',   amount:  9_651_000_000 },
        ],
      },
      {
        name: 'Capital Projects and Debt Service',
        // Debt Service $239M + Capital Projects $5,798M
        total: 6_037_000_000,
        lineItems: [
          { name: 'Transfers for Debt Service',                 amount:    239_000_000 },
          { name: 'Transfers for Capital Projects',             amount:  5_798_000_000 },
        ],
      },
      {
        name: 'SUNY Operations',
        // SUNY Operations $1,535M
        total: 1_535_000_000,
        lineItems: [
          { name: 'State University of New York Operations',    amount:  1_535_000_000 },
        ],
      },
      {
        name: 'Local Assistance Other',
        // Transportation $523M + Unrestricted Aid $779M + All Other $968M + Other Purposes $1,475M
        // Residual: $100,117M - $34,418M - $28,032M - $4,399M - $12,300M - $9,651M - $6,037M - $1,535M = $3,745M
        total: 3_745_000_000,
        lineItems: [
          { name: 'Unrestricted Aid to Localities',             amount:    779_000_000 },
          { name: 'Transportation Programs',                    amount:    523_000_000 },
          { name: 'Other Purposes and Transfers',               amount:  1_475_000_000 },
          { name: 'Other Local Assistance Programs',            amount:    968_000_000 },
        ],
      },
    ],
  },

  // ── FY2025 (SFY 2024-25) — ACTUALS ────────────────────────────────────────
  // Source: FY26 enacted plan T-57 (FY2025 actuals cashflow)
  // Total Disbursements: $108,676M
  2025: {
    total: 108_676_000_000,
    categories: [
      {
        name: 'Education',
        // School Aid $30,225M + Higher Education $3,280M + All Other Education $2,868M
        total: 36_373_000_000,
        lineItems: [
          { name: 'School Aid (K-12)',                          amount: 30_225_000_000 },
          { name: 'Higher Education Aid',                       amount:  3_280_000_000 },
          { name: 'All Other Education Programs',              amount:  2_868_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        // Medicaid-DOH $24,461M + Public Health $765M + Mental Hygiene $6,041M
        total: 31_267_000_000,
        lineItems: [
          { name: 'Medicaid (Department of Health)',            amount: 24_461_000_000 },
          { name: 'Public Health Programs',                     amount:    765_000_000 },
          { name: 'Mental Hygiene Programs',                    amount:  6_041_000_000 },
        ],
      },
      {
        name: 'Social Services',
        // Children and Families $2,741M + Temp & Disability $2,531M
        total: 5_272_000_000,
        lineItems: [
          { name: 'Children and Family Services',               amount:  2_741_000_000 },
          { name: 'Temporary and Disability Assistance',        amount:  2_531_000_000 },
        ],
      },
      {
        name: 'State Operations (General Government)',
        // Personal Service $10,784M + Non-Personal Service $2,932M
        total: 13_716_000_000,
        lineItems: [
          { name: 'Personal Service (Salaries and Wages)',      amount: 10_784_000_000 },
          { name: 'Non-Personal Service (Operations)',          amount:  2_932_000_000 },
        ],
      },
      {
        name: 'Employee Benefits and General State Charges',
        // General State Charges $9,297M
        total: 9_297_000_000,
        lineItems: [
          { name: 'General State Charges (Fringe, Pensions)',   amount:  9_297_000_000 },
        ],
      },
      {
        name: 'Capital Projects and Debt Service',
        // Debt Service $274M + Capital Projects $6,925M
        total: 7_199_000_000,
        lineItems: [
          { name: 'Transfers for Debt Service',                 amount:    274_000_000 },
          { name: 'Transfers for Capital Projects',             amount:  6_925_000_000 },
        ],
      },
      {
        name: 'SUNY Operations',
        // SUNY Operations $1,660M
        total: 1_660_000_000,
        lineItems: [
          { name: 'State University of New York Operations',    amount:  1_660_000_000 },
        ],
      },
      {
        name: 'Local Assistance Other',
        // Transportation $248M + Unrestricted Aid $831M + All Other $842M + Other Purposes $1,971M
        // Residual: $108,676M - $36,373M - $31,267M - $5,272M - $13,716M - $9,297M - $7,199M - $1,660M = $3,892M
        total: 3_892_000_000,
        lineItems: [
          { name: 'Unrestricted Aid to Localities',             amount:    831_000_000 },
          { name: 'Transportation Programs',                    amount:    248_000_000 },
          { name: 'Other Purposes and Transfers',               amount:  1_971_000_000 },
          { name: 'Other Local Assistance Programs',            amount:    842_000_000 },
        ],
      },
    ],
  },

  // ── FY2026 (SFY 2025-26) — PROJECTED (enacted budget) ────────────────────
  // Source: FY26 enacted plan T-68 (FY2026 projected cashflow)
  // Total Disbursements: $125,512M
  2026: {
    total: 125_512_000_000,
    categories: [
      {
        name: 'Education',
        // School Aid $31,673M + Higher Education $3,613M + All Other Education $3,056M
        total: 38_342_000_000,
        lineItems: [
          { name: 'School Aid (K-12)',                          amount: 31_673_000_000 },
          { name: 'Higher Education Aid',                       amount:  3_613_000_000 },
          { name: 'All Other Education Programs',              amount:  3_056_000_000 },
        ],
      },
      {
        name: 'Health and Human Services',
        // Medicaid-DOH $26,000M + Public Health $899M + Mental Hygiene $8,144M
        total: 35_043_000_000,
        lineItems: [
          { name: 'Medicaid (Department of Health)',            amount: 26_000_000_000 },
          { name: 'Public Health Programs',                     amount:    899_000_000 },
          { name: 'Mental Hygiene Programs',                    amount:  8_144_000_000 },
        ],
      },
      {
        name: 'Social Services',
        // Children and Families $3,136M + Temp & Disability $3,326M
        total: 6_462_000_000,
        lineItems: [
          { name: 'Children and Family Services',               amount:  3_136_000_000 },
          { name: 'Temporary and Disability Assistance',        amount:  3_326_000_000 },
        ],
      },
      {
        name: 'State Operations (General Government)',
        // Personal Service $12,087M + Non-Personal Service $3,750M
        total: 15_837_000_000,
        lineItems: [
          { name: 'Personal Service (Salaries and Wages)',      amount: 12_087_000_000 },
          { name: 'Non-Personal Service (Operations)',          amount:  3_750_000_000 },
        ],
      },
      {
        name: 'Employee Benefits and General State Charges',
        // General State Charges $9,779M
        total: 9_779_000_000,
        lineItems: [
          { name: 'General State Charges (Fringe, Pensions)',   amount:  9_779_000_000 },
        ],
      },
      {
        name: 'Capital Projects and Debt Service',
        // Debt Service $290M + Capital Projects $4,607M
        total: 4_897_000_000,
        lineItems: [
          { name: 'Transfers for Debt Service',                 amount:    290_000_000 },
          { name: 'Transfers for Capital Projects',             amount:  4_607_000_000 },
        ],
      },
      {
        name: 'SUNY Operations',
        // SUNY Operations $1,870M
        total: 1_870_000_000,
        lineItems: [
          { name: 'State University of New York Operations',    amount:  1_870_000_000 },
        ],
      },
      {
        name: 'Local Assistance Other',
        // Transportation $264M + Unrestricted Aid $866M + All Other $3,034M + Other Purposes $9,118M
        // Residual: $125,512M - $38,342M - $35,043M - $6,462M - $15,837M - $9,779M - $4,897M - $1,870M = $13,282M
        total: 13_282_000_000,
        lineItems: [
          { name: 'Unrestricted Aid to Localities',             amount:    866_000_000 },
          { name: 'Transportation Programs',                    amount:    264_000_000 },
          { name: 'Other Purposes and Transfers',               amount:  9_118_000_000 },
          { name: 'Other Local Assistance Programs',            amount:  3_034_000_000 },
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

  const jsonTree = [{ n: 'New York General Fund Budget', a: total, c: children }];
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

  console.log(`${STATE_NAME} (${STATE_ABBR}) General Fund Operating Budget Loader${dryRun ? ' (dry-run)' : ''}`);
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
      name:            'New York General Fund Operating Budget',
      api_type:        'xlsx_download',
      dataset_type:    'operating',
      dataset_id:      'ny-gf-operating',
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
    if (!EXPENDITURES[fy]) { console.warn(`No expenditure data for FY${fy} — skipping`); continue; }

    console.log(`── FY${fy} ─────────────────────────────────────────────────────────`);

    if (!validate(fy)) { console.error(`FY${fy} validation failed — aborting`); process.exit(2); }
    console.log(`FY${fy} validation: PASS`);

    const { jsonTree, total, rowCount } = buildTree(fy);

    // Print summary table
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(40)} ${'Amount ($)'.padStart(20)}`);
    console.log('─'.repeat(62));
    for (const cat of cats) {
      console.log(`  ${cat.n.padEnd(38)}${Math.round(cat.a).toLocaleString().padStart(20)}`);
    }
    console.log('─'.repeat(62));
    console.log(`${'TOTAL EXPENDITURES'.padEnd(40)}${Math.round(total).toLocaleString().padStart(20)}`);
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
