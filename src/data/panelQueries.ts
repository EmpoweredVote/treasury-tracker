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
