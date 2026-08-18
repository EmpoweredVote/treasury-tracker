import { describe, it, expect } from 'vitest';
import { chooseDisplaySeries } from './budgetSeries';

const d = (fiscal_year: number, fund_scope: string, basis: string, dataset_type = 'operating') =>
  ({ fiscal_year, dataset_type, period_label: null, fund_scope, basis });

describe('chooseDisplaySeries', () => {
  it('returns null when there is nothing for that dataset type', () => {
    expect(chooseDisplaySeries([d(2024, 'all_funds', 'actual')], 'revenue')).toBeNull();
  });

  it('picks the series with the widest year coverage', () => {
    const sets = [
      ...[2020, 2021, 2022].map((y) => d(y, 'all_funds', 'actual')),
      ...[2023].map((y) => d(y, 'general_fund', 'adopted')),
    ];
    expect(chooseDisplaySeries(sets, 'operating')).toEqual({ fundScope: 'all_funds', basis: 'actual' });
  });

  it('LONG BEACH: does not continue an all-funds actuals series with an adopted GF budget', () => {
    const sets = [
      ...Array.from({ length: 23 }, (_, i) => d(2002 + i, 'all_funds', 'actual')),
      d(2025, 'general_fund', 'adopted'),
      d(2026, 'general_fund', 'adopted'),
    ];
    // 23 actual years beat 2 adopted years, and the adopted rows are a DIFFERENT
    // series -- this is the -75% cliff, and the whole point of the milestone.
    expect(chooseDisplaySeries(sets, 'operating')).toEqual({ fundScope: 'all_funds', basis: 'actual' });
  });

  it('prefers actual over adopted on a tie', () => {
    const sets = [d(2024, 'general_fund', 'adopted'), d(2024, 'all_funds', 'actual')];
    expect(chooseDisplaySeries(sets, 'operating')?.basis).toBe('actual');
  });

  it('breaks a remaining tie total_governmental > all_funds > general_fund', () => {
    const sets = [d(2024, 'general_fund', 'actual'), d(2024, 'total_governmental', 'actual')];
    expect(chooseDisplaySeries(sets, 'operating')?.fundScope).toBe('total_governmental');
  });

  it('NEVER prefers unknown while an evidenced series exists, even with more years', () => {
    const sets = [
      ...Array.from({ length: 10 }, (_, i) => d(2010 + i, 'unknown', 'unknown')),
      d(2024, 'all_funds', 'actual'),
    ];
    expect(chooseDisplaySeries(sets, 'operating')).toEqual({ fundScope: 'all_funds', basis: 'actual' });
  });

  it('falls back to unknown when that is genuinely all there is', () => {
    const sets = [d(2024, 'unknown', 'unknown')];
    expect(chooseDisplaySeries(sets, 'operating')).toEqual({ fundScope: 'unknown', basis: 'unknown' });
  });

  it('treats an absent basis field as unknown rather than throwing', () => {
    const sets = [{ fiscal_year: 2024, dataset_type: 'operating', fund_scope: 'all_funds' }];
    expect(chooseDisplaySeries(sets, 'operating')).toEqual({ fundScope: 'all_funds', basis: 'unknown' });
  });
});
