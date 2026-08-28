/**
 * Stamp `audit_grade` on budget rows whose `data_source` is in the audit-grade
 * registry.
 *
 * NO SHEBANG — a test imports this module, and a `#!` breaks `npm test` on Windows.
 *
 * ⚠ Writes a direct UPDATE by primary key. It does NOT go through
 * `treasury_sync_city_budget`, which is not source-safe: that RPC never updates
 * `data_source` and will overwrite a row or silently insert a duplicate.
 *
 * ⚠ Refuses to stamp any row lacking a `source_url`. A grade whose justifying
 * document cannot be retrieved is an unfalsifiable claim about a government's
 * books. The database enforces this too
 * (`budgets_graded_rows_need_a_source_url`); this keeps the script from even
 * attempting a write the constraint would reject.
 *
 * ⚠ Sources absent from the registry are LEFT ALONE, not defaulted. The MN OSA
 * City/County Finances Report is deliberately unregistered — its audit status is
 * unverified — so Duluth, Saint Paul, Ramsey County and Saint Louis County keep
 * `unknown`. Silence about assurance is the honest output.
 *
 * Usage:
 *   node scripts/stampAuditGrade.mjs --dry-run
 *   node scripts/stampAuditGrade.mjs
 *
 * Spec: .planning/KNIGHT-COMMUNITIES-SEEDING.md §3
 */

import { gradeFor } from './data/auditGradeRegistry.mjs';
import { paginate } from './lib/listAllSources.mjs';

const PAGE_SIZE = 1000;

/**
 * Decide which rows to stamp. Pure — no I/O, no mutation of the input.
 *
 * @param {{id: string, data_source?: string|null, source_url?: string|null}[]} rows
 * @returns {{id: string, audit_grade: string, entryId: string}[]}
 */
export function planStamps(rows) {
  const out = [];
  for (const row of rows) {
    const url = row?.source_url;
    if (typeof url !== 'string' || url.trim() === '') continue;
    const { value, entryId } = gradeFor(row?.data_source);
    // entryId is non-null ONLY when a real classification happened, so this
    // never stamps the unknown value.
    if (entryId === null) continue;
    out.push({ id: row.id, audit_grade: value, entryId });
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

/** Read every budget row's grading inputs, paged. */
async function readAllRows(client) {
  return paginate(async (from, to) => {
    const { data, error } = await client
      .schema('treasury')
      .from('budgets')
      .select('id, data_source, source_url, audit_grade')
      // ⚠ Total order, primary key LAST. Without `id` the page boundaries are
      // not deterministic and rows can repeat or vanish across pages.
      .order('data_source', { nullsFirst: true })
      .order('id')
      .range(from, to);
    if (error) throw new Error(`readAllRows: ${error.message}`);
    return data ?? [];
  }, PAGE_SIZE);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await getSupabase();

  const rows = await readAllRows(client);
  console.log(`read ${rows.length.toLocaleString()} budget rows`);

  const planned = planStamps(rows);
  // Only write rows whose grade would actually change — a no-op UPDATE still
  // touches the row and is not free.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const changes = planned.filter((p) => byId.get(p.id)?.audit_grade !== p.audit_grade);

  const counts = {};
  for (const c of changes) counts[c.entryId] = (counts[c.entryId] ?? 0) + 1;

  console.log(`\n${planned.length.toLocaleString()} row(s) classify; ${changes.length.toLocaleString()} would change:`);
  for (const [entryId, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${entryId.padEnd(28)} ${String(n).padStart(7)}`);
  }
  if (Object.keys(counts).length === 0) console.log('  (nothing to do)');

  if (dryRun) {
    console.log('\n--dry-run: no writes performed.');
    return;
  }

  // ⚠ Batched by explicit ID list, NOT by re-deriving the match pattern in SQL.
  // The classification lives in planStamps (unit-tested) and nowhere else; a
  // WHERE data_source = ... here would be a second, untested copy of the rule
  // that could drift from the registry. Chunked because a URL-encoded `in`
  // list has a practical length limit.
  const CHUNK = 500;
  const byGrade = new Map();
  for (const c of changes) {
    if (!byGrade.has(c.audit_grade)) byGrade.set(c.audit_grade, []);
    byGrade.get(c.audit_grade).push(c.id);
  }

  let written = 0;
  for (const [grade, ids] of byGrade) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = ids.slice(i, i + CHUNK);
      const { error } = await client
        .schema('treasury')
        .from('budgets')
        .update({ audit_grade: grade })
        .in('id', batch);
      if (error) throw new Error(`stamp ${grade} batch at ${i}: ${error.message}`);
      written += batch.length;
      console.log(`  ...${written}/${changes.length}`);
    }
  }
  console.log(`\nstamped ${written.toLocaleString()} row(s).`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('stampAuditGrade.mjs')) await main();
