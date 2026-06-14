---
phase: 51
slug: comparability-notes-source-chain-verification-uat
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 51 — Validation Strategy

> Validation = the source-chain audit (all-PASS, zero residue), durability + spot-check SQL,
> a comparability-source verifier, frontend tsc/build, and observed UAT. No new test framework.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Source-chain audit** | `node scripts/auditFederalSources.mjs` → 0 FAIL, writes 51-audit-results.json |
| **Durability** | SQL: 0 metric source_urls match `outlays_fy\d+\.xlsx` / `api\.fiscaldata` / `\d+db-.*\.xlsx` |
| **Comparability sources** | `node scripts/verifyComparabilitySources.mjs` → every source_url resolves |
| **Spot-check** | SQL: FY1976/1990/2008/2024 totals reconcile to OMB Hist 1.1 |
| **Frontend** | `npm run build` (tsc + vite) green |
| **UAT** | observed walkthrough (historical nav + notes + source links) |

## Sampling Rate
- After each task: the affected check (loader edit → audit re-run; content → verifier; UI → build).
- Before UAT: audit 0-FAIL + durability SQL 0 + comparability verifier + notes on deployed build.

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Threat | Test | Check | Status |
|------|------|------|-------------|--------|------|-------|--------|
| 51-01-01 | 01 | 1 | CTX-02 | T-51-01 | source | no loader writes version-specific/raw metric source_url | ⬜ |
| 51-01-02 | 01 | 1 | CTX-02 | T-51-01 | sql | 0 fragile source_urls in federal_context_metrics | ⬜ |
| 51-01-03 | 01 | 1 | CTX-02 | T-51-01 | audit | auditFederalSources exit 0, 0 FAIL | ⬜ |
| 51-01-04 | 01 | 1 | CTX-02 | T-51-01 | sql | FY1976/90/08/24 reconcile to OMB Hist 1.1 | ⬜ |
| 51-02-01 | 02 | 1 | CTX-02 | T-51-02 | content | TQ + function notes sourced, urls resolve | ⬜ |
| 51-02-02 | 02 | 1 | CTX-02 | T-51-02 | content | agency reorganizations sourced to public laws | ⬜ |
| 51-02-03 | 02 | 1 | CTX-02 | T-51-02 | verifier | verifyComparabilitySources exit 0 | ⬜ |
| 51-03-01 | 03 | 2 | CTX-02 | T-51-03 | build | ComparabilityNote renders sourced lines; build green | ⬜ |
| 51-03-02 | 03 | 2 | CTX-02 | T-51-03 | build/UAT | drift on historical yrs + TQ note on TQ; default clean | ⬜ |
| 51-04-01 | 04 | 3 | CTX-02 | T-51-04 | audit | deployed: audit 0 FAIL + verifier + notes present | ⬜ |
| 51-04-02 | 04 | 3 | CTX-02 | T-51-04 | observed UAT | Chris sign-off (nav + notes + sources + accuracy) | ⬜ |
| 51-04-03 | 04 | 3 | CTX-02 | — | docs | CTX-02 + Phase 51 + v2.1 marked complete | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red*

## Wave 0 Requirements
Existing infrastructure covers all requirements — audit harness + SQL + a small content verifier + frontend build + observed UAT. No new framework.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| Comparability notes read correctly + source links land on official pages | CTX-02 | Visual/content judgment | 51-04-02 observed UAT |
| Historical data accuracy (spot figures vs OMB) | CTX-02 | Cross-check against published tables | 51-04-02 spot a couple figures → OMB source |

## Validation Sign-Off
- [ ] Audit exits 0, 0 FAIL, durable URLs (0 fragile)
- [ ] Comparability content fully sourced; verifier green
- [ ] Spot-check years reconcile to OMB Hist 1.1
- [ ] Frontend build green; notes render correctly
- [ ] Chris UAT sign-off
- [x] `nyquist_compliant: true`

**Approval:** pending
