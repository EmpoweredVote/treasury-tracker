# Phase 95: MN History + OH/VA Re-do - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03
**Areas discussed:** OH/VA sourcing path, OH/VA revenue handling, MN history depth

---

## OH/VA sourcing path

| Option | Description | Selected |
|--------|-------------|----------|
| ACFR upgrade (full, GAAP) | Real GAAP actuals, operating + revenue, matching MN; first "high-traffic ACFR upgrade" of the hybrid. Cost: ACFR extraction for 2 states. | ✓ |
| NASBO now (fast, operating-only) | Phase-94 NASBO loader; fast + cohort-consistent, but operating-only + budgetary basis. | |
| Hybrid: NASBO now + ACFR later | Stop false provenance now via NASBO, full ACFR upgrade later. | |

**User's choice:** ACFR upgrade (full, GAAP)
**Notes:** OH/VA are the highest-priority false-provenance nodes; Chris wants them done right (GAAP, both datasets), realizing the original requirement.

---

## MN history depth

| Option | Description | Selected |
|--------|-------------|----------|
| FY2021 + FY2022 only | Close the recent gap; lowest effort. | |
| Back to ~FY2016 | A decade; moderate effort. | |
| All the way to FY1997 | Full 28-year series; pre-GASB-34 format wall on the oldest years. | |
| **FY2008–2025 (modern GASB-34 era)** | Full comparable era, one extraction approach, "never come back" for apples-to-apples years; FY1997–2007 deferred. | ✓ |

**User's choice:** FY2008–2025 (refined option). Chris asked "how hard would [FY1997] be? Then we'd not need to come back" — prompting an evidence-based difficulty probe.
**Notes:** Probe of the on-hand PDFs found all years 1997–2025 have extractable text (no OCR wall), but **GASB 34 (~FY2002)** is the real divide: FY2008–2025 share the modern Governmental-Funds statement structure (verified FY2008 + FY2014); FY1997–2001 use a pre-GASB-34 "Combined Balance Sheet – All Fund Types" structure that doesn't map 1:1 to the modern taxonomy. Chris chose the full modern era (FY2008–2025) on that basis; FY1997–2007 deferred.

---

## OH/VA revenue handling

| Option | Description | Selected |
|--------|-------------|----------|
| Use ACFR for revenue too | Real GAAP revenue-by-source from the ACFR; keeps both datasets honest. | ✓ |
| Drop the revenue rows | Operating-only (like NASBO nodes). | |
| Decide later | Defer until source path settled. | |

**User's choice:** Use ACFR for revenue too
**Notes:** Moot-but-confirmed given the ACFR-upgrade choice above — revenue comes with the full ACFR treatment.

## Claude's Discretion
- Dedicated vs generalized ACFR loader for OH/VA (planner's call; MN per-FY SOURCES-map + RPC + post-RPC-stamp is the proven shape).
- Exact per-state GF category taxonomy (each ACFR's own line names, validated to published totals).

## Deferred Ideas
- MN FY1997–2007 (pre/early-GASB-34, different statement structure).
- Remaining ~46 states → Phase 96 (NASBO cohort).
- Cohort source-chain audit + UAT → Phase 97.
