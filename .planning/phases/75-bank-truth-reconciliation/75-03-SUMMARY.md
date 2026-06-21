---
phase: 75-bank-truth-reconciliation
plan: 03
status: complete
requirements: [EVDATA-06]
key_files:
  modified:
    - scripts/loadEVDonations.js
    - scripts/loadEVDonations.test.mjs
    - scripts/loadEVFinances.js
    - docs/ev-donation-sources.md
  created:
    - data/ev-sources/manual.csv (gitignored — header-only template)
---

# 75-03 Summary — manual income, bank-interest re-home, ledger retirement

## What was built

- **`scripts/loadEVDonations.js`**:
  - `carryForwardManual(dir, fy)` — reads `data/ev-sources/manual.csv` (`date,source,amount,note`), FY-filters, returns Donations rows tagged `manual`. Absent file → `[]`.
  - `carryForwardInterest(dir, fy)` — reads the bank export, sums `Credit Interest` deposits (via shared `classifyDeposit`/`extractDeposits` from 75-02), returns `Interest → Bank Interest` tagged `bank`.
  - `buildDonationTree` now threads a per-row `source` tag onto line items (`manual` | `bank` | `csv`) and **merges** a carry-forward `Donations` parent into the existing one (fixes a latent duplicate-parent bug). `insertCategories` writes `source: li.source || 'csv'`.
  - `main()` now builds carry-forward from `carryForwardManual` + `carryForwardInterest` — **no longer reads `ev-finances.csv`**. `carryForwardFromSheet` kept as a deprecated, uncalled export.
- **`scripts/loadEVFinances.js`** — RETIRED (D-09): operating write removed (income was already removed in P74). `main()` is a no-op that prints a retirement notice and exits 0; runs without a service key (lazy client). Helpers kept import-safe.
- **`scripts/loadEVDonations.test.mjs`** — +3 tests (source threading + Donations merge; `carryForwardManual` parse/FY-filter/tag; `carryForwardInterest` sums interest, ignores payouts, tags bank). 13/13 pass.
- **`docs/ev-donation-sources.md`** (local/gitignored) — manual.csv schema, in-kind deferral (D-10), and the ev-finances.csv retirement.

## Live FY2026 result (verified)

- Revenue reloaded: **$2,549.17** (interest re-homed bank `$1.17`, was sheet `$0.51`; total was $2,548.51). `Interest → Bank Interest` now `source='bank'`; revenue has 2 distinct sources (`csv` + `bank`).
- Operating untouched at **$1,745.65** (bank-sourced) — confirms `loadEVFinances` no longer overwrites it.
- 0 `givebutter_webhook` rows currently in FY2026 → none to preserve (dedup path exercised, delta $0).
- Idempotent: a second reload kept revenue at $2,549.17 with a single revenue budget.

## Decisions / notes

- `ev-finances.csv` had no FY2026 non-platform income except interest, and the bank carries more-complete interest (Apr/May too) → re-home is a strict improvement, no Direct income lost.
- `manual.csv` is empty for FY2026 (no off-platform cash income yet).
- In-kind (Framer etc.) deferred (D-10) — documented as the near-term follow-up.
- `docs/ev-donation-sources.md` is gitignored project-wide (`docs/*`); kept current locally, not committed (same as Phase 74).

## Verification

- `node --check` clean for both scripts; `node --test scripts/loadEVDonations.test.mjs` → 13/13.
- `loadEVFinances.js` runs, prints retirement notice, exits 0, writes nothing; 0 `'operating'` createBudget call sites.
- Live reload + re-run verified via execute_sql (sources, operating untouched, idempotent).

## Self-Check: PASSED
