# Phase 58: LA County Parity Backfill - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Backfill operating + revenue budget history to FY2003 for Los Angeles County — both the ~85 standard SCO-sourced member cities AND the LA County government entity itself — from the CA State Controller "ByTheNumbers" datasets, every figure carrying a durable source URL, never overwriting the custom-source cities' existing data, bringing LA County to the same depth standard as Orange County (FY2003–2024).

**In scope:** SCO FY2003–2024 operating + revenue load for the ~85 standard LA County cities + Long Beach + West Hollywood (layered beneath their custom years); LA County government's own op/rev backfilled FY2003–2024; source_url repair on existing SCO rows; per-year SCO population; a per-city basis note where basis changes across years; light inline sanity checks.

**Out of scope (other phases):** salaries sweep (Phase 60), category enrichment (Phase 61), formal ACFR reconciliation + source-chain audit + UAT (Phase 62), the remaining unlinked/other-county CA cities (Phase 59), the 6 new SoCal counties (v2.4).
</domain>

<decisions>
## Implementation Decisions

### Backfill range + source repair (standard cities)
- **D-01:** Reload the **full FY2003–2024** range from SCO ByTheNumbers for the ~85 standard SCO-sourced LA County cities — do NOT load only the missing early years. The existing FY2017–2024 rows are already same-source ("CA State Controller - Expenditures/Revenues") but have **NULL `source_url`**; the full reload backfills FY2003–2016 *and* repairs the missing durable source URLs in one uniform pass, satisfying the always-sourced standard. Same source → idempotent re-sync (not a collision skip).
- **D-02:** Every backfilled/repaired row must carry the **durable ByTheNumbers `/d/` dataset-page URL** (`/d/ju3w-4gxp` expenditures, `/d/rrtv-rsj9` revenues) — never the `/resource/*.json` API endpoint — plus the fetch date (`--source-date`). Per-year SCO `estimated_population` populates so per-capita renders across all backfilled years.

### The 3 custom-source cities (the never-overwrite set)
- **D-03:** The never-overwrite set is exactly **3 cities**: **Los Angeles** (rich custom FY2017–2026: budget/checkbook/payroll/revenue, data.lacity.org), **Long Beach** (custom GF op/rev FY2025–2026 only), **West Hollywood** (transaction "Demand Register" FY2018–2026).
- **D-04:** **Long Beach + West Hollywood — layer SCO all-funds FY2003–2024 beneath their custom years.** Their custom history is thin/non-comparable; the never-overwrite guard preserves their custom (fiscal_year, dataset) rows while SCO fills the earlier/empty years, giving them real county-consistent history. Accept a labeled basis seam (see D-08).
- **D-05:** **Los Angeles city stays fully custom — no SCO layering.** Its custom data is the richest in the dataset; layering all-funds SCO beneath GF custom years would create a misleading basis discontinuity. LA gets salaries + enrichment parity only (locked milestone decision), not budget backfill.

### LA County government budget
- **D-06:** Backfill the LA County government's own op/rev to **FY2003–2024** via `loadCountyBudget.js` (SCO county datasets `uctr-c2j8` operating / `emxv-k8xv` revenue) — add FY2003–2020 and **re-sync the existing FY2021–2024** rows to repair their NULL `source_url`. **All-governmental-funds basis**, documented (SCO ByTheNumbers totals are all-funds, not General Fund). SCO county datasets end at FY2024 → no FY2025 (the existing FY2025 row on LA County is *salaries*, untouched here).
- **D-07:** The LA County entity already exists — `loadCountyBudget.js` must reuse it (errors if not found; never ensure-creates with a clobbering population).

### Basis honesty
- **D-08:** Add a **per-city basis note** in-app on any city whose basis changes across the year axis (all-funds SCO history beneath GF custom recent years — Long Beach, West Hollywood, and any analogous case), sourced/short, consistent with the existing OR all-funds gap-explanation and federal comparability-note patterns. This is a planner requirement, not deferred — honors the always-sourced/honesty standard so a citizen doesn't read a basis jump as a real spending change.

### Verification scope (this phase)
- **D-09:** **Light inline checks only** in Phase 58: one city total + the LA County total spot-checked against the SCO/published figure (within rounding), source chip present, per-capita renders, and the 3 custom cities verified **untouched** pre/post. Formal ACFR reconciliation + source-chain audit + Chris UAT are deferred to **Phase 62**.

### Claude's Discretion
- Exact per-`--fy` submission batching (runbook suggests ≤2-year submits for the county loader; cities can batch per the loader's norms), dry-run-first sequencing, and the order of cities-vs-county loading — all left to the planner per the runbook.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline runbook + locked conventions
- `docs/socal-county-onboarding.md` — the hardened pipeline procedure (Steps 1–5) + the 3 LOCKED conventions (durable `/d/` source URL, population backfill-only, never-overwrite existing custom data). §Step 5 + §Locked conventions are directly load-bearing for this phase.

### Reusable scripts (no new tooling)
- `scripts/bulkLoadStateController.js` — city operating + revenue loader (`--county "Los Angeles" --fy … --source-date …`); collision/never-overwrite + per-year population live here. **Planner must confirm its collision rule treats same-source FY2017–2024 rows as an idempotent re-sync (repairing source_url), not a skip** — this gates D-01.
- `scripts/loadCountyBudget.js` — county-government op/rev loader (`--county "Los Angeles" --fy …`); datasets uctr-c2j8 / emxv-k8xv; reuses existing county entity.
- `scripts/seedCountyLinks.js` — county entity + city linking (LA County already seeded + 88 cities linked; likely a no-op/idempotent here, but re-run to confirm any newly auto-created city links).

### Milestone planning docs
- `.planning/REQUIREMENTS.md` — HIST-01, LAC-01 (this phase's requirements) + the named-cities Out-of-Scope rule.
- `.planning/ROADMAP.md` §Phase 58 — goal + 4 success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bulkLoadStateController.js` / `loadCountyBudget.js` / `seedCountyLinks.js`: the entire phase runs on these three v2.2-hardened scripts — no new loaders expected.
- `treasury_sync_city_budget` RPC: persists budget tree + durable source_url + source_date (Step 1 writer).
- Per-city basis note (D-08): an existing display pattern exists — the OR all-funds "gap-explanation" label (Phase 23, data-driven in App.tsx / PlainLanguageSummary) and the federal comparability notes rendered with source chips (Phase 51). Planner should reuse one of these mechanisms rather than invent a new one.

### Established Patterns
- Never-overwrite by (fiscal_year, dataset) source identity — collision-skip already proven against LA County FY2023 (City of LA's data.lacity.org rows preserved).
- All-governmental-funds basis for SCO data (vs GF custom) — the documented basis difference that drives D-08.
- Durable `/d/<id>` source_url + fetch date as `source_date`; population backfill-only (never lower a non-zero population to 0).

### Integration Points
- `treasury.budgets` rows (municipality_id × fiscal_year × dataset_type) gate app visibility; the loaders write these.
- LA County entity id `f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1` (county-gov budget attaches here).
- Backend lives in the separate **ev-accounts** repo (Render) — `source_url`/`source_date` surfacing (source chip) flows through `treasuryService.ts`; the chip was already wired for counties in the 2026-06-16 deploy.
</code_context>

<specifics>
## Specific Ideas

- Parity target = exact OC match: **FY2003–2024 operating + revenue**, all-governmental-funds, every figure sourced with durable URLs.
- The ~85 standard cities' existing FY2017–2024 rows are same-source SCO but `source_url`-NULL — the reload's source-repair side effect is a deliberate, valued outcome, not incidental.
- LA County government op/rev is currently FY2021–2024 (NULL source_url); LA County already holds salaries FY2021–2025 (ArcGIS / LA County Open Data) — leave salaries untouched this phase.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Salaries → Phase 60; enrichment → Phase 61; formal ACFR reconciliation + source-chain audit + UAT → Phase 62; remaining unlinked/other-county CA cities → Phase 59.)

</deferred>

---

*Phase: 58-la-county-parity-backfill*
*Context gathered: 2026-06-16*
