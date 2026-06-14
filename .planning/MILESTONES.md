# Milestones — Treasury Tracker / Empowered Vote Financials

## v2.1 Federal History (Shipped: 2026-06-14)

**Phases completed:** 3 phases, 13 plans

**Delivered:** Every available prior federal fiscal year (FY1976→FY2024) brought up to v2.0 detail — function lens, agency lens, and revenue-by-source per year — selectable through the federal YearSelector, with honest comparability context and every figure sourced, at **$0 API spend**.

**Key accomplishments:**

- **Historical federal backfill (Phase 49)** — function (OMB Hist 3.2), agency (Hist 4.1/5.1), and receipts (Hist 2.x) detail loaded for FY1976–FY2024 plus the FY1976 Transition Quarter, every row carrying source_name/url/date and each year recomputing its own visual-vs-official disclosure; loaders parameterized across years (free OMB tables only, no LLM).
- **Federal YearSelector wiring (Phase 50)** — FY1976–FY2025 + the Transition Quarter all selectable; function/agency/revenue trees, landing bands, and the deficit strip switch per period via a centralized `parsePeriod`/`buildPeriodTokens` model; per-year per-capita/per-taxpayer denominators (FRED population + IRS returns) with honest gaps disclosed.
- **Source-chain durability + comparability + UAT (Phase 51)** — repointed every metric source_url off version-specific xlsx / raw-API URLs to durable human pages (audit **FAIL 0**, 0 fragile URLs); authored sourced comparability content (TQ + function drift + 5 Cabinet reorganizations, each verified against its GovInfo public-law record); rendered the notes in-app with source chips; Chris UAT sign-off on prod.

**Milestone audit:** PASSED — 8/8 requirements satisfied (HIST-01..04, NAV-01/02, CTX-01/02), cross-phase integration + E2E flow verified, all phases Nyquist-compliant. See `milestones/v2.1-MILESTONE-AUDIT.md`.

**Known deferred items at close:** 3 orphaned pre-v2.0 quick-tasks (`001-create-treasury-tracker-entries`, `002-add-longview-tx-revenue`, `003-longview-operating-budget`) — files missing, already acknowledged at the v2.0 close; not v2.1 scope. See STATE.md Deferred Items.

---

## v2.0 Federal Treasury Tracker (Shipped: 2026-06-13)

**Phases completed:** 6 phases, 20 plans

**Delivered:** The US Federal Government live at treasurytracker.empowered.vote — FY2025 budget visualized with maximum clarity and context, every figure and text claim sourced to an official record, never editorialized.

**Key accomplishments:**

- **Federal entity + always-sourced schema (Phase 43)** — `entity_type='federal'` end-to-end on the Phase 32 state pattern; `source_name/url/date` columns on budget + enrichment rows; `program_details` table for Tier 2 origins. No regression on city/county/state.
- **All headline federal data, sourced (Phase 44)** — FY2025 actuals both lenses (function: 18→61→1,613 nodes summing exactly to OMB Hist 1.1; agency: 29 departments, identity 0.006% vs MTS T5), OMB 8.1 split (FY2015–25), 64-year history, FY2026 FYTD, debt $39.2T — every row carries source metadata.
- **Federal visualization (Phase 45)** — proportional Mandatory/Discretionary/Net Interest landing bands + permanent receipts-vs-outlays deficit strip, function-default/agency-toggle drill, a source chip on every figure, per-capita/per-taxpayer/%-of-total scales with disclosed formulas.
- **Sourced explainer pipeline v2 (Phase 46)** — 27 Tier-1 explainers authored from fetched authoritative text only, citations stored + displayed, at **$0 API cost**; DoD failed-audit opacity flagged with GAO's verbatim disclaimer.
- **Program origins pilot (Phase 47)** — 15 major programs show enabling bill / public law / sponsor / year / cosponsors structured from Congress.gov + GovInfo, every claim linked, **zero LLM** (deterministic fetch); foundational pre-1973 programs show an honest sponsor-boundary note.
- **Source-chain verification + UAT (Phase 48)** — automated audit of 225 claim rows / 61 unique URLs → **61/61 PASS, zero residue** (govinfo via API, congress.gov via real-browser content match); Chris UAT sign-off "Looks amazing!"; US tracker pinned first on the landing grid with an American-flag tile.

**Known deferred items at close:** 5 stale/orphaned artifacts acknowledged and deferred (3 unrelated "longview" quick-tasks with missing files; 2 empty uat/verification-gap entries matching the pre-existing Phase 07/14/22/25 `human_needed` tech debt). None are v2.0 blockers — all 6 phases have complete VERIFICATION files. See STATE.md Deferred Items.

---

## v1.9 MA County-City Linking (Shipped: 2026-06-11)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Seeded 5 active MA county entities (Barnstable, Bristol, Dukes, Norfolk, Plymouth) with Census 2024 population, linked all MA cities in those counties via county_id FK, loaded each county's operating budget from individual PDFs, and enriched all 68 county budget categories (municipality_id-scoped). County breadcrumbs and CitiesInCountyPanel activated with zero frontend changes. UAT 27/27 passed.

**Phases completed:** 40–42 (3 phases, 4 plans)

**Archive:** [v1.9-REQUIREMENTS.md](milestones/v1.9-REQUIREMENTS.md)

---

## v1.8 Massachusetts All-Cities Financial Transparency (Shipped: 2026-06-10)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Loaded real budget data for all 351 Massachusetts municipalities from the MA DLS reporting portal (special-revenue + revenue-by-source report types, FY2021–FY2025), making MA the first fully-covered state. Loaded MA populations (Census 2024), upgraded MA state government from hardcoded estimates to real DLS data, and applied universal enrichment for the 14 shared DLS category names. GF Expenditures report type deferred (re-add path in 37-01-SUMMARY.md).

**Phases completed:** 37–39 (3 phases, 8 plans)

---

## v1.7 California State Budget + Deep Icicles (Shipped: 2026-06-09)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Introduced `entity_type: 'state'` infrastructure, loaded the California state budget, built 3-level tree support in ev-accounts-api, shipped the CA state 3-level icicle pilot, and selectively retrofitted deep icicles to qualifying cities.

**Phases completed:** 32–36 (5 phases, 15 plans)

---

## v1.6 California City Expansion (Shipped: 2026-06-06)

**Delivered:** Added 9 new California cities — Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana — with operating + revenue budgets, enrichment, and per-capita display. Closed two v1.5 carry-forwards (Longview TX revenue enrichment, STATE_LABELS full names).

**Phases completed:** 26–31 (6 phases, 20 plans)

**Key accomplishments:**

- Sacramento loaded via existing loadSacramentoCSV.js pipeline — FY2013–FY2026 operating + revenue (14 FYs each), 536K population, 20 enrichment rows; Phase 26 fastest in milestone
- Longview TX revenue enrichment completed (2 corrupted category names fixed, 36 rows added); STATE_LABELS full names verified in live app — carry-forwards closed in under 1 day
- Oakland (GPF biennial, $807M–$834M/yr, FY2024–2025) and San Jose (General Fund, $1.69B–$1.82B, FY2021–2025) loaded via pdfplumber — 50 enrichment rows, all 6 criteria PASS
- Long Beach ($634M–$773M GF, FY2022–2026, Port excluded) and Bakersfield (GF ~$412-427M; scope corrected from all-funds during verification) loaded; Bakersfield scope fix discovered and applied inline during enrichment phase
- Fresno (GF ~$483M, enterprise funds excluded) and Riverside (biennial, GF ~$1.45B/yr, RPU excluded) loaded — 30 enrichment rows, revenue deferred for both (no extractable GF revenue section in PDFs)
- Anaheim (GF $491M–$530M, utility enterprise filtered) and Santa Ana (GF $404M–$424M) loaded — 51 enrichment rows; all 6 criteria PASS in live app

**Stats:** 6 phases, 20 plans; 3 days (2026-06-04 → 2026-06-06); ~143 commits

**Known deferred at close:**

- Oakland revenue (OpenGov embedded chart format — not extractable via pdfplumber)
- Fresno + Riverside revenue (no extractable GF revenue section in PDFs)
- San Jose FY2016–2020 (older PDF format)

**Archive:** [v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) | [v1.6-REQUIREMENTS.md](milestones/v1.6-REQUIREMENTS.md)

---

## v1.5 Oregon Expansion (Shipped: 2026-06-04)

**Phases completed:** 9 phases, 24 plans, 36 tasks

**Key accomplishments:**

- Portland municipality seeded (id 2abac6c2, pop 635,749), two Adopted Budget PDFs downloaded, pdfplumber confirmed, Appropriation Schedule table structure documented for Plan 02 extractor, and Oregon added to city picker
- pdfplumber Python extractor and Node.js loader pipeline built and dry-run validated against both Portland Adopted Budget Vol 1 PDFs; FY2025 yields 39 bureaus totaling $8.045B and FY2026 yields 34 bureaus totaling $8.483B in full-dollar amounts
- Portland, OR operating budget live-loaded for FY2025 (39 bureaus, $8.045B) and FY2026 (34 bureaus, $8.483B), categories AI-enriched (41 rows scoped to Portland), human-verify checkpoint approved, and 17-VERIFICATION.md filed — Phase 17 ROADMAP goal confirmed met
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- Revenue extraction pipeline for Gresham: extract_revenue() + --mode argparse in extractGresham.py; buildRevenueTree() + parametric dataset_type plumbing in processGresham.js; dry-run validates 4 FYs x 10 revenue categories ($411M-$521M)
- Gresham revenue FY2023–FY2026 live-loaded ($411M/$460M/$521M/$512M), 10 categories enriched, no operating collision, Money In tab human-verified in app
- pdfplumber extractor for Troutdale's General Fund (17 depts, $21.1M) and All Funds revenue (10 cats, $33.7M) with all 8 adopted-budget PDFs downloaded and municipality seeded at population 15749
- processTroutdale.js created and validated — all 8 fiscal years (FY2019-FY2026) parse cleanly in operating and revenue dry-runs; D-02 resolved with full FY include-list for Plan 03
- Troutdale, OR live-loaded FY2019–FY2026 operating ($21.1M) + revenue ($33.7M), population 15749 for per-capita display (~$1,342/person), and 26 enrichment rows — all verified by human in the app.
- extract_requirements() added to extractGresham.py with REQUIREMENTS_CATEGORIES whitelist; processGresham.js --requirements mode loads FY2023-FY2026 all_funds_requirements rows into treasury.budgets via treasury_sync_budget_tree RPC
- table-based extract_requirements() from Vol 1 All Funds page with multi-page continuation and reconciliation fallback, loading Portland all_funds_requirements for FY2022-FY2026 ($5.9B-$8.6B)
- Troutdale all_funds_requirements extracted from All Funds Combined PDF pages and loaded to DB for FY2019-FY2026 (8 years, 7 categories, FY2026 total $81.18M) via section-gate flip of extract_revenue()
- One-liner:
- LA FY2025 revenue corrected from $44.6B to $10.2B by nulling actual_amount_column in seedCaliforniaCities.js LA_REVENUE() and reloading both fiscal years via bulkLoadBudget.js
- LA Operating Budget seeder updated with enterprise-fund exclusion filter and fiscal_years expanded to FY2017-FY2026; all 10 years reloaded with clean approved totals and department-level category trees
- Guarded enrichment.description paragraph added to PlainLanguageSummary, surfacing 2-3 sentence context for the top operating category using zero new AI calls
- Fixed General Fund-only WHERE filter to load all-funds LA budget; FY2025 Money Out tile now shows $19.86B across all 10 fiscal years

---

---

## v1.4 Geographic Expansion (Shipped: 2026-05-22)

**Delivered:** First non-TX cities launched — Los Angeles, San Francisco, and San Diego operating + revenue budgets with per-capita display and enrichment, proving the generic Socrata + CSV pipelines scale to any US city.

**Phases completed:** 15–16 (8 plans total)

**Key accomplishments:**

- Los Angeles added as first non-TX city — operating budget FY2025 ($19.8B) and FY2026 ($21.4B) with 70 enriched categories and per-capita display
- San Francisco operating + revenue loaded (FY2025+FY2026, $15.9B each) via shared Socrata dataset with `where_extra` filter splitting spending/revenue types
- San Diego operating + revenue loaded (FY2025, $4.9B op/$5.5B rev) via new CSV pipeline handling fully double-quoted seshat.datasd.org format
- LA Revenue added ($10.2B FY2025+2026, Socrata `vvm4-a2zu`) — completing LA's financial picture
- `bulkLoadBudget.js` extended with `fiscal_year_type` and `where_extra` column_mapping keys — no breaking changes to existing TX city loads
- Enrichment for all 3 CA cities (SF: 53 rows, SD: 61 rows, LA: 70 rows); per-capita labeled "2024 Census estimate" for all

**Stats:** 2 phases, 8 plans; 1 day to ship (2026-05-22); 41 files changed, 6,003 insertions

**Archive:** [v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) | [v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)

---

## v1.3 Revenue Completion & Per-Capita Context (Shipped: 2026-05-22)

**Delivered:** Closed all deferred v1.2 data work — Prosper + Celina revenue, Richardson operating budget, enrichment for 5 Collin County cities, and TX population data with per-capita spending display.

**Phases completed:** 11–14 (9 plans total)

**Key accomplishments:**

- Population schema + TX Census 2024 vintage estimates loaded for all 12 TX cities; per-capita ($/resident) visible in app labeled with source year
- Prosper TX revenue loaded via pdftotext targeting "STATEMENT OF REVENUES" (FY2023–2025, all governmental funds)
- Celina TX revenue loaded (FY2025, validated against $129.6M ACFR total)
- Richardson operating budget loaded (FY2025+FY2026) via 4-format XLSX dispatcher across document generations
- Category enrichment completed for Garland, Wylie, Sachse, Murphy, Princeton

**Stats:** 4 phases, 9 plans; 1 day to ship (2026-05-22)

---

## v1.2 Collin County Completion & Data Quality (Shipped: 2026-05-21)

**Delivered:** Fixed PDF department attribution, loaded revenue data for 4 TX cities, and added 5 new Collin County cities via pdftotext parsers.

**Phases completed:** 8–10 (9 plans total)

**Key accomplishments:**

- PDF pipeline fixed: max_tokens 2048→8192 + cross-page section heading context eliminates "Unknown" department dominance and exit code 2 truncation
- Revenue data loaded for Plano (7 FYs), McKinney (5 FYs), Frisco, and Allen — 412+ revenue rows now visible in app
- 5 new Collin County cities added: Garland ($192.5M), Wylie ($69.6M), Sachse ($31.2M), Murphy ($19.8M), Princeton ($36.9M)
- Confirmed ACFR PDF limitation for revenue extraction — documented pdftotext path for Prosper/Celina
- Princeton MA/TX municipality duplicate resolved; cost discipline maintained (skipped ~$20 API spend for 0.1% marginal improvement)

**Stats:** 3 phases, 9 plans; 18 days (2026-05-03 → 2026-05-21); 13/16 requirements shipped

**Tech debt carried forward:** Prosper/Celina revenue (pdftotext path needed), Richardson operating budget (cor.net HTTP block)

**Archive:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 Texas Municipal Financial Transparency (Shipped: 2026-05-02)

**Delivered:** Citizens can view operating budget and transaction data for Dallas, Plano, McKinney, Frisco, Allen, Prosper, and Celina.

**Phases completed:** 5–7 (9 plans total)

**Key accomplishments:**

- Generic Socrata SODA loader for Dallas operating + revenue budgets (FY2025, FY2026)
- Generic XLSX pipeline for Plano, McKinney, Frisco check registers + McKinney payroll
- Claude Haiku vision PDF pipeline for Allen, Prosper, Celina ACFR budget extraction

---

## v1.0 GiveButter Real-Time Donation Feedback (Shipped: 2026-04-22)

**Delivered:** Donate button on financials.empowered.vote with GiveButter webhook → Supabase → animated live counter on return.

**Phases completed:** 1–4 (9 plans total)

**Key accomplishments:**

- GiveButter webhook → Supabase Edge Function → Postgres RPC atomic donation write
- Animated counter + visibilitychange refetch on donor return
- loadEVFinances.js source-tagging + webhook row deduplication

---

## Pre-GSD History (shipped before planning system)

### SSO Auth Integration

Empowered Vote SSO integration with Alpha landing page. Full read access for Inform/unauthenticated users.

### EV Financials Brand & Logo System

BRAND_BAR_COLORS map, logo tile config, contrast text logic, nonprofit-specific icicle/summary behaviors, annual report download link.

### Enrichment & Municipality Fixes

Category enrichment system, NULL municipality_id fix, Cambridge enrichment.

---

*GSD planning system initialized: 2026-04-21*
*Last updated: 2026-06-06 after v1.6 milestone*
