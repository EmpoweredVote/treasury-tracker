/**
 * useAnimatedCounter — smooth count-up animation using requestAnimationFrame.
 *
 * @remarks
 * Callers MUST wrap `onComplete` in `useCallback` with stable deps, otherwise
 * the animation will restart on every render because `onComplete` appears in the
 * effect dependency array.
 *
 * @example
 * const handleComplete = useCallback(() => { console.log('done'); }, []);
 * const displayed = useAnimatedCounter(total, 600, handleComplete);
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Cubic ease-out: starts fast, decelerates toward target.
 * t must be in [0, 1]; returns a value in [0, 1].
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a numeric value from its previous value to `target` over `duration` ms.
 *
 * @param target   - The destination numeric value.
 * @param duration - Animation duration in milliseconds (default 600).
 * @param onComplete - Optional callback invoked once when animation reaches target.
 * @returns The current interpolated display value (a raw number, not formatted).
 */
export function useAnimatedCounter(
  target: number,
  duration: number = 600,
  onComplete?: () => void,
): number {
  // Initialize display to target so the very first render shows the real value,
  // not a flash from 0 → target on mount.
  const [display, setDisplay] = useState<number>(target);

  // Remembers the previous target across renders without causing re-renders.
  const prevRef = useRef<number>(target);

  // Stores the in-flight requestAnimationFrame id so cleanup can cancel it.
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Nothing to animate if the value hasn't changed.
    if (target === prevRef.current) return;

    const startValue = prevRef.current;
    const delta = target - startValue;
    const startTime = performance.now();

    // Cancel any animation already running for a previous transition.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const current = startValue + delta * eased;

      setDisplay(current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Snap to exact target to eliminate floating-point residue.
        setDisplay(target);
        prevRef.current = target;
        rafRef.current = null;
        onComplete?.();
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    // Cleanup: cancel in-flight frame if the component unmounts or deps change
    // before the animation completes.
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, duration, onComplete]);

  return display;
}
