# Phase 91 — Integration / Render Evidence (MNLINK-01 render half)

**Date:** 2026-06-27
**Method:** data-layer probes + state-agnostic-component code review + production build — then a human visual spot-check (the `autonomous: false` gate). No frontend code created or modified (CONTEXT D-09, reuse-only).

## Data layer (drives the existing UI) — VERIFIED
- **858 MN cities**, **87 MN counties** (entity_type='county', "<Name> County"), **1 "Minnesota" state node** (entity_type='state', pop 5,706,494).
- **852/858 cities linked** to their parent county via `county_id` (6 link-residual: blank ParentEntityName in source — recorded in `mnCountyResidual.json`, not phantom-linked).
- Counties have `county_id` NULL (top sub-state tier).
- Anchor chains resolve: Minneapolis / St. Louis Park / Bloomington / Minnetonka → **Hennepin County**; Saint Paul → **Ramsey County**.

## Existing rendering primitives are state-agnostic (code-confirmed — no rebuild)
- `src/components/EntitySwitcher.tsx` — shows `entity_type==='state'` nodes (line 79) and groups localities generically; uses `STATE_NAMES['MN']='Minnesota'` (`src/utils/wikiImage.ts`) for the group header + search. No state allowlist excludes MN.
- `src/App.tsx` `jurisdictionParents` (line 553) resolves `selectedEntity.county_id` → the county municipality (line 559–560) and composes the US→state→county→locality breadcrumb (`<Breadcrumb>`, line 891). With MN `county_id` set, MN city breadcrumbs resolve automatically.
- `src/components/CitiesInCountyPanel.tsx` — lists cities whose `county_id` = the viewed county (App.tsx line 631 gates it on `entity_type==='county'`). MN counties populate it once cities are linked (done).
- This is the identical path proven for Ohio (Phase 86) + VA — MN now has the same data shape, so it renders without code change.

## Build — GREEN
`npm run build` → ✓ 2322 modules transformed, built in 5.83s, no errors.

## Human visual spot-check (the in-phase render confirmation)
> Full visual UAT across all anchors is Phase 93 (MNVER). This is the in-phase confirmation that the existing UI renders the MN hierarchy.

Click-paths to confirm at treasurytracker.empowered.vote:
1. **Minnesota hub** — "Minnesota" appears in the entity picker (State Governments) and is selectable.
2. **County page** — open **Hennepin County** → operating + revenue render with per-capita; the Cities-in-County panel lists Minneapolis, Bloomington, Minnetonka, St. Louis Park, etc.
3. **City breadcrumb** — open **Minneapolis** → breadcrumb reads **US → Minnesota → Hennepin County → Minneapolis**; a "Hennepin County →" context link is present.
4. Spot-check figure: Hennepin County FY2021 operating $1,834,835,822 / revenue $1,851,255,583; Minneapolis FY2023 revenue $1,192,133,233.

**Result:** ✅ **PASS — Chris confirmed (2026-06-27)** the live app renders the MN hierarchy: Minnesota hub selectable, Hennepin County page with data + Cities-in-County panel, and the US → Minnesota → Hennepin County → Minneapolis breadcrumb. Existing components, no frontend code change (D-09). Full visual UAT across all RCV anchors remains Phase 93.
