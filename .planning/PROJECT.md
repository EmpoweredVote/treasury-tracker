# Treasury Tracker / Empowered Vote Financials

## What This Is

A public-facing financial transparency platform for cities and nonprofits, deployed at treasurytracker.empowered.vote. It translates raw budget and transaction data into plain-language summaries, visual breakdowns, and searchable spending categories — making government and nonprofit finances accessible to everyday citizens.

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

## Current Milestone: v1.9 MA County-City Linking

**Goal:** Surface county context for all 351 MA municipalities — seed 14 county entities, link every city to its county, load budget data for the 5 active county governments, and show county breadcrumb + city panels in the live app.

**Target features:**
- 14 MA county rows seeded (entity_type='county', state='MA', Census population)
- All 351 MA cities linked via county_id FK (county_id column already exists)
- Budget data loaded for 5 active MA county governments (Barnstable, Bristol, Dukes, Nantucket, Norfolk)
- County breadcrumb chip on MA city pages (links to county page)
- CitiesInCountyPanel on MA county pages (available / coming soon)
- Per-capita display on county pages (county population + county budget)

### Active

- v1.9 started 2026-06-10 — requirements definition in progress

### Out of Scope

- Budget data for 9 dissolved MA counties (navigation-only: Berkshire, Dukes islands, Essex, Franklin, Hampden, Hampshire, Middlesex, Plymouth, Worcester)
- Real-time websocket subscriptions — redirect-driven flow is sufficient and simpler
- Multi-year per-capita trends — single vintage population creates false trends for fast-growing entities
- Enterprise fund audit across counties — complex scope; deferred

## Context

- Stack: React + TypeScript frontend, Supabase (Postgres + Edge Functions), Vite, Tailwind, deployed on Render
- EV financial data loaded via `scripts/loadEVFinances.js` from CSV exports
- Donation platforms: GiveButter (primary, lowest fees), Patreon (recurring), Benevity (workplace giving)
- GiveButter supports webhooks and custom return URLs after donation completion
- The webhook fires before the redirect, so DB should be updated by the time user lands back
- Currently covers: 14 TX cities (Dallas, Plano, McKinney, Frisco, Allen, Prosper, Celina, Richardson, Garland, Wylie, Sachse, Murphy, Princeton, Longview) + 12 CA cities (Los Angeles, San Francisco, San Diego, Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana) + LA County + 3 OR cities (Portland, Gresham, Troutdale) + 351 MA cities + Massachusetts (state)
- county_id FK on municipalities; 88 LA County cities linked; county breadcrumb chip on city pages; CitiesInCountyPanel on county pages
- MA: 351 cities with FY2002–2025 General Fund data (24 years), per-capita, universal enrichment (14 categories), real MA state budget

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

## Shipped

- ✅ **v1.8 Massachusetts All-Cities Financial Transparency** — 2026-06-10 — Phases 37-39 (MA DLS loader, 351 MA cities FY2002–2025, MA state budget, per-capita, universal enrichment)
- ✅ **v1.7 California State Budget + Deep Icicles** — 2026-06-09 — Phases 32-36 (CA state entity, CA state budget, 3-level icicle infrastructure, Portland/Dallas retrofit)
- ✅ **v1.6 California City Expansion** — 2026-06-06 — Phases 26-31 (Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana CA; Longview TX revenue; STATE_LABELS)
- ✅ **v1.5 Oregon Expansion** — 2026-06-04 — Phases 17-25 (Portland/Gresham/Troutdale OR, all-funds consistency, LA data quality, LA County + county-city linking)
- ✅ **v1.4 Geographic Expansion** — 2026-05-22 — Phases 15-16 (LA, SF, SD, LA Revenue)
- ✅ **v1.3 Revenue Completion & Per-Capita Context** — 2026-05-22 — Phases 11-14
- ✅ **v1.2 Collin County Completion & Data Quality** — 2026-05-21 — Phases 8-10
- ✅ **v1.1 Texas Municipal Financial Transparency** — 2026-05-02 — Phases 5-7
- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — 2026-04-22 — Phases 1-4

---
*Last updated: 2026-06-09 after v1.7 milestone archived, v1.8 started*
