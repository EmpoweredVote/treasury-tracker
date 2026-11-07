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
  // ⭐⭐ THE CAUSE IS NOW KNOWN, AND IT IS NOT WHAT THE FIRST READING SAID.
  //
  // These entries used to read "⛔ NOT INVESTIGATED", guessing at zero-value
  // voids, refunds carrying an original transaction's date, or TT mis-binning
  // a multi-year file. ALL OF THOSE WERE WRONG. Two separate things were
  // happening and the first hid the second:
  //
  //   1. 99.9% of the register was MISSING. `source_row_id_column` named
  //      `demand` -- a BATCH number, 22 of them across 24,123 rows -- so
  //      ON CONFLICT (budget_id, source_row_id) DO NOTHING kept one row per
  //      batch. The 102 "out-of-period" rows were simply the earliest-dated
  //      survivor of each batch, because the loader paged by check_date
  //      ascending. Fixed by #TBD; the register now holds every published row.
  //
  //   2. WEST HOLLYWOOD'S FILES GENUINELY STRADDLE FISCAL YEARS. With the
  //      full data loaded, the overhang is large and it is the publisher's.
  //      Every row's check_date was parsed and binned on a July-June year:
  //
  //        file          its own year    overhang into the next    matches
  //        FY2018-19     FY2019 19,900   FY2020 4,174              4,174 after
  //        FY2022-24     FY2024 17,762   FY2025 5,707              5,707 after
  //        FY2025-26     FY2026 18,438   FY2027 5,223 + earlier 1,170
  //
  //      The publisher's binning and TT's stored out-of-period counts agree
  //      EXACTLY, row for row. Nothing is mis-binned: each file is loaded
  //      whole into the one year it predominantly covers, as published.
  //
  //   3. ⚠⚠⚠ FY2025-26 IS STILL OPEN, AND IT IS NOW SPILLING FORWARD INTO
  //      FY2027. This entry read 1,164 rows on 2026-11-05 and 6,393 on
  //      2026-11-06: the city appended 8,675 rows overnight, 5,223 of them
  //      dated 2026-07-01 … 2026-10-09 — payments made AFTER FY2026 ended,
  //      written into a file whose title says FY 2025-26. The city is using
  //      that file as its current register and has not opened an FY2026-27 one.
  //
  //      ⚠ So this number is not stable and is not meant to be. Expect it to
  //      climb by roughly 1,500 rows a month for as long as the city keeps
  //      posting there, and expect `verify:out-of-period` to say so. Each move
  //      needs the same check the others got — WHICH months moved — because a
  //      file reaching further forward is the known behaviour, and anything
  //      else is not.
  //
  // ⚠⚠ WHAT THIS COSTS A READER, STATED PLAINLY. FY2024 publishes
  // $249,360,265.89 and $68,811,162.33 of that was paid in FY2025; FY2025
  // publishes $132,277,410.01 and excludes those same payments. FY2026
  // publishes $275,281,324.20, of which only $206,328,645.40 was paid inside
  // FY2026 — $59,999,399.51 is FY2027 and $8,953,279.29 is older. Not one of
  // these years is a clean fiscal year and no file TT can fetch would make
  // them one.
  //
  // ⛔ TT DOES NOT RE-BIN THEM. Splitting each file across budgets by payment
  // date would make FY2025 the sum of two overlapping files (FY2022-24's
  // 5,707 rows and FY2024-25's 11,199) with no published way to tell a
  // genuine duplicate from a genuine repeat. Keeping the publisher's own file
  // boundary and declaring the overhang is the Milledgeville answer: load it,
  // then flag it.
  //
  // ⚠ Counts measured 2026-11-05 AFTER the reload. `before`/`after` say which
  // side of the fiscal period the rows fall on, because a file reaching
  // forward and a file reaching back are different publisher behaviours.
  ...[
    { fiscalYear: 2019, outRows: 4222, outAmount: '31,081,374.14', before: 48, after: 4174, span: '2015-07-02 … 2019-09-13', source: 'FY2018-19' },
    { fiscalYear: 2020, outRows: 91, outAmount: '110,773.46', before: 91, after: 0, span: '2015-07-02 … 2019-06-28', source: 'FY2019-20' },
    { fiscalYear: 2021, outRows: 512, outAmount: '7,385,478.24', before: 88, after: 424, span: '2016-07-21 … 2021-07-09', source: 'FY2020-21' },
    { fiscalYear: 2022, outRows: 499, outAmount: '6,210,359.08', before: 57, after: 442, span: '2015-07-23 … 2022-07-08', source: 'FY2021-22' },
    { fiscalYear: 2023, outRows: 367, outAmount: '3,788,357.34', before: 23, after: 344, span: '2021-04-16 … 2023-07-07', source: 'FY2022-23' },
    { fiscalYear: 2024, outRows: 5791, outAmount: '68,811,162.33', before: 84, after: 5707, span: '2016-12-09 … 2024-10-25', source: 'FY2022-24' },
    { fiscalYear: 2025, outRows: 11, outAmount: '12,195.00', before: 11, after: 0, span: '2021-08-13 … 2023-12-29', source: 'FY2024-25' },
    // ⚠⚠⚠ THE ONLY LIVE ONE, AND IT GROWS EVERY WEEK. See the FY2026 note above.
    { fiscalYear: 2026, outRows: 6393, outAmount: '68,952,678.80', before: 1170, after: 5223, span: '2024-03-14 … 2026-10-09', source: 'FY2025-26' },
  ].map((w) => ({
    key: `west-hollywood-ca-fy${w.fiscalYear}-out-of-period-rows`,
    municipality: 'West Hollywood',
    state: 'CA',
    fiscalYear: w.fiscalYear,
    outRows: w.outRows,
    disposition: 'loaded-as-published',
    what:
      `${w.outRows.toLocaleString()} transaction(s) in West Hollywood FY${w.fiscalYear} fall outside the `
      + `fiscal period (${w.before.toLocaleString()} before it, ${w.after.toLocaleString()} after), `
      + `spanning ${w.span}, totalling $${w.outAmount}. From the `
      + `"West Hollywood Demand Register ${w.source}" source.`,
    evidence: [
      'Measured 2026-11-06 by treasury.out_of_period_transaction_status(), after the reload '
        + 'that restored every published row.',
      'Every row of every West Hollywood dataset was parsed and binned on a July-June fiscal '
        + 'year directly from the publisher: the overhang counts agree with the stored '
        + 'out-of-period counts exactly, so these rows are dated by the publisher and not '
        + 'placed by TT.',
      'The file is loaded whole into the single year it predominantly covers, which is the '
        + 'year the publisher itself declares in fiscal_years.',
    ],
    whyNotCorrected:
      'The dates are the publisher\'s. Re-binning rows across budgets by payment date would '
      + 'make FY2025 the sum of two overlapping files with no published way to separate a '
      + 'genuine duplicate from a genuine repeat — TT would be inventing a boundary the city '
      + 'never drew.',
    readerImpact:
      `⚠ REAL. FY${w.fiscalYear}'s headline includes $${w.outAmount} paid outside the year it names.`,
    corroboration:
      '⚠ PARTIAL. One analyst, 2026-11-05, against the publisher\'s own Socrata datasets. '
      + '⛔ Short of the src/data/figureFlags.ts bar, which requires independent AGENTS. '
      + 'Not reader-facing yet.',
  })),
];
