/**
 * Stamp `audit_grade = 'not_applicable'` on every row that is not a financial
 * statement — `dataset_type` of `salaries` or `transactions`.
 *
 * NO SHEBANG — a test imports this module, and a `#!` breaks `npm test` on Windows.
 *
 * ⭐ Chris's call, 2026-10-30, verbatim: "not_applicable value — salaries aren't
 * financial statements." Spec: docs/superpowers/specs/2026-10-30-audit-grade-ui-design.md §5.4
 *
 * ⚠⚠ WHY THIS IS NOT scripts/stampAuditGrade.mjs.
 *
 * That script is registry-driven, and it refuses any row without a `source_url`
 * — correctly, because every grade IT assigns is a claim about what a publisher
 * did, and such a claim needs a retrievable document behind it. 7,753 of these
 * 7,932 rows (97.7%, measured 2026-10-30) have no `source_url` at all: a
 * payroll extract has no justifying audit document to cite, which is the very
 * fact this value records.
 *
 * So the two stamps answer two different questions and run on two different
 * inputs:
 *
 *   stampAuditGrade.mjs      what did the PUBLISHER do?   → `data_source` + registry + evidence
 *   stampNotApplicableGrade  what KIND of record is this? → `dataset_type`, and nothing else
 *
 * A registry entry would dress a row-shape fact as a publisher judgement, and
 * would have to be repeated for all 26 salary and transaction sources and every
 * future one. tests/auditGradeRegistry.test.mjs pins that no entry carries this
 * value.
 *
 * ⚠ The database agrees: migration 20261030000000 exempts `not_applicable` from
 * `budgets_graded_rows_need_a_source_url` alongside `unknown`, because neither
 * makes a positive claim about assurance. Every value that DOES claim assurance
 * is still bound by that constraint, unchanged.
 *
 * ⚠ Writes a direct UPDATE by primary key. It does NOT go through
 * `treasury_sync_city_budget`, which is not source-safe.
 *
 * Usage:
 *   node scripts/stampNotApplicableGrade.mjs --dry-run
 *   node scripts/stampNotApplicableGrade.mjs
 */

import { paginate } from './lib/listAllSources.mjs';

const PAGE_SIZE = 1000;

/**
 * The dataset types that are not financial statements.
 *
 * ⚠ AN ALLOW-LIST, NEVER A DENY-LIST. Written the other way round — "everything
 * except operating and revenue" — a new statement-shaped dataset_type would be
 * silently claimed by this value the day it was added, and would quietly deny
 * that the audit question applies to it. Adding a type here is a decision
 * somebody makes; forgetting to exclude one is not.
 */
export const NOT_APPLICABLE_DATASET_TYPES = Object.freeze(['salaries', 'transactions']);

/**
 * Decide which rows to stamp. Pure — no I/O, no mutation of the input.
 *
 * @param {{id: string, dataset_type?: string|null, audit_grade?: string|null}[]} rows
 * @returns {{id: string}[]}
 */
export function planNotApplicable(rows) {
  const out = [];
  for (const row of rows) {
    const type = row?.dataset_type;
    if (typeof type !== 'string') continue;
    if (!NOT_APPLICABLE_DATASET_TYPES.includes(type)) continue;
    // Re-runnable: a no-op UPDATE still touches the row and is not free.
    if (row?.audit_grade === 'not_applicable') continue;
    out.push({ id: row.id });
  }
  return out;
}

let _supabase;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).');
    process.exit(1);
  }
  _supabase = createClient(url, key);
  return _supabase;
}

/**
 * Read every candidate row's inputs, paged.
 *
 * ⚠⚠ PAGED READS NEED A TOTAL ORDER, and this repo has broken that five times.
 * `id` is the sort key and the DISTINCT assertion below is the guard: without
 * it, page boundaries can repeat or skip rows and the count would still look
 * plausible.
 */
async function readCandidateRows(client) {
  const rows = await paginate(async (from, to) => {
    const { data, error } = await client
      .schema('treasury')
      .from('budgets')
      .select('id, dataset_type, audit_grade')
      .in('dataset_type', NOT_APPLICABLE_DATASET_TYPES)
      .order('id')
      .range(from, to);
    if (error) throw new Error(`readCandidateRows: ${error.message}`);
    return data ?? [];
  }, PAGE_SIZE);

  const distinct = new Set(rows.map((r) => r.id)).size;
  if (distinct !== rows.length) {
    throw new Error(`PAGING DEFECT: ${rows.length} rows read, ${distinct} distinct ids`);
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await getSupabase();

  const rows = await readCandidateRows(client);
  console.log(`read ${rows.length.toLocaleString()} salaries/transactions rows`);

  const byType = {};
  for (const r of rows) byType[r.dataset_type] = (byType[r.dataset_type] ?? 0) + 1;
  for (const [t, n] of Object.entries(byType).sort()) {
    console.log(`  ${t.padEnd(14)} ${String(n).padStart(7)}`);
  }

  const planned = planNotApplicable(rows);
  console.log(`\n${planned.length.toLocaleString()} row(s) would change to not_applicable.`);
  if (planned.length === 0) console.log('  (nothing to do)');

  if (dryRun) {
    console.log('\n--dry-run: no writes performed.');
    return;
  }

  // ⚠ Batched by explicit ID list, NOT by re-deriving the predicate in SQL. The
  // rule lives in planNotApplicable (unit-tested) and nowhere else; a
  // `WHERE dataset_type IN (...)` here would be a second, untested copy that
  // could drift from it.
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < planned.length; i += CHUNK) {
    const batch = planned.slice(i, i + CHUNK).map((p) => p.id);
    const { error } = await client
      .schema('treasury')
      .from('budgets')
      .update({ audit_grade: 'not_applicable' })
      .in('id', batch);
    if (error) throw new Error(`stamp batch at ${i}: ${error.message}`);
    written += batch.length;
    console.log(`  ...${written}/${planned.length}`);
  }
  console.log(`\nstamped ${written.toLocaleString()} row(s).`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('stampNotApplicableGrade.mjs')) await main();
