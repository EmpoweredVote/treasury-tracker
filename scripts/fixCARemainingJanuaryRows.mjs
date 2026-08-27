#!/usr/bin/env node
/**
 * Correct the last California rows that silently claimed a JANUARY fiscal year:
 * 1 -> 7, for entities whose July–June year has been individually established.
 *
 *     treasury.budgets        89 rows   11 cities
 *     treasury.data_sources   79 rows   14 entities
 *     PROTECTED                6 rows   Empowered Vote (calendar year, correct)
 *                       + all publicpay/GCC rows (calendar year, correct)
 *
 * The evidence — a first-party document per entity, most of them PDFs sitting in
 * this repo — and every classification guard live in, and are tested through:
 *
 *     scripts/lib/caLocalFiscalCalendars.mjs
 *     tests/caLocalFiscalCalendars.test.mjs
 *
 * This file is only the I/O around it. It moves no dollar figure, and proves it.
 *
 * ⚠ THE SCOPE IS AN ENUMERATED LIST, NOT "CA CITIES ARE JULY". Ten of the eleven
 * cities are charter cities, and California binds a charter city to no fiscal
 * year at all — the two examined before this pass were BOTH October (Inglewood,
 * Long Beach). An entity absent from ESTABLISHED is an abort, not a default.
 *
 * ⚠ AND `1` IS NOT UNIFORMLY WRONG IN CALIFORNIA. It is correct for every
 * publicpay/GCC row (a W-2-based calendar-year report, PR #62) and for Empowered
 * Vote (whose own docs say so). A sweep keyed on "CA rows at 1" would corrupt
 * both. Scope is decided per entity and per source, never by the stored value.
 *
 * ── Guards enforced here (the pure ones are in the library) ─────────────────
 *   (a) SCOPE. Every row carries {name,state,entity_type} from its municipality.
 *       Keyed on (name, state): this session, name-only matching would have hit
 *       Long Beach NEW YORK and Berkley MICHIGAN.
 *   (b) READ FULLY, THEN WRITE, ordering by the PRIMARY KEY last for a total
 *       order (auto-memory reference_paged_reads_need_total_order).
 *   (c) Batched updates re-assert the old value; affected must equal batch.
 *   (d) THE PROTECTED SETS ARE ASSERTED, not skipped — Empowered Vote's 6 rows
 *       must be found at 1 before and still at 1 after, and the CA publicpay
 *       population must not shrink. A protection that stops matching would
 *       otherwise let the sweep reach rows it must never touch.
 *   (e) NO FIGURE MOVED. md5 over (id, total_budget) for every CA row, before
 *       and after, must match exactly.
 *
 * Usage:
 *   node scripts/fixCARemainingJanuaryRows.mjs            # dry run
 *   node scripts/fixCARemainingJanuaryRows.mjs --apply
 *   node scripts/fixCARemainingJanuaryRows.mjs --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  CORRECT_MONTH, DEFAULT_MONTH, BASELINE, BUDGET_ROWS_BY_ENTITY, ESTABLISHED,
  classify, classifySource, establishedFor, protectedSourceFor, protectedEntityFor,
} from './lib/caLocalFiscalCalendars.mjs';

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

async function loadCAEntities(db) {
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('municipalities')
      .select('id, name, state, entity_type')
      .eq('state', 'CA')
      .order('id', { ascending: true })
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
        .order('id', { ascending: true })          // guard (b): PK last
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

  const entities = await loadCAEntities(db);
  console.log(`CA entities: ${entities.size}`);
  console.log(`established (evidenced individually): ${ESTABLISHED.length}\n`);

  // Guard (b): both tables read to exhaustion before anything is written.
  const budgetRows = await readTable(db, 'budgets',
    'id, municipality_id, fiscal_year, dataset_type, data_source, total_budget, fiscal_year_start_month',
    entities);
  const sourceRows = await readTable(db, 'data_sources',
    'id, municipality_id, name, api_type, dataset_type, fiscal_year_start_month', entities);
  const digestBefore = figureDigest(budgetRows);

  // ── Guard (d): protected populations, measured BEFORE ─────────────────────
  const evBefore = budgetRows.filter((r) => protectedEntityFor(r.entity?.name, r.entity?.state)
    && r.entity?.name === 'Empowered Vote');
  const evMonthsBefore = [...new Set(evBefore.map((r) => Number(r.fiscal_year_start_month)))].sort();
  const publicpayBefore = budgetRows.filter((r) => protectedSourceFor(r.data_source));
  const publicpayMonthsBefore = [...new Set(publicpayBefore.map((r) => Number(r.fiscal_year_start_month)))].sort();

  // ── budgets ──────────────────────────────────────────────────────────────
  const errors = [];
  const updates = [];
  const perEntity = new Map();
  let alreadyCorrect = 0;
  let skippedProtected = 0;
  let skippedOther = 0;

  for (const r of budgetRows) {
    // Protections and out-of-scope rows are the caller's decision, made here and
    // counted; classify treats either reaching it as an abort — that is its job.
    if (protectedSourceFor(r.data_source)) { skippedProtected += 1; continue; }
    if (protectedEntityFor(r.entity?.name, r.entity?.state)) { skippedProtected += 1; continue; }
    if (Number(r.fiscal_year_start_month) !== DEFAULT_MONTH) { skippedOther += 1; continue; }
    if (!establishedFor(r.entity?.name, r.entity?.state)) {
      errors.push(`${r.entity?.name}, ${r.entity?.state} FY${r.fiscal_year} `
        + `"${r.data_source}": at ${DEFAULT_MONTH} but no established calendar`);
      continue;
    }
    const c = classify(r);
    if (c.error) { errors.push(`${r.entity?.name} FY${r.fiscal_year}: ${c.error}`); continue; }
    if (c.action === 'update') {
      updates.push(r);
      const k = r.entity.name;
      perEntity.set(k, (perEntity.get(k) ?? 0) + 1);
    } else alreadyCorrect += 1;
  }

  console.log('budgets — rows needing 1 -> 7, per entity (baseline in brackets)');
  const names = [...new Set([...Object.keys(BUDGET_ROWS_BY_ENTITY), ...perEntity.keys()])].sort();
  for (const n of names) {
    const got = perEntity.get(n) ?? 0;
    const want = BUDGET_ROWS_BY_ENTITY[n] ?? 0;
    const est = establishedFor(n, 'CA');
    console.log(`    ${n.padEnd(15)} ${String(got).padStart(3)} [${want}] `
      + `${got === (verifyOnly ? 0 : want) ? '' : verifyOnly ? '' : '⚠ MISMATCH'}`
      + `${est?.charter === false ? '   (general-law city)' : ''}`);
  }

  // ── data_sources ─────────────────────────────────────────────────────────
  const srcUpdates = [];
  let srcCorrect = 0;
  let srcSkipped = 0;
  const srcPerEntity = new Map();
  for (const r of sourceRows) {
    if (protectedSourceFor(r.name)) { srcSkipped += 1; continue; }
    if (protectedEntityFor(r.entity?.name, r.entity?.state)) { srcSkipped += 1; continue; }
    if (Number(r.fiscal_year_start_month) !== DEFAULT_MONTH) { srcSkipped += 1; continue; }
    if (!establishedFor(r.entity?.name, r.entity?.state)) {
      errors.push(`data_source "${r.name}" (${r.entity?.name}): at ${DEFAULT_MONTH} `
        + 'but no established calendar');
      continue;
    }
    const c = classifySource(r);
    if (c.error) { errors.push(`data_source "${r.name}": ${c.error}`); continue; }
    if (c.action === 'update') {
      srcUpdates.push(r);
      srcPerEntity.set(r.entity.name, (srcPerEntity.get(r.entity.name) ?? 0) + 1);
    } else srcCorrect += 1;
  }

  console.log('\ndata_sources — rows needing 1 -> 7, per entity');
  for (const [n, c] of [...srcPerEntity.entries()].sort()) {
    const est = establishedFor(n, 'CA');
    console.log(`    ${n.padEnd(15)} ${String(c).padStart(3)}`
      + `${est?.sourceRowsOnly ? '   (source rows only — dormant seed)' : ''}`);
  }

  const bMeasured = verifyOnly ? alreadyCorrect : updates.length;
  console.log(`\nrows read            budgets ${budgetRows.length}   data_sources ${sourceRows.length}`);
  console.log(`budgets  to change   ${updates.length}   vs baseline ${BASELINE.budgetRows} `
    + `${(verifyOnly ? 0 : updates.length) === (verifyOnly ? 0 : BASELINE.budgetRows) ? '(matches)' : `⚠ MEASURED ${bMeasured}`}`);
  console.log(`sources  to change   ${srcUpdates.length}   vs baseline ${BASELINE.sourceRows} `
    + `${(verifyOnly ? 0 : srcUpdates.length) === (verifyOnly ? 0 : BASELINE.sourceRows) ? '(matches)' : '⚠ MISMATCH'}`);
  console.log(`entities to change   budgets ${perEntity.size} [${BASELINE.budgetEntities}]   `
    + `sources ${srcPerEntity.size} [${BASELINE.sourceEntities}]`);
  console.log(`already ${CORRECT_MONTH}            budgets ${alreadyCorrect}   sources ${srcCorrect}`);
  console.log(`skipped protected    budgets ${skippedProtected}   sources ${srcSkipped}`);
  console.log(`skipped other month  ${skippedOther}`);
  console.log(`Empowered Vote       ${evBefore.length} row(s) at [${evMonthsBefore.join(', ')}]`);
  console.log(`publicpay (CA)       ${publicpayBefore.length} row(s) at [${publicpayMonthsBefore.join(', ')}]`);
  console.log(`figure digest        ${digestBefore}`);
  console.log(`errors               ${errors.length}`);
  for (const e of errors.slice(0, 25)) console.log(`    ! ${e}`);
  if (errors.length > 25) console.log(`    ... and ${errors.length - 25} more`);

  if (errors.length) {
    console.error('\nABORT: at least one in-scope row could not be classified. Nothing written.');
    process.exit(1);
  }

  // Guard (d), pre-flight. If a protection stops matching, the sweep is free to
  // reach rows it must never touch — so absence is a failure, not a pass.
  if (evBefore.length !== BASELINE.protectedEvRows
    || evMonthsBefore.length !== 1 || evMonthsBefore[0] !== 1) {
    console.error(`\nABORT: expected ${BASELINE.protectedEvRows} Empowered Vote row(s) all at 1; `
      + `found ${evBefore.length} at [${evMonthsBefore.join(', ')}]. Nothing written.`);
    process.exit(1);
  }
  if (!publicpayBefore.length || publicpayMonthsBefore.length !== 1 || publicpayMonthsBefore[0] !== 1) {
    console.error(`\nABORT: expected the CA publicpay population to be non-empty and all at 1; `
      + `found ${publicpayBefore.length} at [${publicpayMonthsBefore.join(', ')}]. Nothing written.`);
    process.exit(1);
  }
  console.log(`protections OK       EV ${evBefore.length}@1, publicpay ${publicpayBefore.length}@1`);

  if (verifyOnly) {
    if (updates.length || srcUpdates.length) {
      console.error(`\nVERIFY FAILED: ${updates.length} budget and ${srcUpdates.length} `
        + 'data_source row(s) still at 1.');
      process.exit(1);
    }
    console.log(`\nVERIFY OK: every established CA entity at ${CORRECT_MONTH}; `
      + `${evBefore.length} Empowered Vote and ${publicpayBefore.length} publicpay row(s) still at 1.`);
    return;
  }

  if (!updates.length && !srcUpdates.length) { console.log('\nNothing to do.'); return; }
  if (!apply) { console.log('\nDRY RUN — pass --apply to write.'); return; }

  // Sources first — a source row seeds the column on a future tree-RPC load, so
  // it must never be left more wrong than the rows it feeds.
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
  const evAfter = after.filter((r) => r.entity?.name === 'Empowered Vote');
  const evMonthsAfter = [...new Set(evAfter.map((r) => Number(r.fiscal_year_start_month)))].sort();
  const ppAfter = after.filter((r) => protectedSourceFor(r.data_source));
  const ppMonthsAfter = [...new Set(ppAfter.map((r) => Number(r.fiscal_year_start_month)))].sort();
  if (evAfter.length !== evBefore.length || evMonthsAfter.join() !== evMonthsBefore.join()) {
    console.error(`FATAL: Empowered Vote moved — ${evAfter.length} row(s) at `
      + `[${evMonthsAfter.join(', ')}], was ${evBefore.length} at [${evMonthsBefore.join(', ')}].`);
    process.exit(1);
  }
  if (ppAfter.length !== publicpayBefore.length || ppMonthsAfter.join() !== publicpayMonthsBefore.join()) {
    console.error(`FATAL: the publicpay population moved — ${ppAfter.length} row(s) at `
      + `[${ppMonthsAfter.join(', ')}], was ${publicpayBefore.length} at `
      + `[${publicpayMonthsBefore.join(', ')}].`);
    process.exit(1);
  }

  console.log(`\nfigure digest before ${digestBefore}`);
  console.log(`figure digest after  ${digestAfter}`);
  console.log(`\nAPPLIED: ${srcWritten} data_source row(s) and ${written} budget row(s) set to `
    + `${CORRECT_MONTH}. No figure moved. Empowered Vote ${evAfter.length}@1 and publicpay `
    + `${ppAfter.length}@1 untouched. Re-run with --verify.`);
}

await main();
