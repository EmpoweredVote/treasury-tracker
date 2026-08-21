import { describe, it, expect } from 'vitest';
import { chooseSpendVerb, usesSpentLanguage } from '../src/utils/spendVerb';

// The defect this guards: an audited actuals figure rendering as "budgeted" right
// beneath an "Actuals" chip, because the row carried no per-category actualAmount
// values. Found on Los Angeles FY2024 (CA State Controller) during LA-02.
describe('chooseSpendVerb', () => {
  it('says "spent" for a closed year on an actual basis even with NO per-category actuals', () => {
    expect(chooseSpendVerb({ basis: 'actual', isPastYear: true, hasActualData: false })).toBe('spent');
  });

  it('never says "budgeted" for an actual basis', () => {
    for (const isPastYear of [true, false]) {
      for (const hasActualData of [true, false]) {
        const v = chooseSpendVerb({ basis: 'actual', isPastYear, hasActualData });
        expect(v).not.toBe('budgeted');
        expect(usesSpentLanguage(v)).toBe(true);
      }
    }
  });

  it('says "has spent" for an in-progress year on an actual basis', () => {
    expect(chooseSpendVerb({ basis: 'actual', isPastYear: false, hasActualData: false })).toBe('has spent');
  });

  it('says "budgeted" for a closed adopted-budget year', () => {
    expect(chooseSpendVerb({ basis: 'adopted', isPastYear: true, hasActualData: false })).toBe('budgeted');
  });

  it('says "is spending" for a current adopted-budget year', () => {
    expect(chooseSpendVerb({ basis: 'adopted', isPastYear: false, hasActualData: false })).toBe('is spending');
  });

  // An absent `basis` is a real production state (the API only began returning it
  // in 2026-08), so the legacy heuristic must survive unchanged for those rows.
  describe('falls back to the legacy heuristic when basis is unknown/absent', () => {
    for (const basis of ['unknown', null, undefined]) {
      it(`basis=${String(basis)}`, () => {
        expect(chooseSpendVerb({ basis, isPastYear: true,  hasActualData: true  })).toBe('spent');
        expect(chooseSpendVerb({ basis, isPastYear: false, hasActualData: true  })).toBe('has spent');
        expect(chooseSpendVerb({ basis, isPastYear: true,  hasActualData: false })).toBe('budgeted');
        expect(chooseSpendVerb({ basis, isPastYear: false, hasActualData: false })).toBe('is spending');
      });
    }
  });
});

describe('usesSpentLanguage', () => {
  it('is true only for the two spent verbs', () => {
    expect(usesSpentLanguage('spent')).toBe(true);
    expect(usesSpentLanguage('has spent')).toBe(true);
    expect(usesSpentLanguage('budgeted')).toBe(false);
    expect(usesSpentLanguage('is spending')).toBe(false);
  });
});
