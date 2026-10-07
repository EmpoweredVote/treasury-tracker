import { describe, it, expect } from 'vitest';
import {
  BASIS, BASIS_VALUES, REPORTING_ENTITY, REPORTING_ENTITY_VALUES,
  AUDIT_GRADE_VALUES, ACCOUNTING_BASIS, ACCOUNTING_BASIS_VALUES,
  classifyAxis, validateAxisRegistry,
} from '../scripts/lib/budgetAxes.mjs';

const ev = { document: 'doc.pdf', figures: '1 = 1' };
const entry = (over = {}) => ({ id: 'e1', match: /^SRC/, value: BASIS.ACTUAL, evidence: ev, ...over });
const classifyBasis = (s, reg) => classifyAxis(s, reg, BASIS_VALUES, BASIS.UNKNOWN);

describe('value sets', () => {
  it('mirror the CHECK constraints', () => {
    expect([...BASIS_VALUES].sort()).toEqual(['actual', 'adopted', 'unknown']);
    expect([...REPORTING_ENTITY_VALUES].sort())
      .toEqual(['incl_component_units', 'primary_government', 'unknown']);
  });
});

describe('classifyAxis failure direction', () => {
  it('classifies an evidenced match', () => {
    expect(classifyBasis('SRC one', [entry()])).toEqual({ value: 'actual', entryId: 'e1' });
  });
  it('returns unknown when evidence is null', () => {
    expect(classifyBasis('SRC one', [entry({ evidence: null })]).value).toBe('unknown');
  });
  it('returns unknown when evidence is an empty placeholder', () => {
    expect(classifyBasis('SRC one', [entry({ evidence: { document: ' ', figures: '' } })]).value)
      .toBe('unknown');
  });
  it('returns unknown for an illegal value', () => {
    expect(classifyBasis('SRC one', [entry({ value: 'estimated' })]).value).toBe('unknown');
  });
  it('returns unknown for a null or empty data_source', () => {
    expect(classifyBasis(null, [entry()]).value).toBe('unknown');
    expect(classifyBasis('   ', [entry()]).value).toBe('unknown');
  });
  it('returns unknown for an empty registry', () => {
    expect(classifyBasis('SRC one', []).value).toBe('unknown');
  });
  it('survives a throwing matcher and keeps checking later entries', () => {
    const bomb = { id: 'bomb', match: { test() { throw new Error('boom'); } }, value: BASIS.ACTUAL, evidence: ev };
    expect(classifyBasis('SRC one', [bomb, entry()])).toEqual({ value: 'actual', entryId: 'e1' });
  });
  it('takes the FIRST match, so order is precedence', () => {
    const first = entry({ id: 'first', value: BASIS.ADOPTED });
    expect(classifyBasis('SRC one', [first, entry()]).entryId).toBe('first');
  });
  it('never returns an entryId when it returns unknown', () => {
    expect(classifyBasis('SRC one', [entry({ evidence: null })]).entryId).toBeNull();
  });
});

describe('validateAxisRegistry', () => {
  it('passes a good registry', () => {
    expect(validateAxisRegistry([entry()], BASIS_VALUES, BASIS.UNKNOWN).ok).toBe(true);
  });
  it('flags an unevidenced entry', () => {
    const r = validateAxisRegistry([entry({ evidence: null })], BASIS_VALUES, BASIS.UNKNOWN);
    expect(r.ok).toBe(false);
    expect(r.unevidenced).toEqual(['e1']);
  });
  it('exempts an entry whose declared value IS unknown', () => {
    const r = validateAxisRegistry(
      [entry({ value: BASIS.UNKNOWN, evidence: null })], BASIS_VALUES, BASIS.UNKNOWN);
    expect(r.ok).toBe(true);
  });
  it('flags duplicate ids', () => {
    const r = validateAxisRegistry([entry(), entry()], BASIS_VALUES, BASIS.UNKNOWN);
    expect(r.duplicateIds).toEqual(['e1']);
  });
});

describe('ACCOUNTING_BASIS', () => {
  it('carries exactly the four grounded values', () => {
    // ⚠ Each is grounded in a document TT already holds or is loading — GAAP
    // (Redmond, Aberdeen SD), modified cash (Brown County SD), cash (Duvall).
    // No speculative values: an unused vocabulary value is a claim nobody can
    // falsify, and this axis exists to stop unfalsifiable claims.
    expect([...ACCOUNTING_BASIS_VALUES].sort())
      .toEqual(['cash', 'gaap', 'modified_cash', 'unknown']);
  });

  it('is a DIFFERENT axis from `basis`, which means actual-vs-adopted', () => {
    // budgets.basis is CHECK (basis IN ('actual','adopted','unknown')). If the
    // two vocabularies ever intersect beyond `unknown`, someone has conflated
    // measurement with closed-year-vs-budget and both meanings are destroyed.
    const overlap = ACCOUNTING_BASIS_VALUES.filter((v) => BASIS_VALUES.includes(v) && v !== 'unknown');
    expect(overlap).toEqual([]);
  });

  it('is orthogonal to audit_grade — assurance is not measurement', () => {
    // An unaudited cash-basis source must be describable. Deriving basis from
    // `audited_ocboa` would make it invisible.
    const overlap = ACCOUNTING_BASIS_VALUES.filter((v) => AUDIT_GRADE_VALUES.includes(v) && v !== 'unknown');
    expect(overlap).toEqual([]);
  });

  it('freezes the vocabulary', () => {
    // ⚠ Assert DEFINED first. `Object.isFrozen(undefined)` is TRUE in JS —
    // primitives report as frozen — so without this the test is green before
    // the vocabulary exists and proves nothing. It passed vacuously on its
    // first RED run, which is the only reason this line is here.
    expect(ACCOUNTING_BASIS, 'ACCOUNTING_BASIS must be exported').toBeDefined();
    expect(ACCOUNTING_BASIS_VALUES, 'ACCOUNTING_BASIS_VALUES must be exported').toBeDefined();
    expect(Object.isFrozen(ACCOUNTING_BASIS)).toBe(true);
    expect(Object.isFrozen(ACCOUNTING_BASIS_VALUES)).toBe(true);
  });
});
