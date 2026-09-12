/**
 * Correct Bloomington's salaries provenance, and stop publishing the open year.
 *
 * NO SHEBANG — kept importable.
 *
 * Usage:
 *   node scripts/fixBloomingtonSalaries.mjs --dry-run
 *   node scripts/fixBloomingtonSalaries.mjs --commit
 *
 * ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
 *
 * 1. FY2021-FY2025 carried `data_source = 'data/checkbook-all.csv'` — a path on
 *    somebody's disk, rendered to readers as the provenance of the figure.
 * 2. The same rows carried `hierarchy = ['department','position_type']` while
 *    the stored tree is grouped by TITLE ("Sergeant", "Telecommunicator") and
 *    the source's own `column_mapping` declares `["department","title"]`.
 * 3. FY2026 is a PREDICTION in the publisher's own words, refreshed nightly.
 *
 * ⚠⚠ 1 AND 2 PERSISTED BECAUSE THE RPC NEVER REWRITES THEM.
 * `treasury_sync_city_budget` updates `total_budget`, `source_url` and
 * `source_date` and leaves `data_source` and `hierarchy` as first written. That
 * is why the labels went stale while the numbers stayed fresh — and why fixing
 * them here is permanent rather than something Sunday's sync will undo.
 *
 * ⚠⚠ 3 NEEDS TWO CHANGES, NOT ONE. Deleting the FY2026 row alone is undone by
 * the next sync, because the source still DECLARES 2026 in `fiscal_years`. The
 * year is removed from the source first, so the row cannot come back.
 *
 * ── WHAT IT REFUSES ────────────────────────────────────────────────────────
 *
 * The open year is identified from the PUBLISHER's `asofdate`, never from a
 * hardcoded year: a closed year is dated `YYYY-12-31`, and Bloomington's current
 * year carries the date it was last refreshed. If the live dataset ever reports
 * that the year in question has closed, this script refuses to delete it.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import { isFilesystemPathLabel, isClosedYearAsOf } from './lib/bloomingtonSalaries.mjs';

export const MUNICIPALITY = 'Bloomington';
export const STATE = 'IN';
export const SOURCE_NAME = 'Bloomington Annual Compensation';
export const SOCRATA_BASE = 'https://data.bloomington.in.gov';
export const SOCRATA_DATASET = 'fcnf-g862';
export const CORRECT_HIERARCHY = ['department', 'title'];

/** One row per as-of date, straight from the publisher. */
export async function fetchAsOfDates() {
  const url = `${SOCRATA_BASE}/resource/${SOCRATA_DATASET}.json`
    + '?$select=asofdate,count(1) AS n,sum(compensation) AS total&$group=asofdate&$order=asofdate';
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Socrata ${res.status} for ${SOCRATA_DATASET}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('REFUSING: the publisher returned no as-of dates. Nothing was measured.');
  }
  return rows.map((r) => ({
    asOfDate: String(r.asofdate),
    fiscalYear: Number(String(r.asofdate).slice(0, 4)),
    employees: Number(r.n),
    total: Number(r.total),
  }));
}

export async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false }, commit: { type: 'boolean', default: false } },
  });
  if (!values['dry-run'] && !values.commit) { console.error('Pass --dry-run or --commit.'); process.exit(1); }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  const { data: munis, error: mErr } = await db.schema('treasury').from('municipalities')
    .select('id').eq('name', MUNICIPALITY).eq('state', STATE).eq('entity_type', 'city');
  if (mErr) throw new Error(mErr.message);
  if (munis?.length !== 1) throw new Error(`REFUSING: ${munis?.length ?? 0} municipalities match ${MUNICIPALITY}, ${STATE}`);
  const municipalityId = munis[0].id;

  const { data: rows, error: bErr } = await db.schema('treasury').from('budgets')
    .select('id, fiscal_year, data_source, hierarchy, total_budget::text')
    .eq('municipality_id', municipalityId).eq('dataset_type', 'salaries').order('fiscal_year');
  if (bErr) throw new Error(bErr.message);
  if (!rows?.length) throw new Error('REFUSING: no Bloomington salaries rows. Nothing was measured.');

  // ⚠ The publisher decides which years are closed, not this script.
  const published = await fetchAsOfDates();
  const asOfByYear = new Map(published.map((p) => [p.fiscalYear, p]));
  console.log(`publisher serves ${published.length} as-of dates, FY${published[0].fiscalYear}-FY${published[published.length - 1].fiscalYear}`);

  const relabel = [];
  const rehierarchy = [];
  const remove = [];
  for (const r of rows) {
    const pub = asOfByYear.get(r.fiscal_year);
    if (!pub) { console.log(`  FY${r.fiscal_year}: publisher no longer serves this year — left alone`); continue; }
    const closed = isClosedYearAsOf(pub.asOfDate, r.fiscal_year);
    if (!closed) {
      remove.push({ ...r, asOfDate: pub.asOfDate, liveTotal: pub.total, employees: pub.employees });
      continue;
    }
    if (isFilesystemPathLabel(r.data_source)) relabel.push(r);
    const h = Array.isArray(r.hierarchy) ? r.hierarchy : [];
    if (h.join('|') !== CORRECT_HIERARCHY.join('|')) rehierarchy.push(r);
  }

  console.log(`\nrows ${rows.length}  relabel ${relabel.length}  re-hierarchy ${rehierarchy.length}  remove ${remove.length}`);
  for (const r of relabel) console.log(`  relabel  FY${r.fiscal_year}  "${r.data_source}" -> "${SOURCE_NAME}"`);
  for (const r of rehierarchy) console.log(`  hierarchy FY${r.fiscal_year}  [${(r.hierarchy ?? []).join(', ')}] -> [${CORRECT_HIERARCHY.join(', ')}]`);
  for (const r of remove) {
    console.log(`  REMOVE   FY${r.fiscal_year}  as-of ${r.asOfDate.slice(0, 10)} — the publisher calls the current year PREDICTED`);
    console.log(`             stored ${Number(r.total_budget).toLocaleString()} vs live ${r.liveTotal.toLocaleString()} over ${r.employees} employees`);
  }

  // ⚠ A GATE THAT CAN MEASURE NOTHING MUST FAIL. If there is genuinely nothing
  // to do, say so and stop — but never report success from zero checks.
  if (!relabel.length && !rehierarchy.length && !remove.length) {
    console.log('\nNothing to change — already correct.');
    return;
  }
  if (remove.length > 1) {
    throw new Error(`REFUSING: ${remove.length} open years. Only the current year should ever be open; check the publisher.`);
  }

  if (!values.commit) { console.log('\nDry run — nothing written.'); return; }

  // ⚠⚠ ORDER MATTERS. Narrow the SOURCE first: deleting the row while the
  // source still declares the year means Sunday's sync re-creates it.
  for (const r of remove) {
    const { data: srcs, error: sErr } = await db.schema('treasury').from('data_sources')
      .select('id, fiscal_years').eq('municipality_id', municipalityId).eq('name', SOURCE_NAME);
    if (sErr) throw new Error(sErr.message);
    if (srcs?.length !== 1) throw new Error(`REFUSING: ${srcs?.length ?? 0} sources named "${SOURCE_NAME}"`);
    const years = (srcs[0].fiscal_years ?? []).filter((y) => Number(y) !== r.fiscal_year);
    const { error: uErr } = await db.schema('treasury').from('data_sources')
      .update({ fiscal_years: years }).eq('id', srcs[0].id);
    if (uErr) throw new Error(uErr.message);
    console.log(`  source fiscal_years -> [${years.join(', ')}]`);

    for (const table of ['budget_line_items', 'budget_categories']) {
      if (table === 'budget_line_items') {
        const { data: cats } = await db.schema('treasury').from('budget_categories').select('id').eq('budget_id', r.id);
        const ids = (cats ?? []).map((c) => c.id);
        if (ids.length) {
          const { error } = await db.schema('treasury').from('budget_line_items').delete().in('category_id', ids);
          if (error) throw new Error(`delete line items: ${error.message}`);
        }
      } else {
        const { error } = await db.schema('treasury').from(table).delete().eq('budget_id', r.id);
        if (error) throw new Error(`delete ${table}: ${error.message}`);
      }
    }
    const { error: dErr } = await db.schema('treasury').from('budgets').delete().eq('id', r.id);
    if (dErr) throw new Error(`delete budget: ${dErr.message}`);
    console.log(`  deleted FY${r.fiscal_year} (${r.id})`);
  }

  for (const r of relabel) {
    const { error } = await db.schema('treasury').from('budgets')
      .update({ data_source: SOURCE_NAME }).eq('id', r.id);
    if (error) throw new Error(`relabel FY${r.fiscal_year}: ${error.message}`);
  }
  for (const r of rehierarchy) {
    const { error } = await db.schema('treasury').from('budgets')
      .update({ hierarchy: CORRECT_HIERARCHY }).eq('id', r.id);
    if (error) throw new Error(`hierarchy FY${r.fiscal_year}: ${error.message}`);
  }
  console.log(`\nrelabelled ${relabel.length}, re-hierarchied ${rehierarchy.length}, removed ${remove.length}.`);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fixBloomingtonSalaries.mjs');
if (invokedDirectly) main().catch((e) => { console.error(e.message); process.exit(1); });
