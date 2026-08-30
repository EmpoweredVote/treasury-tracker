/**
 * Tennessee — the session-6b entity (Knight campaign).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * **The Metropolitan Government of Nashville and Davidson County** is
 * TENNESSEE'S FIRST LOCAL ENTITY IN TT — the live table held exactly one TN row
 * before this session, the state node.
 *
 * ⚠ Nashville is NOT a Knight community. It was added independently because EV
 * Essentials seeded it and TT had no Tennessee locals at all (spec §2).
 *
 * ── ONE ENTITY, TYPED `city`, `county_id` NULL ──────────────────────────────
 *
 * Nashville and Davidson County are a single consolidated government, so this is
 * ONE entity (spec §4.5) — creating both a city and a county row would
 * double-count Metro in every state and national rollup. It is typed `city` with
 * a NULL `county_id`, the convention settled 2026-08-30 and now shared by San
 * Francisco, Philadelphia, Macon-Bibb and Columbus-Muscogee.
 *
 * ── ⚠⚠ POPULATION — CONSOLIDATED, BUT *NOT* COTERMINOUS THE WAY PHILADELPHIA IS
 *
 * Census vintage-2024 gives three different numbers for this one government, and
 * picking the wrong one silently misstates every per-capita figure:
 *
 *   Davidson County                              SUMLEV 050   729,505
 *   Nashville-Davidson metropolitan government   SUMLEV 170   729,505
 *   Nashville-Davidson metro government (BALANCE) SUMLEV 162  704,963
 *
 * **729,505 is the right one.** The consolidated government (170) is exactly the
 * county (050); the "(balance)" figure excludes SIX INDEPENDENT SATELLITE CITIES
 * that sit inside Davidson County and did not merge — Belle Meade, Berry Hill,
 * Forest Hills, Goodlettsville, Oak Hill and Ridgetop.
 *
 * ⚠ This is a REAL DIFFERENCE FROM PHILADELPHIA, where session 5 verified
 * coterminousness by finding the city (162) and the county (050) both at
 * 1,573,916. Here 162 ≠ 050, and it is 170 that matches. Metro's General
 * Services District covers the whole county including the satellite cities, and
 * the General Fund is a GSD fund, so the county-wide figure is the correct
 * denominator for these statements.
 *
 * ── FISCAL CALENDAR — MONTH 7, FROM TWO FIRST-PARTY SOURCES ─────────────────
 *
 * ⚠⚠ NASHVILLE IS ABSENT FROM THE REPO'S FAC CENSUS SLICE, AND THE CAUSE IS NOW
 * KNOWN. `docs/fac/fac-local-fiscal-year-ends.csv` has no row for it, while every
 * other Tennessee county sits there at month 7. It is NOT missing from FAC —
 * `buildFacFiscalYearCensus.classifyAuditee()` returns **null** for the name form
 * "THE METROPOLITAN GOVERNMENT OF NASHVILLE AND DAVIDSON COUNTY", so the census
 * builder drops it.
 *
 * ⚠ This is a SYSTEMATIC blind spot for consolidated governments, not a one-off,
 * and it explains three "census absent" notes this campaign has already recorded
 * without diagnosing:
 *
 *     CITY OF PHILADELPHIA                        -> municipality  ✅
 *     CITY AND COUNTY OF SAN FRANCISCO / DENVER   -> municipality  ✅
 *     THE METROPOLITAN GOVERNMENT OF NASHVILLE …  -> null          ❌
 *     MACON-BIBB COUNTY                           -> null          ❌
 *     COLUMBUS CONSOLIDATED GOVERNMENT            -> null          ❌
 *     LEXINGTON-FAYETTE URBAN COUNTY GOVERNMENT   -> null          ❌  (session 8!)
 *
 * `censusGuard()` returns `{ok:true}` when it cannot find an entity, so all of
 * these pass WITHOUT CHECKING ANYTHING. Filed as a follow-up; not fixed here,
 * because the classifier governs 33,932 already-censused rows.
 *
 * The month is therefore taken from two INDEPENDENT first-party statements,
 * both stronger than the census would have been:
 *
 *   1. Every statement page prints "For the Year Ended June 30, <year>".
 *   2. The LIVE FAC record for auditee 0000193991 gives `fy_end_date` = June 30
 *      for all ten audit years FY2016–FY2025.
 *
 * ⚠ Do NOT read `fy_start_date` from FAC: FY2017 reads `2016-06-30 -> 2017-06-30`,
 * carrying the PRIOR period's end. Derive from the period END, as the FAC
 * reference records.
 */

/** Where a reader goes for these documents — the issuer's own page. */
export const NASHVILLE_PUBLICATION_PAGE =
  'https://www.nashville.gov/departments/finance/division-accounts/comprehensive-financial-reports';

/**
 * ⚠ FIRST-PARTY BYTES. Unlike session 6a's South Carolina cities, Metro serves
 * its own PDFs with no WAF, so these are fetched from nashville.gov directly and
 * the Federal Audit Clearinghouse is not needed. The URLs are NOT derivable —
 * they carry the upload month and the naming switches from `CAFR<year>.pdf` to
 * three different Annual-Comprehensive-Financial-Report forms — which is exactly
 * why `acfrGfLoad` reads a manifest rather than rebuilding a URL (the Travis
 * precedent).
 */
export const NASHVILLE_ACFR_URLS = Object.freeze({
  2016: 'https://www.nashville.gov/sites/default/files/2025-09/CAFR2016.pdf',
  2017: 'https://www.nashville.gov/sites/default/files/2025-09/CAFR2017.pdf',
  2018: 'https://www.nashville.gov/sites/default/files/2025-09/CAFR2018.pdf',
  2019: 'https://www.nashville.gov/sites/default/files/2025-09/CAFR2019.pdf',
  2020: 'https://www.nashville.gov/sites/default/files/2025-09/CAFR2020.pdf',
  2021: 'https://www.nashville.gov/sites/default/files/2022-01/ACFRFY21_01_21_2022_Upload.pdf',
  2022: 'https://www.nashville.gov/sites/default/files/2023-06/2022_Annual_Comprehensive_Financial_Report_Final_Published_06062023.pdf',
  2023: 'https://www.nashville.gov/sites/default/files/2024-06/2023_Annual_Comprehensive_Financial_Report_Final_6.25.24.pdf',
  2024: 'https://www.nashville.gov/sites/default/files/2025-04/Annual-Comprehensive-Financial-Report-2024.pdf',
  2025: 'https://www.nashville.gov/sites/default/files/2025-12/2025_Annual_Comprehensive_Financial_Report.pdf',
});

/**
 * The FAC report ids for the same ten years, recorded as a SECOND ROUTE and as
 * the fiscal-period evidence. Auditee 0000193991.
 *
 * ⚠⚠ NEVER JOIN THESE BY NAME. A name match over FAC's Tennessee rows also
 * returns `ELECTRIC POWER BOARD OF METRO GOVT OF NASHVILLE & DAVIDSON CO`
 * (Nashville Electric Service — a COMPONENT UNIT, the Charlotte Water trap
 * exactly), `GREATER NASHVILLE REGIONAL COUNCIL`, `HABITAT FOR HUMANITY OF
 * GREATER NASHVILLE`, `KIPP ACADEMY NASHVILLE`, `ADVENTURE SCIENCE CENTER -
 * NASHVILLE` and `THE METROPOLITAN GOVERNMENT OF LYNCHBURG, MOORE COUNTY` — a
 * DIFFERENT Tennessee consolidated government. The report id is the join.
 */
export const NASHVILLE_FAC_REPORTS = Object.freeze({
  2016: '2016-06-CENSUS-0000193991',
  2017: '2017-06-CENSUS-0000193991',
  2018: '2018-06-CENSUS-0000193991',
  2019: '2019-06-CENSUS-0000193991',
  2020: '2020-06-CENSUS-0000193991',
  2021: '2021-06-CENSUS-0000193991',
  2022: '2022-06-CENSUS-0000193991',
  2023: '2023-06-GSAFAC-0000035654',
  2024: '2024-06-GSAFAC-0000363525',
  2025: '2025-06-GSAFAC-0000395247',
});

export const TN_ENTITIES = Object.freeze([
  {
    key: 'nashville-davidson',
    // ⚠ The LEGAL name is "The Metropolitan Government of Nashville and Davidson
    // County". TT stores the display name a reader expects, the way Macon-Bibb
    // kept its legal name and San Francisco did not become "City and County of".
    name: 'Nashville-Davidson',
    entityType: 'city',
    population: 729505,
    censusName: 'Nashville-Davidson',
    fiscalYearStartMonth: 7,
    // ⚠ NULL, and that is the point of a consolidated government.
    parentCountyKey: null,
  },
]);

/**
 * FY2016–FY2025.
 *
 * The ceiling is the latest published edition. The floor matches session 6a's
 * city decade and is where nashville.gov's own listing stops; older years sit
 * behind an "Archive for Previous Years" page and are NOT loaded, under the
 * first-party `source_url` policy the campaign has applied since Durham.
 */
export const TN_LOAD_WINDOW = Object.freeze({ first: 2016, last: 2025 });
export const NASHVILLE_LOAD_YEARS = Object.freeze(
  Array.from({ length: 10 }, (_, i) => 2016 + i),
);

export function tnEntityByKey(key) {
  return TN_ENTITIES.find((e) => e.key === key) ?? null;
}
