import { useState } from 'react';

/**
 * Run `adjust` DURING RENDER whenever any of `deps` changes (compared with
 * Object.is, like effect deps). Not on the first render. `adjust` receives the
 * deps as they were the last time it ran (or at mount).
 *
 * This is React's documented replacement for an effect whose body resets state
 * when its inputs change ("Adjusting some state when a prop changes",
 * react.dev/learn/you-might-not-need-an-effect). `adjust` may call this
 * component's own state setters; React discards the render in progress and
 * re-renders with the adjusted state before anything is committed.
 *
 * ⚠ Same decisions as the effect it replaces, made one step EARLIER. The effect
 * committed a frame with the stale value and then corrected it, and every other
 * effect of that frame (URL sync, loaders) ran against the stale value too. Here
 * the stale frame is never committed. Nothing else changes: `adjust` sees the
 * same inputs, in the same order, as the effect body did.
 *
 * ⚠ `adjust` must converge. If it changes one of its own `deps`, it runs again
 * on the re-render, exactly as the effect re-ran on the next commit; a value
 * that never settles loops here just as it looped there.
 */
export function useAdjustOnChange<const D extends readonly unknown[]>(
  deps: D,
  adjust: (previous: D) => void,
): void {
  const [seen, setSeen] = useState(deps);
  if (seen.length !== deps.length || seen.some((v, i) => !Object.is(v, deps[i]))) {
    setSeen(deps);
    adjust(seen);
  }
}
