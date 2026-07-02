# Phase 111 — Research: Loader Debt — Atomic data_sources Upsert (LOAD-01)

**Researched:** 2026-07-02 (inline, no subagents — per project rule)
**Status:** RESEARCH COMPLETE
**Question:** Why does every `process*Acfr.js` run leave WR-05 "residue" `data_sources` rows, and what template-level fix makes a full run — including an idempotent re-run — leave 0 residue with no manual re-clean?

---

## Root Cause (definitive, verified against live schema)

The WR-05 residue is **not** primarily an atomicity bug. It is a **lifecycle mismatch**: the loaders create a *persistent* `data_sources` row that the architecture guarantees can never be referenced, so the cohort audit's residue probe (INV-2) flags it on every run, forever.

The chain of facts, each verified this session:

1. **The residue probe (INV-2)** in `scripts/verify-phase110-cohort-audit.mjs:147-167` defines residue as: any `treasury.data_sources` row with `dataset_id LIKE '%-gf-%'` (excluding 6 `CITY_PREFIXES`) that has **0 `treasury.budgets` rows referencing it via `budgets.data_source_id`**.

2. **`budgets.data_source_id` FKs to `source_registry`, NOT `data_sources`** (comment in `supabase/migrations/20260614_city_budget_source_attribution.sql:9`; Phase 44 loader contract in STATE.md). A loader-created `data_sources` row therefore **cannot ever** be referenced by the probe's join. State budget rows use text-stamp provenance (`data_source`, `source_url`, `source_date` columns; `data_source_id = null` — asserted by INV-5).

3. **The RPC requires the row.** `public.treasury_sync_budget_tree` (migration `20260613120000`) takes `p_data_source_id`, and reads `v_ds.municipality_id` (budget row lookup/insert), `v_ds.name` (budget `data_source` text), `v_ds.column_mapping->'hierarchy_columns'`, and `v_ds.fiscal_year_start_month` from the `data_sources` row. It also writes `sync_logs` rows FK'd to it and updates its `sync_status`. So the row **cannot simply be not-written** — it is the RPC's parameter vehicle.

4. **Therefore the "clean" state = 0 state-loader rows in `data_sources`.** This matches history: Phase 106 deleted 10 (`{ca,fl,il,ny,pa}-acfr-gf-*`), Phase 110 deleted 20 (`{nj,ma,nc,ga,md,tn,ct,wi,wa,mi}-acfr-gf-*`), and the live baseline today (probed 2026-07-02) shows only the 6×2 city rows — every state row at 0.

5. **Deletion is safe and self-contained.** `sync_logs.data_source_id → data_sources.id` is `ON DELETE CASCADE` (live pg_constraint probe). `data_sources.municipality_id → municipalities` is outbound only. Nothing on the read path uses these rows: `grep data_sources src/` = 0 hits (source chip reads the text-stamped budgets columns — confirmed in 106/110 audits). Prior manual cleanups deleted these rows with zero side effects.

6. **The secondary (true atomicity) defect:** there is **no unique constraint on `data_sources.dataset_id`** (live probe: only PK + check constraints). The loaders' check-then-insert uses `.maybeSingle()`, which **errors if duplicates exist** — so a race or crashed half-run can wedge the loader. `upsert(onConflict: 'dataset_id')` is not available without a migration adding the constraint.

## Chosen Fix: Ephemeral data_sources lifecycle (template-level)

Treat the `data_sources` row as what it actually is — a transient RPC parameter vehicle:

```
START (non-dry-run):  DELETE FROM data_sources WHERE dataset_id = <this loader's id>   -- self-heals residue from any crashed prior run
                      INSERT fresh row → ds
PER FY:               rpc treasury_sync_budget_tree(ds.id, ...)  → stamp budgets source columns   (unchanged)
END (after FY loop):  DELETE FROM data_sources WHERE id = ds.id                        -- leaves 0 residue
```

Why this beats the alternatives:

| Option | Verdict |
|--------|---------|
| `upsert(onConflict)` (the WR-05 note's literal suggestion) | **Insufficient** — needs a migration for the unique constraint, and the row would *still* be unreferenced → INV-2 still flags it. Atomic ≠ residue-free. |
| Stop writing the row entirely | **Impossible** — the RPC requires it (fact 3). |
| Link `budgets.data_source_id` to it | **Impossible** — that FK targets `source_registry` (fact 2). |
| Redefine INV-2 in the audit | **Wrong layer** — moves the goalposts instead of fixing the loader; criterion 2 explicitly uses the existing probe as the measuring stick. |
| **Ephemeral create→use→delete** | **Correct** — deterministic 0-residue after every successful run, self-healing after crashed runs, no migration, no RPC change, budgets writes untouched. |

**Accepted edge:** loaders exit via `process.exit(2)` on error (which skips `finally`), so a *crashed* run leaves its row until the next run's start-delete self-heals it. A lingering row is then a useful signal of a crashed run. Documented, not gated.

**Concurrency note:** loaders are run serially by hand (per-FY retry loops); two concurrent runs of the same state+dataset are out of contract.

## Scope of application

- **All 34 `scripts/process*Acfr.js`** (17 states × op+rev, incl. custom variants MI/NY — verified the `data_sources` block is byte-similar across NJ/MI/WI/NJ-rev). These ARE the template: v2.14 phases 113/114 clone new states from them, and phase 115 re-runs MA/CT/NJ/WI loaders.
- **`scripts/loadStateGF.mjs`** (NASBO fallback, stays in service): same pattern at lines 1593-1603, writes `{abbr}-gf-operating-nasbo` — same residue class (its find is by `(municipality_id, api_type, dataset_type)`; its lifecycle is per-state inside the state loop, so create/delete per state iteration).
- **NOT in scope:** city loaders (the 6 CITY_PREFIXES rows are probe-excluded, different contract), the RPC itself, any schema migration, `budgets` writes.

## Proof design (success criterion 2)

The 108-closure NJ re-run is the precedent. Proof = before/after around a live re-run:

1. **Before:** `node scripts/verify-phase110-cohort-audit.mjs` → exit 0 (baseline clean — confirmed live today); snapshot NJ budgets (row count, per-FY totals, source stamps).
2. **Run fixed loaders live:** `source .env; node scripts/processNJAcfr.js --fy 2025; node scripts/processNJRevenueAcfr.js --fy 2025` (guarded never-overwrite path; expect 0 net change — 110 precedent).
3. **After:** re-run the audit → exit 0 **with no manual re-clean** (previously required deleting `nj-acfr-gf-*` by hand); NJ snapshot identical.

Cost: $0 (no AI usage; Supabase free-tier queries only).

## Validation Architecture

- **No test framework** applies to these standalone loader scripts (no jest/vitest harness in scripts/). Validation is: `node --check` (syntax) on all 35 modified files, `--dry-run` smoke of a representative loader, live NJ idempotency re-run, and the existing read-only audit script as the residue oracle.
- **Quick check:** `for f in scripts/process*Acfr.js scripts/loadStateGF.mjs; do node --check "$f" || exit 1; done`
- **Full check:** `node scripts/verify-phase110-cohort-audit.mjs` (read-only, exit 0/2)
- **Manual-only:** none — everything is CLI-verifiable.

## Key files

| File | Role |
|------|------|
| `scripts/processNJAcfr.js:178-184,208` | Canonical instance of the defective block (select→maybeSingle→update/insert + trailing last_synced_at update) |
| `scripts/loadStateGF.mjs:1586-1603,1627` | NASBO variant of the same block |
| `scripts/verify-phase110-cohort-audit.mjs:147-167` | INV-2 residue probe (the oracle — do not modify) |
| `supabase/migrations/20260613120000_add_budget_period_label.sql` | `treasury_sync_budget_tree` definition (reads v_ds; do not modify) |
