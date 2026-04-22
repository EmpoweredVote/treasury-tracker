---
phase: 04-live-feedback-ui
plan: "01"
subsystem: ui
tags: [react, hooks, requestAnimationFrame, visibilitychange, animation, silent-refetch]

# Dependency graph
requires:
  - phase: 03-webhook-backend
    provides: clearCache export in dataLoader.ts + revenue dataset updated by webhook
provides:
  - useAnimatedCounter hook with rAF + easeOutCubic (ready for Plan 04-02 consumption)
  - Donate-click arms one-shot visibilitychange listener for silent revenue re-fetch
affects:
  - 04-02-live-feedback-ui (consumes useAnimatedCounter + revenueData state update)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "rAF animation loop with easeOutCubic — useRef stores frame id for cancelAnimationFrame cleanup"
    - "Module-level let flag (not useState) for one-shot listener arm — persists across re-renders, resets on hard reload"
    - "visibilitychange hide-event pitfall guard — manual removeEventListener inside handler gated on visibilityState === 'visible', NOT { once: true }"

key-files:
  created:
    - src/hooks/useAnimatedCounter.ts
  modified:
    - src/App.tsx

key-decisions:
  - "visibilitychange guard uses manual removal inside handler (not { once: true }) — once fires on hide event consuming listener before donor returns"
  - "donationRefetchArmed is a module-level let, not useState — must survive re-renders without triggering them"
  - "Hook initializes display to target to avoid 0→target flash on first mount"
  - "onComplete in dep array with JSDoc warning requiring useCallback — documented at hook call-site"

patterns-established:
  - "rAF cleanup pattern: store frameId in useRef, cancel in effect cleanup function"
  - "Silent background refetch: clearCache() + loadBudgetData().then(setRevenueData) — no loading state touched"

# Metrics
duration: 5min
completed: 2026-04-22
---

# Phase 4 Plan 01: Hook and Listener Summary

**rAF-driven useAnimatedCounter hook and one-shot visibilitychange revenue refetch wired to Donate click in App.tsx**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T14:11:05Z
- **Completed:** 2026-04-22T14:15:44Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `src/hooks/useAnimatedCounter.ts` — 93-line hook with rAF loop, easeOutCubic easing, frame cancellation on unmount, and JSDoc warning about onComplete stability
- Added `donationRefetchArmed` module-level flag and `handleDonateClick` useCallback in App.tsx — arms the listener exactly once per page load
- Wired `onClick={handleDonateClick}` to the GiveButter Donate anchor — no preventDefault, link still navigates

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useAnimatedCounter hook** - `0962523` (feat)
2. **Task 2: Wire Donate-click visibilitychange silent revenue refetch** - `19274b1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/hooks/useAnimatedCounter.ts` — New hook. Exports `useAnimatedCounter(target, duration?, onComplete?): number`. Uses rAF + easeOutCubic. Cancels in-flight frame on cleanup. Initializes display to target to avoid mount flash.
- `src/App.tsx` — Three additions:
  - Line 6: `clearCache` added to dataLoader import
  - Lines 77–79: `donationRefetchArmed = false` module-level flag
  - Lines 402–432: `handleDonateClick` useCallback (arms visibility listener)
  - Line 617: `onClick={handleDonateClick}` on the GiveButter Donate `<a>`

## Exact Line Numbers Added in App.tsx

| Addition | Lines |
|----------|-------|
| `clearCache` in import | 6 |
| `donationRefetchArmed` flag | 77–79 |
| `handleDonateClick` callback | 402–432 |
| `onClick={handleDonateClick}` on Donate `<a>` | 617 |

## Final Hook Signature

```ts
export function useAnimatedCounter(
  target: number,
  duration: number = 600,
  onComplete?: () => void,
): number
```

## visibilitychange Hide-Event Pitfall — Confirmed Guarded

The `{ once: true }` option fires on the FIRST `visibilitychange` event, which is the hide event when the donor navigates away to GiveButter — this consumes the listener before the donor returns. The implementation uses manual `removeEventListener` inside the handler, called only after the `visibilityState === 'visible'` guard passes. This is confirmed in the code at lines 413–415 of App.tsx.

## Decisions Made

- `{ once: true }` explicitly rejected — fires on hide (navigate-away) before donor returns. Manual removal after visible guard is correct.
- `donationRefetchArmed` is module-level `let`, not `useState` — component state causes re-renders; this flag only needs to persist.
- Hook display initializes to `target` — prevents flash of 0 on first render.
- `onComplete` in dep array documented via JSDoc — callers must use `useCallback` with stable deps to avoid animation restart every render.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `useAnimatedCounter` is ready for Plan 04-02 to wire into `PlainLanguageSummary` and `DatasetTabs` revenue displays.
- `revenueData` state will be updated silently when donor returns from GiveButter — Plan 04-02 can attach the animated counter directly to that state value.
- No blockers.

---
*Phase: 04-live-feedback-ui*
*Completed: 2026-04-22*
