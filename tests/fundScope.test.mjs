import { describe, it, expect } from 'vitest';
import {
  classify, validateRegistry, SCOPE, SCOPE_VALUES,
  NON_COMPARABLE_SCOPES, isComparableScope,
} from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';

// The pattern is ANCHORED to the exact string. An earlier draft of the plan used
// /^CA State Controller/i, which also claims the 7,682 publicpay.ca.gov salaries
// rows the Modesto reconciliation never covered -- SCOPE-01-RECON.md §1.3.
const reg = [
  { id: 'ca-sco-city-exp', match: /^CA State Controller - Expenditures$/, scope: SCOPE.ALL_FUNDS,
    evidence: { document: 'Modesto FY2024 ACFR', figures: '291,641,122 + 296,400,946 = 588,042,068' } },
  { id: 'no-evidence', match: /^Plausible Source/i, scope: SCOPE.GENERAL_FUND, evidence: null },
];

describe('classify', () => {
  it('matches a source to its registered scope', () => {
    expect(classify('CA State Controller - Expenditures', reg))
      .toEqual({ scope: SCOPE.ALL_FUNDS, entryId: 'ca-sco-city-exp' });
  });

  it('does NOT let the CA SCO entry claim the publicpay salaries source', () => {
    // Same office, same prefix, unrelated program, dataset_type='salaries', and NOT
    // covered by the Modesto reconciliation. Regression test for RECON §1.3 -- the
    // over-matching this milestone exists to prevent.
    expect(classify('CA State Controller — Government Compensation in California (publicpay.ca.gov)', reg))
      .toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
  });

  it('returns unknown for a source no entry matches', () => {
    expect(classify('Some New Loader FY2027', reg))
      .toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
  });

  it('REFUSES to classify from an entry with no evidence', () => {
    // The safety property. An entry that asserts a scope without a reconciliation
    // is exactly the guess this milestone exists to prevent, so it classifies as
    // unknown no matter what its `scope` field claims.
    expect(classify('Plausible Source 2024', reg))
      .toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
  });

  it('treats placeholder evidence as no evidence', () => {
    // `evidence: {}` left behind as a TODO must not be able to classify either --
    // otherwise the evidence rule is satisfied by the SHAPE of an object rather
    // than by a reconciliation having happened.
    const placeholders = [
      { id: 'p1', match: /^P1$/, scope: SCOPE.GENERAL_FUND, evidence: {} },
      { id: 'p2', match: /^P2$/, scope: SCOPE.GENERAL_FUND, evidence: { document: 'TODO', figures: '' } },
      { id: 'p3', match: /^P3$/, scope: SCOPE.GENERAL_FUND, evidence: { document: '   ', figures: 'x' } },
    ];
    for (const s of ['P1', 'P2', 'P3']) {
      expect(classify(s, placeholders)).toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
    }
  });

  it('returns unknown for null/empty data_source rather than throwing', () => {
    expect(classify(null, reg).scope).toBe(SCOPE.UNKNOWN);
    expect(classify('', reg).scope).toBe(SCOPE.UNKNOWN);
    expect(classify(undefined, reg).scope).toBe(SCOPE.UNKNOWN);
    expect(classify('   ', reg).scope).toBe(SCOPE.UNKNOWN);
  });

  it('returns unknown for a missing or empty registry rather than throwing', () => {
    expect(classify('CA State Controller - Expenditures', []).scope).toBe(SCOPE.UNKNOWN);
    expect(classify('CA State Controller - Expenditures', undefined).scope).toBe(SCOPE.UNKNOWN);
  });

  it('takes the FIRST matching entry so precedence is explicit', () => {
    const overlapping = [
      { id: 'specific', match: /^CA State Controller - Revenues/i, scope: SCOPE.ALL_FUNDS, evidence: { document: 'd', figures: 'f' } },
      { id: 'general', match: /^CA State Controller/i, scope: SCOPE.ALL_FUNDS, evidence: { document: 'd', figures: 'f' } },
    ];
    expect(classify('CA State Controller - Revenues', overlapping).entryId).toBe('specific');
  });

  it('never returns an entryId alongside an unknown scope', () => {
    // The invariant the classifier and Task 5's tally both rely on: a non-null
    // entryId means a real classification happened, always.
    for (const s of ['Plausible Source 2024', 'nothing matches this', '', null]) {
      const r = classify(s, reg);
      if (r.scope === SCOPE.UNKNOWN) expect(r.entryId).toBeNull();
    }
  });

  it('does not let a throwing match pattern take the whole classifier down', () => {
    // A malformed entry blocks its own family and nothing else. Same failure
    // direction as caRecon: nothing is waved through by absence.
    const hostile = [
      { id: 'boom', match: { test() { throw new Error('bad pattern'); } }, scope: SCOPE.ALL_FUNDS, evidence: { document: 'd', figures: 'f' } },
      { id: 'fine', match: /^Good Source$/, scope: SCOPE.GENERAL_FUND, evidence: { document: 'd', figures: 'f' } },
    ];
    expect(classify('Good Source', hostile)).toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'fine' });
  });
});

describe('SCOPE', () => {
  it('matches the treasury.budgets CHECK constraint exactly', () => {
    // Drift between this enum and the constraint is a write that fails in
    // production, so the two are asserted equal rather than assumed so.
    expect([...SCOPE_VALUES].sort()).toEqual(
      ['all_funds', 'general_fund', 'special_revenue', 'total_governmental', 'unknown'],
    );
    expect(Object.values(SCOPE).sort()).toEqual([...SCOPE_VALUES].sort());
  });

  it('includes special_revenue, which MA DLS Schedule A needs', () => {
    expect(SCOPE.SPECIAL_REVENUE).toBe('special_revenue');
  });
});

describe('validateRegistry', () => {
  it('rejects an entry claiming a scope with no evidence', () => {
    const r = validateRegistry(reg);
    expect(r.ok).toBe(false);
    expect(r.unevidenced).toEqual(['no-evidence']);
  });

  it('accepts a registry where every non-unknown entry is evidenced', () => {
    expect(validateRegistry([reg[0]]).ok).toBe(true);
  });

  it('rejects duplicate entry ids', () => {
    const dup = [reg[0], { ...reg[0] }];
    const r = validateRegistry(dup);
    expect(r.ok).toBe(false);
    expect(r.duplicateIds).toEqual(['ca-sco-city-exp']);
  });

  it('rejects a scope value the CHECK constraint would refuse', () => {
    const r = validateRegistry([
      { id: 'bad-scope', match: /^x$/, scope: 'enterprise', evidence: { document: 'd', figures: 'f' } },
    ]);
    expect(r.ok).toBe(false);
    expect(r.badScopes).toEqual(['bad-scope']);
  });

  it('rejects an entry whose match is not a usable pattern', () => {
    const r = validateRegistry([
      { id: 'bad-match', match: 'CA State Controller', scope: SCOPE.ALL_FUNDS, evidence: { document: 'd', figures: 'f' } },
    ]);
    expect(r.ok).toBe(false);
    expect(r.badMatches).toEqual(['bad-match']);
  });

  it('exempts an explicitly-unknown entry from the evidence rule', () => {
    // An entry may record "this family is known to be unclassified" without a
    // reconciliation -- there is nothing to reconcile to.
    const r = validateRegistry([
      { id: 'known-unclassified', match: /^x$/, scope: SCOPE.UNKNOWN, evidence: null },
    ]);
    expect(r.ok).toBe(true);
  });

  it('accepts an empty registry, which is the pre-Task-4 state', () => {
    expect(validateRegistry([]).ok).toBe(true);
  });
});

describe('comparability', () => {
  it('treats unknown AND special_revenue as non-comparable', () => {
    // Two values, not one. A filter written as `scope !== 'unknown'` would put
    // 1,560 Special Revenue Fund slices on a per-capita axis beside whole-city
    // totals -- RECON §1.4.
    expect([...NON_COMPARABLE_SCOPES].sort()).toEqual(['special_revenue', 'unknown']);
    expect(isComparableScope(SCOPE.UNKNOWN)).toBe(false);
    expect(isComparableScope(SCOPE.SPECIAL_REVENUE)).toBe(false);
  });

  it('treats the three whole-entity totals as comparable', () => {
    expect(isComparableScope(SCOPE.GENERAL_FUND)).toBe(true);
    expect(isComparableScope(SCOPE.TOTAL_GOVERNMENTAL)).toBe(true);
    expect(isComparableScope(SCOPE.ALL_FUNDS)).toBe(true);
  });

  it('does not treat an unrecognised value as comparable', () => {
    expect(isComparableScope('enterprise')).toBe(false);
    expect(isComparableScope(undefined)).toBe(false);
  });
});

describe('the shipped registry', () => {
  it('validates -- no entry claims a scope without evidence', () => {
    // The gate that keeps a guess out of the database. If this fails, someone
    // added an entry ahead of its reconciliation.
    expect(validateRegistry(FUND_SCOPE_REGISTRY)).toMatchObject({
      ok: true, unevidenced: [], duplicateIds: [], badScopes: [], badMatches: [], missingIds: 0,
    });
  });

  it('classifies each reconciled source', () => {
    // One assertion per evidenced entry. Each pairs with a numbered section of
    // SCOPE-01-RECON.md; adding one here without adding one there is the thing
    // the evidence rule exists to make impossible.
    expect(classify('CA State Controller - Expenditures', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.ALL_FUNDS, entryId: 'ca-sco-city-exp' });   // §2.1
    expect(classify('CA State Controller - Revenues', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.ALL_FUNDS, entryId: 'ca-sco-city-rev' });   // §4.1
    expect(classify('CA State Controller - County Expenditures', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.ALL_FUNDS, entryId: 'ca-sco-county-exp' }); // §4.2
  });

  it('leaves CA SCO County Revenues UNKNOWN', () => {
    // The Stanislaus probe tied the county EXPENDITURE side to $6. The revenue
    // side of the same document is still being adjudicated -- RECON §4.3.
    expect(classify('CA State Controller - County Revenues', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
  });

  it('leaves every other measured family UNKNOWN until Task 4', () => {
    // One representative string per family from RECON §1.2, so a pattern added
    // later cannot quietly start claiming a family that owes evidence.
    for (const s of [
      'CA State Controller — Government Compensation in California (publicpay.ca.gov)',
      'Minnesota Office of the State Auditor City/County Finances Report',
      'Ohio Auditor of State Summarized Annual Financial Reports',
      'Virginia APA Comparative Report',
      'Transparent Utah',
      'Leyden — MA General Fund Expenditures',
      'Acton — MA General Fund Revenues',
      'Adams — MA DLS General Fund Revenue by Source',
      'Acushnet — MA DLS Schedule A — Special Revenue Funds',
      'WA State Auditor — Spokane Annual Report',
      'Utah State ACFR — General Fund (FY2020 actual, GAAP basis)',
      'Wisconsin State CAFR — General Fund Revenue (FY2000 actual, pre-GASB-34 combined statement basis)',
      'City of Tucson ACFR — General Fund Expenditure by Function (FY2018 actual, GAAP basis)',
      'Texas State ACFR — General Revenue Fund (FY2015 actual, GAAP basis)',
      'King County ACFR General Fund Operating (GAAP actuals)',
      'Sacramento Operating Budget',
      'bloomington-open-data',
      'Gresham All Funds Requirements FY2025',
    ]) {
      expect(classify(s, FUND_SCOPE_REGISTRY), s).toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
    }
  });

  it('has a stable, unique id per entry', () => {
    const ids = FUND_SCOPE_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });
});
