# Phase 99 — Execution Summary (CA + TX ACFR Upgrade)

**Executed:** 2026-06-29 (Wave 1 build via gsd-executor; Wave 2 live loads driven inline with Chris GO checkpoints). $0 spend (pdftotext only).

## Result: all 3 success criteria met; ACFR-01, ACFR-02, RECON-03 done; ACFR-05 verified on CA/TX.

### Wave 1 (99-01) — loaders built + dry-run validated (commit `ebf78a5`)
- `scripts/processCA.js` + `processCARevenueAcfr.js` (CA FY2020–2025), `scripts/processTX.js` + `processTXRevenueAcfr.js` (TX FY2015–2024), `scripts/cleanupStaleStateGFDataSources.mjs`.
- Copied from `processMN.js` (operating) + `processOHRevenueAcfr.js` (revenue, P2 clamp). Hand-transcribed per-FY GF column via `pdftotext -table`, every FY tie-checked to the printed control total (gate `exit 2` on mismatch, negative-tested).
- **TX FY2016 recovered**, not dropped: lives at `…/comprehensive-annual-financial/2016/docs/96-471.pdf` (the standard `…/2016/96-471.pdf` 404s).

### Wave 2 — live production loads (DB-verified via execute_sql, not loader self-report)
**California (99-02):** 12 budget rows — 6 operating + 6 revenue (FY2020–2025). Revenue FY2025 $221,591,201K / FY2020 $155,923,876K (exact ties); operating FY2025 $221,826,907K. `budget_categories` populated (operating 11 / revenue 15 per FY). NASBO FY2023/24 operating replaced by GAAP; revenue new. All GAAP-labelled + `sco.ca.gov`-sourced. Stale `ca-lao-gf-operating` + `ca-dof-gf-revenue` deleted (0-row assertion). Idempotent (re-run stayed 12 rows). CA had no negative categories.

**Texas (99-03):** 20 budget rows — 10 operating + 10 revenue (FY2015–2024 incl. FY2016). Revenue FY2024 $161,416,562K (exact GR-Fund tie). `budget_categories` populated. Honestly labelled "General Revenue Fund" (~3× NASBO TX GF $50.5B — a deliberate, sourced scope change Chris acknowledged). NASBO operating replaced by GAAP. Stale `tx-gf-operating` + `tx-gf-revenue` deleted. **P2 clamp (ACFR-05) fired on TX revenue FY2022**: investment income −$122,684K clamped to 0, signed magnitude in label, control total preserved.

## Notes / carry-forward
- **Cosmetic:** `ca-gf-operating-nasbo` + `tx-gf-operating-nasbo` data_source rows linger (now back 0 rows since ACFR replaced their data). Harmless (app keys budget rows by muni+fy+dataset, not data_source_id). The cleanup script deliberately refuses NASBO-named ids; left for Phase 102's audit to decide.
- **"Loaded 0 rows" log is cosmetic** — the RPC's leaf-insert counter; the render tree lands in `treasury.budget_categories` (the `budgets.hierarchy` text[] column is null on these nodes, same as the working MN/NASBO rows).
- Un-upgraded states untouched (loaders are state-scoped); full 50-node cohort audit + independent re-derivation + UAT = Phase 102.
- Downloaded ACFR PDFs cached in gitignored `_acfr-tmp/{ca,tx}/`.

## Next
Phase 100 (NY + FL) reuses this exact loader pair — NY needs ×1000 millions-scaling; same stale-`data_sources` cleanup pattern. Then 101 (Money-In view + `?dataset=revenue`), 102 (verify + audit + UAT).
