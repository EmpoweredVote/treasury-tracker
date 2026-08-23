import { describe, it, expect } from 'vitest';
import { createRequestSequence } from './latestRequest';

/**
 * ⚠ UAT 2026-08-22 (G6). The loader effect in App.tsx applied every response it
 * received, with no cancellation guard. Choosing a year the selected series does
 * not cover produced TWO loads: one for the year the reader picked (which
 * correctly resolves to "absent in this series") and, after the clamp relocated
 * them, one for the year that IS covered. The second came back from the module
 * cache almost immediately; the first came back from the network afterwards and
 * overwrote the good state with its own absent flags.
 *
 * The screen was then self-contradictory: the year control and URL read FY 2018,
 * a year the derived series covers, while both tiles claimed the figure was not
 * published in that series and the chart drew nothing.
 *
 * Deterministic, not flaky — the cached response ALWAYS wins the race, so the
 * stale one always lands last. React components cannot be tested in this repo
 * (vitest runs `environment: 'node'` and never collects `.test.tsx`), so the
 * ordering rule lives in a pure module where it can be.
 */
describe('createRequestSequence', () => {
  it('applies a lone response', () => {
    const seq = createRequestSequence();
    const isLatest = seq.claim();
    expect(isLatest()).toBe(true);
  });

  it('DISCARDS a superseded response even when it lands last', async () => {
    // The Brisbane sequence exactly: FY2017 claimed first and resolves last.
    const seq = createRequestSequence();
    const applied: string[] = [];

    const fy2017IsLatest = seq.claim();   // reader picks FY2017 — goes to the network
    const fy2018IsLatest = seq.claim();   // clamp moves them — served from cache

    await Promise.resolve();
    if (fy2018IsLatest()) applied.push('fy2018-good');
    if (fy2017IsLatest()) applied.push('fy2017-absent');

    expect(applied).toEqual(['fy2018-good']);
  });

  it('keeps only the most recent claim live across several supersessions', () => {
    const seq = createRequestSequence();
    const a = seq.claim();
    const b = seq.claim();
    const c = seq.claim();
    expect([a(), b(), c()]).toEqual([false, false, true]);
  });

  it('gives each sequence its own state', () => {
    // One sequence per effect: the tiles loader must not invalidate the chart
    // loader's in-flight request.
    const one = createRequestSequence();
    const two = createRequestSequence();
    const oneClaim = one.claim();
    two.claim();
    expect(oneClaim()).toBe(true);
  });
});
