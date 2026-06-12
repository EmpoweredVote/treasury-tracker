# 47-01 Summary — Pilot Selection

**Executed:** 2026-06-12 | **Status:** Complete — 47-PROGRAMS.md is the contract

- **Modern probes:** 9 candidates fetched via Congress.gov; 8 title-confirmed with full field sets (PL, sponsor, cosponsors). 1 principled skip: Post-9/11 GI Bill (officially "Supplemental Appropriations Act, 2008" — the record can't support the program claim).
- **Foundational probes:** 3 confirmed in GovInfo STATUTE (Social Security Act 1935, Space Act 1958, Food Stamp Act 1964 — official titles quoted verbatim). 4 candidates ranked poorly under phrase search → CONDITIONAL with refined date-range queries for 47-02; same fetched-title gate.
- **name_keys:** all targets verified against the live tree (depth 0–1 SQL dump), incl. subfunction nodes (disaster relief, food and nutrition assistance, elementary/secondary education). UNIQUE-per-node constraint surfaced one conflict (MMA vs 1965 Medicare act) — resolved: one primary act per node, extras into details jsonb only if fetched.
- Tally: 11 confirmed + up to 5 conditional = 12–16 rows; backup candidates listed if the ≥15 target needs them.

## Deviations from plan

GovInfo phrase-search relevance is poor — date-range + keyword refinement pushed to 47-02 (gate unchanged, so ORIG-03 discipline holds).
