import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixTXOctoberFiscalYear.mjs: that file starts
// with a shebang, and tests/waSao + tests/nulByte forbid a test from importing any
// module that does.
import {
  CORRECT_MONTH, DEFAULT_MONTH, ALLOWED_MONTHS, ESTABLISHED, PROTECTED_ENTITIES,
  BASELINE, BUDGET_ROWS_BY_ENTITY, SOURCE_ROWS_BY_ENTITY,
  establishedFor, protectedEntityFor, classify, classifySource,
} from '../scripts/lib/txLocalFiscalCalendars.mjs';

const row = (over = {}) => ({
  data_source: 'Plano Operating Budget',
  entity: { name: 'Plano', state: 'TX', entity_type: 'municipality' },
  fiscal_year: 2025,
  total_budget: 100,
  fiscal_year_start_month: 1,
  ...over,
});

const src = (over = {}) => ({
  name: 'Plano Operating Budget',
  api_type: 'pdf_download',
  entity: { name: 'Plano', state: 'TX', entity_type: 'municipality' },
  fiscal_year_start_month: 1,
  ...over,
});

describe('Texas targets OCTOBER, not July', () => {
  // ⚠ THE POINT OF THIS FILE. MA was 1->7 and CA was 1->7. Texas is 1->10, and
  // getting it wrong would have been silent: the column moves no dollar.
  it('sweeps January to October', () => {
    expect(DEFAULT_MONTH).toBe(1);
    expect(CORRECT_MONTH).toBe(10);
    expect(CORRECT_MONTH).not.toBe(7);
  });

  it('admits 9, because the State of Texas itself begins September 1', () => {
    expect(ALLOWED_MONTHS.has(9)).toBe(true);
    expect(protectedEntityFor('Texas', 'TX').month).toBe(9);
  });

  it('holds 14 individually established municipalities, each with an authority', () => {
    expect(ESTABLISHED).toHaveLength(14);
    for (const e of ESTABLISHED) {
      expect(e.state).toBe('TX');
      expect(e.authority.length).toBeGreaterThan(30);
      // Each authority must actually name October or a September 30 year end.
      expect(e.authority).toMatch(/October|SEPTEMBER 30|September 30/);
    }
  });

  it('records the measured baselines', () => {
    expect(BASELINE.budgetRows).toBe(71);
    expect(BASELINE.sourceRows).toBe(74);
    expect(Object.values(BUDGET_ROWS_BY_ENTITY).reduce((a, b) => a + b, 0)).toBe(71);
    expect(Object.values(SOURCE_ROWS_BY_ENTITY).reduce((a, b) => a + b, 0)).toBe(74);
    expect(Object.keys(BUDGET_ROWS_BY_ENTITY)).toHaveLength(14);
    expect(Object.keys(SOURCE_ROWS_BY_ENTITY)).toHaveLength(14);
  });

  it('cites the two repo-local documents', () => {
    const local = ESTABLISHED.filter((e) => e.authority.includes('docs/'));
    expect(local.map((e) => e.name).sort()).toEqual(['Plano', 'Richardson']);
  });

  it('requires both name and state', () => {
    expect(establishedFor('Plano', 'TX')).toBeTruthy();
    expect(establishedFor('Plano', 'IL')).toBeNull();
    expect(establishedFor('Richardson', 'TX')).toBeTruthy();
  });

  it('returns null for an unexamined TX city — absence is not evidence', () => {
    for (const n of ['Houston', 'Fort Worth', 'San Antonio', 'El Paso']) {
      expect(establishedFor(n, 'TX')).toBeNull();
    }
  });
});

describe('the three protected entities', () => {
  it('protects the State of Texas at 9, Austin and Travis County at 10', () => {
    expect(PROTECTED_ENTITIES).toHaveLength(3);
    expect(protectedEntityFor('Texas', 'TX').month).toBe(9);
    expect(protectedEntityFor('Austin', 'TX').month).toBe(10);
    expect(protectedEntityFor('Travis County', 'TX').month).toBe(10);
  });

  // ⚠ THE CENTRAL GUARD. A sweep scoped to "TX rows" rather than to named
  // entities would have moved the state's 20 correct September rows to October.
  it('ABORTS when a State of Texas row reaches the update set', () => {
    const c = classify(row({ entity: { name: 'Texas', state: 'TX', entity_type: 'state' } }));
    expect(c.error).toMatch(/protected entity reached the update set/);
    expect(c.error).toMatch(/its month is 9/);
    expect(c.error).toMatch(/September 1/);
  });

  it('ABORTS on Austin and Travis County, so a widened scope cannot re-stamp them', () => {
    for (const n of ['Austin', 'Travis County']) {
      expect(classify(row({ entity: { name: n, state: 'TX', entity_type: 'city' } })).error)
        .toMatch(/protected entity reached the update set/);
    }
  });

  it('protects them on the data_sources side too', () => {
    expect(classifySource(src({ entity: { name: 'Texas', state: 'TX', entity_type: 'state' } })).error)
      .toMatch(/protected entity/);
  });
});

describe('classify — budgets', () => {
  it('moves an established municipality from 1 to 10', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 10 });
  });

  it('leaves a row already at 10 alone', () => {
    expect(classify(row({ fiscal_year_start_month: 10 }))).toEqual({ action: 'correct' });
  });

  it('moves all fourteen municipalities', () => {
    for (const n of Object.keys(BUDGET_ROWS_BY_ENTITY)) {
      expect(classify(row({ entity: { name: n, state: 'TX', entity_type: 'municipality' } })))
        .toEqual({ action: 'update', month: 10 });
    }
  });

  // 7 is the value the previous two sweeps in this arc targeted. In Texas it is
  // an unexplained value and must abort rather than be treated as the old default.
  it('ABORTS on a row at 7 — the value the MA and CA sweeps wrote', () => {
    const c = classify(row({ fiscal_year_start_month: 7 }));
    expect(c.error).toMatch(/stored month 7 is neither 1 nor 10/);
  });

  it('ABORTS on an unestablished TX city, citing the statute', () => {
    const c = classify(row({ entity: { name: 'Houston', state: 'TX', entity_type: 'municipality' } }));
    expect(c.error).toMatch(/no established fiscal calendar/);
    expect(c.error).toMatch(/101\.042/);
  });

  it('ABORTS on an out-of-state entity', () => {
    expect(classify(row({ entity: { name: 'Plano', state: 'IL', entity_type: 'city' } })).error)
      .toMatch(/out-of-state/);
  });

  it('ABORTS on a missing entity', () => {
    expect(classify({ data_source: 'x', fiscal_year_start_month: 1 }).error).toMatch(/no entity/);
  });

  // ⚠ Number(null) and Number('') are both 0 — an integer that would sail past an
  // isInteger check and be reported as "stored month 0".
  it('reports nullish as unparseable, not as month 0', () => {
    for (const v of [null, undefined, '']) {
      const c = classify(row({ fiscal_year_start_month: v }));
      expect(c.error).toMatch(/unparseable/);
      expect(c.error).not.toMatch(/month 0/);
    }
  });

  it('rejects a non-integer month', () => {
    expect(classify(row({ fiscal_year_start_month: 9.5 })).error).toMatch(/unparseable/);
    expect(classify(row({ fiscal_year_start_month: 'Oct' })).error).toMatch(/unparseable/);
  });
});

describe('classifySource — data_sources', () => {
  it('moves an established municipality from 1 to 10', () => {
    expect(classifySource(src())).toEqual({ action: 'update', month: 10 });
  });

  it('leaves a source already at 10 alone', () => {
    expect(classifySource(src({ fiscal_year_start_month: 10 }))).toEqual({ action: 'correct' });
  });

  it('covers every municipality with source rows', () => {
    for (const n of Object.keys(SOURCE_ROWS_BY_ENTITY)) {
      expect(classifySource(src({ entity: { name: n, state: 'TX', entity_type: 'municipality' } })))
        .toEqual({ action: 'update', month: 10 });
    }
  });

  it('ABORTS on an unestablished entity', () => {
    expect(classifySource(src({ entity: { name: 'Katy', state: 'TX', entity_type: 'municipality' } })).error)
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
