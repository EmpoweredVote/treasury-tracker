/**
 * South Dakota — Knight session 8 entities.
 *
 * NO SHEBANG — tests import this module.
 *
 * Brown County is the parent county of Aberdeen, a Knight community. These are
 * SOUTH DAKOTA'S FIRST LOCAL ENTITIES in TT, so they found `sd-local-acfr-gf`
 * rather than extending an existing family.
 *
 * ── ⚠⚠ THE TWO SD ENTITIES DO NOT SHARE AN ACCOUNTING BASIS ────────────────
 *
 * Twelve miles apart, audited in the same town, and measured differently:
 *
 *   City of Aberdeen   GAAP, whole dollars     -> audited_gaap
 *   Brown County       MODIFIED CASH, cents    -> audited_ocboa
 *
 * Brown County's statements are titled `... - MODIFIED CASH BASIS` and its
 * auditor, the South Dakota Department of Legislative Audit, writes that they
 * are "prepared on the modified cash basis of accounting, which is a basis of
 * accounting other than accounting principles generally accepted in the United
 * States of America". The Federal Audit Clearinghouse agrees independently:
 * `gaap_results = not_gaap` on every filing.
 *
 * ⚠ Neither fact may be carried from one entity to the other. This is the
 * Boulder/Boulder County units lesson (7b) repeating on a different axis.
 *
 * ── ⚠ NAME TRAPS ───────────────────────────────────────────────────────────
 *
 * Brown County exists in WISCONSIN, MINNESOTA, OHIO, INDIANA, KANSAS, TEXAS,
 * ILLINOIS, NEBRASKA and several more. **EIN 466000011 is this one**; the City
 * of Aberdeen is 466000010, a single digit away. And ⚠⚠ ABERDEEN, MARYLAND
 * publishes its own ACFR at `aberdeenmd.gov`.
 *
 * ── FISCAL CALENDAR ────────────────────────────────────────────────────────
 *
 * Month 1, read off each document's own "For the Year Ended December 31,
 * <YYYY>" caption and independently confirmed by the FAC census
 * (`SD,Brown County,county,...,1,...`). South Dakota's census slice carries 226
 * county rows, so this is a real confirmation rather than `censusGuard()`
 * silently passing an entity it cannot find.
 *
 * ── POPULATION ─────────────────────────────────────────────────────────────
 *
 * US Census Bureau Population Estimates Program, Vintage 2024,
 * `co-est2024-alldata.csv` SUMLEV=050 — the same program and vintage as every
 * other entity in this campaign.
 */

/** @typedef {{key:string,name:string,state:string,entityType:string,censusName:string,
 *   fiscalYearStartMonth:number,population:number,parentCountyKey:string|null,
 *   units:number,family:string,basisLabel:string}} KnightEntity */

/** @type {readonly KnightEntity[]} */
export const SD_ENTITIES = Object.freeze([
  Object.freeze({
    key: 'browncounty',
    name: 'Brown County',
    state: 'SD',
    entityType: 'county',
    censusName: 'Brown County',
    fiscalYearStartMonth: 1,
    population: 37495,
    parentCountyKey: null,
    /** ⚠ Whole dollars on the WIRE. The documents print CENTS; the extractor
     *  verifies the tie in exact cents and converts once, at emission. */
    units: 1,
    family: 'sd-local-acfr-gf',
    /** ⚠⚠ Appears verbatim in the data_source string a reader sees. `audit_grade`
     *  is not yet surfaced by ev-accounts, so this label is currently the ONLY
     *  place the modified-cash fact reaches a reader. */
    basisLabel: 'modified cash basis',
  }),
]);

export function sdEntityByKey(key) {
  return SD_ENTITIES.find((e) => e.key === key) || null;
}

/**
 * Fiscal years with a document that extracts and ties.
 *
 * ⚠ Brown County is audited BIENNIALLY — South Dakota requires every county to
 * be audited at least once every two years — so this series is sparse by the
 * publisher's design, not by a gap in the hunt. FY2017-FY2019, FY2021-FY2022
 * and FY2025 have no filing at FAC and SD DLA publishes only the CURRENT report
 * per entity, so no archive holds them. Reported as absent, never written as $0.
 *
 * ⚠ FY2023's FAC filing is flagged `audit_period_covered = biennial` and its
 * cover names both 2022 and 2023. The statement THIS loads is the one captioned
 * "For the Year Ended December 31, 2023"; a separate FY2022 statement may sit
 * in the same document and is a filed follow-up, not an assumption.
 */
export const SD_WINDOWS = Object.freeze({
  browncounty: Object.freeze([2016, 2020, 2023, 2024]),
});
