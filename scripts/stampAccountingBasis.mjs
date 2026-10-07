/**
 * Stamp `accounting_basis` on budget rows whose `data_source` is in the
 * accounting-basis registry.
 *
 * NO SHEBANG, deliberately — tests import `planStamps` from this file, and a
 * `#!` on any module a test imports breaks `npm test` on Windows (git rewrites
 * to CRLF, Vite's shebang strip does not match `\r`, and the suite dies with a
 * SyntaxError naming no file). Run it as `node scripts/stampAccountingBasis.mjs`.
 *
 * ⚠ Refuses to stamp any row lacking a `source_url`. A basis claim whose
 * justifying document cannot be retrieved is an unfalsifiable statement about
 * a government's books — the same rule `stampAuditGrade.mjs` follows, and for
 * the same reason.
 *
 * ⚠⚠ Sources absent from the registry are LEFT ALONE, not defaulted. Silence
 * about how a figure was measured is the honest output. A bulk `gaap` default
 * is the specific failure this axis exists to prevent: it would mark ~280k
 * rows with a claim nobody checked, and every one of them would look verified.
 *
 * Usage:
 *   node scripts/stampAccountingBasis.mjs --dry-run
 *   node scripts/stampAccountingBasis.mjs
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (source .env first).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNTING_BASIS_REGISTRY } from './data/accountingBasisRegistry.mjs';
import { classifyAxis, ACCOUNTING_BASIS, ACCOUNTING_BASIS_VALUES } from './lib/budgetAxes.mjs';
import { paginate } from './lib/listAllSources.mjs';

const PAGE_SIZE = 1000;

/**
 * Decide which rows to stamp. Pure — no I/O, no mutation of the input.
 *
 * @param {{id: string, data_source?: string|null, source_url?: string|null}[]} rows
 * @returns {{id: string, accounting_basis: string, entryId: string}[]}
 */
export function planStamps(rows) {
  const out = [];
  for (const row of rows) {
    const url = row?.source_url;
    if (typeof url !== 'string' || url.trim() === '') continue;
    const { value, entryId } = classifyAxis(
      row?.data_source, ACCOUNTING_BASIS_REGISTRY, ACCOUNTING_BASIS_VALUES, ACCOUNTING_BASIS.UNKNOWN,
    );
    // entryId is non-null ONLY when a real classification happened, so this
    // can never stamp the unknown value.
    if (entryId === null) continue;
    out.push({ id: row.id, accounting_basis: value, entryId });
  }
  return out;
}

let _supabase;
async function getSupabase() {
  if (_supabase) return _supabase;
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent is fine */ }
  }
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) { console.error('Missing SUPABASE_URL — refusing to guess a production URL.'); process.exit(1); }
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY. Use --dry-run for a no-write pass.'); process.exit(1); }
  _supabase = createClient(url, key);
  return _supabase;
}

/** ⚠ Paged with a TOTAL ORDER ending in the primary key, and DISTINCT ids
 *  asserted — the defect that has bitten four times. */
async function readAllRows(client) {
  const rows = await paginate(async (from, to) => {
    const { data, error } = await client
      .schema('treasury')
      .from('budgets')
      .select('id, data_source, source_url, accounting_basis')
      .order('data_source', { nullsFirst: true })
      .order('id')
      .range(from, to);
    if (error) throw new Error(`readAllRows: ${error.message}`);
    return data ?? [];
  }, PAGE_SIZE);
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) {
    throw new Error(`PAGING DEFECT: ${rows.length} rows, ${ids.size} distinct ids`);
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await getSupabase();

  const rows = await readAllRows(client);
  console.log(`read ${rows.length.toLocaleString()} budget rows`);

  const planned = planStamps(rows);
  // Only write rows whose value would actually change — a no-op UPDATE still
  // touches the row and is not free.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const changes = planned.filter((p) => byId.get(p.id)?.accounting_basis !== p.accounting_basis);

  const counts = {};
  for (const c of changes) counts[c.entryId] = (counts[c.entryId] ?? 0) + 1;

  console.log(`\n${planned.length.toLocaleString()} row(s) classify; ${changes.length.toLocaleString()} would change:`);
  for (const [entryId, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${entryId.padEnd(32)} ${String(n).padStart(7)}`);
  }
  if (Object.keys(counts).length === 0) console.log('  (nothing to do)');

  const left = rows.length - planned.length;
  console.log(`\n${left.toLocaleString()} row(s) match no registry entry and are LEFT ALONE, not defaulted.`);

  if (dryRun) { console.log('\n--dry-run: no writes performed.'); return; }

  // ⚠ Batched by explicit ID list, NOT by re-deriving the match pattern in SQL.
  // The classification lives in planStamps (unit-tested) and nowhere else; a
  // WHERE data_source = ... here would be a second, untested copy of the rule.
  const CHUNK = 500;
  const byValue = new Map();
  for (const c of changes) {
    if (!byValue.has(c.accounting_basis)) byValue.set(c.accounting_basis, []);
    byValue.get(c.accounting_basis).push(c.id);
  }
  let written = 0;
  for (const [value, ids] of byValue) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = ids.slice(i, i + CHUNK);
      const { error } = await client
        .schema('treasury').from('budgets')
        .update({ accounting_basis: value }).in('id', batch);
      if (error) throw new Error(`stamp ${value} batch at ${i}: ${error.message}`);
      written += batch.length;
    }
    console.log(`  ${value.padEnd(16)} ${ids.length} row(s)`);
  }
  console.log(`\n${written.toLocaleString()} row(s) stamped.`);
}

if (import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href
    || process.argv[1]?.endsWith('stampAccountingBasis.mjs')) {
  await main();
}
