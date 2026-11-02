import { describe, it, expect } from 'vitest';
import {
  compareExclusionSources, compareExclusionUnions,
} from '../scripts/lib/frozenMirrorDrift.mjs';

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
 * ⭐⭐ 2026-10-31, the SECOND investigation this tool caused rather than closed.
 *
 * It reported 81 drifting ids — 19 under `bloomingtonSalariesBackfillCreatedIds`
 * and 62 under `liveSyncExcludedIds` — and syncing the mirror did not clear
 * them, because nothing was wrong. Measured locally over all 64 files and
 * 521,052 distinct ids: EXACTLY 81 ids are listed in more than one repo file,
 * and `liveSyncExcludedIds.json` holds all 81 of them. The arithmetic ties —
 * the 62 is scope04 30 + scope02 12 + weho 12 + postV224 4 + sfWiden 4.
 *
 * ⚠⚠ THE OVERLAP IS BY DESIGN and [[reference_frozen_figure_invariant]] says
 * so: `liveSyncExcludedIds.json` is a SCOPE file, "a complete statement of its
 * own scope, not a diff", so it overlaps the milestone PROVENANCE files. The
 * mirror stores each id ONCE — `syncFrozenInvariantState.mjs` dedupes it or the
 * insert dies on the primary key — and attributes it to one file. Comparing
 * FILE BY FILE then reads the other file's copy as missing from the database.
 *
 * Everything unions into a Set before any invariant is computed, so the only
 * question that means anything is whether the two UNIONS agree.
 */
describe('compareExclusionUnions', () => {
  // The exact shape above, reduced: '2' is listed twice, the mirror holds it once.
  it('is silent when an id listed in two repo files is stored once in the mirror', () => {
    const baseline = { excluded_ids_files: ['scope.json', 'milestone.json'] };
    const mirror = new Map([['scope.json', new Set(['1', '2'])]]);
    const read = (f) => ({ 'scope.json': ['1', '2'], 'milestone.json': ['2'] }[f] ?? null);
    expect(compareExclusionUnions(baseline, mirror, read)).toEqual({ onlyRepo: [], onlyDb: [] });
  });

  // ⚠ The mirror may attribute a shared id to EITHER file. Per-file comparison
  // calls this one 'only-in-db' on milestone.json and therefore BLOCKING, which
  // is the false positive that stops a registration that should proceed.
  it('is silent when the mirror attributes a shared id to the other file', () => {
    const baseline = { excluded_ids_files: ['scope.json', 'milestone.json'] };
    const mirror = new Map([['milestone.json', new Set(['2'])], ['scope.json', new Set(['1'])]]);
    const read = (f) => ({ 'scope.json': ['1', '2'], 'milestone.json': ['2'] }[f] ?? null);
    expect(compareExclusionUnions(baseline, mirror, read)).toEqual({ onlyRepo: [], onlyDb: [] });
  });

  // ⚠⚠ THE UNMERGED-PR FINDING MUST SURVIVE THIS CHANGE. A file the database
  // has and the checkout does not still contributes its ids to the db union.
  it('still names ids the database has and no repo file lists', () => {
    const baseline = { excluded_ids_files: ['a.json', 'pr.json'] };
    const mirror = new Map([['a.json', new Set(['1'])], ['pr.json', new Set(['9', '10'])]]);
    const read = (f) => ({ 'a.json': ['1'] }[f] ?? null);
    expect(compareExclusionUnions(baseline, mirror, read)).toEqual({ onlyRepo: [], onlyDb: ['9', '10'] });
  });

  it('names ids a repo file lists and the mirror holds nowhere at all', () => {
    const baseline = { excluded_ids_files: ['a.json'] };
    const mirror = new Map([['a.json', new Set(['1'])]]);
    const read = (f) => ({ 'a.json': ['1', '2'] }[f] ?? null);
    expect(compareExclusionUnions(baseline, mirror, read)).toEqual({ onlyRepo: ['2'], onlyDb: [] });
  });
});

/**
 * The per-file breakdown stays — it is how a reader finds WHICH file to fix —
 * but it has to say which of its differences are mere attribution, or the next
 * reader runs the same investigation a third time.
 */
describe('compareExclusionSources attribution', () => {
  it('marks an only-in-repo id the mirror holds under another file', () => {
    const baseline = { excluded_ids_files: ['scope.json', 'milestone.json'] };
    const mirror = new Map([['scope.json', new Set(['1', '2'])]]);
    const read = (f) => ({ 'scope.json': ['1', '2'], 'milestone.json': ['2'] }[f] ?? null);
    const drift = compareExclusionSources(baseline, mirror, read);
    expect(drift).toHaveLength(1);
    expect(drift[0].file).toBe('milestone.json');
    expect(drift[0].onlyRepo).toEqual(['2']);
    expect(drift[0].attributedElsewhere).toEqual(['2']);
  });

  it('leaves an id the mirror holds nowhere unmarked', () => {
    const baseline = { excluded_ids_files: ['a.json'] };
    const mirror = new Map([['a.json', new Set(['1'])]]);
    const read = (f) => ({ 'a.json': ['1', '2'] }[f] ?? null);
    const drift = compareExclusionSources(baseline, mirror, read);
    expect(drift[0].onlyRepo).toEqual(['2']);
    expect(drift[0].attributedElsewhere).toEqual([]);
  });
});
