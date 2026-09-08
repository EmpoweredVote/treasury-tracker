/**
 * The frozen-figure invariant's LIVE-SYNC scope, and the drift detector for it.
 *
 * NO SHEBANG — kept importable; tests/liveSyncExclusions.test.mjs imports it.
 *
 * Usage:
 *   node scripts/liveSyncExclusions.mjs --check    # report drift, write nothing
 *   node scripts/liveSyncExclusions.mjs --write    # re-snapshot the exclusion file
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The frozen digest hashes `(budget id | total_budget)` over every budget row not
 * explicitly excluded. That was only ever true of rows nothing can rewrite.
 *
 * It was recorded as a known risk at the v2.33 rebase, 2026-08-28, verbatim:
 *
 *   "…belong to ENABLED, cron-syncing sources. If an upstream publisher revises a
 *    figure, the sync rewrites total_budget and this digest moves with no human
 *    involved — a drift source no ledger can capture, because no person is there
 *    to record it. If that recurs, the fix is to scope the digest to rows NOT
 *    under live sync, which are the only ones 'frozen' meaningfully describes."
 *
 * It recurred on 2026-08-30 during Knight session 5: the digest was green at the
 * start of the session and moved before anything was written, with the row count
 * reconciling. Four enabled sources had cron-synced in between. **It could not be
 * attributed to a single row** — no per-row baseline exists and `budgets.updated_at`
 * is not stamped by `treasury_sync_city_budget` — which is exactly the failure the
 * note predicted. This is that fix.
 *
 * ── ⚠⚠ THE JOIN IS THE TEXT COLUMN, NOT `data_source_id` ────────────────────
 *
 * Measured 2026-08-30: **`data_source_id` links ZERO budget rows to an enabled
 * source.** Only 984 of 88,354 rows carry one at all (1.1%), and none of those
 * point at an enabled source. The real link is `budgets.data_source` (text)
 * matching `data_sources.name`.
 *
 * This is the same 1.1% that forced `audit_grade` to live per-row rather than on
 * `data_sources`. Anything reasoning about "which source owns this row" must use
 * the text column or it silently matches nothing — and a filter that matches
 * nothing looks exactly like a filter that found nothing to do.
 *
 * ── ⚠⚠ WHY THE BROAD DEFINITION, AND NOT `fiscal_years.slice(-2)` ───────────
 *
 * The cron orchestrator only re-syncs the last two fiscal years per source
 * (`supabase/functions/treasury-sync-orchestrator/index.ts:127`), so a narrower
 * rule was measured: 1,069 rows at risk instead of 17,262, keeping far more of
 * the table genuinely frozen. **It was rejected on two grounds, both measured:**
 *
 *   1. It does not cover the observed drift. Of the seven candidate rows from the
 *      2026-08-30 incident, the broad rule covers 7 and the narrow rule covers 6 —
 *      it misses `LA City Checkbook FY2024`, because that source's `fiscal_years`
 *      ends 2026 so FY2024 falls outside the slice. A fix that does not cover the
 *      event that prompted it is not a fix.
 *   2. `fiscal_years` IS MUTABLE. Membership keyed on it changes whenever a
 *      publisher adds a year — the "a new year arrives" hazard that has already
 *      bitten San Francisco. That would put the frozen set itself back under
 *      silent, human-free change, one level up from the problem being solved.
 *
 * `is_enabled` is a single stable flag. The honest statement is the one the v2.33
 * note made: frozen means **not under any live sync.**
 *
 * ── ⚠ THE COST IS REAL AND IS NOT HIDDEN ────────────────────────────────────
 *
 * 1,808 of 1,814 sources are enabled, so this removes **17,262 of 79,916 rows
 * (21.6%)** from the digest. ⚠ The v2.33 note estimated 7,688 / 72,228 remaining;
 * that did not reproduce — it was a MEASUREMENT WITH A DATE, not a constant, the
 * same lesson the `basis` partition count taught in session 2. Re-measure, never
 * carry the number forward.
 *
 * A digest over rows that can move without a human is not an invariant. Covering
 * fewer rows honestly beats covering more of them falsely.
 *
 * ── ⚠⚠ IT IS A SNAPSHOT, DELIBERATELY — NOT A LIVE PREDICATE ────────────────
 *
 * The exclusion is materialised into a repo JSON file and mirrored into
 * `treasury.frozen_excluded_ids`, exactly like every other exclusion. It is NOT
 * evaluated live inside the SQL function, because a live predicate would let
 * toggling `is_enabled` on any source move the digest with no commit — the same
 * class of silent movement this fix exists to end. The repo stays the source of
 * truth, and re-scoping requires a commit.
 *
 * The cost of a snapshot is that a source ENABLED LATER has rows still inside the
 * digest that can now drift. That is what `--check` is for: it names them in
 * seconds, instead of the hours the 2026-08-30 incident took to not-quite-attribute.
 */

import { readFileSync, writeFileSync } from 'node:fs';

export const EXCLUSION_FILE = 'scripts/data/liveSyncExcludedIds.json';
const BASELINE = 'scripts/data/scopeBaseline.json';

/**
 * Page every row of a table.
 * ⚠ Ordered by the primary key LAST so the window is a total order — an unstable
 * sort silently drops and repeats rows across pages
 * (`reference_paged_reads_need_total_order`).
 */
export async function pageAll(client, table, select) {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await client.schema('treasury').from(table)
      .select(select).order('id', { ascending: true }).range(from, from + size - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < size) break;
  }
  // ⚠⚠ The cheap guard for the defect this repo has hit FOUR times: an unstable
  // or unpaged window silently drops and repeats rows, and the result still looks
  // like a plausible list. Distinct ids must equal the row count.
  const ids = new Set(out.map((r) => r.id));
  if (ids.size !== out.length) {
    throw new Error(`PAGING DEFECT in ${table}: ${out.length} rows but ${ids.size} distinct ids`);
  }
  return out;
}

/**
 * Which budget rows belong to a source that can rewrite them?
 *
 * Pure, so it is testable without a database.
 *
 * ── ⚠⚠ THE NAME MATCH ALONE WAS NOT THE REWRITE SURFACE (v2.36, 2026-09-07) ─
 *
 * The original rule was `budgets.data_source === data_sources.name`. It reported
 * **0 unprotected** on the morning a row demonstrably moved, twice:
 *
 *   * v2.35: ten legacy Indiana rows carried the bare string `Indiana Gateway`
 *     while their owning sources were named `… Budget & Disbursements`.
 *   * This fix: **Bloomington, IN FY2025 `salaries`** is written EVERY WEEK by
 *     `Bloomington Annual Compensation` (proved from `treasury.sync_logs`:
 *     1,440 rows fetched and inserted every Sunday) while the row is labelled
 *     `data/checkbook-all.csv`. The name join cannot see it.
 *
 * ⚠⚠ THE CAUSE IS IN THE RPC. `public.treasury_sync_city_budget` finds its row by
 * (municipality, fiscal_year, dataset_type, fund_scope, basis) — NEVER by
 * data_source — and its update path is:
 *
 *     UPDATE treasury.budgets
 *        SET total_budget = p_total,
 *            source_url   = COALESCE(p_source_url, source_url),
 *            source_date  = COALESCE(p_source_date, source_date)
 *      WHERE id = v_budget_id;
 *
 * It rewrites `total_budget` and leaves `data_source` and `hierarchy` exactly as
 * first written. So a row's LABEL is not evidence of which feed sets its VALUE,
 * and any rule keyed on the label is blind by construction.
 *
 * ── THE RULE IS A UNION, AND DELIBERATELY SO ────────────────────────────────
 *
 * A row is under live sync if EITHER holds:
 *   (a) its `data_source` names an enabled source          — the original rule
 *   (b) an enabled source on the SAME municipality declares that fiscal_year
 *       and writes that dataset_type                       — the rewrite surface
 *
 * ⚠ Measured 2026-09-07: (a) 17,243 rows · (b) 17,324 · union 17,340. **(a) is
 * NOT a subset of (b)** — 16 rows match only by name, because a source can carry
 * rows for a year it no longer declares (`LA City Payroll` salaries FY2017-2020,
 * several MA DLS revenue rows). Replacing rather than unioning would have SILENTLY
 * DROPPED those 16 from the scope. A rule change here must only ever widen.
 *
 * ⚠ Rule (b) reads `fiscal_years`, which the header rejects for NARROWING because
 * it is mutable. Widening is the safe direction, and this stays a SNAPSHOT — a
 * publisher adding a year cannot move the digest until someone re-snapshots and
 * commits, and `--check` names the drift meanwhile.
 *
 * ⚠ A source with NO `dataset_type` could write anything, so it widens to the
 * whole (municipality, year) rather than being skipped. Measured 2026-09-07: 0 of
 * 1,799 enabled sources lack one, but a gate must not depend on that staying true.
 */
export function liveSyncRowIds(budgets, sources) {
  const enabled = sources.filter((s) => s.is_enabled);
  const byName = new Set(enabled.map((s) => s.name));
  const surface = new Set();
  for (const s of enabled) {
    if (!s.municipality_id) continue;
    for (const y of s.fiscal_years ?? []) {
      surface.add(`${s.municipality_id}|${Number(y)}|${s.dataset_type || '*'}`);
    }
  }
  const rewritable = (b) => surface.has(`${b.municipality_id}|${Number(b.fiscal_year)}|${b.dataset_type}`)
    || surface.has(`${b.municipality_id}|${Number(b.fiscal_year)}|*`);
  return budgets
    .filter((b) => (b.data_source && byName.has(b.data_source)) || rewritable(b))
    .map((b) => b.id);
}

/** Ids currently excluded for any reason, read from the repo — the source of truth. */
export function repoExcludedIds(baseline, read = (f) => readFileSync(f, 'utf8')) {
  return new Set((baseline.excluded_ids_files ?? [])
    .flatMap((f) => JSON.parse(read(f))));
}

export async function collect(client) {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  // ⚠ municipality_id, fiscal_years, dataset_type and dataset_type on the rows are
  // all needed by rule (b) in liveSyncRowIds. Selecting too few columns here is how
  // that rule would silently match nothing.
  const sources = await pageAll(client, 'data_sources',
    'id,name,is_enabled,sync_frequency,municipality_id,fiscal_years,dataset_type');
  const budgets = await pageAll(client, 'budgets',
    'id,data_source,fiscal_year,municipality_id,dataset_type');
  const excluded = repoExcludedIds(baseline);
  const live = new Set(liveSyncRowIds(budgets, sources));
  const frozen = budgets.filter((b) => !excluded.has(b.id));
  // Rows inside the digest that a live sync can still rewrite. After the fix this
  // must be 0; anything else means a source was enabled since the last snapshot.
  const unprotected = frozen.filter((b) => live.has(b.id));
  return { baseline, sources, budgets, excluded, live, frozen, unprotected };
}

function report(r) {
  const enabled = r.sources.filter((s) => s.is_enabled).length;
  console.log(`data_sources      : ${r.sources.length} (${enabled} enabled)`);
  console.log(`budget rows       : ${r.budgets.length}`);
  console.log(`already excluded  : ${r.excluded.size}`);
  console.log(`frozen set        : ${r.frozen.length}`);
  console.log(`under live sync   : ${r.live.size}`);
  console.log(`\nUNPROTECTED — inside the digest AND rewritable by a live sync: ${r.unprotected.length}`);
  if (r.unprotected.length) {
    const by = {};
    for (const b of r.unprotected) by[b.data_source] = (by[b.data_source] ?? 0) + 1;
    const top = Object.entries(by).sort((a, b) => b[1] - a[1]);
    console.log(`  across ${top.length} source(s); largest:`);
    for (const [name, n] of top.slice(0, 10)) console.log(`    ${String(n).padStart(6)}  ${name}`);
    if (top.length > 10) console.log(`    … and ${top.length - 10} more`);
  }
  return r.unprotected.length;
}

export async function main() {
  const check = process.argv.includes('--check');
  const write = process.argv.includes('--write');
  if (!check && !write) {
    console.error('Pass --check or --write.');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // ⚠ A check that cannot reach its source must not look like a clean pass.
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so nothing was checked.');
    process.exit(2);
  }
  const r = await collect(createClient(url, key));
  const n = report(r);

  if (write) {
    // Snapshot EVERY live-sync row id, not just the unprotected ones, so the file
    // is a complete statement of the scope rather than a running diff.
    const ids = [...r.live].sort();
    writeFileSync(EXCLUSION_FILE, `${JSON.stringify(ids, null, 2)}\n`);
    console.log(`\nwrote ${ids.length} id(s) to ${EXCLUSION_FILE}`);
    if (!(r.baseline.excluded_ids_files ?? []).includes(EXCLUSION_FILE)) {
      console.log(`⚠ NOT yet registered. Add "${EXCLUSION_FILE}" to excluded_ids_files in`);
      console.log('  scopeBaseline.json, then: node scripts/syncFrozenInvariantState.mjs');
    }
    return;
  }

  if (n > 0) {
    console.error('\n✗ The digest covers rows a live sync can rewrite. Re-snapshot:');
    console.error('    node scripts/liveSyncExclusions.mjs --write');
    console.error('  then re-sync the mirror and re-baseline. A source was enabled since');
    console.error('  the last snapshot, so the invariant can move with no human involved.');
    process.exit(1);
  }
  console.log('\n✅ every row in the digest is beyond the reach of a live sync.');
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('liveSyncExclusions.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
