#!/usr/bin/env node
/**
 * Correct the California city rows that silently claimed a JULY fiscal year
 * when the city's own audited financial statements say OCTOBER.
 *
 *     Huntington Beach   36 rows   FY2003-2018   7 -> 10
 *     El Segundo         48 rows   FY2003-2021   7 -> 10
 *     South Lake Tahoe   60 rows   FY2003-2024   7 -> 10
 *     ------------------------------------------------------
 *                       144 rows                 $0 moved
 *
 * The evidence for every city, and the guards, live in and are tested through:
 *
 *     scripts/lib/caCityFiscalExceptions.mjs   (the month, per city, per year)
 *     scripts/lib/caFiscalYearCensus.mjs       (how these three were FOUND)
 *     tests/caCityFiscalExceptions.test.mjs
 *     tests/caFiscalYearCensus.test.mjs
 *
 * ── Why these three, and why now ────────────────────────────────────────────
 * The previous pass audited the 121 CA CHARTER cities, on the reasoning that
 * only a charter city can set its own fiscal year. ⚠⚠ THAT PREMISE IS FALSE.
 * South Lake Tahoe and El Segundo are GENERAL-LAW cities running an October
 * year; neither was ever in the audit set. They were found by censusing the
 * federally filed audit period of every California city
 * (docs/CA/fac-ca-city-fiscal-year-ends.csv), not by reading charters.
 *
 * ⚠ TWO OF THE THREE CHANGED CALENDARS MID-SERIES, so the correction is NOT
 * "city -> month". Huntington Beach ran October through FY2018 and July after;
 * El Segundo through FY2021. A per-city sweep would have flattened the years on
 * the far side of each change. The month is resolved PER ROW, from that row's
 * own fiscal year.
 *
 * ⚠ THE STUB YEAR TAKES THE OLD MONTH. Huntington Beach FY2018 covers Oct 1
 * 2017 - Jun 30 2018: nine months, but it BEGINS in October, so it is 10. The
 * column records a start month and cannot express a short year — the shortness
 * is recorded in the registry's authority text, not here.
 *
 * ── Guards enforced here (the pure ones are in the libraries) ───────────────
 *   (a) SCOPE. Every row carries {name,state} from its municipality and must
 *       match a registry entry keyed on (name, state). Name alone would be
 *       reckless — there is a Long Beach in NY, WA and MS.
 *   (b) READ FULLY, THEN WRITE, ordering by the PRIMARY KEY last for a total
 *       order (auto-memory reference_paged_reads_need_total_order).
 *   (c) DIRECTION. The only transition allowed is 7 -> 10. A row already at 10
 *       is left alone; a row at 1 is REFUSED, never swept.
 *   (d) THE PROTECTED SET IS ASSERTED, NOT SKIPPED. Each of these three cities
 *       also holds 16 publicpay/GCC salary rows that are CORRECTLY at 1 (a
 *       W-2-based calendar-year report, PR #62). All 48 must be found at 1
 *       before AND still at 1 after. A protection that stops matching would
 *       otherwise let the sweep reach rows it must never touch.
 *   (e) COUNTED BEFORE AND AFTER, per city, against a recorded baseline — a
 *       scope error is invisible if you only count the rows you meant to hit.
 *   (f) NO FIGURE MOVED. md5 over (id, total_budget) for every row of every
 *       affected city, before and after, must match exactly.
 *
 * Usage:
 *   node scripts/fixCACityFiscalYearMonths.mjs            # dry run
 *   node scripts/fixCACityFiscalYearMonths.mjs --apply
 *   node scripts/fixCACityFiscalYearMonths.mjs --verify
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { fiscalExceptionFor, monthForEntry } from './lib/caCityFiscalExceptions.mjs';

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

/** The month a correct row must hold. Nothing else is written. */
export const TARGET_MONTH = 10;
/** The month these rows wrongly hold. Nothing else is read as "needs fixing". */
export const WRONG_MONTH = 7;
/** Correct on the publicpay/GCC salary rows these cities also own. Never touched. */
export const CALENDAR_YEAR_MONTH = 1;

/**
 * Measured 2026-08-27, before any write. Per city, so a shifted row set is
 * caught for the city it shifted in rather than netting out across three.
 */
export const BASELINE = {
  'Huntington Beach': { toFix: 36, staysAt7: 24, protectedAt1: 16 },
  'El Segundo': { toFix: 48, staysAt7: 12, protectedAt1: 16 },
  'South Lake Tahoe': { toFix: 60, staysAt7: 0, protectedAt1: 16 },
};
export const CITIES = Object.keys(BASELINE);

/** Sources whose month is legitimately 1 and must never enter the update set. */
const PROTECTED_SOURCE = /publicpay|compensation in california/i;

/**
 * Classify one `budgets` row. Pure, so every guard is testable without a
 * database. `row.entity` is `{ name, state }`.
 */
export function classify(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state) return { error: 'row has no entity {name,state}' };
  if (e.state !== 'CA') return { error: `out-of-state entity reached the update set: ${e.name}, ${e.state}` };
  if (!CITIES.includes(e.name)) return { error: `city outside the audited set reached the update set: ${e.name}` };

  const exc = fiscalExceptionFor(e.name, e.state);
  if (!exc) {
    return { error: `no evidenced fiscal calendar for ${e.name}, ${e.state} — California `
      + 'sets no municipal fiscal year by statute, so this must be read off the '
      + "entity's own audited statements and added to caCityFiscalExceptions.mjs" };
  }

  const fy = Number(row.fiscal_year);
  if (!Number.isInteger(fy)) return { error: `unparseable fiscal_year ${JSON.stringify(row.fiscal_year)}` };

  const evidenced = monthForEntry(exc, fy);
  if (evidenced.error) return { error: evidenced.error };

  // ⚠ Nullish is rejected BEFORE Number(), which turns both null and '' into 0 —
  // an integer that would sail past the checks below and be reported as "stored
  // month 0", blaming a value the column never held.
  const raw = row.fiscal_year_start_month;
  if (raw === null || raw === undefined || raw === '') {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  const stored = Number(raw);
  if (!Number.isInteger(stored)) return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };

  if (PROTECTED_SOURCE.test(row.data_source ?? '')) {
    // Asserted, not skipped: it must be at 1, and it must stay there.
    if (stored !== CALENDAR_YEAR_MONTH) {
      return { error: `protected calendar-year source "${row.data_source}" is at ${stored}, not ${CALENDAR_YEAR_MONTH}` };
    }
    return { action: 'protected' };
  }

  if (stored === CALENDAR_YEAR_MONTH) {
    return { error: `row at month ${CALENDAR_YEAR_MONTH} from non-publicpay source `
      + `"${row.data_source}" — a January row is a DIFFERENT defect and is not this `
      + "sweep's to fix" };
  }
  if (stored === evidenced.month) return { action: 'correct' };
  if (stored !== WRONG_MONTH) {
    return { error: `stored month ${stored} is neither ${WRONG_MONTH} nor the evidenced ${evidenced.month}` };
  }
  if (evidenced.month !== TARGET_MONTH) {
    return { error: `evidenced month ${evidenced.month} for FY${fy} is not the only month this sweep writes (${TARGET_MONTH})` };
  }
  return { action: 'update', month: evidenced.month, fiscalYear: fy };
}

function figureDigest(rows) {
  const h = crypto.createHash('md5');
  for (const r of [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    h.update(`${r.id}:${r.total_budget}\n`);
  }
  return h.digest('hex');
}

async function loadCities(db) {
  const { data, error } = await db
    .from('municipalities').select('id, name, state, entity_type')
    .eq('state', 'CA').in('name', CITIES).order('id', { ascending: true });
  if (error) { console.error('FATAL: municipalities read failed:', error.message); process.exit(1); }
  const map = new Map();
  for (const m of data ?? []) {
    if (m.entity_type === 'county') continue;   // there is no county of these names, but do not assume it
    map.set(m.id, { name: m.name, state: m.state });
  }
  const missing = CITIES.filter((c) => ![...map.values()].some((v) => v.name === c));
  if (missing.length) { console.error(`FATAL: not found in municipalities: ${missing.join(', ')}`); process.exit(1); }
  return map;
}

async function readBudgets(db, entities) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('budgets')
      .select('id, municipality_id, fiscal_year, fiscal_year_start_month, data_source, dataset_type, total_budget')
      .in('municipality_id', [...entities.keys()])
      .order('municipality_id', { ascending: true })
      .order('id', { ascending: true })            // guard (b): PK last
      .range(from, from + PAGE - 1);
    if (error) { console.error('FATAL: budgets read failed:', error.message); process.exit(1); }
    for (const r of data ?? []) rows.push({ ...r, entity: entities.get(r.municipality_id) });
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function writeBatch(db, ids, month) {
  let written = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { data, error } = await db
      .from('budgets')
      .update({ fiscal_year_start_month: month })
      .in('id', slice)
      .eq('fiscal_year_start_month', WRONG_MONTH)   // guard (c): re-assert the old value
      .select('id');
    if (error) { console.error('FATAL: update failed:', error.message); process.exit(1); }
    if (data.length !== slice.length) {
      console.error(`FATAL: updated ${data.length} of ${slice.length} — a row changed underneath this run. Nothing further written.`);
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

  const entities = await loadCities(db);
  const rows = await readBudgets(db, entities);
  const digestBefore = figureDigest(rows);
  console.log(`Cities: ${entities.size}   budget rows: ${rows.length}   figure digest: ${digestBefore}`);

  const updates = [];
  const errors = [];
  const tally = new Map(CITIES.map((c) => [c, { update: 0, correct: 0, protected: 0 }]));
  for (const row of rows) {
    const v = classify(row);
    if (v.error) { errors.push(`${row.entity?.name ?? '?'} FY${row.fiscal_year} [${row.id}]: ${v.error}`); continue; }
    tally.get(row.entity.name)[v.action]++;
    if (v.action === 'update') updates.push({ row, month: v.month });
  }

  if (errors.length) {
    console.error(`\nFATAL: ${errors.length} row(s) could not be classified. Nothing written.`);
    for (const e of errors.slice(0, 20)) console.error(`  ${e}`);
    process.exit(1);
  }

  console.log('\nPer city (guard e — counted against the recorded baseline):');
  let mismatch = false;
  for (const city of CITIES) {
    const t = tally.get(city);
    const b = BASELINE[city];
    const ok = t.update === (verifyOnly ? 0 : b.toFix)
      && t.protected === b.protectedAt1
      && t.correct === (verifyOnly ? b.toFix + b.staysAt7 : b.staysAt7);
    if (!ok) mismatch = true;
    console.log(`  ${city.padEnd(18)} update ${String(t.update).padStart(3)}  already-correct ${String(t.correct).padStart(3)}  `
      + `protected@1 ${String(t.protected).padStart(3)}   ${ok ? 'as baselined' : '⚠ DIFFERS FROM BASELINE'}`);
  }
  if (mismatch) {
    console.error('\nFATAL: the row set does not match the baseline measured on 2026-08-27.');
    console.error('Do NOT widen the baseline to fit. Find out what changed first — a sweep whose');
    console.error('scope moved silently is the exact failure this arc exists to prevent.');
    process.exit(1);
  }

  const protectedRows = rows.filter((r) => PROTECTED_SOURCE.test(r.data_source ?? ''));
  console.log(`\nProtected calendar-year rows found at ${CALENDAR_YEAR_MONTH}: ${protectedRows.length} (guard d)`);

  if (verifyOnly) {
    console.log('\n✅ VERIFY: every row already holds its evidenced month; protections intact.');
    return;
  }
  if (!apply) {
    console.log(`\nDRY RUN — ${updates.length} rows would move ${WRONG_MONTH} -> ${TARGET_MONTH}. Re-run with --apply.`);
    for (const city of CITIES) {
      const yrs = updates.filter((u) => u.row.entity.name === city).map((u) => u.row.fiscal_year);
      if (yrs.length) console.log(`  ${city}: FY${Math.min(...yrs)}-FY${Math.max(...yrs)}`);
    }
    return;
  }

  const written = await writeBatch(db, updates.map((u) => u.row.id), TARGET_MONTH);
  console.log(`\nWrote ${written} rows.`);

  const after = await readBudgets(db, entities);
  const digestAfter = figureDigest(after);
  if (digestAfter !== digestBefore) {
    console.error(`FATAL: figures moved. ${digestBefore} -> ${digestAfter}`);
    process.exit(1);
  }
  const stillWrong = after.filter((r) => !PROTECTED_SOURCE.test(r.data_source ?? '')
    && Number(r.fiscal_year_start_month) !== monthForEntry(fiscalExceptionFor(r.entity.name, 'CA'), Number(r.fiscal_year)).month);
  const protectedAfter = after.filter((r) => PROTECTED_SOURCE.test(r.data_source ?? '')
    && Number(r.fiscal_year_start_month) === CALENDAR_YEAR_MONTH);
  console.log(`Rows still not holding their evidenced month: ${stillWrong.length}`);
  console.log(`Protected rows still at ${CALENDAR_YEAR_MONTH}: ${protectedAfter.length} (was ${protectedRows.length})`);
  if (stillWrong.length || protectedAfter.length !== protectedRows.length) {
    console.error('FATAL: post-write state is not what was intended.');
    process.exit(1);
  }
  console.log(`\n✅ ${written} rows corrected, 0 figures moved (digest ${digestAfter}).`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fixCACityFiscalYearMonths.mjs')) {
  await main();
}
