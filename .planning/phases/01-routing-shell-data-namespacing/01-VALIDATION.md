---
phase: 1
slug: routing-shell-data-namespacing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | ROUTE-01 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | ROUTE-01 | e2e-manual | manual browser check | ✅ | ⬜ pending |
| 1-01-03 | 01 | 1 | ROUTE-02 | e2e-manual | manual browser check | ✅ | ⬜ pending |
| 1-01-04 | 01 | 1 | ROUTE-03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | ROUTE-04 | e2e-manual | manual browser check | ✅ | ⬜ pending |
| 1-02-01 | 02 | 1 | DATA-01 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | DATA-02 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | DATA-03 | e2e-manual | manual browser check | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest configuration
- [ ] `src/tests/routing.test.tsx` — stubs for ROUTE-01, ROUTE-03
- [ ] `src/tests/dataPath.test.ts` — stubs for DATA-01, DATA-02
- [ ] `npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom` — install test dependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/bloomington` displays full v1.0 behavior | ROUTE-02 | Requires visual inspection of charts/drill-down/tabs | Navigate to `/bloomington`, verify all charts render, drill-down works, tabs switch |
| Back button returns to `/` | ROUTE-04 | Browser navigation state | Navigate to `/bloomington`, click back, verify lands on `/` |
| Error message shown on missing data | DATA-03 | Requires UI visibility check | Delete or rename a JSON file, load app, verify visible error message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
