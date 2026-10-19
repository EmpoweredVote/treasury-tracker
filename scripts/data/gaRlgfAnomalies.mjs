/**
 * Georgia RLGF — the anomaly register.
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
 * legitimate fraud — an outlier is a FINDING, not noise to be cleaned up. This
 * register exists so a reader can be told WHY a figure looks inconsistent, not
 * so TT can quietly decline to show it.
 *
 * ⚠ Every entry below was CORROBORATED BY INDEPENDENT AGENTS working from the
 * raw source files with neutral prompts, before being recorded — Chris's
 * standing requirement for any flag of this nature. Agents that were told only
 * the file layout and asked a question, never the conclusion.
 */

/**
 * ── FLAG 1: an implausible figure that is genuinely what was filed ──────────
 *
 * ⚠⚠ THIS IS LOADED AS PUBLISHED. It is not suppressed, capped, or corrected.
 */
export const GA_FIGURE_FLAGS = Object.freeze([

  {
    id: 'georgetown-quitman-fy2023-six-month-transition-year',
    entity: 'Georgetown-Quitman County', state: 'GA', fiscalYear: 2023,
    dataset: 'operating and revenue', section: 'the whole filing', ucoa: null,
    label: 'A six-month transition year',
    amount: 2620719.00, loaded: true, severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter.
    what:
      'Georgetown-Quitman County moved its year end from 31 December to 30 June in FY2023, '
      + 'so that year covers SIX MONTHS. ⚠ The form does not say so — all ten filings report '
      + 'MosRptd = 12 and MoChng = No — which is the Talbot FY2022 shape: the months-reported '
      + 'field cannot be used to find a stub, only the figures can.',
    magnitude: [
      'Operating $2,620,719 against a $4,650,280 mean of FY2022 and FY2024 — ratio 0.564.',
      'Revenue $1,855,762 against a $4,765,256 mean — ratio 0.389.',
      'A December-to-June move makes the stub exactly half a year, so 0.500 is the figure '
        + 'both ratios straddle.',
      '⚠⚠ READER DISTORTION: unflagged, a reader sees revenue fall 63% from FY2022 and then '
        + 'rise 146% into FY2024. Neither movement happened.',
    ],
    verifiedBecause: [
      'The year end printed on the filings moves: 31 December for FY2016-FY2022, 30 June for '
        + 'FY2023-FY2025. Three consecutive later filings carry the new date.',
      'The money independently confirms the length, straddling 0.500 on both sides of the '
        + 'return without being fitted to it.',
      '⚠ FAC CANNOT CORROBORATE THIS ONE AND IS NOT CLAIMED TO. It holds no row for this '
        + 'government covering the window, and its nearest names are ambiguous — "Quitman" '
        + 'is most likely Quitman CITY in BROOKS county, a different government entirely.',
    ],
    benignExplanations: [
      'A government may change its fiscal calendar; the figures are correct for the period '
        + 'they cover.',
      'The months-reported and month-changed fields were left at their defaults while the '
        + 'year-end date was updated.',
    ],
    corroboration:
      'Two independent lines: the year-end date printed across ten filings, and the size of '
      + 'the figures. ⚠ No federal audit record exists for this government in the window, so '
      + 'neither line is external to the publisher — stated rather than glossed.',
  },
  // ── MUNICIPALITIES: four figures that dwarf their own entity ──────────────
  //
  // ⚠ All four TIE 18/18 — the form's own printed subtotal carries the figure,
  // so the preparer entered it and the form summed it. TT reproduces both
  // exactly. These are NOT read-fidelity failures, and the figure published is
  // the one the government filed: the Milledgeville Rule, four more times.
  {
    id: 'monroe-fy2025-other-intergovernmental-line',
    entity: 'Monroe', state: 'GA', fiscalYear: 2025, dataset: 'revenue',
    section: '2', ucoa: null, label: 'Other Intergovernmental Revenues — Attach List',
    amount: 1686319022.00, loaded: true, severity: 'extreme-outlier',
    what:
      '⚠ THE WHOLE EXCESS IS ONE LINE. Monroe\'s FY2025 Section 2 totals $1,689,565,167, '
      + 'and $1,686,319,022 of that sits on the single free-text row "Other '
      + 'Intergovernmental Revenues - Attach List". The section\'s other five lines are '
      + 'entirely ordinary: payment in lieu of taxes $101,356 (against $69,107 the year '
      + 'before), LMIG $206,713 (against $200,899), crime and corrections grants $42,310 '
      + '(against $38,678), CDBG $5,580, SPLOST $2,890,186 (against $4,009,564). The same '
      + '"Other" line was $2,670,179 in FY2024 and $2,496,501 in FY2023.',
    magnitude: [
      'The line: $1,686,319,022 (FY2025) against $2,670,179 (FY2024) — 632x.',
      '⚠⚠ SCALE, PROPERLY STATED: Monroe\'s ENTIRE audited revenue for FY2025, including '
        + 'its municipal electric utility, is $89,170,673 — $21,162,802 governmental and '
        + '$68,007,871 business-type. The figure on this one line is NINETEEN TIMES '
        + 'everything the city handles in a year.',
      'Audited intergovernmental revenue across all governmental funds is $4,232,497 '
        + '($555,205 of it in the General Fund).',
      '⭐ Divided by 1,000 the line reads $1,686,319 — between its own FY2023 and FY2024 '
        + 'values. Section 2 would then total $4,932,464 against the audited $4,232,497, '
        + 'the same order of magnitude rather than 399 times it.',
    ],
    verifiedBecause: [
      'IDENTITY CONFIRMED FROM THE DOCUMENT, not from a name search: the audit used here is '
        + 'titled "City of Monroe, Georgia — Annual Comprehensive Financial Report for the '
        + 'Fiscal Year Ended December 31, 2025", which matches the filing\'s own December '
        + 'year-end. It is the CITY, not Monroe County, which is a separate government '
        + '(CICOID 1102102).',
      'The city\'s own audited statements (Federal Audit Clearinghouse report '
        + '2025-12-GSAFAC-0000422443) report intergovernmental revenue of $4,232,497 across '
        + 'all governmental funds and total revenues of $89,170,673 including the utility.',
      'The filing ties 18/18: the form\'s own Part II subtotal carries the figure, so the '
        + 'preparer entered it and the form summed it. TT reproduces it exactly.',
      'The expenditure side of the same filing reports $22,417,266 against $21,195,504 the '
        + 'year before — so only this one revenue line moves.',
    ],
    benignExplanations: [
      '⭐ A UNIT ERROR. The ×1,000 relationship is exact to the digit and the "Attach List" '
        + 'row is free text, which is where a figure copied from a schedule in thousands '
        + 'would land. ⚠ OFFERED, NOT ASSERTED: no source states it, and the attachment '
        + 'itself was not obtained.',
      'A cumulative or multi-year grant total entered in a single year\'s cell.',
      'A spreadsheet reference picking up an unrelated balance.',
    ],
    corroboration:
      'Checked against an INDEPENDENT document from a different publisher — the city\'s own '
      + 'audited ACFR via the Federal Audit Clearinghouse — and the identity of that '
      + 'document confirmed from its own title page rather than from a name match. The '
      + 'driving line was then isolated against the city\'s own FY2023 and FY2024 filings.',
    supportingContext:
      '⭐⭐ ONE OF FIVE SCALE BREAKS FOUND IN LOADED REVENUE DATA ACROSS THE STATEWIDE SWEEP, '
      + 'and THREE of them share this ×1,000 fingerprint: Monroe FY2025 here, Varnell FY2018 '
      + 'real property tax, and Shellman FY2024 interest revenue. Lowndes FY2022 fits ×100 '
      + 'instead, and Cornelia FY2017 fits neither. See GA-RLGF-RECON.md §10, which measured '
      + 'the ×1,000 mechanism in BALANCE-SHEET Parts only and recorded a null for Parts '
      + 'I-VI across seven governments while asking for a re-measure at scale. Re-measured '
      + 'over 679 governments, that null does not hold.',
  },
  {
    id: 'varnell-fy2018-real-property-tax-line',
    entity: 'Varnell', state: 'GA', fiscalYear: 2018, dataset: 'revenue',
    section: '1A', ucoa: null, label: 'Real Property Taxes, Current Year',
    amount: 44107410.00, loaded: true, severity: 'extreme-outlier',
    what:
      'Varnell\'s FY2018 Section 1A totals $47,936,338, of which $44,107,410 is the single '
      + 'line "Real Property Taxes, Current Year". That line was $67,370 in FY2017 — the '
      + 'town has roughly 2,000 residents and about $1 million of revenue in every other '
      + 'year it filed. ⚠ FY2018 also populates four property-tax lines that were empty in '
      + 'FY2017 (public utility $889,219, personal property $2,189,457, motor vehicle '
      + '$699,210, mobile home $51,042), so the return was filled in more fully that year '
      + 'as well as carrying the outlier.',
    magnitude: [
      'The line: $44,107,410 (FY2018) against $67,370 (FY2017) — 655x.',
      'Revenue total $48,653,429 against a $950,468 mean of FY2017 and FY2019.',
      '⭐ Divided by 1,000 the line reads $44,107, against $67,370 the year before — the '
        + 'same order of magnitude.',
      'The expenditure side reports $783,695, in line with its neighbours, so the two sides '
        + 'of the return do not move together.',
    ],
    verifiedBecause: [
      'The filing ties 18/18: the form\'s own Section 1A subtotal carries the figure.',
      'Varnell\'s eight other filings report $874,715-$1,879,709 of total revenue.',
      '⚠ NO INDEPENDENT SOURCE EXISTS. Varnell has no Federal Audit Clearinghouse record at '
        + 'all — it spends under the $750k federal threshold, so it files no Single Audit '
        + 'and no audited statement is published. This rests on the town\'s own filings, '
        + 'which is said plainly rather than dressed up.',
    ],
    benignExplanations: [
      '⭐ A unit error, the same ×1,000 shape as Monroe FY2025 and Shellman FY2024. ⚠ '
        + 'Offered, not asserted.',
      'A county-wide tax DIGEST figure entered in place of the town\'s own levy.',
    ],
    corroboration:
      'Surfaced by the sweep\'s outlier screen, then isolated to a single line against the '
      + 'town\'s own FY2017 filing. ⚠ Unlike Monroe, there is NO independent document behind '
      + 'this one, because none exists for a government of this size.',
  },
  {
    id: 'cornelia-fy2017-water-wastewater-grants-line',
    entity: 'Cornelia', state: 'GA', fiscalYear: 2017, dataset: 'revenue',
    section: '2', ucoa: null, label: 'Water/Wastewater Grants',
    amount: 63781999.00, loaded: true, severity: 'extreme-outlier',
    what:
      'Cornelia\'s FY2017 Section 2 totals $63,905,171, of which $63,781,999 is the single '
      + 'line "Water/Wastewater Grants". That line was $1,012,024 in FY2016. The city has '
      + 'about 4,500 residents and reports $4-9 million of total revenue in every other '
      + 'year it filed.',
    magnitude: [
      'The line: $63,781,999 (FY2017) against $1,012,024 (FY2016) — 63x.',
      'Revenue total $67,623,932 against a $4,620,323 mean of FY2016 and FY2018.',
      '⚠ THE ×1,000 READING DOES NOT FIT THIS ONE. Divided by 1,000 the line reads $63,782, '
        + 'which is SIXTEEN TIMES SMALLER than the $1,012,024 it ran the year before. So '
        + 'whatever happened here, it is not the unit error that fits Monroe, Varnell and '
        + 'Shellman — and it is recorded as unexplained rather than forced into the pattern.',
      'The expenditure side reports $4,493,669, in line with its neighbours.',
    ],
    verifiedBecause: [
      'The filing ties 18/18: the form\'s own Part II subtotal carries the figure.',
      'Cornelia\'s eight other filings report $4.2M-$9.2M of total revenue.',
      '⭐ THE PRIOR YEAR IS AUDITED, AND IT MATCHES THIS FILING TO THE DIGIT. Cornelia\'s '
        + 'FY2016 Single Audit (Federal Audit Clearinghouse report 2016-12-CENSUS-0000216732) '
        + 'reports CAPITAL GRANTS of $1,012,024 in its proprietary funds — the same figure, '
        + 'exactly, that the FY2016 RLGF filing carries on this very line. So TT reads this '
        + 'line faithfully, AND the $1,012,024 baseline the FY2017 figure departs from is an '
        + 'AUDITED one rather than merely self-reported. The departure is 63x an audited '
        + 'number.',
      '⚠⚠ CORRECTION TO AN EARLIER NOTE IN THIS REGISTER: it said Cornelia\'s FY2017 audit '
        + 'EXISTED and had simply not been fetched. It does not exist. The complete '
        + 'Clearinghouse list for this city is 2016, 2022, 2024 and 2025 — the city evidently '
        + 'spent under the $750k federal threshold in the intervening years, so no FY2017 '
        + 'Single Audit was ever required or filed. The earlier claim was inferred from a '
        + 'truncated descending query and was wrong.',
    ],
    benignExplanations: [
      'A genuine large capital grant for a water or wastewater project, recorded in the '
        + 'year of award rather than of receipt. ⚠ $63.8M would still be implausibly large '
        + 'for a city of this size, but this is the one entry where a real event has not '
        + 'been ruled out.',
      'A digit transposition or a figure carrying a project authorisation rather than cash.',
    ],
    corroboration:
      'Corroborated against an INDEPENDENT document from a different publisher: the city\'s '
      + 'own FY2016 Single Audit reports capital grants of $1,012,024, matching this line\'s '
      + 'FY2016 value to the dollar. ⚠ No FY2017 audit exists to settle the CAUSE — the city '
      + 'filed none that year — so what is established is that the baseline is AUDITED and '
      + 'the FY2017 figure departs from it by 63x, not what produced the departure.',
  },
  {
    id: 'shellman-fy2024-interest-revenues-line',
    entity: 'Shellman', state: 'GA', fiscalYear: 2024, dataset: 'revenue',
    section: '3B', ucoa: null, label: 'Interest Revenues',
    amount: 9049486.00, loaded: true, severity: 'extreme-outlier',
    what:
      'Shellman\'s FY2024 Section 3B totals $9,101,354, of which $9,049,486 is the single '
      + 'line "Interest Revenues". That line was $1,938 in FY2023. The town has about 1,000 '
      + 'residents and reports $0.5-1.0 million of total revenue in every other year.',
    magnitude: [
      'The line: $9,049,486 (FY2024) against $1,938 (FY2023).',
      '⚠⚠ A PHYSICAL TEST FAILS IT. At the ~5% rates of 2024, interest of $9,049,486 '
        + 'implies roughly $180 MILLION on deposit for a town whose annual revenue is under '
        + '$1 million. There is no balance that could produce it.',
      '⭐ Divided by 1,000 the line reads $9,049, which is an ordinary interest figure for a '
        + 'town of this size and the same order as its $1,938 the year before.',
      'The expenditure side reports $1,502,090 against about $1 million in neighbouring '
        + 'years — so $9.1M of revenue is matched by no corresponding spending.',
    ],
    verifiedBecause: [
      'The filing ties 18/18: the form\'s own Section 3B subtotal carries the figure.',
      'Shellman\'s nine other filings report $492,940-$1,034,473 of total revenue.',
      '⚠ No independent source was obtained. The Clearinghouse lookup for this town hit the '
        + 'DEMO_KEY rate limit and was not retried, so whether an audited statement exists '
        + 'is UNKNOWN — weaker than Varnell, where absence is established, and weaker than '
        + 'Cornelia, where existence is established.',
    ],
    benignExplanations: [
      '⭐ A unit error, the same ×1,000 shape as Monroe FY2025 and Varnell FY2018. ⚠ '
        + 'Offered, not asserted.',
      'A bond or loan proceed, or a one-off settlement, entered on the interest line.',
    ],
    corroboration:
      'Surfaced by the sweep\'s outlier screen, isolated to a single line against the town\'s '
      + 'own FY2023 filing, and tested against what an interest figure of that size would '
      + 'require as a deposit balance. ⚠ No independent document; see the note above.',
  },
  {
    id: 'franklin-fy2023-filing-is-all-but-empty',
    entity: 'Franklin County',
    state: 'GA',
    fiscalYear: 2023,
    dataset: 'revenue',
    section: 'Parts I-III (all seven sections)',
    ucoa: null,
    label: 'Total revenue',
    amount: 192274.00,
    loaded: true,
    severity: 'understated-whole-dataset',
    what:
      'Franklin County\'s FY2023 return is all but blank. The revenue side reports $192,274 '
      + 'in a SINGLE category against a $30,078,761 mean of FY2022 and FY2025 — 0.6%. The '
      + 'expenditure side is $0.00 in all seven sections and is NOT loaded at all (see '
      + 'GA_EMPTY_DATASETS): there is no figure there to publish. This revenue figure IS '
      + 'loaded, because unlike the expenditure side it is a number the county filed.',
    magnitude: [
      'Revenue $192,274 in FY2023 against $25,852,333 (FY2022) and $34,305,189 (FY2025).',
      'Franklin\'s revenue ran $17.8M-$25.9M in every filed year from FY2016 to FY2022.',
      '⚠⚠ This is a MORE extreme understatement than DeKalb FY2018, which loaded at 12% '
        + 'of its audited accounts. This one is under 1%.',
      '⚠ DCA lists no FY2021 or FY2024 filing for Franklin at all, so FY2023\'s immediate '
        + 'neighbours in the loaded series are FY2022 and FY2025.',
    ],
    verifiedBecause: [
      'The county\'s own audited statements set the scale INDEPENDENTLY: Franklin County, '
        + 'Georgia FY2024 Single Audit (Federal Audit Clearinghouse report '
        + '2024-06-GSAFAC-0000350197) reports General Fund actual revenues of $22,561,941. '
        + '⚠ That is the FY2024 audit, not FY2023 — DCA lists no FY2023 audit for this '
        + 'county — so it establishes the county\'s scale, NOT the FY2023 figure itself.',
      'Franklin\'s own seven other filings all report $17.8M-$34.3M of revenue, so FY2023 '
        + 'is a departure from the entity\'s own practice rather than a smaller county.',
      'The filing ties 18/18 — against its own near-zero printed subtotals. ⚠ That is the '
        + 'point: an oracle comparing a blank tree to a blank total passes while measuring '
        + 'nothing, which is why this was found by an outlier screen and not by the gate.',
    ],
    benignExplanations: [
      'A return opened and submitted substantially unfilled, which DCA reconciles against '
        + 'nothing and so does not reject.',
      'A filing superseded by a later corrected submission that DCA never published.',
      'A technical failure in the preparer\'s workbook that emptied the data entry sheet '
        + 'before submission.',
    ],
    corroboration:
      'Surfaced by the statewide sweep\'s outlier screen rather than by the oracle, then '
      + 'checked against an INDEPENDENT document — the county\'s own federally filed '
      + 'audited statements, obtained from the Federal Audit Clearinghouse rather than '
      + 'from DCA — and separately against the county\'s own seven other filings.',
  },
  {
    id: 'barrow-fy2017-nine-month-transition-year',
    entity: 'Barrow County',
    state: 'GA',
    fiscalYear: 2017,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A nine-month transition year',
    amount: 35414129.00,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter. Recording
    // this as a defect would both mislead the reader and impute a fault to a
    // county that declared the change on the form itself.
    what:
      'Barrow County moved its fiscal year end from 30 September to 30 June in FY2017, so '
      + 'that year covers NINE MONTHS. The filing declares it: MosRptd = 9 and MoChng = '
      + 'Yes. Operating comes to $35,414,129 against a $45,790,381 mean of FY2016 and '
      + 'FY2018 — a ratio of 0.773 where nine twelfths is 0.750.',
    magnitude: [
      'Operating ratio 0.773 (shortfall $10,376,252 against the neighbour mean).',
      'Revenue ratio 0.874 (shortfall $7,166,650) — higher than the expenditure ratio, '
        + 'which is what a changeover does to a billing cycle that does not divide into '
        + 'the stub.',
      '⚠ This is the FIRST transition stub the Georgia campaign has loaded. Baldwin\'s '
        + '2010 and Atlanta\'s 2006 stubs both sit BELOW the FY2016 floor.',
    ],
    verifiedBecause: [
      'The filing states it itself — the FY2017 return reports MosRptd = 9 and MoChng = '
        + 'Yes, the only one of the three mid-window Georgia calendar changes that does.',
      'FAC, an INDEPENDENT federal source, reports Barrow County at month 10 for 1998-2016 '
        + 'and at month 7 for 2019 and 2024 — both sides of the change, in the right order.',
      'The FY2016 filing gives a year end of 30 September and every filing from FY2017 on '
        + 'gives 30 June.',
    ],
    benignExplanations: [
      'Nothing to explain: a government may change its fiscal calendar, and this one '
        + 'reported the change on the form.',
    ],
    corroboration:
      'Two independent sources agree before this was recorded: the filing\'s own declared '
      + 'nine-month period, and the Federal Audit Clearinghouse\'s record of Barrow\'s '
      + 'audited periods on both calendars.',
  },
  {
    id: 'talbot-fy2022-three-month-transition-year',
    entity: 'Talbot County',
    state: 'GA',
    fiscalYear: 2022,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A three-month transition year',
    amount: 2036818.00,
    loaded: true,
    severity: 'not-comparable',
    what:
      'Talbot County moved its fiscal year end from 30 June to 30 September in FY2022, so '
      + 'that year covers about THREE MONTHS. ⚠⚠ UNLIKE BARROW, THE FORM DOES NOT SAY SO: '
      + 'the FY2022 return reports MosRptd = 12 and MoChng = No while reporting a quarter '
      + 'of a year\'s money. Operating is $2,036,818 against an $8,249,811 mean of FY2021 '
      + 'and FY2023 — a ratio of 0.247 where three twelfths is 0.250.',
    magnitude: [
      'Operating ratio 0.247 — within 0.003 of an exact quarter.',
      'Revenue ratio 0.186, lower than the expenditure ratio.',
      '⚠⚠ READER DISTORTION: without the flag a reader sees county spending fall 73% from '
        + 'FY2021 and then rise 345% into FY2023. Neither movement happened.',
      '⚠ The form\'s own months-reported field is WRONG here. That field therefore cannot '
        + 'be used to detect stubs at scale — only the figures reveal this one.',
    ],
    verifiedBecause: [
      'The year end printed on the filings moves: 30 June for FY2016-2021, 30 September '
        + 'for FY2022-2025. Four consecutive later filings carry the new date, so it is a '
        + 'change of calendar and not a one-year slip.',
      'The money independently confirms the period length: 0.247 of the neighbour mean on '
        + 'the expenditure side, against 0.250 for an exact quarter.',
      '⚠ FAC reports Talbot at month 7 for 1998-2014 and carries NO row on the later '
        + 'calendar, so the federal record corroborates only the EARLIER side. That is '
        + 'weaker than Barrow\'s two-sided confirmation and is recorded as such rather '
        + 'than presented as settled.',
    ],
    benignExplanations: [
      'A government may change its fiscal calendar; the figures for the stub are correct '
        + 'for the period they cover.',
      'The months-reported and month-changed fields were left at their defaults while the '
        + 'year-end date was updated — ordinary form maintenance, and it understates '
        + 'nothing: the money reported matches the period actually covered.',
    ],
    corroboration:
      'The change rests on two independent lines: the year-end date printed across ten '
      + 'filings, and the size of the figures, which lands within 0.003 of an exact '
      + 'quarter without being fitted to it. ⚠ The federal audit record corroborates the '
      + 'earlier calendar only.',
  },
  {
    id: 'lowndes-fy2018-expenditure-side-is-about-one-quarter',
    entity: 'Lowndes County',
    state: 'GA',
    fiscalYear: 2018,
    dataset: 'operating',
    section: 'Part V (all seven sections)',
    ucoa: null,
    label: 'Total government expenditures',
    amount: 23615257.69,
    loaded: true,
    severity: 'understated-whole-dataset',
    what:
      'Lowndes County\'s FY2018 filing reports $23,615,258 of Part V expenditure against '
      + '$89,367,784 of governmental-fund expenditure in the county\'s OWN AUDITED '
      + 'STATEMENTS for the same year — 26.4%. The shortfall is spread across ALL SEVEN '
      + 'sections rather than confined to one: 5A 0.358 of its neighbours, 5B 0.275, '
      + '5C 0.211, 5D 0.177, 5E 0.200, 5F 0.370, 5G 0.256. ⚠ It is NOT a single scale '
      + 'factor — the section ratios range from 0.18 to 0.37 — so this is not a decimal '
      + 'slip; it reads as a partial return.',
    magnitude: [
      'Part V total $23,615,258 in FY2018 against $107,502,596 (FY2017) and $87,178,047 '
        + '(FY2019) — a ratio of 0.243 to the mean of the two.',
      'Against the audited figure the gap is $65,752,526, or 73.6% of the county\'s own '
        + 'reported governmental-fund spending.',
      '⚠ Lowndes\' REVENUE side for FY2018 is $79,919,812 and sits normally among its '
        + 'neighbours, so only the expenditure side is affected.',
    ],
    verifiedBecause: [
      'The county\'s own audited statements, a DIFFERENT document from a DIFFERENT '
        + 'publisher: Lowndes County, Georgia FY2018 Single Audit (Federal Audit '
        + 'Clearinghouse report 2018-06-CENSUS-0000136968) reports TOTAL EXPENDITURES of '
        + '$55,812,164 (General Fund) + $18,725,238 + $14,830,382 = $89,367,784 across '
        + 'governmental funds.',
      'Lowndes\' own FY2017 and FY2019 filings report $107.5M and $87.2M, both near the '
        + 'audited scale — so FY2018 is a departure from the entity\'s own practice, not a '
        + 'different convention applied throughout.',
      'The filing ties 18/18 against its own printed subtotals, so TT read it faithfully: '
        + 'the form is internally consistent and simply reports less than the county did. '
        + 'This is NOT a read-fidelity failure.',
    ],
    benignExplanations: [
      'Only one fund, or part of the year, was entered on the expenditure side while the '
        + 'revenue side was completed in full.',
      'The preparer reported some functions in Parts VI or X (enterprise and '
        + 'intergovernmental expenditure, both outside TT\'s loaded scope) and did not '
        + 'carry them into Part V.',
      'A partially completed return filed to meet the deadline and never revised — DCA '
        + 'reconciles nothing, so nothing downstream would have caught it.',
    ],
    corroboration:
      'The gap rests on an INDEPENDENT document — the county\'s own federally filed audited '
      + 'statements, obtained from the Federal Audit Clearinghouse rather than from DCA — '
      + 'and separately on the entity\'s own two neighbouring filings, which agree with the '
      + 'audited scale. Two lines of evidence, neither of them this filing.',
  },
  {
    id: 'lowndes-fy2022-sales-tax-is-forty-four-times-audited',
    entity: 'Lowndes County',
    state: 'GA',
    fiscalYear: 2022,
    dataset: 'revenue',
    section: '1B',
    ucoa: '31.3100',
    label: 'General Sales and Use Taxes',
    amount: 1673304896.05,
    loaded: true,
    severity: 'extreme-outlier',
    what:
      'Lowndes County\'s FY2022 filing reports $1,673,304,896.05 of General Sales and Use '
      + 'Taxes — more than its own total revenue in every other year, and 44.5x the '
      + '$37,590,000 of sales taxes the county\'s OWN AUDITED STATEMENTS report for FY2022. '
      + 'It is 104.6x the same line in FY2021 ($15,999,448) and 64.4x FY2023 ($25,975,475). '
      + 'It drags the filing\'s whole revenue total to $1,806,076,930 against a $177,440,992 '
      + 'mean of the years either side.',
    magnitude: [
      'Section 1B: $1,673,304,896.05 (FY2022) against $15,999,447.52 (FY2021) and '
        + '$25,975,475 (FY2023).',
      'Part I revenue total $1,717,660,252 against $63,531,704 (FY2021) and $131,425,780 '
        + '(FY2023).',
      '⚠⚠ READER DISTORTION: an unflagged reader comparing FY2021 to FY2022 sees county '
        + 'revenue rise by 779%, and comparing FY2022 to FY2023 sees it fall by 91.7%. '
        + 'Neither movement happened.',
      '⚠ Dividing by exactly 100 gives $16,733,049, which sits between the FY2021 and '
        + 'FY2023 figures. That is OFFERED AS THE LIKELIEST READING AND NOT ASSERTED: no '
        + 'source states it, and the stored value\'s trailing $0.05 does not divide into a '
        + 'clean cent figure, so a two-place decimal slip fits well but not exactly.',
    ],
    verifiedBecause: [
      'The county\'s own audited statements, an INDEPENDENT document from a different '
        + 'publisher: the FY2023 ACFR (Federal Audit Clearinghouse report '
        + '2023-06-GSAFAC-0000024739) reports governmental-activities sales taxes of '
        + '$37.59 million for FY2022 and $36,756,343 for FY2023.',
      'The filing ties 18/18: the form\'s own printed Section 1B subtotal carries the same '
        + 'figure, so the preparer entered it and the form summed it. TT reproduces both '
        + 'exactly — this is NOT a read-fidelity failure.',
      'Every other section of the same filing is ordinary: property taxes $41,284,557 '
        + 'against $40,544,026 the year before. Only 1B moves.',
      '⚠ Lowndes\' FY2021 and FY2023 revenue ratios also fall outside the screen\'s '
        + 'bounds, but ONLY because this year inflates the neighbour mean used to judge '
        + 'them. They are artifacts of this one figure and are not separate findings.',
    ],
    benignExplanations: [
      'A cents-as-dollars entry, or two misplaced decimal places, on a single cell.',
      'A SPLOST or regional-authority gross collection figure entered in place of the '
        + 'county\'s own distribution.',
      'A spreadsheet reference picking up a cumulative or multi-jurisdiction total.',
    ],
    corroboration:
      'Measured by the statewide county sweep\'s outlier screen, then checked against an '
      + 'INDEPENDENT source — the county\'s own audited ACFR via the Federal Audit '
      + 'Clearinghouse, which is a different publisher and a different document from the '
      + 'DCA filing. The county\'s own neighbouring filings agree with the audited scale.',
    supportingContext:
      '⭐⭐ THIS RE-OPENS A NULL RESULT THE EARLIER WAVES RECORDED. `GA-RLGF-RECON.md` §10 '
      + 'found four scale breaks across seven governments and measured that NONE of them '
      + 'touched Parts I-VI — the revenue and expenditure flows TT actually loads — while '
      + 'explicitly warning that the null was measured on 7 governments and not 720, and '
      + 'asking for it to be re-measured at scale. Re-measured across the WHOLE STATE — 679 '
      + 'governments, 6,236 filings — FIVE scale breaks appear in loaded revenue data: this '
      + 'one, Monroe FY2025, Varnell FY2018, Cornelia FY2017 and Shellman FY2024. '
      + '⭐⭐ THREE OF THEM FIT THE x1000 SHAPE EXACTLY — Monroe, Varnell and Shellman each '
      + 'read as an ordinary figure for their government once divided by a thousand. That is '
      + 'the mechanism §10 describes, arising because Georgia ACFRs print in thousands while '
      + 'the form asks for dollars, and §10 measured it as ABSENT from Parts I-VI across '
      + 'seven governments. ⚠ This Lowndes figure is NOT one of the three: it fits x100, not '
      + 'x1000, and Cornelia fits neither. So the null did not hold, and the mechanism behind '
      + 'it does reach the loaded Parts — but it is not the only thing that breaks scale there.',
  },
  {
    id: 'milledgeville-fy2025-rents-royalties',
    entity: 'Milledgeville',
    state: 'GA',
    fiscalYear: 2025,
    dataset: 'revenue',
    section: '3B',
    ucoa: '38.1000',
    label: 'Rents and Royalties',
    amount: 7176532550.32,
    loaded: true,
    severity: 'extreme-outlier',
    what:
      'Milledgeville (population 16,664) reported Rents and Royalties of '
      + '$7,176,532,550.32 for FY2025 — 99.57% of its own reported own-source '
      + 'revenue for the year.',
    magnitude: [
      'Roughly 18,300x the entity\'s own prior maximum for this line ($391,806.73, FY2021).',
      'The entity reported $0.00 on this same line in BOTH FY2023 and FY2024.',
      '~1,100x the largest peer figure in the same filing year: Columbus-Muscogee '
        + '$6,473,714.63 (pop ~206k), Macon-Bibb $2,144,388.00 (pop ~157k), Baldwin County $93,154.08.',
      '578x Atlanta\'s FY2025 rents and royalties ($12,406,000), and 2.2x Atlanta\'s '
        + 'ENTIRE FY2025 revenue ($3,224,314,000).',
      '~$420,000 per resident per year from this line alone.',
      '~100x the city\'s entire net position at 6/30/2024 ($71,641,244, audited).',
      'Creates a 199x revenue-to-expenditure ratio for the filing.',
    ],
    verifiedBecause: [
      'It is a LITERAL VALUE in the published file, not a read artifact. A raw BIFF8 '
        + 'record walk of the OLE stream finds the IEEE-754 double at offset 190708 as a '
        + 'type-0x0203 NUMBER record at Page 2!J49 — a hard-keyed constant. DCA\'s LOAD1 '
        + 'extract reaches it by tRef3d formula reference to that same cell.',
      'The filing\'s own arithmetic ties to the penny WITH the figure included: Section 3B, '
        + 'Total Part III and TOTAL "Own Source Revenues" all reconcile exactly.',
      'It reproduces from a SEPARATE publisher pipeline — the UGA Carl Vinson Institute '
        + 'TED Center export (ted.cviog.uga.edu/FileExport) returns the identical figure.',
    ],
    // ⚠ NO ALLEGATION IS MADE OR IMPLIED. Both corroborating agents were asked
    // for benign explanations and independently reached the same one.
    benignExplanations: [
      'A non-dollar value keyed into a dollar cell. `7176532550` is EXACTLY TEN DIGITS — '
        + 'the signature of a phone number, account number or parcel ID.',
      'A stray digit prefix: dropping the leading `7176` leaves $532,550, an entirely '
        + 'ordinary figure for this city.',
      'A units/decimal error fits POORLY — no clean power-of-ten shift lands in the '
        + 'historical range (/100 = $71.8M, /1,000 = $7.18M, /10,000 = $717K).',
    ],
    supportingContext:
      'Removing this one cell leaves FY2025 total revenue of $31,163,583, which matches the '
      + 'city\'s own FY2025 adopted budget (~$30.1M across all funds) and sits inside its '
      + 'FY2016-FY2024 range ($19.9M-$30.4M). Every other line in the filing is in trend. '
      + '⚠ The FY2025 AUDIT was not yet published at the time of loading, so the figure '
      + 'could not be checked against audited statements. The filing itself is marked '
      + '`Audited = YES` by its preparer.',
    corroboration: '2 independent agents, neutral prompts, raw files — one auditing the '
      + 'file\'s internal arithmetic and BIFF8 records, one seeking external evidence of '
      + 'the city\'s real budget size. Both confirmed the figure is genuinely published.',
  },

  // ── wave 2 (2026-10-17) ─────────────────────────────────────────────────
  {
    id: 'dekalb-fy2018-expenditure-side-is-about-one-twelfth',
    entity: 'DeKalb County',
    state: 'GA',
    fiscalYear: 2018,
    dataset: 'operating',
    section: null,
    ucoa: null,
    label: 'Part V — Government Expenditures (entire side)',
    amount: 92044262.00,
    loaded: true,
    severity: 'understated-whole-dataset',
    what:
      'DeKalb County\'s FY2018 filing reports TOTAL Part V government expenditures of '
      + '$92,044,262 while the county\'s OWN AUDITED CAFR reports $654,486,000 of '
      + 'governmental-fund expenditures for the identical calendar year — and DeKalb '
      + 'additionally books its enterprise/utility spending inside Part V, so the true '
      + 'comparable figure is higher still. The shortfall is NOT confined to a section: '
      + 'it runs through essentially every line of the expenditure side at roughly '
      + 'one-eleventh of normal. ⚠⚠ THE REVENUE SIDE OF THE SAME FILING IS A FULL '
      + 'TWELVE MONTHS (Parts I-III $921,906,986, squarely in trend).',
    magnitude: [
      '0.122 of the mean of the two adjacent filings ($618,046,436 FY2017, '
        + '$891,430,961 FY2019).',
      'Restricted to the 47 line items non-zero in 2017, 2018 AND 2019: 0.102 of the '
        + 'two-year average. Per-line median ratio 0.0867; 34 of 47 lines (72%) fall '
        + 'between 1/14 and 1/8; excluding one outlier the aggregate is 1/11.3.',
      'Independently measured through the UGA TED export: median 11.4x shortfall '
        + 'across the 56 operating lines non-zero in all three years (min 2.8x, max 65x).',
      'Line examples (2017 -> 2018 -> 2019): Police Protection 79,199,817 -> 6,458,448 '
        + '-> 77,561,454. Fire Protection 52,256,028 -> 4,318,276 -> 53,825,220. Jail '
        + 'Operations 50,202,147 -> 3,468,510 -> 54,842,841.',
      'Against the audited control total the filing is low by $562,441,738 — the RLGF '
        + 'reports 14.1% of what DeKalb\'s own CAFR reports for governmental funds alone.',
      'Part V / Parts I-IV = 0.072 for FY2018, against a 0.47-0.77 band in the other '
        + 'seven years.',
    ],
    verifiedBecause: [
      'TRIPLE-SOURCED INSIDE THE FILE: DCA\'s LOAD1 extract, the printed Page 3/Page 4 '
        + 'sheets, and a direct xlrd read of the publisher\'s legacy BIFF8 .xls all agree '
        + 'to the dollar. This is what was filed, not a conversion or extract artifact.',
      'REPRODUCED THROUGH A SECOND PUBLISHER PIPELINE: the UGA Carl Vinson Institute TED '
        + 'export returns the identical $92,044,262 for DeKalb FY2018. ⚠ TED republishes '
        + 'the same DCA survey, so it is an independent ACCESS PATH, not an independent '
        + 'MEASUREMENT — it proves the defect is in the filing as submitted, and that it '
        + 'is not something TT or DCA\'s file serving introduced.',
      'THE CONTROL TOTAL IS AUDITED AND HAS NEVER BEEN RESTATED. DeKalb\'s governmental '
        + 'funds Statement of Revenues, Expenditures and Changes in Fund Balances '
        + '(2018 CAFR p.32, modified accrual, printed in THOUSANDS) gives total '
        + 'expenditures $654,486K. The identical 2018 column is reprinted unchanged in '
        + 'the 2019, 2020, 2021 and 2022 ACFRs, and the printed "excess of revenues over '
        + 'expenditures" row (+$44,458K) ties to it exactly.',
      'The audited series is MONOTONIC and shows no 2018 event: expenditures $591,662K '
        + '(2016), $620,072K (2017), $654,486K (2018, +5.6%), $717,066K (2019), '
        + '$834,890K (2020). 2018 is not an outlier in the county\'s real finances.',
      'ENTITY-SPECIFIC, measured two ways. TT\'s own Fulton and Atlanta filings run '
        + 'smooth through FY2018 (Fulton 0.89 of its neighbours, Atlanta the HIGHEST of '
        + 'its 2016-2019 filings). Pulled the same way from TED, Fulton 671M, Cobb 884M, '
        + 'Gwinnett 975M, Clayton 221M and Chatham 278M all sit in line with their own '
        + 'neighbours. There is no portal-wide or statewide FY2018 problem.',
      'THE FORM ITSELF OFFERS NO EXPLANATION. _LOG1 asserts MosRptd = 12, MoChng = No, '
        + 'FYEmonth = December 31. Part XV certifies "Report uses AUDITED Figures = YES", '
        + 'approved 2019-06-28. The DCA-provided "Attachment(s)" note sheet is the blank '
        + 'template. Parts XI-XIII (debt, cash) are normal and full-year.',
      'Unanimous across two independent agents run on neutral prompts — one characterising '
        + 'the eight filings from the raw workbooks with no external data, one reading '
        + 'DeKalb\'s own CAFRs and the TED export with no sight of the filings. Their '
        + 'ratio estimates (1/11.3 and 11.4x) agree without either seeing the other.',
    ],
    // ⚠ NO ALLEGATION IS MADE OR IMPLIED. This UNDERSTATES spending, and the
    // publisher explicitly does not certify these self-reported forms.
    benignExplanations: [
      'A PARTIAL-PERIOD EXTRACT: the preparer ran the expenditure side of the general '
        + 'ledger query for a single accounting period while pulling revenue '
        + 'year-to-date. A ~1/12 ratio spread across every function, with ordinary '
        + 'month-to-month lumpiness per line (interquartile 0.077-0.103), is exactly '
        + 'the shape a one-period query produces.',
      'A DRAFT FILED AND NEVER AMENDED: FY2018 is the only DeKalb year whose preparer-name '
        + 'block (Page 6 / _LOG1 PreparerName) is blank.',
      '⚠ RULED OUT — a units error. Thousands-vs-dollars would give 0.001 and would be '
        + 'uniform; this is 0.087 with a wide spread.',
      '⚠ RULED OUT — a narrower FUND SCOPE. A partial-fund submission removes whole '
        + 'functions; it does not shave every function to a similar fraction.',
      'Context, not excuse: DCA performs no reconciliation, Rule 110-3-1 says the data '
        + '"does not have to be audited", and the form\'s own page 1 says "DCA cannot '
        + 'certify the accuracy of the report figures submitted". Nothing upstream was '
        + 'positioned to catch this.',
    ],
    supportingContext:
      '⚠ The filing\'s REVENUE side is not wholly clean either, though its total is in '
      + 'trend: General Business Licenses is $0 in FY2018 ($18.9M FY2017, $14.8M FY2019), '
      + 'and the sanitation/water/sewer service-charge categories were re-mapped starting '
      + 'in FY2018 (Landfill Use Fees 253M -> 68.7M as Water and Sewerage Charges first '
      + 'become non-zero). So FY2018 revenue CATEGORIES are not comparable year-over-year '
      + 'even where the total is.',
    corroboration:
      '2 independent agents, neutral prompts, neither told the conclusion nor shown the '
      + 'other\'s work, approached differently — one from the raw workbooks only, one from '
      + 'external published sources only. Both reached the same finding and the same '
      + 'order of magnitude independently. Chris\'s standing requirement.',
  },
  {
    id: 'fulton-fy2017-fy2018-property-tax-timing',
    entity: 'Fulton County',
    state: 'GA',
    fiscalYear: 2017,
    alsoAffects: [2018],
    dataset: 'revenue',
    section: '1A',
    ucoa: '31.1100 / 31.1200',
    label: 'Real Property Taxes, current year and prior year',
    amount: 632142190.16,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. This is the first entry in this register
    // where NOTHING IS WRONG WITH THE NUMBER. The filing faithfully records a
    // real event on a cash-like basis; what breaks is comparing the two years.
    // Recording it as a defect would defame a government that did nothing
    // wrong AND tell the reader something false about the figure.
    what:
      'Fulton County could not bill its 2017 property taxes on time. The Georgia Department of '
      + 'Revenue did NOT approve the county\'s 2017 tax digest after the Board of Commissioners '
      + 'voted to hold residential values at 2016 levels, and the county had to obtain a Superior '
      + 'Court Temporary Collection Order (filed 2017-11-03, O.C.G.A. § 48-5-310) before it could '
      + 'issue bills at all. The due date moved from 15 October to 15 JANUARY 2018, so roughly a '
      + 'third of the 2017 levy was collected in 2018. In the filing, 31.1100 (current year) is '
      + '$296,236,285 in FY2017 against a $500,479,657 neighbour mean, and 31.1200 (PRIOR year) is '
      + '$215,787,678 in FY2018 against a $32,880,709 mean.',
    magnitude: [
      'FY2017 31.1100 ratio 0.592 (short $204,243,372); FY2018 31.1200 ratio 6.563 (excess '
        + '$182,906,969).',
      'Fitted log-linearly to the clean 2016/2019 endpoints, the real-property family residuals are '
        + '-$189,705,539 (2017) and +$182,694,508 (2018) — they CANCEL to -$7,011,032, or -0.640% '
        + 'of the two-year expectation.',
      'Two-year Part I window: 2017+2018 = $1,282,125,297 against 2016+2019 = $1,290,004,088, '
        + '-0.61%.',
      '⚠⚠ READER DISTORTION: of the $407,620,756 apparent Part I increase from FY2017 to FY2018, '
        + '$375,790,658 — 92.2% — is the two residuals unwinding. True growth is ~5%, so the '
        + 'published comparison overstates the move by a FACTOR OF 18 (93.2% vs ~5%). A reader '
        + 'comparing FY2016 to FY2017 concludes revenue FELL 26.8% when it rose ~5%.',
    ],
    verifiedBecause: [
      '⚠⚠ THE GOVERNMENT SAYS SO ITSELF, four times in its own report. FY2017 CAFR transmittal '
        + 'letter, verbatim: "The County\'s due date for property taxes was extended to January 15, '
        + '2018. 67% was collected in fiscal 2017, with the remainder collected in January of 2018." '
        + 'Repeated in the MD&A ("Tax Digest Process for 2017") and in Note 4(a).',
      'PRIMARY COURT RECORD: Superior Court of Fulton County, "Final Order Authorizing the '
        + 'Immediate and Temporary Collection of Taxes", e-filed 2017-11-03 — finding of fact (10): '
        + '"The last Fulton County Tax Digest that was approved by the Revenue Commissioner was from '
        + '2016."',
      'THE COUNTY\'S OWN COLLECTION RECORDS SHOW THE SAME SHAPE IN THREE INDEPENDENT FUNDS '
        + '(Schedule 8-A/8-C). General Fund current-year collection: 97.3% / 94.9% / 66.9% / 95.4% / '
        + '97.2% / 95.4% for 2015-2020. Debt Service: 68.1% then 125.7%. South Fulton: 53.6% then '
        + '211.9%. FY2018 delinquent collections are $159,945K against $8.7K-$44.9K in normal years.',
      'NOTHING WAS LOST: 2017+2018 General Fund levy $1,007,635K against $1,007,252K collected — a '
        + 'gap of $383K on a billion.',
      '⚠ THE DEFERRED INFLOW IS THE MECHANISM, and it is published: "unavailable revenues — '
        + 'property taxes" at 12/31 runs $16,536K / $24,200K / $67,807K / $21,324K / $14,360K / '
        + '$17,252K for 2015-2020. The FY2017 spike is exactly the receivable not collected within '
        + 'the 60-day availability window.',
      '⚠⚠ NO ACCOUNTING CHANGE AND NO RESTATEMENT. The 60-day availability period is identical in '
        + 'every year; the 2015-2018 rows of Schedule 8-A are byte-identical across the FY2017, '
        + 'FY2018 and FY2020 editions. The only restatement in the window is GASB 75 OPEB.',
      'ENTITY-SPECIFIC: DeKalb 31.1100 FY2017 ratio 1.055 and FY2018 0.983, with a monotonic '
        + 'real-property series; Atlanta (a June-30 reporter, so differently phased) shows no '
        + '200M-scale prior-year excess in any year.',
      'Triple-sourced inside the file — printed Page 1, LOAD1 and a direct xlrd read of the BIFF8 '
        + 'original agree on all 55 Part I cells per year, 0 mismatches, and every subtotal foots.',
    ],
    // ⚠ There is nothing to excuse here — the filing is RIGHT.
    benignExplanations: [
      '⭐ NOT APPLICABLE IN THE USUAL SENSE: this is not a defect needing a benign reading. The '
        + 'figures faithfully record what happened on the basis the form uses.',
      'The apparent conflict between sources is a BASIS difference, not an error. Cash/levy basis: '
        + '2017 $343,227K, 2018 $664,025K. Modified accrual (all taxes, governmental funds): '
        + '$575,978K and $696,787K. Government-wide accrual (property taxes): $558,945K and '
        + '$589,027K — SMOOTH, because accrual recognises the levy in the year assessed. All three '
        + 'are correct and none is comparable to another.',
    ],
    supportingContext:
      '⚠ FY2018 WAS NOT A CLEAN RETURN EITHER, and the county\'s own report contradicts itself on '
      + 'this: the FY2018 transmittal letter says 2018 "saw normal activity" while the FY2018 MD&A '
      + 'says "The 2017 Digest has yet to be approved by the Georgia Department of Revenue, '
      + 'therefore the County obtained a temporary collection order to issue tax bills for 2018." '
      + 'The 2018 due date was 31 October, itself two weeks past normal. '
      + '⚠ Fulton\'s ACFR has NO property-tax line on the governmental funds operating statement — '
      + 'only an aggregated "Taxes" — and no current/prior or real/personal split of revenue '
      + 'anywhere, so Schedule 8-A is the only published control at this granularity.',
    corroboration:
      '2 independent agents, neutral prompts, neither told the conclusion nor shown the other\'s '
      + 'work. One swept every Part I line of all 27 filings by ratio from the raw workbooks, with '
      + 'a MANDATORY reappearance test, and established the offset and the two-year closure with no '
      + 'external data. The other read six Fulton ACFRs and the court record and found the '
      + 'documented cause. The first said "this looks like a billing cycle slipping across a year '
      + 'boundary"; the second found the court order that made it slip.',
  },
  {
    id: 'fulton-fy2021-confined-cluster-at-two-percent',
    entity: 'Fulton County',
    state: 'GA',
    fiscalYear: 2021,
    dataset: 'operating',
    section: '5F/5E/5A/5C/5D/5G',
    ucoa: '6500/6100/5400/1555/3100/4200/4250/7400/7500',
    label: 'Libraries, Recreation, Welfare, Risk Management and five more',
    amount: 568996679.77,
    loaded: true,
    severity: 'understated-confined-cluster',
    what:
      'Fulton County\'s FY2021 filing reports $622,851 of Culture and Recreation — '
      + 'against $38.4M in 2020 and $34.7M in 2022 — essentially all of it Libraries, '
      + 'with Recreation at exactly $0. The county\'s OWN budgetary schedule reports '
      + 'LIBRARY DEPARTMENT ACTUALS OF $26,294,000 for the same year, in a flat series '
      + '($27,365K / $28,128K / $26,294K / $26,827K / $27,824K, 2019-2023). '
      + '⚠⚠ UNLIKE DEKALB FY2018 THIS IS CONFINED, NOT FILING-WIDE: Judicial is at '
      + '95.9% of its neighbours and Public Safety at 83.6%. Nine lines are affected; '
      + 'most of the filing is intact.',
    magnitude: [
      'THREE LINES SHARE A RATIO to the mean of their own 2020 and 2022 values, within '
        + '0.24 of a percentage point: Risk Management $137,931 (2.012%), Welfare '
        + '$384,820 (1.850%), Libraries $622,851 (2.090%). For scale, one week of a '
        + 'year is 1.923%.',
      'SIX FURTHER LINES ARE EXACTLY ZERO with non-trivial values on both sides: '
        + 'Public Safety Administration (-$18.0M vs neighbour mean), Recreation '
        + '(-$6.8M), Roads/Streets/Bridges (-$0.67M), Planning and Zoning (-$0.45M), '
        + 'Storm Drainage (-$0.45M), Economic Development (-$0.24M).',
      'Section 5F collapses to 1.70% of its neighbour mean. Part V as a whole is '
        + '$568,996,680 = 78.3% of its neighbour mean, so roughly a fifth is missing.',
      'Against the county\'s own library actuals, the filing reports 2.4% of what '
        + 'Fulton spent on libraries that year ($622,851 vs $26,294,000).',
    ],
    verifiedBecause: [
      '⚠⚠ THE EXTERNAL CONTROL IS FLAT AND UNCHANGED. Fulton\'s own General Fund '
        + 'budgetary schedule reports library actuals of $27,365K (2019), $28,128K '
        + '(2020), $26,294K (2021), $26,827K (2022), $27,824K (2023) — within 7% across '
        + 'five years, with no discontinuity at 2021 whatsoever.',
      '⚠⚠ THE LIBRARY\'S FINANCING DID NOT CHANGE. Verified against five successive '
        + 'ACFRs: it is a General Fund DEPARTMENT, not a component unit (the auditor '
        + 'names only the Fulton-DeKalb Hospital Authority and the Board of Health), '
        + 'has no dedicated millage (Schedule 6 lists four direct levies, none for '
        + 'libraries), and was never moved between funds. So the filing\'s near-zero is '
        + 'NOT a reporting reorganisation.',
      'THE MONEY DOES NOT REAPPEAR ANYWHERE IN THE FILING. Summing every Part V line\'s '
        + 'FY2021 deviation from its own 2020/2022 mean: -$164,089,220 of negative gaps '
        + 'against +$6,213,988 of positive, net -$157,875,232 unabsorbed. Part X '
        + '(intergovernmental, 99.4% of neighbours) and Part VI were both checked as '
        + 'alternative homes. ⚠ This test matters: the SAME sweep found Fulton\'s '
        + 'FY2017/18 property tax swing IS a reappearance and therefore NOT a loss.',
      'THE REVENUE SIDE OF THE SAME FILING IS NORMAL: Part I total 101.3% of its '
        + 'neighbour mean, Own Source Revenues 99.3%, property taxes 101.9%. '
        + 'Expenditure at 78.3% against revenue at ~100% is the same asymmetry DeKalb '
        + 'FY2018 shows.',
      'THE FILING OFFERS NO EXPLANATION: MosRptd = 12, MoChng = No, Audited = YES, '
        + 'approved 2023-01-09. Every sheet of the workbook was read, including hidden '
        + 'ranges; no note, footnote or attachment touches any affected line.',
      'ENTITY- AND YEAR-SPECIFIC: DeKalb FY2021 is its HIGHEST Part V year in the '
        + 'series, and Atlanta FY2021 shows only scattered unrelated items with no '
        + 'shared ratio and no section collapse.',
      'LOAD1 and the printed form agree on all 77 Part V codes, to the cent, in all '
        + 'nine Fulton years — so this is content, not a parse or extract artifact.',
    ],
    // ⚠ NO ALLEGATION. A new preparer inheriting a complex form is the most
    // ordinary circumstance there is, and this UNDERSTATES spending.
    benignExplanations: [
      'A FUND-SCOPE NARROWING — the leading explanation. Every affected function '
        + '(libraries, recreation, risk management as an internal service fund, '
        + 'welfare, planning, economic development, roads, storm drainage) is one '
        + 'Fulton runs substantially OUTSIDE the General Fund. A Part V pulled from the '
        + 'General Fund trial balance plus a few others yields exactly this shape: '
        + 'normal GF-dominated functions, near-zero residuals for the rest, and an '
        + 'untouched revenue side (a tax roll comes from somewhere else).',
      '⭐ A PREPARER CHANGE, read from the form itself: _LOG1 names Sabrinna McTier for '
        + 'FY2016-2020 and Kela Pryor from FY2021 on. FY2021 is the FIRST filing by a '
        + 'new preparer — the most common benign cause of a one-year scope shift.',
      '⚠ PANDEMIC-ADJACENT CIRCUMSTANCE, not a pandemic spending cut. Fulton\'s FY2021 '
        + 'ACFR was the latest-filed of its five years — auditor\'s report dated '
        + '2022-12-15, about 11.5 months after year end — and the county\'s second major '
        + 'fund churned from a CARES Fund (2020) to an American Rescue Plan Fund '
        + '(2021). A new preparer completing the form amid that churn, before the audit '
        + 'was signed, fits.',
      '⚠⚠ RULED OUT — GENUINE COVID CLOSURE. Libraries and recreation centres really '
        + 'were shut, but the numbers refute it: FY2020 was the HARDER closure year and '
        + 'reports $30.4M of libraries and $8.0M of recreation; FY2022 returns to '
        + '$29.2M. A 98% single-year drop bracketed by two normal years is not a '
        + 'closure profile, and buildings, payroll and debt do not stop. The county\'s '
        + 'own library actuals are flat THROUGH 2021.',
      '⚠ RULED OUT — a reclassification. No code in the FY2021 filing absorbs the '
        + '$157.9M.',
    ],
    supportingContext:
      '⚠ Fulton\'s ACFR does NOT use the DCA function set — it reports Administration, '
      + 'Public safety, Legal, Infrastructure and facilities, Social services, Health '
      + 'services and Other nonagency, with no "Culture and Recreation" or "Health and '
      + 'Welfare" caption anywhere. So no ACFR line is a direct control total for '
      + 'Section 5F; the library DEPARTMENT schedule is, and that is what was used. '
      + '⚠ Part V columns (b) property and (d) intangibles are $0 in all nine Fulton '
      + 'years, with capital outlay at 0.90% of Part V — treat Fulton\'s Part V as an '
      + 'OPERATING measure, not total spend.',
    corroboration:
      '2 independent agents, neutral prompts, neither told the conclusion nor shown the '
      + 'other\'s work, approached differently — one swept all nine filings from the raw '
      + 'workbooks with no external data (blind sweep by ratio, not a hunt for a known '
      + 'line), one read Fulton\'s five ACFRs with no sight of the filings. The first '
      + 'established the pattern is real, confined and unabsorbed; the second supplied '
      + 'the flat external control and ruled out a financing change.',
  },
  {
    id: 'dekalb-fy2017-utility-lines-omitted',
    entity: 'DeKalb County',
    state: 'GA',
    fiscalYear: 2017,
    dataset: 'operating',
    section: '5D',
    ucoa: '4250/4300/4400/4510/4520',
    label: 'Public Works — utility and sanitation lines',
    amount: 618046436.00,
    loaded: true,
    severity: 'understated-category-omission',
    what:
      'A SECOND and DIFFERENTLY-SHAPED defect in the same entity. DeKalb\'s FY2017 '
      + 'filing reports $0 on every utility and sanitation line of Section 5D — Storm '
      + 'Drainage, Wastewater, Water, Solid Waste Administration and Solid Waste '
      + 'Collection — while reporting $336,041,721 of Part IV enterprise REVENUE and $0 '
      + 'of Part VI enterprise expense. Roughly $230M of enterprise cost appears nowhere '
      + 'in the filing. ⚠ This is a CATEGORY OMISSION, not the FY2018 scaling: the '
      + 'non-utility 5D lines (Public Works Administration $8,084,787, Roads and Bridges '
      + '$18,046,854, Maintenance Shop $27,443,362) are all normal full-year figures.',
    magnitude: [
      'Section 5D FY2017 = $53,575,003 against $284,222,766 (FY2016) and $298,521,849 '
        + '(FY2019) — 8.7% of Part V, against 27-37% in every other year.',
      'The five blanked lines carried $237,740,833 in FY2016 and $231,393,041 in FY2019.',
      'Water alone: $155,071,343 (FY2016) -> $0 (FY2017) -> $141,615,361 (FY2019).',
    ],
    verifiedBecause: [
      'Read directly from the printed page in all eight years: 4250, 4300, 4400, 4510 '
        + 'and 4520 are simultaneously zero in FY2017 ONLY, while 4100, 4200 and 4900 in '
        + 'the same section carry ordinary full-year values.',
      'Reproduced through the independent TED access path, which shows Water and Solid '
        + 'Waste and Recycling Administration at $0 for DeKalb FY2017.',
      'DeKalb\'s standing practice in all eight filings is to book enterprise spending on '
        + 'the Part V utility lines and leave Part VI at zero — so FY2017 is a departure '
        + 'from the entity\'s own convention, not a different convention.',
    ],
    benignExplanations: [
      'The preparer treated the enterprise funds as out of Part V scope — which the '
        + 'form\'s instruction permits ONLY if they are reported in Part VI — and then '
        + 'did not fill Part VI.',
    ],
    supportingContext:
      '⚠⚠ THE WIDER CONSEQUENCE, which matters more than the one year: DeKalb books '
      + 'ENTERPRISE/UTILITY spending INSIDE Part V (Water runs $141M-$201M), so TT\'s '
      + 'DeKalb operating series is gross of utility operations in most years and net of '
      + 'them in FY2017. The series is therefore NOT year-over-year comparable, and it is '
      + 'not comparable to an entity that reports utilities in Part VI. This is precisely '
      + 'why these rows carry fund_scope = `unknown` rather than a scope vocabulary value '
      + 'they would not honour.',
    corroboration:
      'Found independently by the raw-workbook agent and the external agent, and verified '
      + 'a third time directly against the printed pages before being recorded.',
  },
  {
    id: 'bacon-fy2014-six-month-transition-year',
    entity: 'Bacon County',
    state: 'GA',
    fiscalYear: 2014,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A six-month transition year',
    amount: 4089034,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter, and the
    // county declared the change on the form itself. Recording this as a
    // defect would mislead the reader and impute a fault to a government
    // that said so.
    what:
      'Bacon County moved its fiscal year end from 31 December to 30 June in FY2014, so that year '
      + 'covers SIX MONTHS. The filing declares it: the v1 form’s months-reported field '
      + '(V99) reads 6, not 12. Operating comes to $4,089,034 against a $8,435,661 mean of '
      + 'FY2013 and FY2015 — a ratio of 0.485 where 6 twelfths is 0.500.',
    magnitude: [
      'Operating ratio 0.485 against the neighbour mean (FY2013 and FY2015).',
      'Revenue ratio 0.309 — $2,632,496 against $8,530,743.',
      '⚠ The revenue ratio sits further from 0.50 than the expenditure one, which is '
        + 'what a changeover does to a collection cycle: property tax arrives in a lump that does '
        + 'not divide neatly into a part-year stub. Both figures are shown exactly as filed.',
    ],
    verifiedBecause: [
      'The form states the short period ITSELF — V99 (months reported) reads 6 in this filing '
        + 'and 12 in every other v1 filing this county made.',
      'The money agrees independently: the operating ratio is 0.485 where 0.500 is expected.',
      '⚠⚠ TWO SIGNALS, NOT ONE, AND THAT IS THE POINT. The FY2016-2025 sweep established that the '
        + 'months-reported field ALONE cannot find stubs — Talbot FY2022 reported twelve months '
        + 'while reporting a quarter of the money. Here the declaration and the money agree, and '
        + 'the one Georgia county where they DISAGREED (Chattooga FY2014: twelve months declared, a '
        + 'full year of money, a June year-end between two December ones) turned out to be a keying '
        + 'slip and is corrected rather than flagged.',
    ],
    benignExplanations: [
      'A deliberate, lawful change of fiscal calendar, which Georgia counties make by local '
        + 'ordinance and which the DCA form has a field to declare.',
    ],
    corroboration:
      'The county’s own filings on both sides of the change report the two different year-ends, in '
      + 'the right order, and the transition year declares the short period on its face.',
  },
  {
    id: 'baldwin-fy2010-nine-month-transition-year',
    entity: 'Baldwin County',
    state: 'GA',
    fiscalYear: 2010,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A nine-month transition year',
    amount: 17310524,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter, and the
    // county declared the change on the form itself. Recording this as a
    // defect would mislead the reader and impute a fault to a government
    // that said so.
    what:
      'Baldwin County moved its fiscal year end from 30 June to 31 December in FY2010, so that year '
      + 'covers NINE MONTHS. The filing declares it: the v1 form’s months-reported field '
      + '(V99) reads 9, not 12. Operating comes to $17,310,524 against a $24,919,628 mean of '
      + 'FY2009 and FY2011 — a ratio of 0.695 where 9 twelfths is 0.750.',
    magnitude: [
      'Operating ratio 0.695 against the neighbour mean (FY2009 and FY2011).',
      'Revenue ratio 0.808 — $22,559,133 against $27,903,549.',
      '⚠ The revenue ratio sits further from 0.75 than the expenditure one, which is '
        + 'what a changeover does to a collection cycle: property tax arrives in a lump that does '
        + 'not divide neatly into a part-year stub. Both figures are shown exactly as filed.',
      '⚠ The FY2016-2025 sweep already knew this change existed and could not see it, recording only that Baldwin’s and Atlanta’s changes both sat BELOW the FY2016 floor. This is that change, measured directly for the first time.',
    ],
    verifiedBecause: [
      'The form states the short period ITSELF — V99 (months reported) reads 9 in this filing '
        + 'and 12 in every other v1 filing this county made.',
      'The money agrees independently: the operating ratio is 0.695 where 0.750 is expected.',
      '⚠⚠ TWO SIGNALS, NOT ONE, AND THAT IS THE POINT. The FY2016-2025 sweep established that the '
        + 'months-reported field ALONE cannot find stubs — Talbot FY2022 reported twelve months '
        + 'while reporting a quarter of the money. Here the declaration and the money agree, and '
        + 'the one Georgia county where they DISAGREED (Chattooga FY2014: twelve months declared, a '
        + 'full year of money, a June year-end between two December ones) turned out to be a keying '
        + 'slip and is corrected rather than flagged.',
    ],
    benignExplanations: [
      'A deliberate, lawful change of fiscal calendar, which Georgia counties make by local '
        + 'ordinance and which the DCA form has a field to declare.',
    ],
    corroboration:
      'The county’s own filings on both sides of the change report the two different year-ends, in '
      + 'the right order, and the transition year declares the short period on its face.',
  },
  {
    id: 'cherokee-fy2012-nine-month-transition-year',
    entity: 'Cherokee County',
    state: 'GA',
    fiscalYear: 2012,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A nine-month transition year',
    amount: 90450127,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter, and the
    // county declared the change on the form itself. Recording this as a
    // defect would mislead the reader and impute a fault to a government
    // that said so.
    what:
      'Cherokee County moved its fiscal year end from 31 December to 30 September in FY2012, so that year '
      + 'covers NINE MONTHS. The filing declares it: the v1 form’s months-reported field '
      + '(V99) reads 9, not 12. Operating comes to $90,450,127 against a $124,762,926 mean of '
      + 'FY2011 and FY2013 — a ratio of 0.725 where 9 twelfths is 0.750.',
    magnitude: [
      'Operating ratio 0.725 against the neighbour mean (FY2011 and FY2013).',
      'Revenue ratio 0.537 — $78,189,998 against $145,606,505.',
      '⚠ The revenue ratio sits further from 0.75 than the expenditure one, which is '
        + 'what a changeover does to a collection cycle: property tax arrives in a lump that does '
        + 'not divide neatly into a part-year stub. Both figures are shown exactly as filed.',
      '⚠ Cherokee changed calendar TWICE in this window, and the FIRST change leaves a GAP rather than a stub: FY2010 ends 30 June 2010 and FY2011 reports a full twelve months ending 31 December 2011, so JULY TO DECEMBER 2010 IS REPORTED BY NO FILING AT ALL.',
    ],
    verifiedBecause: [
      'The form states the short period ITSELF — V99 (months reported) reads 9 in this filing '
        + 'and 12 in every other v1 filing this county made.',
      'The money agrees independently: the operating ratio is 0.725 where 0.750 is expected.',
      '⚠⚠ TWO SIGNALS, NOT ONE, AND THAT IS THE POINT. The FY2016-2025 sweep established that the '
        + 'months-reported field ALONE cannot find stubs — Talbot FY2022 reported twelve months '
        + 'while reporting a quarter of the money. Here the declaration and the money agree, and '
        + 'the one Georgia county where they DISAGREED (Chattooga FY2014: twelve months declared, a '
        + 'full year of money, a June year-end between two December ones) turned out to be a keying '
        + 'slip and is corrected rather than flagged.',
    ],
    benignExplanations: [
      'A deliberate, lawful change of fiscal calendar, which Georgia counties make by local '
        + 'ordinance and which the DCA form has a field to declare.',
    ],
    corroboration:
      'The county’s own filings on both sides of the change report the two different year-ends, in '
      + 'the right order, and the transition year declares the short period on its face.',
  },
  {
    id: 'dade-fy2010-six-month-transition-year',
    entity: 'Dade County',
    state: 'GA',
    fiscalYear: 2010,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A six-month transition year',
    amount: 3303828,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter, and the
    // county declared the change on the form itself. Recording this as a
    // defect would mislead the reader and impute a fault to a government
    // that said so.
    what:
      'Dade County moved its fiscal year end from 31 December to 30 June in FY2010, so that year '
      + 'covers SIX MONTHS. The filing declares it: the v1 form’s months-reported field '
      + '(V99) reads 6, not 12. Operating comes to $3,303,828 against a $10,511,276 mean of '
      + 'FY2009 alone — a ratio of 0.314 where 6 twelfths is 0.500.',
    magnitude: [
      'Operating ratio 0.314 against the neighbour mean (FY2009 alone).',
      'Revenue ratio 0.374 — $3,971,994 against $10,607,003.',
      '⚠ The revenue ratio sits further from 0.50 than the expenditure one, which is '
        + 'what a changeover does to a collection cycle: property tax arrives in a lump that does '
        + 'not divide neatly into a part-year stub. Both figures are shown exactly as filed.',
      '⚠ DCA lists NO FY2011 filing for Dade, so the only neighbour is FY2009 - itself a high year at 1.35 of Dade’s own v1 mean. The ratio is measured against an inflated base and reads lower than half; the form’s own six-month declaration is the primary evidence here, not the money.',
    ],
    verifiedBecause: [
      'The form states the short period ITSELF — V99 (months reported) reads 6 in this filing '
        + 'and 12 in every other v1 filing this county made.',
      'The money agrees independently: the operating ratio is 0.314 where 0.500 is expected.',
      '⚠⚠ TWO SIGNALS, NOT ONE, AND THAT IS THE POINT. The FY2016-2025 sweep established that the '
        + 'months-reported field ALONE cannot find stubs — Talbot FY2022 reported twelve months '
        + 'while reporting a quarter of the money. Here the declaration and the money agree, and '
        + 'the one Georgia county where they DISAGREED (Chattooga FY2014: twelve months declared, a '
        + 'full year of money, a June year-end between two December ones) turned out to be a keying '
        + 'slip and is corrected rather than flagged.',
    ],
    benignExplanations: [
      'A deliberate, lawful change of fiscal calendar, which Georgia counties make by local '
        + 'ordinance and which the DCA form has a field to declare.',
    ],
    corroboration:
      'The county’s own filings on both sides of the change report the two different year-ends, in '
      + 'the right order, and the transition year declares the short period on its face.',
  },
  {
    id: 'jasper-fy2011-six-month-transition-year',
    entity: 'Jasper County',
    state: 'GA',
    fiscalYear: 2011,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A six-month transition year',
    amount: 4737846,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter, and the
    // county declared the change on the form itself. Recording this as a
    // defect would mislead the reader and impute a fault to a government
    // that said so.
    what:
      'Jasper County moved its fiscal year end from 31 December to 30 June in FY2011, so that year '
      + 'covers SIX MONTHS. The filing declares it: the v1 form’s months-reported field '
      + '(V99) reads 6, not 12. Operating comes to $4,737,846 against a $9,410,169 mean of '
      + 'FY2010 and FY2012 — a ratio of 0.503 where 6 twelfths is 0.500.',
    magnitude: [
      'Operating ratio 0.503 against the neighbour mean (FY2010 and FY2012).',
      'Revenue ratio 0.252 — $2,415,187 against $9,590,317.',
      '⚠ The revenue ratio sits further from 0.50 than the expenditure one, which is '
        + 'what a changeover does to a collection cycle: property tax arrives in a lump that does '
        + 'not divide neatly into a part-year stub. Both figures are shown exactly as filed.',
    ],
    verifiedBecause: [
      'The form states the short period ITSELF — V99 (months reported) reads 6 in this filing '
        + 'and 12 in every other v1 filing this county made.',
      'The money agrees independently: the operating ratio is 0.503 where 0.500 is expected.',
      '⚠⚠ TWO SIGNALS, NOT ONE, AND THAT IS THE POINT. The FY2016-2025 sweep established that the '
        + 'months-reported field ALONE cannot find stubs — Talbot FY2022 reported twelve months '
        + 'while reporting a quarter of the money. Here the declaration and the money agree, and '
        + 'the one Georgia county where they DISAGREED (Chattooga FY2014: twelve months declared, a '
        + 'full year of money, a June year-end between two December ones) turned out to be a keying '
        + 'slip and is corrected rather than flagged.',
    ],
    benignExplanations: [
      'A deliberate, lawful change of fiscal calendar, which Georgia counties make by local '
        + 'ordinance and which the DCA form has a field to declare.',
    ],
    corroboration:
      'The county’s own filings on both sides of the change report the two different year-ends, in '
      + 'the right order, and the transition year declares the short period on its face.',
  },
  {
    id: 'putnam-fy2010-nine-month-transition-year',
    entity: 'Putnam County',
    state: 'GA',
    fiscalYear: 2010,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A nine-month transition year',
    amount: 14813438,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter, and the
    // county declared the change on the form itself. Recording this as a
    // defect would mislead the reader and impute a fault to a government
    // that said so.
    what:
      'Putnam County moved its fiscal year end from 31 December to 30 September in FY2010, so that year '
      + 'covers NINE MONTHS. The filing declares it: the v1 form’s months-reported field '
      + '(V99) reads 9, not 12. Operating comes to $14,813,438 against a $18,643,856 mean of '
      + 'FY2009 and FY2011 — a ratio of 0.795 where 9 twelfths is 0.750.',
    magnitude: [
      'Operating ratio 0.795 against the neighbour mean (FY2009 and FY2011).',
      'Revenue ratio 0.440 — $8,956,546 against $20,353,469.',
      '⚠ The revenue ratio sits further from 0.75 than the expenditure one, which is '
        + 'what a changeover does to a collection cycle: property tax arrives in a lump that does '
        + 'not divide neatly into a part-year stub. Both figures are shown exactly as filed.',
      '⚠ Putnam’s FY2011 filing ALSO reports nine months while carrying a full year of money (0.942 of its own mean). That later declaration is treated as a stale copy of this year’s answer rather than a second stub, and nothing turns on it because the month itself is unchanged either way.',
    ],
    verifiedBecause: [
      'The form states the short period ITSELF — V99 (months reported) reads 9 in this filing '
        + 'and 12 in every other v1 filing this county made.',
      'The money agrees independently: the operating ratio is 0.795 where 0.750 is expected.',
      '⚠⚠ TWO SIGNALS, NOT ONE, AND THAT IS THE POINT. The FY2016-2025 sweep established that the '
        + 'months-reported field ALONE cannot find stubs — Talbot FY2022 reported twelve months '
        + 'while reporting a quarter of the money. Here the declaration and the money agree, and '
        + 'the one Georgia county where they DISAGREED (Chattooga FY2014: twelve months declared, a '
        + 'full year of money, a June year-end between two December ones) turned out to be a keying '
        + 'slip and is corrected rather than flagged.',
    ],
    benignExplanations: [
      'A deliberate, lawful change of fiscal calendar, which Georgia counties make by local '
        + 'ordinance and which the DCA form has a field to declare.',
    ],
    corroboration:
      'The county’s own filings on both sides of the change report the two different year-ends, in '
      + 'the right order, and the transition year declares the short period on its face.',
  },
  {
    id: 'randolph-fy2012-nine-month-transition-year',
    entity: 'Randolph County',
    state: 'GA',
    fiscalYear: 2012,
    dataset: 'operating and revenue',
    section: 'the whole filing',
    ucoa: null,
    label: 'A nine-month transition year',
    amount: 4657344,
    loaded: true,
    severity: 'not-comparable',
    // ⚠⚠ THE FIGURES ARE CORRECT. The period is genuinely shorter, and the
    // county declared the change on the form itself. Recording this as a
    // defect would mislead the reader and impute a fault to a government
    // that said so.
    what:
      'Randolph County moved its fiscal year end from 31 March to 31 December in FY2012, so that year '
      + 'covers NINE MONTHS. The filing declares it: the v1 form’s months-reported field '
      + '(V99) reads 9, not 12. Operating comes to $4,657,344 against a $7,814,999 mean of '
      + 'FY2011 and FY2013 — a ratio of 0.596 where 9 twelfths is 0.750.',
    magnitude: [
      'Operating ratio 0.596 against the neighbour mean (FY2011 and FY2013).',
      'Revenue ratio 0.830 — $5,453,562 against $6,573,448.',
      '⚠ The revenue ratio sits further from 0.75 than the expenditure one, which is '
        + 'what a changeover does to a collection cycle: property tax arrives in a lump that does '
        + 'not divide neatly into a part-year stub. Both figures are shown exactly as filed.',
      '⚠ Randolph is one of very few Georgia governments on a 31 MARCH year end, which is the calendar it is leaving here.',
    ],
    verifiedBecause: [
      'The form states the short period ITSELF — V99 (months reported) reads 9 in this filing '
        + 'and 12 in every other v1 filing this county made.',
      'The money agrees independently: the operating ratio is 0.596 where 0.750 is expected.',
      '⚠⚠ TWO SIGNALS, NOT ONE, AND THAT IS THE POINT. The FY2016-2025 sweep established that the '
        + 'months-reported field ALONE cannot find stubs — Talbot FY2022 reported twelve months '
        + 'while reporting a quarter of the money. Here the declaration and the money agree, and '
        + 'the one Georgia county where they DISAGREED (Chattooga FY2014: twelve months declared, a '
        + 'full year of money, a June year-end between two December ones) turned out to be a keying '
        + 'slip and is corrected rather than flagged.',
    ],
    benignExplanations: [
      'A deliberate, lawful change of fiscal calendar, which Georgia counties make by local '
        + 'ordinance and which the DCA form has a field to declare.',
    ],
    corroboration:
      'The county’s own filings on both sides of the change report the two different year-ends, in '
      + 'the right order, and the transition year declares the short period on its face.',
  },
]);

/**
 * ── FLAG 2: the publisher’s machine extract is defective ───────────────────
 *
 * ⚠⚠ THIS DOES NOT AFFECT LOADED FIGURES. TT reads the PRINTED FORM, which
 * reconciles to its own subtotals in 1,672 of 1,672 tests. These are recorded
 * because anyone else using Georgia’s RLGF `LOAD1` sheet will hit them.
 *
 * MECHANISM: `LOAD1` is a formula layer over the printed Page sheets. Where a
 * form row was renumbered or moved, the reference snapped to `#REF!` and its
 * NEIGHBOUR’s formula picked up the displaced value — so a real dollar amount
 * is attached to the WRONG UCOA account.
 *
 * ⚠⚠ THE SUBTOTALS STILL TIE. `LOAD1`'s `TTL_*` cells remain correct even where
 * its line items are wrong, so **a control-total check passes over misattributed
 * detail**. Three of the cases below disturb no subtotal at all. Subtotal ties
 * are NECESSARY BUT DEMONSTRABLY NOT SUFFICIENT for this source.
 *
 * ⚠ A naive reader sees these as SMALL PLAUSIBLE NUMBERS, not as errors: in the
 * raw .xls an error cell’s "value" is its error CODE, so `#REF!` reads as the
 * integer **23**. That is how this hid until an independent audit named it.
 */
export const GA_EXTRACT_DEFECTS = Object.freeze([
  { entity: 'Baldwin County', fiscalYear: 2017, section: '3A', refCell: '34_2500',
    displacedTo: '34_2510', amount: 563954.00, label: 'Public Safety - E-911 Fees',
    droppedAmount: 69398.72, breaksSubtotal: true },
  { entity: 'Milledgeville', fiscalYear: 2023, section: '1C', refCell: '31_4200A',
    displacedTo: '31_4200B', amount: 458391.85, label: 'Alcoholic Beverage Excise Taxes - Beer & Wine',
    droppedAmount: 163437.00, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '5B', refCell: '2150A',
    displacedTo: '2100A', amount: 2487618.71, label: 'Judicial Admin. - Superior Court',
    droppedAmount: 0, breaksSubtotal: false },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '5B', refCell: '2300C/2400C',
    displacedTo: '2300B/2400B', amount: 57140.20, label: 'State Court + Magistrate Court, machinery column',
    droppedAmount: 0, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '5C', refCell: '3326A',
    displacedTo: '3226A', amount: 18130069.97, label: 'Jail Operations',
    droppedAmount: 0, breaksSubtotal: false,
    note: '⚠ THE LARGEST: $18.13M of jail spending filed under "Prisoner Custody". '
      + 'Disturbs no subtotal — invisible to a control-total check.' },
  { entity: 'Macon-Bibb County', fiscalYear: 2020, section: '1D', refCell: '32_3100',
    displacedTo: '32_3900', amount: 10300.00, label: 'Regulatory Building Permits / Inspection Fees',
    droppedAmount: 0, breaksSubtotal: false },
  { entity: 'Macon-Bibb County', fiscalYear: 2021, section: '2', refCell: '33_1000C',
    displacedTo: '33_6103C', amount: 475901.28, label: 'Crime and Corrections Grants (federal)',
    droppedAmount: 475901.28, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2022, section: '2', refCell: '33_1000C',
    displacedTo: '33_6103C', amount: 524257.00, label: 'Crime and Corrections Grants (federal)',
    droppedAmount: 524257.00, breaksSubtotal: true },
  { entity: 'Macon-Bibb County', fiscalYear: 2023, section: '2', refCell: '33_1000C',
    displacedTo: '33_6103C', amount: 793967.00, label: 'Crime and Corrections Grants (federal)',
    droppedAmount: 793967.00, breaksSubtotal: true },
  // ── wave 2 ───────────────────────────────────────────────────────────────
  // ⚠⚠ THE ONLY ONE WHOSE PRINTED TOTAL ALSO BROKE. Every entry above leaves
  // the printed form intact, which is why "read the page" rescued them. Here
  // the same editing gesture shortened the page's own SUM range too, so this
  // row has a GA_FORM_TOTAL_DEFECTS entry as well — and it is the reason that
  // register had to exist at all.
  { entity: 'DeKalb County', fiscalYear: 2020, section: '5B', refCell: '2200A',
    displacedTo: '2800A', amount: 20335770.45, label: 'District Attorney',
    droppedAmount: 9479440.83, breaksSubtotal: true,
    note: '⚠ 2800A is a tRef3d pointing at Page 3 row 33 (the DISTRICT ATTORNEY\'s '
      + 'row), not row 42. So the DA\'s figure appears TWICE in the extract and the '
      + 'Public Defender\'s $9,479,440.83 is carried by no LOAD1 key at all. '
      + 'See GA_FORM_TOTAL_DEFECTS: the printed Total Section 5B is short by that '
      + 'same amount, so this filing loads from its line items.' },
]);

/**
 * ── FLAG 3: the PRINTED FORM's own total contradicts its own line items ────
 *
 * ⚠⚠ THIS IS THE EXCEPTION TO "THE PRINTED FORM IS AUTHORITATIVE", INSIDE THE
 * LOADED SCOPE. Flag 2's header says TT reads the printed form because it
 * reconciles where `LOAD1` does not. The Macon-Bibb FY2016 Part XII entry in
 * GA_OUT_OF_SCOPE_FINDINGS already showed a printed total that was wrong — but
 * that was Part XII, outside the loaded trees. These entries are inside
 * Parts I-V, so "prefer the printed page" is now measured as a strong rule with
 * named exceptions rather than a law.
 *
 * MECHANISM: the section's printed `Total Section` cell is a live SUM formula
 * whose RANGE was never extended when a line was added to the form, so the
 * total silently omits its own last row(s). The float tail on the stored result
 * (`76597267.89000002`) is the signature of a computed sum, not a typed
 * constant.
 *
 * ⚠⚠ WHAT TT LOADS, AND WHY. The LINE ITEMS load; the form's broken total does
 * not. Both figures are the government's, and the document contradicts itself —
 * so this is NOT the Milledgeville case (a verified figure that merely looks
 * wrong) and NOT a read-fidelity failure (we reproduce both numbers exactly).
 * When a document disagrees with itself, the sum of its own detail is the
 * better reading, and BOTH numbers are recorded here so the choice is visible
 * and reversible. Nothing is hidden: the omitted line is published money.
 *
 * ⚠ THE GATE IS NOT WEAKENED. `loadGeorgiaRLGF.mjs` still refuses any filing
 * whose sections do not tie, UNLESS an entry below pins ALL THREE of the
 * form's total, the items' total and the shortfall to the cent. A defect of a
 * different size, in a different section, or in a different year still refuses.
 */
export const GA_FORM_TOTAL_DEFECTS = Object.freeze([
  {
    id: 'long-fy2022-5a-total-omits-legislative',
    cicoid: '1091091',
    entity: 'Long County',
    state: 'GA',
    fiscalYear: 2022,
    dataset: 'operating',
    section: '5A',
    sectionLabel: 'General Administration',
    // All three are pinned by the loader. A mismatch in any of them refuses.
    formTotal: 2832877.00,
    itemsTotal: 3228935.00,
    shortfall: 396058.00,
    omittedCode: '1100',
    omittedLabel: 'Administration Support - Legislative',
    loaded: 'items',
    what:
      'The DeKalb FY2020 mechanism in a second government, MIRRORED. Long County FY2022, '
      + 'Part V Section A: the printed "Total Section 5A" reads $2,832,877 while its own '
      + 'line rows sum to $3,228,935. The difference, $396,058, is exactly the FIRST line '
      + 'of the section — Administration Support - Legislative (UCOA 1100). DeKalb\'s total '
      + 'stopped one row EARLY; this one starts one row LATE. The Part V grand total sums '
      + 'the section totals, so it inherits this shortfall and nothing more: $12,487,514 '
      + 'printed against $12,883,572 of line rows.',
    verifiedBecause: [
      '⚠⚠ THE REAPPEARANCE TEST PASSES, AND IT IS THE WHOLE CASE. Section 5A ties to the '
        + 'CENT in all nine of Long County\'s other filings — FY2016-2021 and FY2023-2025, '
        + 'difference $0.00 every time. FY2022 is the sole year that does not tie.',
      '⚠⚠ AND LINE 1100 IS $0.00 IN EVERY ONE OF THOSE NINE YEARS. A total whose range '
        + 'omits row 1100 produces an IDENTICAL printed result in all nine, and breaks only '
        + 'in the one year the county reported money on that line. That is the same reason '
        + 'DeKalb\'s defect was invisible — there the sibling columns were all $0.00 — and '
        + 'it is why this is a long-standing range error surfacing once, not a new mistake.',
      'Reproduced to the cent by arithmetic on the printed page: the sixteen line rows '
        + 'BELOW 1100 sum to 117,784 + 242,566 + 194,040 + 62,396 + 379,936 + 256,487 + '
        + '120,567 + 84,431 + 1,374,670 = $2,832,877, which is the printed total exactly. '
        + 'The total is not approximately short; it is precisely the section minus its '
        + 'first row.',
      '⚠ DCA\'s LOAD1 extract breaks a SECOND way in the same section, the same pairing '
        + 'DeKalb showed: the 1100 key carries $117,784 — the value belonging to 1300 '
        + '(Administration Support - Executive) — and the 1300 key is a #REF!. So the '
        + 'extract is row-shifted exactly where the printed total is range-shifted, which '
        + 'is one editing gesture leaving two fingerprints, not two coincidences.',
      'TT reads the PRINTED PAGE, so its tree carries the correct $396,058 on 1100 and the '
        + 'correct $117,784 on 1300. The cross-check against LOAD1 reports both '
        + 'discrepancies rather than silently preferring one source.',
      '⚠ Checked against the county\'s own audited statements, which are a DIFFERENT '
        + 'document from a DIFFERENT publisher: three of this section\'s other RLGF line '
        + 'values appear in them verbatim — 194,040 (financial administration), 379,936 '
        + '(tax commissioner) and 256,487 (tax assessor) — so TT is reading these cells '
        + 'faithfully. ⚠ Those three match the audited FINAL BUDGET column rather than the '
        + 'ACTUAL column, while others (government buildings 1,374,670 against 1,407,377 '
        + 'actual) sit nearer actual. That is recorded as an OBSERVATION and nothing is '
        + 'concluded from it: three matches do not establish what the preparer did, and '
        + 'this defect does not depend on the answer.',
    ],
    benignExplanations: [
      'A line was inserted at the top of Section A on the form at some point and the '
        + 'total\'s SUM range was never extended upwards to cover it. Nothing suggests '
        + 'anything but ordinary spreadsheet maintenance, and it UNDERSTATES the county\'s '
        + 'own reported spending rather than inflating it.',
    ],
    corroboration:
      'Three independent lines of evidence, two of them outside this filing. (1) The '
      + 'county\'s OWN AUDITED STATEMENTS, obtained from a different publisher by a '
      + 'different route — Long County, Georgia FY2022 Single Audit, Federal Audit '
      + 'Clearinghouse report 2022-06-CENSUS-0000212627 — carry a material General Fund '
      + '"Legislative" line of $611,550 actual against a $612,011 final budget. The line '
      + 'the printed total omits is REAL, published money, independently confirmed, not a '
      + 'phantom cell. (2) Against that same audited statement the ITEMS reading is the '
      + 'closer of the two: audited total general government is $3,871,520, which the '
      + 'line items reach 83.4% of and the printed total only 73.2% of — so the reading '
      + 'TT takes is the one better supported by an independent document, not merely the '
      + 'larger one. (3) Long\'s own other nine filings tie to the cent with line 1100 at '
      + '$0.00 throughout, which is a separate argument from either of the above.',
    corroborationSources: [
      {
        source_name: 'Long County, Georgia — FY2022 Single Audit (General Fund statement of '
          + 'revenues, expenditures and changes in fund balances — budget and actual, page 22)',
        source_url: 'https://app.fac.gov/dissemination/report/pdf/2022-06-CENSUS-0000212627',
        source_date: '2026-10-17',
      },
    ],
    // ⚠ READING THAT PDF NEEDS `pdftotext -table`. Plain `-layout` returns the page
    // with the label column shifted several rows against the number column, so
    // "Risk management" lines up with Financial administration's figure and every
    // reading off it is silently wrong — the WA SAO / Atlanta FY2025 defect class
    // again. The misalignment is invisible unless a known value is checked.
  },
  {
    id: 'dekalb-fy2020-5b-total-omits-public-defender',
    cicoid: '1044044',
    entity: 'DeKalb County',
    state: 'GA',
    fiscalYear: 2020,
    dataset: 'operating',
    section: '5B',
    sectionLabel: 'Judicial',
    // All three are pinned by the loader. A mismatch in any of them refuses.
    formTotal: 76597267.89,
    itemsTotal: 86076708.72,
    shortfall: 9479440.83,
    omittedCode: '2800',
    omittedLabel: 'Public Defender Administration',
    loaded: 'items',
    what:
      'DeKalb County FY2020, Page 3, Part V Section B (Judicial): the printed '
      + '"Total Section 5B" row reads $76,597,267.89 while the FOURTEEN line rows '
      + 'printed directly above it sum to $86,076,708.72. The total omits exactly '
      + 'its own last line, Public Defender Administration (UCOA 2800), '
      + '$9,479,440.83. The Part V grand total correctly sums the SECTION totals, '
      + 'so it inherits the shortfall rather than compounding it: $1,056,796,376.16 '
      + 'printed against $1,066,275,816.99 of line rows, 0.889% low.',
    verifiedBecause: [
      '⚠⚠ THE STORED FORMULA SAYS SO — this does not rest on a subset-sum search. '
        + 'Disassembling the BIFF8 token stream of the Total Section 5B row gives '
        + 'column (a) as tArea (29,2)..(41,2) = SUM(C30:C42), while its OWN sibling '
        + 'columns (b), (c) and (d) are (29,c)..(42,c) = SUM(D30:D43). Column (a) '
        + 'stops one row short. In FY2016-2019 and FY2021-2023 all four columns '
        + 'span (29,c)..(42,c); FY2020 column (a) is the sole outlier in eight years.',
      '⚠ It is invisible on the printed page BECAUSE columns (b), (c) and (d) are '
        + 'all $0.00 — the three correct ranges and the one short range produce the '
        + 'same visible result, so nothing looks out of place.',
      'Reproduced to the cent from the printed page itself: rows 30-43 of "Page 3" '
        + 'sum to 86,076,708.72 against a printed total row of 76,597,267.89, a '
        + 'difference of 9,479,440.83 = the Public Defender line exactly.',
      'The stored total is 76597267.89000002 — a float tail only a live SUM '
        + 'produces, consistent with a formula over a range, not a keyed constant.',
      'DCA\'s LOAD1 extract breaks a second way from the same editing gesture: '
        + '2200A (District Attorney) is a tRefErr3d #REF! token, and 2800A is a '
        + 'tRef3d pointing at Page 3 ROW 33 — the District Attorney\'s row, not the '
        + 'Public Defender\'s row 42. So the Public Defender\'s $9,479,440.83 is '
        + 'carried by NO LOAD1 key at all and the DA\'s figure appears twice. '
        + 'Summing the broken extract reproduces the printed total EXACTLY: '
        + '56,261,497.44 + 20,335,770.45 = 76,597,267.89.',
      '⚠ In the raw .xls the #REF! cell\'s stored "value" reads back as the integer '
        + '23 — the error CODE. A value-only read sees a small plausible number; '
        + 'only a cell-TYPE check catches it.',
      'Independently reproduced in both representations: all 10,750 numeric cells '
        + 'across Page 3, Page 4 and LOAD1 for all eight DeKalb years agree exactly '
        + 'between the publisher\'s .xls and TT\'s .xlsx conversion, and the LOAD1 '
        + 'Part V key set is a perfect bijection with the page key set in every '
        + 'year — so no line row was dropped by either parser.',
      '223 of the 224 section-column checks across DeKalb\'s eight filings (7 '
        + 'sections x 4 object columns x 8 years) tie exactly. This is the only one '
        + 'that does not.',
      'EXTERNAL: DeKalb County\'s own 2020 CAFR (p. 36, General Fund, budget basis, '
        + 'stated in thousands) publishes Public defender actual $11,038,000 and '
        + 'District attorney actual $19,111,000, its twelve office lines summing '
        + 'exactly to the published total. The Public Defender is a real, material, '
        + 'recurring line — $9,447K (2018), $10,355K (2019), $11,038K (2020), '
        + '$9,979K (2021), $12,447K (2022) — so a Judicial total that excludes it '
        + 'is understated, not merely differently scoped.',
      'EXTERNAL, magnitude: DeKalb reports its court function as "Civil and '
        + 'criminal court system", which uniquely INCLUDES the Sheriff\'s Office '
        + '($85,624K) and Medical Examiner ($4,712K). Removing those from the '
        + 'FY2020 General Fund actual leaves $90,354K — near the RLGF line-item '
        + 'sum of $86.08M and far from the broken $76.60M.',
    ],
    // ⚠ NO ALLEGATION. This is routine spreadsheet mechanics on a form that is
    // revised year to year, and it understates a figure rather than inflating it.
    benignExplanations: [
      'A SUM range that was not extended, or was re-typed or dragged by hand in '
        + 'ONE column while the other three kept the original — the single most '
        + 'common spreadsheet defect there is.',
      'A row cut, deleted or dragged on Page 3 while the form was being filled in. '
        + 'Formulas pointing AT a moved row either follow it or collapse to #REF!, '
        + 'and FY2020 shows exactly one of each (2800A followed a row to position '
        + '33, 2200A collapsed). ONE editing gesture explains the shortened range, '
        + 'the orphaned reference and the shifted reference together.',
      'The same fingerprint appears in the Part IV block on Page 2 of the same '
        + 'workbook, suggesting one tidying pass touched both pages of that year.',
      '⚠ It UNDERSTATES a figure rather than inflating one, and the other seven '
        + 'years of the same form are internally flawless.',
    ],
    corroboration:
      '2 independent agents, neutral prompts, raw sources, neither told the '
      + 'conclusion nor shown the other\'s work — one auditing the workbooks\' '
      + 'internal arithmetic across all eight DeKalb filings in Decimal and '
      + 'disassembling the BIFF8 formula tokens, one seeking DeKalb\'s own '
      + 'published judicial figures from the county\'s CAFRs. They converged. '
      + 'Chris\'s standing requirement for any flag of this nature.',
  },
  // ── MUNICIPALITIES (statewide sweep, 2026-10-18) ──────────────────────────
  //
  // ⚠ A THIRD SHAPE OF THE SAME MECHANISM. DeKalb's FY2020 total stopped one
  // row EARLY; Long's FY2022 started one row LATE; these two print $0.00 for a
  // whole section whose own line items carry money. In each case the printed
  // total contradicts the printed detail, and in each case TT loads the detail.
  {
    id: 'hawkinsville-fy2020-5e-total-is-zero',
    cicoid: '2116001',
    entity: 'Hawkinsville',
    state: 'GA',
    fiscalYear: 2020,
    dataset: 'operating',
    section: '5E',
    sectionLabel: 'Health and Welfare',
    formTotal: 0,
    itemsTotal: 5700,
    shortfall: 5700,
    omittedCode: null,
    omittedLabel: 'the whole section',
    loaded: 'items',
    what:
      'Hawkinsville FY2020, Part V Section E: the printed "Total Section 5E" reads $0.00 '
      + 'while the section\'s own line rows carry $5,700. The same $5,700 appears in this '
      + 'section in FY2017, FY2018, FY2019, FY2021 and FY2022 — and in every one of those '
      + 'years the printed total carries it and the section ties. FY2020 is the only year '
      + 'the printed total reads zero.',
    verifiedBecause: [
      '⚠⚠ THE REAPPEARANCE TEST PASSES. Nine of Hawkinsville\'s ten filings tie 18/18. '
        + 'FY2020 is the sole year that does not, and it fails in two sections at once — '
        + 'one editing pass, not two coincidences.',
      'The identical $5,700 line is present and correctly totalled in five other years, so '
        + 'the figure is the city\'s own recurring one and not an artefact of FY2020.',
      'The Part V grand total is short by $266,273.89, which is exactly 5E\'s $5,700 plus '
        + '5F\'s $260,573.89 — the grand total sums the SECTION totals and so inherits both '
        + 'shortfalls and nothing else.',
    ],
    benignExplanations: [
      'The section total\'s formula range was cleared or overwritten during one year\'s '
        + 'form maintenance. It UNDERSTATES the city\'s own reported spending.',
    ],
    corroboration:
      'Corroborated against an INDEPENDENT document from a different publisher — the city\'s '
      + 'own federally filed audited statements (Federal Audit Clearinghouse report '
      + '2020-06-CENSUS-0000218217) — together with the entity\'s own nine other filings. '
      + 'See the FY2020 5F entry for the audited figure that settles the direction.',
  },
  {
    id: 'hawkinsville-fy2020-5f-total-is-zero',
    cicoid: '2116001',
    entity: 'Hawkinsville',
    state: 'GA',
    fiscalYear: 2020,
    dataset: 'operating',
    section: '5F',
    sectionLabel: 'Culture and Recreation',
    formTotal: 0,
    itemsTotal: 260573.89,
    shortfall: 260573.89,
    omittedCode: null,
    omittedLabel: 'the whole section',
    loaded: 'items',
    what:
      'The same failure in the same filing, one section along: the printed "Total Section '
      + '5F" reads $0.00 while its own line rows carry $260,573.89. Hawkinsville reports '
      + 'culture-and-recreation spending in every other year — $142,652 (FY2016), $102,250 '
      + '(FY2017), $94,500 (FY2018), $108,750 (FY2019), $328,982 (FY2021) — and the printed '
      + 'total carries it in all of them.',
    verifiedBecause: [
      '⚠⚠ THE CITY\'S OWN AUDITED STATEMENTS SAY IT IS NOT ZERO. Hawkinsville\'s FY2020 '
        + 'Statement of Activities reports Culture and recreation expenses of $117,000 '
        + 'against charges for services of $3,352 and grants of $108,567. A printed total '
        + 'of $0.00 contradicts the city\'s own audited accounts. ⚠ The audited figure is '
        + 'government-wide expense and the RLGF figure is all-funds expenditure, so the two '
        + 'are NOT expected to match — what the audit establishes is that the function was '
        + 'not zero, which is the whole question here.',
      'Nine of ten filings tie 18/18, and this section carries money in all ten.',
      'The Part V grand total\'s shortfall equals 5E + 5F exactly, so nothing else moved.',
    ],
    benignExplanations: [
      'One year\'s form maintenance cleared two adjacent section totals. It understates the '
        + 'city\'s own reported spending rather than inflating it.',
    ],
    corroboration:
      'Two independent lines, one of them outside this publisher entirely: the city\'s own '
      + 'federally filed audited statements (Federal Audit Clearinghouse report '
      + '2020-06-CENSUS-0000218217, Statement of Activities) report $117,000 of culture and '
      + 'recreation expense for FY2020; and Hawkinsville\'s own nine other filings all tie '
      + 'with this section populated.',
  },
]);

/** Look up a form-total defect. All four coordinates must match. */
export function formTotalDefect(cicoid, fiscalYear, section) {
  return GA_FORM_TOTAL_DEFECTS.find(
    (d) => d.cicoid === String(cicoid)
      && d.fiscalYear === Number(fiscalYear)
      && d.section === section,
  ) || null;
}

/**
 * ── Recorded but OUTSIDE the loaded trees ──────────────────────────────────
 *
 * Kept so the FY2009-2015 follow-up and the statewide sweep inherit them rather
 * than rediscovering them.
 *
 * ⚠⚠ THE SECOND ENTRY QUALIFIES "THE PRINTED FORM IS AUTHORITATIVE". That claim
 * is measured and holds for Parts I-V — the loaded scope, 1,672/1,672. It does
 * NOT hold universally: on one filing the printed form's own total formula
 * contradicts its own printed caption. Verified directly, not taken on report.
 */
export const GA_OUT_OF_SCOPE_FINDINGS = Object.freeze([
  {
    what: 'Baldwin County FY2019 Part XII (cash and investments): $1,721,990 displaced '
      + 'from column (c) into column (b) by a #REF!.',
    why: 'Part XII is a balance-sheet table, not a revenue or expenditure flow. Not loaded.',
  },
  {
    what: 'Macon-Bibb FY2016 Part XII: the printed total row is captioned "TOTAL PART XII '
      + '(excl. Held Prev. Yr)" but its formula INCLUDES the prior-year row. Verified '
      + 'directly: TTL_12x == items + PY_x in all four columns (A, C, D, E). Aggregate '
      + 'overstatement $99,304,981. The same government\'s FY2017 filing computes it correctly.',
    why: 'Not loaded. ⚠ But it is the one measured case where THE PRINTED FORM ITSELF is '
      + 'wrong, so "prefer the printed page" is a finding about Parts I-V, not a law.',
  },
  {
    what: 'Macon-Bibb FY2016 carries 921 LOAD1 keys where every other filing has 924. '
      + 'Verified: the difference is exactly `_D4` lacking SF_ODC_A/B/C (other debt costs).',
    why: 'Resolves the "unexplained variant" follow-up from recon. _D4 is a debt schedule, '
      + 'outside the loaded trees, so the filing loads normally.',
  },
  {
    what: 'The pre-FY2016 workbooks carry 1,393 #REF! cells across their `Data` / '
      + '`Exportable Data` sheets and have no LOAD1 layer at all.',
    why: '⚠ A live hazard for the FY2009-2015 follow-up: that generation is MORE '
      + 'error-ridden than the one loaded here, not less.',
  },
  {
    what: 'Columbus-Muscogee carries 447 FY2016+ error cells, but every one is in a debt or '
      + 'attachment sheet (`Bonded Debt Schedules`, `Debt Schedule`). None in LOAD1 or Pages 1-6.',
    why: 'Its ten loaded years are clean in the audited surface — the one entity with no '
      + 'extract defect at all.',
  },
  // ── wave 2 (2026-10-17) ──────────────────────────────────────────────────
  {
    what: 'DeKalb FY2020 Part IV carries the SAME fingerprint as its Part V defect: LOAD1 '
      + 'key `34_4160` ("Sanitation Fees - Solid Waste Recycling Fees") is a tRefErr3d '
      + '#REF!, while its neighbour `34_4130` ("Sale of Recycled Materials") points at '
      + 'Page 2 row 63 — which IS the 34.4160 row ($310,830.06). Page 2 row 61, the real '
      + '34.4130, is blank. One key re-pointed at a neighbour, one orphaned.',
    why: 'Part IV is public utility / enterprise REVENUE, excluded from the loaded trees by '
      + 'the form\'s own scope statement. ⚠ Recorded because it corroborates that ONE '
      + 'editing pass touched both pages of that workbook, and because the FY2009-2015 '
      + 'follow-up and the statewide sweep will meet this shape again.',
  },
  {
    what: '⚠⚠ A LOAD1 PARSER TRAP: the sheet REUSES bare UCOA key names (`3200A`, `4400A`, '
      + '`5100A`, ...) in block `_E9`, which is PART X (intergovernmental expenditures, '
      + '`TTL_Part10`) — not Part V. A flat key->value dict over the whole sheet collides '
      + 'and manufactures roughly 12 spurious "LOAD1 says $0" mismatches per filing.',
    why: 'Not a defect in the source — a defect in any naive reader of it. TT already '
      + 'scopes lookups per block via SECTION_BLOCKS/scopedLookup, so it is immune; this '
      + 'is recorded for anyone else reading Georgia\'s LOAD1, and as the reason that '
      + 'scoping must never be flattened for convenience.',
  },
  {
    what: '✅ PROMOTED TO GA_FIGURE_FLAGS 2026-10-17 — the DeKalb FY2018 expenditure '
      + 'observation was corroborated by two independent agents and is now a recorded '
      + 'flag (`dekalb-fy2018-expenditure-side-is-about-one-twelfth`), together with the '
      + 'separate FY2017 utility omission it turned up.',
    why: '⭐ Kept as a POINTER, not deleted, because the sequence is the lesson: it was '
      + 'surfaced unprompted by an unrelated audit, held deliberately as an '
      + 'uncorroborated OBSERVATION that TT asserted nothing about, and only became a '
      + 'flag once two agents reached it independently. An observation and a flag are '
      + 'different things and the gap between them is where the discipline lives.',
  },
  {
    what: '✅ PROMOTED TO GA_FIGURE_FLAGS 2026-10-17 — the Fulton FY2021 observation was '
      + 'corroborated and is now `fulton-fy2021-confined-cluster-at-two-percent`. ⚠ It '
      + 'turned out NOT to be the "one-section hole" it was first described as: nine '
      + 'lines across six sections are affected, three of them small-but-non-zero at a '
      + 'shared ~2% and six at exact zero.',
    why: '⭐ Recorded as a correction, not deleted. The first description came from a '
      + 'passing mention and was wrong about the shape; the sweep that corroborated it '
      + 'was a BLIND ratio scan of every line, not a look at the line already suspected. '
      + 'An observation names something worth measuring — it does not describe it.',
  },
  {
    what: '⚠ Part VIII PERSONNEL is unreliable across this corpus. DeKalb reports $0 in '
      + 'all eight filings; Fulton reports $0 in FY2022 and FY2023 only (against ~$0.95bn '
      + 'implied by its own surrounding years) and ~3x its neighbours in FY2016.',
    why: 'Part VIII restates money already inside Part V, and is outside the loaded trees, '
      + 'so no loaded figure moves. ⚠ The form requires "0 or higher, do NOT leave blank", '
      + 'so a preparer without the payroll breakout satisfies validation by entering zero '
      + '— a $0 here means NOTHING WAS REPORTED, never that payroll was zero.',
  },
  {
    what: '✅ CORROBORATED 2026-10-17 — ⚠⚠ A ×1000 KEYING SLIP RECURS ACROSS THIS SOURCE, in '
      + 'TWO governments and FOUR places. A blind sweep of all 85 available filings found '
      + 'exactly four, every one a factor of 1,000: '
      + '(1) FULTON Part VII (enterprise capital assets) FY2023 AND FY2024; '
      + '(2) FULTON Part XIII (fund equity) FY2016; '
      + '(3) ATLANTA Part XI column (e) "interest paid", Sections A and C only, FY2021; '
      + '(4) ATLANTA Part XIII (fund equity) FY2025, 5 of 10 cells. DeKalb is clean.',
    why: '⭐⭐ THE MECHANISM IS CONFIRMED AND IT IS STRUCTURAL: ALL THREE GOVERNMENTS PRINT '
      + 'THEIR ACFRs IN THOUSANDS ("in thousands of dollars" on every statement, every '
      + 'year) while the RLGF form instructs "enter dollar amounts". A preparer reading '
      + 'the ACFR column and forgetting to multiply by 1,000 produces exactly this. '
      + 'CONFIRMED BY EXACT DIGIT MATCH against the audited statements: Fulton Part VII '
      + 'FY2024 reports 1,542,837 and Fulton\'s FY2024 ACFR Note 7 gives Water & Sewerage '
      + 'net book value of 1,542,837 THOUSAND; Fulton Part XIII FY2016 reports 124,580 and '
      + '682,414 against ACFR GF unassigned 124,580K and net investment in capital assets '
      + '682,414K; Atlanta Part XIII FY2025 reports 14,481 / 1,201 against ACFR assigned '
      + '14,481K / committed 1,201K. '
      + '⚠⚠ Fulton Part VII is proved a SECOND way with no external source at all: the '
      + 'form is a ROLL-FORWARD, and FY2023\'s beginning balance equals FY2022\'s ending '
      + 'balance digit-for-digit with three zeros dropped on ALL TEN populated rows. '
      + 'Atlanta Part XI is proved by an IMPLIED INTEREST RATE of 0.0033% on $6.04bn of '
      + 'revenue bonds (corrected: 3.28%, against 4.44% and 4.03% either side), with '
      + 'Section B on the same page as a clean control at 4.292%.',
  },
  {
    what: '⭐⭐ THE NULL RESULT THAT MATTERS MORE: **NO SCALE BREAK EXISTS ANYWHERE IN PARTS '
      + 'I-VI** — the revenue and expenditure FLOWS — in any of the 7 governments, any '
      + 'year, in EITHER form edition. Three independent screens (part-level aggregate, '
      + 'per-line YoY ratio, and an implied-interest-rate test) all came back empty there.',
    why: '⚠⚠ TT LOADS PARTS I-III AND PART V. So NOT ONE LOADED FIGURE IS AFFECTED by the '
      + 'keying slips above, and no reader-facing flag is warranted — this is a '
      + 'source-quality finding for the FY2009-2015 follow-up and the statewide sweep, '
      + 'not a defect in TT\'s data. ⭐ Recording the null result explicitly matters as '
      + 'much as recording the breaks: without it a later session re-opens the question.',
  },
  {
    what: '⚠ DEKALB RESTATED ITS FY2020 CAPITAL ASSETS DOWNWARD BY ~$285.7M in the FY2021 '
      + 'ACFR, after a comprehensive capital-asset inventory (FY2021 Note 5: business-type '
      + 'cost restated 3,520,830K -> 3,340,511K, book value 2,469,299K -> 2,183,642K). '
      + 'FY2016-2020 are on the original basis, FY2021+ on the restated one.',
    why: 'Capital assets are outside the loaded trees, so no loaded figure moves. ⚠ But a '
      + 'DeKalb capital-asset series spanning 2020/2021 has a genuine BASIS BREAK in it, '
      + 'and it is the county\'s own restatement rather than a filing defect. Recorded '
      + 'before anyone builds that series.',
  },
  {
    what: '⚠⚠ TWO HAZARDS REACHING ATLANTA\'S OWN ACFRs, both met head-on 2026-10-17. '
      + '(1) atlantaga.gov returns HTTP 403 from its Akamai edge to curl, PowerShell, '
      + 'plain fetch AND a headless same-origin fetch(), while serving its index pages '
      + 'normally — the document only came back by DRIVING A REAL BROWSER AND CLICKING '
      + 'THE LINK. The Wayback Machine has no copy. '
      + '(2) ⚠⚠ THE FY2025 ACFR HAS A PARTLY BROKEN TEXT LAYER: roughly half its pages '
      + 'extract as a character-shifted cipher AND THE DIGITS DROP OUT ENTIRELY, so an '
      + 'extractor returns prose-shaped garbage with no numbers.',
    why: '⭐ The text-layer defect is the WA SAO class in a new place — a ciphered page '
      + 'yields a silently wrong read, not an obviously empty one. The fix used here was '
      + 'to RENDER THE PAGE TO AN IMAGE and read the printed table rather than trust the '
      + 'text layer. FY2024\'s layer is clean, so it is per-document, not per-publisher. '
      + '⚠ The Federal Audit Clearinghouse carried an identical FY2024 copy and is the '
      + 'better route where it has the year.',
  },
  {
    what: '✅ PROMOTED TO GA_FIGURE_FLAGS 2026-10-17 — the Fulton FY2017/FY2018 property-tax '
      + 'timing shift was corroborated and is now '
      + '`fulton-fy2017-fy2018-property-tax-timing`, carrying severity `not-comparable`.',
    why: '⭐⭐ THE CASE THAT PROVED THE REAPPEARANCE TEST EARNS ITS KEEP. A ratio sweep alone '
      + 'flagged FY2017 at 0.592 of its neighbours — indistinguishable from the DeKalb and '
      + 'Fulton DEFECTS — and only checking whether the money turns up elsewhere showed it '
      + 'was a shift, not a loss. The external leg then found the Superior Court order that '
      + 'caused it. ⭐ It also forced a THIRD severity: the figures here are CORRECT and '
      + 'only the comparison breaks, so dressing it as a warning would tell the reader '
      + 'something false AND impute a fault to a government that has none.',
  },
  {
    what: '⚠ NOT CORROBORATED. Further single-chain observations from the Fulton sweep, '
      + 'all inside the loaded scope: FY2023 line 1595 "General Administration Fees" is '
      + '$64,285,615 against $0 in the three prior years and $4.2M in FY2024, and is '
      + 'ADDITIVE (no other line drops to offset it); FY2023 line 3200 Police Protection '
      + 'is $1,333,171 against $9.7M and $12.8M either side; Section 1D licences/permits '
      + 'is exactly $0 for FY2018-FY2021 then $19.7M in FY2022. Several revenue categories '
      + 'were also re-coded mid-series (sewer into water charges; business taxes into '
      + 'general business licences; court fees into fines and forfeitures), so revenue '
      + 'CATEGORIES are not comparable year-over-year even where totals are.',
    why: 'Recorded so a later session inherits them rather than rediscovering them. Each '
      + 'needs the two-agent treatment before TT asserts anything. ⚠ The re-coding cases '
      + 'in particular are probably NOT defects — they are comparability facts.',
  },
  {
    what: '⚠ Fulton FY2021 Part VI column (f) reports $33,693 while the schedule the SAME '
      + 'preparer attached to the SAME workbook sums to $11,090,369 (Wolf Creek $10,000 + '
      + 'Board of Health $11,080,369) — 0.30% of its own attachment. The equivalent '
      + 'schedules tie to the dollar in FY2018, FY2019 and FY2020.',
    why: 'Part VI is enterprise system expense, excluded from the loaded trees by the '
      + 'form\'s own scope statement. ⚠ Recorded because it is a SAME-FILING '
      + 'CONTRADICTION needing no external source, and because it corroborates that '
      + 'FY2021 is the year Fulton\'s return went wrong. The same filing also leaves '
      + 'Part XIV\'s dependent-entities flag blank while its attachment lists three.',
  },
  {
    what: '⚠⚠ THE TWO ABSORBED COUNTIES ARE NOT LOADED FOR FY2009-2015: Bibb County '
      + '(1011011, FY2009-2013, 5 filings) and Echols County (1050050, FY2009 — its FY2010 '
      + 'is separately REFUSED as a double-count). Both parse and oracle cleanly; neither '
      + 'has a registry entry, because the statewide registry was built from FY2016-2025 and '
      + 'by then both governments had been consolidated out of existence.',
    why:
      '⚠ NOT A PARSING GAP — AN ENTITY-MODELLING DECISION THAT IS ITS OWN PIECE OF WORK, and '
      + 'the two halves need OPPOSITE answers, which is why neither is guessed here. '
      + '⭐ ECHOLS IS THE SAME GOVERNMENT TWICE. Its FY2010 county-prefix filing reports '
      + 'operating $2,679,270 — IDENTICAL to the Echols County CG FY2010 filing already '
      + 'loaded under 3050050. Echols has no municipalities, so the unified government covers '
      + 'the same territory and the same money; FY2009 is a genuine continuation of the series '
      + 'TT already shows. Loading it needs an ALIAS (two CICOIDs, one entity), which '
      + 'GA_ALL_ENTITIES currently forbids by assertion — and that assertion is load-bearing '
      + '(project_sync_city_budget_not_source_safe: a second entity would DUPLICATE rows '
      + 'rather than collide visibly). '
      + '⚠⚠ BIBB IS A DIFFERENT GOVERNMENT. Bibb County alone reports $92.0M-$115.7M of '
      + 'operating across FY2009-2013; Macon-Bibb, which merged the county with the CITY of '
      + 'Macon, reports $195.3M in FY2016. Appending one series to the other would show a '
      + '~1.7x step that reads as growth and is a change of scope — the Fulton FY2017/FY2018 '
      + 'reader-distortion shape, where 92% of an apparent jump was not growth at all. The '
      + 'honest options are a SEPARATE `Bibb County` entity (its own county government, which '
      + 'genuinely existed until 2014) or one series carrying a not-comparable flag at the '
      + 'boundary. That choice belongs to whoever decides what a reader should see, not to a '
      + '1,034-filing sweep. '
      + '⚠ The six filings are fetched, converted and verified; nothing needs re-measuring. '
      + 'The loader reports them as `CICOID … is in no registry — not loaded` on every run, '
      + 'so they cannot be forgotten silently.',
  },
  {
    what: '⚠⚠ SEVEN MUNICIPALITIES WITH FY2009-2015 FILINGS HAVE NO REGISTRY ENTRY, so 37 '
      + 'filings are not loaded: Helena (2134001, FY2009-2014), McRae (2134004, FY2009-2014), '
      + 'Macon City (2011001, FY2009-2013), Payne City (2011002, FY2009-2013), Riverside Town '
      + '(2035008, FY2009-2015), Sunny Side City (2126003, FY2009-2015) and Ranger Town '
      + '(2064902, FY2009).',
    why:
      'ONE CAUSE, read out of buildGaStatewideEntities.mjs rather than inferred: the builder '
      + 'refuses a government with status `no-population` when "Census Vintage 2024 has no GA '
      + 'municipality named X". TT types an entity from the census — entityType AND population '
      + 'both — and a 2024 vintage cannot name a government that stopped existing before 2024. '
      + '⭐ FOUR OF THE SEVEN DISSOLVED INTO SUCCESSORS THAT TT ALREADY CARRIES, and none of '
      + 'them overlaps its successor by even one year: McRae and Helena both stop at FY2014 and '
      + 'McRae-Helena City (2134007) starts at FY2015; Macon City and Payne City both stop at '
      + 'FY2013 and Macon-Bibb County (3011011) starts at FY2014. So there is no double-count '
      + 'to refuse here — only a government TT has no way to TYPE. '
      + '⚠ The other three still exist: Ranger and Sunny Side file again in FY2017+ and FY2016+ '
      + 'and were refused by the FY2016-2025 municipal sweep for this same census reason '
      + '(recorded there as "Ranger and Sunny Side have NO census row — refused, not guessed"), '
      + 'and Riverside Town files only FY2009-2015. Loading them now would mean typing a '
      + 'government the census does not describe, which is the one thing that sweep refused to '
      + 'do. ⚠ Doing it consistently is a single coherent follow-up — a way to type a '
      + 'government the current census vintage cannot name — and NOT a Georgia-only problem.',
  },
]);

/**
 * ── FLAG 5: the filing's own `FYEmonth` disagrees ACROSS an entity's series ──
 *
 * ⚠⚠ A CASE NEITHER EARLIER WAVE MET. Baldwin and Atlanta both changed their
 * fiscal calendars, but each change sat ENTIRELY BEFORE the FY2016 load floor,
 * so a single `fiscalYearStartMonth` per entity was always enough. Sweeping the
 * 151 filing counties found 9 governments whose own filings disagree INSIDE the
 * window — and the two causes need opposite handling.
 *
 * A REAL CALENDAR CHANGE is representable: `treasury_sync_city_budget` takes
 * `p_fiscal_year_start_month` PER FILING, so TT's data can already hold a
 * different month per year. Only the registry was single-valued. Those entities
 * carry `monthByYear` for the years on the far side of the change.
 *
 * A ONE-YEAR OUTLIER inside an otherwise stable series is a keying slip in the
 * form. It is handled the way the printed-total defects are: the document
 * disagrees with itself, the consensus of its own series is the better reading,
 * and BOTH months are recorded here so the choice stays visible and reversible.
 *
 * ⚠⚠ THE GATE IS NOT WEAKENED. `loadGeorgiaRLGF.resolveMonth()` still refuses
 * any filing whose `FYEmonth` matches neither the registry's month nor a
 * `monthByYear` entry, UNLESS an entry below pins BOTH the month the form
 * printed AND the month TT writes instead. A slip of a different size, in a
 * different year, or on a different entity matches nothing and still refuses.
 *
 * ⚠ THE MONTH MOVES NO DOLLAR, which is exactly why it needs this discipline:
 * every tie test passes at $0 whatever is written here
 * (`project_fysm_column_default_one_defect` is 18,700 rows of that lesson).
 */

export const GA_FYE_MONTH_CHANGES = Object.freeze([
  {
    id: 'barrow-fy2017-september-to-june',
    cicoid: '1007007',
    entity: 'Barrow County',
    month: 7,
    monthByYear: Object.freeze({ 2016: 10 }),
    // ⭐ THE ONLY ONE OF THE THREE THE FORM DECLARES ITSELF.
    declaredBy: 'the FY2017 filing reports MosRptd = 9 and MoChng = Yes — a 9-month '
      + 'transition stub, the same shape as Baldwin\'s 2010 and Atlanta\'s 2006 stubs',
    corroboration: 'FAC reports Barrow County at month 10 for 1998-2016 and at month 7 '
      + 'for 2019 and 2024 — both sides of the change, in the right order.',
  },
  {
    id: 'jenkins-fy2020-june-to-september',
    cicoid: '1082082',
    entity: 'Jenkins County',
    month: 10,
    monthByYear: Object.freeze({ 2016: 7, 2017: 7, 2018: 7, 2019: 7 }),
    // ⚠⚠ THE TRANSITION YEAR IS THE ONE FILE THAT CANNOT BE READ. Jenkins FY2020
    // is DCA's encrypted workbook (see xlsToXlsx.py), so the stub that would
    // declare this change the way Barrow's does is unreadable. The change is
    // taken from the two sustained runs either side of it, not from a guess
    // about the missing year — and FY2020 itself is absent from the load.
    declaredBy: null,
    corroboration: 'FAC reports Jenkins County at month 7 for 2007, 2012 and 2015 and at '
      + 'month 10 for 2023 — both months, ordered the same way the filings are. '
      + '⚠ The FY2020 filing, which would carry the transition stub, is DCA\'s '
      + 'encrypted workbook and cannot be read at all.',
  },
  {
    id: 'talbot-fy2022-june-to-september',
    cicoid: '1130130',
    entity: 'Talbot County',
    month: 10,
    monthByYear: Object.freeze({ 2016: 7, 2017: 7, 2018: 7, 2019: 7, 2020: 7, 2021: 7 }),
    declaredBy: null,
    // ⚠ WEAKER THAN THE OTHER TWO, AND RECORDED AS SUCH. FAC has no month-10 row
    // for Talbot at all, so only the EARLIER side is federally corroborated. It is
    // accepted as a change rather than a slip because four consecutive filings
    // print "September 30" — a keying slip does not repeat four times — but the
    // later side rests on the filings alone.
    corroboration: 'FAC reports Talbot County at month 7 for 1998-2014 and has NO row at '
      + 'month 10. The later side is uncorroborated: it rests on four consecutive '
      + 'filings printing "September 30" and on nothing else.',
  },
  // ── MUNICIPALITIES (statewide sweep, 2026-10-18) ──────────────────────────
  //
  // ⚠⚠ THIRTEEN of the 504 in-window municipalities print more than one month
  // across their own filings — against three of 148 counties. A mid-window
  // calendar change is ORDINARY at municipal scale, not exceptional.
  //
  // ⚠ Where the form DECLARES a boundary (MosRptd != 12, or MoChng = Yes), the
  // years at or before it belong to the calendar being changed FROM and are
  // recorded as filed. Tucker's FY2016 and Senoia's FY2025 are exactly that,
  // and an earlier pass wrongly proposed overriding both.

  {
    id: "bloomingdale-month-varies",
    cicoid: "2025901",
    entity: "Bloomingdale",
    month: 7,
    monthByYear: Object.freeze({ 2016: 1 }),
    declaredBy: null,
    corroboration: "⚠⚠ NEITHER SOURCE EXPLAINS THIS. The form declares no change and FAC has "
      + "no row for Bloomingdale at all. The per-year months below are simply "
      + "WHAT EACH FILING PRINTS: recording a document needs no evidence, "
      + "overriding one does, and there is none here. No defect is alleged.",
  },
  {
    id: "doraville-month-varies",
    cicoid: "2044005",
    entity: "Doraville",
    month: 7,
    monthByYear: Object.freeze({ 2023: 10, 2024: 10 }),
    declaredBy: null,
    corroboration: "⚠ The form declares NOTHING — every year reports twelve months and no "
      + "change. The month is taken from what each filing prints, corroborated "
      + "against FAC, which reports Doraville at month 7: "
      + "2007,2008,2009,2010,2011,2012,2021,2022; month 10: 2023,2024.",
  },
  {
    id: "grovetown-month-varies",
    cicoid: "2036002",
    entity: "Grovetown",
    month: 7,
    monthByYear: Object.freeze({ 2016: 1, 2017: 1, 2018: 1, 2019: 1 }),
    declaredBy: "FY2020 reports MosRptd = 6 and MoChng = Yes",
    corroboration: "The form DECLARES the change itself — FY2020 reports MosRptd = 6 and "
      + "MoChng = Yes. FAC reports Grovetown at month 1: 1998,2017,2018,2019; "
      + "month 7: 2021,2022.",
  },
  {
    id: "hapeville-month-varies",
    cicoid: "2060006",
    entity: "Hapeville",
    month: 7,
    monthByYear: Object.freeze({ 2024: 10, 2025: 10 }),
    declaredBy: "FY2023 reports MosRptd = 6; FY2024 reports MosRptd = 15",
    corroboration: "The form DECLARES the change itself — FY2023 reports MosRptd = 6; FY2024 "
      + "reports MosRptd = 15. FAC reports Hapeville at month 7: "
      + "1999,2000,2001,2011,2012,2013,2014,2015,2016,2018,2019,2021,2022.",
  },
  {
    id: "lawrenceville-month-varies",
    cicoid: "2067005",
    entity: "Lawrenceville",
    month: 7,
    monthByYear: Object.freeze({ 2016: 9, 2017: 9, 2018: 9 }),
    declaredBy: "FY2019 reports MosRptd = 10 and MoChng = Yes",
    corroboration: "The form DECLARES the change itself — FY2019 reports MosRptd = 10 and "
      + "MoChng = Yes. FAC reports Lawrenceville at month 7: "
      + "2021,2022,2023,2024,2025; month 9: 2010,2013,2014,2015,2018.",
  },
  {
    id: "lithonia-month-varies",
    cicoid: "2044006",
    entity: "Lithonia",
    month: 1,
    monthByYear: Object.freeze({ 2021: 7, 2022: 7 }),
    declaredBy: "FY2021 reports MosRptd = 6 and MoChng = Yes; FY2022 reports MosRptd = 12 and MoChng = Yes",
    corroboration: "The form DECLARES the change itself — FY2021 reports MosRptd = 6 and "
      + "MoChng = Yes; FY2022 reports MosRptd = 12 and MoChng = Yes. ⚠ FAC has no "
      + "row for this government, so the declaration stands alone.",
  },
  {
    id: "meigs-month-varies",
    cicoid: "2136004",
    entity: "Meigs",
    month: 7,
    monthByYear: Object.freeze({ 2016: 1, 2017: 1 }),
    declaredBy: "FY2018 reports MosRptd = 6 and MoChng = Yes",
    corroboration: "The form DECLARES the change itself — FY2018 reports MosRptd = 6 and "
      + "MoChng = Yes. FAC reports Meigs at month 7: 2025.",
  },
  {
    id: "newborn-month-varies",
    cicoid: "2107003",
    entity: "Newborn",
    month: 1,
    monthByYear: Object.freeze({ 2021: 7, 2022: 7, 2023: 7 }),
    declaredBy: null,
    corroboration: "⚠⚠ NEITHER SOURCE EXPLAINS THIS. The form declares no change and FAC has "
      + "no row for Newborn at all. The per-year months below are simply WHAT "
      + "EACH FILING PRINTS: recording a document needs no evidence, overriding "
      + "one does, and there is none here. No defect is alleged.",
  },
  {
    id: "resaca-month-varies",
    cicoid: "2064601",
    entity: "Resaca",
    month: 5,
    monthByYear: Object.freeze({ 2018: 1 }),
    declaredBy: null,
    corroboration: "⚠⚠ NEITHER SOURCE EXPLAINS THIS. The form declares no change and FAC has "
      + "no row for Resaca at all. The per-year months below are simply WHAT EACH "
      + "FILING PRINTS: recording a document needs no evidence, overriding one "
      + "does, and there is none here. No defect is alleged.",
  },
  {
    id: "senoia-month-varies",
    cicoid: "2038005",
    entity: "Senoia",
    month: 1,
    monthByYear: Object.freeze({ 2025: 10 }),
    declaredBy: "FY2025 reports MosRptd = 9",
    corroboration: "The form DECLARES the change itself — FY2025 reports MosRptd = 9. FAC "
      + "reports Senoia at month 1: 2000,2003,2004,2005,2020,2021,2022,2023,2024.",
  },
  {
    id: "sparta-month-varies",
    cicoid: "2070001",
    entity: "Sparta",
    month: 1,
    monthByYear: Object.freeze({ 2016: 5, 2017: 5, 2018: 5, 2019: 5 }),
    declaredBy: null,
    corroboration: "⚠ The form declares NOTHING — every year reports twelve months and no "
      + "change. The month is taken from what each filing prints, corroborated "
      + "against FAC, which reports Sparta at month 5: 1999,2008,2009,2010.",
  },
  {
    id: "tucker-month-varies",
    cicoid: "2044012",
    entity: "Tucker",
    month: 7,
    monthByYear: Object.freeze({ 2016: 1 }),
    declaredBy: "FY2017 reports MosRptd = 6 and MoChng = Yes; FY2018 reports MosRptd = 12 and MoChng = Yes; FY2019 reports MosRptd = 12 and MoChng = Yes",
    corroboration: "The form DECLARES the change itself — FY2017 reports MosRptd = 6 and "
      + "MoChng = Yes; FY2018 reports MosRptd = 12 and MoChng = Yes; FY2019 "
      + "reports MosRptd = 12 and MoChng = Yes. FAC reports Tucker at month 7: "
      + "2021,2022,2023,2024.",
  },
  {
    id: "villa-rica-month-varies",
    cicoid: "2022006",
    entity: "Villa Rica",
    month: 10,
    monthByYear: Object.freeze({ 2016: 1, 2017: 1 }),
    declaredBy: "FY2018 reports MosRptd = 9 and MoChng = Yes",
    corroboration: "The form DECLARES the change itself — FY2018 reports MosRptd = 9 and "
      + "MoChng = Yes. FAC reports Villa Rica at month 4: 1999,2000,2002,2003; "
      + "month 10: 2023.",
  },
  // ── CONSOLIDATED GOVERNMENTS (statewide sweep, 2026-10-18) ────────────────
  {
    id: 'georgetown-quitman-fy2023-december-to-june',
    cicoid: '3118118',
    entity: 'Georgetown-Quitman CG',
    month: 7,
    monthByYear: Object.freeze({
      2016: 1, 2017: 1, 2018: 1, 2019: 1, 2020: 1, 2021: 1, 2022: 1,
    }),
    declaredBy: null,
    // ⚠ The form declares NOTHING — all ten filings report MosRptd = 12 and
    // MoChng = No — so the change rests on two sustained runs and on the size of
    // the transition year, the Talbot shape.
    corroboration:
      'Seven consecutive filings print "December 31" (FY2016-FY2022) and three print '
      + '"June 30" (FY2023-FY2025); three consecutive years on a new date is not a keying '
      + 'slip. ⭐ THE MONEY CORROBORATES INDEPENDENTLY: a December-to-June move makes FY2023 '
      + 'a SIX-MONTH period, and FY2023 reports 0.564 of its neighbours on the expenditure '
      + 'side and 0.389 on the revenue side, against 0.500 for an exact half year. '
      + '⚠ FAC cannot help here and is not claimed to: it holds no row for this government '
      + 'under any name covering the window, and its nearest matches — "Georgetown" '
      + '(municipality, 1999-2006) and "Quitman" (municipality, month 7) — are ambiguous, '
      + 'the latter most likely Quitman CITY in BROOKS county rather than Quitman County.',
  },
]);

export const GA_FYE_MONTH_DEFECTS = Object.freeze([
  {
    id: 'bartow-fy2025-june-for-december',
    cicoid: '1008008', entity: 'Bartow County', fiscalYear: 2025,
    formMonth: 7, formText: 'June 30', month: 1,
    corroboration: 'Bartow\'s other nine filings all print "December 31", and FAC reports '
      + 'month 1 for 2001-2025 INCLUDING FY2025 itself — the federal audit record '
      + 'contradicts this filing for its own year.',
  },
  {
    id: 'dougherty-fy2025-december-for-june',
    cicoid: '1047047', entity: 'Dougherty County', fiscalYear: 2025,
    formMonth: 1, formText: 'December 31', month: 7,
    corroboration: 'Dougherty\'s other nine filings all print "June 30", and FAC reports '
      + 'month 7 for FY2025 itself — the federal audit record contradicts this '
      + 'filing for its own year.',
  },
  {
    id: 'dooly-fy2019-october-for-september',
    cicoid: '1046046', entity: 'Dooly County', fiscalYear: 2019,
    formMonth: 11, formText: 'October 31', month: 10,
    corroboration: 'Dooly\'s other eight filings all print "September 30", and FAC reports '
      + 'month 10 for FY2019 itself — the federal audit record contradicts this '
      + 'filing for its own year. A one-month slip in the end-month name.',
  },
  {
    id: 'montgomery-fy2016-june-for-december',
    cicoid: '1103103', entity: 'Montgomery County', fiscalYear: 2016,
    formMonth: 7, formText: 'June 30', month: 1,
    corroboration: 'Montgomery\'s other eight filings all print "December 31", and FAC '
      + 'reports month 1 both BEFORE this year (2001, 2002, 2004, 2006) and after '
      + 'it (2022, 2023), with no month-7 row at any time. ⚠ FAC does not cover '
      + 'FY2016 itself, so this rests on the surrounding years, not on that one.',
  },
  {
    id: 'clinch-fy2021-june-for-july',
    cicoid: '1032032', entity: 'Clinch County', fiscalYear: 2021,
    formMonth: 7, formText: 'June 30', month: 8,
    // ⚠ THE WEAKEST TWO ENTRIES IN THIS REGISTER, AND MARKED SO.
    corroboration: 'Clinch\'s other nine filings all print "July 31" (an unusual month, '
      + 'which makes the series itself distinctive). ⚠ FAC covers only FY2024 in '
      + 'the window and agrees with the consensus there, but says NOTHING about '
      + 'FY2021. This rests on the entity\'s own nine-year consistency alone.',
  },
  {
    id: 'newton-fy2022-december-for-june',
    cicoid: '1107107', entity: 'Newton County', fiscalYear: 2022,
    formMonth: 1, formText: 'December 31', month: 7,
    corroboration: 'Newton\'s other nine filings all print "June 30". ⚠ FAC\'s only Newton '
      + 'rows are 2010-2012, all month 7, and none covers FY2022. This rests on '
      + 'the entity\'s own nine-year consistency alone.',
  },
  {
    id: 'chattooga-fy2014-june-for-december',
    cicoid: '1027027', entity: 'Chattooga County', fiscalYear: 2014,
    formMonth: 7, formText: 'June 30', month: 1,
    corroboration:
      '⭐ THE BEST-EVIDENCED SLIP IN THE GEORGIA CORPUS, and the one county of eight whose '
      + 'v1 month split is NOT a calendar change. Chattooga prints "December 31" in 15 of its '
      + '16 filings — FY2009-2013 and FY2015 on the v1 form, and FY2016-2024 on the v2 form, '
      + 'which is BOTH SIDES of the anomalous year in BOTH form generations. '
      + '⚠⚠ What separates it from the seven real changes is that the form declares NO stub '
      + 'and the money shows none: FY2014 reports V99 = 12 and $12,301,887, which is 1.016 of '
      + 'Chattooga\'s own v1 mean. Every genuine change in this corpus declares 6 or 9 months '
      + 'AND reports the matching fraction of the money. A one-year hop to June 30 and back, '
      + 'with twelve months of money on both sides, would require two transitions and two '
      + 'stubs; there are none.',
  },
  // ── MUNICIPALITIES (statewide sweep, 2026-10-18) ──────────────────────────
  //
  // ⚠ Each of these is an ISOLATED year inside an otherwise steady series, and
  // NONE sits at or before a declared calendar boundary — that test is what
  // separates a keying slip from the far side of a real change.

  {
    id: "bronwood-fy2019-month-7-for-1",
    cicoid: "2135001", entity: "Bronwood", fiscalYear: 2019,
    formMonth: 7, formText: "June 30", month: 1,
    corroboration: "Bronwood's other 8 filings all print December 31 and this year is "
      + "isolated between them. ⚠ FAC does not cover FY2019, so this rests on the "
      + "entity's own 8-year consistency alone.",
  },
  {
    id: "broxton-fy2022-month-7-for-1",
    cicoid: "2034002", entity: "Broxton", fiscalYear: 2022,
    formMonth: 7, formText: "June 30", month: 1,
    corroboration: "Broxton's other 9 filings all print December 31 and this year is "
      + "isolated between them. ⚠ FAC does not cover FY2022, so this rests on the "
      + "entity's own 9-year consistency alone.",
  },
  {
    id: "danville-fy2018-month-1-for-7",
    cicoid: "2158002", entity: "Danville", fiscalYear: 2018,
    formMonth: 1, formText: "December 31", month: 7,
    corroboration: "Danville's other 9 filings all print June 30 and this year is isolated "
      + "between them. ⚠ FAC does not cover FY2018, so this rests on the entity's "
      + "own 9-year consistency alone.",
  },
  {
    id: "greenville-fy2018-month-1-for-7",
    cicoid: "2099002", entity: "Greenville", fiscalYear: 2018,
    formMonth: 1, formText: "December 31", month: 7,
    corroboration: "Greenville's other 7 filings all print June 30 and this year is isolated "
      + "between them. ⚠ FAC does not cover FY2018, so this rests on the entity's "
      + "own 7-year consistency alone.",
  },
  {
    id: "morven-fy2020-month-1-for-7",
    cicoid: "2014001", entity: "Morven", fiscalYear: 2020,
    formMonth: 1, formText: "December 31", month: 7,
    corroboration: "Morven's other 8 filings all print June 30 and this year is isolated "
      + "between them. ⚠ FAC does not cover FY2020, so this rests on the entity's "
      + "own 8-year consistency alone.",
  },
  {
    id: "roswell-fy2025-month-1-for-7",
    cicoid: "2060009", entity: "Roswell", fiscalYear: 2025,
    formMonth: 1, formText: "December 31", month: 7,
    corroboration: "Roswell's other 9 filings all print June 30 and this year is isolated "
      + "between them. ⚠ FAC does not cover FY2025, so this rests on the entity's "
      + "own 9-year consistency alone.",
  },
  {
    id: "sandersville-fy2016-month-7-for-1",
    cicoid: "2150004", entity: "Sandersville", fiscalYear: 2016,
    formMonth: 7, formText: "June 30", month: 1,
    corroboration: "Sandersville's other 8 filings all print December 31 and this year is "
      + "isolated between them. ⚠ FAC does not cover FY2016, so this rests on the "
      + "entity's own 8-year consistency alone.",
  },
  {
    id: "sugar-hill-fy2023-month-7-for-1",
    cicoid: "2067010", entity: "Sugar Hill", fiscalYear: 2023,
    formMonth: 7, formText: "June 30", month: 1,
    corroboration: "Sugar Hill's other 8 filings all print December 31 and this year is "
      + "isolated between them. ⚠ FAC does not cover FY2023, so this rests on the "
      + "entity's own 8-year consistency alone.",
  },
  {
    id: "talmo-fy2025-month-1-for-7",
    cicoid: "2078007", entity: "Talmo", fiscalYear: 2025,
    formMonth: 1, formText: "December 31", month: 7,
    corroboration: "Talmo's other 9 filings all print June 30 and this year is isolated "
      + "between them. ⚠ FAC does not cover FY2025, so this rests on the entity's "
      + "own 9-year consistency alone.",
  },
  {
    id: "tucker-fy2020-month-1-for-7",
    cicoid: "2044012", entity: "Tucker", fiscalYear: 2020,
    formMonth: 1, formText: "December 31", month: 7,
    corroboration: "Tucker's other 7 filings all print June 30 and this year is isolated "
      + "between them. ⚠ FAC does not cover FY2020, so this rests on the entity's "
      + "own 7-year consistency alone.",
  },
  {
    id: "tucker-fy2025-month-1-for-7",
    cicoid: "2044012", entity: "Tucker", fiscalYear: 2025,
    formMonth: 1, formText: "December 31", month: 7,
    corroboration: "Tucker's other 7 filings all print June 30 and this year is isolated "
      + "between them. ⚠ FAC does not cover FY2025, so this rests on the entity's "
      + "own 7-year consistency alone.",
  },
]);

/** The recorded calendar change for one government, or null. */
export function fyeMonthChange(cicoid) {
  return GA_FYE_MONTH_CHANGES.find((c) => c.cicoid === String(cicoid)) || null;
}

/**
 * The recorded one-year month slip for one filing, or null.
 *
 * ⚠ The caller must check `formMonth` against what the filing actually printed.
 * An entry excuses only the exact slip it records.
 */
export function fyeMonthDefect(cicoid, fiscalYear) {
  return GA_FYE_MONTH_DEFECTS.find(
    (d) => d.cicoid === String(cicoid) && d.fiscalYear === Number(fiscalYear),
  ) || null;
}

/**
 * ── FLAG 6: filings whose ORACLE CANNOT RUN AT ALL ──────────────────────────
 *
 * ⚠⚠ NOT A DEFECT IN THE FIGURES — AN ABSENCE OF ANY WAY TO CHECK THEM.
 *
 * `checkSectionTotals` verifies TT's tree against the form's own printed
 * subtotal. On these filings those subtotal cells are themselves Excel `#REF!`
 * errors, so there is nothing to compare the tree to. The printed PAGES are
 * intact and the tree TT builds from them looks entirely ordinary against the
 * entity's neighbouring years — but "looks ordinary" is not a measurement.
 *
 * `loadGeorgiaRLGF.mjs` already refuses a run where any filing fails, and its
 * own comment says why: a gate that can measure nothing must FAIL, not pass.
 * Writing these rows would assert a verification that never happened, which is
 * exactly the session-3 failure the whole oracle exists to prevent.
 *
 * So they are EXCLUDED FROM THE LOAD and recorded here. The government keeps
 * every other year it filed; only the unverifiable years are absent.
 *
 * ⚠ EACH ENTRY PINS THE EXACT FAILURE — which checks were skipped and which
 * failed. A filing that breaks differently matches nothing and still refuses
 * the whole run, so this register cannot quietly absorb a new problem. It is
 * the same discipline as GA_FORM_TOTAL_DEFECTS, applied to a different failure.
 */

export const GA_UNVERIFIABLE_FILINGS = Object.freeze([
  {
    id: 'gwinnett-fy2018-every-revenue-subtotal-is-ref',
    cicoid: '1067067',
    entity: 'Gwinnett County',
    state: 'GA',
    fiscalYear: 2018,
    dataset: 'revenue',
    skipped: Object.freeze(['REV 1A', 'REV 1B', 'REV 1C', 'REV 1D', 'REV 2', 'REV 3A', 'REV 3B']),
    failed: Object.freeze(['REV Part I', 'REV Part III', 'REV Own Source (I+III)']),
    what:
      'Every one of the 13 revenue subtotal cells in the FY2018 LOAD1 extract is an Excel '
      + '#REF! error — TTL_1A through TTL_1D, TTL_Part1, TTL_2A/2B/2C, TTL_3A/3B, TTL_Part3, '
      + 'TTL_OSR and TTL_Part4. Not one is a number. 176 LOAD1 cells are errors in total. '
      + 'The seven section checks are therefore SKIPPED for want of anything to compare '
      + 'against, and the three Part-level checks fail as NaN for the same reason.',
    verifiedBecause: [
      'The errors are in DCA\'s published .xls itself, not in TT\'s conversion: '
        + 'xlsToXlsx.py --check re-read every written cell against the source and all '
        + '8,578,433 cells across the 1,442 converted county workbooks round-trip.',
      'The printed pages are INTACT — they still carry 149 non-zero numeric values — and '
        + 'Gwinnett\'s other nine filings all tie 18/18. This is one broken extract sheet, '
        + 'not a broken government and not a broken parser.',
      '⚠ The tree TT builds from the printed pages totals $901,714,723, which sits neatly '
        + 'between FY2017 ($818,568,726) and FY2019 ($995,065,693). That is a reason to '
        + 'believe the figure and NOT a reason to publish it: plausibility is not an oracle.',
    ],
  },
  {
    id: 'gwinnett-fy2023-every-expenditure-subtotal-is-ref',
    cicoid: '1067067',
    entity: 'Gwinnett County',
    state: 'GA',
    fiscalYear: 2023,
    dataset: 'operating',
    skipped: Object.freeze(['EXP 5A', 'EXP 5B', 'EXP 5C', 'EXP 5D', 'EXP 5E', 'EXP 5F', 'EXP 5G']),
    failed: Object.freeze(['EXP Part V grand']),
    what:
      'The same failure on the expenditure side five years later: all 32 Part V subtotal '
      + 'cells (TTL_5A_A through TTL_PART5_D) are #REF!, and 744 LOAD1 cells are errors in '
      + 'total — the worst extract sheet found anywhere in the 1,442-workbook county sweep.',
    verifiedBecause: [
      'The printed pages carry 156 non-zero numeric values and the per-line cross-check '
        + 'reports the page holding figures where LOAD1 holds #REF! — Community Services '
        + '$55,814,741, Libraries $33,763,418, Recreation $19,840,517 and more.',
      'Gwinnett\'s FY2024 filing, the very next year, ties 18/18 at $1,390,421,451.',
      '⚠ Gwinnett is Georgia\'s second-largest county, so these two excluded years are the '
        + 'most expensive omission in this load. Published anyway they would be the '
        + 'largest UNVERIFIED figures in it, which is the worse trade.',
    ],
  },
  {
    id: 'upson-fy2021-part-two-subtotals-are-ref',
    cicoid: '1145145',
    entity: 'Upson County',
    state: 'GA',
    fiscalYear: 2021,
    dataset: 'revenue',
    skipped: Object.freeze(['REV 2']),
    failed: Object.freeze([]),
    what:
      'A much smaller break than Gwinnett\'s, and recorded separately rather than lumped in '
      + 'with it: only TTL_2A and TTL_2B are #REF! (4 error cells in the whole extract), so '
      + '11 of the 13 revenue subtotals ARE numbers and verify. But Part II '
      + '(intergovernmental revenue) cannot be checked, and because the revenue total sums '
      + 'the Part subtotals it comes out NaN.',
    verifiedBecause: [
      'Upson\'s FY2022, FY2023 and FY2024 filings all tie 18/18.',
      '⚠ Excluded under the same rule as the two Gwinnett years even though the break is '
        + 'confined, because the rule is about whether a figure was CHECKED, not about how '
        + 'much of it was. Loading eleven verified sections and one unverified one would '
        + 'publish a revenue total no oracle ever confirmed.',
    ],
  },
  // ── MUNICIPALITIES (statewide sweep, 2026-10-18) ──────────────────────────
  //
  // ⚠ THE LAST ENTRY WIDENS WHAT THIS REGISTER IS FOR. The four above it are
  // the original shape: a subtotal cell is #REF!, so there is NOTHING to check
  // the tree against. Walthourville's oracle runs perfectly well and FAILS, and
  // no independent source exists to settle which of the filing's two readings
  // is right. Both are "TT cannot verify this filing", for different reasons,
  // and both end the same way: the filing is excluded and the reason recorded.
  {
    id: 'jackson-fy2020-every-revenue-subtotal-is-ref',
    cicoid: '2018002', entity: 'Jackson', state: 'GA', fiscalYear: 2020, dataset: 'revenue',
    skipped: Object.freeze(['REV 1A', 'REV 1B', 'REV 1C', 'REV 1D', 'REV 2', 'REV 3A', 'REV 3B']),
    failed: Object.freeze(['REV Part I', 'REV Part III', 'REV Own Source (I+III)']),
    what:
      'All seven revenue subtotals are Excel #REF! errors, so every revenue section check '
      + 'is skipped for want of anything to compare against and the three Part-level checks '
      + 'come out NaN. The Gwinnett FY2018 shape in a small city. The expenditure side of '
      + 'the same filing ties and reports $5,126,664.34.',
    verifiedBecause: [
      'The errors are in DCA\'s published .xls, not in TT\'s conversion: all 27,683,924 '
        + 'cells across the 4,808 converted municipality workbooks round-trip under --check.',
      'Jackson\'s other filings tie 18/18, so this is one broken extract, not a broken '
        + 'government and not a broken parser.',
    ],
  },
  {
    id: 'chester-fy2018-part-three-subtotal-is-ref',
    cicoid: '2045002', entity: 'Chester', state: 'GA', fiscalYear: 2018, dataset: 'revenue',
    skipped: Object.freeze(['REV 3B']),
    failed: Object.freeze(['REV Part III', 'REV Own Source (I+III)']),
    what:
      'A single broken subtotal — TTL_3B — but the revenue total sums the Part subtotals, '
      + 'so it comes out NaN and the revenue side cannot be verified at all. Excluded under '
      + 'the same rule as the larger breaks: the rule is about whether a figure was '
      + 'CHECKED, not about how much of it was.',
    verifiedBecause: [
      'Six of the seven revenue sections ARE numbers and do verify; only Section 3B does '
        + 'not. The expenditure side ties and reports $273,745.',
      'Chester\'s other filings tie 18/18.',
    ],
  },
  {
    id: 'zebulon-fy2025-expenditure-and-revenue-subtotals-are-ref',
    cicoid: '2114005', entity: 'Zebulon', state: 'GA', fiscalYear: 2025, dataset: 'operating',
    skipped: Object.freeze(['EXP 5F', 'EXP 5G', 'REV 2']),
    failed: Object.freeze(['EXP Part V grand']),
    what:
      '⚠ The only filing in the county OR municipality sweep where BOTH sides are '
      + 'unverifiable at once: Sections 5F and 5G and revenue Part II all carry #REF! '
      + 'subtotals, so the Part V grand total and the revenue total are both NaN.',
    verifiedBecause: [
      'Zebulon\'s other filings tie 18/18.',
      'Three separate subtotal cells are errors in one workbook, which is the same '
        + 'single-editing-pass signature seen in Gwinnett and Hawkinsville.',
    ],
  },
  {
    id: 'danville-fy2018-public-safety-subtotal-is-ref',
    cicoid: '2158002', entity: 'Danville', state: 'GA', fiscalYear: 2018, dataset: 'operating',
    skipped: Object.freeze(['EXP 5C']),
    failed: Object.freeze(['EXP Part V grand']),
    what:
      'TTL_5C_* is #REF!, so Section 5C cannot be checked and the Part V grand total is '
      + 'NaN. ⚠ This is the SAME FILING whose FYEmonth prints December 31 against nine '
      + 'other years of June 30 — recorded separately in GA_FYE_MONTH_DEFECTS. One year of '
      + 'this town\'s return went wrong in two unrelated ways.',
    verifiedBecause: [
      'The revenue side of the same filing ties and reports $98,798.',
      'Danville\'s other nine filings tie 18/18.',
    ],
  },
  {
    id: 'walthourville-fy2024-1b-total-cannot-be-settled',
    cicoid: '2089901', entity: 'Walthourville', state: 'GA', fiscalYear: 2024, dataset: 'revenue',
    skipped: Object.freeze([]),
    failed: Object.freeze(['REV 1B', 'REV Part I', 'REV Own Source (I+III)']),
    what:
      '⚠ NOT A #REF! CASE — the oracle runs and FAILS. The printed "Total Section 1B" reads '
      + '$244,012, which is exactly the SPLOST line alone; the section\'s own rows also '
      + 'carry a Local Option Sales Tax line of $673.794, and the tree therefore comes to '
      + '$244,685.794. The same $673.794 propagates to Part I and to Own Source.',
    verifiedBecause: [
      'Walthourville\'s other seven filings tie 18/18, so FY2024 is the sole departure — '
        + 'the reappearance test that settled Long County FY2022 passes here too.',
      'The printed page and the LOAD1 extract AGREE on the $673.794: the cross-check '
        + 'reports no discrepancy, so this is not a parse error and not a displaced cell.',
      '⚠⚠ BUT IT CANNOT BE SETTLED. $673.794 carries THREE decimal places, where every '
        + 'other money figure in this corpus carries two. So the document supports two '
        + 'readings — a printed total that omits a real line (the Long County mechanism), '
        + 'or a corrupt cell the printed total correctly ignores — and nothing available '
        + 'distinguishes them. ⚠ Walthourville has NO Federal Audit Clearinghouse row at '
        + 'all: it spends under the $750k federal threshold, so no audited statement exists '
        + 'to break the tie. Guessing would be asserting one of the city\'s two numbers '
        + 'over the other on no evidence, so the filing is excluded instead.',
      '⏭ TED (ted.cviog.uga.edu/FileExport) is a genuinely independent pipeline for the '
        + 'same RLGF data and is the route a future session should use for the 216 '
        + 'municipalities with no FAC coverage. It was not pursued here for one $673.79 '
        + 'discrepancy.',
    ],
  },
]);

/** The recorded unverifiable filing, or null. */
export function unverifiableFiling(cicoid, fiscalYear) {
  return GA_UNVERIFIABLE_FILINGS.find(
    (u) => u.cicoid === String(cicoid) && u.fiscalYear === Number(fiscalYear),
  ) || null;
}

/**
 * ── FLAG 7: a whole PART reported as zero ───────────────────────────────────
 *
 * ⚠⚠ THE ORACLE CANNOT CATCH THIS, BY CONSTRUCTION. Every Part V section in
 * these filings is $0.00, and so is every one of the form's own printed section
 * totals — so all eighteen checks tie, at zero, and the filing reports 18/18.
 * That is precisely the session-3 failure the loader's own guard describes:
 * counting checks that measured nothing and calling the result green.
 *
 * ⚠ A GOVERNMENT DID NOT SPEND $0. The preparer left the expenditure side of
 * the form blank. TT therefore writes NO operating row for these filings rather
 * than a $0 one — not as a judgement about the figures, but because there is no
 * figure: `toTree()` yields an empty tree, and a budget row with no categories
 * renders as an empty page while asserting to a reader that the county's
 * spending was nothing.
 *
 * ⚠⚠ THIS IS NOT THE MILLEDGEVILLE RULE AND MUST NOT BE READ AS AN EXCEPTION
 * TO IT. That rule governs FIGURES that look wrong — they load, and they are
 * flagged (DeKalb FY2018 loads at $92,044,262 against $654,486,000 audited, and
 * is flagged rather than corrected). Here there is no figure at all to load. An
 * absent section is missing data, and TT's handling of missing data is to have
 * no row, exactly as it does for a year a government never filed.
 *
 * ⚠ The REVENUE side of these same filings is populated and verifies normally,
 * and it is loaded. Only the empty Part is withheld.
 */

export const GA_EMPTY_DATASETS = Object.freeze([
  {
    id: 'franklin-fy2023-whole-filing-is-near-empty',
    cicoid: '1059059', entity: 'Franklin County', state: 'GA', fiscalYear: 2023,
    dataset: 'operating',
    what:
      'All seven Part V sections are $0.00. ⚠ This filing is near-empty on BOTH sides: its '
      + 'revenue comes to $192,274 against a $30,078,761 mean of FY2022 and FY2024, which '
      + 'is 0.6%. Franklin\'s own neighbouring years report $25.9M and $25.6M of '
      + 'expenditure, so the county plainly spent money in FY2023.',
  },
  {
    id: 'sumter-fy2025-part-five-blank',
    cicoid: '1129129', entity: 'Sumter County', state: 'GA', fiscalYear: 2025,
    dataset: 'operating',
    what:
      'All seven Part V sections are $0.00 while the revenue side reports $22,219,885.53 '
      + 'and verifies normally. The expenditure side of the form was not filled in.',
  },
  {
    id: 'upson-fy2024-part-five-blank',
    cicoid: '1145145', entity: 'Upson County', state: 'GA', fiscalYear: 2024,
    dataset: 'operating',
    what:
      'All seven Part V sections are $0.00 while the revenue side reports $29,311,163 and '
      + 'verifies normally. Upson\'s own FY2023 and FY2025 filings report $46.4M and '
      + '$37.6M of expenditure.',
  },
  {
    id: 'upson-fy2010-part-five-blank',
    cicoid: '1145145', entity: 'Upson County', state: 'GA', fiscalYear: 2010,
    dataset: 'operating',
    what:
      'All 36 Part V functions are $0.00 and the printed TOTAL PART V is $0.00 too, so the '
      + 'single v1 expenditure oracle ties AT ZERO having measured nothing. The revenue '
      + 'side of the same filing reports $17,224,904 and verifies normally. Upson\'s own '
      + 'FY2009 and FY2011 filings report $16,059,616 and $13,934,361 of expenditure, so '
      + 'the county plainly spent money in FY2010.',
    why:
      '⚠ THE SECOND BLANK PART V THIS COUNTY HAS FILED — `upson-fy2024-part-five-blank` is '
      + 'the other, fourteen years later. Recorded as its own entry rather than generalised '
      + 'to the entity: a register entry names a FILING, and an entity-level rule would '
      + 'excuse a year nobody has looked at. '
      + '⚠⚠ THE v1 TREE SHAPE DIFFERS FROM v2 HERE. A blank v1 Part V comes back from '
      + 'toTree() as an EMPTY ARRAY — its 36 function roots carry no items and no money, so '
      + 'every one is filtered out — where a blank v2 Part V comes back as SEVEN ROOTS OF '
      + 'ZERO. The guard caught both only because it tests for MONEY and not for length, '
      + 'which is the lesson a `tree.length === 0` guard taught by reaching production.',
  },
  {
    id: 'chatham-fy2010-part-five-blank',
    cicoid: '1025025', entity: 'Chatham County', state: 'GA', fiscalYear: 2010,
    dataset: 'operating',
    what:
      'All 36 Part V functions are $0.00 while the revenue side reports $264,150,126 and '
      + 'verifies normally. Chatham\'s own FY2009 and FY2011 filings report $205,264,337 and '
      + '$257,400,818 of expenditure, so the county plainly spent money in FY2010.',
    why:
      '⚠ Distinguished from a READ failure by the fact that all 36 function rows ARE present '
      + 'and every one of them is $0.00 — the page was read, and it is blank. ⚠⚠ Its FY2013 '
      + 'and FY2014 siblings DID fail to read for a different reason (a `Page 3 ` sheet name '
      + 'with a trailing space) and looked identical from the outside: expenditure $0, revenue '
      + 'normal. Two causes, one appearance. That is why a blank Part is recorded by name '
      + 'rather than skipped by rule.',
  },
  // ── MUNICIPALITIES (statewide sweep, 2026-10-18) ──────────────────────────
  //
  // ⚠⚠ TWENTY of 4,794 municipality filings leave the expenditure side blank,
  // against three of 1,442 county filings. A government filing revenue and no
  // expenditure is ORDINARY at municipal scale — White alone does it in six of
  // its years — so the guard that catches it is load-bearing, not a safety net.
  {
    id: "canon-city-fy2024-part-five-blank",
    cicoid: "2059001", entity: "Canon", state: 'GA', fiscalYear: 2024,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Canon reports $655,313 of '
      + 'expenditure on average across its 7 other filed years, and the revenue side of '
      + 'this same filing reports $339,989 and verifies normally.',
  },
  {
    id: "dahlonega-city-fy2022-part-five-sums-to-zero",
    cicoid: "2093001", entity: "Dahlonega", state: 'GA', fiscalYear: 2022,
    dataset: "operating",
    // ⚠⚠ THE ONE THAT IS NOT BLANK, AND THE REASON THE GUARD TESTS THE TOTAL.
    // An earlier guard asked only whether the Part carried any amount. This one
    // does — and they cancel.
    what:
      'NOT blank: it sums to nothing. Part V carries Police Protection at MINUS $50,000 and '
      + 'Fire Protection at PLUS $50,000 and no other entry at all, so every section total '
      + 'is $0.00, the eighteen checks tie at zero, and the Part totals $0.00 while its line '
      + 'items are not zero. Dahlonega reports $5,602,977 of expenditure on average across '
      + 'its 8 other filed years, and the revenue side of this same filing reports $480,067 '
      + 'and verifies normally. A $0 total is no more publishable for summing to zero than '
      + 'for being left empty, so no row is written either way. ⚠ The ±$50,000 pair reads as '
      + 'a reclassification keyed on its own; nothing is concluded from it here.',
  },
  {
    id: "danielsville-city-fy2021-part-five-blank",
    cicoid: "2097004", entity: "Danielsville", state: 'GA', fiscalYear: 2021,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Danielsville reports $732,670 of '
      + 'expenditure on average across its 9 other filed years, and the revenue side of '
      + 'this same filing reports $598,665 and verifies normally.',
  },
  {
    id: "fort-valley-city-fy2018-part-five-blank",
    cicoid: "2111002", entity: "Fort Valley", state: 'GA', fiscalYear: 2018,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Fort Valley reports $4,627,514 of '
      + 'expenditure on average across its 8 other filed years, and the revenue side of '
      + 'this same filing reports $4,252,291 and verifies normally.',
  },
  {
    id: "good-hope-city-fy2021-part-five-blank",
    cicoid: "2147001", entity: "Good Hope", state: 'GA', fiscalYear: 2021,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Good Hope reports $92,717 of '
      + 'expenditure on average across its 9 other filed years, and the revenue side of '
      + 'this same filing reports $111,926 and verifies normally.',
  },
  {
    id: "ideal-city-fy2016-part-five-blank",
    cicoid: "2096001", entity: "Ideal", state: 'GA', fiscalYear: 2016,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Ideal reports $100,747 of '
      + 'expenditure on average across its 2 other filed years, and the revenue side of '
      + 'this same filing reports $125,026 and verifies normally.',
  },
  {
    id: "jersey-city-fy2025-part-five-blank",
    cicoid: "2147002", entity: "Jersey", state: 'GA', fiscalYear: 2025,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Jersey reports $79,866 of '
      + 'expenditure on average across its 9 other filed years, and the revenue side of '
      + 'this same filing reports $47,248 and verifies normally.',
  },
  {
    id: "lavonia-city-fy2022-part-five-blank",
    cicoid: "2059004", entity: "Lavonia", state: 'GA', fiscalYear: 2022,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Lavonia reports $4,052,665 of '
      + 'expenditure on average across its 8 other filed years, and the revenue side of '
      + 'this same filing reports $704,382 and verifies normally.',
  },
  {
    id: "lone-oak-town-fy2019-part-five-blank",
    cicoid: "2099003", entity: "Lone Oak", state: 'GA', fiscalYear: 2019,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Lone Oak reports $88,569 of '
      + 'expenditure on average across its 7 other filed years, and the revenue side of '
      + 'this same filing reports $29,023 and verifies normally.',
  },
  {
    id: "lone-oak-town-fy2023-part-five-blank",
    cicoid: "2099003", entity: "Lone Oak", state: 'GA', fiscalYear: 2023,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Lone Oak reports $88,569 of '
      + 'expenditure on average across its 7 other filed years, and the revenue side of '
      + 'this same filing reports $77,945 and verifies normally.',
  },
  {
    id: "lumber-city-city-fy2023-part-five-blank",
    cicoid: "2134003", entity: "Lumber City", state: 'GA', fiscalYear: 2023,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Lumber City reports $869,973 of '
      + 'expenditure on average across its 8 other filed years, and the revenue side of '
      + 'this same filing reports $947,402 and verifies normally.',
  },
  {
    id: "orchard-hill-town-fy2025-part-five-blank",
    cicoid: "2126901", entity: "Orchard Hill", state: 'GA', fiscalYear: 2025,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Orchard Hill reports $179,115 of '
      + 'expenditure on average across its 8 other filed years, and the revenue side of '
      + 'this same filing reports $173,200 and verifies normally.',
  },
  {
    id: "stonecrest-city-fy2018-part-five-blank",
    cicoid: "2044013", entity: "Stonecrest", state: 'GA', fiscalYear: 2018,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Stonecrest reports $22,426,356 of '
      + 'expenditure on average across its 5 other filed years, and the revenue side of '
      + 'this same filing reports $10,107,849 and verifies normally.',
  },
  {
    id: "varnell-city-fy2023-part-five-blank",
    cicoid: "2155803", entity: "Varnell", state: 'GA', fiscalYear: 2023,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. Varnell reports $1,287,268 of '
      + 'expenditure on average across its 8 other filed years, and the revenue side of '
      + 'this same filing reports $1,358,585 and verifies normally.',
  },
  {
    id: "white-city-fy2017-part-five-blank",
    cicoid: "2008006", entity: "White", state: 'GA', fiscalYear: 2017,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. White reports $547,322 of '
      + 'expenditure on average across its 2 other filed years, and the revenue side of '
      + 'this same filing reports $322,497 and verifies normally.',
  },
  {
    id: "white-city-fy2020-part-five-blank",
    cicoid: "2008006", entity: "White", state: 'GA', fiscalYear: 2020,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. White reports $547,322 of '
      + 'expenditure on average across its 2 other filed years, and the revenue side of '
      + 'this same filing reports $485,667 and verifies normally.',
  },
  {
    id: "white-city-fy2021-part-five-blank",
    cicoid: "2008006", entity: "White", state: 'GA', fiscalYear: 2021,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. White reports $547,322 of '
      + 'expenditure on average across its 2 other filed years, and the revenue side of '
      + 'this same filing reports $663,980 and verifies normally.',
  },
  {
    id: "white-city-fy2022-part-five-blank",
    cicoid: "2008006", entity: "White", state: 'GA', fiscalYear: 2022,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. White reports $547,322 of '
      + 'expenditure on average across its 2 other filed years, and the revenue side of '
      + 'this same filing reports $679,509 and verifies normally.',
  },
  {
    id: "white-city-fy2023-part-five-blank",
    cicoid: "2008006", entity: "White", state: 'GA', fiscalYear: 2023,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. White reports $547,322 of '
      + 'expenditure on average across its 2 other filed years, and the revenue side of '
      + 'this same filing reports $711,193 and verifies normally.',
  },
  {
    id: "white-city-fy2024-part-five-blank",
    cicoid: "2008006", entity: "White", state: 'GA', fiscalYear: 2024,
    dataset: "operating",
    what:
      'All seven Part V sections are $0.00, so the form\'s own section totals are $0.00 too '
      + 'and all eighteen checks tie AT ZERO. White reports $547,322 of '
      + 'expenditure on average across its 2 other filed years, and the revenue side of '
      + 'this same filing reports $715,738 and verifies normally.',
  },
]);

/** Is this filing's empty dataset a RECORDED one? */
export function emptyDataset(cicoid, fiscalYear, dataset) {
  return GA_EMPTY_DATASETS.find(
    (e) => e.cicoid === String(cicoid)
      && e.fiscalYear === Number(fiscalYear)
      && e.dataset === dataset,
  ) || null;
}

/**
 * ⚠⚠ CONSOLIDATED GOVERNMENTS AND THE COUNTY GOVERNMENTS THEY ABSORBED.
 *
 * The FY2016-2025 sweep recorded that 8 counties file nothing in-window —
 * exactly the 8 with a consolidated counterpart — and that "Bibb's county-prefix
 * filings stop at FY2013 and Echols' at FY2010, BOTH BELOW THE FY2016 FLOOR, so
 * nothing double-counts."
 *
 * ⚠⚠ THAT PROTECTION WAS A SIDE EFFECT OF THE FLOOR, AND READING FY2009-2015
 * REMOVES IT. Below FY2016 a county-prefix CICOID and its consolidated successor
 * can both have filed for the same fiscal year, and loading both would count one
 * government against itself twice.
 *
 * Measured from DCA's own enumeration, 2026-10-19, across all 8:
 *
 *   Echols      1050050 FY2009,2010      3050050 FY2010-2015   ** OVERLAP 2010 **
 *   Macon-Bibb  1011011 FY2009-2013      3011011 FY2014,2015   clean handoff
 *   the other 6: the county-prefix CICOID has NO FY2009-2015 filing at all.
 *
 * ⚠ All 8 are registered, not just the two with filings. The six quiet ones are
 * the reason this is a register rather than two special cases: a filing
 * published later must refuse, not silently double-count.
 *
 * `firstConsolidatedYear` is the first fiscal year the CONSOLIDATED government
 * is the reporting entity. A county-prefix filing at or after it is refused.
 */
export const GA_CONSOLIDATION_OVERLAP = Object.freeze([
  {
    consolidatedCicoid: '3011011', absorbedCicoid: '1011011', name: 'Macon-Bibb County',
    firstConsolidatedYear: 2014,
    why: 'Bibb County filed FY2009-2013 under 1011011; Macon-Bibb filed FY2014-2015 under '
      + '3011011. No year is claimed by both, so nothing is refused today — the entry exists '
      + 'so that a later-published Bibb County filing for FY2014+ cannot create an overlap '
      + 'silently.',
  },
  {
    consolidatedCicoid: '3050050', absorbedCicoid: '1050050', name: 'Echols County CG',
    firstConsolidatedYear: 2010,
    why: '⚠⚠ THE ONE MEASURED OVERLAP IN THE STATE. Echols County filed FY2009 AND FY2010 '
      + 'under 1050050 while Echols County CG filed FY2010-2015 under 3050050. FY2009 loads '
      + 'from the county (the CG had not begun reporting); FY2010 is refused on the county '
      + 'side, because the consolidated filing is the one that continues into FY2016+ and is '
      + 'already loaded there.',
  },
  {
    consolidatedCicoid: '3029029', absorbedCicoid: '1029029', name: 'Athens-Clarke CG',
    firstConsolidatedYear: 2009,
    why: 'Clarke County has NO FY2009-2015 filing. Athens-Clarke filed every year.',
  },
  {
    consolidatedCicoid: '3121121', absorbedCicoid: '1121121', name: 'Augusta/Richmond CG',
    firstConsolidatedYear: 2009,
    why: 'Richmond County has NO FY2009-2015 filing. Augusta-Richmond filed FY2011-2015.',
  },
  {
    consolidatedCicoid: '3106002', absorbedCicoid: '1106002', name: 'Columbus/Muscogee CG',
    firstConsolidatedYear: 2009,
    why: '⚠ 1106002 is not even in DCA\'s dropdown — Columbus-Muscogee\'s CICOID does not '
      + 'follow the county-number-twice pattern (its middle digits are 106, a municipal '
      + 'sequence). Registered for completeness; no county-prefix filing can exist.',
  },
  {
    consolidatedCicoid: '3026026', absorbedCicoid: '1026026', name: 'Cusseta-Chattahoochee CG',
    firstConsolidatedYear: 2009,
    why: 'Chattahoochee County has NO FY2009-2015 filing.',
  },
  {
    consolidatedCicoid: '3118118', absorbedCicoid: '1118118', name: 'Georgetown-Quitman CG',
    firstConsolidatedYear: 2009,
    why: 'Quitman County has NO FY2009-2015 filing. Georgetown-Quitman filed every year.',
  },
  {
    consolidatedCicoid: '3152152', absorbedCicoid: '1152152', name: 'Webster County Unified',
    firstConsolidatedYear: 2009,
    why: 'Webster County has NO county-prefix FY2009-2015 filing; the unified government '
      + 'filed every year under 3152152.',
  },
]);

/**
 * The overlap entry that refuses this county-prefix filing, or null.
 *
 * ⚠ Returns null for a year BEFORE the consolidated government began reporting:
 * those are the absorbed county's own years and are the only record of them.
 */
export function consolidationOverlap(cicoid, fiscalYear) {
  const e = GA_CONSOLIDATION_OVERLAP.find((x) => x.absorbedCicoid === String(cicoid));
  if (!e) return null;
  return Number(fiscalYear) >= e.firstConsolidatedYear ? e : null;
}

/**
 * ⚠⚠ CALENDAR CHANGES INSIDE FY2009-2015, MEASURED ON THE STATEWIDE COUNTY SWEEP.
 *
 * The v1 years have no registry month to check against — the statewide registry
 * was built from FY2016-2025 — so `assertV1MonthConsistency` cross-checks a
 * government's v1 filings against EACH OTHER instead. Eight counties disagree
 * with themselves. Seven of them changed calendar, and this register tells the
 * guard to stand down for exactly those.
 *
 * ⚠⚠ RECORDING A CHANGE NEEDS NO EVIDENCE; THIS IS NOT RECORDING. Each filing
 * already carries its own month and that is what gets written. This register
 * exists to silence a GUARD, so every entry pins TWO independent signals:
 *
 *   1. THE FORM'S OWN DECLARATION — `V99` (months reported) at the transition
 *      year, which reads 6 or 9 instead of 12.
 *   2. THE MONEY — the stub year's operating total against the entity's own v1
 *      mean, which lands within ~0.05 of the fraction V99 declares.
 *
 * ⚠ The v2 sweep learned that `MosRptd` ALONE cannot find stubs (Talbot FY2022
 * reported 12 months while reporting a quarter of the money). Here the two
 * signals agree on all seven, which is a stronger result than either alone —
 * and the one county where they DISAGREE is the one that turned out to be a
 * keying slip (Chattooga, see GA_FYE_MONTH_DEFECTS).
 *
 * ⚠⚠ THE STUB YEARS ARE REAL AND LOAD. Their figures are RIGHT and cover a
 * short period, so each carries a reader flag of severity `not-comparable` —
 * never a warning. See GA_FIGURE_FLAGS and src/data/figureFlags.ts.
 */
export const GA_V1_MONTH_CHANGES = Object.freeze([
  {
    id: 'bacon-fy2014-december-to-june',
    cicoid: '1003003', entity: 'Bacon County',
    monthByYear: Object.freeze({ 2009: 1, 2010: 1, 2011: 1, 2012: 1, 2013: 1, 2014: 7, 2015: 7 }),
    stubYear: 2014, stubMonths: 6, stubRatio: 0.534,
    declaredBy: 'the FY2014 filing reports V99 = 6 — a six-month transition stub',
    corroboration: 'FY2014 operating is $4,089,034, 0.534 of Bacon\'s own v1 mean, against '
      + '0.50 expected for half a year. FY2015 returns to a full year at 1.239.',
  },
  {
    id: 'baldwin-fy2010-june-to-december',
    cicoid: '1005005', entity: 'Baldwin County',
    monthByYear: Object.freeze({ 2009: 7, 2010: 1, 2011: 1, 2012: 1, 2013: 1, 2014: 1, 2015: 1 }),
    stubYear: 2010, stubMonths: 9, stubRatio: 0.740,
    declaredBy: 'the FY2010 filing reports V99 = 9 — a nine-month transition stub',
    corroboration: 'FY2010 operating is $17,310,524, 0.740 of Baldwin\'s own v1 mean, against '
      + '0.75 expected for three quarters. ⭐ THIS IS THE CHANGE THE v2 SWEEP ALREADY KNEW '
      + 'ABOUT but could not see: it recorded that "Baldwin\'s and Atlanta\'s changes both sat '
      + 'BELOW the FY2016 floor". This is that change, now measured directly.',
  },
  {
    id: 'cherokee-fy2011-and-fy2012-two-changes',
    cicoid: '1028028', entity: 'Cherokee County',
    monthByYear: Object.freeze({ 2009: 7, 2010: 7, 2011: 1, 2012: 10, 2013: 10, 2014: 10, 2015: 10 }),
    stubYear: 2012, stubMonths: 9, stubRatio: 0.715,
    declaredBy: 'the FY2012 filing reports V99 = 9 — a nine-month transition stub',
    corroboration: 'FY2012 operating is $90,450,127, 0.715 of Cherokee\'s own v1 mean, against '
      + '0.75 expected. Its v2 filings report September 30 in all ten years FY2016-2025, '
      + 'which is the far side of the change.',
    why: '⚠⚠ TWO CHANGES, NOT ONE, and the first leaves a GAP rather than a stub. FY2010 ends '
      + 'June 30 2010 and FY2011 reports a full twelve months ending December 31 2011, so '
      + 'JULY-DECEMBER 2010 IS NEVER REPORTED BY ANY FILING. That is a six-month hole in the '
      + 'series, not a short year, and no figure in the data is wrong because of it — which '
      + 'is precisely why it needs a reader flag rather than a refusal.',
  },
  {
    id: 'dade-fy2010-december-to-june',
    cicoid: '1041041', entity: 'Dade County',
    monthByYear: Object.freeze({ 2009: 1, 2010: 7, 2012: 7, 2013: 7, 2014: 7, 2015: 7 }),
    stubYear: 2010, stubMonths: 6, stubRatio: 0.425,
    declaredBy: 'the FY2010 filing reports V99 = 6 — a six-month transition stub',
    corroboration: 'FY2010 operating is $3,303,828, 0.425 of Dade\'s own v1 mean, against 0.50 '
      + 'expected. ⚠ DCA lists NO FY2011 filing for Dade, so the map skips that year rather '
      + 'than inventing a month for it.',
  },
  {
    id: 'jasper-fy2011-december-to-june',
    cicoid: '1079079', entity: 'Jasper County',
    monthByYear: Object.freeze({ 2009: 1, 2010: 1, 2011: 7, 2012: 7, 2013: 7, 2014: 7, 2015: 7 }),
    stubYear: 2011, stubMonths: 6, stubRatio: 0.539,
    declaredBy: 'the FY2011 filing reports V99 = 6 — a six-month transition stub',
    corroboration: 'FY2011 operating is $4,737,846, 0.539 of Jasper\'s own v1 mean, against '
      + '0.50 expected.',
  },
  {
    id: 'putnam-fy2010-december-to-september',
    cicoid: '1117117', entity: 'Putnam County',
    monthByYear: Object.freeze({ 2009: 1, 2010: 10, 2011: 10, 2012: 10, 2013: 10, 2014: 10, 2015: 10 }),
    stubYear: 2010, stubMonths: 9, stubRatio: 0.767,
    declaredBy: 'the FY2010 filing reports V99 = 9 — a nine-month transition stub',
    corroboration: 'FY2010 operating is $14,813,438, 0.767 of Putnam\'s own v1 mean, against '
      + '0.75 expected. ⚠ FY2011 ALSO reports V99 = 9 while running 0.942 of the mean — a '
      + 'full-looking year carrying a nine-month declaration. The declaration is treated as '
      + 'the stale copy of the previous year\'s answer, because the money says twelve months; '
      + 'the month itself (September 30) is unchanged either way, so nothing turns on it.',
  },
  {
    id: 'randolph-fy2012-march-to-december',
    cicoid: '1120120', entity: 'Randolph County',
    monthByYear: Object.freeze({ 2009: 4, 2010: 4, 2011: 4, 2012: 1, 2013: 1, 2014: 1, 2015: 1 }),
    stubYear: 2012, stubMonths: 9, stubRatio: 0.752,
    declaredBy: 'the FY2012 filing reports V99 = 9 — a nine-month transition stub',
    corroboration: 'FY2012 operating is $4,657,344, 0.752 of Randolph\'s own v1 mean, against '
      + '0.75 expected. ⚠ Randolph is one of the few GA governments on a MARCH 31 year end, '
      + 'which is why its FY2009-2011 ratios look low against a mean the change pulls upward.',
  },
]);

/** The recorded v1 calendar change for a government, or null. */
export function v1MonthChange(cicoid) {
  return GA_V1_MONTH_CHANGES.find((c) => c.cicoid === String(cicoid)) || null;
}
