/**
 * Texas municipalities run OCTOBER–SEPTEMBER, and the guards that let the last
 * January rows be corrected to it.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── THE HEADLINE: THE OBVIOUS FIX WOULD HAVE BEEN WRONG ─────────────────────
 * Massachusetts was 1 -> 7. California was 1 -> 7. Texas is 1 -> **10**.
 *
 * By this point in the arc the reflex is "a January row in a non-calendar-year
 * state should be July". Applied to Texas that reflex is wrong for all 71 rows,
 * and it would have been wrong SILENTLY — the column moves no dollar, so every
 * tie test would have passed at $0 with the period off by a quarter, which is
 * precisely the failure mode that survived four milestones and produced this arc.
 *
 * The state itself is a third value again: **Texas begins its fiscal year on
 * September 1** (month 9), so its 20 rows share neither the municipal month nor
 * the July that the rest of the country mostly uses. Three different correct
 * answers inside one state.
 *
 * ── There is no statutory default to lean on ────────────────────────────────
 * Tex. Loc. Gov't Code § 101.042, FISCAL YEAR, verbatim and in full:
 *
 *     "The governing body of the municipality by ordinance may prescribe the
 *      fiscal year of the municipality."
 *
 *   https://texas.public.law/statutes/tex._local_gov't_code_section_101.042
 *
 * That is the whole section. It sets NO dates. And § 102.011 provides that a
 * home-rule municipality's own charter provisions control where they require an
 * annual budget and the city otherwise complies with the chapter.
 *
 * So Texas is the same shape as California and the OPPOSITE of Massachusetts,
 * where MGL ch. 44 § 56A fixes July–June "notwithstanding the provisions of
 * their respective charters". Every entity below is here because a first-party
 * document was read and says October — not because Texas cities usually do.
 * An entity absent from ESTABLISHED is an ABORT, never a default.
 *
 * ⚠ These entities carry `entity_type = 'municipality'`, not `'city'` as in
 * California. Scope keys on (name, state), never on entity_type.
 */

/** Every entity here starts its fiscal year in October. */
export const CORRECT_MONTH = 10;

/** The silent column default that produced these rows (`NOT NULL DEFAULT 1`, dropped in PR #69). */
export const DEFAULT_MONTH = 1;

/**
 * Months this corpus can legitimately produce. 9 is in the set because the State
 * of Texas itself begins September 1 — see PROTECTED_ENTITIES.
 */
export const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

/**
 * ⚠ EVERY ENTRY CARRIES THE DOCUMENT THAT WAS ACTUALLY READ, and for most of them
 * that document is the one its own `data_sources.base_url` already cites — the
 * file the figures were parsed from. Two came from PDFs already in this repo.
 */
export const ESTABLISHED = [
  {
    name: 'Allen', state: 'TX',
    authority: 'FY 2025-2026 City of Allen Annual Budget: "As we enter the fiscal '
      + 'year which runs from October 1, 2025 to September 30, 2026".',
  },
  {
    name: 'Celina', state: 'TX',
    authority: 'City of Celina, Texas ACFR FY2025: "Fiscal Year Ended '
      + 'September 30, 2025".',
  },
  {
    name: 'Dallas', state: 'TX',
    // ⚠ Its own source row points at dallasopendata.com (a Socrata portal), which
    // states no period, so the budget book was used instead.
    authority: 'City of Dallas FY 2025-26 Annual Operating and Capital Budget '
      + 'cover page (dallascityhall.com): "FISCAL YEAR 2025-26 October 1, 2025 – '
      + 'September 30, 2026".',
  },
  {
    name: 'Frisco', state: 'TX',
    authority: 'City of Frisco Budget Fiscal Year 26: "October 1 fiscal year start '
      + 'date" and "annual budget for the fiscal year beginning October 1, 2024".',
  },
  {
    name: 'Garland', state: 'TX',
    authority: 'City of Garland 2024-25 Annual Operating Budget: "I am pleased to '
      + 'present the adopted budget for the fiscal year beginning October 1, 2024".',
  },
  {
    name: 'Longview', state: 'TX',
    authority: 'City of Longview Master Budget FY 25-26: "fiscal year beginning '
      + 'October 1, 2024" and "2023 fiscal year (October 1, 2023 ...".',
  },
  {
    name: 'McKinney', state: 'TX',
    authority: 'City of McKinney Annual Budget: "Annual Budget for the fiscal year '
      + 'beginning October 1" and "Concurrent (October 1 - September 30)".',
  },
  {
    name: 'Murphy', state: 'TX',
    authority: 'City of Murphy FY26 Adopted Budget Book: the operating budget '
      + '"commencing October 1", with "Fiscal Year Begins" in the October column.',
  },
  {
    name: 'Plano', state: 'TX',
    authority: 'docs/Plano/2024-25 Program of Service - Operating Budget (PDF).pdf: '
      + '"October 1, 2024 to September 30, 2025" and "annual budget for the fiscal '
      + 'year beginning October 1, 2022".',
  },
  {
    name: 'Princeton', state: 'TX',
    authority: 'City of Princeton Adopted Budget 2025-26: "year starting on '
      + 'October 1 and ending on September 30 each year".',
  },
  {
    name: 'Prosper', state: 'TX',
    authority: 'Town of Prosper ACFR: "YEAR ENDED SEPTEMBER 30, 2025" and "the '
      + 'fiscal year ending September 30, 2025".',
  },
  {
    name: 'Richardson', state: 'TX',
    // ⚠ Its XLSX sources carry only hyphenated "FY 2024-25" column headers, which
    // are NOT evidence — that is the Inglewood trap. The PDF states the rule.
    authority: 'docs/Richardson/FY26 City of Richardson Operating Budget.pdf: "The '
      + 'fiscal year of the City of Richardson shall begin on October 1 of each '
      + 'calendar year"; also "Fiscal Year October 1, 2025, to September 30, 2026".',
  },
  {
    name: 'Sachse', state: 'TX',
    authority: 'City of Sachse FY2025-2026 Adopted Budget: "For the Fiscal Year '
      + 'Beginning ... OCTOBER 1, 2025 - SEPTEMBER 30, 2026".',
  },
  {
    name: 'Wylie', state: 'TX',
    authority: 'City of Wylie FY 2026 Final Budget: "For the Fiscal Year Beginning '
      + '/ October 01, 2024".',
  },
];

export function establishedFor(name, state) {
  return ESTABLISHED.find((e) => e.name === name && e.state === state) ?? null;
}

/**
 * Texas entities whose correct month is NOT the municipal October, keyed on
 * (name, state). They must survive the sweep untouched.
 *
 * ⚠ THE STATE OF TEXAS IS THE ONE THAT MATTERS. It begins September 1, so its
 * month is 9 — neither the 10 this sweep writes nor the 1 it corrects. The 2025
 * NASBO State Expenditure Report names it as one of only four exceptions to the
 * national July rule: "in Texas, the fiscal year begins on September 1".
 * A sweep scoped to "TX rows" rather than to these named entities would have
 * moved 20 correct state rows to October.
 *
 * Austin and Travis County are already at 10 and were established during their
 * own onboarding; they are named so a widened scope cannot silently re-stamp
 * them, and so their being untouched is asserted rather than assumed.
 */
export const PROTECTED_ENTITIES = [
  {
    name: 'Texas', state: 'TX', month: 9,
    why: '2025 NASBO State Expenditure Report: "in Texas, the fiscal year begins '
      + 'on September 1" — one of four states that is not July',
  },
  { name: 'Austin', state: 'TX', month: 10, why: 'established at onboarding; Austin runs Oct–Sep' },
  { name: 'Travis County', state: 'TX', month: 10, why: 'established at onboarding; Travis County runs Oct–Sep' },
];

export function protectedEntityFor(name, state) {
  return PROTECTED_ENTITIES.find((e) => e.name === name && e.state === state) ?? null;
}

/** Measured 2026-08-26, before any write. */
export const BASELINE = {
  budgetRows: 71,
  budgetEntities: 14,
  sourceRows: 74,
  sourceEntities: 14,
  protectedStateRows: 20,
  protectedAustinRows: 32,
  protectedTravisRows: 44,
};

/** Per-entity budget-row baselines, so a shifted row set is caught per city. */
export const BUDGET_ROWS_BY_ENTITY = {
  Plano: 19,
  McKinney: 13,
  Frisco: 10,
  Richardson: 8,
  Prosper: 6,
  Dallas: 4,
  Allen: 2,
  Celina: 2,
  Longview: 2,
  Garland: 1,
  Murphy: 1,
  Princeton: 1,
  Sachse: 1,
  Wylie: 1,
};

/** Per-entity data_sources baselines. */
export const SOURCE_ROWS_BY_ENTITY = {
  Plano: 19,
  McKinney: 13,
  Frisco: 11,
  Richardson: 8,
  Prosper: 6,
  Allen: 2,
  Celina: 2,
  Dallas: 2,
  Garland: 2,
  Longview: 2,
  Murphy: 2,
  Sachse: 2,
  Wylie: 2,
  Princeton: 1,
};

function checkMonth(raw, fromMonth) {
  // ⚠ Nullish is rejected BEFORE Number(), which turns both null and '' into 0 —
  // an integer that would sail past the check below and be reported as "stored
  // month 0", blaming a value the column never held.
  if (raw === null || raw === undefined || raw === '') {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  const stored = Number(raw);
  if (!Number.isInteger(stored)) {
    return { error: `unparseable fiscal_year_start_month ${JSON.stringify(raw)}` };
  }
  if (stored === CORRECT_MONTH) return { action: 'correct' };
  if (stored !== fromMonth) {
    return { error: `stored month ${stored} is neither ${fromMonth} nor ${CORRECT_MONTH}` };
  }
  return { action: 'update', month: CORRECT_MONTH };
}

/**
 * Classify one `budgets` row. Pure, so every guard is testable without a
 * database. `row.entity` is `{ name, state, entity_type }`.
 */
export function classify(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state) return { error: 'row has no entity {name,state}' };
  if (e.state !== 'TX') {
    return { error: `out-of-state entity reached the update set: ${e.name}, ${e.state}` };
  }
  const guarded = protectedEntityFor(e.name, e.state);
  if (guarded) {
    return { error: `protected entity reached the update set: ${e.name}, ${e.state} `
      + `— its month is ${guarded.month} (${guarded.why})` };
  }
  if (!establishedFor(e.name, e.state)) {
    return { error: `no established fiscal calendar for ${e.name}, ${e.state} — `
      + 'Tex. Loc. Gov\'t Code § 101.042 sets NO default ("the governing body of the '
      + 'municipality by ordinance may prescribe the fiscal year"), so this must be '
      + 'read off the entity\'s own document and added to ESTABLISHED' };
  }
  if (!ALLOWED_MONTHS.has(CORRECT_MONTH)) {
    return { error: `target month ${CORRECT_MONTH} outside allowed set` };
  }
  return checkMonth(row.fiscal_year_start_month, DEFAULT_MONTH);
}

/** Classify one `data_sources` row. */
export function classifySource(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state) return { error: 'data_source row has no entity {name,state}' };
  if (e.state !== 'TX') return { error: `out-of-state data_source: ${e.name}, ${e.state}` };
  const guarded = protectedEntityFor(e.name, e.state);
  if (guarded) {
    return { error: `protected entity reached the update set: ${e.name}, ${e.state} `
      + `— its month is ${guarded.month} (${guarded.why})` };
  }
  if (!establishedFor(e.name, e.state)) {
    return { error: `no established fiscal calendar for ${e.name}, ${e.state}` };
  }
  return checkMonth(row.fiscal_year_start_month, DEFAULT_MONTH);
}
