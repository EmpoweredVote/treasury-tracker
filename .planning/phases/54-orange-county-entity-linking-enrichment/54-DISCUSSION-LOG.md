# Phase 54: Orange County Entity, Linking + Enrichment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 54-orange-county-entity-linking-enrichment
**Areas discussed:** Enrichment scope, Cost gate, Enrichment depth, Custom-city linking

---

## Enrichment scope (vs. shared CA SCO taxonomy + past bleed bug)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse LA baseline, fill gaps only | Reuse shared CA SCO enrichment; only enrich net-new OC categories; city-scope new records unless provably statewide-generic | ✓ (with inline twist) |
| Enrich each OC city independently | Run per city for all 34, municipality-scoped; safest from bleed but highest cost | |
| Universal taxonomy pass | Enrich shared names once as universal; cheapest but reintroduces bleed risk | |

**User's choice:** Option 1 — but asked: *"Are we able to do 1 and have you do the enrichment inline?"*
**Notes:** Resolved to D-01 — the agent authors the plain-language text itself inline (no billed Anthropic SDK calls) and writes the same `category_enrichment` rows directly. Reuse-LA-baseline + fill-gaps-only scope retained.

---

## Cost gate (if dry-run estimate exceeds ~$5)

| Option | Description | Selected |
|--------|-------------|----------|
| Stop and ask for approval | Halt, surface estimate, no spend over ~$5 without go-ahead | |
| Enrich a prioritized subset under $5 | Auto-proceed with highest-value subset under $5, defer rest | |
| Defer enrichment entirely this phase | Deliver OC-03/OC-05 only, split out OC-04 | |

**User's choice:** Free-text — *"Are you able to enrich without any money? We've had some surprising overages on API costs, and we are an unfunded nonprofit."*
**Notes:** Resolved to a $0 target via inline authoring (D-01). The gate becomes: STOP and ask before ANY paid API call. No paid run is planned.

---

## Enrichment depth (to match LA County baseline)

| Option | Description | Selected |
|--------|-------------|----------|
| Match whatever LA used | Inspect LA records, apply same depth/level | ✓ |
| Top-level categories only (--depth 1) | Lowest cost, less granular | |
| All category levels (--depth all) | Most detailed, most expensive | |

**User's choice:** Match whatever LA used.
**Notes:** D-04 — inspect LA's current (post-fix) `category_enrichment` records and mirror depth, field richness, and universal-vs-city-scoped placement.

---

## Custom-city linking (Anaheim & Santa Ana, OC-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-link if names match; reconcile if not | Standard link; reconcile a name mismatch so they attach, without touching budget data | ✓ |
| Verify-only, no name changes | Report mismatch as a gap rather than altering records | |

**User's choice:** Auto-link if names match; reconcile if not.
**Notes:** D-07 — OC-05 requires them linked; reconcile a blocking name mismatch without touching budget rows / data_source.

## Claude's Discretion

- Gap-detection `name_key` query mechanics; which fiscal year's categories to enrich (likely latest loaded, matching LA).
- Per-category universal-vs-city-scoped placement, bounded by the no-city-specifics-in-universals rule (D-05).
- Step 4 verification SQL/probe specifics.

## Deferred Ideas

- Richer/always-sourced enrichment backfill to other city/county data → future milestone.
- Statewide per-city salaries → Phase 55.
