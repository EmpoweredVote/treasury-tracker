# 100-02 SUMMARY — Live NY ACFR load (FY2015–2024)

**Executed:** 2026-06-29 inline, after Chris approved the Wave 2 live loads ("Approve both"). $0 spend. DB-verified via `execute_sql` (not loader self-report).

## Result: ACFR-03 + RECON-03 (NY) + ACFR-05 (NY, wired) satisfied.

### What landed on the NY state node (`1a7f871c-7f2e-4786-9c55-5ab3409716f4`)
- **20 budget rows**: 10 operating + 10 revenue, FY2015–2024.
- Operating: **0 NASBO / 10 ACFR** — the NASBO FY2023 ($84.474B) + FY2024 ($91.070B) rows were **replaced in place** by ACFR GAAP (same `(muni,fy,'operating')` key; RECON-03). FY2015–2022 are new operating rows.
- Revenue: **0 NASBO / 10 ACFR** — pure insert (new on this node; feeds Phase 101 Money In).
- Bookends tie in production (millions ×1,000,000): FY2015 rev `total_budget` = **$55,139,000,000**; FY2024 = **$93,894,000,000**.
- `budget_categories` populated: operating 130 rows, revenue 64 rows (10 FYs each). FY2024 revenue leaves (Miscellaneous $36.898B, Personal income $32.681B, Business $10.98B, Consumption/use $9.407B, Federal grants $2.249B, Other $1.679B) sum exactly to the $93.894B root.
- Every row stamped: `data_source` = `New York State ACFR — General Fund [Revenue] (FY{fy} actual, GAAP basis)`, `source_url` = per-year osc.ny.gov finance ACFR (FY≤2021 `comprehensive-annual-…`, FY≥2022 `annual-comprehensive-…`), `source_date` = `{fy}-03-31`.
- Fresh data_sources created: `ny-acfr-gf-operating` (b34a4380…), `ny-acfr-gf-revenue` (a2f7f5bf…).

### Stale data_sources cleanup (--apply)
Deleted `ny-gf-operating` (xlsx_download) + `ny-gf-revenue` (xlsx_download), each re-asserted to back **0** budgets rows before deletion. `ny-gf-operating-nasbo` left untouched.

### Idempotency (D-14, SC#2)
Re-ran both NY loaders → still 10 operating + 10 revenue rows (0 net-new; RPC updates in place). Re-ran cleanup `--apply` → **0 deleted, 2 already-gone**.

### P2 clamp (ACFR-05)
NY's GENERAL column has **no negative revenue categories** in FY2015–2024 (investment income is inside the positive "Miscellaneous" line), so the wired clamp does not fire on NY — same as CA in Phase 99. The live clamp demonstration for Phase 100 is on FL FY2022 (see 100-03).

### Scope safety
Writes were scoped to muni `1a7f871c…` only (explicit id; `treasury_sync_budget_tree`, never the city RPC). CA/TX (Phase 99) and the 46 NASBO states untouched — confirmed FL still pending at this point.

### "Loaded 0 rows" note
Cosmetic — the RPC's leaf-insert counter; the render tree lands in `treasury.budget_categories` (verified above), same as the working CA/TX/MN/NASBO rows.

## Next
100-03 (live FL load FY2022–2024 + FL cleanup + clamp verification).
