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
      ['all_funds', 'general_fund', 'total_governmental', 'unknown'],
    );
    expect(Object.values(SCOPE).sort()).toEqual([...SCOPE_VALUES].sort());
  });

  it('no longer carries special_revenue', () => {
    // Added for the MA "Schedule A — Special Revenue Funds" label, then dropped
    // when that label turned out to describe General Fund data -- RECON §4.4.
    // Asserted rather than merely deleted, so a re-add has to be deliberate and
    // has to come with a source that genuinely needs it.
    expect(SCOPE.SPECIAL_REVENUE).toBeUndefined();
    expect(SCOPE_VALUES).not.toContain('special_revenue');
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
  it('treats unknown as non-comparable', () => {
    expect([...NON_COMPARABLE_SCOPES]).toEqual(['unknown']);
    expect(isComparableScope(SCOPE.UNKNOWN)).toBe(false);
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
    expect(classify('CA State Controller - County Revenues', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.ALL_FUNDS, entryId: 'ca-sco-county-rev' }); // §4.3
    expect(classify('Utah State ACFR — General Fund (FY2020 actual, GAAP basis)', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'state-acfr-gf' }); // §4.5
    expect(classify('Connecticut State ACFR — General Fund Revenue (FY2024 actual, GAAP basis)', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'state-acfr-gf' }); // §4.5
    expect(classify('WA State Auditor — Spokane Annual Financial Report FY2019 (General Fund, Revenue by Source)', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'wa-sao' });        // §4.6
    expect(classify('WA State Auditor — Kitsap County Annual Financial Report FY2011 (General Fund, Expenditure by Function)', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'wa-sao' });        // §4.6
    expect(classify('Minnesota Office of the State Auditor City/County Finances Report', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.TOTAL_GOVERNMENTAL, entryId: 'mn-osa' });  // §4.7
    expect(classify('Ohio Auditor of State Summarized Annual Financial Reports', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.TOTAL_GOVERNMENTAL, entryId: 'oh-aos' });  // §4.8
    // MA DLS — MA-01-RECON.md §4, §4a, §4b. Per-town labels, so these patterns
    // are end-anchored on the family suffix rather than the whole string.
    expect(classify('Leyden — MA General Fund Expenditures', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'ma-dls-gf-exp' });
    expect(classify('Acton — MA General Fund Revenues', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'ma-dls-gf-rev' });
    expect(classify('Adams — MA DLS General Fund Revenue by Source', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.GENERAL_FUND, entryId: 'ma-dls-gf-rev-by-source' });
  });

  it('leaves the FALSE "Special Revenue Funds" label UNCLASSIFIED, deliberately', () => {
    // MA-01-RECON.md §4a proves those 1,560 rows carry figures byte-identical to
    // the GENERAL FUND expenditure workbook, so the label is wrong. No pattern is
    // written for it: classification is per SOURCE STRING, so matching this one
    // would put a statement the recon disproves into the audit trail of record.
    // The label gets corrected in the database; the registry never learns it.
    expect(classify('Acushnet — MA DLS Schedule A — Special Revenue Funds', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
  });

  it('anchors the MA patterns to the family suffix, not a bare town name', () => {
    // ` — MA General Fund Expenditures$` must not be loosened to something like
    // /MA General Fund/ , which would also claim the Revenues family and the
    // DLS-by-source family and silently merge three entries into one.
    const exp = FUND_SCOPE_REGISTRY.find((e) => e.id === 'ma-dls-gf-exp');
    expect(exp.match.test('Natick — MA General Fund Expenditures')).toBe(true);
    expect(exp.match.test('Natick — MA General Fund Revenues')).toBe(false);
    expect(exp.match.test('Natick — MA DLS General Fund Revenue by Source')).toBe(false);
    // and it must not match a town whose NAME ends in the family string
    expect(exp.match.test('MA General Fund Expenditures')).toBe(false);
  });

  it('every total_governmental entry states its reporting entity', () => {
    // The dimension fund_scope cannot express (RECON §4.7). SCOPE-02 adds a
    // `reporting_entity` column; until then, each entry at this level must say
    // where it stands, so the SCOPE-02 migration has its inputs already written
    // down rather than needing every source re-probed.
    // ⚠ SCOPE-04 adds the third, and it is the first DERIVED one: `ca-sco-derived-tg`
    // is Treasury Tracker's own arithmetic over CA State Controller components, not
    // a figure any government published at this level. That is precisely why the
    // `derivation` column exists — `total_governmental` alone now spans two
    // epistemically different kinds of figure, and this list is the place that fact
    // is hardest to overlook.
    // ⚠ `fl-dfs-afr` (Knight session 3) joins on 2026-08-29. It is the first at
    // this level whose scope is read off SEPARATE PUBLISHED FUND COLUMNS rather
    // than off a statement heading, so it is also the first whose reporting
    // entity is settled by which columns TT declined to sum.
    const totGov = FUND_SCOPE_REGISTRY.filter((e) => e.scope === SCOPE.TOTAL_GOVERNMENTAL);
    expect(totGov.map((e) => e.id).sort()).toEqual(['ca-sco-derived-tg', 'fl-dfs-afr', 'mn-osa', 'oh-aos']);
    for (const e of totGov) {
      expect(e.evidence.figures, e.id).toMatch(/REPORTING ENTITY|reporting-entity/);
    }
  });

  it('does not let state-acfr-gf claim the Texas or CAFR variants', () => {
    // Texas calls its principal operating fund the General REVENUE Fund, and the
    // pre-GASB-34 rows are a different statement on a different basis. Both are
    // one word away from the state pattern and neither is evidenced -- RECON §1.5.
    expect(classify('Texas State ACFR — General Revenue Fund (FY2015 actual, GAAP basis)', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
    expect(classify('Wisconsin State CAFR — General Fund Revenue (FY2000 actual, pre-GASB-34 combined statement basis)', FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.UNKNOWN, entryId: null });
    // ...and it must not reach down to city/county ACFRs either. Tucson IS
    // classified now — by `az-muni-acfr-gf`, on its own evidence
    // (ACFR-GF-CLASSIFICATION-RECON.md) — so the assertion this test needs to
    // make is about WHICH entry claims it, not whether anything does. A city
    // ACFR being swept up by the STATE pattern would still be the bug.
    const tucson = classify(
      'City of Tucson ACFR — General Fund Expenditure by Function (FY2018 actual, GAAP basis)',
      FUND_SCOPE_REGISTRY,
    );
    expect(tucson.entryId).not.toBe('state-acfr-gf');
    expect(tucson.entryId).toBe('az-muni-acfr-gf');
  });

  it('records that ca-sco-county-rev is the one entry without a dollar tie', () => {
    // Not a behavioural assertion -- a tripwire. If a future reader wonders which
    // classifications are weakest, this is the list, and it should stay at one.
    // RECON §4.3 states what would overturn it.
    const noDollarTie = FUND_SCOPE_REGISTRY
      .filter((e) => /NOT a dollar tie/.test(e.evidence?.figures ?? ''))
      .map((e) => e.id);
    expect(noDollarTie).toEqual(['ca-sco-county-rev']);
  });

  it('leaves every other measured family UNKNOWN until Task 4', () => {
    // One representative string per family from RECON §1.2, so a pattern added
    // later cannot quietly start claiming a family that owes evidence.
    for (const s of [
      'CA State Controller — Government Compensation in California (publicpay.ca.gov)',
      'Virginia APA Comparative Report',
      'Transparent Utah',
      // The three MA DLS families moved OUT of this list when MA-01 evidenced
      // them; 'Acushnet — MA DLS Schedule A — Special Revenue Funds' stays
      // unclassified on purpose and has its own test above.
      'Wisconsin State CAFR — General Fund Revenue (FY2000 actual, pre-GASB-34 combined statement basis)',
      // The sixteen city/state ACFR families moved OUT of this list when
      // ACFR-GF-CLASSIFICATION-RECON.md evidenced them — same reason the three
      // MA DLS families did above. The representative string that used to sit
      // here, 'City of Tucson ACFR — General Fund Expenditure by Function', is
      // now asserted in the state-acfr-gf over-reach test to be claimed by
      // `az-muni-acfr-gf`.
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
