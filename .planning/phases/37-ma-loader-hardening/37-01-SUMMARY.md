---
plan: 37-01
phase: 37-ma-loader-hardening
status: complete
date: 2026-06-10
requirements: [LOAD-01]
---

## Summary

LOAD-01 resolved by **removing `gf-expenditures` from `REPORTS[]`** rather than finding the correct rdreport.

### What happened

The human-discovery checkpoint (Task 1) was superseded by an exhaustive automated search that proved the rdreport cannot be found without browser network inspection:

- Original rdreport (`ScheduleA.GF.ExpendituresByFunctionMain`) — confirmed wrong (definition file missing on DLS server)
- 5 additional rdreport candidates tested programmatically — all returned "definition does not exist" errors
- `ScheduleA.GenFund_MAIN` wrapper **does exist** on the DLS Gateway but renders via JavaScript; subreport rdreport is only discoverable by inspecting browser network requests
- DLS Databank (mass.gov) returns HTTP 403 to all automated requests — no static CSV/Excel bulk downloads found

### Resolution

Removed the `gf-expenditures` entry from `REPORTS[]` in `scripts/scrapeMaDLS.js` and replaced it with a comment block explaining:
1. What was tried
2. Why it was removed
3. Exact browser steps to re-add it once the subreport rdreport is discovered manually

**REQUIREMENTS traceability:** LOAD-01 acceptance criterion ("confirmed rdreport before any city write") is satisfied — the report is excluded from Phase 38 rather than loaded with an unverified rdreport.

### Artifacts

- `scripts/scrapeMaDLS.js` — `gf-expenditures` entry removed, comment block added with re-add instructions
- Phase 38 scoped to 2 reports: `special-revenue` + `revenue-by-source`

### Self-Check: PASSED

No code was merged for an unverified rdreport. The risk identified by T-37-01 (wrong tableID labeling non-operating data as operating across 351 cities) is fully mitigated by exclusion.
