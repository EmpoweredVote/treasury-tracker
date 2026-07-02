# Phase 111 — WR-05 Residue Proof (LOAD-01)

**Executed:** 2026-07-02 · **Spend:** $0 (no AI usage; Supabase free-tier queries only)

## Root cause (one paragraph — full analysis in 111-RESEARCH.md)

`budgets.data_source_id` FKs to `source_registry`, not `data_sources`, and state budget rows carry text-stamp provenance (`data_source_id = null`) — so a loader-created `data_sources` row can **never** be referenced, and the cohort audit's INV-2 rightly treats any persistent state `*-gf-*` row as residue. The RPC `treasury_sync_budget_tree` still requires the row as its parameter vehicle (it reads `municipality_id`, source name, `column_mapping`, `fiscal_year_start_month` and writes cascade-FK'd `sync_logs`). The fix (commit `f713d3d`): all 34 `process*Acfr.js` + `loadStateGF.mjs` now use an **ephemeral lifecycle** — delete stale by exact `dataset_id` (self-heals crashed runs) → insert fresh → RPC/stamp unchanged → delete by `id` at end of run.

## Proof structure

Criterion 2: "A live idempotency re-run of an existing loader leaves 0 residue rows with no manual re-clean — proven by the cohort-audit residue probe run before and after." Loaders re-run: NJ FY2025 op + rev (the 108-closure / Phase-110 precedent).

## BEFORE (baseline, 2026-07-02)

- `node scripts/verify-phase110-cohort-audit.mjs` → **10/10 PASS, exit 0** (INV-2: "0 state *-gf-* data_sources with 0 referencing live rows (0 checked)")
- `data_sources` rows with `dataset_id LIKE '%-gf-%'`: **12** — exactly the 6 probe-excluded city pairs (anaheim/fresno/longbeach/riverside/sanjose/santa-ana × op+rev); **0 state rows**
- NJ snapshot: **12 rows** (6 operating + 6 revenue, FY2020–2025), all with full text-stamp provenance; FY2025 operating `$59,603,886,014` / revenue `$60,979,024,211`; FY2025 tree checksums: operating 12 categories / Σ `$119,207,772,028`, revenue 8 categories / Σ `$121,958,048,422`

## LIVE RE-RUN (fixed loaders, guarded never-overwrite path)

```
node scripts/processNJAcfr.js --fy 2025          → "Loaded 0 rows for FY2025", TOTAL 59,603,886,014, "Stamped source", exit 0
node scripts/processNJRevenueAcfr.js --fy 2025   → "Loaded 0 rows for FY2025", TOTAL 60,979,024,211, "Stamped source", exit 0
```

Each run created its ephemeral `nj-acfr-gf-*` data_sources row, passed it to the RPC, and deleted it at end of run.

## AFTER (no manual cleanup performed — this is the entire point)

- `node scripts/verify-phase110-cohort-audit.mjs` → **10/10 PASS, exit 0** — INV-2 clean **with zero manual deletions in between** (contrast: Phase 106 required hand-deleting 10 residue rows, Phase 110 required 20)
- `data_sources` `%-gf-%` listing: **12 rows, 0 state rows** — identical to baseline; the loaders cleaned up after themselves
- NJ snapshot: **identical** — 6+6 rows FY2020–2025; operating Σ `$302,491,549,524` and revenue Σ `$327,011,892,940` across all FYs match the per-FY baseline exactly; FY2025 tree checksums unchanged (op 12/`$119,207,772,028`, rev 8/`$121,958,048,422`); INV-1 confirms all 506 cohort rows still fully basis-stamped

## Verdict

| Success criterion | Result |
|---|---|
| 1. Root cause fixed at template level, inherited by every loader this milestone runs | **PASS** — all 34 `process*Acfr.js` (the clone template for phases 113/114, incl. the phase-115 MA/CT/NJ/WI loaders) + `loadStateGF.mjs` converted (commit `f713d3d`); 0 `maybeSingle` check-then-insert remains |
| 2. Idempotency re-run leaves 0 residue, no manual re-clean, probe-proven before/after | **PASS** — audit exit 0 → live NJ op+rev re-run → audit exit 0, zero manual deletions |
| 3. Existing loaded data unchanged | **PASS** — NJ row count / per-FY totals / tree checksums / stamps byte-identical; city data_sources rows untouched; diff audit confirmed 0 budgets/RPC code lines changed |
