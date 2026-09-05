/**
 * Indiana and Colorado local governments run the CALENDAR year, and the guards
 * that keep that stated rather than inherited.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── THIS FILE CORRECTS NO DATA. THAT IS THE POINT ───────────────────────────
 * All 86 Indiana local rows and all 64 Colorado local rows already read 1, and
 * both states' 54 state-level rows already read 7. Every one is RIGHT. Nothing
 * here moves a row.
 *
 * They were right by COINCIDENCE: 1 is what the dropped `NOT NULL DEFAULT 1`
 * handed every loader that said nothing, and both states happen to be
 * calendar-year states. This is the same argument made for Washington in
 * `scripts/lib/waFiscalCalendar.mjs`, and it is worth repeating because PR #71
 * showed the cost of the reflex: by then "January in a non-calendar state means
 * July" felt obvious, and Texas turned out to be OCTOBER. A month nobody has
 * cited is a month nobody can check.
 *
 * ── ⚠ AND IN COLORADO THE OBVIOUS CITATION DOES NOT COVER OUR CITY ──────────
 * Colorado has a clean statutory definition, and it does NOT reach Colorado
 * Springs. See the CO block below. That is the single most important thing in
 * this file: the statute looked sufficient and was not, exactly as Va. Code
 * § 15.2-2500 was not sufficient for two Virginia towns
 * (`scripts/lib/loaderFiscalCalendars.mjs`).
 */

/** Both states' local governments: January. */
export const LOCAL_MONTH = 1;

/** Both states: July for the state itself. Neither is a NASBO exception. */
export const STATE_MONTH = 7;

/** Months this corpus can legitimately produce. */
export const ALLOWED_MONTHS = new Set([1, 7, 10]);

export const STATES = {
  IN: {
    state: 'IN',
    stateNodeName: 'Indiana',
    /**
     * ⚠ Indiana's authority is FIRST-PARTY STATE-AGENCY GUIDANCE, not a single
     * statutory section. I looked for a definitional section putting political
     * subdivisions on the calendar year and did not find one; IC 6-1.1-17 speaks
     * of "the ensuing budget year" without defining its dates. Rather than cite a
     * statute that does not say what is claimed, the authority below is what was
     * actually read. If someone later finds the definitional section, it belongs
     * here — this is the weakest evidence in the IN/CO pair and is labelled so.
     */
    authority: {
      local: 'Indiana DLGF, "2025 Report on Expenditures Per Capita" (in.gov/dlgf): '
        + '"reflects the calendar year expenditures reported by each political '
        + 'subdivision" and "for calendar years 2023 and 2024". Its scope is stated '
        + 'explicitly: "Data were compiled according to the type of local '
        + 'government: counties, townships, cities/towns, school corporations, '
        + 'libraries, special districts, conservancy districts, and soil and water '
        + 'conservation districts" — which covers every Indiana entity type we hold.',
      localSecondary: 'Indiana SBOA, "Accounting and Financial Reporting Regulation '
        + 'Manual" (in.gov), prescribed note language: "The fiscal officer of the '
        + 'Unittype submits a proposed operating budget to the governing board for '
        + 'the following calendar year." The placeholder "Unittype" is the state\'s '
        + 'own generic form, so it applies to any unit type.',
      stateNode: '2025 NASBO State Expenditure Report: 46 states begin July 1; only '
        + 'NY, TX, AL and MI are exceptions. Indiana is not among them.',
    },
    /**
     * ⚠ Indiana gives us FIVE local entity types, two of which appear only on
     * `data_sources` and have no budget row: a SCHOOL CORPORATION and a PUBLIC
     * LIBRARY. Both were checked rather than waved through, because a school
     * district is the classic exception — Washington puts its school districts on
     * September 1 (RCW 1.16.030) and Ohio puts its on July–June (ORC § 9.34). In
     * Indiana they are not an exception: the DLGF report above names school
     * corporations and libraries in the same calendar-year compilation.
     */
    entityTypeMonths: {
      city: LOCAL_MONTH,
      county: LOCAL_MONTH,
      township: LOCAL_MONTH,
      school_district: LOCAL_MONTH,
      library: LOCAL_MONTH,
      state: STATE_MONTH,
    },
    /**
     * ⚠ RE-MEASURED 2026-09-05. This baseline had been stale in BOTH directions
     * and was reporting FAIL on `main` before anything in this change was made —
     * with `disagreeing 0, errors 0`, so no fiscal-calendar fact was ever wrong.
     * A partition count is a measurement with a date, and this one had two:
     *
     *   +78  PR #113 loaded Fort Wayne, Gary, Allen County and Lake County from
     *        the Indiana Gateway AFR branch and never moved this number.
     *   -45  migration 20260905000100 deleted the legacy Gateway-vintage rows
     *        for Ellettsville, Monroe County and three townships. Those five
     *        entities now hold NO budget rows: the AFR reload path covers cities
     *        /towns and counties, so Ellettsville and Monroe County return with
     *        the statewide sweep, and the three townships hold nothing until a
     *        township sweep is decided.
     *
     *   86 + 78 - 45 = 119, measured in the database, not derived.
     *
     * `sourceRows` is unchanged at 11: the nine legacy sources were DISABLED by
     * migration 20260905000000, not deleted, and this verifier counts rows in
     * treasury.data_sources regardless of is_enabled.
     */
    baseline: {
      localRows: 119,
      localEntities: 5,
      stateRows: 48,
      sourceRows: 11,
      sourceEntities: 9,
    },
    localRowsByEntity: {
      Bloomington: 41,
      'Allen County': 20,
      'Fort Wayne': 20,
      'Lake County': 20,
      Gary: 18,
    },
  },

  CO: {
    state: 'CO',
    stateNodeName: 'Colorado',
    authority: {
      local: 'C.R.S. § 29-1-102 (Local Government Budget Law of Colorado): '
        + '"\'Fiscal year\' means the period commencing January 1 and ending '
        + 'December 31; except that \'fiscal year\' may mean the federal fiscal '
        + 'year for water conservancy districts which have contracts with the '
        + 'federal government."',
      stateNode: '2025 NASBO State Expenditure Report: 46 states begin July 1; only '
        + 'NY, TX, AL and MI are exceptions. Colorado is not among them.',
    },
    entityTypeMonths: {
      city: LOCAL_MONTH,
      county: LOCAL_MONTH,
      state: STATE_MONTH,
    },
    baseline: {
      localRows: 64,
      localEntities: 2,
      stateRows: 6,
      sourceRows: 0,
      sourceEntities: 0,
    },
    localRowsByEntity: {
      'El Paso County': 36,
      'Colorado Springs': 28,
    },
  },
};

/**
 * Per-entity authorities, where the state-level citation does NOT settle the
 * entity and its own document had to.
 *
 * ⚠⚠ COLORADO SPRINGS IS THE REASON THIS MAP EXISTS. C.R.S. § 29-1-102 defines
 * "local government" as "any authority, county, municipality, city and county,
 * district, or other political subdivision of the state of Colorado" and then
 * EXCLUDES a list that includes HOME RULE CITIES and school districts. Colorado
 * Springs is a home rule city created under Colo. Const. art. XX — its own
 * municipal code says "a home rule City created pursuant to article XX of the
 * Colorado Constitution". So the tidy statutory definition does not reach it, and
 * reading § 29-1-102 as covering "Colorado local government" would have been
 * right by the wrong route. Its calendar comes from its own audited report.
 *
 * El Paso County is a county and IS within the statutory definition; its ACFR is
 * recorded anyway as corroboration.
 */
export const ENTITY_AUTHORITIES = {
  'Colorado Springs|CO': {
    authority: 'docs/ColoradoSprings/colorado-springs-2023-acfr.pdf, cover page: '
      + '"For the fiscal year ended / December 31, 2023".',
    why: 'HOME RULE city under Colo. Const. art. XX, and C.R.S. § 29-1-102 EXCLUDES '
      + 'home rule cities from "local government" — the statute does not reach it.',
    statuteReaches: false,
  },
  'El Paso County|CO': {
    authority: 'docs/ElPasoCounty/el-paso-county-2023-acfr.pdf: "Annual '
      + 'Comprehensive Financial Report for the Year Ended December 31, 2023" and '
      + '"For the fiscal year ended December 31, 2023".',
    why: 'a county, squarely within C.R.S. § 29-1-102 — its own ACFR corroborates.',
    statuteReaches: true,
  },
};

export function entityAuthorityFor(name, state) {
  return ENTITY_AUTHORITIES[`${name}|${state}`] ?? null;
}

/**
 * Named carve-outs that would take a DIFFERENT month. We hold none of these; they
 * are encoded because the exception is what a plausible constant destroys.
 *
 * ⚠ Colorado's water conservancy districts with federal contracts may use the
 * FEDERAL fiscal year, which begins October 1 — month 10, not 1. That is why 10
 * is in ALLOWED_MONTHS.
 */
export const KNOWN_CARVE_OUTS = [
  {
    state: 'CO',
    entityDescription: 'water conservancy district with a federal contract',
    month: 10,
    authority: 'C.R.S. § 29-1-102 — "\'fiscal year\' may mean the federal fiscal '
      + 'year for water conservancy districts which have contracts with the federal '
      + 'government"; the federal fiscal year begins October 1.',
  },
  {
    state: 'CO',
    entityDescription: 'school district (excluded from the Budget Law definition)',
    month: null,
    authority: 'C.R.S. § 29-1-102 excludes school districts from "local '
      + 'government", so the January-December definition does not reach them and '
      + 'their calendar is UNESTABLISHED here. We hold none.',
  },
];

/** Every state this module can verify. */
export const VERIFIABLE_STATES = Object.keys(STATES);

/**
 * The month an entity's rows must carry.
 *
 * Throws rather than returning a default — a caller asking about an entity type
 * nobody has established has a bug, and a silent fallback is the whole subject of
 * this arc.
 *
 * `entity` is `{ name, state, entity_type }`.
 */
export function monthFor(entity) {
  if (!entity || !entity.state || !entity.entity_type) {
    throw new Error('monthFor: entity {state, entity_type} is required');
  }
  const cfg = STATES[entity.state];
  if (!cfg) {
    throw new Error(`monthFor: ${entity.state} is not a state this module verifies `
      + `(it covers ${VERIFIABLE_STATES.join(', ')})`);
  }
  const month = cfg.entityTypeMonths[entity.entity_type];
  if (month === undefined) {
    throw new Error(`no established ${entity.state} fiscal calendar for entity_type `
      + `"${entity.entity_type}" — add it with its authority rather than assuming `
      + 'the calendar year; school districts are a real exception in other states');
  }
  return month;
}

/**
 * Classify one stored row against the established calendar. Pure, so testable
 * without a database.
 *
 * ⚠ This is a VERIFIER, not a sweep. Every Indiana and Colorado row is expected
 * to return 'correct'; an 'update' means the data has drifted from the evidence
 * and wants investigating, not that a fix is pending.
 */
export function classify(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state || !e.entity_type) {
    return { error: 'row has no entity {name,state,entity_type}' };
  }
  if (!STATES[e.state]) {
    return { error: `out-of-scope state: ${e.name}, ${e.state}` };
  }
  let expected;
  try {
    expected = monthFor(e);
  } catch (err) {
    return { error: err.message };
  }
  if (!ALLOWED_MONTHS.has(expected)) {
    return { error: `expected month ${expected} outside allowed set` };
  }
  // ⚠ Nullish is rejected BEFORE Number(), which turns both null and '' into 0 —
  // an integer that would sail past the check below and be reported as "stored
  // month 0", blaming a value the column never held.
  const raw = row.fiscal_year_start_month;
  if (raw === null || raw === undefined || raw === '') {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  const stored = Number(raw);
  if (!Number.isInteger(stored)) {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  if (stored === expected) return { action: 'correct' };
  return { action: 'update', month: expected, stored };
}
