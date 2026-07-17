---
phase: 133-verification-live-uat
requirement: PIMA-07
kind: blind-re-derivation + source-chain-audit + D-05-confirmation
date: 2026-07-17
method: loader-independent (from-scratch JS parser, `pdftotext -table`, live-DB diff, exact-$0 tolerance)
ai_spend: "$0 (no AI calls)"
result: PASS
coverage: 44/44 FY×mode roll-ups + every category + every displayed leaf (Oro Valley, Marana, Sahuarita, South Tucson)
---

# Phase 133 — PIMA-07 Machine Verification Log

**Result: PASS.** Every displayed General Fund figure for the four Pima County
municipalities — Oro Valley, Marana, Sahuarita (FY2019–2024) and South Tucson
(FY2019–2022), all **44** FY×mode roll-ups, every category subtotal, and every
displayed leaf — was independently re-derived directly from the source ACFR PDFs and
ties the live production DB at **exactly $0**. The full source-chain audit (D-04 a–e)
is clean, and the Phase-132 loader source-safety invariants (D-05) are confirmed in
place with a residue-free, 0-net-change idempotent re-run. This is the direct scaled
analog of the shipped `130-REDERIVATION.md` (Tucson, 1 city → 4 cities here).

## Method (D-01, D-02, D-03, D-03a)

- **Harness:** `scripts/verify-phase133-rederive.mjs` — a from-scratch JS
  re-derivation. It does **not** import, require, or shell out to
  `scripts/extractAcfrGF.py` (the Phase-131 loader extractor) or any shared module. It
  has its own money regex, statement-page finder, positional GF-column isolation, and
  section/tree builders.
- **Source read:** its own `pdftotext -table` call per PDF (never `-layout`, which
  scrambles the multi-fund columns). The General Fund is always the first data
  column, isolated by nearest-anchor from the fully-populated `Total revenues` /
  `Total expenditures` rows; a blank/dash GF cell means "skip this row" (these
  statements have no genuine multi-line-wrapped labels, so no label-buffering is
  needed — 131-RECON.md §Extractor notes).
- **Diff target:** the **live production DB** (`treasury.budgets` /
  `budget_categories` / `budget_line_items`), pulled independently — not
  `131-RECON.md`'s printed numbers and not the Python extractor. RECON was used only
  to map each `<City>-FY<year>.pdf` to its FY.
- **Tolerance:** exact-0 on every figure (`abs(delta) === 0`). Agreement between this
  independent JS path and the DB (built by the Python-extractor + loader path) proves
  the displayed figures are real.

## Coverage (D-01, D-03) — all 44 FY×mode roll-ups tie at $0

| City | Mode | FYs | Roll-up delta | Category-subtotal deltas | Leaf-value deltas |
|------|------|-----|---------------|---------------------------|--------------------|
| Oro Valley | revenue | 2019–2024 (6) | all $0 | all $0 | all $0 |
| Oro Valley | operating | 2019–2024 (6) | all $0 | all $0 | all $0 |
| Marana | revenue | 2019–2024 (6) | all $0 | all $0 | all $0 |
| Marana | operating | 2019–2024 (6) | all $0 | all $0 | all $0 |
| Sahuarita | revenue | 2019–2024 (6) | all $0 | all $0 | all $0 |
| Sahuarita | operating | 2019–2024 (6) | all $0 | all $0 | all $0 |
| South Tucson | revenue | 2019–2022 (4) | all $0 | all $0 | all $0 |
| South Tucson | operating | 2019–2022 (4) | all $0 | all $0 | all $0 |

44 FY×mode combinations total (22 city-FYs × 2 modes); every roll-up, every category,
and every leaf across all 44 ties the live DB exactly. Blockers on the full run: **0**.

### Latest-FY grounding (label + value exact, per city)

**Oro Valley FY2024** — revenue **$59,077,316** / operating **$50,170,504**

| Mode | Category | Leaf | PDF (independent) | DB | Δ |
|------|----------|------|-------------------:|---:|---|
| operating | Current ($47,774,541) | General government | 21,508,943 | 21,508,943 | 0 |
| operating | Current | Public safety | 20,170,049 | 20,170,049 | 0 |
| operating | Current | Transit *(disposition: raw PDF "Tran s it")* | 1,697,772 | 1,697,772 | 0 |
| operating | Current | Culture and recreation | 4,397,777 | 4,397,777 | 0 |
| operating | Capital outlay | Capital outlay | 1,814,920 | 1,814,920 | 0 |
| operating | Debt service ($581,043) | Principal retirement | 489,400 | 489,400 | 0 |
| operating | Debt service | Interest and fiscal charges | 91,643 | 91,643 | 0 |
| revenue | — | Sales taxes | 26,715,684 | 26,715,684 | 0 |
| revenue | — | Franchise taxes | 715,334 | 715,334 | 0 |
| revenue | — | Intergovernmental *(disposition: raw PDF "Integovernmental" typo, FY2020 instance below)* | 25,260,912 | 25,260,912 | 0 |
| revenue | — | Licenses, fees and permits | 2,122,503 | 2,122,503 | 0 |
| revenue | — | Fines, forfeitures and penalties | 61,640 | 61,640 | 0 |
| revenue | — | Charges for services | 2,984,059 | 2,984,059 | 0 |
| revenue | — | Donations | 5,122 | 5,122 | 0 |
| revenue | — | Interest *(disposition: raw PDF "In teres t")* | 747,818 | 747,818 | 0 |
| revenue | — | Net increase/(decrease) in fair value of investments *(disposition: raw PDF "in v es tmen ts")* | -108,967 | -108,967 | 0 |
| revenue | — | Other | 573,211 | 573,211 | 0 |

**Marana FY2024** — revenue **$94,153,099** / operating **$59,821,670**

| Mode | Category | Leaf | PDF (independent) | DB | Δ |
|------|----------|------|-------------------:|---:|---|
| operating | Current ($56,116,975) | General government | 18,580,854 | 18,580,854 | 0 |
| operating | Current | Public safety | 21,797,377 | 21,797,377 | 0 |
| operating | Current | Highways and streets | 3,347,517 | 3,347,517 | 0 |
| operating | Current | Health and welfare | 416,217 | 416,217 | 0 |
| operating | Current | Economic and community development | 4,943,778 | 4,943,778 | 0 |
| operating | Current | Culture and recreation | 7,031,232 | 7,031,232 | 0 |
| operating | Capital outlay | Capital outlay | 3,563,464 | 3,563,464 | 0 |
| operating | Debt service ($141,231) | Principal retirement | 113,876 | 113,876 | 0 |
| operating | Debt service | Interest and fiscal charges | 27,355 | 27,355 | 0 |
| revenue | — | Sales taxes | 44,763,592 | 44,763,592 | 0 |
| revenue | — | Intergovernmental | 26,020,737 | 26,020,737 | 0 |
| revenue | — | Licenses, fees and permits | 10,017,930 | 10,017,930 | 0 |
| revenue | — | Fines, forfeitures and penalties | 410,716 | 410,716 | 0 |
| revenue | — | Charges for services | 812,584 | 812,584 | 0 |
| revenue | — | Lease income | 170,302 | 170,302 | 0 |
| revenue | — | Investment income | 10,938,076 | 10,938,076 | 0 |
| revenue | — | Miscellaneous | 1,019,162 | 1,019,162 | 0 |

**Sahuarita FY2024** — revenue **$32,166,628** / operating **$23,924,397**

| Mode | Category | Leaf | PDF (independent) | DB | Δ |
|------|----------|------|-------------------:|---:|---|
| operating | Current ($23,363,720) | General government | 7,431,137 | 7,431,137 | 0 |
| operating | Current | Public safety | 12,450,244 | 12,450,244 | 0 |
| operating | Current | Culture and recreation | 3,482,339 | 3,482,339 | 0 |
| operating | Capital outlay | Capital outlay | 302,775 | 302,775 | 0 |
| operating | Debt service ($257,902) | Principal | 244,724 | 244,724 | 0 |
| operating | Debt service | Interest | 13,178 | 13,178 | 0 |
| revenue | — | Taxes | 10,281,702 | 10,281,702 | 0 |
| revenue | — | Licenses and permits | 2,821,261 | 2,821,261 | 0 |
| revenue | — | Intergovernmental | 16,603,123 | 16,603,123 | 0 |
| revenue | — | Charges for services | 291,060 | 291,060 | 0 |
| revenue | — | Fines and forfeitures | 147,595 | 147,595 | 0 |
| revenue | — | Investment earnings (losses) | 1,826,030 | 1,826,030 | 0 |
| revenue | — | Miscellaneous | 195,857 | 195,857 | 0 |

**South Tucson FY2022** — revenue **$6,201,468** / operating **$5,883,806**

| Mode | Category | Leaf | PDF (independent) | DB | Δ |
|------|----------|------|-------------------:|---:|---|
| operating | Current ($5,301,120) | General government | 1,416,839 | 1,416,839 | 0 |
| operating | Current | Public safety | 3,782,754 | 3,782,754 | 0 |
| operating | Current | Highways and streets | 101,527 | 101,527 | 0 |
| operating | Capital outlay | Capital outlay | 49,673 | 49,673 | 0 |
| operating | Debt service ($533,013) | Principal retirement | 312,685 | 312,685 | 0 |
| operating | Debt service | Interest and fiscal charges | 220,328 | 220,328 | 0 |
| revenue | — | City sales taxes | 3,985,982 | 3,985,982 | 0 |
| revenue | — | Property taxes | 59,073 | 59,073 | 0 |
| revenue | — | Licenses and permits | 379,383 | 379,383 | 0 |
| revenue | — | Intergovernmental | 1,611,036 | 1,611,036 | 0 |
| revenue | — | Fines and forfeits | 101,591 | 101,591 | 0 |
| revenue | — | Investment earnings | 7 | 7 | 0 |
| revenue | — | Miscellaneous | 64,396 | 64,396 | 0 |

### Oro Valley cosmetic label quirks (only permitted disposition)

Two documented, label-only Oro Valley defects were dispositioned during the full
44-row run — **in every instance the dollar VALUE tied exactly; only the raw-PDF text
label differed from the loader's cleaned label** (132-02-SUMMARY.md `OV_LABEL_FIXES`):

1. **`pdftotext -table` glyph-split rendering** (OV's newer PDFs render some glyphs
   space-separated): `"Tran s it"` → `Transit` (FY2020/2023/2024 operating);
   `"In teres t"` → `Interest` (FY2020/2023/2024 revenue); `"Net increase/(decrease)
   in fair value of in v es tmen ts"` / `"...of inves tments"` → `Net
   increase/(decrease) in fair value of investments` (FY2020/2024 revenue).
2. **Source-PDF typo**: `"Integovernmental"` → `Intergovernmental` (FY2020 revenue,
   $14,527,210 both sides).

The harness (`scripts/verify-phase133-rederive.mjs`) does not hardcode either string —
it pairs any items left unmatched by normalized-label lookup with a same-value
counterpart (general "label variance, value ties exactly" disposition, OroValley-only)
so it never silently passes a real numeric mismatch. All 13 dispositioned instances
tied at exact $0; 0 un-dispositioned mismatches on the full run.

## Source-chain audit (D-04) — clean (a–e)

`scripts/verify-phase133-audit.mjs` (read-only DB + per-URL reachability), all PASS:

| Check | Result |
|-------|--------|
| **(a)** 44 `budgets` rows, all `source_url` + `source_date`=`<FY>-06-30` non-null | PASS — 44/44, 0 nulls, 0 bad dates |
| **(b·1)** each row's `source_url` == correct-per-FY 131-RECON canonical origin URL | PASS — all 44 rows point at their city+FY ACFR |
| **(b·2)** each distinct `source_url` resolves to a reachable PDF | PASS — Oro Valley/Marana/Sahuarita all HTTP 200 `application/pdf` direct; South Tucson's 4 URLs corroborated reachable via Wayback Machine CDX (see note below) |
| **(c)** 0 orphan `data_sources` residue (per-city `dataset_id ILIKE '<slug>-acfr%'`) | PASS — residue = 0 across all four cities |
| **(d)** all `data_source` labels match expected `dataSourceLabel(muniName, fy, datasetType)` shape | PASS — all 44 match, no stale labels |
| **(e)** all 4 municipalities carry population>0 + `population_year`=2024 + `county_id`==Pima | PASS — Oro Valley 48,855; Marana 62,380; Sahuarita 37,448; South Tucson 4,535 (all 2024); Pima County 1,080,149/2024; all four `county_id` link to Pima |

**Retrieval-deviation note (b·2):** 131-RECON.md documents Oro Valley, Marana, and
South Tucson's origin hosts as WAF-blocked to automation (expected 403). On this
live run, Oro Valley and Marana in fact returned HTTP 200 directly (WAF posture can
vary). South Tucson's four canonical URLs returned an anti-bot **soft-404** (not the
anticipated 403) — before accepting this as the documented retrieval deviation rather
than a broken/incorrect URL, the audit independently corroborated each exact URL via
the **Wayback Machine CDX index**, confirming a genuine historical `200
application/pdf` capture for all four (proving the stored `source_url` is the correct
canonical origin; the live anti-bot behavior blocks automation, not real users, and
does not indicate link rot or an incorrect URL). This generalizes the documented WAF
deviation to the anti-bot-blocking-pattern class rather than the single HTTP code
`403` — a Rule-1-class robustness fix to the audit script itself, not a scope change
(no new URLs, no DB writes).

## D-05 — loader source-safety invariants confirmed + idempotent smoke-check

**Already shipped in Phase 132** (132-02-SUMMARY.md) — this phase **confirms**, it did
not re-apply (all invariants found present and correct; no fix branch was triggered).

- **Source-safe RPC (present):** `scripts/processPimaCities.js` loads exclusively
  through `treasury_sync_budget_tree` (line 241) — no reference to
  `treasury_sync_city_budget` anywhere in the file (grep-confirmed).
- **Ephemeral `data_sources` lifecycle (present):** `createEphemeralDataSource` at run
  start (line 265) / `deleteEphemeralDataSource` in a `finally` block at run end (line
  294) — WR-05.
- **Municipality-keyed pre-load delete (present):** `loadFiscalYear`'s pre-load delete
  (lines 237–239) is keyed on `(municipality_id, fiscal_year, dataset_type)`, not
  `data_source_id`.
- `node --check scripts/processPimaCities.js` → OK.
- **Idempotent smoke re-run** (both modes — plain + `--revenue` — over the existing
  windows only: Oro Valley/Marana/Sahuarita FY2019–2024, South Tucson FY2019–2022; no
  new FYs attempted): completed cleanly. Pre/post row-count and per-city dollar-sum
  snapshots were identical (44 rows total; Oro Valley $569,950,050; Marana
  $707,894,592; Sahuarita $261,515,058; South Tucson $45,091,473 — unchanged), and
  each city×mode logged `data_source … deleted (ephemeral cleanup — 0 residue)`.
- **Post-smoke re-verification:** `scripts/verify-phase133-audit.mjs` was re-run
  immediately after the smoke load — still PASS (0 residue, 44/44 rows tie, all
  labels/URLs/population checks clean), proving the re-run netted 0 change.
- **Scope fence honored:** no new FYs, no South Tucson FY2023/FY2024 attempted, no
  schema/RPC/frontend change.

## Reproduce

```bash
node scripts/verify-phase133-rederive.mjs   # exit 0 = all 44 FY×mode + every leaf tie at $0
node scripts/verify-phase133-audit.mjs      # exit 0 = source chain clean (a-e)
```

Both are read-only against the DB (the audit additionally HEAD/GETs the per-city
canonical URLs + a Wayback CDX lookup for the South Tucson deviation). $0 AI spend
(no AI calls in either script). No new data, no new FYs, no schema/RPC/frontend change.
The only production write this phase was the idempotent D-05 smoke re-run, which
netted 0 change (verified above).
