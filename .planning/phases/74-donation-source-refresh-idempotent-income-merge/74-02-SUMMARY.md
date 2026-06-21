# 74-02 Summary — Live Load + Verification

**Status:** Code/data complete; awaiting Chris live-app sign-off (Task 3)
**Requirements:** EVDATA-01, EVDATA-02, EVDATA-03 (live realization)

## Live load result (FY2026, production Supabase)

| Source | Was (stale sheet) | Now (fresh export) |
|--------|------|------|
| Give Butter | $531.00 | **$703.00** (19 txns, fee $26.89) |
| Patreon | $220.00 | **$370.00** (6 months, fee $60.82) |
| Benevity | $505.00 | **$1,475.00** (61 disbursed rows, fee $37.61) |
| Interest (carry-fwd) | $0.51 | $0.51 |
| **Revenue total** | **$1,256.51** | **$2,548.51** |

Platform fees captured (gross→net story, D-09): **$125.32** total.

## Verifications

- **No double-count (D-04):** `exportAsOf` = 2026-06-20 superseded all 6 pre-existing `givebutter_webhook` rows; 0 live delta. Give Butter = $703 export gross with nothing added on top. DB shows 0 webhook rows remaining in the FY2026 revenue dataset.
- **Idempotent:** ran the loader twice → identical state (total $2,548.51, 6 categories, 4 line items). No accumulation, no duplicate rows.
- **No donor PII:** each source leaf holds exactly one aggregate line item; no name/email stored. `data/ev-sources/` gitignored.
- **Webhook compatibility:** the `Donations` → `Give Butter` category exists in the FY2026 revenue budget, so the live `givebutter-webhook` lookup still resolves; future donations (after exportAsOf) accrue as the live delta.

## Cross-year double-count fix (Benevity, found during UAT)

Chris flagged a possible prior-year overlap. Confirmed: FY2025 (loaded by the OLD sheet on a **donation-date** basis) booked 14 Dec-2025 Benevity gifts ($207.50) that the new loader also booked into FY2026 by **disbursement date** (received Jan 2026). Same money, two years.

Fix (Chris-approved, cash-basis-consistent): removed those 14 Dec-2025 rows from FY2025 (they were *received* in 2026 → belong in FY2026). Done atomically via a DO block (delete rows + decrement Benevity / Donations / budget totals).

| | Before | After |
|---|---|---|
| FY2025 Benevity | $522.50 | **$315.00** |
| FY2025 revenue total | $2,547.51 | **$2,340.01** |
| FY2026 Benevity | $1,475 | $1,475 (unchanged) |

Verified: 0 `2025-12` Benevity rows remain in FY2025; the $207.50 lives in FY2026 only.

**Seam to remember:** Benevity disburses on a lag, so a gift's donation-date and disbursement-date can fall in different fiscal years. Prior-year EV data loaded on the old donation-date basis can overlap with the new disbursement (cash) basis. The loader only dedups *within* a FY (webhook); cross-year basis-mix overlaps must be caught by year-boundary review (as here). A future prior-year re-pull on disbursement basis would self-correct this.

## Outstanding

- **Task 3 (human-verify, blocking):** Chris confirms in the live app (treasurytracker.empowered.vote) that the EV Money In totals are refreshed by source and the live donation counter still works. Production reads via the ev-accounts API (allow for cache/deploy).

## Notes

- Benevity nearly tripled vs the stale sheet — the disbursement-date (cash) basis captures all 61 rows received Jan–Apr 2026, including 14 Dec-2025 gifts paid out to EV in early 2026.
- Prior-year EV revenue (FY2024/2025) untouched (current-FY-only scope, D-06).
