---
phase: 2
slug: city-config-dynamic-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | CITY-01 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | CITY-01 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | CITY-02 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | CITY-03 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | CITY-01 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/config/__tests__/cityConfig.test.ts` — stubs for CITY-01 schema validation
- [ ] `src/config/__tests__/cityRegistry.test.ts` — stubs for CITY-01 registry structure
- [ ] `src/components/__tests__/DatasetTabs.test.tsx` — stubs for CITY-02 tab filtering

*Existing vitest infrastructure covers the framework; only test files need to be added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero title/image updates when config changes | CITY-01 | Requires visual browser verification | Change `bloomington` config name → reload `/bloomington` → confirm title changed |
| City picker renders Bloomington + LA placeholder | CITY-01 | DOM rendering with real data | Load `/` → confirm 2 cards: Bloomington (active) + LA (coming soon) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
