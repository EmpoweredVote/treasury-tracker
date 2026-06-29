# Phase 100: New York + Florida ACFR Upgrade - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** Derived from Phase 98 recon (`98-RECON.md` + `98-ACFR-SOURCES.md`) + the proven Phase 99 CA+TX execution — no separate discuss-phase needed (recon located both ACFRs, tie-confirmed bookends, and Chris approved the upgrade-in-place pattern for all four states).

<domain>
## Phase Boundary

Apply the proven Phase 99 path to **New York** and **Florida**: load General Fund **revenue-by-source** + GAAP **spending-by-function** from their ACFRs, as deep as each cleanly extracts, **replacing** the existing NASBO operating rows idempotently (RECON-03). NY and FL each upgrade their single existing state node in place (mirrors CA — no duplicate entity, no MA-style dual-node).

**In scope:** NY + FL only; the GF column of each year's ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (GAAP, audited actuals); operating (spend-by-function) + revenue (rev-by-source) datasets; idempotent NASBO-replace; P2 negative-category clamp; basis-labelled + durably sourced rows; the NY + FL stale-`data_sources` cleanup (extend the Phase-99 cleanup script).

**Out of scope:** CA + TX (done — Phase 99); the "Money In" revenue-view UI + `?dataset=revenue` robustness (Phase 101); independent re-derivation audit + full-cohort source-chain audit + UAT (Phase 102); budgetary/forecast figures; any state other than NY/FL; deeper history below each confirmed window.
</domain>

<decisions>
## Implementation Decisions (locked by recon + the Phase 99 proof)

### New York (ACFR-03)
- **D-01:** Upgrade the **single existing NY state node in place** (`municipalities.id = 1a7f871c-7f2e-4786-9c55-5ab3409716f4`, `entity_type='state'`). No new entity (recon: NY mirrors CA's single-node pattern).
- **D-02:** Window **FY2015–FY2024** (10 FYs). Per-year URL under `https://www.osc.ny.gov/files/reports/finance/pdf/`: FY≥2022 = `annual-comprehensive-financial-report-{YYYY}.pdf`; FY≤2021 = `comprehensive-annual-financial-report-{YYYY}.pdf`. Use the **finance/reports** State ACFR, NOT the NYSLRS (pension) ACFR. Extract the full window now (bookends already tie-confirmed in recon).
- **D-03:** GF column header = "General" (1st numeric col). **Units = millions** — multiply each printed figure by **1,000,000** to store dollars. (This is the extra ×1000 vs the thousands-based CA/TX/FL template — the single NY-specific extraction nuance the recon flagged.) FYE = Mar 31 → `source_date = {FY}-03-31`. Statement at printed p.43 / PDF p.43–44.
- **D-04:** **Delete** the 2 stale v1.7 `data_sources` (`ny-gf-operating` xlsx_download, `ny-gf-revenue` xlsx_download — both back **0** budgets rows). Create fresh `ny-acfr-gf-operating` + `ny-acfr-gf-revenue`. NY revenue source of record = the **ACFR** (GAAP).
- **NY negative categories:** the recon flagged NY (like CA) has negative investment-income years → the P2 clamp (ACFR-05) is expected to fire on NY revenue. Verify it triggers.

### Florida (ACFR-04)
- **D-05:** Upgrade the **single existing FL state node in place** (`municipalities.id = adb19ea0-de7c-4cd5-9445-cbf2108a8a1a`, `entity_type='state'`). Window **FY2022–FY2024** (3 FYs) — the confirmed clean window (durable `fye-{YYYY}-…` naming starts FY2022). Per-year URL = `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf`.
- **D-06:** GF column header = "General Fund" (1st numeric col). **Units = thousands** — ×1,000 to dollars (same as CA). FYE = Jun 30 → `source_date = {FY}-06-30`. Statement at printed p.34 / PDF p.33–35. FL has **no** TX-style scope mismatch — it is a like-for-like GF (FY2024 ACFR $59.8B vs NASBO $51.6B, the expected ~16% GAAP-vs-budgetary spread).
- **D-07:** **Delete** the 2 stale v1.7 `data_sources` (`fl-gf-operating` pdf_download, `fl-gf-revenue` pdf_download — both back **0** budgets rows). Create fresh `fl-acfr-gf-operating` + `fl-acfr-gf-revenue`.

### Loaders (reuse — RECON-03)
- **D-08:** Build `processNY.js` + `processNYRevenueAcfr.js` and `processFL.js` + `processFLRevenueAcfr.js`. The closest concrete analogs are the **Phase 99 CA loaders** (`scripts/processCA.js` / `scripts/processCARevenueAcfr.js`) — already the state-ACFR shape (per-FY `SOURCES` map, GF page-finder, GF column index, units multiplier, tie-check gate, post-RPC source stamp, P2 clamp). FL is the closest copy of CA (both thousands, same statement). NY = the CA shape + the millions multiplier (D-03) + the dual URL-naming rule (D-02). Original templates `processMN.js` (operating) / `processOHRevenueAcfr.js` (revenue, has the clamp) remain the upstream reference.
- **D-09:** **Extraction = `pdftotext -table`** (NOT `-layout`, which floats numbers to wrong rows). Each FY's extracted GF-column category sum MUST tie to the ACFR printed Total (revenue → "Total revenues"; operating → "Total expenditures") within $10M before writing; `validate(fy)` returns false and the loader `process.exit(2)` on mismatch — refuse to write. Light cleanup (`-f`/`-l` page range) before dropping any FY; gap-log any dropped FY.
- **D-10:** $0 spend — pdftotext only, no AI calls.

### NASBO-replace semantics (RECON-03)
- **D-11:** **Operating replace:** write `dataset_type='operating'` keyed on `(municipality_id, fiscal_year, 'operating')` via `treasury_sync_budget_tree` (the **same** key NASBO used) → the RPC updates in place, so the NASBO FY row is *replaced* by the ACFR GAAP row (one basis per state-FY). Then a targeted post-RPC stamp of `data_source` (ACFR GAAP string) + `source_url` + `source_date` (per-year). **Never** use `treasury_sync_city_budget` (not source-safe — [[project_sync_city_budget_not_source_safe]]).
- **D-12:** **Revenue insert:** `dataset_type='revenue'` is new on both nodes (no NASBO revenue) → pure insert (feeds Phase 101's Money-In view).
- **D-13:** **No orphan FY:** both windows fully cover the NASBO FY2023+FY2024 being replaced (NY 2015–24, FL 2022–24) — no FY loses coverage. (NY NASBO: FY2023 $84.474B, FY2024 $91.070B. FL NASBO: FY2023 $44.219B, FY2024 $51.649B.)
- **D-14:** **Idempotent:** re-run updates the same (muni,fy,dataset) rows → 0 net new rows. **Un-upgraded states untouched** — these loaders touch only the NY/FL nodes; `loadStateGF.mjs` stays the NASBO fallback for all others. CA+TX (Phase 99) untouched.

### P2 negative-category clamp (ACFR-05)
- **D-15:** Any negative GF category year (esp. NY investment income) renders via the P2 clamp: area clamped to 0, signed magnitude preserved in the label, parent/control total preserved (the CA/OH-revenue template already implements `clampForRender` / signed label). Verify it triggers on whatever negative years NY/FL have.

### Verification within this phase
- **D-16:** Each loaded NY + FL FY ties to its ACFR GF column printed total (SC#1). Idempotent re-run = 0 writes (SC#2). Negative-category years render clamped (SC#3). Full independent re-derivation + cohort audit + UAT is Phase 102, not here — but a per-FY tie-check gate runs in the load.

### Approval gate
- **D-17:** No new Chris decision is required at plan time — the recon already located the sources, tie-confirmed bookends, and Chris approved the upgrade-in-place pattern for all four states; NY/FL carry no TX-style scope surprise. The **first live production write per state** still pauses at a `checkpoint:human-verify` gate in 100-02 (NY) and 100-03 (FL), exactly as Phase 99 did.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Recon + proof outputs (the source of every decision above)
- `.planning/phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-ACFR-SOURCES.md` — per-state located statement, GF column, units, durable per-year URLs, windows, gap log, NY-millions + NY-finance-not-pension cautions, NY/FL bookend ties.
- `.planning/phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-RECON.md` — upgrade-in-place pattern (Chris-approved), loader-reuse + NASBO-replace plan, per-state config nuances, stale-`data_sources` cleanup applies to all four.
- `.planning/phases/99-california-texas-acfr-upgrade-acfr-01-acfr-02-acfr-05-recon-/99-EXECUTION-SUMMARY.md` — the proven CA+TX result; "Phase 100 (NY+FL) reuses this exact loader pair — NY needs ×1000 millions-scaling; same stale-`data_sources` cleanup pattern."

### Loader templates to copy
- `scripts/processCA.js` / `scripts/processCARevenueAcfr.js` — the Phase-99 CA loaders; closest concrete analog (state-ACFR config shape, tie-check gate, post-RPC stamp, P2 clamp). FL ≈ direct copy; NY = this + millions multiplier + dual URL naming.
- `scripts/processMN.js` — upstream operating (spend-by-function) ACFR template.
- `scripts/processOHRevenueAcfr.js` — upstream revenue (rev-by-source) ACFR template **with the P2 clamp**.
- `scripts/loadStateGF.mjs` — the NASBO loader being replaced (its `(muni,fy,'operating')` key + `treasury_sync_budget_tree` + targeted post-stamp pattern is what the replace must match).
- `scripts/cleanupStaleStateGFDataSources.mjs` — the Phase-99 stale-`data_sources` cleanup; **extend** it with NY (`ny-gf-operating`, `ny-gf-revenue`) + FL (`fl-gf-operating`, `fl-gf-revenue`) targets and `--state NY|FL` filters.

### Requirements + policy
- `.planning/REQUIREMENTS.md` — ACFR-03 (NY), ACFR-04 (FL), ACFR-05 (P2 clamp), RECON-03 (replace); + Out-of-Scope table.
- `.planning/ROADMAP.md` — Phase 100 entry (3 success criteria) + v2.11 constraints (free PDFs only, $0/$5 AI gate, GAAP basis, basis-labelled, idempotent never-overwrite, executed inline).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Phase-99 CA/TX loaders + `cleanupStaleStateGFDataSources.mjs` are now in `scripts/` — Phase 100 is mostly per-state config (SOURCES map + page-finder + units multiplier) + extending the cleanup script with NY/FL ids.
- `loadStateGF.mjs`: the RPC key + post-stamp idempotency pattern to mirror for a clean in-place replace; also exports `clampForRender`/`categoryLabel`/`dataSourceLabel` helpers.

### Established Patterns
- `pdftotext -table` is the proven clean extractor for these GF statements (recon + Phase 99).
- Per-node basis label + source chip keep the mixed-basis cohort (4 ACFR-GAAP + 46 NASBO-budgetary) honest.
- NASBO budgets rows carry `data_source_id = null` (provenance is stamped into `data_source`/`source_url`/`source_date` text per policy P4) — so the stale `*-gf-*` data_sources legitimately show 0 live rows; the 0-row assertion in the cleanup script is the safety gate.

### Integration Points
- ACFR operating rows replace NASBO operating rows on the NY/FL nodes; revenue rows are new (feed Phase 101's Money-In view).
- The 4-ACFR cohort (CA, TX, NY, FL) must not disturb the 46 NASBO states (verified in Phase 102's cohort audit).
</code_context>

<specifics>
## Specific Ideas
- **NY bookends (recon, ×1,000,000 to dollars):** FY2024 GF Total revenues **$93,894M** = $93,894,000,000; FY2015 old-end statement clean (recon tied on personal-income line $30,380M — the loader's tie-check validates the full Total at load).
- **FL bookends (recon, ×1,000 to dollars):** FY2022 GF Total revenues **$57,241,428K** = $57,241,428,000; FY2024 **$59,810,603K** = $59,810,603,000.
- Watch for negative investment-income years on NY (ACFR-05 clamp) — confirm the clamp fires where the ACFR shows a negative.
- NY URL naming flips at FY2022 (`annual-comprehensive-…` ≥2022 vs `comprehensive-…` ≤2021) — the SOURCES map must encode both.
</specifics>

<deferred>
## Deferred Ideas
- "Money In" revenue-view UI + `?dataset=revenue` deep-link robustness → Phase 101.
- Independent re-derivation audit + full-cohort source-chain audit + UAT → Phase 102.
- NY pre-FY2015 deep history (predictable naming exists, optional extension) + FL pre-FY2022 (behind archive pages, no clean URL) — optional later extensions, not this phase.
- The cosmetic `*-gf-operating-nasbo` data_source rows (still present, now 0 live rows after ACFR replace) — left for Phase 102's audit to decide, same as CA/TX.
</deferred>

---

*Phase: 100-new-york-florida-acfr-upgrade*
*Context gathered: 2026-06-29 (derived from Phase 98 recon + the proven Phase 99 CA+TX execution)*
