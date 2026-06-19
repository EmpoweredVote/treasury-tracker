# Transparent Utah BigQuery — Access Runbook (UTSRC-01)

The reusable recipe for querying the Utah State Auditor's **Transparent Utah** public
BigQuery dataset. Established for v2.5 (Phases 68–73) and reused by every downstream Utah phase.

## Access request & grant

- **Recipient:** `alexnielson@utah.gov` (Utah State Auditor — Transparent Utah super-user grants).
- **Requested account:** `chris@empowered.vote` (EV Google Workspace), personal Gmail noted as fallback (D-17).
- **Org / purpose:** Empowered Vote (nonprofit) — free public financial-transparency tool sourcing Utah city/county budgets to Transparent Utah.
- **GCP project:** `empowered-vote-486302` (BigQuery API enabled).
- **Process doc:** `old.transparent.utah.gov/how_to_become_superuser.php`.
- **Status: GRANTED — verified live 2026-06-19.** (Initial request 2026-06-17 hit `Access Denied`; Alex confirmed the grant 2026-06-19.)

## Working recipe

1. **gcloud SDK** is installed at `C:\Users\Chris\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin` — **NOT on the default PATH**; prepend it:
   - PowerShell: `$env:Path = "C:\Users\Chris\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:Path`
2. **Two interactive logins** (run in a REAL terminal — Claude's `!` can't launch the browser):
   - `gcloud auth login` (CLI credential)
   - `gcloud auth application-default login` (**ADC** — the credential the Node `@google-cloud/bigquery` loader actually uses)
   - ⚠️ The `empowered.vote` Workspace has a **reauth/session-length policy**: non-interactive use throws `invalid_grant … invalid_rapt`. Both creds expire on that policy and must be refreshed interactively. CLI login and ADC login are SEPARATE — refreshing one does not refresh the other.
3. **Node dependency:** `@google-cloud/bigquery@^7.9.0` is in `package.json`; run `npm install` (it was missing from `node_modules`).
4. **Verify query** (returns rows, not Access Denied):
   ```sql
   SELECT DISTINCT entity_name FROM `ut-sao-transparency-prod.transaction.transaction`
   WHERE LOWER(entity_name) LIKE '%provo%' LIMIT 20
   ```
   Verified: returns `Provo City`, `Provo City Housing Authority`, `Provo City School District`, etc.

## Cost ($0)

- BigQuery **sandbox / 1 TB-per-month free tier**. A single unfiltered fiscal-year scan ≈ 20–26 GB; always **project columns + filter `entity_name`/`fiscal_year`/`type`** to stay a tiny fraction of the free tier.
- Use **dry-run** jobs (`dryRun: true`, or `bq query --dry_run`) to confirm bytes scanned = 0 cost before real queries.

## Schema corrections (vs. original recon — verified live 2026-06-19)

- **NO `entity_id` column.** Entities are keyed by `entity_name` (STRING) + `govt_lvl`. (56 columns total; tree columns `function1-7`, `cat1-7`, `org1-10` all present.)
- **Data starts FY2014, not FY2009.** All 15 target entities: FY2014→FY2026 (FY2026 current/near-complete).
- See `docs/utah-entity-mapping.md` for the confirmed per-entity mapping.
