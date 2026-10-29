/**
 * Alaska's organized boroughs — entity registry and document provenance.
 *
 * NO SHEBANG — library module; tests import it.
 *
 * TWELVE entities in two waves: the six LARGEST (#299, 2026-10-27) and the six
 * CLEAN ones added 2026-10-28 (North Slope, Northwest Arctic, Petersburg,
 * Sitka, Wrangell, Aleutians East). One route, one extractor, one calendar.
 * ⚠ Alaska has 19 organized boroughs; with Anchorage that leaves 6 unloaded —
 * Skagway (which CHANGED ITS FISCAL YEAR), Yakutat, Lake and Peninsula, Haines,
 * Bristol Bay (five FAC name spellings) and Denali (an image-only scan).
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
 * ── ⚠ FISCAL YEAR: ALL TWELVE END JUNE 30 — UNLIKE ANCHORAGE ─────────────
 *
 * Every borough here closes June 30 (`fiscalYearStartMonth: 7`), confirmed by
 * `fy_end_date` on all 118 FAC filings. ⚠⚠ ANCHORAGE, loaded in the same family,
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

  // ── WAVE 1 — six more boroughs, same route, same statement, same calendar ──
  //
  // Added 2026-10-28. All six close June 30 (`fy_end_date` on all 58 FAC
  // filings), all are born-digital at 1,605–2,442 chars/page, and all are read
  // by the same `extractAkBorough.py`. Nothing above this line changed.
  //
  // ⚠⚠ THE UNIFIED TEST WAS RUN ON ALL SIX, AND IT MOVED ONE OF THEM. Census
  // vintage 2024, SUMLEV 050 (county-equivalent) vs 162 (whole place) vs 157
  // (place part), from `co-est2024-alldata.csv` and `sub-est2024_2.csv`:
  //
  //   Sitka       050/162/157 all 8,355   -> UNIFIED -> `city`
  //   Wrangell    050/162/157 all 2,064   -> UNIFIED -> `city`
  //   Petersburg  050 3,436, NO 162 row, 157 = Kupreanof city 19
  //                                        + Balance 3,417   -> `county`
  //   North Slope        10,663 = 7 cities (Utqiagvik 4,668 …) + balance 3,205
  //   Northwest Arctic    7,134 = 10 cities (Kotzebue 2,889 …) + balance   754
  //   Aleutians East      3,632 = cities + balance 58
  //
  // ⭐ PETERSBURG IS THE ONE THAT LOOKS UNIFIED AND IS NOT. The City of
  // Petersburg dissolved into the borough in 2013, so the borough's own seat is
  // unincorporated "balance" today and the name reads like Sitka's. But
  // **Kupreanof city (pop 19) is a separate incorporated government inside it**,
  // which is exactly what the 157 rows show and what the unified test is for.
  // A name-based guess would have typed it `city` and buried a real government.
  Object.freeze({
    key: 'northslope',
    name: 'North Slope Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '920042378',
    facUei: 'C9NWKJZ37GX3',
    population: 10663,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.north-slope.org/departments/finance/',
    /**
     * ⚠⚠ THE ONLY PER-CAPITA OVERRIDE IN THE COHORT, AND IT IS REAL MONEY.
     *
     * The shared loader's units guard caps a General Fund at $20,000/capita.
     * North Slope's runs far above that, because the borough levies property
     * tax on the Prudhoe Bay oil and gas infrastructure inside its boundaries:
     * the tax base is industrial, the population is not. MEASURED off its own
     * ACFRs, General Fund revenue per resident (pop 10,663):
     *
     *   FY2016 $40,078   FY2020 $43,124   FY2024 $47,683
     *   FY2018 $40,804   FY2022 $39,037   FY2025 $52,990  <- highest
     *
     * ⚠ This raises the ceiling for ONE entity, on evidence, rather than
     * widening it for everyone, and `perCapitaMaxFor` refuses an override that
     * would LOWER the band. The guard exists to catch a 1000x units slip, and
     * at 1000x this borough would land near $53M/capita — 660x over the raised
     * ceiling, still caught. Measured per-capita values print on every load
     * line, so a drift inside the widened band stays visible.
     */
    perCapitaMax: 80_000,
  }),
  Object.freeze({
    key: 'nwarctic',
    name: 'Northwest Arctic Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '920116661',
    facUei: 'X9BGKCFEV966',
    population: 7134,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.nwabor.org/departments/finance/',
  }),
  Object.freeze({
    key: 'petersburg',
    /** ⚠ `county`, NOT `city` — Kupreanof city sits inside it. See above. */
    name: 'Petersburg Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '926000142',
    facUei: 'HREXPN6H9B74',
    population: 3436,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.petersburgak.gov/finance',
  }),
  Object.freeze({
    key: 'sitka',
    /** ⚠ UNIFIED city-borough — typed `city`, like Juneau and Anchorage. */
    name: 'City and Borough of Sitka',
    state: 'AK',
    entityType: 'city',
    facEin: '920041163',
    facUei: 'M916NLPJH1K4',
    population: 8355,
    fiscalYearStartMonth: 7,
    /** ⚠ cityofsitka.com returns 403 to non-browser clients; the page is real. */
    sourcePage: 'https://www.cityofsitka.com/departments/Finance',
  }),
  Object.freeze({
    key: 'wrangell',
    /** ⚠ UNIFIED city-borough — typed `city`. */
    name: 'City and Borough of Wrangell',
    state: 'AK',
    entityType: 'city',
    facEin: '926000144',
    facUei: 'EKXKZEKSQCN1',
    population: 2064,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.wrangell.com/finance',
  }),
  Object.freeze({
    key: 'aleutianseast',
    name: 'Aleutians East Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '920124066',
    facUei: 'R1T5FLNFFEP4',
    population: 3632,
    fiscalYearStartMonth: 7,
    /**
     * ⚠ EIGHT FILINGS, NOT TEN — FAC holds no FY2017 or FY2018 for this
     * borough. A single audit is only filed in a year the auditee spends
     * enough federal money to require one, so a missing year here means NO
     * FILING EXISTS at this source, not a failed fetch and not a $0. Recorded
     * as a coverage limit; the borough's own site remains a later route.
     */
    sourcePage: 'https://www.aleutianseast.org/departments/finance/',
  }),

  // ── WAVE 2 — the four with no novel loader mechanics ──────────────────────
  //
  // Added 2026-10-29. Bristol Bay, Haines, Yakutat and Lake and Peninsula. All
  // close June 30, all born-digital, all read by `extractAkBorough.py`.
  // ⚠ SKAGWAY IS DELIBERATELY NOT HERE: it CHANGED ITS FISCAL YEAR and FAC
  // carries both 06-30 and 12-31 year ends plus a filing literally named
  // "MUNICIPALITY OF SKAGWAY-6 MONTH AUDIT". This family has no
  // fiscal-year-change handling, and a half-year loaded as a full one moves
  // real money while tying at $0. It gets its own pass.
  // ⚠ DENALI IS NOT HERE EITHER: 137 chars/page, an image-only scan.
  //
  // ── ⚠⚠⚠ THE CENSUS CANNOT TYPE THESE THREE, AND WAVE 1'S TEST SAYS SO ────
  //
  // Wave 1 typed on an identical population at SUMLEV 050 / 162 / 157, which
  // proves a government is ALSO an incorporated place and therefore unified.
  // That test needs a 162 row to exist. Vintage 2024 prints NONE for Bristol
  // Bay (884), Haines (2,104) or Yakutat (690) — and no 157 rows either:
  //
  //   Bristol Bay Borough      050 884    no 162, no 157 at all
  //   Haines Borough           050 2,104  no 162, no 157 at all
  //   Yakutat City and Borough 050 690    no 162, no 157 at all
  //   Lake and Peninsula       050 1,315  6 cities + Balance 780  -> `county`
  //
  // Only Lake and Peninsula is settled by the census alone, so all four were
  // typed from THE ISSUER'S OWN NOTE 1 — and that read CORRECTED a provisional
  // `city` on Yakutat before anything was seeded.
  //
  // ⭐⭐ THE TWO SOURCES AGREE, AND TOGETHER THEY EXPLAIN WHY WAVE 1'S TEST
  // WORKED. Alaska distinguishes a unified home rule MUNICIPALITY from a home
  // rule BOROUGH, and the census tracks that distinction exactly:
  //
  //   UNIFIED HOME RULE MUNICIPALITY -> census prints a 162 PLACE row -> `city`
  //     Anchorage, Juneau, Sitka, Wrangell
  //   HOME RULE BOROUGH              -> no 162 row                    -> `county`
  //     Petersburg, Haines, Yakutat, Lake and Peninsula, and the rest
  //
  // ⚠⚠⚠ AND A BOROUGH THAT SWALLOWED ITS CITY IS STILL A BOROUGH. Three of
  // these say so in their own words:
  //   Haines   "created in October 2002, when the public voted to combine the
  //             Haines Borough with the City of Haines ... incorporated under
  //             the laws of the State of Alaska as a Home Rule borough"
  //   Yakutat  "The City of Yakutat was incorporated in 1948. On September 8,
  //             1992, the voters elected to create a 'home rule borough' and
  //             simultaneously DISSOLVE the City of Yakutat"
  //   Petersburg (wave 1) — the same shape, via Kupreanof
  //
  // ⚠⚠ YAKUTAT IS THE SHARPEST TRAP IN THE WHOLE COHORT: its legal name is
  // "City and Borough of Yakutat", which is the SAME CONSTRUCTION as Sitka's
  // and Wrangell's, and it is a `county`. The name carries no information
  // about the form of government. Read Note 1 before typing any Alaska
  // government — `entity_type` is identity-load-bearing, and a later retype
  // MINTS A DUPLICATE rather than moving the row.
  Object.freeze({
    key: 'bristolbay',
    name: 'Bristol Bay Borough',
    state: 'AK',
    entityType: 'county',
    /** ⚠⚠ FIVE FAC NAME SPELLINGS, incl. the FY2025 "BRISTOL BAY BOROUGH OF". */
    facEin: '920029832',
    facUei: 'N7DKJNBTYGE3',
    population: 884,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.bristolbayboroughak.us/finance',
    /**
     * ⚠⚠ THE SECOND PER-CAPITA OVERRIDE, AND THE SAME STORY AS NORTH SLOPE IN
     * A DIFFERENT INDUSTRY. Naknek is the hub of the Bristol Bay salmon
     * fishery, and the borough taxes the catch: its own statements name a
     * "Sales tax on raw fish" and a "Local fish tax", and the Taxes line is
     * 12,800,215 of FY2023's 17,885,914 General Fund revenue — 72%.
     *
     * The tax base is a seasonal industry; the 884 is YEAR-ROUND residents, so
     * per-capita is measuring the wrong denominator rather than the wrong
     * units. MEASURED across its own ACFRs, General Fund revenue per resident:
     *
     *   FY2016 $11,978   FY2020 $16,848   FY2023 $20,233
     *   FY2018 $14,663   FY2022 $20,342 <- highest   FY2025 $16,033
     *
     * ⚠ FY2022 and FY2023 are the only years over the shared $20,000 ceiling,
     * and both are independently confirmed: the oracle reads FY2023's printed
     * General Fund column as 17,885,914 and its five fund columns sum exactly
     * to the printed total. At 1000x this borough would land near $20M/capita,
     * ~680x over the raised ceiling and still caught.
     */
    perCapitaMax: 30_000,
  }),
  Object.freeze({
    key: 'haines',
    name: 'Haines Borough',
    state: 'AK',
    entityType: 'county',
    /** ⚠ The only wave-2 EIN that is not 92-prefixed. */
    facEin: '470888706',
    facUei: 'E9E5AVP1J6R1',
    population: 2104,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.hainesalaska.gov/finance',
  }),
  Object.freeze({
    key: 'yakutat',
    /**
     * ⚠⚠⚠ `county` DESPITE THE NAME. "City and Borough of Yakutat" reads
     * exactly like Sitka's and Wrangell's, which ARE `city`. It is a HOME RULE
     * BOROUGH: its own Note 1 says the voters created one in 1992 and
     * "simultaneously dissolve[d] the City of Yakutat". The census agrees by
     * printing no 162 place row. This entry said `city` until Note 1 was read.
     */
    name: 'City and Borough of Yakutat',
    state: 'AK',
    entityType: 'county',
    facEin: '926001319',
    facUei: 'C2UMLFJ9XP25',
    population: 690,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.yakutatak.gov/finance',
  }),
  Object.freeze({
    key: 'lakepen',
    name: 'Lake and Peninsula Borough',
    state: 'AK',
    entityType: 'county',
    facEin: '920128922',
    facUei: 'C5PJP3YDHSE5',
    population: 1315,
    fiscalYearStartMonth: 7,
    sourcePage: 'https://www.lakeandpen.gov/finance',
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

/**
 * ⚠⚠ A `source_url` IS A LINK A READER CLICKS, SO IT MUST STILL RESOLVE.
 *
 * FAC answers `documentUrlFor()` with a 302 to a PRESIGNED S3 OBJECT carrying
 * `X-Amz-Expires=30` — thirty SECONDS. `fetchAkBoroughs.mjs` recorded that
 * redirect target (`res.url`), following this repo's usual and usually-correct
 * rule of citing the URL that actually served the bytes, and so stamped a dead
 * link onto 227 Alaska borough rows across two loads.
 *
 * Nothing else could catch it. Not one of the five load guards, the frozen
 * invariant, the tie gate or the scope sweep reads a URL; every figure was
 * right and the only broken thing was the citation. So the check lives here,
 * at the point the manifest is written.
 *
 * Repaired in place by `scripts/repairAkBoroughSourceUrls.mjs`.
 */
export function assertCitable(url) {
  if (/[?&]X-Amz-(Expires|Signature)=/i.test(url)) {
    throw new Error(`source_url would be a PRESIGNED, EXPIRING link: ${String(url).slice(0, 80)}… `
      + 'Record the requested FAC URL, not the S3 object it redirects to.');
  }
  return url;
}
