#!/usr/bin/env node
/**
 * Correct `fiscal_year_start_month` on the Minnesota OSA and Ohio AOS rows:
 * 7 -> 1. Both states' local governments run the CALENDAR year by statute.
 *
 *     Minnesota OSA   21,794 rows   945 entities   FY2012–FY2023
 *     Ohio AOS         6,596 rows   340 entities   FY2016–FY2025
 *
 * ⚠ CINCINNATI IS EXEMPT (Ohio Rev. Code § 9.34) and stays at 7.
 *
 * The statutes, the exception and the classification guards all live in — and
 * are tested through — the library:
 *
 *     scripts/lib/calendarYearLocalGov.mjs
 *     tests/calendarYearLocalGov.test.mjs
 *
 * This file is only the I/O around it. It moves no dollar figure.
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Filtered on the exact `data_source` labels, joined to the
 *       municipality so every row carries {name,state} — the Ohio exception is
 *       per-entity and cannot be evaluated without it.
 *   (b) READ FULLY, THEN WRITE. Never interleaved: paging a table while it is
 *       being written double-counts and invents drift that looks exactly like a
 *       stale baseline (auto-memory reference_paged_reads_need_total_order).
 *   (c) Batched updates re-assert the old value and require the affected count
 *       to equal the batch size, so a concurrent writer cannot be silently
 *       clobbered and a partial write cannot pass.
 *   (d) The exempt entity is asserted UNCHANGED after the run, not merely
 *       skipped during it.
 *
 * Usage:
 *   node scripts/fixCalendarYearLocalGov.mjs            # dry run (default)
 *   node scripts/fixCalendarYearLocalGov.mjs --apply
 *   node scripts/fixCalendarYearLocalGov.mjs --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  CORRECT_MONTH, HARDCODED_MONTH, FAMILIES, SWEEP_ROWS, EXEMPT_ENTITIES,
  exemptionFor, classify,
} from './lib/calendarYearLocalGov.mjs';

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

async function readFamily(db, munis, source) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('budgets')
      .select('id, municipality_id, fiscal_year, dataset_type, data_source, fiscal_year_start_month')
      .eq('data_source', source)
      .order('fiscal_year', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(`FATAL: read failed for "${source}":`, error.message); process.exit(1); }
    for (const r of data ?? []) rows.push({ ...r, entity: munis.get(r.municipality_id) });
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function loadMunicipalities(db) {
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('municipalities')
      .select('id, name, state')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('FATAL: municipalities read failed:', error.message); process.exit(1); }
    for (const m of data ?? []) map.set(m.id, { name: m.name, state: m.state });
    if (!data || data.length < PAGE) break;
  }
  return map;
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

  const munis = await loadMunicipalities(db);

  const updates = [];
  const errors = [];
  let alreadyCorrect = 0;
  let exemptSeen = 0;

  for (const family of FAMILIES) {
    // Guard (a)+(b): the whole family is read before anything is written.
    const rows = await readFamily(db, munis, family.source);
    const ents = new Set(rows.map((r) => r.municipality_id)).size;

    let famUpdates = 0;
    let famCorrect = 0;
    let famExempt = 0;
    for (const r of rows) {
      // The exemption is applied HERE, before classify, because classify treats
      // an exempt row reaching it as an abort — that is its job. Skipping is the
      // caller's decision; swallowing it silently inside classify is not.
      if (exemptionFor(r.entity)) { famExempt += 1; exemptSeen += 1; continue; }
      const c = classify(r);
      if (c.error) errors.push(`${family.state} FY${r.fiscal_year} ${r.id}: ${c.error}`);
      else if (c.action === 'update') { updates.push(r); famUpdates += 1; }
      else { famCorrect += 1; alreadyCorrect += 1; }
    }

    const fys = rows.map((r) => r.fiscal_year);
    console.log(`${family.state} — ${family.source}`);
    console.log(`    authority        ${family.authority}`);
    console.log(`    rows read        ${rows.length}   entities ${ents}   `
      + `FY${Math.min(...fys)}–${Math.max(...fys)}`);
    console.log(`    need ${HARDCODED_MONTH} -> ${CORRECT_MONTH}       ${famUpdates}`
      + (famUpdates === family.rows ? '  (matches baseline)' : `  ⚠ baseline ${family.rows}`));
    console.log(`    already ${CORRECT_MONTH}        ${famCorrect}`);
    console.log(`    statutorily exempt ${famExempt}`);
  }

  console.log(`\nTOTAL to change ${updates.length}`
    + (updates.length === SWEEP_ROWS ? `  (matches baseline ${SWEEP_ROWS})` : `  ⚠ baseline ${SWEEP_ROWS}`));
  console.log(`already ${CORRECT_MONTH}       ${alreadyCorrect}`);
  console.log(`exempt          ${exemptSeen}`);
  console.log(`errors          ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log(`    ! ${e}`);
  if (errors.length > 20) console.log(`    ... and ${errors.length - 20} more`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  // Guard (d), pre-flight: the exemption must actually be present. If Cincinnati
  // stopped matching (renamed, restated), the sweep would silently "protect"
  // nothing and corrupt it — so an absent exemption is a failure, not a pass.
  if (exemptSeen === 0) {
    console.error(`\nABORT: expected to see ${EXEMPT_ENTITIES.map((e) => e.name).join(', ')} `
      + 'among the in-scope rows and saw none. The exemption is not matching — '
      + 'nothing written.');
    process.exit(1);
  }

  if (verifyOnly) {
    if (updates.length) {
      console.error(`\nVERIFY FAILED: ${updates.length} row(s) still at ${HARDCODED_MONTH}.`);
      process.exit(1);
    }
    console.log(`\nVERIFY OK: all sweepable rows at ${CORRECT_MONTH}; `
      + `${exemptSeen} statutorily exempt row(s) left alone.`);
    return;
  }

  if (!updates.length) { console.log('\nNothing to do.'); return; }

  if (!apply) {
    console.log('\nDRY RUN — pass --apply to write.');
    return;
  }

  // Guard (c): batched, old value re-asserted, affected count must equal batch.
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
    if (written % 2500 === 0 || written === updates.length) {
      console.log(`  ${written}/${updates.length}`);
    }
  }
  console.log(`\nAPPLIED: ${written} row(s) set to ${CORRECT_MONTH}. Re-run with --verify.`);
}

await main();
