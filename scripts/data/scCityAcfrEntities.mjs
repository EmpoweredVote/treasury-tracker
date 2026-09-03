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
    /** ⚠ DEFERRED — see SC_CITY_DEFERRED. No extractor exists on purpose. */
    extractor: null,
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
    /** ⚠ DEFERRED — see SC_CITY_DEFERRED. No extractor exists on purpose. */
    extractor: null,
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
    /** ⚠ DEFERRED — see SC_CITY_DEFERRED. No extractor exists on purpose. */
    extractor: null,
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
export const SC_CITY_DEFERRED = Object.freeze({
  /**
   * ⚠⚠ DEFERRED ON A **LIBRARY** GAP, NOT A CONFIG GAP — and that is the point.
   * Waves 1 and 2 were per-entity configuration. These two are the first SC
   * cities whose statements need a change to the SHARED extractors, which are
   * used by ~40 entities across merged milestones and deserve their own scoped
   * change with every existing entity re-extracted and proved byte-identical.
   *
   * All the discovery work IS done and recorded above: EIN, every per-year report
   * id, populations, entity types, coverage gaps and the fiscal calendar. Both
   * documents are fetched and both pass all four quality checks. What is missing
   * is only the extraction.
   */
  summerville: {
    reason: 'three-level expenditure hierarchy that neither shared reader can render',
    diagnosis: [
      'The statement nests THREE deep: `Current:` > `General Government:` > '
      + '`Administrative`, with `Public Safety:` and `Roads and drainage:` as sibling '
      + 'sub-groups and `Culture and recreation` a VALUED LEAF sitting at the '
      + 'sub-group level.',
      '`acfrGF.py` (-table) cannot read this issuer at all: 14 rows that carry money '
      + 'come back $0 (FY2024 operating computes 24,184,615 against a printed '
      + '47,063,844). Its `subparents` mechanisms do not reach it either — '
      + '`subparent_member_prefixes` needs a shared suffix the children do not have, '
      + 'and `subparent_close=next_heading` swallows `Culture and recreation`.',
      '`acfrGfCoords.py` reads it correctly and ALL TWELVE extractions tie at $0 — '
      + 'but it is a TWO-LEVEL reader, so it drops the three valueless sub-headings '
      + 'and promotes their children one level, publishing `Current > Administrative` '
      + 'where the town printed `Current > General Government > Administrative`. '
      + 'Same class of shape error as Boulder, so it is not shipped.',
      'FIX: nested-group support in acfrGfCoords.py.',
    ],
    /** ⭐ Settled empirically, so the next session need not re-ask. */
    fiscalYearChangeover: 'The town moved from a December to a June fiscal year, and '
      + 'FY2022 is NOT a short stub: revenue runs 32.9M (FY2020, Dec) -> 37.7M (FY2022, '
      + 'Jun) -> 40.2M -> 46.7M -> 50.8M. A six-month period would be ~18M. The '
      + 'transition fell in FY2021, which FAC does not hold. The document says "FOR THE '
      + 'FISCAL YEAR ENDED JUNE 30, 2022" and carries no transition-period language.',
  },
  'goose-creek': {
    reason: 'a printed revenue subtotal that neither shared reader suppresses',
    diagnosis: [
      'Its revenue section groups: `Local revenues` holds six sources and is closed '
      + 'by a printed `Total local revenues` SUBTOTAL, with `State revenues` and '
      + '`Federal revenues` as root leaves after it.',
      'Read as an ordinary leaf that subtotal DOUBLE-COUNTS its own children. Every '
      + 'year fails by exactly the subtotal — FY2024 by 36,953,087, which IS `Total '
      + 'local revenues` on the printed page.',
      '⚠⚠ BOTH readers fail identically, with the same deltas, so it is not a reader '
      + 'artifact: `CityConfig.subtotal_prefixes` is applied ONLY in the expenditure '
      + 'section (acfrGF.py ~line 1836). `build_revenue` has no subtotal handling and '
      + 'no `subtotal_failures` list at all.',
      'All twelve OPERATING extractions already tie at $0 under both readers; only '
      + 'revenue is blocked.',
      'FIX: mirror the expenditure subtotal block into build_revenue — guarded by '
      + 'cfg.subtotal_prefixes so no existing entity changes, and CHECKING each '
      + 'subtotal against its own group (a free extra oracle).',
    ],
  },
  'north-charleston': {
    reason: 'OCR-damaged statement tables in every readable year, plus three '
          + 'image-only years at both publishers',
    unreadableYears: Object.freeze({
      2019: 'image-only at FAC (120 chars/page) AND at the city (1 char/page)',
      2020: 'image-only at FAC (118 chars/page) AND at the city (226 chars/page)',
      2023: 'image-only at FAC (238 chars/page) AND at the city (129 chars/page)',
    }),
    cityPublicationPage: 'https://www.northcharleston.org/government/city_departments/finance/index.php',
  },
});

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

/** Every (entity, fiscalYear) the wave intends to LOAD. Deferred entities are excluded. */
export function scCityFilings() {
  const out = [];
  for (const e of scCityLoadableEntities()) {
    for (const fy of Object.keys(e.facReports).map(Number).sort((a, b) => a - b)) {
      out.push({ entity: e, fiscalYear: fy, reportId: e.facReports[fy] });
    }
  }
  return out;
}
