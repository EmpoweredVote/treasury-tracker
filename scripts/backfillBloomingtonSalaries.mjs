/**
 * Backfill Bloomington's salary series to FY2002.
 *
 * NO SHEBANG — kept importable.
 *
 * Usage:
 *   node scripts/backfillBloomingtonSalaries.mjs --dry-run
 *   node scripts/backfillBloomingtonSalaries.mjs --commit
 *
 * The publisher serves FY2001-FY2025 in the same Socrata dataset TT already
 * syncs (`fcnf-g862`); TT held only FY2021-FY2025. This adds nineteen years of
 * closed-year actuals at no cost and from no new source.
 *
 * ── ⭐ SWAP THE YEARS, NOT THE LOADER ──────────────────────────────────────
 *
 * This script does NOT build a salary tree. It widens the source's declared
 * `fiscal_years` and then drives the SAME `treasury-sync` edge function that
 * already writes FY2021-FY2025, one year per call. `buildSalaryTree` and the
 * `treasury_sync_salary_tree` RPC are untouched, so a backfilled year cannot
 * differ in shape from a year that was already proven — the South Carolina
 * `--statewide` principle, and the reason the Dallas defect (an edge function
 * speaking a different `column_mapping` dialect from a Node loader) cannot
 * recur here.
 *
 * ⚠ The RPC's own INSERT writes `data_source = <source name>` and
 * `hierarchy = ARRAY['department','title']`, so every backfilled row matches the
 * five corrected by scripts/fixBloomingtonSalaries.mjs by construction.
 *
 * ── WHICH YEARS, AND WHY NOT ALL OF THEM ───────────────────────────────────
 *
 * FY2001 is REFUSED. Its as-of date is 2001-12-31, so the closed-year test
 * passes; only a comparison against FY2002 catches it, and that comparison is
 * unambiguous — see BLOOMINGTON_PARTIAL_YEARS. FY2026 is refused for the other
 * reason: the publisher calls the current year a PREDICTED compensation.
 *
 * ── THE ORACLE ─────────────────────────────────────────────────────────────
 *
 * Every loaded year is checked against the publisher's OWN `sum(compensation)`
 * for that as-of date — a figure computed by Socrata, not by this script and not
 * by the edge function. A year that does not tie to the cent fails the run.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import { shouldPublishYear, BLOOMINGTON_PARTIAL_YEARS } from './lib/bloomingtonSalaries.mjs';
import { MUNICIPALITY, STATE, SOURCE_NAME, SOCRATA_BASE, SOCRATA_DATASET, fetchAsOfDates }
  from './fixBloomingtonSalaries.mjs';

const SYNC_URL = 'https://kxsdzaojfaibhuzmclfq.supabase.co/functions/v1/treasury-sync';

export async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false }, commit: { type: 'boolean', default: false } },
  });
  if (!values['dry-run'] && !values.commit) { console.error('Pass --dry-run or --commit.'); process.exit(1); }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  const { data: munis } = await db.schema('treasury').from('municipalities')
    .select('id').eq('name', MUNICIPALITY).eq('state', STATE).eq('entity_type', 'city');
  if (munis?.length !== 1) throw new Error(`REFUSING: ${munis?.length ?? 0} municipalities match`);
  const municipalityId = munis[0].id;

  const { data: srcs } = await db.schema('treasury').from('data_sources')
    .select('id, fiscal_years, is_enabled').eq('municipality_id', municipalityId).eq('name', SOURCE_NAME);
  if (srcs?.length !== 1) throw new Error(`REFUSING: ${srcs?.length ?? 0} sources named "${SOURCE_NAME}"`);
  const source = srcs[0];
  if (!source.is_enabled) throw new Error(`REFUSING: "${SOURCE_NAME}" is disabled; a sync would not run`);

  // The publisher decides which years exist and which are closed.
  const published = await fetchAsOfDates();
  const decisions = published.map((p) => ({ ...p, ...shouldPublishYear(p.fiscalYear, p.asOfDate) }));
  const publishable = decisions.filter((d) => d.publish).map((d) => d.fiscalYear).sort((a, b) => a - b);
  const refused = decisions.filter((d) => !d.publish);

  console.log(`publisher serves ${published.length} as-of dates`);
  for (const r of refused) console.log(`  REFUSING FY${r.fiscalYear}: ${r.reason.slice(0, 110)}`);

  // ⚠ A declared partial year that the publisher no longer serves is stale.
  for (const p of BLOOMINGTON_PARTIAL_YEARS) {
    if (!published.some((x) => x.fiscalYear === p.year)) {
      throw new Error(`REFUSING: FY${p.year} is declared partial but the publisher no longer serves it`);
    }
  }

  const { data: have } = await db.schema('treasury').from('budgets')
    .select('fiscal_year').eq('municipality_id', municipalityId).eq('dataset_type', 'salaries');
  const held = new Set((have ?? []).map((r) => Number(r.fiscal_year)));
  const missing = publishable.filter((y) => !held.has(y));

  console.log(`\npublishable ${publishable.length} (FY${publishable[0]}-FY${publishable[publishable.length - 1]})`
    + `  held ${held.size}  to load ${missing.length}`);
  if (!missing.length) { console.log('Nothing to backfill — already complete.'); return; }
  console.log(`  ${missing.join(', ')}`);

  if (!values.commit) { console.log('\nDry run — nothing written.'); return; }

  // Widen the declared years FIRST: the edge function reads `fiscal_years` from
  // the source config, and refuses a year the source does not declare.
  const wanted = [...new Set([...(source.fiscal_years ?? []).map(Number), ...publishable])].sort((a, b) => a - b);
  const { error: uErr } = await db.schema('treasury').from('data_sources')
    .update({ fiscal_years: wanted }).eq('id', source.id);
  if (uErr) throw new Error(`widen fiscal_years: ${uErr.message}`);
  console.log(`\nsource fiscal_years -> [${wanted[0]}..${wanted[wanted.length - 1]}] (${wanted.length} years)`);

  const { data: syncKey, error: kErr } = await db.rpc('treasury_get_sync_key');
  if (kErr || !syncKey) throw new Error(`REFUSING: could not read the sync key (${kErr?.message ?? 'empty'})`);

  const byYear = new Map(published.map((p) => [p.fiscalYear, p]));
  let loaded = 0;
  for (const fy of missing) {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': syncKey },
      // ⚠ `triggered_by` IS CHECK-CONSTRAINED. sync_logs allows only
      // scheduler|manual|webhook|backfill|bulk_load|cursor_resume|cron|debug.
      // An invented value fetches every row correctly and then fails on the
      // LOG insert, which is how the first run of this script wrote nothing.
      body: JSON.stringify({ data_source_id: source.id, fiscal_year: fy, triggered_by: 'backfill' }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`FY${fy}: sync HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);

    // ⚠⚠ A 200 IS NOT SUCCESS. The edge function reports per-YEAR failure inside
    // its body and still answers 200 — the same shape as the RPC that "returns
    // failure in its return payload, not as a PostgREST error" and let the
    // Georgia loader print "Wrote 76 budget rows" having written none. The first
    // run of this script hit exactly that: 767 rows fetched, 0 inserted, HTTP
    // 200. Counting attempts is not counting writes.
    const failures = (body.results ?? []).filter((r) => r.error);
    if (failures.length) {
      throw new Error(`FY${fy}: sync reported ${failures.length} failure(s) inside a 200 — `
        + failures.map((f) => f.error).join('; ').slice(0, 300));
    }
    if (!body.results?.length) throw new Error(`FY${fy}: sync returned no results. Nothing was measured.`);

    // ⚠⚠ THE ORACLE IS THE PUBLISHER'S OWN SUM, not this script's and not the
    // edge function's. Socrata computed it server-side from the same rows.
    const { data: rows } = await db.schema('treasury').from('budgets')
      .select('total_budget::text, data_source, hierarchy')
      .eq('municipality_id', municipalityId).eq('dataset_type', 'salaries').eq('fiscal_year', fy);
    if (rows?.length !== 1) throw new Error(`FY${fy}: ${rows?.length ?? 0} rows after sync, expected 1`);
    const stored = Math.round(Number(rows[0].total_budget) * 100);
    const expected = Math.round(byYear.get(fy).total * 100);
    if (stored !== expected) {
      throw new Error(`FY${fy}: stored ${(stored / 100).toLocaleString()} != publisher `
        + `${(expected / 100).toLocaleString()} (delta ${((stored - expected) / 100).toFixed(2)})`);
    }
    if (rows[0].data_source !== SOURCE_NAME) throw new Error(`FY${fy}: data_source is "${rows[0].data_source}"`);
    loaded += 1;
    console.log(`  FY${fy}  ${Number(rows[0].total_budget).toLocaleString().padStart(14)}  `
      + `${String(byYear.get(fy).employees).padStart(5)} employees  ties the publisher to the cent`);
  }

  console.log(`\nloaded ${loaded} of ${missing.length}.`);
  if (loaded !== missing.length) process.exit(1);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('backfillBloomingtonSalaries.mjs');
if (invokedDirectly) main().catch((e) => { console.error(e.message); process.exit(1); });
