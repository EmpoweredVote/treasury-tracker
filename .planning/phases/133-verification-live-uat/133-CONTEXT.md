---
phase: 133
title: "Verification + Live UAT — Pima County municipalities"
requirements: [PIMA-07, PIMA-08, PIMA-09]
---

# Phase 133 Context — Verification + Live UAT

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Source:** Inline synthesis from the shipped Phase 130 (v2.17 Tucson) verification precedent + 131-RECON.md + Phase 132 summaries (no discuss-phase run — this is the direct scaled analog of a shipped phase; decisions below are locked by precedent, not guessed).

<domain>
## Phase Boundary

Prove every figure loaded in Phase 132 for the four Pima County municipalities (Oro Valley, Marana, Sahuarita, South Tucson) is **real, durably sourced, and correctly navigable**, and confirm the v2.16 Essentials cross-product tether on each municipality's banner. This is the milestone-close (v2.18) verification phase — the exact analog of the shipped v2.17 Phase 130 (Tucson), scaled from 1 city to 4.

**Scope fence (hard):** verification only. **No new data, no new FYs, no schema/RPC/frontend/loader-logic change.** The only permitted write to production is an idempotent loader smoke-re-run that must net **0 change**. All other work writes planning/verification markdown + read-only DB queries + client-side HTTP reachability checks + REQUIREMENTS.md traceability.
</domain>

<decisions>
## Implementation Decisions

### Re-derivation (PIMA-07 machine core)
- **D-01 — Loader-independent.** The re-derivation harness MUST NOT import, require, or shell out to `scripts/extractAcfrGF.py` (reusing it would re-test the loader against itself). It runs its own `pdftotext -table` pass over each `docs/<City>/*.pdf` and independently parses+sums the General Fund column. `-layout` is never used (scrambles the multi-fund columns — 131-RECON §Method).
- **D-02 — Live production Supabase is the source of truth** for the diff. `131-RECON.md` numbers/URLs are used only to locate which PDF is which FY, never as the comparison baseline.
- **D-03 — Full-tree coverage.** Re-derive EVERY displayed figure for all **44** FY×mode roll-ups (22 city-FYs × {operating, revenue}): both roll-up totals AND every displayed leaf (each revenue-by-source leaf; the expenditure-by-function tree parents + children) for every in-scope city-FY.
- **D-03a — Exact-$0 tolerance.** PASS is `abs(delta) === 0` on every figure. The only acceptable non-zero disposition is a documented honest cause (e.g. the Oro Valley `-table` glyph-split labels, which are cosmetic-label-only and must still tie at the value/total level) — flagged explicitly, never silently passed.

### Source-chain audit (PIMA-07 audit core)
- **D-04 — Full source-chain audit** (read-only DB + client-side reachability), asserting against the live DB: (a) all 44 `budgets` rows have non-null `source_url` + `source_date`; (b) each `source_url` is reachable AND is the correct-per-FY document — cross-checked against the per-FY canonical origin URL locked in 131-RECON.md (accepting the precedented Wayback/ADE-mirror retrieval deviation: canonical origin is the stored URL even where automation 403s); (c) 0 orphan `data_sources` residue for the four munis' datasets; (d) no stale/overwritten `data_source` labels (match the `dataSourceLabel(muniName, fy, datasetType)` shape); (e) all four municipality rows carry `population > 0`, `population_year = 2024`, and Census provenance, and each is linked to the existing Pima County node (`county_id`).
- **D-05 — Loader confirmation, not re-apply.** `scripts/processPimaCities.js` already ships the source-safe path: `treasury_sync_budget_tree` RPC (never `treasury_sync_city_budget`), ephemeral `data_sources` (created at run start / deleted at run end, WR-05), and a municipality-keyed pre-load delete keyed on `(municipality_id, fiscal_year, dataset_type)`. Confirm these are present + correct (inspection + `node --check`), then run an idempotent smoke-re-run over the existing FY windows only (both modes) that nets **0 change** and leaves **0 residue**; re-run the D-04 audit after and require it still passes. If inspection finds any invariant absent, that branch escalates to fixing it (only branch that edits the loader).

### Live UAT (PIMA-08)
- **D-06 — Formal UAT checklist** with status frontmatter + numbered pass/fail scenarios, run by Chris against the **live production app `https://treasurytracker.empowered.vote`** (the project's real URL — [[feedback_app_url]]; not financials.empowered.vote, not a local build), matching prior milestone-close sign-offs (130/127/124/116).
- **D-07 — Baseline scenarios** exercised across all four Pima municipalities + the Pima County nav node + Arizona: 2-level icicle drill-down (operating Current / Debt-service parents → children), Money In / Money Out toggle (revenue vs expenditure both render), per-capita ($/resident) using each city's pinned population, source chips resolving to the correct-per-FY ACFR, and the `US → Arizona → Pima County → <municipality>` breadcrumb + the Cities-in-County panel listing all five munis (Tucson + the four new) together under Pima.
- **D-08 — Extra scenarios:** (1) Arizona state node regression (v2.14 ACFR undisturbed); (2) year switcher across several FYs with per-FY labels rendering honestly; (3) Oro Valley `-table` glyph-cleanup labels display cleanly (Transit / Interest / Intergovernmental / investments) with the loaded values intact; (4) South Tucson FY2023/FY2024 absence renders as a clean empty state (documented holes — no broken/empty render, no phantom zero row).

### Tether (PIMA-09)
- **D-09 — Determine-then-confirm.** A probe fetches the LIVE `coverage.json` from `essentials.empowered.vote` and runs the shipped deterministic matcher (`matchEntityToCoverage` / `normalizePlace` / `stripLabel` behavior from `src/utils/essentialsCoverage.ts`, mirrored in a Node probe) for each of the four munis (`entity_type=city`, `state=AZ`), computing the EXPECTED tether-icon state (covered → GEOID(s)+label, or null). The probe must distinguish **not-covered** (fetch OK, no match → null) from **fetch-failed** (network error / non-OK / malformed body) — the two must not be conflated. Chris then confirms the live banner matches the prediction; a prediction↔render mismatch is a finding.
- **D-10 — Coverage gap is expected, not a defect.** If `coverage.json` does not cover a municipality, that is documented as an EXPECTED **cross-repo Essentials coverage gap** with a concrete remediation pointer (add a city record — label / state=AZ / Census place GEOID — to Essentials' generated coverage catalog). This requires **NO TT code change** (the v2.16 mechanism is already generic); the icon appears automatically once Essentials publishes coverage. PIMA-09's own language allows met-with-documented-gap.

### Claude's Discretion
- Exact script structure, table formats, and helper factoring for the three verification scripts (mirror the shipped `verify-phase130-*.mjs` / `verify-phase124-*.mjs` harnesses).
- Whether to author one combined 4-city tether probe or extend the existing Tucson/Pima probe (both acceptable; the four new munis are the required coverage).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Verification harness analogs (reuse patterns)
- `scripts/verify-phase130-rederive.mjs` — loader-independent blind re-derivation: own `pdftotext -table` pass, live-DB diff, exact-0 tolerance, no loader import.
- `scripts/verify-phase130-audit.mjs` — source-chain audit shape: per-assertion PASS/FAIL table, URL reachability + correct-per-FY check, 0-residue assertion, non-zero exit on fail.
- `scripts/verify-phase130-tether.mjs` — Essentials tether probe: live coverage.json fetch, ported matcher, fetch-failed vs not-covered distinction (already probes Tucson + Pima).
- `scripts/verify-phase124-rederive.mjs`, `scripts/verify-phase124-cohort-audit.mjs` — env-load + `createClient(treasury)` + exact-0 exit-code conventions.

### Phase 132 loaders + data (what is being verified)
- `scripts/processPimaCities.js` — the loader to confirm (D-05): source-safe RPC, ephemeral `data_sources`, muni-keyed pre-load delete, `dataSourceLabel()`, win32 `py -3`, OV `fixLabel`.
- `scripts/extractAcfrGF.py` — the Phase-131 extractor (read ONLY to understand GF-column layout to reproduce independently; MUST NOT be imported).
- `.planning/phases/131-recon-extractors/131-RECON.md` — per-FY canonical origin URLs (correct-per-FY reference for audit (b)), the retrieval-deviation table, and the dry-run tie table (FY2024 grounding figures).
- `.planning/phases/132-data-model-load-enrichment/132-0{1,2,3}-SUMMARY.md` + `132-CONTEXT.md` — the loaded set (44 rows), municipality ids, Pima node id, pinned populations, source-safety invariants.

### Tether + frontend
- `src/utils/essentialsCoverage.ts` — `fetchCoverage`, `isValidCatalogShape`, `normalizePlace`, `stripLabel`, `matchEntityToCoverage`, `ESSENTIALS_URL` — the exact matcher behavior to mirror.

### Prior close-out shape
- `.planning/phases/.../130-VERIFICATION.md` (in `milestones/v2.17-phases/130-verification-live-uat/`) — the roll-up + traceability-flip format to mirror.
</canonical_refs>

<specifics>
## Specific Ideas / Grounding Facts

**Load set being verified (44 `budgets` rows = 22 city-FYs × 2 modes):**
| City | FY window | city-FYs | rows | muni id (prefix) | pop (2024 Census) |
|------|-----------|:--------:|:----:|------------------|------------------:|
| Oro Valley | FY2019–2024 | 6 | 12 | `1edc0ca1` | 48,855 |
| Marana | FY2019–2024 | 6 | 12 | `bff60025` | 62,380 |
| Sahuarita | FY2019–2024 | 6 | 12 | `3fdb131c` | 37,448 |
| South Tucson | FY2019–2022 | 4 | 8 | `cfa8cc5b` | 4,535 |

Pima County nav node: `b799043e-28f6-4229-9480-8d6b7e329d26` (existing, seeded v2.17; all five munis link to it via `county_id`).

**Grounding figures the re-derivation must reproduce (latest FY per city, from 131-RECON tie table, whole dollars):**
- Oro Valley FY2024: GF revenue $59,077,316 / GF expenditure $50,170,504
- Marana FY2024: GF revenue $94,153,099 / GF expenditure $59,821,670
- Sahuarita FY2024: GF revenue $32,166,628 / GF expenditure $23,924,397
- South Tucson FY2022: GF revenue $6,201,468 / GF expenditure $5,883,806

**Documented holes (must render as clean empty state, not failures):** South Tucson FY2023, FY2024 (not yet published — city files late).

**Execution environment:** run on `main` (gitignored `docs/<City>/` PDFs; not a worktree). `python` on PATH is the WindowsApps stub — invoke the extractor via `py -3` where the loader/harness shells out. Source `.env`/`.env.local`; use `SUPABASE_SERVICE_KEY`. Executed inline (no subagents — [[feedback_no_research_subagents]]). $0 AI spend — no paid API calls in any verification step ([[feedback_api_cost_threshold]]).
</specifics>

<deferred>
## Deferred Ideas

- Deeper Oro Valley / Sahuarita history (CAFRs back to ~FY2006 / FY2015) — deferred to a future deepening pass per 131-RECON (out of scope; this phase verifies only the loaded FY2019–2024 window).
- South Tucson FY2023/FY2024 load — blocked on the city publishing those ACFRs; verified here only as a clean empty state.
</deferred>

---

*Phase: 133-verification-live-uat*
*Context synthesized inline 2026-07-17 (Phase 130 analog).*
