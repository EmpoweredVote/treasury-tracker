/**
 * South Carolina cities — the ACFR route, wave 1 (the Charleston metro).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── WHY SOUTH CAROLINA'S CITIES NEED THIS AT ALL ───────────────────────────
 *
 * The RFA Local Government Finance Report is statewide and icicle-grade and it
 * publishes NO INDIVIDUAL MUNICIPALITY — each county sheet's "Cities only" block
 * is every city in that county summed together, per its own footnote. Finishing
 * all 46 counties (PR #134) therefore did not put a single South Carolina city in
 * TT. They have to come from their own audited statements, one at a time.
 *
 * ⚠ Columbia and Myrtle Beach came the same way in Knight session 6a and live in
 * scripts/data/scAcfrSources.mjs. That module is left alone deliberately: it is
 * proven, it is pinned by tests, and rewriting a working registry to make a new
 * one look tidy is not a reason to touch loaded rows.
 *
 * ── ⚠⚠ THE EIN IS THE JOIN. NEVER THE NAME. ────────────────────────────────
 *
 * A FAC name search for `*charleston*` + `*mount pleasant*` in South Carolina
 * returns **50 distinct (EIN, name) pairs**, of which exactly three are the
 * governments wanted here. Among the other 47: `COLLEGE OF CHARLESTON`,
 * `CHARLESTON SOUTHERN UNIVERSITY`, `HOUSING AUTHORITY OF THE CITY OF
 * CHARLESTON`, `NORTH CHARLESTON HOUSING AUTHORITY`, `CHARLESTON COUNTY SCHOOL
 * DISTRICT`, `COUNTY OF CHARLESTON`, `CHARLESTON WINE & FOOD FESTIVAL` and
 * `Charleston Area Regional Transportation Authority`.
 *
 * ⚠⚠ AND TWO OF THE NEAR MISSES ARE ONE DIGIT AWAY FROM THE RIGHT ANSWER:
 *
 *     576000226  CITY OF CHARLESTON, SOUTH CAROLINA          ← wanted
 *     576000227  Commissioners of Public Works of the City of Charleston
 *
 *     576001079  TOWN OF MOUNT PLEASANT                      ← wanted
 *     576001080  MOUNT PLEASANT WATERWORKS
 *
 * A typo in either EIN does not fail — it silently loads a real, related, WRONG
 * government's audited statements under the city's name, and every tie gate
 * downstream would pass on them. This is session 2's `assertIssuer` lesson in a
 * fourth place. The EINs below were read off the resolution query and every
 * report id is recorded per year rather than rebuilt from a pattern.
 *
 * ⚠ THE ID PATTERN IS NOT STABLE ANYWAY. Through FY2022 the id is
 * `<fy>-<mm>-CENSUS-<stable per-entity number>`; from FY2023 it is
 * `<fy>-<mm>-GSAFAC-<number that changes every year>`. Only the first half could
 * ever be rebuilt, so none of it is.
 *
 * ── ⚠⚠ THE FISCAL CALENDAR IS NOT UNIFORM, AND CHARLESTON PROVES IT ────────
 *
 * All 46 SC counties run July. **The City of Charleston runs JANUARY** — its
 * federal filings report `fy_end_date` 12-31 in all ten years, and the FAC census
 * independently records month 1. North Charleston and Mount Pleasant are July.
 *
 * South Carolina's cities are genuinely heterogeneous — the census also records
 * Bennettsville at 5, Blacksburg at 4, Bowman at 3, and Abbeville at 10 in some
 * years and 11 in others. **There is no state norm to fall back on**, which is
 * exactly the condition `project_fysm_column_default_one_defect` exists for. Every
 * month here is read from that entity's own filings.
 *
 * ── POPULATIONS ────────────────────────────────────────────────────────────
 *
 * US Census Bureau PEP vintage 2024 (`POPESTIMATE2024`) from `sub-est2024_45.csv`,
 * SUMLEV 162 (incorporated place). ⚠ `Mount Pleasant town` is a TOWN both in the
 * Census file and in its own filings (`TOWN OF MOUNT PLEASANT`), and `town` is
 * already a legal `entity_type`. It is recorded as such rather than flattened to
 * `city`: `treasury_ensure_municipality` keys on (name, state, entity_type), so
 * the type is part of the government's identity, not a label.
 */

/** `https://app.fac.gov/dissemination/report/pdf/<id>` — no key, no auth. */
export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf';

export const SC_CITY_STATE = 'SC';

/**
 * Wave 1. Each entry is one government.
 *
 * ⚠ `facReports` is the COMPLETE set of years FAC serves for that EIN. Mount
 * Pleasant genuinely has no FY2016 or FY2017 filing there — that is a coverage
 * gap to report, never a year to invent.
 */
export const SC_CITY_ENTITIES = Object.freeze([
  {
    key: 'charleston',
    name: 'Charleston',
    entityType: 'city',
    extractor: 'scripts/extractCharlestonSC.py',
    state: SC_CITY_STATE,
    population: 157665,
    censusPlace: '13330',
    parentCountyName: 'Charleston County',
    /** ⚠⚠ 576000227 is the Commissioners of Public Works — a different government. */
    facEin: '576000226',
    /** ⚠ Join key for the FAC census — name + state, NEVER the bare name. */
    censusName: 'Charleston',
    /** ⚠⚠ JANUARY. Evidenced by fy_end_date 12-31 across all ten filings, and
     * independently by the census (SC,Charleston,municipality,annual,1). */
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.charleston-sc.gov/319/Comprehensive-Annual-Financial-Report',
    facReports: {
      2016: '2016-12-CENSUS-0000170474',
      2017: '2017-12-CENSUS-0000170474',
      2018: '2018-12-CENSUS-0000170474',
      2019: '2019-12-CENSUS-0000170474',
      2020: '2020-12-CENSUS-0000170474',
      2021: '2021-12-CENSUS-0000170474',
      2022: '2022-12-CENSUS-0000170474',
      2023: '2023-12-GSAFAC-0000058413',
      2024: '2024-12-GSAFAC-0000394878',
      2025: '2025-12-GSAFAC-0000427683',
    },
  },
  {
    key: 'north-charleston',
    name: 'North Charleston',
    entityType: 'city',
    /**
     * ⚠⚠ FOUR OF TEN YEARS, and the six gaps are DOCUMENT-QUALITY gaps checked
     * at TWO publishers each — see KNOWN_DOCUMENT_GAPS. The coordinate reader is
     * the record reader because this issuer needs `row_gap`, `left_margin` and
     * `ocr_leading_one`, none of which a CityConfig can express.
     */
    extractor: 'scripts/extractNorthCharlestonCoords.py',
    /** ⚠ Required once an entity moves to coordinates. Agrees to the dollar on
     * four of the eight loaded extractions; the other four are declared. */
    corroboratingExtractor: 'scripts/extractNorthCharlestonSC.py',
    state: SC_CITY_STATE,
    population: 126005,
    censusPlace: '50875',
    parentCountyName: 'Charleston County',
    facEin: '570545285',
    censusName: 'North Charleston',
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.northcharleston.org/residents/city-departments/finance/',
    facReports: {
      2016: '2016-06-CENSUS-0000170481',
      2017: '2017-06-CENSUS-0000170481',
      2018: '2018-06-CENSUS-0000170481',
      2019: '2019-06-CENSUS-0000170481',
      2020: '2020-06-CENSUS-0000170481',
      2021: '2021-06-CENSUS-0000170481',
      2022: '2022-06-CENSUS-0000170481',
      2023: '2023-06-GSAFAC-0000006301',
      2024: '2024-06-GSAFAC-0000061099',
      2025: '2025-06-GSAFAC-0000397899',
    },
  },
  {
    key: 'mount-pleasant',
    name: 'Mount Pleasant',
    extractor: 'scripts/extractMountPleasantSC.py',
    /** ⚠ A TOWN, in the Census file and in its own filings. Not flattened. */
    entityType: 'town',
    state: SC_CITY_STATE,
    population: 95604,
    censusPlace: '48535',
    parentCountyName: 'Charleston County',
    /** ⚠⚠ 576001080 is Mount Pleasant Waterworks — a different government. */
    facEin: '576001079',
    /** ⚠ The census files it as kind `municipality`; that is the CENSUS's
     * vocabulary, not TT's entity_type. It is still a town. */
    censusName: 'Mount Pleasant',
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.tompsc.com/191/Financial-Reports',
    facReports: {
      2018: '2018-06-CENSUS-0000170477',
      2019: '2019-06-CENSUS-0000170477',
      2020: '2020-06-CENSUS-0000170477',
      2021: '2021-06-CENSUS-0000170477',
      2022: '2022-06-CENSUS-0000170477',
      2023: '2023-06-GSAFAC-0000009569',
      2024: '2024-06-GSAFAC-0000067811',
      2025: '2025-06-GSAFAC-0000396704',
    },
  },
  {
    key: 'rock-hill',
    name: 'Rock Hill',
    entityType: 'city',
    /**
     * ⚠⚠ THE COORDINATE READER, and that is a diagnosed per-ENTITY decision.
     * Rock Hill defeats BOTH `acfrGF.py` column strategies, each in a different
     * year: `positional` reads FY2024 revenue 432,533 short (the exact `Fines
     * and forfeitures` figure, dropped by a two-offset General Fund column) and
     * `ordinal` fixes that while breaking FY2025 operating by 20,125. Picking
     * whichever ties per year is curve-fitting. `extractRockHillSC.py` is kept
     * as the CORROBORATING reader — see scripts/verifyScCityReaders.mjs.
     */
    extractor: 'scripts/extractRockHillCoords.py',
    corroboratingExtractor: 'scripts/extractRockHillSC.py',
    state: SC_CITY_STATE,
    population: 75798,
    censusPlace: '61405',
    parentCountyName: 'York County',
    /**
     * ⚠⚠ THIS EIN IS SHARED BY TWO DIFFERENT GOVERNMENTS. 576000244 carries the
     * CITY of Rock Hill *and* the HOUSING AUTHORITY OF THE CITY OF ROCK HILL —
     * 19 filings under one number, seven name variants, and TWO fiscal year
     * ends. Joining on the EIN alone pulls the housing authority's audited
     * statements into the city's series, and because the authority closes
     * December while the city closes June it would also read as a city that
     * alternates its fiscal calendar every single year. A wrong CONFIRMATION is
     * worse than no evidence.
     *
     * ⭐ The census-era report id disambiguates them cleanly and independently:
     * the city is `...-06-CENSUS-0000170607`, the authority `...-12-CENSUS-0000182948`.
     * Every id below is recorded per year, and every one closes 06-30.
     */
    facEin: '576000244',
    facEinSharedWith: 'HOUSING AUTHORITY OF THE CITY OF ROCK HILL',
    censusName: 'Rock Hill',
    /**
     * ⚠ Rock Hill CHANGED its fiscal year — the census records month 1 for
     * 1998-1999, a SIX-MONTH stub in 2000, then month 7 from 2001. The change
     * predates this window by sixteen years, so month 7 holds throughout it.
     */
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.cityofrockhill.com/departments/finance',
    facReports: {
      2016: '2016-06-CENSUS-0000170607',
      2017: '2017-06-CENSUS-0000170607',
      2018: '2018-06-CENSUS-0000170607',
      2019: '2019-06-CENSUS-0000170607',
      2020: '2020-06-CENSUS-0000170607',
      2021: '2021-06-CENSUS-0000170607',
      2022: '2022-06-CENSUS-0000170607',
      2023: '2023-06-GSAFAC-0000016463',
      2024: '2024-06-GSAFAC-0000347380',
      2025: '2025-06-GSAFAC-0000406755',
    },
  },
  {
    key: 'greenville',
    name: 'Greenville',
    entityType: 'city',
    extractor: 'scripts/extractGreenvilleSC.py',
    state: SC_CITY_STATE,
    population: 74371,
    censusPlace: '30850',
    parentCountyName: 'Greenville County',
    /**
     * ⚠⚠ NOT `576000356 GREENVILLE COUNTY`, `576000234 THE SCHOOL DISTRICT OF
     * GREENVILLE COUNTY`, `576000554 GREENVILLE AIRPORT COMMISSION`,
     * `576000555 Greenville Water System`, `576000612 HOUSING AUTHORITY OF THE
     * CITY OF GREENVILLE`, `570420667 GREENVILLE TECHNICAL COLLEGE`,
     * `570408425 GREENVILLE-SPARTANBURG AIRPORT DISTRICT`, `570634283
     * GREENVILLE TRANSIT AUTHORITY` or `570314406 NORTH GREENVILLE UNIVERSITY`.
     * A name match on `*greenville*` in SC returns 41 (EIN, name) pairs.
     *
     * ⭐ Unlike Rock Hill, this EIN is clean: 10 filings, ONE auditee name, one
     * fiscal year end. Checked in the bulk table rather than assumed.
     */
    facEin: '576000236',
    censusName: 'Greenville',
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.greenvillesc.gov/216/Financial-Reports',
    facReports: {
      2016: '2016-06-CENSUS-0000170520',
      2017: '2017-06-CENSUS-0000170520',
      2018: '2018-06-CENSUS-0000170520',
      2019: '2019-06-CENSUS-0000170520',
      2020: '2020-06-CENSUS-0000170520',
      2021: '2021-06-CENSUS-0000170520',
      2022: '2022-06-CENSUS-0000170520',
      2023: '2023-06-GSAFAC-0000008354',
      2024: '2024-06-GSAFAC-0000344512',
      2025: '2025-06-GSAFAC-0000388925',
    },
  },
  {
    key: 'summerville',
    name: 'Summerville',
    /** ⚠ A TOWN — `Summerville town` in the Census file, `TOWN OF SUMMERVILLE`
     * in its own filings. Same call as Mount Pleasant. */
    entityType: 'town',
    /**
     * ⚠⚠ THE COORDINATE READER IS THE RECORD READER, and the reason is SHAPE,
     * not arithmetic. The town prints THREE levels — `Current:` >
     * `General Government:` > `Administrative`, with `Culture and recreation` a
     * VALUED LEAF at the middle one — and no `CityConfig` can hold three. The
     * `-table` reader below ties at $0 on all twelve extractions while
     * flattening the middle level, which is exactly why the tie cannot choose
     * between them.
     */
    extractor: 'scripts/extractSummervilleCoords.py',
    /** ⚠ Required once an entity moves to coordinates — see verifyScCityReaders.mjs.
     * `column_strategy='ordinal'` is load-bearing: this issuer renders the
     * General Fund column at TWO character offsets. 12/12 exact agreement. */
    corroboratingExtractor: 'scripts/extractSummervilleSC.py',
    state: SC_CITY_STATE,
    population: 52625,
    censusPlace: '70270',
    parentCountyName: 'Dorchester County',
    facEin: '576001110',
    censusName: 'Summerville',
    /**
     * ⚠⚠ SUMMERVILLE CHANGED ITS FISCAL YEAR **INSIDE THIS WINDOW**, and it is
     * the first entity in this campaign to do so. Its filings end 12-31 in
     * FY2018 and FY2020 and 06-30 from FY2022 — independently confirmed by the
     * FAC census, which records month 1 for 2018/2020 and month 7 for 2022-2025.
     *
     * A single per-entity month cannot express that, so the default below is the
     * LATER month and `fiscalMonthOverrides` carries the earlier years. Writing 7
     * across the whole series would put a January-starting year under a July
     * label — a wrong value that moves no dollar and fails no tie gate, which is
     * exactly the shape of project_fysm_column_default_one_defect.
     */
    fiscalYearStartMonth: 7,
    fiscalMonthOverrides: Object.freeze({ 2018: 1, 2020: 1 }),
    monthStatus: 'confirmed',
    publicationPage: 'https://www.summervillesc.gov/206/Finance',
    facReports: {
      2018: '2018-12-CENSUS-0000187544',
      2020: '2020-12-CENSUS-0000187544',
      2022: '2022-06-CENSUS-0000187544',
      2023: '2023-06-GSAFAC-0000022779',
      2024: '2024-06-GSAFAC-0000358242',
      2025: '2025-06-GSAFAC-0000408794',
    },
  },
  {
    key: 'goose-creek',
    name: 'Goose Creek',
    entityType: 'city',
    /** ⚠ Its revenue section is closed by a PRINTED SUBTOTAL (`Total local
     * revenues`) which double-counted until `cfg.subtotal_prefixes` was
     * extended to `build_revenue`. It is now checked against its own six
     * children every year — the issuer's own free oracle. */
    extractor: 'scripts/extractGooseCreekSC.py',
    state: SC_CITY_STATE,
    population: 50352,
    censusPlace: '29815',
    parentCountyName: 'Berkeley County',
    facEin: '576008064',
    censusName: 'Goose Creek',
    /** ⚠ JANUARY, like Charleston — all six filings end 12-31, and the census
     * records month 1 across 1999, 2002-2003, 2016 and 2021-2025. */
    fiscalYearStartMonth: 1,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.cityofgoosecreek.com/departments/finance',
    facReports: {
      2016: '2016-12-CENSUS-0000170470',
      2021: '2021-12-CENSUS-0000170470',
      2022: '2022-12-CENSUS-0000170470',
      2023: '2023-12-GSAFAC-0000044988',
      2024: '2024-12-GSAFAC-0000374202',
      2025: '2025-12-GSAFAC-0000420983',
    },
  },
  {
    key: 'spartanburg',
    name: 'Spartanburg',
    entityType: 'city',
    /**
     * ⚠⚠ THE COORDINATE READER, on a DIAGNOSED failure of the character grid:
     * `pdftotext -table` mis-renders the FY2018 statement page and mixes the two
     * sections (revenue 5,975,414 over — exactly an EXPENDITURE line — and no
     * printed expenditure total at all). BOTH column strategies fail it
     * identically. ⚠ Nine years read fine through `-table`; using it for those
     * and coordinates for FY2018 would be picking whichever reader tied, so the
     * ENTITY moves as a whole.
     */
    extractor: 'scripts/extractSpartanburgCoords.py',
    /** ⚠ Required once an entity moves to coordinates. 18 of 20 exact; the two
     * FY2018 failures are declared in verifyScCityReaders.mjs. */
    corroboratingExtractor: 'scripts/extractSpartanburgSC.py',
    state: SC_CITY_STATE,
    population: 39606,
    censusPlace: '68290',
    parentCountyName: 'Spartanburg County',
    /**
     * ⚠⚠ ITS TWO ONE-DIGIT NEIGHBOURS ARE BOTH CITIES ALREADY LOADED IN TT:
     *
     *     576000244  CITY OF ROCK HILL      <- wave 2, loaded
     *     576000245  CITY OF SPARTANBURG    <- wanted
     *     576000246  CITY OF SUMTER         <- a real SC city, not yet loaded
     *
     * A typo in either direction does not fail. It loads ANOTHER LOADED CITY'S
     * audited statements under Spartanburg's name, and every tie gate passes on
     * them — the wave-1 near-miss lesson at its sharpest, because here the wrong
     * answer is a government TT already holds and could be diffed against.
     *
     * ⚠ Also in SC and NOT this government: SPARTANBURG COUNTY (576000401),
     * HOUSING AUTHORITY OF THE CITY OF SPARTANBURG (576001369), Spartanburg
     * Water System (576000944), Spartanburg Sanitary Sewer District (576000941),
     * SPARTANBURG COUNTY SCHOOL DISTRICT SEVEN (576000942) and six other school
     * districts, Spartanburg Regional Health Services District (571075649),
     * Spartanburg Community College (570439615) and Spartanburg Methodist
     * College (570314415).
     *
     * ⭐ THIS EIN IS EXCEPTIONALLY CLEAN, checked in the bulk table rather than
     * assumed: 10 filings, ONE auditee_name (`CITY OF SPARTANBURG`), ONE fiscal
     * year end, one state, one city. No Rock Hill-style collision and no
     * `Drew Cooper`-style name substitution anywhere in the series.
     */
    facEin: '576000245',
    censusName: 'Spartanburg',
    /**
     * ⭐ JULY, and confirmed three ways: `fy_end_date` is 06-30 on all ten
     * filings, the FAC census records `SC,Spartanburg,municipality,annual,7`
     * across audit years 1998-1999, 2001-2021 and 2023-2025, and each statement
     * states its own period. ⚠ The census has no 2022 row — a census gap, not a
     * disagreement, and the filing for that year exists.
     */
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.cityofspartanburg.org/287/Annual-Financial-Reports',
    facReports: {
      2016: '2016-06-CENSUS-0000195157',
      2017: '2017-06-CENSUS-0000195157',
      2018: '2018-06-CENSUS-0000195157',
      2019: '2019-06-CENSUS-0000195157',
      2020: '2020-06-CENSUS-0000195157',
      2021: '2021-06-CENSUS-0000195157',
      2022: '2022-06-CENSUS-0000195157',
      2023: '2023-06-GSAFAC-0000014256',
      2024: '2024-06-GSAFAC-0000353147',
      2025: '2025-06-GSAFAC-0000405784',
    },
  },
  {
    key: 'sumter',
    name: 'Sumter',
    entityType: 'city',
    /**
     * ⚠⚠ THE COORDINATE READER, and for TWO independent reasons — either alone
     * would justify it. (1) `pdftotext -table` renders this issuer LETTER-SPACED
     * (`Re ve nue s`, `T otal revenues`, `Go v ern men t al`) so the shared
     * reader's banner and anchor patterns match nothing and `classify` refuses
     * the page on a stray page number in the General Fund column. (2) Its
     * revenue section GROUPS THREE TIMES with valued root leaves printed
     * BETWEEN the groups, a shape none of `acfrGF`'s three grouping rules can
     * express — and every wrong shape ties at $0.
     *
     * ⚠⚠ NO `-table` CORROBORATOR IS POSSIBLE, unlike Rock Hill and
     * Spartanburg: the grid reader fails all ten years, not some. The
     * independent check is `scripts/verifyScCityExcess.py`, which reproduces
     * the issuer's OWN printed `Excess (deficiency) of revenues over (under)
     * expenditures` on 10 of 10 years. See the extractor docstring for what
     * that does and does not rule out.
     */
    extractor: 'scripts/extractSumterCoords.py',
    state: SC_CITY_STATE,
    population: 42958,
    censusPlace: '70405',
    parentCountyName: 'Sumter County',
    /**
     * ⚠⚠ ITS ONE-DIGIT NEIGHBOUR IS A CITY TT ALREADY HOLDS, and the one below
     * that is another one:
     *
     *     576000244  CITY OF ROCK HILL      <- wave 2, loaded
     *     576000245  CITY OF SPARTANBURG    <- wave 3, loaded
     *     576000246  CITY OF SUMTER         <- wanted
     *
     * A typo does not fail. It loads a LOADED city's audited statements under
     * Sumter's name and every tie gate passes on them.
     *
     * ⚠ Also in SC and NOT this government: SUMTER COUNTY (576000405),
     * HOUSING AUTHORITY OF SUMTER (570475456), SUMTER SCHOOL DISTRICT
     * (364682689), SUMTER COUNTY COMMISSION ON ALCOHOL AND DRUG ABUSE
     * (570604046), SUMTER COUNTY DISABILITIES AND SPECIAL NEEDS BOARD
     * (570645651 and 824401069 — two EINs, one board name) and SUMTER FAMILY
     * HEALTH CENTER (571095992).
     *
     * ⭐ Checked in the bulk table, not assumed: this EIN carries ONE
     * government — one UEI (WA1XM9LJCL85), one fiscal year end (06-30), one
     * city, and `CITY OF SUMTER` / `City of Sumter` as its only two
     * auditee_name spellings. No Rock Hill-style collision.
     */
    facEin: '576000246',
    censusName: 'Sumter',
    /**
     * ⭐ JULY, confirmed three ways: `fy_end_date` is 06-30 on all eleven
     * filings, `fy_start_date` 07-01; the FAC census records
     * `SC,Sumter,municipality,annual,7` across audit years 1998-2000,
     * 2003-2015 and 2017-2025; and each statement states its own period
     * (`For the Year Ended June 30, 2024`). ⚠ The census has no 2016 row — a
     * census gap, not a disagreement; the filing for that year exists.
     */
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.sumtersc.gov/finance/financial-reports-budgets',
    facReports: {
      2016: '2016-06-CENSUS-0000170600',
      2017: '2017-06-CENSUS-0000170600',
      2018: '2018-06-CENSUS-0000170600',
      2019: '2019-06-CENSUS-0000170600',
      2020: '2020-06-CENSUS-0000170600',
      2021: '2021-06-CENSUS-0000170600',
      2022: '2022-06-CENSUS-0000170600',
      2023: '2023-06-GSAFAC-0000012936',
      2024: '2024-06-GSAFAC-0000392867',
      2025: '2025-06-GSAFAC-0000394755',
    },
  },
  {
    key: 'florence',
    name: 'Florence',
    entityType: 'city',
    extractor: 'scripts/extractFlorenceSC.py',
    state: SC_CITY_STATE,
    population: 40923,
    censusPlace: '25810',
    /**
     * ⚠ Florence city straddles TWO counties in the Census place file — SUMLEV
     * 157 records it under county 041 (Florence, 40,923) and county 031
     * (Darlington, 0). The whole population sits in Florence County.
     */
    parentCountyName: 'Florence County',
    /**
     * ⚠⚠ ITS ONE-DIGIT NEIGHBOUR IS A SCHOOL DISTRICT IN THE SAME CITY:
     *
     *     576000231  FLORENCE SCHOOL DISTRICT ONE
     *     576000232  CITY OF FLORENCE, SC            <- wanted
     *     576000233  CITY OF GAFFNEY                 <- a different SC city
     *
     * ⚠ Also in SC and NOT this government: FLORENCE COUNTY (576000351), the
     * housing authorities (570515841 and 831445511 — two EINs, one authority),
     * FLORENCE DARLINGTON TECHNICAL COLLEGE (570424007), Florence County
     * school districts 2/3/4/5 (570641055 / 570641054 / 570641053 /
     * 570641052), the Florence County disabilities board (570718156 and
     * 570718186), the alcohol and drug abuse commission (570559761) and
     * `Pee Dee Regional Aiport Authority DBA Florence Regional Airport`
     * (571076384 — the publisher's own typo, kept verbatim).
     *
     * ⭐ Checked in the bulk table: one government on this EIN — one fiscal
     * year end (06-30), one city, three auditee_name spellings
     * (`CITY OF FLORENCE, SC`, `City of Florence, SC`,
     * `City of Florence, South Carolina`). ⚠⚠ Three spellings on ten filings is
     * exactly why the join is (EIN + fiscal-year-end + report id): a name join
     * would split this city into three series or drop two of them.
     */
    facEin: '576000232',
    censusName: 'Florence',
    /**
     * ⭐ JULY, confirmed three ways: `fy_end_date` 06-30 and `fy_start_date`
     * 07-01 on all ten filings, the FAC census records
     * `SC,Florence,municipality,annual,7` across audit years 1998-2020 and
     * 2022-2025, and each statement states its own period. ⚠ The census has no
     * 2021 row — a census gap, not a disagreement.
     */
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage: 'https://www.cityofflorencesc.gov/finance-department',
    facReports: {
      2016: '2016-06-CENSUS-0000170511',
      2017: '2017-06-CENSUS-0000170511',
      2018: '2018-06-CENSUS-0000170511',
      2019: '2019-06-CENSUS-0000170511',
      2020: '2020-06-CENSUS-0000170511',
      2021: '2021-06-CENSUS-0000170511',
      2022: '2022-06-CENSUS-0000170511',
      2023: '2023-06-GSAFAC-0000019341',
      2024: '2024-06-GSAFAC-0000356681',
      2025: '2025-06-GSAFAC-0000397355',
    },
  },
  {
    key: 'hilton-head',
    /**
     * ⚠ A TOWN — `Hilton Head Island town` in the Census place file and
     * `TOWN OF HILTON HEAD ISLAND` in its own filings. Same call as Mount
     * Pleasant and Summerville: `treasury_ensure_municipality` keys on
     * (name, state, entity_type), so the type is part of this government's
     * identity and flattening it to `city` would create a different row.
     * The source label is therefore `Town of Hilton Head Island ACFR — ...`.
     */
    name: 'Hilton Head Island',
    entityType: 'town',
    extractor: 'scripts/extractHiltonHeadSC.py',
    state: SC_CITY_STATE,
    population: 38158,
    censusPlace: '34045',
    /**
     * ⭐ ONE SUMLEV-157 row (county 013), so this town does not straddle a
     * county line — unlike Florence. Beaufort County is FIPS 45013.
     */
    parentCountyName: 'Beaufort County',
    /**
     * ⚠⚠ THE NAME TRAP HERE IS A PUBLIC SERVICE DISTRICT, NOT A WATERWORKS:
     *
     *     570752325  TOWN OF HILTON HEAD ISLAND                 <- wanted
     *     570680099  Hilton Head No. 1 Public Service District  <- a SEPARATE
     *                                                              government
     *
     * The PSD is a real independent special-purpose district filing its own
     * audited statements (one filing, audit year 2025). It does NOT share this
     * EIN, so it is a name-search trap only — but it is the third occurrence of
     * the Charleston CPW / Mount Pleasant Waterworks shape in this campaign.
     *
     * ⭐ Checked in the FAC bulk table: ONE government on this EIN, ONE fiscal
     * year end (06-30), and THREE auditee_name spellings —
     * `TOWN OF HILTON HEAD ISLAND, SOUTH CAROLINA`,
     * `TOWN OF HILTON HEAD ISLAND` and `Town of Hilton Head Island, South
     * Carolina`. A name join would split this town into three series.
     *
     * ⚠⚠ AND ITS UEI IS NOT STABLE ACROSS THE WINDOW: `GSA_MIGRATION` through
     * FY2021, `CCGUAVLGD1G9` from FY2022. The (EIN + audit_year + fy_end + UEI)
     * key is the right one for asking whether a GOVERNMENT-YEAR has a second
     * filing, but it must never be used to group a SERIES across years — do
     * that and this town reads as two governments. Asked here: 8 filings,
     * ZERO duplicate government-years. Sumter's reissue does not recur.
     */
    facEin: '570752325',
    censusName: 'Hilton Head Island',
    /**
     * ⭐ JULY, confirmed on every filing: `fy_end_date` 06-30 on all eight FAC
     * filings, and the town's own FY2020 document states `Fiscal Year Ended
     * June 30, 2020` on its cover and in its PDF metadata. No mid-window change
     * of the Summerville kind.
     */
    fiscalYearStartMonth: 7,
    monthStatus: 'confirmed',
    publicationPage:
      'https://hiltonheadislandsc.gov/government/finance/annual_comprehensive_financial_reports.php',
    facReports: {
      2017: '2017-06-CENSUS-0000201322',
      2018: '2018-06-CENSUS-0000201322',
      2019: '2019-06-CENSUS-0000201322',
      2021: '2021-06-CENSUS-0000201322',
      2022: '2022-06-CENSUS-0000201322',
      2023: '2023-06-GSAFAC-0000017854',
      2024: '2024-06-GSAFAC-0000347727',
      2025: '2025-06-GSAFAC-0000397601',
    },
    /**
     * ⭐⭐ THE FIRST YEAR IN THIS CAMPAIGN LOADED FROM THE ISSUER INSTEAD OF FAC.
     *
     * FY2020 has no federal Single Audit filing under this EIN, and the recorded
     * coverage figure for this town was "8 of 10" because of it. The town
     * publishes that year ITSELF, and it is the real document — verified before
     * it was believed:
     *
     *     12,108,104 bytes, magic `%PDF-`, 162 pages
     *     cover      `Town of Hilton Head Island, South Carolina /
     *                 COMPREHENSIVE ANNUAL FINANCIAL REPORT /
     *                 Fiscal Year Ended June 30, 2020`
     *     PDF Author `Town of Hilton Head Island`
     *     acfrDocQuality  1,922 ch/pg · 56.0% vocab · 0.0 welds · 73 stmt pages
     *
     * ⚠⚠ A YEAR REACHABLE AT THE ISSUER IS NOT AUTOMATICALLY A YEAR THAT CAN
     * SHIP. North Charleston's FY2018 passes all four checks at its own
     * publisher and STILL cannot be loaded, because its expenditure statement
     * prints no General Fund figure for two functions. Fetch, then MEASURE.
     *
     * ⚠ A year may appear here or in `facReports`, NEVER BOTH — two publishers
     * for one government-year is ambiguous provenance, and the fetcher refuses
     * it rather than picking. (The town also republishes FY2021-FY2025, which
     * FAC already serves; those are deliberately NOT listed, so every year has
     * exactly one recorded source. The full listing is kept for the record in
     * `HILTON_HEAD_SELF_PUBLISHED`.)
     */
    selfPublishedReports: Object.freeze({
      2020: Object.freeze({
        url: 'https://hiltonheadislandsc.gov/Documents/Government/Town%20Finances/ACFR/ACFRs/FY2020CAFR.pdf',
        why: 'no filing under EIN 570752325 in the Federal Audit Clearinghouse; '
          + "fetched from the town's own ACFR listing",
      }),
    }),
  },
]);

/**
 * Years FAC does not serve for an entity, recorded with the reason.
 *
 * ⚠ A gap is DECLARED, never written as $0 and never silently skipped. These two
 * are simply absent from the federal record for this EIN — Mount Pleasant's
 * earliest filing there is FY2018.
 */
export const SC_CITY_COVERAGE_GAPS = Object.freeze({
  'mount-pleasant': {
    2016: 'no filing under EIN 576001079 in the Federal Audit Clearinghouse',
    2017: 'no filing under EIN 576001079 in the Federal Audit Clearinghouse',
  },
  // ⚠ Summerville and Goose Creek file a Single Audit only in years they expend
  // >= $750k of federal awards, so their FAC coverage is genuinely intermittent —
  // six years each, not ten. Absence here is absence of a FEDERAL filing, NOT
  // evidence the government published no ACFR. Their own sites may carry the
  // missing years; that is a follow-up, never a reason to write $0.
  summerville: {
    2016: 'no filing under EIN 576001110 in the Federal Audit Clearinghouse',
    2017: 'no filing under EIN 576001110 in the Federal Audit Clearinghouse',
    2019: 'no filing under EIN 576001110 in the Federal Audit Clearinghouse',
    2021: 'no filing under EIN 576001110 in the Federal Audit Clearinghouse',
  },
  'goose-creek': {
    2017: 'no filing under EIN 576008064 in the Federal Audit Clearinghouse',
    2018: 'no filing under EIN 576008064 in the Federal Audit Clearinghouse',
    2019: 'no filing under EIN 576008064 in the Federal Audit Clearinghouse',
    2020: 'no filing under EIN 576008064 in the Federal Audit Clearinghouse',
  },
  /**
   * ⚠⚠ HILTON HEAD'S TWO FAC GAPS DO NOT HAVE THE SAME CAUSE, AND ONLY ONE IS
   * A COVERAGE GAP. The recorded figure for this town was "8 of 10"; asking the
   * question per YEAR at BOTH publishers — the North Charleston discipline —
   * turned it into NINE.
   *
   *   FY2016  absent at FAC and absent from the town's own ACFR listing, which
   *           starts at FY2020. A genuine gap, and the ONLY one.
   *   FY2020  absent at FAC, but the TOWN PUBLISHES IT ITSELF — so it is NOT a
   *           coverage gap and is deliberately absent from this map. It loads
   *           from `selfPublishedReports`. See that field for its evidence.
   *
   * ⭐⭐ THE GENERAL POINT: "8 of 10" was a measurement of ONE PUBLISHER, and it
   * was recorded as if it were a measurement of the YEAR. Asking per year at
   * BOTH publishers — the North Charleston discipline — moved this town to NINE.
   */
  'hilton-head': {
    2016: 'no filing under EIN 570752325 in the Federal Audit Clearinghouse, '
      + "and the town's own ACFR listing begins at FY2020",
  },
});

/**
 * ⭐ The town's own ACFR listing, which covers FY2020-FY2025 and therefore
 * OVERLAPS the federal record everywhere except FY2020.
 *
 * ⚠ Spaces MUST be percent-encoded — the North Charleston lesson; unencoded,
 * curl returns 000. ⚠ The listing decorates each href with a `?t=` cache-buster
 * that is NOT required to fetch the bytes and is deliberately not recorded.
 *
 * ⚠⚠ A year reachable here is NOT automatically a year that can ship. North
 * Charleston's FY2018 passed all four document-quality checks at the town's
 * publisher and still could not be loaded, because its expenditure statement
 * prints no General Fund figure for two functions. Fetch, then MEASURE.
 */
export const HILTON_HEAD_SELF_PUBLISHED = Object.freeze({
  base: 'https://hiltonheadislandsc.gov/Documents/Government/Town%20Finances/ACFR/ACFRs',
  files: Object.freeze({
    2020: 'FY2020CAFR.pdf',
    2021: 'FY2021CAFR.pdf',
    2022: 'FY2022ACFR.pdf',
    2023: 'FY2023ACFR.pdf',
    2024: 'FY2024ACFR.pdf',
    2025: 'FY2025ACFR.pdf',
  }),
});

/**
 * ⚠⚠ ONE GOVERNMENT-YEAR, TWO ACCEPTED FILINGS, AND EVERY TIE GATE PASSES BOTH.
 *
 * Sumter FY2024 is the campaign's first. The Federal Audit Clearinghouse serves
 * ELEVEN filings for this EIN's ten years, and the extra one is not a collision
 * with another government (the Rock Hill case) — it is the same city, the same
 * UEI, the same 06-30 year end, the same auditor, filed twice:
 *
 *     2024-06-GSAFAC-0000344027  accepted 2024-12-16  128 pp
 *                                PDF title `ACFR City of Sumter 2024 Final`
 *     2024-06-GSAFAC-0000392867  accepted 2025-12-17  130 pp   <- LOADED
 *                                PDF title `ACFR City of Sumter 2024 - Reissued`
 *
 * ⚠⚠ FAC ITSELF DOES NOT MARK EITHER AS SUPERSEDED. Both carry
 * `resubmission_version 1` and `resubmission_status most_recent`, so the field
 * built for exactly this question answers it wrongly. They differ in
 * `fac_accepted_date` (a year apart), in `total_amount_expended` (1,440,456 vs
 * 3,205,394), in `oversight_agency` (16 vs 21) and in
 * `is_internal_control_material_weakness_disclosed` (No vs Yes).
 *
 * ── ⚠⚠ AND THE REISSUE MOVES GENERAL FUND MONEY BETWEEN CATEGORIES ─────────
 *
 * Diffed page for page. The General Fund statement of revenues, expenditures and
 * changes in fund balances differs in exactly four line items:
 *
 *     Current > General government administration   8,950,216 -> 8,981,421   +31,205
 *     Current > Public safety and law enforcement   25,601,510 -> 25,829,460  +227,950
 *     Capital Outlay > Public safety                3,721,022 -> 3,493,072   -227,950
 *     Capital Outlay > Economic development         858,893 -> 827,688       -31,205
 *
 * A reclassification out of capital outlay and into current, offsetting to the
 * dollar. **Total expenditures (64,284,680), total revenues (85,437,318), every
 * other line and every fund balance are IDENTICAL in the two documents.**
 *
 * ⚠⚠ SO THE TIE GATE CANNOT TELL THEM APART — it passes at exactly $0 on both,
 * and so would a total-only oracle, a row count and a leaf-sum check. Loading
 * the superseded copy would have published $227,950 of public safety CAPITAL
 * spending as CURRENT operating spending, with every gate green. This is the
 * `project_austin_travis_onboarding` lesson (a tautological check) reaching a
 * new place: the arithmetic is internally consistent in BOTH documents, so
 * arithmetic is not what decides. The RECORD decides.
 *
 * ⭐ THREE INDEPENDENT REASONS THE REISSUE IS THE REPORT OF RECORD:
 *   1. its own PDF title says `- Reissued` and the other says `Final`;
 *   2. FAC accepted it a year later, 2025-12-17 against 2024-12-16;
 *   3. ⭐ THE CITY'S OWN SITE PUBLISHES THE REISSUE AND NOT THE OTHER —
 *      `acfr-city-of-sumter-2024-reissued.pdf` is the only FY2024 document on
 *      sumtersc.gov/finance/financial-reports-budgets. The issuer's own answer to
 *      "which one is your annual report" needed no inference.
 *
 * ⭐ CHECKED ACROSS THE WHOLE FAMILY, not just here: every one of the 90 report
 * ids recorded in this module and in scAcfrSources.mjs was resolved in the bulk
 * table and grouped by (EIN + audit_year + fiscal-year-end + UEI). NO other
 * loaded government-year carries a second filing, so no already-loaded row is
 * built on a superseded document. The nine multi-filing EIN-years all belong to
 * the known Rock Hill collision — two governments sharing one EIN, which is a
 * different defect with a different fix.
 * ⚠ Charleston FY2025 is the one recorded id absent from the bulk snapshot; bulk
 * lags recent filings, as wave 1 recorded.
 */
export const SC_CITY_SUPERSEDED_REPORTS = Object.freeze({
  sumter: Object.freeze({
    2024: Object.freeze({
      supersededReportId: '2024-06-GSAFAC-0000344027',
      loadedReportId: '2024-06-GSAFAC-0000392867',
      pdfTitles: Object.freeze({
        '2024-06-GSAFAC-0000344027': 'ACFR City of Sumter 2024 Final',
        '2024-06-GSAFAC-0000392867': 'ACFR City of Sumter 2024 - Reissued',
      }),
      /** ⚠⚠ Both documents tie at $0. Only the split differs. */
      generalFundReclassification: Object.freeze({
        'Current > General government administration': 31205,
        'Current > Public safety and law enforcement': 227950,
        'Capital Outlay > Public safety': -227950,
        'Capital Outlay > Economic development': -31205,
      }),
      unchanged: Object.freeze({
        totalRevenues: 85437318,
        totalExpenditures: 64284680,
      }),
      evidence: 'the PDF title says `- Reissued`; FAC accepted it a year later; and '
        + "the city's own publication page carries only this document for FY2024",
    }),
  }),
});

/**
 * ⚠⚠ NORTH CHARLESTON IS DEFERRED, DIAGNOSED, AND NOT LOADED.
 *
 * Its documents were fetched and measured like the other two; it is held back on
 * evidence, not for lack of time. Recorded here in full so the next session
 * starts from the diagnosis instead of repeating it.
 *
 * ── 1. THREE YEARS ARE IMAGE-ONLY SCANS AT **BOTH** PUBLISHERS ─────────────
 *
 *   FY2019  FAC 120 chars/page · the city's own copy **1 char/page** (150 pages,
 *           no text layer at all)
 *   FY2020  FAC 118 chars/page · city 226 chars/page
 *   FY2023  FAC 238 chars/page · city 129 chars/page
 *
 * Against 1,877-2,378 chars/page for the seven readable years. ⚠ Their VOCABULARY
 * scores are HIGH (58-60%) — the Harrison County pattern, where a single clean
 * cover page masks an all-image document. The density check is what caught them.
 *
 * ⭐ Two publishers were checked before declaring this, per the rule that quality
 * is a property of the COPY, not only the issuer — and here BOTH copies are
 * damaged, so the damage is North Charleston's own. It scans its ACFR some years.
 * Following the Columbia SC FY2019 precedent, these are gaps: recovering them
 * means OCRing a scan and trusting money read off an image.
 *
 * ── 2. ⚠⚠ THE SEVEN "READABLE" YEARS PASS EVERY QUALITY GATE AND STILL CARRY
 *         SYSTEMATIC OCR DAMAGE IN THE STATEMENT TABLE ────────────────────────
 *
 * This is the finding worth carrying forward. FY2024 scores 2,290 chars/page,
 * 54.4% vocabulary, 0.4 welded tokens/page and 87 pages holding a numeric
 * statement — it passes all four checks comfortably — and its General Fund
 * statement page prints:
 *
 *     `Licenses and pennits`                        (rn read as nn)
 *     `,........ Lease & SBIT A liability principal`
 *     `Total revenues l,`
 *     a bare `N` on its own line
 *
 * and puts several rows' money on a DIFFERENT text line from their label.
 *
 * ⚠⚠ SO A WHOLE-DOCUMENT QUALITY GATE DOES NOT PROVE THE STATEMENT PAGE IS
 * CLEAN. The four checks average over 176 pages; the damage is concentrated in
 * the few tabular pages that matter, and a page-level lexical score does not
 * separate them either (this statement page scores 73% vocabulary — HIGHER than
 * Charleston's 69% — because 187 tokens is too small a sample). This is a real
 * blind spot in the gate, not a reason to distrust it: the gate did its job on
 * the three scans.
 *
 * ── 3. WHAT ACTUALLY HAPPENS ON EXTRACTION ────────────────────────────────
 *
 * With the same config shape that works for Charleston and Mount Pleasant, 6 of
 * 14 extractions succeed and tie at $0; 8 fail:
 *
 *   FY2016  operating  'row has a General Fund value (59084783) but no usable
 *                       label' — the label was lost to OCR
 *   FY2017  both       'primary GF statement not found' — the title regex cannot
 *                       see the damaged heading; needs a statement_anchor
 *   FY2018  operating  parse error
 *   FY2021  operating  parse error
 *   FY2024  revenue    parse error
 *
 * ⚠⚠ AND THE SUCCESSFUL ONES ARE NOT THEREFORE SAFE. A tie proves the READ, not
 * the LABELS, and `Licenses and pennits` would be PUBLISHED to a reader exactly
 * as extracted. Repairing it needs an exact `label_fixes` entry per damaged
 * string per year, each verified against the printed page.
 *
 * ⚠ Loading only the 3 fully-clean years would give a reader a 10-year city with
 * a 3-year series full of holes, which is worse than not shipping it.
 */
/**
 * ⭐ WAVE 3's TWO BLOCKERS WERE **LIBRARY** GAPS, AND THEY ARE FIXED.
 *
 * Kept because the distinction is the lesson, not the outcome. Waves 1 and 2
 * were per-entity CONFIGURATION; these two were the first SC cities whose
 * statements needed a change to the SHARED extractors — used by ~40 entities
 * across merged milestones — so the fix got its own scoped change with every
 * existing entity re-extracted and proved byte-identical (238 of 242 unchanged;
 * the 4 that moved are Mecklenburg FY2013-FY2016 `zero_rows` ORDER only, same
 * set, same tree, same totals).
 *
 * ⚠ The regression run is not ceremony: it caught a defect the nesting fix
 * itself introduced, where a WELDED label carried the indent of the printed line
 * holding the money rather than the line where its label starts, and Charlotte
 * FY2022/FY2023 published one category's money under another. It tied at $0.
 */
export const SC_CITY_LIBRARY_FIXES = Object.freeze({
  summerville: {
    wasBlockedBy: 'three-level expenditure hierarchy that neither shared reader could render',
    fix: '`acfrGfCoords._nested` now nests to whatever depth the page prints, measuring '
       + 'depth against the OPEN GROUP rather than the section root.',
    /** ⭐ Settled empirically, so it need not be re-asked. */
    fiscalYearChangeover: 'The town moved from a December to a June fiscal year, and '
      + 'FY2022 is NOT a short stub: revenue runs 32.9M (FY2020, Dec) -> 37.7M (FY2022, '
      + 'Jun) -> 40.2M -> 46.7M -> 50.8M. A six-month period would be ~18M. The '
      + 'transition fell in FY2021, which FAC does not hold. The document says "FOR THE '
      + 'FISCAL YEAR ENDED JUNE 30, 2022" and carries no transition-period language.',
    /** ⚠ CORRECTION to the wave-3 diagnosis, which said the `-table` reader could not
     *  read this issuer at all. It cannot with `column_strategy='positional'`; with
     *  `ordinal` it reads all twelve and agrees to the dollar. What it still cannot do
     *  is carry the THREE-LEVEL SHAPE, which is the real reason for the coordinate
     *  reader — and a better reason, because arithmetic alone would not have justified
     *  the move. */
    corroboration: 'the -table reader agrees on all 12 totals; it flattens the middle level',
  },
  'goose-creek': {
    wasBlockedBy: 'a printed revenue subtotal that neither shared reader suppressed',
    fix: '`cfg.subtotal_prefixes` now applies to `build_revenue` as well as '
       + '`build_operating`, where each subtotal is CHECKED against the sum of the group '
       + 'it closes rather than merely skipped.',
    /** ⭐ The check is a free extra oracle: six years confirm their own subtotal. */
    corroboration: 'the printed `Total local revenues` equals its own six children exactly, every year',
  },
});

/**
 * ⚠⚠ NORTH CHARLESTON'S DEFERRAL BLAMED THE WRONG THING, AND THAT IS THE LESSON.
 *
 * It was held back as "OCR-damaged statement tables in every readable year". The
 * glyphs are CLEAN on the years that matter; two of the three defects were
 * MECHANICAL properties of the shared reader:
 *
 *   1. `lines_of` used SINGLE-LINKAGE clustering, so a word printed BETWEEN two
 *      statement rows bridged them. FY2016 merged `Property taxes` and
 *      `Licenses and permits` into one row for 4,419,364,731,548,834 because
 *      another fund's figure sat 3.40pt below one and 3.47pt above the other.
 *   2. Page furniture at x0 ~32 poisoned `min(indents)`, dragging the section
 *      root 26pt left so every genuine row read as "an indented row with no open
 *      parent".
 *
 * Only the third was a document defect: a leading `1` rendered as the letter
 * `I`. ⭐ THE GENERAL LESSON: "the document is damaged" is a CONCLUSION, and it
 * needs the same evidence as any other. Read the glyphs before accepting it.
 */
/**
 * ⚠⚠ GREER IS NOT HERE, AND THE REASON CORRECTS A PREMISE THIS CAMPAIGN CARRIED.
 *
 * Greer is SC's NINTH LARGEST incorporated place (46,316, Census PEP 2024), so by
 * population it is the next city after Goose Creek. It is absent because
 * **THE CITY OF GREER HAS NO FEDERAL SINGLE AUDIT FILING IN THE LOADABLE
 * WINDOW.** The FAC bulk table was searched by NAME and by LOCATION and returns
 * only three Greer entities, none of them the city:
 *
 *     134349419  GREER MIDDLE COLLEGE CHARTER HIGH SCHOOL
 *     570474477  HOUSING AUTHORITY OF GREER
 *     576001040  Greer CPW            <- the Commission of Public Works, a
 *                                        SEPARATE government with its own ACFR;
 *                                        the Charleston `Commissioners of Public
 *                                        Works` trap, in a second city
 *
 * The FAC fiscal-year census records Greer filing exactly ONCE, in audit year
 * 2002 (`SC,Greer,municipality,annual,7`). A Single Audit is required only when
 * federal awards reach $750k, and Greer's evidently have not since.
 *
 * ⚠⚠ SO "TOP-30 BY POPULATION ALL HAVE FAC COVERAGE" IS FALSE. It was true of
 * every city checked before Greer, which is exactly how a sampled claim becomes
 * a general one. Coverage must be checked per entity, not inherited.
 *
 * ── WHY THE CITY'S OWN SITE DID NOT RESCUE IT (checked, not assumed) ──────
 *
 * `cityofgreersc.gov` answers every request with a 3,038-byte bot-challenge, its
 * document listing is rendered by JavaScript so only the page shell is
 * retrievable, and the legacy S3 assets that search engines indexed now return
 * HTTP 403. Exactly ONE document proved reachable, on a different asset host:
 * FY2025, verified as the CITY's own ACFR (133 pages, June 30 year end, 130
 * mentions of `City of Greer` and none of `Commission of Public Works`).
 *
 * ⚠ One year is not a series, and the campaign has twice judged even three years
 * of ten to be worse than not shipping. Greer waits for a route that can serve
 * the series, not for more effort against the same wall.
 */
export const SC_CITY_NO_FEDERAL_FILING = Object.freeze({
  greer: {
    population: 46316,
    censusPlace: '30985',
    lastFacAuditYear: 2002,
    fiscalYearStartMonth: 7,
    monthEvidence: 'FAC census `SC,Greer,municipality,annual,7`, audit year 2002 only',
    /** ⚠ NOT the city. Recorded so nobody joins on the name and loads it. */
    notThisGovernment: Object.freeze({
      '576001040': 'Greer CPW — the Commission of Public Works, a separate government',
      '570474477': 'HOUSING AUTHORITY OF GREER',
      '134349419': 'GREER MIDDLE COLLEGE CHARTER HIGH SCHOOL',
    }),
    reachableDocument: 'FY2025 only, via files-backend.assets.thrillshare.com; the '
      + 'listing that would give the other years is JavaScript-rendered behind a bot '
      + 'challenge and its asset ids are opaque UUIDs that cannot be derived.',
  },
});

/**
 * ⚠⚠ COORDINATE ENTITIES THAT CANNOT HAVE A `-table` CORROBORATOR, DECLARED.
 *
 * The campaign's rule is that an entity on `acfrGfCoords.py` keeps being
 * corroborated by `acfrGF.py` on every year the grid reader can still read, or
 * the move is unfalsifiable. Rock Hill and Spartanburg are corroborated that
 * way. Sumter cannot be, and the reason is a property of the DOCUMENTS.
 *
 * ⚠⚠ THIS MAP EXISTS BECAUSE THE GATE USED TO SKIP SUCH AN ENTITY IN SILENCE.
 * `verifyScCityReaders.mjs` selects entities by `.filter(e =>
 * e.corroboratingExtractor)`, so a coordinate entity that simply declared none
 * was not checked and nothing said so — the campaign's own recurring defect (a
 * gate that measures nothing), one more time. The gate now REQUIRES every
 * coordinate entity to appear either with a corroborating extractor or here,
 * and it fails on an entry that turns out not to be needed, exactly as
 * `READER_DISAGREEMENTS` fails on a declared-but-unobserved disagreement.
 */
export const SC_CITY_NO_TABLE_CORROBORATOR = Object.freeze({
  sumter: Object.freeze({
    why: '`pdftotext -table` renders the statement page letter-spaced in every one '
      + 'of the ten years (`Re ve nue s`, `T otal revenues`, `Go v ern men t al`), so '
      + 'the acfrGF revenue banner and total-anchor patterns match nothing, and '
      + '`acfrGF.classify` then refuses the page because the printed page number '
      + 'lands in the General Fund column. It fails LOUDLY rather than producing a '
      + 'wrong shape, which is correct — but it means there is no second reading.',
    /** ⚠ The workaround the library already refuses, recorded so it is not retried. */
    refusedWorkaround: 'de-letter-spacing the text layer would be a fuzzy label repair; '
      + 'CityConfig.label_fixes declines that trade explicitly, and '
      + 'repair_ocr_whitespace closes split thousands groups only, never letters.',
    /** ⭐ What checks it instead, and what that is worth. */
    substitute: 'scripts/verifyScCityExcess.py — the printed `Excess '
      + '(deficiency) of revenues over (under) expenditures` line THE CITY ITSELF '
      + 'derived, which equals the two '
      + 'extracted totals on 10 of 10 years. It binds the two SIDES together, which '
      + 'the tie gate does not (the tie compares each side against its own printed '
      + 'total, so a side read from a neighbouring fund column still ties at $0). '
      + 'Its honest limit: two errors equal in size and identical in sign, one per '
      + 'side, would survive it.',
    substituteResult: '10 of 10 Sumter years exact, 20 of 20 across wave 4',
  }),
});

export const SC_CITY_READER_HISTORY = Object.freeze({
  'north-charleston': {
    wasBlockedBy: 'diagnosed as OCR-damaged statement tables in every readable year',
    actualCause: 'single-linkage row chaining and left-margin page furniture in the '
      + 'SHARED coordinate reader, plus one genuine text-layer defect (a leading `1` '
      + 'rendered as the letter `I`)',
    fix: '`row_gap`, `left_margin` and `ocr_leading_one` on CoordsConfig, each opt-in '
      + 'and each defaulting to the behaviour every other entity already had.',
    /** ⚠ The six gaps are REAL and were checked at both publishers. */
    loadedYears: Object.freeze([2021, 2022, 2024, 2025]),
  },
});

export const SC_CITY_DEFERRED = Object.freeze({});

/** Wave-1 entities that are actually loaded. */
export function scCityLoadableEntities() {
  return SC_CITY_ENTITIES.filter((e) => !(e.key in SC_CITY_DEFERRED));
}

/**
 * The fiscal month for ONE entity-year.
 *
 * ⚠⚠ NOT a per-entity constant. Summerville changed its fiscal year inside the
 * loaded window — 12-31 year ends through FY2020, 06-30 from FY2022 — so a single
 * month per entity would put a January-starting year under a July label. That
 * error moves no dollar and fails no tie gate, which is precisely why
 * project_fysm_column_default_one_defect exists.
 */
export function fiscalMonthFor(entity, fiscalYear) {
  const o = entity.fiscalMonthOverrides;
  if (o && Object.prototype.hasOwnProperty.call(o, fiscalYear)) return o[fiscalYear];
  return entity.fiscalYearStartMonth;
}

export function scCityByKey(key) {
  return SC_CITY_ENTITIES.find((e) => e.key === key) ?? null;
}

/**
 * Every fiscal year this entity has a DOCUMENT for, from EITHER publisher.
 *
 * ⚠⚠ USE THIS, NEVER `Object.keys(entity.facReports)`. Wave 5 introduced a second
 * publisher (`selfPublishedReports`, for a year FAC does not serve) and there
 * were FOUR places iterating `facReports` directly — the fetcher, the extraction
 * driver, the loader and the reader gate. Wiring only the fetcher meant the
 * document was fetched and then silently skipped by the other three: 184
 * extractions where 186 were expected, no error, no failing tie, and the year
 * simply absent. The count is the only thing that showed it.
 *
 * ⭐ THE GENERAL LESSON, and it is the SECOND time this campaign has learned it
 * (see `fiscalMonthFor` in wave 3): AFTER ADDING A NEW SOURCE OF TRUTH, GREP FOR
 * EVERY CALL SITE OF THE OLD ONE — and then give them one function to call, so
 * the next publisher cannot reintroduce the same divergence.
 */
export function scCityYearsFor(entity) {
  return [...new Set([
    ...Object.keys(entity.facReports || {}).map(Number),
    ...Object.keys(entity.selfPublishedReports || {}).map(Number),
  ])].sort((a, b) => a - b);
}

/**
 * Every (entity, fiscalYear) the wave intends to LOAD. Deferred entities are excluded.
 *
 * ⚠⚠ THIS MUST ENUMERATE BOTH PUBLISHERS. Wave 5 added `selfPublishedReports`
 * for Hilton Head FY2020 and wired it into `fetchScCityWaveAcfrs.mjs` — and this
 * function still read `facReports` alone, so the document would have been
 * fetched, quality-checked and then SILENTLY NEVER LOADED. No tie would fail and
 * no total would move; the year would just quietly not exist.
 *
 * ⭐ That is `fiscalMonthFor()`'s lesson from wave 3, repeating one wave later:
 * AFTER ADDING A NEW SOURCE OF TRUTH, GREP FOR EVERY CALL SITE OF THE OLD ONE.
 * `facReports` is read here, in the fetcher, and in the manifest check.
 *
 * ⚠ `reportId` is null for a self-published year, and `publisher` says which is
 * which, so no caller can mistake an issuer-served document for a federal filing.
 */
export function scCityFilings() {
  const out = [];
  for (const e of scCityLoadableEntities()) {
    const years = new Set([
      ...Object.keys(e.facReports || {}).map(Number),
      ...Object.keys(e.selfPublishedReports || {}).map(Number),
    ]);
    for (const fy of [...years].sort((a, b) => a - b)) {
      const reportId = e.facReports?.[fy] ?? null;
      out.push({
        entity: e,
        fiscalYear: fy,
        reportId,
        publisher: reportId ? 'fac' : 'self',
      });
    }
  }
  return out;
}
