import { describe, it, expect } from 'vitest';
import {
  BASIS, BASIS_VALUES, REPORTING_ENTITY, REPORTING_ENTITY_VALUES,
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
