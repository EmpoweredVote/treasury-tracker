/**
 * Georgia statewide RLGF registry — GENERATED, DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   node scripts/buildGaStatewideEntities.mjs --dir _acfr-work/ga/sweep/xlsx
 *
 * Built 2026-10-18 from 56 workbooks across 8 consolidated
 * governments listed by DCA.
 *
 * ── HOW `fiscalYearStartMonth` GOT HERE ─────────────────────────────────────
 *
 * From THE FILING'S OWN `FYEmonth` field, corroborated against the entity's
 * federally filed audit period. Georgia has no safe default month — its FAC
 * slice splits 225 July / 212 January / 60 October / 41 other, and the split
 * runs inside a single metro — so a per-state value was never available.
 *
 * `monthStatus` records WHICH of those happened, per entity:
 *   confirmed    the form and the FAC census agree        (0)
 *   unverified   the form states it; the census is silent (6)
 *   census-only  every form was blank; the census answered (0)
 * Absent from this file, each for a DIFFERENT reason — never one count:
 *     0 month CONFLICT   the form and the census disagree, or the
 *       entity's own filings disagree with each other
 *     0 no filing      DCA lists nothing in the window; all 8 are
 *       counties whose consolidated government files instead
 *     2 already loaded carried by georgiaRlgfEntities.mjs
 * Every one is named in the build log. None is silently dropped.
 *
 * ⚠⚠ `censusConfirms` IS TRUE ONLY FOR `confirmed`. `censusGuard()` returns
 * `{ok: true}` when it cannot find an entity, so an unverified month would
 * otherwise pass the load-time check without anything being checked — the
 * Columbus-Muscogee blind spot. An unverified month is loaded and labelled; it
 * is never reported as corroborated.
 *
 * ⚠ `censusName` is FAC's OWN spelling, which is not always the Census
 * Bureau's: FAC writes `Dekalb County`, the Census writes `DeKalb County`, and
 * `censusMonthFor()` does an exact `Map.get`.
 */

export const GA_STATEWIDE_CONS_WINDOW = Object.freeze({ first: 2016, last: 2025 });

export const GA_STATEWIDE_CONSOLIDATED = Object.freeze([
  {
    key: "athens-clarke-county",
    cicoid: "3029029",
    name: "Athens-Clarke County",
    state: 'GA',
    entityType: "city",
    population: 129995,
    populationSource: "co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=059 (Clarke County, the county this government IS — not its census place row, which may be a `(balance)`)",
    fiscalYearStartMonth: 7,
    fiscalYearEndText: "June 30",
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    // ⚠ DCA prints this name; the census designation above is what TT types on.
    dcaName: "Athens-Clarke CG",
    monthStatus: "unverified",
    monthWhy: "the FAC census has no row for \"Athens-Clarke County\"",
    parentCountyKey: null,
    fiscalYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  },
  {
    key: "augusta-richmond-county",
    cicoid: "3121121",
    name: "Augusta-Richmond County",
    state: 'GA',
    entityType: "city",
    population: 206303,
    populationSource: "co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=245 (Richmond County, the county this government IS — not its census place row, which may be a `(balance)`)",
    fiscalYearStartMonth: 1,
    fiscalYearEndText: "December 31",
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    // ⚠ DCA prints this name; the census designation above is what TT types on.
    dcaName: "Augusta/Richmond CG",
    monthStatus: "unverified",
    monthWhy: "the FAC census has no row for \"Augusta-Richmond County\"",
    parentCountyKey: null,
    fiscalYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  },
  {
    key: "cusseta-chattahoochee-county",
    cicoid: "3026026",
    name: "Cusseta-Chattahoochee County",
    state: 'GA',
    entityType: "city",
    population: 8548,
    populationSource: "co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=053 (Chattahoochee County, the county this government IS — not its census place row, which may be a `(balance)`)",
    fiscalYearStartMonth: 7,
    fiscalYearEndText: "June 30",
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    // ⚠ DCA prints this name; the census designation above is what TT types on.
    dcaName: "Cusseta-Chattahoochee CG",
    monthStatus: "unverified",
    monthWhy: "the FAC census has no row for \"Cusseta-Chattahoochee County\"",
    parentCountyKey: null,
    fiscalYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022],
  },
  {
    key: "echols-county",
    cicoid: "3050050",
    name: "Echols County",
    state: 'GA',
    entityType: "city",
    population: 3698,
    populationSource: "co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=101 (Echols County, the county this government IS — not its census place row, which may be a `(balance)`)",
    fiscalYearStartMonth: 1,
    fiscalYearEndText: "December 31",
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    // ⚠ DCA prints this name; the census designation above is what TT types on.
    dcaName: "Echols County CG",
    monthStatus: "unverified",
    monthWhy: "the FAC census has no row for \"Echols County\"",
    parentCountyKey: null,
    fiscalYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  },
  {
    key: "georgetown-quitman-county",
    cicoid: "3118118",
    name: "Georgetown-Quitman County",
    state: 'GA',
    entityType: "city",
    population: 2323,
    populationSource: "co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=239 (Quitman County, the county this government IS — not its census place row, which may be a `(balance)`)",
    fiscalYearStartMonth: 7,
    fiscalYearEndText: "June 30",
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    // ⚠ DCA prints this name; the census designation above is what TT types on.
    dcaName: "Georgetown-Quitman CG",
    // ⚠ CHANGED ITS FISCAL CALENDAR INSIDE THE WINDOW. These years are written
    // with the month the filing printed for them, not the entity's current one.
    monthByYear: Object.freeze({"2016":1,"2017":1,"2018":1,"2019":1,"2020":1,"2021":1,"2022":1}),
    monthStatus: "unverified",
    monthWhy: "the FAC census has no row for \"Georgetown-Quitman County\"",
    parentCountyKey: null,
    fiscalYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  },
  {
    key: "webster-county",
    cicoid: "3152152",
    name: "Webster County",
    state: 'GA',
    entityType: "city",
    population: 2315,
    populationSource: "co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=307 (Webster County, the county this government IS — not its census place row, which may be a `(balance)`)",
    fiscalYearStartMonth: 1,
    fiscalYearEndText: "December 31",
    censusName: "Webster County",
    censusKind: null,
    censusConfirms: false,
    // ⚠ DCA prints this name; the census designation above is what TT types on.
    dcaName: "Webster County Unified",
    monthStatus: "unverified",
    monthWhy: "the census has a row for \"Webster County\" but covers none of FY2016-2025",
    parentCountyKey: null,
    fiscalYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  },
].map(Object.freeze));
