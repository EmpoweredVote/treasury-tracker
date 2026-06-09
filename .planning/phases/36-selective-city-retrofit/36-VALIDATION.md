---
phase: 36
slug: selective-city-retrofit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js scripts (no jest/pytest — data pipeline phase) |
| **Config file** | none — validation via SQL queries and app spot-checks |
| **Quick run command** | `node scripts/verify-3level-tree.mjs <city>` (Wave 0 installs) |
| **Full suite command** | `node scripts/verify-3level-tree.mjs --all` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick verification against the target city
- **After every plan wave:** Run full suite (all retrofitted cities + regression check on 2-level cities)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 1 | RETROFIT-01 | — | Source data genuineness confirmed | manual | SQL audit query | ❌ W0 | ⬜ pending |
| 36-02-01 | 02 | 2 | RETROFIT-02 | — | 3-level tree loads without error | script | `node scripts/verify-3level-tree.mjs portland` | ❌ W0 | ⬜ pending |
| 36-02-02 | 02 | 2 | RETROFIT-02 | — | Enrichment descriptions preserved | script | SQL count check | ❌ W0 | ⬜ pending |
| 36-03-01 | 03 | 3 | RETROFIT-03 | — | 2-level cities unaffected | script | `node scripts/verify-3level-tree.mjs --regression` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-3level-tree.mjs` — spot-check script to verify N-level tree depth, node count, and enrichment preservation for a given city slug

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3-level icicle renders in browser | RETROFIT-02 | UI rendering requires visual verification | Navigate to retrofitted city page, open icicle, drill to depth 2 |
| Source data has genuine 3rd level | RETROFIT-01 | Requires reading original PDF/API and applying judgment | Open source PDF or query Socrata; confirm 3rd-level groupings are not synthesized |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
