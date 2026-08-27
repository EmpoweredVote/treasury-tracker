/**
 * The California entities whose July–June fiscal year has been INDIVIDUALLY
 * ESTABLISHED, and the guards that let the last January rows be corrected.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── This file is deliberately a LIST, not a RULE ─────────────────────────────
 * "California cities run July–June" is exactly the kind of generalisation this
 * whole arc exists to distrust. California sets NO municipal fiscal year by
 * statute — there is no § 56A here binding every city the way Massachusetts has,
 * and no Government Code default for cities the way ch. 29001(e) provides for
 * counties. A CHARTER city is free to choose, and of the two charter cities
 * examined before this pass, BOTH turned out to be October: Inglewood (PR #60)
 * and Long Beach (PR #68).
 *
 * TEN of the eleven cities below are charter cities. Every one of them could
 * legitimately have differed. So none of them is here because CA cities are
 * usually July — each is here because a specific first-party document was read
 * and says so. An entity NOT on this list is an ABORT, never a default.
 *
 * ── The defect being corrected ──────────────────────────────────────────────
 * `treasury_sync_budget_tree` takes no month parameter; it copies the value off
 * the `data_sources` row, and both columns were `NOT NULL DEFAULT 1` (dropped in
 * PR #69). Loaders that never set it produced a silent January. 89 budget rows
 * across 11 cities, and 79 `data_sources` rows across 14 entities.
 *
 * ⚠ BOTH TABLES, SOURCES FIRST. Correcting `budgets` alone leaves the source rows
 * at 1 and the next load copies 1 straight back — see
 * `scripts/lib/maFiscalCalendar.mjs` for the same trap at 100x the size.
 *
 * ⚠ FOUR of the source rows belong to entities with NO budget row at 1 —
 * Berkeley, the State of California, and two Los Angeles revenue sources. They
 * are dormant seeds, not live defects, and they are included anyway: after PR #69
 * a wrong month on a source row is precisely what silently stamps the next row
 * loaded through it. Each was evidenced like the rest.
 *
 * ⚠ Keyed on (name, state) throughout. This session alone, name-only matching
 * would have picked up Long Beach NEW YORK when searching for a charter, and
 * BERKLEY MICHIGAN when searching for Berkeley's ACFR.
 */

/** Every entity here runs July–June. The value is not shared — it is repeated per entity. */
export const CORRECT_MONTH = 7;

/** The silent column default that produced these rows. */
export const DEFAULT_MONTH = 1;

/** Months this corpus can legitimately produce (NASBO cross-check, plus CA's Oct cities). */
export const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

/**
 * ⚠ EVERY ENTRY CARRIES THE DOCUMENT THAT WAS ACTUALLY READ. Where the phrase came
 * out of a PDF sitting in this repo, the path is given — that is the very file the
 * figures were parsed from, which is the strongest evidence available.
 */
export const ESTABLISHED = [
  {
    name: 'Anaheim', state: 'CA', charter: true,
    authority: 'docs/Anaheim/fy2025-adopted-budget.pdf: "year for the City begins '
      + 'on July 1 of each year and ends on June 30 of the following year".',
  },
  {
    name: 'Bakersfield', state: 'CA', charter: true,
    // Its budget books never state the period — checked both, twice, with widened
    // patterns. The audited financials do.
    authority: 'City of Bakersfield Single Audit Reports cover page: "CITY OF '
      + 'BAKERSFIELD, CALIFORNIA / SINGLE AUDIT REPORTS / FOR THE YEAR ENDED '
      + 'JUNE 30, 2021".',
  },
  {
    name: 'Fremont', state: 'CA', charter: false,
    // The only general-law city in this set, and therefore the only one with no
    // instrument to deviate. Evidenced anyway.
    authority: 'docs/Fremont/202526 Adopted Budget_20250829_Webposting.pdf: '
      + '"fiscal year ended June 30, 2024" and "fiscal year ending June 30, 2025".',
  },
  {
    name: 'Fresno', state: 'CA', charter: true,
    authority: 'docs/Fresno/fy2020-adopted-budget.pdf: "July 1, 2019 to June 30, 2020".',
  },
  {
    name: 'Oakland', state: 'CA', charter: true,
    authority: 'docs/Oakland/fy2023-25-adopted-budget.pdf: "fiscal year begins on '
      + 'July 1st" and "July 1, 2023 through June 30, 2025".',
  },
  {
    name: 'Riverside', state: 'CA', charter: true,
    authority: 'docs/Riverside/fy2018-20-adopted-budget.pdf: "fiscal year begins '
      + 'each July first and concludes on June 30".',
  },
  {
    name: 'Sacramento', state: 'CA', charter: true,
    authority: 'City of Sacramento ACFR, cityofsacramento.gov, titled "City of '
      + 'Sacramento, California Fiscal Year Ended June 30, 2017".',
  },
  {
    name: 'San Diego', state: 'CA', charter: true,
    authority: 'sandiego.gov (Independent Budget Analyst FAQ): "The City\'s fiscal '
      + 'year begins July 1 and ends on June 30."',
  },
  {
    name: 'San Francisco', state: 'CA', charter: true,
    authority: 'City and County of San Francisco ACFR, presented "for the year '
      + 'ended June 30" in compliance with Charter §§ 2.115 and 3.105.',
  },
  {
    name: 'San Jose', state: 'CA', charter: true,
    authority: 'docs/SanJose/20162017 Adopted Operating Budget.pdf glossary, under '
      + 'the term "Fiscal Year": "A 12-month accounting period ... is the period '
      + 'from July 1 through June 30".',
  },
  {
    name: 'Santa Ana', state: 'CA', charter: true,
    authority: 'docs/Santa Ana/fy2023-adopted-budget.pdf: "Fiscal Year Ended '
      + 'June 30, 2023".',
  },
  // ── Below: source rows only, no budget row at 1. Dormant seeds. ───────────
  {
    name: 'Berkeley', state: 'CA', charter: true, sourceRowsOnly: true,
    // ⚠ The search for this one surfaced BERKLEY, MICHIGAN (berkleymi.gov). Hence
    // (name, state).
    authority: 'City of Berkeley ACFR on berkeleyca.gov, titled "Annual '
      + 'Comprehensive Financial Report FOR THE YEAR ENDED JUNE 30, 2024".',
  },
  {
    name: 'California', state: 'CA', entityType: 'state', sourceRowsOnly: true,
    authority: '2025_NASBO_State_Expenditure_Report_S.pdf (repo root): "In 46 '
      + 'states the fiscal year begins on July 1 and ends on June 30. The '
      + 'exceptions are ... New York ... Texas ... Alabama and Michigan." '
      + 'California is not among the exceptions.',
  },
  {
    name: 'Los Angeles', state: 'CA', charter: true, sourceRowsOnly: true,
    // The source row's own base_url points at this exact PDF, which was downloaded
    // and read rather than trusted.
    authority: 'City of Los Angeles FY25 ACFR cover page: "City of Los Angeles / '
      + 'For the Fiscal Year Ended June 30, 2025" — the very document the '
      + '"LA City Revenue (ACFR)" source row cites.',
  },
];

export function establishedFor(name, state) {
  return ESTABLISHED.find((e) => e.name === name && e.state === state) ?? null;
}

/**
 * Rows that legitimately sit at a month OTHER than 7 and must survive untouched.
 *
 * ⚠ This is the part a naive "CA rows at 1 -> 7" sweep would destroy.
 */
export const PROTECTED_SOURCES = [
  {
    pattern: /publicpay|compensation in california/i,
    month: 1,
    why: 'publicpay/GCC is a W-2-based CALENDAR-year report — PR #62 moved 7,682 '
      + 'rows across 482 entities to 1. Its 1 is CORRECT.',
  },
];

/**
 * Entities whose whole fiscal calendar is not July, keyed on (name, state).
 *
 * Empowered Vote runs the calendar year: `docs/ev-donation-sources.md` states
 * "EV's fiscal year = the calendar year", and all three EV loaders
 * (loadEVBank.js, loadEVDonations.js, loadEVFinances.js) already pass
 * `fiscal_year_start_month: 1` explicitly. Its 6 rows at 1 are CORRECT.
 *
 * Inglewood and Long Beach are the two evidenced OCTOBER cities. Their rows are
 * no longer at 1, so they cannot reach this sweep by value — but they are named
 * here so that widening the scope later cannot swallow them silently.
 */
export const PROTECTED_ENTITIES = [
  { name: 'Empowered Vote', state: 'CA', month: 1, why: 'docs/ev-donation-sources.md: "EV\'s fiscal year = the calendar year"' },
  { name: 'Inglewood', state: 'CA', month: 10, why: 'ACFR "FOR THE YEAR ENDED SEPTEMBER 30, 2021" (PR #60)' },
  { name: 'Long Beach', state: 'CA', month: 10, why: 'FY2025 ACFR "For the Fiscal Year Ended September 30, 2025" (PR #68)' },
];

export function protectedSourceFor(source) {
  if (typeof source !== 'string') return null;
  return PROTECTED_SOURCES.find((p) => p.pattern.test(source)) ?? null;
}

export function protectedEntityFor(name, state) {
  return PROTECTED_ENTITIES.find((e) => e.name === name && e.state === state) ?? null;
}

/** Measured 2026-08-26, before any write. */
export const BASELINE = {
  budgetRows: 89,
  budgetEntities: 11,
  sourceRows: 79,
  sourceEntities: 14,
  protectedEvRows: 6,
};

/** Per-entity budget-row baselines, so a shifted row set is caught per city. */
export const BUDGET_ROWS_BY_ENTITY = {
  Sacramento: 28,
  Fremont: 16,
  'San Jose': 10,
  'Santa Ana': 8,
  Fresno: 7,
  Anaheim: 4,
  Bakersfield: 4,
  Riverside: 4,
  'San Francisco': 4,
  Oakland: 2,
  'San Diego': 2,
};

/**
 * Classify one `budgets` row. Pure, so every guard is testable without a
 * database. `row.entity` is `{ name, state, entity_type }`.
 */
export function classify(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state) {
    return { error: 'row has no entity {name,state}' };
  }
  if (e.state !== 'CA') {
    return { error: `out-of-state entity reached the update set: ${e.name}, ${e.state}` };
  }
  const guardedSource = protectedSourceFor(row.data_source);
  if (guardedSource) {
    return { error: `protected source reached the update set: "${row.data_source}" `
      + `(${guardedSource.why})` };
  }
  const guardedEntity = protectedEntityFor(e.name, e.state);
  if (guardedEntity) {
    return { error: `protected entity reached the update set: ${e.name}, ${e.state} `
      + `— its month is ${guardedEntity.month}, not ${CORRECT_MONTH} (${guardedEntity.why})` };
  }
  const est = establishedFor(e.name, e.state);
  if (!est) {
    return { error: `no established fiscal calendar for ${e.name}, ${e.state} — `
      + 'California sets no municipal fiscal year by statute, so this must be read '
      + 'off the entity\'s own document and added to ESTABLISHED with its authority' };
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
  if (stored !== DEFAULT_MONTH) {
    return { error: `stored month ${stored} is neither ${DEFAULT_MONTH} nor ${CORRECT_MONTH}` };
  }
  return { action: 'update', month: CORRECT_MONTH };
}

/** Classify one `data_sources` row. */
export function classifySource(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state) {
    return { error: 'data_source row has no entity {name,state}' };
  }
  if (e.state !== 'CA') {
    return { error: `out-of-state data_source: ${e.name}, ${e.state}` };
  }
  const guardedSource = protectedSourceFor(row.name);
  if (guardedSource) {
    return { error: `protected source reached the update set: "${row.name}" (${guardedSource.why})` };
  }
  const guardedEntity = protectedEntityFor(e.name, e.state);
  if (guardedEntity) {
    return { error: `protected entity reached the update set: ${e.name}, ${e.state} `
      + `— its month is ${guardedEntity.month} (${guardedEntity.why})` };
  }
  if (!establishedFor(e.name, e.state)) {
    return { error: `no established fiscal calendar for ${e.name}, ${e.state}` };
  }
  const raw = row.fiscal_year_start_month;
  if (raw === null || raw === undefined || raw === '') {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  const stored = Number(raw);
  if (!Number.isInteger(stored)) {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  if (stored === CORRECT_MONTH) return { action: 'correct' };
  if (stored !== DEFAULT_MONTH) {
    return { error: `stored month ${stored} is neither ${DEFAULT_MONTH} nor ${CORRECT_MONTH}` };
  }
  return { action: 'update', month: CORRECT_MONTH };
}
