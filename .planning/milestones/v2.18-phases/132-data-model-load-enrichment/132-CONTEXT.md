---
phase: 132
title: "Data Model + Load + Enrichment — Pima County municipalities"
requirements: [PIMA-04, PIMA-05, PIMA-06]
---

# Phase 132 Context — Data Model + Load + Enrichment

## Goal (from ROADMAP)
Seed Oro Valley, Marana, Sahuarita, South Tucson under the **existing Pima County node**, load each city's General Fund (operating + revenue) at full parity via the source-safe RPC, then enrich bleed-safe. Consumes Phase 131 (`131-RECON.md` + `scripts/extractAcfrGF.py`). Mirrors the proven Tucson Phase 129 (`seedTucsonArizona.js` → `processTucson.js` → `loadTucsonEnrichment.mjs`).

## Load set (from 131-RECON.md, FY2019–2024 window)
| City | Window | FY×mode budgets rows |
|------|--------|-----|
| Oro Valley | FY2019–2024 | 12 |
| Marana | FY2019–2024 | 12 |
| Sahuarita | FY2019–2024 | 12 |
| South Tucson | FY2019–2022 | 8 |

**Total = 44 `budgets` rows** (2 datasets × each city-FY). PDFs already in gitignored `docs/<City>/`; canonical `source_url`s + printed totals are in `131-RECON.md`.

## Locked decisions
- **`entity_type = 'city'` for all four.** TT has no 'town' entity type; the frontend renders municipality nodes as cities (Tucson precedent). Display names carry no "Town of" prefix: `Oro Valley`, `Marana`, `Sahuarita`, `South Tucson`.
- **Link to the EXISTING Pima County node** (`id = b799043e-28f6-4229-9480-8d6b7e329d26`, seeded v2.17) via `municipalities.county_id`, using the `seedCountyLinks.js` NULL-or-same guard. **No new county node.** Tucson stays linked; all five munis list together in the Cities-in-County panel.
- **Basis = General Fund**, source-safe **`treasury_sync_budget_tree`** (never `treasury_sync_city_budget` — it overwrites + keeps stale labels, see [[project_sync_city_budget_not_source_safe]]). Ephemeral `data_sources` (0 residue, WR-05). `source_date = <FY>-06-30`. Idempotent (0 net change on re-run).
- **Populations** pinned from 2024 Census (sub-est2024, SUMLEV 162, state FIPS 04): Oro Valley ≈ 48k, Marana ≈ 59k, Sahuarita ≈ 37k, South Tucson ≈ 5.5k — pin exact values, no placeholders.
- **Enrichment authored inline at $0** (no paid AI — API-cost guardrail). Universal rows only where the label is genuinely shareable + generic (no `$`, no city names); city-scoped otherwise; universal writes delete-then-insert (NULLS-DISTINCT-safe, see [[reference_category_enrichment_nulls_distinct]]). Tucson's existing universal rows already cover many shared labels — fill only the gaps, assert 100% coverage.

## Carried from Phase 131 (must handle here)
- **Oro Valley glyph-spacing label cleanup (deferred from 131):** OV FY2020+ leaves render "Tran s it"/"In teres t"/"in v es tmen ts" under `-table`. Apply a small OV label-normalization map in the loader (`processPimaCities.js`) at tree-map time. Values/ties are already correct; this only fixes display labels.

## Execution environment
- Run on `main` (gitignored `docs/<City>/` PDFs; not a worktree). `python` on PATH is the WindowsApps stub — invoke the extractor via `py -3` in the loader's spawn. Source `.env`/`.env.local`; use `SUPABASE_SERVICE_KEY`. Executed inline (no subagents).

## Plans
- **132-01** (PIMA-04): `scripts/seedPimaMunicipalities.js` — seed 4 munis + link to existing Pima node, idempotent, no data_source rows.
- **132-02** (PIMA-05): `scripts/processPimaCities.js` — source-safe GF load (operating + revenue) for the 44 city-FYs, sourced, idempotent, OV label-cleanup.
- **132-03** (PIMA-06): `scripts/loadPimaEnrichment.mjs` — bleed-safe 100% enrichment across all 4 cities' loaded categories.
