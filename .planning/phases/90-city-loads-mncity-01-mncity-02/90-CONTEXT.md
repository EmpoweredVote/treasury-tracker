# Phase 90: City Loads (MNCITY-01, MNCITY-02) - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning
**Source:** Inline planning (no discuss-phase) — phase fully specified by ROADMAP + REQUIREMENTS + Phase 89 handoff + the established Ohio Phase 85 / VA Phase 80 bulk-load mold. Decisions below are locked from those sources; no new gray areas.

<domain>
## Phase Boundary

Bulk-load **all ~853 Minnesota cities** operating (expenditure-by-function) + revenue (revenue-by-source) across the XLSX-era FY range by iterating the **proven Phase 89 loader** (`scripts/loadMNOSA.js`) over every city in each year's `cired_<YY>_data.xlsx` workbook. Every row sourced to osa.state.mn.us, per-capita from the `Population` column, per-entity GAAP/Cash basis recorded, idempotent + never-overwrite-safe, no phantom municipalities.

**In scope (MNCITY-01, MNCITY-02):**
- A batch driver `scripts/loadMNOSABatch.js` that, per FY, opens the one city workbook, enumerates every city, and loops the Phase 89 `importEntity` write path over the whole roster.
- Live load across the full city XLSX range **FY2012–FY2023** (pinned in Phase 89 `scripts/mnOsaDatasets.json`).
- Per-entity basis (GAAP/Cash) from the `GAAPInd` column **recorded** (D-02).
- Cross-FY source-gap residual **documented** (D-03); no phantom municipalities.
- Idempotent + source-safe (never-overwrite guard already inside `importDataset`).

**Not in scope:** counties + MN state node + city→county linking (Phase 91); enrichment (Phase 92 — categories stay unmapped until then, acceptable, mirrors Ohio); ACFR reconciliation / source-chain audit / UAT (Phase 93). The loader, tree-map, and manifest are DONE (Phase 89) — this phase only iterates them.
</domain>

<decisions>
## Implementation Decisions

- **D-01: Load the FULL city XLSX range — FY2012–FY2023 (12 years).** ROADMAP locks "across the XLSX-era FY range"; Phase 89 pinned the actual floor at **FY2012** (earlier than the roadmap's ~2015 estimate). All 12 years load. ~853 cities × 12 FY × 2 datasets ≈ 20K RPC writes — $0 (Supabase, not AI), serial, ~30–60 min wall-clock. (If the operator wants to cap to recent years, `--fy` per-year invocation makes that trivial — but the default is the full range per the locked roadmap.)
- **D-02: Record per-entity basis (GAAP/Cash, from `GAAPInd`) in a committed `scripts/mnCityBasis.json`** — entity → basis, keyed per (city, FY) where it varies (a city can be GAAP one year, Cash another). Also surfaced in load logs. **No new DB column** (mirrors Ohio Phase 85's "no schema churn in the load phase"; $0, git-reviewable, no migration risk). Promote to a DB field later only if the app needs to display basis (note for Phase 93).
- **D-03: Cross-FY source-gap residual → committed `scripts/mnCityResidual.json`** (analog to `scripts/ohioCityResidual.json`): cities that appear in some FY rosters but have a blank/zero financial total in others, plus any coverage notes (which cities filed which years). Skipped entities are NEVER created as phantom municipalities. No-financial-total rows are not written.
- **D-04: Batch driver mirrors `scripts/loadOhioAOSBatch.js`** — but SIMPLER: MN has ONE workbook per FY (basis is a per-row `GAAPInd` column, not separate GAAP/CASH/MOD workbooks), so there is **no basis-precedence assignment**. Just `enumerateEntities(workbook)` → loop `importEntity` over the full roster. Reuse `resolveSourceUrl(fy,'city')`, `getSupabase`, the never-overwrite guard verbatim — invent no new tree/parse/write logic.
- **D-05: Serial, idempotent, source-safe.** Single sequential loop (no parallel RPC fan-out); `.env` `SUPABASE_SERVICE_KEY` sourced for live writes; `--fy`/`--dry-run`/`--limit` flags; resilient per-city try/catch that collects failures without aborting; never-overwrite guard skips any (muni,FY,dataset) already owned by a different/richer source.
- **D-06: Per-capita from the per-FY `Population` column** → `municipalities` row (per-year population, no fixed vintage — standing project Key Decision).
- **D-07: Enrichment deferred to Phase 92.** Category descriptions stay unmapped between Phase 90 and 92 (acceptable; mirrors Ohio 85→87).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The tooling to iterate (DONE in Phase 89 — reuse verbatim)
- `scripts/loadMNOSA.js` — the proven loader. Exports `buildRevenueTree`, `buildExpenditureTree`, `entityPopulation`, `entityCounty`, `entityBasis`, `resolveSourceUrl`, `importEntity`, `getSupabase`, `findConflictingBudget`, `importDataset`, `cellNum`, `cellText`, `normalizeLabel`, `DATA_SOURCE_NAME`. `importEntity(supabase, workbook, {entityName, fiscalYear, sourceUrl, sourceDate, dryRun, entityType})` is the loop body (dry-run returns the summary without touching Supabase).
- `scripts/mnOsaDatasets.json` — per-FY city_url (FY2012–2023) + county_url manifest; `resolveSourceUrl(fy,'city')` reads it.
- `scripts/mnOsaTreeMap.json` — the 3-level hierarchy spec the builders consume.
- `scripts/loadMNOSA.test.mjs` — offline tests (extend with enumerate + batch cases).
- `.planning/phases/89-.../89-PROOF.md` + `89-VERIFICATION.md` — Phase 89 outcome + handoff (Minneapolis ties; city floor FY2012; counties lag to FY2021 — not this phase).

### The bulk-load pattern to mirror (the model)
- `scripts/loadOhioAOSBatch.js` (+ Ohio Phase 85 plans `85-01`/`85-02`) — the proven all-cities batch driver: `enumerateCities` → loop `importCity`, manifest acquisition into a gitignored recon dir, `--fy`/`--dry-run`/`--limit`, resilient per-city loop, residual computation. **Swap Ohio's GAAP→CASH→MOD precedence for MN's single-workbook enumerate** (no precedence).
- `scripts/ohioCityResidual.json` — the committed residual-file precedent for `scripts/mnCityResidual.json`.
- `scripts/loadVAComparativeReportBatch.js` — the original `enumerateRoster` → loop analog.

### Data-model / sourcing facts
- Auto-memory `project_sync_city_budget_not_source_safe` — never-overwrite guard mandatory (already inside `importDataset`).
- Auto-memory `feedback_supabase_migration_mcp` — prefer `mcp__supabase-local` tools for the read-only DB verification probes.
- `.planning/REQUIREMENTS.md` — MNCITY-01/02. `.planning/ROADMAP.md` Phase 90 — goal + 4 success criteria.
</canonical_refs>

<specifics>
## Specific Ideas
- **Spot-check anchor:** Minneapolis FY2023 stored revenue/expenditure read back from the DB must equal the Phase 89 proof figures ($1,192,133,233 / $1,193,970,288).
- **Idempotency gate:** a second full run creates 0 new municipalities and changes 0 row counts.
- The 5 RCV anchor cities (Minneapolis, St. Paul, St. Louis Park, Bloomington, Minnetonka) should all be present post-load (Phase 93 reconciliation anchors).
</specifics>

<deferred>
## Deferred Ideas
- Counties + MN state node + city→county linking → Phase 91.
- Enrichment → Phase 92.
- Reconciliation / source-chain audit / UAT → Phase 93.
- Promoting per-entity basis from `mnCityBasis.json` into a DB column → future, only if the app must display basis.

None blocks Phase 90.
</deferred>

---

*Phase: 90-city-loads-mncity-01-mncity-02*
*Context gathered: 2026-06-27 (inline)*
