---
phase: 56
slug: orange-county-verification-uat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node ESM probe script (`verify-phase56.mjs`), mirroring `verify-phase34.mjs` — no test runner |
| **Config file** | none — script reads repo `.env` (SUPABASE_URL + SUPABASE_SERVICE_KEY/SERVICE_ROLE_KEY), schema `treasury` |
| **Quick run command** | `node scripts/verify-phase56.mjs` |
| **Full suite command** | `node scripts/verify-phase56.mjs` |
| **Estimated runtime** | ~5–15 seconds (DB round-trips) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/verify-phase56.mjs`
- **After every plan wave:** Run `node scripts/verify-phase56.mjs`
- **Before `/gsd:verify-work`:** Probe script must exit 0 (all DB assertions pass)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-01-XX | 01 | 0 | VER-01 | — | Reads creds from `.env`, never logs secrets | probe | `node scripts/verify-phase56.mjs` | ❌ W0 | ⬜ pending |

*Filled by planner. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-phase56.mjs` — DB-probe assertions for VER-01 (county_id coverage, budget-row coverage FY2003–2024, source attribution, custom-row preservation for Anaheim/Santa Ana, known exact-match totals, salaries coverage)

*The probe script IS the Wave 0 automated harness; no separate test framework is installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ACFR spot-check reconciliation (~6–8 cities, basis-matched, within ~1–2% + definitional notes) | VER-01 | Requires human judgment to locate the correct published ACFR all-funds table and assess definitional variance (D-01/D-04) | Per sampled city: fetch published ACFR/adopted budget, compare basis-to-basis to DB figure, record figure + source + delta + note in 56-VERIFICATION.md |
| Live-app OC navigation + data surfaces (D-03: breadcrumb chain, CitiesInCountyPanel lists all 34, salaries tab, per-capita, Anaheim/Santa Ana render) | VER-02 | Human visual UAT at https://treasurytracker.empowered.vote; Chris's sign-off gate | Walk the D-03 5-item checklist live; Chris signs off |

---

## Validation Sign-Off

- [ ] All automatable behaviors covered by `verify-phase56.mjs` (VER-01 DB assertions)
- [ ] Manual-only behaviors (ACFR reconciliation judgment, live UAT) documented above with instructions
- [ ] Wave 0 probe script covers all automatable references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
