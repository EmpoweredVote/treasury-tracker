# 07-03 Load Log: Allen / Prosper / Celina ACFR FY2025

**Date:** 2026-05-01
**Plan:** 07-03 (PDF/Haiku Vision Pipeline — Seed + Load)
**Status:** ANTHROPIC_API_KEY unavailable — dry-runs and live loads pending

---

## Data Sources Seeded

| City   | data_source id                         | api_type     | dataset_type | dataset_id | base_url (truncated)                            |
|--------|----------------------------------------|--------------|--------------|------------|-------------------------------------------------|
| Allen  | b9eabf4a-e60f-4428-8ae7-e93ec68b7b76  | pdf_download | operating    | fy2025     | https://www.cityofallen.org/Documents/...       |
| Prosper| f6199a32-bab2-431c-a049-5e4959559fff  | pdf_download | operating    | fy2025     | https://www.prospertx.gov/ArchiveCenter/...     |
| Celina | 0ef50fe5-ca3a-4b19-ab1d-c35661a41017  | pdf_download | operating    | fy2025     | https://www.celina-tx.gov/DocumentCenter/...    |

Seeder is idempotent — re-run on 2026-05-01 showed "updated existing row" for all three.

---

## ANTHROPIC_API_KEY Status

**Status:** NOT SET

ANTHROPIC_API_KEY was not found in:
- Process environment (node -e check)
- Windows registry (HKCU\Environment, HKLM system)
- Project .env files (.env, .env.local, .env.development)
- User home ~/.env

**Impact:** All Haiku-dependent operations (--dry-run and live load) are blocked until the key is provided.

---

## Dry-Run Results

### Allen ACFR FY2025

**Status:** BLOCKED — ANTHROPIC_API_KEY not set
**Command:** `node scripts/bulkLoadPDF.js --source "Allen ACFR FY2025" --fiscal-year 2025 --dry-run`
**Result:** Not executed

### Prosper ACFR FY2025

**Status:** BLOCKED — ANTHROPIC_API_KEY not set
**Command:** `node scripts/bulkLoadPDF.js --source "Prosper ACFR FY2025" --fiscal-year 2025 --dry-run`
**Result:** Not executed

### Celina ACFR FY2025

**Status:** BLOCKED — ANTHROPIC_API_KEY not set
**Command:** `node scripts/bulkLoadPDF.js --source "Celina ACFR FY2025" --fiscal-year 2025 --dry-run`
**Note:** Celina render cache exists at cache/pdf-render/caa2528.../ (133 pages) — rendering will be skipped, only Haiku extraction needed
**Result:** Not executed

---

## Live Load Results

### Allen ACFR FY2025

**Status:** BLOCKED — dry-run must pass first; ANTHROPIC_API_KEY not set
**Rows loaded:** —
**Total $:** —

### Prosper ACFR FY2025

**Status:** BLOCKED — dry-run must pass first; ANTHROPIC_API_KEY not set
**Rows loaded:** —
**Total $:** —

### Celina ACFR FY2025

**Status:** BLOCKED — dry-run must pass first; ANTHROPIC_API_KEY not set
**Rows loaded:** —
**Total $:** —

---

## DB Verification

Not yet run — pending live loads.

```sql
SELECT m.name, b.fiscal_year, b.total_budget,
  (SELECT COUNT(*) FROM treasury.budget_categories WHERE budget_id = b.id) AS category_count
FROM treasury.budgets b
JOIN treasury.municipalities m ON m.id = b.municipality_id
WHERE m.name IN ('Allen', 'Prosper', 'Celina') AND b.fiscal_year = 2025;
```

---

## Flagged Pages

Not yet run — pending live loads.

---

## Resume Instructions

Once ANTHROPIC_API_KEY is available, run:

```bash
# Dry-runs first
node scripts/bulkLoadPDF.js --source "Allen ACFR FY2025" --fiscal-year 2025 --dry-run
node scripts/bulkLoadPDF.js --source "Prosper ACFR FY2025" --fiscal-year 2025 --dry-run
node scripts/bulkLoadPDF.js --source "Celina ACFR FY2025" --fiscal-year 2025 --dry-run

# If dry-runs look reasonable, live load each:
node scripts/bulkLoadPDF.js --source "Allen ACFR FY2025" --fiscal-year 2025
node scripts/bulkLoadPDF.js --source "Prosper ACFR FY2025" --fiscal-year 2025
node scripts/bulkLoadPDF.js --source "Celina ACFR FY2025" --fiscal-year 2025
```

If any dry-run produces 0 budget tables on a clearly table-heavy ACFR, retry with `--confidence-threshold 60`.

Update this log with per-city results after each run.
