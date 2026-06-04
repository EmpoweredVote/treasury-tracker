# Phase 26: Sacramento CA Data Load - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 26-sacramento-ca-data-load
**Areas discussed:** FY load range, Seeder scope, Population approach, Plan structure

---

## FY Load Range

| Option | Description | Selected |
|--------|-------------|----------|
| Full history (FY2013–2026) | Maximum depth. Consistent with how LA/SF/SD loaded all available years. Script handles both CSV schemas. | ✓ |
| Target range only (FY2020–2026) | Matches REQUIREMENTS.md spec. Faster run. | |
| FY2020–2026, add more later | Load target range now, backfill later if needed. | |

**User's choice:** Full history (FY2013–2026)
**Notes:** Consistency with prior CA cities was the deciding factor.

---

## Seeder Scope

| Option | Description | Selected |
|--------|-------------|----------|
| New seedSacramentoCA.js | Dedicated seeder per v1.5 pattern (seedGreshamOregon.js, etc.). Upserts municipality + creates data_source rows + source_registry row. | ✓ |
| Extend seedCaliforniaCities.js | Add Sacramento to existing Phase 16 seeder. Risk: modifying it could affect SF/SD idempotent re-runs. | |

**User's choice:** New seedSacramentoCA.js

### source_registry sub-question

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — create source_registry row | loadSacramentoCSV.js has backfill logic for it. One upsert step in seeder. | ✓ |
| Skip it | Script handles null sourceRegistryId gracefully. | |
| You decide | Let agents match pattern from other CA cities. | |

**User's choice:** Yes — create source_registry row

---

## Population Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in seedSacramentoCA.js | Hardcode population=536K, population_year=2024. Same approach as SF/SD in seedCaliforniaCities.js. | ✓ |
| Build loadCAPopulation.js | Reusable Census downloader for CA (sub-est2024_06.csv). Useful for phases 28–30 but adds scope here. | |
| You decide | Let agents choose based on existing CA city seeder patterns. | |

**User's choice:** Inline in seedSacramentoCA.js

---

## Plan Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 2 plans: seed+load / enrich+verify | Plan 1: seed + dry-run + live-run. Plan 2: enrichment + spot-check. | ✓ |
| Single plan | All steps in one plan. Simpler but less atomic. | |
| 3 plans: seed / load / enrich+verify | Maximum atomicity. May be overkill given loader already exists. | |

**User's choice:** 2 plans: seed+load / enrich+verify

---

## Claude's Discretion

None — all gray areas had explicit user choices.

## Deferred Ideas

- **`loadCAPopulation.js` reusable Census downloader** — useful for phases 28–30 but out of scope here. Noted for the planner of Phase 28 to evaluate.
