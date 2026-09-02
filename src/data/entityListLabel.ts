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

/**
 * Drop a trailing `, <county>` when the county is ALREADY on screen.
 *
 * ── ⚠⚠ WHY THE STORED NAME KEEPS IT ANYWAY ─────────────────────────────────
 *
 * Michigan's townships are named `Hopkins Township, Allegan County` because they
 * have to be: 117 township names are shared by 302 townships, `Grant Township`
 * names eleven of them, and `treasury_ensure_municipality` keys on
 * (name, state, entity_type) — so a bare name would merge those governments into
 * one municipality carrying all their budgets. The county in the name is an
 * identity, not a decoration, and it must never be trimmed from the stored value.
 *
 * But in a context that has already named the county it reads twice over:
 *
 *   Michigan › Allegan County › Hopkins Township, Allegan County
 *   "Local governments in Allegan County"  ->  Hopkins Township, Allegan County
 *
 * So it is trimmed HERE, at the point of display, and only where the caller can
 * prove the county is already visible — the county page's own list, and a
 * breadcrumb whose immediate parent IS that county.
 *
 * ⚠ It matches the ONE county passed in, exactly. A general `/, .* County$/`
 * rule would also strike a place genuinely named that way, and would fire on the
 * state page where the suffix is the only thing telling 302 townships apart.
 */
export function shortNameInCounty(name: string, countyName?: string | null): string {
  if (!countyName) return name;
  const suffix = `, ${countyName}`;
  // ⚠ Never return an empty label, however odd the input.
  if (!name.endsWith(suffix) || name.length <= suffix.length) return name;
  return name.slice(0, -suffix.length);
}
