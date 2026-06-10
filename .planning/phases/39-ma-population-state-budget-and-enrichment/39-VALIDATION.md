---
phase: 39
slug: ma-population-state-budget-and-enrichment
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-10
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual DB queries (node scripts) + Supabase MCP execute_sql |
| **Config file** | none |
| **Quick run command** | `node scripts/loadMAPopulation.js --dry-run` |
| **Full suite command** | DB row count queries via Supabase MCP |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick row count query to confirm DB state
- **After every plan wave:** Run full DB verification across all 351 cities
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | MA-04 | — | N/A | db-query | `mcp__supabase-local__execute_sql: SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND population > 0` | ✅ | ⬜ pending |
| 39-02-01 | 02 | 1 | STATE-01 | — | N/A | db-query | `mcp__supabase-local__execute_sql: SELECT b.fiscal_year, b.total_amount FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.name='Massachusetts' AND m.entity_type='state' AND b.dataset_type='operating' ORDER BY b.fiscal_year` | ✅ | ⬜ pending |
| 39-03-01 | 03 | 1 | ENRICH-01 | — | N/A | db-query | `mcp__supabase-local__execute_sql: SELECT COUNT(*) FROM treasury.category_enrichment WHERE municipality_id IS NULL AND name_key IN ('tax levy','state aid','federal general government grants')` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test framework needed — all verification is via DB queries and script dry-run output.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MA city page shows $/resident figure | MA-04 | UI display verification | Open any MA city (e.g. Boston) in app; confirm per-capita figure appears next to budget total |
| MA state page shows real GF data | STATE-01 | UI display verification | Open Massachusetts state page; confirm General Fund line items match enacted budget |
| MA category enrichment descriptions visible | ENRICH-01 | UI display verification | Open any MA city page; confirm category descriptions appear on operating/revenue tabs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Note:** Tasks in 39-03 and 39-04 use Supabase MCP (`mcp__supabase-local__execute_sql`) as the verification mechanism — this is the established DB-state verification pattern for all data-loading phases in this project. Wave 0 is not applicable; existing MCP infrastructure covers all phase verification needs.

**Approval:** pending
