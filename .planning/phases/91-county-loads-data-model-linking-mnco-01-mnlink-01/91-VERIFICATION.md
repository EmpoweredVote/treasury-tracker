---
phase: 91-county-loads-data-model-linking-mnco-01-mnlink-01
verified: 2026-06-27
status: passed
requirements: [MNCO-01, MNLINK-01]
method: goal-backward (inline) — production read-back probes + idempotency re-run + human render confirmation
---

# Phase 91 Verification — County Loads + Data Model & Linking

**Phase goal:** Load all 87 county governments and establish the Minnesota state node + source-driven city→county linking.

## Success criteria (ROADMAP) — all PASS

1. **All 87 county governments loaded operating + revenue, per-capita, sourced.**
   ✅ PASS — **87** MN counties (entity_type='county', "<Name> County") loaded across FY2013–2017 + FY2019–2021 (FY2018/2022/2023 have no county XLSX — documented). Per-FY op==rev (87/87 … 85/85); **0 NULL source_url**; populations refreshed to latest FY. Hennepin County FY2021 read-back: operating $1,834,835,822 / revenue $1,851,255,583, pop 1,289,645. Fixed a source casing dup ("Lake of the Woods" ×3 → 1 canonical) → exactly 87.

2. **Minnesota state node created; cities linked to parent county via the source `ParentEntityName` column (link residual documented).**
   ✅ PASS — exactly **1** "Minnesota" entity_type='state' node (pop 5,706,494; pre-existing, verified, not duplicated). **852/858 cities** linked via `linkMNCitiesToCounties.js` reading `ParentEntityName` (no authored map); **6 link-residual** (blank ParentEntityName in source) recorded in `scripts/mnCountyResidual.json` — no phantom links. Counties keep `county_id` NULL. All 5 RCV anchors resolve (Minneapolis→Hennepin County; Saint Paul→Ramsey County).

3. **US→Minnesota→county→city breadcrumb + Cities-in-County panel render in the live app (existing frontend, no rebuild).**
   ✅ PASS — existing state-agnostic components (`EntitySwitcher`, `App.tsx jurisdictionParents`, `CitiesInCountyPanel`) render MN with no code change; `STATE_NAMES['MN']='Minnesota'`; `npm run build` green. Human visual confirmed by Chris (2026-06-27): Minnesota hub, Hennepin County page + Cities-in-County panel, and the US→Minnesota→Hennepin County→Minneapolis breadcrumb. Evidence: `91-INTEGRATION.md`.

## Requirements
- **MNCO-01** ✅ — 87 counties loaded, sourced, per-capita.
- **MNLINK-01** ✅ — MN state node verified + city→county linking via ParentEntityName + breadcrumb/Cities-in-County render.

## Idempotency
✅ Re-run linker → 0 to-link (852 already correct); re-run county FY2021 → 87 county munis unchanged, 0 new. Never-overwrite guard + canonical-name alias keep re-runs stable.

## Notable findings (carried forward)
- **County data lags cities**: latest county = FY2021 (FY2022–2023 unpublished as XLSX) — documented ceiling.
- **County files have no GAAPInd** → county basis null (D-03).
- **"Lake of the Woods" casing variants** in source → canonical alias (`scripts/mnCountyNameCanonical.json`) prevents recurrence.
- **6 cities** have blank ParentEntityName (Birchwood, Boy River, Fertile, Gilbert, Thomson, Trosky) — unlinked, recorded; Phase 93 may add authored fallbacks.
- Tooling regression net: `node --test scripts/loadMNOSA.test.mjs` → 16/16.

## Scope discipline
- Enrichment = Phase 92; ACFR reconciliation + source-chain audit + full UAT = Phase 93. This phase did the in-phase render confirmation only.

**Verdict: PASSED.** All 87 MN counties are live, sourced, per-capita; cities linked to counties under the Minnesota state node; the existing UI renders the full hierarchy. Ready for Phase 92.
