/**
 * SCOPE-01 fund-scope matching.
 *
 * Given a `treasury.budgets.data_source` string and the source→scope registry,
 * return which funds that source's figures cover. Pure: no DB, no filesystem, no
 * network — so the rule that decides whether a figure is comparable to another
 * city's is testable without a database.
 *
 * NO SHEBANG — a `#!` on any module a test imports breaks `npm test` on Windows,
 * and a test guards it (commit 40aa706, and see tests/waSao.test.mjs).
 *
 * ── The failure direction ────────────────────────────────────────────────────
 * THE DEFAULT IS UNKNOWN, and `unknown` is a correct outcome rather than a
 * shortfall. A scope is only ever asserted by an entry that carries the document
 * it was reconciled against. No matching entry, a null `data_source`, an entry
 * with no evidence, placeholder evidence, a match pattern that throws — every one
 * of them yields `unknown`. Nothing is classified by absence, because the
 * destructive direction here is "declare two figures comparable", not "skip".
 *
 * That last property is the whole point. Treasury Tracker's enterprise/ISF name
 * heuristic was validated on exactly ONE city; making an unevidenced entry
 * structurally incapable of reaching the database is what stops that heuristic
 * becoming a fact about MN OSA, Ohio AOS or Transparent Utah.
 *
 * Spec: docs/superpowers/specs/2026-08-16-scope-01-design.md
 * Evidence of record: docs/superpowers/plans/SCOPE-01-RECON.md
 */

/**
 * Which funds a figure covers.
 *
 * ⚠ These values are mirrored by the `budgets_fund_scope_check` CHECK constraint
 * on `treasury.budgets`. A value here that the constraint does not know is a
 * write that fails in production, so a test asserts the two sets are equal.
 *
 * ── A `special_revenue` value existed briefly and was removed ────────────────
 * It was added for `X — MA DLS Schedule A — Special Revenue Funds`, on the
 * strength of that source string. The string is wrong: docs/MA/ holds only
 * GenFundExpenditures/GenFundRevenues extracts, and those 1,560 rows equal
 * `Total Expenditures` in the General Fund file exactly. No row was ever
 * special_revenue. Dropped 2026-08-17 (RECON §4.4).
 *
 * The lesson is the one this module exists to enforce, so it is recorded rather
 * than quietly erased: a scope was inferred from a `data_source` label, which is
 * precisely what `classify()` refuses to let a registry entry do. Read a loader's
 * actual input before believing what its source string calls itself.
 */
export const SCOPE = Object.freeze({
  GENERAL_FUND: 'general_fund',
  TOTAL_GOVERNMENTAL: 'total_governmental',
  ALL_FUNDS: 'all_funds',
  UNKNOWN: 'unknown',
});

/** Every legal `fund_scope` value, i.e. the CHECK constraint's set. */
export const SCOPE_VALUES = Object.freeze(Object.values(SCOPE));

/**
 * Scopes that must never appear in a cross-entity comparison.
 *
 * Currently just `unknown`. Kept as a LIST behind `isComparableScope()` rather
 * than collapsed to `scope !== 'unknown'` at each call site, because the set has
 * already changed once this milestone and SCOPE-02 introduces genuine fund slices
 * (a category-level `fund_type`). One definition, one place to extend.
 */
export const NON_COMPARABLE_SCOPES = Object.freeze([SCOPE.UNKNOWN]);

/** True when a scope may be compared across entities. */
export function isComparableScope(scope) {
  return SCOPE_VALUES.includes(scope) && !NON_COMPARABLE_SCOPES.includes(scope);
}

/**
 * @typedef {object} Evidence
 * @property {string} document The independent document reconciled against
 * @property {string} figures  The figures that matched, written out
 */

/**
 * @typedef {object} RegistryEntry
 * @property {string} id                 Stable identifier, unique in the registry
 * @property {RegExp} match              Tested against `data_source`
 * @property {string} scope              One of SCOPE_VALUES
 * @property {Evidence|null} evidence    null means unevidenced, which cannot classify
 */

/**
 * Is this real evidence, or an object left behind as a TODO?
 *
 * Requires both fields to be non-empty after trimming. Without this, the evidence
 * rule would be satisfied by the SHAPE of an object rather than by a
 * reconciliation having actually happened — `evidence: {}` would classify.
 */
function hasEvidence(entry) {
  const e = entry?.evidence;
  if (!e || typeof e !== 'object') return false;
  return typeof e.document === 'string' && e.document.trim() !== ''
      && typeof e.figures === 'string' && e.figures.trim() !== '';
}

/** Is `match` something we can safely call `.test()` on? */
function isUsableMatcher(match) {
  return !!match && typeof match.test === 'function';
}

/**
 * Classify one `data_source` string.
 *
 * Returns the FIRST matching entry's scope, so precedence is the registry's
 * declaration order and a specific pattern can be placed ahead of a general one.
 *
 * @param {string|null|undefined} dataSource
 * @param {RegistryEntry[]} registry
 * @returns {{scope: string, entryId: string|null}} `entryId` is non-null ONLY when
 *   a real classification happened, so a caller can count classifications without
 *   re-deriving the rule.
 */
export function classify(dataSource, registry) {
  const unknown = { scope: SCOPE.UNKNOWN, entryId: null };

  if (typeof dataSource !== 'string' || dataSource.trim() === '') return unknown;
  if (!Array.isArray(registry) || registry.length === 0) return unknown;

  for (const entry of registry) {
    if (!isUsableMatcher(entry?.match)) continue;

    let matched;
    try {
      matched = entry.match.test(dataSource);
    } catch {
      // A malformed pattern blocks its own family and nothing else. Swallowing
      // here is deliberate: the alternative is one bad entry unclassifying the
      // entire table, and validateRegistry() is what surfaces the entry itself.
      continue;
    }
    if (!matched) continue;

    // Matched -- but an unevidenced claim is not allowed to reach the database,
    // whatever its `scope` field says. This is the safety property.
    if (!hasEvidence(entry)) return unknown;
    if (!SCOPE_VALUES.includes(entry.scope)) return unknown;
    if (entry.scope === SCOPE.UNKNOWN) return unknown;

    return { scope: entry.scope, entryId: entry.id };
  }

  return unknown;
}

/**
 * Check the registry is well-formed. Run by the verification harness (Task 8) so a
 * bad entry is caught before it classifies 20,000 rows rather than after.
 *
 * An entry whose declared scope is `unknown` is exempt from the evidence rule —
 * it records "this family is known to be unclassified", and there is nothing to
 * reconcile to.
 *
 * @param {RegistryEntry[]} registry
 * @returns {{ok: boolean, unevidenced: string[], duplicateIds: string[],
 *            badScopes: string[], badMatches: string[], missingIds: number}}
 */
export function validateRegistry(registry) {
  const result = {
    ok: true, unevidenced: [], duplicateIds: [], badScopes: [], badMatches: [], missingIds: 0,
  };
  if (!Array.isArray(registry)) {
    result.ok = false;
    return result;
  }

  const seen = new Set();
  for (const entry of registry) {
    const id = entry?.id;
    if (typeof id !== 'string' || id.trim() === '') {
      result.missingIds += 1;
    } else if (seen.has(id)) {
      if (!result.duplicateIds.includes(id)) result.duplicateIds.push(id);
    } else {
      seen.add(id);
    }

    if (!isUsableMatcher(entry?.match)) result.badMatches.push(id);
    if (!SCOPE_VALUES.includes(entry?.scope)) result.badScopes.push(id);
    else if (entry.scope !== SCOPE.UNKNOWN && !hasEvidence(entry)) result.unevidenced.push(id);
  }

  result.ok = result.unevidenced.length === 0 && result.duplicateIds.length === 0
    && result.badScopes.length === 0 && result.badMatches.length === 0
    && result.missingIds === 0;
  return result;
}
