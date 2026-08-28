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
  /** A state agency compiled it from audited statements. */
  COMPILED_FROM_AUDITED: 'compiled_from_audited',
  /** A state agency compiled entity self-reports, or disclaims audit. */
  SELF_REPORTED_UNAUDITED: 'self_reported_unaudited',
  /** Not yet assessed. */
  UNKNOWN: 'unknown',
});
export const AUDIT_GRADE_VALUES = Object.freeze(Object.values(AUDIT_GRADE));

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
