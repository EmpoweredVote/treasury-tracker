/**
 * South Carolina — the four session-6a entities (Knight campaign).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * Knight communities: Columbia and Myrtle Beach, plus their parent counties
 * Richland and Horry. **These are SOUTH CAROLINA'S FIRST LOCAL ENTITIES IN TT** —
 * the live database held exactly one SC row before this session, the state node.
 *
 * ── ⚠⚠ THE TWO CITIES CANNOT COME FROM THE BULK SOURCE ──────────────────────
 *
 * RFA's Local Government Finance Report is statewide and icicle-grade, and it
 * publishes NO INDIVIDUAL MUNICIPALITY. Each county sheet carries a "Total
 * Revenues (Cities only)*" block whose own footnote reads:
 *
 *   "*Cities Include: Arcadia Lakes, Blythewood, Columbia, Eastover, and Forest
 *    Acres."   (Richland sheet)
 *   "*Cities Include: Atlantic Beach, Aynor, Briarcliffe Acres, Conway, Loris,
 *    Myrtle Beach, North Myrtle Beach, and Surfside Beach."   (Horry sheet)
 *
 * That block is every municipality in the county summed together. Reading
 * Columbia out of it would hand five governments' money to one of them, and it
 * would tie against every internal check while doing so. The `Municipal Info`
 * sheet is a submitted-Y/N matrix, not finance.
 *
 * So the counties are BULK and the cities are ACFR — recorded here as `source`
 * so nothing can later mistake one route for the other.
 *
 * ── FISCAL CALENDAR ─────────────────────────────────────────────────────────
 *
 * ⚠ The publisher warns the month is NOT uniform: "City Fiscal Year: Fiscal Year
 * ended on or before June 30 of each year", and the county instructions say
 * "fiscal year end on or before June 30". So month 7 is a claim needing evidence,
 * not a default — `project_fysm_column_default_one_defect` is the whole reason.
 *
 * All four are ACTIVELY CONFIRMED at month 7 by the FAC census, which is the
 * strong direction (`censusGuard()` returns ok when it cannot find an entity, so
 * absence proves nothing):
 *
 *   SC,Columbia,municipality,annual,7        1998-2001 2003-2025
 *   SC,Myrtle Beach,municipality,annual,7    1998-2025
 *   SC,Richland County,county,annual,7       1998-2002 2005-2025
 *   SC,Horry County,county,annual,7          1999-2012 2014-2021
 *
 * ⚠ JOIN ON `censusName` + STATE, NEVER THE BARE NAME. The census carries
 * `MO,Columbia` (month 10, 1998-2025), `CT,Columbia` (7), `IL,Columbia` (5),
 * `KY,Columbia` (7), `LA,Columbia` (7), `MS,Columbia` (10) and `NC,Columbia` (7),
 * plus `GA,Richland`, `MS,Richland`, `MT,Richland County` and `IL,Richland
 * County`. A bare-name lookup for "Columbia" can land on Missouri and quietly
 * stamp month 10. Fifth occurrence of the Saint-Louis-County shape in this
 * campaign.
 *
 * ── POPULATIONS ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates, vintage 2024 (POPESTIMATE2024), from the
 * static PEP CSVs — the API now demands a key, the flat files do not.
 *   counties: co-est2024-alldata.csv          cities: sub-est2024_45.csv
 */

/** Only Richland and Horry are loadable from RFA; the cities need their ACFRs. */
export const SC_SOURCE = Object.freeze({
  RFA_COUNTY: 'SC_RFA_COUNTY',
  CITY_ACFR: 'SC_CITY_ACFR',
});

/**
 * ⚠ `sheet` is the workbook tab, which is the bare county name with no "County"
 * suffix. `countyInfoName` is the same string as stored in the `County Info`
 * matrix, where Richland carries a TRAILING SPACE (`'Richland '`). Both are
 * recorded rather than derived so a whitespace change in a future edition fails
 * loudly instead of silently matching nothing.
 */
export const SC_ENTITIES = Object.freeze([
  {
    key: 'richland-county',
    name: 'Richland County',
    entityType: 'county',
    population: 430651,
    source: SC_SOURCE.RFA_COUNTY,
    sheet: 'Richland',
    countyInfoName: 'Richland',
    censusName: 'Richland County',
    fiscalYearStartMonth: 7,
    parentCountyKey: null,
  },
  {
    key: 'horry-county',
    name: 'Horry County',
    entityType: 'county',
    population: 413391,
    source: SC_SOURCE.RFA_COUNTY,
    sheet: 'Horry',
    countyInfoName: 'Horry',
    censusName: 'Horry County',
    fiscalYearStartMonth: 7,
    parentCountyKey: null,
  },
  {
    key: 'columbia',
    name: 'Columbia',
    entityType: 'city',
    population: 144788,
    source: SC_SOURCE.CITY_ACFR,
    censusName: 'Columbia',
    fiscalYearStartMonth: 7,
    parentCountyKey: 'richland-county',
  },
  {
    key: 'myrtle-beach',
    name: 'Myrtle Beach',
    entityType: 'city',
    population: 40535,
    source: SC_SOURCE.CITY_ACFR,
    censusName: 'Myrtle Beach',
    fiscalYearStartMonth: 7,
    parentCountyKey: 'horry-county',
  },
]);

/**
 * FY2012-FY2024.
 *
 * The floor is a SCOPE decision, not a convenience. RFA's own Sources and Notes
 * record two category changes taking effect at exactly FY2012 — bonds and leases
 * became separately reported (before that they "may be included in Miscellaneous
 * Revenue"), and county local option sales tax began including the county revenue
 * fund as well as the property tax credit fund. Loading across that line renders
 * a definitional change as a trend. See scripts/lib/scRfa.mjs.
 *
 * The ceiling is simply the latest published edition (FY2024, revised 2026-05-12).
 */
export const SC_LOAD_WINDOW = Object.freeze({ first: 2012, last: 2024 });

export function scEntityByKey(key) {
  return SC_ENTITIES.find((e) => e.key === key) ?? null;
}

export function scBulkEntities() {
  return SC_ENTITIES.filter((e) => e.source === SC_SOURCE.RFA_COUNTY);
}
