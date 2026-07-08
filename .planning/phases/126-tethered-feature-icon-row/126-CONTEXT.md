# Phase 126: Tethered Feature-Icon Row — Context

**Gathered:** 2026-07-08
**Status:** Ready for planning
**Source:** Inline discuss+plan session (no GSD subagents, per project convention)

<domain>
## Phase Boundary

Build the **visible** TT-side tether: a bottom-right feature-icon row on the hero
banner whose live entry is the Essentials yellow magnifying glass, deep-linking the
banner's **current entity** into Essentials. This is the reciprocal of Essentials'
Phase 187 `SectionBanner` feature-icon row. Phase 125 already delivered the
coverage loader/matcher + the invisible `data-essentials-coverage` seam; Phase 126
consumes that resolved `CoverageRecord` to render a real, accessible, theme-aware icon.

**In scope (ICON-01..04, TETH-01/02):** product registry, chip+tooltip components,
theme-aware icon, per-tier deep-link construction, render-only-if-linkable gate,
wiring into `App.tsx`.

**NOT in scope (Phase 127):** end-to-end context-sensitivity verification across
covered/uncovered/federal and Chris live-app UAT (TETH-03, VER-01). Phase 126 builds
the render-time "null resolver → no icon" logic; Phase 127 proves it live.
</domain>

<decisions>
## Implementation Decisions (locked this session)

### D-126-01 — Tooltip: add `@floating-ui/react`
TT has no tooltip library today. Add `@floating-ui/react` and port Essentials'
`FeatureIconChip` (hover + keyboard-focus + `useRole('tooltip')` + dismiss) near-verbatim.
Chosen for behavioral/visual fidelity with Essentials and battle-tested a11y over a
hand-rolled tooltip.

### D-126-02 — Layout: icon row above the credit, both bottom-right
Keep the tiny Wikimedia credit at its current `bottom-1 right-2`. Place the icon-chip
row just **above** it, right-aligned. Nothing else in the banner moves. Row must never
obscure the bottom-left title/subtitle (ICON-01).

### D-126-03 — Icon variant: always the light symbol on a navy chip, both themes
The banner always carries a dark overlay/gradient in both light and dark mode, so the
chip is a semi-transparent navy (`~#0d1117 @ 55%` + `backdrop-blur`) in **both** themes
and always renders the `-light` SVG symbol. This honors ICON-04's governing clause
("legible over any banner art in both themes") and matches Essentials exactly. (We do
NOT swap the symbol with TT's theme.)

### D-126-04 — Registry mirrors Essentials `featureIcons.js`
Fixed reserved order `[essentials, compass, readrank]`. Only `essentials` is a live
entry with a real `resolve()`. `compass`/`readrank` are documented, non-rendering
reserved slots (no greyed/placeholder icons — ICON-03). Each product's `resolve()`
returns `{ key, href, label, iconSrc } | null`.

### D-126-05 — TT's resolver consumes the already-resolved CoverageRecord
Unlike Essentials (which matches inside `resolve`), TT's matching is already done by
`useEssentialsCoverage` (Phase 125). So the essentials product's `resolve(record)`
takes the `CoverageRecord | null` and builds the tier-correct href. Hrefs are built via
the `URL`/`URLSearchParams` API only (T-125-01) — never string-concatenated from
catalog `label`/`target`.

### D-126-06 — Deep-link forms (TETH-01) + geoid-less handling
- city/county → `/results?browse_government_list=<geoids[0]>&browse_state=<abbr>&browse_label=<label>`
- state → `/results?browse_state_officials=<abbr>&browse_label=<label>`
- federal → resolve `record.target` against `ESSENTIALS_URL` via `new URL(target, ESSENTIALS_URL)` (target already carries the query)
- A covered city/county with **no** geoid (`geoids: []`, e.g. Bloomington IN) yields
  **null** (no icon) in this phase — ICON-03 forbids a link with no real target. Flag
  for Phase 127 UAT to confirm whether Essentials wants a label-only fallback.

### Claude's Discretion
Component file layout, exact Tailwind class values for the chip (guided by Essentials'
`FeatureIconChip`), test structure. Reuse the Phase 125 vitest harness + fixture.
</decisions>

<canonical_refs>
## Canonical References

**Downstream executor MUST read these before implementing.**

### TT (this repo)
- `src/utils/essentialsCoverage.ts` — `CoverageRecord`/`CoverageCatalog` types, `ESSENTIALS_URL`, `useEssentialsCoverage` (Phase 125 seam this phase consumes)
- `src/utils/essentialsCoverage.test.ts` + `src/utils/__fixtures__/coverage.sample.json` — vitest harness + fixture to extend
- `src/App.tsx` (hero banner ~L808–833) — `data-essentials-coverage` seam, title (bottom-left), Wikimedia credit (`bottom-1 right-2`); `useTheme()` at L120
- `src/hooks/useTheme.ts` — `{ isDark }` theme signal
- `src/components/AppHeader.tsx` — local component style/convention reference

### Essentials (READ-ONLY reciprocal, `C:/transparent motivations/essentials`)
- `src/lib/featureIcons.js` — `PRODUCT_REGISTRY` shape, fixed order, `resolve(ctx)→{key,href,label,iconSrc}|null`, reserved-slot pattern
- `src/components/SectionBanner.jsx` — `FeatureIconChip` (circular navy chip + backdrop-blur + `@floating-ui` hover/focus tooltip + external `<a target=_blank rel=noopener noreferrer aria-label>`)

### Assets
- `C:/ev-landing/ev-landing-main/icons/` — `essentials-symbol-{light,dark}.svg`, `compass-symbol-{light,dark}.svg`, `readrank-symbol-{light,dark}.svg` → copy into TT `public/`
</canonical_refs>

<deferred>
## Deferred Ideas
- TETH-03 (context-sensitivity end-to-end) + VER-01 (live UAT) → Phase 127.
- Compass / Read & Rank live resolvers → future milestone (reserved slots only here).
- Label-only Essentials link for geoid-less covered cities → revisit in Phase 127 if UAT shows a gap.
</deferred>

---

*Phase: 126-tethered-feature-icon-row*
*Context gathered: 2026-07-08 (inline)*
