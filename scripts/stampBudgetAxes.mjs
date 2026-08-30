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
  // RE-MEASURED 2026-08-28: 165 -> 169. The four extra rows are San Francisco
  // FY2027 + FY2028 x {operating, revenue}, arriving from its ENABLED cron sync
  // between milestones. Strings (129) and entities (30) are unchanged, so the
  // pattern still claims exactly the right rows — there are simply more of them.
  // See the evidence block in scripts/data/basisRegistry.mjs.
  //
  // ⚠⚠ RE-MEASURED AGAIN 2026-08-29: 169 -> 171, ONE DAY LATER, and the cause is
  // the same shape as the previous +4 but a DIFFERENT city. The two extra rows
  // are `Los Angeles Operating Budget` FY2025 + FY2026, created by that source's
  // ENABLED cron sync at 03:07 UTC on 2026-08-29 — after session 2 verified the
  // frozen invariant green at 79,916.
  //
  // ATTRIBUTED EXACTLY, not inferred. Two independent measurements agree:
  //   (a) The frozen-invariant digest as an oracle. Excluding ids
  //       804fd360-8d0e-4ed2-ad17-3d4c67ad9e0f (FY2025, $19,340,363,947.28) and
  //       9d9205b9-f920-43c7-9452-a5b958df6e35 (FY2026, $20,853,668,993.02)
  //       reproduces scopeBaseline.figures_frozen byte-for-byte; no other pair
  //       in the candidate set does. Registered as
  //       scripts/data/laOperatingCronDriftCreatedIds.json.
  //   (b) This gate, arrived at from the opposite direction: exactly 2 rows of
  //       `Los Angeles Operating Budget` match this pattern, FY2025-FY2026.
  //
  // ⚠ The Knight session-3 Florida load ran in the same session and CANNOT be
  // the cause: its 190 rows carry no "Budget" in their source strings, so this
  // pattern cannot reach them, and they are counted separately under
  // `fl-dfs-afr` below.
  //
  // ⚠ THE STANDING LESSON, now observed twice in two days: a partition count is
  // a MEASUREMENT WITH A DATE, not a constant, and the milestone that trips over
  // an enabled sync's drift will be an UNRELATED one. Re-measure with evidence;
  // the "do NOT edit the expected number" rule is about a pattern claiming the
  // WRONG rows, not about the right rows becoming more numerous.
  //
  // ✅ RESOLVED 2026-08-29 (PR #111), and this count is BACK TO 169. Both halves
  // were done: `Los Angeles Operating Budget` is now `is_enabled = false`, so the
  // cron can no longer re-create rows here; and the two rows it had already made
  // were deleted by decision (migrations 20260829000000 + 20260829000100).
  //
  // ⚠ CORRECTED against the live DB before deleting: an earlier version of this
  // note said those rows were `basis: unknown`. They were `basis: adopted` —
  // which is WHY they landed in this partition at all. A row with `basis:
  // unknown` could not have moved this count. `fund_scope: unknown` is the
  // separate axis that kept them out of the rendered series.
  //
  // 171 -> 169 is a RETURN to the pre-drift measurement, not a new one. Deleting
  // was frozen-invariant NEUTRAL (79,916 / 90f009fe... before and after): the
  // ids were already in laOperatingCronDriftCreatedIds.json, so the digest had
  // always filtered them out. Backup:
  // .planning/backups/la-city/la-operating-cron-drift-fy2025-2026.json.gz.
  'city-adopted-budget-doc': 169,
  // AUSTIN-TRAVIS-01, measured 2026-08-19: Austin 32 + Travis County 44. A NEW
  // family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/AUSTIN-TRAVIS-01-SCOPE-RECON.md §2.
  'tx-local-acfr-gf': 76,
  // CO-SPRINGS-EPC-01, measured 2026-08-21: Colorado Springs 28 + El Paso
  // County 36. A NEW family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md section 6.
  'co-local-acfr-gf': 64,
  // NC-DURHAM-AVL-01, measured 2026-08-25: City of Durham 32 + Durham County 42
  // + City of Asheville 28 + Buncombe County 36. A NEW family, so no
  // pre-existing count moved.
  // ⚠ This count moved TWICE after the first load, both times because a series
  // that looked complete was not. 116 -> 134: Asheville rose 10 -> 28 when nine
  // years the city had DELINKED (not deleted) were recovered from Wayback
  // snapshots of its own page. 134 -> 138: Buncombe rose 32 -> 36 when FY2009
  // and FY2010, recorded as "never published", turned out to sit under a FOURTH
  // naming convention (cafr09/cafr.pdf, cafr10/CAFR10.pdf) that is live on the
  // county's own host. Both times the partition gate REFUSED THE WRITE first.
  // Remaining exclusions are documented per entity in ncAcfrSources.mjs.
  // Evidence: docs/superpowers/plans/NC-DURHAM-AVL-01-CLOSEOUT.md section 6.
  'nc-local-acfr-gf': 210,
  // Knight session 6a (South Carolina's first two cities), measured from the
  // ACTUAL post-write count on 2026-08-30. A NEW family, so no pre-existing
  // count moved. 38 = 19 entity-years x 2 datasets: Myrtle Beach FY2016-FY2025
  // and Columbia FY2016-FY2018 + FY2020-FY2025.
  // ⚠ Columbia FY2019 is absent BY DECISION — both surviving copies of that
  // ACFR are scans and the only text layer is defective OCR. See the fuller note
  // on the same id in scripts/classifyFundScope.mjs.
  'sc-local-acfr-gf': 38,
  // Knight session 6b (Tennessee's first local entity), measured from the ACTUAL
  // post-write count on 2026-08-30. 20 = 10 fiscal years x 2 datasets, ONE
  // consolidated entity. See the fuller note on the same id in
  // scripts/classifyFundScope.mjs.
  'tn-local-acfr-gf': 20,
  // Knight session 3 (Florida DFS), measured from the ACTUAL post-write count on
  // 2026-08-29. A NEW family, so no pre-existing count moved. 190 = 95
  // entity-years x 2 datasets over 28 source strings; three of the 98 possible
  // entity-years are absent because Miami-Dade, Leon and Bradenton had not filed
  // FY2025 when the workbooks were fetched. See the note in
  // scripts/classifyFundScope.mjs for why that number may legitimately rise.
  'fl-dfs-afr': 190,
  // Knight session 4 (Georgia DCA RLGF), measured from the ACTUAL post-write
  // count on 2026-08-29. A NEW family, so no pre-existing count moved.
  // 76 = 38 entity-years x 2 datasets, over 44 source strings — more strings per
  // row than Florida because the GA label carries the per-year AUDIT BRANCH as
  // well as the fiscal year.
  // ⚠ The 38 are not 4 entities x 10 years: DCA's own listing has no Macon-Bibb
  // FY2024 and no Milledgeville FY2018, and this load covers FY2016+ only
  // (FY2009-2015 is a different form generation). Those gaps are the
  // publisher's, not fetch failures.
  // ⚠ This count WILL rise when the FY2009-2015 follow-up or the statewide
  // sweep lands. Re-measure with evidence then; a partition count is a
  // measurement with a date, not a constant.
  'ga-dca-rlgf': 76,
  // Knight session 7a (Michigan Treasury F-65), measured from the ACTUAL
  // post-write count on 2026-08-30. A NEW family, so no pre-existing count
  // moved. 128 = 32 entity-years x 2 dataset types x 2 FUND SCOPES — Detroit and
  // Wayne County, FY2010-FY2025 with no gaps in either series.
  // ⚠ Unlike the fund-scope registry, basis does not split by scope: both series
  // are `actual`, so ONE entry claims all 128.
  'mi-treasury-f65': 128,
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
  // Knight session 3 (Florida DFS), measured 2026-08-29. Same 190 rows as the
  // basis entry above; primary_government because DFS publishes discretely
  // presented component units in their own twelfth fund column and TT sums only
  // the five governmental ones. ⚠ The exact OPPOSITE of mn-osa directly above,
  // which consolidates its component units into the same columns.
  'fl-dfs-afr': 190,
  // AUSTIN-TRAVIS-01. Evidence: AUSTIN-TRAVIS-01-SCOPE-RECON.md §3.
  'tx-local-acfr-gf': 76,
  // CO-SPRINGS-EPC-01, measured 2026-08-21: Colorado Springs 28 + El Paso
  // County 36. A NEW family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md section 6.
  'co-local-acfr-gf': 64,
  // NC-DURHAM-AVL-01, measured 2026-08-25: City of Durham 32 + Durham County 42
  // + City of Asheville 28 + Buncombe County 36. A NEW family, so no
  // pre-existing count moved.
  // ⚠ This count moved TWICE after the first load, both times because a series
  // that looked complete was not. 116 -> 134: Asheville rose 10 -> 28 when nine
  // years the city had DELINKED (not deleted) were recovered from Wayback
  // snapshots of its own page. 134 -> 138: Buncombe rose 32 -> 36 when FY2009
  // and FY2010, recorded as "never published", turned out to sit under a FOURTH
  // naming convention (cafr09/cafr.pdf, cafr10/CAFR10.pdf) that is live on the
  // county's own host. Both times the partition gate REFUSED THE WRITE first.
  // Remaining exclusions are documented per entity in ncAcfrSources.mjs.
  // Evidence: docs/superpowers/plans/NC-DURHAM-AVL-01-CLOSEOUT.md section 6.
  'nc-local-acfr-gf': 210,
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
