# Phase 73: Utah Verification + Source-Chain Audit + UAT - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored, mirroring the Phase 67 v2.4 / Phase 62 v2.3 closeout structure + the executed 69–72 SUMMARYs; no research subagents per [[feedback_no_research_subagents]])

<domain>
## Phase Boundary

The v2.5 Utah milestone closeout. Independently verifies everything Phases 69–72 built — Utah city + county operating/revenue budgets, salaries/compensation, Census-2024 per-capita, category enrichment, and city→county linking. Three deliverables:

- **UVER-01 part A (ACFR reconciliation):** a representative sample of Utah entities reconciles against its published ACFR on a basis-matched comparison, with documented (explainable, not penny-exact) variance.
- **UVER-01 part B (source-chain durability audit):** every newly-loaded Utah budget/salary row carries durable human-page source attribution (no fragile/version-specific links), zero residue.
- **UVER-02 (live-app UAT):** the live app is verified end-to-end for the Utah expansion, with **Chris's UAT sign-off recorded at a blocking checkpoint**.

**In scope:** read-only ACFR reconciliation (sample), full-cohort source-chain + bleed-safety audit, guided live-app UAT + Chris sign-off. **Out of scope:** any data fix or re-load (a defect found is a documented follow-up / new phase, never fixed here) — including the 4 pre-existing $-leak enrichment rows (D-73-07).

**Depends on:** Phases 69 (10 cities op/rev + population), 70 (5 county-govs op/rev + linking + display-name fix), 71 (10-city salaries) + 71.1 (rollup ETL cost fix), 72 (3,536 universal enrichment rows) — all complete.
</domain>

<decisions>
## Implementation Decisions

### ACFR reconciliation (UVER-01 part A)
- **D-73-01 (sample — LOCKED):** **Provo (city) + Salt Lake County (county government).** Provo is the clean cross-read (smooth $213M–$346M operating across years, already penny-exact vs the 68-03 independent baseline and operator-approved in 69-02). Salt Lake County (~$1.46B operating) is the **first-ever Utah county-government ACFR reconciliation** — Phase 70-02 explicitly deferred all county ACFR recon to Phase 73. This satisfies UVER-01 SC#1 (≥1 entity) and closes the untested county tier.
- **D-73-02 (basis-matching, HARD):** Transparent Utah BigQuery data is **all-governmental-funds + proprietary** (no fund filter; `fund1` topping the tree gives the General/Enterprise/Special-Revenue/Capital/Internal-Service separation for free — see 69-01/69-02). A "basis-matched comparison" selects the ACFR statement line corresponding to what the load aggregates (total expenditures/revenues across all funds the load includes), same FY, basis documented explicitly. **Passes** when the loaded figure reconciles to the ACFR within a **documented, explainable tolerance** — NOT penny-exact. Differences must be *explained* (fund scope, enterprise inclusion, bond proceeds / airport or utility capital draws, inter-fund gross-ups, restatement, timing), never merely flagged. SLC's known FY-to-FY volatility (e.g. op $1.81B FY23 → $887M FY24 → $1.53B FY25, airport-driven) is the canonical example of explainable lumpiness — but SLC is NOT in this recon sample (already operator-reconciled in 69-01).
- **D-73-03 (year selection):** ACFRs lag ~1 year. For each entity pick the **most recent FY with BOTH a published ACFR AND a loaded Transparent Utah row** (loaded coverage is FY2014–FY2025; FY2026 intentionally excluded). Record the chosen year per entity. Census-2024 population is the per-capita basis.

### Source-chain durability + bleed-safety audit (UVER-01 part B)
- **D-73-04 (durability bar — LOCKED, bare domain passes):** Utah's attribution is **uniform**: `data_source = 'Transparent Utah'` + `source_url = https://transparent.utah.gov` on **every** budget AND salary row (unlike CA's deep `/d/<dataset-id>` pages + publicpay.ca.gov split). `transparent.utah.gov` is a stable, version-independent, citizen-openable page — it **meets** the durable-human-page bar. Uniform single-domain attribution is the Utah norm, NOT a gap. Requiring deeper per-entity/dataset deep-links was explicitly rejected — it would fail the existing load and reopen Phases 69–72, contradicting the read-only closeout.
- **D-73-05 (audit assertions):** (a) every newly-loaded Utah row carries attribution (`source_url` for budgets/salaries, `data_source` label for any custom rows); (b) **zero** Transparent-Utah rows have NULL `source_url`; (c) no stored `source_url` is fragile/version-specific (export tokens, one-time/session URLs, version/date query params, anything that 404s without state); (d) "zero residue" = no orphaned/placeholder/test/phantom rows from the backfill — explicitly re-confirm the 70-02 phantom `entity_type='city' "<X> County"` rows are gone and the 72 duplicate-name_key rows stayed at 0 (count holds at the verified 4,476 universal total / 0 duplicates).
- **D-73-06 (salaries: Transparent Utah attribution + names-free PII guard):** Utah salaries (`dataset_type='salaries'`, 120 rows = 10 cities × 12 FYs) are **Transparent Utah-sourced** (NOT CA GCC/publicpay — a Utah-specific difference from the Phase 67 precedent). The audit re-asserts the **names-free guarantee (D-71-01)**: no PII token (vendor_name, title, hourly_rate, gender, etc.) appears in any stored salary tree — assert 0 PII tokens across the serialized `hierarchy` of all 120 salary rows. This is the durable salary attribution + safety bar, not a gap.
- **D-73-07 (pre-existing $-leak rows — DOCUMENT, do NOT fix):** 4 pre-existing **non-Phase-72** universal enrichment rows (generated 2026-03-28: `parking meter`, `harbor and port enterprise fund`, `sewer enterprise fund`, `solid waste enterprise fund`) carry `$`-figures in their text — a bleed-safety violation. Per the read-only rule (D-73-08), the audit **reports them as a flagged pre-existing defect with a recommended cleanup follow-up** and does **not** write. Phase 73 stays 100% read-only. (The 3,536 Phase-72 rows are already clean: 0 `$`-leaks, 0 city-name leaks — re-confirm this in the audit.)

### Live-app UAT (UVER-02)
- **D-73-09 (UAT format — Chris drives, blocking checkpoint):** Guided checklist; **Chris drives the live app at treasurytracker.empowered.vote** ([[feedback_app_url]]). The plan produces a concrete, ordered click-through checklist; Chris walks it; the agent records pass/fail per item + his sign-off at a **blocking `checkpoint:decision`** task. The agent does NOT drive a browser. Runs after the ACFR recon + source-chain audit complete (Wave 2), so Chris reviews already-audited data.
- **D-73-10 (UAT spread — LOCKED):** **Salt Lake City + Salt Lake County + West Valley City + St. George.**
  - **Salt Lake City** — airport-heavy fund-topped operating icicle + revenue tab + Salaries tab (FY2014–2025) + per-capita + enrichment + Transparent Utah source chips; the volatility/numbered-fund-label case.
  - **Salt Lake County** — county-government page (icicle/summary + per-capita) + breadcrumb (US → Utah → Salt Lake County → city) + **Cities-in-County panel** showing its 4 linked cities (SLC, Sandy, West Jordan, West Valley City).
  - **West Valley City** — 2nd Salt Lake County city (cross-check linking + display name that legitimately keeps "City").
  - **St. George** — smallest-cohort edge / single-city county (Washington County): exercises a county with one linked city + a renamed display name (no "City" suffix).
  - **Pre-flight (Phase 62 Inglewood lesson):** verify each pick actually has the expected data (esp. a Salaries tab requires salaries rows) via a read-only probe BEFORE the checklist — `DatasetTabs.tsx` gates the Salaries card on `availableDatasets.includes('salaries')`.

### Method + safety
- **D-73-08 (read-only — LOCKED):** No DB writes, no source-file changes (the 4 $-leak rows notwithstanding, D-73-07). All verification is read-only probes + ACFR PDF reads (WebFetch) + a human checklist. Any defect found is documented in the SUMMARY as a recommended follow-up; fixing it is out of scope.
- **D-73-11 (DB target):** Production Treasury DB ONLY — repo `.env` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`. NEVER `mcp__supabase-local` (stale) per [[feedback_supabase_migration_mcp]] caveat. Probe columns: `total_budget`, `hierarchy`, `source_url`, `data_source` ([[reference_treasury_budgets_probe_columns]]); use exact-count head queries to avoid the 1000-row cap.
- **D-73-12 (free sources, $0):** ACFR/adopted-budget PDFs via WebFetch (free). No BigQuery (the rollup is loaded; never query BQ live per [[project_utah_bigquery_cost_incident]]). No paid data/APIs. Total spend $0 — well under the gate ([[feedback_api_cost_threshold]]).

### Claude's Discretion
- The exact ACFR statement line chosen as the basis-matched comparator per entity (Provo, Salt Lake County); the tolerance band (document the reasoning); the chosen recon FY per entity (within D-73-03); the order of audit probes; the precise UAT checklist wording/ordering and the exact FY a UAT step lands on (within the D-73-10 entity set + coverage).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Closeout precedent (mirror the method)
- `.planning/phases/67-socal-verification-source-chain-audit-uat/67-CONTEXT.md` — the v2.4 closeout this phase mirrors (3-plan shape: recon ∥ audit → UAT; D-01..D-10 analogs).
- `.planning/milestones/v2.3-phases/62-acfr-verification-source-chain-audit-uat/` — the v2.3 closeout precedent (62-01 reconciliation, 62-02 source-chain audit, 62-03 UAT checklist + blocking checkpoint, 62-VERIFICATION). The Inglewood "no-salaries-tab" pre-flight lesson lives here.
- `scripts/` source-chain audit probes from Phase 62/67 (`audit_task1*.mjs`, `audit_task2.mjs`) — reusable attribution / NULL-source_url / fragility / residue scan patterns; parameterize the cohort filter to the Utah municipality ids.

### Utah loaded cohort (what this phase reconciles/audits)
- `.planning/phases/69-utah-city-budgets-load/69-01-SUMMARY.md`, `69-02-SUMMARY.md`, `69-03-SUMMARY.md` — 10 cities op/rev FY2014–2025 (24 rows each), SLC + Provo operator reconciliations, Census-2024 population. Provo FY2024 baseline: op $346,484,274.68 / rev $285,684,200.65.
- `.planning/phases/70-utah-county-budgets-linking/70-01-SUMMARY.md`, `70-02-SUMMARY.md` — 5 counties op/rev (24 each) + city→county linking + display-name fix; the phantom-county-row incident (residue check target); county recent-FY operating: Salt Lake ~$1.46B, Utah ~$594M, Davis ~$322M, Weber ~$227M, Washington ~$160M.
- `.planning/phases/71-utah-city-salaries-compensation/71-01-SUMMARY.md` + `docs/utah-salaries-coverage.md` — 120 salary rows, names-free PII guard (D-71-01), Provo FY2024 salaries reconciliation.
- `.planning/phases/71.1-utah-single-scan-rollup-etl-bigquery-cost-fix/71.1-01-SUMMARY.md` + `docs/utah-bigquery-access.md` — rollup ETL + the BigQuery cost guard (do NOT query BQ live).
- `.planning/phases/72-utah-enrichment-parity/72-01-SUMMARY.md` + `data/utahEnrichment72.mjs` — 3,536 universal enrichment rows (0 $-leaks, 0 city-name leaks); the NULLS-DISTINCT duplicate incident + 4,476-row clean baseline; the 4 pre-existing 2026-03-28 $-leak rows (D-73-07 target).

### Milestone + entity facts
- `.planning/ROADMAP.md` §"Phase 73" — goal + 4 success criteria + plan shape.
- `.planning/REQUIREMENTS.md` — UVER-01, UVER-02 definitions.
- `.planning/research/UTAH-RECON.md` — Transparent Utah source of record, FY2014→present, all-funds basis.
- The read-only `.env` service-key probe snippet (61-01-PLAN.md Task 2 / 63-01-PLAN.md). [[reference_treasury_budgets_probe_columns]].
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 62/67 audit probes (`scripts/audit_task1*.mjs`, `audit_task2.mjs`) already encode durable-source + NULL-source_url + fragility + zero-residue checks against `treasury.budgets`; parameterize by cohort (filter to the 15 Utah municipality ids).
- `scripts/loadUtahTransparency.test.mjs` already imports the PY query string + `buildSalaryTree` and asserts PII tokens are absent — the audit can reuse this assertion pattern against the live stored salary `hierarchy` (D-73-06).

### Established Patterns
- `DatasetTabs.tsx` gates the Salaries card on `availableDatasets.includes('salaries')` — a UAT city must actually have salaries rows or the tab correctly won't show (verify the pick first; the Phase 62 Inglewood correction). All 10 UT cities have 120 salary rows, so all UAT cities qualify.
- Utah municipality display names: 8 cities were renamed to drop "City" (Provo, Orem, Ogden, Layton, Lehi, Sandy, St. George, West Jordan); **Salt Lake City + West Valley City legitimately keep it** (70-01). Probes/checklists keying on `municipalities.name` must use the display names.
- Uniform Utah attribution: `data_source='Transparent Utah'`, `source_url='https://transparent.utah.gov'` on every budget + salary row — the durability bar (D-73-04), simpler than CA's mix.

### Integration Points
- Production `treasury.budgets` keyed by municipality id; counts: 10 cities × 24 + 5 counties × 24 = 360 budget rows + 120 salary rows; enrichment in `category_enrichment` (4,476 universal total, 3,536 from P72).
- Breadcrumb + Cities-in-County panel: US → Utah (state node, pop 3,271,616/2024) → County → city, via `county_id` links seeded in 70-01.
</code_context>

<specifics>
## Specific Ideas
- The source-chain audit should report per-phase cohort counts (69: 240 city op/rev rows; 70: 120 county op/rev rows; 71: 120 salary rows; 72: 3,536 universal enrichment rows) and confirm NULL-source_url Transparent-Utah rows = 0, residue = 0 (phantom county rows gone, enrichment duplicates = 0 / count holds at 4,476).
- UAT spread deliberately includes a multi-city county (Salt Lake County, 4 cities) AND a single-city county (Washington/St. George) to exercise the Cities-in-County panel at both extremes, plus a "keeps City" display name (West Valley City) vs a renamed one (St. George).
- Salt Lake County is the milestone's first county-government ACFR reconciliation — give its variance explanation extra care (county all-funds vs ACFR governmental/proprietary split).
</specifics>

<deferred>
## Deferred Ideas
- The 4 pre-existing ($-leak) universal enrichment rows (2026-03-28 origin) → documented follow-up (bleed-safety cleanup of the original AI enrichment), NOT fixed here (D-73-07/08).
- Any reconciliation variance or render defect found during recon/audit/UAT → documented follow-up (new phase/issue), not fixed here (D-73-08).
- The 124 deferred single-city salary department enrichments (72 D-72-08) and the 77 generic `general_fund` enrichment fallthroughs (72 D-72-04) remain a long-tail follow-up, not a Phase 73 defect.
- v2.4 follow-ups remain deferred: broader SoCal ACFR cross-read; FUP-01..03 (Glendale/Burbank ACFR, Employees-card year-gating UX, salary dept-name canonicalization).
- Milestone retrospective + archive → `/gsd-complete-milestone` after Phase 73 closes.
- None of the above were folded into this phase — discussion stayed within the closeout scope.
</deferred>

---

*Phase: 73-utah-verification-source-chain-audit-uat*
*Context gathered: 2026-06-20 (inline)*
