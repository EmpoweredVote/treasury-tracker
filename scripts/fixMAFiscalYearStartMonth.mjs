#!/usr/bin/env node
/**
 * Correct `fiscal_year_start_month` for Massachusetts localities, which run
 * JULY–JUNE by statute but whose rows claimed JANUARY: 1 -> 7.
 *
 *     treasury.budgets        16,839 rows   356 entities   FY2002–FY2026
 *     treasury.data_sources    1,409 rows   356 entities
 *
 * The statutes, the county charter checks, the Cambridge dataset check and all
 * the classification guards live in — and are tested through — the library:
 *
 *     scripts/lib/maFiscalCalendar.mjs
 *     tests/maFiscalCalendar.test.mjs
 *
 * This file is only the I/O around it. It moves no dollar figure, and proves it.
 *
 * ⚠ TWO TABLES, AND THE ORDER MATTERS. `treasury_sync_budget_tree` copies the
 * month FROM `data_sources` INTO `budgets`, so correcting `budgets` alone leaves
 * a loaded gun: the next `loadMaGFExcel.js` run writes 1 straight back. Sources
 * are swept FIRST, so that at no point is the source table more wrong than the
 * budget table it feeds.
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Every row is joined to its municipality so it carries
 *       {name,state,entity_type}. Scope is decided per entity, never per label.
 *   (b) READ FULLY, THEN WRITE. Never interleaved: paging a table while it is
 *       being written double-counts and invents drift that looks exactly like a
 *       stale baseline (auto-memory reference_paged_reads_need_total_order).
 *       Every paged read orders by the PRIMARY KEY LAST for a total order.
 *   (c) Batched updates re-assert the old value and require the affected count
 *       to equal the batch size, so a concurrent writer cannot be silently
 *       clobbered and a partial write cannot pass.
 *   (d) THE COMMONWEALTH'S OWN ROWS ARE ASSERTED UNCHANGED, not merely skipped.
 *       MA has no charter carve-out to protect — § 56A forecloses it — so the
 *       thing that could go wrong is the opposite one: over-reach into the state
 *       node. Its 42 rows are counted before and after and must be identical.
 *   (e) NO FIGURE MOVED. An md5 over (id, total_budget) for every MA budget row
 *       is taken before and after and must match exactly. The month moves no
 *       money, so any change to this digest means the sweep touched the wrong
 *       column — the arc's recurring lesson is that a $0 tie proves nothing on
 *       its own, so this is the independent oracle.
 *
 * Usage:
 *   node scripts/fixMAFiscalYearStartMonth.mjs            # dry run (default)
 *   node scripts/fixMAFiscalYearStartMonth.mjs --apply
 *   node scripts/fixMAFiscalYearStartMonth.mjs --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  CORRECT_MONTH, DEFAULT_MONTH, FAMILIES, SOURCE_FAMILIES,
  SWEEP_ROWS, SWEEP_SOURCE_ROWS,
  classify, classifySource, familyFor,
} from './lib/maFiscalCalendar.mjs';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
);

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent is fine */ }
  }
}
loadEnv();

const PAGE = 1000;
const BATCH = 250;
const ID_CHUNK = 40;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Every MA municipality, keyed by id. */
async function loadMAEntities(db) {
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('municipalities')
      .select('id, name, state, entity_type')
      .eq('state', 'MA')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('FATAL: municipalities read failed:', error.message); process.exit(1); }
    for (const m of data ?? []) {
      map.set(m.id, { name: m.name, state: m.state, entity_type: m.entity_type });
    }
    if (!data || data.length < PAGE) break;
  }
  return map;
}

/**
 * Guard (b). Read every budget row for the given municipalities, in id chunks so
 * the `in` list stays a sane URL length, paging each chunk to exhaustion.
 */
async function readBudgets(db, entities) {
  const ids = [...entities.keys()];
  const rows = [];
  for (const ids_ of chunk(ids, ID_CHUNK)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('budgets')
        .select('id, municipality_id, fiscal_year, dataset_type, data_source, total_budget, fiscal_year_start_month')
        .in('municipality_id', ids_)
        .order('municipality_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { console.error('FATAL: budgets read failed:', error.message); process.exit(1); }
      for (const r of data ?? []) rows.push({ ...r, entity: entities.get(r.municipality_id) });
      if (!data || data.length < PAGE) break;
    }
  }
  return rows;
}

async function readSources(db, entities) {
  const ids = [...entities.keys()];
  const rows = [];
  for (const ids_ of chunk(ids, ID_CHUNK)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('data_sources')
        .select('id, municipality_id, name, api_type, dataset_type, fiscal_year_start_month')
        .in('municipality_id', ids_)
        .order('municipality_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { console.error('FATAL: data_sources read failed:', error.message); process.exit(1); }
      for (const r of data ?? []) rows.push({ ...r, entity: entities.get(r.municipality_id) });
      if (!data || data.length < PAGE) break;
    }
  }
  return rows;
}

/**
 * Guard (e). Stable digest over (id, total_budget) for every MA budget row.
 * Sorted by id so it is independent of read order and of paging.
 */
function figureDigest(rows) {
  const h = crypto.createHash('md5');
  for (const r of [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    h.update(`${r.id}:${r.total_budget}\n`);
  }
  return h.digest('hex');
}

async function updateMonth(db, table, ids, label) {
  let written = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const c = ids.slice(i, i + BATCH);
    const { data, error } = await db
      .from(table)
      .update({ fiscal_year_start_month: CORRECT_MONTH })
      .in('id', c)
      .eq('fiscal_year_start_month', DEFAULT_MONTH)   // guard (c)
      .select('id');
    if (error) { console.error(`FATAL: ${label} batch at ${i} failed: ${error.message}`); process.exit(1); }
    if (!data || data.length !== c.length) {
      console.error(`FATAL: ${label} batch at ${i} updated ${data?.length ?? 0} of ${c.length} rows. `
        + 'Something else is writing this column — stopping so the damage is bounded.');
      process.exit(1);
    }
    written += data.length;
    if (written % 2500 === 0 || written === ids.length) console.log(`  ${label} ${written}/${ids.length}`);
  }
  return written;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const verifyOnly = argv.includes('--verify');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('FATAL: SUPABASE_URL and a service key must be set (.env)');
    process.exit(1);
  }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  const entities = await loadMAEntities(db);
  console.log(`MA entities: ${entities.size}`);

  // Guard (b): both tables read to exhaustion before anything is written.
  const budgetRows = await readBudgets(db, entities);
  const sourceRows = await readSources(db, entities);
  const digestBefore = figureDigest(budgetRows);

  // ── Guard (d): the Commonwealth's own rows, counted before ────────────────
  const stateRows = budgetRows.filter((r) => r.entity?.entity_type === 'state');
  const stateMonths = [...new Set(stateRows.map((r) => Number(r.fiscal_year_start_month)))].sort();

  // ── budgets ──────────────────────────────────────────────────────────────
  const updates = [];
  const errors = [];
  let alreadyCorrect = 0;
  let outOfScope = 0;
  const perFamily = new Map(FAMILIES.map((f) => [f.key, { updates: 0, correct: 0, sources: new Set(), entities: new Set() }]));

  for (const r of budgetRows) {
    // Out-of-scope entity types are the caller's decision, made here and counted,
    // never swallowed inside classify — classify treats them as an abort.
    if (r.entity?.entity_type === 'state') { outOfScope += 1; continue; }
    const fam = familyFor(r.data_source);
    if (!fam || fam.ambiguous) {
      errors.push(`FY${r.fiscal_year} ${r.entity?.name}: ${fam?.ambiguous
        ? `ambiguous family (${fam.ambiguous.join(', ')})` : `unknown data_source "${r.data_source}"`}`);
      continue;
    }
    const c = classify(r);
    const acc = perFamily.get(fam.key);
    if (c.error) errors.push(`FY${r.fiscal_year} ${r.entity?.name}: ${c.error}`);
    else if (c.action === 'update') {
      updates.push(r); acc.updates += 1; acc.sources.add(r.data_source); acc.entities.add(r.municipality_id);
    } else { acc.correct += 1; alreadyCorrect += 1; }
  }

  // ⚠ After a successful sweep the number that should equal the baseline is the
  // ALREADY-CORRECT count, not the change count — comparing `updates` in both
  // modes prints "⚠ baseline" on a healthy verify and reads as a failure.
  for (const f of FAMILIES) {
    const a = perFamily.get(f.key);
    const measured = verifyOnly ? a.correct : a.updates;
    console.log(`\n${f.key}   [${f.kind}] ${f.kind === 'regex' ? String(f.pattern) : `"${f.pattern}"`}`);
    console.log(`    authority   ${f.authority}`);
    console.log(`    need ${DEFAULT_MONTH} -> ${CORRECT_MONTH}   ${a.updates}`);
    console.log(`    already ${CORRECT_MONTH}     ${a.correct}`);
    console.log(`    ${verifyOnly ? 'at 7' : 'to change'} vs baseline ${f.rows}   `
      + (measured === f.rows ? '(matches)' : `⚠ MEASURED ${measured}`));
    // The source/entity census is only meaningful over the rows being changed,
    // which is empty once the sweep has run.
    if (!verifyOnly) {
      console.log(`    distinct sources ${a.sources.size} (baseline ${f.sources})   `
        + `entities ${a.entities.size} (baseline ${f.entities})`);
    }
  }

  // ── data_sources ─────────────────────────────────────────────────────────
  const srcUpdates = [];
  let srcCorrect = 0;
  const perApi = new Map(SOURCE_FAMILIES.map((f) => [f.apiType, { updates: 0, correct: 0, entities: new Set() }]));
  for (const r of sourceRows) {
    if (r.entity?.entity_type === 'state') { outOfScope += 1; continue; }
    const c = classifySource(r);
    if (c.error) { errors.push(`data_source "${r.name}" (${r.api_type}): ${c.error}`); continue; }
    const acc = perApi.get(r.api_type);
    if (c.action === 'update') { srcUpdates.push(r); acc.updates += 1; acc.entities.add(r.municipality_id); }
    else { acc.correct += 1; srcCorrect += 1; }
  }
  console.log('\ndata_sources');
  for (const f of SOURCE_FAMILIES) {
    const a = perApi.get(f.apiType);
    const measured = verifyOnly ? a.correct : a.updates;
    console.log(`    ${f.apiType.padEnd(14)} need ${DEFAULT_MONTH} -> ${CORRECT_MONTH} ${String(a.updates).padStart(4)}`
      + `   already ${CORRECT_MONTH} ${String(a.correct).padStart(4)}`
      + `   vs baseline ${f.rows} ${measured === f.rows ? '(matches)' : `⚠ MEASURED ${measured}`}`
      + `   — ${f.why}`);
  }

  const bMeasured = verifyOnly ? alreadyCorrect : updates.length;
  const sMeasured = verifyOnly ? srcCorrect : srcUpdates.length;
  console.log(`\nbudgets  to change ${updates.length}   `
    + `${verifyOnly ? 'at 7' : 'to change'} vs baseline ${SWEEP_ROWS} `
    + (bMeasured === SWEEP_ROWS ? '(matches)' : `⚠ MEASURED ${bMeasured}`));
  console.log(`sources  to change ${srcUpdates.length}   `
    + `${verifyOnly ? 'at 7' : 'to change'} vs baseline ${SWEEP_SOURCE_ROWS} `
    + (sMeasured === SWEEP_SOURCE_ROWS ? '(matches)' : `⚠ MEASURED ${sMeasured}`));
  console.log(`already ${CORRECT_MONTH}          budgets ${alreadyCorrect}   sources ${srcCorrect}`);
  console.log(`out of scope (state) ${outOfScope}`);
  console.log(`figure digest      ${digestBefore}`);
  console.log(`errors             ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log(`    ! ${e}`);
  if (errors.length > 20) console.log(`    ... and ${errors.length - 20} more`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  // Guard (d), pre-flight. The Commonwealth must be present and already at 7. If
  // the state node stopped matching (renamed, retyped) the sweep would be free to
  // reach it, so an absent or mis-valued state node is a failure, not a pass.
  if (stateRows.length === 0) {
    console.error('\nABORT: expected the Massachusetts state node among MA rows and saw none. '
      + 'Scope cannot be confirmed — nothing written.');
    process.exit(1);
  }
  if (stateMonths.length !== 1 || stateMonths[0] !== CORRECT_MONTH) {
    console.error(`\nABORT: the state node's ${stateRows.length} rows read months `
      + `[${stateMonths.join(', ')}], expected exactly [${CORRECT_MONTH}]. Nothing written.`);
    process.exit(1);
  }
  console.log(`state node OK      ${stateRows.length} rows, all at ${CORRECT_MONTH}, untouched by scope`);

  if (verifyOnly) {
    if (updates.length || srcUpdates.length) {
      console.error(`\nVERIFY FAILED: ${updates.length} budget row(s) and ${srcUpdates.length} `
        + `data_source row(s) still at ${DEFAULT_MONTH}.`);
      process.exit(1);
    }
    console.log(`\nVERIFY OK: every in-scope MA row at ${CORRECT_MONTH}; `
      + `${stateRows.length} Commonwealth row(s) untouched.`);
    return;
  }

  if (!updates.length && !srcUpdates.length) { console.log('\nNothing to do.'); return; }
  if (!apply) { console.log('\nDRY RUN — pass --apply to write.'); return; }

  // ⚠ SOURCES FIRST. See the header: budgets-first would leave a window in which
  // the source table is still wrong and a concurrent load re-asserts 1.
  const srcWritten = await updateMonth(db, 'data_sources', srcUpdates.map((r) => r.id), 'data_sources');
  const written = await updateMonth(db, 'budgets', updates.map((r) => r.id), 'budgets');

  // Guard (e): re-read and prove no figure moved.
  const after = await readBudgets(db, entities);
  const digestAfter = figureDigest(after);
  console.log(`\nfigure digest before ${digestBefore}`);
  console.log(`figure digest after  ${digestAfter}`);
  if (digestBefore !== digestAfter) {
    console.error('FATAL: the (id, total_budget) digest CHANGED. A dollar figure moved — '
      + 'this sweep must only touch fiscal_year_start_month. Investigate before doing anything else.');
    process.exit(1);
  }
  const stillWrong = after.filter((r) => r.entity?.entity_type !== 'state'
    && Number(r.fiscal_year_start_month) === DEFAULT_MONTH).length;
  const stateAfter = after.filter((r) => r.entity?.entity_type === 'state');
  if (stateAfter.length !== stateRows.length) {
    console.error(`FATAL: the Commonwealth had ${stateRows.length} rows and now has ${stateAfter.length}.`);
    process.exit(1);
  }

  console.log(`\nAPPLIED: ${srcWritten} data_source row(s) and ${written} budget row(s) `
    + `set to ${CORRECT_MONTH}. No figure moved. ${stillWrong} in-scope row(s) still at ${DEFAULT_MONTH}. `
    + 'Re-run with --verify.');
}

await main();
