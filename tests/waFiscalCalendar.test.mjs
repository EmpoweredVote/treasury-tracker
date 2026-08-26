import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/verifyWAFiscalYearStartMonth.mjs: that file
// starts with a shebang, and tests/waSao + tests/nulByte forbid a test from
// importing any module that does.
import {
  LOCAL_MONTH, STATE_MONTH, SCHOOL_DISTRICT_MONTH, ALLOWED_MONTHS, AUTHORITY,
  ENTITY_TYPE_MONTHS, BASELINE, LOCAL_ROWS_BY_ENTITY,
  monthForWAEntity, classify,
} from '../scripts/lib/waFiscalCalendar.mjs';

const row = (over = {}) => ({
  data_source: 'WA State Auditor — Seattle Annual Financial Report FY2024 (General Fund, Operating)',
  entity: { name: 'Seattle', state: 'WA', entity_type: 'city' },
  fiscal_year: 2024,
  fiscal_year_start_month: 1,
  ...over,
});

describe('Washington has THREE fiscal calendars, not one', () => {
  it('puts local government on January, the state on July, school districts on September', () => {
    expect(LOCAL_MONTH).toBe(1);
    expect(STATE_MONTH).toBe(7);
    expect(SCHOOL_DISTRICT_MONTH).toBe(9);
    expect([...ALLOWED_MONTHS].sort((a, b) => a - b)).toEqual([1, 7, 9]);
  });

  it('cites the RCW for each of the three, and for the biennial case', () => {
    expect(AUTHORITY.local).toMatch(/1\.16\.030/);
    expect(AUTHORITY.local).toMatch(/84\.04\.120/);
    expect(AUTHORITY.state).toMatch(/1\.16\.020/);
    expect(AUTHORITY.schoolDistrict).toMatch(/August 31/);
    expect(AUTHORITY.biennial).toMatch(/1\.16\.020/);
  });

  it('records that nothing in this population needs changing', () => {
    expect(BASELINE.localRows).toBe(336);
    expect(BASELINE.stateRows).toBe(12);
    expect(BASELINE.schoolDistrictRows).toBe(0);
    // waSaoLoad.mjs creates its data_sources row ephemerally and deletes it.
    expect(BASELINE.dataSourceRows).toBe(0);
    expect(Object.values(LOCAL_ROWS_BY_ENTITY).reduce((a, b) => a + b, 0)).toBe(336);
    expect(Object.keys(LOCAL_ROWS_BY_ENTITY)).toHaveLength(10);
  });
});

describe('monthForWAEntity', () => {
  it('resolves the established entity types', () => {
    expect(monthForWAEntity({ name: 'Seattle', state: 'WA', entity_type: 'city' })).toBe(1);
    expect(monthForWAEntity({ name: 'King County', state: 'WA', entity_type: 'county' })).toBe(1);
    expect(monthForWAEntity({ name: 'Washington', state: 'WA', entity_type: 'state' })).toBe(7);
    expect(monthForWAEntity({ name: 'X SD', state: 'WA', entity_type: 'school_district' })).toBe(9);
  });

  it('agrees with the exported table', () => {
    for (const [type, month] of Object.entries(ENTITY_TYPE_MONTHS)) {
      expect(monthForWAEntity({ name: 'x', state: 'WA', entity_type: type })).toBe(month);
    }
  });

  // ⚠ A silent fallback is the entire subject of this arc.
  it('THROWS on an unestablished entity type rather than defaulting', () => {
    expect(() => monthForWAEntity({ name: 'X', state: 'WA', entity_type: 'port_district' }))
      .toThrow(/no established Washington fiscal calendar/);
    expect(() => monthForWAEntity({ name: 'X', state: 'WA', entity_type: 'nonprofit' }))
      .toThrow(/no established/);
  });

  it('THROWS on a missing entity type and on a non-WA entity', () => {
    expect(() => monthForWAEntity({ name: 'X', state: 'WA' })).toThrow(/entity_type. is required/);
    expect(() => monthForWAEntity(null)).toThrow(/is required/);
    expect(() => monthForWAEntity({ name: 'Seattle', state: 'OR', entity_type: 'city' }))
      .toThrow(/not a Washington entity/);
  });
});

describe('classify — a verifier, not a sweep', () => {
  it('reports every real Washington row as already correct', () => {
    expect(classify(row())).toEqual({ action: 'correct' });
    expect(classify(row({
      entity: { name: 'Kitsap County', state: 'WA', entity_type: 'county' },
    }))).toEqual({ action: 'correct' });
    expect(classify(row({
      entity: { name: 'Washington', state: 'WA', entity_type: 'state' },
      fiscal_year_start_month: 7,
    }))).toEqual({ action: 'correct' });
  });

  // ⚠ THE TRAP THIS FILE EXISTS FOR. RCW 84.04.120 makes THE STATE a taxing
  // district too, so a naive reading of "December 31st of all other taxing
  // districts" would put the state on January and call its correct 7 wrong.
  it('does NOT treat the state as a January taxing district', () => {
    const c = classify(row({
      entity: { name: 'Washington', state: 'WA', entity_type: 'state' },
      fiscal_year_start_month: 1,
    }));
    expect(c.action).toBe('update');
    expect(c.month).toBe(7);   // the statute says July, so a stored 1 is the drift
  });

  it('flags a local row that has drifted off January', () => {
    const c = classify(row({ fiscal_year_start_month: 7 }));
    expect(c.action).toBe('update');
    expect(c.month).toBe(1);
    expect(c.stored).toBe(7);
  });

  // The statutory exception. A school district swept to January would be wrong by
  // four months, and nothing arithmetic would notice.
  it('expects September for a school district, never January', () => {
    const c = classify(row({
      entity: { name: 'Seattle SD', state: 'WA', entity_type: 'school_district' },
      fiscal_year_start_month: 1,
    }));
    expect(c.action).toBe('update');
    expect(c.month).toBe(9);
  });

  it('errors on an unestablished entity type instead of guessing', () => {
    expect(classify(row({
      entity: { name: 'Port of Seattle', state: 'WA', entity_type: 'port_district' },
    })).error).toMatch(/no established Washington fiscal calendar/);
  });

  it('errors on an out-of-state entity and a missing entity', () => {
    expect(classify(row({ entity: { name: 'Portland', state: 'OR', entity_type: 'city' } })).error)
      .toMatch(/out-of-state/);
    expect(classify({ fiscal_year_start_month: 1 }).error).toMatch(/no entity/);
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
    expect(classify(row({ fiscal_year_start_month: 1.5 })).error).toMatch(/unparseable/);
    expect(classify(row({ fiscal_year_start_month: 'Jan' })).error).toMatch(/unparseable/);
  });
});
