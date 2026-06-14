# Phase 52: SoCal Bulk Pipeline Hardening - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn `scripts/bulkLoadStateController.js` into a reusable, fully-sourced, one-command county loader so every remaining Southern California county is a repeat run rather than a rebuild. Scope is the **pipeline capability** (PIPE-01..04) — *not* the Orange County data load itself (Phase 53) or OC enrichment/linking execution (Phase 54). Phase 52 is done when an arbitrary CA county can be loaded (operating + revenue) with sourced attribution, population, optional county seed+link, and a documented runbook — proven via a dry-run against a non-OC county so no OC data is created prematurely.

</domain>

<decisions>
## Implementation Decisions

### Population source
- **D-01:** Use the ByTheNumbers feed's own per-year `estimated_population` (already read at `bulkLoadStateController.js:168`) for cities the pipeline creates. Free, in-data, and gives honest per-year per-capita. Accept the minor inconsistency with older cities that use a single 2024 Census vintage — per-year is an improvement, not a regression (the single-vintage approach was a v1.3 limitation, not a preference).

### Source-link target (always-sourced standard)
- **D-02:** Every figure's `source_url` points to the **durable human-facing ByTheNumbers dataset page**, not the raw Socrata API/resource endpoint. This matches the v2.1 durable-URL standard (audit FAIL 0; URLs deliberately moved off version-specific endpoints).
- **D-03:** `source_date` = the data fetch date (when the pipeline pulled the rows). `source_name` = "CA State Controller — ByTheNumbers" (Expenditures / Revenues as applicable).
- **D-04:** This is a real gap to close: the current `treasury_sync_city_budget` RPC takes only `p_data_source_name` (no url/date). Hardening must carry `source_url` + `source_date` through to the stored rows so city figures meet the same always-sourced bar as federal.

### County seed + link automation
- **D-05:** Build a **generic, reusable one-command helper** that seeds a county entity and links its cities (keyed off the SCO `county` field on the source rows), rather than a per-county manual script like `seedLACountyLinks.js`. This delivers PIPE-01's "one command" promise and makes every remaining SoCal county trivial. The helper is the reusable capability; the actual Orange County seed+link *execution* still happens in Phase 54.

### Existing-city collision policy
- **D-06:** The loader must **never overwrite budget data** for cities that already have data from another source (Anaheim, Santa Ana, the LA custom city load). It skips/refuses to alter their budget rows and **logs what it skipped**. County-linking such cities is still allowed (linking ≠ overwriting budget data) — this is how Anaheim & Santa Ana get attached to Orange County without losing their richer custom-sourced data.

### Claude's Discretion
- RPC/schema mechanics for carrying source_url/source_date (new RPC vs altered signature vs column), dry-run assertion mechanics, idempotency/upsert details, and which specific non-OC county to dry-run against — left to research/planning. The dry-run county should be one *not* already loaded and *not* Orange (to prove generalization without creating OC data early).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADR/spec docs — requirements are captured in the decisions above. The authoritative references for this phase are the existing loader/seed scripts and RPCs that the pipeline generalizes:

### Pipeline core (the script being hardened)
- `scripts/bulkLoadStateController.js` — current county-parameterized loader. Already: fetches by `county` (or `--city`), auto-creates municipalities via `treasury_ensure_municipality`, reads per-city `estimated_population` (line 168), writes via `treasury_sync_city_budget`. Gaps to close: source_url/date (D-02..04), county seed+link (D-05), collision policy (D-06).
- Socrata datasets: `ju3w-4gxp` (expenditures → operating), `rrtv-rsj9` (revenues → revenue), host `bythenumbers.sco.ca.gov`.

### County linking precedent (to generalize, not copy)
- `scripts/seedLACountyLinks.js` — how LA County linked its 88 cities (per-county script). Phase 52 replaces this pattern with a generic helper.
- `src/App.tsx` — `jurisdictionParents` breadcrumb chain + `CitiesInCountyPanel` / `CitiesInStatePanel` render off `county_id` and `entity_type`; the county seed+link must populate those fields correctly.
- `src/types/budget.ts` — `Municipality.county_id`, `entity_type` shape the link helper must satisfy.

### Always-sourced standard (carried from federal milestones)
- `.planning/MILESTONES.md` (v2.1 entry) + `scripts/auditFederalSources.mjs` — the durable-URL / source_name+url+date bar this pipeline must meet for city data (D-02..04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bulkLoadStateController.js` — ~90% of the loader exists (fetch, paginate, group-by-city, tree-build, auto-create municipality, population from source). Hardening extends rather than rewrites.
- `treasury_ensure_municipality` RPC — already auto-creates city records with population; reuse as-is.
- `treasury_sync_city_budget` RPC — writes the per-city budget tree; needs source_url/source_date plumbed through (D-04).
- `CitiesInCountyPanel` / breadcrumb `jurisdictionParents` (App.tsx) — already consume `county_id`; the new county-link helper feeds these for free.

### Established Patterns
- Loaders are CLI scripts using `parseArgs`, `--dry-run`, `--fy` (multiple), Supabase service key from env. Match this shape.
- Source attribution rows + durable human URLs (v2.1) — the bar to hit for city figures.
- County entity + `county_id` self-FK on municipalities (v1.5, Phase 25) — the data model the link helper targets.

### Integration Points
- New cities surface automatically in the app's entity list, breadcrumb chain, and Cities-in-State/County panels once `county_id` + datasets exist — no frontend work needed this phase.
- Backend RPCs live in the separate **ev-accounts** repo / Supabase project `kxsdzaojfaibhuzmclfq`; RPC changes (source_url/date) may require an ev-accounts migration, not just a script edit.

</code_context>

<specifics>
## Specific Ideas

- Prove the generalized loader via a **dry-run on a non-OC, not-yet-loaded county** (success criterion #1) — confirms reusability without creating Orange County data before Phase 53.
- "One command" is the explicit ergonomic goal: `bulkLoadStateController.js --county "<Name>"` (+ a county seed+link helper) should be all a new SoCal county needs.

</specifics>

<deferred>
## Deferred Ideas

- Actual Orange County operating+revenue load → Phase 53.
- Orange County entity seed + linking + enrichment *execution* → Phase 54 (Phase 52 only builds the reusable helper).
- Backfilling the always-sourced standard to *other* existing city data (LA custom, TX, OR, MA) → future milestone (PROJECT.md "Future" candidate).
- Loading other SoCal counties (Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial) → future milestone (REQUIREMENTS.md SOCAL-01..06).

None of the discussion strayed outside the phase domain — these are natural downstream-phase boundaries.

</deferred>

---

*Phase: 52-socal-bulk-pipeline-hardening*
*Context gathered: 2026-06-14*
