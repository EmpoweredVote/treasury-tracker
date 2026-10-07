#!/usr/bin/env node
/**
 * SCOPE-01 Task 5 — stamp `fund_scope` onto treasury.budgets from the registry.
 *
 * Reads every DISTINCT `data_source` in the table, runs each through
 * `classify()` against `scripts/data/fundScopeRegistry.mjs`, and writes the
 * resulting scope in bulk per registry entry. Classification is per SOURCE, so
 * the unit of work is a data_source string, never a row.
 *
 * ── THE PARTITION GATE ──────────────────────────────────────────────────────
 * Before writing anything, this asserts the registry's patterns claim EXACTLY the
 * row counts Task 1 measured (SCOPE-01-RECON.md §1.2) and that
 * claimed + unknown = the table total. A pattern claiming MORE than Task 1
 * recorded is over-matching: fix the pattern, never accept the count. `--force`
 * exists only so a deliberate, explained registry change can proceed, and it
 * prints what it is overriding.
 *
 * It also reports strings matched by more than one entry. `classify()` takes the
 * first match, so an overlap is not a double-count -- but it means one entry is
 * silently shadowing another, which is a design smell worth surfacing.
 *
 * ── SAFETY ──────────────────────────────────────────────────────────────────
 * Writes ONE column. Never touches total_budget, categories or line items --
 * `scripts/verify-fund-scope.mjs` proves that against the digest committed at
 * Task 3. Idempotent: re-running produces the same state. Reversible with
 * `--reset`, which sets every row back to 'unknown'.
 *
 * Usage:
 *   node scripts/classifyFundScope.mjs --dry-run     # tally only, no writes
 *   node scripts/classifyFundScope.mjs               # classify
 *   node scripts/classifyFundScope.mjs --reset       # back to all-unknown
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (source .env first).
 */

import { parseArgs } from 'node:util';
import { classify, validateRegistry, checkPartition, SCOPE, SCOPE_VALUES } from './lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from './data/fundScopeRegistry.mjs';
import { EXPECTED_ROWS } from './data/fundScopeExpectations.mjs';


/** Batch size for `data_source IN (...)` updates — 1,448 strings is one family. */
const IN_CHUNK = 200;

let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env). Use --dry-run for a no-write pass.');
    process.exit(1);
  }
  _supabase = createClient(url, key);
  return _supabase;
}

/** Every distinct data_source with its row count. Paged — the table is ~80k rows. */
async function fetchSourceCounts(supabase) {
  const counts = new Map();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .schema('treasury').from('budgets')
      .select('data_source')
      .order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch data_source: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) counts.set(r.data_source, (counts.get(r.data_source) ?? 0) + 1);
    if (data.length < PAGE) break;
  }
  return counts;
}

/** Which entries match this string at all (not just the winning one). */
function allMatches(dataSource, registry) {
  const hits = [];
  for (const e of registry) {
    if (!e?.match || typeof e.match.test !== 'function') continue;
    try {
      if (e.match.test(dataSource)) hits.push(e.id);
    } catch { /* a throwing pattern blocks its own family; classify() reports unknown */ }
  }
  return hits;
}

/** Group distinct sources by the entry that claims them. */
export function plan(sourceCounts, registry) {
  const byEntry = new Map();  // entryId -> {scope, sources:[], rows}
  const unknownSources = [];
  let unknownRows = 0;
  const overlaps = [];

  for (const [src, rows] of sourceCounts) {
    const { scope, entryId } = classify(src, registry);
    const hits = allMatches(src, registry);
    if (hits.length > 1) overlaps.push({ src, hits, rows });

    if (entryId === null) {
      unknownSources.push(src);
      unknownRows += rows;
      continue;
    }
    if (!byEntry.has(entryId)) byEntry.set(entryId, { scope, sources: [], rows: 0 });
    const g = byEntry.get(entryId);
    g.sources.push(src);
    g.rows += rows;
  }
  return { byEntry, unknownSources, unknownRows, overlaps };
}

async function updateScope(supabase, sources, scope) {
  let written = 0;
  for (let i = 0; i < sources.length; i += IN_CHUNK) {
    const chunk = sources.slice(i, i + IN_CHUNK);
    const { error, count } = await supabase
      .schema('treasury').from('budgets')
      .update({ fund_scope: scope }, { count: 'exact' })
      .in('data_source', chunk);
    if (error) throw new Error(`update ${scope}: ${error.message}`);
    written += count ?? 0;
  }
  return written;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      reset: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      only: { type: 'string' },
    },
  });

  const reg = validateRegistry(FUND_SCOPE_REGISTRY);
  if (!reg.ok) {
    console.error('REGISTRY INVALID — refusing to classify:', JSON.stringify(reg, null, 2));
    process.exit(1);
  }
  console.log(`registry: ${FUND_SCOPE_REGISTRY.length} entries, all evidenced ✅`);

  const supabase = await getSupabase();

  if (values.reset) {
    const { error, count } = await supabase
      .schema('treasury').from('budgets')
      .update({ fund_scope: SCOPE.UNKNOWN }, { count: 'exact' })
      .neq('fund_scope', SCOPE.UNKNOWN);
    if (error) throw new Error(`reset: ${error.message}`);
    console.log(`reset ${count} rows to '${SCOPE.UNKNOWN}'`);
    return;
  }

  const sourceCounts = await fetchSourceCounts(supabase);
  const totalRows = [...sourceCounts.values()].reduce((a, b) => a + b, 0);
  console.log(`read ${sourceCounts.size} distinct data_source strings over ${totalRows.toLocaleString()} rows`);

  const p = plan(sourceCounts, FUND_SCOPE_REGISTRY);
  const only = values.only ?? null;
  const check = checkPartition(p, totalRows, { only, expected: EXPECTED_ROWS });

  console.log('\n── per-entry claim vs Task 1 ──');
  for (const [id, g] of [...p.byEntry].sort((a, b) => b[1].rows - a[1].rows)) {
    const want = EXPECTED_ROWS[id];
    const mark = g.rows === want ? '✅' : '❌';
    console.log(`  ${mark} ${id.padEnd(20)} ${g.scope.padEnd(20)} ${String(g.rows).padStart(6)} rows (expected ${want ?? '?'})  ${g.sources.length} strings`);
  }
  console.log(`     ${'unknown'.padEnd(20)} ${''.padEnd(20)} ${String(p.unknownRows).padStart(6)} rows                     ${p.unknownSources.length} strings`);
  console.log(`  claimed ${check.claimed.toLocaleString()} + unknown ${p.unknownRows.toLocaleString()} = ${(check.claimed + p.unknownRows).toLocaleString()} / ${totalRows.toLocaleString()}`);

  if (check.deferred?.length) {
    console.warn(`\n⚠ ${check.deferred.length} partition problem(s) NOT involving --only "${only}" — DEFERRED, NOT FIXED:`);
    for (const m of check.deferred) console.warn(`   - ${m}`);
    console.warn('   These still need adjudicating. --only writes ONE entry; it does not excuse them.');
  }

  if (!check.ok) {
    console.error('\n❌ PARTITION GATE FAILED:');
    for (const m of check.problems) console.error(`   - ${m}`);
    if (!values.force) {
      console.error('\nRefusing to write. Fix the patterns, or re-run with --force if the change is deliberate and explained in SCOPE-01-RECON.md.');
      process.exit(1);
    }
    console.error('\n⚠ --force given; writing anyway. The overrides above must be explained in the recon document.');
  } else {
    console.log(only
      // ⚠ Say what was actually checked. The unscoped sentence would claim the
      // whole table is sound while six entries above are printed as broken.
      ? `\n✅ partition gate (scoped): "${only}" claims exactly what Task 1 measured and is in no overlap. `
        + 'The deferred problems above are UNRESOLVED — this is not a whole-table pass.'
      : '\n✅ partition gate: every entry claims exactly what Task 1 measured, nothing double-claimed, nothing lost');
  }

  if (values['dry-run']) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  console.log(`\n── writing ${only ? `(--only ${only})` : ''} ──`);
  let total = 0;
  for (const [id, g] of p.byEntry) {
    if (only && id !== only) continue;
    const n = await updateScope(supabase, g.sources, g.scope);
    total += n;
    console.log(`  ${id.padEnd(20)} -> ${g.scope.padEnd(20)} ${String(n).padStart(6)} rows`);
  }
  console.log(`  ${total.toLocaleString()} rows stamped`);

  const tally = new Map();
  for (const s of SCOPE_VALUES) tally.set(s, 0);
  for (const [, g] of p.byEntry) tally.set(g.scope, tally.get(g.scope) + g.rows);
  tally.set(SCOPE.UNKNOWN, p.unknownRows);
  console.log('\n── expected tally (verify in SQL) ──');
  for (const [s, n] of [...tally].sort((a, b) => b[1] - a[1])) {
    if (n) console.log(`  ${s.padEnd(20)} ${String(n).padStart(6)} (${(n / totalRows * 100).toFixed(1)}%)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('classifyFundScope.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
