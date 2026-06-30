---
created: 2026-06-30T22:30:00.000Z
title: Icicle/Bars color separation + redundant single-root layer (data-viz UX)
area: frontend-dataviz
files:
  - src/utils/chartColors.ts
  - src/components/BudgetIcicle.tsx
origin_phase: 106
requirements: []
---

## Problem

Surfaced during Phase 106 Chris UAT (Illinois FY2025 operating, Bars view — `C:/tmp/Screenshots/IL.JPG`).

Two related data-viz readability issues, both pre-existing (not v2.12 data — the IL numbers shown are correct):

1. **Adjacent top categories are nearly the same color.** `src/utils/chartColors.ts` defines
   `DATA_VIZ_HUES = ['teal','skyblue','ocean','coral','terracotta','yellow','honey','sage','dusk','stone']`.
   The icicle assigns each root category `getCategoryColor(index)` → `var(--color-data-{hue}-500)`,
   cycling through that list in order. The **first three hues (teal, skyblue, ocean) are all in the
   cyan/blue-green family**, so the three largest IL categories — Health and social services (index 0 =
   teal), Education (index 1 = skyblue), and Public protection and justice (index 2 = ocean) — render
   nearly indistinguishable in the bar chart. This affects every multi-category entity, not just IL.

2. **The single-root "…General Fund Budget" layer shares the teal of child 0 and reads as a "click to
   start" button.** When there is only one root node, the full-width root bar (a) duplicates the teal of
   the first child, and (b) is a redundant navigation layer — Chris's words: "a not helpful layer when
   it's the only option — it feels like clicking to start instead of more accurate."

Note: the `CategoryList` cards below the chart DO show distinct per-category icon colors (via
`BRAND_BAR_COLORS` fallback + hue cycling), so the chart and the cards are inconsistent too.

## Solution (proposed)

- **Reorder `DATA_VIZ_HUES`** so consecutive indices land on contrasting parts of the color wheel
  (e.g. `teal, coral, yellow, dusk, sage, skyblue, terracotta, honey, ocean, stone`) — keeps the same
  palette tokens but guarantees the top-N largest categories are visually distinct. Cheapest, highest-impact fix.
- **Give the root/total bar a distinct treatment** — a neutral/muted fill (e.g. a gray `--color-data-stone`
  or a brand-neutral) rather than reusing child 0's hue, so root ≠ first child.
- **Optionally suppress the single-root layer** when `categories.length === 1` at the root (or when the
  root is the only option), so the view opens directly on the children instead of a redundant full-width
  "start" bar. Verify this doesn't break the icicle drill-up/breadcrumb behavior.

Out of Phase 106 scope (that phase = v2.12 data verification, frontend explicitly excluded). Candidate
for a small dedicated UI phase or a future milestone's polish pass.
