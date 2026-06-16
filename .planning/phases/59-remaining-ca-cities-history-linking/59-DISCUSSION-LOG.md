# Phase 59: Remaining CA Cities History + Linking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 59-remaining-ca-cities-history-linking
**Areas discussed:** History approach, SCO load scope, County link nodes, SF handling, Test record

---

## History approach (HIST-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-city by thinness | Layer SCO history beneath the THIN custom cities (+ basis note), leave richer ones custom-only. Mirrors Phase 58 (Long Beach/WeHo layered, LA left alone). | ✓ |
| Layer all uniformly | Layer SCO beneath ALL 10 cities + basis note. Simplest, but may add a seam to decent-data cities. | |
| Custom-only, no layering | Leave all custom-only (LA pattern); link + salaries/enrichment only, no history backfill. | |

**User's choice:** Per-city by thinness
**Notes:** Every city in scope is custom-source, so "reach FY2003" cannot overwrite — it layers beneath (D-04 precedent) or leaves custom-only (D-05 precedent). Thin candidates to layer: SF, Oakland, Fresno, Riverside, Bakersfield, San Diego, Berkeley. Richer candidates to potentially leave custom-only: San Jose, Fremont, Sacramento (planner applies Phase 58 thinness judgment).

---

## SCO load scope (expansion boundary)

| Option | Description | Selected |
|--------|-------------|----------|
| City-targeted only | Load only the specific named cities from SCO; no full-county loads. Honors v2.4 expansion deferral. | ✓ |
| Whole counties (expansion) | Run full SCO county loads (all member cities) — but that's county expansion, deferred to v2.4. | |
| City-targeted now, note the rest | City-targeted now + record full-county opportunity as v2.4 backlog. | |

**User's choice:** City-targeted only
**Notes:** Research flag — confirm `bulkLoadStateController.js` supports a city filter within `--county`, or add a post-fetch filter; do not load whole counties. Full-county expansion of the touched counties is still recorded as a v2.4 deferred idea in CONTEXT.md.

---

## County link nodes (ENR-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Linking-only nodes | Create Kern/Fresno/Riverside/Santa Clara/SF as entity-only nodes (no county budget), matching Alameda/Sac/SD precedent. | ✓ |
| Nodes + county budgets | Create nodes AND backfill each county-gov budget (LA/OC treatment). Larger scope, overlaps v2.4. | |

**User's choice:** Linking-only nodes
**Notes:** County-government budgets for these nodes deferred to v2.4.

---

## SF handling (city-county)

| Option | Description | Selected |
|--------|-------------|----------|
| Single city-county node | One combined "City and County of San Francisco" entity. Avoids self-nesting breadcrumb. | ✓ |
| Separate county + city | A "San Francisco County" node with SF city linked under it. Uniform shape but nests SF under SF. | |
| You decide / defer | Leave to planner against actual breadcrumb behavior. | |

**User's choice:** Single city-county node
**Notes:** Research flag — verify breadcrumb + Cities-in-County panel render a city==county case cleanly; document the final shape.

---

## Test record (data hygiene)

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | Remove the 'Test' record (after confirming no dependent rows). It was never a real city. | ✓ |
| Investigate first | Probe for FKs/references, delete only if orphaned. | |
| Document, don't delete | Leave in place, record as non-city to ignore. | |

**User's choice:** Delete it
**Notes:** Confirm no dependent budget/salary/link rows before deletion; fall back to documenting only if (unexpectedly) it has dependents.

---

## Claude's Discretion

- The exact "thin vs rich" threshold for the history approach (apply Phase 58 judgment).
- Per-`--fy` batching and dry-run-first sequencing per the runbook.
- The precise city-filter mechanism for the city-targeted SCO load.
- Confirmation of the expected city→county mapping (Bakersfield→Kern, Fresno→Fresno, Oakland→Alameda, Riverside→Riverside, San Jose→Santa Clara, SF→self).

## Deferred Ideas

- Full-county SCO expansion of every touched county (Kern, Fresno, Riverside, Santa Clara, Alameda, San Francisco, Sacramento, San Diego) → v2.4.
- County-government budget backfill for the new linking-only county nodes → v2.4.
- Salaries → Phase 60; enrichment → Phase 61; formal ACFR/audit/UAT → Phase 62.
