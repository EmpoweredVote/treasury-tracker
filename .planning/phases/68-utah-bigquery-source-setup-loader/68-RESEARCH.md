# Phase 68: Utah BigQuery Source Setup + Loader — Research

**Researched:** 2026-06-17 (inline, no subagent — per project preference). Builds on `.planning/research/UTAH-RECON.md` (source recon) — this doc covers the **planning/implementation specifics** for the loader, MCP, and access path.

## Access path (the gating fact — verified live 2026-06-17)

The Utah table `ut-sao-transparency-prod.transaction.transaction` is **access-by-request**, not open. Live test from `chris@empowered.vote` (project `empowered-vote-486302`, BigQuery API enabled) → **Access Denied** on query/get/list. Grant process (`old.transparent.utah.gov/how_to_become_superuser.php`):
1. Email **`alexnielson@utah.gov`** with EV org + the Google account(s) to grant.
2. Have a GCP project (✓ `empowered-vote-486302`).
3. Utah grants the account read access; verify with `SELECT DISTINCT entity_name FROM \`ut-sao-transparency-prod.transaction.transaction\``.

**Consequence for planning:** the access request + grant is a human-in-the-loop dependency with unknown lead time. Split the phase so (a) the access request goes out first and (b) the loader is **built + unit-tested offline against the documented schema** in parallel, with (c) live validation (entity-name recon + pilot dry-run + MCP wiring) gated on the grant.

## Environment (verified)

- gcloud SDK installed at `C:\Users\Chris\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin` (NOT on PATH for pre-existing shells — prepend it, or open a fresh terminal). `gcloud`/`bq` both present.
- Authed: `chris@empowered.vote`; active project `empowered-vote-486302`; ADC quota project set; `bigquery.googleapis.com` enabled.
- No `@google-cloud/bigquery` npm dependency yet — the loader needs it added (or shell out to `bq query --format=json`).

## Loader design (`scripts/loadUtahTransparency.js`)

Mirror `scripts/bulkLoadStateController.js` (the analog) almost exactly — swap only the data-fetch layer:

| Concern | CA loader (analog) | Utah loader |
|---|---|---|
| Fetch | Socrata HTTP `fetchAllPages()` | **BigQuery query** per entity/FY/`type` (`@google-cloud/bigquery` client w/ ADC, recommended; or `bq query --format=json`) |
| Source filter | `county=...` / `entity_name=...` + `fiscal_year=...` | `entity_name=@name AND fiscal_year=@fy AND type=@type` (parameterized; column projection only — keep scanned bytes tiny for the 1 TB/mo free tier) |
| Type split | datasets expenditures/revenues | `type='EX'`→operating, `type='RV'`→revenue (`PY`→salaries deferred to Phase 71) |
| Tree | `category → subcategory_1 → line` | **function/purpose-first** (D-05): top = functional column (`function1`/`cat1` — confirm which is clean once access lands), 2nd = sub-function/category, items = line. Same compact JSON shape `{n,a,c}`/`{n,a,i}`. |
| Amount | `amt(row.value)` | `amt(row.amount)` (handle negatives/offsets) |
| Write | `treasury_sync_city_budget` RPC (`p_municipality_id,p_fiscal_year,p_dataset_type,p_total,p_tree,p_row_count,p_data_source_name,p_source_url,p_source_date`) | **identical RPC + params** |
| Source attribution | ByTheNumbers page URL | `data_source_name='Transparent Utah'`, `source_url=` per-entity page (D-08, confirm `entity_id`-keyed pattern), `source_date` once/run; CC BY 4.0 |
| Never-overwrite | `findConflictingBudget()` pre-skip | **identical guard** |
| Population | SCO feed `estimated_population` | BQ has none → Census vintage (separate input; mirror `loadTXPopulation.js`); Phase 68 dry-run can skip population |
| FY start month | — | Utah municipal FY = **July 1** → `fiscal_year_start_month=7` (confirm per entity) |
| Modes | `--dry-run`, `--list-cities`, `--city`, `--fy`, `--source-date` | same flags + `--entity` (exact BQ `entity_name`) |

**Buildable offline:** the tree-builder, amount parsing, RPC param assembly, never-overwrite guard, and dry-run output are all unit-testable against fixture rows (a small JSON array shaped like BQ output) with NO BigQuery access. Model the test on `scripts/loadCASalaries.test.mjs`.

**Gated on access:** the BQ query function can be written but only *live-validated* once granted; the pilot-city dry-run (sane totals, tree shape) is the proof and needs real data.

## Read-only BigQuery MCP (D-12/13/14)

- Leading candidate: **Google official BigQuery MCP server** (2026; enabled with the BigQuery API, OAuth2+IAM — uses the same EV Workspace auth). Read-only community fallback `ergut/mcp-bigquery-server` (SELECT-only, dry-run-validated) if the official server needs IAM/billing we can't grant.
- Config: project-scoped `.mcp.json` (travels with repo); credentials via ADC, **never commit a key**. Read-only — never a write path.
- Gated on access: the MCP authenticates as the granted account, so it can't read the table until Utah grants access.

## Validation approach (Nyquist Dimension 8)

- **Unit-testable now (no access):** tree-builder (function/purpose grouping, totals = sum of children, zero-row skip, negative/offset handling), `amt()` parsing, never-overwrite decision logic, RPC-param assembly — fixture-driven test `scripts/loadUtahTransparency.test.mjs` (exit 0).
- **Live verification (post-grant):** `SELECT DISTINCT entity_name` returns rows for all 15 targets; pilot-city dry-run produces a sane multi-level tree with a total in a plausible range; zero DB writes confirmed.

## Risks

- **Access lead time unknown** — the #1 schedule risk; send the email first.
- **Account type** — Utah says "gmail accounts"; `chris@empowered.vote` (Workspace) should work as a principal but may be rejected → personal Gmail fallback (D-17).
- **Functional column cleanliness** — won't know if `function1` vs `cat1` is the clean tree top until data is visible; loader parameterizes the source column so it's a one-line switch.
- **Free-tier bytes** — naive `SELECT *` on 250M rows could approach 1 TB; project only needed columns + filter by entity/FY/type.
