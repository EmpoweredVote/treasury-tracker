#!/usr/bin/env node
/**
 * Load the City of Los Angeles audited General Fund series — FY2016-FY2025,
 * both faces, twenty rows.
 *
 * Audit-grade milestone piece 2. This is the series the reader can switch TO:
 * Treasury Tracker already holds this city's UNAUDITED all-funds series from
 * the State Controller for FY2003-FY2025, and a derived total-governmental
 * series for FY2017-FY2025.
 *
 * ⚠⚠⚠ A SECOND SERIES, NEVER A CORRECTION OF THE FIRST. The audited General
 * Fund is ~$6.7B (FY2023); the Controller's all-funds figure for the same city
 * and year is ~$23.5B, because it counts the airport, the port and the
 * utility. Both are right and they will never agree. LA-01 proved the ACFR
 * does not reconcile to the Controller's construction under any stable scope.
 *
 * ⚠⚠ THE RPC KEYS ON (municipality, fiscal_year, dataset_type, fund_scope,
 * basis) AND NOT ON `data_source`. Omitting `p_fund_scope` or `p_basis` makes a
 * re-run DUPLICATE rather than update (#110). This series is
 * `general_fund` + `actual`, which collides with neither of LA's existing
 * series — that is why it lands beside them instead of over them.
 *
 * Usage:
 *   node scripts/loadLaCityAcfr.mjs --dry-run
 *   node scripts/loadLaCityAcfr.mjs
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { toBudgetTree, assertProjection } from './lib/acfrGfLoad.mjs';

const WORK = '_acfr-work/la-city';
const EXTRACTED = `${WORK}/extracted.json`;

/** LA City, as already registered in treasury.municipalities. */
const MUNICIPALITY_ID = '391bf791-1c1f-424f-a7a5-1b698c79093f';
const FISCAL_YEAR_START_MONTH = 7;   // July — fiscal year ends June 30
const FUND_SCOPE = 'general_fund';
const BASIS_VALUE = 'actual';
const DERIVATION = 'published';      // read from the city's own statement

/**
 * ⚠ Must match `la-city-acfr-gf` in all four axis registries BYTE FOR BYTE.
 * The registries key on this string; a space or dash out of place here loads
 * the row `unknown` on every axis and no gate would see it.
 */
function sourceNameFor(datasetType, fiscalYear) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `Los Angeles ACFR — General Fund ${face} (FY${fiscalYear} actual, GAAP basis)`;
}

function client() {
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).');
    process.exit(1);
  }
  return createClient(url, key);
}

const dryRun = process.argv.includes('--dry-run');
const extracted = JSON.parse(readFileSync(EXTRACTED, 'utf8'));

// ⚠ Refuse to write anything if ANY extraction failed its tie. The gate proves
// the read; a partial load would put some audited years on the page and leave
// the rest looking like gaps in the publisher rather than in us.
const untied = extracted.filter((r) => r.tie_delta !== 0);
if (untied.length) {
  console.error(`REFUSING: ${untied.length} extraction(s) do not tie: `
    + untied.map((r) => `FY${r.fiscal_year} ${r.mode} delta ${r.tie_delta}`).join(', '));
  process.exit(1);
}
if (extracted.length !== 20) {
  console.error(`REFUSING: expected 20 extractions (10 years x 2 faces), found ${extracted.length}.`);
  process.exit(1);
}

const db = dryRun ? null : client();
let written = 0;
let categories = 0;

for (const row of extracted) {
  const datasetType = row.mode === 'revenue' ? 'revenue' : 'operating';
  const name = sourceNameFor(datasetType, row.fiscal_year);
  const projected = toBudgetTree(row.tree, row.mode);
  assertProjection(projected, row.tree, `LA FY${row.fiscal_year} ${datasetType}`);

  // ⚠ The source_date is the PERIOD END, never the day we fetched the file.
  // Rendering a retrieval date as "as of" claimed dates that were impossible
  // (Bend FY2006 read "fetched 2006-06-30"); this column holds the period.
  const sourceDate = `${row.fiscal_year}-06-30`;

  if (dryRun) {
    console.log(`FY${row.fiscal_year} ${datasetType.padEnd(9)} `
      + `$${(row.tree.a / 1e9).toFixed(3)}B  ${String(projected.rowCount).padStart(3)} rows  ${name}`);
    written += 1;
    categories += projected.tree.length;
    continue;
  }

  const { data, error } = await db.rpc('treasury_sync_city_budget', {
    p_municipality_id: MUNICIPALITY_ID,
    p_fiscal_year: row.fiscal_year,
    p_dataset_type: datasetType,
    p_total: row.tree.a,
    p_tree: projected.tree,
    p_row_count: projected.rowCount,
    p_data_source_name: name,
    p_source_url: row.url,
    p_source_date: sourceDate,
    p_fiscal_year_start_month: FISCAL_YEAR_START_MONTH,
    p_fund_scope: FUND_SCOPE,
    p_basis: BASIS_VALUE,
    p_derivation: DERIVATION,
  });
  // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST error.
  // Counting attempts is not counting writes.
  if (error) throw new Error(`RPC transport error (FY${row.fiscal_year} ${datasetType}): ${error.message}`);
  if (data?.error) throw new Error(`RPC refused (FY${row.fiscal_year} ${datasetType}): ${data.error}`);
  if (data?.status !== 'success' || !data?.budget_id) {
    throw new Error(`RPC returned no success (FY${row.fiscal_year} ${datasetType}): ${JSON.stringify(data)}`);
  }
  written += 1;
  categories += projected.tree.length;
  console.log(`  FY${row.fiscal_year} ${datasetType.padEnd(9)} ok  ${projected.rowCount} rows`);
}

console.log(`\n${dryRun ? 'WOULD WRITE' : 'Wrote'} ${written} budget rows over ${categories} categories.`);
if (dryRun) {
  console.log('\n--dry-run: no writes performed.');
} else {
  if (written === 0) {
    console.error('REFUSING to report success: no rows were written.');
    process.exit(1);
  }
  console.log('\nNow run, in this order:');
  console.log('  node scripts/stampAuditGrade.mjs --dry-run   # then without --dry-run');
  console.log('  node scripts/verifyAxisStamps.mjs --like "Los Angeles ACFR%"');
  console.log('  npm run verify:frozen');
}
