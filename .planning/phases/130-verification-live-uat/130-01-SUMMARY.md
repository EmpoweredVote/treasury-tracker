---
phase: 130-verification-live-uat
plan: "01"
subsystem: verification
tags: [tucson, acfr, blind-re-derivation, source-chain-audit, pdftotext, supabase, tuc-07]

# Dependency graph
requires:
  - phase: 128-recon-extractor
    provides: docs/Tucson/*.pdf + per-FY canonical URLs (128-RECON.md) used only to locate each PDF
  - phase: 129-data-model-load-enrichment
    provides: the 20 loaded budgets rows + tree this plan re-derives against; the D-05 fixes (CR-01/WR-01) this plan confirms
provides:
  - TUC-07 machine verification PASS (loader-independent re-derivation + source-chain audit + D-05 confirmation)
  - scripts/verify-phase130-rederive.mjs (re-runnable, exit 0 = all figures tie $0)
  - scripts/verify-phase130-audit.mjs (re-runnable, exit 0 = source chain clean a-e)
  - .planning/phases/130-verification-live-uat/130-REDERIVATION.md (durable log)
affects: [130-03-uat-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "From-scratch JS re-implementation of the GF-column parser (own pdftotext -table pass, own money regex, own positional column isolation) — deliberately NOT importing extractTucson.py, to avoid testing the loader against itself"
    - "Value-multiset + total + subtotal comparison (non-zero) so a cosmetic label merge cannot cause a spurious value mismatch, while any real dollar delta still fails exact-0"

key-files:
  created:
    - scripts/verify-phase130-rederive.mjs
    - scripts/verify-phase130-audit.mjs
    - .planning/phases/130-verification-live-uat/130-REDERIVATION.md
  modified: []

key-decisions:
  - "D-05 was verify-only, not re-apply: CR-01 (commit 55f359a) + WR-01 (commit 30aa388) were already fixed in Phase 129's review-fix cycle and are present in processTucson.js. Confirmed via code inspection + node --check; did NOT re-edit the loader."
  - "Idempotent smoke re-run of both modes (existing FY2015-FY2024 window only, no new FYs) netted 0 change; the source-chain audit + full re-derivation were re-run immediately after and both still PASS (0 residue, 20/20 tie)."
  - "D-04(e) Census provenance is carried by population_year=2024 (Vintage-2024 marker) — treasury.municipalities has no dedicated provenance column; the pinned source lives in seedTucsonArizona.js."

# Result
result: PASS
evidence:
  - "20/20 FY×mode roll-ups + every category subtotal + every displayed leaf tie the live DB at exactly $0 (FY2024 grounding: rev $773,493,270 / exp $648,657,363; Debt service Principal $41,325,395 / Interest $18,522,806 / Fiscal agent fees $23,555)"
  - "Source-chain audit a-e all PASS: 20/20 non-null source_url+source_date; all URLs correct-per-FY + reachable (HTTP 200 application/pdf); 0 data_sources residue; no stale labels; Tucson+Pima populated"
  - "$0 AI spend; read-only DB (audit additionally HEAD/GETs the 10 source URLs)"
---

# Plan 130-01 Summary — TUC-07 machine verification

Delivered the machine-verifiable core of TUC-07. A from-scratch, loader-independent
re-derivation harness (`verify-phase130-rederive.mjs`) re-extracts every displayed
Tucson GF figure directly from the 10 ACFR PDFs via its own `pdftotext -table` parser
and diffs against the live production DB — **all 20 FY×mode roll-ups, every category
subtotal, and every leaf tie at exactly $0** (FY2024 grounding figures reproduced
leaf-for-leaf). The source-chain audit (`verify-phase130-audit.mjs`) confirms all 20
rows are durably + correctly-per-FY sourced (URLs reachable), 0 `data_sources` residue,
no stale labels, and Tucson+Pima carry Census Vintage-2024 population. The Phase-129
D-05 loader-hardening (CR-01/WR-01) was confirmed already in place (verify-only, per the
planning-time finding), and an idempotent smoke re-run left the source chain clean
(0 change). Full detail: `130-REDERIVATION.md`.
