---
phase: 55-statewide-city-salaries-integration
plan: "55-01"
subsystem: data-ingestion
tags: [gcc, sco, publicpay, california, salaries, city-compensation, spike, recon]

# Dependency graph
requires:
  - phase: 54-orange-county-entity-linking-enrichment
    provides: 34 OC cities loaded in DB; salaries deferred here to Phase 55
  - phase: 53-orange-county-operating-revenue-load
    provides: OC municipality records; city names match EmployerName in GCC CSV

provides:
  - "55-SPIKE-FINDINGS.md: auditable gate document with access method, field mapping, sample reconciliation, and explicit GATE: PASS verdict"
  - "GCC raw export URL pattern: https://gcc.sco.ca.gov/RawExport/{YEAR}_City.zip (browser UA, HTTP 200)"
  - "Field mapping: DepartmentOrSubdivision → Position tree, TotalWages + TotalRetirementAndHealthContribution = Total Compensation, no individual names"
  - "OC coverage confirmed: all 34 OC cities present in 2024 City CSV (EmployerCounty=Orange filter)"
  - "Irvine 2024 reconciliation: computed $190,426,283 = GCC published figure (delta $0)"

affects:
  - 55-02-PLAN (loader build — authorized by this GATE: PASS)
  - 55-03-PLAN (OC load — depends on loader from 55-02)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GCC City ZIP pattern: one file per year, all CA cities, filter by EmployerName for city scope"
    - "Total Compensation = TotalWages + TotalRetirementAndHealthContribution (no separate column)"
    - "D-03 breakdown: RegularPay = base; OvertimePay+LumpSumPay+OtherPay = overtime/other; TotalRetirementAndHealthContribution = benefits"
    - "Access method: curl/fetch with browser-like UA; no auth, no session, no form submission"

key-files:
  created:
    - ".planning/phases/55-statewide-city-salaries-integration/55-SPIKE-FINDINGS.md"
  modified: []

key-decisions:
  - "GCC access: static ZIP files (/RawExport/{YEAR}_City.zip) bypass Cloudflare challenge that protects the HTML pages — automation is feasible without evasive tooling"
  - "No separate TotalCompensation column: loader computes TotalWages + TotalRetirementAndHealthContribution per row"
  - "Pre-2011 data uses ReportedBaseWage (col 10) instead of RegularPay (col 11); loader must branch on year"
  - "EmployerCounty filter: OC-scoped queries can filter by EmployerCounty=Orange to avoid loading all CA cities into memory simultaneously"

patterns-established:
  - "Spike-first gate: 55-SPIKE-FINDINGS.md with machine-greppable GATE: PASS/FAIL line is the hard gate before any loader build"
  - "Reconciliation via accessible GCC Cities listing page (/Reports/Cities/City.aspx?entityid=N&year=Y, HTTP 200) — entity HTML pages accessible even when main search is Cloudflare-gated"

requirements-completed: [SAL-01]

# Metrics
duration: 55min
completed: 2026-06-15
---

# Phase 55 Plan 01: SAL-01 Spike Summary

**GCC raw export programmatic access confirmed (HTTP 200, browser UA), all 34 OC cities present, Irvine 2024 reconciles exactly ($190,426,283 computed = published, delta $0) — GATE: PASS authorizes Plan 55-02 loader build**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-06-15T05:36:43Z
- **Completed:** 2026-06-15T06:31:00Z
- **Tasks:** 4 of 5 (Task 5 is the blocking human-verify gate — awaiting operator approval)
- **Files modified:** 1 (55-SPIKE-FINDINGS.md created)

## Accomplishments

- Confirmed publicpay.ca.gov → gcc.sco.ca.gov 301 redirect (Task 1)
- Discovered `/RawExport/{YEAR}_City.zip` static URL pattern — HTTP 200 with browser UA, no paywall (Task 1)
- Downloaded 2024_City.zip (8.2 MB / 95.8 MB extracted, 345K rows, covers all CA cities); confirmed all 34 OC cities present (Task 1, Task 2)
- Mapped all 29 GCC CSV columns to tree/metadata fields; confirmed no individual names (D-01 PASS), Total Compensation derivation (D-02), wages/benefits breakdown for D-03 (Task 2)
- Irvine 2024 reconciliation: computed $190,426,283 from raw CSV matches GCC published figures exactly — delta $0 (Task 3)
- Wrote 55-SPIKE-FINDINGS.md with all four required sections and explicit `GATE: PASS` line (Task 4)

## Task Commits

1. **Tasks 1-4: SAL-01 spike (access + schema + reconciliation + findings)** — `8492c31` (feat)

## Files Created/Modified

- `.planning/phases/55-statewide-city-salaries-integration/55-SPIKE-FINDINGS.md` — Auditable gate document: access method, field mapping table, Irvine 2024 reconciliation, GATE: PASS verdict

## Decisions Made

- GCC entity HTML pages (gcc.sco.ca.gov/Reports/GCC.aspx, the old publicpay.ca.gov pages) are Cloudflare-protected (HTTP 403 with managed challenge). However, two access paths are clean: (1) `/RawExport/{YEAR}_City.zip` static files return HTTP 200; (2) `/Reports/Cities/Cities.aspx` and `/Reports/Cities/City.aspx?entityid=N&year=Y` listing pages return HTTP 200. Loader uses path (1); reconciliation used path (2).
- No separate TotalCompensation column exists in the raw CSV. The GCC website derives it as TotalWages + TotalRetirementAndHealthContribution, and the loader must do the same.
- Pre-2011 records use `ReportedBaseWage` (col 10) rather than the component pay fields (cols 11-15). The loader should detect year < 2011 and handle accordingly.
- EmployerCounty column (col 25) enables OC-scoped filtering (`EmployerCounty === 'Orange'`) without pre-loading the full CA file into memory — useful for the OC load pass in Plan 55-03.

## Deviations from Plan

None — plan executed exactly as written. The Cloudflare challenge on the main HTML pages was anticipated (planning noted HTTP 403 from plain crawlers), and the spike proved the static ZIP path bypasses it cleanly.

## Issues Encountered

- Main GCC website HTML pages (RawExport.aspx listing page itself, entity GCC.aspx pages) return HTTP 403 with Cloudflare managed challenge. Resolved by discovering that `/RawExport/*.zip` static file paths and the `/Reports/Cities/` listing pages are not behind the challenge — these are the paths the loader and reconciliation use.

## Known Stubs

None — this plan writes only the spike findings document, no data or UI changes.

## Threat Flags

None new — the spike confirmed T-55-01-01 (bot-block) is mitigated (static ZIP path accessible), T-55-01-03 (individual names) is not present in the source (no name columns), T-55-01-04 (spoofing) mitigated by following the canonical 301 redirect.

## Next Phase Readiness

- **Task 5 (blocking gate):** Operator must review 55-SPIKE-FINDINGS.md and confirm the GATE: PASS verdict before Plan 55-02 begins.
- Once approved: Plan 55-02 builds the statewide city-salaries loader using the URL pattern, field mapping, and zero-comp-skip logic documented in 55-SPIKE-FINDINGS.md.
- Concern to note for 55-02: pre-2011 records use `ReportedBaseWage` (no component breakdown) — the loader needs a year-branch for 2009/2010 data.

---
*Phase: 55-statewide-city-salaries-integration*
*Completed: 2026-06-15 (Task 5 pending operator gate approval)*
