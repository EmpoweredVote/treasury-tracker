#!/usr/bin/env node
/**
 * Correct `fiscal_year_start_month` for the City of Long Beach, CA, which closes
 * on September 30 and therefore starts in OCTOBER (10).
 *
 *     treasury.budgets        60 rows at 7  ->  10   (SCO + derived)
 *                              4 rows at 1  ->  10   (own budget documents)
 *     treasury.data_sources   12 rows at 1  ->  10
 *     PROTECTED               16 rows at 1  stay 1   (publicpay/GCC salaries)
 *
 * The evidence — the FY2025 ACFR cover page and the FY25 Adopted Budget — and
 * every classification guard live in, and are tested through:
 *
 *     scripts/lib/longBeachFiscalCalendar.mjs
 *     tests/longBeachFiscalCalendar.test.mjs
 *
 * This file is only the I/O around it. It moves no dollar figure, and proves it.
 *
 * ⚠ THE HARD PART IS THAT `1` MEANS TWO OPPOSITE THINGS HERE. It is the value to
 * correct on a budget-document row and the value to PRESERVE on a salaries row,
 * inside the same city. A sweep keyed on "rows at 1" would destroy the 16
 * publicpay rows; a sweep keyed on "rows at 7" would miss the 4 budget rows. The
 * library keys on the source family instead, and the protected group is asserted
 * PRESENT AND UNCHANGED here rather than merely skipped.
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Read on (name, state) = (Long Beach, CA). Four states have a
 *       Long Beach; a name-only read would be reckless.
 *   (b) READ FULLY, THEN WRITE. Never interleaved — paging a table while it is
 *       being written double-counts (reference_paged_reads_need_total_order).
 *       Reads order by the PRIMARY KEY last for a total order.
 *   (c) Batched updates re-assert the OLD value per family, so a concurrent
 *       writer cannot be silently clobbered and a partial write cannot pass.
 *   (d) THE PROTECTED GROUP IS ASSERTED, not skipped. Its 16 rows must be found,
 *       must all read 1 before, and must still all read 1 after. If publicpay
 *       stopped matching, the sweep would be free to reach it — so an absent
 *       protected group is a failure, not a pass.
 *   (e) NO FIGURE MOVED. md5 over (id, total_budget) for every Long Beach row,
 *       before and after, must match exactly.
 *
 * Usage:
 *   node scripts/fixLongBeachFiscalYearStartMonth.mjs            # dry run
 *   node scripts/fixLongBeachFiscalYearStartMonth.mjs --apply
 *   node scripts/fixLongBeachFiscalYearStartMonth.mjs --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  ENTITY, CORRECT_MONTH, FAMILIES, SOURCE_FAMILY, PROTECTED, PROTECTED_ROWS,
  EXPECTED_ROWS, classify, classifySource, familyFor, protectionFor,
} from './lib/longBeachFiscalCalendar.mjs';

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

async function pageAll(db, table, select, muniId) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(select)
      .eq('municipality_id', muniId)
      .order('id', { ascending: true })          // guard (b): total order on the PK
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

async function updateMonth(db, table, ids, from, label) {
  let written = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const c = ids.slice(i, i + BATCH);
    const { data, error } = await db
      .from(table)
      .update({ fiscal_year_start_month: CORRECT_MONTH })
      .in('id', c)
      .eq('fiscal_year_start_month', from)        // guard (c)
      .select('id');
    if (error) { console.error(`FATAL: ${label} batch at ${i} failed: ${error.message}`); process.exit(1); }
    if (!data || data.length !== c.length) {
      console.error(`FATAL: ${label} batch at ${i} updated ${data?.length ?? 0} of ${c.length} rows. `
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
  if (!url || !key) {
    console.error('FATAL: SUPABASE_URL and a service key must be set (.env)');
    process.exit(1);
  }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  // Guard (a): (name, state), never name alone.
  const { data: munis, error: mErr } = await db
    .from('municipalities')
    .select('id, name, state, entity_type')
    .eq('name', ENTITY.name)
    .eq('state', ENTITY.state);
  if (mErr) { console.error('FATAL: municipality read failed:', mErr.message); process.exit(1); }
  if (!munis || munis.length !== 1) {
    console.error(`FATAL: expected exactly one ${ENTITY.name}, ${ENTITY.state}; got ${munis?.length ?? 0}. `
      + 'Four states have a Long Beach — refusing to guess.');
    process.exit(1);
  }
  const muni = munis[0];
  const entity = { name: muni.name, state: muni.state };
  console.log(`${muni.name}, ${muni.state}  (${muni.entity_type})  ${muni.id}`);

  // Guard (b): both tables read to exhaustion before anything is written.
  const budgetRows = (await pageAll(db, 'budgets',
    'id, fiscal_year, dataset_type, data_source, total_budget, fiscal_year_start_month', muni.id))
    .map((r) => ({ ...r, entity }));
  const sourceRows = (await pageAll(db, 'data_sources',
    'id, name, api_type, dataset_type, fiscal_year_start_month', muni.id))
    .map((r) => ({ ...r, entity }));
  const digestBefore = figureDigest(budgetRows);

  // ── Guard (d): the protected group, measured BEFORE ───────────────────────
  const protectedRows = budgetRows.filter((r) => protectionFor(r.data_source));
  const protectedMonthsBefore = [...new Set(protectedRows.map((r) => Number(r.fiscal_year_start_month)))].sort();

  // ── budgets ──────────────────────────────────────────────────────────────
  const errors = [];
  const perFamily = new Map(FAMILIES.map((f) => [f.key, { updates: [], correct: 0 }]));
  let alreadyCorrect = 0;

  for (const r of budgetRows) {
    // Protection is applied HERE, before classify, because classify treats a
    // protected row reaching it as an ABORT — that is its job. Skipping is the
    // caller's decision; swallowing it inside classify is not.
    if (protectionFor(r.data_source)) continue;
    const fam = familyFor(r.data_source);
    if (!fam || fam.ambiguous) {
      errors.push(`FY${r.fiscal_year} "${r.data_source}": ${fam?.ambiguous
        ? `ambiguous family (${fam.ambiguous.join(', ')})` : 'out-of-scope data_source'}`);
      continue;
    }
    const c = classify(r);
    const acc = perFamily.get(fam.key);
    if (c.error) errors.push(`FY${r.fiscal_year} "${r.data_source}": ${c.error}`);
    else if (c.action === 'update') acc.updates.push(r);
    else { acc.correct += 1; alreadyCorrect += 1; }
  }

  for (const f of FAMILIES) {
    const a = perFamily.get(f.key);
    const measured = verifyOnly ? a.correct : a.updates.length;
    console.log(`\n${f.key}   known-wrong value ${f.from}  — ${f.why}`);
    console.log(`    need ${f.from} -> ${CORRECT_MONTH}   ${a.updates.length}`);
    console.log(`    already ${CORRECT_MONTH}      ${a.correct}`);
    console.log(`    ${verifyOnly ? `at ${CORRECT_MONTH}` : 'to change'} vs baseline ${f.rows}   `
      + (measured === f.rows ? '(matches)' : `⚠ MEASURED ${measured}`));
  }

  // ── data_sources ─────────────────────────────────────────────────────────
  const srcUpdates = [];
  let srcCorrect = 0;
  for (const r of sourceRows) {
    const c = classifySource(r);
    if (c.error) { errors.push(`data_source "${r.name}": ${c.error}`); continue; }
    if (c.action === 'update') srcUpdates.push(r); else srcCorrect += 1;
  }
  const srcMeasured = verifyOnly ? srcCorrect : srcUpdates.length;
  console.log(`\ndata_sources (${SOURCE_FAMILY.apiType})`);
  console.log(`    need ${SOURCE_FAMILY.from} -> ${CORRECT_MONTH}   ${srcUpdates.length}`);
  console.log(`    already ${CORRECT_MONTH}      ${srcCorrect}`);
  console.log(`    ${verifyOnly ? `at ${CORRECT_MONTH}` : 'to change'} vs baseline ${SOURCE_FAMILY.rows}   `
    + (srcMeasured === SOURCE_FAMILY.rows ? '(matches)' : `⚠ MEASURED ${srcMeasured}`));

  const updates = FAMILIES.flatMap((f) => perFamily.get(f.key).updates);
  const totalMeasured = verifyOnly ? alreadyCorrect : updates.length;
  console.log(`\nrows read          budgets ${budgetRows.length}   data_sources ${sourceRows.length}`);
  console.log(`budgets  ${verifyOnly ? `at ${CORRECT_MONTH}` : 'to change'} ${totalMeasured} vs baseline `
    + `${EXPECTED_ROWS} ${totalMeasured === EXPECTED_ROWS ? '(matches)' : '⚠ MISMATCH'}`);
  console.log(`protected          ${protectedRows.length} row(s) at month(s) [${protectedMonthsBefore.join(', ')}]`);
  console.log(`figure digest      ${digestBefore}`);
  console.log(`errors             ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log(`    ! ${e}`);
  if (errors.length > 20) console.log(`    ... and ${errors.length - 20} more`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  // Guard (d), pre-flight. An absent or mis-valued protected group means the
  // pattern has stopped matching and the sweep is free to reach rows it must not.
  const want = PROTECTED.map((p) => p.month);
  if (protectedRows.length !== PROTECTED_ROWS) {
    console.error(`\nABORT: expected ${PROTECTED_ROWS} protected publicpay row(s) and found `
      + `${protectedRows.length}. The protection is not matching — nothing written.`);
    process.exit(1);
  }
  if (protectedMonthsBefore.length !== 1 || !want.includes(protectedMonthsBefore[0])) {
    console.error(`\nABORT: protected rows read months [${protectedMonthsBefore.join(', ')}], `
      + `expected exactly [${want.join(', ')}]. Nothing written.`);
    process.exit(1);
  }
  console.log(`protected OK       ${protectedRows.length} publicpay row(s), all at `
    + `${protectedMonthsBefore[0]}, excluded from scope`);

  if (verifyOnly) {
    if (updates.length || srcUpdates.length) {
      console.error(`\nVERIFY FAILED: ${updates.length} budget row(s) and ${srcUpdates.length} `
        + 'data_source row(s) still wrong.');
      process.exit(1);
    }
    console.log(`\nVERIFY OK: every in-scope Long Beach row at ${CORRECT_MONTH}; `
      + `${protectedRows.length} publicpay row(s) still at ${protectedMonthsBefore[0]}.`);
    return;
  }

  if (!updates.length && !srcUpdates.length) { console.log('\nNothing to do.'); return; }
  if (!apply) { console.log('\nDRY RUN — pass --apply to write.'); return; }

  // Sources first: a source row is what seeds the column on a future tree-RPC
  // load, so it must never be left more wrong than the rows it feeds.
  const srcWritten = await updateMonth(db, 'data_sources',
    srcUpdates.map((r) => r.id), SOURCE_FAMILY.from, 'data_sources');

  // ⚠ Per family, re-asserting THAT family's old value — 7 for SCO, 1 for the
  // budget documents. A single global `.eq(7)` would silently update nothing for
  // the four budget rows and report success.
  let written = 0;
  for (const f of FAMILIES) {
    const ids = perFamily.get(f.key).updates.map((r) => r.id);
    if (!ids.length) continue;
    written += await updateMonth(db, 'budgets', ids, f.from, `budgets/${f.key}`);
  }

  // Guards (d) and (e), post-flight.
  const after = (await pageAll(db, 'budgets',
    'id, data_source, total_budget, fiscal_year_start_month', muni.id));
  const digestAfter = figureDigest(after);
  const protectedAfter = after.filter((r) => protectionFor(r.data_source));
  const protectedMonthsAfter = [...new Set(protectedAfter.map((r) => Number(r.fiscal_year_start_month)))].sort();

  console.log(`\nfigure digest before ${digestBefore}`);
  console.log(`figure digest after  ${digestAfter}`);
  if (digestBefore !== digestAfter) {
    console.error('FATAL: the (id, total_budget) digest CHANGED. A dollar figure moved — '
      + 'this sweep must only touch fiscal_year_start_month. Investigate before anything else.');
    process.exit(1);
  }
  if (protectedAfter.length !== PROTECTED_ROWS
    || protectedMonthsAfter.length !== 1 || protectedMonthsAfter[0] !== protectedMonthsBefore[0]) {
    console.error(`FATAL: the protected publicpay rows moved — ${protectedAfter.length} row(s) `
      + `now at [${protectedMonthsAfter.join(', ')}], was ${PROTECTED_ROWS} at `
      + `[${protectedMonthsBefore.join(', ')}].`);
    process.exit(1);
  }

  console.log(`\nAPPLIED: ${srcWritten} data_source row(s) and ${written} budget row(s) set to `
    + `${CORRECT_MONTH}. No figure moved. ${protectedAfter.length} publicpay row(s) still at `
    + `${protectedMonthsAfter[0]}. Re-run with --verify.`);
}

await main();
