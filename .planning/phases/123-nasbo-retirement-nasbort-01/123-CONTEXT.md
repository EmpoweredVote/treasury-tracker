# Phase 123: NASBO Retirement (NASBORT-01) - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** Inline discussion (2 locked decisions via AskUserQuestion) + live-DB grounding

<domain>
## Phase Boundary

All 50 states are now on State-ACFR GAAP General-Fund data (Phases 118–121 completed the
last 21; 122 deepened CA/FL). This phase **retires the NASBO loader to fallback-only** — it
no longer serves any live node where ACFR exists — and **documents the 50/50-ACFR end state**.

**In scope:**
- Demote `scripts/loadStateGF.mjs` (the NASBO operating loader) to fallback-only via a
  behavioral **never-overwrite-ACFR guard** + a FALLBACK-ONLY relabel of its header/banner.
- A pure, unit-tested guard helper.
- Read-only DB verification that no live node shows NASBO where same-year ACFR exists.
- One durable doc recording the 50/50-ACFR end state, the two accepted fallback nodes, and
  the retirement decision.

**Out of scope (explicitly):**
- Deleting the NASBO loader code (retire, do NOT delete — REQUIREMENTS non-goal).
- Any new ACFR data load / backfill (incl. KY FY2023 — kept as a documented fallback).
- The two remaining honest NASBO fallback nodes (NV FY2024, KY FY2023) — kept as-is.
- VER-10 Chris live-app UAT (Phase 124).

</domain>

<decisions>
## Implementation Decisions

### Guard mechanism (LOCKED — "Never-overwrite ACFR guard")
- Add a behavioral guard to `loadStateGF.mjs`: before writing a state-FY operating node,
  check the existing `treasury.budgets` row's `data_source`. **Skip** the write if a
  non-NASBO (ACFR/other) source already occupies that node. Write only where the node is
  **absent** or itself **NASBO** (idempotent refresh of the two remaining fallback nodes).
- This makes the loader intrinsically fallback-only and an unfiltered re-run a safe no-op —
  directly satisfying the locked "idempotent, never-overwrite" requirement.
- Extract the skip decision into a **pure exported helper** (e.g. `isAcfrOccupied(existingDataSource)`)
  so it is unit-testable in the existing offline no-DB test harness.
- **Relabel** the loader header docstring + the `main()` console banner as
  **FALLBACK-ONLY** (retired 2026-07-05; all 50 states on ACFR). Not a delete.

### KY FY2023 (LOCKED — "Keep + document as fallback")
- KY FY2023 operating is a NASBO island between ACFR FY2022 and FY2024 (KY FY2023 ACFR was
  not obtained; KY FY2023 revenue is absent). **Accept it as an honest NASBO fallback** and
  record it in the end-state doc. **No new data work** this phase. No backlog item required.

### Claude's Discretion
- Guard placement: run only in live mode (skip check requires the DB client); dry-run keeps
  its current validate-only behavior. Place the guard after municipality resolution and
  **before** the ephemeral `data_sources` insert so a skipped state-FY creates zero residue.
- Documentation location: a durable repo doc under `docs/` (project doc convention), plus
  optional REQUIREMENTS.md checkbox corrections.
- Fix the ACFR-41 (MS) / ACFR-42 (MT) REQUIREMENTS.md checkboxes if verification confirms
  they are loaded (both were completed in Ph119 but left unchecked).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Loader + tests (the retirement target)
- `scripts/loadStateGF.mjs` — the NASBO operating loader to demote (guard + relabel). Note
  the ephemeral `data_sources` lifecycle (WR-05/LOAD-01) and the text-stamp provenance model.
- `scripts/loadStateGF.test.mjs` — offline pure-helper test harness (no DB/no network); the
  new guard helper test goes here.

### Requirements / roadmap
- `.planning/REQUIREMENTS.md` — NASBORT-01 (line ~72), non-goal "Deleting the NASBO loader code",
  and the "never-overwrite / idempotent" success criteria.
- `.planning/ROADMAP.md` — Phase 123 section (goal + 4 success criteria).

</canonical_refs>

<specifics>
## Specific Ideas — live-DB ground truth (2026-07-05)

- Exactly **two** live state nodes carry a NASBO `data_source`:
  - **NV FY2024 operating** — ACFR covers FY2019–2023; FY2024 ACFR not yet available (latest-year tail).
  - **KY FY2023 operating** — ACFR covers FY2002–2025 **except** FY2023 (one-year hole; revenue absent for FY2023).
  - Both are years without same-year ACFR → success criterion #2 is **already satisfied**.
- **50/50** states have ACFR operating data (verified `count(distinct state)=50`).
- The real risk the guard removes: today `node scripts/loadStateGF.mjs` (no `--state`/`--fy`)
  would loop all NASBO STATES and overwrite their FY2023/FY2024 **ACFR** operating nodes — a
  data regression. The guard makes that impossible.

</specifics>

<deferred>
## Deferred Ideas

- KY FY2023 ACFR backfill — deferred (kept as a documented honest fallback; not a tracked gap).
- NV FY2024 ACFR — will supersede the NASBO fallback naturally when NV's FY2024 ACFR is loaded (future).
- VER-10 Chris live-app UAT of the milestone — Phase 124.

</deferred>

---

*Phase: 123-nasbo-retirement-nasbort-01*
*Context gathered: 2026-07-05 (inline)*
