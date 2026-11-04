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
     * exists. TT publishes $984,351,429.99 where Frisco's own file states
     * $1,001,344,551.22. TT is BELOW the publisher's stated total on purpose.
     */
    disposition: 'loaded-below-publisher-total',
    severity: 'publisher-export-artifact',

    what:
      "Frisco's FY2019 check register contains four days in June 2019 whose records "
      + 'appear to have been written to the file TWICE. TT discards the duplicates, so '
      + "TT's figure is $16,993,121.23 below the register's own stated TOTAL — which "
      + 'includes them, because the same report generated both the data rows and the total.',

    magnitude: [
      "Frisco's own TOTAL row: $1,001,344,551.22. TT publishes $984,351,429.99. "
        + 'The difference is $16,993,121.23 — 1.70%.',
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
];
