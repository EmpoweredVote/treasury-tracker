---
phase: 37
slug: ma-loader-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (no automated test suite for scripts/) |
| **Config file** | None |
| **Quick run command** | `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run` |
| **Full suite command** | Same (plus manual LOAD-02 resume test and LOAD-03 fiscal_years DB check) |
| **Estimated runtime** | ~5 seconds (dry-run); ~10 min (full manual sequence) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run`
- **After every plan wave:** Full manual test sequence for LOAD-02 and LOAD-03
- **Before `/gsd-verify-work`:** All 4 success criteria confirmed manually
- **Max feedback latency:** ~5 seconds (dry-run smoke)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | LOAD-01 | — | rdreport update uses only hardcoded string; no user input | manual | `node scripts/scrapeMaDLS.js --explore --report gf-expenditures` → human reads console output | ✅ | ⬜ pending |
| 37-02-01 | 02 | 1 | LOAD-03 | — | DOR codes from validated scrape path only; no external input in update | smoke | Load FY2022 JSON, load FY2023 JSON, query `SELECT fiscal_years FROM treasury.data_sources WHERE api_type='ma-dls'` → expect `[2022,2023]` | ✅ | ⬜ pending |
| 37-03-01 | 03 | 1 | LOAD-02 | — | Progress file contains only DOR codes (public data); no secrets written to disk | manual | Run `--load`, kill mid-run, re-run; confirm `Skipped N already loaded (checkpoint)` in output | ✅ | ⬜ pending |
| 37-04-01 | 04 | 2 | SC-4 | — | Dry-run skips all DB writes by design | smoke | `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run` → non-zero totals, 351 records | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- None — no automated test framework to install. All verifications are manual or smoke (CLI commands on existing files).

*Existing infrastructure covers all phase requirements — no Wave 0 setup tasks needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `--explore` confirms correct GF Expenditures rdreport | LOAD-01 | Requires human to read table headers and confirm they match GF category names | Run `node scripts/scrapeMaDLS.js --explore --report gf-expenditures`; confirm: table ID found, headers show "General Government"/"Public Safety"/"Education" etc., row count = 351 |
| Interrupted bulk run resumes from last success | LOAD-02 | Requires deliberate kill mid-run | Start `--load` against a JSON, kill after 10–20 cities, re-run, verify `Skipped N already loaded (checkpoint)` appears and no duplicate rows exist in DB |
| Loading FY2022 then FY2023 produces `[2022, 2023]` | LOAD-03 | Requires two sequential DB writes and a DB query | Load FY2022 JSON (not dry-run), then FY2023 JSON, then query `fiscal_years` column; expect `[2022,2023]` not `[2023]` or `[2022,2022,2023]` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
