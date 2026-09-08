/**
 * Which entity types render the source chip — the provenance pill carrying the
 * source's name, its as-of date and a link to the document.
 *
 * ⚠ Moved out of App.tsx because membership of this set is a REAL DEFECT SURFACE,
 * not a detail. `city` was missing from it for months: the chip was added for
 * counties only (Phase 57, "OC county page only") and never widened, so no city
 * in the app showed provenance or an as-of date. AUSTIN-TRAVIS-01 UAT reported it
 * as "I don't see sept 30 anywhere on austin". The data was correct the whole
 * time — Austin's API response carried `fetchedAt: 2024-09-30` throughout — and
 * every gate stayed green, because a missing chip moves no dollar figure. This
 * repo can run no component tests, so an enumerated test over this set is the only
 * guard available.
 */

/**
 * ⚠ `state` was EXCLUDED until 2026-08-23, with this reason in the code: "nobody
 * has checked the quality of state `data_source_info` yet — it is a candidate, not
 * a decision." The consequence was that AUSTIN-TRAVIS-01 UAT test 7 — does the New
 * York node show its April fiscal year? — could never be satisfied, because the
 * as-of date is the only surface that fact has.
 *
 * The check was done on ten state nodes, chosen to cover all four distinct fiscal
 * calendars in the table:
 *
 *   New York   2024-03-31   (FYE Mar 31)   ✅
 *   Texas      2024-08-31   (FYE Aug 31)   ✅
 *   Alabama    2025-09-30   (FYE Sep 30)   ✅
 *   Michigan   2025-09-30   (FYE Sep 30)   ✅
 *   CA · FL · OH · MN · WA · AZ  06-30     ✅ 6 of 6
 *
 * 10 of 10 carry a `displayName`, a real source URL, and an as-of date matching
 * that state's own fiscal year end. Chris's call, 2026-08-23: include them.
 *
 * ⚠ `federal` and `nonprofit` stay out. Both render their own source treatments
 * above this chip's position, so including them would double up — a deliberate
 * exclusion, and the enumeration test pins it so it cannot be "fixed" by accident.
 */
/**
 * ⚠⚠ `borough` AND `village` WERE MISSING, AND BOTH CARRY DATA.
 *
 * Measured 2026-09-07: 949 of Pennsylvania's 2,620 municipalities are `borough`
 * (36%, every one with budget rows) and 253 Michigan units are `village`. All
 * 1,202 rendered NO source chip — a figure on screen with no provenance, which
 * is the one thing TT is not allowed to show.
 *
 * ⚠ It was not a simple omission. Knight session 5 typed State College
 * `municipality` INSTEAD of `borough` precisely because this list lacked it, and
 * `tests/paInLoad.test.mjs` pinned that workaround with an assertion that
 * `borough` is absent. Then the DCED statewide sweep (#133) introduced `borough`
 * for 949 entities anyway — so the two decisions collided and the loser was the
 * chip. State College is `borough` in the database today while that test still
 * asserted `municipality`, because it read the registry constant and not the row.
 *
 * ⭐ Adding both here is what lets the Indiana sweep type 449 CIVIL TOWNs as
 * `town` and PA's boroughs as `borough` without a provenance chip going missing.
 */
export const SOURCE_CHIP_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'city', 'municipality', 'town', 'township', 'village', 'borough', 'county', 'state',
]);

/** True when this entity type renders the source chip. */
export function showsSourceChip(entityType: string | null | undefined): boolean {
  return SOURCE_CHIP_ENTITY_TYPES.has(entityType ?? '');
}
