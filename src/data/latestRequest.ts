/**
 * One-line answer to "is this response still the one we asked for?"
 *
 * ⚠ Why this exists: the loader effects in App.tsx applied every response they
 * received. Two loads for the same view are ordinary here — choosing a year the
 * selected series does not cover starts one load for the chosen year and, once
 * the clamp relocates the reader, another for the covered year — and the second
 * is usually served from the module cache while the first is still on the
 * network. The stale response then landed last and stamped its own state over
 * the good one, leaving the year control reading FY 2018 while both tiles
 * claimed the figure was not published in the selected series. Found by UAT
 * 2026-08-22 (G6).
 *
 * A React cleanup flag (`let cancelled = false`) is the usual shape for this,
 * and it cannot be tested in this repo at all: vitest runs `environment: 'node'`
 * and never collects `.test.tsx`, so there are no component tests to catch a
 * regression. Keeping the rule in a pure module buys a real guard —
 * `latestRequest.test.ts` reproduces the Brisbane ordering directly.
 *
 * Usage, one sequence per effect:
 *
 *   const seq = useRef(createRequestSequence()).current;
 *   useEffect(() => {
 *     const isLatest = seq.claim();
 *     load().then((data) => { if (!isLatest()) return; setState(data); });
 *   }, [deps]);
 */
export interface RequestSequence {
  /**
   * Claim the next slot. The returned predicate answers true only while this
   * claim is still the most recent one — so a superseded response can check it
   * and drop itself, whatever order the promises settle in.
   */
  claim: () => () => boolean;
}

export function createRequestSequence(): RequestSequence {
  let issued = 0;
  return {
    claim() {
      const mine = ++issued;
      return () => mine === issued;
    },
  };
}
