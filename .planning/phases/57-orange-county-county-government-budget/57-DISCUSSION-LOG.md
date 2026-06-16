# Phase 57: Orange County County-Government Budget - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 57-orange-county-county-government-budget
**Areas discussed:** Source document, Fiscal-year coverage, County per-capita population, Loader reuse vs clone

---

## Source document

| Option | Description | Selected |
|--------|-------------|----------|
| SCO County datasets (LA way) | SCO County Expenditures `uctr-c2j8` + County Revenues `emxv-k8xv`, `entity_name='Orange'`; machine-readable, multi-year, all-funds, mirrors LA Phase 25 | |
| OC published ACFR / adopted budget | OC's own ACFR (~$8–9B) / adopted budget PDF, MA Phase 41 way; manual extraction, 1–few years | |
| SCO datasets + ACFR cross-check | Load from SCO datasets AND cite the ACFR total as an independent reconciliation in 57-VERIFICATION.md | ✓ |

**User's choice:** Option 3 (free-text): "Can we do 3, but then make sure we are linking to the sources with tags the way we showed sources on the federal swing. If we default to one, do SCO — but the ACFR can be used to flag for inconsistencies."

**Notes:** Primary/default load = SCO (authoritative); ACFR = cross-check to flag inconsistencies, documented in 57-VERIFICATION.md. Added requirement: render federal-style `SourceChip` source tags. Clarifying follow-up confirmed: wire `SourceChip` onto the **OC county page only** for Phase 57; the full municipal source-chip backfill remains its own separate milestone.

---

## Fiscal-year coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Full range, match the cities (~FY2003–2024) | Load every year the SCO County datasets cover, matching the 34 cities; chunked/canary discipline | ✓ |
| Recent years only (~last 5) | Faster, but less history than the county's own cities | |
| Latest year only | Minimal; no history, inconsistent with multi-year city pages | |

**User's choice:** Full range, match the cities (~FY2003–2024)
**Notes:** Exact bounds follow SCO data availability; years with no data skipped gracefully. Use Phase 53's chunked/canary load discipline.

---

## County per-capita population

| Option | Description | Selected |
|--------|-------------|----------|
| Per-year if the feed provides it, else single sourced figure | Use SCO feed `estimated_population` per year if present; fall back to one sourced CA DOF/Census figure; document it | ✓ |
| Per-year from CA DOF / Census, always | Always pull official per-year series; most accurate, more sourcing work | |
| Single sourced figure (LA precedent) | One figure across all years; simplest, ignores growth | |

**User's choice:** Per-year if the feed provides it, else single sourced figure
**Notes:** Most honest + lowest extra effort; document the population source either way.

---

## Loader: reuse vs clone

| Option | Description | Selected |
|--------|-------------|----------|
| Generalize a reusable county-budget loader | One loader taking `--county/--entity`; fulfills the Reusable SoCal Pipeline milestone + runbook Step 5 | ✓ |
| OC-specific clone of the LA loaders | Fastest for OC; adds another one-off pair of scripts | |
| OC-specific now, generalize later | Defers reuse; risks one-off becoming permanent | |

**User's choice:** Generalize a reusable county-budget loader
**Notes:** Mirrors how `bulkLoadStateController.js` generalized the city load; avoids repeating the LA one-off pattern.

---

## Claude's Discretion

- Category-tree mapping (reuse LA `buildTree`: category → subcategory_1 → line items, all-funds basis).
- `verify-phase57.mjs` probe + `57-VERIFICATION.md` mechanics (mirror verify-phase3X.mjs / 53/56 precedent).
- Confirming the OC county entity has no pre-existing budget rows (clean load); honor never-overwrite if any found.
- Which year/figure to spot-check against the ACFR for the cross-check.

## Deferred Ideas

- Bring `SourceChip` source tags to all municipal pages → separate sourcing-backfill milestone.
- Onboard additional SoCal counties' own budgets with the new reusable loader → future county-onboarding milestone.
- Exhaustive multi-year ACFR reconciliation of OC county totals → not this phase (documented spot cross-check only).
