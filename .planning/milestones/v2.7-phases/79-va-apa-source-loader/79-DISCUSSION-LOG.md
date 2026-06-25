# Phase 79: VA APA Source + Loader - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 79-va-apa-source-loader
**Areas discussed:** Tree shape / depth, History floor strategy, Per-capita population, Source attribution

---

## Tree shape / depth

(Expenditure = function→activity 2-level was carried forward as decided from recon; the open question was revenue depth.)

| Option | Description | Selected |
|--------|-------------|----------|
| 2-level (source → sub-source) | Mirror expenditure: major source → sub-source (property-tax breakout etc.); richest icicle | ✓ |
| Flat by major source | One level by major source; simpler, loses property-tax breakout | |

**User's choice:** 2-level (source → sub-source).
**Notes:** Single-child sources collapse naturally — don't force an empty sub-level. → CONTEXT D-01/D-02.

---

## History floor strategy

| Option | Description | Selected |
|--------|-------------|----------|
| XLSX-only, document the floor | Load every XLSX year, record earliest available as floor, stop | ✓ |
| Attempt PDF backfill for older years | Add PDF extraction for pre-XLSX years (slow path) | |

**User's choice:** XLSX-only, document the floor.
**Notes:** PDF backfill deferred as a possible future effort. → CONTEXT D-03.

---

## Per-capita population

| Option | Description | Selected |
|--------|-------------|----------|
| Per-year estimate (Exhibit H) | Each FY's own July population estimate; honest trends; matches Utah/SoCal | ✓ |
| Single fixed vintage | One population across all years; creates false per-capita trends | |

**User's choice:** Per-year estimate from each FY's Exhibit H.
**Notes:** Consistent with the project's standing Key Decision against single-vintage per-capita. → CONTEXT D-04.

---

## Source attribution

| Option | Description | Selected |
|--------|-------------|----------|
| Per-FY dataset/file URL | Link each row to the specific data.virginia.gov dataset/XLSX for its FY; data_source "Virginia APA Comparative Report" | ✓ |
| Bare domain | source_url = data.virginia.gov (Utah's bare-domain bar) | |

**User's choice:** Per-FY dataset/file URL.
**Notes:** More specific than Utah's bare-domain bar; the per-FY CKAN file is itself durable. Strongest for the Phase 83 source-chain audit. → CONTEXT D-05.

---

## Claude's Discretion

- Exact per-exhibit column-index map (parse raw-$ columns, recompute derived; ignore `[object Object]` formula cells).
- Locality-name → `municipalities` matching + `entity_type` handling (Phase 79 proves the city path only).
- CLI flag shape (mirror `loadUtahTransparency.js`).

## Deferred Ideas

- PDF backfill for pre-XLSX fiscal years.
- Enterprise activities (Exhibit F), debt (E/G), capital projects (D) — future-milestone candidates.
- Salaries — not in source, out of v2.7 scope.
