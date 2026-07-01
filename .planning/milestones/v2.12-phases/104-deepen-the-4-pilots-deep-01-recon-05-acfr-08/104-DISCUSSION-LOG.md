# Phase 104: Deepen the 4 Pilots (DEEP-01, RECON-05, ACFR-08) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08
**Areas discussed:** CA depth, Mid-window hole policy, Per-FY tie standard

---

## CA depth: how far back

| Option | Description | Selected |
|--------|-------------|----------|
| Stop at FY2008 (clean) | Load FY2008–FY2019 (12 yrs) on the single clean `cafr{NN}web.pdf` pattern. Recon's recommended floor; symmetric with NY's 12 yrs; lower risk. | ✓ |
| Push to FY2002 (max depth) | Add FY2002–FY2007 too (18 yrs total) via variant per-year URL enumeration. More history, but old-layout + per-year-URL risk. | |
| FY2008 now, FY2002–07 if cheap | Default FY2008 floor; opportunistically extend if variant URLs enumerate quickly. Leaves final depth indeterminate. | |

**User's choice:** Stop at FY2008 (clean)
**Notes:** FY2002–FY2007 deferred as an optional future CA extension. Keeps the window high-confidence and NY/CA symmetric at 12 added years each.

---

## Mid-window hole policy

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + log gap | Drop only the problem FY, log it, keep loading the rest. Window may have a hole. Matches v2.11 "as-deep-as-clean" / 98 D-08; source chip + basis label keep it honest; max history retained. | ✓ |
| Contiguous from recent end | Stop the window at the first failure walking back from the recent end — no holes, but sacrifices all older years beyond the first bad one. | |
| Flag as blocker | Pause and surface each failing FY to Chris before deciding. Safest, but interrupts the inline load. | |

**User's choice:** Skip + log gap
**Notes:** Holes are acceptable given per-node source chip + basis label; gap log preserves auditability.

---

## Per-FY tie standard

| Option | Description | Selected |
|--------|-------------|----------|
| Exact, else skip+log | Line items must sum exactly to the printed GF column total; any drift fails the FY → skip+log. Maximally strict; consistent with v2.11 16/16 exact. No fudging. | ✓ |
| Tolerance w/ explained note | Allow tiny tolerance / a labeled rounding line and keep the FY, recording the residual. Retains more years; requires documenting each non-exact tie. | |

**User's choice:** Exact, else skip+log
**Notes:** Composes with the hole policy — an FY loads only on clean `-table` extract AND exact tie; failing either → skip+log. Phase 106 re-derives independently to audit.

---

## Claude's Discretion

- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l` bounds, light `-table` cleanup) — empirical at load, per the Phase 98 D-07/D-08 levers.
- Plan structure / batching (per-state vs combined) — a planning decision; the three states are independent.
- P2-clamp application across any negative-category year in the deepened range (not just FL FY2021).

## Deferred Ideas

- CA FY2002–FY2007 variant-naming extension — durably sourceable but not required this milestone; future optional deepening.
- FL pre-FY2021 history — not durably sourceable within the effort budget at the known path; deferred.
- PA + IL loads (Phase 105) and states beyond PA/IL (future milestone) — out of this phase.
