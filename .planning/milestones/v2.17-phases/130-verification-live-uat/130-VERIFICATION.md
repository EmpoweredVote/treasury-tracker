---
phase: 130-verification-live-uat
verified: 2026-07-11T00:00:00Z
status: passed
score: 3/3 requirements verified (TUC-07, TUC-08, TUC-09)
overrides_applied: 0
---

# Phase 130: Verification + Live UAT Report

**Phase Goal:** Prove every displayed Tucson figure is real and sourced, and confirm the whole experience live.
**Verified:** 2026-07-11
**Status:** passed
**Method:** loader-independent PDF re-derivation + source-chain audit (machine, inline — no gsd-verifier per project policy) + Chris live-app UAT sign-off.

This is the verification + live-UAT capstone of **v2.17 Tucson, AZ City Onboarding**.
All three phase requirements are met.

## Requirement Achievement

### ✅ TUC-07 — loader-independent re-derivation + source-chain audit (PASS)

Every displayed Tucson General Fund figure was independently re-derived directly from
the source ACFR PDFs along a second, from-scratch path (`scripts/verify-phase130-rederive.mjs`
— its own `pdftotext -table` parser, **no `extractTucson.py` import**) and diffed against
the live production DB:

- **All 20 FY×mode roll-ups + every category subtotal + every displayed leaf tie at
  exactly $0** across FY2015–FY2024. FY2024 grounding reproduced leaf-for-leaf
  (rev $773,493,270 / exp $648,657,363; `Current` $559,483,332 → 5 children;
  `Debt service` $59,871,756 → Principal $41,325,395 / Interest $18,522,806 /
  Fiscal agent fees $23,555).
- The FY2021/FY2022 merged-label quirk is cosmetic only — the non-zero value multisets
  matched the DB exactly and roll-ups tied at $0 (no disposition required).

**Source-chain audit** (`scripts/verify-phase130-audit.mjs`) — D-04 (a)–(e) all PASS:
20/20 rows have non-null + correct-per-FY `source_url` (all 10 URLs reachable, HTTP 200
`application/pdf`); **0 `data_sources` residue** (`dataset_id ILIKE 'tucson%'`); no stale
labels; Tucson (554,013) + Pima County (1,080,149) carry population + Vintage-2024
provenance; `Tucson.county_id == Pima.id`.

**D-05 loader-hardening** confirmed already-fixed (Phase 129 review-fix: CR-01 commit
55f359a try/finally ephemeral cleanup; WR-01 commit 30aa388 municipality-keyed pre-load
delete) — verify-only this phase. An idempotent both-mode smoke re-run (existing FY window
only) netted 0 change; the audit + re-derivation were re-run after and both still PASS.

Full log: `130-REDERIVATION.md`. Reproduce: `node scripts/verify-phase130-rederive.mjs`,
`node scripts/verify-phase130-audit.mjs`.

### ✅ TUC-08 — Chris live-app UAT sign-off (PASS)

Chris ran the formal `130-UAT-CHECKLIST.md` against the live app
**https://treasurytracker.empowered.vote** on **2026-07-11** — **15/15 scenarios PASS**:

- **Baseline (D-07):** 2-level icicle drill-down (`Current`/`Debt service` → children),
  Money In/Out toggle, per-capita ($1,170.83 out / $1,396.16 in @ pop 554,013), source
  chips resolving to the correct-per-FY tucsonaz.gov ACFR, and `US → Arizona → Pima
  County → Tucson` breadcrumb + Cities-in-County panel — all across Tucson + Pima County
  + Arizona.
- **Extra (D-08):** Arizona state node regression (v2.14 ACFR undisturbed); year switcher
  + honest per-FY era labels across multiple FYs; FY2021/FY2022 merged-label quirk
  displays acceptably with explanatory enrichment; FY2025 cleanly absent (no broken/empty
  render, no phantom zero row).

### ✅ TUC-09 — Essentials tether confirmed (PASS)

**Determine-then-confirm (D-09):** `scripts/verify-phase130-tether.mjs` pre-determined,
from the live `coverage.json` (generated 2026-07-10; 137 cities / 17 counties), that
**both Tucson (GEOID `0477000`) and Pima County (GEOID `04019`) are COVERED** — icon
expected on both banners, **no cross-repo gap** (D-10 not triggered). Chris's live UAT
(scenarios j1–j3) **confirmed the prediction**: the Essentials tethered icon renders on
both the Tucson and Pima County banners and deep-links into Essentials. Prediction +
verdict: `130-TETHER-VERDICT.md`.

## External-service note (unchanged from 129)

The icicle / Money-In visual render runs through the external `ev-accounts-api` (not in
this repo) via `src/data/dataLoader.ts`, which is why the visual render is UAT-confirmed
by a human (TUC-08) rather than machine-asserted. The DB data shape was machine-verified
in Phase 129 and independently re-derived at $0 in this phase (TUC-07).

## Outstanding Gaps

None. No new data, no new FYs (FY2025 not yet published — honest boundary), no
schema/RPC/frontend change. Deferred items (FY2025 re-run, pre-FY2015 history, Pima
County's own budget, TUC-SAL-01) remain out of scope per `130-CONTEXT.md`.

## Result

**Phase 130 PASSED — 3/3 requirements verified (TUC-07, TUC-08, TUC-09).** This closes
the v2.17 Tucson, AZ City Onboarding milestone.
