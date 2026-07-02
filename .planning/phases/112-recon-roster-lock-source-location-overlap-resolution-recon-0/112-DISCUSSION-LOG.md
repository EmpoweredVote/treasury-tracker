# Phase 112: Recon — Roster Lock + Source Location + Overlap Resolution (RECON-09, RECON-10) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 112-recon-roster-lock-source-location-overlap-resolution-recon-0
**Areas discussed:** Substitution policy, Batch split rule, UT node overlap, Deliverable shape
**Mode note:** Chris did not respond within the interactive window (AFK). All four areas were resolved with **auto-selected best-judgment defaults**, each grounded in the Chris-approved v2.14 REQUIREMENTS.md text and the Phase 107 precedent, and flagged as overridable in CONTEXT.md before planning.

---

## Substitution policy

| Option | Description | Selected |
|--------|-------------|----------|
| Substitute from NASBO ranking (bounded) | RECON-09 text explicitly allows substitutions (rank correction / non-extractable ACFR); reach to next-largest un-upgraded NASBO state, one substitution round, documented reasons | ✓ (auto) |
| Float count down (v2.13 D-01) | No backfill past the named 10 candidates; tranche shrinks | |

**Choice:** Auto-selected the substitution reading — the v2.14 REQUIREMENTS.md wording ("substitutions allowed…") is newer and Chris-approved at milestone definition, deliberately superseding v2.13's no-backfill rule. Bounded to one substitution round; if a substitute also fails, count floats down. → D-01.

---

## Batch split rule

| Option | Description | Selected |
|--------|-------------|----------|
| Lock by GF size after re-ranking (107 D-03 carry) | Batch 1 = 5 largest (matches ACFR-21..25 = AZ/IN/CO/MO/KY), Batch 2 = rest; rebalance around survivors | ✓ (auto) |
| Rebalance by extraction difficulty | Group easy-extract states first regardless of size | |

**Choice:** Auto-selected the size-order carry — it matches the mapping already written into REQUIREMENTS.md's traceability table and the 107 precedent. → D-02.

---

## UT node overlap

| Option | Description | Selected |
|--------|-------------|----------|
| In-place upgrade default (MA/CA precedent) | If the UT state node carries custom-source rows, plan an in-place upgrade — no duplicate node; municipal Transparent-Utah data untouched | ✓ (auto) |
| Decide per-case at load time | Leave the policy open until Phase 114 | |

**Choice:** Auto-selected the in-place default — it is the only overlap pattern ever used (CA v1.7, MA v1.8-DLS) and RECON-10 names it as the precedent. Anything that doesn't fit the mold gets flagged as a load-phase decision rather than improvised. → D-03.

---

## Deliverable shape

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror Phase 107 shape | 112-RECON.md + 112-BATCH1-SOURCES.md + 112-BATCH2-SOURCES.md with per-state SOURCES maps, bookend ties, risk facts, gap logs, loader-template match | ✓ (auto) |
| New consolidated single-doc format | One combined recon doc | |

**Choice:** Auto-selected the 107 mirror — Phases 113/114 consume the same input contract 108/109 did. → D-04.

---

## Claude's Discretion

- Loader-template → per-state layout mapping (recon finding, not architecture)
- Exact `pdftotext` invocation per state/year
- Per-year URL pattern discovery within the ~15–20 min/state budget
- Doc sectioning within the D-04 shape

## Deferred Ideas

- ACFRX-03 final-tranche states (incl. any substituted-out candidates)
- Phase 115 deepening scope (pre-GASB-34 extractor territory — not tie-confirmed in 112)
- Frontend/UI work (incl. state-flag hero banners); SRCSTD-01; VOTES-01
- Todo `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction` reviewed, not folded (frontend-routing, out of scope — same disposition as Phase 107)
