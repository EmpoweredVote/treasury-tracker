/**
 * Florida — the seven session-3 entities (Knight campaign).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * Four Knight communities (Miami, Tallahassee, Bradenton, Palm Beach County —
 * which is itself a county) plus the three parent counties the other three sit
 * in. These are FLORIDA'S FIRST LOCAL ENTITIES in TT; before this session the
 * state had only its state node from the state-ACFR arc.
 *
 * ── ⚠⚠ `code` IS THE JOIN KEY, NEVER `name` ─────────────────────────────────
 *
 * LOGERx assigns each government a numeric code — `1xxxxx` counties, `2xxxxx`
 * municipalities, `3xxxxx` special districts. Florida has BOTH a
 * `County`/`Palm Beach` (code 100050) and a `City`/`Palm Beach` (code 200287,
 * the Town of Palm Beach), and eight further governments whose names start with
 * "Miami". A name-based match silently swaps a $3.9B county for a $90M town.
 *
 * `unitType`/`unitName` exist only because the `TOTALREVEXPDEBT` oracle report
 * carries NO entity code — it is keyed by (Unit Type, Unit Name), so the oracle
 * join needs both halves to be unambiguous.
 *
 * ── POPULATIONS ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same program
 * and vintage as every other entity in `treasury.municipalities`, so these seven
 * are comparable with the rest.
 *
 *   Cities   sub-est2024_12.csv, SUMLEV=162 (whole place)
 *   Counties co-est2024-alldata.csv, SUMLEV=050
 *
 * ⚠ NONE OF THE THREE CITIES STRADDLES A COUNTY LINE — checked, not assumed.
 * Each city's SUMLEV=157 county-part row carries the identical figure to its
 * whole-place row (Miami 487,014 in county 086; Tallahassee 205,089 in 073;
 * Bradenton 58,184 in 081), so `county_id` is an identity here rather than the
 * 99.86% approximation it is for Durham, or the three-county split Austin has.
 *
 * ── FISCAL CALENDAR ─────────────────────────────────────────────────────────
 *
 * ⚠⚠ FLORIDA IS AN OCTOBER STATE. `fiscalYearStartMonth: 10` for all seven —
 * North Carolina, loaded one session earlier, is 7. `project_fysm_column_default_one_defect`
 * is exactly the defect of carrying a month across a state boundary, so the
 * value is declared per entity here and independently confirmed per row against
 * the FAC census by scripts/loadFloridaDFS.mjs.
 *
 * ⚠ `censusName` exists because FAC does not spell every entity the way TT does:
 * FAC holds Miami-Dade as **"Miami Dade County"**, with no hyphen. A name-exact
 * guard misses it and `censusGuard()` then returns `{ok:true}` for an entity it
 * never found — the `Saint Louis County` shape from session 1 and the
 * `Charlotte City` shape from session 2. Silence is not agreement.
 *
 * ⚠ CENSUS COVERAGE IS NOT COMPLETE, and the gaps are per entity per year:
 *     Miami              1998-2025   complete
 *     Tallahassee        1999-2025   (FAC holds 1998 under "Tallahassee City")
 *     Bradenton          1998-2013 2016 2018-2025   — 2014/2015/2017 absent
 *     Palm Beach County  1998-2020 2025             — 2021-2024 absent
 *     Miami Dade County  2023-2025                  — FY2012-2022 absent
 *     Leon County        1998-2025   complete
 *     Manatee County     1998-2025   complete
 *   A year the census does not cover is NOT confirmed; it is unverified. The
 *   loader records which, and never treats absence as agreement.
 */

/** First and last fiscal years LOGERx publishes detail reports for. */
export const FL_FIRST_YEAR = 2012;
export const FL_LAST_YEAR = 2025;

/**
 * ⚠ FY2025 IS INCOMPLETE AND DOWNLOADS AS A WELL-FORMED WORKBOOK.
 * 1,281 entities had filed against 1,918 for FY2024 when this was fetched, and
 * only four of these seven are present. Presence is checked per entity per year
 * by the loader; nothing here asserts a year exists.
 */
export const FL_PARTIAL_YEARS = [2025];

/** The state every one of these belongs to — never inferred from a name. */
export const FL_STATE = 'FL';

/** @typedef {{code:string, label:string, dbName:string, entityType:'city'|'county',
 *             unitType:string, unitName:string, censusName:string, censusKind:string,
 *             population:number, countyDbName:string|null, fiscalYearStartMonth:number}} FlEntity */

/** @type {FlEntity[]} */
export const FL_ENTITIES = [
  // ── Counties first: a city's `county_id` cannot point at a row that does not
  //    exist yet, so the seeder depends on this ordering.
  {
    code: '100013',
    label: 'Miami-Dade County',
    dbName: 'Miami-Dade County',
    entityType: 'county',
    unitType: 'County',
    unitName: 'Miami-Dade',
    censusName: 'Miami Dade County', // ⚠ FAC spells it WITHOUT the hyphen
    censusKind: 'county',
    population: 2838461,
    countyDbName: null,
    fiscalYearStartMonth: 10,
  },
  {
    code: '100037',
    label: 'Leon County',
    dbName: 'Leon County',
    entityType: 'county',
    unitType: 'County',
    unitName: 'Leon',
    censusName: 'Leon County',
    censusKind: 'county',
    population: 300488,
    countyDbName: null,
    fiscalYearStartMonth: 10,
  },
  {
    code: '100041',
    label: 'Manatee County',
    dbName: 'Manatee County',
    entityType: 'county',
    unitType: 'County',
    unitName: 'Manatee',
    censusName: 'Manatee County',
    censusKind: 'county',
    population: 458352,
    countyDbName: null,
    fiscalYearStartMonth: 10,
  },
  {
    // ⚠ A Knight community that IS a county — spec §2.2 lists it under "already
    // the primary entity", so it is one row, not a city plus a county.
    code: '100050',
    label: 'Palm Beach County',
    dbName: 'Palm Beach County',
    entityType: 'county',
    unitType: 'County',
    unitName: 'Palm Beach', // ⚠ identical to the Town of Palm Beach's unitName
    censusName: 'Palm Beach County',
    censusKind: 'county',
    population: 1582055,
    countyDbName: null,
    fiscalYearStartMonth: 10,
  },
  // ── Cities.
  {
    code: '200239',
    label: 'Miami',
    dbName: 'Miami',
    entityType: 'city',
    unitType: 'City',
    unitName: 'Miami',
    censusName: 'Miami',
    censusKind: 'municipality',
    population: 487014,
    countyDbName: 'Miami-Dade County',
    fiscalYearStartMonth: 10,
  },
  {
    code: '200359',
    label: 'Tallahassee',
    dbName: 'Tallahassee',
    entityType: 'city',
    unitType: 'City',
    unitName: 'Tallahassee',
    censusName: 'Tallahassee',
    censusKind: 'municipality',
    population: 205089,
    countyDbName: 'Leon County',
    fiscalYearStartMonth: 10,
  },
  {
    code: '200037',
    label: 'Bradenton',
    dbName: 'Bradenton',
    entityType: 'city',
    unitType: 'City',
    unitName: 'Bradenton',
    censusName: 'Bradenton',
    censusKind: 'municipality',
    population: 58184,
    countyDbName: 'Manatee County',
    fiscalYearStartMonth: 10,
  },
];

/** Look one up by LOGERx code. */
export function entityByCode(code) {
  return FL_ENTITIES.find((e) => e.code === String(code)) || null;
}
