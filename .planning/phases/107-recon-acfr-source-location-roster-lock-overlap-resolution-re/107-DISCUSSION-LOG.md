# Phase 107: Recon — ACFR Source Location + Roster Lock + Overlap Resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
**Areas discussed:** Roster fill policy, Minimum window depth, Batch split, Recon effort budget

---

## Roster Fill Policy (D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Ship what survives (no backfill) | If >2 fail, lock a smaller tranche (count floats down), defer rest to ACFRX-02 | ✓ |
| Backfill to hold 8–10 | Reach down to next-largest NASBO states to keep count at 8–10 | |
| Ship what survives, log a backfill list | Lock survivors + record ranked backfill for a warm-start follow-up tranche | |

**User's choice:** Ship what survives (no backfill).
**Notes:** Roster stays to the vetted named-10 candidates only. No scope stretch into un-vetted next-largest NASBO states; failures beyond the ≤2 allowance go to ACFRX-02.

---

## Minimum Window Depth (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Any window clearing the recency floor counts | Even a shallow FY2023–2025 window makes a state "in"; deferred only on total extraction failure or recency-floor miss | ✓ |
| Require a minimum depth (~4–5 FYs) | Thinner windows deferred to ACFRX-02; favors deep history over breadth | |

**User's choice:** Any window clearing the recency floor counts.
**Notes:** No FY-depth floor beyond the D-07 recency requirement (FY2023+FY2024). Deep history is ACFRX-02's job; maximize coverage now.

---

## Batch Split (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Lock split, balance extraction difficulty | Recon assigns ~5/~5 mixing clean + fiddly states to balance the two parallel load phases | |
| Lock split by GF size (roadmap's proposed order) | Keep NJ/MA/NC/GA/MD vs TN/CT/WI/WA/MI (largest-first) | ✓ |
| Leave assignment to the load phases | Recon locks roster only; 108/109 self-assign from the pool | |

**User's choice:** Lock split by GF size (roadmap's proposed order).
**Notes:** Batch 1 (Phase 108) = NJ/MA/NC/GA/MD; Batch 2 (Phase 109) = TN/CT/WI/WA/MI. Survivors keep their size-order slot if the roster shrinks per D-01.

---

## Recon Effort Budget (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep ~15–20 min/state (reaffirm v2.12 D-01) | Same bounded per-state URL dig; log + move on if no durable URL surfaces | ✓ |
| Tighter per-state cap (~10 min) | Trim the dig given 10 states; favor recency-window + bookends fast | |
| Prioritize breadth over depth per state | Just confirm recency-floor window ties + durable URL pattern; punt deep history | |

**User's choice:** Keep ~15–20 min/state (reaffirm v2.12 D-01).
**Notes:** Aggregate is larger only because there are more states; per-state discipline unchanged.

---

## Claude's Discretion

- Loader-template → per-state mapping (which existing `process*Acfr.js` family fits each state's GF-statement layout) — derived from actual ACFR layouts; milestone locks the clone-the-PA/IL-template approach.
- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l`, light `-table` cleanup) — recon determines empirically.
- Per-year URL pattern discovery on each state's ACFR/archive page — within the D-04 budget.
- Recon doc file naming/structure (`107-ACFR-SOURCES.md` + gap log) — follow Phase 98/103 shape.

## Deferred Ideas

- States beyond the locked tranche + any failed candidates → ACFRX-02.
- Deeper history on the existing 9 ACFR nodes → out of scope (breadth, not depth).
- SRCSTD-01 (federal always-sourced standard backfill), VOTES-01 (votes/amendments hub) → future.
- Frontend / UI work → out of scope (Money In + `?dataset=revenue` are data-driven).
- Reviewed-not-folded todo: `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction` (frontend-routing, out of scope for a recon doc).
