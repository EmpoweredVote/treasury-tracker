---
phase: 113-acfr-upgrade-batch-1
plan: 01
status: complete
completed: 2026-07-02
requirements: [ACFR-21, ACFR-31, ACFR-32]
---

# 113-01 Summary — Indiana NASBO→ACFR Upgrade

**Indiana is live on full State-ACFR GAAP: 24 years (FY2002–FY2025) of GF revenue-by-source + spending-by-function, every year tying its printed General Fund column total at $0 diff.**

## What was done

- Built `scripts/processINAcfr.js` + `scripts/processINRevenueAcfr.js` on the IL template (UNITS=1_000 thousands, ephemeral data_sources lifecycle, EXPECTED_MUNI_ID assert, P2 clamp).
- Downloaded all 24 ACFR/CAFR PDFs from `www.in.gov/comptroller/files/` across 7 filename eras — zero CDN friction; one truncated download (FY2023) caught and re-fetched.
- Extracted the GF column via `pdftotext -table` + a reusable extractor (`_acfr-work/extract_gf.py`, gitignored) with per-section tie verification; **all 24 years tied $0 diff on BOTH revenues and expenditures** — no honest holes needed.
- Live-loaded 48 rows (24 operating replacing/superseding NASBO in place + 24 revenue net-new); per-year source_url/source_date/GAAP-basis stamps.

## Verification results

- Bookends: FY2024 rev 22,101,900K / FY2002 rev 7,341,746K — both match recon exactly.
- NASBO FY2023/FY2024 replaced in place; 0 NASBO labels remain; 1 operating row per FY.
- Idempotency: FY2024 re-run (both loaders) → 0 net change; `data_sources` 'in-acfr-%' residue = **0** (LOAD-01 held).
- FY2022 negative "Investment income (loss)" (−30,464K) renders via P2 clamp with signed label (ACFR-32 exercised).
- Scope parity ~0.99× recorded (ACFR-31 — Medicaid is a separate major fund in IN).
- Money In auto-enabled; cohort (CA/PA/NJ/OK/KS sample) untouched.

## Deviations

- Loaders run all-FYs in one invocation rather than per-FY shell loops (equivalent: validate() gates each FY before its write). "Loaded 0 rows" in RPC output is the RPC's return-field quirk; rows verified present + stamped by direct SQL.

Details: `113-01-IN-LOADLOG.md`.
