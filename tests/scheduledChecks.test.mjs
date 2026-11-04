/**
 * Judging scheduled-gate verdicts.
 *
 * ⚠⚠ The two failure modes under test both LOOK LIKE SUCCESS, which is why
 * they are tested at all: a check that stopped running leaves its last good
 * verdict behind, and a check that never ran returns no row to be red.
 */
import { describe, it, expect } from 'vitest';
import { judgeScheduledChecks } from '../scripts/lib/scheduledChecks.mjs';

const ok = (name) => ({ check_name: name, ran_at: '2026-11-04T03:12:00Z', ok: true, stale: false, detail: 'clean' });

describe('judgeScheduledChecks', () => {
  it('passes when every expected check is fresh and ok', () => {
    const r = judgeScheduledChecks([ok('a'), ok('b')], ['a', 'b']);
    expect(r).toEqual({ ok: true, faults: [] });
  });

  it('fails a check whose verdict is not ok', () => {
    const rows = [ok('a'), { ...ok('b'), ok: false, detail: '6 duplicate root labels' }];
    const r = judgeScheduledChecks(rows, ['a', 'b']);
    expect(r.ok).toBe(false);
    expect(r.faults).toEqual([{ check_name: 'b', kind: 'failing', detail: '6 duplicate root labels' }]);
  });

  // ⚠⚠⚠ The one that matters most: ok === true and it is STILL a failure.
  it('fails a STALE verdict even though it says ok', () => {
    const rows = [{ ...ok('a'), stale: true }];
    const r = judgeScheduledChecks(rows, ['a']);
    expect(r.ok).toBe(false);
    expect(r.faults[0]).toMatchObject({ check_name: 'a', kind: 'stale' });
    expect(r.faults[0].detail).toMatch(/pg_cron job has stopped/);
  });

  it('prefers stale over failing when a verdict is both', () => {
    const rows = [{ ...ok('a'), ok: false, stale: true }];
    const r = judgeScheduledChecks(rows, ['a']);
    expect(r.faults).toHaveLength(1);
    expect(r.faults[0].kind).toBe('stale');   // the job stopped; its verdict is moot
  });

  // ⚠⚠⚠ The second: an absent check is absent from the list, so nothing is red.
  it('fails an expected check that has NEVER recorded a verdict', () => {
    const r = judgeScheduledChecks([ok('a')], ['a', 'never-ran']);
    expect(r.ok).toBe(false);
    expect(r.faults).toEqual([
      { check_name: 'never-ran', kind: 'absent', detail: 'no verdict has ever been recorded — inconclusive, not a pass' },
    ]);
  });

  it('reports every absent check, not just the first', () => {
    const r = judgeScheduledChecks([], ['a', 'b', 'c']);
    expect(r.faults.map((f) => f.check_name)).toEqual(['a', 'b', 'c']);
  });

  // ⚠ Watching nothing is not the same as everything being fine.
  it('fails when there is nothing to watch at all', () => {
    const r = judgeScheduledChecks([], []);
    expect(r.ok).toBe(false);
    expect(r.faults[0].detail).toMatch(/watching NOTHING/);
  });

  it('tolerates null input without pretending it passed', () => {
    expect(judgeScheduledChecks(null, null).ok).toBe(false);
    expect(judgeScheduledChecks(undefined, ['a']).faults[0]).toMatchObject({ kind: 'absent' });
  });

  it('does not fault a check that is present but unexpected', () => {
    // A new check appearing is news, not a failure — it has a verdict and it is ok.
    const r = judgeScheduledChecks([ok('a'), ok('brand-new')], ['a']);
    expect(r.ok).toBe(true);
  });
});
