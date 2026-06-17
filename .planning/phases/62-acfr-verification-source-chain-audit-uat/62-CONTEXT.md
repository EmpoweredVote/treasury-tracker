# Phase 62: ACFR Verification + Source-Chain Audit + UAT - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored from Phases 58–61 summaries + Chris decisions 2026-06-16; no discuss-phase / research subagents per standing cost preference)

<domain>
## Phase Boundary

The closeout/verification phase for the v2.3 California Coverage Parity milestone. No new data is loaded and no source files change — this phase **independently proves** the parity work shipped in Phases 58–61 is correct, durably sourced, and usable in the live app, then records Chris's sign-off.

Three independent verifications:
1. **ACFR reconciliation (SC#1 / VER-03 part A)** — the loaded SCO/parity totals reconcile against published ACFRs / adopted budgets for the LA County government + a representative sample of LA County cities, on a basis-matched comparison, documented.
2. **Source-chain audit (SC#2 / VER-03 part B)** — every backfilled budget/salary row carries durable human-page source attribution (no fragile/version-specific links), zero residue.
3. **Live-app E2E + Chris UAT (SC#3 + SC#4 / VER-04)** — the live app is verified end-to-end (FY2003 depth, salaries dataset, per-capita across backfilled years, enrichment, breadcrumbs + Cities-in-County panels) and Chris records UAT sign-off.

**In scope:** Read-only verification against the production Treasury DB + published ACFR PDFs (free official sources); documentation of findings; a guided live-app UAT checklist that Chris drives; recorded sign-off.

**Out of scope:** Any data writes or source-file changes (this is a verification phase — if the audit finds a defect, it is documented and a fix is a follow-up, not part of this phase). The 5,226 single-city salaries department long-tail name_keys deferred in Phase 61 (documented gap, v2.4 candidate). SoCal expansion (v2.4). Loading county-government budgets for the linking-only county nodes (v2.4).
</domain>

<decisions>
## Implementation Decisions

### ACFR reconciliation scope (Chris, 2026-06-16)
- **D-01 (Chris):** The ACFR reconciliation sample = **the LA County government entity + the 4 LA County cities already spot-checked in Phase 58: Burbank, Glendale, Pasadena, Santa Monica.** These 4 have documented loaded FY totals in `58-04-SUMMARY.md`, so basis-matching is cleanest and the comparison is traceable. 5 entities total.
- **D-02 (basis-matching, HARD):** SCO ByTheNumbers data is reported on an **all-governmental-funds** basis (general fund + special revenue + debt service + capital projects + enterprise/proprietary/internal-service funds — per the Phase 58 basis note). Published ACFRs present governmental funds and proprietary funds in **separate** statements. A "basis-matched comparison" means: select the ACFR line that corresponds to what SCO aggregates (typically *total expenditures across all governmental funds*, plus proprietary funds where SCO includes them), for the **same fiscal year**, and document the basis explicitly. The reconciliation **passes** when the loaded SCO figure is reconcilable to the published ACFR on a basis-matched line within a **documented, explainable tolerance** — NOT when it ties to the penny. Differences must be *explained* (basis scope, fund inclusion, restatement, timing), never merely flagged.
- **D-03 (year selection):** ACFRs lag ~1 year, so FY2024 ACFRs may be unpublished. For each of the 5 entities pick the **most recent fiscal year for which BOTH a published ACFR exists AND a loaded SCO row exists** (expected FY2022 or FY2023). Reconcile that year. Record the chosen year per entity.

### Source-chain audit (SC#2 / VER-03)
- **D-04 (durability bar):** "Durable human-page URL" = a stable, version-independent page a citizen can open (e.g. the ByTheNumbers `/d/<dataset-id>` dataset page `https://bythenumbers.sco.ca.gov/d/...`, a city's adopted-budget landing page, publicpay.ca.gov for salaries). **Fragile/version-specific** = a link embedding an export token, a one-time download/session URL, an API/CSV endpoint with a version or date query param, or anything that 404s without state. The audit asserts: (a) every backfilled budget/salary row carries source attribution (`source_url` for SCO rows, `data_source` label for custom rows), (b) **zero** SCO-sourced rows have NULL `source_url`, (c) no stored `source_url` is fragile/version-specific, (d) "zero residue" = no orphaned/placeholder/test rows left by the backfill.
- **D-05 (audit cohort):** The full backfilled cohort across all four phases — Phase 58 (88 LA County cities + LA County gov op/rev), Phase 59 (7 thin cities op/rev layer), Phase 60 (98 CA cities salaries), Phase 61 (528 enrichment universals). The 37 known NULL-`source_url` rows are the pre-existing non-SCO custom rows (LA/LB/WeHo) documented in Phase 58 — they carry a `data_source` label instead and are NOT residue.

### Live-app UAT (SC#3 + SC#4 / VER-04) (Chris, 2026-06-16)
- **D-06 (UAT format — Chris):** **Guided checklist, Chris drives the live app.** The plan produces a concrete click-through checklist against **treasurytracker.empowered.vote** (per [[feedback_app_url]]); Chris walks it; the agent records pass/fail per item and Chris's sign-off at a **blocking `checkpoint:decision`** task. The agent does NOT drive a browser itself.
- **D-07 (UAT coverage):** The checklist must exercise every item named in VER-04: FY2003 history depth, the salaries dataset/tab, per-capita across backfilled years, category enrichment rendering, the breadcrumb chain (US → California → County → city), and the Cities-in-County panel — on a representative spread (an LA County city, the LA County government page, a Phase 59 linked city, and a salaries-only city).

### Method + safety
- **D-08 (read-only):** This phase performs **no DB writes and no source-file changes.** All verification is read-only probes + ACFR PDF reads + a human checklist. Any defect found is documented in the SUMMARY with a recommended follow-up; fixing it is out of scope (would be a new phase/issue).
- **D-09 (DB target):** Production Treasury DB ONLY — repo `.env` / `.env.local` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`. `mcp__supabase-local` MUST NOT be used (stale for this data, per [[project_next_milestone_socal_parity]]).
- **D-10 (free sources, $0):** ACFR / adopted-budget PDFs are fetched from official city/county sites via WebFetch (free). No paid data sources, no paid APIs. Total spend $0 (well under the ~$5 gate, [[feedback_api_cost_threshold]]).

### Claude's Discretion
- Which ACFR statement line is the basis-matched comparator per entity; the exact tolerance band (document the reasoning); the order of audit probes; the precise wording / ordering of the UAT checklist items (within D-07 coverage); which specific cities fill the UAT spread.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### What Phase 62 verifies (the four upstream closeouts — read for loaded figures + deferrals)
- `.planning/phases/58-la-county-parity-backfill/58-04-SUMMARY.md` — LA County cities + gov backfill figures (FY2003 county $13.664B op / $14.139B rev; FY2024 $37.577B op / $39.322B rev), the 4 sample cities' loaded FY2003 totals, NULL `source_url`=37 (custom), SCO-NULL=0, Calabasas/Sierra Madre source gaps, and the explicit Phase 62 deferral list.
- `.planning/phases/59-remaining-ca-cities-history-linking/59-04-SUMMARY.md` — 7 thin cities FY2003 reach + county linking + SF combined node + basis notes.
- `.planning/phases/60-statewide-ca-salaries-sweep/60-03-SUMMARY.md` — salaries reconciliation method ($0 delta vs GCC export for Glendale/Burbank/Pasadena), coverage (95/98 full 16 yr; LA/Carson/Lynwood partials explained), SAL render path (`DatasetTabs.tsx`).
- `.planning/phases/61-enrichment-parity/61-01-SUMMARY.md` — 528 universal enrichment rows, op/rev 100% / salaries 56.6% coverage, 0 real bleed leaks, deferred 5,226 single-city salary tail.

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` — VER-03, VER-04 (verbatim acceptance text).
- `.planning/ROADMAP.md` §Phase 62 — goal + 4 success criteria.

### Source-chain + render-code references
- `scripts/loadCASalaries.js` — salaries `source_url`/publicpay provenance + tree shape.
- `src/data/cityBasisNotes.ts` + `App.tsx` (basis-note IIFE ~line 932) — basis-note gating already verified in Phase 58; UAT confirms it renders for Long Beach + West Hollywood only.
- `DatasetTabs.tsx` — Salaries card gating (`availableDatasets.includes('salaries')`).
- `docs/socal-county-onboarding.md` — Step 4 (verification) + the source-durability convention.

### Production DB access pattern (mirror exactly)
- `.planning/phases/61-enrichment-parity/61-01-PLAN.md` (Task 2 `<verify>` block) — the canonical `.env`-loading + `createClient(..., {db:{schema:'treasury'}})` service-key probe snippet to reuse for all read-only probes.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The `.env` service-key probe pattern from `61-01-PLAN.md` is the read-only DB access harness for every probe in this phase.
- LA County government entity id `f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1`.
- Phase 58 already established SCO-NULL-`source_url`=0 and the 37 expected custom NULLs — the source-chain audit re-confirms this at full-cohort depth and adds the fragility check (D-04c) that Phase 58's light pass did not do.

### Established Patterns
- Light-inline verification (Phases 58/59/60) deferred *formal* ACFR/audit/UAT to here — this phase does the deep, documented version.
- Independent-re-aggregation reconciliation (Phase 60 salaries, $0 delta vs GCC export) is the methodological template: compare against an *independent* source, not a re-sum of the ingested tree.

### Integration Points
- ACFRs are the upstream source SCO ByTheNumbers itself collects — so a basis-matched comparison should tie closely; large residuals indicate a basis-scope mismatch to explain, not necessarily a load error.
- Live app at treasurytracker.empowered.vote reads the same production Treasury DB the probes hit — render correctness is data-driven (verified by construction in Phases 58–60); UAT confirms the pixels.
</code_context>

<specifics>
## Specific Ideas
- Expect SCO ByTheNumbers ("all governmental funds") to exceed an ACFR's *governmental-funds-only* statement (SCO folds in enterprise/proprietary). The basis-matched comparator is usually the ACFR's total of all governmental funds + enterprise funds, or the government-wide statement of activities — pick and document per entity.
- For the salaries side, Phase 60 already reconciled 3 cities to $0 delta vs the official GCC export; the source-chain audit only needs to confirm durable `source_url`/provenance on salary rows, not re-reconcile totals.
- The UAT spread should include at least one salaries-only city (e.g. a Phase 60 city without a custom budget) so the salaries tab is exercised distinctly from op/rev.
</specifics>

<deferred>
## Deferred Ideas
- Fixing the 5,226 single-city salaries department long-tail name_keys (Phase 61 documented gap) → v2.4 source-naming canonicalization pass.
- Any defect the audit surfaces → documented as a follow-up phase/issue, not fixed here (D-08).
- Full-county SCO expansion + county-gov budgets for linking-only nodes → v2.4.
</deferred>

---

*Phase: 62-acfr-verification-source-chain-audit-uat*
*Context gathered: 2026-06-16 (inline)*
