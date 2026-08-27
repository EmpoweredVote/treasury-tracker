import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixLeonardtownFiscalYearStartMonth.mjs: that
// file starts with a shebang, and tests/waSao + tests/nulByte forbid a test from
// importing any module that does.
import {
  ENTITY, CORRECT_MONTH, DEFAULT_MONTH, ALLOWED_MONTHS, AUTHORITY, IN_SCOPE,
  BASELINE, classify, classifySource,
} from '../scripts/lib/leonardtownFiscalCalendar.mjs';

const row = (over = {}) => ({
  data_source: 'Leonardtown Operating Budget FY2023',
  entity: { name: 'Leonardtown', state: 'MD', entity_type: 'municipality' },
  fiscal_year: 2023,
  total_budget: 100,
  fiscal_year_start_month: 1,
  ...over,
});

const src = (over = {}) => ({
  name: 'Leonardtown Operating Budget FY2023',
  api_type: 'pdf_download',
  dataset_type: 'operating',
  entity: { name: 'Leonardtown', state: 'MD', entity_type: 'municipality' },
  fiscal_year_start_month: 1,
  ...over,
});

describe('Leonardtown runs July–June', () => {
  it('sweeps January to July', () => {
    expect(DEFAULT_MONTH).toBe(1);
    expect(CORRECT_MONTH).toBe(7);
    expect(ALLOWED_MONTHS.has(7)).toBe(true);
  });

  it('is keyed on (name, state)', () => {
    expect(ENTITY).toEqual({ name: 'Leonardtown', state: 'MD' });
  });

  it('cites the charter section and the budget book header', () => {
    expect(AUTHORITY).toMatch(/§ 703/);
    expect(AUTHORITY).toMatch(/first day of July/);
    expect(AUTHORITY).toMatch(/JULY 1, 2022 - JUNE 30, 2023/);
  });

  it('records the measured baselines', () => {
    expect(BASELINE.budgetRows).toBe(6);
    expect(BASELINE.sourceRows).toBe(6);
    expect(BASELINE.protectedStateRows).toBe(8);
    expect(IN_SCOPE.size).toBe(3);
  });
});

describe('classify — budgets', () => {
  it('moves a January row to July', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 7 });
  });

  it('leaves a row already at July alone', () => {
    expect(classify(row({ fiscal_year_start_month: 7 }))).toEqual({ action: 'correct' });
  });

  // The same three labels carry BOTH dataset types — the revenue loader reuses the
  // "Operating Budget" name string with dataset_type 'revenue'. So all six budget
  // rows are covered by three labels, and the label alone cannot tell them apart.
  it('covers all three fiscal years, for either dataset type', () => {
    for (const fy of [2023, 2024, 2025]) {
      for (const dt of ['operating', 'revenue']) {
        expect(classify(row({
          data_source: `Leonardtown Operating Budget FY${fy}`,
          dataset_type: dt,
          fiscal_year: fy,
        }))).toEqual({ action: 'update', month: 7 });
      }
    }
  });

  it('ABORTS on an out-of-scope label rather than defaulting it', () => {
    expect(classify(row({ data_source: 'Leonardtown Operating Budget FY2026' })).error)
      .toMatch(/out-of-scope data_source/);
    expect(classify(row({ data_source: 'Leonardtown Capital Budget FY2023' })).error)
      .toMatch(/out-of-scope/);
  });

  // ⚠ Maryland's own correct month is 7 — the SAME value this sweep writes — so a
  // scope error against the state node would be invisible in the data afterwards.
  // classify must refuse it on identity, not on value.
  it('ABORTS on the State of Maryland even though its month equals the target', () => {
    const c = classify(row({
      entity: { name: 'Maryland', state: 'MD', entity_type: 'state' },
      fiscal_year_start_month: 7,
    }));
    expect(c.error).toMatch(/wrong entity reached the update set/);
  });

  it('ABORTS on another state\'s Leonardtown and on a missing entity', () => {
    expect(classify(row({ entity: { name: 'Leonardtown', state: 'VA' } })).error)
      .toMatch(/wrong entity/);
    expect(classify({ data_source: 'Leonardtown Operating Budget FY2023', fiscal_year_start_month: 1 }).error)
      .toMatch(/no entity/);
  });

  it('ABORTS on a month that is neither 1 nor 7', () => {
    expect(classify(row({ fiscal_year_start_month: 10 })).error).toMatch(/neither 1 nor 7/);
  });

  // ⚠ Number(null) and Number('') are both 0 — an integer that would sail past an
  // isInteger check and be reported as "stored month 0", blaming a value the
  // column never held.
  it('reports nullish as unparseable, not as month 0', () => {
    for (const v of [null, undefined, '']) {
      const c = classify(row({ fiscal_year_start_month: v }));
      expect(c.error).toMatch(/unparseable/);
      expect(c.error).not.toMatch(/month 0/);
    }
  });

  it('rejects a non-integer month', () => {
    expect(classify(row({ fiscal_year_start_month: 7.5 })).error).toMatch(/unparseable/);
    expect(classify(row({ fiscal_year_start_month: 'July' })).error).toMatch(/unparseable/);
  });
});

describe('classifySource — data_sources', () => {
  it('moves a January source row to July', () => {
    expect(classifySource(src())).toEqual({ action: 'update', month: 7 });
  });

  it('leaves a source already at July alone', () => {
    expect(classifySource(src({ fiscal_year_start_month: 7 }))).toEqual({ action: 'correct' });
  });

  it('covers both dataset types under each of the three names', () => {
    for (const fy of [2023, 2024, 2025]) {
      for (const dt of ['operating', 'revenue']) {
        expect(classifySource(src({ name: `Leonardtown Operating Budget FY${fy}`, dataset_type: dt })))
          .toEqual({ action: 'update', month: 7 });
      }
    }
  });

  it('ABORTS on a foreign api_type or an out-of-scope name', () => {
    expect(classifySource(src({ api_type: 'socrata' })).error).toMatch(/not the established/);
    expect(classifySource(src({ name: 'Leonardtown Water Fund FY2023' })).error)
      .toMatch(/out-of-scope data_source name/);
  });

  it('ABORTS on the wrong entity', () => {
    expect(classifySource(src({ entity: { name: 'Maryland', state: 'MD', entity_type: 'state' } })).error)
      .toMatch(/wrong entity/);
  });

  it('reports nullish as unparseable, not as month 0', () => {
    for (const v of [null, undefined, '']) {
      const c = classifySource(src({ fiscal_year_start_month: v }));
      expect(c.error).toMatch(/unparseable/);
      expect(c.error).not.toMatch(/month 0/);
    }
  });
});
