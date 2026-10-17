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
    what: '⚠⚠ A ×1000 KEYING SLIP RECURS ACROSS THIS SOURCE, and it is NOT confined to one '
      + 'government. Fulton Part VII (enterprise capital assets) is scaled by 1/1000 in '
      + 'FY2023 and FY2024 — restoring the factor puts both years inside the 1.003-1.052 '
      + 'growth band of the preceding six. Fulton Part XIII (fund equity) looks '
      + 'thousands-denominated in FY2016. Atlanta FY2025 Part XIII reports GF unassigned '
      + 'as $127,693 against $124,339,000 in FY2024 — the identical break.',
    why: 'Parts VII and XIII are balance-sheet tables, outside the loaded trees. ⚠ Recorded '
      + 'because the FY2009-2015 follow-up and the statewide sweep WILL meet this, and '
      + 'because a ratio test against neighbouring years detects it cheaply.',
  },
  {
    what: '⚠ NOT CORROBORATED — DO NOT PUBLISH AS A FLAG. Fulton FY2017/FY2018 property tax '
      + 'looks like a TIMING SHIFT between two adjacent UCOA codes, not a loss: 31.1100 '
      + '(current-year real property) is $296.2M in FY2017 against a $500.5M neighbour '
      + 'mean, while 31.1200 (PRIOR-year) is $215.8M in FY2018 against a $32.9M mean. The '
      + 'two-year total holds to within 1.4%. Read alone, FY2017 looks like a collapse and '
      + 'FY2018 like a windfall; read as a pair, almost nothing moved. ⚠ BOTH YEARS ARE '
      + 'INSIDE THE LOADED REVENUE SCOPE.',
    why: '⭐⭐ THE REAPPEARANCE TEST IS WHY THIS IS NOT A FLAG. The same blind sweep that '
      + 'corroborated FY2021 found this and checked whether the money turns up elsewhere '
      + 'in the filing — it does. An omission and a reclassification look IDENTICAL from a '
      + 'single line, and only one of them is a defect. ⚠ One reasoning chain has seen '
      + 'this; it needs its own corroboration before TT says anything about it, and the '
      + 'comparability point (these two years are not comparable to each other) may be '
      + 'worth surfacing even if no figure is wrong.',
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
