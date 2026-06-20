# 68-01 SUMMARY — BigQuery Access (UTSRC-01 access portion)

**Status:** ✅ Complete — access granted + verified live 2026-06-19, $0.

## What happened

- Access request to `alexnielson@utah.gov` for `chris@empowered.vote` (org = Empowered Vote, project `empowered-vote-486302`). Sent 2026-06-17; the table returned `Access Denied` until granted.
- **Alex confirmed the grant 2026-06-19.** Verified live via the Node `@google-cloud/bigquery` client (the loader's auth path) — a dry-run + a real `SELECT DISTINCT entity_name … LIKE '%provo%'` both return rows, no Access Denied, $0 (dry-run scans 0 bytes).

## Access recipe (documented for reuse)

Full runbook: **`docs/utah-bigquery-access.md`**. Key points:
- gcloud SDK at `C:\Users\Chris\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin` (off default PATH — prepend it).
- **Two** interactive logins required, both in a real terminal: `gcloud auth login` (CLI) **and** `gcloud auth application-default login` (ADC — what the Node loader uses). The `empowered.vote` Workspace reauth policy throws `invalid_rapt` non-interactively; the two creds are separate.
- `npm install` to restore `@google-cloud/bigquery@^7.9.0` (was missing from `node_modules`).
- $0 via the 1 TB/month free tier; always column-project + filter `entity_name`/`fiscal_year`/`type`.

## Corrections surfaced (recorded in CONTEXT D-03/D-11/D-15 + the access doc)

- **No `entity_id` column** (entity key = `entity_name` + `govt_lvl`).
- **Data starts FY2014, not FY2009** (all 15 targets FY2014→FY2026).

## Requirement

UTSRC-01 **access portion satisfied**. The entity-name mapping portion is completed in 68-03 (`docs/utah-entity-mapping.md`).
