// NO SHEBANG — tests import this module.
/**
 * Alaska local ACFRs — the anomaly register.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE MILLEDGEVILLE RULE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chris, 2026-08-29: *"It is not our job to hide bad data"* — reflect what is
 * ACCURATE, and flag what looks inconsistent, saying why.
 *
 * **No FIGURE in this file is withheld from the product.** Every one is LOADED
 * and published exactly as the borough reported it. Neither entry below is a
 * data defect: in both cases the stored figures were verified to the dollar
 * against the printed statement by two independent readers.
 *
 * ── ⚠⚠ THIS REGISTER IS A DEVELOPMENT RECORD, NOT A PRODUCT SURFACE ────────
 *
 * Chris's call, 2026-10-28: **these notes stay in development and do not reach
 * readers.** `readerFacing` is false on every entry and a test holds it there.
 *
 * ⚠ THAT IS NOT THE MILLEDGEVILLE RULE BEING OVERRIDDEN, and the distinction is
 * worth keeping straight because the two look alike from a distance. That rule
 * forbids hiding or editing a verified FIGURE — suppressing an outlier creates
 * a blind spot for exactly the thing TT exists to surface. Nothing of the kind
 * happens here: every figure renders in full, as published, unannotated. What
 * is being kept internal is TT'S OWN COMMENTARY about those figures, which is a
 * different thing from the data and carries a different risk — a note is an
 * editorial claim, and the bar for publishing one under TT's name is ours to
 * set. ⚠ If a future case involves WITHHOLDING OR ALTERING A FIGURE, this
 * precedent does not cover it; go back to [[feedback_milledgeville_rule]].
 *
 * What each entry records is why a reader charting the series might misread it
 * — kept so that WE know, and so nobody re-derives it from scratch.
 *
 * ⚠⚠ BOTH ENTRIES WERE CORROBORATED BY INDEPENDENT AGENTS BEFORE BEING
 * RECORDED — Chris's standing requirement for any flag of this nature, and the
 * proven split: ONE agent from the raw filings only and barred from this
 * repository's own readers, ONE from external published sources only and
 * barred from this repository entirely. Neither was shown the other's work and
 * neither was told the conclusion; each was given the figures, the file layout
 * or the subject, and a question. Both were explicitly invited to return a
 * null result. Run 2026-10-28.
 *
 * ⚠ AND BOTH EXTERNAL LEGS REPORTED THE SAME LIMITATION, UNPROMPTED: no
 * independent publisher reprints either borough's General Fund dollar totals.
 * Alaska has no state agency that collects local operating statements — DCCED's
 * `Alaska Taxable` covers assessed values and mill rates only. The Federal
 * Audit Clearinghouse holds the same filings, so it is a SECOND ACCESS PATH,
 * not a second source. That is stated in each entry rather than glossed.
 */

/**
 * @typedef {object} AkAcfrFlag
 * @property {string} id
 * @property {string} entity
 * @property {'AK'} state
 * @property {number} fiscalYear      the year the reader lands on
 * @property {number[]} seamYears     ⚠ BOTH sides, where the break is a seam
 * @property {'not-comparable'|'explained-spike'} severity
 * @property {boolean} loaded         always true — see the header
 * @property {boolean} readerFacing   whether this warrants surfacing to readers
 */

/** @type {readonly AkAcfrFlag[]} */
export const AK_FIGURE_FLAGS = Object.freeze([

  /**
   * ── FLAG 1: a reporting-boundary change the borough announced in advance ──
   *
   * ⚠⚠ BOTH FIGURES ARE CORRECT. Only the comparison between them breaks.
   */
  {
    id: 'ketchikan-gateway-fy2017-education-fund-boundary',
    entity: 'Ketchikan Gateway Borough', state: 'AK',
    fiscalYear: 2017,
    // ⚠⚠ A SEAM HAS TWO SIDES. FY2016 is as affected as FY2017 — it is the
    // last year on the old boundary — so anything surfaced must mark both or
    // it tells half the story and implies the drop happened TO FY2017.
    seamYears: [2016, 2017],
    dataset: 'operating and revenue',
    label: 'Local education moved out of the General Fund',
    severity: 'not-comparable',
    loaded: true,
    // ⚠⚠ INTERNAL. Chris's call, 2026-10-28: TT's own commentary stays in
    // development and does not reach readers. See the header for why this is
    // NOT the Milledgeville Rule being overridden — the figures are published
    // in full; what is withheld is our note ABOUT them.
    readerFacing: false,
    rendersAs: null,
    what:
      'The borough stopped funding local education from the General Fund in FY2017. '
      + 'Ordinance 1793-A (adopted 18 April 2016) dedicated the entire 5.0-mill areawide '
      + 'property tax and the federal Secure Rural Schools receipts to a separate fund — the '
      + 'Schools Reserve Fund, created as a NONMAJOR fund in FY2016, reported as a MAJOR fund '
      + 'in FY2017 once the taxes began flowing to it, and renamed the Local Education Fund by '
      + 'Ordinance 1833 on 6 June 2017. The General Fund\'s Education expenditure line went '
      + 'from $8,529,765 to $0 and its property tax line from $6,761,263 to $31,285 of '
      + 'delinquent collections.',
    magnitude: [
      'General Fund revenues 18,344,071 (FY2016) -> 9,622,305 (FY2017), −47.5%.',
      'General Fund expenditures 18,476,976 -> 10,433,589, −43.5%.',
      '⚠⚠ READER DISTORTION: unflagged, a reader sees the borough\'s General Fund halve in a '
        + 'single year. It did not. Borough-wide, Total Governmental Funds moved −5.8% '
        + '(31,758,890 -> 29,912,910) and −2.6% (30,860,392 -> 30,073,283), and total taxes '
        + 'across all funds ROSE, 17,111,344 -> 18,076,414.',
      'On the FY2017 boundary, FY2016 would read about 10.6M of revenue and 9.95M of '
        + 'expenditure — alongside FY2017\'s 9.62M/10.43M and FY2018\'s 10.49M/10.23M.',
    ],
    verifiedBecause: [
      'Both readers reproduced all six figures to the dollar from the governmental-funds '
        + 'Statement of Revenues, Expenditures and Changes in Fund Balances (FY2016 p.38, '
        + 'FY2017 p.38, FY2018 p.36), cross-checked against each year\'s General Fund '
        + 'budget-and-actual schedule and against the next year\'s comparative column.',
      '⭐ THE BOROUGH SAID SO BEFORE THE YEAR BEGAN. FY2017 Budget, adopted 16 May 2016 under '
        + 'Ord. 1798-A: "Comparing FY 2017 to FY 2016 without adjusting for the effects of '
        + '1793-A leads to a distorted view of the General Fund... The table below has been '
        + 'adjusted to remove these two revenue sources from FY 2016, allowing a better '
        + 'year-over-year comparison." On that adjusted basis the borough projected General '
        + 'Fund revenue −7.3% and expenditures −1.4%.',
      'FY2017 MD&A: "The change of 38.76% is due to the establishment of the Local Education '
        + 'Fund and school appropriations no longer being paid out of the General Fund"; "No '
        + 'property taxes were budgeted in the General Fund in fiscal year 2017."',
      '⭐ A CONTROL OUTSIDE THE FUND STATEMENTS. FY2019 ACFR statistical section, Table 7, '
        + 'Property Tax Levies and Collections: the levy was 6,740,723 (FY2016) and 6,738,896 '
        + '(FY2017) — a change of −$1,827, or −0.03%, collected at 99.5% and 99.6%. The tax '
        + 'did not move; only the fund it landed in did.',
      'The receiving fund shows the mirror image: FY2017 Local Education revenues 7,009,804 '
        + '(property taxes 6,922,519) and education expenditures 8,071,497, against FY2016 '
        + 'revenues of $200 and no education expenditure at all.',
      'No restatement anywhere: each year is reprinted unchanged in the next year\'s '
        + 'comparative column and fund balance rolls forward continuously.',
    ],
    benignExplanations: [
      'A government may reorganise which fund pays for a service; both figures are correct '
        + 'for the boundary they are drawn on.',
      'Two smaller, separately disclosed items sit inside the same change and are ordinary: '
        + 'school-debt reimbursement fell $526,136 "due to a decrease in Legislative funding", '
        + 'and charges for services fell $708,215 because "in fiscal year 2017, DEED '
        + 'determined that the in-kind services were not allowable and those billings were '
        + 'discontinued".',
    ],
    corroboration:
      'Two independent legs converging through channels that share no input. RAW: the filings '
      + 'in docs/AkBoroughs/kgb/, read without this repository\'s own readers. EXTERNAL: the '
      + 'borough\'s own archive at kgbak.us (FY2017 and FY2018 budget documents, FY2019 '
      + 'statistical section), the FAC API, and KRBD/Ketchikan Daily News for the policy '
      + 'history. The external leg reached the pre-announcement in the adopted FY2017 budget, '
      + 'which the raw leg could not see. '
      + '⚠ No independent publisher reprints the General Fund dollar totals, and neither leg '
      + 'claimed otherwise. FAC corroborates the FILINGS (periods, auditors BDO USA for FY2016 '
      + 'and Teuscher Walpole after, zero single-audit findings) but holds the same documents, '
      + 'so it is a second access path and not a second source. Everything that reproduces '
      + 'these totals is the borough reporting on itself.',
  },

  /**
   * ── FLAG 2: an explained spike, recorded because its explanation has TWO
   *    parts and only one was previously written down ───────────────────────
   *
   * ⚠ NOT reader-facing. Both independent legs concluded this is an ordinary
   * pandemic-year pattern, fully explained, with no data problem. It is
   * recorded so the next reader does not re-derive it — and because the
   * explanation on file before 2026-10-28 attributed the whole movement to
   * federal relief and dismissed the property-tax line as "volatile", which is
   * incomplete: a third of the rise is a mill-rate reallocation.
   */
  {
    id: 'kodiak-island-fy2021-relief-and-mill-reallocation',
    entity: 'Kodiak Island Borough', state: 'AK',
    fiscalYear: 2021,
    seamYears: [2021],
    dataset: 'operating and revenue',
    label: 'CARES relief, plus a mill-rate reallocation that was transferred straight back out',
    severity: 'explained-spike',
    loaded: true,
    readerFacing: false,
    rendersAs: null,
    what:
      'General Fund revenue rose $8,607,114 over FY2020 from TWO causes, not one. '
      + '(a) $5,503,500 of CARES Act Coronavirus Relief Fund money passed through the State of '
      + 'Alaska, matched by $5,257,005 of Health and social welfare expenditure, most of it '
      + 're-granted to fourteen named subrecipients. '
      + '(b) $3,240,684 of property tax that is NOT new revenue: the borough moved the General '
      + 'Fund\'s share of an unchanged 10.75-mill areawide levy from 0.56 mills to 2.75 mills, '
      + 'then transferred $3,016,076 straight out to the Education Debt Service Fund.',
    magnitude: [
      'General Fund revenues 6,479,030 (FY2020) -> 15,086,144 (FY2021) -> 8,831,401 (FY2022).',
      'Federal sources 2,018,573 -> 7,320,092; Health and social welfare 157,500 -> 5,257,005.',
      'Property taxes 1,052,998 -> 4,293,682, while GF property tax PER MILL stayed flat: '
        + '1,482,527 (FY19), 1,474,861 (FY20), 1,452,945 (FY21), 1,490,495 (FY22), 1,541,436 '
        + '(FY23). The base did not move; the allocation did.',
      'The $4.4M excess of revenues over expenditures is not a windfall — $3.03M was '
        + 'transferred out, leaving a $1.39M fund-balance increase.',
    ],
    verifiedBecause: [
      'Both readers reproduced all eight FY2019-FY2022 figures to the dollar from the '
        + 'governmental-funds statement, cross-footed every line, and matched each against the '
        + 'Budgetary Comparison Schedule in the same filing.',
      '⭐ A GENUINE SECOND SOURCE FOR THE RELIEF AWARD, PUBLISHED BEFORE THE AUDIT EXISTED. '
        + 'Alaska Legislature RPL# 08-2020-0250, "State of Alaska COVID-19 Community '
        + 'Distribution", revised 1 May 2020, lists "Kodiak Island Borough ... $5,792,501" — '
        + 'matching the FY2021 SEFA (ALN 21.019, pass-through 20-CRF-112) to the dollar. '
        + 'Corroborated independently by KTOO/Alaska Public Media (6 May 2020) and KMXT '
        + '(19 May 2020).',
      'FY2021 is reprinted unchanged in FOUR later filings — the FY2022 budgetary schedule and '
        + 'the FY2023/FY2024/FY2025 statistical sections ("Includes General Fund only. Source: '
        + 'Borough general ledger") — with no restatement and a clean fund-balance roll-forward.',
      'The mill split is stated in each year\'s revenue-recognition note and the TOTAL areawide '
        + 'rate never moves: 10.75 in FY2019 (GF 1.10), FY2020 (0.56), FY2021 (2.75) and '
        + 'FY2022 (2.11). Property taxes across all governmental funds barely moved, '
        + '16,978,718 -> 17,445,434.',
      'The timing explains why the spike lands in FY2021 rather than FY2020: the state\'s '
        + 'largest tranche ($4,836,893) was paid 26 June 2020, four days before FY2020 closed, '
        + 'so under modified accrual it was not revenue until the eligible expenditures were '
        + 'incurred.',
      'It returns. Strip both items and FY2021 is unremarkable: non-health expenditures 5.41M '
        + 'against 5.47M (FY20) and 5.29M (FY22); federal sources fall back to 1.85M (FY22). '
        + 'ARPA did not repeat it — only $29,512 of ALN 21.027 was drawn in FY2022.',
    ],
    benignExplanations: [
      'A one-off federal relief award genuinely received and genuinely spent, audited as a '
        + 'major program with an unmodified compliance opinion and no findings.',
      'A borough may set a different mill rate per areawide function each year; Kodiak has '
        + 'done so since FY2012 and the General Fund share moves every year (1.10, 0.56, 2.75, '
        + '2.11, 1.18, 1.22). FY2021 is not a structural change — FY2020\'s 0.56 was the '
        + 'unusually low year.',
    ],
    corroboration:
      'Two independent legs, both reaching BOTH components separately. RAW: the filings in '
      + 'docs/AkBoroughs/kodiak/, every General Fund line read across FY2018-FY2025. EXTERNAL: '
      + 'the FAC dissemination PDFs, the Alaska Legislature RPL document, USAspending.gov '
      + '(which shows no large DIRECT award, consistent with a state pass-through), and three '
      + 'news organisations. '
      + '⚠ The borough\'s own website hosts only its FY2018 report, so a reader without FAC has '
      + 'no public route to FY2019-FY2022. '
      + '⚠ No independent publisher reprints the General Fund totals; the four later filings '
      + 'that reproduce FY2021 are all the same publisher audited by the same firm. The CARES '
      + 'AWARD is externally sourced; the GENERAL FUND TOTALS are not.',
  },
]);

/** The flags for one entity-year, or an empty array. */
export function akFlagsFor(entity, fiscalYear) {
  return AK_FIGURE_FLAGS.filter(
    (f) => f.entity === entity && (f.seamYears.includes(fiscalYear) || f.fiscalYear === fiscalYear),
  );
}
