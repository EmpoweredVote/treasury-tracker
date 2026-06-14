# Treasury Tracker / Empowered Vote Financials

## What This Is

A public-facing financial transparency platform for governments and nonprofits — cities, counties, states, and now the **US federal government** — deployed at treasurytracker.empowered.vote. It translates raw budget and transaction data into plain-language summaries, visual breakdowns, and searchable spending categories — making public finances accessible to everyday citizens. Federal data adds an always-sourced standard: every figure and explainer carries a link to its official record, and program-origin facts come structured from Congress.gov/GovInfo with zero model-memory claims.

## Core Value

Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

## Requirements

### Validated

- ✓ Budget visualization with icicle bars, category breakdowns, and spending percentages
- ✓ Plain-language narrative summaries (current year "is spending", past year "spent", current year with actuals "As of {month}, has spent")
- ✓ Year selector with FY switching
- ✓ Nonprofit vs. municipality display modes
- ✓ EV SSO auth integration with Inform/Alpha landing page
- ✓ Brand color system with logo tiles and contrast text logic
- ✓ Category enrichment with short descriptions
- ✓ Line item vendor descriptions (Read.AI, MindMeister, Figma, etc.)
- ✓ Annual Report PDF download (FY 2025, shown beside year selector)
- ✓ Linked transactions panel
- ✓ Budget search
- ✓ Dallas operating and revenue budget data loaded via Socrata SODA API — v1.1
- ✓ Generic `bulkLoadBudget.js` for any Socrata city's operating/revenue budgets — v1.1
- ✓ XLSX check register importer for Plano, McKinney, Frisco — v1.1
- ✓ PDF → Claude Haiku vision pipeline for ACFR budget extraction — v1.1
- ✓ Allen, Prosper, Celina budget data loaded via PDF pipeline — v1.1
- ✓ PDF pipeline "Unknown" department attribution fixed (max_tokens + cross-page section context) — v1.2
- ✓ Revenue data visible for Plano (FY2018–2024), McKinney (FY2021–2025), Frisco (FY2026), Allen (FY2026) — v1.2
- ✓ Garland, Wylie, Sachse, Murphy, Princeton operating budgets loaded via pdftotext parsers — v1.2
- ✓ Prosper TX revenue data loaded via pdftotext (FY2023, FY2024, FY2025) — v1.3
- ✓ Celina TX revenue data loaded via pdftotext (FY2025) — v1.3
- ✓ Richardson TX operating budget loaded (FY2025, FY2026) via 4-format XLSX dispatcher — v1.3
- ✓ Category enrichment for Garland, Wylie, Sachse, Murphy, Princeton — v1.3
- ✓ Population data loaded for all 12 TX cities (2024 Census vintage); per-capita ($/resident) visible in app — v1.3
- ✓ Los Angeles operating budget (FY2025+2026, $19.8B/$21.4B) with enrichment and per-capita — v1.4
- ✓ San Francisco operating + revenue (FY2025+2026, $15.9B each) with enrichment and per-capita — v1.4
- ✓ San Diego operating + revenue (FY2025, $4.9B op/$5.5B rev) with enrichment and per-capita — v1.4
- ✓ LA revenue budget (FY2025+2026, $10.2B) added — v1.4
- ✓ `bulkLoadBudget.js` extended with `fiscal_year_type` + `where_extra` for integer FY columns and multi-type datasets — v1.4
- ✓ Portland OR operating + revenue (FY2022–FY2026, 635,749 population, 41 enrichment rows) — v1.5
- ✓ Gresham OR operating + revenue (FY2023–FY2026, 111,507 population, 33 enrichment rows) — v1.5
- ✓ Troutdale OR operating + revenue (FY2019–FY2026, 15,749 population, 26 enrichment rows) — v1.5, Phase 22
- ✓ LA County accurate operating + revenue data (FY2021–FY2024) from CA State Controller county datasets — v1.5, Phase 25
- ✓ Self-referential `county_id` FK on municipalities; 88 LA County cities linked; county breadcrumb chip on city pages; CitiesInCountyPanel on county pages — v1.5, Phase 25
- ✓ Sacramento CA operating + revenue (FY2013–FY2026, 536K population, enriched) — v1.6, Phase 26
- ✓ Longview TX revenue enrichment fixed (2 corrupted names repaired, 36 enrichment rows added) — v1.6, Phase 27
- ✓ City picker STATE_LABELS verified: "California", "Texas", "Oregon" full names confirmed in live app — v1.6, Phase 27
- ✓ Oakland CA operating (FY2024–FY2025, GPF $807M–$834M/yr, 444K population, 26 enrichment rows) — v1.6, Phase 28
- ✓ San Jose CA operating (FY2021–FY2025, GF $1.69B–$1.82B, 997K population, 24 enrichment rows) — v1.6, Phase 28
- ✓ Long Beach CA operating + revenue (FY2022–FY2026, GF $634M–$773M, 451K population, 20 enrichment rows) — v1.6, Phase 29
- ✓ Bakersfield CA operating + revenue (FY2025–FY2026, GF $412M–$427M, 417K population, 25 enrichment rows) — v1.6, Phase 29
- ✓ Fresno CA operating (FY2020–FY2026, GF ~$483M, 550K population, 12 enrichment rows; revenue deferred) — v1.6, Phase 30
- ✓ Riverside CA operating (FY2023–FY2026 biennial, GF ~$1.45B/yr, 324K population, 18 enrichment rows; revenue deferred) — v1.6, Phase 30
- ✓ Anaheim CA operating + revenue (FY2025–FY2026, GF $491M–$530M, 344K population, 25 enrichment rows) — v1.6, Phase 31
- ✓ Santa Ana CA operating + revenue (FY2023–FY2026, GF $404M–$424M, 312K population, 26 enrichment rows) — v1.6, Phase 31
- ✓ 5 MA county operating budgets loaded via PDF extraction: Barnstable $24.75M FY25, Bristol $34.39M FY25, Dukes $2.02M FY24, Norfolk $37.82M FY26, Plymouth $11.87M FY25 — county pages show Money Out tab with per-capita — v1.9, Phase 41
- ✓ Federal entity (`entity_type='federal'`) + always-sourced schema (source_name/url/date columns, program_details table) — v2.0, Phase 43
- ✓ US FY2025 budget loaded both lenses (function 18→61→1,613 nodes = OMB Hist 1.1 exactly; agency 29 depts vs MTS T5), OMB 8.1 split, 64-yr history, FY2026 FYTD, debt $39.2T — every row sourced — v2.0, Phase 44
- ✓ Federal landing: proportional Mandatory/Discretionary/Net-Interest bands + deficit strip; function-default/agency-toggle drill; source chip on every figure; per-capita/per-taxpayer/%-of-total scales — v2.0, Phase 45
- ✓ 27 Tier-1 sourced explainers (fetched-text-only, citations displayed, $0 API); DoD failed-audit opacity flagged with GAO disclaimer — v2.0, Phase 46
- ✓ 15-program origins pilot — enabling bill/public law/sponsor/year/cosponsors from Congress.gov+GovInfo, every claim linked, zero LLM; foundational sponsor-boundary notes — v2.0, Phase 47
- ✓ Source-chain audit (225 rows / 61 URLs, 61/61 PASS) + Chris UAT sign-off; US pinned first on landing with flag tile — v2.0, Phase 48
- ✓ Federal history backfill FY1976–FY2024 — function/agency/revenue per year + per-year visual-vs-official disclosures, every row sourced (free OMB tables, $0) — v2.1, Phase 49
- ✓ Federal YearSelector wiring — FY1976–FY2025 + the FY1976 Transition Quarter selectable; bands/strip/lens trees switch per period — v2.1, Phase 50
- ✓ Source-chain durability (zero residue, audit FAIL 0) + sourced comparability notes (function/agency definition drift + the FY1976 Transition Quarter) rendered in-app with source chips; v2.1 UAT sign-off — v2.1, Phase 51

## Last Milestone: ✅ v2.1 Federal History — SHIPPED 2026-06-14 (Phases 49-51)

> Next milestone TBD — run `/gsd:new-milestone`. Candidates in "Future (deferred milestone candidates)" below.

**Goal:** Bring every available prior federal fiscal year (FY1976→FY2024) up to v2.0 detail — function lens, agency lens, and revenue-by-source — with a working YearSelector, every figure sourced.

**Target features:**
- Function-lens detail per year (OMB Hist 3.2, outlays by budget function) for all years back to FY1976
- Agency-lens detail per year (OMB Hist 4.1/5.1, outlays by agency) for the same span
- Revenue-by-source per year (OMB Hist 2.x receipts) completing Money In for each historical year
- Per-year visual-vs-official disclosures recomputed for each loaded year (the Phase 44 excluded-negatives pattern)
- Federal YearSelector wiring — make all backfilled years selectable in the app
- Comparability notes for function/agency definition drift across decades + the FY1976 Transition Quarter

**Free carryover (zero rework):** the 64-year headline history already lives in `federal_annual_summary`; explainers (name-keyed) and program origins (law-keyed) are year-independent. The real work is mechanical — iterate the Phase 44 OMB loader across prior years, recompute disclosures, load revenue per year, wire the YearSelector. Same free sources, every row sourced (v2.0 ground rules carry forward).

### Active

- [x] Federal historical backfill — FY1976→FY2024 function/agency detail + revenue-by-source + per-year disclosures + YearSelector wiring + comparability notes (v2.1 — **complete**, Phases 49–51; all 8 requirements verified, ready for milestone close)

### Future (deferred milestone candidates)

- [ ] Votes/amendments exploration hub (the eventual mission destination)
- [ ] Backfill the always-sourced standard to city/state data (now proven federally)

### Out of Scope (federal)

- **Paid APIs / data sources** — everything free (ground rule 1)
- **Unsourced LLM text from model memory** — hard ban (ground rule 3)
- **Deep icicles by default** — visualization chosen per data shape (ground rule 4)
- **Anything beyond official public record** — no personal info, no targeting (ground rule 6)
- **USAspending obligations as headline figures** — outlays canonical; obligations drill-down only, explicitly labeled

## Context

- Stack: React + TypeScript frontend, Supabase (Postgres + Edge Functions), Vite, Tailwind, deployed on Render
- EV financial data loaded via `scripts/loadEVFinances.js` from CSV exports
- Donation platforms: GiveButter (primary, lowest fees), Patreon (recurring), Benevity (workplace giving)
- GiveButter supports webhooks and custom return URLs after donation completion
- The webhook fires before the redirect, so DB should be updated by the time user lands back
- Currently covers: 14 TX cities (Dallas, Plano, McKinney, Frisco, Allen, Prosper, Celina, Richardson, Garland, Wylie, Sachse, Murphy, Princeton, Longview) + 12 CA cities (Los Angeles, San Francisco, San Diego, Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana) + LA County + 3 OR cities (Portland, Gresham, Troutdale) + 351 MA cities + Massachusetts (state)
- county_id FK on municipalities; 88 LA County cities linked; county breadcrumb chip on city pages; CitiesInCountyPanel on county pages
- MA: 351 cities with FY2002–2025 General Fund data (24 years), per-capita, universal enrichment (14 categories), real MA state budget
- **Federal:** United States entity (id `0098c405-65e1-426f-8e5f-0fcbe2a900c0`) live with FY2025 actuals (function + agency lenses), 64-yr OMB history, FY2026 FYTD strip, $39.2T debt; 27 sourced explainers + 15 program-origin records; always-sourced standard (source chips, official-record links). Backend in the separate **ev-accounts** repo (Render); data via `scripts/load*Federal*.js` + `loadProgramOrigins.js` using free APIs (Treasury Fiscal Data, OMB, MTS, Congress.gov/GovInfo via `DATA_GOV_API_KEY`)
- Federal data sources bot-wall caveats: congress.gov/bioguide/gao 403 non-browser clients (browser-verify); govinfo SPA returns 200 for any path (verify via api.govinfo.gov); CBO blocks entirely (manual download)

## Constraints

- **Platform**: Supabase Edge Functions for webhook receiver — already in stack
- **Deduplication**: CSV re-imports must not double-count webhook-written transactions
- **Scope**: GiveButter only for real-time; other platforms remain manual

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Redirect-driven (not websockets) | Simpler, no always-on subscription needed; webhook fires before redirect completes | ✓ Good |
| Supabase Edge Function as webhook receiver | Already in stack, no new infra | ✓ Good |
| GiveButter-only for v1 | Best webhook support; Patreon/Benevity less suitable | ✓ Good |
| Socrata SODA API for city budgets | Generic loader reusable for any Socrata city; no city-specific code | ✓ Good — proven across Dallas, LA, SF |
| pdftotext over Haiku vision for revenue sections | PDF structure too irregular for vision; pdftotext + regex targeting yields higher accuracy | ✓ Good |
| Path A population schema (add column to municipalities) | Zero frontend changes, one migration; multi-year history deferred to v2 | ✓ Good |
| 2024 Census vintage applied uniformly across all FYs | Single-year population; false trends would mislead for fast-growing cities | — Single vintage only |
| `where_extra` caller supplies leading AND | More flexible (allows OR, parentheses); matches column_mapping per-dataset contract | ✓ Good |
| `fiscal_year_type` defaults to 'string' | Backward-compatible; only 'integer' triggers unquoted WHERE branch | ✓ Good |
| SD FY2026 excluded (empty budget_cycle in source) | Source-driven gap; update fiscal_years when SD publishes FY2026 adopted data | — No code change needed |
| Bristol + Norfolk county budgets larger than ROADMAP estimates | ROADMAP estimated Bristol ~$9-14M and Norfolk ~$14-18M; both include Agricultural Schools — Bristol $34.4M, Norfolk $37.8M | ✓ Accurate data wins |
| Bristol/Dukes extracted via hardcoded values | Bristol PDF is scanned (no text layer); Dukes dot-leaders prevented reliable OCR parsing; hardcoded from verified sources | ✓ Good — accuracy over automation |
| Recon before roadmap for v2.0 | Pulled live samples from every federal source before writing phases — caught CBO/GAO bot-walls and the obligations-vs-outlays trap up front | ✓ Good — zero source surprises mid-build |
| FY2025 actuals as federal headline; FY2026 FYTD as a strip | Complete/final/sourced; partial-year proportions mislead | ✓ Good |
| Function lens default, agency behind toggle | "What it's for" is the citizen question; ~20 clean categories vs 800-row agency tree | ✓ Good |
| MTS/OMB outlays canonical; USAspending obligations drill-only | $3.3T gap; mixing would corrupt headline figures | ✓ Good |
| Explainers + origins authored/fetched, never from model memory | Always-sourced ground rule; inline authorship hit $0 API; origins need no LLM at all (pure structured fetch) | ✓ Good — $0 spend, fully auditable |
| govinfo existence via API, congress.gov via real browser | govinfo SPA 200s any path; congress.gov 403s non-browser clients — status checks alone would give false PASS/FAIL | ✓ Good — audit caught both |

## Shipped

- ✅ **v2.1 Federal History** — 2026-06-14 — Phases 49-51 (FY1976–FY2024 function/agency/revenue per year + per-year disclosures, federal YearSelector incl. the FY1976 Transition Quarter, sourced comparability notes + definition-drift, source-chain durability audit FAIL 0; $0 API spend; milestone audit passed 8/8)
- ✅ **v2.0 Federal Treasury Tracker** — 2026-06-13 — Phases 43-48 (US federal entity, FY2025 both lenses, first-split bands + deficit strip, 27 sourced explainers, 15-program origins pilot, source-chain audit 61/61 + UAT)
- ✅ **v1.9 MA County-City Linking** — 2026-06-11 — Phases 40-42 (14 MA counties seeded, 351 cities linked, 5 county budgets, county enrichment)
- ✅ **v1.8 Massachusetts All-Cities Financial Transparency** — 2026-06-10 — Phases 37-39 (MA DLS loader, 351 MA cities FY2002–2025, MA state budget, per-capita, universal enrichment)
- ✅ **v1.7 California State Budget + Deep Icicles** — 2026-06-09 — Phases 32-36 (CA state entity, CA state budget, 3-level icicle infrastructure, Portland/Dallas retrofit)
- ✅ **v1.6 California City Expansion** — 2026-06-06 — Phases 26-31 (Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana CA; Longview TX revenue; STATE_LABELS)
- ✅ **v1.5 Oregon Expansion** — 2026-06-04 — Phases 17-25 (Portland/Gresham/Troutdale OR, all-funds consistency, LA data quality, LA County + county-city linking)
- ✅ **v1.4 Geographic Expansion** — 2026-05-22 — Phases 15-16 (LA, SF, SD, LA Revenue)
- ✅ **v1.3 Revenue Completion & Per-Capita Context** — 2026-05-22 — Phases 11-14
- ✅ **v1.2 Collin County Completion & Data Quality** — 2026-05-21 — Phases 8-10
- ✅ **v1.1 Texas Municipal Financial Transparency** — 2026-05-02 — Phases 5-7
- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — 2026-04-22 — Phases 1-4

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-14 — v2.1 Federal History complete (Phases 49–51; all 8 requirements verified) — ready for `/gsd:complete-milestone`*
