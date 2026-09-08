/**
 * The ONE definition of "city-tier" — an incorporated place with its own
 * general-purpose government, as opposed to a county, a state, the federal
 * government, or a special-purpose body.
 *
 * ── ⚠⚠ WHY THIS FILE EXISTS ────────────────────────────────────────────────
 *
 * This set was written out FOUR separate times, and the copies disagreed. On
 * 2026-09-07, `borough` was present in three `verify-*-tether.mjs` scripts and
 * absent from every list the PRODUCT actually consults:
 *
 *   src/utils/essentialsCoverage.ts   CITY_TIER_TYPES        no borough
 *   src/utils/triviaCoverage.ts       CITY_TIER_TYPES        no borough
 *   src/components/CitiesInCountyPanel.tsx  CHILD_TYPES      no borough
 *   scripts/verify-phase133-tether.mjs      (private copy)   HAS borough
 *   scripts/verify-seattle-tether.mjs       (private copy)   HAS borough
 *   scripts/verify-wa-tether.mjs            (private copy)   HAS borough
 *
 * So Pennsylvania's 949 boroughs — 36% of PA's municipalities, every one of them
 * carrying data — were invisible to coverage matching AND to their own county's
 * children panel, while the three scripts that exist to verify the tether each
 * held a copy of the list that said they were fine.
 *
 * ⭐⭐ A GUARD THAT KEEPS ITS OWN COPY OF THE LIST CANNOT CATCH THE LIST BEING
 * WRONG. That is the same defect shape as #143's per-wave hard-coded registries
 * and #138's gate that derived its subject list from the thing it checked.
 * `tests/cityTierTypes.test.mjs` now reads those three scripts' source and
 * asserts their literal matches this set, so the next omission fails a test.
 *
 * ── ⚠ THIS IS NOT THE SOURCE-CHIP LIST ─────────────────────────────────────
 *
 * `SOURCE_CHIP_ENTITY_TYPES` in src/data/sourceChipTypes.ts is a DIFFERENT set —
 * it also contains `county` and `state`, because those render the chip too, and
 * it deliberately excludes `federal` and `nonprofit`, which render their own
 * source treatments. Do not merge the two.
 *
 * ── ⚠ AND `municipality` IS A LEGACY VALUE, NOT A CLASS OF PLACE ────────────
 *
 * It is kept because 30 rows still carry it — including entities typed that way
 * as a WORKAROUND for `borough` being missing from the chip list (Knight session
 * 5 typed State College `municipality` for exactly that reason). With `borough`
 * present, that workaround is no longer needed; the value stays supported so
 * nothing already stored drops out.
 */

import type { Municipality } from '../types/budget';

export const CITY_TIER_TYPES: ReadonlySet<Municipality['entity_type']> = new Set([
  'city',
  'town',
  'township',
  // ⚠ A village is city-tier: an incorporated place with its own government,
  // which is what a city-tier record describes. Michigan's 253 arrived with the
  // F-65 sweep (#124/#129).
  'village',
  // ⚠⚠ A borough likewise — PA's 949 arrived with the DCED sweep (#133), whose
  // own note said it "MUST be present in every CITY_TIER_TYPES set or coverage
  // matching silently stops finding boroughs". It was not. This is that fix.
  'borough',
  'municipality',
]);

/** True when this entity type is an incorporated place, i.e. city-tier. */
export function isCityTier(entityType: string | null | undefined): boolean {
  return CITY_TIER_TYPES.has(entityType as Municipality['entity_type']);
}
