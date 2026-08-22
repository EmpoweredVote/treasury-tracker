import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadBudgetData, clearCache, SeriesAbsentError, listMunicipalities } from './dataLoader';

const CITY = {
  id: 'city-1', name: 'Testville', state: 'CA', population: 1000,
  available_datasets: [
    { fiscal_year: 2024, dataset_type: 'operating', period_label: null,
      fund_scope: 'all_funds', basis: 'actual' },
    { fiscal_year: 2024, dataset_type: 'operating', period_label: null,
      fund_scope: 'general_fund', basis: 'adopted' },
    { fiscal_year: 2024, dataset_type: 'revenue', period_label: null,
      fund_scope: 'all_funds', basis: 'actual' },
  ],
};

const BUDGETS = [
  { id: 'b-allfunds', dataset_type: 'operating', period_label: null,
    fund_scope: 'all_funds', basis: 'actual', total_budget: 900, fiscal_year: 2024 },
  { id: 'b-generalfund', dataset_type: 'operating', period_label: null,
    fund_scope: 'general_fund', basis: 'adopted', total_budget: 100, fiscal_year: 2024 },
  { id: 'b-revenue', dataset_type: 'revenue', period_label: null,
    fund_scope: 'all_funds', basis: 'actual', total_budget: 950, fiscal_year: 2024 },
];

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const body =
      url.includes('/categories') ? []
      : url.includes('/budgets') ? BUDGETS
      : url.endsWith('/treasury/cities') ? [CITY]
      : null;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }));
  return calls;
}

beforeEach(() => { clearCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('loadBudgetData — series-aware cache key', () => {
  it('returns the RIGHT figure for each series, not the first one cached', async () => {
    // MUTATION TARGET. Remove the series from the cache key in dataLoader.ts and
    // this test must FAIL with 900 === 100. Without it, switching series returns
    // the previously cached other-series figure -- the exact non-determinism
    // SCOPE-02 removed from pickBudgetForSeries, reintroduced one layer up.
    stubFetch();
    const allFunds = await loadBudgetData(
      2024, 'Testville', 'CA', 'operating', null,
      { fundScope: 'all_funds', basis: 'actual' });
    const generalFund = await loadBudgetData(
      2024, 'Testville', 'CA', 'operating', null,
      { fundScope: 'general_fund', basis: 'adopted' });

    expect(allFunds.metadata.totalBudget).toBe(900);
    expect(generalFund.metadata.totalBudget).toBe(100);
  });

  it('still serves the same series from cache without refetching', async () => {
    const calls = stubFetch();
    const key = { fundScope: 'all_funds', basis: 'actual' } as const;
    await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, key);
    const before = calls.length;
    await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, key);
    expect(calls.length).toBe(before);
  });

  it('with no series passed, behaves exactly as before', async () => {
    stubFetch();
    // chooseDisplaySeries prefers the evidenced all_funds/actual series.
    const data = await loadBudgetData(2024, 'Testville', 'CA', 'operating', null);
    expect(data.metadata.totalBudget).toBe(900);
  });
});

describe('loadBudgetData — absent in this series', () => {
  it('throws SeriesAbsentError when the dataset has rows but none in this series', async () => {
    // FRESNO's shape: revenue exists, but not in the adopted series. The UI must
    // render an absent tile, so this must be distinguishable from a fetch failure.
    stubFetch();
    await expect(loadBudgetData(
      2024, 'Testville', 'CA', 'revenue', null,
      { fundScope: 'general_fund', basis: 'adopted' },
    )).rejects.toBeInstanceOf(SeriesAbsentError);
  });

  it('carries the dataset, year and series so the UI can name what is missing', async () => {
    stubFetch();
    const err = await loadBudgetData(
      2024, 'Testville', 'CA', 'revenue', null,
      { fundScope: 'general_fund', basis: 'adopted' },
    ).catch((e) => e);
    expect(err.dataset).toBe('revenue');
    expect(err.year).toBe(2024);
    expect(err.series).toEqual({ fundScope: 'general_fund', basis: 'adopted' });
  });

  it('throws a PLAIN Error when the dataset has no rows at all', async () => {
    // Not an absent series -- genuinely nothing to show. Must NOT be swallowed as
    // an absent tile, or a real data gap renders as a deliberate one.
    stubFetch();
    const err = await loadBudgetData(
      2024, 'Testville', 'CA', 'salaries', null,
      { fundScope: 'all_funds', basis: 'actual' },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(SeriesAbsentError);
  });
});

describe('loadBudgetData — the city list is fetched once, not once per dataset', () => {
  const SERIES = { fundScope: 'all_funds', basis: 'actual' } as const;
  const cityCalls = (calls: string[]) => calls.filter((u) => u.endsWith('/treasury/cities'));

  it('CONCURRENT loads share ONE city-list request', async () => {
    // Measured on production 2026-08-21: /treasury/cities was fetched 3-5 times
    // per page load -- alaska-ak 3x, anaheim-ca 5x, modesto-ca 4x -- serially,
    // and the first figure appeared right after the LAST one landed (6.3s, 5.0s,
    // 4.9s). Step 1 of loadBudgetData resolves the city by NAME from the full
    // 2,463-entity list and cached nothing, so every dataset re-downloaded it.
    // The app loads operating + revenue + salaries in one Promise.all, so the
    // memo must dedupe IN FLIGHT, not merely after the first resolves.
    const calls = stubFetch();
    await Promise.all([
      loadBudgetData(2024, 'Testville', 'CA', 'operating', null, SERIES),
      loadBudgetData(2024, 'Testville', 'CA', 'revenue', null, SERIES),
    ]);
    expect(cityCalls(calls)).toHaveLength(1);
  });

  it('SEQUENTIAL loads share ONE city-list request', async () => {
    const calls = stubFetch();
    await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, SERIES);
    await loadBudgetData(2024, 'Testville', 'CA', 'revenue', null, SERIES);
    expect(cityCalls(calls)).toHaveLength(1);
  });

  it('still returns the right figure for each dataset', async () => {
    // The memo must not become a correctness bug: dedupe the LOOKUP, never the
    // per-dataset result.
    stubFetch();
    const [op, rev] = await Promise.all([
      loadBudgetData(2024, 'Testville', 'CA', 'operating', null, SERIES),
      loadBudgetData(2024, 'Testville', 'CA', 'revenue', null, SERIES),
    ]);
    expect(op.metadata.totalBudget).toBe(900);
    expect(rev.metadata.totalBudget).toBe(950);
  });

  it('listMunicipalities shares the SAME memo as loadBudgetData', async () => {
    // A second, byte-identical fetcher of the same list. Memoizing only the one
    // inside loadBudgetData left 3 requests per page load in the real app instead
    // of 1 -- App.tsx calls listMunicipalities on mount as well.
    const calls = stubFetch();
    await Promise.all([
      listMunicipalities(),
      loadBudgetData(2024, 'Testville', 'CA', 'operating', null, SERIES),
    ]);
    expect(cityCalls(calls)).toHaveLength(1);
  });

  it('listMunicipalities still returns the list', async () => {
    stubFetch();
    const list = await listMunicipalities();
    expect(list.map((m) => m.name)).toEqual(['Testville']);
  });

  it('does NOT memoize a failure — a later load retries and succeeds', async () => {
    // ⚠ Memoizing the rejected promise would poison the whole session: one
    // transient 500 on the city list and every later load throws forever,
    // without ever retrying.
    let failOnce = true;
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith('/treasury/cities')) {
        if (failOnce) { failOnce = false; return { ok: false, status: 500, json: async () => null } as unknown as Response; }
        return { ok: true, status: 200, json: async () => [CITY] } as unknown as Response;
      }
      const body = url.includes('/categories') ? [] : url.includes('/budgets') ? BUDGETS : null;
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }));
    await expect(
      loadBudgetData(2024, 'Testville', 'CA', 'operating', null, SERIES),
    ).rejects.toThrow();
    const recovered = await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, SERIES);
    expect(recovered.metadata.totalBudget).toBe(900);
    expect(cityCalls(calls)).toHaveLength(2);
  });

  it('clearCache() resets the memo, so a later load re-fetches', async () => {
    const calls = stubFetch();
    await loadBudgetData(2024, 'Testville', 'CA', 'operating', null, SERIES);
    expect(cityCalls(calls)).toHaveLength(1);
    clearCache();
    await loadBudgetData(2024, 'Testville', 'CA', 'revenue', null, SERIES);
    expect(cityCalls(calls)).toHaveLength(2);
  });
});
