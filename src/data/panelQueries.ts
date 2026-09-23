import type { Municipality } from '../types/budget';
import type { EntityQuery } from './entityQueries';
import { CITY_TIER_TYPES } from '../utils/cityTierTypes';

/**
 * The slice a page's panels need, or null when it has none.
 *
 * ⭐ A CITY PAGE RENDERS NO PANELS AT ALL — all four are gated on an
 * entity_type of federal, county or state (App.tsx). That is the whole reason
 * this change works: the common case needs ~52 rows, not 8,149.
 *
 * ⚠ A STATE page returns ONE query covering both of its panels. Splitting it
 * would double the requests to save nothing: CountiesInStatePanel and
 * CitiesInStatePanel both want `state = X` and differ only in their predicate,
 * which they still apply themselves.
 */
export function panelQueryFor(
  entity: Pick<Municipality, 'entity_type' | 'state' | 'id'>
): EntityQuery | null {
  switch (entity.entity_type) {
    case 'federal': return { entityTypes: ['state'] };
    case 'state':   return { state: entity.state };
    // ⚠ `entityTypes` here is CITY_TIER_TYPES, a client-side list — the backend
    // has its own whitelist for `?entity_type=`, in a different repo, with no
    // test spanning the two. Adding a type to CITY_TIER_TYPES that the backend
    // does not also know makes this a 422, not a silently-narrower result.
    case 'county':  return { countyId: entity.id, entityTypes: [...CITY_TIER_TYPES] };
    default:        return null;
  }
}

/**
 * The jurisdiction chain above any entity: the federal row, all 50 states (a
 * city resolves its own by abbreviation), and — fetched separately by id — its
 * county. ~52 rows, against 8,149 before.
 */
export function parentsQuery(): EntityQuery {
  return { entityTypes: ['state', 'federal'] };
}

/**
 * The parents query an entity actually needs, or null when it has none.
 *
 * ⚠ `jurisdictionParents` returns [] for a nonprofit (not a jurisdiction) and
 * for the federal government (top of the chain), so fetching for them is pure
 * waste — and on financials.empowered.vote, against an API that ignores the
 * filter, that waste is the whole 3.05 MB list this project exists to avoid.
 */
export function parentsQueryFor(
  entity: Pick<Municipality, 'entity_type'> | null
): EntityQuery | null {
  if (!entity) return null;
  if (entity.entity_type === 'federal' || entity.entity_type === 'nonprofit') return null;
  return parentsQuery();
}
