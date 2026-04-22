# Phase 4: Live Feedback UI - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a window focus listener and animated revenue counter on financials.empowered.vote so that when a donor returns from GiveButter, the page re-fetches and displays the updated donation total. Scope: re-fetch trigger + counter animation only. Real-time polling, push notifications, and per-donation activity feeds are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Trigger mechanism
- Use `visibilitychange` event with `document.hidden === false` (more reliable than `window focus` across mobile/desktop)
- Fire immediately on visibility restore — no artificial delay
- Fire once per page load only — do not re-trigger on repeated tab switches

### Counter animation
- Count-up animation: number increments from old value to new value (odometer/fundraising counter style)
- Duration: ~600ms
- Only plays when the fetched value differs from the displayed value

### No-change state
- Completely silent background fetch — no spinner, no loading indicator, no "checking..." message
- If the number hasn't changed, nothing visible happens

### Settled state
- After count-up completes, apply a brief green glow/highlight to the revenue number
- Highlight duration: ~2 seconds, then fades back to normal appearance
- No persistent badge, timestamp, or "updated" message

### Claude's Discretion
- Exact CSS for the green glow (color value, shadow spread, transition curve)
- How to store the "already fetched this page load" flag (module-level var, sessionStorage, etc.)
- Easing function for the count-up animation

</decisions>

<specifics>
## Specific Ideas

- The settled-state green glow should feel like a payment success signal — universally understood as "it worked"
- The count-up animation is the emotional payoff for the donor; it should be prominent enough to notice but not so slow it feels broken

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-live-feedback-ui*
*Context gathered: 2026-04-22*
