import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadBudgetData, clearCache } from './dataLoader';
import type { HydratedMunicipality } from '../types/budget';

/**
 * ⚠⚠ THE ENTITY LIST IS 3.05 MB, AND A BUDGET LOAD USED TO REQUIRE IT.
 *
 * `loadBudgetData` took a municipality NAME and resolved it to an id against
 * the full list, so every budget load on every host pulled ~8,149 rows to read
 * one. That is why the `?slug=` win in #197 did not remove the big fetch: the
 * financials page looked up its entity in 311 bytes and then the data layer
 * fetched the whole list anyway.
 *
 * ⚠ The payload is O(total entities) and grows with every statewide load
 * (1,144 -> 8,149 so far). Trimming the constant does not stop it; not
 * fetching it does. See project_financials_page_load_perf.
 *
 * Callers already hold the entity — App.tsx passes `selectedEntity`, which is a
 * HydratedMunicipality — so the lookup was re-deriving something known.
 *
 * ⚠ The name path REMAINS for callers that genuinely have only a name. This
 * test pins that both paths work, and that passing the entity skips the list.
 */

const CITY: HydratedMunicipality = {
  id: 'city-1', name: 'Testville', state: 'CA', population: 1000,
  available_datasets: [
    { fiscal_year: 2024, dataset_type: 'operating', period_label: null,
      fund_scope: 'all_funds', basis: 'actual' },
  ],
} as unknown as HydratedMunicipality;

const BUDGETS = [
  { id: 'b-1', dataset_type: 'operating', period_label: null,
    fund_scope: 'all_funds', basis: 'actual', total_budget: 900, fiscal_year: 2024 },
];

const isCityListUrl = (u: string) => {
  const { pathname } = new URL(u, 'http://test');
  return pathname.endsWith('/treasury/cities');
};

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const body =
      url.includes('/categories') ? []
      : url.includes('/budgets') ? BUDGETS
      : isCityListUrl(url) ? [CITY]
      : url.includes('/treasury/cities/') ? CITY
      : null;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }));
  return calls;
}

beforeEach(() => { clearCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('loadBudgetData — entity passed in, list not fetched', () => {
  it('never requests the 3 MB city list when given the entity', async () => {
    // MUTATION TARGET. Drop the `municipality` parameter and this fails: the
    // loader falls back to resolving the name against the full list.
    const calls = stubFetch();

    const data = await loadBudgetData(
      2024, CITY.name, CITY.state, 'operating', null, null, CITY
    );

    expect(calls.filter(isCityListUrl)).toEqual([]);
    expect(data.metadata.totalBudget).toBe(900);
  });

  it('still resolves by name when no entity is passed', async () => {
    // The fallback must keep working — not every caller holds the object.
    const calls = stubFetch();

    const data = await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, null);

    expect(calls.filter(isCityListUrl).length).toBe(1);
    expect(data.metadata.totalBudget).toBe(900);
  });

  it('uses the passed entity even when its name would not match the list', async () => {
    // Proves the entity is USED, not merely accepted and then ignored in favour
    // of a name lookup that happens to return the same row.
    const calls = stubFetch();

    const data = await loadBudgetData(
      2024, 'Not The Same Name', 'ZZ', 'operating', null, null, CITY
    );

    expect(calls.filter(isCityListUrl)).toEqual([]);
    expect(data.metadata.totalBudget).toBe(900);
  });
});
