# Phase 56: Orange County Verification + UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 56-orange-county-verification-uat
**Areas discussed:** Reconciliation target + tolerance, Spot-check sampling scope, Navigation UAT checklist, Discrepancy handling

---

## Reconciliation target + tolerance

| Option | Description | Selected |
|--------|-------------|----------|
| Same-basis, ~1-2% + notes | Compare each loaded figure to the matching basis in the published doc; pass within ~1-2%; note definitional differences | ✓ |
| Strict near-exact (<1%) | Require <1% against the closest published figure; flag anything above | |
| Looser (<5%) + per-city note | Allow up to ~5% with a written definition-drift note per city | |

**User's choice:** Same-basis, ~1-2% + notes
**Notes:** Independent check against published ACFRs/adopted budgets (roadmap-mandated), matched basis-to-basis, with sourced definitional notes where bases differ. → D-01

---

## Spot-check sampling scope

| Option | Description | Selected |
|--------|-------------|----------|
| Representative ~6-8 cities | Largest-by-budget + both custom (Anaheim, Santa Ana) + a couple small; latest FY + one historical; operating + revenue | ✓ |
| Broad: all 34, latest FY, operating only | Every city, one figure each, current year, operating only | |
| Quick: 3-4 cities, latest FY, operating | Fast smoke check | |

**User's choice:** Representative ~6-8 cities
**Notes:** Salaries excluded from re-check (already reconciled to GCC in Phase 55 SC-4). Exact city list left to Claude's discretion per the selection rule. → D-02

---

## Navigation UAT checklist

| Option | Description | Selected |
|--------|-------------|----------|
| Full OC nav + data surfaces | breadcrumb; CitiesInCountyPanel (all 34 + links); salaries tab on covered cities; per-capita; custom Anaheim/Santa Ana render | ✓ |
| Core nav only | breadcrumb + Cities-in-Orange-County panel (the two roadmap-named items) | |
| Claude proposes the checklist | Claude drafts checklist from built components, user reviews in planning | |

**User's choice:** Full OC nav + data surfaces
**Notes:** Sign-off is Chris's, live app at treasurytracker.empowered.vote. → D-03

---

## Discrepancy handling

| Option | Description | Selected |
|--------|-------------|----------|
| Document sourced variance; fix only real errors | Definitional mismatches recorded as sourced known-variances and pass; only genuine load errors open a fix | ✓ |
| Verify + fix everything here | Any non-reconciling figure corrected before sign-off | |
| Verify-only; defer all fixes | Document pass/fail only; failures route to a follow-up gap phase | |

**User's choice:** Document sourced variance; fix only real errors
**Notes:** Keeps the phase verification-focused without ballooning into a re-load; genuine load errors (wrong total/year/mapping) still get fixed. → D-04

---

## Claude's Discretion

- Verification methodology: `verify-phase56.mjs` DB-probe script (precedent: verify-phase32/33/34) + a documented `56-VERIFICATION.md` / UAT artifact.
- Exact 6–8 city sample selection and historical year.
- ACFR/adopted-budget figure sourcing per city; reconciliation probe SQL.

## Deferred Ideas

- Exhaustive all-34-city ACFR reconciliation (future deeper-audit pass).
- Data corrections beyond genuine load errors (document as variance; revisit in a future phase if warranted).
