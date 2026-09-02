import type { Municipality } from '../types/budget';

/** Plural labels for the sub-state entity types a state page can list. */
export const TYPE_LABELS: Record<string, string> = {
  city: 'Cities',
  town: 'Towns',
  township: 'Townships',
  village: 'Villages',
  municipality: 'Municipalities',
  special_district: 'Special Districts',
  school_district: 'School Districts',
  library: 'Libraries',
  conservancy: 'Conservancy Districts',
};

/** The label used when a list holds more than one kind of government. */
export const MIXED_LABEL = 'Local governments';

/**
 * What to call a list of a state's local governments, given what is actually IN
 * it.
 *
 * ── ⚠⚠ WHY THIS IS DERIVED AND NOT A CONSTANT ──────────────────────────────
 *
 * `CitiesInStatePanel` selects its entities by EXCLUSION — everything that is
 * not a state, county, nonprofit or federal entity — while its heading was the
 * hardcoded string "Cities in {state}". Those two claims agreed only for as long
 * as every state happened to hold nothing but cities, and nothing connected them,
 * so the day one didn't, the page asserted something false and no test moved.
 *
 * Michigan is that day: 280 cities, 253 villages and 1,240 townships, and
 * "Cities in Michigan" over 1,774 entries is simply wrong.
 *
 * Deriving the label from the list's own contents means a state holding only
 * cities keeps its precise, familiar heading, a mixed one gets an honest one,
 * and no entity type added later can be silently mislabelled again.
 *
 * ⚠ An UNKNOWN type falls to the mixed label rather than to its raw database
 * value. `village` reached the UI as the lowercase string `village` in the
 * entity switcher, because that map used `LABELS[type] || type` — a fallback
 * that prints a schema value at a reader.
 */
export function listLabel(entities: Pick<Municipality, 'entity_type'>[]): string {
  const types = new Set(entities.map(e => e.entity_type));
  if (types.size !== 1) return MIXED_LABEL;
  const [only] = [...types];
  return TYPE_LABELS[only] ?? MIXED_LABEL;
}
