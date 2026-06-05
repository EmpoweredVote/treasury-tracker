---
phase: 29
slug: long-beach-bakersfield-ca-data-load
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual dry-run validation (no automated test framework in project) |
| **Config file** | none |
| **Quick run command** | `node scripts/processLongBeach.js --dry-run` |
| **Full suite command** | `node scripts/processLongBeach.js --dry-run && node scripts/processBakersfield.js --dry-run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/processLongBeach.js --dry-run` or `node scripts/processBakersfield.js --dry-run` (whichever applies)
- **After every plan wave:** Both dry-runs green + DB row count verification
- **Before `/gsd-verify-work`:** Both cities visible in app with correct totals, per-capita, and enrichment
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | POPUL-01 | — | N/A | manual | check seeder output for population rows | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 1 | DATA-04 | — | PDF paths from controlled docs/ only | smoke | `node scripts/processLongBeach.js --dry-run` | ❌ W0 | ⬜ pending |
| 29-02-02 | 02 | 1 | DATA-04 | — | PDF paths from controlled docs/ only | smoke | `node scripts/processLongBeach.js --dry-run --revenue` | ❌ W0 | ⬜ pending |
| 29-03-01 | 03 | 2 | DATA-07 | — | PDF paths from controlled docs/ only | smoke | `node scripts/processBakersfield.js --dry-run` | ❌ W0 | ⬜ pending |
| 29-03-02 | 03 | 2 | DATA-07 | — | PDF paths from controlled docs/ only | smoke | `node scripts/processBakersfield.js --dry-run --revenue` | ❌ W0 | ⬜ pending |
| 29-04-01 | 04 | 3 | ENRICH-01 | — | Cost gate: stop if estimate exceeds $0.10 | manual | `node scripts/enrichCategories.js --city "Long Beach" --state CA --year 2025 --dry-run` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/seedLongBeachBakersfieldCA.js` — Plan 1 creates this
- [ ] `scripts/extractLongBeach.py` — Plan 2 creates this
- [ ] `scripts/processLongBeach.js` — Plan 2 creates this
- [ ] `scripts/extractBakersfield.py` — Plan 3 creates this
- [ ] `scripts/processBakersfield.js` — Plan 3 creates this
- [ ] `docs/Long Beach/` directory + FY22–FY26 fund summary PDFs — Plan 2 downloads these
- [ ] `docs/Bakersfield/` directory + FY2024-25/FY2025-26 adopted budget PDFs — Plan 3 downloads these

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Long Beach operating total ~$1.5B GF | DATA-04 | No automated assertion framework; visual DB check | Run processor live, query `treasury.budget_entries` grouped by city+year, confirm GF total |
| Bakersfield operating total ~$765M | DATA-07 | Same as above | Run processor live, query DB totals |
| Enrichment cost < $0.10 combined | ENRICH-01 | API cost tracking is manual | Review token estimate before running; abort if approaching threshold |
| Both cities visible in EntitySwitcher | DATA-04, DATA-07 | UI visual check | Open app, confirm Long Beach + Bakersfield appear under California |
| Per-capita display correct | POPUL-01 | UI visual check | Verify ~$3,327/capita for LB (1.5B/451K) and ~$1,835/capita for BF (765M/417K) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
