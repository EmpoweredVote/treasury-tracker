/**
 * Frisco, TX check registers — the anomaly register.
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
 * ── ⚠⚠⚠ THIS FILE IS NOT YET READER-FACING, AND MUST NOT BE PROMOTED ───────
 *
 * `src/data/figureFlags.ts` requires that a claim about a government's figures
 * be reached INDEPENDENTLY — separate agents, neutral prompts, neither shown
 * the other's work, approached from different directions — before a reader is
 * told it. The entry below is a SINGLE-ANALYST OBSERVATION. It stays here,
 * marked as such, until that bar is met.
 *
 * ⚠ The arithmetic is not in doubt; the INTERPRETATION is what needs a second
 * pair of eyes. "100% of distinct rows appear an even number of times" is a
 * fact about the file. "Therefore the publisher exported the day twice" is an
 * inference, and it is the inference that reaches the reader.
 */

/** @type {Array<Record<string, unknown>>} */
export const FRISCO_REGISTER_ANOMALIES = [
  {
    key: 'frisco-tx-fy2019-duplicated-export-days',
    municipality: 'Frisco',
    state: 'TX',
    fiscalYears: [2019],
    dataset: 'operating',
    loaded: true,

    /**
     * ⚠⚠ NOT 'loaded-as-published', and this is the whole reason the entry
     * exists. TT publishes $365,021,764.02 where Frisco's own file states
     * $1,001,344,551.22. TT is BELOW the publisher's stated total on purpose,
     * for TWO independent reasons that compose: the four doubled export days
     * described here, and the repeated allocation rows described in the next
     * entry, which is much the larger of the two.
     */
    disposition: 'loaded-below-publisher-total',
    severity: 'publisher-export-artifact',

    what:
      "Frisco's FY2019 check register contains four days in June 2019 whose records "
      + 'appear to have been written to the file TWICE. TT discards the duplicates, so '
      + "TT's figure is $16,993,121.23 below the register's own stated TOTAL — which "
      + 'includes them, because the same report generated both the data rows and the total.',

    magnitude: [
      "Frisco's own TOTAL row: $1,001,344,551.22. Removing ONLY these duplicates "
        + 'would give $984,351,429.99, a difference of $16,993,121.23 (1.70%).',
      '⚠ TT now publishes $365,021,764.02, because the repeated allocation rows in '
        + 'the next entry are collapsed as well. The two defects OVERLAP and compose '
        + 'correctly: SHI Government Solutions appears four times on 2019-06-04 at '
        + '$1,081,182.43 — two account lines, each written twice by the doubled export. '
        + 'One payment of $1,081,182.43 survives, which is what the city paid.',
      'The duplicated rows are 1,027 of the file\'s 25,426 data rows, concentrated on '
        + '2019-06-03, 06-04, 06-06, 06-07, 06-11 and 06-13.',
      'Largest single duplicated payment: TMRS retirement, $2,301,072.23, twice on '
        + '2019-06-13. Also SHI Government Solutions $1,081,182.43 twice, and payroll '
        + 'FICA and federal withholding of $940,991.21 each, twice, on 2019-06-14.',
    ],

    verifiedBecause: [
      'On 2019-06-06, 06-11 and 06-13, 100% of distinct rows appear an EVEN number of '
        + 'times and NOT ONE row appears exactly once. On 06-04 it is 272 of 273. The '
        + 'baseline in the same file is 1.3% even for May 2019 and 0.7% for July 2019, '
        + 'where ~99% of rows appear exactly once.',
      'A real payment day always contains rows that happen only once. Zero is not '
        + 'reachable by coincidence; it requires the day to have been emitted twice.',
      'The duplicates are adjacent or interleaved at a fixed offset (rows 16418/16420 '
        + 'and 16419/16421 are a two-row block repeated), not scattered as genuine '
        + 'repeated payments would be.',
      'The same signature appears in Plano\'s registers on 2020-04-10, 2021-07-30, '
        + '2022-03-18, 2022-07-29 and 2024-12-06 — so it is a known export failure mode, '
        + 'not a Frisco-specific reading.',
    ],

    benignExplanations: [
      'A city CAN legitimately pay the same amount twice on one day, and Frisco '
        + 'publishes only date, vendor, description and amount — no identifier column at '
        + 'all — so genuinely distinct events are inherently byte-identical. That is why '
        + 'the ordinary background of repeated rows in every OTHER Frisco year '
        + '($60k–$156k each) is left alone rather than treated as an artifact.',
      'The evidence here is not the repetition itself but its SHAPE: a whole day with '
        + 'no row occurring once. That cannot be explained by a city paying twice.',
    ],

    supportingContext:
      '⚠ Separately, and now FIXED: TT published Frisco FY2018, FY2019 and FY2022 at '
      + "exactly TWICE the truth because the register's own `TOTAL` row was loaded as a "
      + 'transaction ($2,523,034,629.69 of phantom spending). That was a TT defect, not a '
      + 'publisher one, and is not a reader flag — it is simply corrected. It is noted '
      + 'here because the same three files are involved and a future reader comparing old '
      + 'screenshots will otherwise be confused.',

    corroboration:
      '⛔ NOT CORROBORATED. Single analyst, 2026-11-04, working from the raw XLSX files '
      + 'and from TT\'s own stored transactions. The evenness statistics are reproducible '
      + 'with `npm run verify:doubled-days`, but no independent agent has reached the '
      + '"exported twice" conclusion from the sources. MUST NOT be promoted to '
      + 'src/data/figureFlags.ts until it has been.',
  },

  {
    key: 'frisco-tx-fy2018-fy2019-repeated-allocation-rows',
    municipality: 'Frisco',
    state: 'TX',
    fiscalYears: [2018, 2019],
    dataset: 'transactions',
    loaded: true,

    /**
     * ⚠⚠ TT DEPARTS FROM THE PUBLISHER'S STATED TOTAL HERE, deliberately.
     *
     * Frisco's own TOTAL row says $1,081,755,767.17 for FY2018 and agrees with
     * its own data rows to the cent — but what a publisher's total CANNOT say
     * is whether the rows beneath it double-count. The audited ACFR says they
     * do, by a factor of three, so TT collapses them and now publishes
     * $379,429,772.10.
     *
     * ⚠ That makes this a Milledgeville-rule departure: the figure is NOT as
     * published, and a reader comparing TT to the raw file will find a gap.
     * It is recorded here for exactly that reason.
     */
    disposition: 'collapsed-repeated-allocations',
    severity: 'scope-overstatement',

    what:
      "Frisco's FY2018 and FY2019 check registers repeat the FULL payment amount on "
      + 'EVERY account-allocation line, instead of splitting it across them. One payment '
      + 'to North Texas Municipal Water District on 2017-10-31 appears NINE times at '
      + '$6,905,317.56, once per service line; another on 2017-11-21 appears ELEVEN times '
      + 'at $4,359,026.75. The descriptions differ, so the row-dedup hash cannot see them. '
      + 'No other Frisco year does this.',

    magnitude: [
      'FY2018: 5,135 of 23,183 rows (22.1%) sit in same-date/same-vendor/same-amount '
        + 'groups with differing descriptions, carrying $702,170,403.95 of repeat.',
      'FY2019: 5,859 of 25,426 rows (23.0%), carrying $628,422,920.10.',
      'Every other year is 0.0%–0.3%. FY2025 has none at all.',
    ],

    /**
     * ⭐⭐ THE ORACLE IS THE AUDITED ACFR, and it is decisive because it sets a
     * BAND from the years that are not in question. A check register covers
     * governmental AND enterprise cash, so it should sit a little ABOVE
     * governmental expenditures — and in every ordinary year it does, by
     * 0.92x to 1.14x. FY2018 and FY2019 sit at 3.07x and 3.00x.
     */
    verifiedBecause: [
      "Frisco's FY2025 ACFR, 'Changes in Fund Balances of Governmental Funds, Last Ten "
        + "Fiscal Years' (p.150-151), gives total governmental expenditures of "
        + '$352,020,545 (FY2018) and $328,138,720 (FY2019). The column mapping was '
        + 'confirmed by making each year\'s seven components sum to its stated total '
        + 'exactly, for five separate years — the extraction is not an assumption.',
      'TT against audited, by year: FY2018 3.07x, FY2019 3.00x, then FY2020 1.06x, '
        + 'FY2021 0.92x, FY2022 1.11x, FY2023 1.14x, FY2024 1.01x, FY2025 1.11x. Two '
        + 'years stand three times outside a band the other six hold.',
      'Removing one copy per repeated-allocation group puts FY2018 at $379,585,363.22 '
        + '(1.08x) and FY2019 at $372,921,631.12 (1.14x) — INSIDE that band, from the '
        + 'high end. The structural fix and the external oracle agree without being '
        + 'tuned to each other.',
      'The paired descriptions are account lines, not separate purchases: '
        + '"CURRENT PORTION-LT DEBT" beside "NOTES PAYABLE"; "CAPITAL EXP-TRAFFIC SYS '
        + 'IMPROV" beside "RETAINAGE PAYABLE". A genuine split would apportion the '
        + 'payment across them, not repeat it whole on each.',
    ],

    benignExplanations: [
      'A city CAN pay one vendor the same amount twice in a day for different purposes. '
        + '⚠ FY2026 contains a real example: FRISCO STADIUM LLC appears twice monthly at '
        + 'the same amount as "CAPITAL EXP-BLDGS/IMPRVMNTS" and "TRANSFER OUT - CAPITAL '
        + 'PROJECT" — plausibly an expenditure and the interfund transfer funding it. '
        + 'That is why a blanket date+vendor+amount collapse would be WRONG, and why the '
        + 'repair is OPT-IN per source behind a share threshold: FY2026 has 0.3% of rows '
        + 'in such groups and the loader REFUSES to collapse it, naming the '
        + '$63,167,944.48 it would have deleted.',
      'Nine identical lines could in principle be nine separate invoices settled '
        + "together — but then the ACFR's governmental total would not be a third of what "
        + 'the register reports, in exactly the two years that show the pattern.',
    ],

    supportingContext:
      'REPAIRED 2026-11-05. FY2018 now publishes $379,429,772.10 (1.08x audited) and '
      + 'FY2019 $365,021,764.02 (1.11x). Every one of the eight years for which the ACFR '
      + 'gives a figure now sits between 0.92x and 1.14x; before the repair, two of them '
      + 'sat at 3.07x and 3.00x. The series reads as a coherent curve for a fast-growing '
      + 'city with a COVID dip — 379M, 365M, 378M, 317M, 440M, 525M, 565M, 807M, 938M — '
      + 'where previously FY2018 and FY2019 towered over FY2020 and FY2021 by ~3x and '
      + 'then collapsed, which is what prompted the question.',

    corroboration:
      '⚠ PARTIAL. One analyst, 2026-11-04, but TWO INDEPENDENT LINES OF EVIDENCE reached '
      + "from different directions: the file's internal structure (repeated allocation "
      + "rows) and an external audited document (the city's own ACFR). They agree to "
      + 'within the band set by six other years. ⛔ This still does not meet the '
      + 'src/data/figureFlags.ts bar, which requires independent AGENTS, not merely '
      + 'independent sources. MUST NOT be promoted until that is done.',
  },

  {
    key: 'frisco-tx-register-coverage-gaps',
    municipality: 'Frisco',
    state: 'TX',
    fiscalYears: [2019, 2021, 2026],
    dataset: 'transactions',
    loaded: true,

    /**
     * ⚠⚠ The figures are as published. What is NOT as published is the
     * implication that each one covers a year: FY2021's does not.
     */
    disposition: 'loaded-as-published',
    severity: 'incomplete-period',

    what:
      "Three of Frisco's registers do not cover the period their fiscal-year label "
      + 'implies. FY2021 is the serious one: it contains only TEN months, October 2020 '
      + 'through July 2021. August and September 2021 are absent entirely.',

    magnitude: [
      'FY2021: 10 of 12 months. TT publishes $316,736,239.27 as a YEAR total; it is a '
        + 'ten-month total. At the file\'s own run rate the missing two months are worth '
        + 'roughly $63M.',
      'FY2026: one business day missing — 2025-10-01, a WEDNESDAY, and the first day of '
        + 'the fiscal year. The file starts 2025-10-02 and FY2025 ends 2025-09-30, so that '
        + 'day is absent from TT entirely. A 1 October elsewhere in the series is worth '
        + '$104,857.97 (2024), $2,201,936.88 (2019) and $4,560,172.99 (2021), so the '
        + 'amount at stake is unknowable rather than small.',
      'FY2019: one row dated 2009-04-05 — ten years outside its own fiscal year — and '
        + 'the file ends 2019-09-26, missing Friday the 27th and Monday the 30th.',
    ],

    /**
     * ⭐⭐ THE ACFR BAND CORROBORATES FY2021 INDEPENDENTLY. A check register
     * covers governmental AND enterprise cash, so every complete Frisco year
     * sits a little ABOVE audited governmental expenditures. FY2021 is the
     * ONLY year below 1.0, and the only year missing months.
     */
    verifiedBecause: [
      'Read from the published files, not inferred: FY2021 lists months 2020-10 through '
        + '2021-07 and nothing after. Checked in BOTH formats Frisco publishes — the XLSX '
        + '(Archive ADID 3781) and the PDF (ADID 3780) — and the PDF has zero rows in '
        + 'August or September 2021 either. It is the publisher\'s omission, not a '
        + 'parsing or format artifact, and nothing in TT can recover it.',
      'FY2021 is 0.92x its audited governmental expenditures ($316,736,239.27 against '
        + '$345,843,297) — the only year in the series below 1.0. Every complete year runs '
        + '1.01x to 1.14x. Ten months at the file\'s own rate would reach about $380M, or '
        + '1.10x, squarely inside that band.',
      'The gaps at other year boundaries are NOT gaps. FY2023 starts 2022-10-03 because '
        + '1 October was a Saturday and the 2nd a Sunday; FY2024 starts 2023-10-02 because '
        + '1 October was a Sunday. Only FY2026 begins after a missed WEEKDAY.',
    ],

    benignExplanations: [
      'A city can have a quiet day. 2025-10-01 carrying no payments is possible, and TT '
        + 'cannot distinguish "no cheques issued" from "not published" for a single date.',
      'The FY2021 omission is harder to explain away: two consecutive months, in both '
        + 'published formats, in the one year whose total falls below the audited figure.',
    ],

    supportingContext:
      '⚠ Unlike Plano, none of this is TT asking for the wrong range. Frisco publishes '
      + 'static files at fixed archive URLs and TT loads what is in them, so there is no '
      + 'query to correct — only the gap to declare. Contrast Plano, where an exclusive '
      + 'SD/ED bound silently dropped 1,349 rows and the fix was TT\'s to make.',

    corroboration:
      '⚠ PARTIAL. One analyst, 2026-11-05. The month census is a direct reading of the '
      + 'published files and is not in doubt; the ACFR band agreeing with it is '
      + 'independent of that reading. ⛔ Still short of the src/data/figureFlags.ts bar, '
      + 'which requires independent AGENTS. MUST NOT be promoted until that is done.',
  },
];
