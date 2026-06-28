---
phase: 95
slug: mn-history-oh-va-re-do-sgfs-02-sgfs-03
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 95 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node script self-validation (`validate()` sum-check in each loader) |
| **Config file** | none — loaders embed their own validation |
| **Quick run command** | `node scripts/<loader>.js --dry-run` (per-FY checksum vs published totals) |
| **Full suite command** | `node scripts/<loader>.js` then DB probe of `treasury.budgets` for state node |
| **Estimated runtime** | ~30–90 seconds per loader |

---

## Sampling Rate

- **After every task commit:** Run the affected loader in `--dry-run` (checksum only, no write)
- **After every plan wave:** Run the loader for real + probe `treasury.budgets` rows (0-NULL source-stamp invariant)
- **Before `/gsd:verify-work`:** All loaded FYs validate against published Total Expenditures / Net Revenues within tolerance
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {planner fills} | | | SGFS-02 / SGFS-03 | — | actuals-only, sourced, 0-NULL stamp | checksum + DB probe | `{command}` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Per-loader `validate()` sum-check against published ACFR Total Expenditures / Net Revenues (tolerance per Phase-94 = $10M)
- [ ] DB probe asserting no NULL `source_url`/`source_date`/`data_source` on loaded state rows (P4 0-NULL invariant)

*Planner refines into concrete per-task commands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OH ACFR PDF download | SGFS-03 | archives.obm.ohio.gov SSL cert blocks programmatic fetch | Chris downloads OH ACFR PDFs via browser before extraction tasks |
| GENERAL FUND column transcription | SGFS-02/03 | pdftotext column-misalign → render-to-image read | Verify transcribed figures against rendered page image + checksum |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
