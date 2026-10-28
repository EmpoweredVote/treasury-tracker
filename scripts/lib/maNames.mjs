/**
 * Resolving a Massachusetts municipality name to its type and stored name.
 *
 * NO SHEBANG — library module under scripts/lib/.
 *
 * ── ⚠⚠ WHY THIS EXISTS ─────────────────────────────────────────────────────
 *
 * All 351 MA municipalities were typed `city`; 306 of them are towns.
 * `scripts/scrapeMaDLS.js` hard-coded `entity_type: 'city'`, so the type was
 * never a reading of anything. Correcting it is not cosmetic:
 * `treasury_ensure_municipality` keys on (lower(name), state, entity_type) and
 * INSERTS when it finds no match, so a retype plus any loader still passing
 * `city` MINTS A SECOND Brookline rather than colliding visibly.
 *
 * ⚠⚠ AND THIRTEEN GOVERNMENTS ARE NOW STORED UNDER A NAME DLS DOES NOT PRINT.
 * Thirteen MA municipalities have a legal name ending in "Town" and run a city
 * charter, so the census writes "Amherst Town city". TT types them `town` and
 * stores the LEGAL name — `Amherst Town` — while DLS keeps printing `Amherst`.
 * Every MA lookup site matches the publisher's spelling, so each one must
 * resolve through here. A site that does not will not fail: it will create a
 * second `Amherst`, typed `city`, and quietly take every year from then on.
 *
 * ⚠ The failure direction is `null`, never a guess. A caller handed a name
 * this module does not know must REFUSE — defaulting to `city` is exactly the
 * hard-coded assumption that caused the defect.
 */
import { MA_MUNICIPAL_TYPES } from '../data/maMunicipalTypes.mjs';

/**
 * The lookup key.
 *
 * ⚠⚠ The census writes `Manchester-by-the-Sea` and DLS writes
 * `Manchester By The Sea`. Matching raw strings loses that government, and a
 * lost government forks on the next load. Punctuation, spacing and case all go.
 */
export function squashMa(s) {
  return typeof s === 'string' ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

/** Legal name minus a trailing " Town" — the spelling DLS prints. */
const plain = (legal) => legal.replace(/\sTown$/, '');

/**
 * ⚠ BOTH spellings key the same entry: the legal name TT now stores, and the
 * plain name the publisher prints. That is what lets a reload find the entity
 * it already created instead of making a second one.
 */
const BY_KEY = new Map();
for (const row of MA_MUNICIPAL_TYPES) {
  for (const key of new Set([squashMa(row.legal), squashMa(plain(row.legal))])) {
    BY_KEY.set(key, row);
  }
}

/**
 * The thirteen renames, as (publisher spelling -> stored legal name).
 *
 * ⚠ Derived from the roster rather than listed by hand, so it cannot drift
 * from the data it describes.
 */
export const MA_RENAMES = MA_MUNICIPAL_TYPES
  .filter((r) => plain(r.legal) !== r.legal)
  .map((r) => ({ from: plain(r.legal), to: r.legal }));

/** The roster entry for a Massachusetts name, in either spelling, or null. */
export function maEntityFor(name) {
  return BY_KEY.get(squashMa(name)) ?? null;
}

/** The name TT stores this government under, or null if MA has no such name. */
export function maLegalName(name) {
  return maEntityFor(name)?.legal ?? null;
}

/** `city` or `town`, or null if MA has no such name. */
export function maEntityType(name) {
  return maEntityFor(name)?.entityType ?? null;
}

/**
 * The ONE key every Massachusetts name lookup must use, on BOTH sides of the
 * comparison.
 *
 * ⚠⚠ SQUASHING ALONE IS NOT ENOUGH, and that is the subtle half of this.
 * `squashMa` fixes punctuation (`Manchester-by-the-Sea` vs
 * `Manchester By The Sea`) but it cannot fix a name that is genuinely
 * DIFFERENT: DLS prints `Amherst` while TT stores `Amherst Town`, and
 * `squashMa` maps those to two distinct keys. Canonicalising through the
 * roster first collapses them, because the roster keys both spellings.
 *
 * ⚠ A name the roster does not know falls through to its own squashed form
 * rather than vanishing, so a non-MA or newly-created name still compares
 * equal to itself. The caller still has to decide what to do about it —
 * `maEntityFor` returning null is the signal, not this.
 */
export function maKey(name) {
  return squashMa(maLegalName(name) ?? name);
}
