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
  // ⚠ 64 -> 88 on 2026-08-30: Knight session 7b extended this family with City
  // of Boulder (7 years) and Boulder County (5 years) = 24 rows. The
  // pre-existing 64 did not move.
  'co-local-acfr-gf': 88,
  // Knight session 7b — Kansas's FIRST local entities. A NEW family. 84 = 42
  // entity-years x 2 datasets (Wichita FY2000-2025 less FY2001/FY2008; Sedgwick
  // County FY2006-2024 less FY2019). The four absent years are DECLARED
  // document gaps, never written as $0 — see scripts/extractCoKsAll.mjs.
  'ks-local-acfr-gf': 84,
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
  // ⚠ 114 -> 138 on 2026-09-03: city wave 3 added Town of Summerville and City
  // of Goose Creek, 6 years each, 24 rows. 38 -> 74 -> 114 -> 138, and no
  // pre-existing count moved.
  //
  // ⚠ THE PATTERN WAS INTERROGATED BEFORE THIS NUMBER WAS TOUCHED: 138 rows over
  // 138 DISTINCT ids, read PAGED with distinct-id == row-count asserted across
  // all 269,960 rows; 0 rows outside South Carolina; exactly 8 entities; 2
  // dataset types; 138 distinct source strings; 0 duplicate (entity, year,
  // dataset) keys; 0 non-positive totals; uniform general_fund / actual /
  // audited_gaap. 69 entity-years x 2 = 138, with Columbia 9 (FY2019 absent by
  // decision), Mount Pleasant 8, and Summerville and Goose Creek 6 each (a
  // Single Audit is filed only when federal awards reach $750k).
  //
  // ⚠⚠ SUMMERVILLE CARRIES TWO FISCAL MONTHS — 1 through FY2020 and 7 from
  // FY2022, because the town changed its fiscal year inside the loaded window.
  // Correct, and the first in this campaign; a uniformity check over this family
  // must not read it as a defect.
  //
  // ⚠ 138 -> 146 on 2026-09-03: City of North Charleston, FOUR years of ten
  // (FY2021, FY2022, FY2024, FY2025), 8 rows. No pre-existing count moved.
  //
  // ⚠ THE PATTERN WAS INTERROGATED FIRST: 146 rows over 146 DISTINCT ids, read
  // PAGED with distinct-id == row-count asserted across the whole table; 0 rows
  // outside South Carolina; exactly 9 entities; 2 dataset types; 146 distinct
  // source strings; 0 duplicate (entity, year, dataset) keys; 0 non-positive
  // totals; uniform general_fund / actual / audited_gaap.
  //
  // ⚠⚠ THIS FAMILY IS NOW DELIBERATELY RAGGED, and a uniformity check over it
  // must not read that as a defect. Year counts run 10, 10, 10, 9, 8, 6, 6, 4;
  // entity_type is city AND town; and the fiscal month is 1 for Charleston and
  // Goose Creek, 7 for four others, and BOTH for Summerville, which changed its
  // fiscal year inside the loaded window.
  //
  // ⚠ 146 -> 166 on 2026-09-03: City of Spartanburg, a FULL ten years
  // (FY2016-FY2025), 20 rows. No pre-existing count moved.
  //
  // ⚠ THE PATTERN WAS INTERROGATED FIRST: 166 rows over 166 DISTINCT ids, read
  // PAGED with distinct-id == row-count asserted across the whole table; 0 rows
  // outside South Carolina; exactly 10 entities; 2 dataset types; 166 distinct
  // source strings; 0 duplicate (entity, year, dataset) keys; 0 non-positive
  // totals; uniform general_fund / actual / audited_gaap.
  //
  // ⚠⚠ THE FAMILY IS DELIBERATELY RAGGED and a uniformity check must not read
  // that as a defect: year counts run 10, 10, 10, 10, 9, 8, 6, 6, 4;
  // entity_type is city AND town; the fiscal month is 1 for two entities, 7 for
  // five, and BOTH for Summerville, which changed its fiscal year mid-window.
  'sc-local-acfr-gf': 166,
  // Knight session 6b (Tennessee's first local entity), measured from the ACTUAL
  // post-write count on 2026-08-30. 20 = 10 fiscal years x 2 datasets, ONE
  // consolidated entity. See the fuller note on the same id in
  // scripts/classifyFundScope.mjs.
  'tn-local-acfr-gf': 20,
  // Florida DFS. Was 190 (Knight session 3, seven entities); re-measured
  // 2026-09-02 after the STATEWIDE sweep loaded every filing city and county.
  //
  // 12,764 = 6,382 entity-years x 2 datasets, over 34 source strings and 479
  // entities across FY2012-FY2025.
  //
  // ⚠ The PATTERN did not widen — it was interrogated before this number was
  // touched, which is the rule this gate exists to enforce: 0 rows outside
  // Florida, 0 rows of an entity type the family cannot contain (city and county
  // only), 0 dataset types beyond operating/revenue, and 0 duplicate
  // (entity, year, dataset) keys. The family grew because a load added members,
  // and that load reconciles to the registry BY DIGEST, member for member
  // (scripts/verifyFlStatewideLoad.mjs).
  //
  // ⚠ 6,382 rather than 6,396 entity-years: 14 are withheld because DFS's own
  // totals report contradicts its own detail report for them. See
  // scripts/data/flOracleDrift.mjs.
  'fl-dfs-afr': 12764,
  // Pennsylvania DCED form DCED-CLGS-30, statewide sweep, measured 2026-09-03.
  // Was absent entirely: the Knight session-5 load's 58 rows were never claimed
  // by a basis or reporting_entity entry, so Pennsylvania sat in the `unknown`
  // bucket and nothing noticed.
  //
  // 51,078 = 25,539 approved entity-years x 2 datasets, over exactly 40 source
  // strings = 10 fiscal years x 2 datasets x 2 SCOPES — DCED publishes a
  // municipal report that is all-funds and a county report that is
  // governmental, and the loader writes which one into the source string.
  //
  // ⚠ THE PATTERN WAS INTERROGATED BEFORE THIS NUMBER WAS WRITTEN, which is the
  // rule this gate exists to enforce: every row maps to a registry entity, each
  // row's fund_scope matches that entity's report, every row carries its own
  // entity's fiscal month (1, or 7 for Philadelphia), and the loaded set
  // reconciles to the registry BY DIGEST — 4aeb630dde9f86e85e3af72200ad30fa,
  // member for member (scripts/verifyPaStatewideLoad.mjs). The family grew
  // because a load added members, not because a pattern widened.
  'pa-dced-clgs30': 51078,
  // South Carolina RFA Local Government Finance Report, county blocks. Statewide
  // sweep, measured 2026-09-03 from the ACTUAL post-write count.
  //
  // Was absent entirely: the Knight session-6a load's 52 rows were never claimed
  // by a basis entry, so South Carolina sat in the `unknown` bucket and nothing
  // noticed — the same gap Pennsylvania carried until #133.
  //
  // 1,170 = 585 loadable county-years x 2 datasets, over exactly 26 source
  // strings = 13 fiscal years x 2 datasets, across all 46 counties.
  //
  // ⚠ 585 rather than 598 county-years: 13 are refused because the publisher
  // marks them not reported — by an asterisk in the column header (Clarendon
  // FY23/24, Jasper FY23/24, Kershaw FY21) or an `N` in the `County Info` matrix
  // (Allendale FY20/21/24, Hampton FY22, Orangeburg FY21, Williamsburg
  // FY22/23/24). Neither signal is a superset of the other, so a county-year is
  // trusted only when BOTH agree, and a refused year is ABSENT rather than $0.
  //
  // ⚠ THE PATTERN WAS INTERROGATED BEFORE THIS NUMBER WAS WRITTEN, which is the
  // rule this gate exists to enforce: 0 rows outside South Carolina, 0 rows of an
  // entity type the family cannot contain (county only), exactly 2 dataset types,
  // exactly 26 distinct source strings over exactly 46 entity ids, and 0 duplicate
  // (entity, year, dataset) keys. The loaded set also reconciles to the workbook
  // BY DIGEST — 8723ea9adbb20af36dbc3ff12a51e383, member for member
  // (scripts/verifyScStatewideLoad.mjs). The family grew because a load added
  // members, not because a pattern widened.
  //
  // ⚠ There is deliberately NO reporting_entity twin for this id: RFA never says
  // whether a county's component units are inside its County-only figures, so
  // those rows stay `unknown`. See scripts/data/reportingEntityRegistry.mjs.
  'sc-rfa-lgf': 1170,
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
  //
  // ⭐ RE-MEASURED 2026-08-31: 128 -> 23,084, the Michigan STATEWIDE sweep. Same
  // family, same pattern, same publisher — 364 cities and counties instead of 2.
  // 23,084 = 5,771 entity-years x 2 dataset types x 2 fund scopes.
  //
  // ⚠ This is the case the standing lesson above describes: the pattern did not
  // widen and did not claim a row it should not; the right rows became more
  // numerous. The "do NOT edit the expected number" rule is about a pattern
  // reaching the WRONG rows. Verified before editing: 23,084 is the exact count
  // of `data_source LIKE 'Michigan Treasury Form F-65%'` in the live table, over
  // exactly 364 municipality_ids.
  //
  // ⭐ RE-MEASURED 2026-09-02: 23,084 -> 116,456, the Michigan TOWNSHIP and
  // VILLAGE sweep. Same family, same pattern, same publisher — the state's other
  // 1,493 general-purpose local governments. 116,456 = 23,084 + 93,372, and
  // 93,372 = 23,343 entity-years x 2 dataset types x 2 fund scopes.
  //
  // ⚠ Verified BEFORE editing, the same way and with the same questions asked of
  // the pattern rather than of the total: `data_source LIKE 'Michigan Treasury
  // Form F-65%'` selects exactly 116,456 rows over exactly 1,856
  // municipality_ids — the roster's own size — with ZERO rows outside Michigan,
  // ZERO rows of an entity type this family cannot contain, FY2010-FY2025, and
  // 64 distinct source names (2 faces x 16 years x 2 scopes). A widened pattern
  // shows up in those columns, not in the count.
  'mi-treasury-f65': 116456,
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
  // Florida DFS, re-measured 2026-09-02 after the statewide sweep. Same 12,764
  // rows as the basis entry above; primary_government because DFS publishes
  // discretely presented component units in their own twelfth fund column and TT
  // sums only the five governmental ones. ⚠ The exact OPPOSITE of mn-osa
  // directly above, which consolidates its component units into the same columns.
  'fl-dfs-afr': 12764,
  // PA DCED statewide — the same 51,078 rows as the basis entry above.
  // primary_government because neither DCED report publishes a component-unit
  // column, and the county report keeps proprietary, internal service and
  // fiduciary funds in blocks this loader never reads. ⚠ Also the exact opposite
  // of mn-osa, which consolidates component units into the same columns.
  'pa-dced-clgs30': 51078,
  // AUSTIN-TRAVIS-01. Evidence: AUSTIN-TRAVIS-01-SCOPE-RECON.md §3.
  'tx-local-acfr-gf': 76,
  // Knight session 7a (Michigan Treasury F-65), measured 2026-08-30. The same
  // 23,084 rows as the basis entry above; primary_government because the F-65
  // publishes discretely presented component units in their own column d and TT
  // reads only columns a and b. ⚠ ONE entry spans BOTH fund scopes — the entity
  // boundary is identical whether TT reads column a alone or a + b.
  //
  // ⭐ RE-MEASURED 2026-08-31 alongside the basis entry: 128 -> 23,084. The
  // column-d fact that justifies `primary_government` is a property of the FORM,
  // so it holds for all 364 filers exactly as it held for two.
  //
  // ⭐ RE-MEASURED 2026-09-02 alongside the basis entry: 23,084 -> 116,456, the
  // township and village sweep. The same reasoning carries a third time and for
  // the same reason: column d is a fact about the FORM every filer submits, so
  // it holds for 1,856 filers exactly as it held for 364 and for two.
  'mi-treasury-f65': 116456,
  // CO-SPRINGS-EPC-01, measured 2026-08-21: Colorado Springs 28 + El Paso
  // County 36. A NEW family, so no pre-existing count moved.
  // Evidence: docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md section 6.
  // ⚠ 64 -> 88 on 2026-08-30: Knight session 7b extended this family with City
  // of Boulder (7 years) and Boulder County (5 years) = 24 rows. The
  // pre-existing 64 did not move.
  'co-local-acfr-gf': 88,
  // Knight session 7b — Kansas's FIRST local entities. A NEW family. 84 = 42
  // entity-years x 2 datasets (Wichita FY2000-2025 less FY2001/FY2008; Sedgwick
  // County FY2006-2024 less FY2019). The four absent years are DECLARED
  // document gaps, never written as $0 — see scripts/extractCoKsAll.mjs.
  'ks-local-acfr-gf': 84,
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
      // ⚠⚠ TOTAL ORDER, PRIMARY KEY LAST. Without it PostgreSQL gives no stable
      // row order and `.range()` page boundaries drift: rows repeat in one page
      // and vanish from another.
      //
      // This read had NO `order()` at all, and the failure was invisible because
      // the TOTAL came out right. Measured over 217,722 rows, three consecutive
      // runs read 217,722 rows each but only 143,537 / 137,267 / 138,261 DISTINCT
      // ids — roughly 80,000 rows read twice and 80,000 never read — and counted
      // the Florida family at 13,255 / 13,744 / 13,905 against a true 12,764. So
      // this stamper was classifying about two thirds of the table, a different
      // two thirds every run, and its per-family counts were noise.
      //
      // Every sibling read already carried this comment (stampAuditGrade.mjs,
      // listAllSources.mjs). This one was the missed sibling.
      .order('data_source', { nullsFirst: true })
      .order('fiscal_year')
      .order('id')
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
