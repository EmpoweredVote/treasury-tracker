/**
 * The invariant nobody was asserting: a budget's headline total must equal the
 * sum of its own root categories.
 *
 * ⚠⚠ 1,765 Ohio rows ship a total that contradicts their own tree, and 13 of
 * them publish a NEGATIVE total — worst Huber Heights FY2024 at −$35,461,443
 * against roots summing to +$10,483,560. None of it was caught by anything;
 * it surfaced while looking at an unrelated $1 budget in Indiana.
 *
 * ⚠ This gate is a RATCHET, not a pass/fail. Failing outright on 1,765 known
 * rows would be a red light nobody can turn green, which is a light people
 * learn to ignore. It fails on a REGRESSION and reports an improvement.
 */

import { describe, it, expect } from 'vitest';
import { classifyBudgetTie, summarizeTies, summarizeCounts } from '../scripts/lib/totalsTie.mjs';

describe('classifyBudgetTie', () => {
  it('ties when the total equals the sum of root categories', () => {
    expect(classifyBudgetTie({ total: 500, rootSum: 500, nRoots: 2 })).toBe('ties');
  });

  it('tolerates a rounding dollar, and no more', () => {
    // ⚠ Amounts are stored as integers, so the only legitimate gap is a
    // rounding artefact. A $2 gap is a real disagreement.
    expect(classifyBudgetTie({ total: 500, rootSum: 501, nRoots: 1 })).toBe('ties');
    expect(classifyBudgetTie({ total: 500, rootSum: 502, nRoots: 1 })).toBe('mismatch');
  });

  it('calls a budget with NO root categories rootless, not a mismatch', () => {
    // ⚠ "No tree at all" is a different defect from "the tree disagrees", and
    // folding them together would hide both. CA SCO has 12 rootless rows.
    expect(classifyBudgetTie({ total: 500, rootSum: 0, nRoots: 0 })).toBe('rootless');
  });

  it('is a mismatch when the total contradicts the tree', () => {
    expect(classifyBudgetTie({ total: -35461443, rootSum: 10483560, nRoots: 2 }))
      .toBe('mismatch');
  });

  it('still ties a legitimately tiny budget', () => {
    // ⚠ Victoria Woods (IN) and Cold Spring Township (PA) each report $1 with
    // a single $1 root. Thin is not broken, and the gate must not say it is.
    expect(classifyBudgetTie({ total: 1, rootSum: 1, nRoots: 1 })).toBe('ties');
  });
});

describe('summarizeTies', () => {
  const rows = (n, source) => Array.from({ length: n }, () => ({
    source, total: 10, rootSum: 99, nRoots: 2,
  }));

  it('counts mismatches per source', () => {
    const r = summarizeTies([...rows(3, 'Ohio'), ...rows(1, 'MN')], { Ohio: 3, MN: 1 });
    expect(r.bySource.Ohio).toBe(3);
    expect(r.bySource.MN).toBe(1);
    expect(r.regressions).toHaveLength(0);
  });

  it('REGRESSES when a source exceeds its baseline', () => {
    const r = summarizeTies(rows(4, 'Ohio'), { Ohio: 3 });
    expect(r.regressions).toEqual([{ source: 'Ohio', baseline: 3, actual: 4 }]);
    expect(r.ok).toBe(false);
  });

  it('REGRESSES when a source breaks that had no baseline at all', () => {
    // ⚠ A new source quietly joining the broken set is the case a bare total
    // would hide, because another source improving could mask it.
    const r = summarizeTies(rows(1, 'Georgia'), { Ohio: 3 });
    expect(r.regressions).toEqual([{ source: 'Georgia', baseline: 0, actual: 1 }]);
    expect(r.ok).toBe(false);
  });

  it('reports an improvement without failing, so the baseline can be lowered', () => {
    const r = summarizeTies(rows(1, 'Ohio'), { Ohio: 3 });
    expect(r.ok).toBe(true);
    expect(r.improvements).toEqual([{ source: 'Ohio', baseline: 3, actual: 1 }]);
  });

  it('counts negative totals separately from mismatches', () => {
    // ⚠ A negative headline is indefensible even if it tied its own tree, so
    // it gets its own count and its own baseline.
    const r = summarizeTies(
      [{ source: 'Ohio', total: -5, rootSum: -5, nRoots: 1 }], { Ohio: 0 }, { Ohio: 1 },
    );
    expect(r.negatives.Ohio).toBe(1);
    expect(r.ok).toBe(true);
  });

  it('REGRESSES on a new negative total', () => {
    const r = summarizeTies(
      [{ source: 'Ohio', total: -5, rootSum: -5, nRoots: 1 }], { Ohio: 0 }, { Ohio: 0 },
    );
    expect(r.ok).toBe(false);
    expect(r.regressions).toEqual([{ source: 'Ohio', baseline: 0, actual: 1, kind: 'negative' }]);
  });
});

/**
 * ⚠ The database returns per-source COUNTS, not rows: the aggregate spans
 * 585,587 budgets and all their categories. Both paths must ratchet
 * identically, so the comparison lives in ONE place and `summarizeCounts`
 * feeds it the same shape `summarizeTies` builds from rows. A second copy of
 * the rule is how two declarations drift apart.
 */
describe('summarizeCounts — the RPC path ratchets the same way', () => {
  it('passes when every source is at its baseline', () => {
    const r = summarizeCounts(
      [{ source: 'Ohio', mismatches: 1765, negatives: 13, rootless: 38 }],
      { Ohio: 1765 }, { Ohio: 13 },
    );
    expect(r.ok).toBe(true);
    expect(r.total).toBe(1765);
    expect(r.rootless.Ohio).toBe(38);
  });

  it('REGRESSES when mismatches grow', () => {
    const r = summarizeCounts(
      [{ source: 'Ohio', mismatches: 1766, negatives: 13, rootless: 0 }],
      { Ohio: 1765 }, { Ohio: 13 },
    );
    expect(r.ok).toBe(false);
    expect(r.regressions).toEqual([{ source: 'Ohio', baseline: 1765, actual: 1766 }]);
  });

  it('REGRESSES when a negative total appears in a clean source', () => {
    const r = summarizeCounts(
      [{ source: 'Georgia', mismatches: 0, negatives: 1, rootless: 0 }], {}, {},
    );
    expect(r.ok).toBe(false);
    expect(r.regressions).toEqual([{ source: 'Georgia', baseline: 0, actual: 1, kind: 'negative' }]);
  });

  it('reports an improvement without failing', () => {
    const r = summarizeCounts(
      [{ source: 'Ohio', mismatches: 0, negatives: 0, rootless: 0 }],
      { Ohio: 1765 }, { Ohio: 13 },
    );
    expect(r.ok).toBe(true);
    expect(r.improvements).toEqual([{ source: 'Ohio', baseline: 1765, actual: 0 }]);
  });

  it('does not gate rootless rows — a check register has no tree by design', () => {
    const r = summarizeCounts(
      [{ source: 'Plano Check Register FY2024', mismatches: 0, negatives: 0, rootless: 1 }], {}, {},
    );
    expect(r.ok).toBe(true);
  });
});
