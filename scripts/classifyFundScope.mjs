#!/usr/bin/env node
/**
 * SCOPE-01 Task 5 — stamp `fund_scope` onto treasury.budgets from the registry.
 *
 * Reads every DISTINCT `data_source` in the table, runs each through
 * `classify()` against `scripts/data/fundScopeRegistry.mjs`, and writes the
 * resulting scope in bulk per registry entry. Classification is per SOURCE, so
 * the unit of work is a data_source string, never a row.
 *
 * ── THE PARTITION GATE ──────────────────────────────────────────────────────
 * Before writing anything, this asserts the registry's patterns claim EXACTLY the
 * row counts Task 1 measured (SCOPE-01-RECON.md §1.2) and that
 * claimed + unknown = the table total. A pattern claiming MORE than Task 1
 * recorded is over-matching: fix the pattern, never accept the count. `--force`
 * exists only so a deliberate, explained registry change can proceed, and it
 * prints what it is overriding.
 *
 * It also reports strings matched by more than one entry. `classify()` takes the
 * first match, so an overlap is not a double-count -- but it means one entry is
 * silently shadowing another, which is a design smell worth surfacing.
 *
 * ── SAFETY ──────────────────────────────────────────────────────────────────
 * Writes ONE column. Never touches total_budget, categories or line items --
 * `scripts/verify-fund-scope.mjs` proves that against the digest committed at
 * Task 3. Idempotent: re-running produces the same state. Reversible with
 * `--reset`, which sets every row back to 'unknown'.
 *
 * Usage:
 *   node scripts/classifyFundScope.mjs --dry-run     # tally only, no writes
 *   node scripts/classifyFundScope.mjs               # classify
 *   node scripts/classifyFundScope.mjs --reset       # back to all-unknown
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (source .env first).
 */

import { parseArgs } from 'node:util';
import { classify, validateRegistry, SCOPE, SCOPE_VALUES } from './lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from './data/fundScopeRegistry.mjs';

/**
 * Row counts each entry is expected to claim, measured at Task 1 and recorded in
 * SCOPE-01-RECON.md §1.2. These are the numbers the partition gate enforces.
 *
 * ⚠ Do NOT update a number here to make the gate pass. The gate failing means
 * either a pattern changed behaviour or the table changed underneath -- both of
 * which need explaining in the recon document before the count is edited.
 */
export const EXPECTED_ROWS = Object.freeze({
  // ⚠ +10 and +2 against the Task 1 measurements of 10438 / 10446. The table
  // changed underneath, which the header permits once explained: SCOPE-02 Task 10
  // backfilled 12 State Controller rows (Fresno operating FY2020-24, Riverside
  // FY2023-24, Oakland FY2024, Santa Ana operating+revenue FY2023-24). Their ids
  // are committed in scripts/data/scope02CreatedIds.json, and querying that exact
  // id set by data_source gives 10 "CA State Controller - Expenditures" and 2
  // "CA State Controller - Revenues" — precisely the overage, with nothing left
  // over. Not a pattern change: both patterns are byte-identical to SCOPE-01's.
  // The gate had been failing on this since the backfill; the classifier was not
  // re-run afterwards.
  // ⚠ +4 each against 10448: LA-02 loaded the State Controller's already-published
  // FY2021-2024 for Los Angeles City (4 expenditure + 4 revenue rows). Those years
  // had been sitting under a `Socrata: https://data.lacity.org` label — the revenue
  // figures were the State Controller's all along, dollar-identical in all 4 years.
  // Verified against the live table: the two sources now count 10452 / 10452, exactly
  // +4 / +4, with nothing else moved. Evidence: LA-02-SCOPING.md §2.
  'ca-sco-city-exp': 10452,
  'ca-sco-city-rev': 10452,
  'ca-sco-county-exp': 1188,
  'ca-sco-county-rev': 1188,
  'state-acfr-gf': 1448,
  // SCOPE-04, measured from the ACTUAL post-write count, never the estimate.
  // 7,650 = 7,664 eligible − 8 quarantined − 6 excluded. Ids are committed in
  // scripts/data/scope04CreatedIds.json and proven an exact set match against the
  // rows carrying derivation='derived'.
  //
  // ⚠ DO NOT RUN THIS GATE WHILE A LOAD IS IN FLIGHT. Measured the hard way: run
  // mid-write, it reported eight entries OVER-MATCHING by a total of 27 rows —
  // including mn-osa +11 and oh-aos +2, in states SCOPE-04 does not touch at all.
  // Nothing was wrong with any pattern. Paging is LIMIT/OFFSET, so rows inserted
  // during the scan shift later pages and existing rows get counted twice. The
  // fabricated drift looked exactly like a real stale baseline, and the reasoning
  // that "this milestone is CA-only so it cannot have added MN rows" does NOT
  // exonerate the numbers — a racing read double-counts rows that were already
  // there. Re-run after the load: every entry matched exactly.
  'ca-sco-derived-tg': 7650,
  // AUSTIN-TRAVIS-01, measured 2026-08-19: Austin 32 + Travis County 44. A NEW
  // family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/AUSTIN-TRAVIS-01-SCOPE-RECON.md §1.
  'tx-local-acfr-gf': 76,
  // CO-SPRINGS-EPC-01, measured 2026-08-21: Colorado Springs 28 + El Paso
  // County 36. A NEW family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md section 6.
  // ⚠ 64 -> 88 on 2026-08-30. Knight session 7b EXTENDED this family with the
  // City of Boulder (FY2016-FY2022, 7 years) and Boulder County (FY2021-FY2025,
  // 5 years) = 12 entity-years x 2 datasets = 24 rows. The pre-existing 64
  // (Colorado Springs 28 + El Paso County 36) did not move; this is a family
  // that GREW, which the header permits once explained. A partition count is a
  // measurement with a date, not a constant.
  'co-local-acfr-gf': 88,
  // Knight session 7b — KANSAS'S FIRST LOCAL ENTITIES. A NEW family, so no
  // pre-existing count moved. 84 = 42 entity-years x 2 datasets: City of
  // Wichita FY2000-FY2025 less FY2001 and FY2008 (24 years) and Sedgwick County
  // FY2006-FY2024 less FY2019 (18 years).
  // ⚠ THE FOUR ABSENT YEARS ARE DOCUMENT GAPS, NOT FETCH FAILURES, and each is
  // declared in scripts/extractCoKsAll.mjs: Wichita FY2001 and FY2008 are
  // image-only scans; Sedgwick County FY2005 is a dead link in the county's own
  // archive; Sedgwick County FY2019's statement page carries a custom font
  // encoding under which NO NUMBER survives extraction. None is written as $0.
  // ⚠ This count WILL rise if the FY2019 recovery via FAC lands. Re-measure
  // with evidence then.
  'ks-local-acfr-gf': 84,
  // Knight session 7a (Michigan's first local entities), measured from the
  // ACTUAL post-write count on 2026-08-30. A NEW family, so no pre-existing
  // count moved. Detroit and Wayne County, FY2010-FY2025 with no gaps.
  //
  // ⚠ 64 EACH, NOT 128 BETWEEN THEM. Michigan is the first family in TT to write
  // TWO scopes for the same entity-year, so every filing produces one
  // general-fund row and one governmental-funds row per dataset type:
  //   32 entity-years x 2 dataset types = 64 rows per scope, 128 in total.
  // `treasury_sync_city_budget` keys on fund_scope + basis, so the two series
  // coexist rather than overwrite — the same keying that made
  // project_sync_city_budget_not_source_safe dangerous when scope was OMITTED.
  'mi-treasury-f65-gf': 64,
  'mi-treasury-f65-tg': 64,
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
  // ACTUAL post-write count on 2026-08-30, never from an estimate. A NEW family,
  // so no pre-existing count moved.
  //
  // 38 = 19 entity-years x 2 datasets: City of Myrtle Beach FY2016-FY2025 (10)
  // and City of Columbia FY2016-FY2018 + FY2020-FY2025 (9).
  //
  // ⚠ THE MISSING YEAR IS COLUMBIA FY2019, AND IT IS ABSENT BY DECISION. Both
  // available copies of that ACFR are SCANS: the Federal Audit Clearinghouse
  // copy carries a defective OCR text layer (it renders `20 ,775,337` with an
  // embedded space and `State government` as `Slate government`), and the city's
  // own copy has no text layer at all — 1,900 characters across 169 pages. The
  // year is reported as a gap rather than written as $0, and it is NOT expected
  // to appear later unless someone decides money read off an image is
  // acceptable. If this count ever reads 40, that decision was made somewhere
  // and needs to be in the recon document, not in this number.
  // ⚠ 38 -> 74 on 2026-09-03: the South Carolina city wave 1 added City of
  // Charleston (FY2016-FY2025) and Town of Mount Pleasant (FY2018-FY2025),
  // 36 rows. The pre-existing 38 did not move.
  //
  // ⚠ THE PATTERN WAS INTERROGATED BEFORE THIS NUMBER WAS TOUCHED: 74 rows over
  // 74 distinct ids, 0 rows outside South Carolina, exactly 4 entities
  // (Charleston, Columbia, Mount Pleasant, Myrtle Beach), exactly 2 dataset
  // types, 74 distinct source strings, 0 duplicate (entity, year, dataset) keys,
  // and uniform general_fund / actual / audited_gaap. The family grew because a
  // load added members, not because a pattern widened past its evidence.
  //
  // ⚠⚠ `entity_type` is now city AND town — Mount Pleasant is a town in the
  // Census file and in its own filings, and that is part of its identity.
  // ⚠⚠ And the months are NOT uniform: Charleston is 1, the other three are 7.
  // ⚠ 74 -> 114 on 2026-09-03: city wave 2 added City of Rock Hill and City of
  // Greenville, FY2016-FY2025 each, 40 rows. 38 (session 6a) -> 74 (wave 1) ->
  // 114. No pre-existing count moved.
  //
  // ⚠ THE PATTERN WAS INTERROGATED FIRST: 114 rows over 114 DISTINCT ids, 0 rows
  // outside South Carolina, exactly 6 entities, 2 dataset types, 114 distinct
  // source strings, 0 duplicate (entity, year, dataset) keys, uniform
  // general_fund / actual / audited_gaap. 57 entity-years x 2 = 114, and the
  // per-entity year counts still read Columbia 9 (FY2019 absent by decision) and
  // Mount Pleasant 8 (no FAC filing before FY2018).
  //
  // ⚠⚠ Non-uniform BY DESIGN: entity_type is city AND town, and Charleston runs
  // a JANUARY fiscal year while the other five run July.
  'sc-local-acfr-gf': 114,
  // Knight session 6b (Tennessee's first local entity), measured from the ACTUAL
  // post-write count on 2026-08-30. A NEW family, so no pre-existing count moved.
  // 20 = 10 fiscal years (FY2016-FY2025) x 2 datasets, ONE entity — Metro
  // Nashville is a consolidated government and is deliberately a single row in
  // `municipalities`, not a city plus a county (spec §4.5).
  'tn-local-acfr-gf': 20,
  // Knight session 3 (Florida DFS), measured from the ACTUAL post-write count on
  // 2026-08-29, never from an estimate. A NEW family, so no pre-existing count
  // moved: the gate reported every other entry unchanged in the same run.
  //
  // 190 = 95 entity-years x 2 datasets, across 28 source strings (14 fiscal years
  // x {Expenditure by Function, Revenue by Source}). The seven entities span
  // FY2012-FY2025 = 98 possible entity-years; THREE are absent because those
  // governments had not filed FY2025 when the workbooks were fetched — Miami-Dade,
  // Leon and Bradenton. 98 - 3 = 95.
  //
  // ⚠ THAT SHORTFALL IS THE NUMBER TO WATCH. FY2025 is still filling: 1,281
  // entities had filed statewide against 1,918 for FY2024. When those three file,
  // a re-run of the loader will legitimately raise this to as much as 196, and
  // that is a re-measurement, not a pattern bug — the same distinction
  // basisRegistry.mjs's `city-adopted-budget-doc` entry had to make for San
  // Francisco's cron sync. Check WHICH rows appeared before editing the number.
  'fl-dfs-afr': 190,
  // The sixteen entity-published city/state ACFR families, measured 2026-08-19.
  // Evidence: docs/superpowers/plans/ACFR-GF-CLASSIFICATION-RECON.md.
  // 106 + 64 + 34 + 56 = 260. All NEW families; no pre-existing count moved.
  'or-city-acfr-gf': 106,       // Bend 36, Sherwood 22, Beaverton 12, Hillsboro 10,
                                // Tualatin 10, Cornelius 8, Tigard 8
  'az-muni-acfr-gf': 64,        // Tucson 20, Marana 12, Oro Valley 12, Sahuarita 12,
                                // South Tucson 8
  'seattle-city-acfr-gf': 34,
  'state-acfr-gf-by-name': 56,  // Minnesota 36, Ohio 12, Virginia 8
  'wa-sao': 286,
  'mn-osa': 21794,
  'oh-aos': 6616,
  // ── MA DLS (MA-01) ────────────────────────────────────────────────────────
  // 8403 + 6663 + 1750 = 16,816, the whole MA DLS family.
  //
  // ⚠ 8403 IS DELIBERATELY THE POST-RELABEL COUNT, and the gate will FAIL at
  // 6843 until the 1,560 rows still labelled "MA DLS Schedule A — Special
  // Revenue Funds" are corrected to "MA General Fund Expenditures". That is the
  // intended ordering, enforced rather than remembered: classification is per
  // SOURCE STRING, so classifying first would require an entry whose pattern
  // matches a label MA-01-RECON.md §4a proves false — writing a wrong statement
  // into the audit trail of record. Fix the label, then this passes.
  //
  // Both counts were measured directly, not derived: the patterns were run
  // against all 3,824 distinct data_source strings before the entries were
  // written, matching 351 / 351 / 350 strings with zero over-match and zero
  // collision with an existing entry.
  // +5 and +5 for Cambridge (migration 20260818000400). Cambridge's FY2021-2025
  // rows were labelled 'cambridge-open-data' but are byte-identical to
  // docs/MA/GenFund{Expenditures,Revenues}{2021..2025}.xlsx on all 10 rows, so it
  // is the same DLS source as the other 350 municipalities wearing a third wrong
  // label. Before that fix ma-dls-gf-rev-by-source matched 350 strings, not 351 —
  // Cambridge was the missing one, which is what led to finding this.
  // Cambridge FY2026 is NOT included: revenue equals operating exactly
  // ($992,181,320), the balanced-adopted-budget signature, and no FY2026 workbook
  // exists. It stays 'cambridge-open-data' and stays unknown.
  'ma-dls-gf-exp': 8408,
  'ma-dls-gf-rev': 6663,
  'ma-dls-gf-rev-by-source': 1755,
});

/** Batch size for `data_source IN (...)` updates — 1,448 strings is one family. */
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

/** Every distinct data_source with its row count. Paged — the table is ~80k rows. */
async function fetchSourceCounts(supabase) {
  const counts = new Map();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .schema('treasury').from('budgets')
      .select('data_source')
      .order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch data_source: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) counts.set(r.data_source, (counts.get(r.data_source) ?? 0) + 1);
    if (data.length < PAGE) break;
  }
  return counts;
}

/** Which entries match this string at all (not just the winning one). */
function allMatches(dataSource, registry) {
  const hits = [];
  for (const e of registry) {
    if (!e?.match || typeof e.match.test !== 'function') continue;
    try {
      if (e.match.test(dataSource)) hits.push(e.id);
    } catch { /* a throwing pattern blocks its own family; classify() reports unknown */ }
  }
  return hits;
}

/** Group distinct sources by the entry that claims them. */
export function plan(sourceCounts, registry) {
  const byEntry = new Map();  // entryId -> {scope, sources:[], rows}
  const unknownSources = [];
  let unknownRows = 0;
  const overlaps = [];

  for (const [src, rows] of sourceCounts) {
    const { scope, entryId } = classify(src, registry);
    const hits = allMatches(src, registry);
    if (hits.length > 1) overlaps.push({ src, hits, rows });

    if (entryId === null) {
      unknownSources.push(src);
      unknownRows += rows;
      continue;
    }
    if (!byEntry.has(entryId)) byEntry.set(entryId, { scope, sources: [], rows: 0 });
    const g = byEntry.get(entryId);
    g.sources.push(src);
    g.rows += rows;
  }
  return { byEntry, unknownSources, unknownRows, overlaps };
}

/** Assert the patterns partition the table the way Task 1 measured. */
export function checkPartition({ byEntry, unknownRows, overlaps }, totalRows) {
  const problems = [];
  let claimed = 0;

  for (const [id, g] of byEntry) {
    claimed += g.rows;
    const want = EXPECTED_ROWS[id];
    if (want === undefined) {
      problems.push(`entry "${id}" claims ${g.rows} rows but has no EXPECTED_ROWS entry — add it to the recon doc first`);
    } else if (g.rows > want) {
      problems.push(`entry "${id}" claims ${g.rows} rows, MORE than the ${want} Task 1 recorded — OVER-MATCHING, fix the pattern`);
    } else if (g.rows < want) {
      problems.push(`entry "${id}" claims ${g.rows} rows, FEWER than the ${want} Task 1 recorded — pattern too narrow, or rows changed`);
    }
  }
  for (const id of Object.keys(EXPECTED_ROWS)) {
    if (!byEntry.has(id)) problems.push(`EXPECTED_ROWS has "${id}" but no source matched it`);
  }
  if (claimed + unknownRows !== totalRows) {
    problems.push(`claimed ${claimed} + unknown ${unknownRows} = ${claimed + unknownRows}, not the table's ${totalRows}`);
  }
  for (const o of overlaps) {
    problems.push(`"${o.src}" matches ${o.hits.length} entries [${o.hits.join(', ')}] — "${o.hits[0]}" wins and shadows the rest`);
  }
  return { ok: problems.length === 0, problems, claimed };
}

async function updateScope(supabase, sources, scope) {
  let written = 0;
  for (let i = 0; i < sources.length; i += IN_CHUNK) {
    const chunk = sources.slice(i, i + IN_CHUNK);
    const { error, count } = await supabase
      .schema('treasury').from('budgets')
      .update({ fund_scope: scope }, { count: 'exact' })
      .in('data_source', chunk);
    if (error) throw new Error(`update ${scope}: ${error.message}`);
    written += count ?? 0;
  }
  return written;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      reset: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });

  const reg = validateRegistry(FUND_SCOPE_REGISTRY);
  if (!reg.ok) {
    console.error('REGISTRY INVALID — refusing to classify:', JSON.stringify(reg, null, 2));
    process.exit(1);
  }
  console.log(`registry: ${FUND_SCOPE_REGISTRY.length} entries, all evidenced ✅`);

  const supabase = await getSupabase();

  if (values.reset) {
    const { error, count } = await supabase
      .schema('treasury').from('budgets')
      .update({ fund_scope: SCOPE.UNKNOWN }, { count: 'exact' })
      .neq('fund_scope', SCOPE.UNKNOWN);
    if (error) throw new Error(`reset: ${error.message}`);
    console.log(`reset ${count} rows to '${SCOPE.UNKNOWN}'`);
    return;
  }

  const sourceCounts = await fetchSourceCounts(supabase);
  const totalRows = [...sourceCounts.values()].reduce((a, b) => a + b, 0);
  console.log(`read ${sourceCounts.size} distinct data_source strings over ${totalRows.toLocaleString()} rows`);

  const p = plan(sourceCounts, FUND_SCOPE_REGISTRY);
  const check = checkPartition(p, totalRows);

  console.log('\n── per-entry claim vs Task 1 ──');
  for (const [id, g] of [...p.byEntry].sort((a, b) => b[1].rows - a[1].rows)) {
    const want = EXPECTED_ROWS[id];
    const mark = g.rows === want ? '✅' : '❌';
    console.log(`  ${mark} ${id.padEnd(20)} ${g.scope.padEnd(20)} ${String(g.rows).padStart(6)} rows (expected ${want ?? '?'})  ${g.sources.length} strings`);
  }
  console.log(`     ${'unknown'.padEnd(20)} ${''.padEnd(20)} ${String(p.unknownRows).padStart(6)} rows                     ${p.unknownSources.length} strings`);
  console.log(`  claimed ${check.claimed.toLocaleString()} + unknown ${p.unknownRows.toLocaleString()} = ${(check.claimed + p.unknownRows).toLocaleString()} / ${totalRows.toLocaleString()}`);

  if (!check.ok) {
    console.error('\n❌ PARTITION GATE FAILED:');
    for (const m of check.problems) console.error(`   - ${m}`);
    if (!values.force) {
      console.error('\nRefusing to write. Fix the patterns, or re-run with --force if the change is deliberate and explained in SCOPE-01-RECON.md.');
      process.exit(1);
    }
    console.error('\n⚠ --force given; writing anyway. The overrides above must be explained in the recon document.');
  } else {
    console.log('\n✅ partition gate: every entry claims exactly what Task 1 measured, nothing double-claimed, nothing lost');
  }

  if (values['dry-run']) {
    console.log('\n--dry-run: nothing written.');
    return;
  }

  console.log('\n── writing ──');
  let total = 0;
  for (const [id, g] of p.byEntry) {
    const n = await updateScope(supabase, g.sources, g.scope);
    total += n;
    console.log(`  ${id.padEnd(20)} -> ${g.scope.padEnd(20)} ${String(n).padStart(6)} rows`);
  }
  console.log(`  ${total.toLocaleString()} rows stamped`);

  const tally = new Map();
  for (const s of SCOPE_VALUES) tally.set(s, 0);
  for (const [, g] of p.byEntry) tally.set(g.scope, tally.get(g.scope) + g.rows);
  tally.set(SCOPE.UNKNOWN, p.unknownRows);
  console.log('\n── expected tally (verify in SQL) ──');
  for (const [s, n] of [...tally].sort((a, b) => b[1] - a[1])) {
    if (n) console.log(`  ${s.padEnd(20)} ${String(n).padStart(6)} (${(n / totalRows * 100).toFixed(1)}%)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('classifyFundScope.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
