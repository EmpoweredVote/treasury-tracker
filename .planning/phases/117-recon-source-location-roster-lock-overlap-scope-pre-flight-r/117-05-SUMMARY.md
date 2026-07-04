---
phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
plan: "05"
subsystem: recon
tags: [acfr, pdftotext, state-general-fund, sco, myfloridacfo, osc-ny, texas-comptroller]

requires:
  - phase: 104 (v2.12)
    provides: the actual current CA/NY/FL windows (FY2008-2025 / FY2003-2024 / FY2021-2024) this recon dug below
  - phase: 99-01 (v2.11)
    provides: the TX FY2016 file-id gap fix this recon re-confirmed still live
provides:
  - "117-DEEPEN-SOURCES.md — Phase 122's input contract for DEEP-05: CA/NY/FL/TX per-target deepening disposition + bookend ties + gap log"
  - "A corrected, live-verified statement of each target's actual current window (the phase objective's stated windows were stale)"
affects: [122-deepening-existing-acfr-node-pre-window-holes]

tech-stack:
  added: []
  patterns:
    - "Filename-variant discovery: state ACFR archives often have multiple undocumented naming schemes at the same base path (CA cafrNN.pdf vs cafrNNweb.pdf vs {YYYY}_cafrNN.pdf; FL cafr{YYYY}.pdf vs {YYYY}cafr.pdf) — probe variants with curl -I + Content-Type/size validation before declaring a durable floor"
    - "Durable-URL-but-extraction-corrupted is a distinct disposition from unavailable — gap-log separately (light-cleanup/repair candidate for the load phase), never conflate with D-06 durability exclusion"

key-files:
  created:
    - .planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-DEEPEN-SOURCES.md
  modified: []

key-decisions:
  - "Corrected the plan's stale premise (CA pre-FY2020/NY pre-FY2015/FL pre-FY2022/TX FY2016) by verifying actual current windows directly from live loader source before digging further, per D-02's 'go as deep as durable URLs allow' — treated as a Rule-1 factual correction, not a scope change"
  - "CA: found 6 additional clean FYs (FY2002-2007) via an undocumented filename variant (no 'web' suffix / year-prefixed) at the same SCO base path already used for FY2008-2019 — FY2002 (GASB-34 boundary) bookend-tied exact $0, no pre34 flag needed"
  - "FL: found 18 additional clean FYs (FY2003-2020) via a third myfloridacfo naming variant discovered through the state's own archive index page — FY2003 and FY2020 bookend-tied exact $0; FY2000-2002 are durable-URL-confirmed but pdftotext-corrupted, gap-logged as a repair candidate rather than an unavailable hole"
  - "NY and TX: reconfirmed (not re-derived) that FY2003 and FY2015 respectively are the genuine durable floors — no new work possible within the recon budget"

requirements-completed: [RECON-11]

duration: 55min
completed: 2026-07-04
---

# Phase 117 Plan 05: DEEP-05 Deepening Recon Summary

**Located and bookend-tied durable pre-window ACFR URLs for CA (+6 FYs to FY2002) and FL (+18 FYs to FY2003) via previously-undiscovered filename variants; reconfirmed NY (FY2003) and TX (FY2015) as genuine durable floors — after first correcting the plan's stale premise about each target's actual current window.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-04T01:20:00Z
- **Completed:** 2026-07-04T02:15:00Z
- **Tasks:** 3 (00, 01, 02 — completed together in one research pass since all three target the same single deliverable file)
- **Files modified:** 1

## Accomplishments
- Discovered the phase objective's stated "current windows" (CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016) were stale — verified from live loader source that Phase 104 (v2.12) already deepened CA/NY/FL and Phase 99-01 (v2.11) already closed the TX FY2016 gap
- Found a new durable CA extension: FY2002-2007 (6 more years) via an undocumented filename variant (`cafrNN.pdf` and `{YYYY}_cafrNN.pdf`) at the SCO archive — FY2002 bookend-tied exact $0, landing exactly on the GASB-34 boundary with no earlier soft-404-free years reachable
- Found a much larger new durable FL extension: FY2003-2020 (18 more years) via a third naming scheme (`cafr{YYYY}.pdf` / `{YYYY}cafr.pdf`) discovered through FL's own transparency archive index page — FY2003 and FY2020 both bookend-tied exact $0
- Reconfirmed NY's FY2003 floor and TX's FY2015 floor are genuine (no deeper durable URL exists), and reconfirmed TX's FY2016 file-id fix is still live
- Wrote `117-DEEPEN-SOURCES.md` — the complete Phase 122 input contract with per-target table, a full FL per-year filename map, a consolidated gap log, and per-target load statements

## Task Commits

All three tasks (00 workspace/load-current-windows, 01 NY+TX, 02 CA+FL+finalize) were researched and written together into the single deliverable file, then committed atomically:

1. **Tasks 0-2 combined: DEEP-05 deepening recon** - `b8bf031` (docs)

**Plan metadata:** committed together with this SUMMARY (worktree mode — no separate STATE.md/ROADMAP.md writes; orchestrator owns those after the wave completes).

## Files Created/Modified
- `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-DEEPEN-SOURCES.md` - Per-target (CA/NY/FL/TX) deepening disposition table, FL per-year filename map, consolidated gap log, Phase 122 load statements

## Decisions Made
- Verified each target's actual current window from live loader source (`scripts/process{CA,NYAcfr,FLAcfr,TX}.js` + their `*RevenueAcfr.js` counterparts) rather than trusting the plan's stated windows, since the code showed Phase 104/v2.12 had already deepened three of the four targets — this is the corrected starting point the D-02 "go as deep as durable URLs allow" instruction actually applies to.
- Treated "durable URL exists but pdftotext fails" (FL FY2000-2002) as a distinct gap-log disposition from "no durable URL" (per D-06) — the former is a repair candidate for Phase 122, not an exclusion.
- Did not force-repair the FL FY2000-2002 PDFs (xref-damaged) within this recon's effort budget — flagged for Phase 122's discretion (e.g. `qpdf` repair) rather than attempting an open-ended fix here.
- Stopped CA's dig at FY2002 (the GASB-34 boundary) once every filename variant tried below it returned the known SCO soft-404 signature (HTTP 200, `text/html`, exactly 11,561 bytes) — consistent with the CA soft-404 caution in the threat model.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Factual/premise correction] Plan's stated "current window" for all four DEEP-05 targets was stale**
- **Found during:** Task 0 (workspace setup / load current windows)
- **Issue:** The phase objective and CONTEXT.md described CA/NY/FL/TX's current windows as pre-FY2020/pre-FY2015/pre-FY2022/FY2016-gap — but these describe the *v2.11* (pre-Phase-104) state. Phase 104 (v2.12) already deepened CA to FY2008-2025, NY to FY2003-2024, and FL to FY2021-2024; Phase 99-01 (v2.11) already closed the TX FY2016 gap. Digging "below" the stale windows would have re-discovered years already loaded, producing a useless/wrong deliverable.
- **Fix:** Read the live loader source files (`scripts/processCA.js`, `processNYAcfr.js`, `processFLAcfr.js`, `processTX.js` + revenue counterparts) to establish each target's true current window before probing further back. Documented the correction prominently at the top of `117-DEEPEN-SOURCES.md` so Phase 122 doesn't inherit the same stale assumption.
- **Files modified:** `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-DEEPEN-SOURCES.md` (correction section + corrected per-target table)
- **Verification:** Cross-checked against `103-DEEPEN-SOURCES.md` (the v2.12 deepening recon) and the v2.12 PROJECT.md changelog entry, both of which independently confirm the same actual windows.
- **Committed in:** `b8bf031`

---

**Total deviations:** 1 auto-fixed (1 factual/premise correction, Rule 1)
**Impact on plan:** Necessary for the recon to be useful — digging from the plan's stale premise would have produced a deliverable describing years already loaded, misleading Phase 122. No scope creep: still exactly the four DEEP-05 targets, still documentation-only, still $0.

## Issues Encountered
- FL FY2000-2002 PDFs download successfully (confirmed genuine PDF v1.3 via `file`, correct size) but `pdftotext` fails with "Couldn't read xref table" / "damaged" on both `-table` and plain modes — a real server-side/legacy PDF encoding issue, not a download or tool problem. Gap-logged as a repair candidate rather than spending further recon budget attempting a repair (out of scope for a documentation-only recon).
- No WebFetch/browser tool was available in this environment; all archive-page discovery was done via `curl` (fetching raw HTML and grepping for `.pdf` hrefs), which worked reliably for finding the FL and NY archive index pages.

## User Setup Required

None - no external service configuration required. Documentation-only, $0 spend (curl + pdftotext, no AI).

## Next Phase Readiness
- `117-DEEPEN-SOURCES.md` is the complete input contract for Phase 122: CA can add 6 FYs (FY2002-2007), FL can add up to 18 FYs (FY2003-2020, plus an optional FY2000-2002 repair attempt), NY and TX have no further extension available.
- No DB writes, no NASBO mutations, no loader code changes — existing CA/NY/FL/TX ACFR rows are completely untouched.
- Every newly-reached bookend FY (CA FY2002+FY2007, FL FY2003+FY2020) is tie-confirmed to its printed GF/General-Fund column total; the FL FY2000-2002 hole and the "no extension" NY/TX findings are both clearly gap-logged with reasons.

---
*Phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r*
*Completed: 2026-07-04*

## Self-Check: PASSED
- FOUND: .planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-DEEPEN-SOURCES.md
- FOUND: commit b8bf031
