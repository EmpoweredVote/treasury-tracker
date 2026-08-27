import { describe, it, expect } from 'vitest';
import { buildSocrataWhere, buildSocrataFilters, skipFyFilterMultiYearProblem }
  from '../scripts/lib/socrataFilter.mjs';

/**
 * Port of buildFyFilter() as it ships in supabase/functions/treasury-sync/index.ts.
 * The edge function is Deno TS and calls Deno.serve() at import time, so it cannot
 * be imported here. This mirror exists so the two implementations cannot drift —
 * drift is what made San Francisco unsyncable by cron for months while the repo
 * loader handled it fine.
 */
function edgeBuildFyFilter(cm, fy, defaultFilters) {
  const filters = { ...(defaultFilters || {}) };
  const parts = [];
  if (filters.$where) parts.push(String(filters.$where).trim());
  const skipFy = cm.skip_fy_filter === true || cm.skip_fy_filter === 'true';
  if (!skipFy) {
    const fyCol = cm.fiscal_year_column || 'fiscal_year';
    const isDateField = typeof cm.note === 'string' && cm.note.includes('date field');
    if (isDateField) parts.push(`date_extract_y(${fyCol})=${fy}`);
    else if (cm.fiscal_year_type === 'integer') parts.push(`${fyCol}=${fy}`);
    else parts.push(`${fyCol}='${fy}'`);
  }
  if (cm.where_extra) {
    parts.push(parts.length === 0
      ? String(cm.where_extra).replace(/^\s*(AND|OR)\s+/i, '').trim()
      : String(cm.where_extra).trim());
  }
  if (parts.length === 0) { delete filters.$where; return filters; }
  filters.$where = parts.reduce((acc, p) =>
    !acc ? p : (/^\s*(AND|OR)\s+/i.test(p) ? `${acc} ${p}` : `${acc} AND ${p}`), '');
  return filters;
}

describe('buildSocrataWhere', () => {
  it('quotes a string fiscal year by default', () => {
    expect(buildSocrataWhere({ fiscal_year_column: 'bfy' }, 2025)).toBe("bfy='2025'");
  });

  it('defaults the column name to fiscal_year', () => {
    expect(buildSocrataWhere({}, 2025)).toBe("fiscal_year='2025'");
  });

  it('leaves an integer fiscal year unquoted', () => {
    expect(buildSocrataWhere({ fiscal_year_type: 'integer' }, 2025)).toBe('fiscal_year=2025');
  });

  it('uses date_extract_y when the note says the column is a date field', () => {
    expect(buildSocrataWhere({ fiscal_year_column: 'paid_on', note: 'this is a date field' }, 2025))
      .toBe('date_extract_y(paid_on)=2025');
  });

  it('emits no year predicate when skip_fy_filter is set', () => {
    expect(buildSocrataWhere({ skip_fy_filter: true }, 2025)).toBeNull();
    expect(buildSocrataWhere({ skip_fy_filter: 'true' }, 2025)).toBeNull();
  });

  // ── The San Francisco case: one dataset holding both directions ──
  it('appends where_extra after the year predicate', () => {
    const cm = { fiscal_year_column: 'fiscal_year', where_extra: "AND revenue_or_spending='Spending'" };
    expect(buildSocrataWhere(cm, 2025))
      .toBe("fiscal_year='2025' AND revenue_or_spending='Spending'");
  });

  it('strips the leading AND when where_extra is the only predicate', () => {
    const cm = { skip_fy_filter: true, where_extra: "AND revenue_or_spending='Revenue'" };
    expect(buildSocrataWhere(cm, 2025)).toBe("revenue_or_spending='Revenue'");
  });

  it('ANDs default_filters.$where in front', () => {
    const cm = { fiscal_year_column: 'bfy', where_extra: 'AND amount > 0' };
    expect(buildSocrataWhere(cm, 2026, { $where: "fund='General'" }))
      .toBe("fund='General' AND bfy='2026' AND amount > 0");
  });

  it('reproduces the LA Operating clause', () => {
    expect(buildSocrataWhere({ where_extra: 'AND adopted_budget_amount > 0' }, 2025))
      .toBe("fiscal_year='2025' AND adopted_budget_amount > 0");
  });
});

describe('buildSocrataFilters', () => {
  it('returns a filters object carrying $where', () => {
    expect(buildSocrataFilters({ fiscal_year_column: 'bfy' }, 2025)).toEqual({ $where: "bfy='2025'" });
  });

  it('drops $where entirely when no predicate applies', () => {
    expect(buildSocrataFilters({ skip_fy_filter: true }, 2025)).toEqual({});
  });

  it('does not mutate the caller default_filters', () => {
    const df = { $limit: 10 };
    buildSocrataFilters({}, 2025, df);
    expect(df).toEqual({ $limit: 10 });
  });
});

describe('the edge function copy agrees with the shared module', () => {
  const CASES = [
    [{ fiscal_year_column: 'bfy' }, 2025, {}],
    [{}, 2025, {}],
    [{ fiscal_year_type: 'integer' }, 2025, {}],
    [{ fiscal_year_column: 'paid_on', note: 'a date field here' }, 2025, {}],
    [{ skip_fy_filter: true }, 2025, {}],
    [{ where_extra: "AND revenue_or_spending='Spending'" }, 2025, {}],
    [{ skip_fy_filter: 'true', where_extra: "AND revenue_or_spending='Revenue'" }, 2025, {}],
    [{ fiscal_year_column: 'bfy', where_extra: 'AND amount > 0' }, 2026, { $where: "fund='General'" }],
    [{ where_extra: 'AND adopted_budget_amount > 0' }, 2025, {}],
  ];

  it.each(CASES)('case %#', (cm, fy, df) => {
    expect(edgeBuildFyFilter(cm, fy, df)).toEqual(buildSocrataFilters(cm, fy, df));
  });
});

describe('skipFyFilterMultiYearProblem', () => {
  it('is silent for a single year', () => {
    expect(skipFyFilterMultiYearProblem({ skip_fy_filter: true }, [2018])).toBeNull();
  });

  it('is silent when the dataset does have a year column', () => {
    expect(skipFyFilterMultiYearProblem({}, [2017, 2018])).toBeNull();
  });

  // West Hollywood Budget Expenditure Detail FY15-18.
  it('refuses skip_fy_filter across multiple years, naming the amount column', () => {
    const msg = skipFyFilterMultiYearProblem(
      { skip_fy_filter: 'true', amount_column: '_2018_actuals' }, [2017, 2018]);
    expect(msg).toContain('2 fiscal years');
    expect(msg).toContain('_2018_actuals');
    expect(msg).toContain('one explicit fiscal year');
  });
});
