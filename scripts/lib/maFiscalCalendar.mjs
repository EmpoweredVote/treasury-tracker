/**
 * Massachusetts cities, towns and counties run JULY–JUNE — by statute, with no
 * charter escape. Their rows claimed JANUARY. This library carries the evidence
 * and the guards.
 *
 * ⚠ NO SHEBANG. This is a library, never executed — and `tests/waSao.test.mjs`
 * fails the build if any module a test imports starts with `#!`.
 *
 * ── The defect: a SECOND silent default, on a SECOND write path ──────────────
 * PR #61 removed the literal `7` from `treasury_sync_city_budget`. It did not
 * touch `treasury_sync_budget_tree`, which is what every MA loader actually
 * calls — and that RPC takes no month parameter at all. It copies the month from
 * the `treasury.data_sources` row:
 *
 *     INSERT INTO treasury.budgets (..., fiscal_year_start_month, ...)
 *     VALUES (..., v_ds.fiscal_year_start_month, ...)
 *
 * and BOTH columns are declared `NOT NULL DEFAULT 1`:
 *
 *     treasury.data_sources.fiscal_year_start_month  bigint NOT NULL DEFAULT 1
 *     treasury.budgets.fiscal_year_start_month       bigint NOT NULL DEFAULT 1
 *
 * No MA loader ever sets it, so the default propagated: 1,409 `data_sources`
 * rows assert January, and the RPC copied that onto 16,839 `budgets` rows.
 *
 *     MA DLS General Fund Expenditures    8,408 rows   351 entities
 *     MA DLS General Fund Revenues        6,663 rows   351 entities
 *     MA DLS GF Revenue by Source         1,755 rows   351 entities
 *     cambridge-open-data                     8 rows     1 entity
 *     County operating budget PDFs            5 rows     5 counties
 *                                        ─────────────────────────────
 *                                        16,839 rows   356 entities
 *
 * ⚠ THIS IS WHY BOTH TABLES MUST BE SWEPT. Correcting `budgets` alone leaves the
 * `data_sources` rows at 1, and the next `loadMaGFExcel.js` run copies 1 straight
 * back over the corrected rows. The sweep would silently undo itself.
 *
 * ⚠ AND WHY THE SWEEP'S OWN SCOPE WAS A TRAP. The audit that found this was
 * scoped to `fiscal_year_start_month = 7`, the value the arc had learned to
 * distrust. This entire class sits at `1` and was invisible to that scope. Three
 * CA charter cities holding ZERO rows at 7 is what exposed it. Enumerate a
 * column's whole distribution before scoping an audit to the value you expect.
 *
 * ── Evidence: cities and towns ──────────────────────────────────────────────
 * Mass. Gen. Laws ch. 44, § 56A, CITIES; FISCAL YEAR, verbatim:
 *
 *   "The fiscal year of all cities of the commonwealth shall begin with July
 *    first and end with the following June thirtieth, NOTWITHSTANDING THE
 *    PROVISIONS OF THEIR RESPECTIVE CHARTERS, and the returns made to the
 *    director under section forty-three shall show the financial condition of
 *    the city at the close of business on June thirtieth..."
 *
 *   https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter44/Section56A
 *
 * Mass. Gen. Laws ch. 44, § 56, TOWNS; FISCAL YEAR, verbatim:
 *
 *   "The fiscal year of all towns of the commonwealth shall begin with July
 *    first and end with the following June thirtieth..."
 *
 *   https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter44/Section56
 *
 * ⚠ THE "NOTWITHSTANDING" CLAUSE IS WHY MA HAS NO CARVE-OUT, and it is the one
 * material difference from every other state in this arc. Ohio names Cincinnati;
 * Utah splits by entity type; California lets a charter city choose (Inglewood
 * is October, Long Beach is October). Massachusetts forecloses that in the
 * statute's own words. So a per-state constant IS correct here — but only
 * because the statute says so, not because the data looked uniform. Uniformity
 * was never the reason; see the arc's `deriveTotalGovernmental` guard, which
 * measured conformity to a hardcode and called it agreement.
 *
 * Our 351 municipal entities are stored with `entity_type = 'city'`, which is
 * every Massachusetts municipality — the commonwealth has exactly 351 cities and
 * towns and no other municipal form. §§ 56 and 56A together cover all of them
 * regardless of which label a given one wears, so the split does not matter.
 *
 * ── Evidence: the five surviving counties ───────────────────────────────────
 * §§ 56/56A reach cities and towns only. Counties need their own authority.
 *
 * Mass. Gen. Laws ch. 35, § 16, FISCAL YEAR, verbatim:
 *
 *   "The fiscal year of each county shall be the year beginning with July first
 *    and ending with the following June thirtieth; but the treasurer shall,
 *    until July tenth, enter in his books the items for the payment of bills
 *    incurred and salaries earned during the previous fiscal year."
 *
 *   https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVI/Chapter35/Section16
 *
 * ⚠ § 16 has NO "notwithstanding charters" clause, and two of our five counties
 * are home-rule charter counties — so they were checked individually rather than
 * covered by the statute and assumed. Both agree with it:
 *
 *   BARNSTABLE — Home Rule Charter § 5-1: the fiscal year of the Cape Cod
 *     regional government begins July 1 and ends June 30.
 *     https://www.capecod.gov/county-government/charter/
 *   DUKES — its own County Advisory Board on Expenditures budget hearing notice
 *     puts FY2027 at July 1, 2026 through June 30, 2027.
 *
 * Bristol, Norfolk and Plymouth have no charter and are governed by § 16
 * directly. The other nine Massachusetts counties were abolished (1997–2000) and
 * we hold no rows for them.
 *
 * ── Evidence: cambridge-open-data, the publicpay-shaped risk ────────────────
 * Six of these rows are `dataset_type = 'salary'`, which is exactly the shape
 * that made publicpay a genuine calendar-year source (PR #62) — a compensation
 * extract can easily be W-2-based. So it was checked, not swept.
 *
 * The Socrata metadata for the dataset (`data.cambridgema.gov/api/views/
 * ixg8-tyau.json`, first party) says, verbatim:
 *
 *   "Budgeted salary amounts by position for City of Cambridge departments and
 *    Cambridge Public Schools. Each row represents a budgeted position for a
 *    FISCAL YEAR and includes service area, department, division, position
 *    number, job title, and total budgeted salary. CAMBRIDGE'S FISCAL YEAR RUNS
 *    FROM JULY 1 TO JUNE 30. Data currently covers FY2017 through FY2027."
 *
 * Its columns are `fiscal_year, service, department, division, position_number,
 * job_title, total_salary` — and our stored hierarchy for those rows is exactly
 * `["service", "department", "division"]`. This is a budget, denominated in
 * fiscal years, by a city that § 56A binds anyway. It is the OPPOSITE of
 * publicpay, whose instructions contain zero occurrences of "fiscal year".
 *
 * ⚠ These 8 rows carry a `data_source_id` that has no matching `data_sources`
 * row, so there is nothing to correct on the source side and no loader that can
 * re-assert 1 over them. They are budgets-only.
 *
 * ── What must NOT move ──────────────────────────────────────────────────────
 * The Commonwealth's own 42 state-level rows already read 7 and are out of
 * scope by entity type. The sweep asserts that rather than trusting it.
 */

/** Massachusetts local government runs July–June. */
export const CORRECT_MONTH = 7;

/** The silent column default that propagated through `treasury_sync_budget_tree`. */
export const DEFAULT_MONTH = 1;

/**
 * Months this corpus can legitimately produce. Deliberately narrow: MA admits no
 * charter exception, so anything else in scope is a fact we do not understand.
 */
export const ALLOWED_MONTHS = new Set([1, 7]);

/** Entity types in scope. `state` is excluded — the Commonwealth is not a locality. */
export const IN_SCOPE_ENTITY_TYPES = new Set(['city', 'county']);

/**
 * The in-scope `data_source` families.
 *
 * ⚠ Matched by SUFFIX, not by exact string, because the DLS labels are per-city —
 * 351 distinct strings per family, 1,059 in total. A suffix is the smallest thing
 * that identifies the family, and `match()` anchors it with `endsWith` so a label
 * that merely CONTAINS the phrase cannot slip in.
 *
 * Counts were measured at sweep time (2026-08-25) and independently corroborated:
 * 8,408 / 6,663 / 1,755 are the same three numbers `scripts/classifyFundScope.mjs`
 * arrived at by its own separate census of the 3,824 distinct source strings.
 */
export const FAMILIES = [
  {
    key: 'ma-dls-gf-exp',
    kind: 'suffix',
    pattern: ' — MA General Fund Expenditures',
    entityTypes: ['city'],
    rows: 8408,
    sources: 351,
    entities: 351,
    authority: 'Mass. Gen. Laws ch. 44 §§ 56, 56A — July 1 to June 30 for all '
      + 'towns and all cities, the latter "notwithstanding the provisions of '
      + 'their respective charters".',
  },
  {
    key: 'ma-dls-gf-rev',
    kind: 'suffix',
    pattern: ' — MA General Fund Revenues',
    entityTypes: ['city'],
    rows: 6663,
    sources: 351,
    entities: 351,
    authority: 'Mass. Gen. Laws ch. 44 §§ 56, 56A.',
  },
  {
    key: 'ma-dls-gf-rev-by-source',
    kind: 'suffix',
    pattern: ' — MA DLS General Fund Revenue by Source',
    entityTypes: ['city'],
    rows: 1755,
    sources: 351,
    entities: 351,
    authority: 'Mass. Gen. Laws ch. 44 §§ 56, 56A.',
  },
  {
    // ⚠ Checked, not assumed — six of these are `dataset_type = 'salary'`, the
    // publicpay shape. The dataset's own metadata states the fiscal year.
    key: 'cambridge-open-data',
    kind: 'exact',
    pattern: 'cambridge-open-data',
    entityTypes: ['city'],
    rows: 8,
    sources: 1,
    entities: 1,
    authority: 'City of Cambridge Open Data "Budget - Salaries" metadata: "Each '
      + 'row represents a budgeted position for a fiscal year ... Cambridge\'s '
      + 'fiscal year runs from July 1 to June 30."; and ch. 44 § 56A regardless.',
  },
  {
    key: 'ma-county-budget-doc',
    kind: 'regex',
    pattern: /^[A-Za-z. ]+ County Operating Budget FY\d{4}$/,
    entityTypes: ['county'],
    rows: 5,
    sources: 5,
    entities: 5,
    authority: 'Mass. Gen. Laws ch. 35 § 16 — "The fiscal year of each county '
      + 'shall be the year beginning with July first"; Barnstable Home Rule '
      + 'Charter § 5-1 and the Dukes County FY2027 budget hearing notice concur.',
  },
];

/** Total `budgets` rows the sweep expects to change. */
export const SWEEP_ROWS = FAMILIES.reduce((n, f) => n + f.rows, 0);

/**
 * `data_sources` rows the sweep expects to change, by `api_type`. Measured, and
 * kept separate from the budgets census because they are a different table with
 * a different cardinality — 1,409 source rows behind 16,839 budget rows.
 *
 * ⚠ `ma-dls` is the portal-scraped family that `loadMaGFExcel.js` deliberately
 * KEEPS for future cross-checking (it only clears the budget rows). Its month is
 * just as wrong as the family that is live, and if it is ever promoted to the
 * loading path an uncorrected 1 comes back with it. It is in scope.
 */
export const SOURCE_FAMILIES = [
  { apiType: 'ma-dls', rows: 702, entities: 351, why: 'portal-scraped DLS rows, retained for cross-check' },
  { apiType: 'ma-dls-excel', rows: 702, entities: 351, why: 'the DLS XLSX family that actually loads' },
  { apiType: 'pdf_download', rows: 5, entities: 5, why: 'the five county operating-budget PDFs' },
];

export const SWEEP_SOURCE_ROWS = SOURCE_FAMILIES.reduce((n, f) => n + f.rows, 0);
export const IN_SCOPE_API_TYPES = new Set(SOURCE_FAMILIES.map((f) => f.apiType));

/** Does this `data_source` string belong to a known MA family? */
export function familyFor(source) {
  if (typeof source !== 'string' || source === '') return null;
  const hits = FAMILIES.filter((f) => {
    if (f.kind === 'exact') return source === f.pattern;
    if (f.kind === 'suffix') return source.endsWith(f.pattern);
    return f.pattern.test(source);
  });
  // ⚠ Two families matching one label means the patterns overlap and the census
  // double-counted. That is a bug in this file, not a data problem — say so.
  if (hits.length > 1) {
    return { ambiguous: hits.map((h) => h.key) };
  }
  return hits[0] ?? null;
}

/**
 * Classify one `budgets` row. Pure, so every guard is testable without a
 * database. `row.entity` is `{ name, state, entity_type }` — required, because
 * scope is decided per entity, not per label.
 *
 * Returns `{ action: 'update', month }`, `{ action: 'correct' }`, or `{ error }`
 * — and an error is always an abort, never a skip.
 */
export function classify(row) {
  const e = row.entity;
  if (!e || !e.name || !e.state || !e.entity_type) {
    return { error: 'row has no entity {name,state,entity_type}; scope cannot be evaluated' };
  }
  if (e.state !== 'MA') {
    return { error: `out-of-state entity reached the update set: ${e.name}, ${e.state}` };
  }
  if (!IN_SCOPE_ENTITY_TYPES.has(e.entity_type)) {
    return { error: `entity_type "${e.entity_type}" (${e.name}) is out of scope — `
      + 'ch. 44 §§ 56/56A and ch. 35 § 16 bind localities, not the Commonwealth' };
  }
  const family = familyFor(row.data_source);
  if (!family) {
    return { error: `no established MA family for data_source "${row.data_source}"` };
  }
  if (family.ambiguous) {
    return { error: `data_source "${row.data_source}" matches ${family.ambiguous.length} `
      + `families (${family.ambiguous.join(', ')}) — the patterns overlap` };
  }
  if (!family.entityTypes.includes(e.entity_type)) {
    return { error: `entity_type "${e.entity_type}" does not belong to family `
      + `"${family.key}", which covers ${family.entityTypes.join('/')} — `
      + 'its calendar is not established' };
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
    return { error: `stored month ${stored} is neither ${DEFAULT_MONTH} nor ${CORRECT_MONTH} — `
      + 'MA admits no charter exception, so this is a fact we do not understand' };
  }
  return { action: 'update', month: CORRECT_MONTH };
}

/**
 * Classify one `data_sources` row. Separate from `classify` because the source
 * table is scoped by `api_type`, not by a label suffix, and because getting this
 * half wrong is what would let the sweep undo itself on the next load.
 */
export function classifySource(row) {
  const e = row.entity;
  if (!e || !e.state || !e.entity_type) {
    return { error: 'data_source row has no entity {state,entity_type}' };
  }
  if (e.state !== 'MA') {
    return { error: `out-of-state data_source reached the update set: ${e.name}, ${e.state}` };
  }
  if (!IN_SCOPE_ENTITY_TYPES.has(e.entity_type)) {
    return { error: `data_source entity_type "${e.entity_type}" is out of scope` };
  }
  if (!IN_SCOPE_API_TYPES.has(row.api_type)) {
    return { error: `api_type "${row.api_type}" is not an established MA family` };
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
