# 100-03 SUMMARY — Live FL ACFR load (FY2022–2024)

**Executed:** 2026-06-29 inline, under Chris's Wave 2 approval. $0 spend. DB-verified via `execute_sql`.

## Result: ACFR-04 + RECON-03 (FL) + ACFR-05 (FL, clamp FIRED) satisfied. v2.11 4-state cohort load complete.

### What landed on the FL state node (`adb19ea0-de7c-4cd5-9445-cbf2108a8a1a`)
- **6 budget rows**: 3 operating + 3 revenue, FY2022–2024.
- Operating: **0 NASBO / 3 ACFR** — NASBO FY2023 ($44.219B) + FY2024 ($51.649B) **replaced in place** by ACFR GAAP. FY2022 is a new operating row. FY2022 op `total_budget` = **$36,205,183,000**, FY2024 = **$50,141,014,000**.
- Revenue: **0 NASBO / 3 ACFR** — pure insert. Bookends tie: FY2022 = **$57,241,428,000**, FY2024 = **$59,810,603,000**.
- Like-for-like GF (no TX-style scope jump): FY2024 ACFR op $50.1B vs prior NASBO budgetary $51.6B — the expected GAAP-vs-budgetary spread.
- Every row stamped GAAP `data_source` (`Florida State ACFR — General Fund [Revenue] (FY{fy} actual, GAAP basis)`), per-year `source_url` (myfloridacfo.com `fye-{YYYY}-…`), `source_date` `{fy}-06-30`.
- Fresh data_sources: `fl-acfr-gf-operating` (ee83bc25…), `fl-acfr-gf-revenue` (03a2c1ab…).

### P2 clamp (ACFR-05) — FIRED on FL FY2022 revenue (the Phase-100 live clamp demonstration)
Production `budget_categories` for FY2022 revenue:
- Root `Florida General Fund Revenue` = $57,241,428,000.
- Positive leaves: Taxes $51.757B, Grants and donations $4.788B, Fees and charges $1.691B, Licenses and permits $450.3M, Fines/forfeits $185.4M.
- **Two clamped negatives, each rendered at amount 0** with signed label: `Investment earnings (losses) (net loss — shown at 0)` (true −$1,573,844,000) and `Other (net loss — shown at 0)` (true −$56,189,000).
- Net check: positive leaves $58,871,461,000 − negatives $1,630,033,000 = $57,241,428,000 = root total preserved ✓ (P2: area clamped to 0, magnitude in label, control total preserved).

### Stale data_sources cleanup (--apply)
Deleted `fl-gf-operating` (pdf_download) + `fl-gf-revenue` (pdf_download), each 0-row-asserted. `fl-gf-operating-nasbo` left untouched.

### Idempotency (D-14, SC#2)
Re-ran both FL loaders → still 3 operating + 3 revenue (0 net-new). Cleanup re-run `--apply` → **0 deleted, 2 already-gone**.

### Scope safety
Writes scoped to muni `adb19ea0…` only. NY (100-02), CA/TX (Phase 99), and the 46 NASBO states untouched.

## Phase 100 status
All 3 success criteria met across NY + FL: ACFR-sourced rev-by-source + spend-by-function (GAAP basis-labelled, each FY tying to the ACFR General-column total); NASBO operating replaced idempotently (never-overwrite); negative-category years render via the P2 clamp (FL FY2022). The independent re-derivation, full 50-node cohort source-chain audit, and live UAT are Phase 102.
