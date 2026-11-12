/**
 * Nevada — City of Reno and its parent county, Washoe County.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⭐ NEVADA'S FIRST LOCAL ENTITIES IN TT. Before this, `NV` carried exactly one
 * row set: the state node (11 budgets, FY2019-FY2024). So this opens a new
 * family, `nv-local-acfr-gf`, rather than extending one.
 *
 * ── NAMES: THE DOMINANT CONVENTION, NOT THE MOST RECENT ────────────────────
 *
 * `treasury.municipalities` is not consistent about city names. Measured:
 *
 *     City of Boulder (CO)   City of Wichita (KS)      <- session 7b, 2 rows
 *     Colorado Springs       Asheville  Charlotte      <- everything else,
 *     Durham                 + all 488 CA cities          including every
 *                                                         city loaded since
 *
 * The bare name is the convention; `City of ...` is the outlier. Reno is
 * therefore `Reno`, which also yields the slug the UI expects (`reno-nv`) —
 * ⚠ a bad slug SILENTLY FALLS BACK TO BLOOMINGTON, IN, so this is checkable
 * in UAT by asserting the rendered population.
 *
 * ⚠ The name is also the figure-flag key (`${entity}|${state}|${fy}|${dataset}`)
 * and must match this string exactly.
 *
 * ── FISCAL CALENDAR: JULY-JUNE, CONFIRMED TWICE ────────────────────────────
 *
 * Read off every cover ("For the Fiscal Year Ended June 30, <YYYY>", all 15
 * documents) and independently confirmed by the FAC national census:
 *
 *     NV,Reno,municipality,annual,7,,1998-2008 2010-2024
 *     NV,Washoe County,county,annual,7,,1998-2025
 *
 * ⚠ Nevada's census slice is 43 rows and BOTH entities appear in it by name,
 * so this is a real confirmation rather than `censusGuard()` passing an entity
 * it could not find — the California-counties failure mode.
 *
 * ⚠ A third census row exists: `NV,Reno State Of,municipality,annual,7,,2009`.
 * That is an FAC auditee-name artifact for a single year, not a second
 * government, and it carries the same start month.
 *
 * ⚠ NRS 354.624 requires the annual independent audit; the June 30 year end is
 * the issuer's, not an assumption from the state's own calendar.
 *
 * ── POPULATIONS ────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024.
 *
 *   Reno           sub-est2024_32.csv, SUMLEV=162   281,714
 *   Washoe County  co-est2024-alldata.csv, SUMLEV=050, FIPS 32031   507,280
 *
 * ⚠ RENO DOES NOT STRADDLE A COUNTY LINE — checked, not assumed. Its
 * SUMLEV=157 county-part row carries COUNTY=031 (Washoe) and the identical
 * 281,714, so the whole place sits in the one county.
 */

export const NV_STATE = Object.freeze({ reno: 'NV', 'washoe-county': 'NV' });

export const NV_ENTITIES = Object.freeze([
  Object.freeze({
    key: 'reno',
    name: 'Reno',
    state: 'NV',
    entityType: 'city',
    censusName: 'Reno',
    fiscalYearStartMonth: 7,
    population: 281714,
    parentCountyKey: 'washoe-county',
    units: 1,
    family: 'nv-local-acfr-gf',
  }),
  Object.freeze({
    key: 'washoe-county',
    name: 'Washoe County',
    state: 'NV',
    entityType: 'county',
    censusName: 'Washoe County',
    fiscalYearStartMonth: 7,
    population: 507280,
    parentCountyKey: null,
    units: 1,
    family: 'nv-local-acfr-gf',
  }),
]);

export function nvEntityByKey(key) {
  return NV_ENTITIES.find((e) => e.key === key) || null;
}
