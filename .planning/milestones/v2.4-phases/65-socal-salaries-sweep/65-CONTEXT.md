# Phase 65: SoCal Salaries Sweep - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored from the v2.3 Phase 60 sweep tool + script read + production DB probes; no discuss-phase / research subagents per standing cost preference [[feedback_no_research_subagents]])

<domain>
## Phase Boundary

Loads CA Government Compensation (GCC) salary data (FY2009–2024) for the **95 newly-loaded SoCal cities** (the Phase 63 cohort across the 6 SoCal counties) using the hardened Phase 60 sweep tool `sweepCASalaries.js` with **zero new code**. Salaries are an additive `dataset_type='salaries'` tree (names-free Department→Position total-compensation) — never touches operating/revenue rows. A sample city's latest-year total compensation is reconciled to the published GCC figure at ~$0 delta; per-city coverage + gaps documented.

**In scope:** GCC salaries 2009–2024 for the 95 SoCal cities (6 counties), confirmed against GCC before writing, never-overwrite guard, sample reconciliation, coverage documentation.

**Out of scope:** County-government salaries (cities only, per SAL-07). Enrichment (Phase 66). ACFR reconciliation + UAT (Phase 67). The OC cohort + the non-OC statewide cohort already swept in v2.2/Phase 60 (not re-swept).

**Depends on:** Phase 63 (the SoCal cities must exist — they do, 95 cities verified). Salary state confirmed against the **production** DB first (local Supabase is stale).
</domain>

<decisions>
## Implementation Decisions

- **D-01 (cohort = 95 SoCal cities):** all `entity_type='city'` municipalities under the 6 SoCal county nodes — Riverside (28), San Bernardino (24), San Diego (18), Ventura (10), Santa Barbara (8), Imperial (7) = **95** (confirmed 2026-06-17). Swept **per-county** via `sweepCASalaries.js --county "<Name>"` (resolves "<Name> County", selects its linked cities from the DB). Per-county scoping keeps the sweep additive and bounded to Phase 65's cohort (NOT a full statewide re-sweep, which would needlessly re-write already-correct non-SoCal cities).
- **D-02 (tool — zero new code):** `scripts/sweepCASalaries.js` (the Phase 60 statewide sweep). Flags: `--county "<Name>"` (narrow to one county), `--dry-run`, `--start-year` / `--end-year` (default 2009 / 2024). Writes ONLY `p_dataset_type='salaries'` via `treasury_sync_city_budget` — additive, never touches operating/revenue. Imports `loadCASalaries.js` helpers (`normalizeDeptLabel`, `parseMoney`). No SoCal-specific code.
- **D-03 (year range + source):** GCC FY2009–2024 (16 yearly `City.zip` exports from `https://gcc.sco.ca.gov/RawExport/<year>_City.zip`). OUTER loop = year (16 ZIP downloads, cached in `os.tmpdir()/gcc-salary-cache`), INNER loop = city — so running 6 counties shares one ZIP cache (first county downloads, the rest hit `[cache hit]`).
- **D-04 (PRODUCTION target — CRITICAL):** `SUPABASE_URL` MUST be the production project `kxsdzaojfaibhuzmclfq.supabase.co` (confirmed 2026-06-17 via repo `.env`). **Local Supabase is stale** ([[project_next_milestone_socal_parity]] / STATE memo) — the GCC salary state is production-only. The cohort is read from production; **coverage is confirmed against GCC (dry-run) BEFORE any write** (Success Criterion #1). `mcp__supabase-local` MUST NOT be used. The script does NOT auto-load `.env` (no dotenv dep) — source it first: `set -a; . ./.env; set +a`.
- **D-05 (dry-run coverage gate, HARD):** Run the sweep in `--dry-run` across the cohort FIRST; read per-city/year coverage + gaps; only then write. No live sweep before the dry-run is read.
- **D-06 (never-overwrite + gaps):** The sweep pre-loads existing `salaries` rows for the cohort and SKIPS any `(municipality_id, fiscal_year)` from a DIFFERENT `data_source`; same-source (GCC) rows refresh idempotently. **Riverside city + San Diego city already carry 16 GCC salaries rows each** (Phase 60 statewide sweep — they pre-existed Phase 63) → they refresh, not duplicate. The other 4 counties' cities have 0 existing salaries (new). A city with no GCC records in a given year gets **no** salaries row for that year — recorded as a documented gap, not a failure.
- **D-07 (reconciliation — independent re-aggregation):** Replicate the Phase 60-03 gold-standard method: for 2–3 sample SoCal cities, re-aggregate the official GCC source export for FY2024 via a **separate code path** (NOT a re-sum of the ingested DB tree) and compare to the DB-stored salaries total — expect **~$0 delta** (target exactly $0).
- **D-08 (names-free + attribution):** The stored tree is a **names-free Department→Position total-compensation tree** (per-position averages + counts; no individual names). `data_source = "CA State Controller — Government Compensation in California (publicpay.ca.gov)"`.
- **D-09 (execution mode — serial, no worktrees):** Same as Phases 63/64 — the script needs the gitignored `.env`, writes the shared production DB, and caches ZIPs in tmp. Runs serially on the main working tree; `files_modified: []` (DB rows + SUMMARY only).
- **D-10 ($0):** GCC is a free public source; no AI. Total spend $0.
- **D-11 (verification):** Per-city coverage + gaps documented; the salaries dataset renders for a spot-checked city at the data + render-code level (`DatasetTabs.tsx` shows the Salaries card when the city has a `salaries` row with a populated tree). Pixel-level live-app UAT is Phase 67 (VER-06).
</decisions>

<canonical_refs>
## Canonical References

**Downstream executors MUST read these before implementing.**

- `scripts/sweepCASalaries.js` — the sweep tool (cohort-from-DB, `--county`, `--dry-run`, year range, never-overwrite pre-pass, ZIP cache, names-free tree builder, `syncCityYear`).
- `scripts/loadCASalaries.js` — shared helpers (`normalizeDeptLabel`, `parseMoney`) + the per-city salary load conventions.
- `.planning/phases/60-statewide-ca-salaries-sweep/60-01-SUMMARY.md` / `60-02-SUMMARY.md` — the statewide sweep result + cohort/coverage precedent.
- `.planning/phases/60-statewide-ca-salaries-sweep/60-03-SUMMARY.md` — the reconciliation + coverage-documentation method to replicate (independent GCC re-aggregation, exactly $0 delta; render-code-level verification).
- `.planning/phases/63-socal-county-cities-load-linking/VERIFICATION.md` — the 95-city SoCal cohort this phase targets.
- [[project_next_milestone_socal_parity]] — the production-only salary caveat (local stale).
</canonical_refs>

<code_context>
## Existing Code Insights

- `sweepCASalaries.js` reads its cohort from the DB (`entity_type='city'`), so `--county "<Name>"` cleanly targets exactly that county's linked cities — ideal for the per-county SoCal sweep.
- The year-outer / city-inner loop + tmp ZIP cache means 6 per-county runs download the 16 GCC ZIPs only once total.
- `treasury_sync_city_budget` is NOT source-aware ([[project_sync_city_budget_not_source_safe]]); the sweep's own pre-pass (`protectedKeys`) provides the never-overwrite guard by skipping different-source `(city, year)` rows.
- GCC download uses `curl` (available on Windows 10) with a browser UA + 180s timeout per ZIP; a failed year is retryable (cache makes re-runs cheap).
</code_context>

<specifics>
## Specific Ideas
- Expected cohort: 95 cities. Riverside + San Diego counties each already show 16 existing salaries rows (the pre-existing Riverside/San Diego *cities* from Phase 60) — these refresh idempotently; the other 4 counties' cities are net-new salaries.
- Sample reconciliation cities: pick 2–3 with substantial workforces for a meaningful check (e.g. a large Riverside or San Bernardino city for FY2024).
- Some small cities may have GCC gaps in some years (contract cities, late incorporation) — expected; document per-city.
</specifics>

<deferred>
## Deferred Ideas
- County-government salaries → not in SAL-07 (cities only).
- Enrichment for salaries categories → Phase 66 (ENR-03).
- Live-app pixel UAT for salaries → Phase 67 (VER-06).
- Salary department-name canonicalization (FUP-03) → later milestone.
</deferred>

---

*Phase: 65-socal-salaries-sweep*
*Context gathered: 2026-06-17 (inline)*
