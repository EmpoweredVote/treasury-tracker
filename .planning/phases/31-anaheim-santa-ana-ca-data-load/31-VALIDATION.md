---
phase: 31
slug: anaheim-santa-ana-ca-data-load
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None formal — manual dry-run verification + sanity band checks |
| **Config file** | n/a |
| **Quick run command** | `node scripts/processAnaheim.js --dry-run` |
| **Full suite command** | `node scripts/processAnaheim.js --dry-run && node scripts/processSantaAna.js --dry-run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/processAnaheim.js --dry-run` (or `processSantaAna.js --dry-run`)
- **After every plan wave:** Both dry-runs passing + DB spot-check via `treasury_list_source_ids` RPC
- **Before `/gsd-verify-work`:** All 6 success criteria verified in app (city picker, totals, revenue tabs, per-capita, enrichment)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Automated Command | File Exists | Status |
|---------|------|------|-------------|-------------------|-------------|--------|
| Seed Anaheim + Santa Ana | 01 | 1 | POPUL-02 | `node scripts/seedAnaheimSantaAnaCA.js --dry-run` | ❌ Wave 0 | ⬜ pending |
| Extract + process Anaheim | 02 | 2 | DATA-08 | `node scripts/processAnaheim.js --dry-run` | ❌ Wave 0 | ⬜ pending |
| Extract + process Santa Ana | 03 | 3 | DATA-09 | `node scripts/processSantaAna.js --dry-run` | ❌ Wave 0 | ⬜ pending |
| Enrichment + verification | 04 | 4 | ENRICH-02 | `node scripts/enrichCategories.js --city Anaheim --state CA --year 2025 --dry-run` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/seedAnaheimSantaAnaCA.js` — Plan 1; covers POPUL-02
- [ ] `scripts/extractAnaheim.py` — Plan 2; covers DATA-08
- [ ] `scripts/processAnaheim.js` — Plan 2; covers DATA-08
- [ ] `scripts/extractSantaAna.py` — Plan 3; covers DATA-09
- [ ] `scripts/processSantaAna.js` — Plan 3; covers DATA-09

*Existing infrastructure: `enrichCategories.js`, `bulkLoadBudget.js`, `supabase` client — all present and usable.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Anaheim" and "Santa Ana" in city picker | DATA-08, DATA-09 | UI spot-check | Open treasurytracker.empowered.vote → state filter "California" → verify both cities appear |
| Anaheim General Fund total ~$380–550M | DATA-08 | Visual check | App → Anaheim → Operating Budget → verify total in expected range |
| Santa Ana General Fund total ~$350–450M | DATA-09 | Visual check | App → Santa Ana → Operating Budget → verify total in expected range |
| Revenue / Money In tabs populated | DATA-08, DATA-09 | UI spot-check | App → each city → Revenue tab → verify at least 1 FY visible |
| Per-capita correct for Anaheim (~344K) | POPUL-02 | Visual check | App → Anaheim → verify per-capita calculation shown |
| Per-capita correct for Santa Ana (~312K) | POPUL-02 | Visual check | App → Santa Ana → verify per-capita calculation shown |
| Enrichment descriptions visible | ENRICH-02 | Visual check | App → each city → hover/click top categories → verify descriptions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
