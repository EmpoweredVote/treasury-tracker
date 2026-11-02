#!/usr/bin/env node
/**
 * Re-write every VA APA revenue row with Exhibit B-1 intergovernmental aid
 * included, so a locality's "Money In" is its whole revenue rather than its
 * local-source slice.
 *
 * (Shebang is correct HERE — entry point with a main guard.)
 *
 * ── WHAT THIS CHANGES ───────────────────────────────────────────────────────
 * Only `revenue`. The 304 operating rows are untouched — Exhibit C has not
 * moved and there is nothing to correct there, so they keep their figures AND
 * their source_date.
 *
 * ⚠⚠ RUN THE MIGRATION FIRST. 20261103000000 relabels these rows
 * revenue_local_only -> revenue. The RPC finds its target on
 * (municipality_id, fiscal_year, dataset_type, fund_scope, basis), so until
 * that label flips this script would match nothing, INSERT 304 new rows, and
 * strand the originals. It refuses to start if any revenue_local_only row is
 * still there.
 *
 * ⚠⚠ AND CAPTURE THE LEDGER FIRST — scripts/captureVaRevenueFigureChanges.mjs.
 * Every one of these rows is inside the frozen set, so their figures moving is
 * exactly what figures_frozen exists to catch. This script refuses to start if
 * scripts/data/figureChanges.json does not already cover all of them.
 *
 * ⚠ EACH ROW'S EXISTING source_url IS PRESERVED, read back per row rather than
 * hard-coded, so the citation a reader follows is unchanged by a figure fix.
 * source_date moves to the date the workbooks were actually fetched, because
 * that is what it means and these figures were read from files pulled that day.
 *
 * Usage:
 *   node scripts/backfillVaIntergovernmentalRevenue.mjs --fy2023 <xlsx> --fy2024 <xlsx> --dry-run
 *   node scripts/backfillVaIntergovernmentalRevenue.mjs --fy2023 <xlsx> --fy2024 <xlsx>
 */
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import {
  getSupabase, buildRevenueTree, importDataset, ENTITY_TYPE_SECTION, DATA_SOURCE_NAME,
  workbookName,
} from './loadVAComparativeReport.js';

/** The date the two workbooks were fetched from data.virginia.gov. */
const SOURCE_DATE = '2026-11-02';

export async function main() {
  const { values } = parseArgs({
    options: {
      fy2023: { type: 'string' },
      fy2024: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const dryRun = values['dry-run'];
  if (!values.fy2023 || !values.fy2024) {
    throw new Error('both --fy2023 and --fy2024 workbook paths are required');
  }

  const supabase = await getSupabase();

  // ── Precondition 1: the relabel has run ──────────────────────────────────
  const { count: stillHidden, error: hiddenErr } = await supabase.schema('treasury')
    .from('budgets').select('id', { count: 'exact', head: true })
    .eq('data_source', DATA_SOURCE_NAME).eq('dataset_type', 'revenue_local_only');
  if (hiddenErr) throw new Error(`precondition read failed: ${hiddenErr.message}`);
  if (stillHidden > 0) {
    throw new Error(
      `${stillHidden} row(s) are still dataset_type='revenue_local_only'. Apply migration `
      + '20261103000000 first — writing `revenue` while they are hidden INSERTS duplicates '
      + 'instead of updating, because the RPC keys on dataset_type.');
  }

  // ── The rows to rewrite, with the source_url each already carries ────────
  const { data: rows, error } = await supabase.schema('treasury')
    .from('budgets')
    .select('id, fiscal_year, source_url, municipality_id, municipalities!inner(name, entity_type)')
    .eq('data_source', DATA_SOURCE_NAME)
    .eq('dataset_type', 'revenue')
    .order('id')
    .limit(5000);
  if (error) throw new Error(`read failed: ${error.message}`);
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) {
    throw new Error(`paged read returned ${rows.length} rows but ${ids.size} distinct ids`);
  }

  // ── Precondition 2: the ledger covers every row whose figure will move ───
  const ledger = new Set(
    JSON.parse(readFileSync('scripts/data/figureChanges.json', 'utf8')).map((e) => e.id));
  const unledgered = rows.filter((r) => !ledger.has(r.id));
  if (unledgered.length > 0) {
    throw new Error(
      `${unledgered.length} row(s) would change figure with no entry in `
      + 'scripts/data/figureChanges.json. Run scripts/captureVaRevenueFigureChanges.mjs '
      + 'BEFORE this script — afterwards it records the new figures as the old ones.');
  }

  const books = {};
  for (const [fy, p] of [[2023, values.fy2023], [2024, values.fy2024]]) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(p);
    books[fy] = wb;
  }

  let written = 0; let unverified = 0;
  const failures = [];

  for (const row of rows) {
    const { name, entity_type: et } = row.municipalities;
    const section = ENTITY_TYPE_SECTION[et];
    const mn = workbookName(name, et);
    const label = `${name} FY${row.fiscal_year}`;
    try {
      const rev = buildRevenueTree(books[row.fiscal_year], mn, section);
      if (rev.statedTotal == null) unverified += 1;
      if (dryRun) { written += 1; continue; }
      const out = await importDataset(
        supabase, row.municipality_id, row.fiscal_year, 'revenue',
        rev.tree, rev.total, row.source_url, SOURCE_DATE);
      if (out == null) { failures.push(`${label}: skipped by the never-overwrite guard`); continue; }
      written += 1;
      if (written % 50 === 0) console.log(`  …${written}/${rows.length}`);
    } catch (e) {
      failures.push(`${label}: ${e.message}`);
    }
  }

  console.log(`\nrows considered : ${rows.length}`);
  console.log(`${dryRun ? 'would write' : 'written'}     : ${written}`);
  console.log(`unverified      : ${unverified}  (no Exhibit A row to check the tree against)`);
  console.log(`failures        : ${failures.length}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('backfillVaIntergovernmentalRevenue.mjs')) {
  await main();
}
