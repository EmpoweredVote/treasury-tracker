# State General Fund Data — the 50/50-ACFR End State

**Status:** Complete — all 50 states on State-ACFR GAAP General-Fund data
**Recorded:** 2026-07-05 (Phase 123, NASBORT-01)
**Milestone:** v2.15 — State ACFR Long Tail (Final Tail + NASBO Retirement)

---

## 1. The end state — 50/50 on ACFR

Every one of the 50 U.S. states now has **State ACFR (Annual Comprehensive Financial
Report) GAAP General-Fund operating** data loaded (spending-by-function), verified live:

```
count(distinct state) with entity_type='state', dataset_type='operating',
data_source ILIKE '%ACFR%'  →  50
```

The high-traffic states (CA, TX, NY, FL, and others) additionally carry ACFR
**revenue-by-source** ("Money In"), not just spending-by-function.

This replaces the earlier **hybrid** model (LOCKED 2026-06-27, `94-01-SPIKE.md`): NASBO
State Expenditure Report data for ~49 states with per-state ACFR upgrades for high-traffic
states. Phases 118–121 loaded the last 21 NASBO-only states onto ACFR; Phase 122 deepened
CA/FL history. The hybrid is now fully resolved — ACFR is the source of record for all 50.

**Basis note:** ACFR General Fund is GAAP-basis actuals; the retired NASBO path was
*budgetary*-basis General Fund. Every node self-declares its basis in its `data_source`
label, so the two accepted fallbacks below remain honest and auditable.

---

## 2. The two accepted honest NASBO fallback nodes

Exactly **two** live state operating nodes still carry a NASBO `data_source`. Both are
years for which same-year ACFR does **not** exist, so neither displays NASBO where ACFR is
available (success criterion #2 — verified: for each, the NASBO row is the *only* operating
row for that state-year):

| State | FY | Reason kept as fallback | Superseded when |
|-------|----|--------------------------|-----------------|
| **NV** (Nevada) | **2024** | ACFR covers FY2019–2023; FY2024 ACFR not yet available (latest-year tail). | Nevada's FY2024 ACFR is published and loaded. |
| **KY** (Kentucky) | **2023** | ACFR covers FY2002–2025 **except** FY2023 (one-year hole; KY FY2023 revenue absent). | Kentucky's FY2023 ACFR is obtained and loaded. |

Both are **documented honest fallbacks**, not gaps to backfill this phase (LOCKED decision,
`123-CONTEXT.md`). They will be superseded naturally when their ACFR years become available
— no tracked backlog item is required.

Verification queries (read-only, 2026-07-05):
- NASBO operating rows across all states → exactly `KY 2023` and `NV 2024`.
- For NV FY2024 and KY FY2023, the NASBO row is the **only** operating row (no same-year ACFR).

---

## 3. NASBORT-01 — NASBO retired to fallback-only (not deleted)

The NASBO operating loader `scripts/loadStateGF.mjs` is **demoted to a dormant fallback**,
kept and available but no longer serving any node where ACFR exists. It was **retired, not
deleted** (REQUIREMENTS.md non-goal: *"Deleting the NASBO loader code → Retire to
fallback-only, not delete — keep it available as a documented fallback."*).

Two mechanisms enforce the retirement:

1. **Never-overwrite-ACFR guard (behavioral).** Before writing any state-FY operating node,
   `loadStateFY` reads the existing `treasury.budgets` row's `data_source` and calls the
   pure exported helper `isAcfrOccupied(existingDataSource)`:
   - `null`/empty → `false` (node absent → NASBO fallback may fill it),
   - matches `/NASBO/i` → `false` (node is itself NASBO → allow idempotent refresh),
   - otherwise → `true` (an ACFR/other source occupies the node → **skip**, protect it).

   When the guard returns `true`, the loader logs
   `SKIP <ST> FY<yr>: ACFR node present — NASBO retired to fallback-only` and returns
   **before** the ephemeral `data_sources` insert — so a skipped state-FY leaves **zero
   residue**. This makes an unfiltered `node scripts/loadStateGF.mjs` re-run a **safe
   no-op**: it overwrites 0 ACFR nodes and only refreshes the two NASBO fallbacks
   idempotently. The guard is unit-tested offline in `scripts/loadStateGF.test.mjs`.

2. **FALLBACK-ONLY relabel.** The loader's header docstring and its `main()` console banner
   are relabelled `[FALLBACK-ONLY]` (retired 2026-07-05), so anyone reading or running it
   sees its dormant status immediately.

**Why this matters:** before the guard, an unfiltered loader run would loop every NASBO
state and overwrite their FY2023/FY2024 **ACFR** operating nodes with budgetary-basis NASBO
data — a silent data regression. The guard makes that impossible.

---

## 4. Verification results (read-only, 2026-07-05)

| Check | Result |
|-------|--------|
| Distinct states with ACFR operating | **50** |
| Live operating nodes with NASBO `data_source` | **2** — NV FY2024, KY FY2023 |
| NV FY2024 / KY FY2023 have same-year ACFR operating? | **No** (NASBO row is the only operating row for each) |
| MS (ACFR-41) ACFR operating loaded? | **Yes** — FY2003–FY2024 |
| MT (ACFR-42) ACFR operating loaded? | **Yes** — FY2015–FY2025 |

No DB writes were performed — verification is read-only.

---

## 5. Hand-off

Phase 124 (VER-10, Chris live-app UAT) should confirm that no state node displays NASBO
where same-year ACFR exists — the two fallbacks (NV FY2024, KY FY2023) are the only NASBO
nodes and are the accepted ACFR-gap years.
