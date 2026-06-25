# Phase 83-03 — Live-App UAT Checklist (Virginia)

**App:** https://treasurytracker.empowered.vote · **Driver:** Chris · **Recorder:** agent (blocking checkpoint)
**Spread:** Alexandria (independent city, standalone) · Fairfax County (county) · Herndon (town → Fairfax County). All confirmed FY2024 op+rev in the pre-flight probe.

## A — Alexandria (independent city)
1. Navigate US → Virginia → Alexandria. Renders **standalone** (no parent-county breadcrumb; independent city).
2. Money Out (operating) icicle renders; top functions show **plain-language Phase-82 enrichment** (Public Safety, Public Works, Health & Human Services, Education, …) with descriptions.
3. Drill into a function → activity (e.g. Public Safety → Fire & Rescue / Law Enforcement): activity-level plain-language names + descriptions render.
4. Money In (revenue) renders; sources show enrichment (Property Taxes, Other Local Taxes, …) incl. drill-down (Real Estate Tax, Local Sales Tax).
5. Per-capita renders (population 158,591). Source chip shows **data.virginia.gov**.

## B — Fairfax County (county)
6. Navigate US → Virginia → Fairfax County. Renders as a **county node**.
7. **Localities-in-County panel** lists its linked towns (incl. Herndon, Vienna).
8. Money Out + Money In icicles render with plain-language enrichment; drill-down works.
9. Per-capita renders. Source chip shows **data.virginia.gov**.

## C — Herndon (town in Fairfax County)
10. Navigate to Herndon. **Breadcrumb** shows US → Virginia → Fairfax County → Herndon.
11. Town Money Out + Money In render with plain-language enrichment.
12. Herndon appears under Fairfax County's Localities-in-County panel (cross-check with item 7).

## D — Bleed / honesty spot-check
13. Across all three: **no locality name** appears inside another entity's category descriptions; **no `$` figures** in any enrichment text; county/town functions read locality-neutral (not "the city…").
14. (Optional regression) Open one CA city + one MA town: shared keys still read sensibly; **Miscellaneous reads as revenue**, not "Information Technology" (Phase 82 fix).

---

## Sign-off

- [ ] Items 1–14 reviewed.
- **Verdict:** _______________  (Chris)
- **Date:** _______________

*Recorder fills pass/fail per item from Chris's walkthrough; sign-off recorded at the blocking checkpoint.*
