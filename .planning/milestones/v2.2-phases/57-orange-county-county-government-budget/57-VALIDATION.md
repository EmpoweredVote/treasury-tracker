---
phase: 57
slug: orange-county-county-government-budget
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-15
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node ESM probe script (`verify-phase57.mjs`), mirroring `verify-phase34.mjs` / `verify-phase56.mjs` — no test runner |
| **Config file** | none — script reads repo `.env`/`.env.local` (SUPABASE_URL + SUPABASE_SERVICE_KEY/SERVICE_ROLE_KEY), schema `treasury` |
| **Quick run command** | `node scripts/verify-phase57.mjs` |
| **Full suite command** | `node scripts/verify-phase57.mjs` |
| **Estimated runtime** | ~5–15 seconds (DB round-trips) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/verify-phase57.mjs` (after the probe exists — built in Plan 57-02)
- **After every plan wave:** Run `node scripts/verify-phase57.mjs`
- **Before `/gsd:verify-work`:** Probe must exit 0 (all DB assertions pass) AND ACFR cross-check documented AND Chris UAT sign-off recorded in `57-VERIFICATION.md`
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 57-01-01 | 01 | 1 | OCB-01 | T-57-01 | Reads creds from `.env`; single-entity target; no key logged | manual review + dry-run | `node scripts/loadCountyBudget.js --county "Orange" --fy 2024 --dry-run` | ❌ W0 | ⬜ pending |
| 57-01-02 | 01 | 1 | OCB-01 | T-57-01 | Dry-run only — zero writes; confirms clean state | dry-run | `node scripts/loadCountyBudget.js --county "Orange" --fy 2024 --dry-run` | ❌ W0 | ⬜ pending |
| 57-01-03 | 01 | 1 | OCB-01 | T-57-01 | Canary single-year write to county entity only | DB assertion | `node scripts/verify-phase57.mjs` (once built) / inline probe | ❌ W0 | ⬜ pending |
| 57-01-04 | 01 | 1 | OCB-01 | T-57-01 | Idempotent chunked backfill; never-overwrite | DB assertion | inline probe / `verify-phase57.mjs` | ❌ W0 | ⬜ pending |
| 57-01-05 | 01 | 1 | OCB-01 | T-57-01 | Full-range read-only verify + ACFR spot | DB assertion + manual | `node scripts/verify-phase57.mjs` | ❌ W0 | ⬜ pending |
| 57-02-01 | 02 | 2 | OCB-02 | T-57-02 | Read-only render of already-sourced data | live-app UAT + API check | curl `/api/treasury/cities/{ocId}/budgets` | ❌ W0 | ⬜ pending |
| 57-02-02 | 02 | 2 | OCB-01/02 | — | Probe reads creds from `.env`, never logs secrets | probe | `node scripts/verify-phase57.mjs` | ❌ W0 | ⬜ pending |
| 57-02-03 | 02 | 2 | OCB-01/02 | — | Documentation + requirement traceability | doc assertion | `verify-phase57.mjs` (REQUIREMENTS [x] check) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. The probe script IS the Wave 0 automated harness; no separate test framework is installed.*

---

## Wave 0 Requirements

- [ ] `scripts/loadCountyBudget.js` — reusable county-government-budget loader (Plan 57-01, task 01). It is the load harness; its `--dry-run` is the pre-write validation.
- [ ] `scripts/verify-phase57.mjs` — DB-probe assertions for OCB-01/02 (county operating + revenue coverage, durable `source_url`+`source_date`, non-zero population, sampled exact-match total, 34-city rows untouched, REQUIREMENTS [x] traceability) (Plan 57-02, task 02).

*No JS/TS unit-test framework is installed for this phase — consistent with every prior data-load phase (53–56). The dry-run gate + DB probe provide the automated feedback loop.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ACFR cross-check (one FY, basis-matched, delta recorded) | OCB-01 | Requires human judgment to locate the correct OC ACFR all-governmental-funds total and assess definitional variance (D-02) | Fetch the OC published ACFR; pick one loaded FY; compare basis-to-basis to the DB total; record figure + source + delta + note in `57-VERIFICATION.md`. If SCO ≠ ACFR, SCO is authoritative; delta is a documented variance. |
| Live-app OC county page: icicle/summary + per-capita render, SourceChip present + links to durable SCO page, 34 cities still listed | OCB-02 | Human visual UAT at https://treasurytracker.empowered.vote; Chris's sign-off gate | Open the OC county page; confirm budget icicle/summary renders (not directory-only), per-capita shows $/resident, the SourceChip appears with source name + fetched date + working link, and CitiesInCountyPanel lists all 34 cities. Chris signs off. |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify (dry-run / DB probe) or are Wave 0 harness-builds or documented manual-only
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (each load task is gated by dry-run/probe)
- [ ] Wave 0 covers all MISSING references (`loadCountyBudget.js`, `verify-phase57.mjs`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
