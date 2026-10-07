import { describe, it, expect } from 'vitest';
import {
  ACCOUNTING_BASIS_VALUES, ACCOUNTING_BASIS_COPY, normalizeAccountingBasis,
  isComparableBasisPair,
} from './accountingBasisVocabulary';

describe('accounting basis copy', () => {
  it('has copy for every value', () => {
    expect(ACCOUNTING_BASIS_VALUES, 'vocabulary must be exported').toBeDefined();
    expect(ACCOUNTING_BASIS_VALUES.length).toBe(4);
    for (const v of ACCOUNTING_BASIS_VALUES) {
      expect(ACCOUNTING_BASIS_COPY[v].label, v).toBeTruthy();
      expect(ACCOUNTING_BASIS_COPY[v].short, v).toBeTruthy();
    }
  });

  it('never calls a non-GAAP basis worse — only different', () => {
    // ⚠⚠ Duvall is AUDITED, with an unmodified opinion on the regulatory
    // basis. The copy must not imply a defect: the figure is real and
    // attested, it is simply measured another way. Colour cannot carry this
    // distinction either — every graded chip shares one tone on purpose — so
    // the WORDS are the whole mechanism and they have to be exactly right.
    for (const v of ['cash', 'modified_cash'] as const) {
      const text = `${ACCOUNTING_BASIS_COPY[v].label} ${ACCOUNTING_BASIS_COPY[v].short}`.toLowerCase();
      for (const bad of ['unreliable', 'lower quality', 'worse', 'inferior', 'unaudited', 'incomplete', 'less rigorous']) {
        expect(text, `${v} copy must not say "${bad}"`).not.toContain(bad);
      }
    }
  });

  it('tells the reader what a non-GAAP figure IS comparable to', () => {
    // Saying only "not GAAP" leaves the reader thinking the figure is useless.
    // It is comparable — to other figures on the same basis.
    for (const v of ['cash', 'modified_cash'] as const) {
      expect(ACCOUNTING_BASIS_COPY[v].short.toLowerCase()).toContain('comparable');
    }
  });

  it('normalizes an unrecognised value to unknown rather than throwing', () => {
    expect(normalizeAccountingBasis('nonsense')).toBe('unknown');
    expect(normalizeAccountingBasis(null)).toBe('unknown');
    expect(normalizeAccountingBasis(undefined)).toBe('unknown');
    expect(normalizeAccountingBasis('cash')).toBe('cash');
  });
});

describe('isComparableBasisPair — the TS mirror of the JS rule', () => {
  // ⚠ `isComparableScope` already exists twice — scripts/lib/fundScope.mjs for
  // the loaders and src/data/fundScopeVocabulary.ts for the UI. This mirrors
  // the basis half the same way. The two implementations must agree, so the
  // same cases are asserted here as in tests/accountingBasis.test.mjs.
  it('refuses a proven mismatch', () => {
    expect(isComparableBasisPair('gaap', 'cash')).toBe(false);
    expect(isComparableBasisPair('modified_cash', 'gaap')).toBe(false);
    expect(isComparableBasisPair('cash', 'modified_cash')).toBe(false);
  });

  it('allows the same known basis', () => {
    expect(isComparableBasisPair('gaap', 'gaap')).toBe(true);
    expect(isComparableBasisPair('cash', 'cash')).toBe(true);
  });

  it('allows when either side is unknown — absence never blocks', () => {
    expect(isComparableBasisPair('unknown', 'gaap')).toBe(true);
    expect(isComparableBasisPair('cash', 'unknown')).toBe(true);
    expect(isComparableBasisPair(null, 'cash')).toBe(true);
    expect(isComparableBasisPair(undefined, undefined)).toBe(true);
  });

  it('treats an EMPTY STRING as absence, not as a basis that differs', () => {
    // ⚠ The type says this cannot happen; the runtime disagrees. An API that
    // returns `""` for a column it has not populated is the shape every axis
    // in this repo has already met, and `""` read as a KNOWN basis would
    // REFUSE a comparison on the strength of a blank field.
    //
    // ⚠⚠ The guard that makes this true is also what broke `npm run build`:
    // `v !== ''` against a narrowed union is a no-overlap error under
    // `tsc -b`, which is the build, while `tsc --noEmit` passes it. This test
    // is why the guard is kept and cast rather than deleted to appease the
    // compiler.
    expect(isComparableBasisPair('' as never, 'gaap')).toBe(true);
    expect(isComparableBasisPair('cash', '' as never)).toBe(true);
    expect(isComparableBasisPair('' as never, '' as never)).toBe(true);
  });
});
