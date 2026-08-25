#!/usr/bin/env node
/**
 * Correct `fiscal_year_start_month` on the City of Inglewood, CA rows: 7 -> 10.
 *
 * Inglewood closes its books on September 30, so its fiscal year starts in
 * October. Every CA row was created with a literal `7` hardcoded inside
 * `public.treasury_sync_city_budget`. The defect, the evidence for October, the
 * deliberate exclusion of the publicpay `salaries` rows, and the classification
 * guards all live in — and are tested through — the library:
 *
 *     scripts/lib/inglewoodFiscalCalendar.mjs
 *     tests/inglewoodFiscalCalendar.test.mjs
 *
 * This file is only the I/O around it: resolve the entity, page the rows, report,
 * and write. It moves no dollar figure — `total_budget` is never in the update.
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Resolved through the ONE municipality row matching
 *       name='Inglewood' AND state='CA'. Never a name match without the state —
 *       there is an Ingleside, TX whose ACFR also ends September 30.
 *   (e) EXPECTED COUNT. `EXPECTED_ROWS` in-scope rows, asserted before any write.
 *   (f) Writes only where the value differs, and re-asserts the old value in the
 *       WHERE clause, so a re-run is a no-op and a concurrent writer cannot be
 *       silently clobbered.
 *
 * Usage:
 *   node scripts/fixInglewoodFiscalYearStartMonth.mjs            # dry run (default)
 *   node scripts/fixInglewoodFiscalYearStartMonth.mjs --apply
 *   node scripts/fixInglewoodFiscalYearStartMonth.mjs --verify   # re-read and assert
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  ENTITY, CORRECT_MONTH, HARDCODED_MONTH, IN_SCOPE, EXPECTED_ROWS, classify,
} from './lib/inglewoodFiscalCalendar.mjs';

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

  // Guard (a): resolve the entity, and insist it is unique.
  const { data: munis, error: mErr } = await db
    .from('municipalities')
    .select('id, name, state')
    .eq('name', ENTITY.name)
    .eq('state', ENTITY.state);
  if (mErr) { console.error('FATAL: municipality lookup failed:', mErr.message); process.exit(1); }
  if (!munis || munis.length !== 1) {
    console.error(`FATAL: expected exactly 1 ${ENTITY.name}, ${ENTITY.state}; `
      + `found ${munis?.length ?? 0}`);
    process.exit(1);
  }
  const muni = munis[0];

  // Paged, ordered by the PRIMARY KEY last, so a tie on a non-unique column
  // cannot repeat or drop a row across a page boundary
  // (auto-memory reference_paged_reads_need_total_order).
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('budgets')
      .select('id, fiscal_year, dataset_type, fund_scope, basis, data_source, '
        + 'fiscal_year_start_month, source_date')
      .eq('municipality_id', muni.id)
      .order('fiscal_year', { ascending: true })
      .order('data_source', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('FATAL: budgets read failed:', error.message); process.exit(1); }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const inScope = rows.filter((r) => IN_SCOPE.has(r.data_source));
  const skipped = rows.filter((r) => !IN_SCOPE.has(r.data_source));

  const updates = [];
  const alreadyCorrect = [];
  const errors = [];
  for (const r of inScope) {
    const c = classify(r);
    if (c.error) errors.push(`FY${r.fiscal_year} ${r.dataset_type}/${r.fund_scope}: ${c.error}`);
    else if (c.action === 'update') updates.push(r);
    else alreadyCorrect.push(r);
  }

  console.log(`${ENTITY.name}, ${ENTITY.state} (${muni.id})`);
  console.log(`  rows total          ${rows.length}`);
  console.log(`  in scope            ${inScope.length}`);
  console.log(`  out of scope        ${skipped.length}`
    + (skipped.length ? `  [${[...new Set(skipped.map((r) => r.data_source))].join('; ')}]` : ''));
  console.log(`  need ${HARDCODED_MONTH} -> ${CORRECT_MONTH}          ${updates.length}`);
  console.log(`  already ${CORRECT_MONTH}          ${alreadyCorrect.length}`);
  console.log(`  errors              ${errors.length}`);
  for (const e of errors) console.log(`      ! ${e}`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  if (verifyOnly) {
    const wrong = inScope.filter((r) => Number(r.fiscal_year_start_month) !== CORRECT_MONTH);
    if (wrong.length || inScope.length !== EXPECTED_ROWS) {
      console.error(`\nVERIFY FAILED: ${wrong.length} row(s) not at ${CORRECT_MONTH}, `
        + `${inScope.length} in scope (expected ${EXPECTED_ROWS}).`);
      process.exit(1);
    }
    console.log(`\nVERIFY OK: all ${inScope.length} in-scope rows at ${CORRECT_MONTH}.`);
    return;
  }

  // Guard (e). In-scope rows only, and before any write.
  if (inScope.length !== EXPECTED_ROWS) {
    console.error(`\nABORT: expected ${EXPECTED_ROWS} in-scope rows, found ${inScope.length}. `
      + 'The row set has moved — re-read the scope rather than forcing this.');
    process.exit(1);
  }

  if (!updates.length) { console.log('\nNothing to do.'); return; }

  if (!apply) {
    console.log('\nDRY RUN — pass --apply to write. Rows that would change:');
    for (const r of updates) {
      console.log(`  FY${r.fiscal_year}  ${r.dataset_type}/${r.fund_scope}  `
        + `${r.fiscal_year_start_month} -> ${CORRECT_MONTH}  ${r.id}`);
    }
    return;
  }

  let written = 0;
  for (const r of updates) {
    // Guard (f): one id at a time, re-asserting the old value.
    const { data, error } = await db
      .from('budgets')
      .update({ fiscal_year_start_month: CORRECT_MONTH })
      .eq('id', r.id)
      .eq('fiscal_year_start_month', HARDCODED_MONTH)
      .select('id');
    if (error) { console.error(`FATAL: update ${r.id} failed: ${error.message}`); process.exit(1); }
    if (!data || data.length !== 1) {
      console.error(`FATAL: update ${r.id} matched ${data?.length ?? 0} rows, expected 1.`);
      process.exit(1);
    }
    written += 1;
  }
  console.log(`\nAPPLIED: ${written} row(s) set to ${CORRECT_MONTH}. Re-run with --verify.`);
}

await main();
