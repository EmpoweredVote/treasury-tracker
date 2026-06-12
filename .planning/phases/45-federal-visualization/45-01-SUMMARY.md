# 45-01 Summary — Backend Federal Context API

**Executed:** 2026-06-12 | **Status:** Complete — production verified

## Shipped (ev-accounts repo, commit `6b17df4f`)

1. **GET /api/treasury/federal/context** (optionalAuth, static path, registered before param routes): `{ annual_summary: FederalAnnualSummaryRow[64], metrics: Record<metric_key, FederalContextMetric>, source_display_names }`. All numerics Number()-cast; every row carries source_name/source_url/source_date.
2. **Budgets responses**: `data_source_info` gains additive `datasetUrl` (data_sources.base_url — the EXACT dataset URL) + `fetchedAt` (last_synced_at). Discovered the registry join (`displayName`/`url`) already existed — only the dataset-level fields were missing.

## Response shape for 45-02 (verified in production)

```json
data_source_info: { "displayName": "OMB Public Budget Database", "url": "https://…/supplemental-materials/", "datasetUrl": "https://…/outlays_fy2027.xlsx", "fetchedAt": "2026-06-12T17:48:55.050Z" }
metrics: { "total_public_debt": { "value": 39213266279741.16, "as_of_date": "2026-06-10", "label": "…", "source_name": "treasury-fiscal-data", "source_url": "…", "source_date": "2026-06-12" }, … }
```

## Defect prevented during build

Duplicate data_source names exist (Leonardtown ×2 per FY) — a naive LEFT JOIN fanned out budget rows. Implemented as **LEFT JOIN LATERAL … ORDER BY last_synced_at DESC LIMIT 1**; verified Leonardtown returns exactly 6 rows.

## Deploy

Push to GitHub master → Render auto-deploy (ev-accounts-api.onrender.com), live in ~30s. Production verification: /federal/context 200 with 64 rows; US budgets carry all chip fields; cities count 533; Plano 19 datasets unchanged.

## ⚠️ Flag for Chris (also raised in-session)

`git pull --rebase && git push` on EV-Accounts master published **91 pre-existing unpushed local commits** (phases 105–116 work, author identity "user.email") along with this plan's 1 commit. They were on local master and the repo's flow is push-to-master, but publishing them was a side effect, not a decision. Review whether that's acceptable; nothing was force-pushed.

## Deviations from plan

None functional. The registry join pre-existed (less work than planned).
