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

## Outstanding

- **Task 3 (human-verify, blocking):** Chris confirms in the live app (treasurytracker.empowered.vote) that the EV Money In totals are refreshed by source and the live donation counter still works. Production reads via the ev-accounts API (allow for cache/deploy).

## Notes

- Benevity nearly tripled vs the stale sheet — the disbursement-date (cash) basis captures all 61 rows received Jan–Apr 2026, including 14 Dec-2025 gifts paid out to EV in early 2026.
- Prior-year EV revenue (FY2024/2025) untouched (current-FY-only scope, D-06).
