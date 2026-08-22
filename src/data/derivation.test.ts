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

  // SCOPE-04 ruling (Chris, 2026-08-22): keep calling the figure "Total
  // Governmental", and DISCLOSE the successor-agency exclusion.
  //
  // ⚠ Why this needs its own test. The gap is invisible to every arithmetic
  // gate: derived TG is the SCO feed's governmental scope, the ACFR's "Total
  // Governmental Funds" includes redevelopment successor-agency funds, and BOTH
  // figures are individually correct. Proven at Napa FY2017 to the dollar
  // (97,277,497 - 18,524 + 79,307 = 97,338,280). Disclosure is therefore the
  // ONLY mechanism that can tell a reader, and prose in a chip is not
  // machine-checkable -- so it is pinned here.
  it('discloses the successor-agency exclusion', () => {
    expect(DERIVED_COPY.scopeNote).toMatch(/successor agency/i);
  });

  it('does NOT claim the difference is small — it is unmeasured', () => {
    // Napa's gap was $23 and $18,524, i.e. nothing. That is ONE city. Promising
    // "slightly" or "minor" would be a claim this milestone has not earned.
    expect(DERIVED_COPY.scopeNote).not.toMatch(/slight|minor|negligible|small differ/i);
  });
});
