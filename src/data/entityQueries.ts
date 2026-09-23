import type { Municipality } from '../types/budget';

const API_BASE = import.meta.env.PROD && import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export type EntityIndexRow =
  Pick<Municipality, 'id' | 'name' | 'state' | 'entity_type' | 'county_id'>
  & { has_data: boolean; latest_year: number | null };

export interface EntityQuery {
  entityTypes?: string[];
  state?: string;
  countyId?: string;
  fields?: 'index';
}

/**
 * ⚠ `datasets=summary` is always sent. It is what keeps the per-budget-row
 * `available_datasets` array (97% of 23.5 MB) out of the response, and it
 * predates every filter here.
 */
export function entityQueryUrl(base: string, f: EntityQuery): string {
  const p = new URLSearchParams({ datasets: 'summary' });
  if (f.entityTypes?.length) p.set('entity_type', f.entityTypes.join(','));
  if (f.state) p.set('state', f.state);
  if (f.countyId) p.set('county_id', f.countyId);
  if (f.fields) p.set('fields', f.fields);
  return `${base}?${p.toString()}`;
}

/**
 * ⚠⚠ THE CALLER MUST STILL APPLY ITS OWN PREDICATE to what comes back. An API
 * that does not yet understand these parameters returns the FULL list, and
 * every consumer has to render correctly against that — which is what makes
 * the deploy order between the two repos irrelevant. It also means a future
 * drift between a filter and its predicate shows up as a visibly wrong list
 * rather than as silent substitution.
 */
const entityQueryCache: Map<string, Promise<Municipality[]>> = new Map();

/**
 * ⚠⚠ MEMOIZED BY URL, and the PROMISE not the value — same reasoning as
 * `fetchEntityIndex` below and `citiesPromise` in dataLoader.ts. Two callers
 * asking the same question in the same session should cost one request.
 *
 * ⚠ This is not a micro-optimisation while the API is un-deployed: an API that
 * ignores `entity_type` answers the parents query with all 8,149 rows
 * (measured: 3,123 KB), so an un-memoized refetch on every entity change —
 * which App.tsx's parentPool effect now does deliberately, see
 * parentsQueryFor — would download 3 MB per navigation.
 *
 * ⚠ A rejection is NOT memoized — one transient failure must not poison a
 * query for the rest of the session.
 */
export async function fetchEntities(f: EntityQuery): Promise<Municipality[]> {
  const url = entityQueryUrl(`${API_BASE}/treasury/cities`, f);
  let pending = entityQueryCache.get(url);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Cities API returned ${res.status}`);
      return res.json();
    })();
    entityQueryCache.set(url, pending);
    pending.catch(() => { entityQueryCache.delete(url); });
  }
  return pending;
}

/**
 * One entity by id. Used for the county in the jurisdiction chain, which is the
 * only parent not covered by the states+federal query.
 *
 * ⚠ Lives here rather than in App.tsx because `API_BASE` is private to this
 * layer — App.tsx has no business knowing the API's shape.
 */
export async function fetchEntityById(id: string): Promise<Municipality | null> {
  const res = await fetch(`${API_BASE}/treasury/cities/${id}`);
  if (!res.ok) return null;
  return res.json();
}

let indexPromise: Promise<EntityIndexRow[]> | null = null;

/** The lean index, fetched at most once per session. Memoize the PROMISE. */
export function fetchEntityIndex(): Promise<EntityIndexRow[]> {
  if (!indexPromise) {
    indexPromise = fetchEntities({ fields: 'index' }) as unknown as Promise<EntityIndexRow[]>;
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
}

/**
 * Test seam — clears every memo in this module.
 *
 * ⚠ Renamed from `clearEntityIndexCache`: it cleared only `indexPromise`, and
 * once `fetchEntities` grew its own URL-keyed cache a caller who cleared "the"
 * cache and expected a fresh fetch would still get a memoized response for
 * any non-index query — the exact "clearCache() is a half-truth" defect
 * dataLoader.ts documents on its own clearCache(). Clear every memo here, or
 * this becomes that defect again the next time one is added.
 */
export function clearEntityCaches(): void {
  indexPromise = null;
  entityQueryCache.clear();
}
