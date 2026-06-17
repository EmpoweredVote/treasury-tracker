# Phase 63: SoCal County Cities Load + Linking - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored from the v2.2/v2.3 pipeline + runbook + production DB probes; no discuss-phase / research subagents per standing cost preference [[feedback_no_research_subagents]])

<domain>
## Phase Boundary

The first execution phase of the v2.4 Southern California Expansion milestone. Loads operating + revenue history (FY2003–2024) for every city in the 6 remaining SoCal counties from the SCO ByTheNumbers feed, and links each city to its county node — using the hardened v2.2 pipeline with **zero new code**.

The 6 counties (SCO `county` field values, no "County" suffix): **Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial** (~95 cities total, estimated).

**In scope:** Per-county bulk city load (operating + revenue, FY2003–2024, SCO-sourced, per-year population) + county entity seed + `county_id` linking. Read-only verification probes.

**Out of scope (later phases of v2.4):** County-**government** budgets (Phase 64, incl. Alameda + Sacramento), salaries (Phase 65), enrichment (Phase 66), ACFR reconciliation + UAT (Phase 67). Also out: the v2.3 follow-ups (FUP-01..03).
</domain>

<decisions>
## Implementation Decisions

- **D-01 (county set):** All 6 SoCal counties, passed to the pipeline by their exact SCO `county` field value (NO "County" suffix): `Riverside`, `San Bernardino`, `San Diego`, `Ventura`, `Santa Barbara`, `Imperial`.
- **D-02 (FY range):** FY2003–2024 — the full SCO ByTheNumbers coverage window. Pass each year with a repeated `--fy` (`--fy 2003 --fy 2004 … --fy 2024`).
- **D-03 (pipeline — zero new tooling):** Each county is the identical two-command sequence:
  1. `node scripts/bulkLoadStateController.js --county "<Name>" --fy 2003 … --fy 2024` (operating + revenue load by default; never-overwrite guard; auto-creates city municipalities with per-year `estimated_population`; durable source URL + fetch date).
  2. `node scripts/seedCountyLinks.js --county "<Name>"` (seeds/reuses the `"<Name> County"` entity, links member cities via `county_id`).
  The loader uses a **single statewide SCO dataset** filtered by the `county` field — `ju3w-4gxp` (expenditures → operating) + `rrtv-rsj9` (revenues) — NOT per-county dataset IDs. No county-specific code.
- **D-04 (existing DB state — probed 2026-06-17):**
  - County nodes already exist (reuse, idempotent): **Riverside County** (`e4906055-017e-4fde-af87-878760301c65`, 1 city linked) and **San Diego County** (`9290f46e-c1db-46e5-9523-470aadb075b3`, 1 city linked).
  - County nodes do NOT exist yet (created by `seedCountyLinks`): **San Bernardino, Ventura, Santa Barbara, Imperial**.
  - **San Diego city** is a named custom-source city that already carries its custom budget AND SCO operating/revenue (20 FYs each) + salaries — the never-overwrite guard preserves it; `seedCountyLinks` only links it. Other already-loaded cities in these counties are handled identically.
- **D-05 (execution mode — serial, no worktrees):** One PLAN per county (63-01 Riverside … 63-06 Imperial), each mapping to one requirement (SOCAL-01..06). The plans are **data-independent** (different counties) but MUST run **serially on the main working tree** — the scripts require the gitignored `.env` (absent in fresh worktrees, same constraint as Phase 62) and write to the shared production DB. `files_modified: []` (no source-code changes; the plans write DB rows + their SUMMARY only).
- **D-06 (dry-run gate, HARD):** Every plan runs `--dry-run --list-cities` FIRST (runbook rule), enumerates the county's cities + counts, identifies which are new vs already-loaded/custom, and records them — BEFORE any live write. Read the dry-run output before the real load.
- **D-07 (source attribution):** Every loaded row carries the durable ByTheNumbers `/d/<id>` page URL + a fetch date (`--source-date <YYYY-MM-DD>`, default = run day). Always-sourced standard.
- **D-08 (DB target):** Production Treasury DB ONLY — repo `.env` / `.env.local` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`. `mcp__supabase-local` MUST NOT be used (stale, per [[project_next_milestone_socal_parity]]).
- **D-09 ($0):** Free SCO ByTheNumbers source; no AI/enrichment in this phase. Total spend $0 (well under the ~$5 gate, [[feedback_api_cost_threshold]]).
- **D-10 (never-overwrite):** The loader skips any `(city, fiscal_year, dataset)` already loaded from a different source — custom-source cities (e.g. San Diego) keep their richer data and are only linked.
</decisions>

<canonical_refs>
## Canonical References

**Downstream executors MUST read these before implementing.**

- `docs/socal-county-onboarding.md` — the runbook (Steps 1–2 are this phase; Steps 3–5 are later phases). The authoritative procedure.
- `scripts/bulkLoadStateController.js` — the city loader (`--county`, `--fy`, `--dry-run`, `--list-cities`, `--source-date`; `DATASETS` map; never-overwrite `findConflictingBudget`).
- `scripts/seedCountyLinks.js` — the county seed + link helper (`countyEntityName = "<county> County"`; reuses existing entity; links only NULL/same-county `county_id`; `--force` repoints).
- `.planning/milestones/v2.3-phases/` is NOT used; instead see the live phase dirs:
  - `.planning/phases/58-la-county-parity-backfill/58-04-SUMMARY.md` — the LA County city-load result (the closest precedent: 88 cities, FY2003, never-overwrite, per-capita).
  - `.planning/phases/53-*/53-01-SUMMARY.md` (if present) — the original OC city load via this exact pipeline.
- `.planning/phases/61-enrichment-parity/61-01-PLAN.md` (Task 2 verify block) — the canonical `.env`-loading + `createClient(..., {db:{schema:'treasury'}})` read-only service-key probe snippet to reuse for verification.
</canonical_refs>

<code_context>
## Existing Code Insights

- The pipeline is fully county-name-parameterized and proven across Orange (Phase 53) + LA (Phase 58) counties — this phase is "run the runbook" six times, one county per plan.
- `seedCountyLinks` derives the county entity name by appending `" County"` to the `--county` value, so `--county "Riverside"` reuses the existing **Riverside County** node and `--county "Ventura"` creates a **Ventura County** node — uniform handling of existing vs new.
- Never-overwrite + idempotent seeding make every step safe to re-run; partial pre-existing state (San Diego city, the 1 city already linked to Riverside/San Diego County) is handled automatically.
- SCO `county` field values carry NO "County" suffix; the DB county entity names DO. Pass the suffix-less form to both scripts.
</code_context>

<specifics>
## Specific Ideas
- Per-county city counts are estimates (Riverside ~28, San Bernardino ~24, San Diego ~18, Ventura ~10, Santa Barbara ~8, Imperial ~7); the dry-run `--list-cities` step yields the exact set per county at execution.
- Some SoCal cities may already exist (auto-created earlier or custom). The dry-run output distinguishes new auto-creates from existing rows; the never-overwrite guard protects existing budget data.
- Verification per county is automated read-only probes (row counts, source_url non-null, per-capita population present, county_id linked) plus the standard breadcrumb/Cities-in-County render check — no human checkpoint (the milestone UAT is Phase 67).
</specifics>

<deferred>
## Deferred Ideas
- County-government budgets (incl. Alameda + Sacramento) → Phase 64.
- Salaries for the new SoCal cities → Phase 65.
- Enrichment for the new SoCal categories → Phase 66.
- ACFR reconciliation + source-chain audit + Chris UAT → Phase 67.
- v2.3 follow-ups FUP-01..03 → later milestone.
</deferred>

---

*Phase: 63-socal-county-cities-load-linking*
*Context gathered: 2026-06-17 (inline)*
