# Phase 67: SoCal Verification + Source-Chain Audit + UAT - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored, mirroring the Phase 62 v2.3 closeout structure + the executed 63–66 SUMMARYs; no discuss-phase / research subagents per [[feedback_no_research_subagents]])

<domain>
## Phase Boundary

The v2.4 milestone closeout. Independently verifies everything Phases 63–66 built: (VER-05) a representative sample of SoCal county governments + cities reconciles against published ACFRs/adopted budgets on a basis-matched comparison, AND a full-cohort source-chain durability audit passes (every backfilled row carries durable human-page attribution, zero residue); (VER-06) the live app is verified end-to-end for the SoCal expansion with **Chris's UAT sign-off recorded at a blocking checkpoint**.

**In scope:** Read-only ACFR reconciliation (sample), full-cohort source-chain audit, guided live-app UAT + Chris sign-off. **Out of scope:** any data fix (a defect found is a documented follow-up / new phase, never fixed here); new loads.

**Depends on:** Phases 63 (95 cities op/rev), 64 (8 county-gov op/rev), 65 (95 cities salaries), 66 (185 enrichment universals) — all complete.
</domain>

<decisions>
## Implementation Decisions

### ACFR reconciliation (VER-05 part A)
- **D-01 (sample):** A representative spread of **~3 SoCal county governments + ~3 SoCal cities** with documented loaded FY totals (traceable to the 63/64 SUMMARYs). Suggested: county govs **Riverside, San Diego, Ventura** (different sizes; Ventura is the Phase 52/57 validation county); cities **Riverside, Oxnard, Chula Vista** (large, clean op/rev). Executor may adjust within "≥3 county-govs + ≥3 cities across ≥3 counties." Loaded county-gov FY2024 totals for cross-check (from 64-01-SUMMARY): Riverside op $7.58B/rev $7.64B; San Diego op $7.48B/rev $7.62B; Ventura op $3.01B/rev $3.17B.
- **D-02 (basis-matching, HARD):** SCO ByTheNumbers data is **all-governmental-funds** basis (general + special revenue + debt service + capital + enterprise/proprietary/internal-service). Published ACFRs present governmental vs proprietary funds in separate statements. A "basis-matched comparison" selects the ACFR line corresponding to what SCO aggregates (typically total expenditures across all governmental funds + proprietary where SCO includes them), same FY, basis documented explicitly. **Passes** when the loaded SCO figure reconciles to the ACFR within a **documented, explainable tolerance** — NOT penny-exact. Differences must be *explained* (basis scope, fund inclusion, restatement, timing), never merely flagged.
- **D-03 (year selection):** ACFRs lag ~1 year (FY2024 ACFRs may be unpublished). For each entity pick the **most recent FY with BOTH a published ACFR AND a loaded SCO row** (expected FY2022 or FY2023). Record the chosen year per entity.

### Source-chain durability audit (VER-05 part B)
- **D-04 (durability bar):** "Durable human-page URL" = a stable, version-independent page a citizen can open: the ByTheNumbers `/d/<dataset-id>` pages (`/d/ju3w-4gxp` + `/d/rrtv-rsj9` for city op/rev; `/d/uctr-c2j8` + `/d/emxv-k8xv` for county-gov op/rev), publicpay.ca.gov for salaries, official adopted-budget landing pages for custom rows. **Fragile** = export tokens, one-time/session URLs, API/CSV endpoints with version/date query params, anything that 404s without state. The audit asserts: (a) every backfilled row carries attribution (`source_url` for SCO rows, `data_source` label for custom rows); (b) **zero** SCO-sourced rows have NULL `source_url`; (c) no stored `source_url` is fragile/version-specific; (d) "zero residue" = no orphaned/placeholder/test rows from the backfill.
- **D-05 (audit cohort + known non-residue):** The full SoCal backfill: Phase 63 (95 cities op/rev), Phase 64 (8 county-gov op/rev — incl. Alameda + Sacramento), Phase 65 (95 cities salaries), Phase 66 (185 universal enrichment rows). **Known NULL-`source_url` rows that are NOT residue:** Riverside city's custom General-Fund operating rows (FY2023/2024) and San Diego city's custom budget + FY2025 op/rev — these are pre-existing custom-source rows carrying a `data_source` label (documented in 63-01/63-03 SUMMARYs), preserved by never-overwrite. Salaries rows store the GCC `data_source` label (publicpay.ca.gov) rather than a `/d/` URL — that is the durable salary attribution, not a gap.

### Live-app UAT (VER-06)
- **D-06 (UAT format — Chris drives):** **Guided checklist; Chris drives the live app at treasurytracker.empowered.vote** ([[feedback_app_url]]). The plan produces a concrete, ordered click-through checklist; Chris walks it; the agent records pass/fail per item and his sign-off at a **blocking `checkpoint:decision`** task. The agent does NOT drive a browser. Runs after 67-01 + 67-02 so Chris reviews already-audited data.
- **D-07 (UAT coverage):** Exercise every VER-06 item — FY2003 history depth, the salaries dataset/tab, per-capita across backfilled years, category enrichment rendering, the breadcrumb chain (US → California → County → city), and the Cities-in-County panel — on a representative SoCal spread: a SoCal city (FY2003 + per-capita + enrichment), a SoCal county-government page (icicle/summary + per-capita + Cities-in-County + breadcrumb), a salaries city (Salaries tab FY2009–2024), spanning a newly-created county (e.g. Ventura/Imperial) to test breadcrumb + Cities-in-County on a county created this milestone. Suggested spread: Riverside (city), Ventura County (county-gov page), Oxnard (Ventura city — salaries + breadcrumb), El Centro (Imperial — smallest cohort). Verify pick has the data via a read-only probe BEFORE the checklist (the Phase 62 Inglewood lesson — a city with no budget rows correctly shows no Salaries tab).

### Method + safety
- **D-08 (read-only):** No DB writes, no source-file changes. All verification is read-only probes + ACFR PDF reads (WebFetch) + a human checklist. Any defect found is documented in the SUMMARY as a recommended follow-up; fixing it is out of scope.
- **D-09 (DB target):** Production Treasury DB ONLY — repo `.env` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`. NEVER `mcp__supabase-local` (stale). Probe columns: `total_budget`, `hierarchy`, `source_url`, `data_source` ([[reference_treasury_budgets_probe_columns]]); use exact-count head queries to avoid the 1000-row cap.
- **D-10 (free sources, $0):** ACFR/adopted-budget PDFs via WebFetch (free). No paid data/APIs. Total spend $0 (well under the gate, [[feedback_api_cost_threshold]]).

### Claude's Discretion
- Which ACFR statement line is the basis-matched comparator per entity; the tolerance band (document the reasoning); the exact sample entities; the order of audit probes; the precise UAT checklist wording/ordering and city picks (within D-07 coverage).
</decisions>

<canonical_refs>
## Canonical References

**Downstream executors MUST read these.**

- `.planning/phases/62-acfr-verification-source-chain-audit-uat/` — the v2.3 closeout precedent (62-01 reconciliation, 62-02 source-chain audit, 62-03 UAT checklist + blocking checkpoint, 62-VERIFICATION). Mirror its method.
- `.planning/phases/63-*/VERIFICATION.md` + `64-*/VERIFICATION.md` + `65-*/VERIFICATION.md` + `66-*/VERIFICATION.md` — the loaded cohorts + per-entity totals this phase reconciles/audits.
- `scripts/` source-chain audit probes from Phase 62 (`audit_task1*.mjs`, `audit_task2.mjs`) — reusable patterns for attribution / NULL-source_url / fragility / residue scans.
- The read-only `.env` service-key probe snippet (61-01-PLAN.md Task 2 / 63-01-PLAN.md). [[reference_treasury_budgets_probe_columns]].
</canonical_refs>

<code_context>
## Existing Code Insights
- Phase 62's audit probes already encode the durable-source + zero-residue checks against `treasury.budgets`; they parameterize by cohort (filter to the SoCal municipality ids).
- `DatasetTabs.tsx` gates the Salaries card on `availableDatasets.includes('salaries')` — a UAT city must actually have salaries rows or the tab correctly won't show (verify the pick first; the Phase 62 Inglewood correction).
- Salaries `data_source` = "CA State Controller — Government Compensation in California (publicpay.ca.gov)" (durable), not a `/d/` URL — expected.
</code_context>

<specifics>
## Specific Ideas
- The source-chain audit should report per-phase cohort counts (63: ~4106 city op/rev + linking; 64: 352 county-gov; 65: 1510 salaries; 66: 185 enrichment) and confirm NULL-source_url SCO rows = 0 (excluding the documented custom-source rows that carry a data_source label).
- UAT spread should include at least one city in a county CREATED this milestone (San Bernardino/Ventura/Santa Barbara/Imperial) to exercise the new breadcrumb + Cities-in-County panel.
</specifics>

<deferred>
## Deferred Ideas
- Any reconciliation variance or render defect found → documented follow-up (new phase/issue), not fixed here (D-08).
- v2.3 follow-ups FUP-01..03 remain deferred to a later milestone.
- Milestone retrospective + archive → /gsd-complete-milestone after Phase 67 closes.
</deferred>

---

*Phase: 67-socal-verification-source-chain-audit-uat*
*Context gathered: 2026-06-17 (inline)*
