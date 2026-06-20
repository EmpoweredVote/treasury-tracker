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

## Manual rollup refresh (the ONLY bulk BigQuery access — Phase 71.1 / UETL-01)

**Background:** The per-(entity,FY,type) live-query pattern ran up ~21 TiB / ~$132 in one day
(2026-06-19 cost incident: 622 queries, each full-scanning the unpartitioned source table at ~35–47 GiB
regardless of the WHERE filter). Phase 71.1 replaces that pattern with ONE rollup scan into Supabase,
refreshed manually. Per-entity querying is guardrailed off at 2 GiB by default.

**The single rollup scan** covers all 15 mapped entities × FY2014–2025 × EX/RV/PY in one parameterized
GROUP BY query. Estimated bytes: ~47 GiB. Estimated cost: ~$0.29 (at $6.25/TiB). Fits under the
1 TiB/day project quota. Run cadence: ad-hoc / manual only — no scheduler.

### Step-by-step runbook

1. **Open a real terminal** (PowerShell or Git Bash — not Claude's Bash tool, which can't open browsers
   for the ADC reauth if needed).

2. **Prepend gcloud SDK to PATH** (it is not on the default PATH):
   ```powershell
   $env:Path = "C:\Users\Chris\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:Path
   ```

3. **Source the gitignored `.env`** (provides SUPABASE_SERVICE_KEY and SUPABASE_URL):
   ```powershell
   # PowerShell — source .env manually
   Get-Content .env | ForEach-Object {
     if ($_ -match '^([^#=]+)=(.+)$') { [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), 'Process') }
   }
   ```
   Or in Git Bash: `set -a && source .env && set +a`

4. **Verify ADC** (the Node BQ client uses ADC, not the CLI credential):
   ```bash
   gcloud auth application-default print-access-token
   ```
   If it throws `invalid_grant` / `invalid_rapt` (Workspace session-length policy), reauth:
   ```bash
   gcloud auth application-default login
   ```
   This opens a browser — must be done in a real terminal, not non-interactively.

5. **Run the free dry-run preview** (bills 0 bytes, quota-exempt, no writes):
   ```bash
   node scripts/loadUtahTransparency.js --rollup
   ```
   Confirm the output shows: estimated GiB (~40–50), estimated cost (~$0.25–$0.30), quota-fit: FITS.

6. **After the 1 TiB/day quota has reset** (next calendar day UTC — do NOT raise the quota):
   ```bash
   node scripts/loadUtahTransparency.js --rollup --confirm
   ```
   The real scan runs, rows are grouped in memory, and all (entity, FY, type) groups are upserted to
   Supabase via `treasury_sync_city_budget`. Expect ~$0.29 billed for ONE scan. Confirm in GCP Billing
   → BigQuery → Reports 24–48h later.

7. **Verify in Supabase** after the run: spot-check that 15 entities' operating/revenue/salaries rows
   match the pre-run state (idempotent refresh). No FY2026 rows; no different-source rows touched;
   nothing deleted.

### Cost discipline
- NEVER run `--rollup --confirm` more than once per day (1 TiB/day quota; one scan ≈ 47 GiB).
- NEVER run the per-entity mode (`--entity`) without an explicit LOADER_MAX_GIB override — the 2 GiB
  cap will trip the guardrail on raw-table scans.
- DO NOT raise the QueryUsagePerDay quota. It is intentional.
