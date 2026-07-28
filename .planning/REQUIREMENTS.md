# Requirements — v2.20 Madison, WI + Dane County Onboarding

**Milestone:** v2.20 (Phases 135–137, continues from 134)
**Started:** 2026-07-27
**Goal:** Bring the **City of Madison, WI** and **Dane County, WI** onto Treasury Tracker at city/county parity — revenue-by-source (Money In) + expenditure-by-function for CY2020–CY2024, per-capita, bleed-safe enriched, every figure durably sourced — beneath a new **Dane County** navigation node under the existing Wisconsin state node, loaded from the Wisconsin DOR *County and Municipal Revenues and Expenditures* statewide workbook.

**Source is a statewide bulk XLSX, not a per-city PDF.** WI DOR Bulletin 124 (`CMREB<YYYY>.xlsx`, free, no auth) covers all 190 cities, 417 villages, 1,242 towns and 72 counties for CY2020–CY2024, with revenue-by-source and expenditure-by-function columns plus printed subtotal columns that serve as an exact tie gate. A 2026-07-27 probe re-derived nine subtotal identities against their components across **9,608 rows × 5 years = 86,472 checks with zero failures**. Full recon + verified column map: `.planning/MADISON-WI-SCOPING.md`.

**Reuses the proven Ohio AOS playbook** (`loadOhioAOS.js`): flat 1-level revenue + expenditure trees from category columns, D-04b exclusion of Other Financing Sources/Uses, `--entity-type city|county`, source-safe `treasury_sync_budget_tree` (never-overwrite), per-FY `data_sources` + durable `source_url`/`source_date`. **No PDF extractor needed** — strictly less work than Tucson or Gresham. Free XLSX only, $0 AI spend, executed inline.

**Locked decisions (Chris, 2026-07-27):**
- **Scope = Madison + Dane County only.** The statewide fan-out (190 cities + 72 counties) is deliberately deferred, not rejected — the loader must be written generically so it is a flag flip, not a rewrite.
- **Dane County is a FULL entity, not a nav-only node.** Unlike Pima (v2.17, nav-only with `PIMA-BUDGET-01` deferred), the CMREB `Counties` sheet carries Dane's own financial data, so the county gets real budget rows in the same pass.
- **Basis = all governmental funds** as the source defines them (general + capital projects + special revenue + debt service). Not GF-only — the source does not separate the General Fund. This differs from the Tucson/Pima/Oregon GF basis and must be labelled, not silently mixed.
- **Fiscal year = calendar year.** CY2024 = FY2024; no FY-end ambiguity.
- **Provenance grade is UNAUDITED** and must be stated as such (MAD-06). This is the first city in TT whose figures are not audited-ACFR GAAP.

---

## v2.20 Requirements

### Source & Loader

- [x] **MAD-01**: Reconcile Madison's CMREB CY2024 figures against the **City of Madison's own FY2024 ACFR** (governmental funds) — quantify the delta on both revenue and expenditure, identify its cause (fund-scope, audit adjustment, transit treatment, or accounting-practice difference), and record an explicit basis verdict against §4 of the scoping brief: (a) CMREB, labelled unaudited, (b) Madison from its ACFR with CMREB reserved for the statewide fan-out, or (c) both as separate `dataset_type`s. **No silent choice** — the verdict and its evidence are written down before any load.
- [x] **MAD-02**: `scripts/loadWICMREB.js` implements the verified column map (`.planning/MADISON-WI-SCOPING.md` §0) and **asserts all nine printed-subtotal identities per row**, exiting non-zero and dumping the row on any mismatch so a mis-parse cannot reach the database. Carries the exact-delta source-rounding registry pattern from `lib/acfrGF.py` / `extractGresham.py` (empty today — no year needs it) rather than any tolerance. Correctly treats `Total Miscellaneous Revenues` as covering only `Interest Income` + `Other Revenues`, and filters rows on a non-empty `Municipality` cell rather than trusting `openpyxl`/ExcelJS `max_row`.
- [x] **MAD-03**: Loader is **generic across entity type and municipality** — `--entity-type city|county` (cf. the Utah phantom-city-row lesson) and per-municipality vs. `--all` selection, so the deferred statewide fan-out (`WI-CITIES-01`) needs no rewrite. Dry-run for Madison + Dane County across CY2020–CY2024, revenue + operating, each tree summing to its printed total (`Subtotal-General Revenues` / `Sub-total Expenditure`) at exactly **$0**.

### Data Model & Load

- [x] **MAD-04**: **Madison** seeded (name=Madison, state=WI, `entity_type`=city, population from the workbook's own DOA estimate) and **Dane County** seeded (`entity_type`=county, population as printed — not derived, per the bulletin's cross-county caveat), idempotent (select-by-name → insert/update; `data_source` rows owned by the loader, not the seeder), with Madison linked via `county_id`. Breadcrumb **US → Wisconsin → Dane County → Madison** and the Cities-in-County panel both render. Guard against collision with the existing `Madison, MN` / `Madison County, OH` / `Madison County, VA` rows.
- [x] **MAD-05**: Madison **and** Dane County each load **revenue** (revenue-by-source) + **operating** (expenditure-by-function) for CY2020–CY2024 via `treasury_sync_city_budget` behind an explicit never-overwrite pre-skip guard (CORRECTED 2026-07-27: this requirement originally called `treasury_sync_budget_tree` "the source-safe RPC" — neither RPC is safe on its own; the guard is what makes it safe, per `project_sync_city_budget_not_source_safe` and the `loadOhioAOS.js` pattern); every row carries a durable `source_url` (per-year direct XLSX URL) + `source_date`; per-capita ($/resident) renders; the "Money In" revenue view auto-enables; a re-run is idempotent (0 net change, 0 `data_sources` residue).
- [x] **MAD-06**: **Provenance is labelled honestly.** The `data_source` name and any surfaced provenance text state that the figures are **unaudited, self-reported Municipal Financial Report filings** collected by the Wisconsin DOR, on an **all-governmental-funds** basis, **calendar-year**. Never labelled "audited" or bare "GAAP". The all-funds basis and its difference from TT's GF-basis cities is discoverable by a reader, not buried.

### Enrichment

- [x] **MAD-07**: Bleed-safe category enrichment covering **100%** of Madison's and Dane County's loaded categories (universal where the label is shareable — most CMREB labels are statewide-uniform and will generalize to the deferred fan-out — entity-scoped otherwise), authored inline at $0, delete-then-insert / NULLS-DISTINCT-safe, with **no cross-entity bleed** (verified against the pre-existing Madison MN / Madison County OH / Madison County VA rows especially).

### Verification

- [ ] **MAD-08**: Loader-independent **blind re-derivation** of every loaded row's revenue + expenditure total straight from the source workbook ($0-delta target, 20 rows), plus a full source-chain audit — every new row durably sourced, 0 NULL/fragile/residue, no stale labels, population pinned to the workbook's stated figure.
- [ ] **MAD-09**: Chris live-app UAT — icicle categories, Money In/Out, per-capita, source chips (including the unaudited labelling from MAD-06), and breadcrumb + Cities-in-County navigation for Madison under Dane County — signed off. The v2.16/v2.19 Essentials + CTC tether chips are confirmed on Madison's banner, or their absence documented as a cross-repo coverage gap (no TT code change).

---

## Future Requirements (deferred)

- **WI-CITIES-01**: Statewide fan-out — the remaining 189 WI cities + 71 counties (~2,600 budget rows) from the same workbooks and the same loader. Near-free once MAD-02/MAD-03 exist; the cost is municipality seeding and audit/UAT breadth.
- **WI-TOWNS-01**: WI villages (417) + towns (1,242). Coverage win, but ~1,650 entities many under $1M — weigh against the browse-dilution incident that capped CityGrid rendering (`project_posthog_session_replay_freeze`).
- **MAD-ACFR-01**: Deepen Madison to **FY2015** from its own audited ACFR archive (FY2015–FY2025 live). Would give audited GAAP + 5 extra years, at the cost of two bases inside Wisconsin unless it *replaces* the CMREB rows.
- **WI-PRE2020-01**: CMREB history before CY2020 — bulletins exist as PDF (and on wistatedocuments.org) but were **not** probed for an XLSX equivalent.
- **WI-SAL-01**: Wisconsin employee compensation — no free statewide comp dataset identified; same blocker as AZ.

## Out of Scope (this milestone)

- Enterprise / internal-service ("Propriety Funds") columns — carried in the workbook as context only, not loaded.
- `Other Financing Sources` / `Other Financing Uses` — excluded per the Ohio D-04b decision (debt proceeds, inter-fund transfers, refunding, asset sales would double-count).
- `Total General Obligation Debt` — a balance, not a flow; does not belong in either tree.
- Any GF-only split of Madison — the source does not separate the General Fund; that would require the ACFR path (`MAD-ACFR-01`).
- Sub-category drill-down — CMREB is a flat source (`project_flat_source_icicle_limitation`); clicking a leaf will not expand.
