/**
 * Pennsylvania + Indiana — the seven session-5 entities (Knight campaign).
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * Knight communities: Philadelphia and State College (PA), Fort Wayne and Gary
 * (IN), plus the parent counties Centre (PA), Allen and Lake (IN). Philadelphia
 * is its own county and is therefore ONE entity (spec §4.5).
 *
 * These are PENNSYLVANIA'S FIRST LOCAL ENTITIES in TT. Indiana already carries
 * 23 Monroe County entities from earlier Bloomington work; all four entities
 * here are new.
 *
 * ── ⚠⚠ JOIN ON THE PUBLISHER'S ID, NEVER ON `name` ──────────────────────────
 *
 * Both publishers key on a code, and both corpora contain near-misses that a
 * name match would silently swallow:
 *
 *   PA  `NEW PHILADELPHIA BORO` (541023, Schuylkill) is a DIFFERENT government
 *       from `PHILADELPHIA CITY` (510012), and a substring match on
 *       "PHILADELPHIA" hits both. TT also already contains `New Philadelphia`
 *       in OHIO. `PHILADELPHIA  COUNTY` (510001) carries a DOUBLE SPACE.
 *   PA  `CENTRE TOWNSHIP` exists in several counties and is not Centre County.
 *   IN  `unit_code` is only unique WITHIN a county — Gary is `0101` in county
 *       45, but `0101` in county 02 is a different city entirely. The key is
 *       the PAIR (cnty_cd, unit_code).
 *
 * The FAC census is worse: it carries SIX `Lake County` rows (CO, FL, IL, IN,
 * MI, MN — Florida's at month 10 and Montana's at month 7 while Indiana's is
 * month 1), THREE `Philadelphia` rows (PA 7, MS 10, NY 6) and TWO `Gary` rows
 * (IN, MN). This is the fourth occurrence of the Saint-Louis-County shape in
 * this campaign. `censusName` + state is the join, never the bare name.
 *
 * ── ⚠⚠ PHILADELPHIA IS `city`, AND GEORGIA IS THE OUTLIER ───────────────────
 *
 * Philadelphia is coterminous with Philadelphia County, so it is one entity.
 * Session 4 typed Georgia's consolidated governments `county` and expected to
 * set the precedent. Chris reversed that here on 2026-08-29, and the live DB is
 * why: TT ALREADY carries San Francisco — itself a consolidated city-county —
 * as `city` with `county_id` NULL, and that predates session 4. So `county` was
 * the divergence, not `city`.
 *
 * Following DCED (which files Philadelphia in the MUNICIPAL extract, typed
 * `City`, and leaves an empty `PHILADELPHIA  COUNTY` placeholder that never
 * files) therefore agrees with TT's own older convention.
 *
 * ⚠ Coterminousness is VERIFIED, not assumed, the same way Macon-Bibb was:
 * Census PEP vintage 2024 gives Philadelphia city (SUMLEV 162) 1,573,916 and
 * Philadelphia County (SUMLEV 050) 1,573,916 — identical.
 *
 * ⚠ FOLLOW-UP, deliberately NOT done here: Macon-Bibb and Columbus-Muscogee are
 * now inconsistent with San Francisco and Philadelphia. Retyping them moves $0
 * (`entity_type` lives on `municipalities`, not `budgets`) but edits merged
 * session-4 work. Nashville-Davidson (session 6) and Lexington-Fayette
 * (session 8) are still to come, so settle the rule before those land.
 *
 * ── ⚠⚠ `entity_type` MUST RENDER THE SOURCE CHIP ────────────────────────────
 *
 * `src/data/sourceChipTypes.ts` limits the chip to
 * {city, municipality, town, township, county, state}. **`borough` is not in
 * that set**, so typing State College by its legal class would silently drop its
 * provenance chip — precisely the defect that file was written to record (`city`
 * was missing for months, every gate green, no city showed a source).
 *
 * State College is therefore `municipality`: covered by the chip set, and more
 * honest than `city`, which Pennsylvania law uses for a distinct class of
 * government that a borough is not.
 *
 * ── POPULATIONS ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same program
 * and vintage as the NC, FL and GA entities, so all are comparable.
 *
 *   Places   sub-est2024_42.csv (PA) / sub-est2024_18.csv (IN), SUMLEV=162
 *   Counties co-est2024-alldata.csv, SUMLEV=050
 *
 * ⚠ NONE OF THE FOUR CITIES STRADDLES A COUNTY LINE — checked, not assumed. For
 * each, the SUMLEV=157 county-part row equals the SUMLEV=162 whole-place row:
 * State College 41,228 in Centre; Fort Wayne 273,203 in Allen; Gary 67,555 in
 * Lake; Philadelphia 1,573,916 in Philadelphia. So `county_id` is an identity
 * here, not the approximation it is for Durham.
 *
 * ⚠ DCED PUBLISHES ITS OWN POPULATION COLUMN AND IT DISAGREES (Philadelphia
 * 1,603,797; State College 40,501). It is an older vintage. TT uses Census PEP
 * for cross-entity comparability; DCED's column is deliberately NOT read.
 *
 * ── FISCAL CALENDAR ─────────────────────────────────────────────────────────
 *
 * ⚠⚠ PENNSYLVANIA IS A TRAP. 611 of the 643 PA rows in the FAC census are month
 * 1; PHILADELPHIA IS ONE OF THIRTEEN THAT ARE NOT — it is month 7. A loader that
 * resolves "PA = January" once and carries it across the state mislabels
 * Philadelphia's entire series, which is exactly
 * `project_fysm_column_default_one_defect`. Every month here is declared per
 * ENTITY and confirmed against the census per ROW; nothing is defaulted.
 *
 * ⚠⚠ AND DCED'S FORM CONTRADICTS THE CENSUS ON ITS FACE. The DCED-CLGS-30 is
 * calendar-framed throughout ("ending cash balance … as of December 31",
 * "Fund Balance/Retained Earnings 12/31"), yet Philadelphia's fiscal year ends
 * June 30. Resolved by ORACLE rather than by argument, 2026-08-29:
 *
 *     DCED `Total Taxes Revenues`, Reporting Year 2023   $5,160,574,000
 *     Philadelphia ACFR, governmental funds, FY ended
 *       June 30 2023, Tax Revenue  $5,160,574 thousand = $5,160,574,000
 *                                                        ------------- $0
 *
 * An exact match to the dollar against a different publisher's document. DCED's
 * "Reporting Year" IS Philadelphia's July–June fiscal year; the 12/31 wording is
 * boilerplate Philadelphia ignores. FY2022 ties exactly too; FY2021 differs by
 * $254K (0.006%), most likely a later restatement in ACFR Table 4.
 *
 * Indiana is uniformly month 1 across all four entities, census-confirmed.
 * ⚠ NEVER CARRY THAT BETWEEN STATES — it is true of Indiana and false of
 * Philadelphia one file away.
 */

/** The load window taken this session, aligned across both states. */
export const PA_IN_LOAD_WINDOW = { first: 2015, last: 2024 };

/**
 * ⚠ Both sources reach much further and the marginal cost is verification, not
 * code — filed as a ready follow-up the way session 3 filed the Florida sweep,
 * so this session ends whole.
 *   PA DCED   1996–2024 (29 years), 2,572 municipalities + 67 counties
 *   IN Gateway 2011–2025 (15 years), all cities/towns + 92 counties
 */
export const SOURCE_REACH = {
  PA: { years: [1996, 2024], municipalities: 2572, counties: 67 },
  IN: { years: [2011, 2025], note: 'all cities/towns + 92 counties' },
};

export const PA_IN_KNIGHT_ENTITIES = [
  // ── Pennsylvania ─────────────────────────────────────────────────────────
  {
    key: 'philadelphia',
    name: 'Philadelphia',
    state: 'PA',
    entityType: 'city',
    population: 1_573_916,
    // Coterminous with its county -> one entity, no parent. See the header.
    parentCountyKey: null,
    coterminousCounty: 'Philadelphia County',
    source: 'PA_MUNI',
    dcedId: '510012',
    dcedName: 'PHILADELPHIA CITY',
    fiscalYearStartMonth: 7,
    censusName: 'Philadelphia',
    censusKind: 'municipality',
    censusConfirms: true, // FAC PA/Philadelphia/municipality month 7, 1998-2024
  },
  {
    key: 'state-college',
    name: 'State College',
    state: 'PA',
    // ⚠ NOT `borough` — see the source-chip note in the header.
    entityType: 'municipality',
    population: 41_228,
    parentCountyKey: 'centre-county',
    source: 'PA_MUNI',
    dcedId: '140933',
    dcedName: 'STATE COLLEGE BORO',
    fiscalYearStartMonth: 1,
    censusName: 'State College',
    censusKind: 'municipality',
    censusConfirms: true, // FAC PA/State College/municipality month 1, 1998-2025
  },
  {
    key: 'centre-county',
    name: 'Centre County',
    state: 'PA',
    entityType: 'county',
    population: 159_805,
    parentCountyKey: null,
    source: 'PA_COUNTY',
    dcedId: '140001',
    dcedName: 'CENTRE COUNTY',
    fiscalYearStartMonth: 1,
    censusName: 'Centre County',
    censusKind: 'county',
    censusConfirms: true, // FAC PA/Centre County/county month 1, 1999-2024
  },

  // ── Indiana ──────────────────────────────────────────────────────────────
  {
    key: 'fort-wayne',
    name: 'Fort Wayne',
    state: 'IN',
    entityType: 'city',
    population: 273_203,
    parentCountyKey: 'allen-county-in',
    source: 'IN_CITY',
    // ⚠ The key is the PAIR — `unit_code` is unique only within a county.
    countyCode: '02',
    unitCode: '0100',
    gatewayName: 'FORT WAYNE CIVIL CITY',
    fiscalYearStartMonth: 1,
    censusName: 'Fort Wayne',
    censusKind: 'municipality',
    censusConfirms: true, // FAC IN/Fort Wayne/municipality month 1, 1998-2025
  },
  {
    key: 'gary',
    name: 'Gary',
    state: 'IN',
    entityType: 'city',
    population: 67_555,
    parentCountyKey: 'lake-county-in',
    source: 'IN_CITY',
    countyCode: '45',
    unitCode: '0101',
    gatewayName: 'GARY CIVIL CITY',
    fiscalYearStartMonth: 1,
    censusName: 'Gary',
    censusKind: 'municipality',
    censusConfirms: true, // FAC IN/Gary/municipality month 1, 1998-2024
  },
  {
    key: 'allen-county-in',
    name: 'Allen County',
    state: 'IN',
    entityType: 'county',
    population: 399_295,
    parentCountyKey: null,
    source: 'IN_COUNTY',
    countyCode: '02',
    unitCode: '0000',
    gatewayName: 'ALLEN COUNTY',
    fiscalYearStartMonth: 1,
    censusName: 'Allen County',
    censusKind: 'county',
    censusConfirms: true,
    // ⚠ The census does NOT cover every year in the load window. Reported as
    // UNCOVERED per row, never silently treated as confirmation — `censusGuard()`
    // returns ok:true when it cannot find an entity, which makes silence look
    // like agreement (session 3's discipline).
    censusGaps: [2012, 2015, 2025],
  },
  {
    key: 'lake-county-in',
    name: 'Lake County',
    state: 'IN',
    entityType: 'county',
    population: 502_955,
    parentCountyKey: null,
    source: 'IN_COUNTY',
    countyCode: '45',
    unitCode: '0000',
    gatewayName: 'LAKE COUNTY',
    fiscalYearStartMonth: 1,
    censusName: 'Lake County',
    censusKind: 'county',
    censusConfirms: true,
    censusGaps: [2019, 2025],
  },
];

/** PA lookup by DCED Municipality ID — never by name. */
export function entityByDcedId(id) {
  return PA_IN_KNIGHT_ENTITIES.find((e) => e.dcedId === String(id).trim());
}

/**
 * IN lookup by the (county code, unit code) PAIR.
 * ⚠ `unit_code` alone is ambiguous across counties; Gary's `0101` in county 45
 * is a different government from `0101` in county 02.
 */
export function entityByGatewayUnit(countyCode, unitCode) {
  const cc = String(countyCode).trim().padStart(2, '0');
  const uc = String(unitCode).trim().padStart(4, '0');
  return PA_IN_KNIGHT_ENTITIES.find((e) => e.countyCode === cc && e.unitCode === uc);
}

export const PA_ENTITIES = PA_IN_KNIGHT_ENTITIES.filter((e) => e.state === 'PA');
export const IN_ENTITIES = PA_IN_KNIGHT_ENTITIES.filter((e) => e.state === 'IN');
