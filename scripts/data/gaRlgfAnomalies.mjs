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
      + 'asking for it to be re-measured at scale. Re-measured across 151 counties and '
      + '1,442 filings, a break DOES appear inside Part I. ⚠ It is NOT the x1000 slip that '
      + 'register describes: that one is structural, arising because Georgia ACFRs print in '
      + 'thousands while the form asks for dollars. This is a single cell at roughly x100, '
      + 'in a different Part, with a different fingerprint. The null held for the mechanism '
      + 'it described; it did not hold for scale breaks in loaded data generally.',
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
]);

/**
 * ── FLAG 2: the publisher's machine extract is defective ───────────────────
 *
 * ⚠⚠ THIS DOES NOT AFFECT LOADED FIGURES. TT reads the PRINTED FORM, which
 * reconciles to its own subtotals in 1,672 of 1,672 tests. These are recorded
 * because anyone else using Georgia's RLGF `LOAD1` sheet will hit them.
 *
 * MECHANISM: `LOAD1` is a formula layer over the printed Page sheets. Where a
 * form row was renumbered or moved, the reference snapped to `#REF!` and its
 * NEIGHBOUR's formula picked up the displaced value — so a real dollar amount
 * is attached to the WRONG UCOA account.
 *
 * ⚠⚠ THE SUBTOTALS STILL TIE. `LOAD1`'s `TTL_*` cells remain correct even where
 * its line items are wrong, so **a control-total check passes over misattributed
 * detail**. Three of the cases below disturb no subtotal at all. Subtotal ties
 * are NECESSARY BUT DEMONSTRABLY NOT SUFFICIENT for this source.
 *
 * ⚠ A naive reader sees these as SMALL PLAUSIBLE NUMBERS, not as errors: in the
 * raw .xls an error cell's "value" is its error CODE, so `#REF!` reads as the
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
]);

/** Is this filing's empty dataset a RECORDED one? */
export function emptyDataset(cicoid, fiscalYear, dataset) {
  return GA_EMPTY_DATASETS.find(
    (e) => e.cicoid === String(cicoid)
      && e.fiscalYear === Number(fiscalYear)
      && e.dataset === dataset,
  ) || null;
}
