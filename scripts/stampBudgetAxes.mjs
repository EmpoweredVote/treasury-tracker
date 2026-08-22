#!/usr/bin/env node
/**
 * SCOPE-02 — stamp `basis` and `reporting_entity` onto treasury.budgets.
 *
 * Classification is PER SOURCE, so the unit of work is a data_source string,
 * never a row. Mirrors scripts/classifyFundScope.mjs, including its partition
 * gate: before writing anything, assert each entry claims exactly the row count
 * measured at plan time and that claimed + unknown = the table total.
 *
 * ⚠ Do NOT edit an EXPECTED_* number to make the gate pass. The gate failing
 * means a pattern changed behaviour or the table changed underneath, and either
 * needs explaining before a number moves.
 *
 * ── THE UNCLOSED-YEAR RULE ──────────────────────────────────────────────────
 * No row may be `actual` for a fiscal year that has not closed. Several cities
 * carry FY2026 adopted budgets; if a pattern ever claimed one as an actual this
 * would catch it before the write, not after.
 *
 * Usage:
 *   node scripts/stampBudgetAxes.mjs --dry-run
 *   node scripts/stampBudgetAxes.mjs
 *   node scripts/stampBudgetAxes.mjs --reset
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (source .env first).
 */

import { parseArgs } from 'node:util';
import {
  BASIS, BASIS_VALUES, REPORTING_ENTITY, REPORTING_ENTITY_VALUES,
  classifyAxis, validateAxisRegistry,
} from './lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from './data/basisRegistry.mjs';
import { REPORTING_ENTITY_REGISTRY } from './data/reportingEntityRegistry.mjs';

/** Measured 2026-08-17. See plan Task 3 Step 1 for the query that produced them. */
export const EXPECTED_BASIS_ROWS = Object.freeze({
  // ⚠ +10 and +2 against the 2026-08-17 measurements of 10438 / 10446 — the SAME
  // drift, from the same cause, that `classifyFundScope.mjs`'s EXPECTED_ROWS was
  // already corrected for. That file was updated and this one was not, so this
  // gate has been failing on these two entries ever since, independently of any
  // new entry.
  //
  // Cause: SCOPE-02 Task 10 backfilled 12 State Controller rows (Fresno
  // operating FY2020-24, Riverside FY2023-24, Oakland FY2024, Santa Ana
  // operating+revenue FY2023-24). Re-verified against the live table on
  // 2026-08-19 rather than taken on trust: selecting the 12 ids in
  // scripts/data/scope02CreatedIds.json returns exactly 12 rows, splitting
  // 10 "CA State Controller - Expenditures" + 2 "CA State Controller -
  // Revenues" — precisely the overage, with nothing left over. Neither pattern
  // changed; both are byte-identical to SCOPE-01's.
  // ⚠ +4 each against 10448: LA-02 loaded the State Controller's already-published
  // FY2021-2024 for Los Angeles City (4 expenditure + 4 revenue rows). Those years
  // had been sitting under a `Socrata: https://data.lacity.org` label — the revenue
  // figures were the State Controller's all along, dollar-identical in all 4 years.
  // Verified against the live table: the two sources now count 10452 / 10452, exactly
  // +4 / +4, with nothing else moved. Evidence: LA-02-SCOPING.md §2.
  'ca-sco-city-exp': 10452,
  'ca-sco-city-rev': 10452,
  // SCOPE-04 — the derived Total Governmental rows. basis='actual', INHERITED from
  // the parent all_funds rows (all 7,664 eligible were measured uniformly actual);
  // summing a subset of a row's own roots cannot change the basis of the figure.
  // 7,650 = 7,664 eligible − 8 quarantined − 6 excluded, from the post-write count.
  // ⚠ See the note in classifyFundScope.mjs EXPECTED_ROWS: never run this gate
  // while a load is in flight, or LIMIT/OFFSET paging invents drift.
  'ca-sco-derived-tg': 7650,
  'ca-sco-county-exp': 1188,
  'ca-sco-county-rev': 1188,
  'wa-sao': 286,
  'state-acfr-gf': 1448,
  'mn-osa': 21794,
  'oh-aos': 6616,
  'city-adopted-budget-doc': 165,
  // AUSTIN-TRAVIS-01, measured 2026-08-19: Austin 32 + Travis County 44. A NEW
  // family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/AUSTIN-TRAVIS-01-SCOPE-RECON.md §2.
  'tx-local-acfr-gf': 76,
  // CO-SPRINGS-EPC-01, measured 2026-08-21: Colorado Springs 28 + El Paso
  // County 36. A NEW family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md section 6.
  'co-local-acfr-gf': 64,
  // The sixteen entity-published city/state ACFR families, measured 2026-08-19.
  // Evidence: docs/superpowers/plans/ACFR-GF-CLASSIFICATION-RECON.md §2.
  'or-city-acfr-gf': 106,
  'az-muni-acfr-gf': 64,
  'seattle-city-acfr-gf': 34,
  'state-acfr-gf-by-name': 56,
});

export const EXPECTED_REPORTING_ENTITY_ROWS = Object.freeze({
  'mn-osa': 21794,
  'state-acfr-gf': 1448,
  'wa-sao': 286,
  // AUSTIN-TRAVIS-01. Evidence: AUSTIN-TRAVIS-01-SCOPE-RECON.md §3.
  'tx-local-acfr-gf': 76,
  // CO-SPRINGS-EPC-01, measured 2026-08-21: Colorado Springs 28 + El Paso
  // County 36. A NEW family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md section 6.
  'co-local-acfr-gf': 64,
  // The sixteen entity-published city/state ACFR families.
  // Evidence: ACFR-GF-CLASSIFICATION-RECON.md §3.
  'or-city-acfr-gf': 106,
  'az-muni-acfr-gf': 64,
  'seattle-city-acfr-gf': 34,
  'state-acfr-gf-by-name': 56,
});

/** The last fiscal year that has closed. A row after this cannot be an actual. */
const LAST_CLOSED_FY = 2025;

const IN_CHUNK = 200;

let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env). Use --dry-run for a no-write pass.');
    process.exit(1);
  }
  _supabase = createClient(url, key);
  return _supabase;
}

/** Every distinct (data_source, fiscal_year) with its row count. Paged. */
async function fetchSourceYearCounts(supabase) {
  const counts = new Map(); // data_source -> { rows, years: Map<fy, n> }
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .schema('treasury').from('budgets')
      .select('data_source, fiscal_year')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch data_source: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) {
      if (!counts.has(r.data_source)) counts.set(r.data_source, { rows: 0, years: new Map() });
      const g = counts.get(r.data_source);
      g.rows += 1;
      g.years.set(r.fiscal_year, (g.years.get(r.fiscal_year) ?? 0) + 1);
    }
    if (data.length < PAGE) break;
  }
  return counts;
}

function planAxis(counts, registry, legalValues, unknownValue, expected, axisName) {
  const byEntry = new Map();
  let unknownRows = 0;
  const unknownStrings = new Set();
  const violations = [];

  for (const [source, g] of counts) {
    const { value, entryId } = classifyAxis(source, registry, legalValues, unknownValue);
    if (!entryId) {
      unknownRows += g.rows;
      unknownStrings.add(source);
      continue;
    }
    if (!byEntry.has(entryId)) byEntry.set(entryId, { value, rows: 0, strings: [] });
    const e = byEntry.get(entryId);
    e.rows += g.rows;
    e.strings.push(source);

    // The unclosed-year rule.
    if (axisName === 'basis' && value === BASIS.ACTUAL) {
      for (const [fy, n] of g.years) {
        if (fy > LAST_CLOSED_FY) violations.push({ source, fy, rows: n, entryId });
      }
    }
  }

  const mismatches = [];
  for (const [id, want] of Object.entries(expected)) {
    const got = byEntry.get(id)?.rows ?? 0;
    if (got !== want) mismatches.push({ id, want, got });
  }
  for (const id of byEntry.keys()) {
    if (!(id in expected)) mismatches.push({ id, want: 0, got: byEntry.get(id).rows });
  }

  return { byEntry, unknownRows, unknownStrings, mismatches, violations };
}

function report(axisName, plan, totalRows) {
  console.log(`\n── ${axisName} ──`);
  const claimed = [...plan.byEntry.values()].reduce((a, e) => a + e.rows, 0);
  for (const [id, e] of [...plan.byEntry].sort((a, b) => b[1].rows - a[1].rows)) {
    console.log(`  ${id.padEnd(26)} ${e.value.padEnd(22)} ${String(e.rows).padStart(6)} rows  ${e.strings.length} strings`);
  }
  console.log(`  ${'unknown'.padEnd(26)} ${''.padEnd(22)} ${String(plan.unknownRows).padStart(6)} rows  ${plan.unknownStrings.size} strings`);
  console.log(`  claimed ${claimed.toLocaleString()} + unknown ${plan.unknownRows.toLocaleString()} = ${(claimed + plan.unknownRows).toLocaleString()} / ${totalRows.toLocaleString()}`);
  return claimed;
}

async function writeAxis(supabase, column, plan) {
  for (const [id, e] of plan.byEntry) {
    for (let i = 0; i < e.strings.length; i += IN_CHUNK) {
      const chunk = e.strings.slice(i, i + IN_CHUNK);
      const { error } = await supabase
        .schema('treasury').from('budgets')
        .update({ [column]: e.value })
        .in('data_source', chunk);
      if (error) throw new Error(`write ${column} for ${id}: ${error.message}`);
    }
    console.log(`  wrote ${column}=${e.value} for ${id} (${e.rows} rows)`);
  }
}

async function main() {
  const { values: argv } = parseArgs({
    options: { 'dry-run': { type: 'boolean' }, reset: { type: 'boolean' }, force: { type: 'boolean' } },
  });

  for (const [name, reg, vals, unk] of [
    ['basis', BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN],
    ['reporting_entity', REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES, REPORTING_ENTITY.UNKNOWN],
  ]) {
    const v = validateAxisRegistry(reg, vals, unk);
    if (!v.ok) {
      console.error(`✗ ${name} registry invalid:`, JSON.stringify(v, null, 2));
      process.exit(1);
    }
  }

  const supabase = await getSupabase();

  if (argv.reset) {
    const { error } = await supabase.schema('treasury').from('budgets')
      .update({ basis: 'unknown', reporting_entity: 'unknown' })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw new Error(`reset: ${error.message}`);
    console.log('reset: every row back to unknown/unknown');
    return;
  }

  const counts = await fetchSourceYearCounts(supabase);
  const totalRows = [...counts.values()].reduce((a, g) => a + g.rows, 0);
  console.log(`read ${counts.size} distinct data_source strings over ${totalRows.toLocaleString()} rows`);

  const basisPlan = planAxis(counts, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN, EXPECTED_BASIS_ROWS, 'basis');
  const entityPlan = planAxis(counts, REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES,
    REPORTING_ENTITY.UNKNOWN, EXPECTED_REPORTING_ENTITY_ROWS, 'reporting_entity');

  report('basis', basisPlan, totalRows);
  report('reporting_entity', entityPlan, totalRows);

  if (basisPlan.violations.length) {
    console.error(`\n✗ UNCLOSED-YEAR RULE: ${basisPlan.violations.length} source-years would be stamped 'actual' for a fiscal year after FY${LAST_CLOSED_FY}:`);
    for (const v of basisPlan.violations.slice(0, 20)) {
      console.error(`    ${v.entryId}  FY${v.fy}  ${v.rows} rows  ${v.source}`);
    }
    process.exit(1);
  }

  const allMismatches = [...basisPlan.mismatches.map((m) => ({ axis: 'basis', ...m })),
    ...entityPlan.mismatches.map((m) => ({ axis: 'reporting_entity', ...m }))];
  if (allMismatches.length) {
    console.error('\n✗ PARTITION GATE FAILED — an entry did not claim what was measured:');
    for (const m of allMismatches) console.error(`    ${m.axis}/${m.id}: expected ${m.want}, got ${m.got}`);
    if (!argv.force) {
      console.error('  Fix the pattern, do NOT edit the expected number. --force overrides deliberately.');
      process.exit(1);
    }
    console.error('  --force given: proceeding despite the mismatches above.');
  } else {
    console.log('\n✅ partition gate: every entry claims exactly what was measured');
  }

  if (argv['dry-run']) {
    console.log('\n(dry run — nothing written)');
    return;
  }

  await writeAxis(supabase, 'basis', basisPlan);
  await writeAxis(supabase, 'reporting_entity', entityPlan);
  console.log('\n✅ written');
}

main().catch((e) => { console.error(e); process.exit(1); });
