import { describe, it, expect } from 'vitest';
import { makeArchiveIt } from './support/nyOscArchive.mjs';

/**
 * The skip warning used to carry a HARDCODED count. It said "4 archive-backed
 * tests SKIPPED" while CI actually skipped 11, because tests were added next
 * to it without anyone updating the digit. A number maintained by hand beside
 * a growing list will drift again, so it is derived — and this is the test
 * that keeps it derived.
 */

/** A stand-in for vitest's `it`, so the factory can be exercised directly. */
function fakeIt() {
  const calls = { ran: [], skipped: [] };
  const f = (name) => { calls.ran.push(name); };
  f.skip = (name) => { calls.skipped.push(name); };
  return [f, calls];
}

describe('makeArchiveIt', () => {
  it('counts every test it skipped, however many there are', () => {
    const [itFn] = fakeIt();
    const archiveIt = makeArchiveIt({ have: false, itFn });
    for (const n of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) archiveIt(n, () => {});
    expect(archiveIt.skippedCount()).toBe(7);
  });

  it('puts that real count in the warning, not a literal', () => {
    const [itFn] = fakeIt();
    const archiveIt = makeArchiveIt({ have: false, itFn });
    archiveIt('one', () => {});
    archiveIt('two', () => {});
    const msg = archiveIt.warningText();
    expect(msg).toMatch(/\b2 archive-backed tests SKIPPED/);
    expect(msg).toContain('scripts/fetchNyOsc.mjs');
  });

  it('skips nothing and warns nothing when the archive is present', () => {
    const [itFn, calls] = fakeIt();
    const archiveIt = makeArchiveIt({ have: true, itFn });
    archiveIt('one', () => {});
    archiveIt('two', () => {});
    expect(calls.ran).toEqual(['one', 'two']);
    expect(calls.skipped).toEqual([]);
    expect(archiveIt.skippedCount()).toBe(0);
    expect(archiveIt.warningText()).toBeNull();
  });

  it('keeps each test file\'s count separate', () => {
    // Two files must not share a counter, or each would report the other's
    // skips as its own.
    const [itA] = fakeIt();
    const [itB] = fakeIt();
    const a = makeArchiveIt({ have: false, itFn: itA });
    const b = makeArchiveIt({ have: false, itFn: itB });
    a('one', () => {});
    b('one', () => {});
    b('two', () => {});
    expect(a.skippedCount()).toBe(1);
    expect(b.skippedCount()).toBe(2);
  });
});
