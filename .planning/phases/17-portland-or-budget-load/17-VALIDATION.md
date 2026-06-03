---
phase: 17
slug: portland-or-budget-load
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node scripts (manual verification) |
| **Config file** | none — data loader scripts are run directly |
| **Quick run command** | `node scripts/seedPortlandOregon.js --dry-run` |
| **Full suite command** | `node scripts/seedPortlandOregon.js && node scripts/bulkLoadPDF.js --city Portland --state OR` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run row-count SQL to verify expected records exist
- **After every plan wave:** Run full loader + verify category count in DB
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| seed-01 | 01 | 1 | D-05 | — | N/A | manual | `node scripts/seedPortlandOregon.js` | ✅ created | ⬜ pending |
| load-01 | 01 | 2 | D-01/D-02 | — | N/A | manual | `node scripts/loadPortlandBudget.js` | ✅ created | ⬜ pending |
| enrich-01 | 01 | 3 | D-06 | — | N/A | manual | `node scripts/enrichCategories.js --city Portland --state OR` | ✅ exists | ⬜ pending |
| pop-01 | 01 | 3 | D-05 | — | N/A | manual | `node scripts/loadPortlandPopulation.js` | ✅ created | ⬜ pending |
| ui-01 | 01 | 4 | D-07 | — | N/A | manual | visual check in browser | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/loadPortlandBudget.js` — PDF extractor + loader for Portland operating budget
- [ ] `scripts/seedPortlandOregon.js` — municipality + data_source seeder
- [ ] `scripts/loadPortlandPopulation.js` — Census subcounty population loader (adapted from loadTXPopulation.js)

*Wave 0 creates the loader scripts before the data load tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Portland appears in EntitySwitcher | D-07 | UI visual check | Start app, open city picker, verify Oregon → Portland is selectable |
| Budget categories display with enriched descriptions | D-06 | Requires browser session | Open Portland city view, verify AI-enriched descriptions render |
| Per-capita amounts correct | D-05 | Math verification | Check Portland total budget / 635,749 population matches display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
