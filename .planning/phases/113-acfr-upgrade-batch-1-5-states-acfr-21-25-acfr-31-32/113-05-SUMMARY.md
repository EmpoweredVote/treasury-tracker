---
phase: 113-acfr-upgrade-batch-1
plan: 05
status: complete
completed: 2026-07-02
requirements: [ACFR-25, ACFR-31, ACFR-32]
---

# 113-05 Summary — Colorado NASBO→ACFR Upgrade (TABOR clamp exercise)

**Colorado is live on full State-ACFR GAAP across FY2023–FY2025, all 3 years tying $0 diff — and the tranche's primary P2-clamp exercise passed on live data.**

- TABOR two-form check ran on every year: FY2024 standalone −1,214,908K (recon match) and **FY2025 standalone −129,536K (new finding)** both transcribed signed + clamped at render; FY2023 confirmed netted-into-income-tax (no standalone line, no clamp needed).
- Stored-tree assertion: the FY2024 revenue tree in `treasury.budget_categories` carries the TABOR child at $0 with the signed magnitude in its label; the row total 26,271,588,000 preserves the signed net (ACFR-32 verified in the DB, not just loader output).
- Referer-header fetch recipe worked first-try on all 3 PDFs (mild WAF, as recon predicted).
- NASBO FY2023/FY2024 replaced in place; ~1.81× Federal-Grants divergence recorded (ACFR-31); idempotency re-run 0 net change; 'co-acfr-%' residue 0; Money In auto-enabled.

Details: `113-05-CO-LOADLOG.md`.
