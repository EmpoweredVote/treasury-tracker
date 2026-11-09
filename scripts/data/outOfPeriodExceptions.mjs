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
  // ⚠⚠ FY2017 AND FY2018 ADDED 2026-11-08, and they are not a new defect —
  // they are the same publisher behaviour in two files TT did not know existed
  // until #356 found them by asking data.weho.org what it has EVER served.
  // They were loaded AFTER this registry was last measured, which is the only
  // reason the gate went red.
  //
  // ⭐⭐ CONFIRMED AGAINST THE PUBLISHER, NOT TT'S OWN COPY. data.weho.org was
  // asked for its own count of rows outside each file's fiscal period, and it
  // returned TT's numbers exactly:
  //
  //   jaed-p39k (FY2016-17)   before 2016-07-01: 1,341   on/after 2017-07-01: 288
  //   cz69-a684 (FY2017-18)   before 2017-07-01:   192   on/after 2018-07-01: 278
  //
  // A tree built from TT's transactions always ties to TT's transactions, so
  // the only reading that settles anything is the publisher's.
  // ── ⭐⭐ `readerFacing` — WHICH OF THESE A READER IS ACTUALLY TOLD ──────────
  //
  // All ten years hold out-of-period rows; only five of them distort the
  // headline enough to be worth a reader's attention. The share of each year's
  // published total that was paid OUTSIDE the year, measured 2026-11-08:
  //
  //     FY2024  27.6%   FY2026  25.0%   FY2019  18.6%   ← flagged
  //     FY2017   6.6%   FY2021   4.6%   FY2022   4.0%   ← register only
  //     FY2023   2.4%   FY2018   0.6%   FY2020   0.1%
  //     FY2025   0.0%
  //
  // ⚠ FY2020 and FY2025 are flagged DESPITE being clean themselves, because
  // they are the RECEIVING side of a seam: $31.05M paid during FY2020 sits in
  // FY2019's total, and $68.52M paid during FY2025 sits in FY2024's. A reader
  // landing on FY2025 sees $132.28M against FY2024's $249.36M and would read
  // spending as halving. Flagging only the odd-looking side of a seam leaves
  // the other silently misleading — the rule tests/figureFlags.test.ts already
  // enforces for Fulton FY2017/FY2018.
  //
  // ⚠⚠ A 2.4% skew is not worth a banner. Spending a reader's attention on
  // FY2023 would make the FY2024 banner matter less, which is how flagging
  // everything becomes flagging nothing.
  ...[
    { fiscalYear: 2017, outRows: 1629, outAmount: '7,520,308.03', before: 1341, after: 288, span: '2014-05-08 … 2017-07-07', source: 'FY2016-17' },
    { fiscalYear: 2018, outRows: 470, outAmount: '735,649.20', before: 192, after: 278, span: '2015-01-02 … 2018-07-06', source: 'FY2017-18' },
    { fiscalYear: 2019, outRows: 4222, outAmount: '31,081,374.14', before: 48, after: 4174, span: '2015-07-02 … 2019-09-13', source: 'FY2018-19', readerFacing: true },
    { fiscalYear: 2020, outRows: 91, outAmount: '110,773.46', before: 91, after: 0, span: '2015-07-02 … 2019-06-28', source: 'FY2019-20', readerFacing: true },
    { fiscalYear: 2021, outRows: 512, outAmount: '7,385,478.24', before: 88, after: 424, span: '2016-07-21 … 2021-07-09', source: 'FY2020-21' },
    { fiscalYear: 2022, outRows: 499, outAmount: '6,210,359.08', before: 57, after: 442, span: '2015-07-23 … 2022-07-08', source: 'FY2021-22' },
    { fiscalYear: 2023, outRows: 367, outAmount: '3,788,357.34', before: 23, after: 344, span: '2021-04-16 … 2023-07-07', source: 'FY2022-23' },
    { fiscalYear: 2024, outRows: 5791, outAmount: '68,811,162.33', before: 84, after: 5707, span: '2016-12-09 … 2024-10-25', source: 'FY2022-24', readerFacing: true },
    { fiscalYear: 2025, outRows: 11, outAmount: '12,195.00', before: 11, after: 0, span: '2021-08-13 … 2023-12-29', source: 'FY2024-25', readerFacing: true },
    // ⚠⚠⚠ THE ONLY LIVE ONE, AND IT GROWS EVERY WEEK. See the FY2026 note above.
    //
    // ⭐⭐ `stillGrowing` IS NOT DECORATION — IT IS A COPY REQUIREMENT. This
    // source is sync_frequency WEEKLY while the other nine are `manual`, so the
    // figure the page prints for FY2026 rises on its own. Any reader-facing
    // copy about it must therefore state its numbers AS OF A DATE, or the
    // banner will end up contradicting the total displayed beside it — which is
    // worse than no banner. tests/figureFlags.test.ts enforces it.
    { fiscalYear: 2026, outRows: 6393, outAmount: '68,952,678.80', before: 1170, after: 5223, span: '2024-03-14 … 2026-10-09', source: 'FY2025-26', readerFacing: true, stillGrowing: true },
  ].map((w) => ({
    id: `west-hollywood-ca-fy${w.fiscalYear}-fiscal-straddle`,
    readerFacing: w.readerFacing === true,
    stillGrowing: w.stillGrowing === true,
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
    /**
     * ⭐⭐ CONFIRMED BY THE PUBLISHER, PER YEAR, 2026-11-08. data.weho.org was
     * asked for its OWN count and sum of rows outside each file's fiscal
     * period, and returned TT's figures exactly — FY2019 4,222/$31,081,374.14,
     * FY2020 91/$110,773.46, FY2024 5,791/$68,811,162.33, FY2025 11/$12,195.00,
     * FY2026 6,393/$68,952,678.80.
     *
     * ⚠⚠ FY2024 NEEDED A DIFFERENT QUESTION. Its dataset (b8ph-69yc) stores
     * check_date as TEXT in MM-DD-YYYY, so a date comparison is lexicographic
     * and matches the WHOLE FILE — it answered 23,553. Asked with
     * substring(check_date,7,4) for the year and substring(check_date,1,2) for
     * the month, it returned 17,762/$180,549,103.56 inside and
     * 5,791/$68,811,162.33 outside, which is TT to the cent. Three other
     * registers share that text format: FY2021, FY2022 and FY2023.
     *
     * ⚠ What is published to a reader is a FACT ABOUT THE FILE — the dates it
     * contains and the share of its total paid outside the year it names. Why
     * the city's files straddle is NOT published; nothing establishes it, and
     * it would be an inference about a government's internal process. Same line
     * scripts/data/mckinneyRegisterAnomalies.mjs draws.
     */
    corroboration: w.readerFacing === true
      ? '✅ Publisher-confirmed 2026-11-08 against data.weho.org\'s own counts and sums. '
        + 'Reader-facing: the claim is the period the file covers, not an inference about '
        + 'why it covers it.'
      : '⚠ PARTIAL. One analyst, 2026-11-05, against the publisher\'s own Socrata datasets. '
        + 'Register only — the distortion is too small to spend a reader\'s attention on.',
  })),

  // ── Los Angeles, CA ─────────────────────────────────────────────────────
  //
  // ⭐⭐ THE PUBLISHER CLASSIFIES THESE ROWS ITSELF, AND TT OBEYED IT.
  //
  // TT bins the LA City Checkbook by the dataset's OWN `fiscal_year` column
  // (`fiscal_year_column` in its column_mapping), not by the payment date. So
  // when LA labels a payment dated 2024-12-05 as fiscal year 2026, TT files it
  // in FY2026 — exactly as published. Nothing here is TT's placement.
  //
  // Verified 2026-11-08 by asking controllerdata.lacity.org directly:
  //
  //   $where=fiscal_year='2026' AND transaction_date < '2025-07-01T00:00:00'
  //     → count 38, sum $216,953.17
  //
  // which is TT's 38 rows and $216,953.17 to the cent.
  //
  // ⚠ ISOLATED TO FY2026. TT holds LA FY2018-FY2026 and this gate finds
  // out-of-period rows in none of the other eight — and because TT bins on the
  // publisher's own field and keeps the publisher's date, TT's count for a
  // year IS the publisher's count for that year. So this is not routine LA
  // behaviour; it is particular to FY2026.
  {
    key: 'la-city-ca-fy2026-publisher-dated-rows-in-fy2026',
    municipality: 'Los Angeles',
    state: 'CA',
    fiscalYear: 2026,
    outRows: 38,
    disposition: 'loaded-as-published',

    what:
      '38 transactions in Los Angeles FY2026 are dated 2024-12-05 and 2024-12-06 — about '
      + 'seven months before the fiscal period opens on 2025-07-01 — totalling $216,953.17. '
      + 'All 38 are payments to INSIGHT PUBLIC SECTOR, INC. for software and subscriptions, '
      + 'from the "LA City Checkbook" source.',

    evidence: [
      "LA's own dataset carries fiscal_year '2026' on every one of these rows while dating "
        + 'them in December 2024. Asked directly: $where=fiscal_year=\'2026\' AND '
        + "transaction_date < '2025-07-01T00:00:00' returns count 38, sum $216,953.17 — TT's "
        + 'figures exactly.',
      'TT bins this source by the publisher\'s `fiscal_year` column, so the year is the '
        + "city's classification and not TT's inference from the date.",
      'The descriptions name coverage periods that begin in late 2024 — "Adobe Pro DC '
        + 'coverage 10/1/24-9/30/25", "ZOHO ManageEngine AD360 … 10/25/24-10/24/25", "BMC '
        + 'Track-It … 10/30/24-10/29/25" — so these are subscription terms, one vendor, two '
        + 'adjacent payment dates.',
      'None of the other eight LA fiscal years TT holds has any out-of-period row, so this '
        + 'is specific to FY2026 rather than a habit of the dataset.',
    ],

    magnitude:
      '$216,953.17 — a rounding error against the billions TT publishes for LA City FY2026, '
      + 'and the YEAR TOTAL is unaffected either way: the rows carry the publisher\'s own '
      + 'FY2026 label and belong in the FY2026 total. Only the dates sit outside it.',

    /**
     * ⚠⚠ WHY NO EXPLANATION IS RECORDED. A prepaid subscription re-coded to
     * the year its term is recognised in would produce exactly this shape, and
     * so would a keying slip, and so would a re-issued encumbrance. Nothing LA
     * publishes distinguishes them, so the register says WHAT and not WHY —
     * the same line scripts/data/mckinneyRegisterAnomalies.mjs draws between a
     * fact about the file and an inference about the publisher.
     */
    whyNotCorrected:
      "The fiscal year is the city's own, stated in its own column. Re-binning these rows by "
      + 'payment date would make TT overrule a classification Los Angeles published, and the '
      + 'reader could not see that the judgement had been made.',

    readerImpact:
      '⚠ NEGLIGIBLE but real. FY2026\'s headline includes $216,953.17 paid in December 2024.',

    corroboration:
      '⚠ PARTIAL. One analyst, 2026-11-08, against the publisher\'s own Socrata dataset. '
      + '⛔ Short of the src/data/figureFlags.ts bar, which requires independent AGENTS. '
      + 'Not reader-facing, and at this magnitude a banner would cost a reader more attention '
      + 'than the figure is worth.',
  },
];
