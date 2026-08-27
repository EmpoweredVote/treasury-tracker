import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixMAFiscalYearStartMonth.mjs: that file starts
// with a shebang, and tests/waSao + tests/nulByte forbid a test from importing
// any module that does.
import {
  CORRECT_MONTH, DEFAULT_MONTH, ALLOWED_MONTHS, IN_SCOPE_ENTITY_TYPES,
  FAMILIES, SOURCE_FAMILIES, SWEEP_ROWS, SWEEP_SOURCE_ROWS, IN_SCOPE_API_TYPES,
  familyFor, classify, classifySource,
} from '../scripts/lib/maFiscalCalendar.mjs';

const EXP = 'Abington — MA General Fund Expenditures';
const REV = 'Abington — MA General Fund Revenues';
const RBS = 'Abington — MA DLS General Fund Revenue by Source';
const CAM = 'cambridge-open-data';
const CTY = 'Barnstable County Operating Budget FY2025';

const row = (over = {}) => ({
  data_source: EXP,
  entity: { name: 'Abington', state: 'MA', entity_type: 'city' },
  fiscal_year: 2023,
  total_budget: 1234,
  fiscal_year_start_month: 1,
  ...over,
});

const src = (over = {}) => ({
  name: 'Abington — MA General Fund Expenditures',
  api_type: 'ma-dls-excel',
  entity: { name: 'Abington', state: 'MA', entity_type: 'city' },
  fiscal_year_start_month: 1,
  ...over,
});

describe('Massachusetts fiscal calendar — direction and scope', () => {
  it('sweeps January to July, the opposite direction from the MN/OH sweep', () => {
    expect(DEFAULT_MONTH).toBe(1);
    expect(CORRECT_MONTH).toBe(7);
  });

  it('admits only 1 and 7 — MA has no charter exception to accommodate', () => {
    expect([...ALLOWED_MONTHS].sort()).toEqual([1, 7]);
  });

  it('scopes to localities, never the Commonwealth', () => {
    expect([...IN_SCOPE_ENTITY_TYPES].sort()).toEqual(['city', 'county']);
    expect(IN_SCOPE_ENTITY_TYPES.has('state')).toBe(false);
  });

  it('records the budgets baseline: 8,408 + 6,663 + 1,755 + 8 + 5 = 16,839', () => {
    expect(FAMILIES.map((f) => f.rows)).toEqual([8408, 6663, 1755, 8, 5]);
    expect(SWEEP_ROWS).toBe(16839);
  });

  it('records the data_sources baseline: 702 + 702 + 5 = 1,409', () => {
    expect(SOURCE_FAMILIES.map((f) => f.rows)).toEqual([702, 702, 5]);
    expect(SWEEP_SOURCE_ROWS).toBe(1409);
    expect([...IN_SCOPE_API_TYPES].sort()).toEqual(['ma-dls', 'ma-dls-excel', 'pdf_download']);
  });

  it('cites a statute for every family', () => {
    for (const f of FAMILIES) expect(f.authority).toMatch(/Mass\. Gen\. Laws|Cambridge/);
  });
});

describe('family matching', () => {
  it('matches each of the five families', () => {
    expect(familyFor(EXP).key).toBe('ma-dls-gf-exp');
    expect(familyFor(REV).key).toBe('ma-dls-gf-rev');
    expect(familyFor(RBS).key).toBe('ma-dls-gf-rev-by-source');
    expect(familyFor(CAM).key).toBe('cambridge-open-data');
    expect(familyFor(CTY).key).toBe('ma-county-budget-doc');
  });

  it('matches the DLS families for every city name, not just Abington', () => {
    for (const n of ['Boston', 'Cambridge', 'West Bridgewater', "Manchester-by-the-Sea"]) {
      expect(familyFor(`${n} — MA General Fund Expenditures`).key).toBe('ma-dls-gf-exp');
    }
  });

  // The three DLS suffixes are close cousins. "Revenues" vs "Revenue by Source"
  // is the pair that would silently cross-match under a `contains` test, which is
  // why the library anchors with endsWith.
  it('never lets one label match two families', () => {
    for (const s of [EXP, REV, RBS, CAM, CTY]) {
      const f = familyFor(s);
      expect(f.ambiguous).toBeUndefined();
    }
  });

  it('is anchored — a label that merely CONTAINS the phrase does not match', () => {
    expect(familyFor('Abington — MA General Fund Expenditures (restated)')).toBeNull();
    expect(familyFor('Notes on — MA General Fund Revenues and other funds')).toBeNull();
  });

  it('rejects a foreign label outright rather than defaulting it', () => {
    expect(familyFor('Minnesota Office of the State Auditor City/County Finances Report')).toBeNull();
    expect(familyFor('CA State Controller - Expenditures')).toBeNull();
    expect(familyFor('')).toBeNull();
    expect(familyFor(null)).toBeNull();
  });

  it('requires a four-digit FY on a county budget label', () => {
    expect(familyFor('Barnstable County Operating Budget FY25')).toBeNull();
    expect(familyFor('Barnstable County Operating Budget')).toBeNull();
  });
});

describe('classify — budgets', () => {
  it('updates a January DLS row to July', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 7 });
  });

  it('leaves a row already at July alone', () => {
    expect(classify(row({ fiscal_year_start_month: 7 }))).toEqual({ action: 'correct' });
  });

  it('sweeps all five families', () => {
    for (const [s, e] of [[EXP, 'city'], [REV, 'city'], [RBS, 'city'], [CAM, 'city'], [CTY, 'county']]) {
      expect(classify(row({
        data_source: s,
        entity: { name: 'X', state: 'MA', entity_type: e },
      }))).toEqual({ action: 'update', month: 7 });
    }
  });

  // Guard (d): the failure mode MA actually has is over-reach into the state
  // node, not a missed carve-out.
  it('ABORTS on the Commonwealth rather than sweeping it', () => {
    const c = classify(row({ entity: { name: 'Massachusetts', state: 'MA', entity_type: 'state' } }));
    expect(c.error).toMatch(/out of scope/);
  });

  it('ABORTS on an out-of-state entity', () => {
    const c = classify(row({ entity: { name: 'Duluth', state: 'MN', entity_type: 'city' } }));
    expect(c.error).toMatch(/out-of-state/);
  });

  it('ABORTS when a county label carries a city entity, and vice versa', () => {
    expect(classify(row({
      data_source: CTY, entity: { name: 'Abington', state: 'MA', entity_type: 'city' },
    })).error).toMatch(/does not belong to family/);
    expect(classify(row({
      data_source: EXP, entity: { name: 'Barnstable County', state: 'MA', entity_type: 'county' },
    })).error).toMatch(/does not belong to family/);
  });

  it('ABORTS on a month that is neither 1 nor 7', () => {
    const c = classify(row({ fiscal_year_start_month: 10 }));
    expect(c.error).toMatch(/neither 1 nor 7/);
  });

  it('ABORTS on an unknown data_source rather than defaulting it', () => {
    expect(classify(row({ data_source: 'Sacramento Operating Budget' })).error)
      .toMatch(/no established MA family/);
  });

  it('ABORTS on a missing entity', () => {
    expect(classify({ data_source: EXP, fiscal_year_start_month: 1 }).error)
      .toMatch(/no entity/);
  });

  // ⚠ Number(null) and Number('') are both 0, an integer that would sail past an
  // Number.isInteger check and be reported as "stored month 0" — blaming a value
  // the column never held. Nullish must be rejected first.
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
  it('updates a January source row to July', () => {
    expect(classifySource(src())).toEqual({ action: 'update', month: 7 });
  });

  it('leaves a source already at July alone', () => {
    expect(classifySource(src({ fiscal_year_start_month: 7 }))).toEqual({ action: 'correct' });
  });

  // The retained portal-scraped family is just as wrong as the live one, and is
  // the thing that would bring a 1 back if it were ever promoted.
  it('covers the retained ma-dls family, not only ma-dls-excel', () => {
    expect(classifySource(src({ api_type: 'ma-dls' }))).toEqual({ action: 'update', month: 7 });
  });

  it('covers the county pdf_download family', () => {
    expect(classifySource(src({
      api_type: 'pdf_download',
      entity: { name: 'Barnstable County', state: 'MA', entity_type: 'county' },
    }))).toEqual({ action: 'update', month: 7 });
  });

  it('ABORTS on an api_type that is not an established MA family', () => {
    expect(classifySource(src({ api_type: 'socrata' })).error).toMatch(/not an established/);
  });

  it('ABORTS on the Commonwealth and on out-of-state sources', () => {
    expect(classifySource(src({ entity: { name: 'MA', state: 'MA', entity_type: 'state' } })).error)
      .toMatch(/out of scope/);
    expect(classifySource(src({ entity: { name: 'X', state: 'NH', entity_type: 'city' } })).error)
      .toMatch(/out-of-state/);
  });

  it('reports nullish as unparseable, not as month 0', () => {
    for (const v of [null, undefined, '']) {
      const c = classifySource(src({ fiscal_year_start_month: v }));
      expect(c.error).toMatch(/unparseable/);
      expect(c.error).not.toMatch(/month 0/);
    }
  });
});
