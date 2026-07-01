---
status: passed
phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
verified: 2026-06-30
method: inline (no subagent — per feedback-no-research-subagents; goal-backward against ROADMAP success criteria)
requirements: [RECON-04, RECON-05]
---

# Phase 103 Verification — Recon (Deeper-History URLs + PA/IL ACFR Source Location)

**Verdict: PASSED.** Documentation-only recon phase; goal achieved. All three ROADMAP success criteria are satisfied by committed, independently-tie-confirmed artifacts. $0 spend, no DB writes, no loader edits, no NASBO mutations (the recon boundary held).

## Success-criteria check (goal-backward)

1. **Pilot deeper-history URLs probed + recorded with gap log** — ✅ `103-DEEPEN-SOURCES.md`. NY → FY2003–FY2024 (FY2003 GF total rev $29,250M tie); CA → FY2008–FY2025 (FY2008 $97,774,378K tie, via the `/Files-ARD/CAFR/` path 98 never probed); FL → FY2021–FY2024 (FY2021 $46,989,188K tie); TX FY2016 found already-loaded in v2.11 (re-confirmed $96,239,551K). Gap log records CA FY2002–07 (variant naming, optional) + FL ≤FY2020 (not durably sourceable → excluded per D-02).
2. **PA + IL ACFR GF statements located + bookend-tied** — ✅ `103-PA-IL-SOURCES.md`. PA Govtl Funds GF column, thousands, Jun 30, FY2016–FY2025, FY2024 $91,293,027K + FY2023 $95,231,042K ties. IL Govtl Funds GF column, thousands, Jun 30, final-audited FY2021–FY2025, FY2023 $73,827,795K + FY2025 $78,342,927K ties. Four facts pinned per state; scope-vs-NASBO documented; recent-window verdict per state.
3. **Loader-reuse + NASBO-replace plan written** — ✅ `103-RECON.md` §1–§3. Pilot SOURCES-map extension plan (which loader files, which FY keys, which URL pattern, idempotent); PA/IL loader mapping (new processPA/processIL on the processTX.js pattern) + NASBO-replace rule + D-06 greenlights + D-04 relabel gates.

## Requirement traceability

| REQ-ID | Covered by | Status |
|--------|-----------|--------|
| RECON-04 | 103-01 (pilot URLs + gap log) + 103-02 (PA/IL location + bookend tie) | ✅ |
| RECON-05 | 103-03 (loader-reuse + NASBO-replace plan; replace-enabling) | ✅ |

## must_haves spot-check
- Durable-URL-bound + bounded effort + no-hard-floor (D-01) honored; non-durable years excluded + logged (D-02) ✓
- Bookend ties via `pdftotext -table` (D-03) ✓ — every claimed FY's GF total tie-checked (line-items-sum and/or columns-sum)
- PA/IL four facts pinned (D-05); scope accept-relabel recommended (D-04); recent-window verified (D-06) ✓
- CA soft-404 not mistaken for PDF (Content-Type/size filter) ✓
- No DB writes; no loader edits; $0 spend ✓

## Notable findings carried to 104–105 (see 103-RECON.md §4 Open Risks)
- Two 98-era "not durably sourceable" verdicts overturned (CA `/Files-ARD/CAFR/`, FL FY2021) — CA + NY extend ~12 yrs deeper than expected.
- TX FY2016 was already closed in v2.11 (no Phase-104 TX work).
- PA (~2×) + IL (~1.5×) GF scope exceeds NASBO (federal inside the GAAP GF) → accept-relabel gate for Chris at load/UAT.
- FL FY2021 negative investment-income → P2 clamp (ACFR-08).
- IL final-vs-interim trap: SOURCES must use `ACFR Final {YYYY}` files only.
