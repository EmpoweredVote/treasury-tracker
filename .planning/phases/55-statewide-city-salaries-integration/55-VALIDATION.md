---
phase: 55
slug: statewide-city-salaries-integration
status: validated
nyquist_compliant: partial
wave_0_complete: true
created: 2026-06-15
---

# Phase 55 — Validation Strategy

> Per-phase validation contract. Phase 55 is a data-load phase: the automatable
> surface is the pure transformation logic in the reusable loader; the spike
> recon (SAL-01) and the production data load + live-app render (SAL-03) are
> inherently manual/integration verifications.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) + `node:assert/strict` |
| **Config file** | none — `.test.mjs` files run directly via `node --test` |
| **Quick run command** | `node --test scripts/loadCASalaries.test.mjs` |
| **Full suite command** | `node --test scripts/*.test.mjs` |
| **Estimated runtime** | ~0.2 seconds |

---

## Sampling Rate

- **After every task commit:** `node --test scripts/loadCASalaries.test.mjs`
- **Before `/gsd:verify-work`:** suite must be green
- **Max feedback latency:** ~1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-02 (normalizeDeptLabel) | 02 | 2 | SAL-02 | — (gap-closure) | Approved tokens expand ("Pw Sust"→"Public Works Sustainability", "Hum Res"→"Human Resources", "City Cnl"→"City Council", "Admin Services"→"Administrative Services", "Pw Trsp"→"Public Works Transportation") | unit | `node --test scripts/loadCASalaries.test.mjs` | ✅ | ✅ green |
| 55-02 (normalizeDeptLabel) | 02 | 2 | SAL-02 | T-55-02 / D-01 | Ambiguous codes left as-reported, never fabricated ("Com Eng", "Pd Sustainability", "Citycnl2") | unit | `node --test scripts/loadCASalaries.test.mjs` | ✅ | ✅ green |
| 55-02 (normalizeDeptLabel) | 02 | 2 | SAL-02 | — | Acronyms/roman numerals preserved ("IT"→"IT", "II"→"II", "IV"→"IV"); empty→"UNKNOWN" | unit | `node --test scripts/loadCASalaries.test.mjs` | ✅ | ✅ green |
| 55-02 (parseMoney) | 02 | 2 | SAL-02 | T-55-02-04 (WR-01) | Thousands separators / `$` stripped, not truncated ("1,234.56"→1234.56, "$1,000"→1000); empty/null/non-numeric→0 | unit | `node --test scripts/loadCASalaries.test.mjs` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — 25 assertions, 0 failures.*

---

## Wave 0 Requirements

Existing infrastructure (`node --test`) covers the automatable phase requirements. No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GCC source reachable + schema/sample reconcile (spike GATE) | SAL-01 | One-time external HTTP recon against gcc.sco.ca.gov; no persistent behavior to unit-test | Re-run the spike checks in `55-SPIKE-FINDINGS.md` §1–3: static ZIP HTTP 200 with browser UA; field mapping; Irvine 2024 computed total = published figure ($0 delta) |
| 34 OC cities loaded 2009–2024 (544 salaries rows); additive (operating/revenue untouched) | SAL-03 | Production-DB integration; requires service key + live DB state | DB probe schema `treasury`: salaries rows for OC `county_id` cities across fiscal years; confirm Anaheim/Santa Ana custom operating/revenue rows unchanged (see `55-COVERAGE.md`) |
| Salaries tab renders names-free Dept→Position tree with wages/benefits split + 2009–2024 selector | SAL-03 / D-01 / D-03 | Live frontend rendering; browser-only | Open a covered OC city at https://treasurytracker.empowered.vote → Employees tab → drill a department/position; confirm no individual names, wages/benefits split, year range. Operator approved 2026-06-15 (see `55-VERIFICATION.md`). |
| Loaded total reconciles with published source (SC-4) | SAL-03 | Compares stored DB total to the external published figure | Probe stored Irvine 2024 salaries total ($190,426,283) vs the gcc.sco.ca.gov Cities entity page for the same city/year |

---

## Validation Sign-Off

- [x] Automatable behaviors (`normalizeDeptLabel`, `parseMoney`) have automated `node --test` coverage
- [x] Sampling continuity: the regression-prone transformation logic is covered
- [x] Wave 0 covers all MISSING references (none — `node:test` is built in)
- [x] No watch-mode flags
- [x] Feedback latency < 1s
- [~] `nyquist_compliant: partial` — SAL-01 (one-time spike) and SAL-03 (prod load + live app) are manual/integration by nature; documented above with reproducible instructions

**Approval:** approved 2026-06-15
