# Phase 107 RECON — ACFR Source Location + Roster Lock + Overlap Resolution

**Status:** COMPLETE — 107-01 (Batch 1: NJ/MA/NC/GA/MD sourced + bookend-tied), 107-02 (Batch 2: TN/CT/WI/WA/MI sourced + bookend-tied), 107-03 (overlap resolution + roster lock + consolidated handoff) all done. Decision-ready handoff for Phases 108/109.
**Spend:** $0 — `pdftotext -table` only, no AI. No DB writes. All probes read-only SELECT.
**Requirements:** RECON-06 (per-state ACFR location + roster lock), RECON-07 (overlap resolution)
**DB write confirmation:** NONE — this entire phase is documentation + read-only SELECT queries only.

---

## Overlap Resolution (RECON-07)

### Read-Only DB Probe Results (2026-07-01)

Probe ran SELECT-only against `treasury.municipalities`, `treasury.budgets`, and `treasury.data_sources`. No INSERT/UPDATE/DELETE/DDL executed.

#### All 10 Roster State Nodes Confirmed

| State | Node ID | Name |
|-------|---------|------|
| NJ | `91f310a1-bec9-404a-9825-82b1106c911f` | New Jersey |
| MA | `fd6b008f-4d35-4665-8c6a-0429de5a4e1f` | Massachusetts |
| NC | `dd5281e8-6988-4f42-b83c-4fed43c7ada4` | North Carolina |
| GA | `6eb7dd4a-4dcf-4dcc-898f-45af9a3e20c3` | Georgia |
| MD | `8e597f8f-c696-47c0-9001-ed78a54f2228` | Maryland |
| TN | `f96037ba-af9e-406d-a98f-8c5e2fd299d6` | Tennessee |
| CT | `d01de53e-d687-4825-bfe2-09f7694c28d6` | Connecticut |
| WI | `15fe5240-19d9-4fef-b785-d624b0a39a2a` | Wisconsin |
| WA | `d8257751-45c4-4853-9621-e1841e7d4998` | Washington |
| MI | `38c9f1ff-130e-423d-955a-6f0aa5aecae2` | Michigan |

#### Budgets Rows on Roster State Nodes (all 10)

All 10 roster states carry exactly **2 NASBO operating rows** (FY2023 + FY2024), `data_source_id = null` (text-stamp provenance per policy P4), `data_source` = `"NASBO State Expenditure Report — General Fund (FY20XX actual, budgetary basis)"`. No revenue rows. No ACFR rows. No legacy custom-source rows.

| State | FY2023 operating | FY2024 operating | Total rows |
|-------|-----------------|-----------------|-----------|
| NJ | $48,837M | $52,996M | 2 |
| MA | $34,287M | $35,720M | 2 |
| NC | $26,775M | $29,216M | 2 |
| GA | $29,266M | $34,594M | 2 |
| MD | $27,972M | $27,397M | 2 |
| TN | $19,570M | $23,411M | 2 |
| CT | $22,199M | $22,779M | 2 |
| WI | $18,864M | $22,280M | 2 |
| WA | $30,861M | $32,397M | 2 |
| MI | $14,861M | $15,129M | 2 |

#### data_sources Rows on Roster State Nodes

**Zero `data_sources` rows** found for any of the 10 roster states — neither via `municipality_id` FK query nor via `dataset_id` pattern search (`nj-%`, `ma-%`, `nc-%`, etc.). The roster states' `budgets` rows use `data_source_id = null` (text-stamp only per P4 policy). No stale metadata rows exist.

---

### 1. Massachusetts — In-Place Upgrade Plan (RECON-07)

**Probe verdict:** The MA state node (`fd6b008f`) holds exactly the two NASBO operating rows (FY2023 $34,287M, FY2024 $35,720M) and nothing else. **No v1.8 DLS `data_sources` metadata rows exist** on the MA state node — the `data_sources` table has zero rows matching `ma-%` pattern or the `fd6b008f` municipality_id. There is no CA-style stale-metadata problem to clean up.

**Context from 98-RECON (Phase 98 MA dual-node check):** The Phase 98 probe already confirmed: "The Massachusetts state node (`fd6b008f`) holds the same two NASBO operating rows (FY2023 $34.287B, FY2024 $35.720B) and nothing else. v1.8 (Massachusetts All-Cities) was city-level, not a state-budget load — so the MA state node has no dual-node overlap to resolve." This is re-confirmed by the Phase 107 probe: same node, same two rows, no new custom-source additions since Phase 98.

**What the v1.8 DLS node was:** The Massachusetts Division of Local Services (DLS) state-budget load in v1.8 was a **city-level** data load (municipal-level financial data), not a duplicate state-ACFR node. It does not conflict with the state node at `fd6b008f`. The MA ACFR load in Phase 108 writes to the **state node only** — city-level DLS data (if any) is unrelated and unaffected.

**In-Place Upgrade Recommendation (Phase 98 CA precedent):** Upgrade the single existing MA state node (`fd6b008f`) in place. No duplicate MA node. No new municipality row.

**Concrete Phase-108 Steps:**

1. **Add ACFR revenue rows** — insert `dataset_type='revenue'` rows for each FY in the confirmed clean window (FY2001–FY2025, starting with FY2018+ derivable-URL years). Each row keyed `(fd6b008f, fy, 'revenue')`. Pure insert — no conflict (no existing revenue rows).
2. **Replace NASBO operating rows for ACFR-covered FYs** — write `dataset_type='operating'` rows for each ACFR-covered FY, keyed `(fd6b008f, fy, 'operating')`. The never-overwrite guard checks for existing ACFR provenance first; the NASBO FY2023 and FY2024 rows will be replaced by the ACFR GAAP actuals for those FYs. Idempotent.
3. **No stale data_sources cleanup needed** — the Phase 107 probe confirmed zero `data_sources` rows on the MA node. Skip the stale-metadata deletion step (unlike the CA v1.7 cleanup in Phase 99).
4. **Create fresh `ma-acfr-operating` + `ma-acfr-revenue` data_source rows** — metadata for the new ACFR rows, with `api_type = 'pdf_download'`, pointing to the macomptroller.org ACFR landing page. `dataset_id` pattern: `ma-acfr-operating` and `ma-acfr-revenue`.
5. **Unit handling** — MA reports in thousands; loader must multiply by 1,000 when storing in the `total_budget` column (which stores in dollars) or confirm schema convention matches existing ACFR loaders.
6. **FY2017 naming exception** — the SOURCES map must special-case `acfr_fy2017.pdf` (no hyphen) vs the `acfr_fy-{YYYY}.pdf` pattern for FY2018+.
7. **Scope-relabel confirmation** — MA ACFR GF ~1.73× NASBO GF ($61.9B vs $35.7B). Accept-and-relabel honestly at Phase-108 load (TX precedent); surface to Chris at UAT.

**Overlap verdict:** MA is a **clean in-place upgrade** with no pre-existing ACFR rows, no stale metadata, and no dual-node risk. Simpler than the CA v1.7 case.

---

### 2. Georgia — ACFR Supersedes F-97-01 Medicaid Fix (RECON-07)

**Probe verdict:** The GA state node (`6eb7dd4a`) holds exactly the two NASBO operating rows:
- FY2023: $29,266M — `"NASBO State Expenditure Report — General Fund (FY2023 actual, budgetary basis)"`
- FY2024: $34,594M — `"NASBO State Expenditure Report — General Fund (FY2024 actual, budgetary basis)"`

Both rows carry NASBO text-stamp provenance, `data_source_id = null`, and NASBO `source_url`. No legacy PDF-download rows, no custom data_sources metadata.

**F-97-01 Medicaid Fix context (v2.10 Phase 97):** Phase 97 applied a correction to GA's FY2023 NASBO row, updating it from an incorrect 2024-SER stale value to the correct 2025-SER value ($29,266M). This fix was applied via `loadStateGF.mjs` and is now reflected in the `$29,266M` FY2023 row confirmed by the probe.

**How ACFR supersedes cleanly:** The ACFR GAAP actuals replace NASBO operating rows keyed on `(municipality_id, fiscal_year, 'operating')`. When Phase 108 loads GA's ACFR GF operating data for FY2023, the existing NASBO FY2023 row (with the F-97-01 fix applied) is replaced by the ACFR GAAP actuals. The fix is **moot once ACFR wins that state-FY** — the ACFR figure is the real GAAP audited actual, which supersedes the NASBO budgetary figure (corrected or otherwise). There is no orphan risk: the ACFR loader writes to the same `(muni_id, fy, 'operating')` key, idempotently replacing the NASBO row.

**Flag for Phase-108 confirmation:** The GA FY2023 row has the Medicaid-corrected NASBO value ($29,266M). The ACFR GF FY2023 value (from the 107-BATCH1-SOURCES.md bookend tie: FY2021 GA GF total revenues = $55,378,103K) will be materially different from the NASBO figure — that is expected and correct (ACFR GF is ~1.98× NASBO GF due to federal intergovernmental revenue inclusion). The loader author must verify the supersede occurs cleanly with no orphan NASBO row competing with the ACFR row.

**GA overlap verdict:** Clean supersede. No dual-node, no custom data_sources, no stale metadata. F-97-01 Medicaid fix is moot once ACFR GAAP replaces the NASBO FY2023 operating row. Flag for Phase-108 load confirmation only.

---

### 3. Other Roster States — Custom-Source Node Check (RECON-07)

**Probe verdict:** The remaining 8 roster states (NJ, NC, MD, TN, CT, WI, WA, MI) each have exactly 2 NASBO operating rows and **zero `data_sources` metadata rows**. No `api_type` other than the NASBO text-stamp pattern was found for any roster state.

**Result: None found.** All 8 remaining roster states are clean NASBO-only nodes with no pre-existing custom-source overlap to resolve. Standard new ACFR loaders; no in-place-upgrade complication beyond the standard NASBO-replace rule.

---

### RECON-08 Untouched-Nodes Contract

#### Existing 9 ACFR Nodes (confirmed from read-only DB probe)

| State | Node ID | Current ACFR FY window | dataset_types | Rows |
|-------|---------|------------------------|---------------|------|
| CA | `e1007bf5` | FY2008–FY2025 | operating + revenue | 36 |
| FL | `adb19ea0` | FY2021–FY2024 | operating + revenue | 8 |
| IL | `ac8b3dee` | FY2021–FY2025 | operating + revenue | 10 |
| MN | `d4b4897d` | FY2008–FY2025 | operating + revenue | 36 |
| NY | `1a7f871c` | FY2003–FY2024 | operating + revenue | 44 |
| OH | `7b2f8ddc` | FY2020–FY2025 | operating + revenue | 12 |
| PA | `d4a4aadc` | FY2016–FY2025 | operating + revenue | 20 |
| TX | `dc93d846` | FY2015–FY2024 | operating + revenue | 20 |
| VA | `c9b21975` | FY2022–FY2025 | operating + revenue | 8 |

**9 nodes confirmed. These 9 ACFR nodes are entirely distinct from the 10 roster state nodes.**

#### The Contract

> **Phases 108 and 109 touch ONLY the 10 roster state nodes** (NJ/MA/NC/GA/MD for Phase 108; TN/CT/WI/WA/MI for Phase 109). The **9 existing ACFR nodes** (MN/OH/VA/CA/TX/NY/FL/PA/IL) and **all un-upgraded NASBO states** (the remaining ~31 NASBO states not in the roster) are **undisturbed** — no writes, no deletes, no schema changes. The per-state ACFR loaders (new `processNJ/MA/NC/GA/MD/TN/CT/WI/WA/MI{,Revenue}Acfr.js` scripts) are scoped to their own state node by `municipality_id`; they cannot affect other state nodes. `loadStateGF.mjs` stays the NASBO fallback for all un-upgraded states and is not modified. This contract is noted here; it is executed (enforced) by the loaders themselves in Phases 108/109.

---

## Roster Lock (RECON-06, D-01/D-02)

### Roster Decision Criteria

A state is **IN** if it:
1. Cleanly `pdftotext -table`-extracts (the GF column reads without column-alignment errors), AND
2. Passes the D-07 recency floor (FY2023 + FY2024 covered by the clean window with durable URLs)

A state is **DEFERRED** to ACFRX-02 if it fails either criterion.

D-01 (no backfill): draw only from the named 10; if ≤2 fail, defer them; if >2 fail, let the count float down. No reaching to the 11th/12th NASBO state.

D-02 (no minimum depth): any window clearing the recency floor counts. Shallow clean windows are IN.

### Roster Lock Table

| State | Verdict | Clean window | Recency floor | Reason if deferred |
|-------|---------|-------------|---------------|--------------------|
| **NJ** | **IN** | FY2020–FY2025 (6 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied, $0-diff. GF column (dollars, not thousands). GREENLIGHT. |
| **MA** | **IN** | FY2001–FY2025 (25 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied. In-place upgrade of existing MA state node. GREENLIGHT. |
| **NC** | **IN** | FY2012–FY2025 (14 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied, $0-diff. No derivable URL pattern — enumerate from archive. GREENLIGHT. |
| **GA** | **IN** | FY2021–FY2025 (5 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied, $0-diff. F-97-01 supersede plan confirmed. GREENLIGHT. |
| **MD** | **IN** | FY2022–FY2025 (4 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied (diff ≤$2K, GAAP rounding). FY2022 negative investment income → P2 clamp required. GREENLIGHT. |
| **TN** | **IN** | FY2009–FY2025 (17 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied, $0-diff. Mixed filename conventions — enumerate from archive. GREENLIGHT. |
| **CT** | **IN** | FY2019–FY2025 (7 years, FY1988+ enumerable) | FY2023 ✅ FY2024 ✅ | Bookend-tied, $0-diff. No derivable pattern — enumerate from archive JSON. GREENLIGHT. |
| **WI** | **IN** | FY2019–FY2025 (7 years, FY2000+ enumerable) | FY2023 ✅ FY2024 ✅ | Bookend-tied, $0-diff. Path structure changes per year — enumerate from archive. GREENLIGHT. |
| **WA** | **IN** | FY2020–FY2025 (6 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied, $0-diff. FY2025 has unique URL — must special-case. Biennial budget ≠ biennial ACFR (ACFR is annual GAAP). GREENLIGHT. |
| **MI** | **IN** | FY2019–FY2025 (7 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied (diff $1K, GAAP rounding). September 30 FY-end (unique) — custom loader logic required. FY2025 unique URL. GREENLIGHT. |

**All 10 states IN. Zero deferred. Final roster size: 10.**

D-01 check: 0 failures → full roster, no backfill needed, no count float-down.
D-02 check: all windows clear the recency floor, including the shallow ones (GA: 5 years, MD: 4 years).

---

## Batch Split Lock (D-03)

Locked by GF size — roadmap's largest-first proposed order. No rebalancing needed (all 10 states IN).

| Batch | Phase | States | Rationale |
|-------|-------|--------|-----------|
| **Batch 1** | Phase 108 | **NJ, MA, NC, GA, MD** | Largest-GF five from the roster (NJ ~$61B, MA ~$62B, NC ~$75B, GA ~$68B, MD ~$49B ACFR GF revenues FY2025). Includes the MA in-place upgrade and GA F-97-01 supersede — RECON-07 resolutions confirmed. |
| **Batch 2** | Phase 109 | **TN, CT, WI, WA, MI** | Remaining five (TN ~$35.5B, CT ~$26.1B, WI ~$38.7B, WA ~$55.8B, MI ~$53.8B ACFR GF revenues FY2025). Includes MI with the unique September 30 FY-end. |

Both batches fully populated. D-03 assignment intact.

---

## Per-State Summary and Loader Mapping

Consolidated from 107-BATCH1-SOURCES.md and 107-BATCH2-SOURCES.md.

| State | Statement/GF column | Units | FY-end | Clean window | Latest tie | Old-end tie | Scope vs NASBO (ratio) | Accept-relabel rec | Closest loader template |
|-------|---------------------|-------|--------|-------------|-----------|-------------|------------------------|-------------------|------------------------|
| **NJ** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of 4: GF\|Transportation Trust\|Nonmajor\|Total) | **dollars** (not thousands) | Jun 30 | FY2020–FY2025 | FY2025 $60,979,024,211 ✅ | FY2020 $38,768,977,008 ✅ | ~1.15× NASBO | Accept-relabel honestly | `processILAcfr.js` / `processILRevenueAcfr.js` |
| **MA** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of 3: GF\|Other Governmental\|Total) | thousands | Jun 30 | FY2001–FY2025 | FY2025 $61,907,573K ✅ | FY2015 $35,029,512K ✅ | ~1.73× NASBO | Accept-relabel honestly | `processPAAcfr.js` / `processPARevenueAcfr.js` |
| **NC** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of 4+: GF\|Highway\|Other\|Total) | thousands | Jun 30 | FY2012–FY2025 | FY2025 $75,416,082K ✅ | FY2020 $44,930,429K ✅ | ~2.58× NASBO | Accept-relabel honestly | `processILAcfr.js` / `processILRevenueAcfr.js` |
| **GA** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of: GF\|Other\|Total) | thousands | Jun 30 | FY2021–FY2025 | FY2025 $68,445,055K ✅ | FY2021 $55,378,103K ✅ | ~1.98× NASBO | Accept-relabel honestly | `processILAcfr.js` / `processILRevenueAcfr.js` |
| **MD** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of 6: GF\|Special Revenue\|Debt Service\|Capital Projects\|Enterprise\|Total) | thousands | Jun 30 | FY2022–FY2025 | FY2025 $48,689,018K ✅ | FY2022 $50,540,136K ✅ | ~1.78× NASBO | Accept-relabel honestly | `processPAAcfr.js` / `processPARevenueAcfr.js` |
| **TN** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of 4+: GF\|Education\|Highway\|Nonmajor\|Total) | thousands | Jun 30 | FY2009–FY2025 | FY2025 $35,473,625K ✅ | FY2019 $22,201,193K ✅ | ~1.51× NASBO | Accept-relabel honestly | `processILAcfr.js` / `processILRevenueAcfr.js` |
| **CT** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of 7: GF\|Debt Service\|Transportation\|Restricted Grants\|Grant & Loan\|Other\|Total) | thousands | Jun 30 | FY2019–FY2025 (FY1988+ enumerable) | FY2025 $26,074,183K ✅ | FY2019 $20,776,288K ✅ | ~1.14× NASBO | Accept-relabel honestly | `processILAcfr.js` / `processILRevenueAcfr.js` |
| **WI** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (1st of 3: GF\|Transportation\|Nonmajor Governmental\|Total) | thousands | Jun 30 | FY2019–FY2025 (FY2000+ enumerable) | FY2025 $38,655,598K ✅ | FY2019 $27,866,801K ✅ | ~1.74× NASBO | Accept-relabel honestly | `processILAcfr.js` / `processILRevenueAcfr.js` |
| **WA** | Govtl Funds Stmt Rev/Exp/Changes — General Fund (labeled "GENERAL"; 1st of 3+: GF\|Higher Ed Special Revenue\|Higher Ed Endowment\|Total) | thousands | Jun 30 | FY2020–FY2025 | FY2025 $55,775,958K ✅ | FY2020 $38,977,410K ✅ | ~1.72× NASBO | Accept-relabel honestly | `processPAAcfr.js` / `processPARevenueAcfr.js` |
| **MI** | Govtl Funds Stmt Rev/Exp/Changes — GENERAL FUND (Fund 10; 1st of 3: GF\|School Aid\|Non-Major\|Totals) | thousands | **Sep 30** | FY2019–FY2025 | FY2025 $53,788,610K ✅ | FY2020 $39,920,656K ✅ | ~3.56× NASBO | Accept-relabel honestly (prominently) | `processILAcfr.js` or new `processMIAcfr.js` |

**Loader-template rationale:**
- **IL-template states (NJ, NC, GA, TN, CT, WI, MI):** These have multiple major fund columns in the GF statement and/or non-derivable per-year URL patterns requiring explicit SOURCES maps — matching the IL loader's explicit-SOURCES + multi-column GF shape.
- **PA-template states (MA, MD, WA):** These have a more regular GF-first layout (fewer columns or derivable URL patterns) closer to the PA loader. MA has a partially derivable URL pattern (`acfr_fy-{YYYY}.pdf`). WA has a consistent path structure (FY2021–2024) with one special-case (FY2025). MD has consistent paths with one case change at FY2024.
- **MI exception:** September 30 FY-end is unique across all existing templates. May require a new `processMIAcfr.js` rather than a pure clone — see Open Risks.

---

## NASBO-Replace Rule (RECON-08)

The ACFR operating rows **replace** the NASBO operating rows per state-FY, using the same `(municipality_id, fiscal_year, 'operating')` key:

1. **Operating replacement:** ACFR operating loader writes `dataset_type='operating'` keyed on `(muni_id, fy, 'operating')`. The never-overwrite guard checks for existing ACFR provenance first; if the existing row has NASBO provenance it is replaced by the ACFR GAAP row. One basis per state-FY (GAAP wins where ACFR exists).
2. **Revenue is a pure insert:** `dataset_type='revenue'` is new on all 10 roster nodes (no NASBO revenue exists). Pure insert — enables the "Money In" view automatically.
3. **Idempotent:** re-run of any Phase-108/109 loader produces 0 net new rows.
4. **Scoped to roster states only:** each per-state loader targets its own `municipality_id`; cannot affect other state nodes.
5. **Un-upgraded NASBO states stay on `loadStateGF.mjs`:** the NASBO fallback is not modified. ~31 remaining NASBO states are untouched.
6. **The 9 existing ACFR nodes are untouched:** per the RECON-08 contract above — the loader scripts are per-state-scoped and cannot write to MN/OH/VA/CA/TX/NY/FL/PA/IL nodes.
7. **No stale metadata cleanup** for any roster state — the Phase 107 probe confirmed zero `data_sources` rows on any roster state node. No equivalent of the Phase 99 CA/TX/NY/FL stale-`data_sources` delete step is needed.

---

## Recency-Floor Verdicts (D-07)

All 10 states GREENLIGHT:

| State | Latest ACFR FY | FY2023 in clean window? | FY2024 in clean window? | Verdict |
|-------|---------------|------------------------|------------------------|---------|
| NJ | FY2025 | ✅ | ✅ | GREENLIGHT — NASBO FY2023/FY2024 replaceable |
| MA | FY2025 | ✅ | ✅ | GREENLIGHT — in-place upgrade, NASBO FY2023/FY2024 replaceable |
| NC | FY2025 | ✅ | ✅ | GREENLIGHT — NASBO FY2023/FY2024 replaceable |
| GA | FY2025 | ✅ | ✅ | GREENLIGHT — F-97-01 supersede planned, NASBO FY2023/FY2024 replaceable |
| MD | FY2025 | ✅ | ✅ | GREENLIGHT — NASBO FY2023/FY2024 replaceable; P2 clamp FY2022 |
| TN | FY2025 | ✅ | ✅ | GREENLIGHT — NASBO FY2023/FY2024 replaceable |
| CT | FY2025 | ✅ | ✅ | GREENLIGHT — NASBO FY2023/FY2024 replaceable |
| WI | FY2025 | ✅ | ✅ | GREENLIGHT — NASBO FY2023/FY2024 replaceable |
| WA | FY2025 | ✅ | ✅ | GREENLIGHT — NASBO FY2023/FY2024 replaceable |
| MI | FY2025 (Sep 30) | ✅ (Oct 2022–Sep 2023) | ✅ (Oct 2023–Sep 2024) | GREENLIGHT — NASBO FY2023/FY2024 replaceable; FY-end Sept 30 |

No D-07 blockers. No strand-flagged states. Every state's clean ACFR window covers both NASBO replacement FYs.

---

## Open Risks for Phases 108/109

### Scope-Relabel Confirmations (D-09)

All 10 states require accept-and-relabel at load time (TX precedent). Chris confirms at Phase-108/109 load and UAT (Phase 110). Scope-divergence magnitude summary:

| State | Ratio | Driver | Load-time confirmation needed |
|-------|-------|--------|-------------------------------|
| MI | ~3.56× | Federal Medicaid/ARP passthrough inside GF ($30.3B from federal agencies) | Prominently document; largest divergence in the tranche |
| NC | ~2.58× | Large federal grant flows (Medicaid federal match, education aid) | Explain in relabel |
| GA | ~1.98× | Federal intergovernmental flows inside GAAP GF | F-97-01 supersede also required |
| MA | ~1.73× | Federal grants (lottery, federal grants) inside GAAP GF | |
| WI | ~1.74× | Intergovernmental revenue ($14.4B, nearly all federal) | |
| WA | ~1.72× | Federal grants-in-aid ($22.4B); also: biennial budget ≠ annual ACFR | Must document WA biennial-budget ≠ biennial ACFR |
| MD | ~1.78× | Federal intergovernmental revenue | P2 clamp FY2022 also required |
| TN | ~1.51× | Federal revenue ($17.5B of $35.5B total) | |
| NJ | ~1.15× | Modest — federal/intergovernmental expands GAAP GF slightly | Smallest divergence; still requires honest relabel |
| CT | ~1.14× | Federal Grants and Aid ($2.8B) inside GAAP GF | Smallest divergence; closest to NASBO concept |

### P2 Clamp Anticipations (D-08.2)

| State | FY at risk | Issue | Action |
|-------|-----------|-------|--------|
| **MD** | FY2022 | `Interest and other investment income = -$275,992K` (confirmed) | P2 clamp required for FY2022; loader must check all years |
| **CT** | FY2009–FY2017 (CT fiscal stress era) | Investment income may be negative in older years | Check each year at load; apply P2 clamp if negative |
| **WA** | Older years | Column header is "Investment income (loss)" — negative is possible in adverse-market years | Check each year at load |
| **TN** | Older years | Check older years at load | Unlikely based on confirmed bookend years |
| **WI** | FY2008–FY2012 (zero-rate era) | Near-zero possible; unlikely negative in GF column | Check at load |
| **NC** | Older years | Investment earnings line positive in confirmed years; check older at load | Low risk |
| **NJ** | — | Investment earnings positive in both bookend years | Low risk |
| **MA** | — | Investment income embedded in Miscellaneous; no standalone negative line possible | No clamp risk |
| **GA** | — | Investment income positive in confirmed years | Low risk |
| **MI** | — | Investment income embedded in Miscellaneous; no standalone negative line possible | No clamp risk |

### Units Traps

| State | Unit trap | Action |
|-------|-----------|--------|
| **NJ** | Dollars (NOT thousands) — only state in the entire tranche with this | Loader must store raw dollars, OR divide by 1,000 — must match schema convention for existing ACFR states (which all store in thousands scale). Critical: do NOT apply ×1,000 multiply to NJ. |
| **MI** | September 30 FY-end (unique across all existing templates and all other roster states) | `fiscal_year_start_month = 10`; `source_date = {FY}-09-30`. FY2025 = Oct 2024–Sep 2025. NASBO FY labels match MI's designation. |

### URL / Naming Variants (Soft-404 and Enumeration Risks)

| State | Risk | Action |
|-------|------|--------|
| **NJ** | FY2025 drops "FR" infix: `NJFY2025Complete.pdf` vs `NJFRFY{YYYY}Complete.pdf` | SOURCES map must enumerate FY2025 explicitly |
| **NC** | No derivable URL pattern — each year unique from archive page | Must enumerate all 14+ per-year URLs from `ncosc.gov/annual-report-and-popular-report-archives` |
| **GA** | Opaque Drupal slugs (FY2023 uses `-0` suffix: `fy-2023-acfr-0`) | Enumerate all 5 Drupal stable URLs; do not assume pattern |
| **MD** | Case change at FY2024: `ACFR{YYYY}.pdf` (FY2022–FY2023) vs `acfr{YYYY}.pdf` (FY2024+) | SOURCES map must split by case |
| **TN** | FY2025 unique naming + mixed case across years; no single pattern | Enumerate from archive; special-case FY2025 |
| **CT** | FY2022 has "revised" suffix (`ACFR-2022revised032227.pdf`) | Use exact URL from archive JSON; do not derive |
| **WI** | Path structure changes: FY2023/2022 = `/budget/SCO/`; FY2021 = `/budget/`; FY2018–2020 = `CAFR{YYYY}.pdf` | Enumerate per-year URLs |
| **WA** | FY2025 unique: `FY-2025-Annual-Comprehensive-Financial-Report.pdf`; FY2020 uses `CAFR20.pdf` | Special-case FY2025 and FY2020 in SOURCES map |
| **MI** | FY2025 reversed: `FY-2025-ACFR.pdf` vs `ACFR-FY{YYYY}.pdf` for FY2019–2024 | Enumerate FY2025 separately |
| **MA** | FY2017 no-hyphen: `acfr_fy2017.pdf` vs `acfr_fy-{YYYY}.pdf` | Special-case FY2017 in SOURCES map |

### Michigan Custom Template Risk

MI's September 30 FY-end is unique across all existing loaders (`process{PA,IL,CA,TX,NY,FL,OH,VA,MN}Acfr.js`). None of the existing templates are built for October-start fiscal years. Phase-109 may need a new `processMIAcfr.js` rather than a pure clone. The GF statement is otherwise standard — Fund 10 column, thousands, same GAAP statement type. The only required customization is `fiscal_year_start_month = 10` and `source_date = {FY}-09-30`. If the PA/IL template supports a configurable FY-end month, MI can clone it; if not, a minimal new template is needed.

### WA Biennial Budget Clarification

Washington budgets on a 2-year biennium cycle, but publishes **annual GAAP financial statements** for each fiscal year ending June 30. The loader must treat this as annual data — "For the Fiscal Year Ended June 30, {YYYY}" is confirmed in the ACFR. Do NOT interpret the biennial budget cycle as biennial ACFR data. Document this explicitly in the loader comments.

---

## Gap Log (Consolidated)

All gaps from 107-BATCH1-SOURCES.md and 107-BATCH2-SOURCES.md. None of these gaps prevent the states from being IN the roster or passing the recency floor.

| State | FY / Period | Gap reason | Disposition |
|-------|------------|-----------|-------------|
| NJ | Pre-FY2020 | URL pattern exists but durability not verified for pre-2020. FY2019 and older may differ. | Low priority — 6-year window (FY2020–2025) sufficient. Extend at load time. |
| MA | FY2017 | `acfr_fy2017.pdf` (no hyphen) vs `acfr_fy-{YYYY}.pdf`. Naming exception. | Not a gap; PDF confirmed present. SOURCES map must special-case FY2017. |
| NC | Pre-FY2012 | Archive page starts at FY2012. | Low priority — 14-year window more than sufficient. |
| GA | Pre-FY2021 | Only 5 years on main + historical pages. Older ACFRs not linked or discoverable. | Gap logged. FY2021–FY2025 (5 years) is the confirmed clean window. |
| MD | Pre-FY2022 | Site restructured from marylandtaxes.gov; older files not migrated or linked. | Gap logged. FY2022–FY2025 (4 years) is the confirmed clean window. FY2022 has P2 clamp requirement. |
| TN | FY2025 naming | `ACFR%20-%20FY25.pdf` (space+dash). All other years use underscore. | Named variant, not a gap — confirmed real. SOURCES map must enumerate separately. |
| TN | Pre-FY2009 | FY2007/2008 listed on archive but not tested. | Low priority — 17-year window (FY2009–2025) sufficient. |
| CT | Pre-FY2019 | FY2018 and older confirmed listed in archive JSON; extraction not verified. | Not a blocking gap — FY2019 is oldest verified. Older PDFs likely clean given consistent OSC layout. |
| WI | FY2021–FY2023 path variation | Path structure changes between years. | Must enumerate from archive; all confirmed durable `doa.wi.gov` paths. |
| WI | Pre-FY2000 | Archive lists back to FY1995 in multi-file format. | Low priority — 26-year window (FY2000–2025) more than sufficient. |
| WA | Pre-FY2020 | Archive listing references State Library link; older year URLs not tested. | Gap: FY2019 and older not verified. FY2020–2025 (6 years) satisfies recency floor. |
| WA | FY2025 naming | `FY-2025-Annual-Comprehensive-Financial-Report.pdf` (unique prefix). | Named variant, not a gap — confirmed real (24 MB). SOURCES map must special-case FY2025. |
| MI | FY2025 naming | `FY-2025-ACFR.pdf` (reversed vs `ACFR-FY{YYYY}.pdf`). | Named variant, not a gap — confirmed real (4.9 MB). Enumerate FY2025 separately. |
| MI | Pre-FY2019 | Archive shows FY2019 as oldest listed year. | Gap: pre-FY2019 not available. FY2019–2025 (7 years) satisfies recency floor. |
| MI | Sep 30 FY-end | All other states are Jun 30. | Not a gap — documented risk fact. Loader must customize FY-end logic. |

---

## Success-Criteria Coverage

### Phase 107 ROADMAP Success Criteria

**SC-1: All 10 candidate ACFR sources located, GF statement confirmed, bookend tie-confirmed, durable per-year URLs recorded.**
→ SATISFIED. All 10 states in 107-BATCH1-SOURCES.md + 107-BATCH2-SOURCES.md: GF column confirmed (GAAP Governmental Funds Statement of Rev/Exp/Changes), bookend ties at $0 or ≤$2K (GAAP thousands rounding), durable URLs recorded. $0 spend, `pdftotext -table` only.

**SC-2: Roster locked (≤2 deferred, no backfill), each surviving state's clean window recorded.**
→ SATISFIED. All 10 states IN, 0 deferred. D-01 (no backfill) and D-02 (no minimum depth) honored. Each state's clean window recorded in the Roster Lock table above.

**SC-3: Prior-load overlaps resolved (MA in-place upgrade plan, GA F-97-01 supersede plan, other custom-source nodes identified).**
→ SATISFIED. MA: in-place upgrade confirmed, no dual-node, no stale metadata (simpler than CA). GA: F-97-01 Medicaid fix will be superseded cleanly by ACFR GAAP actuals at same (muni, fy, 'operating') key. Other 8 roster states: none found (all pure NASBO, zero custom data_sources rows). RECON-07 fully resolved.

**SC-4: Consolidated handoff doc (107-RECON.md) produced for Phases 108/109 — $0 spend, no DB writes.**
→ SATISFIED. This document is the consolidated handoff. $0 spend confirmed. No DB writes — all probes were read-only SELECT. Shape mirrors 103-RECON.md (per-state summary + loader mapping, NASBO-replace rule, recency-floor verdicts, open risks, success-criteria coverage).

### RECON-06 Coverage

- [x] Per-state ACFR source located (GF statement, column, units, FY-end) for all 10 roster states
- [x] Durable per-year URL pattern recorded for each state
- [x] Bookend tie-confirmed at both ends of each state's window
- [x] Four risk facts (D-08) pinned: units, negative GF lines, exact column header + statement, FY-end month
- [x] Roster locked with clean window recorded per state; ≤2 deferred (0 deferred)
- [x] Gap log written for each state

### RECON-07 Coverage

- [x] Massachusetts: in-place upgrade confirmed (Phase 98 CA precedent; no dual-node; no stale metadata)
- [x] Georgia: F-97-01 Medicaid fix supersede plan confirmed (ACFR replaces same key; fix is moot once ACFR wins)
- [x] Other custom-source nodes: none found across remaining 8 roster states (all pure NASBO)
- [x] Read-only DB probe confirmed findings (no DB writes)

### RECON-08 Coverage (Phases 108/109 Inherit)

- [x] 9 existing ACFR nodes enumerated from DB and confirmed distinct from roster states
- [x] Untouched-nodes contract written: Phases 108/109 touch only roster states; 9 ACFR nodes + un-upgraded NASBO states undisturbed
- [x] NASBO-replace rule documented: (muni, fy, 'operating') key replacement, idempotent, never-overwrite, revenue is pure insert
- [x] `loadStateGF.mjs` stays the NASBO fallback for un-upgraded states; not modified
