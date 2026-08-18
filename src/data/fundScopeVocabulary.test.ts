import { describe, it, expect } from 'vitest';
import {
  FUND_SCOPE_VALUES, FUND_SCOPE_COPY, FUND_SCOPE_EXPLAINER, NON_COMPARABLE_SCOPES,
  isComparableScope, normalizeScope, scopeLabel,
  areComparable, normalizeReportingEntity, normalizeBasis,
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

describe('normalizeBasis', () => {
  it('passes legal values through', () => {
    expect(normalizeBasis('actual')).toBe('actual');
    expect(normalizeBasis('adopted')).toBe('adopted');
  });
  it('turns absent, null and nonsense into unknown', () => {
    expect(normalizeBasis(undefined)).toBe('unknown');
    expect(normalizeBasis(null)).toBe('unknown');
    expect(normalizeBasis('estimated')).toBe('unknown');
    expect(normalizeBasis(7)).toBe('unknown');
  });
});

describe('areComparable — three axes', () => {
  const ok = { fundScope: 'all_funds', basis: 'actual', reportingEntity: 'primary_government' } as const;

  it('compares two identical, fully evidenced figures', () => {
    expect(areComparable(ok, { ...ok })).toBe(true);
  });
  it('refuses when fund scope differs', () => {
    expect(areComparable(ok, { ...ok, fundScope: 'general_fund' })).toBe(false);
  });
  it('refuses when basis differs — actuals vs an adopted budget', () => {
    expect(areComparable(ok, { ...ok, basis: 'adopted' })).toBe(false);
  });
  it('refuses when reporting entity differs — the MN OSA ~7-22% bias', () => {
    expect(areComparable(ok, { ...ok, reportingEntity: 'incl_component_units' })).toBe(false);
  });
  it('refuses when ANY axis is unknown on either side', () => {
    expect(areComparable(ok, { ...ok, basis: 'unknown' })).toBe(false);
    expect(areComparable({ ...ok, reportingEntity: 'unknown' }, ok)).toBe(false);
    expect(areComparable({ ...ok, fundScope: 'unknown' }, ok)).toBe(false);
  });
  it('refuses when a field is absent — absent is unknown, never optimistic', () => {
    expect(areComparable(ok, { fundScope: 'all_funds', basis: 'actual' })).toBe(false);
    expect(areComparable(ok, {})).toBe(false);
  });

  // Two figures being EQUALLY unestablished on one axis does not make them
  // comparable on that axis. Without the explicit `unknown` guard clauses in
  // areComparable(), the final per-field equality check alone would let
  // 'unknown' === 'unknown' slip through and be judged comparable -- these
  // cases fail if either guard clause is removed, unlike the "refuses when
  // ANY axis is unknown" tests above, where the two sides' values differ
  // textually and the equality check alone already returns false.
  it('refuses when BOTH sides share the same unknown fund scope, even with the other axes matching', () => {
    expect(areComparable({ ...ok, fundScope: 'unknown' }, { ...ok, fundScope: 'unknown' })).toBe(false);
  });
  it('refuses when BOTH sides share the same unknown basis, even with the other axes matching', () => {
    expect(areComparable({ ...ok, basis: 'unknown' }, { ...ok, basis: 'unknown' })).toBe(false);
  });
  it('refuses when BOTH sides share the same unknown reporting entity, even with the other axes matching', () => {
    expect(areComparable({ ...ok, reportingEntity: 'unknown' }, { ...ok, reportingEntity: 'unknown' })).toBe(false);
  });
});

describe('normalizeReportingEntity', () => {
  it('passes legal values and rejects everything else', () => {
    expect(normalizeReportingEntity('primary_government')).toBe('primary_government');
    expect(normalizeReportingEntity('incl_component_units')).toBe('incl_component_units');
    expect(normalizeReportingEntity('component_units_only')).toBe('unknown');
    expect(normalizeReportingEntity(undefined)).toBe('unknown');
  });
});
