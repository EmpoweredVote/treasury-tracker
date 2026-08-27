#!/usr/bin/env node
/**
 * Correct the Town of Leonardtown, MD, which runs JULY–JUNE by its charter but
 * whose rows claimed JANUARY: 1 -> 7.
 *
 *     treasury.budgets         6 rows   FY2023–FY2025 (operating + revenue)
 *     treasury.data_sources    6 rows
 *     PROTECTED                8 rows   State of Maryland, already 7
 *
 * The evidence — Charter § 703 and the town's own budget book — and every
 * classification guard live in, and are tested through:
 *
 *     scripts/lib/leonardtownFiscalCalendar.mjs
 *     tests/leonardtownFiscalCalendar.test.mjs
 *
 * This file is only the I/O around it. It moves no dollar figure, and proves it.
 *
 * ⚠ THIS IS THE LAST OF THE `DEFAULT 1` POPULATION AND THE ONLY ONE OF THE FINAL
 * FOUR STATES THAT WAS ACTUALLY WRONG. Washington, Indiana and Colorado were all
 * already correct at 1 because their local governments really do run the calendar
 * year (PRs #77, #78). Maryland was the state I flagged as suspect rather than
 * probably-fine, and Leonardtown's charter puts it on July–June — so these rows
 * have been six months out, silently, because the column moves no dollar.
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Read on (name, state) = (Leonardtown, MD).
 *   (b) READ FULLY, THEN WRITE, ordering by the PRIMARY KEY last for a total
 *       order (auto-memory reference_paged_reads_need_total_order).
 *   (c) Batched updates re-assert the old value; affected must equal batch.
 *   (d) THE STATE OF MARYLAND IS ASSERTED UNCHANGED, not merely skipped — its 8
 *       rows must be found at 7 before and still at 7 after. Its correct month
 *       happens to equal this sweep's target, so a scope error against it would
 *       be INVISIBLE in the data; only an explicit count-and-compare catches it.
 *   (e) NO FIGURE MOVED. md5 over (id, total_budget) for every Maryland row,
 *       before and after, must match exactly.
 *
 * Usage:
 *   node scripts/fixLeonardtownFiscalYearStartMonth.mjs            # dry run
 *   node scripts/fixLeonardtownFiscalYearStartMonth.mjs --apply
 *   node scripts/fixLeonardtownFiscalYearStartMonth.mjs --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  ENTITY, CORRECT_MONTH, DEFAULT_MONTH, BASELINE, AUTHORITY, IN_SCOPE,
  classify, classifySource,
} from './lib/leonardtownFiscalCalendar.mjs';

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

async function pageAll(db, table, select, muniIds) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(select)
      .in('municipality_id', muniIds)
      .order('municipality_id', { ascending: true })
      .order('id', { ascending: true })              // guard (b): PK last
      .range(from, from + PAGE - 1);
    if (error) { console.error(`FATAL: ${table} read failed: ${error.message}`); process.exit(1); }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

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
    const { data, error } = await db.from(table)
      .update({ fiscal_year_start_month: CORRECT_MONTH })
      .in('id', c)
      .eq('fiscal_year_start_month', DEFAULT_MONTH)   // guard (c)
      .select('id');
    if (error) { console.error(`FATAL: ${label} batch at ${i} failed: ${error.message}`); process.exit(1); }
    if (!data || data.length !== c.length) {
      console.error(`FATAL: ${label} batch at ${i} updated ${data?.length ?? 0} of ${c.length}. `
        + 'Something else is writing this column — stopping so the damage is bounded.');
      process.exit(1);
    }
    written += data.length;
  }
  return written;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const verifyOnly = argv.includes('--verify');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('FATAL: SUPABASE_URL and a service key must be set'); process.exit(1); }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  // Every Maryland entity, so the state node can be asserted alongside the town.
  const { data: munis, error: mErr } = await db.from('municipalities')
    .select('id, name, state, entity_type').eq('state', 'MD').order('id', { ascending: true });
  if (mErr) { console.error('FATAL: municipalities read failed:', mErr.message); process.exit(1); }
  const byId = new Map((munis ?? []).map((m) => [m.id, { name: m.name, state: m.state, entity_type: m.entity_type }]));

  const town = (munis ?? []).filter((m) => m.name === ENTITY.name && m.state === ENTITY.state);
  if (town.length !== 1) {
    console.error(`FATAL: expected exactly one ${ENTITY.name}, ${ENTITY.state}; got ${town.length}.`);
    process.exit(1);
  }
  console.log(`${ENTITY.name}, ${ENTITY.state}  (${town[0].entity_type})  ${town[0].id}`);
  console.log(`target month ${CORRECT_MONTH}\n  ${AUTHORITY}\n`);

  const ids = [...byId.keys()];
  const budgetRows = (await pageAll(db, 'budgets',
    'id, municipality_id, fiscal_year, dataset_type, data_source, total_budget, fiscal_year_start_month', ids))
    .map((r) => ({ ...r, entity: byId.get(r.municipality_id) }));
  const sourceRows = (await pageAll(db, 'data_sources',
    'id, municipality_id, name, api_type, dataset_type, fiscal_year_start_month', ids))
    .map((r) => ({ ...r, entity: byId.get(r.municipality_id) }));
  const digestBefore = figureDigest(budgetRows);

  // ── Guard (d): the state node, measured BEFORE ────────────────────────────
  const stateBefore = budgetRows.filter((r) => r.entity?.entity_type === 'state');
  const stateMonthsBefore = [...new Set(stateBefore.map((r) => Number(r.fiscal_year_start_month)))].sort();

  const errors = [];
  const updates = [];
  const srcUpdates = [];
  let alreadyCorrect = 0;
  let srcCorrect = 0;
  let skippedState = 0;

  for (const r of budgetRows) {
    // The state node is out of scope by entity, decided here and counted;
    // classify treats it reaching it as an abort — that is its job.
    if (r.entity?.entity_type === 'state') { skippedState += 1; continue; }
    const c = classify(r);
    if (c.error) errors.push(`FY${r.fiscal_year} ${r.dataset_type} "${r.data_source}": ${c.error}`);
    else if (c.action === 'update') updates.push(r);
    else alreadyCorrect += 1;
  }
  for (const r of sourceRows) {
    if (r.entity?.entity_type === 'state') { skippedState += 1; continue; }
    const c = classifySource(r);
    if (c.error) errors.push(`data_source "${r.name}" (${r.dataset_type}): ${c.error}`);
    else if (c.action === 'update') srcUpdates.push(r);
    else srcCorrect += 1;
  }

  const bMeasured = verifyOnly ? alreadyCorrect : updates.length;
  const sMeasured = verifyOnly ? srcCorrect : srcUpdates.length;
  console.log(`in-scope labels      ${IN_SCOPE.size}`);
  console.log(`rows read            budgets ${budgetRows.length}   data_sources ${sourceRows.length}`);
  console.log(`budgets  need ${DEFAULT_MONTH} -> ${CORRECT_MONTH}   ${updates.length}   `
    + `${verifyOnly ? `at ${CORRECT_MONTH}` : 'to change'} vs baseline ${BASELINE.budgetRows} `
    + `${bMeasured === BASELINE.budgetRows ? '(matches)' : `⚠ MEASURED ${bMeasured}`}`);
  console.log(`sources  need ${DEFAULT_MONTH} -> ${CORRECT_MONTH}   ${srcUpdates.length}   `
    + `${verifyOnly ? `at ${CORRECT_MONTH}` : 'to change'} vs baseline ${BASELINE.sourceRows} `
    + `${sMeasured === BASELINE.sourceRows ? '(matches)' : `⚠ MEASURED ${sMeasured}`}`);
  console.log(`skipped state node   ${skippedState}`);
  console.log(`State of Maryland    ${stateBefore.length} row(s) at [${stateMonthsBefore.join(', ')}]`);
  console.log(`figure digest        ${digestBefore}`);
  console.log(`errors               ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log(`    ! ${e}`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  // Guard (d), pre-flight. ⚠ Maryland's correct month EQUALS this sweep's target,
  // so if the state node were wrongly in scope the data would look fine
  // afterwards. Counting it explicitly is the only way that error is visible.
  if (stateBefore.length !== BASELINE.protectedStateRows
    || stateMonthsBefore.length !== 1 || stateMonthsBefore[0] !== CORRECT_MONTH) {
    console.error(`\nABORT: expected ${BASELINE.protectedStateRows} State of Maryland row(s) all at `
      + `${CORRECT_MONTH}; found ${stateBefore.length} at [${stateMonthsBefore.join(', ')}]. Nothing written.`);
    process.exit(1);
  }
  console.log(`state node OK        ${stateBefore.length} rows at ${CORRECT_MONTH}, excluded by entity`);

  if (verifyOnly) {
    if (updates.length || srcUpdates.length) {
      console.error(`\nVERIFY FAILED: ${updates.length} budget and ${srcUpdates.length} `
        + `data_source row(s) still at ${DEFAULT_MONTH}.`);
      process.exit(1);
    }
    console.log(`\nVERIFY OK: every Leonardtown row at ${CORRECT_MONTH}; the State of Maryland's `
      + `${stateBefore.length} rows untouched.`);
    return;
  }

  if (!updates.length && !srcUpdates.length) { console.log('\nNothing to do.'); return; }
  if (!apply) { console.log('\nDRY RUN — pass --apply to write.'); return; }

  // Sources first: a source row seeds the column on a future tree-RPC load, so it
  // must never be left more wrong than the rows it feeds.
  const srcWritten = await updateMonth(db, 'data_sources', srcUpdates.map((r) => r.id), 'data_sources');
  const written = await updateMonth(db, 'budgets', updates.map((r) => r.id), 'budgets');

  // Guards (d) and (e), post-flight.
  const after = (await pageAll(db, 'budgets',
    'id, municipality_id, data_source, total_budget, fiscal_year_start_month', ids))
    .map((r) => ({ ...r, entity: byId.get(r.municipality_id) }));
  const digestAfter = figureDigest(after);
  if (digestBefore !== digestAfter) {
    console.error(`\nFATAL: the (id, total_budget) digest CHANGED (${digestBefore} -> ${digestAfter}). `
      + 'A dollar figure moved — this sweep must only touch fiscal_year_start_month.');
    process.exit(1);
  }
  const stateAfter = after.filter((r) => r.entity?.entity_type === 'state');
  if (stateAfter.length !== stateBefore.length) {
    console.error(`FATAL: the State of Maryland had ${stateBefore.length} rows and now has `
      + `${stateAfter.length}.`);
    process.exit(1);
  }

  console.log(`\nfigure digest before ${digestBefore}`);
  console.log(`figure digest after  ${digestAfter}`);
  console.log(`\nAPPLIED: ${srcWritten} data_source row(s) and ${written} budget row(s) set to `
    + `${CORRECT_MONTH}. No figure moved. State of Maryland unchanged. Re-run with --verify.`);
}

await main();
