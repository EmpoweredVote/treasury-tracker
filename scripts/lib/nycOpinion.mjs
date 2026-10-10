// NO SHEBANG — a test imports this module.
/**
 * Is a book's auditor's report an UNMODIFIED opinion?
 *
 * Extracted from the verifiers so it can be tested against real wording
 * instead of only being exercised on 24 documents that all happen to pass.
 *
 * ⚠⚠ TWO TRAPS, AND THE OBVIOUS GATE FALLS INTO BOTH.
 *
 * 1. `qualified` IS A SUBSTRING OF `unqualified`. A naive search for
 *    "qualified opinion" matches "unqualified opinion" and reports every clean
 *    book as modified. The compound is blanked before any matching.
 *
 * 2. ⚠⚠ THE PHRASE "QUALIFIED OPINION" IS NOT PRESENT IN A PRE-2012
 *    QUALIFIED REPORT. That heading became mandatory with the clarified
 *    standards (AU-C 705, effective for periods ending on or after
 *    2012-12-15). An SAS-58-era report qualifies with "Except for the effects
 *    of ..., the financial statements referred to above present fairly, in all
 *    material respects ..." -- so it CONTAINS the unmodified phrase and does
 *    NOT contain the heading. TEN of NYC's twenty-four books predate the
 *    change, so a gate resting on the heading alone is blind on 42% of the
 *    window. The "except for" / "basis for qualified" wording is tested too.
 */

const MODIFIED_PHRASES = [
  'qualified opinion',
  'adverse opinion',
  'disclaimer of opinion',
  'basis for qualified',
  'basis for adverse',
  'basis for disclaimer',
  // Pre-2012 wording. Anchored to the opinion sentence, not bare "except for",
  // which appears harmlessly in notes and in the management discussion.
  'except for the effects',
  'except for the omission',
  'with the foregoing explanation',
];

const UNMODIFIED_PHRASE = 'present fairly, in all material respects';

/** Flatten a report's text the way both verifiers do. */
export function flatten(text) {
  return (text || '').replace(/\s+/g, ' ').toLowerCase();
}

/**
 * @param {string} text raw text of the report's front matter
 * @returns {{unmodified: boolean, hasOpinionPhrase: boolean, modifiedHits: string[]}}
 */
export function readOpinion(text) {
  const flat = flatten(text);
  // ⚠ Blank the compound FIRST. Also covers a line-broken "un- qualified",
  // which collapses to "un qualified" and would otherwise match the heading.
  const masked = flat
    .replace(/un-?\s*qualified/g, 'UNQUAL')
    .replace(/unmodified/g, 'UNMOD');

  const modifiedHits = MODIFIED_PHRASES.filter((p) => masked.includes(p));
  const hasOpinionPhrase = flat.includes(UNMODIFIED_PHRASE)
    || masked.includes('UNQUAL opinion') || masked.includes('UNMOD opinion');

  return {
    unmodified: hasOpinionPhrase && modifiedHits.length === 0,
    hasOpinionPhrase,
    modifiedHits,
  };
}
