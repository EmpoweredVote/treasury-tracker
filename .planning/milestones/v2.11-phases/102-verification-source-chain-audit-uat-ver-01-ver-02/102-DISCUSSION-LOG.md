# Phase 102: Verification + Source-Chain Audit + UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 102-verification-source-chain-audit-uat-ver-01-ver-02
**Areas discussed:** Re-derivation depth & tolerance, Stale data_source residue, Audit failure handling, UAT format & target

---

## Re-derivation depth & tolerance

| Option | Description | Selected |
|--------|-------------|----------|
| Newest FY + 1 bookend/state | Independently re-read newest displayed FY + one older bookend per state (8 statements); exact-to-printed-total, $10M rounding fallback | ✓ |
| Every loaded FY (all 4 states) | Exhaustively re-derive all ~26 loaded FY-statements | |
| Newest displayed FY only | Re-derive just the 4 default-displayed FYs | |

**User's choice:** Newest FY + bookend.
**Notes:** Chris first asked to discuss — concern was that connecting states to ACFR shouldn't yield shallow coverage forcing a full redo later. Clarified that (a) data is already loaded; re-derivation is only a loader-independent double-check, not a re-load; (b) current windows: NY/TX ~10yr, CA 6yr, FL 3yr (FL thin due to URL-stability floor at FY2022); (c) loaders are parameterized so deepening later is incremental (add URLs + re-run), not a rebuild. Chris then settled: "Newest FY + bookend is fine; keep v2.11 as-is, deepen FL later."

---

## Stale data_source residue

| Option | Description | Selected |
|--------|-------------|----------|
| Delete them | Extend cleanupStaleStateGFDataSources.mjs to remove the 0-row `*-gf-operating-nasbo` artifacts | ✓ |
| Leave, document as known-empty | Keep rows, annotate as intentionally-empty | |

**User's choice:** Delete them.
**Notes:** VER-01 requires the audit show 0 residue; deletion is guarded by the existing 0-live-rows assertion.

---

## Audit failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fix inline (gap-closure) | Hot-fix integrity defects (NULL/orphan/dup/out-of-window/missing basis label) and re-run audit to green | ✓ |
| Report-only + follow-up | List defects, fix in a later phase | |

**User's choice:** Fix inline (gap-closure).
**Notes:** Milestone-closing phase; escalate only defects needing a full re-load or scope change.

---

## UAT format & target

| Option | Description | Selected |
|--------|-------------|----------|
| I drive, you sign off — on prod | Claude-driven guided walkthrough of live production app, evidence captured, Chris signs off | ✓ |
| You drive on prod | Chris clicks through prod with a checklist | |
| Local dev vs prod API | Run UAT against local dev build | |

**User's choice:** I drive, you sign off — on prod.
**Notes:** Verify deploy propagated first; folds in the 4 phase-101-deferred browser-smoke items per node.

---

## Claude's Discretion

- Exact SQL/queries and report layout of the cohort audit script.
- How the independent PDF re-read is captured (must be loader-independent + reproducible).

## Deferred Ideas

- Deepen historical coverage — "State ACFR Long Tail" follow-up milestone (esp. FL pre-FY2022, CA pre-FY2020, NY pre-FY2015, TX FY2016). Keep v2.11 as-is.
- Flat-revenue-tree drill-down / enrichment-on-leaf-click — accepted limitation.
