/**
 * McKinney, TX check registers — the anomaly register.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MILLEDGEVILLE RULE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chris, 2026-08-29: *"It is not our job to hide bad data"* — reflect what is
 * ACCURATE, and flag what looks inconsistent, saying why.
 *
 * ── ⚠⚠ THIS ENTRY *IS* READER-FACING, AND HERE IS WHY IT CLEARS THE BAR ────
 *
 * The sibling register (scripts/data/friscoRegisterAnomalies.mjs) is marked
 * NOT reader-facing, and draws the line that matters:
 *
 *   "'100% of distinct rows appear an even number of times' is a FACT ABOUT
 *    THE FILE. 'Therefore the publisher exported the day twice' is an
 *    INFERENCE, and it is the inference that reaches the reader."
 *
 * Frisco's entry is held back because its claim is the inference. This one is
 * held to the same line and lands on the other side of it: everything the
 * reader is told is a fact about the file or about McKinney's own published
 * fiscal calendar.
 *
 *   PUBLISHED  the file's payments run 2025-10-03 to 2026-08-28
 *   PUBLISHED  it contains no payment dated in September 2026
 *   PUBLISHED  McKinney's fiscal year runs October-September
 *   PUBLISHED  eleven months of spending is not comparable to twelve
 *
 *   ⚠ NOT PUBLISHED, because it is an inference nothing establishes:
 *     *why* September is absent. "The city has not posted it yet" is the
 *     obvious reading and may well be right, and it is still a guess about a
 *     government's internal process. The banner does not say it.
 *
 * ── ⚠ THE FISCAL-YEAR BOUNDARY IS CORROBORATED, NOT ASSUMED ────────────────
 *
 * Three independent directions, none of them the check register's contents:
 *
 *   1. McKinney's Annual Budget archive (Archive.aspx?AMID=37) names each year
 *      "FY 2025-2026", "FY 2024-2025" … — a different document family stating
 *      an October-September year.
 *   2. All four earlier McKinney registers in TT end in late September
 *      (2022-09-30, 2023-09-29, 2024-09-30, 2025-09-26), twelve months each.
 *   3. The FY26 file's own `fiscal_year` column: 2026 on 43,764 rows, 2025 on
 *      the 3,033 paid in October against prior-year invoices.
 */

/** @type {Array<Record<string, unknown>>} */
export const MCKINNEY_REGISTER_ANOMALIES = [
  {
    id: 'mckinney-tx-fy2026-eleven-month-year',
    key: 'mckinney-tx-fy2026-eleven-month-year',
    municipality: 'McKinney',
    state: 'TX',
    fiscalYears: [2026],
    dataset: 'transactions',

    /**
     * ⚠ LOADED, exactly as published. Every row in the file is real, parsed
     * and stored: 46,797 published lines against 46,797 rows held, verified
     * against the publisher's own file by `npm run verify:xlsx-row-coverage`.
     * Nothing is withheld, capped or corrected. What the flag adds is the
     * PERIOD the figure covers.
     */
    loaded: true,
    disposition: 'loaded-as-published',
    severity: 'incomplete-period',

    what:
      "McKinney's FY2026 check register covers 2025-10-03 to 2026-08-28 and contains no "
      + 'payment dated in September 2026. McKinney\'s fiscal year runs October to September, '
      + 'so the file holds eleven months of a twelve-month year: $597,313,687.70 over 46,797 '
      + 'published lines.',

    whyItMatters:
      'Against FY2025 the figure reads as a FALL — $597,313,687.70 against $619,940,294.15, '
      + 'down $22.6 million or about 3.6% — and a reader would take that as McKinney spending '
      + 'less. Per month it is the opposite: $54.3 million against FY2025\'s $51.7 million. A '
      + "twelfth month at the year's own rate would put FY2026 near $651 million, up about 5%.",

    /** The four complete years this one is read against. */
    comparison: [
      { fiscalYear: 2022, total: 373359332.59, rows: 45844, months: 12 },
      { fiscalYear: 2023, total: 432897552.41, rows: 47169, months: 12 },
      { fiscalYear: 2024, total: 488161856.36, rows: 47324, months: 12 },
      { fiscalYear: 2025, total: 619940294.15, rows: 50096, months: 12 },
      { fiscalYear: 2026, total: 597313687.70, rows: 46797, months: 11 },
    ],

    /**
     * ⚠⚠⚠ RETIRE THIS FLAG, DO NOT EDIT IT, WHEN SEPTEMBER APPEARS.
     *
     * If McKinney republishes the FY26 file with September 2026 in it, a
     * reload makes this a twelve-month year and the banner becomes FALSE — a
     * flag saying "this covers eleven months" on a complete year is its own
     * misinformation. `verify:xlsx-row-coverage` is what will notice: the
     * baseline in scripts/data/xlsxRowCoverage.mjs will move, reported as a
     * notice rather than a failure.
     *
     * The condition is mechanical: the budget covers twelve distinct months,
     * or holds any payment dated in September 2026. Remove the entry from
     * src/data/figureFlags.ts and mark this one retired.
     */
    retireWhen:
      'McKinney Check Register FY2026 holds any payment dated 2026-09-01 or later, or covers '
      + 'twelve distinct payment months.',

    source_name: 'City of McKinney FY26 Check Register',
    source_url: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2849',
    source_date: '2026-11-08',
  },
];
