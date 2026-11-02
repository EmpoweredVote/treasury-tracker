#!/usr/bin/env node
/**
 * Capture the VA revenue rows' CURRENT figures into scripts/data/figureChanges.json,
 * so the frozen invariant keeps verifying across the Exhibit B-1 load.
 *
 * (Shebang is correct HERE — entry point with a main guard.)
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * All 304 VA revenue rows are INSIDE the frozen set (measured: 0 excluded, 0
 * already in the ledger). Loading Exhibit B-1 changes every one of their
 * `total_budget` values — by +14.8% to +263.1% — and `figures_frozen` is
 * sha256 over (id | total_budget) for exactly those rows. So the load moves the
 * digest, and that is the invariant doing its job: a published figure is
 * changing and somebody has to say so on the record.
 *
 * `treasury.frozen_figure_ledger` is the sanctioned way to say it. The digest
 * reads `coalesce(l.old_value, b.total_budget::text, '~')`, so a ledger entry
 * holding the value a row USED to carry keeps 62,587 / 60098de6 verifying while
 * the row itself tells the truth. checkFrozenInvariant.mjs names this file:
 * "record it in scripts/data/figureChanges.json with the value it replaced; the
 * digest then keeps verifying and no rebase is needed."
 *
 * ⚠⚠⚠ RUN THIS *BEFORE* THE LOAD. It records what is in the table right now.
 * Run it afterwards and it records the NEW figures as though they were the old
 * ones, which silently re-bases the invariant instead of documenting a change —
 * the exact thing scopeBaseline.json's _warning forbids. It refuses to
 * overwrite a non-empty file for that reason.
 *
 * ⚠⚠ THE VALUE MUST BE POSTGRES' OWN `total_budget::text`, NOT a JS number.
 * scopeBaseline.json records that PostgREST's JSON encoding drops numeric scale
 * (420993316.00 -> 420993316) and loses precision outright on at least one row
 * (316736239.26999999985 -> 316736239.27). A ledger value that round-tripped
 * through a JS float would be a different string and would not restore the
 * digest. The select below casts in the database and keeps the string.
 *
 * ── TWO PHASES, AND THEY RUN EITHER SIDE OF THE LOAD ────────────────────────
 *
 *   --capture      BEFORE the load. Records `old` — the figure being replaced.
 *   --record-new   AFTER  the load. Records `new` — the figure now stored.
 *
 * tests/frozenBaselineIntegrity.test.mjs requires BOTH on every entry, which is
 * the right shape: `old` is what keeps the digest verifying, and `new` is what
 * makes the entry auditable by someone who was not here. An entry with only
 * `old` holds the digest steady while saying nothing about what replaced it.
 *
 * ⚠ --record-new REFUSES an entry whose stored figure still equals `old`. That
 * would mean the load did not actually touch the row, and ledgering an
 * unchanged row is dead weight that hides a mistake.
 *
 * Usage:
 *   node scripts/captureVaRevenueFigureChanges.mjs --dry-run     # print only
 *   node scripts/captureVaRevenueFigureChanges.mjs               # phase 1: old
 *   node scripts/captureVaRevenueFigureChanges.mjs --record-new  # phase 2: new
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const OUT = 'scripts/data/figureChanges.json';
const DATA_SOURCE = 'Virginia APA Comparative Report';

/**
 * ⚠ ONE SHORT LINE, REPEATED 304 TIMES. The first draft of this string was a
 * full paragraph and produced a 220 KB committed artifact that was 90% the same
 * sentence. The reason belongs in the record once — SCOPE-01-RECON §4.9 and the
 * docstring above — and in the row only as a pointer to it.
 */
const WHY = 'Pre-Exhibit-B-1 "Total LOCAL Revenue"; row now carries Exhibit A '
  + '"Total Revenue". SCOPE-01-RECON §4.9.';

export async function capture({ dryRun = false } = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_KEY is not set');
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key);

  // ⚠ `total_budget::text` — cast in Postgres. See the warning above.
  // ⚠ Ordered by id and asserted DISTINCT: an unpaged read over this table has
  //   silently duplicated rows before (reference_paged_reads_need_total_order).
  const { data, error } = await supabase.schema('treasury')
    .from('budgets')
    .select('id, total_budget::text')
    .eq('data_source', DATA_SOURCE)
    .eq('dataset_type', 'revenue_local_only')
    .order('id')
    .limit(5000);
  if (error) throw new Error(`read failed: ${error.message}`);

  const ids = new Set(data.map((r) => r.id));
  if (ids.size !== data.length) {
    throw new Error(`paged read returned ${data.length} rows but only ${ids.size} distinct ids`);
  }
  if (data.some((r) => r.total_budget == null)) {
    throw new Error('a row has a NULL total_budget — the digest encodes those as "~", not a number');
  }

  const entries = data.map((r) => ({ id: r.id, old: r.total_budget, why: WHY }));

  if (dryRun) {
    console.log(`${entries.length} row(s); first: ${JSON.stringify(entries[0], null, 2)}`);
    return entries;
  }

  const existing = JSON.parse(readFileSync(OUT, 'utf8'));
  if (existing.length > 0) {
    throw new Error(
      `${OUT} already holds ${existing.length} entr(y/ies). Refusing to overwrite — merge by `
      + 'hand, and make sure you are not recording post-load figures as pre-load ones.');
  }

  writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`wrote ${entries.length} ledger entr(y/ies) to ${OUT}`);
  return entries;
}

/**
 * Phase 2 — fill in `new` from the table, after the load has run.
 *
 * ⚠ Reads `total_budget::text` for the same reason phase 1 does, and matches
 * the ledger by id so a row that moved between fiscal years or changed label
 * cannot be silently paired with the wrong figure.
 */
export async function recordNew({ dryRun = false } = {}) {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_KEY is not set');
  const supabase = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key);

  const entries = JSON.parse(readFileSync(OUT, 'utf8'));
  if (entries.length === 0) throw new Error(`${OUT} is empty — run the capture phase first`);

  const { data, error } = await supabase.schema('treasury')
    .from('budgets').select('id, total_budget::text')
    .eq('data_source', DATA_SOURCE).eq('dataset_type', 'revenue')
    .order('id').limit(5000);
  if (error) throw new Error(`read failed: ${error.message}`);
  const now = new Map(data.map((r) => [r.id, r.total_budget]));

  const missing = [];
  const unchanged = [];
  const out = entries.map((e) => {
    const n = now.get(e.id);
    if (n == null) { missing.push(e.id); return e; }
    if (n === e.old) { unchanged.push(e.id); return e; }
    return { ...e, new: n };
  });

  if (missing.length) {
    throw new Error(`${missing.length} ledgered id(s) are not in the table as 'revenue': `
      + `${missing.slice(0, 3).join(', ')}…`);
  }
  if (unchanged.length) {
    throw new Error(
      `${unchanged.length} ledgered row(s) still hold their OLD figure — the load did not `
      + `touch them: ${unchanged.slice(0, 3).join(', ')}…. Do not ledger an unchanged row.`);
  }

  if (dryRun) { console.log(`would record ${out.length} new value(s)`); return out; }
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`recorded ${out.length} new value(s) in ${OUT}`);
  return out;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('captureVaRevenueFigureChanges.mjs')) {
  const dryRun = process.argv.includes('--dry-run');
  if (process.argv.includes('--record-new')) await recordNew({ dryRun });
  else await capture({ dryRun });
}
