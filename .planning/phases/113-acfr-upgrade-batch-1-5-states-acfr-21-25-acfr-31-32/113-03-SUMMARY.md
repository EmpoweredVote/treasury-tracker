---
phase: 113-acfr-upgrade-batch-1
plan: 03
status: complete
completed: 2026-07-02
requirements: [ACFR-23, ACFR-31, ACFR-32]
---

# 113-03 Summary — Oregon NASBO→ACFR Upgrade

**Oregon is live on full State-ACFR GAAP across its honest recon-locked window FY2022–FY2025 — 4 years of GF revenue-by-source + spending-by-function, each tying its printed General column total (±≤3K printed-rounding, tolerance 10K).**

- Built `scripts/processORAcfr.js` + `scripts/processORRevenueAcfr.js` (generalized generator `_acfr-work/gen_state.py`, gitignored, from tie-verified extraction data).
- 4 PDFs downloaded via the 4 verbatim per-year URLs (different separator each year); all %PDF-verified.
- Bookends: FY2025 rev 17,291,987K / FY2022 rev 15,711,953K — recon match.
- NASBO FY2023/FY2024 replaced in place (0 NASBO labels, 1 operating row/FY); FY2005–FY2021 correctly absent (D-06 exclusion, min_fy=2022 in DB).
- Idempotency FY2025 re-run → 0 net change; 'or-acfr-%' residue = 0; Money In auto-enabled; ~1.07× scope note recorded; no negative lines (clamp = safety net).

Deviation: none. Details: `113-03-OR-LOADLOG.md`.
