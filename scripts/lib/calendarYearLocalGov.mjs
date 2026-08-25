/**
 * Minnesota and Ohio local governments run the CALENDAR year — by statute.
 * Their rows claimed July. This library carries the evidence and the guards.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 * `public.treasury_sync_city_budget` INSERTed a literal `7` (fixed 2026-08-25,
 * PR #61 — but every row it had already created keeps the wrong value). So:
 *
 *     Minnesota OSA   21,794 rows   945 entities   FY2012–FY2023
 *     Ohio AOS         6,596 rows   340 entities   FY2016–FY2025
 *
 * all assert a July–June fiscal year. Every one is wrong. This is the third and
 * largest sweep of the arc, after Inglewood's 60 (PR #60) and publicpay's 7,682
 * (PR #62), and it was found only because wiring the loaders forced the question
 * "what IS this entity's fiscal year?" to be asked of each source in turn.
 *
 * ── Evidence: Minnesota ─────────────────────────────────────────────────────
 * CITIES and TOWNS — Minn. Stat. § 471.696, FISCAL YEAR; DESIGNATION, verbatim:
 *
 *   "Beginning in 1979, the fiscal year of a city and all of its funds shall be
 *    the calendar year, except that a city may, by resolution, provide that the
 *    fiscal year for city-owned nursing homes be the reporting year designated
 *    by the commissioner of human services. Beginning in 1994, the fiscal year
 *    of a town and all of its funds shall be the calendar year."
 *
 *   https://www.revisor.mn.gov/statutes/cite/471.696
 *
 * The nursing-home exception is a fund-level reporting choice inside a city, not
 * a change to the city's own fiscal year, and the OSA report aggregates the
 * city. It does not reach these rows.
 *
 * COUNTIES — the OSA's own County Finances Report, first party, verbatim:
 *
 *   "For the Year Ended December 31, 2022"
 *   "The report summarizes ... the financial operations of Minnesota counties
 *    for calendar year 2022."
 *
 *   https://www.auditor.state.mn.us/media/acqhhgxq/county_22_report.pdf
 *
 * Our MN rows are 858 cities + 87 counties. Both halves are covered.
 *
 * ── Evidence: Ohio, AND ITS STATUTORY EXCEPTION ─────────────────────────────
 * Ohio Rev. Code § 9.34, verbatim:
 *
 *   "The fiscal year of every school library district, and all political
 *    subdivisions or taxing units EXCEPT SCHOOL DISTRICTS AND THE CITY OF
 *    CINCINNATI ... shall begin at the opening of the first day of January of
 *    each calendar year and end at the close of the succeeding thirty-first day
 *    of December."
 *
 * and for the state, school districts and Cincinnati: "shall begin on the first
 * day of July of each calendar year and end at the close of the thirtieth day of
 * June of the succeeding calendar year."
 *
 *   https://codes.ohio.gov/ohio-revised-code/section-9.34
 *
 * "Subdivision" is defined by ORC § 5705.01(A) to include any county and any
 * municipal corporation, so our 253 cities and 88 counties are all in scope.
 *
 * ⚠⚠ CINCINNATI IS EXEMPT, AND IT IS IN OUR DATA — 20 rows, FY2016–FY2025.
 * Its `7` is CORRECT and must survive this sweep. A per-state constant would
 * have silently corrupted it, which is the same shape as the original defect:
 * uniform is not correct. Cincinnati is therefore excluded LOUDLY — reaching the
 * update set is an ABORT, not a skip — so a widened scope cannot swallow it.
 *
 * No SCHOOL DISTRICT rows exist under either label (both sources hold only
 * `entity_type` city and county), so that half of the exception is inert here.
 * If school districts are ever loaded, they belong at 7 and this guard must grow.
 */

/** Both states' local governments run January–December. */
export const CORRECT_MONTH = 1;

/** The known-wrong value the sync RPC hardcoded. */
export const HARDCODED_MONTH = 7;

/** Months this corpus can legitimately produce. */
export const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

/**
 * The in-scope `data_source` labels, matched exactly rather than by pattern,
 * with the row/entity counts measured at sweep time (2026-08-25).
 */
export const FAMILIES = [
  {
    source: 'Minnesota Office of the State Auditor City/County Finances Report',
    state: 'MN',
    rows: 21794,
    entities: 945,
    authority: 'Minn. Stat. § 471.696 (cities, towns); '
      + 'OSA County Finances Report "For the Year Ended December 31" (counties)',
  },
  {
    source: 'Ohio Auditor of State Summarized Annual Financial Reports',
    state: 'OH',
    rows: 6596,
    entities: 340,
    authority: 'Ohio Rev. Code § 9.34 (all political subdivisions except school '
      + 'districts and the city of Cincinnati)',
  },
];

export const IN_SCOPE_SOURCES = new Set(FAMILIES.map((f) => f.source));

/** Total rows the sweep expects to change. */
export const SWEEP_ROWS = FAMILIES.reduce((n, f) => n + f.rows, 0);

/**
 * Entities the statute EXEMPTS from the calendar year. Their stored month is
 * already correct and must not be touched.
 *
 * ⚠ Keyed on (name, state). Name alone would be reckless — this list exists
 * precisely because one entity differs from its neighbours.
 */
export const EXEMPT_ENTITIES = [
  { name: 'Cincinnati', state: 'OH', month: 7, why: 'Ohio Rev. Code § 9.34 names the city of Cincinnati' },
];

export function exemptionFor(entity) {
  if (!entity) return null;
  return EXEMPT_ENTITIES.find((e) => e.name === entity.name && e.state === entity.state) ?? null;
}

/**
 * Classify one row. Pure, so every guard is testable without a database.
 * `row.entity` is `{ name, state }` — required, because the Ohio exception is
 * per-entity and a row cannot be judged without knowing whose it is.
 *
 * Returns `{ action: 'update', month }`, `{ action: 'correct' }`, or `{ error }`
 * — and an error is always an abort, never a skip.
 */
export function classify(row) {
  if (!row.entity || !row.entity.name || !row.entity.state) {
    return { error: 'row has no entity {name,state}; the Ohio exception cannot be evaluated' };
  }
  const exempt = exemptionFor(row.entity);
  if (exempt) {
    return { error: `statutorily exempt entity reached the update set: `
      + `${exempt.name}, ${exempt.state} (${exempt.why}) — its ${exempt.month} is CORRECT` };
  }
  if (!IN_SCOPE_SOURCES.has(row.data_source)) {
    return { error: `out-of-scope data_source: "${row.data_source}"` };
  }
  const family = FAMILIES.find((f) => f.source === row.data_source);
  if (row.entity.state !== family.state) {
    return { error: `entity state ${row.entity.state} does not match the `
      + `${family.state} family for "${row.data_source}"` };
  }
  if (!ALLOWED_MONTHS.has(CORRECT_MONTH)) {
    return { error: `target month ${CORRECT_MONTH} outside allowed set` };
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
  if (stored === CORRECT_MONTH) return { action: 'correct' };
  if (stored !== HARDCODED_MONTH) {
    return { error: `stored month ${stored} is neither ${HARDCODED_MONTH} nor ${CORRECT_MONTH}` };
  }
  return { action: 'update', month: CORRECT_MONTH };
}
