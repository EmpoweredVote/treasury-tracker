# Phase 49: Historical Federal Data Backfill (FY1976–FY2024) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 49-historical-federal-data-backfill-fy1976-fy2024
**Areas discussed:** Tree depth across decades, Transition Quarter (1976), Money In (receipts) shape, Won't-reconcile years

---

## Tree Depth Across Decades

| Option | Description | Selected |
|--------|-------------|----------|
| Account-level for all years | Reuse FY2025's Function→Subfunction→Account for every year; most work; per-year reconciliation must pass | |
| Account-level where it ties, else func·subfunction | Try account-level per year; fall back to function·subfunction depth where a year won't reconcile; no gaps | ✓ |
| Function·subfunction only for all | Load only published Hist 3.2 / 4.1 levels; shallowest; every figure a published cell | |

**User's choice:** Account-level where it ties, else func·subfunction
**Notes:** Matches the v2.0 "deeper than 3 where data supports; clarity first" ground rule. Fallback years to carry a context-metric note recording reduced depth + reason.

---

## Transition Quarter (Jul–Sep 1976)

| Option | Description | Selected |
|--------|-------------|----------|
| Store as its own period, selectable later | Distinct period marker so Phase 50 can offer it as a labeled entry; Phase 51 explains it | ✓ |
| Store as data only, not selectable | Load + source but no YearSelector entry; surfaces only in Phase 51 notes | |
| Exclude entirely | Skip TQ; only full fiscal years | |

**User's choice:** Store as its own period, selectable later
**Notes:** Roadmap constraint — handle explicitly, don't fold into FY1976/FY1977. Exact schema representation (integer fiscal_year key vs. flag vs. sentinel) flagged as research item R-01 for the planner.

---

## Money In (Receipts by Source) Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Major sources, flat (Hist 2.1) | ~7 top buckets, each a direct Hist 2.1 cell; clarity-first; template for all 49 years | ✓ |
| Two levels where data supports | Major sources + second level under composites (Hist 2.4/2.5); more work; thinner old-year coverage | |
| You decide | Let planner pick based on what Hist 2.x provides cleanly | |

**User's choice:** Major sources, flat (Hist 2.1)
**Notes:** No federal receipts-by-source tree loader exists yet — built once here, applied per year. Becomes the deficit-strip template Phase 50 reads against.

---

## Won't-Reconcile Years

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered: account halts → fallback, year halts → disclose | Account won't tie → func·subfunction fallback; that won't tie → load with per-year disclosure of the gap; no year dropped | ✓ |
| Hard-halt the year, fix before continuing | Mirror FY2025 exactly; any year outside 0.5% halts; single stubborn year blocks gap-free coverage | |
| Load with disclosure, log for review | Always load best-available + disclosure; log over-tolerance years for Chris to spot-check | |

**User's choice:** Tiered: account halts → fallback, year halts → disclose
**Notes:** Unifies with the tree-depth decision — same fallback ladder governs depth and reconciliation. Keeps HIST-04 gap-free coverage; inverts FY2025's hard-halt deliberately so one stubborn historical year can't block the milestone.

---

## Claude's Discretion

- Reconciliation tolerance thresholds at each tier (anchored on FY2025's 0.5% / thousands-precision check).
- Whether to ship three separate parameterized loaders or one orchestrator iterating years.

## Deferred Ideas

- Two-level receipts breakdown (Hist 2.4/2.5) — set aside for clarity-first flat view; candidate future enhancement.
- Backfilling the always-sourced standard to city/state data — FUT-02, future milestone.
