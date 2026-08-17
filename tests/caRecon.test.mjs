/**
 * CA-CITIES-01 cross-source reconciliation.
 *
 * This is the gate that decides whether an audited ACFR figure overwrites a
 * State Controller figure already in production. It is a pure function on
 * purpose, so the decision logic is provable before any PDF exists.
 *
 * The property these tests exist to pin down is the FAILURE DIRECTION: every
 * way this can go wrong must resolve toward "do not overwrite". An empty
 * catalogue, a malformed rule, a rule that throws, a zero denominator — none of
 * them may wave a year through.
 */

import { describe, it, expect } from 'vitest';
import { reconcile, BUCKET } from '../scripts/lib/caRecon.mjs';
import { auditReconCompleteness } from '../scripts/verify-ca-recon.mjs';

const cal = {
  tieAbs: 1000,
  tiePct: 0.001,
  depthRatio: 0.5,
  structural: [
    {
      id: 'TRANSFERS-OUT',
      note: 'SCO folds transfers out into expenditure',
      test: (c) => c.unmatchedSco.includes('Transfers Out'),
    },
  ],
};

const tree = (total, cats, lineItemCount) => ({
  total,
  categories: cats.map(([name, amount]) => ({ name, amount })),
  lineItemCount,
});

describe('reconcile — bucketing', () => {
  it('calls an exact match a tie', () => {
    const r = reconcile(tree(100, [['Police', 100]], 5), tree(100, [['Police', 100]], 5), cal);
    expect(r.bucket).toBe(BUCKET.TIE);
    expect(r.deltaAbs).toBe(0);
    expect(r.loadable).toBe(true);
  });

  it('calls a delta inside the absolute threshold a tie', () => {
    const r = reconcile(tree(100_900, [['Police', 100_900]], 5), tree(100_000, [['Police', 100_000]], 5), cal);
    expect(r.bucket).toBe(BUCKET.TIE);
  });

  it('calls a large-city delta inside the percentage threshold a tie', () => {
    // $500M city, $400k delta: over tieAbs, under tiePct. Both thresholds apply,
    // or every large city fails on a rounding-scale difference.
    const r = reconcile(
      tree(500_400_000, [['Police', 500_400_000]], 5),
      tree(500_000_000, [['Police', 500_000_000]], 5),
      cal
    );
    expect(r.bucket).toBe(BUCKET.TIE);
  });

  it('explains a divergence that matches a registered structural reason', () => {
    const acfr = tree(90_000, [['Police', 90_000]], 5);
    const sco = tree(120_000, [['Police', 90_000], ['Transfers Out', 30_000]], 6);
    const r = reconcile(acfr, sco, cal);
    expect(r.bucket).toBe(BUCKET.EXPLAINED);
    expect(r.reason).toBe('TRANSFERS-OUT');
    expect(r.loadable).toBe(true);
  });

  it('leaves an unmatched divergence UNEXPLAINED and unloadable', () => {
    const r = reconcile(tree(90_000, [['Police', 90_000]], 5), tree(120_000, [['Police', 120_000]], 5), cal);
    expect(r.bucket).toBe(BUCKET.UNEXPLAINED);
    expect(r.reason).toBeNull();
    expect(r.loadable).toBe(false);
  });

  it('defaults to UNEXPLAINED when the calibration has no rules yet', () => {
    // The safety property: an empty catalogue must block, never wave through.
    const empty = { ...cal, structural: [] };
    const r = reconcile(tree(90_000, [['Police', 90_000]], 5), tree(120_000, [['Police', 120_000]], 5), empty);
    expect(r.bucket).toBe(BUCKET.UNEXPLAINED);
  });

  it('does not let a throwing structural rule pass a year', () => {
    const bad = {
      ...cal,
      structural: [{ id: 'BOOM', note: 'x', test: () => { throw new Error('bang'); } }],
    };
    const r = reconcile(tree(90_000, [['Police', 90_000]], 5), tree(120_000, [['Police', 120_000]], 5), bad);
    expect(r.bucket).toBe(BUCKET.UNEXPLAINED);
  });

  it('survives a zero SCO total without dividing by zero, and does not call it a tie', () => {
    // $500 against nothing is a 100% divergence, not a small absolute delta.
    // Letting tieAbs carry this would tie every year where SCO reported nothing.
    const r = reconcile(tree(500, [['Police', 500]], 1), tree(0, [], 0), cal);
    expect(Number.isFinite(r.deltaPct)).toBe(true);
    expect(r.bucket).toBe(BUCKET.UNEXPLAINED);
  });
});

describe('reconcile — the depth flag is orthogonal to the bucket', () => {
  it('flags a tie whose ACFR is materially coarser than the SCO row it would replace', () => {
    // Modesto's real shape: SCO FY2024 operating is 32 categories / 83 line items.
    const acfr = tree(100, [['Current', 100]], 6);
    const sco = tree(100, Array.from({ length: 32 }, (_, i) => [`Cat${i}`, i]), 83);
    const r = reconcile(acfr, sco, cal);
    expect(r.bucket).toBe(BUCKET.TIE);
    expect(r.depthFlag).toBe(true);
    expect(r.loadable).toBe(false); // held pending an explicit call
  });

  it('does not flag depth when the ACFR is at least as granular', () => {
    const acfr = tree(100, [['A', 50], ['B', 50]], 40);
    const sco = tree(100, [['A', 50], ['B', 50]], 39);
    expect(reconcile(acfr, sco, cal).depthFlag).toBe(false);
  });
});

describe('recon completeness harness', () => {
  /**
   * This is the check that can fail quietly. Every arithmetic gate in this repo
   * verifies the rows that ARE there; none of them can see a city-year that was
   * never examined, because an unexamined year is indistinguishable from one
   * that passed. So completeness is asserted directly.
   */
  const overlaps = [
    { city: 'Modesto', fy: 2024, dataset: 'operating' },
    { city: 'Modesto', fy: 2024, dataset: 'revenue' },
  ];

  it('passes when every overlapping city-year is bucketed', () => {
    const recon = overlaps.map((o) => ({ ...o, bucket: 'TIE', loadable: true }));
    expect(auditReconCompleteness(overlaps, recon, []).ok).toBe(true);
  });

  it('fails when an overlapping city-year is silently absent', () => {
    const recon = [{ ...overlaps[0], bucket: 'TIE', loadable: true }];
    const r = auditReconCompleteness(overlaps, recon, []);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([{ city: 'Modesto', fy: 2024, dataset: 'revenue' }]);
  });

  it('fails when an UNEXPLAINED year was loaded anyway', () => {
    const recon = overlaps.map((o) => ({ ...o, bucket: 'UNEXPLAINED', loadable: false }));
    const loaded = [{ city: 'Modesto', fy: 2024, dataset: 'operating' }];
    const r = auditReconCompleteness(overlaps, recon, loaded);
    expect(r.ok).toBe(false);
    expect(r.wronglyLoaded).toHaveLength(1);
  });

  it('fails when a loaded year has no recon entry at all', () => {
    // The bypass case: something wrote a row without ever reconciling it.
    const r = auditReconCompleteness(overlaps, [], [{ city: 'Modesto', fy: 2024, dataset: 'operating' }]);
    expect(r.ok).toBe(false);
    expect(r.wronglyLoaded).toHaveLength(1);
    expect(r.missing).toHaveLength(2);
  });

  it('tallies buckets so a run can be read at a glance', () => {
    const recon = [
      { ...overlaps[0], bucket: 'TIE', loadable: true },
      { ...overlaps[1], bucket: 'UNEXPLAINED', loadable: false },
    ];
    expect(auditReconCompleteness(overlaps, recon, []).counts).toEqual({
      TIE: 1,
      EXPLAINED: 0,
      UNEXPLAINED: 1,
      depthFlagged: 0,
    });
  });
});

describe('reconcile — reporting', () => {
  it('lists unmatched categories on both sides rather than dropping them', () => {
    const acfr = tree(100, [['Police', 60], ['Library', 40]], 2);
    const sco = tree(100, [['Police', 60], ['Parks', 40]], 2);
    const r = reconcile(acfr, sco, cal);
    expect(r.unmatchedAcfr).toEqual(['Library']);
    expect(r.unmatchedSco).toEqual(['Parks']);
  });
});
