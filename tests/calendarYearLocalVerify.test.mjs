import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/verifyCalendarYearLocals.mjs: that file starts
// with a shebang, and tests/waSao + tests/nulByte forbid a test from importing any
// module that does.
import {
  LOCAL_MONTH, STATE_MONTH, ALLOWED_MONTHS, STATES, VERIFIABLE_STATES,
  ENTITY_AUTHORITIES, KNOWN_CARVE_OUTS,
  monthFor, classify, entityAuthorityFor,
} from '../scripts/lib/calendarYearLocalVerify.mjs';

const inRow = (over = {}) => ({
  data_source: 'Indiana Gateway — Bloomington',
  entity: { name: 'Bloomington', state: 'IN', entity_type: 'city' },
  fiscal_year: 2025,
  fiscal_year_start_month: 1,
  ...over,
});

const coRow = (over = {}) => ({
  data_source: 'Colorado Springs ACFR',
  entity: { name: 'Colorado Springs', state: 'CO', entity_type: 'city' },
  fiscal_year: 2023,
  fiscal_year_start_month: 1,
  ...over,
});

describe('scope and baselines', () => {
  it('covers Indiana and Colorado, locals on January and the states on July', () => {
    expect(VERIFIABLE_STATES.sort()).toEqual(['CO', 'IN']);
    expect(LOCAL_MONTH).toBe(1);
    expect(STATE_MONTH).toBe(7);
  });

  // 10 is in the set because Colorado's water conservancy districts with federal
  // contracts may use the FEDERAL fiscal year, which starts in October.
  it('admits 10 for the Colorado federal-contract carve-out', () => {
    expect(ALLOWED_MONTHS.has(10)).toBe(true);
    const wc = KNOWN_CARVE_OUTS.find((c) => c.entityDescription.includes('water conservancy'));
    expect(wc.month).toBe(10);
    expect(wc.state).toBe('CO');
  });

  it('records that nothing in either population needs changing', () => {
    // ⚠ Indiana re-measured 2026-09-05: 86 + 78 (PR #113's AFR entities, never
    // absorbed here) - 45 (migration 20260905000100's legacy deletion) = 119.
    // Colorado's 64 is ALSO stale against the live database (measured 88) but is
    // someone else's population change and is deliberately left alone here.
    expect(STATES.IN.baseline).toMatchObject({ localRows: 119, stateRows: 48, sourceRows: 11 });
    expect(STATES.CO.baseline).toMatchObject({ localRows: 64, stateRows: 6, sourceRows: 0 });
    expect(Object.values(STATES.IN.localRowsByEntity).reduce((a, b) => a + b, 0)).toBe(119);
    expect(Object.values(STATES.CO.localRowsByEntity).reduce((a, b) => a + b, 0)).toBe(64);
  });

  it('labels Indiana\'s authority as agency guidance, not a statute it does not have', () => {
    expect(STATES.IN.authority.local).toMatch(/DLGF/);
    expect(STATES.IN.authority.local).toMatch(/calendar year/);
    // The DLGF scope list is what makes it cover townships, schools and libraries.
    expect(STATES.IN.authority.local).toMatch(/townships/);
    expect(STATES.IN.authority.local).toMatch(/libraries/);
    expect(STATES.IN.authority.localSecondary).toMatch(/SBOA/);
  });

  it('cites the Colorado statute verbatim, including its exception', () => {
    expect(STATES.CO.authority.local).toMatch(/29-1-102/);
    expect(STATES.CO.authority.local).toMatch(/commencing January 1 and ending December 31/);
    expect(STATES.CO.authority.local).toMatch(/water conservancy districts/);
  });
});

describe('⚠ the Colorado statute does not reach Colorado Springs', () => {
  // THE MOST IMPORTANT CASE IN THIS FILE. C.R.S. 29-1-102 excludes HOME RULE
  // CITIES from "local government", and Colorado Springs is one — so citing the
  // statute for it would be right by the wrong route.
  it('records that the statute does NOT reach the home-rule city', () => {
    const cs = entityAuthorityFor('Colorado Springs', 'CO');
    expect(cs.statuteReaches).toBe(false);
    expect(cs.why).toMatch(/HOME RULE/);
    expect(cs.why).toMatch(/EXCLUDES/);
    expect(cs.authority).toMatch(/December 31, 2023/);
    expect(cs.authority).toMatch(/docs\/ColoradoSprings/);
  });

  it('records that the statute DOES reach the county, with its ACFR as corroboration', () => {
    const ep = entityAuthorityFor('El Paso County', 'CO');
    expect(ep.statuteReaches).toBe(true);
    expect(ep.authority).toMatch(/December 31, 2023/);
  });

  it('keys per-entity authorities on (name, state)', () => {
    expect(entityAuthorityFor('Colorado Springs', 'IN')).toBeNull();
    expect(Object.keys(ENTITY_AUTHORITIES).every((k) => k.includes('|'))).toBe(true);
  });
});

describe('monthFor', () => {
  it('resolves every established Indiana entity type, including township, school and library', () => {
    for (const t of ['city', 'county', 'township', 'school_district', 'library']) {
      expect(monthFor({ name: 'x', state: 'IN', entity_type: t })).toBe(1);
    }
    expect(monthFor({ name: 'Indiana', state: 'IN', entity_type: 'state' })).toBe(7);
  });

  it('resolves Colorado\'s types', () => {
    expect(monthFor({ name: 'Colorado Springs', state: 'CO', entity_type: 'city' })).toBe(1);
    expect(monthFor({ name: 'El Paso County', state: 'CO', entity_type: 'county' })).toBe(1);
    expect(monthFor({ name: 'Colorado', state: 'CO', entity_type: 'state' })).toBe(7);
  });

  // ⚠ Colorado school districts are EXCLUDED from the statutory definition, so
  // unlike Indiana's they are NOT established. The resolver must refuse.
  it('THROWS for a Colorado school district — excluded from the statute', () => {
    expect(() => monthFor({ name: 'X', state: 'CO', entity_type: 'school_district' }))
      .toThrow(/no established CO fiscal calendar/);
  });

  it('THROWS on an unestablished type and on an out-of-scope state', () => {
    expect(() => monthFor({ name: 'X', state: 'IN', entity_type: 'port_authority' }))
      .toThrow(/no established IN fiscal calendar/);
    expect(() => monthFor({ name: 'X', state: 'OH', entity_type: 'city' }))
      .toThrow(/not a state this module verifies/);
    expect(() => monthFor(null)).toThrow(/is required/);
  });
});

describe('classify — a verifier, not a sweep', () => {
  it('reports real Indiana and Colorado rows as already correct', () => {
    expect(classify(inRow())).toEqual({ action: 'correct' });
    expect(classify(coRow())).toEqual({ action: 'correct' });
    expect(classify(inRow({
      entity: { name: 'Bean Blossom Township', state: 'IN', entity_type: 'township' },
    }))).toEqual({ action: 'correct' });
    expect(classify(inRow({
      entity: { name: 'Indiana', state: 'IN', entity_type: 'state' },
      fiscal_year_start_month: 7,
    }))).toEqual({ action: 'correct' });
  });

  it('flags a local row that has drifted off January', () => {
    const c = classify(inRow({ fiscal_year_start_month: 7 }));
    expect(c.action).toBe('update');
    expect(c.month).toBe(1);
    expect(c.stored).toBe(7);
  });

  // The state node must not be dragged onto the local calendar.
  it('flags a state row stored at 1 as drift, expecting 7', () => {
    const c = classify(coRow({
      entity: { name: 'Colorado', state: 'CO', entity_type: 'state' },
      fiscal_year_start_month: 1,
    }));
    expect(c.action).toBe('update');
    expect(c.month).toBe(7);
  });

  it('errors on a Colorado school district rather than assuming January', () => {
    expect(classify(coRow({
      entity: { name: 'X SD', state: 'CO', entity_type: 'school_district' },
    })).error).toMatch(/no established CO fiscal calendar/);
  });

  it('errors on an out-of-scope state and a missing entity', () => {
    expect(classify(inRow({ entity: { name: 'Duluth', state: 'MN', entity_type: 'city' } })).error)
      .toMatch(/out-of-scope state/);
    expect(classify({ fiscal_year_start_month: 1 }).error).toMatch(/no entity/);
  });

  // ⚠ Number(null) and Number('') are both 0 — an integer that would sail past an
  // isInteger check and be reported as "stored month 0", blaming a value the
  // column never held.
  it('reports nullish as unparseable, not as month 0', () => {
    for (const v of [null, undefined, '']) {
      const c = classify(inRow({ fiscal_year_start_month: v }));
      expect(c.error).toMatch(/unparseable/);
      expect(c.error).not.toMatch(/month 0/);
    }
  });

  it('rejects a non-integer month', () => {
    expect(classify(inRow({ fiscal_year_start_month: 1.5 })).error).toMatch(/unparseable/);
    expect(classify(inRow({ fiscal_year_start_month: 'Jan' })).error).toMatch(/unparseable/);
  });
});
