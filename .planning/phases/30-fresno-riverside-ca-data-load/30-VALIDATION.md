---
phase: 30
slug: fresno-riverside-ca-data-load
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None formal — dry-run smoke checks + manual DB spot-checks |
| **Config file** | n/a |
| **Quick run command** | `node scripts/processFresno.js --dry-run` |
| **Full suite command** | `node scripts/processFresno.js --dry-run && node scripts/processRiverside.js --dry-run` |
| **Estimated runtime** | ~10–20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/processFresno.js --dry-run` (or `processRiverside.js --dry-run` for Riverside tasks)
- **After every plan wave:** Both dry-runs passing; DB spot-check via `treasury_list_source_ids` RPC
- **Before `/gsd-verify-work`:** All 6 success criteria verified
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | POPUL-01 | — | N/A | smoke | `node scripts/seedFresnoRiversideCA.js --dry-run` | ❌ W0 | ⬜ pending |
| 30-02-01 | 02 | 2 | DATA-05 | T-30-01 | PDF path from controlled readdir, double-quoted in execSync | smoke | `node scripts/processFresno.js --dry-run` | ❌ W0 | ⬜ pending |
| 30-02-02 | 02 | 2 | DATA-05 | — | N/A | smoke | `node scripts/processFresno.js --dry-run --revenue` | ❌ W0 | ⬜ pending |
| 30-03-01 | 03 | 3 | DATA-06 | T-30-01 | PDF path from controlled readdir, double-quoted in execSync | smoke | `node scripts/processRiverside.js --dry-run` | ❌ W0 | ⬜ pending |
| 30-03-02 | 03 | 3 | DATA-06 | — | N/A | smoke | `node scripts/processRiverside.js --dry-run --revenue` | ❌ W0 | ⬜ pending |
| 30-04-01 | 04 | 4 | ENRICH-01 | T-30-02 | $0.10 combined cost gate enforced before live run | smoke | `node scripts/enrichCategories.js --city Fresno --state CA --year 2025 --dry-run` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/extractFresno.py` — covers DATA-05; created in Plan 2
- [ ] `scripts/processFresno.js` — covers DATA-05; created in Plan 2
- [ ] `scripts/extractRiverside.py` — covers DATA-06; created in Plan 3
- [ ] `scripts/processRiverside.js` — covers DATA-06; created in Plan 3
- [ ] `scripts/seedFresnoRiversideCA.js` — covers POPUL-01; created in Plan 1
- [ ] `docs/Fresno/` directory + adopted budget PDFs — must exist before Plan 2 runs
- [ ] `docs/Riverside/` directory + adopted budget PDFs — must exist before Plan 3 runs

*Existing infrastructure covers enrichment (enrichCategories.js) and all Supabase RPC calls.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresno appears in city picker under California | DATA-05 | UI visual check | Open app → city picker → verify "Fresno" listed under California |
| Riverside appears in city picker under California | DATA-06 | UI visual check | Open app → city picker → verify "Riverside" listed under California |
| Fresno total ~$483M (GF only) | DATA-05 | DB value check | Open Fresno budget view; verify operating total ≈ $483M; verify enterprise funds absent |
| Riverside total ~$1.45B/yr, 2+ FYs | DATA-06 | DB value check | Open Riverside budget view; verify 2+ FYs; total ≈ $1.45B per FY; RPU absent |
| Per-capita correct for both cities | POPUL-01 | UI visual check | Open each city → verify per-capita column uses ~550K (Fresno) / ~324K (Riverside) |
| Population values in DB | POPUL-01 | DB spot-check | Query `treasury.municipalities` for population = 550000/324000, population_year = 2024 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
