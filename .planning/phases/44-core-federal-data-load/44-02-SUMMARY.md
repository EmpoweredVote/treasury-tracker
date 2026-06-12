# 44-02 Summary — OMB Annual Summary Load

**Executed:** 2026-06-12 | **Status:** Complete

## Shipped

- `scripts/extractOMBHistorical.py` — header-text-driven column mapping; units READ from each file's "(in millions/billions of dollars)" line; 4-digit-year row filter (excludes range rows, TQ, "2026 estimate" rows); per-year validations: receipts−outlays=deficit, BEA components sum to total within 0.5%, 1.1↔8.1 cross-check within 0.1%. All 64 years pass.
- `scripts/loadFederalAnnualSummary.js` — scrapes the landing page for current-edition xlsx URLs (whitehouse.gov-only accepted, T-44-04), downloads with browser UA, runs extractor, anchors checked (FY2025 exact: 5,236,421M / 7,011,105M / −1,774,684M; FY2024 outlays 6,735,261M), upserts 64 rows by fiscal_year. Re-run → still 64 rows (idempotent).
- `supabase/migrations/20260612110200_grant_federal_tables.sql` — **unplanned fix**: all three federal tables (incl. 43's program_details) were created without the service_role GRANT every other treasury table carries; loaders hit "permission denied". Granted to match treasury.municipalities.

## Layout discoveries (vs plan assumptions)

1. **8.1 is in BILLIONS, 1.1 in millions** — plan assumed millions for both; extractor reads units per file.
2. 8.1's 'Mandatory' subtotal column (incl. undistributed offsetting receipts) + defense + nondefense + net interest sums EXACTLY to total outlays — used as the per-year identity check.
3. Net Interest FY2025: **$970.1B** (was ~residual estimate in recon; now exact from the 'Net Interest' column).
4. hist01z1 contains no estimate rows; hist08z1 does ("2026 estimate" …) — the 4-digit filter handles both.

## Evidence

- `SELECT count(*), min(fiscal_year), max(fiscal_year)` → 64, 1962, 2025
- FY2025 row matches anchors exactly; every row carries source_name/source_url/source_date
- Zero treasury.budgets rows — US entity still invisible ✓ (checkpoint not yet passed)

## Deviations from plan

GRANT migration added (above). Units handling generalized. Both recorded for the 44-VERIFICATION sweep.
