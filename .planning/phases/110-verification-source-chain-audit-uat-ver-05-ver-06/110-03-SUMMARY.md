---
phase: 110-verification-source-chain-audit-uat-ver-05-ver-06
plan: 03
status: complete
completed: 2026-07-01
requirements: [VER-06]
key-files:
  created:
    - .planning/phases/110-verification-source-chain-audit-uat-ver-05-ver-06/110-UAT-CHECKLIST.md
---

# 110-03 SUMMARY — Live-App UAT + Chris Sign-off (VER-06)

**Verdict: 11/11 anchors PASS — Chris signed off "all pass" 2026-07-01. VER-06 satisfied.**

## What was done
- Production confirmed live: HTTP 200 at treasurytracker.empowered.vote (2026-07-01).
- `110-UAT-CHECKLIST.md` written with 11 anchors — one per upgraded state, each exercising a
  distinct verified risk case, plus the NASBO regression control:
  1. NJ FY2025 (dollars-unit magnitude ~$61.0B) ✅
  2. MA FY2025 + hole honesty (year selector skips FY2014/FY2021) ✅
  3. NC FY2012 (deep floor) ✅
  4. GA FY2023 (F-97-01 supersede: $59,893,783K ACFR, not $29.3B NASBO) ✅
  5. MD FY2022 (clamp: "Interest and other investment income (net loss — shown at 0)", root $50,540,136,000 intact) ✅
  6. TN FY2025 (source chip opens tn.gov ACFR in browser) ✅
  7. CT FY2002 (oldest FY in the cohort, pre-GASB-34 boundary edition) ✅
  8. WI FY2013 (clamp: Interest Income −$838K shown at 0, root intact) ✅
  9. WA FY2022 (largest clamp: Investment income (loss) −$216,940K shown at 0, root intact) ✅
  10. MI FY2025 (~3.5× honest relabel, ~$53.8B revenue, source date 2025-09-30) ✅
  11. CO NASBO control (operating-only, Money In disabled, ?dataset=revenue graceful fallback) ✅
- Each anchor checked the 5 standard items (revenue-by-source, spending-by-function, GAAP basis
  label, source chip url+date, Money In enabled/disabled) with expected values sourced from
  110-REDERIVATION.md (independent re-derivation, never the loaders).
- Chris exercised all 11 anchors on the live app and signed off all-pass; checklist frontmatter
  set to `status: passed` with signature + date. 0 defects, 0 in-phase fixes needed, 0 cosmetic
  items logged.

## Deviations from plan
None — the anchor set executed exactly as planned.
