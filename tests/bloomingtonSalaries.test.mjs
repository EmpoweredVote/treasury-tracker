/**
 * Bloomington salaries — the two rules the stored rows broke.
 *
 * ⚠⚠ WHY A ROW'S LABEL WENT STALE AND STAYED STALE. `treasury_sync_city_budget`
 * finds its row by (municipality, fiscal_year, dataset_type, fund_scope, basis)
 * and its update path sets ONLY `total_budget`, `source_url` and `source_date`.
 * It rewrites the VALUE every Sunday and never touches `data_source` or
 * `hierarchy`. So FY2021-FY2025 kept `data/checkbook-all.csv` — a path on
 * somebody's disk, shown to readers as the provenance of the figure — while the
 * numbers themselves had long since come from Socrata `fcnf-g862`.
 *
 * The corollary is the reason this is safe to fix in place: a correction to
 * `data_source` or `hierarchy` cannot be undone by the weekly sync.
 *
 * ⚠⚠ AND THE PUBLISHER SAYS THE CURRENT YEAR IS NOT AN ACTUAL, in one sentence:
 * "All data within the current year is a PREDICTED compensation and may not
 * reflect what the compensation will be by the end of the year. Previous years
 * reflect what compensation was actually earned."
 * Every closed year in the dataset carries `asofdate = YYYY-12-31`; the open one
 * carries the date it was last refreshed. That is the test, and it is the
 * publisher's own signal rather than a threshold invented here.
 */
import { describe, it, expect } from 'vitest';

import {
  isFilesystemPathLabel, isClosedYearAsOf, shouldPublishYear, BLOOMINGTON_PARTIAL_YEARS,
} from '../scripts/lib/bloomingtonSalaries.mjs';

describe('isFilesystemPathLabel', () => {
  it('catches the label that actually shipped', () => {
    expect(isFilesystemPathLabel('data/checkbook-all.csv')).toBe(true);
  });

  it('catches other shapes of local path', () => {
    expect(isFilesystemPathLabel('./exports/salaries.xlsx')).toBe(true);
    expect(isFilesystemPathLabel('C:\\work\\payroll.csv')).toBe(true);
    expect(isFilesystemPathLabel('_acfr-work/in/rec_city_ALL.txt')).toBe(true);
  });

  it('does NOT flag a publisher name', () => {
    expect(isFilesystemPathLabel('Bloomington Annual Compensation')).toBe(false);
    expect(isFilesystemPathLabel('Indiana Gateway Annual Financial Report — Revenue by Source (FY2020 actual, unaudited, all funds excl. settlement and payroll clearing)')).toBe(false);
  });

  it('does NOT flag a URL, which names a real publisher endpoint', () => {
    // ⚠ LA County's salaries row is labelled with an ArcGIS FeatureServer URL.
    // That is a provenance a reader can follow; a path on a disk is not. A rule
    // that cannot tell them apart would rewrite a row that is already correct.
    expect(isFilesystemPathLabel('ArcGIS: https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/LA_County_Employee_Salaries/FeatureServer/0')).toBe(false);
    expect(isFilesystemPathLabel('Socrata: https://data.lacity.org')).toBe(false);
  });

  it('is safe on empty and non-string input', () => {
    expect(isFilesystemPathLabel('')).toBe(false);
    expect(isFilesystemPathLabel(null)).toBe(false);
    expect(isFilesystemPathLabel(undefined)).toBe(false);
  });
});

describe('isClosedYearAsOf', () => {
  it('accepts the last day of the fiscal year', () => {
    expect(isClosedYearAsOf('2025-12-31T00:00:00.000', 2025)).toBe(true);
    expect(isClosedYearAsOf('2001-12-31T00:00:00.000', 2001)).toBe(true);
  });

  it('REJECTS a mid-year as-of date — the publisher calls it predicted', () => {
    expect(isClosedYearAsOf('2026-09-11T00:00:00.000', 2026)).toBe(false);
  });

  it('REJECTS 31 December of a DIFFERENT year', () => {
    // A row whose as-of date belongs to another year is not evidence that THIS
    // year closed.
    expect(isClosedYearAsOf('2024-12-31T00:00:00.000', 2025)).toBe(false);
  });

  it('REJECTS 30 December, which is not the last day', () => {
    expect(isClosedYearAsOf('2025-12-30T00:00:00.000', 2025)).toBe(false);
  });

  it('is safe on missing or malformed input', () => {
    expect(isClosedYearAsOf(null, 2025)).toBe(false);
    expect(isClosedYearAsOf('not a date', 2025)).toBe(false);
    expect(isClosedYearAsOf('2025-12-31T00:00:00.000', null)).toBe(false);
  });
});

describe('shouldPublishYear', () => {
  it('publishes a closed year', () => {
    expect(shouldPublishYear(2019, '2019-12-31T00:00:00.000').publish).toBe(true);
  });

  it('REFUSES the open year, because the publisher calls it predicted', () => {
    const r = shouldPublishYear(2026, '2026-09-11T00:00:00.000');
    expect(r.publish).toBe(false);
    expect(r.reason).toMatch(/predicted|not closed/i);
  });

  it('REFUSES FY2001, a DECLARED partial year', () => {
    // ⚠⚠ Its as-of date is 2001-12-31, so the closed-year test passes and cannot
    // catch it. Measured instead: across 168 department+title groups with
    // IDENTICAL headcounts, 2001 is a median 0.629 of 2002 and 90% fall in
    // 0.55-0.75, while 2002/2003 and 2003/2004 sit at 0.956 and 0.958. That is
    // ~7.5 months, not a pay cut — a payroll-system cutover mid-year.
    const r = shouldPublishYear(2001, '2001-12-31T00:00:00.000');
    expect(r.publish).toBe(false);
    expect(r.reason).toMatch(/partial/i);
  });

  it('every declared partial year carries its evidence', () => {
    // A declaration without the measurement behind it is a guess someone will
    // later delete. Same rule as the axis registries.
    for (const p of BLOOMINGTON_PARTIAL_YEARS) {
      expect(p.reason.length, `FY${p.year}`).toBeGreaterThan(60);
      expect(p.reason).toMatch(/0\.6|ratio|month/i);
    }
  });
});
