import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixPublicpayFiscalYearStartMonth.mjs: that
// file starts with a shebang, and tests/waSao + tests/nulByte forbid a test from
// importing any module that does.
import {
  CORRECT_MONTH, HARDCODED_MONTH, ALLOWED_MONTHS, IN_SCOPE_SOURCE, IN_SCOPE_DATASET,
  EXCLUDED_SOURCES, SWEEP_ROWS, SWEEP_ENTITIES, classify,
} from '../scripts/lib/publicpayFiscalCalendar.mjs';

const row = (over = {}) => ({
  data_source: IN_SCOPE_SOURCE,
  dataset_type: 'salaries',
  fiscal_year: 2024,
  fiscal_year_start_month: 7,
  ...over,
});

describe('publicpay (GCC) reporting calendar', () => {
  it('is January — GCC is a W-2-based calendar-year report', () => {
    expect(CORRECT_MONTH).toBe(1);
    expect(ALLOWED_MONTHS.has(CORRECT_MONTH)).toBe(true);
  });

  it('replaces 7, the value the sync RPC hardcoded', () => {
    expect(HARDCODED_MONTH).toBe(7);
    expect(CORRECT_MONTH).not.toBe(HARDCODED_MONTH);
  });

  it('records the sweep baseline: 7,682 rows across 482 entities', () => {
    expect(SWEEP_ROWS).toBe(7682);
    expect(SWEEP_ENTITIES).toBe(482);
  });

  // ⚠ The label is compared with ===, and it contains an EM DASH. Pinning the
  // exact bytes here means a hyphen variant creeping into the constant fails a
  // test instead of silently matching zero rows in production.
  it('pins the exact data_source label, em dash included', () => {
    expect(IN_SCOPE_SOURCE).toBe(
      'CA State Controller — Government Compensation in California (publicpay.ca.gov)');
    expect(IN_SCOPE_SOURCE).toContain('—');
    expect(IN_SCOPE_SOURCE).not.toContain(' - ');
  });
});

describe('classify', () => {
  it('updates a row still carrying the hardcoded 7', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 1 });
  });

  it('reports an already-corrected row as correct, so a re-run is a no-op', () => {
    expect(classify(row({ fiscal_year_start_month: 1 }))).toEqual({ action: 'correct' });
  });

  it('accepts a numeric string, as PostgREST may return for a bigint', () => {
    expect(classify(row({ fiscal_year_start_month: '7' }))).toEqual({ action: 'update', month: 1 });
  });

  // ⚠ THE GUARD WITH TEETH. These are also dataset_type='salaries' and also sit
  // at 7, but each has its own calendar and none of it is established here.
  // Writing 1 to Utah's rows would replace one unverified value with another.
  it.each(EXCLUDED_SOURCES)('ABORTS rather than touch a %s row', (data_source) => {
    const c = classify(row({ data_source }));
    expect(c.error).toMatch(/excluded source/i);
    expect(c.action).toBeUndefined();
  });

  it('lists the excluded sources it must never sweep in', () => {
    expect(EXCLUDED_SOURCES).toContain('Transparent Utah');
    expect(EXCLUDED_SOURCES).toContain('LA City Payroll');
  });

  it('aborts on an unrecognised label rather than assuming the calendar', () => {
    expect(classify(row({ data_source: 'CA State Controller - Expenditures' })).error)
      .toMatch(/out-of-scope/i);
  });

  // A hyphen where the label has an em dash must NOT quietly match.
  it('aborts on a hyphen variant of the label', () => {
    const hyphenated = IN_SCOPE_SOURCE.replace('—', '-');
    expect(classify(row({ data_source: hyphenated })).error).toMatch(/out-of-scope/i);
  });

  it('aborts if the row is not a salaries row, even under the right label', () => {
    expect(classify(row({ dataset_type: 'operating' })).error).toMatch(/expected dataset_type/i);
    expect(IN_SCOPE_DATASET).toBe('salaries');
  });

  it('aborts on a stored month that is neither 7 nor 1', () => {
    expect(classify(row({ fiscal_year_start_month: 10 })).error).toMatch(/neither 7 nor 1/);
    expect(classify(row({ fiscal_year_start_month: 4 })).error).toMatch(/neither 7 nor 1/);
  });

  it('aborts on an unparseable month instead of coercing it', () => {
    expect(classify(row({ fiscal_year_start_month: null })).error).toMatch(/unparseable/i);
    expect(classify(row({ fiscal_year_start_month: '' })).error).toMatch(/unparseable/i);
    expect(classify(row({ fiscal_year_start_month: 'January' })).error).toMatch(/unparseable/i);
  });
});
