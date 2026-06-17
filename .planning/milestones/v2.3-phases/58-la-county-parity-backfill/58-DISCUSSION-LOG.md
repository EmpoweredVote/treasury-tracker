# Phase 58: LA County Parity Backfill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 58-la-county-parity-backfill
**Areas discussed:** Backfill range + source repair, The 3 custom-source cities, LA County gov budget, Mixed-basis + verify scope

---

## Backfill range + source repair (standard cities)

| Option | Description | Selected |
|--------|-------------|----------|
| Full FY2003–2024 reload | Reload entire range; adds FY2003–2016 + repairs NULL source_url on existing FY2017–2024; uniform with OC; idempotent (same source) | ✓ |
| Only missing early years (FY2003–2016) | Load just the gap; faster; leaves FY2017–2024 source_url NULL for verification phase to repair | |

**User's choice:** Full FY2003–2024 reload (Recommended)
**Notes:** Grounding query confirmed the ~85 standard cities are already SCO-sourced ("CA State Controller - Expenditures/Revenues") FY2017–2024 but with NULL source_url — so the reload repairs sourcing as a side effect.

---

## The 3 custom-source cities

| Option | Description | Selected |
|--------|-------------|----------|
| Layer SCO history beneath both (LB + WeHo) | SCO all-funds FY2003–2024 under their custom years; never-overwrite keeps custom; labeled basis seam | ✓ |
| Leave both custom-only | Strict 'named = custom only'; LB stays 2 years, WeHo transaction-only | |
| Decide each individually | Per-city split | |

**User's choice:** Layer SCO history beneath both Long Beach + West Hollywood (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep LA fully custom | No SCO backfill for LA (rich FY2017–2026); avoids GF-vs-all-funds basis discontinuity; salaries + enrichment parity only | ✓ |
| Layer SCO under LA too | Add SCO FY2003–2016 beneath LA's custom years | |

**User's choice:** Keep LA fully custom (Recommended)
**Notes:** Never-overwrite set is exactly 3 cities (LA, Long Beach, West Hollywood) per grounding query.

---

## LA County gov budget

| Option | Description | Selected |
|--------|-------------|----------|
| FY2003–2024, re-sync 2021–24 | Backfill FY2003–2020 + re-sync FY2021–2024 for source_url; all-governmental-funds; matches OC; SCO ends FY2024 | ✓ |
| Only backfill FY2003–2020 | Add early years, leave FY2021–2024 source_url NULL for Phase 62 | |

**User's choice:** FY2003–2024, re-sync 2021–24 (Recommended)
**Notes:** Confirmed LA County op/rev is currently FY2021–2024 (the FY2025 row was salaries, not op/rev).

---

## Mixed-basis + verify scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-city basis note where it differs | Sourced in-app note on cities whose basis changes across years; reuses OR/federal disclosure pattern | ✓ |
| Document in CONTEXT only | No in-app copy this phase | |

**User's choice:** Per-city basis note where it differs (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Light inline, formal in 62 | Sanity checks only (1 city + county total, source chip, per-capita, custom cities untouched); full reconciliation/audit/UAT in Phase 62 | ✓ |
| Heavier inline verification | ACFR reconciliation for a sample within Phase 58 | |

**User's choice:** Light inline, formal in 62 (Recommended)

---

## Claude's Discretion

- Per-`--fy` submission batching, dry-run-first sequencing, cities-vs-county load order — left to the planner per the runbook.

## Deferred Ideas

None — discussion stayed within phase scope.
