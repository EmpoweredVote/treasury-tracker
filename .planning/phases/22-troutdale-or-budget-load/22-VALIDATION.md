---
phase: 22
slug: troutdale-or-budget-load
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — data pipeline phase; validation via dry-run + DB queries |
| **Config file** | none |
| **Quick run command** | `node scripts/processTroutdale.js --dry-run` |
| **Full suite command** | `node scripts/processTroutdale.js --dry-run && node scripts/processTroutdale.js --revenue --dry-run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/processTroutdale.js --dry-run`
- **After every plan wave:** Run full dry-run suite (operating + revenue)
- **Before `/gsd-verify-work`:** Full dry-run must be green + DB verification queries must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | seeder | — | municipality_id not null; data_source rows created | manual | `node scripts/seedTroutdaleOregon.js --dry-run` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | extractor | — | fiscal years parsed; 17 dept rows per year | dry-run | `python scripts/extractTroutdale.py --dry-run` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | loader | — | operating totals match expected ($17–21M per year) | dry-run | `node scripts/processTroutdale.js --dry-run` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | revenue extractor | — | 10 resource category rows per year | dry-run | `python scripts/extractTroutdale.py --mode revenue --dry-run` | ❌ W0 | ⬜ pending |
| 22-02-02 | 02 | 2 | revenue loader | — | revenue totals match expected ($28–34M per year) | dry-run | `node scripts/processTroutdale.js --revenue --dry-run` | ❌ W0 | ⬜ pending |
| 22-03-01 | 03 | 3 | population | — | Troutdale FIPS 41-74850, pop 15,749 loaded | db-query | `node scripts/loadORPopulation.js` | ✅ | ⬜ pending |
| 22-04-01 | 04 | 3 | enrichment | — | enriched descriptions saved for Troutdale dept rows | db-query | `node scripts/enrichCategories.js --city Troutdale --state OR --dry-run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docs/Troutdale/` — all 8 fiscal year PDFs downloaded and confirmed accessible
- [ ] `scripts/extractTroutdale.py` — extractor stub (copy from extractGresham.py)
- [ ] `scripts/processTroutdale.js` — loader stub (copy from processGresham.js)
- [ ] `scripts/seedTroutdaleOregon.js` — seeder stub (copy from seedGreshamOregon.js)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Troutdale appears in OR state tile in app | UI display | Browser-only | Open app → click Oregon → confirm Troutdale tile visible |
| Budget tab shows 17 dept rows, ~$21M FY2026 | Data accuracy | Browser-only | Select Troutdale, OR → Budget → verify row count and FY2026 total |
| Money In tab shows 10 categories, ~$33.7M FY2026 | Revenue display | Browser-only | Select Troutdale, OR → Money In → verify row count and FY2026 total |
| Per-capita figures appear correctly | Population data | Browser-only | Select Troutdale, OR → confirm per-capita column visible (pop 15,749) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
