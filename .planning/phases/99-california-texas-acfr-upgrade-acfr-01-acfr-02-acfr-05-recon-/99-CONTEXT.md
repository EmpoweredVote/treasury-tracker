# Phase 99: California + Texas ACFR Upgrade - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** Derived from Phase 98 recon (`98-RECON.md` + `98-ACFR-SOURCES.md`) + Chris's CA-target approval — no separate discuss-phase needed (recon resolved every gray area).

<domain>
## Phase Boundary

Load **California** and **Texas** General Fund **revenue-by-source** + GAAP **spending-by-function** from their ACFRs, as deep as each cleanly extracts, **replacing** the existing NASBO operating rows idempotently — proving the per-state ACFR upgrade path that Phase 100 reuses for NY+FL.

**In scope:** CA + TX only; the GF column of each year's ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (GAAP, audited actuals); operating (spend-by-function) + revenue (rev-by-source) datasets; idempotent NASBO-replace; P2 negative-category clamp; basis-labelled + durably sourced rows; the CA stale-`data_sources` cleanup.

**Out of scope:** NY + FL (Phase 100); the "Money In" revenue-view UI + `?dataset=revenue` robustness (Phase 101); independent re-derivation audit + UAT (Phase 102); budgetary/forecast figures; any state other than CA/TX.
</domain>

<decisions>
## Implementation Decisions (locked by recon + Chris)

### California (ACFR-01)
- **D-01:** Upgrade the **single existing CA state node in place** (`municipalities.id = e1007bf5-bac9-4b1c-878e-f6834885f850`). No new entity. (Chris-approved 2026-06-29.)
- **D-02:** Window **FY2020–FY2025** (`https://www.sco.ca.gov/Files-ARD/ACFR/acfr{NN}web.pdf`, NN=20…25). Extract the full window now (the bookends FY2020 $155,923,876K + FY2025 $221,591,201K are already tie-confirmed; load the in-between years too).
- **D-03:** GF column header = "General" (1st numeric col), units = **thousands**.
- **D-04:** **Delete** the 2 stale v1.7 `data_sources` (`ca-lao-gf-operating`, `ca-dof-gf-revenue` — 0 budgets rows). Create fresh `ca-acfr-gf-operating` + `ca-acfr-gf-revenue` data_sources. CA revenue source of record = the **ACFR** (not the old DOF/ebudget figures).
- **CA soft-404 guard:** the SCO server returns HTTP 200 + an 11,561-byte HTML body for missing files — verify each download is `Content-Type: application/pdf` (or size > ~1 MB), never trust HTTP status alone.

### Texas (ACFR-02)
- **D-05:** Upgrade the existing TX state node in place; window **FY2015–FY2024** (`https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/{YYYY}/96-471.pdf`). **FY2016** returns 404 at `96-471.pdf` — try to locate FY2016's alternate file-id on the same archive page (light cleanup, D-07-style); if not cleanly found, **drop FY2016 with a gap-log note** (do not block the rest).
- **D-06:** TX fund column = **"General Revenue Fund"** (1st numeric col), units = thousands. **Its magnitude is ~3× the NASBO TX GF** ($161.4B FY2024 vs $50.5B) because TX's GR Fund is a far broader consolidated operating fund. **Accept it as TX's GAAP general-fund-equivalent and relabel the basis honestly** (Chris-acknowledged) — do NOT try to carve it down to the NASBO scale. The node total will visibly jump; that is correct + sourced.
- **D-07:** Same delete-stale-`data_sources` + fresh `tx-acfr-*` treatment as CA (TX carries analogous stale `tx-gf-operating` + `tx-gf-revenue` metadata).

### Loaders (reuse — RECON-03)
- **D-08:** Copy `scripts/processMN.js` → the **operating** loader (parses the EXPENDITURES section, GF column, GAAP, deepest multi-FY `SOURCES{url,date}` map). Copy `scripts/processOHRevenueAcfr.js` → the **revenue** loader (parses the REVENUES section; **has the P2 negative-investment-income clamp built in** — ACFR-05). One pair per state (or one parameterized pair) with per-state config: `SOURCES` map, GF-statement page-finder, GF column index, fund-column label, units multiplier.
- **D-09:** **Extraction = `pdftotext -table`** (NOT `-layout`, which floats numbers to wrong rows). Each FY's extracted GF column total MUST tie to the printed total before writing (the CA FY2025 exact tie is the proof-of-method). Light cleanup (page-range / `-f`/`-l`) before dropping any FY; keep a FY if its total ties + lines are categorizable; gap-log every dropped FY.
- **D-10:** $0 spend — pdftotext only, no AI calls.

### NASBO-replace semantics (RECON-03)
- **D-11:** **Operating replace:** write `dataset_type='operating'` keyed on `(municipality_id, fiscal_year, 'operating')` via `treasury_sync_budget_tree` (the **same** key the NASBO loader used) → the RPC updates in place, so the NASBO FY row is *replaced* by the ACFR GAAP row (one basis per state-FY). Then targeted post-RPC stamp of `data_source` (ACFR GAAP string) + `source_url` + `source_date` (per-year), mirroring `processMN.js`. **Never** use `treasury_sync_city_budget` (not source-safe — [[project_sync_city_budget_not_source_safe]]).
- **D-12:** **Revenue insert:** `dataset_type='revenue'` is new on these nodes (no NASBO revenue) → pure insert.
- **D-13:** **No orphan FY:** both windows fully cover the NASBO FY2023+FY2024 being replaced (CA 2020–25, TX 2015–24) — no FY loses coverage.
- **D-14:** **Idempotent:** re-run updates the same (muni,fy,dataset) rows → 0 net new rows. **Un-upgraded states untouched** — these loaders touch only the CA/TX nodes; `loadStateGF.mjs` stays the NASBO fallback for all others.

### P2 negative-category clamp (ACFR-05)
- **D-15:** Any negative GF category year (e.g. investment income) renders via the P2 clamp: area clamped to 0, signed magnitude preserved in the label, parent/control total preserved (the OH-revenue template already implements this — `clampForRender` / `categoryLabel` pattern; verify it triggers on whatever negative years CA/TX have).

### Verification within this phase
- **D-16:** Each loaded CA + TX FY ties to its ACFR GF column total (SC#1). Idempotent re-run = 0 writes (SC#2). Negative-category years render clamped (SC#3). Full independent re-derivation + cohort audit + UAT is Phase 102, not here — but a per-FY tie-check gate runs in the load.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Recon outputs (the source of every decision above)
- `.planning/phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-RECON.md` — CA target (approved), loader-reuse + NASBO-replace plan, open risks.
- `.planning/phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-ACFR-SOURCES.md` — per-state located statement, GF column, units, durable per-year URLs, windows, gap log, soft-404 caution.

### Loader templates to copy
- `scripts/processMN.js` — operating (spend-by-function) ACFR template, deepest-history multi-FY `SOURCES` map.
- `scripts/processOHRevenueAcfr.js` — revenue (rev-by-source) ACFR template **with the P2 negative-category clamp**.
- `scripts/loadStateGF.mjs` — the NASBO loader being replaced (its `(muni,fy,'operating')` key + `treasury_sync_budget_tree` + targeted post-stamp pattern is what the replace must match); also exports `clampForRender`/`categoryLabel`/`dataSourceLabel` patterns.

### Requirements + policy
- `.planning/REQUIREMENTS.md` — ACFR-01 (CA), ACFR-02 (TX), ACFR-05 (P2 clamp), RECON-03 (replace); + Out-of-Scope table.
- `.planning/ROADMAP.md` — Phase 99 entry (3 success criteria) + v2.11 constraints (free PDFs only, $0/$5 AI gate, GAAP basis, basis-labelled, idempotent never-overwrite).

### Local working copies (gitignored)
- `_acfr-tmp/{ca,tx}/` — already-downloaded ACFR PDFs (CA FY2020+FY2025, TX FY2015+FY2024) + extracted statement text from recon. Reuse; don't re-download what's present.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `processMN.js` / `processOHRevenueAcfr.js`: near-complete templates — same statement, same `-table` method, idempotent write + source stamp + P2 clamp already built. Phase 99 is mostly per-state config (SOURCES map + page-finder + units) + the stale-`data_sources` cleanup.
- `loadStateGF.mjs`: the RPC key + post-stamp idempotency pattern to mirror for a clean in-place replace.

### Established Patterns
- `pdftotext -table` is the proven clean extractor for these GF statements (recon).
- Per-node basis label + source chip make the mixed-basis cohort (4 ACFR-GAAP + 46 NASBO-budgetary) honest.

### Integration Points
- ACFR operating rows replace NASBO operating rows on the same nodes; revenue rows are new (feed Phase 101's Money-In view).
- The 4-ACFR cohort must not disturb the 46 NASBO states (verified in Phase 102's cohort audit).
</code_context>

<specifics>
## Specific Ideas
- CA bookends already tie-confirmed: FY2020 GF Total rev $155,923,876K; FY2025 $221,591,201K (exact).
- TX bookends: FY2015 GR Fund Total rev $95,574,830K; FY2024 $161,416,562K.
- Watch for negative investment-income years in CA/TX (ACFR-05 clamp) — confirm the clamp triggers where the ACFR shows a negative.
</specifics>

<deferred>
## Deferred Ideas
- NY + FL upgrade → Phase 100 (same loader pair, NY needs ×1000 millions-scaling).
- "Money In" revenue-view UI + `?dataset=revenue` deep-link robustness → Phase 101.
- Independent re-derivation audit + full-cohort source-chain audit + UAT → Phase 102.
- CA pre-FY2020 / FL pre-FY2022 deep history (behind archive pages, no clean URL) + TX FY2016 alt-id + NY pre-FY2015 — optional later extensions, not this phase.
</deferred>

---

*Phase: 99-california-texas-acfr-upgrade*
*Context gathered: 2026-06-29 (derived from Phase 98 recon + Chris approval)*
