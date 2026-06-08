# Phase 35: CA State 3-Level Icicle Pilot — Verification

**Date:** 2026-06-08
**Plan:** 35-03

## Summary

| Requirement | Result | Evidence |
|-------------|--------|----------|
| ICICLE-01 | PASS | DB shows depth-0/1/2 rows for all 5 CA FYs; FY2026 total unchanged at $228,365,858,000 |
| ICICLE-02 | PENDING human verification | Human spot-check required |
| ICICLE-03 | PENDING human verification | Human spot-check required |

---

## ICICLE-01 — DB Depth Verification

**Script run:** `node scripts/processCA.js --fy 2022 --fy 2023 --fy 2024 --fy 2025 --fy 2026`
**Exit code:** 0 (no env error, no sanity error)

### Per-FY rows_inserted (reported by RPC)

| FY | rows_inserted | Total Budget | In $150B-$300B Band |
|----|---------------|--------------|----------------------|
| 2022 | 252 | $216,784,797,000 | YES |
| 2023 | 256 | $195,189,253,000 | YES |
| 2024 | 253 | $205,670,467,000 | YES |
| 2025 | 253 | $233,577,316,000 | YES |
| 2026 | 219 | $228,365,858,000 | YES |

### DB Depth Distribution (post-reload)

| FY | depth-0 (DOF Agency) | depth-1 (Department) | depth-2 (Function) | Total categories |
|----|---------------------|---------------------|-------------------|-----------------|
| 2022 | 12 | 166 | 252 | 430 |
| 2023 | 12 | 171 | 256 | 439 |
| 2024 | 12 | 169 | 253 | 434 |
| 2025 | 12 | 169 | 253 | 434 |
| 2026 | 12 | 157 | 219 | 388 |

**ICICLE-01 PASS:** All 5 FYs have depth-2 rows in `treasury.budget_categories`. FY2026 budget total $228,365,858,000 = pre-reload total (diff $0). Sanity band $150B-$300B: all FYs pass.

---

## Enrichment (D-08/D-09)

**Decision:** Approved (cost gate cleared — dry-run estimated $0.0438 for 219 FY2026 nodes; gate approved by user)

### Step 1 — Survival baseline (before enrichment)

| Query | Count | Expected |
|-------|-------|----------|
| `name_key NOT LIKE '%|%'` (depth-0) | 12 | 12 |
| `name_key LIKE '%|%'` (depth-2) | 0 | 0 (before run) |

**Survival baseline: PASS** — 12 depth-0 CA enrichments present before enrichment run.

### Step 2 — Live enrichment runs

Commands run (all with `--depth 2`, read-only enrichCategories.js):

| FY | Command | AI-enriched | Failed | Exit code |
|----|---------|-------------|--------|-----------|
| 2026 | `node scripts/enrichCategories.js --city "California" --state CA --year 2026 --depth 2` | 219 | 0 | 0 |
| 2022 | `node scripts/enrichCategories.js --city "California" --state CA --year 2022 --depth 2` | 48 | 0 | 0 |
| 2023 | `node scripts/enrichCategories.js --city "California" --state CA --year 2023 --depth 2` | 19 | 0 | 0 |
| 2024 | `node scripts/enrichCategories.js --city "California" --state CA --year 2024 --depth 2` | 5 | 0 | 0 |
| 2025 | `node scripts/enrichCategories.js --city "California" --state CA --year 2025 --depth 2` | 1 | 0 | 0 |
| **Total** | | **292** | **0** | |

Note: FY2022-2025 enriched fewer nodes because they share many function name_keys with FY2026; the script skips already-covered name_keys.

### Step 3 — Post-enrichment verification

| Query | Count | Expected |
|-------|-------|----------|
| `name_key NOT LIKE '%|%'` (depth-0, survival) | 12 | 12 |
| `name_key LIKE '%|%'` (depth-2, new) | 292 | >0 |

**Sample depth-2 enrichments (pipe-delimited name_keys):**
- `agricultural labor relations board|state operations` → "Agricultural Labor Relations Board Operations" [medium]
- `arts council|local assistance` → "Arts Council Local Support" [medium]
- `arts council|state operations` → "Arts Council Operations" [medium]
- `augmentation for contingencies or emergencies|state operations` → "Emergency Reserve Fund" [medium]
- `augmentation for employee compensation|state operations` → "State Employee Pay Raises" [medium]

**Actual cost:** 292 AI calls × ~$0.0002/call (Claude Haiku) = **~$0.0584** (well under $5 gate)

**D-08 survival: PASS** — Depth-0 count 12/12 before AND after enrichment (name-key binding preserved through reload)
**D-09 enrichment: PASS** — 292 depth-2 rows created with state-level framing; 0 failures
**D-11 depth flag: PASS** — enrichCategories.js used unmodified with `--depth 2` flag; git diff shows no changes to the file

---

## ICICLE-02 / ICICLE-03 — Live App Spot-Check

*(To be filled in after human visual verification checkpoint)*
