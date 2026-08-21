import { describe, it, expect } from 'vitest';
import {
  listSeries, seriesId, defaultSeries, encodeSeries, decodeSeries,
  seriesPeriodTokens, seriesDatasetTokens, resolveSeriesYear, shouldResetSeries,
  clampYearToSeries, spanLabel,
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

describe('spanLabel', () => {
  it('abbreviates a multi-year span to a two-digit end', () => {
    expect(spanLabel({ min: 2003, max: 2024 })).toBe('FY2003–24');
  });

  it('renders a single-year span with no range dash', () => {
    expect(spanLabel({ min: 2026, max: 2026 })).toBe('FY2026');
  });

  it('PLANO: distinguishes two series whose labels are identical', () => {
    // Both series read "Scope not established ...". The span is the only thing
    // separating them for a reader, which is why the pill renders it.
    expect(spanLabel({ min: 2018, max: 2024 })).not.toBe(spanLabel({ min: 2019, max: 2022 }));
  });

  it('does not abbreviate across a century boundary into an ambiguous pair', () => {
    // FY1998-2003 must not read "FY1998-03", which looks like a backwards range.
    // Connecticut and Wisconsin both carry pre-2000 series, so this is live.
    expect(spanLabel({ min: 1998, max: 2003 })).toBe('FY1998–2003');
  });
});

describe('seriesDatasetTokens', () => {
  /**
   * ANAHEIM, found by UAT on 2026-08-21 and not by any unit test.
   *
   * Its two budget series are DISJOINT -- all_funds/actual FY2003-24 and
   * unknown/adopted FY2025-26 -- and it also carries salaries FY2009-24.
   *
   * `seriesPeriodTokens` deliberately KEEPS salaries-only years so the Employees
   * tab stays reachable. Correct on its own. But it means FY2024 is in the year
   * list while the adopted series has no operating row for FY2024, so the clamp
   * in App.tsx sees an "available" year, returns early, and the reader lands on a
   * blank tile reading "not published in Scope not established - adopted budget.
   * Choose another set above to see it." -- the set they just chose.
   *
   * Two individually-correct decisions combining into a dead end.
   */
  const anaheim = [
    ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'operating', 'all_funds', 'actual')),
    ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'revenue', 'all_funds', 'actual')),
    ...[2025, 2026].map((y) => d(y, 'operating', 'unknown', 'adopted')),
    ...[2025, 2026].map((y) => d(y, 'revenue', 'unknown', 'adopted')),
    ...Array.from({ length: 16 }, (_, i) => d(2009 + i, 'salaries', 'unknown', 'unknown')),
  ];
  const adopted = { fundScope: 'unknown', basis: 'adopted' } as const;

  it('offers only years the series can actually render for the active dataset', () => {
    expect(seriesDatasetTokens(anaheim, adopted, 'operating')).toEqual(['2026', '2025']);
  });
});

describe('resolveSeriesYear', () => {
  // The decision App.tsx makes when the reader picks a series. Pure, because this
  // repo collects no `.test.tsx` and a component cannot be tested at all.
  const anaheim = [
    ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'operating', 'all_funds', 'actual')),
    ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'revenue', 'all_funds', 'actual')),
    ...[2025, 2026].map((y) => d(y, 'operating', 'unknown', 'adopted')),
    ...[2025, 2026].map((y) => d(y, 'revenue', 'unknown', 'adopted')),
    ...Array.from({ length: 16 }, (_, i) => d(2009 + i, 'salaries', 'unknown', 'unknown')),
  ];
  const adopted = { fundScope: 'unknown', basis: 'adopted' } as const;

  it('moves the reader into the selected series instead of stranding them on a blank', () => {
    // THE BUG: FY2024 is in the year picker because salaries covers it, so the
    // clamp saw an available year and returned early -- leaving the reader on a
    // blank tile telling them to choose the set they had just chosen.
    expect(resolveSeriesYear(anaheim, adopted, 'operating', '2024'))
      .toEqual({ token: '2025', moved: true });
  });

  it('reports the move rather than making it silently', () => {
    // `moved` exists so the reader can be told. If the caller had to infer it by
    // comparing tokens, a clamp that happens to land on the same year would be
    // indistinguishable from no clamp at all.
    expect(resolveSeriesYear(anaheim, adopted, 'operating', '2024').moved).toBe(true);
    expect(resolveSeriesYear(anaheim, adopted, 'operating', '2025').moved).toBe(false);
  });

  it('does not move a year the series already covers', () => {
    expect(resolveSeriesYear(anaheim, adopted, 'operating', '2026'))
      .toEqual({ token: '2026', moved: false });
  });

  it('leaves the Employees tab on its own year', () => {
    // salaries is not a series dataset; its years must not be dragged into a
    // budget series' range or the tab becomes unreachable in the years it has.
    expect(resolveSeriesYear(anaheim, adopted, 'salaries', '2024'))
      .toEqual({ token: '2024', moved: false });
  });

  it('a budget-series choice never drags the Employees year', () => {
    // Pins the non-series-dataset guard. Needs a fixture where salaries shares
    // the SELECTED series' scope+basis and does NOT cover the current year --
    // otherwise the empty-tokens guard catches it and the guard looks redundant.
    // A mutation run proved exactly that: this was the one surviving mutant.
    const sets = [
      ...[2020, 2021, 2022, 2023, 2024].map((y) => d(y, 'operating', 'unknown', 'unknown')),
      ...[2020, 2021, 2022].map((y) => d(y, 'salaries', 'unknown', 'unknown')),
    ];
    const series = { fundScope: 'unknown', basis: 'unknown' } as const;
    // Reader is on Employees in FY2024, a year salaries does not cover -- legal,
    // because the picker offers the UNION so every tab stays reachable.
    expect(resolveSeriesYear(sets, series, 'salaries', '2024'))
      .toEqual({ token: '2024', moved: false });
  });

  it('stays put when the series has no row for this dataset at all', () => {
    // FRESNO / LONGVIEW: a one-sided series. There is nowhere to clamp TO, and
    // the display rule wants the absent state shown with the toggle still usable
    // -- not a relocation to an unrelated year.
    const fresno = [
      ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'operating', 'all_funds', 'actual')),
      ...Array.from({ length: 22 }, (_, i) => d(2003 + i, 'revenue', 'all_funds', 'actual')),
      ...[2025, 2026].map((y) => d(y, 'operating', 'unknown', 'adopted')),
    ];
    expect(resolveSeriesYear(fresno, adopted, 'revenue', '2024'))
      .toEqual({ token: '2024', moved: false });
  });

  it('stays put when no series is selected', () => {
    expect(resolveSeriesYear(anaheim, null, 'operating', '2024'))
      .toEqual({ token: '2024', moved: false });
  });

  it('still rescues a year that is outside the picker entirely, even on Employees', () => {
    // Do not regress the pre-existing clamp. "Stay put on a non-series dataset"
    // must mean "do not drag a VALID year", not "never correct an invalid one" --
    // otherwise a reader deep-linked to FY2030 is stranded on a blank forever.
    const sets = [
      ...[2020, 2021, 2022].map((y) => d(y, 'operating', 'unknown', 'unknown')),
      ...[2020, 2021, 2022].map((y) => d(y, 'salaries', 'unknown', 'unknown')),
    ];
    const series = { fundScope: 'unknown', basis: 'unknown' } as const;
    expect(resolveSeriesYear(sets, series, 'salaries', '2030'))
      .toEqual({ token: '2022', moved: true });
  });

  it('resolves the deep-linked adopted series that UAT saw revert to the default', () => {
    // Establishes WHERE the round-trip fault is. Reloading
    // ?scope=unknown&basis=adopted dropped both params and reverted the pill.
    // If this passes, decodeSeries is sound and the fault is in the App wiring.
    expect(decodeSeries('unknown', 'adopted', listSeries(anaheim)))
      .toEqual({ fundScope: 'unknown', basis: 'adopted' });
  });

  it('does NOT narrow the year picker -- Employees stays reachable in FY2024', () => {
    // Guards the fix against over-correcting. The picker keeps salaries-only
    // years; only the landing decision uses the narrow list.
    expect(seriesPeriodTokens(anaheim, adopted)).toContain('2024');
    expect(seriesDatasetTokens(anaheim, adopted, 'operating')).not.toContain('2024');
  });
});

describe('shouldResetSeries', () => {
  /**
   * SCOPE-03 clears the selection when the reader moves between entities: a
   * series Modesto has, Natick will not. Correct -- but the effect was keyed on
   * the entity VALUE, so it also fired once on mount, AFTER the URL-restore batch
   * had already decoded ?scope=&basis= for that same entity. It wiped the
   * restored selection, the URL sync then dropped both params, and a shared link
   * silently showed a DIFFERENT series than the one that was sent.
   *
   * Worse, the year had already been resolved from the URL, so the page rendered
   * FY2025 adopted figures under an "All Funds - actuals, FY 2024" label. Found
   * by UAT 2026-08-21.
   *
   * Reset on a real CHANGE, never on first sight.
   */
  it('does not reset on first sight, so a URL-restored series survives mount', () => {
    expect(shouldResetSeries(null, 'anaheim-ca')).toBe(false);
  });

  it('does not reset when the entity has not changed', () => {
    expect(shouldResetSeries('anaheim-ca', 'anaheim-ca')).toBe(false);
  });

  it('resets when the reader moves to a different entity', () => {
    expect(shouldResetSeries('anaheim-ca', 'natick-ma')).toBe(true);
  });

  it('resets when leaving an entity for the landing screen', () => {
    expect(shouldResetSeries('anaheim-ca', null)).toBe(true);
  });
});
