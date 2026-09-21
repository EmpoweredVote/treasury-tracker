import { describe, it, expect } from 'vitest';
import config from '../vitest.config.ts';

/**
 * Guards the safe default test timeout.
 *
 * ⚠⚠ WHY A TEST FOR A CONFIG LINE. This repo has fixed the same flake four
 * times — SCOPE-02, #145, 2026-09-11, and four more files found on 2026-09-21 —
 * each time by adding an explicit timeout to whichever test had just gone red,
 * leaving every sibling exposed. The recurrence is structural: a filesystem
 * test's duration is a property of the machine, and the next one written has to
 * REMEMBER to carry a timeout, which is the defect's own shape.
 *
 * The default in vitest.config.ts is what makes that memory unnecessary. This
 * test exists so removing it is a deliberate act with a red suite attached,
 * rather than a quiet edit that reintroduces an intermittent red six months
 * from now — by which time nobody will connect the two.
 *
 * ⚠ It asserts a FLOOR, not an exact value. Raising the default is fine;
 * dropping it back toward vitest's 5,000ms is the regression.
 */

/** Idle duration of the slowest known I/O-bound test, measured 2026-09-21. */
const SLOWEST_IDLE_MS = 2_646; // loadOhioAOS: FY2024 dry-run batch
/** Observed slowdown factor under disk contention (reference_ci_and_io_test_timeouts). */
const CONTENTION_FACTOR = 8;

describe('vitest default testTimeout', () => {
  it('is set at all — the 5,000ms default is what the flake rides on', () => {
    expect(config.test?.testTimeout).toBeTypeOf('number');
  });

  it('clears the slowest known I/O test at the observed contention factor', () => {
    // 2,646ms x 8 = 21,168ms. A default below that leaves the class exposed.
    expect(config.test?.testTimeout).toBeGreaterThanOrEqual(SLOWEST_IDLE_MS * CONTENTION_FACTOR);
  });

  it('is not so long that a genuinely hung test wedges the suite', () => {
    // Upper bound is judgement, not measurement: long enough for disk
    // contention, short enough that a real hang still fails in under a minute.
    expect(config.test?.testTimeout).toBeLessThanOrEqual(60_000);
  });
});
