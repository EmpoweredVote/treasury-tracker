---
phase: 73-utah-verification-source-chain-audit-uat
plan: "73-02"
requirements: [UVER-01]
status: complete
date: 2026-06-20
---

# 73-02 SUMMARY — Utah Source-Chain Durability + Bleed-Safety Audit (UVER-01 part B)

**Status:** ✅ Complete. Full-cohort read-only audit of the Utah backfill **passes**: every loaded budget/salary row carries durable human-page attribution (the uniform `https://transparent.utah.gov` bare domain), zero residue, salaries are names-free, and the Phase-72 enrichment is bleed-safe. The 4 pre-existing non-P72 `$`-leak enrichment rows are documented as a follow-up (not fixed). Read-only, production DB, no live BigQuery, $0.

## Cohort (discovered, not assumed)

Cohort = every municipality with a `data_source='Transparent Utah'` budget row → **15 entities**: 10 cities (Layton, Lehi, Ogden, Orem, Provo, Salt Lake City, Sandy, St. George, West Jordan, West Valley City) + 5 counties (Davis, Salt Lake, Utah, Washington, Weber).

## Task 1 — per-dataset cohort counts + attribution + NULL source_url

| Dataset | Rows | Transparent Utah + source_url | NULL source_url | FY2026 rows |
|---|---|---|---|---|
| operating | **180** (15 × 12 FY) | 180 | **0** | **0** |
| revenue | **180** (15 × 12 FY) | 180 | **0** | **0** |
| salaries | **179** (120 city + 59 county) | 179 | **0** | **0** |

- **Budget op+rev = 360 rows** = 10 cities × 24 + 5 counties × 24 — matches the Phase 69 (240 city) + Phase 70 (120 county) loads exactly.
- **Salaries = 179**, NOT the 120 the 73-02 plan assumed. The extra 59 are **county-government salaries** loaded by the Phase **71.1 single-scan rollup ETL** (which swept PY for all 15 mapped entities, beyond Phase 71's 10-city / 120-row scope). This is **additional coverage, not a gap or defect** — every county salary row is durably sourced and names-free (below).
- **Every** budget + salary row carries `data_source='Transparent Utah'` + `source_url='https://transparent.utah.gov'`; **0** NULL-source_url rows; **0** FY2026 rows.

## Task 2a — fragility (durable human-page bar, D-73-04)

Distinct `source_url` across the entire cohort: exactly **one** value — `https://transparent.utah.gov`. This bare domain is a stable, version-independent, citizen-openable page: no export tokens, no session URLs, no `/resource/*.json` or BigQuery endpoints, no version/date query params. **Fragile/version-specific count = 0.** Uniform single-domain attribution is the Utah norm (unlike CA's `/d/` deep links + publicpay split) and PASSES the durability bar.

## Task 2b — zero residue (D-73-05)

| Check | Result |
|---|---|
| Phantom `entity_type='city'` "% County" rows (the 70-02 incident) | **0** — cleanup confirmed |
| Cohort Transparent Utah rows with NULL/zero `total_budget` | **0** |
| Duplicate (municipality_id, fiscal_year, dataset_type) in cohort | **0** |
| FY2026 rows | **0** |

## Task 2c — salaries names-free PII guard (D-73-06)

All **179** salary hierarchies (cities + counties) serialized and scanned for PII tokens (`vendor_name`, `hourly_rate`, `gender`, `employee`, first/last name, `ssn`, `dob`, …). **PII token hits = 0.** The stored trees are `org1`/`cat1`/SUM only — the names-free guarantee (D-71-01, enforced by `loadUtahTransparency.test.mjs`) holds in production across the full salaries cohort.

## Task 2d — enrichment counts + bleed (D-73-07)

- **Universal (`municipality_id` NULL) `category_enrichment` total = 4,476** — matches the Phase 72 verified clean baseline; **0 duplicate name_keys** (the NULLS-DISTINCT duplicate incident stayed fixed). Phase 72 authored 3,536 of these.
- **P72 bleed-safety:** **0** universal rows contain a UT city/county name → no city-name bleed across the 3,536 P72 rows.
- **`$`-leak rows = exactly 4**, all `generated_at = 2026-03-28` (pre-Phase-72): `parking meter`, `harbor and port enterprise fund`, `sewer enterprise fund`, `solid waste enterprise fund`. These are the known pre-existing AI-authored universal rows, **NOT Phase 72 output**.

## Requirements

- **UVER-01 part B (source-chain durability audit):** ✅ satisfied — every newly-loaded Utah budget/salary row carries durable human-page attribution, 0 NULL/fragile source_url, 0 residue; salaries names-free; P72 enrichment bleed-safe.

## Follow-ups (documented, NOT fixed here — D-73-07, D-73-08)

1. **4 pre-existing `$`-leak universal enrichment rows** (2026-03-28 origin: parking meter, harbor and port enterprise fund, sewer enterprise fund, solid waste enterprise fund) — bleed-safety cleanup of the original AI enrichment. Out of this read-only phase's scope; recommend a small follow-up to strip the `$`-figures.
2. **Salt Lake County FY2025 salaries** — the one absent (entity, FY) salaries combo (consistent with FY2025 being the current/near-complete year; 71.1 logs absent combos as coverage notes, never deletes). Will fill on the next FY2025-complete rollup refresh. Not a residue/defect.

## Self-Check: PASSED

Read-only (no writes, no BigQuery), $0; durable single-domain source chain, 0 NULL/fragile/residue, 0 PII across 179 salary rows, enrichment at 4,476/0-duplicate, 0 city-name leaks, the 4 pre-existing `$`-leaks enumerated as a follow-up. UVER-01 part B satisfied. Verify probe target: this file references UVER-01, residue, fragility, transparent.utah.gov, and PII.
