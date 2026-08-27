#!/usr/bin/env node
/**
 * Verify — never change — Washington's stored fiscal calendars against the RCW.
 *
 *     336 local rows (8 cities + 2 counties)  expected 1   RCW 1.16.030 + 84.04.120
 *      12 State of Washington rows            expected 7   RCW 1.16.020
 *       0 school-district rows                expected 9   RCW 1.16.030 exception
 *
 * ⚠ THIS SCRIPT HAS NO --apply, DELIBERATELY. Every Washington row is already
 * correct. The reason it exists is that they were correct by COINCIDENCE: 1 is
 * what the dropped `NOT NULL DEFAULT 1` gave every loader that said nothing, and
 * Washington happens to be a calendar-year state. The arc has twice mistaken
 * agreement-with-a-default for correctness (SCOPE-04's `=== 7` gate and
 * `deriveTotalGovernmental`'s guard), so this turns the coincidence into a
 * checkable assertion. If it ever reports a row needing a change, the data has
 * drifted from the statute and wants investigating — not a sweep.
 *
 * The statutes and every guard live in, and are tested through:
 *
 *     scripts/lib/waFiscalCalendar.mjs
 *     tests/waFiscalCalendar.test.mjs
 *
 * Usage:
 *   node scripts/verifyWAFiscalYearStartMonth.mjs
 *
 * Exits non-zero if any Washington row disagrees with the RCW, if an entity type
 * has no established calendar, or if the population has moved off its baseline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  LOCAL_MONTH, STATE_MONTH, SCHOOL_DISTRICT_MONTH, AUTHORITY, BASELINE,
  LOCAL_ROWS_BY_ENTITY, classify, monthForWAEntity,
} from './lib/waFiscalCalendar.mjs';

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

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('FATAL: SUPABASE_URL and a service key must be set'); process.exit(1); }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  const entities = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('municipalities')
      .select('id, name, state, entity_type').eq('state', 'WA')
      .order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) { console.error('FATAL: municipalities read failed:', error.message); process.exit(1); }
    for (const m of data ?? []) entities.set(m.id, { name: m.name, state: m.state, entity_type: m.entity_type });
    if (!data || data.length < PAGE) break;
  }

  // Read to exhaustion, ordering by the PRIMARY KEY last for a total order
  // (auto-memory reference_paged_reads_need_total_order).
  const rows = [];
  for (const ids of chunk([...entities.keys()], ID_CHUNK)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from('budgets')
        .select('id, municipality_id, fiscal_year, dataset_type, data_source, fiscal_year_start_month')
        .in('municipality_id', ids)
        .order('municipality_id', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { console.error('FATAL: budgets read failed:', error.message); process.exit(1); }
      for (const r of data ?? []) rows.push({ ...r, entity: entities.get(r.municipality_id) });
      if (!data || data.length < PAGE) break;
    }
  }

  const sourceRows = [];
  for (const ids of chunk([...entities.keys()], ID_CHUNK)) {
    const { data, error } = await db.from('data_sources')
      .select('id, name, fiscal_year_start_month').in('municipality_id', ids)
      .order('id', { ascending: true });
    if (error) { console.error('FATAL: data_sources read failed:', error.message); process.exit(1); }
    sourceRows.push(...(data ?? []));
  }

  console.log(`WA entities: ${entities.size}   budget rows: ${rows.length}   `
    + `data_sources rows: ${sourceRows.length}`);
  console.log(`  local  expect ${LOCAL_MONTH}   ${AUTHORITY.local}`);
  console.log(`  state  expect ${STATE_MONTH}   ${AUTHORITY.state}`);
  console.log(`  school expect ${SCHOOL_DISTRICT_MONTH}   ${AUTHORITY.schoolDistrict}`);
  console.log(`  biennial: ${AUTHORITY.biennial}\n`);

  const errors = [];
  const drift = [];
  const byEntity = new Map();
  let localRows = 0;
  let stateRows = 0;
  let schoolRows = 0;

  for (const r of rows) {
    const c = classify(r);
    const t = r.entity?.entity_type;
    if (t === 'state') stateRows += 1;
    else if (t === 'school_district') schoolRows += 1;
    else localRows += 1;
    byEntity.set(r.entity?.name, (byEntity.get(r.entity?.name) ?? 0) + 1);
    if (c.error) errors.push(`${r.entity?.name} FY${r.fiscal_year}: ${c.error}`);
    else if (c.action === 'update') {
      drift.push(`${r.entity?.name} (${t}) FY${r.fiscal_year} ${r.dataset_type}: `
        + `stored ${c.stored}, statute says ${c.month}`);
    }
  }

  console.log('rows per entity (baseline in brackets)');
  for (const [n, c] of [...byEntity.entries()].sort()) {
    const want = LOCAL_ROWS_BY_ENTITY[n];
    const label = want === undefined ? '' : `[${want}]${c === want ? '' : ' ⚠ MISMATCH'}`;
    console.log(`    ${String(n).padEnd(18)} ${String(c).padStart(3)} ${label}`);
  }

  console.log(`\nlocal rows            ${localRows} [${BASELINE.localRows}]`);
  console.log(`state rows            ${stateRows} [${BASELINE.stateRows}]`);
  console.log(`school-district rows  ${schoolRows} [${BASELINE.schoolDistrictRows}]`);
  console.log(`data_sources rows     ${sourceRows.length} [${BASELINE.dataSourceRows}] `
    + '— waSaoLoad.mjs creates its source row EPHEMERALLY and deletes it');
  console.log(`disagreeing with RCW  ${drift.length}`);
  console.log(`errors                ${errors.length}`);
  for (const e of errors.slice(0, 25)) console.log(`    ! ${e}`);
  for (const d of drift.slice(0, 25)) console.log(`    ~ ${d}`);

  let bad = false;
  if (errors.length) { console.error('\nFAIL: at least one row could not be classified.'); bad = true; }
  if (drift.length) {
    console.error(`\nFAIL: ${drift.length} row(s) disagree with the RCW. This script does NOT `
      + 'write — investigate why the data drifted before correcting anything.');
    bad = true;
  }
  if (localRows !== BASELINE.localRows || stateRows !== BASELINE.stateRows) {
    console.error(`\nFAIL: population moved — local ${localRows} (baseline ${BASELINE.localRows}), `
      + `state ${stateRows} (baseline ${BASELINE.stateRows}). Re-measure and update the baseline `
      + 'deliberately rather than loosening this check.');
    bad = true;
  }
  // A school district appearing is not an error — but it IS the statutory
  // exception, so it must be reported loudly the first time rather than blending in.
  if (schoolRows !== BASELINE.schoolDistrictRows) {
    console.log(`\n⚠ NOTE: ${schoolRows} school-district row(s) are now present (baseline `
      + `${BASELINE.schoolDistrictRows}). RCW 1.16.030 puts them on a September 1 start `
      + `(month ${SCHOOL_DISTRICT_MONTH}), NOT January. Confirm they were loaded with `
      + 'that month and update the baseline.');
  }
  // Sanity check the resolver itself against the statute, so a bad edit to the
  // library fails here too and not only in the unit tests.
  for (const [type, want] of [['city', LOCAL_MONTH], ['county', LOCAL_MONTH],
    ['state', STATE_MONTH], ['school_district', SCHOOL_DISTRICT_MONTH]]) {
    const got = monthForWAEntity({ name: 'x', state: 'WA', entity_type: type });
    if (got !== want) {
      console.error(`\nFAIL: monthForWAEntity('${type}') returned ${got}, expected ${want}.`);
      bad = true;
    }
  }

  if (bad) process.exit(1);
  console.log(`\nVERIFY OK: all ${rows.length} Washington rows agree with the RCW — `
    + `${localRows} local at ${LOCAL_MONTH}, ${stateRows} state at ${STATE_MONTH}. `
    + 'No row needed changing; the value is now established rather than inherited.');
}

await main();
