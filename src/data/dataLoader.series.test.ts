import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadBudgetData, clearCache, SeriesAbsentError } from './dataLoader';

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
