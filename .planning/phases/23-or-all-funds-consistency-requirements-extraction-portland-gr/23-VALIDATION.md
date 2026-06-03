---
phase: 23
slug: or-all-funds-consistency-requirements-extraction-portland-gr
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (Python extractors) + vitest (frontend) |
| **Config file** | pytest.ini / vitest.config.ts |
| **Quick run command** | `node scripts/processGresham.js --mode requirements --dry-run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick dry-run validation for that city's loader
- **After every plan wave:** Run `npx vitest run` (frontend type checks + component tests)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-T1 | 01 | 1 | D-06 | — | N/A | syntax | `python -c "import ast; ast.parse(open('scripts/extractGresham.py').read())"` | ✅ | ⬜ pending |
| 23-01-T2 | 01 | 1 | D-01/D-06 | — | N/A | dry-run | `node scripts/processGresham.js --requirements --dry-run` | ✅ | ⬜ pending |
| 23-02-T1 | 02 | 1 | D-07/D-06 | — | N/A | syntax | `python -c "import ast; ast.parse(open('scripts/extractPortland.py').read())"` | ✅ | ⬜ pending |
| 23-02-T2 | 02 | 1 | D-07/D-06 | — | N/A | dry-run | `node scripts/processPortland.js --requirements --dry-run` | ✅ | ⬜ pending |
| 23-03-T1 | 03 | 1 | D-05/D-06 | — | N/A | syntax | `python -c "import ast; ast.parse(open('scripts/extractTroutdale.py').read())"` | ✅ | ⬜ pending |
| 23-03-T2 | 03 | 1 | D-05/D-06 | — | N/A | dry-run | `node scripts/processTroutdale.js --requirements --dry-run` | ✅ | ⬜ pending |
| 23-04-T1 | 04 | 2 | D-04/D-02 | — | N/A | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 23-04-T2 | 04 | 2 | D-02/D-03/D-04 | — | N/A | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new test framework installation needed — pytest and vitest are both already in the project. Extractor verification is done via dry-run output inspection; loader verification via DB row counts post-load.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Portland FY2026 two-page accumulation correct | D-07/D-06 | Requires PDF visual inspection | Open Portland Vol 1 FY2026, verify extracted total matches page 117 continuation sum |
| Gap-explanation label renders correctly | D-03 | Visual UI component | Load Gresham FY2024 in browser; verify Budget tab shows ~$512M headline + departmental gap label |
| All Funds total not shown as selectable dataset tab | D-04 | Visual UI regression | Verify DatasetTabs shows only operating/revenue tabs; no "All Funds Requirements" card appears |
| Fallback for non-OR cities unchanged | D-04 | Visual UI regression | Load Dallas or LA city; Budget tab should show departmental total with no gap label |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — all scripts pre-exist)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-06-01
