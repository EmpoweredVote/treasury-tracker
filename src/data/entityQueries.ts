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
export async function fetchEntities(f: EntityQuery): Promise<Municipality[]> {
  const res = await fetch(entityQueryUrl(`${API_BASE}/treasury/cities`, f));
  if (!res.ok) throw new Error(`Cities API returned ${res.status}`);
  return res.json();
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

/** Test seam — clears the memo. */
export function clearEntityIndexCache(): void { indexPromise = null; }
