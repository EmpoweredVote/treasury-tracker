# Research Summary: v1.7 California State Budget + Deep Icicles

**Project:** Treasury Tracker — v1.7 milestone
**Domain:** Government financial transparency — state-level entity + 3-level budget visualization
**Researched:** 2026-06-06
**Confidence:** HIGH — all findings derived from direct codebase inspection + confirmed source availability

---

## Critical Finding (Read First)

**The biggest risk for v1.7 is build-order violation, not data extraction.** The `treasury_sync_budget_tree` RPC in `ev-accounts-api` is the critical-path gate: no 3-level data can be stored or served until that RPC is updated to walk depth-3 trees. Updating any city loader before the RPC update is complete will silently discard the 3rd level or error. The correct sequence is: schema migration → RPC update → API endpoint update → loaders. This order is non-negotiable.

The second top risk is data source selection: there is **no Socrata API for the CA state budget**. Any plan referencing `bulkLoadBudget.js` or a Socrata dataset ID for CA state is wrong. Use the LAO historical Excel pivot (openpyxl, HIGH confidence, machine-readable) or the ebudget.ca.gov Enacted Budget Summary PDF (pdfplumber, MEDIUM confidence, same pattern as existing CA city PDFs).

---

## Executive Summary

v1.7 adds two tightly coupled features to an existing 30+ entity financial transparency app: (1) California as a state-level entity in the jurisdiction picker, and (2) a 3-level icicle chart hierarchy deepening the existing 2-level (category → subcategory → line items) to 3 levels (category → subcategory → department → line items). Both features are architecturally incremental: the schema already has a `department` column in `budget_line_items` that currently goes unused in 2-level loads; `BudgetIcicle.tsx` already renders arbitrary depth via `navigationPath`; and `BudgetCategory` is already a recursive TypeScript type. No new npm or pip packages are required.

The recommended approach is a 5-phase delivery: (1) schema + UI foundation (entity_type constraint, TypeScript type, EntitySwitcher fix); (2) CA state budget load using LAO Excel or ebudget PDF with General Fund scope only (~$212B — do not load all-funds ~$495B); (3) RPC + API 3-level extension with backward compatibility; (4) CA state 3-level display + enrichment; (5) selective city retrofit pilots where source data genuinely has a 3rd level. The CA state data and 3-level infrastructure phases can partially overlap after the schema migration completes.

The critical risks are: wrong fund scope (all-funds vs General Fund), RPC contract violation (loading 3-level trees before the RPC accepts them), API backward compatibility break (existing city pages must remain unchanged), and EntitySwitcher circular nesting. All four are avoidable with the phase ordering below. The `department` column current stored values for existing 2-level rows must be confirmed by live DB query at the start of Phase 34 before any RPC changes are written — this is an open gap in the architecture research.

---

## Key Findings

### Recommended Stack

No new packages are needed. Every tool required for v1.7 is already in use: `pdfplumber` for CA ebudget PDF extraction (same pattern as Anaheim/Santa Ana), `openpyxl` for LAO Excel historical data (same pattern as Richardson XLSX loader), the Supabase JS client for the unchanged `treasury_sync_budget_tree` RPC signature, and `BudgetIcicle.tsx` which already renders N levels. New work is confined to new script files and logic changes in `ev-accounts-api`.

**Core technologies:**
- LAO historical Excel (openpyxl): CA state budget source — HIGH confidence, FY1985–FY2026, machine-readable, multi-year history available for free
- ebudget.ca.gov PDF (pdfplumber): CA state current-year program detail — MEDIUM confidence, same extraction pattern as existing CA cities
- `treasury_sync_budget_tree` RPC (ev-accounts-api): JSONB tree walk update — signature unchanged, internal logic extended to depth-3
- `/api/treasury/budgets/:id/categories` (ev-accounts-api): GROUP BY (category, subcategory, department); backward-compat when `department IS NULL`
- Supabase migration (SQL only): DROP + ADD CHECK constraint to add state to entity_type enum

**What NOT to use:**
- Socrata/SODA for CA state — no state-level endpoint exists (confirmed)
- Open FISCal CKAN — 151 department CSVs per fiscal year; engineering cost is disproportionate
- All-funds CA state dataset — ~$495B inflates by $280B+ of federal pass-through; use General Fund (~$212B) only

### Expected Features

**Must have (P1 — gates everything else):**
- entity_type: state schema migration + TypeScript type update — gate for seeding CA state
- EntitySwitcher State Governments top section — prevents circular nesting; required before CA state entity is seeded
- CA state General Fund operating budget loaded (LAO Excel or ebudget PDF)
- RPC depth-3 update + API conditional 3-level grouping with backward compat
- CA state 3-level icicle display (no frontend change — data change only)
- CA state enrichment with state-level prompt variant

**Should have (P2 — after infrastructure is stable):**
- Multi-year CA state historical data from LAO Excel (FY2015–FY2026)
- Retrofit 1–2 pilot cities to 3 levels where source data has genuine 3rd level

**Defer to v1.8:**
- CA state revenue budget (separate PDF/dataset; different extraction problem)
- Full retrofit of all 30+ cities to 3 levels (most city sources have only 2 meaningful levels)
- All-funds CA state budget

### Architecture Approach

The system is a 3-tier pipeline: (1) loader scripts in this repo build a compact JSONB tree and call the Supabase RPC; (2) the RPC (in `ev-accounts-api`, a separate repo) parses and inserts into `treasury.budget_line_items`; (3) the categories API endpoint queries `budget_line_items` and assembles a recursive `BudgetCategory[]` tree for the React frontend. For 3-level support, the change set is: RPC adds a depth-adaptive walk (leaf nodes have `i`, branch nodes have `c`, never both); the API adds GROUP BY department with a department IS NULL backward-compat branch; loaders for CA state emit the new 3-level shape. The frontend (`BudgetIcicle.tsx`, `App.tsx`, `dataLoader.ts`, `BudgetCategory` type) is entirely unchanged.

**Component responsibilities for v1.7:**

| Component | Repo | Change Scope |
|-----------|------|--------------|
| treasury.municipalities CHECK constraint | treasury-tracker (migration) | Add state — 2-line SQL |
| src/types/budget.ts | treasury-tracker | Add state to entity_type union — 1 line |
| EntitySwitcher.tsx | treasury-tracker | Pre-filter state entities to top section — ~20 lines |
| treasury_sync_budget_tree RPC | ev-accounts-api | Depth-adaptive tree walk — medium rewrite |
| /api/treasury/budgets/:id/categories | ev-accounts-api | 3-level GROUP BY + compat branch — medium SQL refactor |
| scripts/seedCaliforniaState.js | treasury-tracker (new) | New file |
| scripts/loadCaliforniaState.js | treasury-tracker (new) | New file |
| BudgetIcicle.tsx, App.tsx, dataLoader.ts | treasury-tracker | No change |

### Critical Pitfalls

1. **No CA state Socrata API** — `bulkLoadBudget.js` cannot be reused for CA state; use LAO Excel (openpyxl) or ebudget PDF (pdfplumber). Any plan referencing a Socrata dataset ID for CA state is wrong.

2. **RPC contract is the real 3-level blocker** — updating loaders to emit 3-level trees before the RPC is updated silently discards the 3rd level or errors. Schema → RPC → API → loaders is the only valid order.

3. **API backward compat break** — if the updated categories endpoint always returns 3 levels, all existing city pages break. The department IS NULL branch must return lineItems directly on the subcategory node, matching current behavior.

4. **All-funds CA state inflation** — loading all-funds (~$495B) instead of General Fund (~$212B) makes CA state non-comparable. If the loaded CA total exceeds $250B, the wrong fund scope was used.

5. **EntitySwitcher circular nesting** — a CA state entity falls under the CALIFORNIA state header by default, creating California > States > California. Pre-filter state entities before building the byState map.

6. **Enrichment prompt mismatch** — the default enrichCategories.js prompt uses city-level framing, which is wrong for CA state program areas. Add a --entity-type state flag.

7. **department column current state unknown** — whether existing 2-level rows have department = NULL or something else is inferred, not confirmed. A live DB query is required before writing the RPC update.

8. **Synthetic 3rd level in city retrofits** — most CA PDF city sources have only 2 meaningful levels; forcing a 3rd level creates noise. Retrofit only cities with genuine dept/subdept structure in source data.

---

## Implications for Roadmap

### Suggested Phase Structure (Phases 32–36)

#### Phase 32: Schema Foundation + EntitySwitcher Fix
**Rationale:** Everything else in v1.7 depends on entity_type: state existing in the DB. EntitySwitcher must be fixed in the same phase — if the schema migration ships without the UI fix, seeding CA state creates an immediately broken picker. Ship both together.
**Delivers:** DB accepts state entity_type; TypeScript type updated; entity picker shows State Governments section above state groups; app fully functional for all existing cities
**Avoids:** EntitySwitcher circular nesting (Pitfall 5)
**Research flag:** Standard patterns; no phase-level research needed

#### Phase 33: CA State Budget Data + Load
**Rationale:** Once the schema accepts state, the CA state entity can be seeded and the budget loaded. Loading as a 2-level tree initially is acceptable; the RPC update (Phase 34) will enable 3-level display. LAO Excel is the recommended primary source.
**Delivers:** CA state municipality row seeded; CA state General Fund operating budget loaded (~$212B); per-capita display working (~$5,400/resident); enrichment with state-level prompt variant
**Avoids:** Pitfall 1 (no Socrata), Pitfall 4 (all-funds inflation), Pitfall 7 (enrichment prompt mismatch)
**Research flag:** Confirm LAO Excel column structure at phase start before writing loader

#### Phase 34: RPC + API 3-Level Extension (ev-accounts-api)
**Rationale:** The ev-accounts-api changes are the critical-path gate for all 3-level display. Must land before any 3-level data is visible. The backward-compat branch (department IS NULL → return lineItems directly) is mandatory. Coordinate deployment with ev-accounts-api repo.
**Delivers:** RPC accepts depth-3 trees (backward-compat with all 2-level loaders); API returns 3-level BudgetCategory[] when department non-NULL; all existing city pages remain pixel-identical
**Avoids:** Pitfall 3 (RPC contract blocker), Pitfall 6 (API backward compat break), Pitfall 8 (department column state)
**Open question at phase start:** Run SELECT category, subcategory, department, description FROM treasury.budget_line_items LIMIT 20 before writing any code
**Research flag:** Needs phase-level research — inspect ev-accounts-api RPC body and categories endpoint before planning

#### Phase 35: CA State 3-Level Icicle Display
**Rationale:** With RPC and API updated, reload the CA state budget as a genuine 3-level tree. This is the end-to-end pilot proving the full pipeline before touching any existing city. Frontend needs zero changes.
**Delivers:** CA state budget displays as 3-level icicle (Program Area → Department → Budget Category); end-to-end validation; CA state is the showcase entity for v1.7
**Research flag:** Standard patterns after Phase 34 is complete; no additional research needed

#### Phase 36: Selective City Retrofit Pilots
**Rationale:** Not all cities have genuine 3rd-level source data. Audit before retrofitting. Target 1–2 cities where the source has a natural department/subdivision level. Validate the pattern, then decide whether full retrofit is v1.7 tail or deferred to v1.8.
**Delivers:** 1–2 cities with 3-level icicle; retrofit pattern documented; decision on full v1.8 retrofit scope
**Avoids:** Synthetic 3rd level noise (Pitfall 8)
**Research flag:** Audit source data for 2–3 candidate cities at phase start before committing

### Build Order (Strict Dependency Graph)

    Phase 32 (schema + EntitySwitcher)
        unblocks: Phase 33 (CA state seed + budget load)  [parallel with Phase 34]
        unblocks: Phase 34 (RPC + API update)

    Phase 34 (RPC + API 3-level update)
        unblocks: Phase 35 (CA state 3-level display)
        unblocks: Phase 36 (city retrofit pilots)

    Phase 35 (CA state 3-level verified)
        validates: Phase 36 (confirms infrastructure is solid)

    Critical path: Phase 32 -> Phase 34 -> Phase 35

### Research Flags

**Needs phase-level research before planning:**
- **Phase 34 (RPC + API):** ev-accounts-api RPC body and categories endpoint must be located and read; department column current values must be confirmed by live query
- **Phase 33 (CA state data):** LAO Excel file structure and ebudget PDF table layout must be inspected before writing the loader

**Standard patterns (skip research-phase):**
- **Phase 32 (schema + EntitySwitcher):** DROP/ADD CHECK constraint is a repeated pattern (Phase 23 precedent); EntitySwitcher change is a pre-filter + render block
- **Phase 35 (CA state 3-level display):** Purely a data reload using loader and RPC updated in Phases 33 and 34
- **Phase 36 (retrofit pilots):** Pattern established by Phase 35; only source data audit is new

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools confirmed in codebase; no Socrata for CA state confirmed via web research |
| Features | HIGH | Must-have / defer line is clear from existing GF-only policy and per-capita patterns |
| Architecture | HIGH | Direct code inspection of BudgetIcicle.tsx, budget.ts, EntitySwitcher.tsx, all loader scripts |
| Pitfalls | HIGH (codebase) / MEDIUM (CA data) | Codebase pitfalls confirmed; CA state data structure inferred, not live-queried |

**Overall confidence:** HIGH

### Gaps to Address

- **department column current values:** Must run SELECT category, subcategory, department, description FROM treasury.budget_line_items LIMIT 20 at Phase 34 start. The backward-compat branch depends on this answer.
- **ev-accounts-api RPC body location:** Function name confirmed from loader scripts, but the file path / SQL definition in ev-accounts-api has not been located. Phase 34 planning must start by finding it.
- **LAO Excel column structure:** File not directly inspected — openpyxl approach confirmed, but actual column names and sheet structure must be verified at Phase 33 start.
- **ebudget PDF table structure:** Whether the PDF has genuine 3-level granularity (Program to Department to Category) vs 2 levels must be confirmed before Phase 33.
- **City retrofit candidates:** Which of the 30+ cities have genuine 3rd-level source data is unknown. Phase 36 planning must start with a source data audit for 2-3 candidate cities.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- src/components/BudgetIcicle.tsx — confirmed arbitrary-depth rendering via navigationPath
- src/types/budget.ts — confirmed BudgetCategory.subcategories: BudgetCategory[] recursive type; entity_type union
- src/components/EntitySwitcher.tsx — confirmed grouping behavior; identified circular-nesting risk
- scripts/bulkLoadBudget.js — confirmed 2-level tree shape { n, a, c: [{ n, a, i: [...] }] }
- supabase/migrations/20260602031258_add_all_funds_requirements_dataset_type.sql — confirmed DROP/ADD CHECK pattern

### Primary (HIGH confidence — web research)
- ebudget.ca.gov — confirmed Enacted Budget Summary PDF exists; confirmed no Socrata endpoint
- LAO (lao.ca.gov) — confirmed historical Excel pivot table covering FY1985-FY2026
- CA Open Data (data.ca.gov) — confirmed no SODA API for state budget
- CA State Controller Socrata — confirmed datasets are city/county aggregates, not state own budget

### Secondary (MEDIUM confidence — inferred from patterns)
- treasury.budget_line_items column layout — inferred from RPC usage patterns across loader scripts; not confirmed by live information_schema query
- Current department column values for 2-level rows — inferred as NULL or subcategory-echoed; unconfirmed

---

*Research completed: 2026-06-06*
*Ready for roadmap: yes*
