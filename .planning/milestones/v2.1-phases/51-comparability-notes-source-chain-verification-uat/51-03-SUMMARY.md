# Plan 51-03 Summary — Comparability notes UI

**Status:** Complete
**Commits:** `feat(51-03): ComparabilityNote component + content type + static loader` · `feat(51-03): render TQ explanation + historical drift notes`
**Requirements:** CTX-02 (criterion: surface the sourced comparability content in-app)

## What changed
- **Types** (`src/types/budget.ts`): `ComparabilitySource`, `AgencyReorganization`, `ComparabilityContent`.
- **Loader** (`src/data/comparability.ts`, new): static import of the committed `data/federal-comparability.json` — $0, no API/network change. Enabled `resolveJsonModule` in `tsconfig.app.json` (the cross-root import type-checks under `tsc -b`).
- **Component** (`src/components/federal/ComparabilityNote.tsx`, new): compact, expandable panel mirroring `MethodologyPanel`. Renders titled prose entries (each with optional verbatim quote + a `SourceChip`) and an optional agency-reorganization list (each row chipped to its enabling public law). `defaultOpen` + `reorgHeading` props.
- **TQ view** (`src/components/federal/FederalLanding.tsx`): the `!summary` branch now renders the sourced Transition-Quarter note (`defaultOpen`) when `periodLabel !== null`, replacing Phase 50's bare neutral heading.
- **Historical years** (`src/App.tsx`): on federal annual years that are not the current/default year and not the TQ, renders the function-comparability note plus the Cabinet departments **created after the viewed fiscal year** (`agency_reorganizations.filter(r => r.year > viewedYear)`), so an FY1976 agency lens explains why DOE/Education/HHS/VA/DHS aren't there, while FY2024 shows none. FY2025 default and the TQ stay clean.

## Verification
- `npm run build` (tsc -b && vite build) → **green** (exit 0). Pre-existing CSS `@import`-order and 500kB chunk warnings only; no new warnings.
- No regression to FY2025 default / city / state paths: the note is gated to `entity_type === 'federal'` historical years; the default-year and non-federal branches are untouched.

## Notes
- Observed UAT (notes render correctly on a historical year + the TQ, source links work) is performed in 51-04 against the deployed build.
- Reorg filtering is data-driven from the sourced content; adding a future reorganization to the JSON automatically surfaces it on the relevant historical years.
