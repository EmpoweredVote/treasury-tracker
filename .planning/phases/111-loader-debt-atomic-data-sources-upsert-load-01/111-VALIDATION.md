---
phase: 111
slug: loader-debt-atomic-data-sources-upsert-load-01
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-02
---

# Phase 111 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — standalone Node loader scripts (no jest/vitest harness applies) |
| **Config file** | none — Wave 0 not required |
| **Quick run command** | `for f in scripts/process*Acfr.js scripts/loadStateGF.mjs; do node --check "$f" || exit 1; done` |
| **Full suite command** | `node scripts/verify-phase110-cohort-audit.mjs` (read-only residue/invariant oracle, exit 0/2) |
| **Estimated runtime** | quick ~10s · full ~60s |

---

## Sampling Rate

- **After every task commit:** Run the quick command (syntax across all 35 modified files)
- **After every plan wave:** Run the full audit script
- **Before `/gsd:verify-work`:** Full audit must exit 0 with no manual data_sources cleanup performed
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 111-01-01 | 01 | 1 | LOAD-01 | T-111-01 | delete scoped to exact dataset_id / ds.id only; budgets never written outside RPC | static + smoke | quick command + `node scripts/processNJAcfr.js --dry-run` + `grep -L "maybeSingle" scripts/process*Acfr.js` | ✅ | ⬜ pending |
| 111-01-02 | 01 | 1 | LOAD-01 | T-111-02 | live re-run produces 0 net budgets change; 0 residue with no manual re-clean | live idempotency + oracle | `node scripts/verify-phase110-cohort-audit.mjs` before AND after `node scripts/processNJAcfr.js --fy 2025` + `node scripts/processNJRevenueAcfr.js --fy 2025` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (the residue oracle `verify-phase110-cohort-audit.mjs` already exists and is the criterion-2 measuring stick — it must NOT be modified this phase).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | — | Everything is CLI-verifiable |
