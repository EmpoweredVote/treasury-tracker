import { describe, it, expect } from 'vitest';
import {
  hasYearColumns, declaredYears, resolveYearColumns, yearColumnsCoverageProblem,
} from '../scripts/lib/yearColumnMapping.mjs';
import { skipFyFilterMultiYearProblem } from '../scripts/lib/socrataFilter.mjs';

/**
 * West Hollywood's real expenditure mapping, FY17-21 dataset 6pse-xeqx.
 * Its actual Socrata columns are _2017_actuals, _2018_actuals, _2019_actuals,
 * _2020_approved and _2021_recommended. The recommended year is deliberately
 * absent: the council never adopted it, so it is neither an actual nor an
 * adopted budget and has no honest basis to be stored under.
 */
const WEHO_FY17_21 = {
  fund_column: 'fund_title',
  skip_fy_filter: true,
  hierarchy_columns: ['fund_title', 'department_title', 'division_title', 'account_category_title'],
  description_column: 'account_title',
  expense_type_column: 'account_category_title',
  year_columns: {
    2017: { amount_column: '_2017_actuals', basis: 'actual' },
    2018: { amount_column: '_2018_actuals', basis: 'actual' },
    2019: { amount_column: '_2019_actuals', basis: 'actual' },
    2020: { amount_column: '_2020_approved', basis: 'adopted' },
  },
};

describe('hasYearColumns', () => {
  it('is false for an ordinary long-format mapping', () => {
    expect(hasYearColumns({ amount_column: 'total_budget' })).toBe(false);
  });

  it('is false for an empty object, an array, or a missing mapping', () => {
    expect(hasYearColumns({ year_columns: {} })).toBe(false);
    expect(hasYearColumns({ year_columns: [] })).toBe(false);
    expect(hasYearColumns({})).toBe(false);
    expect(hasYearColumns()).toBe(false);
  });

  it('is true for the WeHo mapping', () => {
    expect(hasYearColumns(WEHO_FY17_21)).toBe(true);
  });
});

describe('declaredYears', () => {
  it('returns the declared years as ascending numbers', () => {
    expect(declaredYears(WEHO_FY17_21)).toEqual([2017, 2018, 2019, 2020]);
  });

  it('returns nothing for a long-format mapping', () => {
    expect(declaredYears({ amount_column: 'x' })).toEqual([]);
  });
});

describe('resolveYearColumns', () => {
  // ── The behaviour every existing source depends on ──
  it('returns the mapping untouched when there are no year_columns', () => {
    const cm = { amount_column: 'total_budget', actual_amount_column: 'expbfy' };
    const out = resolveYearColumns(cm, 2025);
    expect(out.cm).toBe(cm);          // same object, not a copy
    expect(out.basis).toBeNull();
  });

  it('binds the requested year to its own amount column', () => {
    expect(resolveYearColumns(WEHO_FY17_21, 2019).cm.amount_column).toBe('_2019_actuals');
    expect(resolveYearColumns(WEHO_FY17_21, 2020).cm.amount_column).toBe('_2020_approved');
  });

  it('accepts a numeric or a string fiscal year', () => {
    expect(resolveYearColumns(WEHO_FY17_21, '2018').cm.amount_column).toBe('_2018_actuals');
  });

  it('reports the declared basis for the year', () => {
    expect(resolveYearColumns(WEHO_FY17_21, 2019).basis).toBe('actual');
    expect(resolveYearColumns(WEHO_FY17_21, 2020).basis).toBe('adopted');
  });

  it('leaves the rest of the mapping alone', () => {
    const { cm } = resolveYearColumns(WEHO_FY17_21, 2020);
    expect(cm.hierarchy_columns).toEqual(WEHO_FY17_21.hierarchy_columns);
    expect(cm.description_column).toBe('account_title');
    expect(cm.skip_fy_filter).toBe(true);
  });

  it('does not mutate the source mapping', () => {
    const before = JSON.stringify(WEHO_FY17_21);
    resolveYearColumns(WEHO_FY17_21, 2017);
    expect(JSON.stringify(WEHO_FY17_21)).toBe(before);
  });

  // ⚠ The defect this module exists to prevent, in its subtlest form. WeHo's
  // FY17-21 sources carried actual_amount_column: '_2019_actuals' at the top
  // level. Inheriting that would make FY2017 report FY2019's outturn as its own
  // actual — and the Σ-items == total gate would pass, because the rollup reads
  // the approved column.
  it('DROPS an inherited top-level actual_amount_column the year does not declare', () => {
    const cm = { ...WEHO_FY17_21, actual_amount_column: '_2019_actuals' };
    expect(resolveYearColumns(cm, 2017).cm).not.toHaveProperty('actual_amount_column');
    expect(resolveYearColumns(cm, 2020).cm).not.toHaveProperty('actual_amount_column');
  });

  it('keeps a per-year actual column when the year declares one', () => {
    const cm = {
      ...WEHO_FY17_21,
      year_columns: {
        2020: { amount_column: '_2020_approved', actual_amount_column: '_2020_actuals', basis: 'adopted' },
      },
    };
    expect(resolveYearColumns(cm, 2020).cm.actual_amount_column).toBe('_2020_actuals');
  });

  it('drops an inherited approved_amount_column the year does not declare', () => {
    const cm = { ...WEHO_FY17_21, approved_amount_column: '_2020_approved' };
    expect(resolveYearColumns(cm, 2017).cm).not.toHaveProperty('approved_amount_column');
  });

  // ── Fail loud, never fall back ──
  it('THROWS for a year the mapping does not declare', () => {
    expect(() => resolveYearColumns(WEHO_FY17_21, 2021, 'WeHo Expenditure'))
      .toThrow(/declares no entry for 2021/);
  });

  it('names the declared years and refuses the silent fallback explicitly', () => {
    const cm = { ...WEHO_FY17_21, amount_column: '_2020_approved' };
    expect(() => resolveYearColumns(cm, 2021, 'WeHo Expenditure'))
      .toThrow(/2017, 2018, 2019, 2020/);
    expect(() => resolveYearColumns(cm, 2021, 'WeHo Expenditure'))
      .toThrow(/would file another year's figures under FY2021/);
  });

  it('THROWS when a declared year names no amount column', () => {
    const cm = { year_columns: { 2020: { basis: 'adopted' } } };
    expect(() => resolveYearColumns(cm, 2020)).toThrow(/has no amount_column/);
  });

  // ── basis is mandatory, and 'unknown' is not a declaration ──
  it('THROWS when a declared year omits its basis', () => {
    const cm = { year_columns: { 2020: { amount_column: '_2020_approved' } } };
    expect(() => resolveYearColumns(cm, 2020)).toThrow(/must say whether its column holds/);
  });

  it("THROWS on basis 'unknown' — naming the column means knowing its kind", () => {
    const cm = { year_columns: { 2020: { amount_column: '_2020_approved', basis: 'unknown' } } };
    expect(() => resolveYearColumns(cm, 2020)).toThrow(/basis is "unknown"/);
  });

  it("THROWS on basis 'proposed' — a never-adopted figure has no home here", () => {
    const cm = { year_columns: { 2021: { amount_column: '_2021_recommended', basis: 'proposed' } } };
    expect(() => resolveYearColumns(cm, 2021)).toThrow(/never adopted — do not belong/);
  });
});

describe('yearColumnsCoverageProblem', () => {
  it('is null for a long-format mapping', () => {
    expect(yearColumnsCoverageProblem({ amount_column: 'x' }, [2024, 2025])).toBeNull();
  });

  it('is null when every requested year has its own distinct column', () => {
    expect(yearColumnsCoverageProblem(WEHO_FY17_21, [2017, 2018, 2019, 2020])).toBeNull();
  });

  it('reports the years the mapping does not declare', () => {
    expect(yearColumnsCoverageProblem(WEHO_FY17_21, [2019, 2020, 2021]))
      .toMatch(/no entry for 2021/);
  });

  // Two years on one column is the wide-format defect itself.
  it('reports two years pointing at the same column', () => {
    const cm = {
      year_columns: {
        2017: { amount_column: '_2018_actuals', basis: 'actual' },
        2018: { amount_column: '_2018_actuals', basis: 'actual' },
      },
    };
    expect(yearColumnsCoverageProblem(cm, [2017, 2018]))
      .toMatch(/FY2017 and FY2018 to the same column '_2018_actuals'/);
  });
});

describe('skipFyFilterMultiYearProblem with year_columns', () => {
  // The original refusal — unchanged for every source that is not wide-format.
  it('still refuses a multi-year skip_fy_filter source with no year_columns', () => {
    const cm = { skip_fy_filter: true, amount_column: '_2018_actuals' };
    expect(skipFyFilterMultiYearProblem(cm, [2015, 2016, 2017, 2018]))
      .toMatch(/all read from '_2018_actuals'/);
  });

  it('now points a wide-format source at the fix instead of only "one year at a time"', () => {
    const cm = { skip_fy_filter: true, amount_column: '_2018_actuals' };
    expect(skipFyFilterMultiYearProblem(cm, [2017, 2018]))
      .toMatch(/declare column_mapping\.year_columns/);
  });

  it('ALLOWS multiple years when year_columns covers them distinctly', () => {
    expect(skipFyFilterMultiYearProblem(WEHO_FY17_21, [2017, 2018, 2019, 2020])).toBeNull();
  });

  it('still refuses when year_columns misses one of the requested years', () => {
    expect(skipFyFilterMultiYearProblem(WEHO_FY17_21, [2017, 2021]))
      .toMatch(/no entry for 2021/);
  });

  it('is null for a single year regardless of the mapping', () => {
    expect(skipFyFilterMultiYearProblem({ skip_fy_filter: true, amount_column: 'x' }, [2020]))
      .toBeNull();
  });

  it('is null when skip_fy_filter is not set', () => {
    expect(skipFyFilterMultiYearProblem({ amount_column: 'x' }, [2019, 2020])).toBeNull();
  });
});

/**
 * ── Edge-function parity ──
 *
 * Port of resolveYearColumns() as it ships in supabase/functions/treasury-sync/index.ts.
 * The edge function is Deno TS and calls Deno.serve() at import time, so it cannot be
 * imported here. This mirror exists so the two implementations cannot drift — drift
 * between the repo loader and the cron is what made San Francisco unsyncable for
 * months (PR #88) and what wrote Dallas's $0 total (PR #83).
 */
function edgeResolveYearColumns(cm, fy, sourceName = 'source') {
  const yc = cm?.year_columns;
  const has = !!yc && typeof yc === 'object' && !Array.isArray(yc) && Object.keys(yc).length > 0;
  if (!has) return { cm, basis: null };

  const key = String(fy);
  const entry = yc[key];
  const declared = Object.keys(yc).map(Number).filter(Number.isInteger).sort((a, b) => a - b);

  if (!entry) {
    throw new Error(
      `Refusing to sync ${sourceName} FY${fy}: column_mapping.year_columns is set ` +
      `(this is a wide-format dataset with one column per year) but declares no entry for ` +
      `${key}. Declared years: ${declared.join(', ') || '(none)'}. Falling back to ` +
      `amount_column '${cm.amount_column ?? 'none'}' would file another year's figures under ` +
      `FY${fy}. Add the year to year_columns, or drop it from fiscal_years.`);
  }
  if (!entry.amount_column) {
    throw new Error(
      `Refusing to sync ${sourceName} FY${fy}: year_columns["${key}"] has no ` +
      `amount_column, so every row would be read as 0.`);
  }
  if (!['actual', 'adopted'].includes(entry.basis)) {
    throw new Error(
      `Refusing to sync ${sourceName} FY${fy}: year_columns["${key}"].basis is ` +
      `${JSON.stringify(entry.basis ?? null)}, but a declared year must say whether its ` +
      `column holds an actual or an adopted figure. A wide dataset puts ` +
      `closed-year actuals in the columns next to the adopted budget; storing one as the ` +
      `other is what the basis axis exists to prevent. Figures that are neither — a proposal ` +
      `never adopted — do not belong in year_columns at all.`);
  }

  const bound = { ...cm };
  bound.amount_column = entry.amount_column;
  if (entry.actual_amount_column) bound.actual_amount_column = entry.actual_amount_column;
  else delete bound.actual_amount_column;
  if (entry.approved_amount_column) bound.approved_amount_column = entry.approved_amount_column;
  else delete bound.approved_amount_column;
  return { cm: bound, basis: entry.basis };
}

describe('edge function parity', () => {
  const cases = [
    [{ amount_column: 'total_budget' }, 2025],
    [WEHO_FY17_21, 2017],
    [WEHO_FY17_21, 2020],
    [{ ...WEHO_FY17_21, actual_amount_column: '_2019_actuals' }, 2018],
    [{ ...WEHO_FY17_21, approved_amount_column: 'x' }, 2019],
    [{ year_columns: { 2020: { amount_column: 'a', actual_amount_column: 'b', basis: 'adopted' } } }, 2020],
  ];

  it.each(cases)('agrees on mapping %# for FY%s', (cm, fy) => {
    expect(edgeResolveYearColumns(cm, fy)).toEqual(resolveYearColumns(cm, fy));
  });

  const throwing = [
    [WEHO_FY17_21, 2021],
    [{ year_columns: { 2020: { basis: 'adopted' } } }, 2020],
    [{ year_columns: { 2020: { amount_column: 'a' } } }, 2020],
    [{ year_columns: { 2020: { amount_column: 'a', basis: 'unknown' } } }, 2020],
  ];

  it.each(throwing)('agrees on the refusal for mapping %# FY%s', (cm, fy) => {
    let mine, theirs;
    try { resolveYearColumns(cm, fy, 'S'); } catch (e) { mine = e.message; }
    try { edgeResolveYearColumns(cm, fy, 'S'); } catch (e) { theirs = e.message; }
    expect(mine).toBeDefined();
    expect(theirs).toBe(mine);
  });
});
