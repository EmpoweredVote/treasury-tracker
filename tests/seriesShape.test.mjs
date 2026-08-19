import { describe, it, expect } from 'vitest';
import { detectSplitSeriesEntities } from '../scripts/lib/seriesShape.mjs';

const r = (municipality_id, name, dataset_type, fund_scope, basis, fiscal_year = 2026) =>
  ({ municipality_id, name, state: 'TX', dataset_type, fund_scope, basis, fiscal_year });

describe('detectSplitSeriesEntities', () => {
  it('finds the LONGVIEW shape: one series per dataset, and they DIFFER', () => {
    const rows = [
      r('m1', 'Longview', 'operating', 'unknown', 'adopted'),
      r('m1', 'Longview', 'revenue', 'unknown', 'unknown'),
    ];
    const out = detectSplitSeriesEntities(rows);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Longview');
  });

  it('ignores an entity whose datasets share one series', () => {
    const rows = [
      r('m1', 'Normalton', 'operating', 'all_funds', 'actual'),
      r('m1', 'Normalton', 'revenue', 'all_funds', 'actual'),
    ];
    expect(detectSplitSeriesEntities(rows)).toEqual([]);
  });

  it('ignores an entity that is multi-series WITHIN a dataset', () => {
    // San Francisco: two series on operating. The reader has a real choice there
    // and no tile is lost, so it is not this shape.
    const rows = [
      r('m1', 'San Francisco', 'operating', 'all_funds', 'actual', 2024),
      r('m1', 'San Francisco', 'operating', 'unknown', 'adopted', 2025),
      r('m1', 'San Francisco', 'revenue', 'all_funds', 'actual', 2024),
      r('m1', 'San Francisco', 'revenue', 'unknown', 'adopted', 2025),
    ];
    expect(detectSplitSeriesEntities(rows)).toEqual([]);
  });

  it('ignores an entity with only one dataset', () => {
    expect(detectSplitSeriesEntities([r('m1', 'OneSided', 'operating', 'unknown', 'adopted')]))
      .toEqual([]);
  });

  it('ignores non-series datasets entirely', () => {
    const rows = [
      r('m1', 'Salaryville', 'operating', 'all_funds', 'actual'),
      r('m1', 'Salaryville', 'salaries', 'unknown', 'unknown'),
    ];
    expect(detectSplitSeriesEntities(rows)).toEqual([]);
  });
});
