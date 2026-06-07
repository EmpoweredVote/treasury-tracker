# Phase 33: CA State Budget Data — Verification Record

**Status: PASSED**
**Verified:** 2026-06-07
**Verifier:** Human (browser spot-check at https://treasurytracker.empowered.vote)

---

## Success Criteria Verification

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | California visible in entity picker under "State Governments" section | PASS | Appears at top of California section with "State Budget" badge (EntitySwitcher) |
| 2 | Money Out tab shows General Fund total ~$228B for FY2025-26 | PASS | Confirmed approximately $228 billion for FY2025-26 |
| 3 | Per-capita display shows ~$5,782 per resident for FY2025-26 | PASS | Confirmed approximately $5,782 per resident |
| 4 | Enrichment descriptions use state-level policy language (Medi-Cal, General Fund, state programs — not city council/mayor) | PASS | State-level framing confirmed; no city council/mayor language present |
| 5 | Year selector offers at least FY2022-2026 as selectable years | PASS | FY2022-2026 selectable; year switching updates totals correctly |

---

## Requirements Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| DATA-01 | CA state municipality seeded with entity_type='state' | PASS (Phase 33-01) |
| DATA-02 | CA General Fund operating budget FY2022-2026 loaded (~$228B FY2025-26) | PASS (Phase 33-02) |
| DATA-03 | enrichCategories.js 'state' case added; CA FY2026 enrichment run with state framing | PASS (Phase 33-03) |
| DATA-04 | Live app functional: entity picker, Money Out, per-capita, enrichment, year selector | PASS (Phase 33-03) |

---

## Additional Notes

- A supplementary fix was applied on the `main` branch (commit ea29501, outside the worktree): California state entity now appears at the top of the California section on the landing page with a "State Budget" badge.
- All 12 category enrichment rows for California FY2026 use state-level language (Medi-Cal, General Fund, DOF agency groupings). Zero instances of "city council" or "mayor" framing.
- Population denominator of 39.5M residents produces correct per-capita ($228B / 39.5M ≈ $5,772, within tolerance of $5,782 target).

---

*Phase 33 is complete. All DATA-01 through DATA-04 requirements verified.*
