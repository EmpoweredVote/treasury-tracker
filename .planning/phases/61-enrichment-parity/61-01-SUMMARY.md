---
phase: 61-enrichment-parity
plan: "61-01"
title: "CA parity enrichment authored inline at $0 — op/rev full + common salary departments"
completed: "2026-06-16"
duration: "~1 session"
tasks_completed: 3
tasks_total: 3
files_created:
  - data/caParityEnrichment61.mjs
  - data/caParityEnrichment61_oprev.mjs
  - scripts/loadCAParityEnrichment61.mjs
  - data/ca-parity-enrichment-61.expanded.json
files_modified: []

subsystem: data-enrichment
tags: [california, category-enrichment, inline-zero-cost, universal, bleed-safe, hybrid-scoping, salaries, ENR-01]

dependency_graph:
  requires: [58, 59, 60]
  provides: [ENR-01]
  affects: [treasury.category_enrichment]

tech_stack:
  added: []
  patterns:
    - "Inline $0 enrichment (D-01): agent authors plain-language text directly; paid enrichCategories.js NOT run (ANTHROPIC_API_KEY absent)"
    - "Concept library + ordered keyword router collapses 447 messy salary dept-name variants onto ~60 generic concepts; deterministic, reviewable, bleed-safe"
    - "name_key-only join (dataset-independent): one universal row covers a category across operating/revenue/salaries for all CA cities"
    - "Committed data file + deterministic loader (per feedback memory); dry-run review gate before DB write; idempotent upsert on (name_key, municipality_id)"

metrics:
  api_cost_usd: 0
  gap_discovered_name_keys: 5754
  rows_authored: 528
  deferred_single_city_salaries: 5226
  op_coverage_pct: 100
  rev_coverage_pct: 100
  salaries_coverage_pct: 56.6
  bleed_leaks_real: 0
---

# Phase 61 Plan 01: CA Parity Enrichment authored inline at $0 — Summary

**One-liner:** Discovered the parity-load enrichment gap is **5,754 distinct uncovered name_keys** (not the ~13 OC-precedent assumed), gated the strategy with Chris, then authored **528 bleed-safe UNIVERSAL `category_enrichment` rows inline at $0** — covering 100% of the operating + revenue gap and every salary department shared by ≥2 cities — with the 5,226 single-city salary dept-name long tail documented as a deferred gap.

## Tasks Completed

| Task | Name | Status | Key Result |
|------|------|--------|------------|
| 61-01-01 | Gap-set + baseline + $0 decision (GATE) | Complete — APPROVED | Gap = 5,754 name_keys (op 85, rev 39, salaries 5,683); Chris chose: op/rev fully + salary depts ≥2 cities, document long tail; $0 inline confirmed |
| 61-01-02 | Author gap set inline + upsert | Complete | 528 universal rows authored ($0), idempotent upsert on (name_key, municipality_id); 0 $-leaks in authored text |
| 61-01-03 | Verify coverage + bleed-safety | Complete | op/rev 100% covered; 0 real bleed leaks (7 "California" flags are the state name; 4 $-style funds are pre-existing) |

## Decision Checkpoint (Task 1) — gate findings

The OC precedent (Phase 54) authored 13 rows. A read-only production probe found the CA parity gap is **~440× larger**:

| Dataset | Uncovered name_keys | Shape |
|---------|--------------------:|-------|
| Operating | 85 | 8 shared SCO functional categories (120–131 cities) + rarer |
| Revenue | 39 | 11 shared functional categories + rarer |
| Salaries | 5,683 | ~447 departments shared by ≥2 cities + **5,236 single-city** dept strings |

Even 502 universal rows (every ≥2-city name_key) covered only 49.5% of uncovered instances — the salaries single-city tail (messy publicpay source naming) cannot be collapsed by any frequency threshold. **Chris decision (2026-06-16):** author op/rev fully + salary departments shared by ≥2 cities inline at $0; document the single-city salary long tail as a known deferred gap (low value — "Police Department" is self-explanatory).

## What Was Built — 528 universal rows (municipality_id IS NULL, source='ai')

Authoring model (committed, reviewable, $0):
- **`data/caParityEnrichment61.mjs`** — ~60 generic, citizen-friendly, bleed-safe municipal **CONCEPTS** (police, fire, public works, water, parks, finance, city clerk, …).
- **`data/caParityEnrichment61_oprev.mjs`** — **EXPLICIT_ROWS** (65 exact-key rows: SCO operating functional groupings, enterprise funds, revenue categories) + an ordered **ROUTE_RULES** keyword router.
- **`scripts/loadCAParityEnrichment61.mjs`** — resolves each name_key (explicit → keyword-route → `general_dept` fallback), dedupes by name_key (the enrichment join is dataset-independent), self-checks for `$`-leaks, writes an audit JSON, and upserts only with `--apply`.

Resolution of the 528: **65 explicit**, **440 keyword-routed**, **3 exact-override**, **20 → 9 generic fallback** (ultra-rare 1–2 city oddities). Key insight exploited: enrichment is keyed by `name_key` **only**, so a universal "police" row covers police in operating, revenue, AND salaries for every CA city.

## Verification (Task 3 — read-only production probes)

- **Coverage:** operating **20,731/20,731 (100%)**, revenue **29,023/29,023 (100%)**, salaries **24,910/44,027 (56.6%)**. op/rev distinct uncovered name_keys = **0**.
- **Bleed-safety (D-04):** **0 genuine leaks** in the 528 authored rows. The verifier's 7 "city-name" flags all matched the token **"california"** (the *state* entity, appearing legitimately in generic text like "State of California"); the 4 `$`-figure flags are **pre-existing** Phase-54-era "$0 here"-style enterprise-fund universals, untouched by this phase. No CA *city* token appears in any authored universal.
- **Idempotency:** upsert on `(name_key, municipality_id)` — re-running writes the same rows, no duplicates.
- **$0 cost:** `ANTHROPIC_API_KEY` absent; `enrichCategories.js` never run; no billed API call.

## Requirements Satisfied

- **ENR-01** — every parity-loaded operating + revenue category, plus salary departments shared by ≥2 cities, carries standardized, bleed-safe, plain-language enrichment consistent with the OC/LA baseline, authored inline at $0. Hybrid scoping resolved to all-universal-where-generic (every authored row is a generic, inheritable universal; no city-specific text stored).

## Notes / Follow-ups

- **Deferred (documented gap):** 5,226 single-city salaries department name_keys (idiosyncratic publicpay source strings). Candidates for a future source-naming-canonicalization pass; low citizen value. Tracked for Phase 62 awareness / v2.4.
- The 528 universal rows are inherited by all current + future CA cities sharing each name_key — coverage compounds at no extra cost.
- 9 ultra-rare name_keys (e.g. `plng & blg agy`, `#n/a`, `chrp`) resolve to the generic `City Department` fallback (confidence: low) — honest and bleed-safe.
