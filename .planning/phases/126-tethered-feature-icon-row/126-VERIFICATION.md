# Phase 126 — Verification Note

**Task:** 126-05 (verify)
**Date:** 2026-07-08

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `npx tsc -b` | exit 0, no errors |
| Unit tests | `npx vitest run` | exit 0 — 2 files, **22/22 tests pass** (11 from Phase 125's `essentialsCoverage.test.ts` + 11 new in `src/utils/featureIcons.test.ts`) |
| Build | `npm run build` | exit 0 (`tsc -b && vite build`); pre-existing chunk-size + `@import`-order warnings only (unrelated to this phase) |
| Lint delta | `npm run lint` | **15 problems (13 errors, 2 warnings) — identical to the Phase 125 baseline** (see `125-essentials-coverage-contract/deferred-items.md`). New files (`featureIcons.ts`, `featureIcons.test.ts`, `FeatureIconRow.tsx`) contribute **zero** errors/warnings (confirmed via `npx eslint <files>` scoped run, 3x for determinism). `App.tsx`'s error count is unchanged at 6 pre-existing `react-hooks/set-state-in-effect` errors (same effect bodies, line numbers shifted by the +3 lines this phase inserted — not new violations). |

## New-file vitest assertions (featureIcons.test.ts)

- Long Beach CA (city) → one essentials icon; href contains `browse_government_list=0643000`, `browse_state=CA`, `browse_label=Long+Beach`.
- California/CA (state) → href contains `browse_state_officials=CA`.
- Federal record → href resolves against `ESSENTIALS_URL`, contains `browse_federal_officials=1`.
- Bloomington IN (covered, `geoids: []`) → `buildEssentialsHref` → `null`; `resolveFeatureIcons` → `[]`.
- `null` record → `resolveFeatureIcons(null)` → `[]`.
- Hostile absolute federal `target` (`https://evil.example/x`) → `buildEssentialsHref` → `null` (T-126-01 same-origin-path guard).
- `PRODUCT_REGISTRY` order is exactly `['essentials','compass','readrank']`; `compass`/`readrank` `.resolve()` always return `null` (reserved, non-rendering), for both a real record and `null`.

## Deviation note (Rule 1 auto-fix)

`eslint-plugin-react-hooks@7.0.1`'s compiler-based `react-hooks/refs` rule
false-positived on `ref={refs.setFloating}` inside the `FloatingPortal`
subtree in `FeatureIconChip` — `refs.setFloating` is a stable ref-callback
*setter* from `@floating-ui/react`'s `useFloating()`, not a mutable `.current`
read, so this is not a real ref-during-render violation. Suppressed with a
scoped `eslint-disable-line` + comment (verified deterministic across 3 lint
runs). No other file in this phase needed a similar suppression.

## Deferred to Phase 127

Per the phase's `scope_note` (126-PLAN.md) and CONTEXT.md, this plan proves
the render-time "null resolver → no icon" logic deterministically via the
fixture-backed vitest suite above. It does **not** cover:

- End-to-end context-sensitivity across covered / uncovered / federal entities
  in the live running app (TETH-03).
- Chris's live-app UAT sign-off (VER-01).

Both are explicitly Phase 127 scope (`127-context-sensitivity-live-uat`, not
yet started).
