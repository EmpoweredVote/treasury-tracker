import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * ⚠ `useLayoutEffect` warns when React renders on the server, and this repo's
 * only way to test a component is `renderToStaticMarkup` (see
 * `no-component-tests-vitest`). Layout effects do not run there at all, so the
 * hook swaps itself out rather than emitting a warning into every test run.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Measure an element's rendered width, and keep measuring as it changes.
 *
 * Returns `[ref, width]`, where `width` is `null` until the first measurement
 * lands. ⚠ Callers must treat `null` as "not known yet" and render something
 * sensible — NOT as zero. `segmentLabelFit.ts` is the worked example.
 *
 * ⚠ The measurement runs in a LAYOUT effect, so it happens before the browser
 * paints: the chart does not visibly re-label itself one frame after it appears.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ⚠ `setState` with an identical number bails out of re-rendering, which is
    // what keeps a per-frame observer from looping. Nothing this width feeds
    // changes the width back — label visibility cannot resize the container —
    // so there is no feedback edge to break.
    const measure = () => setWidth(el.getBoundingClientRect().width || null);
    measure();

    // ⚠ Falls back to window resizes where ResizeObserver is absent. That misses
    // a container that changes width WITHOUT the window changing (a sidebar
    // opening), which is the honest limit of the fallback rather than a bug.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
