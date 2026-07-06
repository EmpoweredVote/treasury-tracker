# SRCSTD-01 — Sourced-Standard Backfill: Scoping Brief

**Status:** Candidate (not started) — pre-milestone scoping
**Captured:** 2026-07-06 (during v2.15 close-out, from a live production DB audit)
**Requirement:** SRCSTD-01 — backfill the federal always-sourced standard (visible per-figure official-record links + honest provenance on explainers) to city/state data.

---

## Bottom line

The **numbers** are in good shape. The real, tractable gap is a **two-source backfill of clickable source URLs on city budget rows**. The genuinely open question is a **policy call about AI-generated explainer text**, not a data slog. There are **zero truly-unsourced rows** anywhere — nothing is displaying with no provenance at all; the gap is "labeled but missing the clickable official-record link."

---

## 1. Budget-figure source coverage (by entity type)

A budget row counts as sourced if it has a durable `source_url` **or** a `data_source_id` (→ `source_registry`). Federal uses `data_source_id`; everyone else uses `source_url`.

| Entity | Budget rows | Sourced | Coverage |
|--------|-------------|---------|----------|
| State | 1,560 | 1,560 | **100%** (v2.11–v2.15 ACFR arc) |
| County | 6,044 | 6,025 | **99.7%** |
| Town | 126 | 126 | **100%** |
| Federal | 153 | 153 | **100%** (via `data_source_id`, not `source_url`) |
| **City** | 71,409 | 46,666 | **65.4%** ← the gap (~24,700 rows) |
| municipality / township / nonprofit | ~110 | mixed | small; township via ds_id; nonprofit = EV's own data |

## 2. The city gap collapses to two bulk sources

`bare_no_source_at_all = 0` in every dataset type — **every** unsourced city row still carries a `data_source` **label** (attribution text). The gap is a missing per-row `source_url` (clickable link), not missing provenance.

Unsourced city rows by dataset: operating 8,546 · revenue 8,521 · salaries 7,702 · (tiny: transactions 28, all_funds_requirements 17, salary 6).

**~99% of it is two loaders:**

| Bucket | Rows | Cities | Source (already in `data_source` label) | Fix |
|--------|------|--------|------------------------------------------|-----|
| **MA DLS** (operating + revenue) | 16,816 | 351 | "MA DLS General Fund Revenue by Source / Schedule A" — data.mass.gov DLS Municipal Databank (v1.8 all-MA-cities load) | Backfill one canonical DLS URL (per-dataset or per-city DLS page) |
| **CA publicpay** (salaries) | 7,686 | 482 | "CA State Controller — Government Compensation in California (publicpay.ca.gov)" | Backfill the publicpay.ca.gov URL |
| Per-city tail | ~190 | ~30 | Individual loaders that didn't stamp `source_url` — Anaheim (CA), Allen (TX), Gresham (OR), Leonardtown (MD), etc. | Opportunistic per-loader fix |

Each backfill is a per-loader fix (stamp `source_url` going forward) + a one-time bulk `UPDATE treasury.budgets SET source_url=… WHERE …`. Must respect the source-safe never-overwrite convention (`treasury_sync_budget_tree`, never `treasury_sync_city_budget`).

## 3. Frontend source-chip rendering (no code change needed — purely data-gated)

The chip UI already exists and works; it just doesn't fire when the data lacks a URL.

- **Federal, County** → `<SourceChip>` component (clickable name + fetch date). `src/components/federal/SourceChip.tsx`, rendered in `App.tsx`.
- **City, State** → "**Data sourced from [name](url)**" line with a clickable `<a href={source.url}>` in `src/components/dashboard/PlainLanguageSummary.tsx` (~line 347).
- **Gate (all of them):** renders only when `budgetData.metadata.dataSourceInfo != null`.
- `dataSourceInfo` is **not** a DB column. The **EV-Accounts backend API** (separate repo, `treasuryService.ts`, deployed 2026-06-16) assembles it from `budgets.source_url + source_date + data_source` (when `data_source_id` is null) or from `data_source_id` → `source_registry`.

**Consequence:** a city row with a `data_source` label but null `source_url`/`data_source_id` yields either no source line or a name with a dead link. **Backfilling `source_url` lights up the existing chip/line — no frontend change required.** (Confirm the EV-Accounts mapping treats label-only rows the way we expect.)

## 4. Enrichment / explainer-text sourcing (the real policy question)

`treasury.category_enrichment` — 7,066 explainer rows (4,692 universal, 2,374 city-specific).

| Dimension | Coverage |
|-----------|----------|
| Has a `source` value | 7,066 (100%) |
| Has a `confidence` value | 7,066 (100%) |
| `source='ai'` (AI-generated) | **6,719 (95%)** — high 4,174 / med 1,767 / low 778 |
| `source='official'` | 69 (~1%) |
| `generated` / `manual` / `hybrid` / `claude-generated` | 176 / 68 / 29 / 5 |
| Clickable `source_url` | **98 (1.4%)** |
| Truly bare (no source at all) | 0 |

The explainer text is **honestly labeled as AI-generated with a confidence score**, but it is **not cited to official records** the way federal program-origins are (those are structured from Congress.gov/GovInfo with zero model-memory claims). The frontend does render `enrichment.sourceUrl` as a link when present (`App.tsx` ~1224) — but that's only the 98 rows.

**The decision SRCSTD-01 must make:** do AI-generated *category definitions* (what "Public Works" generally means — not entity-specific factual claims) need official citations to meet the standard, or is clearly-labeled `ai` + confidence-scored text an acceptable honest posture? This is distinct from unsourced *numbers* (which are never acceptable). This call, not the URL backfill, is the larger part of SRCSTD-01.

## 5. Proposed scope split

- **SRCSTD-01a — City budget-figure URL backfill (mechanical, low-risk).** Two bulk sources (MA DLS, CA publicpay) + ~190-row tail. Per-loader `source_url` stamp + bulk `UPDATE`. Lights up existing chips. Verify EV-Accounts mapping; verify chips render live.
- **SRCSTD-01b — Explainer-text provenance policy (decision + optional work).** Decide the bar for AI definitional text; if citations are required, add a per-category authoritative source; otherwise formalize the "labeled AI + confidence" posture and surface it clearly in the UI.

## 6. Open questions / decisions needed before planning

1. Does the EV-Accounts API build `dataSourceInfo` from a `data_source` label alone (name, dead link) or require `source_url`? (Determines whether label-only rows currently show a broken link or nothing.)
2. MA DLS `source_url` granularity — one report URL for all MA cities, or a per-city DLS Databank page?
3. Policy on AI explainer text (§4) — cite or formalize-as-labeled?
4. Should `data_source_id`/`source_registry` be the single source-of-truth mechanism cohort-wide (federal model), or is the `source_url` column fine for city/state/county? (Currently mixed.)

---

## Appendix — reproduce these numbers

Run against the production `treasury` schema (via `mcp__supabase-local__execute_sql` or `.env` service key):

- Coverage by entity: `SELECT m.entity_type, COUNT(*), COUNT(*) FILTER (WHERE b.source_url<>'' OR b.data_source_id IS NOT NULL) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id GROUP BY 1;`
- City gap by source: filter `entity_type IN ('city','municipality') AND (source_url IS NULL OR source_url='') AND data_source_id IS NULL`, group by `state` / `dataset_type` / `data_source`.
- Enrichment: `SELECT source, confidence, COUNT(*) FROM treasury.category_enrichment GROUP BY 1,2;`
