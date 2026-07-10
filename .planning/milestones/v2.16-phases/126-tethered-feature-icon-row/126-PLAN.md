---
phase: 126
plan: "126"
title: "Tethered feature-icon row: product registry + chip/tooltip + banner wiring"
wave: 1
depends_on: []
files_modified:
  - public/essentials-symbol-light.svg
  - public/essentials-symbol-dark.svg
  - public/compass-symbol-light.svg
  - public/compass-symbol-dark.svg
  - public/readrank-symbol-light.svg
  - public/readrank-symbol-dark.svg
  - package.json
  - package-lock.json
  - src/utils/featureIcons.ts
  - src/utils/featureIcons.test.ts
  - src/components/FeatureIconRow.tsx
  - src/App.tsx
autonomous: true
requirements: [ICON-01, ICON-02, ICON-03, ICON-04, TETH-01, TETH-02]
must_haves:
  - "A generic product registry (src/utils/featureIcons.ts) with fixed reserved order [essentials, compass, readrank]; only essentials is a live entry, compass/readrank are documented non-rendering reserved slots — no greyed/placeholder icons (TETH-02, ICON-03)"
  - "The essentials resolver takes the Phase-125 CoverageRecord and builds the tier-correct Essentials deep-link via URL/URLSearchParams only (never string concat of catalog label/target): city/county→browse_government_list+browse_state+browse_label, state→browse_state_officials+browse_label, federal→record.target resolved against ESSENTIALS_URL (TETH-01, T-125-01)"
  - "A covered city/county with no geoid resolves to null (no icon); any tier with no resolvable link renders no icon and the row left-aligns whatever is live with no gaps (ICON-03)"
  - "FeatureIconRow renders bottom-right on the hero banner, above the Wikimedia credit, as circular semi-transparent navy chips (backdrop-blur) that never obscure the bottom-left title; each chip is an external <a target=_blank rel=noopener noreferrer> with an aria-label and a @floating-ui hover+keyboard-focus tooltip naming the product (ICON-01, ICON-02)"
  - "Each icon always uses the -light SVG symbol on the navy chip in BOTH themes (legible over banner art in light+dark) (ICON-04, per D-126-03)"
  - "Verification passes: vitest proves per-tier href construction + geoid-less→null + reserved-slots-omitted over the committed fixture; tsc build and npm run build are green; lint shows zero NEW errors vs the pre-phase baseline"
scope_note: >
  Phase 126 builds the render-time gate (null resolver → no icon) but does NOT own the
  end-to-end context-sensitivity proof or live UAT — those are Phase 127 (TETH-03,
  VER-01). The Essentials producer (coverage.json incl. federal) is already fully live
  and CORS-enabled (ESSENTIALS-STATUS-D1/D2), so the icon can be smoke-tested live, but
  deterministic proof in this plan is the fixture-backed vitest suite.
---

# Plan 126 — Tethered feature-icon row

**Mode:** standard
**Goal:** Turn Phase 125's invisible `data-essentials-coverage` seam into a real,
accessible, theme-aware Essentials tether icon on the hero banner. Deliver a generic
product registry (fixed order, essentials-live/compass+readrank-reserved), a
`FeatureIconChip`/`FeatureIconRow` ported from Essentials' `SectionBanner` (navy chip +
`@floating-ui` hover/focus tooltip + external link), per-tier deep-link construction
from the resolved `CoverageRecord`, and wiring into `App.tsx` bottom-right above the
credit — proven by an extended fixture-backed vitest suite.

**Locked decisions (126-CONTEXT.md):** @floating-ui tooltip (D-126-01); row above credit
both bottom-right (D-126-02); always the `-light` symbol on a navy chip in both themes
(D-126-03); registry mirrors Essentials `featureIcons.js` (D-126-04); resolver consumes
the already-resolved `CoverageRecord` (D-126-05); deep-link forms + geoid-less→null (D-126-06).

<threat_model>
**T-126-01 — Untrusted catalog values composed into an external href.** `geoids`,
`stateAbbrev`, `label`, and `target` come from a remote JSON TT does not control.
- *Surface:* the `<a href>` on each chip; `target="_blank"`.
- *Mitigations (this plan):* build every href with the `URL` + `URLSearchParams` API —
  `URLSearchParams` percent-encodes all values; the federal `target` is resolved with
  `new URL(record.target, ESSENTIALS_URL)` and only accepted when it is a same-origin
  path (starts with `/`), which prevents a hostile absolute/`javascript:` target from
  escaping the Essentials origin. Every external link carries `rel="noopener noreferrer"`.
  No catalog value is ever interpolated into HTML/DOM (no `dangerouslySetInnerHTML`).
- *Block on:* high. No high-severity threat introduced (read-only public data, encoded output).
</threat_model>

## Tasks

<task id="126-01" type="execute">
<action>
Bring in the icon assets and the tooltip dependency.

1. Copy these six files from `C:/ev-landing/ev-landing-main/icons/` into TT `public/` (verbatim, no rename): `essentials-symbol-light.svg`, `essentials-symbol-dark.svg`, `compass-symbol-light.svg`, `compass-symbol-dark.svg`, `readrank-symbol-light.svg`, `readrank-symbol-dark.svg`. (Both variants for each product so the reserved slots are asset-ready with zero future layout change; the live essentials icon uses the `-light` variant per D-126-03.)
2. `npm install @floating-ui/react` (runtime dependency — it drives the accessible tooltip). Confirm it lands in `package.json` `dependencies` and `package-lock.json` updates.
</action>
<read_first>
- package.json (dependencies block — confirm @floating-ui/react is absent; where deps go)
- public/ (existing asset naming convention — kebab-case .svg alongside treasury-tracker-logo-*.svg)
</read_first>
<acceptance_criteria>
- `public/essentials-symbol-light.svg` and the other five symbol SVGs exist and are non-empty
- `package.json` `dependencies` contains `@floating-ui/react`
- `npm ls @floating-ui/react` resolves without error
</acceptance_criteria>
</task>

<task id="126-02" type="execute" depends_on="126-01">
<action>
Create `src/utils/featureIcons.ts` — the TT product registry + resolver, mirroring Essentials' `src/lib/featureIcons.js` but consuming the already-resolved `CoverageRecord` (D-126-05).

Export:
1. **`FeatureIcon`** type: `{ key: string; href: string; label: string; iconSrc: string }`.
2. **`buildEssentialsHref(record: CoverageRecord): string | null`** — pure, tier-aligned URL construction (TETH-01, T-126-01). Use `new URL('/results', ESSENTIALS_URL)` + `url.searchParams.set(...)`:
   - `tier==='city'|'county'`: require `record.geoids?.[0]` — if absent return `null`; else set `browse_government_list=geoids[0]`, `browse_state=record.stateAbbrev`, `browse_label=record.label`.
   - `tier==='state'`: set `browse_state_officials=record.stateAbbrev`, `browse_label=record.label`.
   - `tier==='federal'`: require `record.target`; accept only if it starts with `/` (same-origin path); return `new URL(record.target, ESSENTIALS_URL).toString()`; else `null`.
   Return the `.toString()` href, or `null` when required fields are missing.
3. **`PRODUCT_REGISTRY`** — a fixed-order array `[essentials, compass, readrank]`. Only `essentials` has a live `resolve(record: CoverageRecord | null): FeatureIcon | null` that returns `null` when `record` is null or `buildEssentialsHref` is null, else `{ key:'essentials', href, label:'Essentials', iconSrc:'/essentials-symbol-light.svg' }`. `compass` and `readrank` are present as **documented reserved entries whose `resolve` always returns `null`** (comment: no per-location contract yet — ICON-03/TETH-02), referencing `/compass-symbol-light.svg` and `/readrank-symbol-light.svg` for the future.
4. **`resolveFeatureIcons(record: CoverageRecord | null): FeatureIcon[]`** — map `PRODUCT_REGISTRY` in order through `resolve(record)`, filter out nulls. Returns `[]` when nothing is live (so the row renders nothing).

Keep everything in this file PURE (no React, no fetch) so it is unit-testable. Import `CoverageRecord` and `ESSENTIALS_URL` from `./essentialsCoverage`.
</action>
<read_first>
- src/utils/essentialsCoverage.ts (CoverageRecord fields §65-72, ESSENTIALS_URL §78)
- C:/transparent motivations/essentials/src/lib/featureIcons.js (PRODUCT_REGISTRY shape, fixed order, reserved-slot comment pattern, resolve() contract)
</read_first>
<acceptance_criteria>
- `src/utils/featureIcons.ts` exports `FeatureIcon`, `buildEssentialsHref`, `PRODUCT_REGISTRY`, `resolveFeatureIcons`
- `PRODUCT_REGISTRY` has exactly 3 entries in order essentials/compass/readrank; compass+readrank `resolve` return `null`
- `buildEssentialsHref` uses `URLSearchParams` (grep: `searchParams.set`) and builds no href by string concatenation of `record.label`/`record.target`
- File imports `ESSENTIALS_URL` from `./essentialsCoverage`; contains no `dangerouslySetInnerHTML`
</acceptance_criteria>
</task>

<task id="126-03" type="execute" depends_on="126-01,126-02">
<action>
Create `src/components/FeatureIconRow.tsx` — the visible chip row, porting Essentials' `FeatureIconChip` (`SectionBanner.jsx`) to TT/TS.

1. **`FeatureIconChip({ icon }: { icon: FeatureIcon })`** — a single circular semi-transparent navy chip (~`h-9 w-9`, `rounded-full`, background `rgba(13,17,23,0.55)`, `backdrop-filter: blur(2px)`) wrapping an external `<a href={icon.href} target="_blank" rel="noopener noreferrer" aria-label={icon.label}>` with an `<img src={icon.iconSrc} alt="">` (decorative — the accessible name is the link's `aria-label`, ICON-02). Use `@floating-ui/react` (`useFloating`, `useHover`, `useFocus`, `useDismiss`, `useRole({role:'tooltip'})`, `useInteractions`) so a small label tooltip naming the product appears on BOTH hover and keyboard focus, positioned above the chip. Mirror Essentials' implementation.
2. **`FeatureIconRow({ icons }: { icons: FeatureIcon[] })`** — returns `null` when `icons.length === 0`; otherwise a right-aligned flex row (`gap-2`) of `FeatureIconChip`s. The row is positioned by its parent (App.tsx wires the absolute placement), so keep it layout-neutral (just the flex row).

Icons always use the `-light` variant supplied by the registry (D-126-03) — do NOT branch on theme for the symbol; the navy chip guarantees legibility in both themes.
</action>
<read_first>
- C:/transparent motivations/essentials/src/components/SectionBanner.jsx (FeatureIconChip: @floating-ui hook wiring, chip classes/inline styles, tooltip markup, external-link attrs)
- src/utils/featureIcons.ts (FeatureIcon type)
- src/components/AppHeader.tsx (TT component/TS + Tailwind conventions to match)
</read_first>
<acceptance_criteria>
- `src/components/FeatureIconRow.tsx` exports `FeatureIconRow` (and `FeatureIconChip`)
- Each chip renders `<a target="_blank" rel="noopener noreferrer" aria-label={...}>` (grep all three attrs)
- Uses `@floating-ui/react` (grep: `useFloating`) with both `useHover` and `useFocus` for hover+keyboard tooltip
- `FeatureIconRow` returns null/empty for an empty `icons` array (no empty wrapper div)
- `npx tsc -b` compiles the component with no type errors
</acceptance_criteria>
</task>

<task id="126-04" type="execute" depends_on="126-02,126-03">
<action>
Wire the row into the hero banner in `src/App.tsx`.

1. Import `FeatureIconRow` from `./components/FeatureIconRow` and `resolveFeatureIcons` from `./utils/featureIcons`.
2. The banner already computes `const essentialsCoverage = useEssentialsCoverage(selectedEntity)` (~L177) and sets `data-essentials-coverage` on the hero div. Compute `const featureIcons = resolveFeatureIcons(essentialsCoverage);` alongside it.
3. Render `<FeatureIconRow icons={featureIcons} />` inside the hero banner div, positioned **bottom-right, just above the Wikimedia credit** (D-126-02): wrap in an absolutely-positioned container (e.g. `absolute bottom-6 right-2 z-10`) so it sits above the `bottom-1 right-2` credit and never overlaps the bottom-left `<h1>` title. Keep the existing `data-essentials-coverage` attribute (Phase 125 seam / Phase 127 UAT hook).
Do NOT change banner imagery, gradient, title, or credit text.
</action>
<read_first>
- src/App.tsx (hero banner block ~L806-833: hero div, title h1, credit span at bottom-1 right-2; essentialsCoverage at ~L177)
- src/components/FeatureIconRow.tsx (props: icons: FeatureIcon[])
- src/utils/featureIcons.ts (resolveFeatureIcons signature)
</read_first>
<acceptance_criteria>
- `src/App.tsx` imports `FeatureIconRow` and `resolveFeatureIcons`, calls `resolveFeatureIcons(essentialsCoverage)`, and renders `<FeatureIconRow icons={...} />` inside the hero banner div
- The row's container is absolutely positioned bottom-right above the credit (grep: a `FeatureIconRow` usage within the hero div; credit span still present at `bottom-1 right-2`)
- Title `<h1>` and credit are unchanged; no banner image/gradient change
- `npx tsc -b` reports no unused-import / type errors
</acceptance_criteria>
</task>

<task id="126-05" type="verify" depends_on="126-01,126-02,126-03,126-04">
<action>
Prove the phase goal deterministically and confirm the build.

1. Extend `src/utils/featureIcons.test.ts` (new file; reuse the Phase 125 vitest harness + `__fixtures__/coverage.sample.json` by matching entities through `matchEntityToCoverage` then `resolveFeatureIcons`, OR by constructing `CoverageRecord`s directly). Assert:
   - Long Beach CA (city, geoid 0643000) → one essentials icon whose href contains `browse_government_list=0643000`, `browse_state=CA`, and an encoded `browse_label`.
   - A state record (California/CA) → href contains `browse_state_officials=CA`.
   - The federal record → href resolves `record.target` against ESSENTIALS_URL and contains `browse_federal_officials=1`.
   - Bloomington IN (covered, `geoids: []`) → `buildEssentialsHref` returns `null` and `resolveFeatureIcons` returns `[]` (no icon).
   - `null` record → `resolveFeatureIcons(null)` returns `[]`.
   - `PRODUCT_REGISTRY` order is `['essentials','compass','readrank']` and compass/readrank `resolve(<any record>)` return `null` (reserved, non-rendering).
   - A federal-like record with a hostile absolute `target` (e.g. `https://evil.example/x`) → `buildEssentialsHref` returns `null` (same-origin-path guard, T-126-01).
2. Run and confirm green: `npx tsc -b`, `npx vitest run`, `npm run build`.
3. Run `npm run lint` and confirm it introduces **zero new errors** vs the pre-phase baseline (the repo has 13 known pre-existing lint errors — see 125 deferred-items.md). Verify the new files (`featureIcons.ts`, `featureIcons.test.ts`, `FeatureIconRow.tsx`) contribute no errors and App.tsx's error count is unchanged. Do NOT fix pre-existing unrelated debt.
4. Append a short verification note to the phase dir recording the gate results and that live-in-app UAT is deferred to Phase 127 (TETH-03/VER-01).
</action>
<read_first>
- src/utils/essentialsCoverage.test.ts (Phase 125 vitest style + fixture import pattern)
- src/utils/__fixtures__/coverage.sample.json (fixture entities + federal target)
- src/utils/featureIcons.ts (functions under test)
- .planning/phases/125-essentials-coverage-contract/deferred-items.md (the 13-error pre-existing lint baseline)
</read_first>
<acceptance_criteria>
- `npx vitest run` exits 0 with the new featureIcons assertions passing (incl. geoid-less→[], null→[], reserved-slots→null, hostile-target→null)
- `npx tsc -b` and `npm run build` exit 0
- `npm run lint` shows no NEW errors attributable to this phase's files (App.tsx error count unchanged; new files clean)
- A verification note records gate results + defers live UAT to Phase 127
</acceptance_criteria>
</task>

## Verification

- **ICON-01/02:** `FeatureIconRow` renders bottom-right above the credit as navy chips with accessible hover+focus tooltips and external links; never obscures the title. (Visual/live check is Phase 127; structural asserts here via grep + tsc.)
- **ICON-03:** render-only-if-linkable — geoid-less/null/uncovered → `[]` → no icon; reserved slots omitted; row left-aligns live icons. Proven in vitest.
- **ICON-04:** always `-light` symbol on navy chip in both themes (D-126-03).
- **TETH-01:** per-tier href construction (city/county/state/federal) via URL/URLSearchParams. Proven in vitest.
- **TETH-02:** generic fixed-order registry, essentials live + compass/readrank reserved non-rendering. Proven in vitest.
- **Deferred (Phase 127):** end-to-end context-sensitivity across covered/uncovered/federal + Chris live-app UAT (TETH-03, VER-01).

## must_haves (goal-backward)

1. A generic, fixed-order product registry drives the row; only Essentials is live; no dead/placeholder icons (TETH-02, ICON-03).
2. The current entity resolves to a tier-correct, safely-encoded Essentials deep-link, or to no icon when no real link exists (TETH-01, ICON-03, T-126-01).
3. The icon renders as an accessible, theme-legible bottom-right chip that never obscures the title/credit, wired into App.tsx (ICON-01/02/04).
4. It's proven by an extended fixture vitest suite + green tsc/build and a clean lint-delta; live UAT deferred to Phase 127.
