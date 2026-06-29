# Phase 98 — RECON: CA Overlap + 4-State ACFR Source Location

**Created:** 2026-06-29
**Status:** In progress (98-01 CA section complete; 98-02/98-03 sections pending)
**Requirements:** RECON-01 (CA node + target), RECON-02 (4 ACFRs located + extracted), + loader-reuse plan
**Decision posture:** Recon documents + recommends; the CA upgrade-target decision is Chris's to approve before Phase 99 (CONTEXT D-04).

---

## CA Node Resolution (98-01) — RECON-01

### Live database evidence (read-only `execute_sql`, 2026-06-29)

**Entities.** There is exactly **ONE** California state entity and **no** separate "CA-state-budget" entity:

| entity | id | entity_type | note |
|--------|----|-----|------|
| California | `e1007bf5-bac9-4b1c-878e-f6834885f850` | `state` | the canonical CA state node |
| California City | `e51e00a3-…` | `city` | unrelated real city (Kern County, pop 11,111) — not a state-budget node |

**Budgets rows on the CA state node** — exactly two, both NASBO:

| dataset_type | FY | total_budget | data_source |
|---|---|---|---|
| operating | 2023 | $195.189B | NASBO SER — General Fund (FY2023 actual, **budgetary basis**) |
| operating | 2024 | $205.671B | NASBO SER — General Fund (FY2024 actual, budgetary basis) |

No `revenue` row exists → the "Money In" card is correctly disabled. `data_source_id` is `null` on both (the NASBO loader stamps provenance into `source_url`/`source_date`/`data_source` text per policy P4; the FK is intentionally left null — so FK-linkage counts are **not** a reliable orphan signal).

**data_sources on the CA state node** — three metadata rows, only one of which maps to live budgets rows:

| dataset_id | api_type | dataset_type | fiscal_years | live budgets rows? |
|---|---|---|---|---|
| `ca-gf-operating-nasbo` | nasbo-ser | operating | 2023, 2024 | ✅ yes (the 2 rows above) |
| `ca-lao-gf-operating` | xlsx_download (LAO Historical_Expenditures.xlsx) | operating | 2022–2026 | ❌ none — **stale v1.7 metadata** |
| `ca-dof-gf-revenue` | pdf_download (ebudget.ca.gov / DOF) | revenue | 2022–2026 | ❌ none — **stale v1.7 metadata** |

### What this means

The "v1.7 overlap" the milestone was de-risking **is not a live duplicate-node problem.** The v1.7 *California State Budget + Deep Icicles* data (LAO operating + DOF revenue, the deep trees) is **no longer present in `treasury.budgets`** — it was superseded during the v2.10 State GF Sourcing work (the unsourced-estimate cleanup + the NASBO operating load, which keys on `municipality_id + fiscal_year + dataset_type` and replaced the FY2023/24 operating rows). What survives from v1.7 is only **two dangling `data_sources` metadata rows** (`ca-lao-gf-operating`, `ca-dof-gf-revenue`) that point at zero budgets rows and would mislead a future reader.

Today the CA state node renders exactly like the other 46 NASBO states: operating-only, budgetary basis, 6 NASBO functions, disabled Money In.

### MA v1.8 dual-node check (CONTEXT D-05)

The **Massachusetts state node** (`fd6b008f-…`) holds the same two NASBO operating rows (FY2023 $34.287B, FY2024 $35.720B) and nothing else. v1.8 (*Massachusetts All-Cities*) was **city-level**, not a state-budget load — so the MA **state** node has **no** dual-node overlap to resolve. **Verdict: MA does NOT have the CA-style pattern at the state node.** (MA is out of scope for v2.11 regardless — flag-for-future only.)

> Side-note surfaced during the probe: TX, NY, and FL each *also* carry the same trio of `data_sources` metadata rows (`xx-gf-operating`, `xx-gf-operating-nasbo`, `xx-gf-revenue`) with only the NASBO one backed by live budgets rows. So the stale-metadata cleanup below is not CA-specific — it applies to all four upgrade targets. Recorded here; handled in the loader-reuse plan (98-03).

### ▶ Recommended upgrade target (ONE — for Chris to approve)

**Upgrade the existing single California state node (`e1007bf5`) in place.** There is no duplicate entity and nothing to reconcile between two live nodes — the earlier concern is resolved by the data itself.

Concrete steps for Phase 99:
1. **Add** ACFR GAAP rows to the CA state node: `revenue` (revenue-by-source) + `operating` (spending-by-function), as deep as the ACFR cleanly extracts (per-state-independent window, no NASBO floor — CONTEXT D-01/02/03).
2. **Replace** the two NASBO operating rows for any FY the ACFR covers (one basis per state-FY → GAAP wins where ACFR exists); leave NASBO operating in place only for FYs the ACFR window does not reach (the no-floor case — document the disposition; see 98-03).
3. **Delete the two stale v1.7 `data_sources`** (`ca-lao-gf-operating`, `ca-dof-gf-revenue`) so the node's metadata matches its data. Create a fresh `ca-acfr-*` data_source for the GAAP rows.
4. CA revenue source of record = the **ACFR** (GAAP), not the v1.7 DOF/ebudget figures.

**Runner-up (not recommended):** keep the stale LAO/DOF `data_sources` and only add ACFR rows — rejected because dangling metadata pointing at no data is exactly the kind of confusion this milestone removes.

**Decision owner:** Chris approves (or picks the runner-up) before Phase 99 begins.

---

## ACFR Source Location (98-02) — RECON-02

_Pending — see `98-ACFR-SOURCES.md` (per-state located statement, GENERAL FUND column, GAAP/thousands, durable URL, clean FY window, divergence-from-NASBO, gap log, access quirks). This section will summarize/link that doc._

---

## Loader-Reuse + NASBO-Replace Plan (98-03)

_Pending — per-state mapping to the closest `process*Acfr.js` template + the NASBO-replace rule (delete NASBO state-FY operating rows → insert ACFR operating+revenue, one basis per state-FY, idempotent never-overwrite, un-upgraded states untouched) + the stale-data_source cleanup noted above._

---

## Open Risks / Unknowns for 99–100

_Pending (filled in 98-03)._ Seeded so far:
- The stale-`data_sources` cleanup applies to **all four** upgrade targets (CA/TX/NY/FL each have a non-NASBO `xx-gf-operating` + `xx-gf-revenue` metadata row with no live budgets rows).
- The pending CA upgrade-target decision (above) is Chris's to approve before Phase 99.
