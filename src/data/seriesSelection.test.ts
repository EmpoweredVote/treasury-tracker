import { describe, it, expect } from 'vitest';
import {
  listSeries, seriesId, defaultSeries, encodeSeries, decodeSeries,
  seriesPeriodTokens, clampYearToSeries,
} from './seriesSelection';
import { TQ_TOKEN, TQ_LABEL } from '../utils/period';

/** One available_datasets entry. */
const d = (
  fiscal_year: number, dataset_type: string, fund_scope: string, basis: string,
  period_label: string | null = null,
) => ({ fiscal_year, dataset_type, period_label, fund_scope, basis });

describe('listSeries', () => {
  it('returns nothing when there are no series datasets', () => {
    expect(listSeries([d(2024, 'salaries', 'unknown', 'unknown')])).toEqual([]);
  });

  it('collapses one series across many years into a single entry', () => {
    const sets = [2022, 2023, 2024].map((y) => d(y, 'operating', 'all_funds', 'actual'));
    const out = listSeries(sets);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('all_funds|actual');
    expect(out[0].label).toBe('All Funds · actuals');
    expect(out[0].span).toEqual({ min: 2022, max: 2024 });
    expect(out[0].totalYears).toBe(3);
    expect(out[0].coverage.operating.years).toEqual([2022, 2023, 2024]);
    expect(out[0].coverage.revenue).toBeUndefined();
  });

  it('UNIONS across operating and revenue rather than intersecting them', () => {
    // FRESNO: operating has two series, revenue has one. The adopted series must
    // survive enumeration even though revenue never carries it -- an intersection
    // would make Fresno's FY2020-26 adopted operating figures permanently invisible.
    const sets = [
      ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'operating', 'all_funds', 'actual')),
      ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'revenue', 'all_funds', 'actual')),
      ...[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => d(y, 'operating', 'unknown', 'adopted')),
    ];
    const out = listSeries(sets);
    expect(out.map((s) => s.id)).toEqual(['all_funds|actual', 'unknown|adopted']);
    expect(out[1].coverage.operating.min).toBe(2020);
    expect(out[1].coverage.revenue).toBeUndefined();
  });

  it('LONGVIEW: two datasets, one series each, DIFFERENT -- yields two entries', () => {
    // The single production entity where no dataset is multi-series yet the entity
    // renders more than one pill. Spec section 3.1. Nothing else exercises this.
    const sets = [
      d(2026, 'operating', 'unknown', 'adopted'),
      d(2026, 'revenue', 'unknown', 'unknown'),
    ];
    const out = listSeries(sets);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.id).sort()).toEqual(['unknown|adopted', 'unknown|unknown']);
    // Each covers exactly one dataset -- which is why selecting either leaves the
    // other tile absent.
    expect(out.every((s) => Object.keys(s.coverage).length === 1)).toBe(true);
  });

  it('PLANO: two series that are both unknown scope, separated only by basis', () => {
    const sets = [
      ...[2018, 2020, 2022, 2024].map((y) => d(y, 'revenue', 'unknown', 'unknown')),
      ...[2019, 2021, 2022].map((y) => d(y, 'revenue', 'unknown', 'adopted')),
    ];
    const out = listSeries(sets);
    expect(out).toHaveLength(2);
    // Both labels start with the same five words; the SPAN is what separates them
    // for a reader, which is why the pill renders coverage and not only a name.
    expect(out.every((s) => s.label.startsWith('Scope not established'))).toBe(true);
    expect(out.map((s) => s.span)).toEqual([{ min: 2018, max: 2024 }, { min: 2019, max: 2022 }]);
  });

  it('EXCLUDES salaries and every other non-series dataset from enumeration', () => {
    const sets = [
      d(2024, 'operating', 'all_funds', 'actual'),
      d(2024, 'salaries', 'unknown', 'unknown'),
      d(2024, 'all_funds_requirements', 'unknown', 'unknown'),
      d(2024, 'federal_agency', 'unknown', 'unknown'),
    ];
    expect(listSeries(sets).map((s) => s.id)).toEqual(['all_funds|actual']);
  });

  it('orders evidenced first, then by coverage, then actual over adopted', () => {
    const sets = [
      ...Array.from({ length: 10 }, (_, i) => d(2010 + i, 'operating', 'unknown', 'unknown')),
      ...[2023, 2024].map((y) => d(y, 'operating', 'all_funds', 'actual')),
    ];
    // An evidenced series leads even with a fifth of the coverage -- the same rule
    // chooseDisplaySeries applies, so the first pill is always the default.
    expect(listSeries(sets).map((s) => s.id)).toEqual(['all_funds|actual', 'unknown|unknown']);
  });

  it('treats an absent fund_scope or basis field as unknown rather than throwing', () => {
    const sets = [{ fiscal_year: 2024, dataset_type: 'operating' }];
    expect(listSeries(sets).map((s) => s.id)).toEqual(['unknown|unknown']);
  });

  it('seriesId round-trips a key', () => {
    expect(seriesId({ fundScope: 'general_fund', basis: 'actual' })).toBe('general_fund|actual');
  });
});

describe('defaultSeries', () => {
  it('is exactly what chooseDisplaySeries picks for the active dataset', () => {
    const sets = [
      ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'operating', 'all_funds', 'actual')),
      ...[2025, 2026].map((y) => d(y, 'operating', 'unknown', 'adopted')),
    ];
    expect(defaultSeries(sets, 'operating')).toEqual({ fundScope: 'all_funds', basis: 'actual' });
  });

  it('falls back to the entity-wide best when the active dataset has no rows', () => {
    // LONGVIEW selecting the Employees tab, or any dataset with no series rows:
    // there is still a sensible entity-level default rather than null.
    const sets = [d(2026, 'revenue', 'unknown', 'unknown')];
    expect(defaultSeries(sets, 'operating')).toEqual({ fundScope: 'unknown', basis: 'unknown' });
  });

  it('returns null when the entity has no series datasets at all', () => {
    expect(defaultSeries([d(2024, 'salaries', 'unknown', 'unknown')], 'operating')).toBeNull();
  });
});

describe('decodeSeries', () => {
  const available = listSeries([
    d(2024, 'operating', 'all_funds', 'actual'),
    d(2026, 'operating', 'unknown', 'adopted'),
  ]);

  it('resolves a valid pair the entity actually has', () => {
    expect(decodeSeries('unknown', 'adopted', available))
      .toEqual({ fundScope: 'unknown', basis: 'adopted' });
  });

  it('returns null for a series the entity does not have, so the caller defaults', () => {
    expect(decodeSeries('general_fund', 'actual', available)).toBeNull();
  });

  it('returns null when either param is missing', () => {
    expect(decodeSeries(null, 'actual', available)).toBeNull();
    expect(decodeSeries('all_funds', null, available)).toBeNull();
  });

  it('does NOT let a garbage param normalise into the unknown series', () => {
    // normalizeScope('garbage') returns 'unknown'. Normalising BEFORE validating
    // would make ?scope=garbage&basis=garbage silently select this entity's
    // unknown|adopted series instead of falling back to the default -- a garbage
    // URL quietly changing the figure on screen.
    expect(decodeSeries('garbage', 'garbage', available)).toBeNull();
    expect(decodeSeries('garbage', 'adopted', available)).toBeNull();
    expect(decodeSeries('unknown', 'garbage', available)).toBeNull();
  });

  it('round-trips through encodeSeries', () => {
    const k = { fundScope: 'all_funds', basis: 'actual' } as const;
    const { scope, basis } = encodeSeries(k);
    expect(decodeSeries(scope, basis, available)).toEqual(k);
  });
});

describe('seriesPeriodTokens', () => {
  it('offers only the years the selected series covers', () => {
    const sets = [
      ...[2022, 2023, 2024].map((y) => d(y, 'operating', 'all_funds', 'actual')),
      ...[2025, 2026].map((y) => d(y, 'operating', 'unknown', 'adopted')),
    ];
    expect(seriesPeriodTokens(sets, { fundScope: 'unknown', basis: 'adopted' }))
      .toEqual(['2026', '2025']);
  });

  it('unions the series years across operating and revenue', () => {
    const sets = [
      d(2024, 'operating', 'all_funds', 'actual'),
      d(2023, 'revenue', 'all_funds', 'actual'),
    ];
    expect(seriesPeriodTokens(sets, { fundScope: 'all_funds', basis: 'actual' }))
      .toEqual(['2024', '2023']);
  });

  it('KEEPS years that only a non-series dataset has, so the Employees tab stays reachable', () => {
    const sets = [
      d(2024, 'operating', 'all_funds', 'actual'),
      d(2025, 'salaries', 'unknown', 'unknown'),
    ];
    expect(seriesPeriodTokens(sets, { fundScope: 'all_funds', basis: 'actual' }))
      .toEqual(['2025', '2024']);
  });

  it('preserves the FY1976 Transition Quarter token', () => {
    // The TQ is SYNTHESISED by buildPeriodTokens from a period_label row, so the
    // filter must be applied to its INPUT, never to its output tokens -- filtering
    // tokens would drop or orphan it. Federal is the only entity with TQ rows and
    // it has a single series, so no multi-series fixture can catch this.
    const sets = [
      d(1975, 'operating', 'unknown', 'unknown'),
      d(1976, 'operating', 'unknown', 'unknown'),
      d(1976, 'operating', 'unknown', 'unknown', TQ_LABEL),
      d(1977, 'operating', 'unknown', 'unknown'),
    ];
    expect(seriesPeriodTokens(sets, { fundScope: 'unknown', basis: 'unknown' }))
      .toEqual(['1977', '1976', TQ_TOKEN, '1975']);
  });

  it('falls back to every year when no series is selected', () => {
    const sets = [
      d(2024, 'operating', 'all_funds', 'actual'),
      d(2026, 'operating', 'unknown', 'adopted'),
    ];
    expect(seriesPeriodTokens(sets, null)).toEqual(['2026', '2024']);
  });
});

describe('clampYearToSeries', () => {
  it('keeps a year the series covers', () => {
    expect(clampYearToSeries('2023', ['2024', '2023', '2022'])).toBe('2023');
  });

  it('moves to the nearest covered year', () => {
    expect(clampYearToSeries('2019', ['2024', '2023', '2022'])).toBe('2022');
    expect(clampYearToSeries('2030', ['2024', '2023', '2022'])).toBe('2024');
  });

  it('prefers the LATER year on an equal distance', () => {
    // Tokens descend, and the scan keeps the first strict improvement, so a tie
    // resolves to the more recent year. Readers reach for recent data.
    expect(clampYearToSeries('2023', ['2024', '2022'])).toBe('2024');
  });

  it('returns the token unchanged when the series covers nothing', () => {
    expect(clampYearToSeries('2024', [])).toBe('2024');
  });

  it('handles the Transition Quarter token without producing NaN', () => {
    expect(clampYearToSeries(TQ_TOKEN, ['1977', '1976'])).toBe('1976');
  });
});
