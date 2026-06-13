# Phase 49 — Research: Historical Federal Data Backfill (FY1976–FY2024)

**Researched:** 2026-06-13 (inline — no research subagent, per project cost policy)
**Question answered:** "What do I need to know to PLAN the FY1976–FY2024 + TQ backfill well?"
**Requirements covered:** HIST-01, HIST-02, HIST-03, HIST-04, CTX-01

> All findings below are verified against the live code (`scripts/load*Federal*.js`,
> `scripts/extractOMB*.py`), the live Supabase `treasury` schema, and the live OMB /
> Treasury Fiscal Data sources. Where a claim was checked against a live endpoint or
> DB query, it is marked **[verified]**.

---

## TL;DR for the planner

1. **The single biggest finding:** the FY2025 **agency lens does NOT come from OMB Hist 4.1/5.1** as CONTEXT/ROADMAP assume — it comes from **MTS Table 5 via the Fiscal Data API, whose history starts at FY2015** **[verified: earliest `mts_table_5` record_date = 2015-03-31]**. MTS T5 cannot backfill FY1976–FY2014. **BUT** the OMB Public Budget Database outlays file (the *function* loader's source) already emits `agency` + `bureau` + `account` on every row, with per-year columns back to 1962. → **Rebuild the agency lens by regrouping the same PBD rows by agency→bureau→account.** One source powers both Money-Out lenses, at full depth, for every year.
2. **Function lens** is a near-pure parameterization: `extractOMBPublicBudgetDB.py` already takes the fiscal year as a CLI arg and does `header.index(fy)`. The PBD file has year columns 1962→present **and a literal `TQ` column**, so the same extractor loads the Transition Quarter by passing `TQ`. Per-year reconciliation anchor = OMB Hist 1.1 total outlays, already produced per-year by `extractOMBHistorical.py`.
3. **Receipts lens** for history is a **new** flat 7-bucket loader from **OMB Hist 2.1** (the existing FY2025 `revenue` tree is MTS Table 9, API-only, FY2015+). Hist 2.1 covers 1934→present, so the full span is available.
4. **Transition Quarter storage (R-01) is constrained by a hard DB invariant:** `treasury.budgets` has a **UNIQUE index on `(municipality_id, fiscal_year, dataset_type)`** **[verified]**, so the TQ cannot be stored as a second row at `fiscal_year = 1976` for a lens that already has FY1976. The clean fix is a small, backward-compatible migration: add nullable `budgets.period_label`, widen the unique index to include it (`NULLS NOT DISTINCT`), and add an optional `p_period_label` arg to `treasury_sync_budget_tree`. **Gate this migration behind a human checkpoint** (first schema change to a shared, app-facing table).
5. **$0 spend holds.** OMB historical tables + the OMB Public Budget Database are free xlsx downloads (browser User-Agent required — already implemented). No paid APIs, no LLM calls. The only per-row text is OMB-sourced titles read from the files.

---

## 1. Source map (what feeds each lens, and how far back)

| Lens (`dataset_type`) | FY2025 source (existing) | History source for FY1976–FY2024 + TQ | Span available | Depth |
|---|---|---|---|---|
| `operating` (function) | OMB Public Budget Database outlays (xlsx) + Hist 3.2 titles | **same file**, different year column | 1962→present **+ `TQ` column** | Function→Subfunction→Account |
| `federal_agency` (agency) | **MTS Table 5 (API)** — FY2015+ only **[verified]** | **OMB Public Budget Database**, regrouped agency→bureau→account | 1962→present + `TQ` | Department→Bureau→Account |
| `revenue` (receipts) | **MTS Table 9 (API)** — FY2015+ only | **OMB Hist 2.1** (xlsx), flat 7 buckets | 1934→present + `TQ` row | Flat (7 sources) |

**Why this matters:** the agency and receipts lenses change *source* for history (the API-based FY2025 sources don't reach back). The function lens keeps its source and just iterates the year. FY2025 rows stay exactly as they are (FY2025 changes are out of scope) — there is a one-year source discontinuity at FY2024(OMB)→FY2025(MTS) for agency and receipts that **Phase 51** will explain. This is consistent with the milestone's "preserve the source label per year" rule.

### OMB source URLs (free; browser UA required — `Mozilla/5.0 ... Chrome/125` already in loaders)
- Historical Tables landing: `https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/` — Hist 1.1, 2.1, 3.2, 4.1, 8.1.
- Public Budget Database (account-level outlays): linked from `https://www.whitehouse.gov/omb/information-resources/budget/supplemental-materials/` — the file `loadFederalFunctions.js` already downloads via `findXlsxUrl(html, 'outlays')`.
- Both pages are whitehouse.gov-only (the loaders enforce this — T-44-04 source rule).

---

## 2. Reusable assets (verified against current code)

| Asset | Reuse for Phase 49 |
|---|---|
| `scripts/loadFederalFunctions.js` | Parameterize: replace hardcoded `const FY = 2025` / `OMB_OUTLAYS = 7_011_105e6` with a `--fy <N>` / `--tq` arg and a **per-year anchor** derived from Hist 1.1. Download the PBD + Hist 3.2 files **once**, iterate years. |
| `scripts/loadFederalAgencies.js` | **Do not extend its MTS-T5 path for history** (FY2015+ only). Add a new PBD-sourced agency tree builder (group extracted rows by `agency`→`bureau`→`account`). Keep the MTS path for reference; the historical path is new. |
| `scripts/extractOMBPublicBudgetDB.py` | Already emits `{agency, bureau, account, subfunction_code/title, function_code/title, bea_category, amount}` and `net_total` for the requested year column. Passing `TQ` as the year extracts the Transition Quarter column. **No change needed for function; the agency builder consumes the same JSON.** May need a `--fallback hist32` companion path for the function tier-1 fallback (see §4). |
| `scripts/extractOMBHistorical.py` | Reference for robust OMB xlsx parsing (units read from file, columns by header text, year-row regex). **Source of the per-year function anchor** (Hist 1.1 `outlays`, 1962→2025). Note: it explicitly *excludes* the TQ row (4-digit year regex) — the TQ anchor must be read separately. |
| `treasury_sync_budget_tree` RPC | Tree-sync write path; reuse unchanged for all FY rows. **Extend with optional `p_period_label text DEFAULT NULL`** only to support the TQ (see §3). Backward-compatible. |
| `treasury.federal_context_metrics` | Per-year disclosure store. Extend with per-year keys (`excluded_*_fyNNNN`, `offsets_*_fyNNNN`, `agency_offsets_*_fyNNNN`) and a **reduced-depth note** key when a year falls back (D-02). Upsert by `metric_key`. |
| `scripts/auditFederalSources.mjs` | Source-chain verifier (Phase 48: 61/61 PASS). Re-run after the backfill to prove every new row carries source_name/url/date. |
| `loadFederalMTS.js` `buildReceiptsTree` | Shape reference for the new Hist 2.1 receipts loader (flat positives, excluded negatives → metrics). CONTEXT D-04 chooses **flat 7 buckets** (no L3), simpler than the MTS 2-level tree. |

---

## 3. R-01 resolved — Transition Quarter storage

**Hard constraints discovered [verified]:**
- `treasury.budgets.fiscal_year` is `bigint`; `treasury_sync_budget_tree(p_fiscal_year integer, ...)`. No fractional or sub-annual period type exists.
- **`CREATE UNIQUE INDEX idx_budget_municipality_year_type ON treasury.budgets (municipality_id, fiscal_year, dataset_type)`** — one row per (entity, year, lens). A TQ row at `(US, 1976, operating)` collides with real FY1976.

**Recommended resolution (one backward-compatible migration, checkpoint-gated):**
1. `ALTER TABLE treasury.budgets ADD COLUMN period_label text;` (nullable, default NULL — every existing row stays NULL).
2. Replace the unique index with `UNIQUE NULLS NOT DISTINCT (municipality_id, fiscal_year, dataset_type, period_label)` (Supabase is PG15+, so `NULLS NOT DISTINCT` is available — this *preserves* the "one NULL-label row per (entity,year,lens)" guarantee while letting a labeled TQ row coexist).
3. Add `p_period_label text DEFAULT NULL` to `treasury_sync_budget_tree`; write it onto the inserted `budgets` row and update its `ON CONFLICT` target to the 4-column key. **Read the live RPC body (`pg_get_functiondef`) before editing** — the conflict target must move in lockstep with the index.
4. TQ rows: `fiscal_year = 1976`, `period_label = 'Transition Quarter (Jul–Sep 1976)'`, in their own `data_source` (`dataset_id = 'tq1976'`). Real years pass `period_label = NULL` (unchanged behavior).

**Why not a sentinel `fiscal_year`:** a magic integer (e.g. 19763) would silently break every naive year filter/sort downstream and leak a fake "year." `period_label` keeps the year truthful (TQ *is* the 1976 transition) and makes the special period self-describing for Phase 50's YearSelector. **Trade-off:** touches a shared RPC + index, so it is checkpoint-gated.

**Rejected alternatives:** (a) reuse `fiscal_year=1976` without a discriminator → unique-index violation; (b) sentinel integer → silent-wrong-data risk; (c) brand-new `transition_periods` table → over-engineered for one period, breaks the single tree-read path Phase 50 expects.

---

## 4. Reconciliation & the tiered fallback ladder (D-01 / D-05)

The FY2025 loaders **hard-halt** if the net total doesn't tie to the OMB anchor within 0.5% (and to the thousand for function). Phase 49 keeps the *check* but inverts the *failure action* — **no year is ever dropped** (HIST-04). Per-lens ladder:

**Function lens (per year):**
1. **Tier 0 — account depth (preferred):** sum the PBD account rows for the year; anchor = Hist 1.1 outlays for that year. If `|net − anchor| ≤ thousands` and displayed+excluded reconciles ≤ 0.5% → write Function→Subfunction→Account.
2. **Tier 1 — function·subfunction depth:** if account rows won't tie, build the tree from **Hist 3.2** subfunction net amounts (ties to the published total by construction). Record a `federal_context_metrics` reduced-depth note (D-02).
3. **Tier 2 — load anyway with a disclosure:** if even function·subfunction is outside tolerance, write the best available tree and store a per-year **visual-vs-official** metric capturing the exact gap (CTX-01). Never drop the year.

**Agency lens (per year):**
1. **Tier 0 — account depth from PBD:** group rows by `agency`→`bureau`→`account`; anchor = same Hist 1.1 outlays (same rows as function → same net by construction, so this should tie whenever the function lens ties).
2. **Tier 1 — agency-level flat from Hist 4.1** if PBD account grouping won't tie; reduced-depth note.
3. **Tier 2 — load anyway + disclosure.**

**Receipts lens (per year):** Hist 2.1 is already a published per-year row of 7 source totals that sum to Total Receipts; anchor = Hist 1.1 receipts (or Hist 2.1's own Total). Single tier; if the 7 buckets don't sum within tolerance, load anyway + disclosure.

**Tolerances (planner's discretion, anchored on FY2025):** thousands-precision net check for function/account; 0.5% reconciliation for displayed+excluded; receipts within 0.5% of the Hist 1.1 receipts anchor. Loosen only at Tier 2, and always record the gap.

---

## 5. Data-availability de-risking (R-02 / R-03) — do at execution via dry-run, $0

The 1970s–80s account-level depth is *unproven*. **Do not assume; probe.** Each loader plan must, before the full span, run `--dry-run` for a **sample set: FY1976, TQ, FY1985, FY2000, FY2014, FY2024** and report which tier each lands on. This converts R-02/R-03 from a planning unknown into an execution observation at zero cost (OMB downloads are free). Expectations:
- **PBD year columns + `TQ` column exist** back to 1962 (the extractor's `header.index(fy)` design assumes named year columns; confirm the exact `TQ` header string — likely `"TQ"`).
- **Hist 2.1** layout (units in line 2, columns by header text) is stable across the span — reuse `extractOMBHistorical.py`'s robust patterns.
- **Definition drift (R-04):** note (don't resolve) where function/agency names shift across decades; the per-year `source_url`/`source_date` keep each year honest. Comparability copy is **Phase 51**.

---

## 6. Idempotency & performance

- **Download once, iterate years.** The PBD outlays file, Hist 3.2, Hist 2.1, and Hist 1.1 each contain *all* years. Download the four files once per run; extract per-year columns in a loop. (Re-running the extractor per year re-parses the workbook — acceptable with openpyxl read-only, but a single multi-year Python pass is the optimization if runtime is poor.)
- **Idempotent upserts (preserve the existing pattern):** `data_sources` upsert by `(municipality_id, api_type, dataset_id, dataset_type)`; `budgets` pre-deleted by `(data_source_id, fiscal_year)` before the RPC. Per-year loaders create one `data_source` per (lens, year) with `dataset_id = 'fyNNNN'` (and `'tq1976'` for the TQ). Re-running overwrites cleanly.
- **Metrics** upsert by `metric_key`; per-year keys make re-runs idempotent.

---

## Validation Architecture

> Drives `49-VALIDATION.md`. This is a **data-loading** phase: "tests" are reconciliation
> assertions, the source-chain audit, and coverage queries — not a unit-test framework.

- **Per-task feedback:** every loader runs `--dry-run` and prints the per-year reconciliation delta + chosen tier; a task is green when its sample years reconcile (or fall back with a recorded gap) and the dry-run exits 0.
- **Per-wave feedback:** after the loaders are built (wave 1), the wave-2 execution plan runs the full span, then `node scripts/auditFederalSources.mjs` must return **all-PASS** for the new rows.
- **Coverage gate (HIST-04):** a SQL query proving exactly one `budgets` row per `(US, fiscal_year, dataset_type)` for every year FY1976–FY2024 across all three lenses, plus the three TQ rows — zero gaps.
- **Disclosure gate (CTX-01):** a SQL query proving each loaded year has its own `federal_context_metrics` reconciliation/excluded-negatives rows (per-year keys, recomputed — not copied from FY2025).
- **Sourcing gate (HIST-01..04):** the audit harness confirms every new line-item and metric row carries `source_name` / `source_url` / `source_date`.
- **Manual checkpoint:** the TQ schema migration (R-01) is human-gated before it touches the shared `budgets` table / RPC.

---

## RESEARCH COMPLETE

Findings are concrete and verified against live code, schema, and sources. The plan can
proceed with: 1 schema plan (checkpoint-gated), 3 loader plans (function / agency-from-PBD /
receipts-from-Hist-2.1), and 1 execution+audit plan.
