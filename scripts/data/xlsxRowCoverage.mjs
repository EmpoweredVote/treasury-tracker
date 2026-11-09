/**
 * Every XLSX transaction budget, and how many rows it should hold.
 *
 * ⚠⚠⚠ READ scripts/lib/rowCoverage.mjs BEFORE EDITING. `rows` is a BASELINE,
 * not a tolerance: the gate hard-fails when TT and the publisher's file
 * disagree, and merely reports when this number has gone stale because the
 * publisher restated.
 *
 * ⚠⚠ `rows` IS NOT THE NUMBER OF ROWS IN THE FILE, and the two must never be
 * confused. It is the number of DISTINCT row keys the file implies once the
 * loader's own policies have run — the publisher's grand total removed (#336),
 * Frisco's repeated allocation rows collapsed, blank and header-dupe rows
 * dropped, identical rows keyed by the source's dedup policy, and ON CONFLICT
 * (budget_id, source_row_id) DO NOTHING applied. See scripts/lib/xlsxPolicies.mjs.
 *
 *   Frisco FY2018:  23,184 rows in the file
 *                   23,183 after the publisher's grand total comes out
 *                   19,786 after repeated allocations collapse
 *                   19,297 distinct keys  ← this is `rows`
 *
 * All four numbers are correct. Only the last one is comparable to a COUNT(*)
 * over treasury.transactions, which is why the gate computes it rather than
 * counting lines in a spreadsheet.
 *
 * ── MEASURED 2026-11-08 ────────────────────────────────────────────────────
 *
 * Every one of these 22 budgets tied EXACTLY on the first run: TT holds, to
 * the row, what each publisher's file implies. That is the baseline, not a
 * finding — nothing had asked these publishers before, so "nothing was wrong"
 * was not previously knowable.
 *
 * ⚠ TWO OF THESE GROW, and will move this baseline without anything being
 * wrong:
 *   - Frisco FY2026 is the CURRENT fiscal year (Frisco's FY starts 1 October).
 *   - Plano's URLs are a LIVE report generator, `ReportExport.aspx` with SD/ED
 *     date parameters, not a static file. A closed year should be stable, but
 *     the generator is free to restate it, and it returns rows in a different
 *     order on each call — which is harmless here only because Plano keys on
 *     content, so the set of keys does not depend on their order. ⚠⚠ An
 *     `occurrence`-keyed source served by a generator with unstable ordering
 *     would NOT be safe to baseline this way.
 */
export const XLSX_ROW_COVERAGE = [
  // ── Frisco, TX — one published file per fiscal year ─────────────────────
  //
  // ⚠ FY2018 and FY2019 are the two that wrote the CHECK TOTAL on every GL
  // line; their `allocation_rows: 'repeat-payment-total'` collapse is why
  // their file-row counts are so much larger than their baselines.
  { source: 'Frisco Check Register FY2018', fiscalYear: 2018, rows: 19297 },
  { source: 'Frisco Check Register FY2019', fiscalYear: 2019, rows: 20165 },
  { source: 'Frisco Check Register FY2020', fiscalYear: 2020, rows: 19738 },
  { source: 'Frisco Check Register FY2021', fiscalYear: 2021, rows: 14743 },
  { source: 'Frisco Check Register FY2022', fiscalYear: 2022, rows: 17488 },
  { source: 'Frisco Check Register FY2023', fiscalYear: 2023, rows: 16009 },
  { source: 'Frisco Check Register FY2024', fiscalYear: 2024, rows: 16280 },
  { source: 'Frisco Check Register FY2025', fiscalYear: 2025, rows: 16358 },

  // ⚠ CORRECTED 2026-11-08: this is NOT the current fiscal year. All three
  // Texas cities run OCTOBER-SEPTEMBER, so FY2026 ended 2026-09-30, and
  // Frisco's last payment is exactly that date — a closed, complete year. The
  // live year is FY2027. The file is still named "FY26_To_Date" and still
  // lives in DocumentCenter rather than the Archive Center, which is what
  // made it look current; neither is a statement about the period it covers.
  //
  // ⚠⚠ It may still move, because a city can post a late payment against a
  // closed year. If it does, CHECK IT IS AN APPEND before syncing. These files
  // are keyed on content, so a wholesale restate that changed any column would
  // re-key every row and DOUBLE the year.
  { source: 'Frisco Check Register FY2026', fiscalYear: 2026, rows: 17595 },

  // ── McKinney, TX ────────────────────────────────────────────────────────
  //
  // ⚠⚠ The only sources here keyed by `dedup: 'occurrence'` — four police
  // Tahoes at $52,962.25 on one purchase order are four payments, not one.
  // That is why McKinney's baselines equal its file row counts exactly, where
  // every Frisco and Plano baseline is smaller than its file.
  //
  // ⚠ mckinneytexas.org's WAF refuses Node with a flat 403 and lets curl
  // through; downloadXLSX already falls back. The gate reports that fallback
  // on stderr every run, and it is expected, not a fault.
  //
  // ⚠⚠⚠ ONLY FOUR YEARS ARE DECLARED. McKinney publishes through an
  // Archive.aspx listing, and nothing here has asked that listing what it has
  // EVER served. These four are what TT claims, not what McKinney has.
  { source: 'McKinney Check Register FY2022', fiscalYear: 2022, rows: 45844 },
  { source: 'McKinney Check Register FY2023', fiscalYear: 2023, rows: 47169 },
  { source: 'McKinney Check Register FY2024', fiscalYear: 2024, rows: 47324 },
  { source: 'McKinney Check Register FY2025', fiscalYear: 2025, rows: 50096 },

  // ⚠⚠⚠ AN ELEVEN-MONTH YEAR, LOADED AS PUBLISHED AND FLAGGED ON THE PAGE.
  // The file covers 2025-10-03 to 2026-08-28 and holds no September 2026
  // payment, so this baseline is eleven months of a twelve-month year —
  // $597,313,687.70 over 46,797 lines, every one of them held.
  //
  // ⭐ THIS BASELINE MOVING IS THE SIGNAL TO RETIRE THE READER-FACING FLAG.
  // If McKinney republishes with September in it, the gate reports a moved
  // baseline (a notice, not a failure); after the reload the banner in
  // src/data/figureFlags.ts saying "this covers eleven months" becomes FALSE
  // and must be REMOVED, not reworded. See the `retireWhen` condition in
  // scripts/data/mckinneyRegisterAnomalies.mjs.
  { source: 'McKinney Check Register FY2026', fiscalYear: 2026, rows: 46797 },

  // ── Plano, TX — a live report generator, not a file ─────────────────────
  //
  // ⚠⚠ Plano's register serves CSV from a query string with no suffix, and its
  // descriptions carry unquoted inch marks. The parser's fixed-width repair is
  // what stands between these baselines and the 694 rows / $786,721.63 that
  // naive quote handling cost FY2024 alone — so a sudden drop in a Plano
  // baseline is as likely to be a parsing regression as a publisher change.
  // Check the file before believing either.
  { source: 'Plano Check Register FY2017', fiscalYear: 2017, rows: 71376 },
  { source: 'Plano Check Register FY2018', fiscalYear: 2018, rows: 68435 },
  { source: 'Plano Check Register FY2019', fiscalYear: 2019, rows: 59836 },
  { source: 'Plano Check Register FY2020', fiscalYear: 2020, rows: 41303 },
  { source: 'Plano Check Register FY2021', fiscalYear: 2021, rows: 28007 },
  { source: 'Plano Check Register FY2022', fiscalYear: 2022, rows: 28213 },
  { source: 'Plano Check Register FY2023', fiscalYear: 2023, rows: 28953 },
  { source: 'Plano Check Register FY2024', fiscalYear: 2024, rows: 28863 },
  { source: 'Plano Check Register FY2025', fiscalYear: 2025, rows: 23816 },

  // ⚠ Added 2026-11-08. A CLOSED, COMPLETE year — all twelve months, Oct 2025
  // through Sep 2026, $515,381,643.03 across 24,223 published lines. TT had
  // never asked for it: the gate above went green on 22 budgets precisely
  // because it iterates what TT DECLARES. See the FY2026 migration.
  { source: 'Plano Check Register FY2026', fiscalYear: 2026, rows: 23238 },
];
