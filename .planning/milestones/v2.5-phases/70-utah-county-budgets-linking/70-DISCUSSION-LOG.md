# Phase 70: Utah County Budgets + Linking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 70-utah-county-budgets-linking
**Areas discussed:** County tree shape, Linking membership source, County population source, County entity_type handling

---

## County tree shape

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse fund1→org1→cat1 (D-69-01) | County fund mix separates legibly under the fund top-level; icicle sorts by amount | ✓ |
| Revisit / new shape for counties | Counties have a different fund mix | |

**User's choice:** Reuse the city fund tree unchanged (D-70-01).
**Notes:** Consistency + zero new tuning; same all-funds basis and loader.

---

## Linking membership source

| Option | Description | Selected |
|--------|-------------|----------|
| Feed explicit map from utah-entity-mapping.md | seedCountyLinks' SCO fetch is CA-only; use a --cities flag / Utah membership source | ✓ |
| Keep API-derived membership | Dead for Utah (no SCO equivalent) | |

**User's choice:** Explicit mapping-doc membership, generalize seedCountyLinks with a `--cities` flag (D-70-02).
**Notes:** All 10 cities map cleanly to one of the 5 counties — no orphans. MA non-SCO precedent (`seedMACountyLinks.js`).

---

## County population source

| Option | Description | Selected |
|--------|-------------|----------|
| Extend loadUTPopulation.js for counties | Census county file (co-est, SUMLEV 050, FIPS 49), vintage 2024 | ✓ |
| Skip county per-capita | Would leave county pages without $/resident | |

**User's choice:** Extend loadUTPopulation.js, county-level Census, vintage 2024 (D-70-03).
**Notes:** Vintage 2024 chosen to match the cities so per-capita is comparable across the hierarchy.

---

## County entity_type handling

| Option | Description | Selected |
|--------|-------------|----------|
| Add --entity-type flag (default city) | Required fix — loader hardcodes p_entity_type:'city'; county load would insert a duplicate phantom | ✓ |
| Rely on loader as-is | Would create a phantom city-typed "X County" + leave the real county directory-only | |

**User's choice:** Add `--entity-type` flag; 70-01 seeds county entities first, 70-02 loads with `--entity-type county` (D-70-04).
**Notes:** Verified live — `treasury_ensure_municipality` matches on name+state+entity_type, and `importEntityData` calls it unconditionally with 'city'. This is a correctness fix, not a preference.

## Claude's Discretion

- Exact `--cities` flag mechanism vs a thin `seedUTCountyLinks.js` variant.
- `--counties` mode on loadUTPopulation.js vs a sibling script.
- County-load sweep ordering (canary the largest, Salt Lake County, first).
- BigQuery SQL projection/filters.

## Deferred Ideas

- Curated functional icicle rollup → enrichment (Phase 72) or later.
- FY2026 (partial current year) → load + relabel once complete.
