---
phase: 36-selective-city-retrofit
verified: 2026-06-09T00:00:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 36: Selective City Retrofit — Verification Record

**Phase Goal:** Retrofit Portland OR and Dallas TX operating budgets to genuine 3-level trees using their confirmed audit verdicts. SF is recorded as audit_deferred.
**Verified:** 2026-06-09
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Enrichment Baselines (before reload)

| City | Municipality ID | Enrichment row count (before) |
|------|----------------|-------------------------------|
| Portland OR | 2abac6c2-78b0-466a-98d1-6cd38e19a411 | 140 |
| Dallas TX | 17ce5baf-277d-41c9-a3f6-2e44f9def106 | 0 |

*Note: STATE.md said Portland ~41 rows, but actual DB query returned 140. This is because enrichment was run at multiple depths across prior phases. The count of 140 is the true baseline.*

---

## Task 1: Portland + Dallas FY2026 3-Level Live Load

### Pre-Reload Depth Distribution (before reload)

| City | FY | Data Source ID | Depth Distribution (before) |
|------|-----|----------------|------------------------------|
| Portland OR | 2026 | 3d24b9cf-2a29-4b32-8aaf-79ea8976b193 | No budget rows (not yet loaded) |
| Dallas TX | 2026 | 443a5578-568c-4684-8d47-43ef5f10e773 | No budget rows (not yet loaded) |

*Note: Portland baseline from 36-01 audit was `{"0":34}` — those rows were loaded during research but have since been deleted. No pre-DELETE required before this live load.*

### Pre-DELETE Step (conditional per 36-01 directive)

Per 36-01-SUMMARY, the `treasury_sync_budget_tree` RPC **accumulates** — a pre-DELETE is required before reload. Since no existing FY2026 budget rows exist for Portland or Dallas operating data sources, the pre-DELETE step is satisfied (nothing to delete). `processPortland.js` internally performs:
```javascript
await supabase.schema('treasury').from('budgets')
  .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
```
This will be a no-op since there are no existing rows, confirming idempotency.

### FY2026-Only Scope Decision

Per plan requirement and research Pitfall 5: Portland was only loaded for FY2026 (the `--pdf` flag targeting only the fy2025-26-vol1.pdf). Older Portland FYs (2022-2025) are intentionally left flat. Reasons:
1. Portland reorganized service areas between fiscal years — FY2025-26 structure (8 service areas from charter reform) differs from prior years
2. Only retrofitting the latest year minimizes risk of mismatched service area structures in older PDFs
3. Dallas operating data source covers FY2025-2026 via the same Socrata dataset; reloading FY2026 only avoids touching the FY2025 existing records

### Live Load Results

#### Portland FY2026

**Command:** `node scripts/processPortland.js --pdf "docs/Portland/fy2025-26-vol1.pdf"`
(Limited to FY2026 via --pdf targeting fy2025-26-vol1.pdf only)

| Metric | Value |
|--------|-------|
| Service areas (depth-0) | 8 |
| Bureaus (depth-1) | 34 |
| Tree total | $8,482,617,933 |
| Expected (dry-run from 36-02) | $8,482,617,933 |
| Reconciles? | YES — exact match |
| Rows inserted (RPC) | 34 |

**Budget ID:** `a5445549-c48f-47fc-bf2e-2f485aad72f1`
**Data source ID:** `3d24b9cf-2a29-4b32-8aaf-79ea8976b193`

#### Dallas FY2026

**Command:** `node scripts/bulkLoadBudget.js --source "Dallas Operating" --fy 2026`

| Metric | Value |
|--------|-------|
| Departments (depth-0) | 62 (budget_categories) + 3 others = 65 top-level nodes |
| Services (depth-1) | 208 |
| ObjectGroups (depth-2) | 730 |
| Tree total | $4,284,452,698 |
| Expected (dry-run from 36-03) | $4,284,452,698 |
| Reconciles? | YES — exact match |
| Rows inserted (RPC) | 759 line items; 1,000 budget_categories total |

**Budget ID:** `2d37a684-df65-4afc-b58e-b260989acb7b`
**Data source ID:** `443a5578-568c-4684-8d47-43ef5f10e773`

### Post-Reload Depth Distribution

| City | FY | Depth Distribution (after) | Passes? |
|------|-----|----------------------------|---------|
| Portland OR | 2026 | `{"0":8,"1":34}` — 8 service areas, 34 bureaus; line items in budget_line_items (34) | YES — was `{"0":34}` flat, now `{"0":8,"1":34}` 3-level |
| Dallas TX | 2026 | `{"0":62,"1":208,"2":730}` — 62 depts, 208 services, 730 object groups | YES — all 3 depths confirmed |

**Portland tree structure note:** Portland's 3-level structure is: service_area (depth-0 budget_category) → bureau (depth-1 budget_category) → line item (budget_line_item). The RPC stores bureau-level line items in `budget_line_items`, not as depth-2 `budget_categories`. Portland has 34 `budget_line_items` (one per bureau). This is correct behavior — the tree has 3 levels (SA → Bureau → Line Item), and the icicle renders all 3 levels correctly.

**Dallas tree structure:** Department (depth-0) → Service (depth-1) → ObjectGroup (depth-2), with 759 line items under depth-2 nodes. Full 3-level budget_categories hierarchy confirmed.

### Enrichment Integrity Check (post-reload)

| City | Enrichment count (before) | Enrichment count (after reload) | Passes (count >= before)? |
|------|--------------------------|----------------------------------|---------------------------|
| Portland OR | 140 | 140 | YES — unchanged (no enrichment deleted by reload) |
| Dallas TX | 0 | 0 | YES — no prior enrichment existed |

*D-11 satisfied: no existing enrichment rows deleted by the live load operations.*

---

## Task 2: Enrichment of New Depth-0 Nodes

### Dry-Run Results (cost gate check)

#### Portland OR — depth-0 service areas

**Command:** `node scripts/enrichCategories.js --city "Portland" --state OR --year 2026 --depth 0 --dry-run`

| Metric | Value |
|--------|-------|
| New nodes to enrich (dry-run count) | 6 (5 operating service areas + 1 all_funds_requirements root) |
| Estimated cost | ~$0.003 (6 calls × $0.0005/call, Claude Haiku 4.5) |
| Under $5 gate? | YES |

**Nodes identified:** Total Requirements (all_funds_requirements), Public Works, Community & Economic Development, City Operations, Public Safety, City Council
*(City Administrator, Office of City Auditor, Office of Mayor already enriched from prior phases)*

#### Dallas TX — depth-0 departments

**Command:** `node scripts/enrichCategories.js --city "Dallas" --state TX --year 2026 --depth 0 --dry-run`

| Metric | Value |
|--------|-------|
| New nodes to enrich (dry-run count) | 97 (65 operating departments + 32 revenue categories, all depth-0/parent_id=null) |
| Estimated cost | ~$0.049 (97 calls × $0.0005/call, Claude Haiku 4.5) |
| Under $5 gate? | YES |

**Combined estimated cost:** ~$0.052 (Portland $0.003 + Dallas $0.049)

**Decision:** GO — combined estimate of $0.052 is well under the $5 gate (D-12). Live enrichment approved.

### Live Enrichment Results

**Commands run:**
- `node scripts/enrichCategories.js --city "Portland" --state OR --year 2026 --depth 0`
- `node scripts/enrichCategories.js --city "Dallas" --state TX --year 2026 --depth 0`

| City | Nodes enriched (live run) | Unique name_keys stored in DB | Enrichment count (after live) | Actual cost estimate |
|------|---------------------------|-------------------------------|-------------------------------|---------------------|
| Portland OR | 6 | 6 new rows | 146 | ~$0.003 |
| Dallas TX | 97 | 93 unique name_keys (4 operating/revenue duplicates merged via upsert) | 93 | ~$0.049 |

**Total actual cost estimate:** ~$0.052 (both dry-run + live run = ~$0.104 total across all 4 script executions — still under $5)

**Portland enrichment count verification:** 140 (before reload) → 146 (after enrichment) = +6 new rows. Baseline preserved.
**Dallas enrichment count verification:** 0 (before) → 93 (after enrichment) = +93 new rows.

**Enrichment count >= baseline check (D-11):**
- Portland: 146 >= 140 — PASS
- Dallas: 93 >= 0 — PASS

**name_key format:** `normalize(parent)|normalize(name)` for subcategories, `normalize(name)` for depth-0 — unchanged (D-11 / Pitfall 3 compliance verified). No source edits to enrichCategories.js normalize() logic.

**Task 2 status:** COMPLETE. Cost gate: $0.052 estimated (well under $5). All 6 Portland + 97 Dallas depth-0 nodes enriched. DB confirmed: Portland 146 rows, Dallas 93 rows (unique name_keys after upsert dedup).

**New depth-0 nodes have non-NULL descriptions:** CONFIRMED
- Portland sample: `name_key='public works'` → `plain_name='City Streets and Infrastructure'`, description present (high confidence)
- Dallas sample: `name_key='airport operations avi'` → `plain_name='Airport Operations'`, description present (high confidence)

### Enrichment Verification Queries

**Portland depth-0 enriched nodes (post-live):**
- `public works` → "City Streets and Infrastructure" [high]
- `community & economic development` → "Business & Community Growth" [medium]
- `city operations` → "Daily City Operations" [medium]
- `public safety` → "Police and Emergency Services" [medium]
- `city council` → "City Council Operations" [medium]
- `total requirements` → "Total City Budget" [high]

**Dallas depth-0 sample (top 5 by budget):**
- `water utilities dwu` → "Water System Operations" [high]
- `police department gf` → "Police Department Operations" [high]
- `debt service bms` → "Debt Payments" [high]
- `dallas fire rescue gf` → "Fire Rescue Services" [high]
- `airport operations avi` → "Airport Operations" [high]

---

## Task 3: Human Verification (checkpoint)

### Status: APPROVED

**Instructions for human verifier:** See how-to-verify in 36-04-PLAN.md Task 3.

| Check | Result |
|-------|--------|
| Portland 3-level icicle drill-down (service area → bureau → line items) | PASS |
| Portland bureau-level enrichment descriptions intact (D-10 preservation) | PASS |
| Dallas 3-level icicle drill-down (department → service → object group) | PASS |
| Regression check: 3 non-retrofitted entities render correctly | PASS |
| Portland and Dallas totals/per-capita correct | PASS |

**Human verdict:** APPROVED — all 5 spot-check steps passed 2026-06-09

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Audit framework exists in .planning/AUDIT-FRAMEWORK.md and covers all 3 pilot cities | VERIFIED | File exists, 195 lines, contains all 6 required sections including Socrata, pdfplumber, Genuineness, retrofit_recommended, audit_deferred |
| 2 | Each of the 3 pilot cities has a recorded audit_verdict in treasury.data_sources | VERIFIED | 36-01-SUMMARY confirms all 3 non-NULL verdicts: Portland/Dallas=retrofit_recommended, SF=audit_deferred |
| 3 | Portland FY2026 operating loads as a 3-level tree (service_area depth-0, bureau depth-1, items) | VERIFIED | Live load produced depth distribution `{"0":8,"1":34}` + 34 budget_line_items; total $8,482,617,933 reconciles to dry-run |
| 4 | Dallas FY2026 operating loads as a 3-level tree (department depth-0, service depth-1, objectgroup depth-2) | VERIFIED | Live load produced depth distribution `{"0":62,"1":208,"2":730}`; total $4,284,452,698 reconciles to dry-run |
| 5 | extractPortland.py populates service_area from PDF mapping table located by keyword search | VERIFIED | `extract_service_area_map` function present; uses 'Managing Agency'+'Service Area' keyword guards; 34/34 bureaus mapped to 8 service areas |
| 6 | processPortland.js buildOperatingTree emits 3-level tree; WR-04 hardcoded SUPABASE_URL fallback removed | VERIFIED | buildOperatingTree present; no `process.env.SUPABASE_URL \|\| 'https` pattern found |
| 7 | bulkLoadBudget.js department_column gate enables 3-level tree; WR-04 fix applied; backward-compatible for 2-level sources | VERIFIED | department_column present; no hardcoded SUPABASE_URL fallback; Dallas Revenue backward-compat dry-run confirmed identical output |
| 8 | Existing enrichment rows for Portland and Dallas remain intact after reload (D-11) | VERIFIED | Portland: 140 → 140 after reload, 146 after enrichment. Dallas: 0 → 0 after reload, 93 after enrichment. Count never decreased. |
| 9 | New depth-0 nodes enriched within the $5 cost gate (D-12) | VERIFIED | Combined estimate $0.052; dry-run run first; both cities' depth-0 nodes have non-NULL descriptions |
| 10 | Both retrofitted cities show 3-level icicle drill-down in live app; no regression on non-retrofitted cities (RETROFIT-03) | VERIFIED | Human checkpoint approved 2026-06-09; all 5 spot-checks passed including Portland drill-down, Dallas drill-down, and 3-city regression check |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/AUDIT-FRAMEWORK.md` | Reusable audit guide ≥60 lines | VERIFIED | 195 lines, all 6 sections, contains all required keywords |
| `supabase/migrations/20260609120000_add_audit_verdict_to_data_sources.sql` | audit_verdict JSONB column | VERIFIED | Contains `audit_verdict JSONB` and `IF NOT EXISTS`; applied to DB |
| `scripts/extractPortland.py` | Service area extraction | VERIFIED | `extract_service_area_map` function; keyword-based table location; service_area field populated per row |
| `scripts/processPortland.js` | 3-level tree builder + WR-04 | VERIFIED | `buildOperatingTree` present; no hardcoded SUPABASE_URL fallback |
| `scripts/bulkLoadBudget.js` | department_column gate + WR-04 | VERIFIED | `department_column` gated 3-level path; WR-04 fix applied |
| `scripts/buildBudgetTree.mjs` | Pure tree-builder module | VERIFIED | 155 lines; exports `buildBudgetTree` with `department_column` support; 16 unit tests all pass |
| `.planning/phases/36-selective-city-retrofit/36-VERIFICATION.md` | Phase verification record | VERIFIED | Contains Portland, Dallas, depth, enrichment, RETROFIT-03, APPROVED |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `treasury.data_sources` | `audit_verdict JSONB` | ALTER TABLE ADD COLUMN IF NOT EXISTS | VERIFIED | Migration applied; 36-01-SUMMARY confirms column accessible |
| `extractPortland.py extract_service_area_map` | `row['service_area']` | `service_area_map.get(bureau_name, '')` | VERIFIED | Pattern `service_area_map` present in extractPortland.py |
| `processPortland.js buildOperatingTree` | treasury_sync_budget_tree node shape | service_area nodes with c[] bureau children | VERIFIED | 8-SA / 34-bureau live tree loaded successfully |
| `data_sources.column_mapping.department_column='appropriation'` | `buildBudgetTree 3-level path` | `cm.department_column` gate | VERIFIED | Dallas Operating column_mapping confirmed with all 7 keys including `department_column: 'appropriation'` |
| `processPortland.js / bulkLoadBudget.js live load` | treasury.budget_categories depth 0/1/2 | treasury_sync_budget_tree RPC | VERIFIED | Portland `{"0":8,"1":34}`, Dallas `{"0":62,"1":208,"2":730}` confirmed post-load |
| `enrichCategories.js --depth 0` | new depth-0 service-area / department nodes | name_key upsert (existing format unchanged) | VERIFIED | Portland +6, Dallas +93 new enrichment rows; format unchanged |

### Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| RETROFIT-01 | 36-01 | Source data audit completed — genuine extractable 3rd level identified | SATISFIED | AUDIT-FRAMEWORK.md created; 3 DB verdicts written; Portland + Dallas = retrofit_recommended, SF = audit_deferred |
| RETROFIT-02 | 36-02, 36-03, 36-04 | 1–2 cities with confirmed genuine 3rd-level data retrofitted and reloaded | SATISFIED | Portland FY2026 depth `{"0":8,"1":34}` + Dallas FY2026 depth `{"0":62,"1":208,"2":730}` live in DB |
| RETROFIT-03 | 36-04 Task 3 | Retrofitted cities display 3-level icicle; existing enrichment intact | SATISFIED | Human verified 2026-06-09: all 5 spot-checks passed (Portland drill, Dallas drill, enrichment intact, regression, totals) |

### Anti-Patterns Found

No blockers. WR-04 (hardcoded SUPABASE_URL fallback) was identified in 36-02 plan and mitigated in both `processPortland.js` and `bulkLoadBudget.js`. No TBD/FIXME/XXX markers in modified files.

### Human Verification Required

None — human checkpoint (Task 3 of 36-04) was completed and approved on 2026-06-09.

---

## Phase 36 Requirements Status

| Requirement | Status |
|------------|--------|
| RETROFIT-01: Audit framework + DB verdicts (Portland, Dallas, SF) | COMPLETE (36-01) |
| RETROFIT-02: Portland + Dallas reloaded as live 3-level trees | COMPLETE (36-04 Tasks 1-2, human-verified 2026-06-09) |
| RETROFIT-03: 3-level icicle confirmed in app, existing enrichment intact, no regression | COMPLETE (human verified 2026-06-09 — all 5 checks passed) |

---

_Verified: 2026-06-09_
_Verifier: Claude (gsd-verifier)_
