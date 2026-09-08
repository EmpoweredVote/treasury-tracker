/**
 * Indiana Gateway AFR — the anomaly register.
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
 * **Nothing in this file is withheld from the product.** Every figure recorded
 * here is LOADED exactly as the government published it. Editing or dropping a
 * verified figure because it looks outlandish would create a blind spot for
 * legitimate fraud — an outlier is a FINDING, not noise to be cleaned up.
 *
 * ⚠ Every entry was CORROBORATED BY INDEPENDENT AGENTS working from the raw
 * source with neutral prompts, before being recorded — Chris's standing
 * requirement for any flag of this nature. Agents are told the file layout and
 * asked a question, never the conclusion, and are explicitly invited to return
 * a null result.
 *
 * ── ⚠⚠ WHY THIS FILE IS SHAPED DIFFERENTLY FROM ITS GEORGIA PREDECESSOR ─────
 *
 * `scripts/data/gaRlgfAnomalies.mjs` is the precedent and it is **imported by
 * nothing** — measured: `GA_FIGURE_FLAGS` has zero importers, not even a test.
 * So it achieved the rule's stated MINIMUM ("a registry in the repo is the
 * minimum") and could never reach a reader, and nothing would notice if the data
 * underneath it changed. That is the guard shape #143 was about.
 *
 * A flag here therefore carries `assertions`: the exact figures the flag claims
 * the publisher filed. `assertFigureFlagStillHolds()` re-checks them on every
 * load, so if a government AMENDS its filing the loader REFUSES rather than
 * continuing to publish a stale claim about a real government. That is the Parke
 * residue pattern — pin the exact figure, refuse on drift, never a tolerance
 * where an exact registry will do.
 *
 * ⚠ Still true, and still a gap worth naming: TT has NO READER-FACING anomaly
 * surface. `treasury_sync_city_budget` takes no note or flag parameter, and the
 * only free-text a reader sees is the `data_source` name — which is load-bearing
 * for the live-sync name join and the frozen digest, so it must not be bent into
 * carrying prose. Surfacing these to readers is a product decision, not
 * something a loader can smuggle in. The rule's stated GOAL is not yet met.
 */

/**
 * `assertions` is what makes a flag self-checking:
 *   fiscalYear  the year the claim is about
 *   dataset     'revenue' | 'operating'
 *   measure     a field on the parsed result — `subsetTotal` is what TT loads
 *   expected    the exact figure, in dollars, as published
 */
export const IN_FIGURE_FLAGS = Object.freeze([
  /**
   * ── FLAG 1: the PRE-2024 years overstate this county by ~3x ───────────────
   *
   * ⚠⚠ THIS FLAG IS THE OPPOSITE OF THE ONE THIS INVESTIGATION SET OUT TO
   * WRITE. Marion County's FY2024 filing looked like a 61% collapse, and the
   * obvious flag was "FY2024/FY2025 are short filings". Independent
   * corroboration inverted it: FY2024 and FY2025 are the years that AGREE with
   * the county's own audited statements, and it is FY2013-FY2023 that are
   * inflated. The flag belongs on the earlier years.
   */
  {
    id: 'marion-county-custodial-inflation-through-fy2023',
    entity: 'Marion County',
    state: 'IN',
    countyCode: '49',
    unitCode: '0000',
    fiscalYears: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
    dataset: 'both',
    loaded: true,
    severity: 'scope-overstatement',
    what:
      'Marion County (Indianapolis, consolidated under Unigov) reports its Gateway AFR '
      + 'on an everything-through-the-treasury cash basis, so these years include '
      + 'custodial money the county collects and remits for OTHER taxing units. TT '
      + 'already excludes the Settlement fund, and the remainder still runs ~3x the '
      + "county's own audited revenue.",
    magnitude: [
      "FY2023: TT loads revenue $1,448,064,843.05 against the county's own AUDITED "
        + 'governmental-funds revenue of $436,289,784 — 3.32x.',
      'The gap narrows to 1.28x in FY2024 ($569,988,242.80 vs $446,935,168 audited) and '
        + '1.11x in FY2025 ($516,280,371.48 vs $463,520,173 audited).',
      "Marion's FY2025 ACFR shows custodial-fund additions of $2,895,709,431, of which "
        + '$2,691,995,013 is "taxes from individuals and organizations" collected for '
        + "other units — the mechanism, in the county's own audited words.",
      'The largest non-settlement custodial funds in FY2023 alone: LIT Certified Shares '
        + '$358,874,997.66, LIT Public Safety $159,421,288.99, Payroll Clearing '
        + "$101,875,285.53, Clerk's Trust $55,988,582.41, Special Purpose "
        + 'LIT-Transportation $73,937,047.72.',
    ],
    verifiedBecause: [
      'Every year ties against a DIFFERENT Gateway report: the Cash and Investments '
        + 'oracle matches fund-for-fund, 179/179 in FY2023, 148/148 in FY2024, 159/159 in '
        + "FY2025. The READ is proven; it is the publisher's SCOPE that is wide.",
      "The audited counter-figures were read from Marion County's own FY2025 ACFR "
        + '(Federal Audit Clearinghouse report 2025-12-GSAFAC-0000409398), Statistical '
        + 'Schedule 5 and the Statement of Changes in Fiduciary Net Position — confirmed '
        + 'directly in the document, not taken on report.',
      "The county's ACFR states it has no business-type activities and no component "
        + 'units, so governmental activities ARE the whole non-fiduciary county. There is '
        + 'no missing segment that could account for the gap.',
    ],
    benignExplanations: [
      "This is what a regulatory-basis cash report IS. Gateway's AFR is a receipts and "
        + 'disbursements statement for every fund in the treasury; a county auditor who '
        + 'settles property tax and distributes local income tax for every unit in the '
        + 'county will show those flows as receipts. Nothing is misreported.',
      'The county is a consolidated city-county, so a reader may also be comparing '
        + 'against the CITY of Indianapolis, whose audited governmental revenue is a '
        + 'separate $1.49B (FY2025) filed in its own ACFR.',
    ],
    supportingContext:
      'The operating core is continuous and growing straight through: General Fund '
      + 'receipts $266,918,809.15 (FY2023) -> $280,570,980.97 (FY2024) -> $302,836,808.87 '
      + '(FY2025), and Personal Services disbursements +10.0% then +11.9%. Whatever '
      + 'changed, the county did not shrink. ⚠ A broad name pattern over ALL 92 counties '
      + 'touches 46.5% of what TT would load for FY2023 (median county 40.5%), so this may '
      + 'be systemic rather than a Marion quirk — but that pattern has clear false '
      + 'positives (License Excise IS county revenue), so it is a SIZING QUESTION and an '
      + 'open scope decision, NOT a measured defect.',
    corroboration:
      '2 independent agents, neutral prompts, null result explicitly invited, told not to '
      + 'reuse repo scripts — one auditing the raw Gateway extracts fund-by-fund, one '
      + "establishing the county's real scale from audited ACFRs and DLGF budget orders. "
      + 'Both reached the custodial pass-through mechanism from different directions. '
      + '⚠ THEY DISAGREE ON CAUSE: the file-side agent infers a chart-of-accounts or '
      + 'financial-system conversion (zero fund-code overlap, fund names switching to '
      + 'ALL-CAPS); the document-side agent looked and found NO evidence of an ERP '
      + 'conversion at either entity. Recorded as a disagreement rather than resolved. '
      + 'Load-bearing figures were then re-verified against the primary documents.',
    assertions: [
      { fiscalYear: 2023, dataset: 'revenue', measure: 'subsetTotal', expected: 1_448_064_843.05 },
      { fiscalYear: 2023, dataset: 'operating', measure: 'subsetTotal', expected: 1_456_345_289.00 },
    ],
  },

  /**
   * ── FLAG 2: the FY2023 -> FY2024 step is a BASIS CHANGE, not a decline ────
   */
  {
    id: 'marion-county-scope-break-fy2024',
    entity: 'Marion County',
    state: 'IN',
    countyCode: '49',
    unitCode: '0000',
    fiscalYears: [2024, 2025],
    dataset: 'both',
    loaded: true,
    severity: 'series-discontinuity',
    what:
      "Marion County's FY2024 and FY2025 Gateway filings sit on a different fund "
      + 'structure from FY2013-FY2023 and largely stop reporting custodial pass-through. '
      + 'TT therefore shows revenue falling from $1,448,064,843.05 to $569,988,242.80, '
      + "-60.6%. ⚠⚠ THAT IS NOT A DECLINE IN THE COUNTY'S FINANCES — these two years "
      + 'are the ones that AGREE with its audited statements.',
    magnitude: [
      'Revenue $1,448,064,843.05 (FY2023) -> $569,988,242.80 (FY2024): -60.6%.',
      'Expenditure $1,456,345,289.00 -> $469,158,041.04: -67.8%.',
      'Against audited governmental-funds revenue the SAME step is $436,289,784 -> '
        + '$446,935,168, i.e. +2.4%. The county grew.',
      'ZERO of 98 fund codes carry over from FY2023 to FY2024 (Jaccard 0.000). Marion is '
        + 'the ONLY county of 92 with a fully disjoint renumbering that year; the '
        + 'statewide median is 0.7246 and the next lowest is 0.2415.',
      'Fund names switch case: 0-1% ALL-CAPS in every year 2011-2023, then 84.7% in '
        + 'FY2024 and 100% in FY2025.',
      'Funds reporting only one side rise from 17.2% (FY2023) to ~49% (FY2024/FY2025).',
    ],
    verifiedBecause: [
      'The Cash and Investments oracle ties 148/148 funds in FY2024 and 159/159 in FY2025 '
        + '— TT is reading the filing correctly.',
      'Seven pass-through funds that stop appearing account for ~94.8% of the drop, led '
        + 'by Settlement ($1,845,103,557 in FY2023 -> a $71,482,508.88 one-sided fragment '
        + 'in FY2024).',
      'Lake County RETAINS its settlement fund across the same boundary ($799,271,207 -> '
        + '$851,891,460 -> $901,078,130), so this is specific to Marion\'s filing, not a '
        + 'statewide Gateway change.',
    ],
    benignExplanations: [
      'A chart-of-accounts or financial-system conversion in which the custodial and '
        + 'distribution funds were not carried into the Gateway upload.',
      "A deliberate narrowing to the county's OWN funds, excluding custodial activity — "
        + 'which is what the audited statements do, and would explain why these years now '
        + 'match them.',
      'A fund-renumbering crosswalk gap, or a partial upload under the new structure — '
        + 'though it would have to be incomplete the same way in two consecutive years.',
      'Marion County did restate FY2022-FY2024 in its FY2025 ACFR (audit finding '
        + '2025-001, a material weakness) — but that correction is non-cash depreciation '
        + 'and moves no revenue, so it does NOT explain this.',
    ],
    supportingContext:
      'A reader comparing FY2023 with FY2024 in TT will see a 60.6% collapse that the '
      + 'underlying operating figures contradict. Both years load exactly as published. '
      + '⚠ TT has no reader-facing surface for this caveat yet — see the module header.',
    corroboration:
      'Same 2 independent agents as flag 1, same neutral-prompt conditions. The '
      + 'fund-code disjointness, the case change, the General Fund continuity and Lake '
      + "County's retained settlement fund were each re-measured from the raw extracts "
      + 'before being recorded here. ⚠ The two agents diverge on the CAUSE of the break '
      + '(system conversion vs. no evidence of one); that disagreement is itself part of '
      + 'the finding and is not resolved.',
    assertions: [
      { fiscalYear: 2024, dataset: 'revenue', measure: 'subsetTotal', expected: 569_988_242.80 },
      { fiscalYear: 2024, dataset: 'operating', measure: 'subsetTotal', expected: 469_158_041.04 },
      { fiscalYear: 2025, dataset: 'revenue', measure: 'subsetTotal', expected: 516_280_371.48 },
      { fiscalYear: 2025, dataset: 'operating', measure: 'subsetTotal', expected: 497_577_828.46 },
    ],
  },

  /**
   * ── FLAG 3: FY2019 carries ~$1.8B of payroll clearing that never rested ───
   *
   * ⚠ Found only because the FY2024 investigation looked at the WHOLE series.
   * A single-year review would have missed it entirely.
   */
  {
    id: 'marion-county-fy2019-payroll-clearing-gross-up',
    entity: 'Marion County',
    state: 'IN',
    countyCode: '49',
    unitCode: '0000',
    fiscalYears: [2019],
    dataset: 'both',
    loaded: true,
    severity: 'extreme-outlier',
    what:
      'Marion County FY2019 reports fund 105100 "Payroll Clearing" at '
      + '$1,988,575,425.58 received and $1,988,679,715.33 disbursed, against $175M-$275M '
      + 'in the surrounding years. That ONE fund is 41.7% of the year\'s receipts, and it '
      + "lifts TT's loaded revenue to $3,038,450,485.48 from $1,201,173,627.09 the year "
      + 'before and $1,437,986,303.30 the year after.',
    magnitude: [
      '11.34x the FY2018 figure, 7.22x FY2020, and 10.79x the FY2014-18 mean of '
        + '$184,245,319.',
      'Excess over the FY2020 level is roughly $1.71 BILLION.',
      'Strip this one fund out and FY2019 sits smoothly between its neighbours.',
      "The fund's own cash balance is $3-4.5M in EVERY year including FY2019 "
        + '($3,741,340 opening, $3,637,050 closing), so ~$2B never rested there.',
      'Unique in magnitude among large Indiana counties: the worst comparable spike in '
        + 'Hamilton, Lake, Allen or St. Joseph is worth 2.5% of a year and $35M.',
    ],
    verifiedBecause: [
      'It is a SINGLE SUBMITTED ROW on each side, not an aggregation artifact — receipt '
        + 'line "Payroll Fund and Clearing Account Receipts", disbursement line "Other '
        + 'Disbursements".',
      'The Cash and Investments report reproduces both figures exactly and its '
        + 'roll-forward is self-consistent ($3,741,340 + 1,988,575,426 - 1,988,679,715 = '
        + 'the $3,637,050 FY2020 opens with).',
      '⚠ That cash agreement is NOT independent corroboration — it is a different report '
        + 'over the same submission. It shows the figure was submitted this way, not that '
        + 'it is right.',
    ],
    benignExplanations: [
      'A clearing-account gross-up, the leading candidate. A payroll clearing fund '
        + 'receives from every operating fund and pays employees plus withholding '
        + 'agents; if one year captured every leg of that chain rather than one, '
        + 'throughput multiplies while the balance stays flat. The reporting LABELS for '
        + 'this fund were in flux in exactly these years, and the two sides land within '
        + '$104,289 (0.005%) of each other — the signature of a figure balanced by '
        + 'construction.',
      'A cumulative or multi-year figure entered where an annual one belonged.',
      'A one-off genuine flow reported gross through the clearing fund.',
      '⚠ A x10 decimal slip is TEMPTING BUT WEAKER THAN IT LOOKS: dividing by 10 gives '
        + '$198,857,542.56, right between the FY2014 and FY2015 actuals — but a clean x10 '
        + 'of a cents-precise value would end in .60, not .58. Do not lead with it.',
    ],
    supportingContext:
      'TT loads this year as published. A reader sees Marion revenue spike +153% in '
      + 'FY2019 and fall -53% in FY2020, driven entirely by this one fund.',
    corroboration:
      '2 independent agents, neutral prompts, told not to reuse repo scripts and '
      + 'explicitly invited to return a null result. Both found this fund-year without '
      + 'being pointed at it; the second reached it via a strict threshold test (>=3 other '
      + 'non-zero years, >=$15M, >=4x) and also volunteered a FALSE POSITIVE it had '
      + 'rejected (fund 107202 "Inheritance Tax", a 13x apparent spike that is really the '
      + '2013 renumbering), which is the behaviour that makes the rest credible. Figures '
      + 're-verified against the raw extracts before recording.',
    assertions: [
      { fiscalYear: 2019, dataset: 'revenue', measure: 'subsetTotal', expected: 3_038_450_485.48 },
      { fiscalYear: 2019, dataset: 'operating', measure: 'subsetTotal', expected: 2_933_456_533.66 },
    ],
  },

  /**
   * ── FLAG 4: FY2012 reports the same settlement money through TWO funds ────
   */
  {
    id: 'marion-county-fy2012-settlement-double-report',
    entity: 'Marion County',
    state: 'IN',
    countyCode: '49',
    unitCode: '0000',
    fiscalYears: [2012],
    dataset: 'both',
    loaded: true,
    severity: 'extreme-outlier',
    what:
      'In FY2012 alone Marion County populated BOTH settlement-type funds at full scale: '
      + '110888 "Tax Settlement" $1,313,051,592.44 and 110899 "Treasurer\'s Tax '
      + 'Collections" $1,364,152,597.39 — $2,677,204,190 combined, against a '
      + '$1.09B-$1.35B trend on either side. TT excludes 110888 by its exact name but '
      + 'NOT 110899, so the duplicate loads.',
      // ⚠ This is why the settlement rule is code-OR-EXACT-NAME and why an exact
      // name match cannot be widened to a substring: it would still miss this one.
    magnitude: [
      '110899 is 35.4x its own FY2011 value on the same fund code ($38,531,900.03), then '
        + 'the code disappears from FY2013 onward.',
      'It is 36.96% of the year\'s receipts.',
      "TT's loaded revenue reads $2,368,797,655.54 for FY2012 against $843,350,482.27 "
        + '(FY2011) and $1,264,024,397.66 (FY2013) — +181% then -47%.',
      'Marion\'s settlement-family receipts: $1.09B (FY2011) -> $2.68B (FY2012) -> $1.35B '
        + '(FY2013). FY2012 is ~$1.3B above its own trend.',
    ],
    verifiedBecause: [
      '110899\'s sole receipt line is literally "General Property Taxes" and its sole '
        + 'disbursement line "Distributions to Other Governmental Entities" — settlement '
        + 'semantics, not a separate revenue stream.',
      'Marion\'s genuinely separate after-settlement stream is two orders of magnitude '
        + 'smaller: fund 100001 runs $15.4M-$57.1M across FY2013-FY2023. That band '
        + "matches 110899's own FY2011 value of $38.5M, not its FY2012 $1.364B.",
      'Other counties used fund 110899 for exactly that smaller stream and NAMED it so — '
        + 'Hamilton and Allen "After Settlement Collections", St. Joseph "AFTER '
        + 'SETTLEMENT COLLECTIONS". Marion is the one that put a full gross collection in '
        + 'it.',
      '110888 passes $1.31B on an $80,289 opening balance and closes slightly negative — '
        + 'a pure pass-through profile — so it is the one behaving as the settlement fund.',
    ],
    benignExplanations: [
      'Double-reporting across the 2012->2013 chart-of-accounts change. The 11xxxx/91xxxx '
        + 'codes were retired after FY2012, and 36 of 92 counties are fully disjoint at '
        + 'the FY2011->FY2012 boundary, so the whole state was mid-transition.',
      'Gross-versus-net: collections and the settlement distribution of the SAME dollars '
        + 'each reported in full, in separate funds. The county does collect and settle '
        + 'property tax for every taxing unit in Marion County, so a ~$1.3B gross is '
        + 'legitimate — the duplication is reporting it twice.',
      'A one-year mapping slip putting the settlement total into the treasurer\'s '
        + 'collections fund as well as the settlement fund. ⚠ Supporting detail: 110899\'s '
        + 'FY2012 opening cash balance ($38,531,900) is EXACTLY its FY2011 reported '
        + 'receipt figure, which suggests a balance was carried into a flow field during '
        + 'the transition.',
    ],
    supportingContext:
      'Loaded as published. ⚠ Note for the statewide sweep: TT\'s settlement rule is '
      + '"code 106000 OR an exact name match", and it catches 110888 but not 110899. '
      + 'Widening the name match to a substring would NOT catch this either, and would '
      + 'wrongly drop real revenue like "Monsanto Class Action Settlement".',
    corroboration:
      '2 independent agents, neutral prompts, no conclusion supplied. One found the '
      + 'FY2012 total anomaly and named both funds; the second was asked separately '
      + 'whether any year reports the same money through two funds and independently '
      + 'identified this pair with the same amounts, adding the line-item semantics and '
      + 'the peer-county naming evidence. Re-verified against the raw extracts.',
    assertions: [
      { fiscalYear: 2012, dataset: 'revenue', measure: 'subsetTotal', expected: 2_368_797_655.54 },
      { fiscalYear: 2012, dataset: 'operating', measure: 'subsetTotal', expected: 2_362_027_138.70 },
    ],
  },
]);

/** Whole dollars: these extracts carry cents but never sub-cent noise. */
const EPSILON = 1.0;

/** Every flag recorded against one government-year. Keyed on (cnty_cd, unit_code). */
export function figureFlagsFor(countyCode, unitCode, fiscalYear, { flags = IN_FIGURE_FLAGS } = {}) {
  return flags.filter((f) => f.countyCode === countyCode
    && f.unitCode === unitCode
    && f.fiscalYears.includes(Number(fiscalYear)));
}

/**
 * Re-check a flag's claims against what was just parsed.
 *
 * ⚠⚠ A flag is a CLAIM ABOUT A GOVERNMENT'S PUBLISHED FIGURES. If the publisher
 * amends the filing, the claim becomes false, and TT would be asserting
 * something untrue about a real government — worse than having no flag, because
 * it looks like knowledge. So this refuses and names what to re-measure.
 */
export function assertFigureFlagStillHolds(flag, fiscalYear, filing, label) {
  let checked = 0;
  for (const a of flag.assertions ?? []) {
    if (Number(a.fiscalYear) !== Number(fiscalYear)) continue;
    const actual = filing?.[a.dataset]?.[a.measure];
    checked++;
    if (!Number.isFinite(actual) || Math.abs(actual - a.expected) > EPSILON) {
      throw new Error(
        `REFUSING ${label}: the recorded anomaly flag "${flag.id}" no longer describes `
        + `the data — it claims ${a.dataset}.${a.measure} of ${a.expected.toFixed(2)} for `
        + `FY${a.fiscalYear}, the extract now parses `
        + `${Number.isFinite(actual) ? actual.toFixed(2) : String(actual)}. `
        + 'The publisher may have amended the filing. Re-measure with '
        + 'scripts/inGovernmentTotalsProbe.py, re-corroborate, and update or retire the '
        + 'flag — do NOT keep publishing a stale claim about a real government.');
    }
  }
  return { ok: true, checked };
}
