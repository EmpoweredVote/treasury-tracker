---
phase: 128
slug: recon-extractor
status: passed
verified: 2026-07-10
method: inline (no verifier subagent — per project token/machine-strain policy)
requirements: [TUC-01, TUC-02]
---

# Phase 128 — Verification (Recon + Extractor)

**Phase goal:** Locate and validate the Tucson ACFR source end-to-end before any load — enumerate the published years, pin durable URLs, prove clean `pdftotext -table` extraction of the General Fund column, and build the extractor.

**Verdict: PASSED.** Goal-backward review — every success criterion is met with reproducible $0-tie evidence.

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Every published year listed with a durable per-year PDF URL; each GF column bookend-ties printed *Total revenues* & *Total expenditures* at $0 (or documented hole) | ✅ | `128-RECON.md`: FY2015–FY2024, 10 durable `tucsonaz.gov` URLs (all 200/`application/pdf`), all tie $0; no interior holes; FY2025 documented as not-yet-published |
| 2 | Clean-extract window locked and recorded | ✅ | `128-RECON.md` → "Locked clean-extract window: FY2015–FY2024 (10 contiguous years)" |
| 3 | `extractTucson.py --mode operating\|revenue` dry-runs each windowed FY; each GF tree sums to the printed GF total at $0 | ✅ | 20/20 dry-runs (`10 FY × 2 modes`) `tie_delta == 0`; table in `128-RECON.md`; FY2024 = $773,493,270 / $648,657,363 |
| 4 | Wrapped "Community enrichment and development" label and `$`/blank non-GF cells handled with no mis-parsed rows | ✅ | FY2024 operating tree rejoins the wrapped label into one node ($70,448,394); GF-blank `Developer fees` resolves to 0 (not the Non-Major value); all $0 ties prove no mis-parse |

## Requirements
- **TUC-01** — recon + window lock → Plan 128-01 (commit `4e6feef`). ✅
- **TUC-02** — `extractTucson.py` → Plan 128-02 (commit `74ddd19`). ✅

## Robustness checks beyond the stated criteria
- **Fail-loud gate** proven by fault injection: a dropped GF row → `tie_delta ≠ 0` + exit code 1. A mis-parse cannot silently reach the Phase 129 load.
- **Wrong-page guard:** finder excludes Combining/Reconciliation/Budgetary/Net-Position/Proprietary/Fiduciary pages and picks the earliest primary statement; monotonic GF-revenue ($468M→$773M) confirms the correct statement every year.
- **Cross-era label variance** handled (label-driven parsing); confirmed across `Current:`/`Current -`, case shifts, `General government`↔`Non-Departmental`, and differing debt-service components.

## Boundaries honored (phase fence)
No municipality seed, no live load, no `category_enrichment`, no schema/RPC touch — all correctly deferred to Phase 129. Phase 128 ends with a locked window, pinned durable URLs, and a self-tying extractor.

## Deferred / follow-ups (not blocking)
- **FY2025** ACFR: add when the city publishes a resolvable URL (~late 2026).
- **Pre-FY2015** history: available in the archive but not pursued (higher format risk; 10 years is a deep window for a one-off city).

**Ready to proceed to Phase 129 (Data Model + Load + Enrichment).**
