/**
 * Georgia — every local entity TT loads from the DCA RLGF.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * ⚠ RENAMED from `georgiaKnightEntities.mjs` / `GA_KNIGHT_ENTITIES`. The first
 * four entries arrived with the Knight campaign, but the roster is not a Knight
 * artifact — it is the list of governments read from one statewide source, and
 * the Atlanta wave below is not a Knight community. Naming it after the campaign
 * would have made every later addition look like a scope violation.
 *
 * ── WAVE 1, Knight session 4 (2026-08-29) ───────────────────────────────────
 *
 * Three Knight communities (Macon-Bibb, Columbus-Muscogee, Milledgeville) plus
 * Milledgeville's parent county, Baldwin. These were GEORGIA'S FIRST LOCAL
 * ENTITIES in TT; before that session the state had only its state node from
 * the state-ACFR arc.
 *
 * ── WAVE 2, Atlanta (2026-10-17) ────────────────────────────────────────────
 *
 * Atlanta plus BOTH counties it lies in, Fulton and DeKalb. Same source, same
 * `LOAD1` form generation, same FY2016-2025 window — no new parsing.
 *
 * ⚠⚠ ATLANTA STRADDLES A COUNTY LINE, AND TT's `county_id` IS SINGLE-VALUED.
 * Census Vintage 2024 splits the city's 520,070 people 477,903 Fulton (91.9%)
 * / 42,167 DeKalb (8.1%). `parentCountyKey` is therefore `fulton-county`: an
 * APPROXIMATION, the same one Durham carries, not an identity like
 * Milledgeville's. DeKalb is loaded as a full entity in its own right and is
 * simply not reachable as Atlanta's parent — that is a limitation of the
 * column, and it is recorded here rather than papered over by picking a
 * "primary" county and calling it exact.
 *
 * ⚠ DCA's own CICOID agrees with that choice, independently: the middle three
 * digits are DCA's county number, and Atlanta's `2060002` carries `060` =
 * Fulton (`1060060`), not `044` = DeKalb (`1044044`).
 *
 * ⚠ NAME-COLLISION TRAP, same shape as wave 1: `South Fulton City` (`2060505`)
 * is a DIFFERENT government — a city incorporated in 2017, not part of Atlanta
 * and not Fulton County. Select by CICOID.
 *
 * ⚠⚠ THREE REAL GAPS, which are DCA's and not fetch failures: Fulton has no
 * FY2025 filing, and DeKalb has neither FY2024 nor FY2025. Verified by BYTES,
 * not by status code — see the trap note on GA_LOAD_WINDOW below.
 *
 * ── ⚠⚠ `cicoid` IS THE JOIN KEY, NEVER `name` ───────────────────────────────
 *
 * Georgia DCA assigns each government a numeric CICOID — `1xxxxxx` counties,
 * `2xxxxxx` municipalities, `3xxxxxx` consolidated governments — then a
 * three-digit county number and a sequence. The 721-option dropdown contains
 * four near-misses for these four entities, each a DIFFERENT government:
 *
 *   `Macon County`  (1096096)  a separate county, pop 11,831 — NOT Macon-Bibb
 *   `Bibb City`     (2106001)  its `106` is MUSCOGEE — a former mill village
 *                              in Columbus, nothing to do with Bibb County
 *   `Baldwin City`  (2068002)  unrelated to Baldwin County (1005005)
 *   `Macon City`    (2011001)  and `Bibb County` (1011011) are the
 *                              PRE-CONSOLIDATION governments
 *
 * A name match silently swaps an 11,831-person county for a 157,056-person
 * consolidated government. This is the Palm Beach shape from session 3.
 *
 * ── ⚠⚠ CONSOLIDATED GOVERNMENTS ARE TYPED `city` — CORRECTED 2026-08-30 ─────
 *
 * Macon-Bibb and Columbus-Muscogee are single governments performing both city
 * and county functions, so each is ONE entity (spec §4.5) — creating a city AND
 * a county row would double-count them in every rollup. That part was always
 * right. **The TYPE was not.**
 *
 * Session 4 typed them `county` believing it was setting TT's precedent. It was
 * not: TT ALREADY CARRIED ONE. **San Francisco — itself a consolidated
 * city-county — has been typed `city` with `county_id` NULL since long before
 * this campaign.** Session 5 checked the live database rather than reasoning
 * from the filings, and that made session 4's call the divergence, not the
 * precedent.
 *
 * Retyped to `city` on 2026-08-30 (Chris's call) so TT holds ONE convention:
 *   San Francisco  CA  city, county_id NULL   (pre-existing)
 *   Philadelphia   PA  city, county_id NULL   (session 5)
 *   Macon-Bibb     GA  city, county_id NULL   (this correction)
 *   Columbus-Muscogee GA city, county_id NULL (this correction)
 * Nashville-Davidson (session 6) and Lexington-Fayette (session 8) follow it.
 *
 * ⚠ The session-4 arguments FOR `county` were real and are worth keeping, because
 * they are what makes this a judgement rather than a bug:
 *   - Census confirms each is COTERMINOUS with its county: Macon-Bibb's place
 *     population (157,056) is identical to Bibb County's, and Columbus city's
 *     (201,830) is identical to Muscogee County's. Verified, not assumed.
 *   - The RLGF filings show them performing county functions — Sheriff's
 *     Office, Tax Commissioner, Superior Court, Probate Court, Coroner.
 *   - Macon-Bibb's legal NAME is literally "Macon-Bibb County", and the name is
 *     deliberately UNCHANGED by this correction — only the type moved.
 * Every one of those is equally true of San Francisco, which is the point:
 * they justify a `consolidated` type, not `county` specifically.
 *
 * ⚠ Pennsylvania's publisher independently agrees: DCED files Philadelphia in
 * the MUNICIPAL extract typed `City`, and keeps an empty `PHILADELPHIA  COUNTY`
 * placeholder that never files.
 *
 * ⚠ SAFE TO CHANGE, MEASURED NOT ASSUMED: `entity_type` lives on
 * `municipalities`, not `budgets`, so the frozen-figure digest — which hashes
 * (budget id | total_budget) — cannot move. $0 moved and the 38 budget rows on
 * these two entities are untouched. Checked before the change: NOTHING pointed
 * at either as its `county_id` (Milledgeville's parent is Baldwin County), so
 * no parent/child relationship broke.
 *
 * ⚠ TT's `entity_type` is free text, so a `consolidated` value was possible; it
 * was rejected because UI and rollup code switches on the existing values and
 * an unknown type would drop these two out of both. `city` is also in
 * `SOURCE_CHIP_ENTITY_TYPES`, so provenance keeps rendering. Revisit as its own
 * change if the campaign ever wants consolidated governments distinguishable —
 * that is a UI/rollup question, not a typing one.
 *
 * ── POPULATIONS ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same program
 * and vintage as the FL and NC entities, so all are comparable.
 *
 *   Places   sub-est2024_13.csv, SUMLEV=162 (whole place)
 *   Counties co-est2024-alldata.csv, SUMLEV=050
 *
 * ⚠ MILLEDGEVILLE DOES NOT STRADDLE A COUNTY LINE — checked, not assumed. Its
 * SUMLEV=157 county-part row for county 009 (Baldwin) carries the identical
 * 16,664 as its whole-place row, so `county_id` is an identity here rather than
 * the approximation it is for Durham.
 *
 * ── FISCAL CALENDAR ─────────────────────────────────────────────────────────
 *
 * ⚠⚠ GEORGIA IS NOT A UNIFORM-MONTH STATE. The FAC census GA slice (538 rows)
 * splits 225 July / 212 January / 60 October / 41 other, and these seven
 * entities are themselves split: Baldwin, Fulton and DeKalb counties all end
 * December 31 (start month 1) while Atlanta, Milledgeville, Macon-Bibb and
 * Columbus-Muscogee end June 30 (start month 7).
 *
 * ⚠⚠ WAVE 2 PUTS THE TRAP INSIDE ONE METRO: Atlanta is month 7 and both of its
 * counties are month 1. A loader that resolved a month once per STATE, or
 * carried one across a city/county boundary, would be wrong on three of the
 * three new entities. Every value is declared per entity AND re-read per filing
 * from the form's own `FYEmonth` — confirmed across all 27 wave-2 filings, each
 * reporting `MosRptd` = 12.
 *
 * ⚠ ATLANTA CHANGED ITS FISCAL CALENDAR, the Baldwin shape again. FAC has it at
 * month 1 for 1999-2001 and 2003-2005, a 6-MONTH "other" period in 2006 — the
 * transition stub — then month 7 from 2007 through 2024. The entire change sits
 * BEFORE the FY2016-2025 window, so it is a live trap for the FY2009-2015
 * follow-up and not for this load.
 *
 * ⚠ FULTON'S FAC AUDIT-YEAR LIST ENDS AT 2021, so FY2022-2024 rest on the
 * filing's own `FYEmonth` alone. That is weaker than a two-source agreement and
 * is recorded as such; it is NOT the Columbus-Muscogee case, where no census row
 * exists at all. DeKalb's list runs 2003-2024 and covers its whole window.
 *
 * Florida, loaded one session
 * earlier, is 10 and North Carolina is 7 —
 * `project_fysm_column_default_one_defect` is exactly the defect of carrying a
 * month across a boundary, so every value here is declared per entity AND
 * re-read per filing from the form's own `FYEmonth` field.
 *
 * ⚠⚠ TWO OF THE FOUR ARE ABSENT FROM THE FAC CENSUS, so `censusGuard()` would
 * return `{ok:true}` for them without checking anything — the CA-counties blind
 * spot in a new place. Recorded honestly per entity in `censusName` below:
 *   - Columbus-Muscogee: NO row under any name. Census-unverifiable.
 *   - Macon-Bibb: only the PRE-CONSOLIDATION `Macon` (municipality, 1998-2013)
 *     and `Bibb County` (2000-2013). Nothing for the consolidated government
 *     that has existed since 2014, i.e. nothing covering any loaded year.
 *   - Milledgeville and Baldwin County ARE covered and DO confirm.
 *
 * ⚠ BALDWIN COUNTY CHANGED ITS FISCAL CALENDAR. FAC has it at month 7 for
 * 1998-2001 and 2005-2008, month 1 for 2011-2023, with a 9-month stub in 2010.
 * The FY2016+ window loaded here is entirely after the change and every filing
 * reports `MosRptd` = 12 with `MoChng` = No, so the change is a live trap for
 * the FY2009-2015 follow-up, not for this load.
 */

export const GA_RLGF_ENTITIES = Object.freeze([
  {
    key: 'baldwin-county',
    cicoid: '1005005',
    name: 'Baldwin County',
    state: 'GA',
    entityType: 'county',
    population: 43644,
    populationSource: 'co-est2024-alldata.csv SUMLEV=050 COUNTY=009',
    fiscalYearStartMonth: 1,
    fiscalYearEndText: 'December 31',
    censusName: 'Baldwin County',
    censusKind: 'county',
    censusConfirms: true,
    parentCountyKey: null,
  },
  {
    key: 'milledgeville',
    cicoid: '2005001',
    name: 'Milledgeville',
    state: 'GA',
    entityType: 'city',
    population: 16664,
    populationSource: 'sub-est2024_13.csv SUMLEV=162 PLACE=51492',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    censusName: 'Milledgeville',
    censusKind: 'municipality',
    censusConfirms: true,
    parentCountyKey: 'baldwin-county',
  },
  {
    key: 'macon-bibb',
    cicoid: '3011011',
    name: 'Macon-Bibb County',
    state: 'GA',
    // ⚠ `city`, corrected 2026-08-30 — see the header. The NAME keeps "County"
    // because that is the government's legal name; only the type moved.
    entityType: 'city',
    population: 157056,
    populationSource: 'sub-est2024_13.csv SUMLEV=162 PLACE=49008 (= Bibb County, coterminous)',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    // ⚠ Census holds only the pre-consolidation `Macon` and `Bibb County`,
    // neither covering FY2014+. Left null so the guard cannot report a
    // confirmation it never made.
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    parentCountyKey: null,
  },
  {
    key: 'columbus-muscogee',
    cicoid: '3106002',
    name: 'Columbus-Muscogee',
    state: 'GA',
    // ⚠ `city`, corrected 2026-08-30 — see the header.
    entityType: 'city',
    population: 201830,
    populationSource: 'sub-est2024_13.csv SUMLEV=162 PLACE=19000 (= Muscogee County, coterminous)',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    // ⚠ NO FAC census row exists under any spelling. Census-unverifiable.
    censusName: null,
    censusKind: null,
    censusConfirms: false,
    parentCountyKey: null,
  },

  // ── WAVE 2 — Atlanta and both of its counties (2026-10-17) ────────────────
  {
    key: 'fulton-county',
    cicoid: '1060060',
    name: 'Fulton County',
    state: 'GA',
    entityType: 'county',
    population: 1090354,
    populationSource: 'co-est2024-alldata.csv SUMLEV=050 COUNTY=121',
    fiscalYearStartMonth: 1,
    fiscalYearEndText: 'December 31',
    censusName: 'Fulton County',
    censusKind: 'county',
    // ⚠ FAC confirms month 1, but its audit-year list stops at 2021 — so this
    // is a genuine confirmation for FY2016-2021 and silence, not disagreement,
    // for FY2022-2024. Recorded in the header.
    censusConfirms: true,
    parentCountyKey: null,
  },
  {
    key: 'dekalb-county',
    cicoid: '1044044',
    name: 'DeKalb County',
    state: 'GA',
    entityType: 'county',
    population: 770307,
    populationSource: 'co-est2024-alldata.csv SUMLEV=050 COUNTY=089',
    fiscalYearStartMonth: 1,
    fiscalYearEndText: 'December 31',
    // ⚠ FAC spells it `Dekalb County`, lowercase k. Transcribed as the census
    // has it so the lookup matches; TT's own name keeps the government's.
    censusName: 'Dekalb County',
    censusKind: 'county',
    censusConfirms: true,
    parentCountyKey: null,
  },
  {
    key: 'atlanta',
    cicoid: '2060002',
    name: 'Atlanta',
    state: 'GA',
    entityType: 'city',
    population: 520070,
    // ⚠ The WHOLE-PLACE row. Its two SUMLEV=157 county parts are 477,903
    // (Fulton) + 42,167 (DeKalb) = 520,070, so the city is not double-counted
    // and the split is the evidence for `parentCountyKey` below.
    populationSource: 'sub-est2024_13.csv SUMLEV=162 PLACE=04000 (91.9% Fulton / 8.1% DeKalb)',
    fiscalYearStartMonth: 7,
    fiscalYearEndText: 'June 30',
    censusName: 'Atlanta',
    censusKind: 'municipality',
    censusConfirms: true,
    // ⚠⚠ AN APPROXIMATION, NOT AN IDENTITY — unlike Milledgeville, whose
    // county-part row equals its whole-place row exactly. See the header.
    parentCountyKey: 'fulton-county',
  },
]);

/** Look one up by CICOID — the only safe key. */
export function entityByCicoid(cicoid) {
  return GA_RLGF_ENTITIES.find((e) => e.cicoid === String(cicoid)) || null;
}

/**
 * The fiscal years this session loads, per entity.
 *
 * ⚠ Scope is the FY2016+ `LOAD1` form generation. FY2009-2015 uses a different
 * extract sheet with a different key set and is a filed follow-up.
 *
 * ⚠ Gaps are REAL and are DCA's, not fetch failures — Macon-Bibb has no FY2024
 * in DCA's own listing, Milledgeville has no FY2018, Fulton has no FY2025, and
 * DeKalb has neither FY2024 nor FY2025.
 *
 * ⚠⚠ A STATUS CODE IS NOT EVIDENCE A FILING EXISTS. DCA serves a 1,245-byte
 * HTML 404 page for an absent year, and a ranged probe of it comes back **206
 * Partial Content** — so every year of every entity looks present. The three
 * wave-2 gaps above were found only by reading the first four bytes: a real
 * filing is OLE2/BIFF8 `d0cf11e0`, the error page is `3c21444f` ("<!DO").
 * Probe the BYTES, and let the converter's `--check` be the second gate.
 */
/**
 * The two DCA form generations, and the fiscal years each one covers.
 *
 * ⚠⚠ THE WINDOW NOW SELECTS A READER, NOT JUST A LOOP BOUND. DCA changed the
 * workbook between FY2015 and FY2016: `v2` carries a `LOAD1` sheet keyed by UCOA
 * code, `v1` carries `Exportable Data` plus a redundant `Data` twin keyed by the
 * form's own line numbers. `scripts/lib/gaRlgf.mjs` reads v2 and
 * `scripts/lib/gaRlgfV1.mjs` reads v1.
 *
 * ⚠ These years are the BOUNDS of each generation, and are NOT how a reader is
 * chosen. `readFiling` dispatches on the sheets the workbook actually carries,
 * because the sheet is a fact about the file in hand while the year is only an
 * inference about what DCA did that year.
 *
 * ⚠ DCA also lists FY2008 (3 filings, 3 governments) and FY2026 (6 filings).
 * Neither is admitted: FY2008 has never been probed for which generation it
 * belongs to, and FY2026 is a question about the v2 ceiling.
 * Full measured design: `.planning/GA-RLGF-V1-DESIGN.md`.
 */
export const GA_FORM_GENERATIONS = Object.freeze({
  v1: Object.freeze({ firstFiscalYear: 2009, lastFiscalYear: 2015 }),
  v2: Object.freeze({ firstFiscalYear: 2016, lastFiscalYear: 2025 }),
});

/** The union of both generations — what the loader will accept at all. */
export const GA_LOAD_WINDOW = Object.freeze({
  firstFiscalYear: GA_FORM_GENERATIONS.v1.firstFiscalYear,
  lastFiscalYear: GA_FORM_GENERATIONS.v2.lastFiscalYear,
});
