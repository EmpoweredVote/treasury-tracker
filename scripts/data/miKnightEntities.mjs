/**
 * Michigan — the two session-7a entities (Knight campaign).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * Detroit is one of Knight's eight RESIDENT communities (spec §2). Wayne County
 * is its parent county. Both are MICHIGAN'S FIRST LOCAL ENTITIES in TT — before
 * this load the table held exactly one Michigan row, the state node.
 *
 * ── ⚠⚠ JOIN ON `municode`, NEVER ON `lu_name` ───────────────────────────────
 *
 * The publisher's own name field is NOT stable across the series: Detroit files
 * as `Detroit` in some years and `City of Detroit` in others, under one constant
 * `municode` 822050. A name match would silently drop half the series.
 *
 * ⚠⚠ AND THE FAC CENSUS CONTAINS A NEAR-MISS THAT WOULD BE SILENT. Michigan has
 * FOUR census rows matching /Detroit|Wayne/:
 *
 *     MI,Detroit,municipality,annual,7,,1998-2025      <- the city
 *     MI,Wayne,municipality,annual,7,,1998-2013        <- THE CITY OF WAYNE, MI
 *     MI,Wayne County,county,annual,10,,1999-2005      <- the county
 *     MI,Wayne Township,township,annual,4,,2015
 *
 * The City of Wayne is a real, separate government inside Wayne County, and its
 * fiscal year starts in month 7 where the COUNTY's starts in month 10. A bare
 * `Wayne` census lookup returns the city's month and `censusGuard()` would then
 * confirm a WRONG month for the county — agreeing enthusiastically, moving $0,
 * and passing every tie test. This is the fifth occurrence of the
 * Saint-Louis-County shape in this campaign, so `censusName` is exact.
 *
 * ── ⚠⚠ TWO DIFFERENT FISCAL CALENDARS, ONE STATE, CITY vs ITS OWN COUNTY ────
 *
 * Detroit starts in month 7; Wayne County starts in month 10. Both are READ per
 * filing from the F-65's own `fiscalendmonth` field (6 and 9 = the ENDING month)
 * and both are constant across all 16 filings — verified per row, not assumed.
 *
 * Michigan's counties are genuinely split, so no state-wide default is safe. The
 * FAC census slice for MI counties:
 *
 *     month 1 (January)  72 counties
 *     month 10 (October) 29 counties   <- Wayne is here
 *     month 7             1 county
 *     (blank)             7 counties
 *
 * Taking the dominant month would have put Wayne wrong by nine months on every
 * row while moving $0 — verbatim project_fysm_column_default_one_defect.
 *
 * ── POPULATIONS ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same program
 * and vintage as the NC, FL, GA, PA and IN entities, so all are comparable.
 *
 *   Places   sub-est2024_26.csv, SUMLEV=162
 *   Counties co-est2024-alldata.csv, SUMLEV=050
 *
 * ⚠ DETROIT DOES NOT STRADDLE A COUNTY LINE — checked, not assumed, the way the
 * four session-5 cities were. Its SUMLEV=157 county-part row (county 163 =
 * Wayne) equals its SUMLEV=162 whole-place row exactly: 645,705 both.
 */

/** FY2010-FY2025. Every F-65 dataset in the Socrata catalogue, no gaps. */
export const MI_LOAD_WINDOW = Object.freeze({ first: 2010, last: 2025 });

export const MI_ENTITIES = Object.freeze([
  Object.freeze({
    key: 'detroit',
    name: 'Detroit',
    /** ⚠ The publisher's stable key. `lu_name` alternates Detroit/City of Detroit. */
    municode: '822050',
    unitType: 'City',
    entityType: 'city',
    /** ⚠ Exact. A bare `Wayne`-style near-miss is what the header warns about. */
    censusName: 'Detroit',
    /** READ from the F-65 `fiscalendmonth` = 6 (June end), constant 2010-2025. */
    fiscalYearStartMonth: 7,
    population: 645705,
    parentCountyKey: 'wayne-county',
  }),
  Object.freeze({
    key: 'wayne-county',
    name: 'Wayne County',
    municode: '820000',
    unitType: 'County',
    entityType: 'county',
    /** ⚠⚠ NOT `Wayne` — that is the City of Wayne, MI, at month 7. */
    censusName: 'Wayne County',
    /** READ from the F-65 `fiscalendmonth` = 9 (September end), constant 2010-2025. */
    fiscalYearStartMonth: 10,
    population: 1771063,
    parentCountyKey: null,
  }),
]);

export function entityByMunicode(municode) {
  const key = String(municode ?? '').trim();
  return MI_ENTITIES.find((e) => e.municode === key) ?? null;
}

export function entityByKey(key) {
  return MI_ENTITIES.find((e) => e.key === key) ?? null;
}
