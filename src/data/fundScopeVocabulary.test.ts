import { describe, it, expect } from 'vitest';
import {
  FUND_SCOPE_VALUES, FUND_SCOPE_COPY, FUND_SCOPE_EXPLAINER, NON_COMPARABLE_SCOPES,
  isComparableScope, normalizeScope, scopeLabel,
} from './fundScopeVocabulary';

describe('fund scope values', () => {
  it('match the CHECK constraint on treasury.budgets exactly', () => {
    // Drift between this list and the constraint means the UI can be handed a
    // value it has no copy for. Asserted rather than assumed.
    expect([...FUND_SCOPE_VALUES].sort()).toEqual(
      ['all_funds', 'general_fund', 'total_governmental', 'unknown'],
    );
  });

  it('has reader-facing copy for EVERY value, including unknown', () => {
    for (const scope of FUND_SCOPE_VALUES) {
      const copy = FUND_SCOPE_COPY[scope];
      expect(copy, `no copy for ${scope}`).toBeDefined();
      expect(copy.label.trim().length, `${scope} label`).toBeGreaterThan(0);
      expect(copy.short.trim().length, `${scope} short`).toBeGreaterThan(0);
      expect(copy.long.trim().length, `${scope} long`).toBeGreaterThan(40);
    }
  });

  it('labels unknown as a statement about verification, not a defect', () => {
    // The wording matters: "scope not established" describes OUR checking, not a
    // fault in the source. If someone reworks this into "unreliable"/"bad data",
    // this test should make them stop and think.
    expect(FUND_SCOPE_COPY.unknown.label).toBe('Scope not established');
    expect(FUND_SCOPE_COPY.unknown.long).toMatch(/not.*guess|rather than guess/i);
  });
});

describe('normalizeScope — absent must mean unknown, never a guess', () => {
  it('passes through every legal value', () => {
    for (const scope of FUND_SCOPE_VALUES) expect(normalizeScope(scope)).toBe(scope);
  });

  it('maps absent/garbage to unknown', () => {
    // This is the pre-deploy path: the API only began returning fund_scope in
    // 2026-08, so undefined is a real production state, not a hypothetical.
    for (const bad of [undefined, null, '', 'enterprise', 42, {}, 'GENERAL_FUND']) {
      expect(normalizeScope(bad), String(bad)).toBe('unknown');
    }
  });
});

describe('isComparableScope — the cross-entity guard', () => {
  it('permits the three established scopes', () => {
    expect(isComparableScope('general_fund')).toBe(true);
    expect(isComparableScope('total_governmental')).toBe(true);
    expect(isComparableScope('all_funds')).toBe(true);
  });

  it('refuses unknown', () => {
    expect(isComparableScope('unknown')).toBe(false);
    expect([...NON_COMPARABLE_SCOPES]).toEqual(['unknown']);
  });

  it('refuses absent or unrecognised values rather than defaulting to comparable', () => {
    // The failure direction that matters. A comparison surface built later must not
    // be able to slip an unlabelled figure onto a shared axis just because the
    // field was missing.
    for (const bad of [undefined, null, 'enterprise', '' as never]) {
      expect(isComparableScope(bad as never), String(bad)).toBe(false);
    }
  });

  it('stays a LIST rather than an inline !== unknown check', () => {
    // SCOPE-02 adds a reporting_entity dimension that folds in here. The set has
    // already changed once this milestone (special_revenue was added and dropped),
    // so the indirection is load-bearing, not ceremony.
    expect(Array.isArray(NON_COMPARABLE_SCOPES)).toBe(true);
  });
});

describe('the explainer copy', () => {
  it('covers all four required beats', () => {
    // Task 10 Step 2: what each level contains, why one place has more than one
    // true total, why two honest figures can differ by half, and what we do.
    for (const key of ['heading', 'intro', 'whyMoreThanOneTotal', 'whyFiguresDiffer', 'whatWeDo'] as const) {
      expect(FUND_SCOPE_EXPLAINER[key].trim().length, key).toBeGreaterThan(20);
    }
  });

  it('stays inside SCOPE-01 and does not stray into SCOPE-03 territory', () => {
    // The enterprise-TRANSFER material -- money moving between a city and its
    // enterprises, and getting reclassified on the way -- is SCOPE-03's subject.
    // Putting it here would bury the vocabulary this copy exists to teach.
    const all = Object.values(FUND_SCOPE_EXPLAINER).join(' ').toLowerCase();
    expect(all).not.toMatch(/transfer(s|red)? between|reclassif/);
  });

  it('does not blame the publisher for an unverified scope', () => {
    const all = [
      ...Object.values(FUND_SCOPE_EXPLAINER),
      FUND_SCOPE_COPY.unknown.long,
    ].join(' ').toLowerCase();
    expect(all).not.toMatch(/misleading|wrong|inaccurate|unreliable|sloppy/);
  });
});

describe('scopeLabel', () => {
  it('gives a label for anything, including nothing', () => {
    expect(scopeLabel('all_funds')).toBe('All Funds');
    expect(scopeLabel(undefined)).toBe('Scope not established');
  });
});
