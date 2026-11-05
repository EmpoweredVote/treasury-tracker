/**
 * Budgets that hold transactions dated outside their own fiscal period, and
 * the reason each is tolerated.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ⚠⚠ THIS FILE IS A LIST OF KNOWN DEFECTS, NOT A LIST OF THINGS THAT ARE FINE.
 * An entry means "somebody looked, and TT keeps the row on purpose" — not that
 * the publisher's date is correct. `npm run verify:out-of-period` fails on any
 * budget that is NOT here, on any entry whose row count has MOVED, and on any
 * entry that no longer matches anything at all.
 *
 * `outRows` is the exact count the gate expects. It is deliberately exact: a
 * tolerance would let a new defect hide inside an old one's allowance.
 *
 * Measured 2026-11-05 against treasury.out_of_period_transaction_status():
 * 41 transaction budgets evaluated, 0 skipped, 9 with hits, 103 rows.
 */

/** @type {Array<Record<string, unknown>>} */
export const OUT_OF_PERIOD_EXCEPTIONS = [
  {
    key: 'frisco-tx-fy2019-row-dated-2009',
    municipality: 'Frisco',
    state: 'TX',
    fiscalYear: 2019,
    outRows: 1,
    disposition: 'loaded-as-published',

    what:
      "Frisco's FY2019 check register opens with a row dated 2009-04-05 — ten years "
      + 'outside its own fiscal year — for $2,556,546.04, vendor "CITY OF FRISCO - '
      + 'BIWEEKLY PAYROLL", description "CASH - PAYROLL". TT reads the file correctly: '
      + 'the published XLSX really does carry that date.',

    /**
     * ⭐ Five independent signals, and every one of them says 2019-04-05. This
     * is as close to settled as a single-analyst reading gets — which is
     * exactly why the DATE IS STILL NOT CHANGED. See `whyNotCorrected`.
     */
    evidence: [
      'The biweekly payroll series runs on FRIDAYS, exactly 14 days apart, for all 25 '
        + 'of its other FY2019 paydays.',
      'That series has exactly ONE break in cadence: a 28-day gap from 2019-03-22 to '
        + '2019-04-19. The missing payday is 2019-04-05.',
      'NO row anywhere in the FY2019 file is dated 2019-04-05.',
      '2019-04-05 was a Friday, matching all 25 other paydays. 2009-04-05 was a Sunday, '
        + 'matching none of them.',
      '$2,556,546.04 sits inside the series’ contemporaneous range of $2.37M–$2.68M.',
    ],

    magnitude:
      '$2,556,546.04 — 0.70% of the $365,021,764.02 TT publishes for Frisco FY2019. '
      + 'The YEAR TOTAL is unaffected either way: the row is in the publisher’s FY2019 '
      + 'file and belongs in the FY2019 total. Only the date is wrong.',

    /**
     * ⚠⚠ THE MILLEDGEVILLE RULE APPLIES TO A DATE EXACTLY AS IT DOES TO AN
     * AMOUNT. Rewriting 2009 to 2019 would be TT asserting something the
     * publisher never said, and the reader could not see that the judgement
     * had been made. Strong evidence is a reason to FLAG confidently, never a
     * licence to edit silently.
     */
    whyNotCorrected:
      'TT loads what Frisco published and declares the discrepancy. The correction is '
      + "Frisco's to make, not TT's.",

    benignExplanations: [
      'A single-digit keying slip, 2009 for 2019, in the first row of an export.',
      'Nothing about this implies anything beyond a typo: the amount is ordinary for the '
        + 'series and the money is accounted for in the right fiscal year.',
    ],

    readerImpact:
      'NONE today. payment_date is stored but not consumed — no API route, component or '
      + 'tree builder reads it, so no reader currently sees a 2009 date. This entry exists '
      + 'so that stays true deliberately rather than by luck.',

    corroboration:
      '⚠ PARTIAL. One analyst, 2026-11-05, reading the publisher’s own XLSX with the '
      + "loader's own parser. ⛔ Short of the src/data/figureFlags.ts bar, which requires "
      + 'independent AGENTS. Not reader-facing.',
  },

  // ── West Hollywood, CA ──────────────────────────────────────────────────
  //
  // ⚠⚠ A DIFFERENT DEFECT ENTIRELY, AND NOT YET INVESTIGATED. These 102 rows
  // are NOT typos. Two things are visible from a first reading and neither has
  // been run down:
  //
  //   * Many carry an amount of exactly $0 — FY2018's 16 rows sum to $0.00 —
  //     which looks like voided or zero-value register entries.
  //   * Others are small refunds ("PARKING CITE OVERPAYMENT" $15 dated
  //     2015-07-02) that appear to carry the ORIGINAL transaction's date
  //     rather than the refund's.
  //
  // ⚠ And the files are MULTI-YEAR — "FY2018-19" and "FY2022-24" each feed
  // more than one budget — so some of these rows may be binned into the wrong
  // year by TT rather than mis-dated by the publisher. That is TT's bug if so,
  // which makes it materially different from Frisco's.
  //
  // ⛔ THESE ENTRIES ASSERT NOTHING ABOUT THE CAUSE. They record the measured
  // state so the gate is honest and so a NEW West Hollywood defect still
  // fails. FY2024 alone carries $5,341,854.86 and deserves its own look.
  ...[
    { fiscalYear: 2018, outRows: 16, outAmount: '0.00', span: '2015-07-02 … 2019-05-01', source: 'FY2018-19' },
    { fiscalYear: 2019, outRows: 15, outAmount: '1,850,312.59', span: '2015-07-02 … 2020-04-23', source: 'FY2018-19' },
    { fiscalYear: 2020, outRows: 14, outAmount: '353,370.36', span: '2020-07-31 … 2021-04-02', source: 'FY2019-20' },
    { fiscalYear: 2021, outRows: 16, outAmount: '249,986.47', span: '2021-07-30 … 2022-05-10', source: 'FY2020-21' },
    { fiscalYear: 2022, outRows: 16, outAmount: '1,818,350.80', span: '2022-07-08 … 2023-06-21', source: 'FY2021-22' },
    { fiscalYear: 2024, outRows: 12, outAmount: '5,341,854.86', span: '2021-08-13 … 2025-03-21', source: 'FY2022-24' },
    { fiscalYear: 2025, outRows: 2, outAmount: '1,284.83', span: '2024-03-14 … 2025-07-18', source: 'FY2024-25' },
    { fiscalYear: 2026, outRows: 11, outAmount: '26,902.99', span: '2024-03-14 … 2025-05-09', source: 'FY2025-26' },
  ].map((w) => ({
    key: `west-hollywood-ca-fy${w.fiscalYear}-out-of-period-rows`,
    municipality: 'West Hollywood',
    state: 'CA',
    fiscalYear: w.fiscalYear,
    outRows: w.outRows,
    disposition: 'accepted-pending-investigation',
    what:
      `${w.outRows} transaction(s) in West Hollywood FY${w.fiscalYear} fall outside the `
      + `fiscal period, spanning ${w.span}, totalling $${w.outAmount}. From the `
      + `"West Hollywood Demand Register ${w.source}" source.`,
    evidence: [
      'Measured 2026-11-05 by treasury.out_of_period_transaction_status().',
      'Zero-value voids and refunds carrying an earlier transaction date are both present; '
        + 'which rows are which has NOT been separated.',
    ],
    whyNotCorrected:
      '⛔ NOT INVESTIGATED. Cause unknown — publisher dating, or TT mis-binning rows from a '
      + 'multi-year file across budgets. Recorded so the gate is honest and so any NEW '
      + 'out-of-period row here still fails.',
    corroboration: '⛔ NONE. Measurement only. TT asserts nothing about the cause.',
  })),
];
