# Phase 85 — City Loads — Context

**Phase goal:** Every Ohio city that files reporting data is live on the tracker with operating + revenue and per-capita, across all available years.
**Requirements:** OHCITY-01, OHCITY-02
**Depends on:** Phase 84 (the `scripts/loadOhioAOS.js` single-city loader + `scripts/ohioAosDatasets.json` FY×basis manifest, both shipped + verified).

This phase mirrors the proven Virginia Phase 80 two-plan shape (`.planning/milestones/v2.7-phases/80-city-county-loads/`): plan 85-01 builds the bulk tooling and proves the whole roster via `--dry-run` + offline tests (no writes); plan 85-02 acquires the data, runs the live load, and verifies in-phase. Ohio is **cities-only** here — county governments + city→county linking are Phase 86.

The only genuinely new logic is (1) a city-enumeration export on the Phase 84 loader and (2) a batch driver that does the **per-city GAAP→CASH→MOD basis assignment** + roster loop. Everything else — `detectLayout`, the flat tree-builders, `importCity`, the never-overwrite guard, per-FY+basis source stamping, `resolveSourceUrl`, `cityPopulation` — is reused verbatim from Phase 84.

## Implementation Decisions

- **D-01: Live load covers the full FY2016–2025 range.** (User-locked.) All 10 available years per ROADMAP SC#1 ("across the available FY range"), not just the most-recent window. ≈235 cities × up to 10 FY × 2 datasets (operating + revenue). Idempotent + never-overwrite make re-runs and partial-then-resume safe. The batch driver loops `--fy` so the range is parameterised, not hardcoded.

- **D-02: Per-city basis precedence = GAAP → CASH → MOD.** (OHCITY-02.) For each (city, FY): if the city appears in that FY's GAAP workbook (`SOREACIFB_TotalGov`), load GAAP. Otherwise fall back to CASH, then MOD (both `SORDACIFB_TotalGov`, auto-handled by `detectLayout`). The first basis whose workbook contains the city wins; the chosen basis is recorded per (city, FY) in the run output. A city can therefore be GAAP in one year and CASH in another — mixed basis is tracked, not forced uniform.

- **D-03: Source-gap residual → committed `scripts/ohioCityResidual.json`.** (User-locked; OHCITY-02 "no phantom municipalities".) Cities that appear in a workbook's `OI_Demographics` roster but have **no financial row in any basis workbook for any FY** are written to a committed JSON residual file (durable provenance, mirroring `ohioAosDatasets.json`), NOT created as municipalities. The file records each absent city + the reason (e.g. "demographics-only, no SOREACIFB/SORDACIFB row in any FY").

- **D-04: Workbook acquisition = download from the manifest into gitignored `_oh-recon/`.** (Mirror Phase 84 + VA `_va-recon/`.) The batch driver resolves each FY×basis URL via `resolveSourceUrl(fy, basis)` and downloads to `_oh-recon/City_<FY>_<BASIS>_Summarized.XLSX` if absent; `--file-gaap/--file-cash/--file-mod` override per basis for offline runs. The XLSX files stay gitignored; `scripts/ohioAosDatasets.json` is the committed provenance record. FY2024 GAAP+CASH are already on disk from Phase 84.

- **D-05: Live writes run SERIALLY on the main tree** with the gitignored `.env` `SUPABASE_SERVICE_KEY` sourced. Writes are safe to repeat — the never-overwrite guard protects any richer pre-existing source and `importCity`/`importDataset` are idempotent. A failures log (`scripts/load-ohio-cities.failures.txt`) captures any per-city errors without aborting the whole run (mirrors the VA load logs).

- **D-06: Per-capita from each FY's `OI_Demographics`.** `cityPopulation` already reads the per-year demographics tab, so per-capita uses the population vintage that matches each FY — no single fixed vintage.

## Reused precedent / anchors

- `scripts/loadVAComparativeReport.js` + `scripts/loadVAComparativeReportBatch.js` — the closest analog (all-localities-in-one XLSX → batch roster loop). VA's `enumerateRoster` is the model for Ohio's `enumerateCities`.
- `scripts/loadOhioAOS.js` (Phase 84) — `detectLayout` (entityCol/dataStart for both GAAP + CASH/MOD), `buildExpenditureTree`/`buildRevenueTree`, `cityPopulation`, `cityCounty`, `importCity(supabase, workbook, opts)`, `resolveSourceUrl(fy, basis)`, the `findConflictingBudget` never-overwrite guard.
- `scripts/ohioAosDatasets.json` (Phase 84) — 30 FY2016–2025 × {GAAP,CASH,MOD} entries, floor=2016, all URLs HTTP-200 confirmed.
- Auto-memory `project_sync_city_budget_not_source_safe` — `treasury_sync_city_budget` overwrites; the pre-skip `findConflictingBudget` guard is mandatory (already in `importDataset`).

## Out of scope (Phase 86+)

- County governments (`OHCO-01`) + the Ohio state navigation node + city→county linking via the `County` column (`OHLINK-01`) — Phase 86.
- Category enrichment (`OHENR-01`) — Phase 87.
- Salaries — not in the AOS source at all (milestone constraint).
- Enterprise funds — milestone scope is governmental funds only (`*_TotalGov`).
