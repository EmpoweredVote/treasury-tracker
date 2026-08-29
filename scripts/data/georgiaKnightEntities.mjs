/**
 * Georgia — the four session-4 entities (Knight campaign).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * Three Knight communities (Macon-Bibb, Columbus-Muscogee, Milledgeville) plus
 * Milledgeville's parent county, Baldwin. These are GEORGIA'S FIRST LOCAL
 * ENTITIES in TT; before this session the state had only its state node from
 * the state-ACFR arc.
 *
 * ── ⚠⚠ `cicoid` IS THE JOIN KEY, NEVER `name` ───────────────────────────────
 *
 * Georgia DCA assigns each government a numeric CICOID — `1xxxxxx` counties,
 * `2xxxxxx` municipalities, `3xxxxxx` consolidated governments — then a
 * three-digit county number and a sequence. The 721-option dropdown contains
 * four near-misses for these four entities, each a DIFFERENT government:
 *
 *   `Macon County`  (1096096)  a separate county, pop 11,831 — NOT Macon-Bibb
 *   `Bibb City`     (2106001)  its `106` is MUSCOGEE — a former mill village
 *                              in Columbus, nothing to do with Bibb County
 *   `Baldwin City`  (2068002)  unrelated to Baldwin County (1005005)
 *   `Macon City`    (2011001)  and `Bibb County` (1011011) are the
 *                              PRE-CONSOLIDATION governments
 *
 * A name match silently swaps an 11,831-person county for a 157,056-person
 * consolidated government. This is the Palm Beach shape from session 3.
 *
 * ── ⚠ CONSOLIDATED GOVERNMENTS ARE TYPED `county` ───────────────────────────
 *
 * Macon-Bibb and Columbus-Muscogee are single governments performing both city
 * and county functions, so each is ONE entity (spec §4.5) — creating a city AND
 * a county row would double-count them in every rollup.
 *
 * They are TT's FIRST consolidated governments, so this sets the precedent for
 * Philadelphia, Lexington-Fayette and Nashville-Davidson later in the campaign.
 * `county` was chosen because:
 *   - Census confirms each is COTERMINOUS with its county: Macon-Bibb's place
 *     population (157,056) is identical to Bibb County's, and Columbus city's
 *     (201,830) is identical to Muscogee County's. Verified, not assumed.
 *   - The RLGF filings show them performing county functions — Sheriff's
 *     Office, Tax Commissioner, Superior Court, Probate Court, Coroner.
 *   - Macon-Bibb's legal name is literally "Macon-Bibb County".
 * ⚠ TT's `entity_type` is free text, so a `consolidated` value was possible; it
 * was rejected because UI and rollup code switches on the existing values and
 * an unknown type would drop these two out of both. Revisit as its own change
 * if the campaign wants consolidated governments distinguishable.
 *
 * ── POPULATIONS ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same program
 * and vintage as the FL and NC entities, so all are comparable.
 *
 *   Places   sub-est2024_13.csv, SUMLEV=162 (whole place)
 *   Counties co-est2024-alldata.csv, SUMLEV=050
 *
 * ⚠ MILLEDGEVILLE DOES NOT STRADDLE A COUNTY LINE — checked, not assumed. Its
 * SUMLEV=157 county-part row for county 009 (Baldwin) carries the identical
 * 16,664 as its whole-place row, so `county_id` is an identity here rather than
 * the approximation it is for Durham.
 *
 * ── FISCAL CALENDAR ─────────────────────────────────────────────────────────
 *
 * ⚠⚠ GEORGIA IS NOT A UNIFORM-MONTH STATE. The FAC census GA slice (538 rows)
 * splits 225 July / 212 January / 60 October / 41 other, and these four entities
 * are themselves split: Baldwin County ends December 31 (start month 1) while
 * the other three end June 30 (start month 7). Florida, loaded one session
 * earlier, is 10 and North Carolina is 7 —
 * `project_fysm_column_default_one_defect` is exactly the defect of carrying a
 * month across a boundary, so every value here is declared per entity AND
 * re-read per filing from the form's own `FYEmonth` field.
 *
 * ⚠⚠ TWO OF THE FOUR ARE ABSENT FROM THE FAC CENSUS, so `censusGuard()` would
 * return `{ok:true}` for them without checking anything — the CA-counties blind
 * spot in a new place. Recorded honestly per entity in `censusName` below:
 *   - Columbus-Muscogee: NO row under any name. Census-unverifiable.
 *   - Macon-Bibb: only the PRE-CONSOLIDATION `Macon` (municipality, 1998-2013)
 *     and `Bibb County` (2000-2013). Nothing for the consolidated government
 *     that has existed since 2014, i.e. nothing covering any loaded year.
 *   - Milledgeville and Baldwin County ARE covered and DO confirm.
 *
 * ⚠ BALDWIN COUNTY CHANGED ITS FISCAL CALENDAR. FAC has it at month 7 for
 * 1998-2001 and 2005-2008, month 1 for 2011-2023, with a 9-month stub in 2010.
 * The FY2016+ window loaded here is entirely after the change and every filing
 * reports `MosRptd` = 12 with `MoChng` = No, so the change is a live trap for
 * the FY2009-2015 follow-up, not for this load.
 */

export const GA_KNIGHT_ENTITIES = Object.freeze([
  {
    key: 'baldwin-county',
    cicoid: '1005005',
    name: 'Baldwin County',
    state: 'GA',
    entityType: 'county',
    population: 43644,
    populationSource: 'co-est2024-alldata.csv SUMLEV=050 COUNTY=009',
    fiscalYearStartMonth: 1,
    fiscalYearEndText: 'December 31',
    censusName: 'Baldwin County',
    censusKind: 'county',
    censusConfirms: true,
    parentCountyKey: null,
  },
  {
    key: 'milledgeville',
    cicoid: '2005001',
    name: 'Milledgeville',
    state: 'GA',
    entityType: 'city',
    population: 16664,
    populationSource: 'sub-est2024_13.csv SUMLEV=162 PLACE=51492',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    censusName: 'Milledgeville',
    censusKind: 'municipality',
    censusConfirms: true,
    parentCountyKey: 'baldwin-county',
  },
  {
    key: 'macon-bibb',
    cicoid: '3011011',
    name: 'Macon-Bibb County',
    state: 'GA',
    entityType: 'county',
    population: 157056,
    populationSource: 'sub-est2024_13.csv SUMLEV=162 PLACE=49008 (= Bibb County, coterminous)',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    // ⚠ Census holds only the pre-consolidation `Macon` and `Bibb County`,
    // neither covering FY2014+. Left null so the guard cannot report a
    // confirmation it never made.
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    parentCountyKey: null,
  },
  {
    key: 'columbus-muscogee',
    cicoid: '3106002',
    name: 'Columbus-Muscogee',
    state: 'GA',
    entityType: 'county',
    population: 201830,
    populationSource: 'sub-est2024_13.csv SUMLEV=162 PLACE=19000 (= Muscogee County, coterminous)',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    // ⚠ NO FAC census row exists under any spelling. Census-unverifiable.
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    parentCountyKey: null,
  },
]);

/** Look one up by CICOID — the only safe key. */
export function entityByCicoid(cicoid) {
  return GA_KNIGHT_ENTITIES.find((e) => e.cicoid === String(cicoid)) || null;
}

/**
 * The fiscal years this session loads, per entity.
 *
 * ⚠ Scope is the FY2016+ `LOAD1` form generation. FY2009-2015 uses a different
 * extract sheet with a different key set and is a filed follow-up.
 *
 * ⚠ Gaps are REAL and are DCA's, not fetch failures — Macon-Bibb has no FY2024
 * in DCA's own listing, and Milledgeville has no FY2018.
 */
export const GA_LOAD_WINDOW = Object.freeze({ firstFiscalYear: 2016, lastFiscalYear: 2025 });
