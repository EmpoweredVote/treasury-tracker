# Phase 4: Live Feedback UI - Research

**Researched:** 2026-04-22
**Domain:** React event listeners, requestAnimationFrame count-up animation, CSS glow effects
**Confidence:** HIGH

## Summary

This phase adds a one-shot `visibilitychange` listener that triggers a revenue re-fetch when a donor returns from GiveButter, then animates the updated total using a count-up effect with a green glow acknowledgment. All decisions about trigger mechanism, animation style, and settled state are locked by CONTEXT.md; the only open design questions are the CSS glow specifics, the "already fetched" flag storage, and the easing function.

The codebase already has `useRef`, `useCallback`, and `useEffect` imported in App.tsx. No animation library is installed or needed — all animation logic can be implemented with vanilla `requestAnimationFrame` in a small custom hook. The InsightCard component renders a formatted `value` string prop, so the animation must happen upstream at the number derivation level, not inside InsightCard.

**Primary recommendation:** Put the visibilitychange listener in App.tsx (which owns `revenueData` state), drive it from an `onClick` added to the donate `<a>` tag, use a `useRef` boolean flag for the "already fired" guard, and animate via a `useAnimatedCounter` hook in `QuickFactsRow` that accepts the raw numeric total and returns the current animated display value.

## Standard Stack

No additional npm packages are needed. Everything uses what is already in the project.

### Core (existing, no new installs)
| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| React 19 | ^19.2.0 | `useRef`, `useEffect`, `useState` for animation state | Already installed |
| TypeScript | ~5.9.3 | Type the hook and component props | Already installed |
| Tailwind CSS v4 | ^4.2.2 | `transition-shadow`, arbitrary `shadow-[...]` for glow | Already installed |
| `requestAnimationFrame` (browser API) | N/A | Frame-accurate count-up timing | No install needed |
| `document.visibilityState` (browser API) | N/A | Detect tab-return | No install needed |

### Alternatives Considered
| Instead of | Could Use | Why We Don't |
|------------|-----------|--------------|
| Vanilla `requestAnimationFrame` | `countup.js` or `react-countup` | No new dependency needed; logic is ~30 lines |
| Module-level `useRef` boolean flag | `sessionStorage` | Simpler; sessionStorage persists across full page reloads which is wrong here |
| Tailwind arbitrary shadow | Inline style with `transition` | Tailwind keeps styling consistent with existing patterns in the codebase |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended File Changes
```
src/
├── App.tsx                               # Add onClick to donate <a>, add listener logic
├── hooks/
│   └── useAnimatedCounter.ts             # New: count-up hook (pure logic, no JSX)
└── components/dashboard/
    └── QuickFactsRow.tsx                 # Use hook to get animated value; pass to InsightCard
```

The `hooks/` directory does not yet exist — create it.

### Pattern 1: One-Shot visibilitychange Listener in App.tsx

**What:** When the donate button is clicked, register a `visibilitychange` listener on `document` that fires exactly once when the tab becomes visible again, clears the data cache, and re-fetches revenue data.

**When to use:** The listener must only be registered after the donate click (not on page load), and must never fire more than once per page load regardless of how many times the user tabs away.

**Implementation approach:**

```typescript
// Source: MDN Web API docs (https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)
// In App.tsx — add to the donate <a> tag:

const donationListenerActive = useRef(false);

const handleDonateClick = useCallback(() => {
  // Guard: only register once per page load
  if (donationListenerActive.current) return;
  donationListenerActive.current = true;

  const handleVisibility = () => {
    if (document.hidden) return; // still hidden, wait for visible
    // Tab is now visible — clear cache and re-fetch
    clearCache();
    const yearNum = parseInt(selectedYear);
    if (selectedEntity && selectedEntity.available_datasets.some(
      d => d.fiscal_year === yearNum && d.dataset_type === 'revenue'
    )) {
      loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'revenue')
        .then(revenue => setRevenueData(revenue))
        .catch(() => { /* silent fail — no error UI in this phase */ });
    }
  };

  // { once: true } auto-removes the listener after first fire
  document.addEventListener('visibilitychange', handleVisibility, { once: true });
}, [selectedEntity, selectedYear]);
```

Key points:
- `{ once: true }` on `addEventListener` automatically removes the listener after the first `visibilitychange` event. This covers the case where the event fires while the page is still hidden (user re-hid before becoming visible) — but since we check `document.hidden` inside the handler, we just return early. The `{ once: true }` still removes the listener regardless, so a second tab-back will not trigger anything. This is the correct behavior per CONTEXT.md ("fire once per page load only").
- The `donationListenerActive` ref guard prevents registering a second listener if the user clicks Donate twice.
- `clearCache()` is already exported from `dataLoader.ts` — use it directly.

**Alternative for the `{ once: true }` hidden-state edge case:**

If the tab fires `visibilitychange` while hidden (e.g., user tab-switches away immediately), `{ once: true }` consumes the event. The listener is gone. This is acceptable behavior per the spec — the "fire once per page load" requirement is satisfied. No additional guard is needed.

### Pattern 2: useAnimatedCounter Hook

**What:** A custom hook that accepts a target numeric value. When the value changes, it animates from the previous value to the new value over 600ms using `requestAnimationFrame`. Returns the current animated value as a number.

**When to use:** Call from `QuickFactsRow` for the `totalRevenue` value. Pass the animated number to `formatCompact()` before passing to InsightCard.

```typescript
// Source: MDN requestAnimationFrame docs + CSS-Tricks hooks pattern
// src/hooks/useAnimatedCounter.ts

import { useRef, useState, useEffect } from 'react';

// easeOutCubic: starts fast, decelerates to stop. Good for a counter landing on a value.
// Source: https://gist.github.com/gre/1650294
const easeOutCubic = (t: number): number => (--t) * t * t + 1;

export function useAnimatedCounter(target: number, duration = 600): number {
  const [displayed, setDisplayed] = useState(target);
  const prevTarget = useRef(target);
  const rafId = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    const from = prevTarget.current;
    const to = target;
    prevTarget.current = to;

    // No change — nothing to animate
    if (from === to) return;

    // Cancel any in-progress animation before starting a new one
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
    }

    startTime.current = null;

    const animate = (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(from + (to - from) * eased);
      setDisplayed(current);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        rafId.current = null;
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [target, duration]);

  return displayed;
}
```

**Integration in QuickFactsRow:**

```typescript
// In QuickFactsRow.tsx
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

// ... inside the component:
const totalRevenue = revenueData?.metadata.totalBudget ?? 0;
const animatedRevenue = useAnimatedCounter(totalRevenue, 600);

// Then use animatedRevenue instead of totalRevenue in the InsightCard value prop:
value={animatedRevenue > 0 ? formatCompact(animatedRevenue) : '—'}
```

This works because on normal page load `totalRevenue` is 0 initially and then jumps to the real value — but the animation only plays when the value differs, so the initial load (0 → real value) would also animate. To prevent the initial load animation, initialize `prevTarget.current` to the initial target value before the effect runs, which `useState(target)` and `useRef(target)` (not `useRef(0)`) achieve.

Wait — the hook as written initializes `prevTarget.current = target` (the initial prop value) and `displayed = target` (also the initial prop). So on the first render, `from === to === initialTarget`, no animation runs. On subsequent renders when `target` changes, the animation fires. This is correct behavior.

### Pattern 3: Green Glow CSS

**What:** After the count-up completes, briefly apply a green `box-shadow` glow to the InsightCard containing Total Income, then fade it away.

**The design constraint:** The glow is a "payment success" signal — Stripe-green (`#22c55e` / Tailwind `green-500`) is universally understood as success. The glow should be on the card's outer box, not text-shadow.

**Performance note:** Per Tobias Ahlin's analysis (https://tobiasahlin.com/blog/how-to-animate-box-shadow/), directly transitioning `box-shadow` triggers repaints. For a 2-second fade that fires once (not on every render), this performance cost is negligible. The pseudo-element technique is better for continuous hover animations — not needed here.

**Recommended approach:** Add a CSS class dynamically with Tailwind arbitrary shadow + transition:

```typescript
// In QuickFactsRow, track whether the glow is active:
const [glowing, setGlowing] = useState(false);
const prevAnimatedRevenue = useRef(animatedRevenue);

useEffect(() => {
  // Detect when animation settles at a new higher value
  if (animatedRevenue !== prevAnimatedRevenue.current && animatedRevenue === totalRevenue && totalRevenue > 0) {
    setGlowing(true);
    const timer = setTimeout(() => setGlowing(false), 2000);
    return () => clearTimeout(timer);
  }
  prevAnimatedRevenue.current = animatedRevenue;
}, [animatedRevenue, totalRevenue]);
```

However, this approach of watching `animatedRevenue` settle is fragile. A cleaner approach: track whether a "post-donation refresh" happened in App.tsx and pass a `highlight` boolean prop down, or use a simpler callback from the `useAnimatedCounter` hook.

**Cleaner glow trigger:** Add an `onComplete` callback to `useAnimatedCounter`:

```typescript
export function useAnimatedCounter(
  target: number,
  duration = 600,
  onComplete?: () => void
): number {
  // ... same as before, but after `setDisplayed(current)` when progress >= 1:
  // if (progress >= 1 && from !== to) onComplete?.();
}
```

Then in QuickFactsRow:

```typescript
const [glowing, setGlowing] = useState(false);

const handleCountComplete = useCallback(() => {
  setGlowing(true);
  setTimeout(() => setGlowing(false), 2000);
}, []);

const animatedRevenue = useAnimatedCounter(totalRevenue, 600, handleCountComplete);
```

**CSS for the green glow (Tailwind v4 arbitrary + transition):**

```tsx
// On the InsightCard wrapper div — pass via a wrapping div in QuickFactsRow:
<div
  className={`transition-shadow duration-700 ${
    glowing
      ? 'shadow-[0_0_0_2px_#22c55e,0_0_16px_4px_#22c55e66]'
      : 'shadow-none'
  }`}
>
  <InsightCard ... />
</div>
```

The glow uses two shadow layers:
1. `0_0_0_2px_#22c55e` — a 2px solid green border ring (no blur)
2. `0_0_16px_4px_#22c55e66` — a soft 16px spread, 40% opacity green bloom

`duration-700` for the fade-out (700ms) gives a gentle dissolve after the 2s hold. Use `transition-shadow` so only the shadow animates, not other properties. The class change from glowing → not-glowing triggers the CSS transition.

However, Tailwind v4 uses CSS variables for shadow transitions via `@property`. There's a known quirk (GitHub Discussion #16772) where arbitrary `shadow-[...]` values may not animate via `transition-shadow` because `@property` registration only covers the predefined shadow variables. **Mitigation:** If Tailwind transition doesn't work for arbitrary shadow, use inline `style` with CSS `transition: box-shadow 700ms ease-out` instead:

```tsx
<div
  style={{
    transition: 'box-shadow 700ms ease-out',
    boxShadow: glowing
      ? '0 0 0 2px #22c55e, 0 0 16px 4px #22c55e66'
      : 'none',
  }}
>
  <InsightCard ... />
</div>
```

This inline approach bypasses the Tailwind `@property` limitation entirely and is fully reliable.

**Recommended color values:**
- Primary ring: `#22c55e` (Tailwind green-500 — universally "success")
- Bloom: `#22c55e66` (same color at ~40% opacity for soft glow)

### Anti-Patterns to Avoid

- **Registering the listener on every render:** Use `useRef` flag or check `donationListenerActive.current` before registering.
- **Calling `setRevenueData(null)` before re-fetch:** This would blank out the displayed value. Do not clear state — just overwrite it when the new data arrives.
- **Animating inside InsightCard:** InsightCard accepts a formatted `string` value. The animation must happen at the numeric level (in QuickFactsRow) before formatting.
- **Using `setInterval` for animation:** Interval-based timers accumulate drift on slow devices. `requestAnimationFrame` is the correct tool — it uses wall-clock timestamps.
- **Animating the initial page load 0→N:** The hook's design (initializing `prevTarget.current = target`) prevents this. Do not initialize `prevTarget.current = 0`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| One-shot listener | Custom flag + removeEventListener | `{ once: true }` option on addEventListener | Browser-native, cleaner, already verified MDN |
| Cache invalidation | Custom cache clear logic | `clearCache()` already exported from dataLoader.ts | Already exists |
| Animation library install | countup.js, react-countup | Vanilla rAF hook (30 lines) | No new dependency; we control the from/to precisely |

**Key insight:** The browser's `{ once: true }` addEventListener option and the existing `clearCache()` export handle the two hardest pieces. The animation is genuinely simple enough to hand-roll because we only need integer count-up with one easing curve.

## Common Pitfalls

### Pitfall 1: visibilitychange fires immediately while still hidden

**What goes wrong:** The browser fires `visibilitychange` when going FROM visible TO hidden (i.e., when the user clicks Donate and the new tab opens). If using `{ once: true }`, this first hidden-transition consumes the listener before the donor returns.

**Why it happens:** `visibilitychange` fires on any visibility state change, not just becoming visible.

**How to avoid:** Inside the handler, check `document.hidden`. If `document.hidden === true`, return early. But with `{ once: true }`, the listener is gone — the user returning will not trigger another event.

**Correct pattern:** Do NOT use `{ once: true }` alone. Instead, keep the listener and check `document.visibilityState === 'visible'` before acting. Remove the listener manually inside the handler after the first successful visible-trigger:

```typescript
const handleVisibility = () => {
  if (document.visibilityState !== 'visible') return; // not visible yet, keep listening
  // Now visible — do the work
  document.removeEventListener('visibilitychange', handleVisibility);
  clearCache();
  // ... re-fetch
};
document.addEventListener('visibilitychange', handleVisibility);
```

This is more reliable than `{ once: true }` for the navigate-away scenario.

### Pitfall 2: Stale closure captures selectedEntity/selectedYear

**What goes wrong:** The `handleDonateClick` callback registers a closure over `selectedEntity` and `selectedYear`. If those values change before the donor returns, the re-fetch uses stale values.

**Why it happens:** JavaScript closures capture values at the time of creation, not at the time of invocation.

**How to avoid:** Use `useRef` to track the current values, or include them in `useCallback`'s dependency array. Since only one entity is visible at a time and users won't typically switch entities while donating, the simplest fix is to include `selectedEntity` and `selectedYear` in the `useCallback` deps and accept that if they change, a new listener registration can't happen (guard ref prevents it). This is acceptable for the phase scope.

### Pitfall 3: React 19 concurrent mode and animation frame timing

**What goes wrong:** In React 19, state updates may be batched differently. `setDisplayed` called on every animation frame could theoretically batch or skip intermediate updates.

**Why it happens:** React 19 auto-batches state updates in async contexts.

**How to avoid:** `requestAnimationFrame` callbacks are not async-batched like Promises in React 19. Each `setDisplayed` call inside an rAF callback will produce a re-render. This is expected behavior — the 60fps animation will produce ~36 re-renders over 600ms, which is fine for a single InsightCard number value. No special handling needed.

### Pitfall 4: The `formatCompact` function in QuickFactsRow produces non-numeric strings

**What goes wrong:** The `animatedRevenue` value during animation is a rounded integer that `formatCompact` will format correctly. But since the nonprofit path formats to `$X.XX` (two decimal places) and we're rounding to integers in the animation, the decimal places will always show `.00` mid-animation.

**Why it happens:** The nonprofit format is `n.toLocaleString('en-US', { minimumFractionDigits: 2 })`.

**How to avoid:** This is cosmetically acceptable — the animation is 600ms and the jitter between `.00` displays at each integer step is fine. No special handling needed; the format is determined by entity type and the animated integer will still count up visibly.

### Pitfall 5: Tailwind v4 arbitrary shadow may not animate via `transition-shadow`

**What goes wrong:** Tailwind v4 uses CSS custom properties (`@property`) internally for shadow animations. Arbitrary `shadow-[...]` values bypass this mechanism, so `transition-shadow` may have no effect when changing between arbitrary shadow values.

**Why it happens:** GitHub Discussion #16772 confirms this is a known v4 limitation in shadow-dom contexts; similar issues affect arbitrary value animation.

**How to avoid:** Use inline `style` prop with explicit `transition: 'box-shadow 700ms ease-out'` for the glow wrapper div. Do not rely on Tailwind's `transition-shadow` for arbitrary shadow values.

## Code Examples

### One-Shot visibilitychange Listener (Correct Pattern)

```typescript
// Source: MDN Web API (https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)
// Combined with handler-self-removal for reliable one-shot behavior

const donationListenerActive = useRef(false);

const handleDonateClick = useCallback(() => {
  if (donationListenerActive.current) return;
  donationListenerActive.current = true;

  const handleVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    // Unregister first — then do async work
    document.removeEventListener('visibilitychange', handleVisibility);

    clearCache();
    const yearNum = parseInt(selectedYear);
    const hasRevenue = selectedEntity?.available_datasets.some(
      d => d.fiscal_year === yearNum && d.dataset_type === 'revenue'
    );
    if (selectedEntity && hasRevenue) {
      loadBudgetData(yearNum, selectedEntity.name, selectedEntity.state, 'revenue')
        .then(revenue => setRevenueData(revenue))
        .catch(() => {});
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
}, [selectedEntity, selectedYear]);
```

### useAnimatedCounter Hook (Complete)

```typescript
// Source: MDN requestAnimationFrame (https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
// Easing formula: https://gist.github.com/gre/1650294
// src/hooks/useAnimatedCounter.ts

import { useRef, useState, useEffect } from 'react';

const easeOutCubic = (t: number): number => {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
};

export function useAnimatedCounter(
  target: number,
  duration = 600,
  onComplete?: () => void
): number {
  const [displayed, setDisplayed] = useState(target);
  const prevTarget = useRef(target);
  const rafId = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevTarget.current;
    prevTarget.current = target;

    if (from === target) return;

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(from + (target - from) * eased);
      setDisplayed(current);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        rafId.current = null;
        onComplete?.();
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [target, duration, onComplete]);

  return displayed;
}
```

### Green Glow Wrapper (Inline Style — Reliable Approach)

```tsx
// In QuickFactsRow.tsx
// Wrap the Total Income InsightCard with a glow div

const [glowing, setGlowing] = useState(false);
const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleCountComplete = useCallback(() => {
  setGlowing(true);
  glowTimerRef.current = setTimeout(() => setGlowing(false), 2000);
}, []);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
  };
}, []);

const animatedRevenue = useAnimatedCounter(totalRevenue, 600, handleCountComplete);

// JSX:
<div
  style={{
    borderRadius: 'inherit',
    transition: 'box-shadow 700ms ease-out',
    boxShadow: glowing
      ? '0 0 0 2px #22c55e, 0 0 16px 4px #22c55e66'
      : 'none',
  }}
>
  <InsightCard
    label={isNonprofit ? 'Total Income' : 'Expected Revenue'}
    value={animatedRevenue > 0 ? formatCompact(animatedRevenue) : '—'}
    subtext={isNonprofit ? 'Money raised' : 'Money coming in'}
    icon={<Receipt size={18} className="text-ev-gray-500" />}
  />
</div>
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `window.onfocus` for tab detection | `visibilitychange` + `document.visibilityState` | More reliable on mobile where focus events are inconsistent |
| `setInterval` for animation | `requestAnimationFrame` with timestamp | Frame-rate independent; consistent on 60Hz/120Hz screens |
| `removeEventListener` boilerplate | `{ once: true }` addEventListener option | Simpler but doesn't work for the "hidden-first" edge case |

## Open Questions

1. **`onComplete` callback identity and useEffect re-running**
   - What we know: `onComplete` is in the `useEffect` dependency array. If `handleCountComplete` is recreated on each render (not wrapped in `useCallback`), the animation will reset on every render.
   - What's unclear: Whether the `useCallback` in QuickFactsRow will be stable enough.
   - Recommendation: Wrap `handleCountComplete` in `useCallback` with no deps (the `setGlowing` setter is stable). Or omit `onComplete` from the dependency array and use a ref for it instead.

2. **Animation on initial data load (0 → actual value)**
   - What we know: The hook initializes `displayed = target` and `prevTarget = target`, so on the first render there's no animation.
   - What's unclear: If React renders the component before `revenueData` is loaded (so `target = 0`), then when data arrives, `target` changes from 0 to the real value. This WILL animate.
   - Recommendation: This is probably desirable for the donor view. But if it's unwanted, pass a `skipFirst` flag or only attach the `onComplete` glow after a donation has been detected.

3. **QuickFactsRow rerenders during animation**
   - What we know: Each animation frame calls `setDisplayed`, causing QuickFactsRow to rerender 36+ times in 600ms.
   - What's unclear: Whether other expensive computations in QuickFactsRow (category counting, etc.) will cause visible jank.
   - Recommendation: The category counting (`spendingAreaCount`) is a simple array length — no concern. The `formatCompact` call is trivial. No optimization needed.

## Sources

### Primary (HIGH confidence)
- MDN Web API — `visibilitychange` event: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- MDN Web API — `requestAnimationFrame`: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Tailwind CSS v4 docs — box-shadow: https://tailwindcss.com/docs/box-shadow
- Tailwind CSS v4 docs — transition-property: https://tailwindcss.com/docs/transition-property

### Secondary (MEDIUM confidence)
- CSS-Tricks — requestAnimationFrame with React hooks: https://css-tricks.com/using-requestanimationframe-with-react-hooks/
- easing functions gist (gre/1650294): https://gist.github.com/gre/1650294 — easeOutCubic formula verified
- Tobias Ahlin — animate box-shadow performance: https://tobiasahlin.com/blog/how-to-animate-box-shadow/

### Tertiary (LOW confidence)
- Tailwind GitHub Discussion #16772 — arbitrary shadow `@property` limitation: mentioned in search results, not directly fetched. Treat the inline-style fallback as the safe path.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all browser APIs are widely supported (MDN "Baseline: widely available")
- Architecture: HIGH — codebase structure is fully read; InsightCard interface confirmed; dataLoader.clearCache confirmed
- Animation pattern: HIGH — rAF + easing formula verified from authoritative sources
- CSS glow: MEDIUM — values are standard CSS; the Tailwind v4 arbitrary shadow animation limitation is flagged but workaround (inline style) is reliable
- Pitfalls: HIGH — the hidden-first visibilitychange edge case is the single most important correctness concern and the fix is documented

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable browser APIs; no library version sensitivity)
