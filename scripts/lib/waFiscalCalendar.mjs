/**
 * Washington's fiscal calendars, and the guard that keeps them stated rather
 * than inherited.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── THIS FILE CORRECTS NO DATA. THAT IS THE POINT ───────────────────────────
 * All 336 Washington local-government rows already read 1, and the 12 State of
 * Washington rows already read 7. Both are RIGHT. Nothing here moves a row.
 *
 * They were right by COINCIDENCE, though: 1 is what the dropped
 * `NOT NULL DEFAULT 1` handed every loader that said nothing (see
 * `scripts/lib/maFiscalCalendar.mjs`), and Washington happens to be a
 * calendar-year state. The arc has already been burned twice by that kind of
 * agreement — SCOPE-04's `=== 7` gate and `deriveTotalGovernmental`'s guard both
 * measured conformity to a hardcode and reported it as correctness. So the value
 * being right is not the same as the value being established, and this file
 * establishes it.
 *
 * ⚠ Texas is why this matters. By PR #71 the reflex was "January in a
 * non-calendar state means July"; Texas turned out to be OCTOBER, and the wrong
 * answer would have been silent because the column moves no dollar. A month that
 * nobody has cited is a month nobody can check.
 *
 * ── Evidence: cities and counties run the CALENDAR year ─────────────────────
 * RCW 1.16.030, "Fiscal year"—School districts and other taxing districts, in
 * full and verbatim:
 *
 *     "August 31st shall end the fiscal year of school districts and December
 *      31st of all other taxing districts."
 *
 *   https://app.leg.wa.gov/RCW/default.aspx?cite=1.16.030
 *
 * A December 31 year end is a January 1 start, so month 1. And cities and
 * counties ARE taxing districts — this was checked rather than assumed. RCW
 * 84.04.120, "Taxing district", verbatim:
 *
 *     "'Taxing district' means the state and any county, city, town, port
 *      district, school district, road district, metropolitan park district,
 *      regional transit authority, water-sewer district, or other municipal
 *      corporation..."
 *
 *   https://app.leg.wa.gov/RCW/default.aspx?cite=84.04.120
 *
 * ── ⚠ THE STATE IS NOT COVERED BY THAT READING, AND THE TRAP IS REAL ────────
 * § 84.04.120 makes THE STATE a taxing district too. Read naively, "December
 * 31st of all other taxing districts" would therefore put the State of
 * Washington on the calendar year and our 12 state rows at 7 would look wrong.
 * They are not. RCW 1.16.020, "Fiscal biennium", is the specific provision:
 *
 *     "The fiscal biennium of the state shall commence on the first day of July
 *      in each odd-numbered year and end on the thirtieth day of June of the
 *      next succeeding odd-numbered year."
 *
 * so the state runs July–June — month 7, corroborated by the 2025 NASBO State
 * Expenditure Report, which lists only New York, Texas, Alabama and Michigan as
 * exceptions to July.
 *
 * ── ⚠ AND THE BIENNIAL-BUDGET TRAP IS ANSWERED IN THE SAME SECTION ──────────
 * Several Washington cities budget biennially, which elsewhere in this project
 * has produced wrong-period rows (see the Oregon onboarding notes). It does NOT
 * change the start month here. RCW 1.16.020 continues:
 *
 *     "The fiscal biennium of those cities and towns which utilize a biennial
 *      budget shall commence on the first day of January in each odd-numbered
 *      year and end on the thirty-first day of December of the next succeeding
 *      even-numbered year."
 *
 * January either way.
 *
 * ── ⚠ SCHOOL DISTRICTS ARE A NAMED STATUTORY EXCEPTION: AUGUST 31 ───────────
 * § 1.16.030 carves them out by name, exactly as Ohio Rev. Code § 9.34 carves
 * out Cincinnati. An August 31 year end is a SEPTEMBER 1 start — month 9,
 * neither of Washington's other two answers. We currently hold NO Washington
 * school district, so the exception is inert; it is encoded anyway, because the
 * one thing this arc has proved repeatedly is that the exception is what a
 * plausible constant destroys.
 */

/** Cities, counties and other non-school taxing districts: January. */
export const LOCAL_MONTH = 1;

/** The State of Washington: July (RCW 1.16.020). */
export const STATE_MONTH = 7;

/** School districts: September, because August 31 ends their year (RCW 1.16.030). */
export const SCHOOL_DISTRICT_MONTH = 9;

/** Months this corpus can legitimately produce. */
export const ALLOWED_MONTHS = new Set([1, 7, 9]);

export const AUTHORITY = {
  local: 'RCW 1.16.030 — "August 31st shall end the fiscal year of school '
    + 'districts and December 31st of all other taxing districts"; RCW 84.04.120 '
    + 'defines "taxing district" to include "any county, city, town".',
  state: 'RCW 1.16.020 — "The fiscal biennium of the state shall commence on the '
    + 'first day of July in each odd-numbered year"; corroborated by the 2025 '
    + 'NASBO State Expenditure Report, which lists only NY, TX, AL and MI as '
    + 'exceptions to a July 1 start.',
  schoolDistrict: 'RCW 1.16.030 names school districts explicitly: their year '
    + 'ends August 31, so it begins September 1.',
  biennial: 'RCW 1.16.020 — a city or town on a biennial budget still commences '
    + '"on the first day of January in each odd-numbered year", so budgeting '
    + 'biennially does not change the start month.',
};

/** Entity types we hold for Washington, and the month each takes. */
export const ENTITY_TYPE_MONTHS = {
  city: LOCAL_MONTH,
  county: LOCAL_MONTH,
  municipality: LOCAL_MONTH,
  state: STATE_MONTH,
  school_district: SCHOOL_DISTRICT_MONTH,
};

/** Measured 2026-08-26. Nothing in this population needs changing. */
export const BASELINE = {
  localRows: 336,
  localEntities: 10,
  stateRows: 12,
  schoolDistrictRows: 0,
  dataSourceRows: 0,   // waSaoLoad.mjs creates its data_sources row EPHEMERALLY and deletes it
};

export const LOCAL_ROWS_BY_ENTITY = {
  Spokane: 40,
  Everett: 38,
  Tacoma: 38,
  Vancouver: 38,
  'Bainbridge Island': 36,
  Kent: 36,
  'Kitsap County': 36,
  Seattle: 34,
  Bellevue: 24,
  'King County': 16,
};

/**
 * The month a Washington entity's rows must carry.
 *
 * Throws rather than returning a default — a caller asking about an entity type
 * nobody has established has a bug, and a silent fallback is the whole subject
 * of this arc.
 *
 * `entity` is `{ name, state, entity_type }`.
 */
export function monthForWAEntity(entity) {
  if (!entity || !entity.entity_type) {
    throw new Error('monthForWAEntity: entity {entity_type} is required');
  }
  if (entity.state && entity.state !== 'WA') {
    throw new Error(`monthForWAEntity: ${entity.name}, ${entity.state} is not a Washington entity`);
  }
  const month = ENTITY_TYPE_MONTHS[entity.entity_type];
  if (month === undefined) {
    throw new Error(`no established Washington fiscal calendar for entity_type `
      + `"${entity.entity_type}" — RCW 1.16.030 covers taxing districts and names `
      + 'school districts as an exception; add the type here with its authority');
  }
  return month;
}

/**
 * Classify one stored row against the statute. Pure, so testable without a
 * database. Returns `{ action: 'correct' }`, `{ action: 'update', month }`, or
 * `{ error }`.
 *
 * ⚠ This is a VERIFIER, not a sweep. Every Washington row is expected to return
 * 'correct'; an 'update' means the data has drifted from the statute and wants
 * investigating, not that a fix is pending.
 */
export function classify(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state || !e.entity_type) {
    return { error: 'row has no entity {name,state,entity_type}' };
  }
  if (e.state !== 'WA') {
    return { error: `out-of-state entity: ${e.name}, ${e.state}` };
  }
  let expected;
  try {
    expected = monthForWAEntity(e);
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
