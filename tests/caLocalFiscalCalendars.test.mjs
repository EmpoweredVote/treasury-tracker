import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixCARemainingJanuaryRows.mjs: that file starts
// with a shebang, and tests/waSao + tests/nulByte forbid a test from importing any
// module that does.
import {
  CORRECT_MONTH, DEFAULT_MONTH, ALLOWED_MONTHS, ESTABLISHED, BASELINE,
  BUDGET_ROWS_BY_ENTITY, PROTECTED_SOURCES, PROTECTED_ENTITIES,
  establishedFor, protectedSourceFor, protectedEntityFor, classify, classifySource,
} from '../scripts/lib/caLocalFiscalCalendars.mjs';

const PUBLICPAY = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)';

const row = (over = {}) => ({
  data_source: 'Sacramento Operating Budget',
  entity: { name: 'Sacramento', state: 'CA', entity_type: 'city' },
  fiscal_year: 2025,
  total_budget: 100,
  fiscal_year_start_month: 1,
  ...over,
});

const src = (over = {}) => ({
  name: 'Sacramento Operating Budget',
  api_type: 'pdf_download',
  entity: { name: 'Sacramento', state: 'CA', entity_type: 'city' },
  fiscal_year_start_month: 1,
  ...over,
});

describe('the registry is a LIST, not a rule', () => {
  it('targets July, from January', () => {
    expect(DEFAULT_MONTH).toBe(1);
    expect(CORRECT_MONTH).toBe(7);
    expect([...ALLOWED_MONTHS].sort((a, b) => a - b)).toEqual([1, 4, 7, 9, 10]);
  });

  it('holds 14 individually established entities, each with an authority', () => {
    expect(ESTABLISHED).toHaveLength(14);
    for (const e of ESTABLISHED) {
      expect(e.state).toBe('CA');
      expect(e.authority.length).toBeGreaterThan(30);
    }
  });

  // The point of the file: CA binds a charter city to no fiscal year, and the two
  // charter cities examined before this pass were BOTH October.
  it('is mostly charter cities — any of which could have differed', () => {
    const charters = ESTABLISHED.filter((e) => e.charter === true);
    expect(charters.length).toBeGreaterThanOrEqual(12);
    expect(ESTABLISHED.filter((e) => e.charter === false).map((e) => e.name)).toEqual(['Fremont']);
  });

  it('cites a repo-local document where one exists', () => {
    const local = ESTABLISHED.filter((e) => e.authority.includes('docs/'));
    expect(local.map((e) => e.name).sort()).toEqual(
      ['Anaheim', 'Fremont', 'Fresno', 'Oakland', 'Riverside', 'San Jose', 'Santa Ana']);
  });

  it('records the measured baselines', () => {
    expect(BASELINE.budgetRows).toBe(89);
    expect(BASELINE.sourceRows).toBe(79);
    expect(BASELINE.budgetEntities).toBe(11);
    expect(BASELINE.sourceEntities).toBe(14);
    expect(Object.values(BUDGET_ROWS_BY_ENTITY).reduce((a, b) => a + b, 0)).toBe(89);
    expect(Object.keys(BUDGET_ROWS_BY_ENTITY)).toHaveLength(11);
  });

  // ⚠ (name, state), because this session name-only matching would have picked up
  // Long Beach NEW YORK and Berkley MICHIGAN.
  it('requires both name and state', () => {
    expect(establishedFor('Sacramento', 'CA')).toBeTruthy();
    expect(establishedFor('Berkeley', 'CA')).toBeTruthy();
    expect(establishedFor('Berkeley', 'MI')).toBeNull();
    expect(establishedFor('Berkley', 'MI')).toBeNull();
    expect(establishedFor('Oakland', 'FL')).toBeNull();
  });

  it('returns null for an unexamined CA city — absence is not evidence of July', () => {
    for (const n of ['Pasadena', 'Glendale', 'Torrance', 'Vernon']) {
      expect(establishedFor(n, 'CA')).toBeNull();
    }
  });
});

describe('what must NOT move', () => {
  it('protects publicpay by either phrasing', () => {
    expect(protectedSourceFor(PUBLICPAY).month).toBe(1);
    expect(protectedSourceFor('Government Compensation in California').month).toBe(1);
  });

  it('protects Empowered Vote at 1 and the two October cities at 10', () => {
    expect(protectedEntityFor('Empowered Vote', 'CA').month).toBe(1);
    expect(protectedEntityFor('Inglewood', 'CA').month).toBe(10);
    expect(protectedEntityFor('Long Beach', 'CA').month).toBe(10);
    expect(PROTECTED_ENTITIES).toHaveLength(3);
    expect(PROTECTED_SOURCES).toHaveLength(1);
  });

  // ⚠ THE CENTRAL GUARD. `1` is CORRECT for publicpay and for Empowered Vote, and
  // WRONG for the eleven cities. A sweep keyed on "CA rows at 1" destroys both.
  it('ABORTS when a publicpay row reaches the update set', () => {
    const c = classify(row({ data_source: PUBLICPAY }));
    expect(c.error).toMatch(/protected source reached the update set/);
  });

  it('ABORTS when an Empowered Vote row reaches the update set', () => {
    const c = classify(row({
      data_source: 'Empowered Vote Financial Records',
      entity: { name: 'Empowered Vote', state: 'CA', entity_type: 'nonprofit' },
    }));
    expect(c.error).toMatch(/protected entity reached the update set/);
    expect(c.error).toMatch(/its month is 1/);
  });

  it('ABORTS on the two October cities, so widening scope cannot swallow them', () => {
    for (const n of ['Inglewood', 'Long Beach']) {
      const c = classify(row({ entity: { name: n, state: 'CA', entity_type: 'city' } }));
      expect(c.error).toMatch(/protected entity reached the update set/);
      expect(c.error).toMatch(/its month is 10/);
    }
  });
});

describe('classify — budgets', () => {
  it('moves an established city from 1 to 7', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 7 });
  });

  it('leaves a row already at 7 alone', () => {
    expect(classify(row({ fiscal_year_start_month: 7 }))).toEqual({ action: 'correct' });
  });

  it('moves every one of the eleven budget-row cities', () => {
    for (const n of Object.keys(BUDGET_ROWS_BY_ENTITY)) {
      expect(classify(row({ entity: { name: n, state: 'CA', entity_type: 'city' } })))
        .toEqual({ action: 'update', month: 7 });
    }
  });

  it('ABORTS on an unestablished CA city rather than defaulting it to July', () => {
    const c = classify(row({ entity: { name: 'Pasadena', state: 'CA', entity_type: 'city' } }));
    expect(c.error).toMatch(/no established fiscal calendar/);
    expect(c.error).toMatch(/sets no municipal fiscal year by statute/);
  });

  it('ABORTS on an out-of-state entity', () => {
    expect(classify(row({ entity: { name: 'Sacramento', state: 'KY', entity_type: 'city' } })).error)
      .toMatch(/out-of-state/);
  });

  it('ABORTS on a month that is neither 1 nor 7', () => {
    expect(classify(row({ fiscal_year_start_month: 10 })).error).toMatch(/neither 1 nor 7/);
    expect(classify(row({ fiscal_year_start_month: 4 })).error).toMatch(/neither 1 nor 7/);
  });

  it('ABORTS on a missing entity', () => {
    expect(classify({ data_source: 'x', fiscal_year_start_month: 1 }).error).toMatch(/no entity/);
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
    expect(classify(row({ fiscal_year_start_month: 6.5 })).error).toMatch(/unparseable/);
    expect(classify(row({ fiscal_year_start_month: 'July' })).error).toMatch(/unparseable/);
  });
});

describe('classifySource — data_sources', () => {
  it('moves an established entity from 1 to 7', () => {
    expect(classifySource(src())).toEqual({ action: 'update', month: 7 });
  });

  // The four dormant seeds: source rows with no budget row at 1 behind them.
  it('covers the source-rows-only entities', () => {
    for (const n of ['Berkeley', 'California', 'Los Angeles']) {
      expect(establishedFor(n, 'CA').sourceRowsOnly).toBe(true);
      expect(classifySource(src({ entity: { name: n, state: 'CA', entity_type: 'city' } })))
        .toEqual({ action: 'update', month: 7 });
    }
  });

  it('leaves a source already at 7 alone', () => {
    expect(classifySource(src({ fiscal_year_start_month: 7 }))).toEqual({ action: 'correct' });
  });

  it('ABORTS on a protected source name or a protected entity', () => {
    expect(classifySource(src({ name: PUBLICPAY })).error).toMatch(/protected source/);
    expect(classifySource(src({ entity: { name: 'Long Beach', state: 'CA', entity_type: 'city' } })).error)
      .toMatch(/protected entity/);
  });

  it('ABORTS on an unestablished entity', () => {
    expect(classifySource(src({ entity: { name: 'Modesto', state: 'CA', entity_type: 'city' } })).error)
      .toMatch(/no established fiscal calendar/);
  });

  it('reports nullish as unparseable, not as month 0', () => {
    for (const v of [null, undefined, '']) {
      const c = classifySource(src({ fiscal_year_start_month: v }));
      expect(c.error).toMatch(/unparseable/);
      expect(c.error).not.toMatch(/month 0/);
    }
  });
});
