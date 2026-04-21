# Feature Landscape: Donate and Immediately See Your Impact

**Domain:** Post-donation return flow on a financial transparency dashboard
**Researched:** 2026-04-20
**Milestone:** Real-time donation feedback UX

---

## Emotional Goal

The user must feel: "I gave $5 and I can see that $5 in the total right now."

This closes the "did my donation matter?" loop that research confirms is the single
biggest driver of donor return behavior. Nearly 1 in 4 donors stop giving due to a
lack of transparency about how their donations are used. Showing the updated total
instantly — not in an email, not in a week — is the differentiating act.

---

## Table Stakes

Features that must exist for the flow to feel complete. Missing any of these and the
moment falls flat.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Donate button on the financials page | Users expect a direct path from seeing the need to acting on it | Low | Must be visible at the QuickFactsRow level, near the "Incoming" total |
| Post-donation landing back on financials.empowered.vote | Without this the loop never closes | Medium | GiveButter does not natively support redirect URLs; this requires the donate link to encode a return path, or use a GiveButter webhook + Supabase to refresh the total |
| Updated "Incoming" total visible immediately | The core promise of the flow | Medium | Total must reflect the new donation, not a cached value from before the user left |
| Brief thank-you message on return | Donors expect confirmation that the system received their gift | Low | A banner or callout, not a full interstitial page |
| Clear copy on the donate button | "Donate" is fine; context should connect giving to the financials being shown | Low | "Support this work" or "Donate to EV" anchors the ask to the page they are on |

---

## Differentiators

Features that elevate this from "generic donation CTA" to something memorable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated counter roll-up on the "Incoming" total | Makes the impact visceral — the number visibly climbs to include the donor's contribution | Low-Med | CountUp.js or pure CSS/JS; duration 800–1200ms; easing makes it feel organic, not mechanical |
| Personalized thank-you that names the amount | "You just added $5. Total incoming: $2,224." connects the abstract total to the specific gift | Low | Requires amount to survive the redirect (query param or sessionStorage) |
| Subtle highlight/pulse on the updated card | Draws the eye to the changed value after the animation completes without being garish | Low | CSS keyframe: yellow (#F5C842) glow fading over ~2s; brand-consistent and reads as "new" |
| "Your $X is X.XX% of total incoming" micro-stat | Transforms a small dollar amount into a concrete share of the mission | Low | Pure math; deeply satisfying for small donors who feel their gift is trivial |
| Persistent "you contributed" chip on the QuickFacts card | Stays visible for the session so the donor can share the page and still see their mark | Low | sessionStorage keyed to the amount; disappears on refresh |
| Social share nudge after the moment lands | "Share your impact" after the animation lets donor evangelism happen at peak emotional engagement | Med | Secondary — do not interrupt the impact moment; offer it after a 3–4s delay |

---

## Anti-Features

Things that would actively hurt the experience. These are common patterns in nonprofit
fundraising UX that would feel wrong on a transparency-first dashboard.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full-page interstitial "Thank You" overlay | Breaks context; the whole point is staying on the financials page to see the impact | Brief banner at top of QuickFactsRow — transient, dismissible |
| Popups or modals requesting email opt-in on return | Donor just gave; immediately asking for more is a trust-killer | GiveButter handles the receipt email; do not duplicate or append asks |
| Showing a stale/cached total (no refresh) | The loop never closes if the number does not change | Force a data refetch on return, or pass the new total as a query param as a fallback |
| Requiring login to see the updated total | Adds friction at the most emotionally charged moment of the flow | The page is public; no auth gate on this path |
| Animating on every page load (not just post-donation return) | Desensitizes users and makes the animation meaningless | Gate the animation behind detection of the `?donated=true` (or equivalent) query param |
| Donate button that navigates away without context | Loses the page state; donor returns to homepage or a generic GiveButter page | Use `?return_url=` or `?redirect=` in the GiveButter link so the browser returns to the exact financials URL with the right entity/year params |
| Showing a "Thank You" message on subsequent loads | Awkward if the donor refreshes or bookmarks the page | Clear the banner after first render or on query-param removal via `replaceState` |
| Large, aggressive CTAs that compete with the data | This is a transparency page, not a fundraising page | Donate button should be secondary in visual weight to the financial data |

---

## Feature Dependencies

```
GiveButter return URL encodes entity + year + ?donated=true + ?amount=5
  → App.tsx detects ?donated=true on mount (already reads URL params)
      → Triggers fresh data fetch (already has loadBudgetData pattern)
          → QuickFactsRow receives updated revenueData total
              → Counter animation fires (new: triggered by donated param)
                  → Thank-you banner renders (new: derived from donated param)
                      → Pulse animation on Incoming card (new: CSS class applied once)
```

The existing URL-param-reading code in App.tsx (lines 155–179) is the natural hook.
No new routing infrastructure is needed.

---

## Donate Button: Placement and Copy

**Placement:** Inside or immediately below the QuickFactsRow, visually attached to
the "Total Income" InsightCard. The spatial relationship between the number and the
button communicates "this number goes up when you click this."

**Visual weight:** Secondary button, not primary. EV teal (#1B6C8C) border with teal
text, white fill. On hover, fill with teal. This keeps the data as the hero.

**Copy options (ranked):**
1. "Donate to Empowered Vote" — direct, accurate, no ambiguity
2. "Support this work" — warmer, connects to mission
3. "Donate" — fine but generic; loses the transparency-page context

Avoid: "Give Now", "Contribute Today" — urgency language feels out of place on a
data-first page.

**Mobile:** Button must be full-width below the QuickFactsRow grid on small screens.
The tap target needs minimum 44px height (WCAG 2.5.5).

---

## GiveButter Integration Constraints

**Confirmed (HIGH confidence, via official docs):**
- GiveButter does NOT support a native redirect/return URL parameter after donation
  completion. The four supported URL params are: `amount`, `frequency`, `fund`, `promo`.
- GiveButter DOES support `transaction.succeeded` webhooks with full payload (amount,
  donor info, campaign ID).
- GiveButter widgets do not expose post-donation JavaScript callbacks to the host page.

**Implication for the flow:**

Two viable implementation paths:

**Path A — Link opens GiveButter in new tab, webhook updates Supabase, page polls/
refreshes:**
- Donate button opens `https://givebutter.com/ev` (or campaign URL) in a new tab
- GiveButter fires `transaction.succeeded` webhook to an EV backend endpoint
- Backend upserts the new total into Supabase
- Financials page detects focus-return (window `visibilitychange` or `focus` event)
  and refetches revenue data
- If total changed, triggers animation
- No query params needed; more reliable but requires backend webhook handler

**Path B — Link encodes return URL manually, user clicks "Back to Financials" on
GiveButter thank-you page:**
- Donate link: open GiveButter, instruct donor to return via a link the thank-you
  message includes (not native redirect — GiveButter does not auto-redirect)
- Return URL includes `?donated=true&amount=5` as a soft signal
- Page detects param, fetches fresh data, runs animation
- Simpler to build; less reliable (user may not click back; amount is unverified)

**Recommended:** Path A for production fidelity. Path B as a fast-follow MVP to
ship the UX shell quickly while the webhook backend is being built.

---

## MVP Recommendation

For MVP (proving the emotional loop), prioritize:

1. Donate button on the QuickFactsRow with correct copy and placement
2. Path B return URL with `?donated=true&amount=[x]` (manual, unverified but works)
3. Fresh data fetch on return
4. Animated counter roll-up on the Incoming total (CountUp.js or vanilla — 1000ms ease-out)
5. Personalized thank-you banner: "Thanks for your $[x] donation. This page reflects your contribution."
6. CSS pulse/glow on the updated InsightCard (yellow #F5C842, 2s fade)

Defer to post-MVP:
- "Your $X is X% of total income" micro-stat — low complexity but not needed to prove the loop
- Social share nudge — real value, but adds decision load right after donation
- Persistent session chip — nice but not essential for MVP
- Path A webhook backend — needed for production reliability; not needed to validate the UX

---

## Animation Specification

For the animated counter on the Incoming total:

- **Duration:** 1000ms (research consensus: 200–500ms for micro-interactions, but
  counting to a dollar amount reads better slower; 1000ms is the sweet spot for
  financial figures)
- **Easing:** ease-out (starts fast, slows as it reaches the new value — feels like
  the number "settling")
- **Start value:** previous total (from before the donation; can be derived from the
  pre-fetch state)
- **End value:** new total from fresh data fetch
- **Format:** matches existing formatCompact — dollar sign, two decimals for nonprofit
- **Trigger:** only when `?donated=true` param is present AND the refetched total
  differs from the prior total
- **Library recommendation:** CountUp.js (well-maintained, zero dependencies, handles
  number formatting) or vanilla requestAnimationFrame (avoids a dependency for a
  single use case)

For the pulse/glow on the InsightCard:

```css
@keyframes donation-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(245, 200, 66, 0.7); }  /* EV yellow */
  50%  { box-shadow: 0 0 0 10px rgba(245, 200, 66, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(245, 200, 66, 0); }
}
/* Applied once via a class added on post-donation render */
.donation-highlight {
  animation: donation-pulse 2s ease-out 1;
}
```

---

## Sources

- GiveButter URL parameters (confirmed via official help docs): https://help.givebutter.com/en/articles/4868782-how-to-leverage-url-and-html-parameters
- GiveButter webhooks, transaction.succeeded event: https://help.givebutter.com/en/articles/8828428-how-to-automate-workflows-and-data-using-webhooks
- NN/g donation usability research: https://www.nngroup.com/articles/donation-usability/
- Donate button best practices (Neon One): https://neonone.com/resources/blog/donate-button/
- Donor psychology — impact confirmation loop: https://www.donorperfect.com/nonprofit-technology-blog/featured/donor-behavior/
- Animation duration guidance (200–500ms micro-interactions): https://www.concretecms.com/about/blog/web-design/using-animation-to-improve-ux
- CountUp.js: https://inorganik.github.io/countUp.js/
- Tailwind CSS animation utilities: https://tailwindcss.com/docs/animation
