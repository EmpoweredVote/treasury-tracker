import { describe, it, expect } from 'vitest';

import { chunkForIn, IN_MAX_COUNT, IN_MAX_ENCODED } from '../scripts/lib/inChunks.mjs';

/**
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * `scripts/stampBudgetAxes.mjs` wrote its classification axes in chunks of 200
 * data_source strings and died partway through a live run:
 *
 *     wrote basis=actual for ny-osc-city (6357 rows)
 *     Error: write basis for ny-osc-municipal: Bad Request
 *
 * PostgREST sends `.in(...)` as a URL QUERY STRING, so what costs is a chunk's
 * ENCODED LENGTH, never its member count. The `ny-osc-municipal` strings
 * average 104 characters and carry an em dash and two commas apiece — each one
 * encodes to well over 200 bytes — so 200 of them exceed the request-line
 * limit and the server refuses the whole update. 200 of the `state-acfr-gf`
 * strings, averaging 75 characters, fit; that is why the same constant worked
 * for twenty families and failed for the twenty-first.
 *
 * ⚠⚠ THE FAILURE MODE IS A PARTIAL WRITE, NOT A CLEAN ONE. The run had already
 * committed twenty-three families when it threw. Nothing was left WRONG that
 * time — the remaining families already held the values the run would have
 * rewritten — but a sweep that stops in the middle of a partitioned write is
 * one changed value away from leaving the table disagreeing with the registry,
 * which is the whole condition the partition gate exists to prevent.
 *
 * Found 2026-10-28 running the SCOPE-02 stamper for the Alaska basis entry.
 */

/** Shaped like the strings that actually broke it. */
const NY = (n) => Array.from({ length: n }, (_, i) =>
  `New York OSC Town Annual Financial Report — Revenues, General Fund (FY${2000 + (i % 26)} actual, self-reported) #${i}`);

/** Shaped like the strings that fit, so the fix must not over-split them. */
const SHORT = (n) => Array.from({ length: n }, (_, i) => `src-${i}`);

const encodedCost = (chunk) => chunk.reduce((a, s) => a + encodeURIComponent(s).length + 3, 0);

describe('chunkForIn — a chunk is bounded by ENCODED LENGTH, not member count', () => {
  it('⭐ splits the strings that broke the live run', () => {
    const chunks = chunkForIn(NY(372));
    expect(chunks.length).toBeGreaterThan(2); // count-only chunking gave 2
    for (const c of chunks) expect(encodedCost(c)).toBeLessThanOrEqual(IN_MAX_ENCODED);
  });

  it('⭐⭐ loses nothing and duplicates nothing, in the original order', () => {
    // The property that matters most. A chunker that dropped a string would
    // leave those rows unstamped and SILENT — the partition gate reads the
    // registry, not the table, so it could not catch it.
    const input = NY(372);
    expect(chunkForIn(input).flat()).toEqual(input);
    const short = SHORT(1000);
    expect(chunkForIn(short).flat()).toEqual(short);
  });

  it('still respects the member-count cap for short strings', () => {
    const chunks = chunkForIn(SHORT(1000));
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(IN_MAX_COUNT);
    // Short strings are nowhere near the byte budget, so the count cap governs
    // and the chunking is unchanged from what it always was.
    expect(chunks.length).toBe(Math.ceil(1000 / IN_MAX_COUNT));
  });

  it('never emits an empty chunk', () => {
    for (const n of [0, 1, 2, 199, 200, 201, 372, 1000]) {
      for (const c of chunkForIn(NY(n))) expect(c.length).toBeGreaterThan(0);
    }
    expect(chunkForIn([])).toEqual([]);
  });

  it('gives a single over-budget string a chunk of its own rather than dropping it', () => {
    // It cannot be split, and refusing it silently would be the one outcome
    // worse than a Bad Request.
    const huge = 'x'.repeat(IN_MAX_ENCODED * 2);
    const chunks = chunkForIn(['a', huge, 'b']);
    expect(chunks.flat()).toEqual(['a', huge, 'b']);
    expect(chunks.some((c) => c.length === 1 && c[0] === huge)).toBe(true);
  });

  it('honours caller-supplied bounds', () => {
    expect(chunkForIn(SHORT(10), 3).map((c) => c.length)).toEqual([3, 3, 3, 1]);
    expect(chunkForIn(SHORT(10), 100, 1).length).toBe(10);
  });
});
