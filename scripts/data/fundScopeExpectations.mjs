/**
 * Row counts each fund-scope registry entry is expected to claim.
 *
 * NO SHEBANG — data module under scripts/data/, imported by tests.
 *
 * Measured at SCOPE-01 Task 1 and recorded in SCOPE-01-RECON.md §1.2; these are
 * the numbers the partition gate in scripts/lib/fundScope.mjs enforces.
 *
 * ⚠⚠ DO NOT UPDATE A NUMBER HERE TO MAKE THE GATE PASS. A failure means either
 * a pattern changed behaviour or the table changed underneath. They are told
 * apart by MEASURING, never by assuming:
 *
 *   PATTERN BUG      the entry claims strings that are not its publisher's, or
 *                    a string is claimed by more than one entry. FIX THE
 *                    PATTERN; the count is a symptom.
 *   TABLE GREW       every claimed string is the entry's own, no string is
 *                    double-claimed, and the entity count reconciles with that
 *                    load's own record. RE-MEASURE, and say what moved it.
 *
 * The evidence a re-measurement must carry, in this order, is the house style
 * set by `in-gateway-afr`: rows / DISTINCT ids / strings / entities.
 * ⚠ DISTINCT ids is not decoration — a paged read over this table has silently
 * duplicated rows four times, and ids == rows is the guard that catches it.
 *
 * ⚠ This file lived inside scripts/classifyFundScope.mjs until 2026-10-06. It
 * moved because a test that imports it may not import a module carrying a
 * shebang (git rewrites to CRLF on Windows and Vite's shebang strip does not
 * match 
, which takes the whole suite down with a SyntaxError naming no file).
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
  // ⭐ RE-MEASURED IN THE TABLE 2026-10-06, after the statewide F-65 sweep.
  // 64 each was the PILOT-ERA count from SCOPE-01 Task 1; the sweep landed
  // 1,856 units and the gate had been refusing to write ever since.
  //
  // PER HALF: 58,228 rows / 58,228 DISTINCT ids / 32 strings / 1,856 entities,
  // and ZERO of those strings is claimed by any other registry entry. The two
  // halves sum to 116,456 — the MI F-65 statewide total on record — and the
  // 1,856 entities reconcile with that sweep's own unit count exactly.
  //
  // NOT a pattern bug: the pattern is anchored ^...$ on the full Michigan
  // Treasury F-65 title and discriminates the two halves only by the literal
  // "general fund" vs "governmental funds". It cannot reach another publisher.
  // The table grew; the pattern did not change.
  'mi-treasury-f65-gf': 58228,
  'mi-treasury-f65-tg': 58228,
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
  //
  // ⚠ 114 -> 138 on 2026-09-03: city wave 3 added Town of Summerville and City
  // of Goose Creek, 6 years each, 24 rows. 38 (session 6a) -> 74 (wave 1) ->
  // 114 (wave 2) -> 138. No pre-existing count moved.
  //
  // ⚠ THE PATTERN WAS INTERROGATED FIRST, and a count is a MEASUREMENT WITH A
  // DATE: 138 rows over 138 DISTINCT ids, read PAGED with distinct-id ==
  // row-count asserted over all 269,960 rows; 0 rows outside South Carolina;
  // exactly 8 entities; 2 dataset types; 138 distinct source strings; 0
  // duplicate (entity, year, dataset) keys; 0 non-positive totals; uniform
  // general_fund / actual / audited_gaap. 69 entity-years x 2 = 138, and the
  // per-entity year counts read Columbia 9 (FY2019 absent by decision), Mount
  // Pleasant 8 (no FAC filing before FY2018), and Summerville 6 and Goose Creek
  // 6 (a Single Audit is filed only when federal awards reach $750k). The family
  // grew because a load added members, not because a pattern widened past its
  // evidence.
  //
  // ⚠⚠ AND SUMMERVILLE CARRIES **TWO** FISCAL MONTHS — the probe reads `months
  // 1/7` for that one entity, because the town moved from a December to a June
  // fiscal year inside the loaded window. That is the first entity in this
  // campaign to do so, it is correct, and a uniformity check over this family
  // must not treat it as a defect.
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
  //
  // ⚠ 166 -> 206 on 2026-09-04 (wave 4): City of Sumter and City of Florence,
  // FY2016-FY2025 each, 20 rows apiece. No pre-existing count moved.
  //
  // ⚠⚠ THE FAMILY IS STILL DELIBERATELY RAGGED and a uniformity check must not
  // read that as a defect. MEASURED in the database after the write, not derived
  // from the roster: 206 rows over 206 DISTINCT ids and 12 distinct
  // municipality_ids, with year counts 10, 10, 10, 10, 10, 10, 10, 9, 8, 6, 6, 4
  // (Columbia is 9 — FY2019 exists only as defective scans; North Charleston is
  // 4 of 10). entity_type is city AND town; the fiscal month is 1 for two
  // entities, 7 for nine, and BOTH for Summerville, which changed its fiscal
  // year inside the loaded window.
  // ⚠ Wave 5 adds Town of Hilton Head Island — NINE years x 2 datasets = 18,
  // taking 206 to 224. Nine, not ten: FY2016 is absent at both publishers. And
  // nine, not eight: FY2020 has no federal filing and comes from the TOWN's own
  // publisher, the first year in this family sourced outside FAC.
  'sc-local-acfr-gf': 224,
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
  // ⭐ RE-MEASURED IN THE TABLE 2026-10-06, after the FL DFS statewide sweep
  // (#132). 190 was the pilot-era count; the sweep landed 479 governments.
  // 12,764 rows / 12,764 DISTINCT ids / 34 strings / 479 entities, zero strings
  // claimed by any other entry. The 479 entities reconcile with that sweep's
  // own government count exactly. Pattern unchanged and still anchored on the
  // full "Florida DFS Annual Financial Report" title.
  'fl-dfs-afr': 12764,
  // The sixteen entity-published city/state ACFR families, measured 2026-08-19.
  // Evidence: docs/superpowers/plans/ACFR-GF-CLASSIFICATION-RECON.md.
  // 106 + 64 + 34 + 56 = 260. All NEW families; no pre-existing count moved.
  'or-city-acfr-gf': 106,       // Bend 36, Sherwood 22, Beaverton 12, Hillsboro 10,
                                // Tualatin 10, Cornelius 8, Tigard 8
  'az-muni-acfr-gf': 64,        // Tucson 20, Marana 12, Oro Valley 12, Sahuarita 12,
                                // South Tucson 8
  'seattle-city-acfr-gf': 34,
  'state-acfr-gf-by-name': 56,  // Minnesota 36, Ohio 12, Virginia 8
  // RE-MEASURED 2026-10-06: 286 -> 308, exactly +22, with nothing else moved.
  // The 22 are Redmond, WA (MCAG 0425) — 11 fiscal years x operating+revenue,
  // loaded this milestone. The pattern is byte-identical to the one that
  // measured 286: the table changed underneath, which this header permits once
  // explained. Evidence: docs/superpowers/specs/2026-10-06-redmond-duvall-
  // accounting-basis-design.md §2 and docs/superpowers/plans/REDMOND-RECON.md.
  //
  // ✅ CONFIRMED BY A PASSING SCOPED RUN: `--only wa-sao` reported
  // "claims exactly what Task 1 measured" and wrote 308 rows. The number is
  // therefore validated in place, not merely asserted.
  //
  // ⚠⚠ THE UNSCOPED GATE STILL FAILS, AND NOT BECAUSE OF THIS NUMBER. Six
  // problems across five OTHER entries predate this milestone and remain
  // UNRESOLVED: mi-treasury-f65-gf / -tg (58,228 vs 64), fl-dfs-afr
  // (12,764 vs 190), pa-dced-clgs30-muni (50,034, no entry),
  // pa-dced-clgs30-county (1,044, no entry) and in-county-acfr-tg (198, no
  // entry). Each belongs to a later statewide load whose rows this registry
  // now legitimately claims, so each needs re-measuring against its own recon.
  //
  // ⚠ Do NOT clear them with --force: that writes EVERY entry, including the
  // ones the gate is flagging as over-matching. `--only <entryId>` exists for
  // this situation — it writes one entry, and only when that entry is itself
  // clean and in no overlap.
  // RE-MEASURED 2026-10-06 (phase 2): 308 -> 328, exactly +20 = Duvall's
  // 10 fiscal years x operating+revenue. Same byte-identical pattern again.
  //
  // ⚠⚠ DUVALL'S SCOPE IS NOT INHERITED FROM THE ENTRY'S EVIDENCE. This entry
  // was evidenced on Spokane and Tacoma GAAP statements, which Duvall's
  // documents do not resemble — different caption, different column ORDER,
  // the memo column printed FIRST. The scope claim is re-established on
  // Duvall's own page in scripts/data/fundScopeRegistry.mjs; read that before
  // assuming the 20 new rows are covered by the old evidence.
  'wa-sao': 328,
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
  // ⚠⚠ NEW 2026-09-11 alongside the fundScopeRegistry entry of the same id.
  // 106, MEASURED IN THE TABLE with the entry's own anchored pattern (106 rows /
  // 106 DISTINCT ids / 5 entities / FY2012-FY2025), not derived from the roster.
  // Expected to move to roughly 16,878 once the FY2012-FY2024 sweep commits;
  // re-measure then rather than pre-writing it.
  //
  // ✅ RESOLVED 2026-10-06 — the session this note asked for.
  // This file was INERT FROM #132 (2026-09) TO 2026-10-06: five entries carried
  // pilot-era counts or none at all while four statewide sweeps landed, so the
  // gate refused to write for roughly a month. It failed CLOSED and every
  // loader writes fund_scope directly, so NOTHING WAS EVER MIS-STAMPED — but a
  // gate that cannot run is measuring nothing, which is how an invariant stops
  // being read. All six problems are now re-measured above with evidence, and
  // tests/fundScope.test.mjs pins every one so the same drift is a test
  // failure rather than a silent refusal.
  // ⭐ RE-MEASURED IN THE TABLE 2026-09-12 after the statewide sweep:
  // 16,878 rows / 16,878 DISTINCT ids / 28 strings / 659 entities.
  // ⭐ MEASURED IN THE TABLE 2026-10-06. These three families had NO entry at
  // all, which the gate reports as "claims N rows but has no EXPECTED_ROWS
  // entry" — a different failure from a stale count and a worse one: an entry
  // with no expectation is claiming rows nobody ever measured.
  //
  // PA DCED statewide sweep (#133). The two halves are one sweep split by
  // scope, exactly like Michigan's:
  //   muni   50,034 rows / 50,034 DISTINCT ids / 20 strings / 2,553 entities
  //   county  1,044 rows /  1,044 DISTINCT ids / 20 strings /    66 entities
  // They sum to 51,078 rows across 2,619 governments, which is that sweep's
  // own recorded total. Zero strings claimed by another entry.
  // ⚠ The two patterns differ ONLY in "all funds" vs "governmental funds";
  // PA publishes both presentations, so the split is the publisher's, not ours.
  'pa-dced-clgs30-muni': 50034,
  'pa-dced-clgs30-county': 1044,
  // Indiana county ACFR route. 198 rows / 198 DISTINCT ids / 198 strings /
  // 17 entities — one string per county x fiscal year x mode, which is why
  // strings equals rows here and nowhere else in this table. The 17 entities
  // are the 17 GAAP-filing counties that route established.
  'in-county-acfr-tg': 198,
  'in-gateway-afr': 16878,
});
