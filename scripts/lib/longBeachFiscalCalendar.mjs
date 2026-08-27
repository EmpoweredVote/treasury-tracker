/**
 * The City of Long Beach, CA fiscal calendar, and the guards that let it be
 * written to `fiscal_year_start_month` without guessing.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!` (a CRLF checkout
 * turns `#!/usr/bin/env node\r` into an unresolvable interpreter path and every
 * test in the importing file vanishes behind a position-less SyntaxError).
 *
 * ── What this corrects ──────────────────────────────────────────────────────
 * Long Beach closes on **September 30**, so its year starts in **October (10)**.
 * It is the second CA charter city found off July, after Inglewood, and it was
 * PREDICTED rather than stumbled on: the CA audit reduced 482 municipalities to
 * the 121 charter cities on the ground that only a charter city can set its own
 * fiscal year, then ranked them by exposure. Long Beach came out 4th at $54.3B.
 * See `scripts/lib/inglewoodFiscalCalendar.mjs` for the first one.
 *
 * ── TWO defects in one entity, at TWO different wrong values ─────────────────
 * This is the part that makes Long Beach harder than Inglewood, and the reason
 * the guard keys on the SOURCE FAMILY rather than on the stored value:
 *
 *   60 rows at 7  — SCO + derived Total Governmental. The literal `7` that
 *                   `treasury_sync_city_budget` used to INSERT (PR #61).
 *    4 rows at 1  — the city's own budget-document rows, from the OTHER silent
 *                   default: `NOT NULL DEFAULT 1` on the column (see
 *                   `scripts/lib/maFiscalCalendar.mjs` for that whole story).
 *   16 rows at 1  — publicpay salaries, which are CORRECT and must not move.
 *
 * ⚠⚠ SO `1` MEANS TWO OPPOSITE THINGS INSIDE ONE CITY. It is the value to
 * correct on a budget-document row and the value to preserve on a salaries row.
 * A sweep keyed on "rows at 1" would destroy the 16; a sweep keyed on "rows at
 * 7" would miss the 4. `classify` therefore reads the expected-wrong month off
 * the family the label belongs to, and treats an unrecognised label as an abort.
 *
 * ── Evidence: two independent first-party documents ─────────────────────────
 * (1) City of Long Beach FY2025 Annual Comprehensive Financial Report, cover
 *     page, read from the PDF itself:
 *
 *         Annual Comprehensive Financial Report
 *         City of Long Beach, California
 *         For the Fiscal Year Ended
 *         September 30, 2025
 *         Prepared by the Department of Financial Management
 *
 *     https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/accounting/comprehensive-annual-financial-report/fiscal-year-2025-annual-report
 *
 * (2) City of Long Beach FY25 Adopted Budget, "Understanding the City's Budget":
 *
 *         "The FY 25 Budget covers the period of October 1, 2024 through
 *          September 30, 2025."
 *         "...the end of the fiscal year, or September 30..."
 *
 *     https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/fy-25-adopted-budget/08-understanding-the-city-s-budget
 *
 * Long Beach has been a charter city since 1921, which is WHY it can differ —
 * California sets no municipal fiscal year by statute, so a charter city is free
 * to choose one. (Contrast Massachusetts, where MGL ch. 44 § 56A fixes July–June
 * "notwithstanding the provisions of their respective charters" and no city can.)
 *
 * ⚠ Do NOT infer the month from the ACFR INDEX page. longbeach.gov lists the
 * reports as "Fiscal Year 2025 Annual Report" and states no month anywhere on
 * that page — the same trap documented for Inglewood, where an index page's
 * hyphenated "2020-2021" label led a WebFetch to answer "likely June 30" with
 * confidence. The month has to come off the document's own cover.
 *
 * ⚠ AND KEY ON (name, state). There is a Long Beach in New York, Washington and
 * Mississippi as well as California, and a web search for the charter returns the
 * NEW YORK city's budget reviews first. `ENTITY` carries the state for that
 * reason, and every read filters on it.
 */

/** The entity. ⚠ Name alone is not enough — four states have a Long Beach. */
export const ENTITY = { name: 'Long Beach', state: 'CA' };

/** Sep 30 year end -> Oct 1 start -> 10. */
export const CORRECT_MONTH = 10;

/**
 * Months this corpus can legitimately produce, cross-checked against the 2025
 * NASBO State Expenditure Report in the repo root: Dec 31 -> 1, Mar 31 -> 4,
 * Jun 30 -> 7, Aug 31 -> 9, Sep 30 -> 10.
 */
export const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

/**
 * The in-scope families, each carrying the WRONG value it is expected to hold.
 * `from` is load-bearing: it is what stops a `1`-valued salaries row and a
 * `1`-valued budget row being treated the same way.
 */
export const FAMILIES = [
  {
    key: 'sco',
    kind: 'exact',
    // Enumerated exactly rather than pattern-matched. A future Long Beach load
    // under a new label must be checked against its own document, not swept in
    // by a prefix nobody validated it against.
    sources: [
      'CA State Controller - Expenditures',
      'CA State Controller - Revenues',
      'Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)',
      'Treasury Tracker derived: Total Governmental (CA State Controller - Revenues)',
    ],
    from: 7,
    rows: 60,
    why: 'the literal 7 that treasury_sync_city_budget used to INSERT (PR #61)',
  },
  {
    key: 'city-budget',
    kind: 'regex',
    // "Long Beach General Fund Operating Budget FY2025" and the un-suffixed
    // "Long Beach General Fund Revenue Budget" both exist in `data_sources`.
    pattern: /^Long Beach General Fund (Operating|Revenue) Budget( FY\d{4})?$/,
    from: 1,
    rows: 4,
    why: 'the NOT NULL DEFAULT 1 on fiscal_year_start_month',
  },
];

export const EXPECTED_ROWS = FAMILIES.reduce((n, f) => n + f.rows, 0);

/**
 * Labels this fix must NEVER touch, and their correct value.
 *
 * Long Beach's 16 `salaries` rows come from publicpay.ca.gov (Government
 * Compensation in California), which is a W-2-based CALENDAR-year report — its
 * instructions contain zero occurrences of "fiscal year", and PR #62 corrected
 * 7,682 such rows across 482 entities from 7 to 1. Their 1 is RIGHT.
 *
 * ⚠ Consequence: Long Beach carries TWO start months afterwards — 10 for its
 * SCO, derived and own-budget rows, 1 for its salaries rows. A per-entity
 * single-month assertion would flag that and would be WRONG to. An entity has
 * one fiscal calendar, but a calendar-year compensation dataset genuinely does
 * not share it. Per-entity consistency holds within a dataset family, not across
 * them — the same conclusion Inglewood reached.
 */
export const PROTECTED = [
  {
    pattern: /publicpay|compensation in california/i,
    month: 1,
    rows: 16,
    why: 'publicpay/GCC is a W-2-based calendar-year report (PR #62)',
  },
];

export function protectionFor(source) {
  if (typeof source !== 'string') return null;
  return PROTECTED.find((p) => p.pattern.test(source)) ?? null;
}

export const PROTECTED_ROWS = PROTECTED.reduce((n, p) => n + p.rows, 0);

/** Which in-scope family does this label belong to? */
export function familyFor(source) {
  if (typeof source !== 'string' || source === '') return null;
  const hits = FAMILIES.filter((f) => (f.kind === 'exact'
    ? f.sources.includes(source)
    : f.pattern.test(source)));
  // Two families matching one label means the patterns overlap and the census
  // double-counted. That is a bug in this file, not a data problem.
  if (hits.length > 1) return { ambiguous: hits.map((h) => h.key) };
  return hits[0] ?? null;
}

/**
 * The `data_sources` rows that would re-seed a wrong month on a future load
 * through `treasury_sync_budget_tree`, which takes no month parameter and copies
 * the value off the source row.
 *
 * ⚠ These 12 rows are currently referenced by NO budget row (Long Beach's
 * budgets were written by `treasury_sync_city_budget`, which is name-based and
 * leaves `data_source_id` null). They are corrected anyway: leaving a 1 in a
 * table whose only job is to seed that column is leaving the defect loaded.
 */
export const SOURCE_FAMILY = {
  apiType: 'pdf_download',
  pattern: /^Long Beach General Fund (Operating|Revenue) Budget( FY\d{4})?$/,
  from: 1,
  rows: 12,
};

/**
 * Classify one `budgets` row. Pure, so every guard is testable without a
 * database. `row.entity` is `{ name, state }` — required, because four states
 * have a Long Beach.
 *
 * Returns `{ action: 'update', month }`, `{ action: 'correct' }`, or `{ error }`
 * — and an error is always an abort, never a skip.
 */
export function classify(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state) {
    return { error: 'row has no entity {name,state}; four states have a Long Beach' };
  }
  if (e.name !== ENTITY.name || e.state !== ENTITY.state) {
    return { error: `wrong entity reached the update set: ${e.name}, ${e.state} `
      + `(expected ${ENTITY.name}, ${ENTITY.state})` };
  }
  const guarded = protectionFor(row.data_source);
  if (guarded) {
    return { error: `protected source reached the update set: "${row.data_source}" `
      + `(${guarded.why}) — its ${guarded.month} is CORRECT` };
  }
  const family = familyFor(row.data_source);
  if (!family) {
    return { error: `out-of-scope data_source: "${row.data_source}"` };
  }
  if (family.ambiguous) {
    return { error: `data_source "${row.data_source}" matches ${family.ambiguous.length} `
      + `families (${family.ambiguous.join(', ')}) — the patterns overlap` };
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
  // ⚠ Compared against THIS FAMILY's expected wrong value, not a global one.
  // A `1` is wrong on a budget-document row and right on a salaries row.
  if (stored !== family.from) {
    return { error: `stored month ${stored} is neither ${family.from} (this family's `
      + `known-wrong value) nor ${CORRECT_MONTH} — something else has written this `
      + `column and the fix's premise no longer holds` };
  }
  return { action: 'update', month: CORRECT_MONTH };
}

/** Classify one `data_sources` row. */
export function classifySource(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state) {
    return { error: 'data_source row has no entity {name,state}' };
  }
  if (e.name !== ENTITY.name || e.state !== ENTITY.state) {
    return { error: `wrong entity: ${e.name}, ${e.state}` };
  }
  if (row.api_type !== SOURCE_FAMILY.apiType) {
    return { error: `api_type "${row.api_type}" is not the established Long Beach family` };
  }
  if (!SOURCE_FAMILY.pattern.test(row.name ?? '')) {
    return { error: `data_source name "${row.name}" is out of scope` };
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
  if (stored !== SOURCE_FAMILY.from) {
    return { error: `stored month ${stored} is neither ${SOURCE_FAMILY.from} nor ${CORRECT_MONTH}` };
  }
  return { action: 'update', month: CORRECT_MONTH };
}
