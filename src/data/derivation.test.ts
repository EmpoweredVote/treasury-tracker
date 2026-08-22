import { describe, it, expect } from 'vitest';
import { normalizeDerivation, isDerived, DERIVED_COPY } from './derivation';

describe('normalizeDerivation', () => {
  it('passes through the two legal values', () => {
    expect(normalizeDerivation('published')).toBe('published');
    expect(normalizeDerivation('derived')).toBe('derived');
  });

  it('treats anything absent or unrecognised as PUBLISHED, not derived', () => {
    // ⚠ Direction matters. Every one of the 80,076 pre-SCOPE-04 rows is
    // published, and older API builds omit the field entirely. Defaulting to
    // 'derived' would label the whole database as computed.
    for (const raw of [undefined, null, '', 'garbage', 42])
      expect(normalizeDerivation(raw)).toBe('published');
  });
});

describe('isDerived', () => {
  it('is true only for derived', () => {
    expect(isDerived('derived')).toBe(true);
    expect(isDerived('published')).toBe(false);
  });
});

describe('DERIVED_COPY', () => {
  it('says who computed it and from what', () => {
    expect(DERIVED_COPY.marker).toMatch(/computed/i);
    expect(DERIVED_COPY.explainer).toMatch(/published components/i);
  });
});
