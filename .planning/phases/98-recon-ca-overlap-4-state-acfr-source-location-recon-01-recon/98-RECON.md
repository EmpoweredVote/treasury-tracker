# Phase 98 — RECON: CA Overlap + 4-State ACFR Source Location

**Created:** 2026-06-29
**Status:** COMPLETE — 98-01 (CA recon + target), 98-02 (4 ACFRs located + bookend-extracted; detail in `98-ACFR-SOURCES.md`), 98-03 (loader-reuse + NASBO-replace plan) all done. Decision-ready handoff for Phases 99–100. One item awaits Chris: approve the CA upgrade target (+ note the TX scope change).
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

**Full detail: `98-ACFR-SOURCES.md`.** Summary:

- All four ACFR Governmental-Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (GENERAL/GENERAL-REVENUE column, GAAP) located; durable per-year URL patterns recorded.
- `pdftotext -table` (NOT `-layout`) extraction **tie-confirmed at both ends** of each state's window (CA FY2025 ties to the dollar; CA2020/TX2015/NY2015/FL2022 old-ends all extract clean GF columns).
- **Access is clean** — all four download over plain `curl` (no CDN/TLS block; the city-ACFR blocking in `ca-acfr-reconciliation.md` does NOT apply to state ACFRs).
- Confirmed clean windows: **CA FY2020–2025, TX FY2015–2024 (–FY2016), NY FY2015–2024 (millions), FL FY2022–2024.** Per-state independent, no NASBO floor.
- **Per-FY in-between extraction deferred to Phase 99's load** (bookend decision, Chris 2026-06-29) — recon proved both ends + recorded the URL pattern; Phase 99 extracts the middle years as it loads.

---

## Loader-Reuse + NASBO-Replace Plan (98-03)

### One uniform template pair fits all four states
All four target ACFRs use the **same** GAAP statement (Governmental Funds Stmt of Rev/Exp/Changes, GF column) — unlike the state-specific workbook layouts of OH/VA/MN. So the existing ACFR template pair generalizes directly:

| Side | Template to copy | Why it fits |
|------|------------------|-------------|
| **Operating (spending-by-function)** | `scripts/processMN.js` | Parses the EXPENDITURES section of this exact statement, GF column, GAAP/thousands, deepest multi-FY `SOURCES{url,date}` map (FY2008–2025) — the right shape for CA/TX/NY's deep windows. |
| **Revenue (revenue-by-source)** | `scripts/processOHRevenueAcfr.js` | Parses the REVENUES section of this exact statement, GF column, **with the P2 negative-investment-income clamp already built in** (needed — CA/NY have negative investment-income years). |

**Recommended build for Phase 99–100:** copy the MN+OH-revenue pair to a `process{XX}.js` + `process{XX}RevenueAcfr.js` per state (or one parameterized pair), configured per state with: the per-year `SOURCES` map (URLs from `98-ACFR-SOURCES.md`), the GF-statement page-finder, the GF column index, the fund-column label, and a **units multiplier**.

### Per-state config nuances (from 98-02)
- **NY** — statement is **in millions**; loader must scale ×1,000. 6-column statement, "General" is column 1.
- **TX** — fund column is **"General Revenue Fund"**, ~3× the NASBO GF magnitude (scope mismatch). Accept it as TX's GAAP GF-equivalent and relabel basis honestly; do NOT try to force it to NASBO's $50B scale.
- **CA** — "General" column; deep window FY2020–2025; soft-404 caution (filter by Content-Type, not HTTP status).
- **FL** — "General Fund" column; window FY2022–2024.

### NASBO-replace rule (sets up RECON-03 in Phase 99)
- **Operating:** the ACFR operating loader writes `dataset_type='operating'` keyed on `(municipality_id, fiscal_year, 'operating')` via `treasury_sync_budget_tree` — the **same key** the NASBO loader used, so the RPC **updates in place** → the NASBO FY row is *replaced* by the ACFR GAAP row (one basis per state-FY). Re-label `data_source` to the ACFR GAAP string + stamp `source_url`/`source_date` (per-year ACFR), mirroring `processMN.js`. Do **not** use `treasury_sync_city_budget` (not source-safe — `[[project_sync_city_budget_not_source_safe]]`).
- **Revenue:** `dataset_type='revenue'` is **new** on these nodes (no NASBO revenue exists) → pure insert; enables the "Money In" view (Phase 101).
- **No orphaned-NASBO-FY case:** every state's clean ACFR window fully covers the NASBO FY2023+FY2024 rows being replaced — so no FY loses coverage, the D-02 no-floor risk does **not** materialize for any of the four.
- **Idempotent:** re-run updates the same (muni,fy,dataset) rows → 0 net new rows.
- **Un-upgraded states untouched:** the per-state ACFR loaders only touch their own state node; `loadStateGF.mjs` (NASBO) stays the fallback for all other states.
- **Stale-metadata cleanup:** delete each upgraded state's legacy non-NASBO `data_sources` rows (CA `ca-lao-gf-operating` + `ca-dof-gf-revenue`; and the analogous `xx-gf-operating` + `xx-gf-revenue` rows on TX/NY/FL) — they point at zero budgets rows and would mislead. Create fresh `xx-acfr-*` data_sources for the GAAP rows.

---

## Open Risks / Unknowns for 99–100

1. **CA upgrade-target decision is Chris's to approve** before Phase 99 (recommendation: upgrade single node in place + delete stale metadata — see CA section).
2. **TX General-Revenue-Fund scope (~3× NASBO).** Confirm the basis-relabel approach with Chris; the TX node total will jump from ~$50B → ~$161B on upgrade. Honest + correct, but a visible change.
3. **Stale-`data_sources` cleanup applies to all four** targets, not just CA.
4. **Deeper history is optional, not blocking:** CA<FY2020 and FL<FY2022 exist only behind archive pages (no clean predictable URL); NY can extend below FY2015; TX FY2016 needs an alternate file-id. The confirmed windows are the as-deep-as-clean baseline; Phase 99 may extend if cheap.
5. **NY millions** scaling and **negative investment-income years** (P2 clamp) are the two extraction edge-cases the loaders must handle — both already covered by the OH-revenue template.
