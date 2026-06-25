---
phase: 82
slug: enrichment-parity
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-23
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in; matches `scripts/loadUtahEnrichment72.test.mjs`) |
| **Config file** | none — node:test needs no config |
| **Quick run command** | `node --test scripts/loadVAEnrichment82.test.mjs` |
| **Full suite command** | `node --check data/vaEnrichment82.mjs && node --check scripts/loadVAEnrichment82.mjs && node --test scripts/loadVAEnrichment82.test.mjs` |
| **Estimated runtime** | ~3 seconds (offline; no DB) |

---

## Sampling Rate

- **After every task commit:** Run `node --test scripts/loadVAEnrichment82.test.mjs`
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite green + Task 3 dry-run reports 100% coverage, `$`-leak=0, locality-leak=0
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 82-01-01 | 01 | 1 | VAENR-01 | T-82-01 | All map text concept-level — no locality name / no `$` | unit | `node --test scripts/loadVAEnrichment82.test.mjs` | ❌ W0 | ⬜ pending |
| 82-01-02 | 01 | 1 | VAENR-01 | T-82-05 | Loader writes only `municipality_id IS NULL`; coverage assert ABORTS on unmapped key | unit | `node --test scripts/loadVAEnrichment82.test.mjs` | ❌ W0 | ⬜ pending |
| 82-01-03 | 01 | 1 | VAENR-01 | T-82-04 | Dry-run: 0 writes, 100% coverage, `$`-leak=0, locality-leak=0 | integration (read-only) | `node scripts/loadVAEnrichment82.mjs` | ❌ W0 | ⬜ pending |
| 82-01-04 | 01 | 1 | VAENR-01 | T-82-02 | `--apply` idempotent; live render; CA+MA no-regression | manual | live-app spot-check | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/loadVAEnrichment82.test.mjs` — offline tests for VAENR-01 (created in Task 1/2 of the plan)
- [ ] No framework install needed — node:test is built in

*Tests are authored inside the plan's Task 1–2, not a separate Wave 0 — the loader exports its resolver/map so tests import without DB access.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Enrichment renders in-app for a VA city, county, and town (SC#3) | VAENR-01 | Requires the deployed API + live app render | Open a VA city, county, and town at treasurytracker.empowered.vote; confirm functions + drill-down activities show plain-language names/descriptions |
| No cross-entity / cross-state regression (D-82-03) | VAENR-01 | Visual judgement across states | Open one CA city + one MA town; confirm shared keys (public safety, education, miscellaneous…) read sensibly; `miscellaneous` now reads as revenue, not "Information Technology" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are explicitly manual (Task 4 checkpoint)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covered by in-plan test authoring
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-23
