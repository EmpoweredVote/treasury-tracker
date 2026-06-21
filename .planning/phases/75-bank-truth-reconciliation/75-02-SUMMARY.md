---
phase: 75-bank-truth-reconciliation
plan: 02
status: complete
requirements: [EVDATA-04, EVDATA-05]
key_files:
  created:
    - scripts/lib/evBankDeposits.js
    - scripts/reconcileEV.js
    - scripts/reconcileEV.test.mjs
  modified:
    - docs/ev-donation-sources.md
---

# 75-02 Summary — reconcileEV (balance / runway / fees / reconciliation)

## What was built

- **`scripts/lib/evBankDeposits.js`** — shared pure helpers: `classifyDeposit(desc)` (D-04 descriptor → platform/interest/unmatched) and `extractDeposits(rows, fy)`. Reused by 75-03 for the interest re-home.
- **`scripts/reconcileEV.js`** — computes and upserts the FY summary into `treasury.org_financial_summary`:
  - **Balance/runway (D-01/02/03):** `monthlyBurn` = avg of the last **3 complete calendar months** strictly before the as-of month (in-progress month excluded); `runway` = balance/burn (1 dp), `null` when burn≈0.
  - **Income gross→net (D-11):** `buildIncome` → per-source `{gross,fee,net}` from the platform parsers; fees are a reduction of income, never an expense.
  - **Reconciliation (D-05/07):** `reconcile` matches bank payout deposits per source vs. platform net, stores `recon_by_source` + total `recon_variance` + a direction-neutral `recon_explanation` (names the largest single-source gap). Bank payout deposits are matched-and-excluded — never re-added as income. Unmatched non-platform/non-interest deposits → `unmatched_deposits` (flagged). Interest reported but not written here (75-03 re-homes it).
  - Idempotent upsert onConflict `(municipality_id, fiscal_year)`; `--dry-run` prints, no write.
- **`scripts/reconcileEV.test.mjs`** — 6 offline tests (classify, extractDeposits, the complete-month burn window, the zero-burn→null guard, income net, reconcile variance/interest/unmatched). All pass.
- **`docs/ev-donation-sources.md`** — added the "Bank reconciliation (Phase 75)" section (descriptors, variance, burn/runway, fees-as-income, unmatched→manual, interest re-home, Phase-76 API note).

## Live FY2026 result (verified)

| Field | Value |
|-------|-------|
| balance / as-of | $1,706.77 / 2026-06-17 |
| trailing-3-mo burn → runway | $344.27/mo → 5 months |
| income gross / fees / net | $2,548.00 / $125.32 / $2,422.68 |
| recon variance | −$132.39 |

Per-source recon: Patreon Δ +$1.50, Benevity Δ $0.00, **GiveButter Δ −$133.89**.

## Decisions / findings

- **GiveButter variance −$133.89 is real and explained:** the bank GiveButter payout ($810.00) exceeds the current GiveButter export's FY2026 gross ($703) — the export was a partial snapshot relative to the bank. Recorded as an honest "explained tolerance" per Chris's call (upsert now; refresh GiveButter + re-run later if desired — idempotent). Feeds EVVER-01.
- `recon_explanation` made direction-neutral (the variance is bank>platform-net here, not the assumed platform>bank) and now names the largest single-source gap.

## Verification

- `node --check` clean for lib + loader; `node --test scripts/reconcileEV.test.mjs` → 6/6 pass.
- `--dry-run` reproduced the real FY2026 figures.
- Live upsert: one FY2026 `org_financial_summary` row (verified via execute_sql); a second run kept it at exactly one row (idempotent).

## Hand-off

- 75-03 imports `classifyDeposit`/`extractDeposits` to re-home bank interest, and adds the manual.csv income path.
- Phase 76 reads this row via the ev-accounts API (separate repo).

## Self-Check: PASSED
