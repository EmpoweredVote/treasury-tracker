import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixInglewoodFiscalYearStartMonth.mjs: that
// file starts with a shebang, and tests/waSao + tests/nulByte forbid a test from
// importing any module that does.
import {
  ENTITY, CORRECT_MONTH, HARDCODED_MONTH, ALLOWED_MONTHS, IN_SCOPE, EXCLUDED,
  EXPECTED_ROWS, classify,
} from '../scripts/lib/inglewoodFiscalCalendar.mjs';

const row = (over = {}) => ({
  data_source: 'CA State Controller - Expenditures',
  fiscal_year: 2024,
  dataset_type: 'operating',
  fund_scope: 'all_funds',
  fiscal_year_start_month: 7,
  ...over,
});

const PUBLICPAY = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)';

describe('Inglewood fiscal calendar', () => {
  it('is October, because the ACFR cover page reads "YEAR ENDED SEPTEMBER 30"', () => {
    expect(CORRECT_MONTH).toBe(10);
    expect(ALLOWED_MONTHS.has(CORRECT_MONTH)).toBe(true);
  });

  it('replaces 7, the value the sync RPC hardcodes', () => {
    expect(HARDCODED_MONTH).toBe(7);
    expect(CORRECT_MONTH).not.toBe(HARDCODED_MONTH);
  });

  it('is keyed on state as well as name — Ingleside, TX also ends September 30', () => {
    expect(ENTITY).toEqual({ name: 'Inglewood', state: 'CA' });
  });

  it('expects 60 rows: 22 + 22 SCO, 8 + 8 derived Total Governmental', () => {
    expect(EXPECTED_ROWS).toBe(22 + 22 + 8 + 8);
  });
});

describe('classify', () => {
  it('updates a row still carrying the hardcoded 7', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 10 });
  });

  it('reports an already-corrected row as correct, so a re-run is a no-op', () => {
    expect(classify(row({ fiscal_year_start_month: 10 }))).toEqual({ action: 'correct' });
  });

  it('accepts a numeric string, as PostgREST may return for a smallint', () => {
    expect(classify(row({ fiscal_year_start_month: '7' }))).toEqual({ action: 'update', month: 10 });
  });

  it('covers all four in-scope labels, SCO and derived alike', () => {
    expect(IN_SCOPE.size).toBe(4);
    for (const data_source of IN_SCOPE) {
      expect(classify(row({ data_source })).action).toBe('update');
    }
  });

  // ⚠ THE GUARD WITH TEETH. publicpay reports by CALENDAR year, so those rows
  // belong at 1 — writing 10 to them would replace one wrong value with another
  // and hide a 7,682-row defect behind a green run. Reaching the update set is an
  // ABORT, not a skip, so a widened scope cannot sweep them in silently.
  it('ABORTS rather than touch a publicpay salaries row', () => {
    const c = classify(row({ data_source: PUBLICPAY, dataset_type: 'salaries' }));
    expect(c.error).toMatch(/excluded source/i);
    expect(c.action).toBeUndefined();
  });

  it('the exclusion matches the live label and is case-insensitive', () => {
    expect(EXCLUDED.test(PUBLICPAY)).toBe(true);
    expect(EXCLUDED.test('PUBLICPAY.CA.GOV')).toBe(true);
    expect(EXCLUDED.test('CA State Controller - Expenditures')).toBe(false);
  });

  it('aborts on an unrecognised label rather than assuming the calendar', () => {
    const c = classify(row({ data_source: 'City of Inglewood ACFR — General Fund FY2024' }));
    expect(c.error).toMatch(/out-of-scope/i);
  });

  // A third value means something else has been writing this column, so the
  // fix's premise no longer holds — stop rather than overwrite it.
  it('aborts on a stored month that is neither 7 nor 10', () => {
    expect(classify(row({ fiscal_year_start_month: 1 })).error).toMatch(/neither 7 nor 10/);
    expect(classify(row({ fiscal_year_start_month: 4 })).error).toMatch(/neither 7 nor 10/);
  });

  it('aborts on an unparseable month instead of coercing it', () => {
    expect(classify(row({ fiscal_year_start_month: null })).error).toMatch(/unparseable/i);
    expect(classify(row({ fiscal_year_start_month: 'July' })).error).toMatch(/unparseable/i);
  });
});
