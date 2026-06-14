---
phase: 50
slug: federal-yearselector-wiring
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 50 — Validation Strategy

> Frontend (treasury-tracker) + backend (../EV-Accounts). Validation = type/build checks,
> backend integration tests, API contract probes, and observed UAT (no new test framework).

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend** | `npm run build` (tsc -b + vite) — typecheck is the main automated gate |
| **Backend** | `cd ../EV-Accounts && npm test` (treasury integration) + `npm run build` |
| **Contract probe** | `curl /treasury/cities` + `/budgets?fiscal_year=1976` → assert `period_label` |
| **Behavior** | observed UAT via `npm run dev` (year switching, TQ, regression) |
| **Quick run** | `npm run build` (frontend) / `npm test` (backend treasury suite) |
| **Est. runtime** | build ~20–40s; backend tests ~30–60s |

## Sampling Rate
- **After each task:** the affected repo's build/tsc green; backend tasks also run the treasury integration suite.
- **After waves 1–2:** contract probe confirms `period_label` on the test API target.
- **Before sign-off:** observed UAT (50-04-02) across federal years + TQ + city/state regression.

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Threat | Test Type | Command / Check | Status |
|------|------|------|-------------|--------|-----------|-----------------|--------|
| 50-01-01 | 01 | 1 | NAV-01 | T-50-01 | build | `cd ../EV-Accounts && npm run build` | ⬜ |
| 50-01-02 | 01 | 1 | NAV-01 | T-50-01 | integration | `cd ../EV-Accounts && npm test` (period_label asserted) | ⬜ |
| 50-02-01 | 02 | 2 | NAV-01 | T-50-02 | unit/build | parsePeriod returns correct year/label; `npm run build` | ⬜ |
| 50-02-02 | 02 | 2 | NAV-01 | T-50-02 | build | no `parseInt(selectedYear)` remains; build green | ⬜ |
| 50-02-03 | 02 | 2 | NAV-01 | T-50-02 | build | loadBudgetData disambiguates by period_label; build green | ⬜ |
| 50-03-01 | 03 | 2 | NAV-02 | T-50-03 | build | FederalLanding selects summary by year; TQ guarded | ⬜ |
| 50-03-02 | 03 | 2 | NAV-02 | T-50-03 | build | props wired; isCurrent only on default; build green | ⬜ |
| 50-04-01 | 04 | 3 | NAV-01 | T-50-04 | contract | API responses carry period_label as specified | ⬜ |
| 50-04-02 | 04 | 3 | NAV-01/02 | T-50-04 | observed UAT | 7 federal behaviors + city/state/default regression (Chris) | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red*

## Wave 0 Requirements
Existing infrastructure covers all phase requirements — frontend tsc/build + backend treasury
integration suite + API probes + observed UAT. No new framework.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| Year switching updates all panels; TQ distinct from FY1976 | NAV-01/02 | Visual/runtime, cross-repo (needs deployed/local API) | 50-04-02 observed UAT walkthrough |
| No regression to city/state/default | NAV-01 | Visual confirmation across entities | Switch to a city + a state; confirm FY2025 federal default unchanged |

## Validation Sign-Off
- [ ] Each repo's build/tsc green after its tasks
- [ ] Backend integration asserts period_label
- [ ] Contract probe confirms period_label on the test target
- [ ] Observed UAT passes (federal years + TQ + regression)
- [x] `nyquist_compliant: true`

**Approval:** pending
