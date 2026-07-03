---
phase: 113-acfr-upgrade-batch-1
plan: 02
status: complete
completed: 2026-07-02
requirements: [ACFR-22, ACFR-31, ACFR-32]
---

# 113-02 Summary — Arizona NASBO→ACFR Upgrade

**Arizona is live on full State-ACFR GAAP: 23 years (FY2002–FY2024) of GF revenue-by-source + spending-by-function, every year tying $0, with the FY2024 durability decision executed and documented.**

- **FY2024 durability re-check:** still Google-Drive-only as published — loaded per the locked decision with a caveat comment in both loaders' SOURCES and the Drive URL stamped as source_url. Data tie-confirmed; only the URL is fragile.
- **WAF:** milder than recon this session — cookie-jar + Referer worked throughout; no browser-download fallback needed. Key discovery: gao.az.gov's **Drupal JSON:API is open**, enumerating all ACFR file paths directly (recorded in the LOADLOG for Phase 114+ reuse).
- FY2014 ("TOC"-named) and FY2019 ("Opinion"-named) files are actually complete reports — verified by content, both tie.
- 5 years needed hand-verified positional fixes for tiny GF Transportation values that pdftotext shifted (70/58/44/51/4 thousands — each matched its year's diff exactly).
- Two clamp-handled negative years found beyond recon's bookends (FY2013/FY2022 Earnings on investments).
- NASBO FY2023/FY2024 replaced in place; ~2.46× Intergovernmental divergence recorded (ACFR-31); idempotency 0 net change; 'az-acfr-%' residue 0; Money In auto-enabled; bookends 44,045,434K / 11,655,423K exact.

Details: `113-02-AZ-LOADLOG.md`.
