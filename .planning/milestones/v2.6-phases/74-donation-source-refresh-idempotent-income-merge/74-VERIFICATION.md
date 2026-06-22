---
phase: 74-donation-source-refresh-idempotent-income-merge
status: passed
verified: 2026-06-20
requirements: [EVDATA-01, EVDATA-02, EVDATA-03]
---

# Phase 74 Verification — Donation Source Refresh (Idempotent Income Merge)

**Verdict: PASSED** — goal achieved, all success criteria met, Chris signed off in the live app.

## Phase goal
EV's donation totals reflect the latest data from GiveButter, Patreon, and Benevity, with every income row deduplicated — re-running any loader never double-counts against the live webhook rows.

## Success criteria

1. **GiveButter export loads + dedups vs webhook** — ✓ Loaded $703 gross (19 txns). `exportAsOf` 2026-06-20 superseded all 6 pre-existing `givebutter_webhook` rows; 0 delta; DB shows 0 webhook rows double-counting. Give Butter = export gross, nothing stacked.
2. **Patreon loads, idempotent** — ✓ $370 from the monthly earnings file; second run identical.
3. **Benevity loads, idempotent** — ✓ $1,475 (61 disbursed rows, cash basis); second run identical.
4. **Money In reflects combined dedup total** — ✓ FY2026 revenue $2,548.51 (GiveButter $703 + Patreon $370 + Benevity $1,475 + Interest $0.51), confirmed in DB and in the live app.

## Evidence
- 10 offline unit tests pass (`scripts/loadEVDonations.test.mjs`): parsing, aggregation, GiveButter date-based dedup, idempotency, zero-source drop.
- Live load + a second identical run (idempotency proven: total $2,548.51, 6 categories, 4 line items, no duplicates).
- Aggregate-only storage — 0 donor PII rows; `data/ev-sources/` gitignored.
- Single income writer: `loadEVFinances.js` revenue write removed (D-08).
- **Cross-year double-count (found at UAT, Chris):** 14 Dec-2025 Benevity gifts ($207.50) were in both FY2025 (old sheet) and FY2026 (new loader). Fixed — removed from FY2025 (cash basis). Verified 0 overlap.
- **UAT:** Chris signed off in the live app 2026-06-20 ("approved") — Money In by source correct, live counter intact.

## Notes / carried into Phase 75
- **Platform fees must be tracked, not lost** (Chris, 2026-06-20): netted platform fees (~$125 FY2026) are captured by the loader (D-09) but not yet displayed. Surfacing them is now explicit Phase 75 scope.
- Expense side (bank debits → operating) was pulled forward into Phase 75 during this session; remaining Phase 75 = balance/runway, deposit↔donation reconciliation, manual entries, platform-fee display.
