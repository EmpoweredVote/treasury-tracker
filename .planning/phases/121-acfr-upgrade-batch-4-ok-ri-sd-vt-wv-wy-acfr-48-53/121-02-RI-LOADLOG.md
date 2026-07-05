# 121-02 — Rhode Island ACFR Load Log (ACFR-49)

**Node:** 483f02b4-2167-4e3d-9f5c-0f3ed83be2e6 (Rhode Island, state)
**Units:** THOUSANDS (UNITS=1000) · **FY-end:** June 30 · **Statement:** Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL column (1st of 4)

> **Provenance note:** Task 1 (loader generation + dry-run tie) was committed by the executor in `541a48d`. The live load (Task 2) completed successfully against the production DB, but the executor's Task 2/3 commit + SUMMARY/LOADLOG were lost to an internal tool error before they were written. This log + the SUMMARY were reconstructed by the orchestrator from direct DB verification (below); the DB state is authoritative and correct.

## Load Disposition

- **FYs loaded:** FY2006–FY2025 (20 years, zero honest holes) — operating + revenue both datasets.
- **DB row counts (verified):** 20 operating + 20 revenue rows, all data_source `ILIKE '%ACFR%'`, **0 NASBO rows remaining**.
- **Bookend ties (live, revenue):** FY2025 = $10,095,792,000 ✓; FY2006 = $4,585,920,000 ✓ (both ×1,000, exact match to 117-BATCH4-SOURCES.md recon).
- **NASBO replacement:** pre-load NASBO operating rows FY2023 $5,075,000K + FY2024 $5,236,000K replaced in place at (483f02b4, fy, 'operating') — zero NASBO labels remain; exactly one operating row per (RI, fy).
- **Accept-relabel divergence:** RI ACFR GF ~1.93× NASBO (FY2025 ACFR $10.10B vs NASBO FY2024 $5.24B) — driven by a large Federal grants line (~45% of GF) consolidated into the GAAP General Fund (MD/GA mechanism). Accepted and relabelled honestly (GAAP basis label on every live row).
- **P2 clamp:** column header carries the "(loss)" possibility; both bookends positive. Any interior negative routes through clampForRender (loader-wired).
- **0-residue (LOAD-01):** 0 `data_sources` rows for `ri-acfr-gf-operating` / `ri-acfr-gf-revenue` after load — ephemeral lifecycle self-cleaned.
- **Money In:** auto-enabled (20 revenue rows present).
- **Idempotency:** loaders use the RPC-keyed (muni, fy, dataset) UPDATE-in-place + ephemeral data_sources lifecycle — a re-run is a no-op by construction (same pattern proven across Batch 1–3 + OK 121-01; RI FY2025 re-run recommended as a spot-confirm at Phase 124).
- **Cohort:** RI-scoped write only; existing ACFR nodes + un-upgraded NASBO states untouched (confirmed via 121-01 OK cohort spot-check earlier in this phase).

Hands RI to Phase 124 for independent re-derivation + cohort audit + Chris UAT.
