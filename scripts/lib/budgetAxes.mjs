/**
 * SCOPE-02 — classifiers for the two axes SCOPE-01 could not express.
 *
 * NO SHEBANG — a `#!` on any module a test imports breaks `npm test` on Windows.
 *
 * Deliberately a near-clone of scripts/lib/fundScope.mjs rather than a
 * generalisation of it. fundScope.mjs is load-bearing for 79,927 already-stamped
 * rows and refactoring it to serve three axes would put that at risk for no
 * behavioural gain. The shared property is the one that matters and it is
 * restated here rather than imported:
 *
 *   AN ENTRY WITHOUT EVIDENCE CANNOT CLASSIFY.
 *
 * No matching entry, a null data_source, placeholder evidence, an illegal value,
 * a matcher that throws — every one yields the axis's unknown value. The
 * destructive direction is "declare two figures comparable", never "skip".
 *
 * Spec: docs/superpowers/specs/2026-08-17-scope-02-design.md
 */

/** Closed-year actual, adopted budget, or not established. */
export const BASIS = Object.freeze({
  ACTUAL: 'actual',
  ADOPTED: 'adopted',
  UNKNOWN: 'unknown',
});
export const BASIS_VALUES = Object.freeze(Object.values(BASIS));

/** Whose books: the primary government alone, or consolidated with component units. */
export const REPORTING_ENTITY = Object.freeze({
  PRIMARY: 'primary_government',
  INCL_COMPONENT_UNITS: 'incl_component_units',
  UNKNOWN: 'unknown',
});
export const REPORTING_ENTITY_VALUES = Object.freeze(Object.values(REPORTING_ENTITY));

/**
 * How much assurance stands behind a figure.
 *
 * Added for the Knight communities campaign as a thin slice of SRCSTD-01 — see
 * .planning/KNIGHT-COMMUNITIES-SEEDING.md §3. It is a THIRD AXIS, classified by
 * the same classifyAxis() below, and inherits its central rule unchanged:
 * an entry without evidence cannot classify.
 *
 * ⚠ The ladder runs strongest-assurance-first, and a source that is MIXED takes
 * the WEAKER branch. Colorado DOLA is the known case: it compiles from "audit OR
 * exemption", so it is self_reported_unaudited unless the specific entity's
 * filing can be identified as audited.
 *
 * ⚠ `unknown` means NOBODY HAS LOOKED. It is never a stand-in for a guess. A row
 * wrongly stamped `audited_gaap` is a false public claim about a government's
 * books — a worse failure than admitting ignorance, and the reason the
 * destructive direction here is "assert a grade", never "skip".
 */
export const AUDIT_GRADE = Object.freeze({
  /** Read directly from an ACFR bearing an independent auditor's opinion. */
  AUDITED_GAAP: 'audited_gaap',
  /**
   * Audited, with an independent opinion — but on an OTHER COMPREHENSIVE BASIS
   * OF ACCOUNTING (OCBOA), not GAAP. Typically modified cash or regulatory
   * basis.
   *
   * ⚠⚠ ADDED FOR BROWN COUNTY SD (Knight session 8), which had no honest slot.
   * Its statements are titled `... - MODIFIED CASH BASIS` and its auditor, the
   * South Dakota Department of Legislative Audit, states outright that they are
   * "prepared on the modified cash basis of accounting, which is a basis of
   * accounting other than accounting principles generally accepted in the
   * United States of America". FAC agrees independently: `gaap_results` is
   * `not_gaap`.
   *
   * The three pre-existing values all misrepresented it. `audited_gaap` matched
   * the DEFINITION but its NAME asserts GAAP, which the document explicitly
   * denies — exactly the "false public claim about a government's books" this
   * docstring warns against. `unknown` means NOBODY HAS LOOKED, and somebody
   * had. `self_reported_unaudited` denies a real independent audit.
   *
   * ⚠ ASSURANCE IS NOT THE SAME AS COMPARABILITY. This sits directly below
   * AUDITED_GAAP because the assurance is equivalent — an independent opinion
   * under Government Auditing Standards — while the measurement basis is not.
   * A reader comparing an OCBOA General Fund with a GAAP one is comparing two
   * different things, and that is what this value exists to say.
   */
  AUDITED_OCBOA: 'audited_ocboa',
  /** A state agency compiled it from audited statements. */
  COMPILED_FROM_AUDITED: 'compiled_from_audited',
  /** A state agency compiled entity self-reports, or disclaims audit. */
  SELF_REPORTED_UNAUDITED: 'self_reported_unaudited',
  /** Not yet assessed. */
  UNKNOWN: 'unknown',
});
export const AUDIT_GRADE_VALUES = Object.freeze(Object.values(AUDIT_GRADE));

/**
 * HOW A FIGURE WAS MEASURED — the accounting basis of the statements it came
 * from. A FOURTH axis, independent of the other three.
 *
 * ⚠⚠ NOT `basis`. `treasury.budgets.basis` is CHECK (basis IN
 * ('actual','adopted','unknown')) and means "closed-year actual, or adopted
 * budget". That is a different question and it already earns its keep —
 * overloading it would destroy both meanings.
 *
 * ⚠⚠ NOT `audit_grade` EITHER. That axis is ASSURANCE: how much independent
 * checking stands behind the figure. Measurement and assurance are
 * independent. Brown County SD is audited to Government Auditing Standards ON
 * A MODIFIED CASH BASIS, and an UNAUDITED cash-basis source must also be
 * describable — deriving this axis from `audited_ocboa` would make that source
 * invisible and would re-encode the very confusion the OCBOA migration was
 * written to escape.
 *
 * ⚠ ASSURANCE IS NOT COMPARABILITY, and neither is this axis a ranking. `cash`
 * is not a worse `gaap`; it is a different measurement. A reader comparing an
 * OCBOA General Fund against a GAAP one is comparing two different things, and
 * saying so is this axis's whole job.
 *
 * Every value is grounded in a document TT holds or is loading. No speculative
 * values: an unused vocabulary value is a claim nobody can falsify.
 */
export const ACCOUNTING_BASIS = Object.freeze({
  /** U.S. GAAP. Redmond WA, Aberdeen SD, every ACFR-derived family. */
  GAAP: 'gaap',
  /** Modified cash. Brown County SD — statements titled `... - MODIFIED CASH BASIS`. */
  MODIFIED_CASH: 'modified_cash',
  /** Cash. Duvall WA — WA BARS regulatory basis, ADVERSE opinion on U.S. GAAP. */
  CASH: 'cash',
  /** Nobody has looked. The default, and a correct outcome rather than a shortfall. */
  UNKNOWN: 'unknown',
});
export const ACCOUNTING_BASIS_VALUES = Object.freeze(Object.values(ACCOUNTING_BASIS));

function hasEvidence(entry) {
  const e = entry?.evidence;
  if (!e || typeof e !== 'object') return false;
  return typeof e.document === 'string' && e.document.trim() !== ''
      && typeof e.figures === 'string' && e.figures.trim() !== '';
}

function isUsableMatcher(match) {
  return !!match && typeof match.test === 'function';
}

/**
 * Classify one `data_source` against one axis registry.
 *
 * @returns {{value: string, entryId: string|null}} entryId is non-null ONLY when a
 *   real classification happened, so callers can count classifications without
 *   re-deriving the rule.
 */
export function classifyAxis(dataSource, registry, legalValues, unknownValue) {
  const none = { value: unknownValue, entryId: null };

  if (typeof dataSource !== 'string' || dataSource.trim() === '') return none;
  if (!Array.isArray(registry) || registry.length === 0) return none;

  for (const entry of registry) {
    if (!isUsableMatcher(entry?.match)) continue;

    let matched;
    try {
      matched = entry.match.test(dataSource);
    } catch {
      // A malformed pattern blocks its own family and nothing else.
      continue;
    }
    if (!matched) continue;

    if (!hasEvidence(entry)) return none;
    if (!legalValues.includes(entry.value)) return none;
    if (entry.value === unknownValue) return none;

    return { value: entry.value, entryId: entry.id };
  }
  return none;
}

/** Structural check, run by the stamping script before it writes anything. */
export function validateAxisRegistry(registry, legalValues, unknownValue) {
  const result = {
    ok: true, unevidenced: [], duplicateIds: [], badValues: [], badMatches: [], missingIds: 0,
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
    if (!legalValues.includes(entry?.value)) result.badValues.push(id);
    else if (entry.value !== unknownValue && !hasEvidence(entry)) result.unevidenced.push(id);
  }

  result.ok = result.unevidenced.length === 0 && result.duplicateIds.length === 0
    && result.badValues.length === 0 && result.badMatches.length === 0
    && result.missingIds === 0;
  return result;
}
