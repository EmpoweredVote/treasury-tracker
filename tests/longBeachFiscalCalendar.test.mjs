import { describe, it, expect } from 'vitest';
// From the LIB, never from scripts/fixLongBeachFiscalYearStartMonth.mjs: that
// file starts with a shebang, and tests/waSao + tests/nulByte forbid a test from
// importing any module that does.
import {
  ENTITY, CORRECT_MONTH, ALLOWED_MONTHS, FAMILIES, SOURCE_FAMILY,
  PROTECTED, PROTECTED_ROWS, EXPECTED_ROWS,
  familyFor, protectionFor, classify, classifySource,
} from '../scripts/lib/longBeachFiscalCalendar.mjs';

const SCO_EXP = 'CA State Controller - Expenditures';
const SCO_REV = 'CA State Controller - Revenues';
const DER_EXP = 'Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)';
const DER_REV = 'Treasury Tracker derived: Total Governmental (CA State Controller - Revenues)';
const BUD_OP = 'Long Beach General Fund Operating Budget FY2025';
const BUD_RV = 'Long Beach General Fund Revenue Budget FY2026';
const BUD_BARE = 'Long Beach General Fund Operating Budget';
const PUBLICPAY = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)';

const row = (over = {}) => ({
  data_source: SCO_EXP,
  entity: { name: 'Long Beach', state: 'CA' },
  fiscal_year: 2024,
  total_budget: 1234,
  fiscal_year_start_month: 7,
  ...over,
});

const src = (over = {}) => ({
  name: BUD_OP,
  api_type: 'pdf_download',
  entity: { name: 'Long Beach', state: 'CA' },
  fiscal_year_start_month: 1,
  ...over,
});

describe('Long Beach fiscal calendar — the basics', () => {
  it('is keyed on (name, state): four states have a Long Beach', () => {
    expect(ENTITY).toEqual({ name: 'Long Beach', state: 'CA' });
  });

  it('closes September 30, so starts in October', () => {
    expect(CORRECT_MONTH).toBe(10);
    expect(ALLOWED_MONTHS.has(10)).toBe(true);
  });

  it('records the baseline: 60 SCO/derived + 4 own-budget = 64, plus 12 sources', () => {
    expect(FAMILIES.map((f) => f.rows)).toEqual([60, 4]);
    expect(EXPECTED_ROWS).toBe(64);
    expect(SOURCE_FAMILY.rows).toBe(12);
  });

  it('records 16 protected publicpay rows whose correct value is 1', () => {
    expect(PROTECTED_ROWS).toBe(16);
    expect(PROTECTED[0].month).toBe(1);
  });

  // The whole point of this library: the two in-scope families hold DIFFERENT
  // wrong values, so the expected-wrong month is a property of the family.
  it('carries a per-family known-wrong value, 7 for SCO and 1 for own budgets', () => {
    expect(FAMILIES.find((f) => f.key === 'sco').from).toBe(7);
    expect(FAMILIES.find((f) => f.key === 'city-budget').from).toBe(1);
  });
});

describe('family matching', () => {
  it('matches all four SCO/derived labels exactly', () => {
    for (const s of [SCO_EXP, SCO_REV, DER_EXP, DER_REV]) {
      expect(familyFor(s).key).toBe('sco');
    }
  });

  it('matches the own-budget labels, with and without an FY suffix', () => {
    for (const s of [BUD_OP, BUD_RV, BUD_BARE, 'Long Beach General Fund Revenue Budget']) {
      expect(familyFor(s).key).toBe('city-budget');
    }
  });

  it('never lets one label match two families', () => {
    for (const s of [SCO_EXP, SCO_REV, DER_EXP, DER_REV, BUD_OP, BUD_RV, BUD_BARE]) {
      expect(familyFor(s).ambiguous).toBeUndefined();
    }
  });

  it('rejects a near-miss own-budget label rather than defaulting it', () => {
    expect(familyFor('Long Beach General Fund Operating Budget FY25')).toBeNull();
    expect(familyFor('Long Beach Measure A Operating Budget FY2025')).toBeNull();
    expect(familyFor('Inglewood General Fund Operating Budget FY2025')).toBeNull();
  });

  it('rejects foreign labels and junk', () => {
    expect(familyFor('CA State Controller - County Expenditures')).toBeNull();
    expect(familyFor('')).toBeNull();
    expect(familyFor(null)).toBeNull();
  });
});

describe('the protected publicpay group', () => {
  it('recognises publicpay by either phrasing', () => {
    expect(protectionFor(PUBLICPAY).month).toBe(1);
    expect(protectionFor('Government Compensation in California').month).toBe(1);
    expect(protectionFor('some publicpay extract').month).toBe(1);
  });

  it('does not protect anything else', () => {
    expect(protectionFor(SCO_EXP)).toBeNull();
    expect(protectionFor(BUD_OP)).toBeNull();
  });

  // ⚠ THE CENTRAL GUARD. A publicpay row sits at 1, and so does a wrong
  // own-budget row. If a publicpay row ever reaches classify it must ABORT, not
  // be swept to 10 as though it were a budget row.
  it('ABORTS when a publicpay row reaches the update set', () => {
    const c = classify(row({ data_source: PUBLICPAY, fiscal_year_start_month: 1 }));
    expect(c.error).toMatch(/protected source reached the update set/);
    expect(c.error).toMatch(/its 1 is CORRECT/);
  });
});

describe('classify — budgets', () => {
  it('moves an SCO row from 7 to 10', () => {
    expect(classify(row())).toEqual({ action: 'update', month: 10 });
  });

  it('moves an own-budget row from 1 to 10', () => {
    expect(classify(row({ data_source: BUD_OP, fiscal_year_start_month: 1 })))
      .toEqual({ action: 'update', month: 10 });
  });

  it('leaves a row already at 10 alone, in either family', () => {
    expect(classify(row({ fiscal_year_start_month: 10 }))).toEqual({ action: 'correct' });
    expect(classify(row({ data_source: BUD_OP, fiscal_year_start_month: 10 })))
      .toEqual({ action: 'correct' });
  });

  // The mirror of the central guard: 1 is not a licence to update just because
  // some family somewhere expects it, and 7 is not either.
  it('ABORTS on a value that is wrong for THAT family, even if right for the other', () => {
    // 1 is the own-budget family's wrong value, but an SCO row at 1 is unexplained.
    expect(classify(row({ data_source: SCO_EXP, fiscal_year_start_month: 1 })).error)
      .toMatch(/neither 7 .*nor 10/);
    // 7 is the SCO family's wrong value, but an own-budget row at 7 is unexplained.
    expect(classify(row({ data_source: BUD_OP, fiscal_year_start_month: 7 })).error)
      .toMatch(/neither 1 .*nor 10/);
  });

  it('ABORTS on the wrong entity, including another state\'s Long Beach', () => {
    expect(classify(row({ entity: { name: 'Long Beach', state: 'NY' } })).error)
      .toMatch(/wrong entity/);
    expect(classify(row({ entity: { name: 'Inglewood', state: 'CA' } })).error)
      .toMatch(/wrong entity/);
  });

  it('ABORTS on a missing entity', () => {
    expect(classify({ data_source: SCO_EXP, fiscal_year_start_month: 7 }).error)
      .toMatch(/no entity/);
  });

  it('ABORTS on an out-of-scope data_source rather than defaulting it', () => {
    expect(classify(row({ data_source: 'Long Beach Airport Enterprise Fund' })).error)
      .toMatch(/out-of-scope/);
  });

  // ⚠ Number(null) and Number('') are both 0, an integer that would sail past an
  // Number.isInteger check and be reported as "stored month 0" — blaming a value
  // the column never held.
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
  it('moves a pdf_download source row from 1 to 10', () => {
    expect(classifySource(src())).toEqual({ action: 'update', month: 10 });
  });

  it('leaves a source already at 10 alone', () => {
    expect(classifySource(src({ fiscal_year_start_month: 10 }))).toEqual({ action: 'correct' });
  });

  it('accepts the un-suffixed source names that exist in the table', () => {
    expect(classifySource(src({ name: 'Long Beach General Fund Revenue Budget' })))
      .toEqual({ action: 'update', month: 10 });
  });

  it('ABORTS on a foreign api_type or an out-of-scope name', () => {
    expect(classifySource(src({ api_type: 'socrata' })).error).toMatch(/not the established/);
    expect(classifySource(src({ name: 'Long Beach Airport Budget' })).error).toMatch(/out of scope/);
  });

  it('ABORTS on the wrong entity', () => {
    expect(classifySource(src({ entity: { name: 'Long Beach', state: 'MS' } })).error)
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
