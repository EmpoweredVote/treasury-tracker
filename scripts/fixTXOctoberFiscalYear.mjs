#!/usr/bin/env node
/**
 * Correct the Texas rows that silently claimed a JANUARY fiscal year.
 * Texas municipalities run OCTOBER–SEPTEMBER: 1 -> 10.
 *
 *     treasury.budgets        71 rows   14 municipalities
 *     treasury.data_sources   74 rows   14 municipalities
 *     PROTECTED               20 rows   State of Texas, month 9 (Sept 1 start)
 *                             32 rows   Austin, already 10
 *                             44 rows   Travis County, already 10
 *
 * The evidence — a first-party document per entity — and every classification
 * guard live in, and are tested through:
 *
 *     scripts/lib/txLocalFiscalCalendars.mjs
 *     tests/txLocalFiscalCalendars.test.mjs
 *
 * This file is only the I/O around it. It moves no dollar figure, and proves it.
 *
 * ⚠⚠ THE TARGET IS 10, NOT 7. Massachusetts was 1 -> 7 and California was 1 -> 7,
 * so the reflex by now is "January in a non-calendar state means July". In Texas
 * that reflex is wrong for all 71 rows, and it would have been wrong SILENTLY:
 * the column moves no dollar, so every tie test passes at $0 while the period is
 * off by a quarter. Tex. Loc. Gov't Code § 101.042 sets no default at all — each
 * municipality prescribes its own by ordinance — so there was nothing to assume
 * from and each city was read individually.
 *
 * ⚠ AND THE STATE IS A THIRD VALUE. Texas begins September 1 (month 9). Three
 * different correct answers inside one state, which is why scope is a named list
 * of entities and not "rows where state = TX".
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Every row carries {name,state,entity_type}; keyed on (name,state).
 *   (b) READ FULLY, THEN WRITE, ordering by the PRIMARY KEY last for a total
 *       order (auto-memory reference_paged_reads_need_total_order).
 *   (c) Batched updates re-assert the old value; affected must equal batch.
 *   (d) THE PROTECTED SETS ARE ASSERTED, not skipped. The State of Texas must be
 *       found at 9 before and still at 9 after; Austin and Travis County must
 *       keep their row counts and their 10. A protection that silently stopped
 *       matching would let the sweep reach rows it must never touch.
 *   (e) NO FIGURE MOVED. md5 over (id, total_budget) for every TX row, before
 *       and after, must match exactly.
 *
 * Usage:
 *   node scripts/fixTXOctoberFiscalYear.mjs            # dry run
 *   node scripts/fixTXOctoberFiscalYear.mjs --apply
 *   node scripts/fixTXOctoberFiscalYear.mjs --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  CORRECT_MONTH, DEFAULT_MONTH, BASELINE, BUDGET_ROWS_BY_ENTITY,
  SOURCE_ROWS_BY_ENTITY, ESTABLISHED, PROTECTED_ENTITIES,
  classify, classifySource, establishedFor, protectedEntityFor,
} from './lib/txLocalFiscalCalendars.mjs';

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

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) },
  (_, i) => a.slice(i * n, i * n + n));

async function loadTXEntities(db) {
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('municipalities').select('id, name, state, entity_type')
      .eq('state', 'TX').order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('FATAL: municipalities read failed:', error.message); process.exit(1); }
    for (const m of data ?? []) map.set(m.id, { name: m.name, state: m.state, entity_type: m.entity_type });
    if (!data || data.length < PAGE) break;
  }
  return map;
}

async function readTable(db, table, select, entities) {
  const rows = [];
  for (const ids of chunk([...entities.keys()], ID_CHUNK)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from(table).select(select)
        .in('municipality_id', ids)
        .order('municipality_id', { ascending: true })
        .order('id', { ascending: true })            // guard (b): PK last
        .range(from, from + PAGE - 1);
      if (error) { console.error(`FATAL: ${table} read failed: ${error.message}`); process.exit(1); }
      for (const r of data ?? []) rows.push({ ...r, entity: entities.get(r.municipality_id) });
      if (!data || data.length < PAGE) break;
    }
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
    const { data, error } = await db
      .from(table)
      .update({ fiscal_year_start_month: CORRECT_MONTH })
      .in('id', c)
      .eq('fiscal_year_start_month', DEFAULT_MONTH)     // guard (c)
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

/** Snapshot of a protected entity: row count and the distinct months it holds. */
function snapshot(rows, name) {
  const mine = rows.filter((r) => r.entity?.name === name);
  return { n: mine.length, months: [...new Set(mine.map((r) => Number(r.fiscal_year_start_month)))].sort() };
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const verifyOnly = argv.includes('--verify');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('FATAL: SUPABASE_URL and a service key must be set'); process.exit(1); }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  const entities = await loadTXEntities(db);
  console.log(`TX entities: ${entities.size}   established: ${ESTABLISHED.length}   `
    + `protected: ${PROTECTED_ENTITIES.length}`);
  console.log(`target month: ${CORRECT_MONTH} (October) — NOT 7; `
    + 'Tex. Loc. Gov\'t Code § 101.042 sets no default\n');

  // Guard (b): both tables read to exhaustion before anything is written.
  const budgetRows = await readTable(db, 'budgets',
    'id, municipality_id, fiscal_year, dataset_type, data_source, total_budget, fiscal_year_start_month',
    entities);
  const sourceRows = await readTable(db, 'data_sources',
    'id, municipality_id, name, api_type, dataset_type, fiscal_year_start_month', entities);
  const digestBefore = figureDigest(budgetRows);

  // ── Guard (d): protected snapshots, taken BEFORE ──────────────────────────
  const before = {
    Texas: snapshot(budgetRows, 'Texas'),
    Austin: snapshot(budgetRows, 'Austin'),
    'Travis County': snapshot(budgetRows, 'Travis County'),
  };

  const errors = [];
  const updates = [];
  const perEntity = new Map();
  let alreadyCorrect = 0;
  let skippedProtected = 0;

  for (const r of budgetRows) {
    // Protections are the caller's decision, applied here and counted; classify
    // treats a protected row reaching it as an abort — that is its job.
    if (protectedEntityFor(r.entity?.name, r.entity?.state)) { skippedProtected += 1; continue; }
    if (Number(r.fiscal_year_start_month) === CORRECT_MONTH) { alreadyCorrect += 1; continue; }
    const c = classify(r);
    if (c.error) { errors.push(`${r.entity?.name} FY${r.fiscal_year}: ${c.error}`); continue; }
    if (c.action === 'update') {
      updates.push(r);
      perEntity.set(r.entity.name, (perEntity.get(r.entity.name) ?? 0) + 1);
    } else alreadyCorrect += 1;
  }

  const srcUpdates = [];
  const srcPerEntity = new Map();
  let srcCorrect = 0;
  let srcSkipped = 0;
  for (const r of sourceRows) {
    if (protectedEntityFor(r.entity?.name, r.entity?.state)) { srcSkipped += 1; continue; }
    if (Number(r.fiscal_year_start_month) === CORRECT_MONTH) { srcCorrect += 1; continue; }
    const c = classifySource(r);
    if (c.error) { errors.push(`data_source "${r.name}": ${c.error}`); continue; }
    if (c.action === 'update') {
      srcUpdates.push(r);
      srcPerEntity.set(r.entity.name, (srcPerEntity.get(r.entity.name) ?? 0) + 1);
    } else srcCorrect += 1;
  }

  console.log('per-entity rows needing 1 -> 10   (budgets [baseline] / sources [baseline])');
  const names = [...new Set([...Object.keys(BUDGET_ROWS_BY_ENTITY), ...Object.keys(SOURCE_ROWS_BY_ENTITY)])].sort();
  for (const n of names) {
    const b = perEntity.get(n) ?? 0;
    const s = srcPerEntity.get(n) ?? 0;
    const wb = BUDGET_ROWS_BY_ENTITY[n] ?? 0;
    const ws = SOURCE_ROWS_BY_ENTITY[n] ?? 0;
    const ok = verifyOnly ? (b === 0 && s === 0) : (b === wb && s === ws);
    console.log(`    ${n.padEnd(12)} budgets ${String(b).padStart(3)} [${String(wb).padStart(2)}]   `
      + `sources ${String(s).padStart(3)} [${String(ws).padStart(2)}]   ${ok ? '' : '⚠ MISMATCH'}`);
  }

  const bOk = verifyOnly ? updates.length === 0 : updates.length === BASELINE.budgetRows;
  const sOk = verifyOnly ? srcUpdates.length === 0 : srcUpdates.length === BASELINE.sourceRows;
  console.log(`\nrows read            budgets ${budgetRows.length}   data_sources ${sourceRows.length}`);
  console.log(`budgets  to change   ${updates.length} vs baseline ${BASELINE.budgetRows} ${bOk ? '(ok)' : '⚠ MISMATCH'}`);
  console.log(`sources  to change   ${srcUpdates.length} vs baseline ${BASELINE.sourceRows} ${sOk ? '(ok)' : '⚠ MISMATCH'}`);
  console.log(`entities to change   budgets ${perEntity.size} [${BASELINE.budgetEntities}]   `
    + `sources ${srcPerEntity.size} [${BASELINE.sourceEntities}]`);
  console.log(`already ${CORRECT_MONTH}           budgets ${alreadyCorrect}   sources ${srcCorrect}`);
  console.log(`skipped protected    budgets ${skippedProtected}   sources ${srcSkipped}`);
  for (const [n, s] of Object.entries(before)) {
    console.log(`protected ${n.padEnd(14)} ${String(s.n).padStart(3)} row(s) at [${s.months.join(', ')}]`);
  }
  console.log(`figure digest        ${digestBefore}`);
  console.log(`errors               ${errors.length}`);
  for (const e of errors.slice(0, 25)) console.log(`    ! ${e}`);
  if (errors.length > 25) console.log(`    ... and ${errors.length - 25} more`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  // Guard (d), pre-flight. The state is the one that matters: it must be present
  // and at 9, or the protection is not matching and the sweep could re-stamp it.
  const want = {
    Texas: { n: BASELINE.protectedStateRows, month: 9 },
    Austin: { n: BASELINE.protectedAustinRows, month: 10 },
    'Travis County': { n: BASELINE.protectedTravisRows, month: 10 },
  };
  for (const [n, w] of Object.entries(want)) {
    const s = before[n];
    if (s.n !== w.n || s.months.length !== 1 || s.months[0] !== w.month) {
      console.error(`\nABORT: expected ${w.n} ${n} row(s) all at ${w.month}; found ${s.n} at `
        + `[${s.months.join(', ')}]. The protection is not matching — nothing written.`);
      process.exit(1);
    }
  }
  console.log(`protections OK       Texas ${before.Texas.n}@9, Austin ${before.Austin.n}@10, `
    + `Travis County ${before['Travis County'].n}@10`);

  if (verifyOnly) {
    if (updates.length || srcUpdates.length) {
      console.error(`\nVERIFY FAILED: ${updates.length} budget and ${srcUpdates.length} `
        + 'data_source row(s) still at 1.');
      process.exit(1);
    }
    console.log(`\nVERIFY OK: every established TX municipality at ${CORRECT_MONTH}; `
      + 'the State of Texas still at 9 and Austin/Travis County untouched.');
    return;
  }

  if (!updates.length && !srcUpdates.length) { console.log('\nNothing to do.'); return; }
  if (!apply) { console.log('\nDRY RUN — pass --apply to write.'); return; }

  // Sources first: a source row seeds the column on a future tree-RPC load.
  const srcWritten = await updateMonth(db, 'data_sources', srcUpdates.map((r) => r.id), 'data_sources');
  const written = await updateMonth(db, 'budgets', updates.map((r) => r.id), 'budgets');

  // Guards (d) and (e), post-flight.
  const after = await readTable(db, 'budgets',
    'id, municipality_id, data_source, total_budget, fiscal_year_start_month', entities);
  const digestAfter = figureDigest(after);
  if (digestBefore !== digestAfter) {
    console.error(`\nFATAL: the (id, total_budget) digest CHANGED (${digestBefore} -> ${digestAfter}). `
      + 'A dollar figure moved — this sweep must only touch fiscal_year_start_month.');
    process.exit(1);
  }
  for (const n of Object.keys(want)) {
    const a = snapshot(after, n);
    if (a.n !== before[n].n || a.months.join() !== before[n].months.join()) {
      console.error(`FATAL: ${n} moved — ${a.n} row(s) at [${a.months.join(', ')}], `
        + `was ${before[n].n} at [${before[n].months.join(', ')}].`);
      process.exit(1);
    }
  }

  console.log(`\nfigure digest before ${digestBefore}`);
  console.log(`figure digest after  ${digestAfter}`);
  console.log(`\nAPPLIED: ${srcWritten} data_source row(s) and ${written} budget row(s) set to `
    + `${CORRECT_MONTH}. No figure moved. State of Texas still at 9; Austin and Travis County `
    + 'unchanged. Re-run with --verify.');
}

await main();
