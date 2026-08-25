#!/usr/bin/env node
/**
 * Correct `fiscal_year_start_month` on the publicpay.ca.gov (GCC) salaries rows:
 * 7 -> 1. GCC is a W-2-based CALENDAR-year report; all 7,682 rows across 482 CA
 * entities were asserting a July–June fiscal year.
 *
 * The defect, the first-party evidence, the excluded sibling sources and the
 * classification guards all live in — and are tested through — the library:
 *
 *     scripts/lib/publicpayFiscalCalendar.mjs
 *     tests/publicpayFiscalCalendar.test.mjs
 *
 * This file is only the I/O around it. It moves no dollar figure — `total_budget`
 * is never in the update.
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Filtered on the exact `data_source` string AND
 *       `dataset_type='salaries'` in the query itself, then re-asserted per row
 *       by `classify`.
 *   (b) READ FULLY, THEN WRITE. Never interleaved: paging a table while it is
 *       being written double-counts and invents drift that looks exactly like a
 *       stale baseline (auto-memory reference_paged_reads_need_total_order).
 *   (c) Batched updates re-assert the old value in the WHERE clause and require
 *       the affected count to equal the batch size, so a concurrent writer
 *       cannot be silently clobbered and a partial write cannot pass.
 *   (d) Writes only where the value differs, so a re-run is a no-op.
 *
 * Usage:
 *   node scripts/fixPublicpayFiscalYearStartMonth.mjs            # dry run (default)
 *   node scripts/fixPublicpayFiscalYearStartMonth.mjs --apply
 *   node scripts/fixPublicpayFiscalYearStartMonth.mjs --verify   # re-read and assert
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  CORRECT_MONTH, HARDCODED_MONTH, IN_SCOPE_SOURCE, IN_SCOPE_DATASET,
  SWEEP_ROWS, SWEEP_ENTITIES, classify,
} from './lib/publicpayFiscalCalendar.mjs';

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

  // Guard (a)+(b): the whole in-scope set is read before anything is written.
  // Ordered by the PRIMARY KEY last so a tie on a non-unique column cannot
  // repeat or drop a row across a page boundary.
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('budgets')
      .select('id, municipality_id, fiscal_year, dataset_type, data_source, fiscal_year_start_month')
      .eq('data_source', IN_SCOPE_SOURCE)
      .eq('dataset_type', IN_SCOPE_DATASET)
      .order('fiscal_year', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('FATAL: budgets read failed:', error.message); process.exit(1); }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const updates = [];
  const alreadyCorrect = [];
  const errors = [];
  for (const r of rows) {
    const c = classify(r);
    if (c.error) errors.push(`FY${r.fiscal_year} ${r.id}: ${c.error}`);
    else if (c.action === 'update') updates.push(r);
    else alreadyCorrect.push(r);
  }

  const entities = new Set(rows.map((r) => r.municipality_id)).size;
  const fys = rows.map((r) => r.fiscal_year);

  console.log(`publicpay.ca.gov (GCC) salaries — ${HARDCODED_MONTH} -> ${CORRECT_MONTH}`);
  console.log(`  rows in scope       ${rows.length}`
    + (rows.length === SWEEP_ROWS ? '  (matches sweep baseline)' : `  ⚠ baseline was ${SWEEP_ROWS}`));
  console.log(`  entities            ${entities}`
    + (entities === SWEEP_ENTITIES ? '  (matches sweep baseline)' : `  ⚠ baseline was ${SWEEP_ENTITIES}`));
  console.log(`  fiscal years        ${Math.min(...fys)}–${Math.max(...fys)}`);
  console.log(`  need ${HARDCODED_MONTH} -> ${CORRECT_MONTH}           ${updates.length}`);
  console.log(`  already ${CORRECT_MONTH}           ${alreadyCorrect.length}`);
  console.log(`  errors              ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log(`      ! ${e}`);
  if (errors.length > 20) console.log(`      ... and ${errors.length - 20} more`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  if (!rows.length) {
    console.error('\nABORT: zero in-scope rows. The data_source label is compared with === '
      + 'and contains an em dash — a hyphen variant would land here. Nothing written.');
    process.exit(1);
  }

  if (verifyOnly) {
    const wrong = rows.filter((r) => Number(r.fiscal_year_start_month) !== CORRECT_MONTH);
    if (wrong.length) {
      console.error(`\nVERIFY FAILED: ${wrong.length} of ${rows.length} row(s) not at ${CORRECT_MONTH}.`);
      process.exit(1);
    }
    console.log(`\nVERIFY OK: all ${rows.length} in-scope rows at ${CORRECT_MONTH}.`);
    return;
  }

  if (!updates.length) { console.log('\nNothing to do.'); return; }

  if (!apply) {
    const byFy = new Map();
    for (const r of updates) byFy.set(r.fiscal_year, (byFy.get(r.fiscal_year) ?? 0) + 1);
    console.log('\nDRY RUN — pass --apply to write. Rows that would change, by fiscal year:');
    for (const fy of [...byFy.keys()].sort()) console.log(`  FY${fy}  ${byFy.get(fy)}`);
    return;
  }

  // Guard (c): batched, old value re-asserted, affected count must equal the batch.
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    const { data, error } = await db
      .from('budgets')
      .update({ fiscal_year_start_month: CORRECT_MONTH })
      .in('id', chunk.map((r) => r.id))
      .eq('fiscal_year_start_month', HARDCODED_MONTH)
      .select('id');
    if (error) { console.error(`FATAL: batch at ${i} failed: ${error.message}`); process.exit(1); }
    if (!data || data.length !== chunk.length) {
      console.error(`FATAL: batch at ${i} updated ${data?.length ?? 0} of ${chunk.length} rows. `
        + 'Something else is writing this column — stopping so the damage is bounded.');
      process.exit(1);
    }
    written += data.length;
    console.log(`  ${written}/${updates.length}`);
  }
  console.log(`\nAPPLIED: ${written} row(s) set to ${CORRECT_MONTH}. Re-run with --verify.`);
}

await main();
