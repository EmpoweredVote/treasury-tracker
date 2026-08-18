import { describe, it, expect } from 'vitest';
import {
  pctChange, detectSeams, findDuplicateScopes, checkRequiredSeams,
  figureDigest, compositeDigest, REQUIRED_SEAMS,
  findIllegalDuplicates, checkSeamsClosed, frozenIdDigest,
} from '../scripts/lib/scopeVerify.mjs';
import { SCOPE } from '../scripts/lib/fundScope.mjs';

const row = (o) => ({
  id: o.id ?? `id-${o.municipality_id}-${o.fiscal_year}-${o.dataset_type}-${o.period_label ?? ''}`,
  municipality_id: 'm1', name: 'Testville', state: 'CA', dataset_type: 'operating',
  period_label: null, fund_scope: SCOPE.UNKNOWN, total_budget: 100, data_source: 'src', ...o,
});

describe('pctChange', () => {
  it('computes a signed percentage', () => {
    expect(pctChange(200, 50)).toBe(-75);
    expect(pctChange(100, 120)).toBeCloseTo(20);
  });

  it('returns null rather than Infinity when the base is zero or absent', () => {
    expect(pctChange(0, 50)).toBeNull();
    expect(pctChange(null, 50)).toBeNull();
    expect(pctChange('nonsense', 50)).toBeNull();
  });
});

describe('detectSeams', () => {
  it('flags a change INTO unknown — the property the seven CA cities depend on', () => {
    // Every one of the seven is all_funds -> unknown. A detector that only compared
    // two KNOWN scopes would report zero and look clean, which is the bug this
    // test exists to prevent.
    const seams = detectSeams([
      row({ fiscal_year: 2024, fund_scope: SCOPE.ALL_FUNDS, total_budget: 3015653000 }),
      row({ fiscal_year: 2025, fund_scope: SCOPE.UNKNOWN, total_budget: 755369580 }),
    ]);
    expect(seams).toHaveLength(1);
    expect(seams[0].from_scope).toBe(SCOPE.ALL_FUNDS);
    expect(seams[0].to_scope).toBe(SCOPE.UNKNOWN);
    expect(seams[0].pct).toBeCloseTo(-74.95, 1);
    expect(seams[0].involves_unknown).toBe(true);
  });

  it('flags a change OUT OF unknown too', () => {
    const seams = detectSeams([
      row({ fiscal_year: 2001, fund_scope: SCOPE.UNKNOWN }),
      row({ fiscal_year: 2002, fund_scope: SCOPE.GENERAL_FUND }),
    ]);
    expect(seams).toHaveLength(1);
    expect(seams[0].involves_unknown).toBe(true);
  });

  it('does not flag a stable series', () => {
    expect(detectSeams([
      row({ fiscal_year: 2022, fund_scope: SCOPE.ALL_FUNDS }),
      row({ fiscal_year: 2023, fund_scope: SCOPE.ALL_FUNDS }),
      row({ fiscal_year: 2024, fund_scope: SCOPE.ALL_FUNDS }),
    ])).toEqual([]);
  });

  it('spans a fiscal-year gap rather than letting it hide a seam', () => {
    // FY2009 is missing from several real CA series. Consecutive means consecutive
    // IN THE DATA, and the gap width is reported so it can be judged.
    const seams = detectSeams([
      row({ fiscal_year: 2001, fund_scope: SCOPE.UNKNOWN }),
      row({ fiscal_year: 2003, fund_scope: SCOPE.GENERAL_FUND }),
    ]);
    expect(seams).toHaveLength(1);
    expect(seams[0].fy_gap).toBe(2);
  });

  it('keeps period_label series separate so a Transition Quarter invents no seam', () => {
    const seams = detectSeams([
      row({ fiscal_year: 1976, fund_scope: SCOPE.ALL_FUNDS, period_label: null }),
      row({ fiscal_year: 1976, fund_scope: SCOPE.UNKNOWN, period_label: 'Transition Quarter' }),
      row({ fiscal_year: 1977, fund_scope: SCOPE.ALL_FUNDS, period_label: null }),
    ]);
    expect(seams).toEqual([]);
  });

  it('does not compare across entities or datasets', () => {
    expect(detectSeams([
      row({ municipality_id: 'm1', fiscal_year: 2024, fund_scope: SCOPE.ALL_FUNDS }),
      row({ municipality_id: 'm2', fiscal_year: 2025, fund_scope: SCOPE.GENERAL_FUND }),
      row({ dataset_type: 'revenue', fiscal_year: 2025, fund_scope: SCOPE.GENERAL_FUND }),
    ])).toEqual([]);
  });
});

describe('checkRequiredSeams', () => {
  it('names all seven CA cities as required', () => {
    expect(REQUIRED_SEAMS.map((s) => s.name)).toEqual([
      'Long Beach', 'Anaheim', 'Riverside', 'Santa Ana', 'Oakland', 'Fresno', 'Bakersfield',
    ]);
  });

  it('FAILS when a required seam is missing — a short count condemns the detector', () => {
    const r = checkRequiredSeams([]);
    expect(r.ok).toBe(false);
    expect(r.results.every((x) => !x.found)).toBe(true);
  });

  it('fails when the magnitude drifts beyond tolerance, not just when absent', () => {
    const seams = [{
      name: 'Long Beach', dataset_type: 'operating', from_fy: 2024, to_fy: 2025, pct: -10,
      from_scope: SCOPE.ALL_FUNDS, to_scope: SCOPE.UNKNOWN,
    }];
    const r = checkRequiredSeams(seams);
    const lb = r.results.find((x) => x.name === 'Long Beach');
    expect(lb.found).toBe(false);
    expect(lb.reason).toMatch(/differs from -75/);
  });
});

describe('findDuplicateScopes', () => {
  it('reads zero when every city-year holds one scope', () => {
    expect(findDuplicateScopes([
      row({ fiscal_year: 2024, fund_scope: SCOPE.ALL_FUNDS }),
      row({ fiscal_year: 2025, fund_scope: SCOPE.UNKNOWN }),
    ])).toEqual([]);
  });

  it('fires when one city-year holds two scopes — the mutation test', () => {
    // This is the guard SCOPE-02 will move off zero. It is exercised here because
    // a guard first run against the data it polices is a guard nobody has tested.
    const dupes = findDuplicateScopes([
      row({ fiscal_year: 1976, fund_scope: SCOPE.UNKNOWN, period_label: null }),
      row({ fiscal_year: 1976, fund_scope: SCOPE.ALL_FUNDS, period_label: 'Transition Quarter' }),
    ]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].scopes).toEqual(['all_funds', 'unknown']);
    expect(dupes[0].rows).toBe(2);
  });

  it('groups WITHOUT period_label, so a TQ double-count cannot hide', () => {
    // If period_label were part of the grouping key, the case above would split
    // into two single-scope buckets and report clean. Asserted so nobody "fixes"
    // the grouping by adding it.
    const dupes = findDuplicateScopes([
      row({ fiscal_year: 1976, fund_scope: SCOPE.GENERAL_FUND, period_label: 'A' }),
      row({ fiscal_year: 1976, fund_scope: SCOPE.ALL_FUNDS, period_label: 'B' }),
    ]);
    expect(dupes).toHaveLength(1);
  });
});

describe('the two digests', () => {
  const base = [
    row({ id: 'a', fiscal_year: 2024, total_budget: 100 }),
    row({ id: 'b', fiscal_year: 2025, total_budget: 200 }),
  ];

  it('are stable for identical input regardless of row order', () => {
    expect(figureDigest(base)).toBe(figureDigest([...base].reverse()));
    expect(compositeDigest(base)).toBe(compositeDigest([...base].reverse()));
  });

  it('figureDigest MOVES when a figure changes — it is the invariant', () => {
    const moved = [base[0], { ...base[1], total_budget: 201 }];
    expect(figureDigest(moved)).not.toBe(figureDigest(base));
  });

  it('figureDigest is IMMUNE to a dataset_type relabel', () => {
    // The whole point. The VA APA revenue rows were relabelled
    // revenue -> revenue_local_only by migration 20260817000200, and no figure
    // moved. A figure digest that flinched at that would be useless.
    const relabelled = base.map((r) => ({ ...r, dataset_type: 'revenue_local_only' }));
    expect(figureDigest(relabelled)).toBe(figureDigest(base));
  });

  it('compositeDigest DOES move on a relabel — that is its job', () => {
    const relabelled = base.map((r) => ({ ...r, dataset_type: 'revenue_local_only' }));
    expect(compositeDigest(relabelled)).not.toBe(compositeDigest(base));
  });

  it('figureDigest is immune to a period_label change too', () => {
    const relabelled = base.map((r) => ({ ...r, period_label: 'Transition Quarter' }));
    expect(figureDigest(relabelled)).toBe(figureDigest(base));
  });

  it('treats a null total_budget as distinct from zero', () => {
    const withNull = [base[0], { ...base[1], total_budget: null }];
    const withZero = [base[0], { ...base[1], total_budget: 0 }];
    expect(figureDigest(withNull)).not.toBe(figureDigest(withZero));
  });
});

const r = (over = {}) => ({
  id: 'id-1', municipality_id: 'm1', name: 'Testville', state: 'CA',
  fiscal_year: 2024, dataset_type: 'operating', period_label: null,
  fund_scope: 'all_funds', basis: 'actual', total_budget: 100, data_source: 'SCO', ...over,
});

describe('findIllegalDuplicates — inverted from SCOPE-01', () => {
  it('ALLOWS the pair this milestone exists to create', () => {
    const rows = [r(), r({ id: 'id-2', fund_scope: 'general_fund', basis: 'adopted', total_budget: 25 })];
    expect(findIllegalDuplicates(rows)).toEqual([]);
  });

  it('REJECTS two rows sharing a (city-year, dataset, basis) — a real double-count', () => {
    const rows = [r(), r({ id: 'id-2', fund_scope: 'general_fund', total_budget: 25 })];
    expect(findIllegalDuplicates(rows)).toHaveLength(1);
  });

  it('REJECTS two identical rows outright', () => {
    expect(findIllegalDuplicates([r(), r({ id: 'id-2' })])).toHaveLength(1);
  });

  it('still groups ACROSS period_label, so the FY1976 TQ hazard stays visible', () => {
    const rows = [
      r({ fiscal_year: 1976, period_label: null }),
      r({ id: 'id-2', fiscal_year: 1976, period_label: 'Transition Quarter (Jul–Sep 1976)' }),
    ];
    expect(findIllegalDuplicates(rows)).toHaveLength(1);
  });
});

describe('checkSeamsClosed', () => {
  it('passes when none of the seven is present', () => {
    expect(checkSeamsClosed([]).ok).toBe(true);
  });
  it('fails when one of the seven is still there', () => {
    const seams = [{ name: 'Long Beach', dataset_type: 'operating', from_fy: 2024, to_fy: 2025, pct: -75 }];
    const res = checkSeamsClosed(seams);
    expect(res.ok).toBe(false);
    expect(res.stillOpen.map((s) => s.name)).toContain('Long Beach');
  });
  it('does NOT fail on a seam outside the seven — the other 19 must still be found', () => {
    const seams = [{ name: 'Nevada', dataset_type: 'operating', from_fy: 2023, to_fy: 2024, pct: -57.5 }];
    expect(checkSeamsClosed(seams).ok).toBe(true);
  });
});

describe('frozenIdDigest — exclusion-based (Chris\'s inversion of the brief)', () => {
  // The parameter is EXCLUDED ids (rows the backfill created), not an inclusion
  // list of everything frozen at v2.24 -- created_at can't identify that set
  // (NULL on 79,899/79,927 rows) and committing all 79,927 ids would be a ~3MB
  // permanent artifact. The digest covers every row NOT in the excluded set.
  const excludedIds = ['new'];

  it('ignores rows created after the freeze (the excluded ones)', () => {
    const before = frozenIdDigest([{ id: 'a', total_budget: 1 }, { id: 'b', total_budget: 2 }], excludedIds);
    const after = frozenIdDigest(
      [{ id: 'a', total_budget: 1 }, { id: 'b', total_budget: 2 }, { id: 'new', total_budget: 9 }],
      excludedIds,
    );
    expect(after).toBe(before);
  });

  it('moves when a frozen row\'s figure changes', () => {
    const a = frozenIdDigest([{ id: 'a', total_budget: 1 }, { id: 'b', total_budget: 2 }], excludedIds);
    const b = frozenIdDigest([{ id: 'a', total_budget: 1 }, { id: 'b', total_budget: 3 }], excludedIds);
    expect(b).not.toBe(a);
  });

  it('moves when a frozen row DISAPPEARS', () => {
    const a = frozenIdDigest([{ id: 'a', total_budget: 1 }, { id: 'b', total_budget: 2 }], excludedIds);
    const b = frozenIdDigest([{ id: 'a', total_budget: 1 }], excludedIds);
    expect(b).not.toBe(a);
  });
});
