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
  // ⚠ The source declares fiscal_years 2021-2026 but TT publishes only FY2024
  // and FY2025, so only those are loaded and only those are registered. The
  // other four years are available from the publisher and NOT loaded — that is
  // a coverage decision, not a defect, and it is recorded here so the next
  // person does not rediscover it as one.
  { source: 'LA City Checkbook', fiscalYear: 2024, rows: 713133 },
  { source: 'LA City Checkbook', fiscalYear: 2025, rows: 749295 },
];
