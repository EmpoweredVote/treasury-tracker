import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixCalendarYearLocalGov.mjs: that file starts
// with a shebang, and tests/waSao + tests/nulByte forbid a test from importing
// any module that does.
import {
  CORRECT_MONTH, HARDCODED_MONTH, FAMILIES, IN_SCOPE_SOURCES, SWEEP_ROWS,
  EXEMPT_ENTITIES, exemptionFor, classify,
} from '../scripts/lib/calendarYearLocalGov.mjs';

const MN = 'Minnesota Office of the State Auditor City/County Finances Report';
const OH = 'Ohio Auditor of State Summarized Annual Financial Reports';

const row = (over = {}) => ({
  data_source: MN,
  entity: { name: 'Duluth', state: 'MN' },
  fiscal_year: 2023,
  fiscal_year_start_month: 7,
  ...over,
});

const ohRow = (over = {}) => row({
  data_source: OH,
  entity: { name: 'Columbus', state: 'OH' },
  ...over,
});

describe('calendar-year local government families', () => {
  it('targets January', () => {
    expect(CORRECT_MONTH).toBe(1);
    expect(HARDCODED_MONTH).toBe(7);
  });

  it('covers exactly the two statutory families', () => {
    expect(IN_SCOPE_SOURCES.size).toBe(2);
    expect(IN_SCOPE_SOURCES.has(MN)).toBe(true);
    expect(IN_SCOPE_SOURCES.has(OH)).toBe(true);
  });

  it('records the sweep baseline: 21,794 MN + 6,596 OH = 28,390', () => {
    expect(FAMILIES.find((f) => f.state === 'MN').rows).toBe(21794);
    expect(FAMILIES.find((f) => f.state === 'OH').rows).toBe(6596);
    expect(SWEEP_ROWS).toBe(28390);
  });

  it('cites an authority for every family — no family without evidence', () => {
    for (const f of FAMILIES) {
      expect(f.authority).toBeTruthy();
      expect(f.authority).toMatch(/§|December 31/);
    }
  });
});

// ⚠⚠ THE GUARD THIS SWEEP EXISTS TO SURVIVE. Ohio Rev. Code § 9.34 names the
// city of Cincinnati as an exception, and Cincinnati IS in our data with 20 rows
// whose 7 is CORRECT. A per-state constant would have corrupted them — the same
// shape as the original defect: uniform is not correct.
describe('the Cincinnati exception', () => {
  it('is registered, keyed on name AND state, with the statute cited', () => {
    const c = EXEMPT_ENTITIES.find((e) => e.name === 'Cincinnati');
    expect(c).toBeTruthy();
    expect(c.state).toBe('OH');
    expect(c.month).toBe(7);
    expect(c.why).toMatch(/9\.34/);
  });

  it('matches Cincinnati OH and nothing else', () => {
    expect(exemptionFor({ name: 'Cincinnati', state: 'OH' })).toBeTruthy();
    // Name alone must not exempt — a same-named entity in another state is not
    // what the Ohio statute names.
    expect(exemptionFor({ name: 'Cincinnati', state: 'IA' })).toBeNull();
    expect(exemptionFor({ name: 'Columbus', state: 'OH' })).toBeNull();
    expect(exemptionFor(null)).toBeNull();
  });

  it('ABORTS rather than sweep a Cincinnati row to 1', () => {
    const c = classify(ohRow({ entity: { name: 'Cincinnati', state: 'OH' } }));
    expect(c.error).toMatch(/exempt/i);
    expect(c.error).toMatch(/CORRECT/);
    expect(c.action).toBeUndefined();
  });

  it('still sweeps its Ohio neighbours', () => {
    expect(classify(ohRow({ entity: { name: 'Columbus', state: 'OH' } })))
      .toEqual({ action: 'update', month: 1 });
    expect(classify(ohRow({ entity: { name: 'Cleveland', state: 'OH' } })))
      .toEqual({ action: 'update', month: 1 });
  });
});

describe('classify', () => {
  it('updates a row still carrying the hardcoded 7', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 1 });
    expect(classify(ohRow())).toEqual({ action: 'update', month: 1 });
  });

  it('reports an already-corrected row as correct, so a re-run is a no-op', () => {
    expect(classify(row({ fiscal_year_start_month: 1 }))).toEqual({ action: 'correct' });
  });

  it('accepts a numeric string, as PostgREST may return for a bigint', () => {
    expect(classify(row({ fiscal_year_start_month: '7' }))).toEqual({ action: 'update', month: 1 });
  });

  // A row cannot be judged without knowing whose it is — the Ohio exception is
  // per-entity, so a missing entity must fail rather than default to sweeping.
  it('aborts when the row carries no entity', () => {
    expect(classify(row({ entity: null })).error).toMatch(/no entity/i);
    expect(classify(row({ entity: { name: 'Duluth' } })).error).toMatch(/no entity/i);
  });

  it('aborts when the entity state does not match its family', () => {
    expect(classify(row({ entity: { name: 'Columbus', state: 'OH' } })).error)
      .toMatch(/does not match the MN family/);
  });

  it('aborts on an unrecognised label rather than assuming the calendar', () => {
    expect(classify(row({ data_source: 'Virginia APA Comparative Report' })).error)
      .toMatch(/out-of-scope/i);
  });

  it('aborts on a stored month that is neither 7 nor 1', () => {
    expect(classify(row({ fiscal_year_start_month: 10 })).error).toMatch(/neither 7 nor 1/);
  });

  it('aborts on an unparseable month instead of coercing it', () => {
    expect(classify(row({ fiscal_year_start_month: null })).error).toMatch(/unparseable/i);
    expect(classify(row({ fiscal_year_start_month: '' })).error).toMatch(/unparseable/i);
    expect(classify(row({ fiscal_year_start_month: 'Jan' })).error).toMatch(/unparseable/i);
  });
});
