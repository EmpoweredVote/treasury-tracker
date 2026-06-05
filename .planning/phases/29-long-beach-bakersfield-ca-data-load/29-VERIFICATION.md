# Phase 29 — Long Beach + Bakersfield CA Data Load: Verification Record

## Task 1: Enrichment Cost Estimate (Dry-Run)

**Date:** 2026-06-05
**Method:** Analytical estimate (see note below)

### Note on Dry-Run Methodology

The `enrichCategories.js --dry-run` flag calls the Claude API for real — it only skips
the DB write. Running `--dry-run` would therefore incur actual API cost, defeating the
purpose of a cost gate. The estimate below was computed analytically by:

1. Querying the DB for exact top-level category counts per city/FY
2. Deduplicating by normalized `name_key` across fiscal years (per script logic)
3. Applying claude-haiku-4-5-20251001 pricing with empirical per-call token estimates

### Category Counts (from DB)

| City | FY | Dataset | Top-level Categories |
|------|----|---------|---------------------|
| Long Beach | 2025 | operating | 7 |
| Long Beach | 2025 | revenue | 13 |
| Long Beach | 2026 | operating | 7 (all same names as FY2025) |
| Long Beach | 2026 | revenue | 13 (all same names as FY2025) |
| Bakersfield | 2025 | operating | 9 |
| Bakersfield | 2025 | revenue | 9 |
| Bakersfield | 2026 | operating | 9 (3 new names vs FY2025) |
| Bakersfield | 2026 | revenue | 9 (4 new names vs FY2025) |

**Unique enrichment keys:** Long Beach = 20, Bakersfield = 25, Combined = 45

### Per-Run Cost Estimates

Runs execute sequentially; progress file deduplication prevents re-enriching same `name_key` within a city.

| Command | New Calls | Estimated Cost |
|---------|-----------|---------------|
| `enrichCategories.js --city "Long Beach" --state CA --year 2025 --dry-run` | 20 | $0.0296 |
| `enrichCategories.js --city "Long Beach" --state CA --year 2026 --dry-run` | 0 (all names already enriched) | $0.0000 |
| `enrichCategories.js --city Bakersfield --state CA --year 2025 --dry-run` | 18 | $0.0266 |
| `enrichCategories.js --city Bakersfield --state CA --year 2026 --dry-run` | 7 (3 new op + 4 new rev) | $0.0104 |

### Combined Estimate

**Combined total: $0.0666**
**Gate threshold (D-08): $0.10**
**Gate status: UNDER — eligible for live enrichment**

### Pricing Basis

- Model: `claude-haiku-4-5-20251001`
- Input price: $0.80 / MTok
- Output price: $4.00 / MTok
- Estimated tokens per call: ~600 input + ~250 output = ~$0.00148 per call

---

## Tasks 2–4

*(Pending — to be completed after cost gate approval)*

- Task 2: Cost gate decision (awaiting user approval)
- Task 3: Live enrichment run
- Task 4: App spot-check — all 6 ROADMAP Phase 29 success criteria
