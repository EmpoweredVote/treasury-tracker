/**
 * Hawaii's four county governments — entity registry and document provenance.
 *
 * NO SHEBANG — library module; tests import it.
 *
 * Opens the `hi-local-acfr-gf` family. The HI STATE node belongs to
 * `state-acfr-gf`, is a different document, and NOTHING HERE TOUCHES IT.
 *
 * ── ⭐⭐ HAWAII HAS NO MUNICIPALITIES AT ALL ───────────────────────────────
 *
 * The entire general-purpose local layer is FOUR COUNTIES. No cities, no
 * towns, no villages. PROVED, not assumed: `cache/sub-est2024_15.csv` holds
 * exactly ONE row at SUMLEV 162 (whole incorporated place) and it is
 * `Urban Honolulu CDP` — a census DESIGNATED place, i.e. UNINCORPORATED. The
 * full SUMLEV census for the state is {040: 1, 050: 5, 157: 2, 162: 1}.
 *
 * ⭐ This is why Hawaii is worth doing: unlike Alaska (~145 cities, of which
 * FAC reaches ~43) its local layer is COMPLETE at four entities. It is the one
 * state where "TT holds all of it" is a true and cheap claim.
 *
 * ── ⚠⚠ KALAWAO COUNTY IS NOT HERE, AND MUST NEVER BE ──────────────────────
 *
 * Hawaii has FIVE county-equivalents at SUMLEV 050. Kalawao (pop 81) — the
 * Kalaupapa settlement — is administered by the STATE Department of Health and
 * has no county government. It files nothing at FAC.
 *
 * Same class as Alaska's 11 census areas: a census county-equivalent that is
 * not a government. Seeding it would MINT A GOVERNMENT THAT DOES NOT EXIST.
 *
 * ── ⚠⚠⚠ DO NOT EXPORT ALASKA'S CENSUS TYPING RULE TO HAWAII ───────────────
 *
 * Alaska's rule — *no SUMLEV 162 row ⇒ `county`* — is an ALASKA rule. It
 * encodes Alaska's own legal split between a unified home rule MUNICIPALITY
 * and a home rule BOROUGH. Applied blindly here it types Honolulu `county`,
 * because the census prints no 162 row for Honolulu County (only the
 * `Urban Honolulu CDP` carve-out, which is NOT the city).
 *
 * ⭐ TT'S OWN PRECEDENT GOVERNS INSTEAD, and it is unambiguous: a consolidated
 * city-county is `city` with `county_id` NULL. Re-verified live 2026-10-29:
 *
 *     CA city San Francisco        (county_id null, geoid 0667000)
 *     PA city Philadelphia         (county_id null, geoid 4260000)
 *     TN city Nashville-Davidson   (county_id null)
 *
 * So the City and County of Honolulu is `city`; the other three are `county`.
 * ⚠ `entity_type` is identity-load-bearing (`treasury_ensure_municipality`
 * keys on it), so a later retype MINTS A DUPLICATE rather than moving the row.
 * ⚠⚠ Still READ NOTE 1 of each report before seeding, per the Yakutat lesson:
 * the name is not the evidence, the issuer's own reporting-entity note is.
 *
 * ── ⚠⚠⚠ NEVER JOIN FAC BY NAME — 299 HI AUDITEES, FOUR GOVERNMENTS ────────
 *
 * The other 295 are STATE bodies and COMPONENT UNITS, and a loose name match
 * claims them:
 *
 *   STATE OF HAWAII DEPARTMENT OF TRANSPORTATION — its Highways, Airports,
 *     Administration and Harbors divisions each file SEPARATELY (4 EINs)
 *   Department of Education, State of Hawaii — the state runs ALL schools;
 *     Hawaii has no local school districts at all
 *   THE JUDICIARY, DEPARTMENT OF THE ATTORNEY GENERAL,
 *     OFFICE OF HAWAIIAN AFFAIRS
 *   ⚠ Department of Water, County of Kauai (EIN 472810526) — a COMPONENT UNIT
 *     of Kauai with its own EIN and its own filings. The exact lookalike the
 *     Alaska loader had to exclude (KODIAK ISLAND HOUSING AUTHORITY et al).
 *
 * This roster is keyed on the four government EINs, and `fetchHiCounties.mjs`
 * then verifies every downloaded PDF against its own cover page.
 *
 * ── ⚠ FISCAL YEAR: ALL FOUR END JUNE 30 ───────────────────────────────────
 *
 * Confirmed by `fy_end_date` on all 38 FAC filings. Unlike the Alaska family,
 * which carried two calendars (the boroughs June 30, Anchorage December 31),
 * this cohort is uniform — but it is still asserted per filing, never carried.
 *
 * ── ⭐ THE ROSTER IS 38 FILINGS, NOT 40 ───────────────────────────────────
 *
 * Honolulu and Maui run FY2016-2025. Hawaii County and Kaua'i stop at FY2024.
 *
 * ⚠ That gap was RE-CHECKED LIVE on 2026-10-29, because the bulk CSV is only a
 * September snapshot:
 *
 *     api.fac.gov/general?auditee_ein=in.(996000658,996000567)&audit_year=eq.2025
 *       -> []        control: the same query for Honolulu returns 1 row
 *     ...&audit_year=eq.2026 for all four
 *       -> []        nobody has filed FY2026 yet
 *
 * They have not filed. That is the PUBLISHER'S gap, not TT's, and it must
 * reach the reader as such rather than looking like a loader failure.
 *
 * ⚠ FAC's PDF archive starts at FY2016, so that is this load's floor. The
 * counties' own sites may go deeper; that is a later, more expensive pass.
 */

// ⚠ Moved out of `akBoroughSources.mjs` so both FAC-sourced state families
// share one definition of what makes a URL citable.
import { FAC_PDF_BASE, assertCitable } from './facCitable.mjs';

export { FAC_PDF_BASE, assertCitable };

/**
 * The four governments.
 *
 * `population` / `populationYear` are census vintage 2024 POPESTIMATE2024,
 * measured from `cache/co-est2024-alldata.csv`.
 *
 * `geoid` is the county FIPS. ⚠ Honolulu has NO SUMLEV 162 geography, so it
 * cannot take San Francisco's `census-pep-162-exact` basis — its only census
 * geography IS the county. `seedHiCounties.mjs` records that honestly rather
 * than claiming a place geoid that does not exist.
 *
 * ⚠⚠ `sourcePage` IS NOT A CITATION AND IS NOT USED AS ONE. Measured
 * 2026-10-29, not one of the four passes the "a reader can click it and see
 * this data" test: Honolulu answered only after 30.7s (two earlier GETs timed
 * out at 0 bytes) and names just three fiscal years; Maui's never mentions an
 * ACFR at all; Hawaii County's and Kaua'i's return 403 to every client tried,
 * browser headers included. `source_url` is the FAC permalink. These are kept
 * only as the starting point for the deep-link follow-up.
 */
export const HI_COUNTIES = Object.freeze([
  Object.freeze({
    key: 'honolulu',
    name: 'Honolulu',
    // ⚠ The legal name is "City and County of Honolulu". TT stores the bare
    // city name for a consolidated city-county, as it does for San Francisco
    // and Philadelphia, because that is what a reader searches for.
    legalName: 'City and County of Honolulu',
    entityType: 'city',
    state: 'HI',
    ein: '996001257',
    geoid: '15003',
    population: 998747,
    populationYear: 2024,
    sourcePage: 'https://www.honolulu.gov/budget/',
  }),
  Object.freeze({
    key: 'hawaii',
    // ⚠⚠ `Hawaii County` differs from the existing `Hawaii` STATE node by one
    // word. `check:forks` is the only thing that looks; run it after seeding.
    name: 'Hawaii County',
    legalName: 'County of Hawaii',
    entityType: 'county',
    state: 'HI',
    ein: '996000567',
    geoid: '15001',
    population: 209790,
    populationYear: 2024,
    sourcePage: 'https://www.hawaiicounty.gov/departments/finance',
  }),
  Object.freeze({
    key: 'maui',
    name: 'Maui County',
    legalName: 'County of Maui',
    entityType: 'county',
    state: 'HI',
    ein: '996000618',
    geoid: '15009',
    population: 163688,
    populationYear: 2024,
    sourcePage: 'https://www.mauicounty.gov/193/Finance',
  }),
  Object.freeze({
    key: 'kauai',
    // ⚠ The county styles itself "Kaua'i" and FAC spells it three ways
    // (COUNTY OF KAUA'I, COUNTY OF KAUAI). TT stores the census spelling,
    // without the ʻokina, so name matching and geoid joins behave.
    name: 'Kauai County',
    legalName: "County of Kaua'i",
    entityType: 'county',
    state: 'HI',
    ein: '996000658',
    geoid: '15007',
    population: 73840,
    populationYear: 2024,
    sourcePage: 'https://www.kauai.gov/Government/Departments-Agencies/Finance',
  }),
]);

/**
 * {entityKey: {fiscalYear: {report_id, name, ein, uei, fy_end}}}
 *
 * Transcribed from `cache/fac-general.csv` filtered on the four EINs above —
 * data, not computed. `uei` reads `GSA_MIGRATION` on the pre-FY2022 rows the
 * Census migration carried over; each county has exactly ONE real UEI.
 */
export const FAC_ROSTER = Object.freeze({
  honolulu: Object.freeze({
    2016: { report_id: '2016-06-CENSUS-0000137896', name: 'CITY AND COUNTY OF HONOLULU', ein: '996001257', uei: 'GSA_MIGRATION', fy_end: '2016-06-30' },
    2017: { report_id: '2017-06-CENSUS-0000137896', name: 'CITY AND COUNTY OF HONOLULU', ein: '996001257', uei: 'GSA_MIGRATION', fy_end: '2017-06-30' },
    2018: { report_id: '2018-06-CENSUS-0000137896', name: 'CITY AND COUNTY OF HONOLULU', ein: '996001257', uei: 'GSA_MIGRATION', fy_end: '2018-06-30' },
    2019: { report_id: '2019-06-CENSUS-0000137896', name: 'CITY AND COUNTY OF HONOLULU', ein: '996001257', uei: 'GSA_MIGRATION', fy_end: '2019-06-30' },
    2020: { report_id: '2020-06-CENSUS-0000137896', name: 'CITY AND COUNTY OF HONOLULU', ein: '996001257', uei: 'GSA_MIGRATION', fy_end: '2020-06-30' },
    2021: { report_id: '2021-06-CENSUS-0000137896', name: 'CITY AND COUNTY OF HONOLULU', ein: '996001257', uei: 'GSA_MIGRATION', fy_end: '2021-06-30' },
    2022: { report_id: '2022-06-CENSUS-0000137896', name: 'CITY AND COUNTY OF HONOLULU', ein: '996001257', uei: 'D4W7SB9CF8G4', fy_end: '2022-06-30' },
    2023: { report_id: '2023-06-GSAFAC-0000032510', name: 'City and County of Honolulu', ein: '996001257', uei: 'D4W7SB9CF8G4', fy_end: '2023-06-30' },
    2024: { report_id: '2024-06-GSAFAC-0000359770', name: 'City and County of Honolulu', ein: '996001257', uei: 'D4W7SB9CF8G4', fy_end: '2024-06-30' },
    2025: { report_id: '2025-06-GSAFAC-0000409937', name: 'City and County of Honolulu', ein: '996001257', uei: 'D4W7SB9CF8G4', fy_end: '2025-06-30' },
  }),
  hawaii: Object.freeze({
    2016: { report_id: '2016-06-CENSUS-0000137893', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'GSA_MIGRATION', fy_end: '2016-06-30' },
    2017: { report_id: '2017-06-CENSUS-0000137893', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'GSA_MIGRATION', fy_end: '2017-06-30' },
    2018: { report_id: '2018-06-CENSUS-0000137893', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'GSA_MIGRATION', fy_end: '2018-06-30' },
    2019: { report_id: '2019-06-CENSUS-0000137893', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'GSA_MIGRATION', fy_end: '2019-06-30' },
    2020: { report_id: '2020-06-CENSUS-0000137893', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'GSA_MIGRATION', fy_end: '2020-06-30' },
    2021: { report_id: '2021-06-CENSUS-0000137893', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'GSA_MIGRATION', fy_end: '2021-06-30' },
    2022: { report_id: '2022-06-CENSUS-0000137893', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'F7S9S5D2CSP3', fy_end: '2022-06-30' },
    2023: { report_id: '2023-06-GSAFAC-0000039486', name: 'COUNTY OF HAWAII', ein: '996000567', uei: 'F7S9S5D2CSP3', fy_end: '2023-06-30' },
    // ⚠⚠⚠ RESUBMITTED — THE BULK CSV'S ID IS DEAD. The Sep-3 snapshot carries
    // `2024-06-GSAFAC-0000375935`, whose PDF endpoint returns HTTP 500 on
    // every attempt (three tried). The live API reports this id instead, and
    // it serves 6,267,428 bytes. A FAC report_id is NOT stable across a
    // resubmission, and a dead id looks exactly like a county that never
    // filed. Corrected live 2026-10-29.
    2024: { report_id: '2024-06-GSAFAC-0000432974', name: 'County of Hawaii', ein: '996000567', uei: 'F7S9S5D2CSP3', fy_end: '2024-06-30' },
  }),
  maui: Object.freeze({
    2016: { report_id: '2016-06-CENSUS-0000137895', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'GSA_MIGRATION', fy_end: '2016-06-30' },
    2017: { report_id: '2017-06-CENSUS-0000137895', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'GSA_MIGRATION', fy_end: '2017-06-30' },
    2018: { report_id: '2018-06-CENSUS-0000137895', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'GSA_MIGRATION', fy_end: '2018-06-30' },
    2019: { report_id: '2019-06-CENSUS-0000137895', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'GSA_MIGRATION', fy_end: '2019-06-30' },
    2020: { report_id: '2020-06-CENSUS-0000137895', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'GSA_MIGRATION', fy_end: '2020-06-30' },
    2021: { report_id: '2021-06-CENSUS-0000137895', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'GSA_MIGRATION', fy_end: '2021-06-30' },
    2022: { report_id: '2022-06-CENSUS-0000137895', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'VJLZC958JLH6', fy_end: '2022-06-30' },
    2023: { report_id: '2023-06-GSAFAC-0000032130', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'VJLZC958JLH6', fy_end: '2023-06-30' },
    2024: { report_id: '2024-06-GSAFAC-0000348871', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'VJLZC958JLH6', fy_end: '2024-06-30' },
    2025: { report_id: '2025-06-GSAFAC-0000405123', name: 'COUNTY OF MAUI', ein: '996000618', uei: 'VJLZC958JLH6', fy_end: '2025-06-30' },
  }),
  kauai: Object.freeze({
    2016: { report_id: '2016-06-CENSUS-0000137894', name: "COUNTY OF KAUA'I", ein: '996000658', uei: 'GSA_MIGRATION', fy_end: '2016-06-30' },
    2017: { report_id: '2017-06-CENSUS-0000137894', name: "COUNTY OF KAUA'I", ein: '996000658', uei: 'GSA_MIGRATION', fy_end: '2017-06-30' },
    2018: { report_id: '2018-06-CENSUS-0000137894', name: "COUNTY OF KAUA'I", ein: '996000658', uei: 'GSA_MIGRATION', fy_end: '2018-06-30' },
    2019: { report_id: '2019-06-CENSUS-0000137894', name: 'COUNTY OF KAUAI', ein: '996000658', uei: 'GSA_MIGRATION', fy_end: '2019-06-30' },
    2020: { report_id: '2020-06-CENSUS-0000137894', name: 'COUNTY OF KAUAI', ein: '996000658', uei: 'GSA_MIGRATION', fy_end: '2020-06-30' },
    2021: { report_id: '2021-06-CENSUS-0000137894', name: 'COUNTY OF KAUAI', ein: '996000658', uei: 'GSA_MIGRATION', fy_end: '2021-06-30' },
    2022: { report_id: '2022-06-CENSUS-0000137894', name: 'COUNTY OF KAUAI', ein: '996000658', uei: 'HTMSM8JK94Q5', fy_end: '2022-06-30' },
    2023: { report_id: '2023-06-GSAFAC-0000056091', name: 'COUNTY OF KAUAI', ein: '996000658', uei: 'HTMSM8JK94Q5', fy_end: '2023-06-30' },
    2024: { report_id: '2024-06-GSAFAC-0000348912', name: 'COUNTY OF KAUAI', ein: '996000658', uei: 'HTMSM8JK94Q5', fy_end: '2024-06-30' },
  }),
});

/** The government for `key`, or undefined. */
export function countyByKey(key) {
  return HI_COUNTIES.find((c) => c.key === key);
}

/** Ascending fiscal years this county filed, from the roster. */
export function fysFor(key) {
  return Object.keys(FAC_ROSTER[key] ?? {}).map(Number).sort((a, b) => a - b);
}

/**
 * The CITABLE FAC permalink for one filing, or null if the county did not file
 * that year.
 *
 * ⚠⚠⚠ This — never `res.url` — is what the fetcher records and the loader
 * stamps as `source_url`. See `facCitable.mjs`.
 */
export function documentUrlFor(key, fiscalYear) {
  const rec = FAC_ROSTER[key]?.[String(fiscalYear)];
  return rec ? assertCitable(`${FAC_PDF_BASE}${rec.report_id}`) : null;
}
