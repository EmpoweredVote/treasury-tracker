import { describe, it, expect } from 'vitest';
import { compareExclusionSources, splitLiveAndStale } from '../scripts/lib/frozenMirrorDrift.mjs';

/**
 * ⭐ The 2026-10-31 investigation, pinned.
 *
 * `verify:frozen` reported 20 new rows; `registerCreatedRows` computed a
 * deficit of 24 and refused to write, with a message that reads as "your load
 * is wrong". Nothing about the load was wrong. The four extra rows belonged to
 * an UNMERGED pull request whose data had already been loaded to production:
 * the rows were live and in the database mirror, and their bookkeeping files
 * existed only on that PR's branch.
 *
 * Production running ahead of `main` by an unmerged load is normal here, so
 * this shape needs a name rather than an investigation every time.
 */
describe('compareExclusionSources', () => {
  const baseline = { excluded_ids_files: ['a.json', 'b.json'] };

  it('is silent when the two lists agree', () => {
    const mirror = new Map([['a.json', new Set(['1', '2'])], ['b.json', new Set(['3'])]]);
    const read = (f) => ({ 'a.json': ['1', '2'], 'b.json': ['3'] }[f] ?? null);
    expect(compareExclusionSources(baseline, mirror, read)).toEqual([]);
  });

  // ⚠⚠ THE UNMERGED-PR SHAPE. The file is in the database mirror and listed in
  // the baseline of the branch that created it — but absent from the checkout
  // doing the comparison. This is what made the deficit read 4 too high.
  it('names a file the database has and the checkout does not', () => {
    const mirror = new Map([['a.json', new Set(['1', '2'])], ['pr.json', new Set(['9', '10'])]]);
    const read = (f) => ({ 'a.json': ['1', '2'] }[f] ?? null);
    const drift = compareExclusionSources({ excluded_ids_files: ['a.json', 'pr.json'] }, mirror, read);
    expect(drift).toHaveLength(1);
    expect(drift[0].file).toBe('pr.json');
    expect(drift[0].missingFile).toBe(true);
    expect(drift[0].onlyDb).toEqual(['9', '10']);
  });

  // ⚠ The other half of the same PR: a file that EXISTS in both but whose repo
  // copy is behind the mirror. scope04CreatedIds.json was 7,650 on main and
  // 7,652 in the database, because two derived rows were loaded on a branch.
  it('names ids the database has and the file is behind on', () => {
    const mirror = new Map([['a.json', new Set(['1', '2', '3'])], ['b.json', new Set(['4'])]]);
    const read = (f) => ({ 'a.json': ['1', '2'], 'b.json': ['4'] }[f] ?? null);
    const drift = compareExclusionSources(baseline, mirror, read);
    expect(drift).toHaveLength(1);
    expect(drift[0].onlyDb).toEqual(['3']);
    expect(drift[0].onlyRepo).toEqual([]);
  });

  it('names ids the file has and the database was never told about', () => {
    const mirror = new Map([['a.json', new Set(['1'])], ['b.json', new Set(['4'])]]);
    const read = (f) => ({ 'a.json': ['1', '2'], 'b.json': ['4'] }[f] ?? null);
    const drift = compareExclusionSources(baseline, mirror, read);
    expect(drift[0].onlyRepo).toEqual(['2']);
  });

  it('flags a mirror file nobody listed in the baseline', () => {
    const mirror = new Map([['a.json', new Set(['1', '2'])], ['b.json', new Set(['4'])], ['rogue.json', new Set(['7'])]]);
    const read = (f) => ({ 'a.json': ['1', '2'], 'b.json': ['4'], 'rogue.json': ['7'] }[f] ?? null);
    const drift = compareExclusionSources(baseline, mirror, read);
    expect(drift.map((d) => d.file)).toEqual(['rogue.json']);
    expect(drift[0].unlisted).toBe(true);
  });
});

/**
 * ⚠⚠ The headline count misleads unless these are separated. On 2026-10-31 the
 * raw drift was 85 ids and only FOUR could move anything: the rest were ids of
 * rows that no longer exist. Reporting 85 would send the next reader hunting
 * for 85 rows that are not there.
 */
describe('splitLiveAndStale', () => {
  const drift = [{ file: 'a.json', onlyRepo: ['stale1', 'stale2'], onlyDb: ['live1'] }];

  it('counts only ids that still exist as budget rows as live', () => {
    expect(splitLiveAndStale(drift, new Set(['live1']))).toEqual({ live: 1, stale: 2 });
  });

  it('calls everything stale when no id survives', () => {
    expect(splitLiveAndStale(drift, new Set())).toEqual({ live: 0, stale: 3 });
  });

  it('is zero on both counts when nothing drifts', () => {
    expect(splitLiveAndStale([], new Set(['x']))).toEqual({ live: 0, stale: 0 });
  });
});
