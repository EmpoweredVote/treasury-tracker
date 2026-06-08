---
phase: 35
slug: ca-state-3-level-icicle-pilot
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — data loading phase; dry-run + SQL DB verification |
| **Config file** | none |
| **Quick run command** | `node scripts/processCA.js --dry-run --fy 2026` |
| **Full suite command** | `node scripts/processCA.js --dry-run` (all 5 FYs) |
| **Estimated runtime** | ~30 seconds (dry-run per FY) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/processCA.js --dry-run --fy 2026`
- **After every plan wave:** Full dry-run all 5 FYs + DB depth distribution query
- **Before `/gsd-verify-work`:** DB must show depth-2 rows + human spot-check of live app
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 0 | ICICLE-01 | — | N/A | discovery | `python scripts/extractCA.py --fy 2026 --dry-run` — inspect function column values | ✅ | ⬜ pending |
| 35-01-02 | 01 | 0 | ICICLE-01 | T-35-01 | mixed-node RPC must not silently drop rows | smoke | targeted RPC call with 1-dept mixed-node tree (c+i on same node) | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 1 | ICICLE-01 | T-35-02 | SUPABASE_URL missing → process.exit(2), no fallback | smoke | `node scripts/processCA.js --dry-run --fy 2026` exits 0, shows 3-level tree structure | ✅ | ⬜ pending |
| 35-02-02 | 02 | 1 | ICICLE-01 | — | N/A | db-verify | `SELECT depth, count(*) FROM treasury.budget_categories bc JOIN treasury.budgets b ON b.id=bc.budget_id JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.name='California' AND b.fiscal_year=2026 GROUP BY depth ORDER BY depth` — must show depth 0, 1, AND 2 rows | ❌ W0 SQL | ⬜ pending |
| 35-03-01 | 03 | 2 | ICICLE-01 | — | N/A | db-verify | same depth distribution query — depth-2 count > 0 for all 5 FYs | ❌ W0 SQL | ⬜ pending |
| 35-04-01 | 04 | 3 | ICICLE-01,ICICLE-02,ICICLE-03 | — | N/A | manual | Human spot-check at treasurytracker.empowered.vote/California — verify 3 drill levels, LineItemsTable at level 3 | ❌ Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Discovery: `python scripts/extractCA.py --fy 2026 --dry-run` — count distinct function values to validate Assumption A1
- [ ] Mixed-node RPC test: verify `treasury_sync_budget_tree` accepts `{ n, a, c: [...], i: [...] }` on same node (resolves Assumption A2)
- [ ] `scripts/extractCA.py` modified — `function` field added to `rows_out`
- [ ] `scripts/processCA.js` modified — `buildCATree()` replaced + SUPABASE_URL fallback removed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CA icicle renders 3 clickable drill-down levels | ICICLE-02 | Browser interaction required | Go to treasurytracker.empowered.vote/California; click Level 1 → Level 2 → Level 3; confirm all 3 levels are navigable |
| Drilling to Level 3 shows LineItemsTable | ICICLE-03 | Browser interaction required | At Level 3 node, confirm LineItemsTable renders with leaf-level items (not empty) |
| Drill-down animation looks correct at all 3 levels | (success criteria) | Visual verification | Check for layout breakage, text truncation, or animation glitches at each level |
| CA state page shows correct totals, year, per-capita, enrichment | (success criteria) | End-to-end visual | Verify summary figures match expectations; check enrichment descriptions appear at depth-2 nodes after enrichment step |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
