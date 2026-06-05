---
phase: 28
slug: oakland-san-jose-ca-data-load
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual dry-run testing (no automated test framework in project) |
| **Config file** | none |
| **Quick run command** | `node scripts/processOakland.js --dry-run` |
| **Full suite command** | `node scripts/processOakland.js --dry-run && node scripts/processSanJose.js --dry-run` |
| **Estimated runtime** | ~30 seconds per city |

---

## Sampling Rate

- **After every task commit:** Run dry-run for the relevant script being modified
- **After every plan wave:** Run full suite (`processOakland.js --dry-run && processSanJose.js --dry-run`)
- **Before `/gsd-verify-work`:** Full suite must be green + app spot-check at treasurytracker.empowered.vote
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 1 | POPUL-01 | — | N/A | smoke | `node scripts/seedOaklandSanJoseCA.js` (idempotent, check output) | ❌ Wave 0 | ⬜ pending |
| 28-01-02 | 01 | 1 | DATA-02/03 | — | data_source rows named correctly | smoke | `node scripts/seedOaklandSanJoseCA.js` (verify data_source names) | ❌ Wave 0 | ⬜ pending |
| 28-02-01 | 02 | 2 | DATA-02 | T-28-01 | PDF path from controlled docs/Oakland/ only | smoke (dry-run) | `node scripts/processOakland.js --dry-run` | ❌ Wave 0 | ⬜ pending |
| 28-02-02 | 02 | 2 | DATA-02 | T-28-04 | maxBuffer: 8MB prevents OOM | smoke (dry-run) | `node scripts/processOakland.js --dry-run` | ❌ Wave 0 | ⬜ pending |
| 28-03-01 | 03 | 3 | DATA-03 | T-28-01 | PDF path from controlled docs/SanJose/ only | smoke (dry-run) | `node scripts/processSanJose.js --dry-run` | ❌ Wave 0 | ⬜ pending |
| 28-04-01 | 04 | 4 | ENRICH-01 | T-28-02 | $0.10 gate: estimate before running | smoke (dry-run) | `node scripts/enrichCategories.js --city Oakland --state CA --year 2024 --dry-run` | ✅ exists | ⬜ pending |
| 28-04-02 | 04 | 4 | ENRICH-01 | T-28-02 | $0.10 gate: estimate before running | smoke (dry-run) | `node scripts/enrichCategories.js --city "San Jose" --state CA --year 2025 --dry-run` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/seedOaklandSanJoseCA.js` — covers POPUL-01 and DATA-02/03 seeder prerequisites
- [ ] `scripts/extractOakland.py` — covers DATA-02 PDF extraction
- [ ] `scripts/processOakland.js` — covers DATA-02 DB load (with `--dry-run` flag)
- [ ] `scripts/extractSanJose.py` — covers DATA-03 PDF extraction
- [ ] `scripts/processSanJose.js` — covers DATA-03 DB load (with `--dry-run` flag)
- [ ] `docs/Oakland/` directory — required by processOakland.js (create with `mkdir docs/Oakland`)
- [ ] `docs/SanJose/` directory — required by processSanJose.js (create with `mkdir docs/SanJose`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Oakland + San Jose appear in city picker under "California" | DATA-02, DATA-03 | Requires live app in browser | Visit treasurytracker.empowered.vote → EntitySwitcher → verify both cities show under "California" |
| Oakland operating totals ~$800M–$850M GPF per year | DATA-02 | Requires loaded DB + UI | Navigate to Oakland → Operating Budget → verify total per fiscal year |
| San Jose General Fund total ~$1.7–1.9B | DATA-03 | Requires loaded DB + UI | Navigate to San Jose → Operating Budget → verify total |
| Per-capita display for Oakland (~$1,800/capita) and San Jose (~$1,700–1,900/capita) | POPUL-01 | Requires loaded DB + UI | Navigate to each city → verify per-capita value shown |
| Enrichment descriptions visible for top categories | ENRICH-01 | Requires loaded DB + UI | Click top category nodes in Oakland + San Jose → verify description text present |
| Revenue / Money In tabs populated for both cities | DATA-02, DATA-03 | Requires loaded DB + UI | Navigate to each city → Revenue tab → verify at least one fiscal year has data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
