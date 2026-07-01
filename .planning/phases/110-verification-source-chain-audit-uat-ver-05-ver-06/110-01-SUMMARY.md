---
phase: 110-verification-source-chain-audit-uat-ver-05-ver-06
plan: 01
status: complete
completed: 2026-07-01
requirements: [VER-05]
key-files:
  created:
    - scripts/verify-phase110-rederive.mjs
    - .planning/phases/110-verification-source-chain-audit-uat-ver-05-ver-06/110-REDERIVATION.md
---

# 110-01 SUMMARY — Loader-Independent Blind Re-Derivation (VER-05 part a)

**Verdict: 49/49 exact ties, $0 delta on every check. Harness exits 0.**

## What was built
- `scripts/verify-phase110-rederive.mjs` — blind ACFR re-derivation harness for all 10 tranche-2
  states. Imports ZERO loaders and ZERO shared-parser modules (maAcfrExtract.mjs); its statement
  locator (whitespace-normalized title match, combining/budget/notes pages excluded, auto page
  discovery) and first-numeric-token GF-column parser are an independent implementation. Exact-0
  bar, soft-404 + %PDF guards, tn.gov browser UA, NJ dollars ×1 vs thousands ×1000 units,
  runtime municipality-ID resolution.
- `110-REDERIVATION.md` — the full 49-row tie log with dispositions, sample reproducibility
  (random middles MA FY2016 / NC FY2019 / TN FY2017), clamp-year root-total confirmation
  (MD FY2022, CT FY2013, WI FY2013, WA FY2022), and the rounding-note reconciliation (loaders
  stored printed roots → exact ties even at the loadlog-flagged rounding years).

## Deviations from plan
1. **Windows corrected from post-plan LOADLOG updates:** the GA-parser colon fix (recorded in the
   108 loadlog UPDATE sections) recovered MA FY2003/FY2006 and NC FY2012/FY2013 after the 108
   summaries were written. Sample bookends moved accordingly: MA oldest = FY2003 (not FY2007),
   NC oldest = FY2012 (not FY2014). MA middle FY2016 retained; NC middle = FY2019 (year 8/14).
2. **Cached source bytes reused** (`_acfr-work/{st}/{ST}{YYYY}.pdf`, re-verified %PDF + size at
   runtime) per the Phase 106 cache-reuse precedent — all 26 targets served from the load-time
   verified cache; canonical re-fetch URLs recorded per target.
3. **Harness locator bug self-caught:** first run showed 4 WI false deltas — the -table title-gap
   issue documented in 110-REDERIVATION.md. Fixed in-harness (whitespace normalization); DB data
   was correct throughout. No data fix was needed.

## Verification
- `node scripts/verify-phase110-rederive.mjs` → 49/49 PASS, exit 0.
- No loader/parser imports (only node: builtins).
- No tolerance band anywhere in the source (exact `abs(delta) === 0` gate).
