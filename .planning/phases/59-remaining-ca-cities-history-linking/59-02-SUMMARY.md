---
phase: 59-remaining-ca-cities-history-linking
plan: "59-02"
subsystem: database
tags: [county-linking, breadcrumb, municipalities, seedCountyLinks, data-hygiene]

requires:
  - phase: 58-la-county-parity-backfill
    provides: linking-only county-node precedent (Alameda/Sacramento/San Diego)
provides:
  - 4 new linking-only county entities (Kern, Fresno, Riverside, Santa Clara County)
  - 5 city→county links (Bakersfield, Fresno, Riverside, San Jose, Oakland)
  - San Francisco resolved as a single combined city-county node (county_id NULL)
  - Test record removed
affects: [59-03, 59-04]

tech-stack:
  added: []
  patterns:
    - "Combined city-county node = entity_type='city' + county_id NULL (San Francisco)"

key-files:
  created:
    - .planning/phases/59-remaining-ca-cities-history-linking/59-02-SUMMARY.md
  modified: []

key-decisions:
  - "San Francisco NOT renamed (kept 'San Francisco', not 'City and County of San Francisco') to keep the 59-03 basis-note key + name-based lookups stable; breadcrumb renders cleanly either way"
  - "New-county dry-run shows the target under 'Already linked' (null==null artifact); confirmed blast radius = intended target only; real run links correctly once the county UUID exists"

patterns-established:
  - "Dry-run blast-radius check: every other county member must be 'Not yet in DB' before a real link"

requirements-completed: [ENR-02]

duration: ~10min
completed: 2026-06-16
---

# Phase 59 / Plan 59-02: county linking + entities + Test deletion

**Created the 4 missing linking-only CA county nodes, linked the 5 county-bound cities, kept San Francisco as a clean single combined city-county node, and removed the budget-less Test artifact — all without touching budgets or repointing any already-linked city.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-16
- **Tasks:** 6/6
- **Files modified:** 0 source files (DB-only plan; production Supabase writes)

## Accomplishments
- **4 new linking-only county entities** — Kern, Fresno, Riverside, Santa Clara County — `entity_type='county'`, pop 0, **0 budget rows** (matching the Alameda/Sacramento/San Diego precedent; `loadCountyBudget.js` not run).
- **5 city→county links:** Bakersfield→Kern, Fresno→Fresno, Riverside→Riverside, San Jose→Santa Clara, Oakland→Alameda (existing).
- **San Francisco = combined node** — `entity_type='city'`, `county_id NULL`, no "San Francisco County" entity → breadcrumb renders `US / California / San Francisco` cleanly (D-07).
- **No repoints:** Berkeley/Fremont→Alameda, Sacramento→Sacramento, San Diego→San Diego all unchanged (no `--force`).
- **Test record deleted** after the zero-dependent gate (budgets/salaries/operating_budgets/revenue_budgets/county_refs all 0).

## Task Commits
DB-only plan — no per-task source commits. The single git artifact is this SUMMARY.

1. **59-02-01 baseline** — county_ids of 10 cohort cities, existing county entities, Test dependents (all 0).
2. **59-02-02 dry-run gate** — blast radius = intended target only for all 5 counties; Alameda reuse + Berkeley/Fremont already-linked confirmed.
3. **59-02-03 real links** — 4 county nodes created, 5 cities linked, no repoint.
4. **59-02-04 San Francisco** — confirmed city/NULL, no county node, no rename (decision recorded).
5. **59-02-05 verify** — 4 new nodes 0 budgets, no SF county node, 4 already-linked cities unchanged.
6. **59-02-06 Test deletion** — deleted by exact id; verified absent.

## Files Created/Modified
- `.planning/phases/.../59-02-SUMMARY.md` — this summary. No source files changed.

## Decisions Made
- **SF muni name kept as "San Francisco"** (rename was optional). The 59-03 SF basis-note key is therefore `San Francisco|CA`.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- The dry-run "Already linked" labeling for the 4 new counties was a `null === null` (city county_id vs not-yet-created county id) artifact, not a real already-linked state. Analyzed, confirmed safe, and the real run linked all targets correctly.

## Next Phase Readiness
- **59-03** SF entry key = `San Francisco|CA`.
- **59-04** can verify the 5 breadcrumbs + Cities-in-County panels + SF clean render live.

---
*Phase: 59-remaining-ca-cities-history-linking*
*Completed: 2026-06-16*
