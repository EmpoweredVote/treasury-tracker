---
phase: 35
slug: ca-state-3-level-icicle-pilot
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-08
audited: 2026-06-08
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
| 35-01-01 | 01 | 0 | ICICLE-01 | — | N/A | discovery | `python -c "import ast; src=open('scripts/extractCA.py').read(); assert \"row[COLS['function']]\" in src; ast.parse(src); print('PASS')"` | ✅ | ✅ green |
| 35-01-02 | 01 | 0 | ICICLE-01 | T-35-01 | mixed-node RPC must not silently drop rows | smoke | `node -e "const fs=require('fs');const t=fs.readFileSync('.planning/phases/35-ca-state-3-level-icicle-pilot/35-DISCOVERY.md','utf8');if(!/A2 VERDICT: (ACCEPTED\|REJECTED)/.test(t))process.exit(1);if(!/## D-05 Strategy Decision/.test(t))process.exit(1);console.log('PASS')"` | ✅ | ✅ green |
| 35-02-01 | 02 | 1 | ICICLE-01 | T-35-02 | SUPABASE_URL missing → process.exit(2), no fallback | smoke | `node -e "const s=require('fs').readFileSync('scripts/processCA.js','utf8'); if(s.includes('kxsdzaojfaibhuzmclfq'))process.exit(1); if(!/function buildNLevelTree\(/.test(s))process.exit(1); if(/buildCATree\(/.test(s))process.exit(1); console.log('PASS')"` | ✅ | ✅ green |
| 35-02-02 | 02 | 1 | ICICLE-01 | — | N/A | db-verify | `node scripts/verify-ca-depth.mjs` — asserts depth-0/1/2 rows present for CA FY2026 operating budget; depth-2 count = 219 | ✅ | ✅ green |
| 35-03-01 | 03 | 2 | ICICLE-01 | — | N/A | db-verify | `node scripts/verify-ca-depth.mjs` — asserts depth-2 count > 0 for all 5 FYs (2022: 252, 2023: 256, 2024: 253, 2025: 253, 2026: 219) | ✅ | ✅ green |
| 35-04-01 | 03 | 3 | ICICLE-01,ICICLE-02,ICICLE-03 | — | N/A | manual | Human spot-check at treasurytracker.empowered.vote/California — verify 3 drill levels, LineItemsTable at level 3 | ❌ Manual | manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Discovery: `python scripts/extractCA.py --fy 2026 --dry-run` — count distinct function values to validate Assumption A1
- [x] Mixed-node RPC test: verify `treasury_sync_budget_tree` accepts `{ n, a, c: [...], i: [...] }` on same node (resolves Assumption A2)
- [x] `scripts/extractCA.py` modified — `function` field added to `rows_out`
- [x] `scripts/processCA.js` modified — `buildCATree()` replaced + SUPABASE_URL fallback removed

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-06-08 (automated audit — all 5 automated tasks green, 1 manual-only)

---

## Validation Audit 2026-06-08

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Gaps resolved:**
- 35-02-02: Created `scripts/verify-ca-depth.mjs` — asserts depth-0/1/2 rows for CA FY2026; verified green (depth-2=219)
- 35-03-01: Same script covers all 5 FYs — verified green (2022: 252, 2023: 256, 2024: 253, 2025: 253, 2026: 219)

**Also updated:** task statuses from `⬜ pending` → `✅ green` / `manual`; automated commands updated to match what was actually verified during execution.
