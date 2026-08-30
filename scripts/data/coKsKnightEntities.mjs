/**
 * Colorado + Kansas — the four session-7b entities (Knight campaign).
 *
 * NO SHEBANG — tests import this module.
 *
 * Boulder CO and Wichita KS are Knight communities; Boulder County and Sedgwick
 * County are their parent counties. Wichita and Sedgwick County are KANSAS'S
 * FIRST LOCAL ENTITIES in TT. Colorado already carries Colorado Springs and El
 * Paso County (v2.29), so the two Boulder entities EXTEND `co-local-acfr-gf`
 * rather than opening a new family.
 *
 * ── ⚠⚠ TWO NAME TRAPS, BOTH LIVE ───────────────────────────────────────────
 *
 * 1. THE CITY OF SEDGWICK, KANSAS IS A DIFFERENT GOVERNMENT. The FAC census
 *    carries both:
 *
 *        KS,Sedgwick,municipality,annual,1,,2003
 *        KS,Sedgwick County,county,annual,1,,1998-2025
 *
 *    The city is a town of about 1,600 people in HARVEY County — not even
 *    inside Sedgwick County. Sixth occurrence of the Saint-Louis-County shape
 *    in this campaign, after the City of Wayne MI one session earlier.
 *
 * 2. BOULDER CITY, NEVADA is a real municipality with its own "Annual Financial
 *    Reports" page, and it surfaced in this campaign's own searches for
 *    Colorado's Boulder. `censusName` is exact and every document is fetched by
 *    a publisher id, never by a name query.
 *
 * ⚠ FAC's own auditee names are worse still. A name query returns Boulder
 * Community Health, Boulder Housing Partners, Boulder County Housing Authority,
 * Boulder Valley School District, Mental Health Center of Boulder County,
 * Wichita State University, Wichita Public Schools USD 259, The Wichita
 * Children's Home, WICHITA COUNTY Health Center (a different Kansas county 250
 * miles away), Sedgwick County Zoological Society and USD 265 Sedgwick County.
 *
 * ⚠⚠ AND THE AUDITEE NAME IS NOT STABLE ACROSS YEARS — the same governments
 * file as `BOULDER COUNTY, COLORADO`, then `Boulder County`, then `County of
 * Boulder`; and as `SEDGWICK COUNTY`, `SEDGWICK COUNTY, KS`, `Sedgwick County,
 * KS`. The EIN is the stable key.
 *
 * ── FISCAL CALENDARS: ALL FOUR ARE CALENDAR-YEAR, AND ALL FOUR ARE CONFIRMED ─
 *
 * Every entity starts in month 1, read off each document's own "For the year
 * ended December 31, <YYYY>" caption and independently confirmed by the FAC
 * census:
 *
 *     CO,Boulder,municipality,annual,1,,1999-2009 2011-2024
 *     CO,Boulder County,county,annual,1,,1998-2025
 *     KS,Wichita,municipality,annual,1,,1998-2021 2023-2025
 *     KS,Sedgwick County,county,annual,1,,1998-2025
 *
 * ⚠ Both state slices are well covered — Colorado has 254 census rows including
 * 63 counties and Kansas 356 including 97 — so unlike California's counties
 * this is a real confirmation rather than `censusGuard()` silently passing an
 * entity it cannot find.
 *
 * ⚠ Uniformity here is READ, not assumed. Michigan, one session earlier, put a
 * city at month 7 and its own parent county at month 10.
 *
 * ── POPULATIONS ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same program
 * and vintage as every other entity in this campaign.
 *
 *   Places   sub-est2024_8.csv (CO) / sub-est2024_20.csv (KS), SUMLEV=162
 *   Counties co-est2024-alldata.csv, SUMLEV=050
 *
 * ⚠ Colorado's file is `sub-est2024_8.csv`, NOT `_08` — single-digit state FIPS
 * drop the leading zero, where Kansas is `_20` and Michigan was `_26`. The
 * zero-padded URL returns 404.
 *
 * ⚠ NEITHER CITY STRADDLES A COUNTY LINE — checked, not assumed. For each, the
 * SUMLEV=157 county-part row equals the SUMLEV=162 whole-place row exactly:
 * Boulder 106,803 in Boulder County; Wichita 400,991 in Sedgwick County.
 */

export const CO_KS_STATE = Object.freeze({ boulder: 'CO', 'boulder-county': 'CO', wichita: 'KS', 'sedgwick-county': 'KS' });

export const CO_KS_ENTITIES = Object.freeze([
  Object.freeze({
    key: 'boulder',
    name: 'City of Boulder',
    state: 'CO',
    entityType: 'city',
    censusName: 'Boulder',
    fiscalYearStartMonth: 1,
    population: 106803,
    parentCountyKey: 'boulder-county',
    /** ⚠ THOUSANDS. Boulder County, in the same session, is whole dollars. */
    units: 1000,
    family: 'co-local-acfr-gf',
  }),
  Object.freeze({
    key: 'boulder-county',
    name: 'Boulder County',
    state: 'CO',
    entityType: 'county',
    censusName: 'Boulder County',
    fiscalYearStartMonth: 1,
    population: 330262,
    parentCountyKey: null,
    units: 1,
    family: 'co-local-acfr-gf',
  }),
  Object.freeze({
    key: 'wichita',
    name: 'City of Wichita',
    state: 'KS',
    entityType: 'city',
    censusName: 'Wichita',
    fiscalYearStartMonth: 1,
    population: 400991,
    parentCountyKey: 'sedgwick-county',
    units: 1,
    family: 'ks-local-acfr-gf',
  }),
  Object.freeze({
    key: 'sedgwick-county',
    name: 'Sedgwick County',
    state: 'KS',
    entityType: 'county',
    /** ⚠⚠ NOT `Sedgwick` — that is the CITY of Sedgwick, in Harvey County. */
    censusName: 'Sedgwick County',
    fiscalYearStartMonth: 1,
    population: 536081,
    parentCountyKey: null,
    units: 1,
    family: 'ks-local-acfr-gf',
  }),
]);

export function entityByKey(key) {
  return CO_KS_ENTITIES.find((e) => e.key === key) ?? null;
}
