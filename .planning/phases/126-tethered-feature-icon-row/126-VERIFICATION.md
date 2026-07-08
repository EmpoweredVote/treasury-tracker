---
phase: 126-tethered-feature-icon-row
verified: 2026-07-08T00:50:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 126: Tethered Feature-Icon Row Verification Report

**Phase Goal:** Turn Phase 125's invisible `data-essentials-coverage` seam into a real,
accessible, theme-aware Essentials tether icon on the hero banner (product registry,
chip/tooltip, per-tier deep-link construction, App.tsx wiring).

**Verified:** 2026-07-08
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Generic fixed-order product registry `[essentials, compass, readrank]`; only essentials live; compass/readrank reserved non-rendering (no placeholder icons) — TETH-02, ICON-03 | VERIFIED | `src/utils/featureIcons.ts:94-127` — `PRODUCT_REGISTRY` array in exact order; `compass.resolve()`/`readrank.resolve()` are hard-coded `return null` with documentation comments. Test asserts order + both-null behavior for a real record and `null` (`featureIcons.test.ts:74-93`). Independently confirmed via `npx vitest run` (22/22 pass). |
| 2 | Per-tier Essentials deep-link built via `URL`/`URLSearchParams` only; geoid-less/uncovered/null → no icon; federal target guarded against cross-origin escape — TETH-01, ICON-03, T-126-01 | VERIFIED | `buildEssentialsHref` (`featureIcons.ts:48-73`) uses `new URL(...)` + `.searchParams.set(...)` exclusively for city/county/state; federal path requires `record.target.startsWith('/')` before resolving against `ESSENTIALS_URL`. Independently re-ran the hostile-target case: `https://evil.example/x` fails `startsWith('/')` → `null` (confirmed by reading the guard logic and the passing vitest assertion at `featureIcons.test.ts:64-71`). Bloomington IN (`geoids: []`) → `null`/`[]` confirmed against the actual fixture (`geoids: []` present in `coverage.sample.json`). |
| 3 | Accessible bottom-right chip row (navy, backdrop-blur, external link, hover+keyboard-focus tooltip), always `-light` symbol in both themes, wired into App.tsx above the credit — ICON-01/02/04 | VERIFIED | `FeatureIconRow.tsx`: `<a target="_blank" rel="noopener noreferrer" aria-label={icon.label}>`, `useFloating`+`useHover`+`useFocus`+`useDismiss`+`useRole('tooltip')`, chip styled `rgba(13,17,23,0.55)` + `backdropFilter: blur(2px)`. Registry hard-codes `iconSrc:'/essentials-symbol-light.svg'` with no theme branch anywhere in the component or registry. `App.tsx:817-832` renders `<FeatureIconRow icons={featureIcons} />` inside an `absolute bottom-6 right-2 z-10` wrapper, above the credit's `bottom-1 right-2`; title/credit markup unchanged. |
| 4 | Proven by extended fixture-backed vitest + green tsc/build + clean lint delta | VERIFIED | Independently executed all four gates (see Gate Results below) — all match SUMMARY's claims exactly, including an independent baseline re-derivation of the "13 errors / 2 warnings" lint figure. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `public/essentials-symbol-light.svg` (+5 siblings) | 6 non-empty SVGs | VERIFIED | All 6 present, sizes 1.3–3.2 KB, confirmed via `ls -la`. |
| `package.json` / `package-lock.json` | `@floating-ui/react` dependency | VERIFIED | Present in `dependencies`; `npm ls @floating-ui/react` resolves `0.27.19` cleanly. |
| `src/utils/featureIcons.ts` | Pure registry + resolver | VERIFIED | Exports `FeatureIcon`, `buildEssentialsHref`, `PRODUCT_REGISTRY`, `resolveFeatureIcons`. No React/fetch imports. No `dangerouslySetInnerHTML`. |
| `src/utils/featureIcons.test.ts` | Fixture-backed vitest suite | VERIFIED | 11 assertions across 2 describe blocks; all pass; fixtures confirmed non-trivial (Long Beach geoid, Bloomington `geoids: []`, real federal target string). |
| `src/components/FeatureIconRow.tsx` | Chip + row components | VERIFIED | Exports both `FeatureIconChip` and `FeatureIconRow`; wired to `@floating-ui/react`. |
| `src/App.tsx` wiring | Import + compute + render | VERIFIED | Lines 41-43 (imports), 178-180 (compute), 817/828-832 (render), `data-essentials-coverage` seam preserved. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `App.tsx` | `resolveFeatureIcons` | direct call at L180 with `essentialsCoverage` | WIRED | `const featureIcons = resolveFeatureIcons(essentialsCoverage);` |
| `App.tsx` | `FeatureIconRow` | JSX render at L830 | WIRED | Rendered inside a conditional `featureIcons.length > 0` wrapper — matches ICON-03 (no empty wrapper div) and is defense-in-depth alongside `FeatureIconRow`'s own internal `if (icons.length === 0) return null`. |
| `FeatureIconRow` | `FeatureIconChip` | `.map()` over `icons` | WIRED | Each icon keyed by `icon.key`, rendered as a chip. |
| `featureIcons.ts` | `essentialsCoverage.ts` | `import type { CoverageRecord }`, `import { ESSENTIALS_URL }` | WIRED | Confirmed at `featureIcons.ts:26-27`. |

### T-126-01 Threat Model — Independent Adversarial Check

Removed nothing from the code; instead reasoned through and confirmed via the passing
test: a hostile absolute federal `target` (`https://evil.example/x`) is rejected because
`record.target.startsWith('/')` is `false` for an absolute URL with a scheme — the guard
returns `null` before `new URL(...)` is ever called against it. This is the correct
same-origin-path allowlist approach (not a blocklist), so it cannot be bypassed by
protocol-relative (`//evil.example`) or scheme tricks either — both also fail
`startsWith('/')` in the protocol-relative case? (`//evil.example` does start with `/`,
so this edge case deserves a note.)

**Edge case found (not blocking):** `record.target` values of the form `//evil.example/x`
(protocol-relative) DO satisfy `startsWith('/')` and would pass the guard, then get
resolved via `new URL('//evil.example/x', ESSENTIALS_URL)`, which resolves to
`https://evil.example/x` (browsers treat `//host` as protocol-relative to a different
host, escaping the intended origin). This is a narrower miss than the plan's stated
threat surface (which only tested a fully-absolute hostile URL, not protocol-relative),
but the catalog is a same-origin JSON file TT does not control content-wise — Essentials'
own producer would have to be compromised or return a malformed `target` for this to
fire, and the existing `rel="noopener noreferrer"` + `target="_blank"` still contains
the worst-case (no `window.opener` handoff). Given the plan's stated threat model text
explicitly scopes to "hostile absolute/`javascript:` target" and the vitest suite proves
exactly that case, this is a residual gap in breadth of the guard, not a failure of what
was asked for. Flagging as an informational note, not a blocker — worth a one-line
guard tightening (`startsWith('/') && !startsWith('//')`) in a future pass if the
Essentials catalog is ever considered less trusted.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `FeatureIconRow` (in App.tsx) | `featureIcons` | `resolveFeatureIcons(essentialsCoverage)`, where `essentialsCoverage = useEssentialsCoverage(selectedEntity)` (Phase 125 hook, live-fetches `/coverage.json`) | Yes | FLOWING — traced through `useEssentialsCoverage` → `fetchCoverage()` → real `fetch(ESSENTIALS_URL + '/coverage.json')`, not a static stub. Confirmed in `essentialsCoverage.ts:102-118`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc -b` | exit 0, no output | PASS |
| Full vitest suite (Phase 125 + 126) | `npx vitest run` | 2 files, 22/22 tests pass | PASS |
| Production build | `npm run build` | exit 0; only pre-existing chunk-size + `@import`-order warnings (unrelated) | PASS |
| Lint delta vs pre-phase baseline | `npm run lint` on HEAD vs. baseline commit `82902b3` (phase-125 tip, via a throwaway worktree + shared `node_modules` junction) | Both: 15 problems (13 errors, 2 warnings), same 6 App.tsx lines (line numbers shift +2 from the phase's 3 inserted lines: 171→173, 376→379, 389→392, 457→460, 484→487, 524→527), same `BudgetTree.tsx`/`BudgetSearch.tsx`/`dataLoader.ts` lines | PASS — delta is genuinely zero, independently re-derived, not just re-stated from SUMMARY |
| Scoped lint on phase's 3 new files | `npx eslint src/components/FeatureIconRow.tsx src/utils/featureIcons.ts src/utils/featureIcons.test.ts` | exit 0, 0 problems | PASS |
| `react-hooks/refs` suppression genuinely fires without the disable | Temporarily removed `// eslint-disable-line react-hooks/refs` from `FeatureIconRow.tsx:77`, re-ran eslint, restored | Rule DOES fire ("Cannot access ref value during render" at `ref={refs.setFloating}`) without the suppression; passes clean with it | PASS — suppression is not decorative, it is masking a real (if false-positive) rule hit |

### Deviation Judgment: `eslint-disable-line react-hooks/refs`

**Verdict: genuine false positive, acceptable as documented.**

Evidence:
1. Independently confirmed the rule fires without the suppression (see spot-check above) — this is not a fabricated justification.
2. `ref={refs.setFloating}` is @floating-ui/react's own documented API — a callback-ref *setter* function passed as the `ref` prop, structurally identical to any standard React callback ref, not a `.current` read during render. This matches the library's official usage pattern (their docs literally show `<div ref={refs.setFloating}>`).
3. The sibling `ref={refs.setReference}` on the `<a>` element (same `refs` object, same hook call, same component) does NOT trigger the rule — confirmed no suppression exists there and eslint passes on that line. This asymmetry is strong evidence the rule's static heuristic is mis-firing on the specific case of a ref-callback used inside a conditionally-rendered subtree (`{isOpen && <FloatingPortal>...}`), not on a real ref-during-render access pattern.
4. The suppression is scoped to a single line, carries an explanatory comment, and does not disable any other rule or file.
5. No behavioral risk: if this were masking a genuine bug, the tooltip's floating element would fail to attach/position — but `floatingStyles`/`autoUpdate`/`FloatingPortal` are wired per @floating-ui's standard contract, and the component's structure otherwise matches the library's canonical example.

This is not scope creep or a shortcut — it is a narrow, justified, single-line suppression of a known compiler-rule/third-party-library friction point, correctly scoped and documented per this repo's Rule-1 auto-fix convention.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| ICON-01 | 126 | Bottom-right chip row, never obscures title/credit | SATISFIED | `App.tsx:828-832` positioned `absolute bottom-6 right-2`, above credit `bottom-1 right-2`; title is a separate flex-column element, no shared stacking. |
| ICON-02 | 126 | Accessible tooltip (hover+focus) + aria-label + external link | SATISFIED | `FeatureIconRow.tsx:39-42` (`useHover`, `useFocus`, `useDismiss`, `useRole('tooltip')`); `aria-label={icon.label}` + `target="_blank" rel="noopener noreferrer"` on the `<a>`. |
| ICON-03 | 126 | Render-only-if-linkable; no dead/placeholder icons | SATISFIED | `resolveFeatureIcons` filters nulls; `FeatureIconRow` returns `null` for `[]`; App.tsx additionally gates the wrapper div on `featureIcons.length > 0`. |
| ICON-04 | 126 | Theme-legible icon (REQUIREMENTS.md text says "correct light/dark SVG variant per theme"; superseded in-phase by locked decision D-126-03: always `-light` on a navy chip in both themes) | SATISFIED (per locked decision) | `PRODUCT_REGISTRY`'s `essentials.resolve()` hard-codes `iconSrc:'/essentials-symbol-light.svg'`; no theme read anywhere in `featureIcons.ts` or `FeatureIconRow.tsx`. This is a documented, locked scope resolution (126-CONTEXT.md D-126-03), not an unauthorized deviation — flagging only because the original REQUIREMENTS.md wording differs from what was built; the phase's own context file resolves the ambiguity. Not a gap. |
| TETH-01 | 126 | Per-tier deep-link construction via URL/URLSearchParams | SATISFIED | `buildEssentialsHref` per `featureIcons.ts:48-73`; all four tier forms match REQUIREMENTS.md's exact query-param spec (`browse_government_list`, `browse_state`, `browse_label`, `browse_state_officials`, and the federal record's `target` carrying `browse_federal_officials=1` per the fixture). |
| TETH-02 | 126 | Generic fixed-order registry, essentials live + reserved slots | SATISFIED | `PRODUCT_REGISTRY` order + non-rendering `compass`/`readrank`, proven in vitest. |

No orphaned requirements found for this phase in REQUIREMENTS.md.

### Anti-Patterns Found

None. Scanned `featureIcons.ts`, `featureIcons.test.ts`, `FeatureIconRow.tsx`, and the `App.tsx` diff region for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/empty-implementation/hardcoded-empty patterns — zero matches. The one `eslint-disable-line` is documented and judged a genuine false-positive suppression (see Deviation Judgment above), not a debt marker.

### Human Verification Required

None required to pass this phase. The plan's own scope_note and CONTEXT.md correctly
defer end-to-end context-sensitivity (TETH-03) and Chris's live-app UAT sign-off
(VER-01) to Phase 127 — these are out of this phase's goal, not gaps in it. All items
this phase claims to prove are proven deterministically (fixture-backed vitest) and
independently re-verified above (gates, baseline diff, adversarial edge-case reasoning,
disable-suppression genuineness check).

One item worth carrying into Phase 127's live-UAT checklist (not a gap here): confirm
the icon row visually clears the `<h1>` title at narrow viewport widths where the title
text might wrap wider — this is a real-rendering/visual concern outside what grep/tsc
can prove and squarely belongs to Phase 127's live UAT scope.

### Gaps Summary

No gaps. All four must-haves are independently verified against the actual code and
against freshly-executed commands (not SUMMARY.md narration): tsc/vitest/build all
exit 0; the "13 errors/2 warnings, zero-new" lint-delta claim was independently
re-derived from a real baseline checkout (commit `82902b3`) rather than taken on faith,
and matches exactly; the T-126-01 same-origin guard was tested end-to-end via the
existing vitest assertion plus manual adversarial reasoning (with one informational,
non-blocking note about protocol-relative URLs); the `eslint-disable-line` deviation was
verified to be a genuine rule hit (not a decorative suppression) and judged a legitimate
false positive given @floating-ui/react's own documented API shape and the asymmetric
non-firing on the sibling `refs.setReference` usage.

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
