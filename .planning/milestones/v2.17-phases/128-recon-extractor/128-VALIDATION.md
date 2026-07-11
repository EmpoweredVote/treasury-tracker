---
phase: 128
slug: recon-extractor
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-10
---

# Phase 128 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Validation here is a **deterministic $0 bookend-tie**, not a unit-test suite — the
> printed ACFR totals are the correctness oracle for extraction work.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None introduced — validation = `$0` bookend-tie assertion via `pdftotext -table` + `extractTucson.py` self-check |
| **Config file** | none |
| **Quick run command** | `python scripts/extractTucson.py "docs/Tucson/cot-<FY>-...pdf" --mode revenue` (inspect `tie_delta`) |
| **Full suite command** | dry-run both modes for every windowed FY; assert every `tie_delta == 0` |
| **Estimated runtime** | ~2–5 s per FY per mode (pdftotext + parse) |

---

## Sampling Rate

- **After every task commit:** run the extractor dry-run for the FY(s) touched; confirm `tie_delta == 0`.
- **After every plan wave:** run the full window sweep (both modes, all windowed FYs).
- **Before phase close (Phase 130 UAT):** every windowed FY ties $0 in both modes.
- **Max feedback latency:** < 30 s (full window sweep).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 128-01-01 | 01 | 1 | TUC-01 | T-128-01 | Only tucsonaz.gov PDF URLs fetched (host allow-list); args-array subprocess | integration | `pdftotext -table` per FY → bookend sum vs printed `Total revenues`/`Total expenditures`, delta 0 | ❌ W0 | ⬜ pending |
| 128-01-02 | 01 | 1 | TUC-01 | — | N/A | manual+doc | `128-RECON.md` lists every year · durable URL · tie status; window locked | ❌ W0 | ⬜ pending |
| 128-02-01 | 02 | 2 | TUC-02 | T-128-02 | Malformed/hostile PDF cannot silently mis-tie (non-zero `tie_delta` → non-zero exit) | integration | `extractTucson.py --mode revenue` → `tie_delta == 0` for each windowed FY | ❌ W0 | ⬜ pending |
| 128-02-02 | 02 | 2 | TUC-02 | T-128-02 | N/A | integration | `extractTucson.py --mode operating` → `tie_delta == 0`; `Current`/`Debt service` sub-totals == Σ children | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docs/Tucson/` populated with each resolvable per-year ACFR PDF (gitignored via `docs/*`; on `main`, not a worktree).
- [ ] `pdftotext` (poppler) on PATH — confirmed `pdftotext version 4.00`.
- [ ] `python` on PATH — confirmed.

*No test framework install required — the tie assertion is self-contained in the extractor + recon steps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Archive enumeration is complete (no published ACFR year missed) | TUC-01 | Judgment call against the live archive index page; no machine oracle for "did the city publish a year we didn't list" | Open the ACFR archive URL, cross-check every listed year against `128-RECON.md`; note any year present on the page but absent from RECON |

---

## Validation Sign-Off

- [ ] Every windowed FY ties $0 in `--mode revenue` (`tie_delta == 0`)
- [ ] Every windowed FY ties $0 in `--mode operating` (`tie_delta == 0`)
- [ ] `Current` and `Debt service` sub-totals equal the sum of their children each FY
- [ ] `128-RECON.md` records year · durable URL · page · tie status for every published year (holes documented, not dropped)
- [ ] Clean-extract window is locked and recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
