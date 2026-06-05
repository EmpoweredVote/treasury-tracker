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

---

## Task 3: Live Enrichment Results

**Date:** 2026-06-05
**Gate status at run time:** Combined estimate $0.0666 < $0.10 — approved by user

### Per-Run Results

| Command | Categories Enriched | Notes |
|---------|---------------------|-------|
| `enrichCategories.js --city "Long Beach" --state CA --year 2025` | 20 | 6 operating + 13 revenue + 1 other; all new |
| `enrichCategories.js --city "Long Beach" --state CA --year 2026` | 0 | All names identical to FY2025 — already covered by upsert |
| `enrichCategories.js --city Bakersfield --state CA --year 2025` | 17 | 9 operating + 8 revenue; all new |
| `enrichCategories.js --city Bakersfield --state CA --year 2026` | 7 | 3 operating + 4 revenue (new name variants vs FY2025) |

**Total enrichment calls made:** 44
**Total failures:** 0
**All runs exited 0:** Yes

### Idempotency Re-Check

Re-ran `--dry-run` for Long Beach FY2025 after live enrichment:

```
[Long Beach] Nothing new to enrich
Categories enriched: 0
```

**Result: PASS** — near-zero remaining cost confirmed; DB write deduplication working correctly.

### Enrichment Coverage Summary

| City | FYs Covered | Operating Categories Enriched | Revenue Categories Enriched |
|------|-------------|-------------------------------|------------------------------|
| Long Beach | 2025, 2026 | 6 | 14 |
| Bakersfield | 2025, 2026 | 12 | 13 |

---

## Task 4: App Spot-Check — 6 Phase 29 Success Criteria

*(Pending — awaiting human verification)*
