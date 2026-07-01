# Phase 108: ACFR Upgrade — Batch 1 (RECON-08, ACFR-09..13, ACFR-19, ACFR-20) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 108-acfr-upgrade-batch-1-recon-08-acfr-09-13-acfr-19-acfr-20
**Areas discussed:** History depth (per-state load window), Plan structure

> Note: Phase 107 recon was thorough enough that the roster, per-state source URLs, units, FY-ends, loader templates, NASBO-replace rule, MA in-place-upgrade + GA F-97-01 supersede, scope-relabel policy, P2-clamp anticipations, and URL variants were already locked and carried into CONTEXT.md without re-asking. Only two genuinely-open decisions were surfaced for discussion.

---

## History Depth (per-state load window)

| Option | Description | Selected |
|--------|-------------|----------|
| Full clean window | Load every state to its full recon-confirmed clean window — MA FY2001–2025 (25 yrs), NC FY2012–2025 (14 yrs), NJ/GA/MD full. Max history, largest transcription effort. Matches ROADMAP "as deep as ACFR cleanly extracts". | ✓ |
| Cap deep states to ~10 yr | Load NJ/GA/MD full; cap MA and NC to ~FY2015+, deferring older years (Phase-104-style effort cap). | |
| Recency floor only (~FY2020+) | Load all 5 to a shallow recent floor covering the NASBO-replace FYs + a few years. Smallest effort. | |

**User's choice:** Full clean window
**Notes:** Chris chose maximum historical depth over the Phase-104-style effort cap, accepting the larger hand-transcription effort (esp. MA 25 yrs). "Full window" is understood to mean *attempt* every year; any year failing its exact GF-column total-tie is dropped+logged (carried-forward D-03/D-04 mold), so a deep window may be non-contiguous — kept honest by the per-node basis label + source chip.

---

## Plan structure

| Option | Description | Selected |
|--------|-------------|----------|
| One plan per state | 5 plans (108-01..05). Atomic per-state checkpoints; failed/held state doesn't block others; resumable for the long transcription effort. | ✓ |
| You decide (planner's call) | Leave plan batching to the planner (Phase 104 treated this as Claude's discretion). | |
| One combined plan | All 5 states in a single plan. Fewer files; no intermediate cross-state checkpoints. | |

**User's choice:** One plan per state
**Notes:** Chosen given the uneven depth (4–25 yrs) and full-window effort — per-state atomic plans keep the long transcription resumable. Plan ordering left to planner discretion.

## Claude's Discretion

- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l` bounds, light `-table` cleanup).
- Ordering of the 5 per-state plans; whether revenue + spend are one plan-step or two per state.
- Final loader-template pick per state if the loader shape fits the other template better than recon's assignment.

## Deferred Ideas

- Pre-clean-window history for Batch-1 states (NJ pre-FY2020, NC pre-FY2012, GA pre-FY2021, MD pre-FY2022) — durability unverified; candidate for a future deepening pass.
- Batch-2 states TN/CT/WI/WA/MI — Phase 109 (out of this phase).
