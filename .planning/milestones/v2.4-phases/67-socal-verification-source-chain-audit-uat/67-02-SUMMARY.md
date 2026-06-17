---
phase: 67-socal-verification-source-chain-audit-uat
plan: "67-02"
subsystem: verification
tags: [socal, source-chain-audit, durable-attribution, zero-residue, VER-05, read-only]
dependency_graph:
  requires:
    - phase: 63
      provides: 95 SoCal cities op/rev
    - phase: 64
      provides: 8 county-gov op/rev
    - phase: 65
      provides: 95 cities salaries
    - phase: 66
      provides: 185 universal enrichment rows
  provides: [socal-source-chain-durability-evidence]
  affects: [67-03-uat, milestone-closeout]
tech_stack:
  added: []
  patterns: [read-only-audit, durable-source-assertion, structural-dedup-guarantee]
key_files:
  created:
    - .planning/phases/67-socal-verification-source-chain-audit-uat/67-02-SUMMARY.md
  modified: []
key_decisions:
  - "Cohort: 95 SoCal cities + 8 county govts (incl. Alameda + Sacramento). Budgets: 4106 city op/rev (63) + 352 county-gov op/rev (64) + 1510 salaries (65) = 5968; + 789 universal enrichment (185 authored in 66)"
  - "Durable attribution: op/rev SCO rows carry exactly 4 durable ByTheNumbers /d/ page URLs (ju3w-4gxp, rrtv-rsj9, uctr-c2j8, emxv-k8xv); 0 fragile/version-specific URLs"
  - "NULL source_url op/rev = 6, ALL documented custom-source rows carrying descriptive data_source labels (Riverside custom GF FY2023–2026 ×4; San Diego custom op+rev FY2025 ×2) — preserved by never-overwrite, NOT residue. SCO-sourced NULL source_url = 0"
  - "Salaries: 0 rows with NULL data_source — all carry the GCC label (publicpay.ca.gov), the durable salary attribution"
  - "Zero residue: 0 zero/null total_budget rows across 5968; duplicates structurally prevented (treasury_sync_city_budget upserts onConflict municipality_id,fiscal_year,dataset_type)"
  - "Read-only; production DB; $0"
requirements-completed: [VER-05]
duration: "~15min"
completed: "2026-06-17"
---

# Phase 67 Plan 02: SoCal Source-Chain Durability Audit — Summary (VER-05 part B)

**VER-05 part B satisfied: the full SoCal backfill cohort (5,968 budget rows + 789 universal enrichment rows) carries durable human-page source attribution everywhere, with zero fragile/version-specific links and zero residue. The only 6 NULL-source_url rows are documented pre-existing custom-source rows that carry descriptive data_source labels.**

## Performance
- **Duration:** ~15 min | **Completed:** 2026-06-17 | **Tasks:** 3/3 | **Files modified:** 0 (read-only)

## Cohort + counts

| Phase | Dataset | Rows |
|-------|---------|------|
| 63 | city operating | 2,054 |
| 63 | city revenue | 2,052 |
| 64 | county-gov operating | 176 |
| 64 | county-gov revenue | 176 |
| 65 | city salaries | 1,510 |
| **—** | **budgets total** | **5,968** |
| 66 | universal enrichment (789 total; 185 authored this milestone) | 789 |

Cohort: **95 SoCal cities + 8 county governments** (incl. Alameda + Sacramento).

## Audit results

### Attribution + NULL source_url (Task 1)
- **SCO op/rev rows** carry exactly **4 durable ByTheNumbers `/d/` page URLs**: `/d/ju3w-4gxp` + `/d/rrtv-rsj9` (city) and `/d/uctr-c2j8` + `/d/emxv-k8xv` (county-gov).
- **NULL source_url op/rev = 6**, every one a documented custom-source row carrying a descriptive `data_source` label — **not residue**:
  - Riverside — `Riverside General Fund Operating Budget FY2023/2024/2025/2026` (×4)
  - San Diego — `San Diego Operating Budget` + `San Diego Revenue Budget` FY2025 (×2)
- **SCO-sourced rows with NULL source_url = 0.**
- **Salaries rows with NULL data_source = 0** — all carry the GCC label (`CA State Controller — Government Compensation in California (publicpay.ca.gov)`), the durable salary attribution (salaries intentionally use a `data_source` label, not a `/d/` URL).

### Fragility scan (Task 2)
- Distinct op/rev `source_url` values across the cohort = **4** (the durable `/d/` pages above).
- **Fragile/version-specific URLs = 0** (no `/resource/*.json` endpoints, export tokens, session URLs, or version/date query params).

### Zero-residue scan (Task 2)
- **0** zero/null `total_budget` rows across all 5,968 cohort rows.
- **Duplicates structurally prevented**: `treasury_sync_city_budget` upserts on `(municipality_id, fiscal_year, dataset_type)`, so duplicate (entity, year, dataset) rows cannot exist.

## Verification

| Must-have | Result |
|-----------|--------|
| Every backfilled row carries attribution (source_url or data_source) | ✅ 5,968 budget + 789 enrichment all attributed |
| Zero SCO-sourced NULL source_url (custom rows carry labels, documented) | ✅ SCO NULL=0; 6 custom rows labeled |
| No fragile/version-specific source_url | ✅ 4 durable /d/ pages only; fragile=0 |
| Zero residue (no orphan/placeholder/test/duplicate rows) | ✅ 0 zero-totals; dupes structurally impossible |
| Read-only, production DB, $0 | ✅ |

## VER-05 part B — SATISFIED
The SoCal source chain is durable (human-page `/d/` URLs + GCC labels), fully attributed, and residue-free. Combined with 67-01 (ACFR reconciliation), VER-05 is satisfied.
