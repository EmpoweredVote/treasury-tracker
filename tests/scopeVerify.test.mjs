import { describe, it, expect } from 'vitest';
import {
  pctChange, detectSeams, findDuplicateScopes, checkRequiredSeams,
  figureDigest, compositeDigest, REQUIRED_SEAMS,
  findIllegalDuplicates, checkSeamsClosed, frozenIdDigest, classifyFrozenDrift,
  SEAMS_CLOSED_BY_SCOPE_02, SEAMS_OPEN_BY_SOURCE_COVERAGE, classifyDuplicates,
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

describe('detectSeams once a city-year can hold TWO rows (post-SCOPE-02)', () => {
  // SCOPE-02 Task 9 widened the unique index to include (fund_scope, basis), so a
  // (city, dataset, period) series may now hold more than one row per fiscal year.
  // detectSeams was written against the OLD index and assumed one row per year: it
  // walked the list pairwise, so two rows of the SAME year were compared to each
  // other and reported as a seam with fy_gap 0. Measured against the live table
  // that produced 12 spurious seams out of 40, and made the output depend on the
  // order rows came back from PostgREST.

  it('does NOT report a seam between two rows of the SAME fiscal year', () => {
    // A seam is a change ACROSS time. Two rows in one year are the intended
    // SCOPE-02 pair (SCO all-funds actuals beside the city's own adopted budget);
    // findIllegalDuplicates owns that case, and deliberately permits it.
    const seams = detectSeams([
      row({ fiscal_year: 2024, fund_scope: SCOPE.ALL_FUNDS, basis: 'actual', total_budget: 1474000000 }),
      row({ id: 'x', fiscal_year: 2024, fund_scope: SCOPE.UNKNOWN, basis: 'adopted', total_budget: 774000000 }),
    ]);
    expect(seams).toEqual([]);
  });

  it('reports NO seam when a scope continues across the boundary — the Fresno case', () => {
    // Task 10 backfilled all_funds/actual into FY2020, so all_funds now runs
    // FY2019 -> FY2020 continuously. The reader has an unbroken same-scope series;
    // that the year ALSO carries an unknown-scope adopted row does not break it.
    const seams = detectSeams([
      row({ id: 'a', fiscal_year: 2019, fund_scope: SCOPE.ALL_FUNDS, total_budget: 822_000_000 }),
      row({ id: 'b', fiscal_year: 2020, fund_scope: SCOPE.ALL_FUNDS, total_budget: 874_000_000 }),
      row({ id: 'c', fiscal_year: 2020, fund_scope: SCOPE.UNKNOWN, total_budget: 452_000_000 }),
    ]);
    expect(seams).toEqual([]);
  });

  it('STILL reports a seam when the years share no scope — the Long Beach case', () => {
    // SCO ends at FY2024 and the adopted rows begin FY2025, so nothing can be
    // backfilled and the seam is genuinely open. This must not be silenced.
    const seams = detectSeams([
      row({ id: 'a', fiscal_year: 2024, fund_scope: SCOPE.ALL_FUNDS, total_budget: 3015653000 }),
      row({ id: 'b', fiscal_year: 2025, fund_scope: SCOPE.UNKNOWN, total_budget: 755369580 }),
    ]);
    expect(seams).toHaveLength(1);
    expect(seams[0].from_scope).toBe(SCOPE.ALL_FUNDS);
    expect(seams[0].to_scope).toBe(SCOPE.UNKNOWN);
    expect(seams[0].pct).toBeCloseTo(-74.95, 1);
  });

  it('is INDEPENDENT of row order when a year holds two rows', () => {
    // The old pairwise walk picked whichever row PostgREST happened to return
    // first, so reversing the fetch changed which seams were reported.
    const rows = [
      row({ id: 'a', fiscal_year: 2019, fund_scope: SCOPE.ALL_FUNDS }),
      row({ id: 'b', fiscal_year: 2020, fund_scope: SCOPE.ALL_FUNDS }),
      row({ id: 'c', fiscal_year: 2020, fund_scope: SCOPE.UNKNOWN }),
      row({ id: 'd', fiscal_year: 2021, fund_scope: SCOPE.UNKNOWN }),
      row({ id: 'e', fiscal_year: 2021, fund_scope: SCOPE.ALL_FUNDS }),
    ];
    const key = (s) => `${s.from_fy}->${s.to_fy}:${s.from_scope}->${s.to_scope}`;
    expect(detectSeams(rows).map(key)).toEqual(detectSeams([...rows].reverse()).map(key));
  });

  it('reports BOTH scopes when a multi-row year genuinely is a seam', () => {
    // Disjoint on both sides: FY2024 holds general_fund + all_funds, FY2025 holds
    // only unknown. Nothing continues, so it is a real seam, and the report must
    // not pretend the year had a single scope.
    const seams = detectSeams([
      row({ id: 'a', fiscal_year: 2024, fund_scope: SCOPE.ALL_FUNDS, total_budget: 900 }),
      row({ id: 'b', fiscal_year: 2024, fund_scope: SCOPE.GENERAL_FUND, total_budget: 300 }),
      row({ id: 'c', fiscal_year: 2025, fund_scope: SCOPE.UNKNOWN, total_budget: 250 }),
    ]);
    expect(seams).toHaveLength(1);
    expect(seams[0].from_scopes).toEqual(['all_funds', 'general_fund']);
    expect(seams[0].from_scope).toBe('all_funds+general_fund');
    expect(seams[0].multi_row).toBe(true);
    // the representative total is the largest-magnitude row of the year
    expect(seams[0].from_total).toBe(900);
  });

  it('keeps fy_gap meaning what it always meant, and never emits 0', () => {
    const seams = detectSeams([
      row({ id: 'a', fiscal_year: 2001, fund_scope: SCOPE.UNKNOWN }),
      row({ id: 'b', fiscal_year: 2003, fund_scope: SCOPE.GENERAL_FUND }),
      row({ id: 'c', fiscal_year: 2003, fund_scope: SCOPE.GENERAL_FUND, period_label: 'TQ' }),
    ]);
    expect(seams.every((s) => s.fy_gap >= 1)).toBe(true);
    expect(seams[0].fy_gap).toBe(2);
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

describe('classifyDuplicates', () => {
  const grp = (labels) => ({
    name: 'United States', fiscal_year: 1976, dataset_type: 'operating', basis: 'unknown',
    rows: labels.length, detail: labels.map((period_label) => ({ period_label, total_budget: 1 })),
  });

  it('treats the federal FY1976 annual + Transition Quarter pair as a PERIOD SPLIT', () => {
    // The US moved its fiscal year from a July start to an October start in 1976,
    // so OMB published both FY1976 and a Jul-Sep Transition Quarter. Two
    // non-overlapping periods from two evidenced sources are not a duplicate.
    const { illegal, periodSplit } = classifyDuplicates([grp([null, 'Transition Quarter (Jul–Sep 1976)'])]);
    expect(illegal).toEqual([]);
    expect(periodSplit).toHaveLength(1);
  });

  it('treats two rows sharing a period_label as ILLEGAL — a real double-count', () => {
    const { illegal, periodSplit } = classifyDuplicates([grp([null, null])]);
    expect(illegal).toHaveLength(1);
    expect(periodSplit).toEqual([]);
  });

  it('is fatal when three rows hold only two distinct periods', () => {
    const { illegal } = classifyDuplicates([grp(['Q1', 'Q2', 'Q2'])]);
    expect(illegal).toHaveLength(1);
  });

  it('keeps every finding — classification never drops one', () => {
    const input = [grp([null, 'TQ']), grp([null, null]), grp(['Q1', 'Q2', 'Q3'])];
    const { illegal, periodSplit, scopeSplit } = classifyDuplicates(input);
    expect(illegal.length + periodSplit.length + (scopeSplit?.length ?? 0)).toBe(input.length);
  });

  // ── SCOPE-04 ──────────────────────────────────────────────────────────────
  //
  // ⚠ SCOPE-02's rule was "two rows sharing a basis is a genuine double-count
  // hazard WHATEVER their scopes", and it was right when the only legal pair was
  // an actuals row beside an adopted-budget row. SCOPE-04 deliberately creates
  // actual+actual at TWO DIFFERENT SCOPES for the same city-year — a published
  // all_funds row and a derived total_governmental one — on 7,650 rows. The
  // detector firing on all of them is the assertion being wrong, not the data;
  // this is the same shape as SCOPE-01's findDuplicateScopes going stale when
  // SCOPE-02 created its first legal pair.
  const scopeGrp = (scopes) => ({
    name: 'Modesto', fiscal_year: 2024, dataset_type: 'operating', basis: 'actual',
    rows: scopes.length,
    detail: scopes.map((fund_scope) => ({ fund_scope, period_label: null, total_budget: 1 })),
  });

  it('treats one all_funds row beside one total_governmental row as a SCOPE SPLIT', () => {
    const { illegal, scopeSplit } = classifyDuplicates([scopeGrp(['all_funds', 'total_governmental'])]);
    expect(illegal).toEqual([]);
    expect(scopeSplit).toHaveLength(1);
  });

  it('is still fatal when two rows share BOTH scope and period', () => {
    // The unique index forbids this, which is exactly why the detector must keep
    // reporting it — a guard that only ever sees legal data is a guard nobody has
    // tested.
    const { illegal, scopeSplit } = classifyDuplicates([scopeGrp(['all_funds', 'all_funds'])]);
    expect(illegal).toHaveLength(1);
    expect(scopeSplit).toEqual([]);
  });

  it('is fatal when three rows hold only two distinct scopes', () => {
    const { illegal } = classifyDuplicates([
      scopeGrp(['all_funds', 'total_governmental', 'total_governmental'])]);
    expect(illegal).toHaveLength(1);
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

  it('accepts a narrower expected set without disturbing the default', () => {
    const longBeach = [{ name: 'Long Beach', dataset_type: 'operating', from_fy: 2024, to_fy: 2025, pct: -75 }];
    // against all seven it is still open, so not ok...
    expect(checkSeamsClosed(longBeach).ok).toBe(false);
    // ...but it is not one of the four SCOPE-02 actually closed.
    expect(checkSeamsClosed(longBeach, SEAMS_CLOSED_BY_SCOPE_02).ok).toBe(true);
  });
});

describe('which of the seven SCOPE-02 could close', () => {
  // The seven split cleanly, and the split is the difference between a harness
  // that shouts "DETECTOR BROKEN" on a successful milestone and one worth reading.
  it('partitions the seven with no overlap and nothing dropped', () => {
    const closed = SEAMS_CLOSED_BY_SCOPE_02.map((s) => s.name);
    const open = SEAMS_OPEN_BY_SOURCE_COVERAGE.map((s) => s.name);
    expect(closed).toEqual(['Riverside', 'Santa Ana', 'Oakland', 'Fresno']);
    expect(open).toEqual(['Long Beach', 'Anaheim', 'Bakersfield']);
    expect([...closed, ...open].sort()).toEqual(REQUIRED_SEAMS.map((s) => s.name).sort());
    expect(closed.filter((n) => open.includes(n))).toEqual([]);
  });

  it('the three that stay open are exactly the ones whose seam lands after SCO ends', () => {
    // SCO publishes through FY2024. A seam INTO FY2025 cannot be closed by loading
    // anything, because there is nothing to load. That is the whole criterion.
    expect(SEAMS_OPEN_BY_SOURCE_COVERAGE.every((s) => s.to_fy === 2025)).toBe(true);
    expect(SEAMS_CLOSED_BY_SCOPE_02.every((s) => s.to_fy <= 2024)).toBe(true);
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

/**
 * The authorised-correction ledger.
 *
 * ⚠ WHY THIS EXISTS. `figures_frozen` became UNRECONSTRUCTABLE TWICE in one week
 * — rebased at v2.30 after the LA-02 withdrawals, and broken again five days
 * later. The second time, part of the cause was PR #83: Dallas rendered a $0
 * total against ~$17B of correct line items, and fixing it CHANGED a frozen
 * row's figure.
 *
 * That is the invariant firing on TT's best work. Finding and correcting wrong
 * figures is the mission; an invariant that treats every correction as
 * corruption is one people learn to ignore — which the baseline records
 * happening across v2.27, v2.28 and v2.29.
 *
 * The ledger resolves it: a correction is RECORDED with the value it replaced,
 * and the digest keeps hashing the OLD value. The original hash therefore keeps
 * verifying across authorised corrections, forever, and no rebase is needed.
 * An UNrecorded change still moves the digest — that is the whole point.
 */
describe('frozenIdDigest — the authorised-correction ledger', () => {
  const rowsBefore = [{ id: 'a', total_budget: 1 }, { id: 'b', total_budget: 2 }];
  const rowsAfter = [{ id: 'a', total_budget: 1 }, { id: 'b', total_budget: 999 }];

  it('holds the digest steady across a LEDGERED correction', () => {
    const before = frozenIdDigest(rowsBefore, []);
    const after = frozenIdDigest(rowsAfter, [], new Map([['b', 2]]));
    expect(after).toBe(before);
  });

  it('still moves for an UNLEDGERED change — the guard must not go soft', () => {
    const before = frozenIdDigest(rowsBefore, []);
    const after = frozenIdDigest(rowsAfter, [], new Map());
    expect(after).not.toBe(before);
  });

  it('a ledger entry for the wrong row does not mask a real change', () => {
    const before = frozenIdDigest(rowsBefore, []);
    const after = frozenIdDigest(rowsAfter, [], new Map([['a', 1]]));
    expect(after).not.toBe(before);
  });

  it('accepts the old value as a string, since total_budget arrives as text', () => {
    const before = frozenIdDigest(rowsBefore, []);
    const after = frozenIdDigest(rowsAfter, [], new Map([['b', '2']]));
    expect(after).toBe(before);
  });

  it('is backward compatible — omitting the ledger behaves exactly as before', () => {
    expect(frozenIdDigest(rowsBefore, ['new'])).toBe(frozenIdDigest(rowsBefore, ['new'], new Map()));
  });

  // An excluded row is not frozen at all, so a ledger entry for it is meaningless
  // and must not resurrect it into the digest.
  it('ignores a ledger entry for an excluded row', () => {
    const a = frozenIdDigest([{ id: 'a', total_budget: 1 }], ['x']);
    const b = frozenIdDigest([{ id: 'a', total_budget: 1 }, { id: 'x', total_budget: 5 }],
      ['x'], new Map([['x', 4]]));
    expect(b).toBe(a);
  });
});

/**
 * Telling the two failures apart.
 *
 * ⚠ WHY. The harness reported ONE message for both — "a row that existed at
 * v2.24 changed or vanished" — when the actual condition was usually that a
 * milestone forgot its created-ids file. That message is alarming, unactionable,
 * and points at the wrong thing, so the rational response is to stop reading it.
 * The baseline records exactly that outcome across v2.27, v2.28 and v2.29.
 *
 * The harness already HAS the numbers needed to distinguish them. It just never
 * used them.
 */
describe('classifyFrozenDrift', () => {
  const ok = { nonExcludedCount: 100, frozenRowCount: 100, digest: 'x', expectedDigest: 'x' };

  it('passes when the count and the digest both agree', () => {
    expect(classifyFrozenDrift(ok).kind).toBe('ok');
  });

  it('names UNREGISTERED ROWS when more rows are hashed than were frozen', () => {
    const v = classifyFrozenDrift({ ...ok, nonExcludedCount: 254, digest: 'y' });
    expect(v.kind).toBe('unregistered_rows');
    expect(v.deficit).toBe(154);
    expect(v.message).toMatch(/154/);
    // It must say what to DO, naming the mechanism.
    expect(v.message).toMatch(/created-ids|excluded_ids_files/i);
  });

  it('names MISSING ROWS when rows have vanished', () => {
    const v = classifyFrozenDrift({ ...ok, nonExcludedCount: 90, digest: 'y' });
    expect(v.kind).toBe('missing_rows');
    expect(v.deficit).toBe(-10);
    expect(v.message).toMatch(/10/);
  });

  // ⚠ THE ONE THAT MATTERS. Only when the count reconciles is a digest mismatch
  // actually evidence that a surviving figure moved. Reporting this when the
  // count is off is what taught everyone to ignore the check.
  it('reports a FIGURE CHANGE only when the count reconciles', () => {
    const v = classifyFrozenDrift({ ...ok, digest: 'different' });
    expect(v.kind).toBe('figure_changed');
    expect(v.message).toMatch(/ledger/i);
  });

  it('does not cry figure_changed when the count is off, even though the digest also differs', () => {
    expect(classifyFrozenDrift({ ...ok, nonExcludedCount: 254, digest: 'y' }).kind)
      .not.toBe('figure_changed');
  });

  it('treats a matching digest as ok even if a caller passes no expected digest', () => {
    expect(classifyFrozenDrift({ ...ok, expectedDigest: null }).kind).toBe('ok');
  });
});
