/**
 * Knight session 8 — the six GAAP entities.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⚠ BROWN COUNTY SD IS NOT HERE. It is the session's one OCBOA filer and was
 * loaded first, through scripts/data/sdKnightEntities.mjs +
 * scripts/loadSdAcfrs.mjs, because it needed the `audited_ocboa` vocabulary
 * value that did not exist yet. Its rows are already live and registered; do
 * not re-load it from here.
 *
 * ── FOUR STATES, TWO FISCAL CALENDARS, AND THEY DO NOT FOLLOW THE STATE ────
 *
 *     Aberdeen SD / Grand Forks ND / Grand Forks County ND   month 1
 *     Biloxi MS / Harrison County MS                         month 10
 *     Lexington-Fayette KY                                   month 7
 *
 * Every month is read off each document's own "For the year ended ..." caption
 * and independently confirmed against the FAC census, except Lexington-Fayette,
 * which is ABSENT FROM THE KY CENSUS ENTIRELY (244 KY rows, none matching) and
 * whose July-June year came from live FAC filings instead — first-party, and
 * stronger than the census would have been.
 *
 * ⚠ Never carry a month between these. Michigan put a city at month 7 and its
 * own parent county at month 10 one session earlier.
 *
 * ── ⚠⚠ NAME TRAPS, ALL LIVE ────────────────────────────────────────────────
 *
 * ABERDEEN, MARYLAND publishes its own ACFR at aberdeenmd.gov.
 * LEXINGTON COUNTY, SOUTH CAROLINA publishes a CAFR at lex-co.sc.gov.
 * FIVE SIBLING GOVERNMENTS share the Lexington-Fayette name — the transit
 * authority, housing authority, health department, airport board and community
 * action council. **EIN 610858140 is the government.**
 * HARRISON COUNTY SCHOOL DISTRICT and the PAT HARRISON WATERWAY DISTRICT both
 * answer to a "Harrison" query; **EIN 646000425 is the county.**
 * GRAND FORKS has a school district, an AIR FORCE BASE school district, a
 * housing authority, an airport authority and an MPO. The city is 456002085 and
 * the county 456002215.
 *
 * ── POPULATIONS ────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same
 * program and vintage as every other entity in this campaign.
 *   Places   sub-est2024_46 (SD) / _28 (MS) / _38 (ND) / _21 (KY), SUMLEV=162
 *   Counties co-est2024-alldata.csv, SUMLEV=050
 */

/** @type {readonly object[]} */
export const S8_ENTITIES = Object.freeze([
  Object.freeze({
    key: 'aberdeen',
    name: 'City of Aberdeen',
    state: 'SD',
    entityType: 'city',
    censusName: 'Aberdeen',
    fiscalYearStartMonth: 1,
    population: 27919,
    /** ⚠ Brown County is ALREADY IN THE DATABASE from the OCBOA load, so this
     *  link is resolved by lookup rather than created in this batch. */
    parentCountyName: 'Brown County',
    parentCountyState: 'SD',
    parentCountyKey: null,
    family: 'sd-local-acfr-gf',
    basisLabel: 'GAAP basis',
  }),
  Object.freeze({
    key: 'harrisoncounty',
    name: 'Harrison County',
    state: 'MS',
    entityType: 'county',
    censusName: 'Harrison County',
    fiscalYearStartMonth: 10,
    population: 213730,
    parentCountyName: null,
    parentCountyKey: null,
    family: 'ms-local-acfr-gf',
    basisLabel: 'GAAP basis',
  }),
  Object.freeze({
    key: 'biloxi',
    name: 'City of Biloxi',
    state: 'MS',
    entityType: 'city',
    censusName: 'Biloxi',
    fiscalYearStartMonth: 10,
    population: 48144,
    parentCountyName: null,
    parentCountyKey: 'harrisoncounty',
    family: 'ms-local-acfr-gf',
    basisLabel: 'GAAP basis',
  }),
  Object.freeze({
    key: 'grandforkscounty',
    name: 'Grand Forks County',
    state: 'ND',
    entityType: 'county',
    censusName: 'Grand Forks County',
    fiscalYearStartMonth: 1,
    population: 73771,
    parentCountyName: null,
    parentCountyKey: null,
    family: 'nd-local-acfr-gf',
    basisLabel: 'GAAP basis',
  }),
  Object.freeze({
    key: 'grandforks',
    name: 'City of Grand Forks',
    state: 'ND',
    entityType: 'city',
    censusName: 'Grand Forks',
    fiscalYearStartMonth: 1,
    population: 59845,
    parentCountyName: null,
    parentCountyKey: 'grandforkscounty',
    family: 'nd-local-acfr-gf',
    basisLabel: 'GAAP basis',
  }),
  Object.freeze({
    key: 'lfucg',
    /** ⚠ A CONSOLIDATED city-county: ONE entity in the roster, not a city plus
     *  a county. Recorded as `city`, matching how this campaign already carries
     *  Nashville-Davidson, Macon-Bibb, Columbus-Muscogee and Philadelphia. */
    name: 'Lexington-Fayette Urban County Government',
    state: 'KY',
    entityType: 'city',
    censusName: 'Lexington-Fayette',
    fiscalYearStartMonth: 7,
    population: 329437,
    parentCountyName: null,
    parentCountyKey: null,
    family: 'ky-local-acfr-gf',
    basisLabel: 'GAAP basis',
  }),
]);

export function s8EntityByKey(key) {
  return S8_ENTITIES.find((e) => e.key === key) || null;
}

/**
 * Fiscal years whose document extracts and ties at $0 in BOTH modes.
 *
 * ⚠ Every absence below is DIAGNOSED, not a hole in the hunt, and none is
 * written as $0. See .planning/KNIGHT-SESSION-08-DOCUMENTS.md:
 *
 *   biloxi          FY2003 the PDF letter-spaces its own text ("Total exp
 *                          enditures"), so the page finder cannot see the
 *                          statement that is plainly on p34
 *                   FY2005-08, FY2013 image-only on the city site; MS OSA's
 *                          archive begins at FY2015, so no publisher has them
 *                   FY2023 catastrophic scan — 24.4% vocabulary, ZERO numeric
 *                          statement pages, identical at FAC, the city AND MS
 *                          OSA. Unobtainable, not unfetched.
 *                   FY2024 two UNRECOVERABLE lost digits ("4,973,!09")
 *                   FY2025 residual OCR after repair; fails at +535/-802
 *   harrisoncounty  FY2018-20 the revenue section closes with a BARE NUMERIC
 *                          ROW carrying no "Total revenues" label at all
 *                   FY2015 MS OSA holds it and it is an image-only scan
 *                          (1 text page of 126)
 *                   FY2024-25 not published by ANY publisher yet
 *   aberdeen        FY2006-09 an older chart of accounts that does not parse
 *                   FY2010-15 on no route: absent from the city archive and
 *                          before FAC's coverage begins
 *   grandforkscounty FY2018-19 absent from FAC (below the $750k single-audit
 *                          threshold); the ND mirror's copy has ROTTED
 */
export const S8_WINDOWS = Object.freeze({
  aberdeen: Object.freeze([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]),
  biloxi: Object.freeze([2002, 2004, 2009, 2010, 2011, 2012, 2014, 2015,
    2016, 2017, 2018, 2019, 2020, 2021, 2022]),
  harrisoncounty: Object.freeze([2016, 2017, 2021, 2022, 2023]),
  grandforkscounty: Object.freeze([2016, 2017, 2020, 2021, 2022, 2023, 2024]),
  grandforks: Object.freeze([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]),
  lfucg: Object.freeze([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]),
});

/** extractor script per entity — the loader shells out to these. */
export const S8_EXTRACTORS = Object.freeze({
  aberdeen: 'scripts/extractAberdeenSD.py',
  biloxi: 'scripts/extractBiloxiMS.py',
  harrisoncounty: 'scripts/extractHarrisonCountyMS.py',
  grandforkscounty: 'scripts/extractGrandForksCountyND.py',
  grandforks: 'scripts/extractGrandForksND.py',
  lfucg: 'scripts/extractLexingtonFayetteKY.py',
});
