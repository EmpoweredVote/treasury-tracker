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
  const calls = { ran: [], skipped: [], timeouts: [] };
  const f = (name, fn, timeout) => { calls.ran.push(name); calls.timeouts.push(timeout); };
  f.skip = (name, fn, timeout) => { calls.skipped.push(name); calls.timeouts.push(timeout); };
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

  // ⚠⚠ THE HELPER USED TO DROP THE TIMEOUT ARGUMENT, SILENTLY.
  // `archiveIt` took only (name, fn), so a third argument went nowhere. On
  // 2026-10-12 `nyOsc.test.mjs > normalises both eras` timed out at 32,753ms
  // against the 30s global; the fix vitest.config.ts prescribes is a call-site
  // budget, `}, 60_000)` — and in the files using this helper that fix CANNOT
  // WORK and says nothing when it fails. The author reads a green suite and
  // believes the test is protected. Proven with `npx vitest run
  // --testTimeout=1`: the test still died at 1ms with its budget in place,
  // while every test using a plain `it` survived.
  it('forwards a call-site timeout to vitest, present or skipped', () => {
    const [itFn, ran] = fakeIt();
    const present = makeArchiveIt({ have: true, itFn });
    present('slow', () => {}, 60_000);
    expect(ran.timeouts).toEqual([60_000]);

    const [itFn2, skipped] = fakeIt();
    const absent = makeArchiveIt({ have: false, itFn: itFn2 });
    absent('slow', () => {}, 120_000);
    expect(skipped.timeouts).toEqual([120_000]);
  });

  it('passes no timeout when the call site gives none', () => {
    const [itFn, calls] = fakeIt();
    const archiveIt = makeArchiveIt({ have: true, itFn });
    archiveIt('ordinary', () => {});
    expect(calls.timeouts).toEqual([undefined]);
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
    // (see the timeout-forwarding tests above for the 2026-10-12 defect)
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
