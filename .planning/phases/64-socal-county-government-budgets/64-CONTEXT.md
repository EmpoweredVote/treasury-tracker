# Phase 64: SoCal County-Government Budgets - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored from the v2.2/v2.3 pipeline + runbook + production DB probes + a live Ventura dry-run; no discuss-phase / research subagents per standing cost preference [[feedback_no_research_subagents]])

<domain>
## Phase Boundary

Loads each **county-government's own** operating + revenue budget (FY2003–2024, all-governmental-funds basis) from the SCO ByTheNumbers **county** datasets, attached to the existing county entity — so each county page renders icicle/summary + per-capita instead of directory-only. Uses the hardened Phase 57 tool `loadCountyBudget.js` with **zero new code**.

**8 counties** (SCO `entity_name`, no "County" suffix): the 6 SoCal counties **Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial** + the 2 directory-only counties already in the DB **Alameda, Sacramento**.

**In scope:** County-government op + rev (FY2003–2024) loaded onto the existing county entity; per-year population from the feed; durable source attribution; read-only verification.

**Out of scope (later phases / not this phase):** City loads (Phase 63 — done). Salaries (Phase 65). Enrichment (Phase 66). ACFR reconciliation + UAT (Phase 67). Any change to city rows under these counties (untouched). LA County / Orange County already have their county-gov budgets (prior phases) — not re-loaded here.

**Independence:** Per ROADMAP, Phase 64 depends on nothing and runs parallel to Phase 63 (city loads). It writes only to the 8 county entities, never to city municipalities.
</domain>

<decisions>
## Implementation Decisions

- **D-01 (entity set):** 8 counties — Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial, Alameda, Sacramento. Pass each to `--county` by its exact SCO `entity_name` (NO "County" suffix); the DB entity name defaults to `"<X> County"` (the loader's `--entity` default). **All 8 entities already exist** (probed 2026-06-17: `entity_type='county'`, `population=0`, **0 existing op+rev rows** — clean load, no conflicts). The loader **errors if the entity is missing** and never ensure-creates — existence is a precondition, satisfied.
- **D-02 (FY range + basis):** FY2003–2024, **all-governmental-funds basis** (SCO county totals are all-funds, per the Phase 56 finding — documented in each SUMMARY, NOT General Fund).
- **D-03 (tool — zero new code):** `node scripts/loadCountyBudget.js --county "<X>" --fy <year> [--source-date YYYY-MM-DD | --dry-run]`. County datasets: **`uctr-c2j8`** (expenditures→operating) + **`emxv-k8xv`** (revenues) — distinct from the city datasets. Both dataset types load by default. No county-specific code.
- **D-04 (population — from the feed, CONFIRMED):** A live Ventura dry-run (2026-06-17) confirmed the SCO **county** feed carries per-year `estimated_population` (Ventura FY2024 = 823,863; FY2003 = 791,310). So **no `--population` fallback sourcing is needed** — the loader backfills population automatically from the feed. Backfill is **first-non-zero-wins** (`.or(population.is.null,population.eq.0)`), so **load the FY2024 canary FIRST** so the stored `population` reflects the current year for per-capita display.
- **D-05 (canary discipline + HARD dry-run gate):** Per the runbook, for each county: (1) `--dry-run --fy 2024` canary FIRST (zero writes — confirm entity resolves, feed population present, categories/total sane), read the output; (2) load FY2024 for real; (3) backfill FY2003–2023. Dry-run before any live write is mandatory.
- **D-06 (SCO flakiness → per-FY retry loop):** `bythenumbers.sco.ca.gov` intermittently connect-times-out and the loader **aborts on any single failed fetch** ([[project_sco_api_flaky_per_fy_retry]]). Drive the **unchanged** loader **one fiscal year at a time inside a bash retry loop**, retrying each `--fy` until its output contains `Done.`; gap-fill any year that still fails. This is orchestration only (per-FY `--fy` is runbook-supported) — **zero new code**, `files_modified` stays `[]`.
- **D-07 (source attribution):** Every loaded row carries the durable `/d/<id>` ByTheNumbers **page** URL (`/d/uctr-c2j8`, `/d/emxv-k8xv`) + `--source-date` (run day = 2026-06-17). Never the `/resource/*.json` endpoint.
- **D-08 (never-overwrite):** The loader skips any `(county, fy, dataset)` row from a DIFFERENT `data_source`. **City rows are untouched** — the county-gov load writes only to the county entity (`entity_type='county'`); city municipalities are separate rows.
- **D-09 (DB target):** Production Treasury DB ONLY — repo `.env` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`. `mcp__supabase-local` MUST NOT be used (stale). The loader does NOT auto-load `.env` (no dotenv dep) — source it first: `set -a; . ./.env; set +a`.
- **D-10 ($0):** Free SCO ByTheNumbers source; no AI/enrichment in this phase. Total spend $0 (well under the ~$5 gate, [[feedback_api_cost_threshold]]).
- **D-11 (execution mode — serial, no worktrees):** Same constraint as Phase 63 (D-05 there): the loader needs the gitignored `.env` (absent in fresh worktrees) and writes to the shared production DB. Plans run **serially on the main working tree**; `files_modified: []` (DB rows + SUMMARY only).
- **D-12 (verification — read-only):** Per county: op + rev rows present for FY2003–2024 (where the feed provides), every row carrying a `/d/` source_url, `population > 0` (per-capita renders), county page no longer directory-only. City rows under each county unchanged. No human checkpoint (the milestone UAT is Phase 67 / VER-06).
</decisions>

<canonical_refs>
## Canonical References

**Downstream executors MUST read these before implementing.**

- `docs/socal-county-onboarding.md` — the runbook; Step "County-government budget" (canary-then-backfill flow) is this phase. The authoritative procedure + "Locked conventions" (durable source, population backfill-only, never-overwrite).
- `scripts/loadCountyBudget.js` — the county-gov loader (`--county`, `--entity`, `--fy`, `--type`, `--population`, `--source-date`, `--dry-run`; `DATASETS` = uctr-c2j8 / emxv-k8xv; `resolveCountyEntity` errors if entity missing; `findConflictingBudget` never-overwrite; `backfillPopulation` first-non-zero-wins).
- `.planning/phases/63-socal-county-cities-load-linking/63-01-SUMMARY.md` + `VERIFICATION.md` — the immediately-prior phase using the same pipeline/host; per-FY retry pattern + verification probe shape established there.
- `.planning/phases/61-enrichment-parity/61-01-PLAN.md` (Task 2 verify block) — the canonical `.env`-loading + `createClient(..., {db:{schema:'treasury'}})` read-only service-key probe snippet to reuse for verification.
- [[project_sco_api_flaky_per_fy_retry]] — SCO API flakiness + per-FY retry-loop workaround (memory).
</canonical_refs>

<code_context>
## Existing Code Insights

- `loadCountyBudget.js` is fully county-name-parameterized and was proven against Ventura County (Phase 52/57). This phase is "run the county-gov loader" eight times.
- A county-year is small (Ventura FY2024: 653 operating rows / 963 revenue rows; FY2003: ~198/179) — well under the loader's 5000-row single-fetch page size, so no pagination concern for these 8 counties.
- Never-overwrite + idempotent same-source refresh make every step safe to re-run; partial progress from a flaky-API run accumulates and converges.
- The county entity name in the DB carries the "County" suffix; the SCO `entity_name` filter does NOT. Pass the suffix-less form to `--county`.
</code_context>

<specifics>
## Specific Ideas
- Ventura dry-run baseline (for sanity-checking the live load): FY2024 op $3,010,778,369 / rev $3,174,363,315; FY2003 op $870,497,988 / rev $882,725,441; all-governmental-funds basis.
- Per-capita uses the single `municipalities.population` field (same model as cities); loading FY2024 first locks a current population. Historical-year per-capita using a single population figure is the established app design (a v2.3 follow-up, not this phase's concern).
- Some county-years may have `No data found` (feed gaps in early years) — the loader logs and skips without erroring; record any gaps in the SUMMARY (expected, not a failure).
</specifics>

<deferred>
## Deferred Ideas
- Salaries for the SoCal cities → Phase 65.
- Enrichment for new SoCal categories → Phase 66.
- ACFR reconciliation (incl. county-gov sample) + source-chain audit + Chris UAT → Phase 67 (VER-05, VER-06).
- Per-year historical population for exact historical per-capita → v2.3 follow-up (out of scope).
</deferred>

---

*Phase: 64-socal-county-government-budgets*
*Context gathered: 2026-06-17 (inline)*
