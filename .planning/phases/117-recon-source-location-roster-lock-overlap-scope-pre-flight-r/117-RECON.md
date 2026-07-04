# Phase 117 RECON — Source Location + Roster Lock + Overlap/Scope Pre-flight (RECON-11)

**Status:** IN PROGRESS — Task 1 (Overlap Resolution D-10 + untouched-nodes contract) complete.
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

*Task 1 (Overlap Resolution D-10 + Untouched-Nodes Contract) complete. Task 2 (Roster Lock, Batch
Split Confirmation, Per-state Summary, DEEP-05 Summary, NASBO-Served List, Open Risks,
Success-Criteria Coverage) follows below.*
