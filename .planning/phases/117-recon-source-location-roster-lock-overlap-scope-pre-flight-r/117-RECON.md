# Phase 117 RECON — Source Location + Roster Lock + Overlap/Scope Pre-flight (RECON-11)

**Status:** COMPLETE — Task 1 (Overlap Resolution D-10 + untouched-nodes contract) and Task 2 (Roster
Lock, Batch Split Confirmation, Per-state Summary + Loader Mapping, DEEP-05 Deepening Summary,
NASBO-Served List, NASBO-Replace Rule, Open Risks, Success-Criteria Coverage) both complete. Decision-
ready handoff for Phases 118–123.
**Spend:** $0 — read-only `SELECT` DB probe only (Supabase JS client via `node`, schema `treasury`). No DB writes anywhere in this recon.
**Requirement:** RECON-11
**DB write confirmation:** NONE — every query below is a `SELECT`. No `INSERT`/`UPDATE`/`DELETE`/DDL executed.

---

## Overlap Resolution (D-10)

### Read-only DB probe method

Queried `treasury.municipalities` (`entity_type='state'`), `treasury.budgets`, and `treasury.data_sources`
for all 21 roster states (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/OK/RI/SD/VT/WV/WY), mirroring the
107-RECON dual-node check. For each state's node: which `budgets` rows exist (dataset_type / fiscal_year /
total_budget / data_source) and which `data_sources` metadata rows exist (dataset_id / api_type /
dataset_type / fiscal_years). Separately enumerated every state-entity municipality with a `revenue`
dataset_type row to confirm the existing ACFR-node population. Executed via the project's standard
Supabase-JS read pattern (`@supabase/supabase-js`, service-role key, `schema: 'treasury'`) — the same
client/credential path used by existing project audit scripts (`scripts/audit_task1.mjs` precedent).
`mcp__supabase-local__execute_sql` was not available in this execution environment; this is the
project-documented read-only fallback. All queries were `.select(...)` reads; zero writes.

### Probe results — 21 roster states

| State | Muni ID | `budgets` rows | dataset_types | `data_sources` rows | Non-NASBO budget rows | Non-NASBO data_sources rows |
|-------|---------|----------------|----------------|----------------------|-------------------------|-------------------------------|
| AK | `b268c415-0058-4fea-8ba1-24f49fb434b4` | 2 | operating | **2** | 0 | **2 — see AK finding below** |
| AR | `5efd2f95-6deb-4118-a07a-9f48cdca681c` | 2 | operating | 0 | 0 | 0 |
| DE | `a7854fa3-8e68-4a0e-b92a-415bad6bccd2` | 2 | operating | 0 | 0 | 0 |
| HI | `bf5b7221-9c8e-4df7-961d-e9c020ca733e` | 2 | operating | 0 | 0 | 0 |
| ID | `247ca2d0-44bc-4ef0-bc0d-4875758bae5e` | 2 | operating | 0 | 0 | 0 |
| IA | `6e71a93f-a43d-4972-a239-85ddbebe2545` | 2 | operating | 0 | 0 | 0 |
| KS | `bb3dcf05-586c-4e68-85d3-26a6199cc4ab` | 2 | operating | 0 | 0 | 0 |
| ME | `53f26018-1d20-4f6a-9c0e-400bfb91199a` | 2 | operating | 0 | 0 | 0 |
| MS | `ebec9e07-a79e-44b0-b5d5-2551625d4b8e` | 2 | operating | 0 | 0 | 0 |
| MT | `6e085a8b-97e3-479d-8879-9bb7ff4f9fb1` | 2 | operating | 0 | 0 | 0 |
| NE | `ccfb8751-ae32-4974-96a9-d8c8ea85a898` | 2 | operating | 0 | 0 | 0 |
| NV | `d0879e45-0b72-41ee-bdbd-a214a4f2a1d5` | 2 | operating | 0 | 0 | 0 |
| NH | `c54f6dbd-3f2a-453e-b0b9-259e377aef67` | 2 | operating | 0 | 0 | 0 |
| NM | `1e60ff76-c9fa-48d0-9442-042f61cd40ea` | 2 | operating | 0 | 0 | 0 |
| ND | `e84aafe0-eeaa-470a-8fd3-708c88af2a80` | 2 | operating | 0 | 0 | 0 |
| OK | `54233a91-919d-4a5f-9f24-2f9325250e64` | 2 | operating | 0 | 0 | 0 |
| RI | `483f02b4-2167-4e3d-9f5c-0f3ed83be2e6` | 2 | operating | 0 | 0 | 0 |
| SD | `e7273079-b392-449d-af38-d2e4d0df73e0` | 2 | operating | 0 | 0 | 0 |
| VT | `563d6f1c-ce2b-4071-938f-01725d283504` | 2 | operating | 0 | 0 | 0 |
| WV | `e21923d7-ad99-4711-b765-255b9807c059` | 2 | operating | 0 | 0 | 0 |
| WY | `4009951b-8a23-457e-9591-1597356dfe34` | 2 | operating | 0 | 0 | 0 |

All 21 states carry exactly 2 `budgets` rows (FY2023 + FY2024, `dataset_type='operating'`,
`data_source` text matching `NASBO State Expenditure Report...`, `data_source_id = null` — text-stamp
provenance per policy P4). **Twenty of the 21 states have zero `data_sources` rows and zero non-NASBO
budget rows — clean NASBO-only nodes, no overlap.** One exception: **Alaska**.

### AK finding — orphaned `data_sources` residue (cleanup, not an in-place-upgrade overlap)

Alaska's `budgets` rows are clean NASBO-only (2 rows, FY2023 $7,450,000,000 / FY2024 $6,339,000,000,
both `data_source_id = null`, NASBO text-stamp, NASBO `source_url`) — **no live custom-sourced budget
data exists for AK.** However, the `data_sources` table carries **2 stale/orphaned metadata rows** with
no corresponding `budgets` rows referencing them:

| dataset_id | name | api_type | base_url | dataset_type | fiscal_years | sync_status | rows_synced | last_synced_at |
|-----------|------|----------|----------|---------------|---------------|--------------|--------------|------------------|
| `ak-ugf-revenue` | Alaska General Fund Revenue | html | `https://omb.alaska.gov/` | revenue | 2022–2026 | idle | 30 | 2026-06-08 |
| `ak-ugf-operating` | Alaska General Fund Operating Budget | html | `https://omb.alaska.gov/` | operating | 2022–2026 | idle | 60 | 2026-06-08 |

Both rows are `is_enabled: true` and claim `rows_synced` counts (30 + 60 = 90), but **zero `budgets`
rows reference either dataset** (AK has 0 `revenue` rows at all, and its 2 `operating` rows are pure
NASBO text-stamp with no `data_source_id` FK). This is the **WR-05/LOAD-01-class residue pattern**
(stale `data_sources` metadata with no matching live budget data) documented at v2.13/v2.14 close —
**not** a "pre-existing custom-source node" in the D-10 sense, because there is no actual overlapping
budget data to preserve via an in-place upgrade. It is dead metadata from an abandoned/never-completed
HTML loader attempt (Alaska Office of Management and Budget "Unrestricted General Fund" html source),
apparently synced once (2026-06-08) but leaving no trace in `budgets`.

**Recommendation for Phase 118 (AK loader):** DELETE the 2 stale `ak-ugf-revenue` / `ak-ugf-operating`
`data_sources` rows as a pre-load cleanup step (LOAD-01 zero-residue discipline), before writing new
`ak-acfr-operating` / `ak-acfr-revenue` `data_sources` rows for the ACFR load. This avoids leaving
orphaned `sync_status`/`rows_synced` metadata alongside the new ACFR-sourced rows and keeps the
dataset_id namespace clean. This is a load-time hygiene step, **not a blocker** — AK's actual ACFR
recon (117-BATCH1-SOURCES.md, Section 1–7) stands unaffected; AK still resolves to a standard new
ACFR loader like the other 20 roster states.

**Overlap verdict for all 21 roster states:** **"None found"** in the D-10 in-place-upgrade sense (no
state carries a live custom-sourced budget node requiring an in-place upgrade) — **except AK**, which
requires a pre-load stale-metadata cleanup (documented above) rather than an in-place upgrade. All 21
states proceed to Phases 118–121 as standard new ACFR loaders.

---

## Untouched-Nodes Contract

### Existing 29 ACFR nodes (confirmed from read-only DB probe)

Enumerated every `entity_type='state'` municipality (50 total) with at least one `budgets` row where
`dataset_type='revenue'` — the signature of an already-upgraded ACFR node (NASBO carries no revenue
dataset).

| State | Muni ID | Total `budgets` rows |
|-------|---------|------------------------|
| AL | `bc953061-98de-43ad-878a-c6564bf75dbc` | 48 |
| AZ | `866036ee-20b2-4e3c-a4f3-5100659edf31` | 46 |
| CA | `e1007bf5-bac9-4b1c-878e-f6834885f850` | 36 |
| CO | `89d2aff1-6980-4c20-80fe-513618bce8ac` | 6 |
| CT | `d01de53e-d687-4825-bfe2-09f7694c28d6` | 76 |
| FL | `adb19ea0-de7c-4cd5-9445-cbf2108a8a1a` | 8 |
| GA | `6eb7dd4a-4dcf-4dcc-898f-45af9a3e20c3` | 10 |
| IL | `ac8b3dee-b431-48d0-9f59-deea46c85948` | 10 |
| IN | `7eb77ada-b504-4531-98cc-8262cfb22ff5` | 48 |
| KY | `6d9dfe88-f908-466c-95d5-66dce0777ee0` | 47 |
| LA | `b7e9e7cd-8b7e-4272-8e42-ef41b293120b` | 48 |
| MA | `fd6b008f-4d35-4665-8c6a-0429de5a4e1f` | 42 |
| MD | `8e597f8f-c696-47c0-9001-ed78a54f2228` | 8 |
| MI | `38c9f1ff-130e-423d-955a-6f0aa5aecae2` | 14 |
| MN | `d4b4897d-5bb8-44ce-b7d2-355ca7c5f746` | 36 |
| MO | `21892bb7-1a1d-4038-8665-51c256ab5875` | 28 |
| NC | `dd5281e8-6988-4f42-b83c-4fed43c7ada4` | 28 |
| NJ | `91f310a1-bec9-404a-9825-82b1106c911f` | 48 |
| NY | `1a7f871c-7f2e-4786-9c55-5ab3409716f4` | 44 |
| OH | `7b2f8ddc-5d88-4f44-8d1e-52e02c0d0205` | 12 |
| OR | `7686da27-5d64-44c2-bae2-f8c85c073e37` | 8 |
| PA | `d4a4aadc-f91e-45e4-852f-2cf21e177de5` | 20 |
| SC | `f0024b19-1b89-4bdf-af47-d2e28c21278f` | 48 |
| TN | `f96037ba-af9e-406d-a98f-8c5e2fd299d6` | 34 |
| TX | `dc93d846-ef3e-4a41-b58f-06be2d1ab40a` | 20 |
| UT | `740cffee-3111-44c0-9473-a77acb6c42f8` | 14 |
| VA | `c9b21975-bcc2-41d8-9dd8-fd9dcde32506` | 8 |
| WA | `d8257751-45c4-4853-9621-e1841e7d4998` | 12 |
| WI | `15fe5240-19d9-4fef-b785-d624b0a39a2a` | 52 |

**29 nodes confirmed** — matches the accumulated-context memory ("29 ACFR nodes ... 901 rows, 0
anomalies at v2.14 close"). Total state-entity municipalities = **50** (confirmed via probe). 50 − 29
ACFR = **21**, which exactly matches the named roster (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/
OK/RI/SD/VT/WV/WY). No overlap between the two populations, no missing/unaccounted state.

### The contract

> **Phases 118–121 touch ONLY the 21 named roster states** (Batch 1: AK/AR/DE/HI/ID; Batch 2:
> IA/KS/ME/MS/MT; Batch 3: NE/NV/NH/NM/ND; Batch 4: OK/RI/SD/VT/WV/WY). **Phase 122 touches ONLY the 4
> DEEP-05 existing nodes** (CA/NY/FL/TX), extending their own windows deeper into history — **no new
> state nodes are created** by Phase 122; it is a pure history-extension on 4 of the 29 already-upgraded
> nodes. **The remaining 25 of the 29 existing ACFR nodes are completely undisturbed** by any Phase
> 117–122 activity. Per-state ACFR loaders (`extract_gf.py` + `gen_state.py` clones, or the closest
> `process*Acfr.js` template) are scoped to their own `municipality_id`; they cannot write to any other
> state's node. `loadStateGF.mjs` (the NASBO fallback) stays untouched and continues serving any state
> not yet upgraded. The NASBO-replace rule (below) is idempotent and never-overwrite — a re-run of any
> loader is a no-op. This contract is noted here; it is enforced by the loaders themselves in Phases
> 118–122 (documentation-only recon does not execute it).

### Read-only confirmation

Every query executed in this probe was a `.select(...)` read against `treasury.municipalities`,
`treasury.budgets`, and `treasury.data_sources`. Zero `insert`/`update`/`delete`/DDL calls were made.
$0 spend (no AI, local `node` execution against the existing Supabase project only).

---

## Roster Lock (D-11)

### Roster decision criteria

A state is **RECON** if it (1) publishes a GAAP Governmental Funds *Statement of Revenues,
Expenditures and Changes in Fund Balances* with a splittable General Fund column (D-03 triage), (2)
bookend-tie-confirms at both ends of a durable-URL window (D-05/D-06), and (3) clears the D-07 recency
floor (FY2023 + FY2024 covered, or flagged as a load-time gap that does not block the disposition — see
NV/NM below). A state is **STAY-NASBO-exception** if no clean GAAP GF ACFR exists, or the recency floor
fails unrecoverably, or only a broader/budgetary basis is available (D-01).

D-11 (ship-what-survives on count, not on states): roster is drawn ONLY from the named 21 — no
backfill to a 22nd state. If any state can't cleanly extract, it is marked STAY-NASBO-exception, not
substituted.

### Roster Lock table

| State | Verdict | Clean window | Basis | Reason if exception |
|-------|---------|---------------|-------|------------------------|
| **AK** | **RECON** | FY1998–FY2025 (28 yr) | GAAP GF (General Fund, 1st of 4) | — |
| **AR** | **RECON** | FY2003–FY2024 (22 yr; FY2025 garbled, gap-logged) | GAAP GF (single-fund state) | — |
| **DE** | **RECON** | FY2004–FY2025 (22 yr) | GAAP GF (General, 1st of 5) | — |
| **HI** | **RECON** | FY2005–FY2025 (21 yr; FY2000-04 image-only gap) | GAAP GF (General Fund, 1st col) | GF-alone-vs-composite load-time call (~0.95× narrower than NASBO) |
| **ID** | **RECON** | FY2004–FY2025 (22 yr) | GAAP GF (General, 1st of 3-4) | Units-transition year unresolved (dollars→thousands between FY2004-FY2015); loader must verify per-year |
| **IA** | **RECON** | FY2002–FY2025 (24 yr) | GAAP GF (GENERAL FUND, "NET REVENUES" total line) | — |
| **KS** | **RECON** | FY2019–FY2025 (7 yr, shallow) | GAAP GF (General, 1st of 8) | — |
| **ME** | **RECON** | FY2000–FY2025 (26 yr) | GAAP GF (General, 1st of 6) | — |
| **MS** | **RECON** | FY2003–FY2024 (22 yr; FY2025 not yet published) | GAAP GF (General, near-single-fund) | P2 clamp required FY2024 (Investment income −$434,060K) |
| **MT** | **RECON** | FY2016–FY2025 (10 yr) | GAAP GF (GENERAL, 1st of many) | Annual GAAP reporting confirmed despite biennial budget cycle — no exception triggered |
| **NE** | **RECON** | FY2020–FY2025 (6 yr) | GAAP GF (General Fund, 1st of 7) | — |
| **NV** | **RECON** | FY2019–FY2023 (5 yr; FY2024/25 not yet published) | GAAP GF (General Fund, 1st of 4) | FY2024/FY2025 recency-floor gap flagged for Phase-120 load-time re-check or partial-window accept; does not disqualify |
| **NH** | **RECON** | FY2017–FY2024 (8 yr) | GAAP GF (General, 1st of 5) | Access-mechanism risk only (Akamai-blocks automated fetch; Wayback-mirror proxy required) — not a data-availability exception |
| **NM** | **RECON** | FY2019–FY2024 (6 yr; FY2022 image-only, FY2023 URL undiscovered) | GAAP GF (General Fund, 1st of 3) | FY2022 requires hand-transcription/embed; FY2023 URL needs live-site discovery at load — neither disqualifies |
| **ND** | **RECON** | FY2021–FY2025 (5 yr) | GAAP GF (General, 1st of 5) | Annual GAAP reporting confirmed despite biennial budget cycle — no exception triggered |
| **OK** | **RECON** | FY2002–FY2024 (22 yr, v2.14-preserved + re-verified, no rot) | GAAP GF (General, 1st of 4) | — |
| **RI** | **RECON** | FY2006–FY2025 (20 yr) | GAAP GF (General, 1st of 4) | — |
| **SD** | **RECON** | FY2002–FY2025 (24 yr) | GAAP GF (General Fund, 1st of 7) | — |
| **VT** | **RECON** | FY2015–FY2025 (11 yr) | GAAP GF (General Fund, 1st of 7) | — |
| **WV** | **RECON** | FY2020–FY2025 (6 yr, shallow) | GAAP GF (General, 1st of 5) | — |
| **WY** | **RECON** | FY2005–FY2025 (21 yr; FY1980-2004 poor-OCR gap) | GAAP GF (General Fund, 1st of 6) | P2 clamp monitoring recommended every load year (large investment-income exposure) |

**All 21 states are RECON. Zero STAY-NASBO-exception dispositions.** Every D-03 triage across all four
batch docs passed; every bookend tied at exact $0 diff; every state either clears the D-07 recency
floor outright, or (NV, NM) carries a load-time gap that is explicitly a *within-RECON* window
decision (partial-window accept, live-site re-check, or embedded transcription) rather than a
disqualifying STAY-NASBO exception. **Final roster size: 21 — no float-down, D-11 honored with a
perfect count.**

---

## Batch Split Confirmation (D-12)

Because zero states triaged to STAY-NASBO-exception, no rebalancing is needed — the roadmap's original
batch assignment is confirmed unchanged:

| Batch | Phase | States | Count |
|-------|-------|--------|-------|
| **Batch 1** | Phase 118 | AK, AR, DE, HI, ID | 5 |
| **Batch 2** | Phase 119 | IA, KS, ME, MS, MT | 5 |
| **Batch 3** | Phase 120 | NE, NV, NH, NM, ND | 5 |
| **Batch 4** | Phase 121 | OK, RI, SD, VT, WV, WY | 6 |

**Total: 21 states across 4 batches, confirmed per D-12.** No survivor-rebalancing required.

---

## Per-state summary + loader mapping

Consolidated from 117-BATCH1-SOURCES.md, 117-BATCH2-SOURCES.md, 117-BATCH3-SOURCES.md, and
117-BATCH4-SOURCES.md.

| State | Statement/GF column | Units | FY-end | Durable window | Latest tie | Old-end tie | Scope vs NASBO | Accept-relabel rec | Closest loader template |
|-------|----------------------|-------|--------|-------------------|-------------|---------------|-------------------|------------------------|---------------------------|
| AK | General Fund (1st of 4) | thousands | Jun 30 | FY1998–2025 | FY2025 $8,378,945K ✅ | FY2020 $6,063,851K ✅ | ~1.32× | Accept-relabel | `processMDAcfr.js`/`processNJAcfr.js` |
| AR | General Fund (single fund) | thousands | Jun 30 | FY2003–2024 | FY2024 $24,045,611K ✅ | FY2003 $9,434,421K ✅ | **~3.96×** (widest in cohort) | Accept-relabel, prominent basis note | Simplest single-column pass-through |
| DE | General (1st of 5) | thousands | Jun 30 | FY2004–2025 | FY2025 $7,475,243K ✅ | FY2004 $3,055,310K ✅ | ~1.20× | Accept-relabel | `processNJAcfr.js`/`processMDAcfr.js` |
| HI | General Fund (1st, 4→8 cols) | thousands | Jun 30 | FY2005–2025 | FY2025 $10,607,306K ✅ | FY2005 $4,198,123K ✅ | ~0.95× (narrower) | GF-alone-vs-composite load-time call | `processMDAcfr.js`/`processLAAcfr.js` |
| ID | General (1st of 3-4) | **MIXED** (dollars→thousands, transition year unpinned) | Jun 30 | FY2004–2025 | FY2025 $6,658,024K ✅ | FY2004 $2,314,491,978 ✅ | ~1.33× | Accept-relabel; verify units per year | `gen_state.py` + custom units-detection step |
| IA | GENERAL FUND (NET REVENUES total line) | thousands | Jun 30 | FY2002–2025 | FY2025 $24,251,676K ✅ | FY2002 $9,752,220K ✅ | ~2.83× | Accept-relabel | `extract_gf.py`/`gen_state.py` (enumerated) |
| KS | General (1st of 8) | thousands | Jun 30 | FY2019–2025 (shallow) | FY2025 $10,352,600K ✅ | FY2019 $7,539,362K ✅ | ~1.11× | Accept-relabel | `extract_gf.py`/`gen_state.py` (wide multi-fund) |
| ME | General (1st of 6) | thousands | Jun 30 | FY2000–2025 (deepest B2) | FY2025 $6,194,288K ✅ | FY2002 $2,302,006K ✅ | ~1.24× | Accept-relabel | `extract_gf.py`/`gen_state.py` (derivable URL) |
| MS | General (near-single-fund) | thousands | Jun 30 | FY2003–2024 | FY2024 $22,709,403K ✅ (P2 clamp req'd) | FY2003 $9,707,864K ✅ | **~3.42×** | Accept-relabel + P2 clamp FY2024 | `extract_gf.py`/`gen_state.py` (enumerated) |
| MT | GENERAL (1st of many) | thousands | Jun 30 | FY2016–2025 | FY2025 $3,453,804K ✅ | FY2016 $2,039,879K ✅ | ~1.29× | Accept-relabel | `extract_gf.py`/`gen_state.py` (enumerated) |
| NE | General Fund (1st of 7) | thousands | Jun 30 | FY2020–2025 | FY2025 $6,308,910K ✅ | FY2020 $4,993,719K ✅ | ~1.19× | Accept-relabel (near-parity) | `processCOAcfr.js`/`processINAcfr.js` |
| NV | General Fund (1st of 4) | **dollars** | Jun 30 | FY2019–2023 (FY24/25 gap) | FY2023 $15,153,168,081 ✅ | FY2019 $10,411,179,917 ✅ | ~2.87× | Accept-relabel; resolve recency gap at load | `processGAAcfr.js`/`processNCAcfr.js` (enumerated) |
| NH | General (1st of 5) | thousands | Jun 30 | FY2017–2024 | FY2024 $6,377,159K ✅ (via Wayback mirror) | FY2017 $4,207,160K ✅ | **~3.22×** | Accept-relabel; browser/Wayback fetch required | `processMDAcfr.js`/`processNCAcfr.js` |
| NM | General Fund (1st of 3) | thousands | Jun 30 | FY2019–2024 (FY2022 image-only, FY2023 gap) | FY2024 $30,530,269K ✅ | FY2019 $15,358,087K ✅ | ~3.06× | Accept-relabel; embed FY2022, discover FY2023 URL | `processGAAcfr.js`/`processNCAcfr.js` + NJ/CT embedded-data pattern |
| ND | General (1st of 5) | **dollars** | Jun 30 | FY2021–2025 | FY2025 $4,510,201,793 ✅ | FY2021 $3,955,670,947 ✅ | ~1.57× | Accept-relabel | `processCOAcfr.js`/`processINAcfr.js` |
| OK | General (1st of 4) | thousands | Jun 30 | FY2002–2024 | FY2024 $30,604,464K ✅ (re-verified, no rot) | FY2002 $9,568,595K ✅ | **~3.35×** | Accept-relabel, document prominently | `extract_gf.py`/`gen_state.py` (v2.14-preserved) |
| RI | General (1st of 4) | thousands | Jun 30 | FY2006–2025 | FY2025 $10,095,792K ✅ | FY2006 $4,585,920K ✅ | ~1.93× | Accept-relabel | `extract_gf.py`/`gen_state.py` (enumerated) |
| SD | General Fund (1st of 7) | thousands | Jun 30 | FY2002–2025 | FY2025 $2,423,413K ✅ | FY2002 $697,589K ✅ | ~1.03× (near-parity) | Accept-relabel (minimal divergence) | `extract_gf.py`/`gen_state.py` (cleanest derivable) |
| VT | General Fund (1st of 7) | **dollars** | Jun 30 | FY2015–2025 | FY2025 $2,543,030,123 ✅ | FY2015 $1,392,033,404 ✅ | ~1.01× (near-parity) | Accept-relabel (minimal divergence) | `extract_gf.py`/`gen_state.py` (browser UA required) |
| WV | General (1st of 5) | thousands | Jun 30 | FY2020–2025 (shallow) | FY2025 $14,639,897K ✅ | FY2020 $10,760,376K ✅ | **~3.52×** | Accept-relabel, document prominently | `extract_gf.py`/`gen_state.py` (enumerated media IDs) |
| WY | General Fund (1st of 6) | **dollars** | Jun 30 | FY2005–2025 | FY2025 $4,027,001,270 ✅ | FY2005 $1,590,602,744 ✅ | ~2.43× | Accept-relabel; flag investment-income driver | `extract_gf.py`/`gen_state.py` (enumerated, P2 monitoring) |

---

## DEEP-05 deepening summary

Pulled from 117-DEEPEN-SOURCES.md. **Premise correction:** the phase objective's stated windows (CA
pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016) were stale — Phase 104 (v2.12) already deepened
CA/NY/FL and Phase 99-01 (v2.11) already closed the TX FY2016 gap. This recon dug below the *actual*
current windows, verified live.

| Target | Actual current window (pre-recon) | New durable old-end reached | Added FYs | Units | Pre-GASB-34 flag |
|--------|--------------------------------------|-------------------------------|-------------|-------|---------------------|
| **CA** | FY2008–FY2025 | **FY2002** | +6 (FY2002–2007) | thousands (unchanged) | **No** — FY2002 is already modern GASB-34 layout, identical shape to FY2008+ |
| **NY** | FY2003–FY2024 | No extension — FY2003 remains the floor | 0 | millions | N/A |
| **FL** | FY2021–FY2024 | **FY2003** (clean); FY2000–2002 durable but extraction-corrupted | +18 (FY2003–2020) | thousands (unchanged) | Deferred — clean block is post-GASB-34; FY2000-02 pre34 status unconfirmed pending PDF repair |
| **TX** | FY2015–FY2024 (already contiguous) | No extension found within budget — FY2015 remains the floor | 0 | thousands | N/A |

**Phase 122 load statement:** CA extends to FY2002–FY2025 (24yr, full public archive) via
`cafr{NN}.pdf`/`{YYYY}_cafr{NN}.pdf` naming; FL extends to FY2003–FY2024 (22yr) via a per-year filename
map with no single formula (probe both `cafr{YYYY}.pdf`/`{YYYY}cafr.pdf`); NY and TX add 0 new FYs
(both floors reconfirmed durable, not rotted). FL's FY2000–2002 (damaged-xref PDFs, durable URL but
`pdftotext` fails) is a documented repair-pending hole, optional for Phase 122. Existing CA/NY/FL/TX
ACFR rows are untouched by this recon (documentation only). $0 spend.

---

## Nodes remaining NASBO-served after this milestone (D-01 → Phase 123)

**Empty list — all 21 roster states triaged to RECON (zero STAY-NASBO-exception).** Once Phases
118–121 complete their loads, all 21 states join the 29 existing ACFR nodes: **"all 50 states on ACFR
— NASBO serves no live node."**

This is the honest restatement per D-01: "all states that have a clean GAAP ACFR are on ACFR; the
remainder stay on labelled NASBO fallback" — in this milestone's case, the remainder is the empty set.
Two states (NV, NM) carry load-time window gaps (NV: FY2024/FY2025 not yet published; NM: FY2023 URL
undiscovered, FY2022 image-only) that are Phase-120 load-time decisions, not STAY-NASBO dispositions —
if either state's load phase cannot resolve its gap and must accept a partial window, that state still
lands on ACFR (ACFR-sourced FY2019–2023 for NV, FY2019–2024 minus the FY2022 caveat for NM), just with
an honestly-labelled shallower window than the other 19. Neither scenario adds an entry to this list.
`scripts/loadStateGF.mjs` (the NASBO fallback) is retired to guarded fallback-only status by Phase 123
regardless, per NASBORT-01 — it stays in the codebase as a documented dormant fallback (deferred item,
not deleted) but serves zero live nodes once Phases 118–121 land.

---

## NASBO-replace rule

Restated from the 107-RECON precedent, applying to all 21 roster states:

1. **Operating replacement:** the ACFR operating loader writes `dataset_type='operating'` keyed on
   `(municipality_id, fiscal_year, 'operating')`. The never-overwrite guard checks for existing ACFR
   provenance first; the existing NASBO rows for that state-FY are replaced by the ACFR GAAP actuals.
   One basis per state-FY (GAAP wins where ACFR exists).
2. **Revenue is a pure insert:** `dataset_type='revenue'` is new on all 21 roster nodes (no NASBO
   revenue exists on any of them, confirmed by the D-10 probe). Pure insert — auto-enables the "Money
   In" view and `?dataset=revenue` deep-link with zero frontend work.
3. **Idempotent, never-overwrite:** a re-run of any Phase 118–121 loader produces 0 net new rows.
4. **Scoped to roster states only:** each per-state loader targets its own `municipality_id`; it
   cannot write to any other state's node (untouched-nodes contract, above).
5. **The 29 existing ACFR nodes are untouched** except the 4 DEEP-05 targets (CA/NY/FL/TX), which
   Phase 122 extends within their own existing nodes — no new rows outside those 4 nodes' own
   `municipality_id`.
6. **Un-upgraded states have none remaining** — see the empty NASBO-served list above; once Phases
   118–121 complete, `loadStateGF.mjs` serves zero live nodes and Phase 123 formally retires it to
   guarded fallback-only.
7. **AK pre-load cleanup exception:** unlike the other 20 roster states (which need no stale-metadata
   cleanup, confirmed 0 `data_sources` rows), AK's loader must first DELETE the 2 orphaned
   `ak-ugf-revenue`/`ak-ugf-operating` `data_sources` rows (see Overlap Resolution, above) before
   writing its new `ak-acfr-operating`/`ak-acfr-revenue` rows.

---

## Open Risks for 118–123

### Non-June FY-ends
**None** — all 21 roster states confirmed June 30 FY-end (ME and WY were flagged pre-recon as
"non-June to watch"/biennial risks; both empirically disproven — ME is June 30, WY's biennial cycle is
budget-only, its audited ACFR is annual). MT and ND's biennial *budget* cycles are likewise confirmed
not to affect their *annual* GAAP ACFR reporting.

### Scope-relabel confirmations (D-09)
All 21 states require accept-and-relabel at load time (TX precedent), ranging from near-parity (SD
~1.03×, VT ~1.01×) to the widest scope divergence found in the entire ACFR cohort to date (**AR
~3.96×**). Other wide cases: WV ~3.52×, OK ~3.35×, MS ~3.42×, NH ~3.22×. One narrower-than-NASBO case:
**HI ~0.95×** (Med-Quest/Medicaid Special Revenue Fund reported separately) — requires an explicit
GF-alone-vs-composite load-time call (UT precedent, v2.14). Chris confirms magnitude + basis at
Phase-118–121 load and UAT (Phase 124).

### P2-clamp anticipations (D-08.2)
| State | FY at risk | Issue |
|-------|-----------|-------|
| MS | FY2024 | Investment income = −$434,060K (material negative), Rentals = −$338K — **P2 clamp required** |
| NM | FY2022 | Investment Income (Loss) = −$91,222K — **P2 clamp required if FY2022 loaded** |
| NE | FY2020 | "Other Taxes" = −$193K (minor, immaterial) |
| WY | Every load year | GF carries large investment-income exposure (Permanent Mineral Trust Fund) — recommend P2 clamp monitoring at every year, not just bookends |
| AK, AR, DE, HI, ID, IA, KS, ME, MT, ND, OK, RI, SD, VT, WV | Bookend years | All confirmed positive at both bookends; check interior years at load (routine, low risk) |
| NV, NH | Bookend years | Both positive; low risk |

### Units traps
| State | Trap |
|-------|------|
| ID | MIXED units — whole dollars confirmed FY2004, thousands confirmed FY2015+; exact transition year unpinned. Loader MUST verify per-year (check statement header) before scaling. |
| NV, ND, VT, WY | Report in **dollars**, not thousands — do NOT apply a default ×1,000 scaling assumption. |

### Soft-404 / access-mechanism cautions
| State | Issue |
|-------|-------|
| DE | `accountingfiles.delaware.gov` WAF rejects requests lacking a `Referer` header — returns HTTP 200 + 245-byte "Request Rejected" HTML (soft-404). Loader must set `Referer` header; Content-Type + size filters both independently catch it. |
| NH | `das.nh.gov` is Akamai-edge-blocked for automated fetches (HTTP 403, all UA/header variants tried) — harder block than the `tn.gov` precedent. Loader must implement a browser-download step or fetch via Wayback Machine mirror (`web.archive.org/web/{ts}if_/...`), which is not blocked. |
| VT | `finance.vermont.gov` returns HTTP 403 to a bare `curl` UA — resolved by a browser User-Agent (same class of quirk as `tn.gov`). |
| ID | `sco.idaho.gov`'s live archive page is JS-rendered; used Wayback CDX enumeration to find filenames, then confirmed each live directly. |
| NM | Landing page does not itself link the current ACFR; located via Wayback CDX enumeration of `wp-content/uploads/`. |

### Pre-GASB-34 flags
None of the 21 new roster states cross the FY2002 GASB-34 boundary within their confirmed clean
windows (all windows start at FY2002 or later, already in modern layout). For DEEP-05: CA's new
FY2002 floor is itself the GASB-34 boundary year (already modern layout, no flag needed); FL's
FY2000–2002 pre34 status is unconfirmed pending a PDF-repair pass (deferred, not applied); NY and TX
had no extension this pass.

### Recency-floor blockers
| State | Gap | Disposition |
|-------|-----|--------------|
| NV | FY2024/FY2025 not found under any tested filename variant; site under "remediation" | Re-check at Phase-120 load; if still absent, load FY2019–2023 and leave the latest year(s) NASBO-sourced with an honest label until NV publishes. Does not disqualify NV from the roster. |
| NM | FY2023 URL not discovered within the D-04 budget (opaque, non-pattern filenames) | Phase-120 loader should crawl the live site to find FY2023 before falling back to a partial window. Does not disqualify. |

### AK data_sources residue (see Overlap Resolution)
AK carries 2 orphaned `data_sources` rows (`ak-ugf-revenue`, `ak-ugf-operating`) with no matching
`budgets` data — flagged for Phase 118 pre-load cleanup (delete before writing new ACFR
`data_sources` rows).

### Naming / enumeration requirements
The large majority of the 21 states (all except ME, NE, ND, SD which have fully or near-fully
derivable per-year URL patterns) require an explicit per-year SOURCES map — opaque IDs (KS, WV,
Iowa's ePrints numeric IDs, RI's Drupal date-stamped paths), varying/non-derivable filenames (MS, MT,
WY), or naming-era exceptions within an otherwise-derivable pattern (AK cafr→acfr switch, DE
cafr→acfr switch, ME's FY2020 `v2_0` suffix, ND's FY2021 `-nd` suffix, VT's FY2019/FY2020 exceptions,
NH's `_acfr` suffix at FY2023, OK's current-year filename break). Each is documented in the per-batch
SOURCES docs' Section 6/7 gap logs and load notes.

---

## Success-criteria coverage

### Phase 117 ROADMAP success criteria (5 truths)

1. **Overlap probe confirms non-NASBO state nodes among the 21 roster states, recommends in-place
   upgrade or "none found."** → **SATISFIED.** Read-only probe of all 21 states; 20/21 clean NASBO-only
   ("none found"); AK flagged with a distinct finding (orphaned `data_sources` residue, cleanup not
   in-place-upgrade — no live custom-source node exists to upgrade).
2. **Probe confirms the 29 existing ACFR nodes + un-upgraded states are left undisturbed by Phases
   118–122 (untouched-nodes contract).** → **SATISFIED.** 29 ACFR nodes enumerated from the DB;
   contract recorded: Phases 118–121 touch only the 21 roster states, Phase 122 touches only the 4
   DEEP-05 nodes (extending, not duplicating), the other 25 ACFR nodes stay untouched.
3. **Final roster locked, drawn only from the named 21 (D-11 no backfill); each state marked RECON or
   STAY-NASBO-exception; count floats down honestly.** → **SATISFIED.** Roster Lock table above: all 21
   marked RECON, zero exceptions, count holds at 21 (no float-down needed — a perfect pass, not a
   substitution).
4. **118–121 batch split confirmed per D-12, rebalanced around any STAY-NASBO-exception survivors.**
   → **SATISFIED.** Batch Split Confirmation table above: 118=AK/AR/DE/HI/ID, 119=IA/KS/ME/MS/MT,
   120=NE/NV/NH/NM/ND, 121=OK/RI/SD/VT/WV/WY — unchanged from the roadmap since zero exceptions exist,
   no rebalancing needed.
5. **Explicit "nodes remaining NASBO-served after this milestone" list produced — the Phase 123
   input contract.** → **SATISFIED.** List is empty: "all 50 states on ACFR — NASBO serves no live
   node." Phase 123 (NASBORT-01) retires `loadStateGF.mjs` to guarded fallback-only with no exception
   nodes to preserve.
6. **Non-June FY-ends, GF-alone scope divergences, units traps rolled up into an Open Risks section.**
   → **SATISFIED.** Open Risks section above covers non-June FY-ends (none found), scope-relabel
   confirmations (D-09, all 21 states), P2-clamp anticipations (D-08.2), units traps (D-08.1), soft-404/
   access cautions, pre-GASB-34 flags, recency-floor blockers, and naming/enumeration requirements.
7. **117-RECON.md consolidates the batch docs + deepening doc into a decision-ready Phase 118–123
   handoff mirroring the Phase 98/103/107 RECON shape, $0 spend, no-DB-write confirmed.** →
   **SATISFIED.** This document. $0 spend (no AI, `pdftotext`/`curl` in the batch recons + `node`
   read-only DB queries in this consolidation). No DB writes — every probe query was `SELECT`.

### RECON-11 coverage

- [x] Per-state ACFR source located (GF statement, column, units, FY-end) for all 21 roster states
- [x] Durable per-year URL pattern (or explicit enumeration requirement) recorded for each state
- [x] Bookend tie-confirmed at both ends of each state's window (all $0 diff, one hand-verified
      mid-window tie for NM's image-only FY2022)
- [x] Four risk facts (D-08) pinned per state: units, negative GF lines, exact column header +
      statement, FY-end month
- [x] Roster locked with clean window recorded per state; 0 exceptions (D-11 no-backfill honored)
- [x] Batch split confirmed per D-12 (no rebalancing needed)
- [x] DEEP-05 deeper-history URLs located + bookend-tied for CA/FL (extended) and NY/TX (floor
      reconfirmed, 0 extension found)
- [x] Overlap resolution (D-10): read-only probe, in-place-upgrade recommendation framework applied
      (none needed; AK cleanup flagged)
- [x] Untouched-nodes contract written and confirmed against the DB
- [x] "Nodes remaining NASBO-served" list produced for Phase 123 (empty)
- [x] Gap log written for each state (per-batch SOURCES docs)
- [x] $0 spend confirmed; no DB writes confirmed (read-only SELECT only)
