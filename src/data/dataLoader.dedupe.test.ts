import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadBudgetData, clearCache } from './dataLoader';

/**
 * ⚠⚠ A VALUE CACHE DOES NOT DEDUPE CONCURRENT CALLERS.
 *
 * `loadBudgetData` caches its result, but it writes that entry only AFTER the
 * awaits resolve. The app loads operating + revenue + salaries together, and
 * re-renders fire more loads before any of them land, so every one of those
 * callers sees an empty cache and issues its own request.
 *
 * Measured on production 2026-09-22, one load of the Los Angeles page:
 * `/treasury/cities/391bf791.../budgets?fiscal_year=2024` fetched **8 times**,
 * one `/categories` URL 4 times, two more twice each — 12 redundant requests
 * out of 36.
 *
 * ⭐ The fix is the one `fetchCityList` already uses, and whose reasoning is
 * written five lines above this cache's declaration: memoize the PROMISE, not
 * the resolved value.
 *
 * ⚠ A REJECTION MUST NOT STAY MEMOIZED, or one transient failure poisons the
 * key for the whole session and every later attempt throws without retrying.
 * That is asserted below, because it is the half of this fix that a naive
 * promise cache gets wrong.
 */

const CITY = {
  id: 'city-1', name: 'Testville', state: 'CA', population: 1000,
  available_datasets: [
    { fiscal_year: 2024, dataset_type: 'operating', period_label: null,
      fund_scope: 'all_funds', basis: 'actual' },
  ],
};

const BUDGETS = [
  { id: 'b-1', dataset_type: 'operating', period_label: null,
    fund_scope: 'all_funds', basis: 'actual', total_budget: 900, fiscal_year: 2024 },
];

const isCityListUrl = (u: string) => new URL(u, 'http://test').pathname.endsWith('/treasury/cities');

function stubFetch(onBudgets?: () => void) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    if (url.includes('/budgets')) onBudgets?.();
    const body =
      url.includes('/categories') ? []
      : url.includes('/budgets') ? BUDGETS
      : isCityListUrl(url) ? [CITY]
      : null;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }));
  return calls;
}

const countMatching = (calls: string[], fragment: string) =>
  calls.filter(u => u.includes(fragment)).length;

beforeEach(() => { clearCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('loadBudgetData — concurrent callers share one request', () => {
  it('fetches a given budget ONCE for six simultaneous callers', async () => {
    // MUTATION TARGET. Revert the cache to storing resolved values instead of
    // the in-flight promise and this fails with 6 === 1.
    const calls = stubFetch();

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        loadBudgetData(2024, 'Testville', 'CA', 'operating', null, null))
    );

    expect(countMatching(calls, '/budgets?fiscal_year=2024')).toBe(1);
    expect(countMatching(calls, '/categories')).toBe(1);
    // Every caller still gets the real answer, not a half-built object.
    for (const r of results) expect(r.metadata.totalBudget).toBe(900);
  });

  it('fetches the budgets URL ONCE across different datasets and series', async () => {
    // MUTATION TARGET, and the one the first fix did NOT cover. These are four
    // DIFFERENT cache keys — two datasets x two series — but the endpoint takes
    // only city + fiscal_year, so all four are the same URL. Deduping by
    // loadBudgetData's key leaves 4 requests; measured 5 on production LA after
    // the caller-level fix alone. Only a per-RESOURCE memo collapses them.
    const calls = stubFetch();

    await Promise.all([
      loadBudgetData(2024, 'Testville', 'CA', 'operating', null, null),
      loadBudgetData(2024, 'Testville', 'CA', 'operating', null,
        { fundScope: 'all_funds', basis: 'actual' }),
      loadBudgetData(2024, 'Testville', 'CA', 'revenue', null, null).catch(() => null),
      loadBudgetData(2024, 'Testville', 'CA', 'salaries', null, null).catch(() => null),
    ]);

    expect(countMatching(calls, '/budgets?fiscal_year=2024')).toBe(1);
  });

  it('still serves later callers from cache once resolved', async () => {
    const calls = stubFetch();
    await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, null);
    await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, null);
    expect(countMatching(calls, '/budgets?fiscal_year=2024')).toBe(1);
  });

  it('does NOT memoize a rejection — a later call retries', async () => {
    let attempt = 0;
    const calls = stubFetch(() => { attempt += 1; });
    // First attempt fails at the budgets step.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('/budgets')) {
        attempt += 1;
        if (attempt === 1) return { ok: false, status: 500 } as unknown as Response;
      }
      const body =
        url.includes('/categories') ? []
        : url.includes('/budgets') ? BUDGETS
        : isCityListUrl(url) ? [CITY]
        : null;
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }));

    await expect(loadBudgetData(2024, 'Testville', 'CA', 'operating', null, null))
      .rejects.toThrow();

    // The failure must not be sticky.
    const retried = await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, null);
    expect(retried.metadata.totalBudget).toBe(900);
  });
});
