---
phase: 113-acfr-upgrade-batch-1
plan: 04
status: complete
completed: 2026-07-02
requirements: [ACFR-24, ACFR-31, ACFR-32]
---

# 113-04 Summary — Missouri NASBO→ACFR Upgrade

**Missouri is live on full State-ACFR GAAP: 14 years (FY2012–FY2025) of GF revenue-by-source + spending-by-function, every year tying its printed General Fund column total at $0 diff.**

- All 14 per-year node pages on `acct.oa.mo.gov` resolved (PDF links live in `data-src` embed attributes); URLs match recon's confirmed examples.
- Extraction upgraded to position-aware GF-column anchoring (kills wrapped-label overflow rows); two years (FY2017, FY2021) needed hand-verified corrections for the wrapped "Net Increase (Decrease) in the Fair Value of Investments" line — both then tie $0.
- **Six years have negative GF fair-value-of-investments lines** (largest FY2022 −309,337K) — all render via the P2 clamp with signed labels, root totals preserved (ACFR-32 exercised at scale).
- NASBO FY2023/FY2024 replaced in place; ~2.25× divergence recorded with the Contributions-and-Intergovernmental mechanism (ACFR-31).
- Idempotency FY2024 re-run → 0 net change; 'mo-acfr-%' residue = 0; Money In auto-enabled; bookends 32,756,386K / 18,068,155K exact.

Details: `113-04-MO-LOADLOG.md`.
