# Phase 57: Orange County County-Government Budget — Research

**Researched:** 2026-06-15 (inline — no subagent, per project token-cost rule)
**Consumes:** `57-CONTEXT.md` (decisions D-01..D-07)
**Produces:** input for `57-01-PLAN.md` (loader + load) and `57-02-PLAN.md` (frontend + verify)

> ## RESEARCH COMPLETE

---

## Question this answers

"What do I need to know to PLAN loading Orange County's **own** county-government
operating + revenue budget onto the existing OC county entity, render it (icicle/
summary + per-capita + a source tag), and verify it — without regressing the 34
linked cities?"

---

## 1. The load path (D-01) — SCO ByTheNumbers *County* datasets

Two Socrata datasets on `https://bythenumbers.sco.ca.gov`, filtered to the single
county entity (`entity_name='Orange'` — **no "County" suffix**, mirrors the city
`entity_name` field and `seedCountyLinks.js`):

| Dataset | Socrata ID | dataset_type | Durable page URL (source_url) |
|---------|-----------|--------------|-------------------------------|
| County Expenditures | `uctr-c2j8` | `operating` | `https://bythenumbers.sco.ca.gov/d/uctr-c2j8` |
| County Revenues | `emxv-k8xv` | `revenue` | `https://bythenumbers.sco.ca.gov/d/emxv-k8xv` |

These are the **county** feeds — distinct from the cities feeds (`ju3w-4gxp` /
`rrtv-rsj9`) the 34 OC cities loaded from. Using the cities revenue feed for the
county would misrepresent county-government revenue (CONTEXT specifics).

The exact loaders to mirror already exist and are proven (Phase 25, LA County):
- `scripts/loadLACountyOperating.js` — `uctr-c2j8`, `entity_name='Los Angeles'`,
  `buildTree` (category → subcategory_1 → line items via subcategory_2/
  line_description), `parseAmt`, writes via `treasury_sync_city_budget`.
- `scripts/loadLACountyRevenue.js` — `emxv-k8xv`, identical tree/write shape.

**Basis (Phase 56 finding):** SCO county totals are **all-governmental-funds**, not
General Fund. This is the figure that loads. Document the basis in the load output
and `57-VERIFICATION.md`.

## 2. What the LA loaders hardcode — and what the reusable loader must parameterize (D-07)

The LA loaders are permanent one-offs. They hardcode three things that must become
arguments in the new **reusable** `scripts/loadCountyBudget.js`:

| Hardcoded in LA loaders | Reusable loader behavior |
|-------------------------|--------------------------|
| `entity_name='Los Angeles'` in the `$where` | `--county "<Name>"` → `entity_name='<Name>'` (escape `'`) |
| Target municipality via `treasury_ensure_municipality('Los Angeles County', pop=10014009)` | **Look up the existing** county entity by name (`entity_type='county'`, `ilike '<Name> County'`, or `--entity` override) and use its id — do **not** ensure-with-population (would clobber). Pattern: `seedCountyLinks.js:92-99`. |
| Fixed `p_population` baked into ensure | Per-year population from feed if present, else `--population <n>` sourced fallback (D-06); never lower a non-zero pop to 0 (backfill-only, `bulkLoadStateController.js:112-120`). |
| **No** `p_source_url` / `p_source_date` | **Always** pass `p_source_url = <durable page URL>` + `p_source_date = <fetchDate>` (the Phase 52 hardening the city loader already has — `bulkLoadStateController.js:159-169`). |

The reusable loader should adopt the **city loader's** modern shape, not the LA
loader's: arg parsing + durable attribution + collision pre-pass +
`--county/--fy/--source-date/--dry-run`, but pointed at the *county* datasets and a
*single* county entity instead of looping cities. Recommended args:
`--county` (SCO filter), `--entity` (DB name override, default `"<county> County"`),
`--fy` (repeatable), `--type` (operating|revenue, default both), `--population`
(sourced fallback), `--source-date`, `--dry-run`.

**Write RPC:** `treasury_sync_city_budget` upserts on (municipality_id, fiscal_year,
dataset_type) → idempotent, so any year/chunk is safe to re-run (enables D-05).
`entity_type='county'` is already a property of the OC municipality (set at Phase 54
seed) — the sync RPC does not need it; the loader only needs the right
`municipality_id`.

## 3. The target entity (D-07, clean-state)

The OC county entity is named **"Orange County"** (`entity_type='county'`,
`state='CA'`), created by `seedCountyLinks.js --county "Orange"` in Phase 54
(`countyEntityName = "${county} County"`, line 79). The 34 cities are linked via
`municipalities.county_id` → this entity. Phase 56 confirmed the entity is
**directory-only** (zero budget rows → `available_datasets.length === 0`).

**Loader must:** resolve this exact entity id (error if not found — it must exist),
confirm it has **no** budget rows for the target (fy, dataset_type) before writing
(never-overwrite safety net, `bulkLoadStateController.js:findConflictingBudget`),
and attach budgets to it.

## 4. Population denominator (D-06) — runtime discovery

The **city** feeds carry `estimated_population` per row (used for per-capita). It is
**unconfirmed** whether the *county* feeds (`uctr-c2j8`/`emxv-k8xv`) carry
`estimated_population`. The dry-run task (Plan 57-01) inspects a returned row to
decide:
- **If present:** use the per-year value (backfill-only on the entity, never lower a
  non-zero pop). Honest across ~22 years of OC growth (~3.0M → ~3.2M).
- **If absent:** fall back to a single **sourced** figure via `--population`
  (CA Dept. of Finance E-series or Census; e.g. OC ≈ 3.17M for 2023) applied across
  years. **Document the population source** in the load + `57-VERIFICATION.md`.

Either way the per-capita denominator is sourced (project ground rule), not invented.

## 5. Year coverage + load discipline (D-04, D-05)

- Target the **full SCO county range (~FY2003–2024)** to match the 34 cities.
- **Chunked/canary discipline (D-05, from Phase 53):** dry-run → canary one recent
  year (FY2024) end-to-end → verify → backfill remaining years in small (≤2-year)
  submits. Each submit is idempotent. Avoids the 600s executor command-timeout on a
  single multi-year run.
- Years with no SCO county data log "No data found" and are skipped gracefully.

## 6. Frontend: rendering + source tag (D-03)

**Rendering is automatic.** `App.tsx:615-617` sets `isCountyDirectoryOnly` =
`entity_type==='county' && available_datasets.length === 0`. Once budget rows exist,
`available_datasets` is non-empty → the directory-only suppression lifts and the
existing icicle/summary + year selector + per-capita render with **no frontend
change**. The `CitiesInCountyPanel` (App.tsx:1200-1208) is independent of budget data
→ the 34 cities keep listing (no regression).

**SourceChip wiring is the only frontend work.** `SourceChip.tsx` props:
`sourceName`, `sourceUrl`, `fetchDate?`, `compact?`. Today it renders **only** for
`entity_type==='federal'` (App.tsx:945-985, inside a federal-only block that also
holds federal Lens/Scale toggles). The chip's `sourceUrl` ternary already has a
**non-federal branch** (`datasetUrl || url`, App.tsx:967-970) → municipal budgets
already carry `budgetData.metadata.dataSourceInfo`. The data layer maps it from the
API: `dataLoader.ts:131` `dataSourceInfo: budget.data_source_info || …`.

**Therefore D-03 = add a small county-scoped SourceChip render** (when
`entity_type==='county'` and `budgetData.metadata.dataSourceInfo` is present), using
`dataSourceInfo.displayName` / `(datasetUrl || url)` / `fetchedAt`. Do **not** widen
the federal block (it carries federal-only toggles). Add a separate minimal block so
no federal/city behavior regresses.

**One risk to verify, not assume:** `data_source_info` is built by the **external
EV-Accounts budget API** (`/api/treasury/cities/{id}/budgets`, `dataLoader.ts:51`),
not in this repo. Cities populate it (the city branch exists), so the OC county
*should* too once the loader writes `source_url`/`source_date`. Plan 57-02 makes
"API returns non-null `data_source_info` for the OC county budget" an explicit
acceptance check; if it comes back null, the fix is an EV-Accounts request
(`C:/EV-Accounts/ACCOUNTS-FEATURE-REQUEST.md` pattern) — flagged, not silently
shipped.

## 7. ACFR cross-check (D-02)

The OC published ACFR (all-governmental-funds, ~$8–9B) is an **independent
cross-check**, not the load source. After load, spot one fiscal year, compare the
loaded SCO total to the ACFR figure basis-to-basis, and record the figure + delta in
`57-VERIFICATION.md`. **If SCO and ACFR conflict, SCO is the loaded value** (ACFR
delta = documented variance, per the Phase 56 definitional finding). This is a
documented spot, not a full audit (deferred).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node ESM probe script (`verify-phase57.mjs`), mirroring `verify-phase34.mjs`/`56` — no test runner |
| Config file | None — script reads repo `.env`/`.env.local` (SUPABASE_URL + SUPABASE_SERVICE_KEY/SERVICE_ROLE_KEY), schema `treasury` |
| Quick run command | `node scripts/verify-phase57.mjs` |
| Full suite command | Same — single script covers all automatable assertions |
| Estimated runtime | ~5–15 seconds (DB round-trips) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Auto? |
|--------|----------|-----------|-------------------|-------|
| OCB-01 | OC county entity ("Orange County", entity_type=county) has `operating` budget rows | DB assertion | `node scripts/verify-phase57.mjs` (gap 57-02-01) | Yes |
| OCB-01 | OC county entity has `revenue` budget rows | DB assertion | `node scripts/verify-phase57.mjs` (gap 57-02-02) | Yes |
| OCB-01 | County budget rows carry durable `source_url` (`/d/uctr-c2j8` or `/d/emxv-k8xv`, never `/resource/*.json`) + `source_date` | DB assertion | `node scripts/verify-phase57.mjs` (gap 57-02-03) | Yes |
| OCB-01 | OC county entity has a non-zero population (per-capita denominator) | DB assertion | `node scripts/verify-phase57.mjs` (gap 57-02-04) | Yes |
| OCB-01 | A sampled county/year loaded total matches the SCO source figure within rounding | DB assertion | `node scripts/verify-phase57.mjs` (gap 57-02-05) | Yes |
| OCB-01 | The 34 city budget rows were NOT overwritten (county load touched only the county entity) | DB assertion | `node scripts/verify-phase57.mjs` (gap 57-02-06) | Yes |
| OCB-01 | ACFR cross-check: one FY basis-matched, delta recorded | Manual ACFR review | n/a — human reads OC ACFR, records in 57-VERIFICATION.md | Human |
| OCB-02 | OC county page renders icicle/summary + per-capita (no empty/error state) | Live-app UAT | n/a — Chris at https://treasurytracker.empowered.vote | Human |
| OCB-02 | SourceChip renders on the OC county page (source name + fetched date + link to durable SCO page) | Live-app UAT | n/a — Chris confirms chip + link target | Human |
| OCB-02 | API returns non-null `data_source_info` for the OC county budget | API assertion | curl `/api/treasury/cities/{ocId}/budgets` (or DB-derived) | Yes (57-02 task) |
| OCB-02 | CitiesInCountyPanel still lists all 34 OC cities (no regression) | Live-app UAT | n/a — Chris counts on OC county page | Human |
| OCB-02 | `verify-phase57.mjs` exits 0 | Probe gate | `node scripts/verify-phase57.mjs` | Yes |
| OCB-02 | Chris UAT sign-off | Explicit sign-off | n/a — recorded in 57-VERIFICATION.md | Human |

### Sampling Rate

- **After every task commit in 57-02:** run `node scripts/verify-phase57.mjs`
- **Phase gate:** `verify-phase57.mjs` exits 0 AND ACFR cross-check documented AND
  Chris UAT sign-off recorded in `57-VERIFICATION.md` before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `scripts/loadCountyBudget.js` — reusable county-budget loader; does not exist (built in Plan 57-01).
- [ ] `scripts/verify-phase57.mjs` — DB-probe harness; does not exist (built in Plan 57-02).
- [ ] `.planning/phases/57-…/57-VERIFICATION.md` — produced during 57-02.

Automated gap checks (57-02-01..06) are definable up front (DB state is known after
the load). Human gaps (ACFR spot-check + live-app UAT) are documented in
`57-VERIFICATION.md` during execution.

---

## Security Domain

- **Scripts use the Supabase service-role key** (`SUPABASE_SERVICE_KEY`/
  `SERVICE_ROLE_KEY`) from repo `.env` — never hardcode, never log the key, never
  commit `.env`. Same posture as every prior loader/verify script.
- **Data is public record** (CA State Controller open data) — no PII; ground-rule
  compliant (official public record only; never fabricate; always source).
- **Destructive-write risk** is the real threat surface: a mis-targeted or
  over-broad write could clobber the 34 cities' or the county's data. Mitigated by
  single-entity targeting + never-overwrite collision check + canary-before-backfill
  (see Plan 57-01 threat model). Block on **high**.
- **Frontend** change is read-only render of already-sourced data; no new input
  surface, no injection vector (URL comes from the trusted API `data_source_info`).
