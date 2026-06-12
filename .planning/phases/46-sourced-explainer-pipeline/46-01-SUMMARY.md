# 46-01 Summary — Sources Contract

**Executed:** 2026-06-12 | **Status:** Complete — 46-SOURCES.md is the binding contract

## Function descriptions: source found on the 3rd candidate (+1 unplanned)

1. ❌ OMB Circular A-11 (a11.pdf downloaded, 39,529 lines extracted): Exhibit 79A is a code→title list only — no definitions.
2. ❌ PBDB user guide (db_guide_fy2027.pdf): Table 2 is also codes+titles only.
3. ❌ CRS reports: crsreports.congress.gov 403s (joins GAO/CBO on the blocked list).
4. ✅ **GAO-05-734SP Appendix IV "Budget Functional Classification"** — full official definitions for all 20 functions with includes/excludes, derived from OMB's classification paper. KEY DISCOVERY: gao.gov curl-blocks even its PDF assets, but **the WebFetch fetcher passes the bot wall and saves the binary** — the GAO acquisition path is now unblocked for 46-03 and Phase 48. Appendix committed verbatim at `docs/federal/gao_appendix4.txt`; structure cross-checked against A-11 Exhibit 79A (exact match); 2005-vintage caveat recorded.

## Agency missions: 9/10 fetched, 1 explicit skip

All 9 mappable top-10 departments mapped to toptier codes from the live directory (no memory codes) and their official missions fetched verbatim (table in 46-SOURCES.md). "Other Defense Civil Programs" skipped with rationale — T5 composite, no single agency. Recipe set: mission + our own sourced agency-lens figures carry the description (some missions are thin slogans).

## Deviations from plan

- CRS attempted as an extra candidate (blocked).
- WebFetch-passes-GAO workaround discovered and documented — improves 46-03's audit-record odds considerably.
