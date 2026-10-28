/**
 * Alaska's six largest boroughs — entity registry and document provenance.
 *
 * NO SHEBANG — library module; tests import it.
 *
 * Extends the `ak-local-acfr-gf` family opened by the Municipality of Anchorage.
 * The AK STATE node (`processAKAcfr.js`) belongs to `state-acfr-gf` and is a
 * different document, and nothing here touches it.
 *
 * ── ⚠⚠ AN ALASKA BOROUGH IS A COUNTY-EQUIVALENT, SO IT IS TYPED `county` ──
 *
 * Alaska has no counties. Its 19 ORGANIZED boroughs are what the census counts
 * at SUMLEV 050, exactly where another state's counties sit, so they are typed
 * `county` here.
 *
 * ⚠⚠ NOT `borough`. In TT that value means the 949 PENNSYLVANIA boroughs — a
 * city-like unit BENEATH a county. Using one label for both would put a
 * county-equivalent into the children panel of a county. `entity_type` is
 * identity-load-bearing (`treasury_ensure_municipality` keys on it), so a later
 * retype MINTS A DUPLICATE rather than moving the row.
 *
 * ⚠ Alaska also has 11 CENSUS AREAS at SUMLEV 050 which have NO government and
 * cannot be loaded. Bethel Census Area (18,237) is larger than two of the
 * boroughs below and is still not a government. The county layer is 19, not 30.
 *
 * ── ⭐ JUNEAU IS UNIFIED, SO IT IS A `city` ───────────────────────────────
 *
 * The City and Borough of Juneau is a consolidated city-borough, like Anchorage.
 * The census test that settles it: a unified government's estimate is IDENTICAL
 * at SUMLEV 050 (county-equivalent), 162 (whole place) and 157 (county-part),
 * because the two geographies are the same. Measured on vintage 2024:
 *
 *   UNIFIED      Juneau 31,572 / 31,572 / 31,572   -> `city`
 *                Sitka 8,355, Wrangell 2,064 behave the same way (not loaded here)
 *   NOT UNIFIED  Ketchikan Gateway 13,677 = Ketchikan city 8,033 + balance 5,267
 *                Kodiak Island    12,654 = Kodiak city 5,399 + balance 6,681
 *                Mat-Su, Fairbanks North Star and Kenai Peninsula all print a
 *                "Balance of ..." row, i.e. they contain cities -> `county`
 *
 * Run that test before typing any further Alaska government.
 *
 * ── ⚠ FISCAL YEAR: ALL SIX END JUNE 30 — UNLIKE ANCHORAGE ────────────────
 *
 * Every borough here closes June 30 (`fiscalYearStartMonth: 7`), confirmed by
 * `fy_end_date` on all 60 FAC filings. ⚠⚠ ANCHORAGE, loaded in the same family,
 * closes DECEMBER 31. Two fiscal calendars inside one family — never carry the
 * month between entities.
 *
 * ── WHY THE DOCUMENTS COME FROM THE FEDERAL AUDIT CLEARINGHOUSE ──────────
 *
 * Each borough publishes its own ACFRs, but through SIX different and hostile
 * archive systems: Mat-Su serves `docs/general/<id>/FY<YY>-ACFR.pdf` with
 * non-sequential ids; Ketchikan Gateway uses CivicPlus `Archive.aspx?ADID=<n>`
 * whose ids are NOT ordered by year (63=FY2007, 62=FY2008, 56=FY2012,
 * 337=FY2015); Kenai's resources page lists only FY2002-03 and FY2003-04;
 * Juneau's forms archive is 343 paginated entries.
 *
 * FAC serves the complete audited package as a PDF, free, no key, no WAF:
 *
 *     https://app.fac.gov/dissemination/report/pdf/<report_id>
 *
 * ⚠ The bytes are the auditee's OWN submission, filed under federal penalty, so
 * this is a first-party document. `source_url` still cites each borough's own
 * publication page, because that is where a reader goes; the report_id records
 * exactly which file was parsed so any figure can be reproduced.
 *
 * ⚠ FAC's PDF archive starts at FY2016, so that is this load's floor. The
 * boroughs' own sites go deeper (Ketchikan to FY2006, Juneau's CAFRs to FY1985)
 * and remain available to a later, more expensive pass.
 *
 * ── ⚠⚠⚠ NEVER JOIN FAC BY NAME, AND DO NOT TRUST ITS EIN EITHER ─────────
 *
 * Three independent identity traps, all live in this cohort:
 *
 * 1. THE AUDITEE NAME IS NOT STABLE. Matanuska-Susitna files under THREE names
 *    in ten years: "MATANUSKA-SUSITNA BOROUGH, ALASKA" (FY2016-23), "MAT-SU
 *    BOROUGH" (FY2024), "MATANUSKA-SUSITNA BOROUGH" (FY2025).
 * 2. ⚠⚠ THE EIN CAN BE WRONG. The Fairbanks North Star Borough FY2024 filing
 *    carries EIN 920143182 — which belongs to MAT-SU HEALTH SERVICES, INC.,
 *    a different entity in a different borough. Its UEI is correct.
 * 3. ⚠⚠ `auditee_uei` IS THE LITERAL STRING `GSA_MIGRATION` on every census-era
 *    (pre-FY2022) row, so UEI resolves nothing before FY2022.
 *
 * So the roster is built on EIN **and** UEI together, and then every entry is
 * verified against the fiscal year and auditee name printed on the document's
 * own cover page by `fetchAkBoroughs.mjs`. The verification is what makes it
 * safe; no single key here is trustworthy alone.
 *
 * ⚠ Name filters also had to exclude SCHOOL / HOUSING / HEALTH: FAC's Alaska
 * rows contain "MATANUSKA-SUSITNA BOROUGH SCHOOL DISTRICT", "KODIAK ISLAND
 * HOUSING AUTHORITY", "KODIAK ISLAND HEALTH CARE FOUNDATION" and "KENAI
 * PENINSULA HOUSING INITIATIVES" — four separate governments and nonprofits a
 * loose name match claims.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** {entityKey: {fiscalYear: {report_id, name, fy_end, ein, uei}}} */
export const FAC_ROSTER = Object.freeze(
  JSON.parse(readFileSync(path.join(ROOT, 'scripts/data/akBoroughFacRoster.json'), 'utf8')),
);

export const FAC_PDF_BASE = 'https://app.fac.gov/dissemination/report/pdf/';

export const AK_BOROUGHS = Object.freeze([
  Object.freeze({
    key: 'matsu',
    name: 'Matanuska-Susitna Borough',
    state: 'AK',
    entityType: 'county',
    /** ⚠ Files under three different names at FAC; see the header. */
    facEin: '920030816',
    facUei: 'QRK7LJ2Y3RJ1',
    population: 117613,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://matsugov.us/finance',
  }),
  Object.freeze({
    key: 'fnsb',
    name: 'Fairbanks North Star Borough',
    state: 'AK',
    entityType: 'county',
    /** ⚠⚠ Its FY2024 filing carries MAT-SU HEALTH SERVICES' EIN. UEI is right. */
    facEin: '920030612',
    facUei: 'KBLKNWKWRAX5',
    population: 94951,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.fnsb.gov/234/Financial-Reports',
  }),
  Object.freeze({
    key: 'kpb',
    name: 'Kenai Peninsula Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '920030894',
    facUei: null,
    population: 61259,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.kpb.us/departments/finance-department/finance-overview',
  }),
  Object.freeze({
    key: 'juneau',
    /** ⚠ UNIFIED city-borough — typed `city`, not `county`. See the header. */
    name: 'City and Borough of Juneau',
    state: 'AK',
    entityType: 'city',
    facEin: '920038816',
    facUei: null,
    population: 31572,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://juneau.org/finance',
  }),
  Object.freeze({
    key: 'kgb',
    name: 'Ketchikan Gateway Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '920084626',
    facUei: null,
    population: 13677,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.kgbak.us/Archive.aspx?AMID=38',
  }),
  Object.freeze({
    key: 'kodiak',
    name: 'Kodiak Island Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '920030845',
    facUei: null,
    population: 12654,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.kodiakak.us/148/Finance',
  }),
]);

export function boroughByKey(key) {
  return AK_BOROUGHS.find((b) => b.key === key) ?? null;
}

/** Fiscal years FAC holds for one borough. */
export function fysFor(key) {
  return Object.keys(FAC_ROSTER[key] ?? {}).map(Number).sort((a, b) => a - b);
}

/** Resolve the fetch URL for one entity-year. */
export function documentUrlFor(key, fiscalYear) {
  const rec = FAC_ROSTER[key]?.[String(fiscalYear)];
  return rec ? `${FAC_PDF_BASE}${rec.report_id}` : null;
}
