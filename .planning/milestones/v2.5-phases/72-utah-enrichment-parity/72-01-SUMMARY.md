---
phase: 72-utah-enrichment-parity
plan: 01
status: complete
requirements: [UENR-01]
date: 2026-06-20
---

# Phase 72 Plan 01 — Summary: Utah Enrichment Parity

## Self-Check: PASSED (pending user live-app spot-check)

Authored standardized, bleed-safe, plain-language enrichment for every newly-loaded Utah
budget category (operating, revenue, salaries) inline at **$0**, reusing the Phase 61/66
pattern with a fresh Utah fund library + county-government concept set. Live-applied to
production and verified at the data level; the final human live-app bleed spot-check is
pending (Task 4 resume-signal).

## What was built

- **`data/utahEnrichment72.mjs`** — `UTAH_FUND_CONCEPTS` (33 governmental fund types, purpose+money-source voice), `UTAH_COUNTY_CONCEPTS` (9 county-gov departments), `UTAH_FUND_ROUTES` (fund keyword router incl. bond/CIP/CRA/CDA/EDA/SID patterns), `UTAH_FUND_TO_DEPT` (service funds reuse the CA library), `UTAH_DEPT_EXTRA_ROUTES` (county-dept routes tried ahead of CA rules). All universal + bleed-safe (no city names, no $).
- **`scripts/loadUtahEnrichment72.mjs`** — live-worklist loader: derives op/rev depth-0 (fund) + depth-1 (`fund|dept` composite) + salaries depth-0 (dept) keys for the 15 UT entities; resolves via fund/dept routers + fallbacks; **delete-then-insert** of universal (`municipality_id NULL`) rows; `$`-leak guard; deferred-tail counting.
- **`scripts/loadUtahEnrichment72.test.mjs`** — 12 offline resolver/bleed tests (all pass).

## Key decisions realized

- **D-72-01/02 (depth-0 + depth-1):** op/rev funds (depth-0) AND `fund|department` composites (depth-1) enriched. Utah op/rev has no populated depth-2 (verified) — this is the full tree.
- **D-72-03/04 (fresh fund library):** 33 fund concepts, citizen-first purpose+money-source voice. Fund routing: 550 routed to a fund concept, 134 reused CA service concepts, 26 via dept fallthrough, **77 (~10%) generic `general_fund`** for genuinely bespoke names (project areas like "outlets at traverse mountain", "liquor fund").
- **D-72-05/06 (reuse + county set):** CA `CONCEPTS`/`ROUTE_RULES` reused for overlapping depts; fresh county concepts for assessor/recorder/sheriff/surveyor/clerk-auditor/commission/justice-court/children's-justice-center.
- **D-72-07 (all-universal, bleed-safe):** every row `municipality_id NULL`; **0 `$`-leaks, 0 city-name leaks** across all 3,536 P72 rows.
- **D-72-08 (salary tail):** **124 single-city salary depts** matching only `general_dept` counted + deferred (left raw), per SC#3.
- **D-72-09 (depth-1 fallback written):** general_dept written at composites, deferred at salary depth-0.

## name_key / app-join confirmation (T-72-05)

Confirmed via `scripts/enrichCategories.js:382` that `name_key = parent_name|name` for child nodes else `name` — exactly `budget_categories.link_key` (depth-0 plain; depth-1 `fund|dept` composite). The app's two-tier join (city-scoped row first, then NULL universal) reads by that key, so the composite rows join correctly. Spot-confirmed: `general fund|human resources → Human Resources`, `general fund|legal → City Attorney`.

## Production result (verified)

- **4,476 universal `category_enrichment` rows total; 0 duplicates; 3,536 authored by Phase 72.**
- County collisions corrected: `assessor` Finance→**County Assessor**, `sheriff` Police→**County Sheriff**, `commission` IT→**Commission/Council** (single rows each).
- **Idempotent:** re-running `--apply` holds the count at 4,476 with 0 duplicates.
- **$0 spend** (no AI API path; inline authoring only).

## DEVIATION — duplicate-row incident + recovery (important)

The plan assumed the Phase 61/66 `upsert(onConflict: 'name_key,municipality_id')` was idempotent for universal rows. It is **not on this schema**: the unique index treats `NULL municipality_id` as **DISTINCT**, so `ON CONFLICT` never matches an existing universal row → the first live apply (and a county-fix re-apply) **inserted 172 duplicate name_keys**. Root causes: (1) NULLS DISTINCT, (2) a name_key in multiple buckets written twice, (3) stale CA county mappings skipped as "covered".

**Recovery:** reset all P72 universal rows to the 943-row pre-P72 baseline, then re-ran a fixed loader that (a) dedups rows by name_key, (b) **delete-then-inserts** universal rows, (c) force-overwrites county-office keys. Final state verified clean (0 duplicates, idempotent). This is a durable fix for any future universal-enrichment loader on this schema.

## Out-of-scope finding (pre-existing)

4 pre-existing universal rows (generated 2026-03-28: `parking meter`, `harbor and port enterprise fund`, `sewer enterprise fund`, `solid waste enterprise fund`) contain `$`-figures in their text. Not Phase 72 rows; flagged for a future bleed-safety cleanup of the original AI enrichment.

## Pending (Task 4 human checkpoint)

Live-app bleed-safety spot-check across ≥3 Utah entities (city + county) on treasurytracker.empowered.vote — confirm fund + department drill-downs show plain language, no cross-entity bleed, county offices read with county framing. Awaiting Chris's "approved".

## Files
- `data/utahEnrichment72.mjs` (new)
- `data/utah-enrichment-72.expanded.json` (new, mapping audit trail)
- `scripts/loadUtahEnrichment72.mjs` (new)
- `scripts/loadUtahEnrichment72.test.mjs` (new)
