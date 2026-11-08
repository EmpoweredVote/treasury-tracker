/**
 * Every Socrata transaction budget, and how many rows it should hold.
 *
 * ⚠⚠⚠ READ scripts/lib/rowCoverage.mjs BEFORE EDITING. `rows` is a BASELINE,
 * not a tolerance: the gate hard-fails on `stored != published` and merely
 * reports when this number has gone stale because the publisher restated.
 *
 * These counts were taken on 2026-11-05, immediately after the reload that
 * repaired the batch-number-as-row-id defect. Before it:
 *
 *   budget                        held        published      share
 *   West Hollywood, 8 years          143        142,649       0.1%
 *   LA City FY2024               152,674        713,133      21.4%
 *   LA City FY2025               226,909        749,295      30.3%
 *
 * Every total tied to the transactions beneath it the whole time.
 */
export const SOCRATA_ROW_COVERAGE = [
  // ── West Hollywood, CA — one published file per fiscal year ────────────
  //
  // ⚠ The file TITLES are not the years. Each dataset was binned by parsing
  // every row's check_date onto a July-June year; see the migration
  // 20261105130000_weho_year_binding.sql for the full table. "FY2022-24" is a
  // FY2024 file (17,762 of its rows) and carries 38 FY2023 rows, not a year.
  // ⚠⚠ THESE TWO WERE NOT IN THE CATALOG TT KNEW ABOUT. Found 2026-11-08 by
  // asking data.weho.org what it has ever served (`/api/catalog/v1?q=demand
  // register`), which returned ten files where TT had eight. Each carries ONE
  // row with no category and no amount_paid — the publisher published it
  // empty, so it has no key, becomes no root, and moves no money.
  //
  // ⚠ `cz69-a684` COVERS FY2018 — the year 20261105130000_weho_year_binding.sql
  // retired because "NO published file covers it". That was true of the eight
  // files then registered; this one was not among them.
  { source: 'West Hollywood Demand Register FY2016-17', fiscalYear: 2017, rows: 20470 },
  { source: 'West Hollywood Demand Register FY2017-18', fiscalYear: 2018, rows: 20570 },
  { source: 'West Hollywood Demand Register FY2018-19', fiscalYear: 2019, rows: 24123 },
  { source: 'West Hollywood Demand Register FY2019-20', fiscalYear: 2020, rows: 18411 },
  { source: 'West Hollywood Demand Register FY2020-21', fiscalYear: 2021, rows: 16342 },
  { source: 'West Hollywood Demand Register FY2021-22', fiscalYear: 2022, rows: 15722 },
  { source: 'West Hollywood Demand Register FY2022-23', fiscalYear: 2023, rows: 17132 },
  { source: 'West Hollywood Demand Register FY2022-24', fiscalYear: 2024, rows: 23553 },
  { source: 'West Hollywood Demand Register FY2024-25', fiscalYear: 2025, rows: 11210 },

  // ⚠⚠ THE CURRENT FISCAL YEAR, AND IT GROWS. This read 16,156 on 2026-11-05
  // and 24,831 on 2026-11-06 — the publisher appended 8,675 rows overnight and
  // the gate went red the next morning, exactly as intended: TT really was
  // 8,675 rows and $89.9M behind what the city had published.
  //
  // ⚠ Before syncing an append, CHECK IT IS AN APPEND. A wholesale replace
  // re-mints every `:id`, so ON CONFLICT would match nothing and the year would
  // DOUBLE. Measured here by asking the publisher whether rows TT already holds
  // are still present under the same `:id`:
  //   $select=count(*)&$where=:id in ('row-…','row-…', …)
  // 100 of 100 sampled ids came back. Then sync: +8,675 new, 16,156 skipped.
  { source: 'West Hollywood Demand Register FY2025-26', fiscalYear: 2026, rows: 24831 },

  // ── Los Angeles, CA ────────────────────────────────────────────────────
  //
  // ⚠⚠ APPENDED TO WEEKLY — 130 distinct `:created_at` batches, oldest
  // 2024-07-15. Expect this baseline to go stale often and the gate to say so
  // without failing. It fails only if TT stops matching what is published.
  //
  // Counts taken from the publisher's own
  // `$select=fiscal_year,count(1)&$group=fiscal_year` on 2026-11-08.
  { source: 'LA City Checkbook', fiscalYear: 2018, rows: 751841 },
  { source: 'LA City Checkbook', fiscalYear: 2019, rows: 802411 },
  { source: 'LA City Checkbook', fiscalYear: 2020, rows: 775335 },
  { source: 'LA City Checkbook', fiscalYear: 2021, rows: 584697 },
  { source: 'LA City Checkbook', fiscalYear: 2022, rows: 599460 },
  { source: 'LA City Checkbook', fiscalYear: 2023, rows: 682006 },
  { source: 'LA City Checkbook', fiscalYear: 2024, rows: 713133 },
  { source: 'LA City Checkbook', fiscalYear: 2025, rows: 749295 },
  { source: 'LA City Checkbook', fiscalYear: 2026, rows: 747363 },

  // ⚠⚠ ONE YEAR THE PUBLISHER HAS AND TT DOES NOT, and it is a DECISION:
  //
  //     FY2027   ~209,812 rows — the CURRENT fiscal year, partial and growing
  //
  // LA's fiscal year starts in July, so FY2026 closed 2026-06-30 and FY2027
  // is in progress. TT now holds every CLOSED year the publisher serves
  // (FY2018-FY2026). FY2027 stays out because a live year grows weekly and
  // would re-trigger `verify:out-of-period` every month, the way West
  // Hollywood FY2025-26 does — that is a choice somebody should make
  // deliberately, not inherit.
  //
  // ⚠ The publisher also carries 6 rows outside any year it serves: FY2006
  // (3), FY2007 (2), FY2011 (1), $121,312.98 all told. No declared year
  // touches them.
  //
  // ⚠ Do NOT register a year here that is not loaded. `rows` is the baseline
  // the gate compares STORED against; a line for an unloaded year is a
  // guaranteed red that says nothing. The gap belongs in a comment, which is
  // why it is one.
];
