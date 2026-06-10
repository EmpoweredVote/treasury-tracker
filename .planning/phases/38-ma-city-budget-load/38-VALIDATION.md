---
phase: 38
slug: ma-city-budget-load
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — data load phase; all verification is post-load DB queries + manual app spot-check |
| **Config file** | none |
| **Quick run command** | Supabase MCP SQL: `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA'` |
| **Full suite command** | Post-load DB count queries (see Per-Task Verification Map) + manual spot-check of 3 MA cities in app |
| **Estimated runtime** | ~30 seconds (DB queries) + ~5 minutes (manual app check) |

---

## Sampling Rate

- **After Wave 1 completes (all 8 scrape runs):** Verify JSON files exist on disk (`ls scripts/output/ma_dls_*_202*.json | wc -l` — expect 10 files)
- **After each Wave 2 load run:** Check DB row count is increasing (`SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA'`)
- **Before `/gsd-verify-work`:** Full DB count verification + app spot-check must pass

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | MA-02 | — | N/A | CLI | `ls scripts/output/ma_dls_revenue-by-source_202{1,2,3,4}.json` | ✅ after scrape | ⬜ pending |
| 38-01-02 | 01 | 1 | MA-01 | — | N/A | CLI | `ls scripts/output/ma_dls_special-revenue_202{1,2,3,4}_expenditures.json` | ✅ after scrape | ⬜ pending |
| 38-02-01 | 02 | 2 | MA-02 | — | N/A | DB count | `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA' AND b.dataset_type='revenue'` — expect ≥ 351 | ✅ after load | ⬜ pending |
| 38-02-02 | 02 | 2 | MA-01 | — | N/A | DB count | `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA' AND b.dataset_type='operating'` — expect ≥ 292 (after 59 zero-city exclusions) | ✅ after load | ⬜ pending |
| 38-02-03 | 02 | 2 | SC-5 | — | N/A | DB count | `SELECT COUNT(*) FROM treasury.budget_categories bc JOIN treasury.budgets b ON b.id=bc.budget_id JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA' AND b.dataset_type='operating'` — expect > 1,000 | ✅ after load | ⬜ pending |
| 38-02-04 | 02 | 2 | MA-03 | — | N/A | Manual | Open app → expand city picker → verify "MASSACHUSETTS" group appears with ≥ 350 cities | ✅ once budgets exist | ⬜ pending |
| 38-02-05 | 02 | 2 | MA-03 | — | N/A | Manual | Click Boston → verify Money In tab shows revenue data for at least one FY between 2021–2025 | ✅ after load | ⬜ pending |
| 38-02-06 | 02 | 2 | LOAD-03 | — | N/A | DB query | `SELECT fiscal_years FROM treasury.data_sources WHERE api_type='ma-dls' AND dataset_type='revenue' LIMIT 5` — expect `{2021,2022,2023,2024,2025}` | ✅ after full load | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test infrastructure needed for a data load phase. All verification is post-load DB queries and human app spot-check.

*Existing infrastructure (Supabase MCP) covers all phase verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "MASSACHUSETTS" group visible in city picker | MA-03 | UI interaction required | Open app → expand city picker → look for "MASSACHUSETTS" group header |
| Boston Money Out tab shows operating data | SC-2 | UI interaction required | Click "Boston" → select "Money Out" tab → verify ≥1 fiscal year shows data |
| Boston Money In tab shows revenue data | SC-3 | UI interaction required | Click "Boston" → select "Money In" tab → verify ≥1 fiscal year shows data |
| FY2021–2025 all available in year selector | SC-4 | UI interaction required | Click "Boston" → open year selector → verify FY2021, 2022, 2023, 2024, 2025 all selectable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are noted as Manual-Only
- [ ] Wave 1 output: 8 JSON files on disk confirmed
- [ ] Wave 2 output: DB row counts meet all thresholds
- [ ] Manual spot-check: Boston, Worcester, Springfield pass SC-2/3/4
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
