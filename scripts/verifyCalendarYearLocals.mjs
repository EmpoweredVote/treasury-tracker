#!/usr/bin/env node
/**
 * Verify — never change — Indiana's and Colorado's stored fiscal calendars
 * against the evidence recorded in the library.
 *
 *     IN   86 local rows (1 city, 1 county, 3 townships, 1 town)  expect 1
 *          48 State of Indiana rows                              expect 7
 *          11 data_sources rows across 9 entities                 expect 1
 *     CO   64 local rows (1 home-rule city, 1 county)             expect 1
 *           6 State of Colorado rows                             expect 7
 *           0 data_sources rows
 *
 * ⚠ NO --apply, DELIBERATELY. Every row in both states is already correct. This
 * exists because they were correct by COINCIDENCE — 1 is what the dropped
 * `NOT NULL DEFAULT 1` handed any loader that said nothing, and both states
 * happen to be calendar-year states. PR #71 showed what that reflex costs: Texas
 * turned out to be OCTOBER. If this script ever reports a disagreement, the data
 * has drifted from the evidence and wants investigating, not sweeping.
 *
 * The evidence and every guard live in, and are tested through:
 *
 *     scripts/lib/calendarYearLocalVerify.mjs
 *     tests/calendarYearLocalVerify.test.mjs
 *
 * Usage:
 *   node scripts/verifyCalendarYearLocals.mjs             # both states
 *   node scripts/verifyCalendarYearLocals.mjs --state CO
 *
 * Exits non-zero if any row disagrees, if an entity type has no established
 * calendar, or if a population has moved off its baseline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  STATES, LOCAL_MONTH, STATE_MONTH, VERIFIABLE_STATES, KNOWN_CARVE_OUTS,
  classify, monthFor, entityAuthorityFor,
} from './lib/calendarYearLocalVerify.mjs';

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
const ID_CHUNK = 40;
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) },
  (_, i) => a.slice(i * n, i * n + n));

async function loadEntities(db, state) {
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('municipalities')
      .select('id, name, state, entity_type').eq('state', state)
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) { console.error(`FATAL: municipalities read failed (${state}):`, error.message); process.exit(1); }
    for (const m of data ?? []) map.set(m.id, { name: m.name, state: m.state, entity_type: m.entity_type });
    if (!data || data.length < PAGE) break;
  }
  return map;
}

async function readTable(db, table, select, entities) {
  const rows = [];
  for (const ids of chunk([...entities.keys()], ID_CHUNK)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from(table).select(select)
        .in('municipality_id', ids)
        .order('municipality_id', { ascending: true })
        .order('id', { ascending: true })          // PK last, for a total order
        .range(from, from + PAGE - 1);
      if (error) { console.error(`FATAL: ${table} read failed: ${error.message}`); process.exit(1); }
      for (const r of data ?? []) rows.push({ ...r, entity: entities.get(r.municipality_id) });
      if (!data || data.length < PAGE) break;
    }
  }
  return rows;
}

async function verifyState(db, stateCode) {
  const cfg = STATES[stateCode];
  const bl = cfg.baseline;
  console.log(`\n${'='.repeat(78)}\n${stateCode} — ${cfg.stateNodeName}`);
  console.log(`  locals expect ${LOCAL_MONTH}   ${cfg.authority.local}`);
  if (cfg.authority.localSecondary) console.log(`  corroborated  ${cfg.authority.localSecondary}`);
  console.log(`  state  expect ${STATE_MONTH}   ${cfg.authority.stateNode}`);

  const entities = await loadEntities(db, stateCode);
  const budgetRows = await readTable(db, 'budgets',
    'id, municipality_id, fiscal_year, dataset_type, data_source, fiscal_year_start_month', entities);
  const sourceRows = await readTable(db, 'data_sources',
    'id, municipality_id, name, api_type, fiscal_year_start_month', entities);

  const errors = [];
  const drift = [];
  const byEntity = new Map();
  let localRows = 0;
  let stateRows = 0;

  for (const r of budgetRows) {
    const isState = r.entity?.entity_type === 'state';
    if (isState) stateRows += 1; else localRows += 1;
    byEntity.set(r.entity?.name, (byEntity.get(r.entity?.name) ?? 0) + 1);
    const c = classify(r);
    if (c.error) errors.push(`${r.entity?.name} FY${r.fiscal_year}: ${c.error}`);
    else if (c.action === 'update') {
      drift.push(`${r.entity?.name} (${r.entity?.entity_type}) FY${r.fiscal_year} `
        + `${r.dataset_type}: stored ${c.stored}, evidence says ${c.month}`);
    }
  }

  const srcByEntity = new Map();
  for (const r of sourceRows) {
    srcByEntity.set(r.entity?.name, (srcByEntity.get(r.entity?.name) ?? 0) + 1);
    const c = classify({ ...r, fiscal_year: '-', dataset_type: 'data_source' });
    if (c.error) errors.push(`data_source "${r.name}": ${c.error}`);
    else if (c.action === 'update') {
      drift.push(`data_source "${r.name}" (${r.entity?.entity_type}): `
        + `stored ${c.stored}, evidence says ${c.month}`);
    }
  }

  console.log('\n  budget rows per entity (baseline in brackets)');
  for (const [n, c] of [...byEntity.entries()].sort()) {
    const want = cfg.localRowsByEntity[n];
    const ea = entityAuthorityFor(n, stateCode);
    const mark = want === undefined ? '' : `[${want}]${c === want ? '' : ' ⚠ MISMATCH'}`;
    const note = ea ? (ea.statuteReaches ? '' : '   ⚠ statute does NOT reach this entity') : '';
    console.log(`    ${String(n).padEnd(30)} ${String(c).padStart(3)} ${mark}${note}`);
  }
  if (srcByEntity.size) {
    console.log('\n  data_sources rows per entity');
    for (const [n, c] of [...srcByEntity.entries()].sort()) {
      const t = [...entities.values()].find((x) => x.name === n)?.entity_type ?? '?';
      console.log(`    ${String(n).padEnd(30)} ${String(c).padStart(3)}   (${t})`);
    }
  }

  // Per-entity authorities: print the ones whose own document had to settle them.
  const own = [...byEntity.keys()].map((n) => [n, entityAuthorityFor(n, stateCode)])
    .filter(([, a]) => a);
  if (own.length) {
    console.log('\n  per-entity evidence');
    for (const [n, a] of own) {
      console.log(`    ${n}: ${a.why}`);
      console.log(`        ${a.authority}`);
    }
  }

  console.log(`\n  local rows           ${localRows} [${bl.localRows}]`);
  console.log(`  state rows           ${stateRows} [${bl.stateRows}]`);
  console.log(`  data_sources rows    ${sourceRows.length} [${bl.sourceRows}]`);
  console.log(`  disagreeing          ${drift.length}`);
  console.log(`  errors               ${errors.length}`);
  for (const e of errors.slice(0, 20)) console.log(`      ! ${e}`);
  for (const d of drift.slice(0, 20)) console.log(`      ~ ${d}`);

  let bad = false;
  if (errors.length) { console.error(`  FAIL (${stateCode}): a row could not be classified.`); bad = true; }
  if (drift.length) {
    console.error(`  FAIL (${stateCode}): ${drift.length} row(s) disagree with the evidence. `
      + 'This script does NOT write — investigate the drift first.');
    bad = true;
  }
  if (localRows !== bl.localRows || stateRows !== bl.stateRows
    || sourceRows.length !== bl.sourceRows) {
    console.error(`  FAIL (${stateCode}): population moved — local ${localRows} [${bl.localRows}], `
      + `state ${stateRows} [${bl.stateRows}], sources ${sourceRows.length} [${bl.sourceRows}]. `
      + 'Re-measure and update the baseline deliberately rather than loosening this check.');
    bad = true;
  }
  return bad;
}

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--state');
  const only = i >= 0 ? argv[i + 1]?.toUpperCase() : null;
  if (only && !VERIFIABLE_STATES.includes(only)) {
    console.error(`FATAL: --state must be one of ${VERIFIABLE_STATES.join(', ')}`);
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('FATAL: SUPABASE_URL and a service key must be set'); process.exit(1); }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  let bad = false;
  for (const s of (only ? [only] : VERIFIABLE_STATES)) {
    // eslint-disable-next-line no-await-in-loop
    if (await verifyState(db, s)) bad = true;
  }

  // Sanity-check the resolver against the recorded tables, so a bad library edit
  // fails here too and not only in the unit tests.
  for (const [code, cfg] of Object.entries(STATES)) {
    for (const [type, want] of Object.entries(cfg.entityTypeMonths)) {
      const got = monthFor({ name: 'x', state: code, entity_type: type });
      if (got !== want) {
        console.error(`\nFAIL: monthFor(${code}, '${type}') returned ${got}, expected ${want}.`);
        bad = true;
      }
    }
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log('known carve-outs encoded but NOT present in our data:');
  for (const c of KNOWN_CARVE_OUTS) {
    console.log(`  ${c.state}: ${c.entityDescription} -> `
      + `${c.month === null ? 'UNESTABLISHED' : `month ${c.month}`}`);
  }

  if (bad) process.exit(1);
  console.log('\nVERIFY OK: every Indiana and Colorado row agrees with the recorded '
    + 'evidence. No row needed changing; the values are now established rather than '
    + 'inherited from a column default.');
}

await main();
