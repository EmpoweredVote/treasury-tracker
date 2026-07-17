---
phase: 133-verification-live-uat
verified: 2026-07-17T00:00:00Z
status: passed
score: 3/3 requirements verified (PIMA-07, PIMA-08, PIMA-09)
overrides_applied: 0
---

# Phase 133: Verification + Live UAT Report

**Phase Goal:** Prove every displayed figure for the four new Pima County municipalities
is real and sourced, and confirm the whole four-municipality experience live.
**Verified:** 2026-07-17
**Status:** passed
**Method:** loader-independent PDF re-derivation + source-chain audit (machine, inline —
no gsd-verifier per project policy) + Chris live-app UAT sign-off + tether
determine-then-confirm.

This is the verification + live-UAT capstone of **v2.18 Pima County Municipalities — TT
Budget Parity** (Oro Valley, Marana, Sahuarita, South Tucson). All three phase
requirements are met.

## Requirement Achievement

### PIMA-07 — loader-independent re-derivation + source-chain audit (PASS)

Every displayed General Fund figure for the four municipalities was independently
re-derived directly from the source ACFR PDFs along a second, from-scratch path
(`scripts/verify-phase133-rederive.mjs` — its own `pdftotext -table` parser, **no
`extractAcfrGF.py` import**) and diffed against the live production DB:

- **All 44 FY×mode roll-ups + every category subtotal + every displayed leaf tie at
  exactly $0** — Oro Valley/Marana/Sahuarita FY2019–2024 (revenue + operating), South
  Tucson FY2019–2022 (revenue + operating); 22 city-FYs × 2 modes = 44 combinations.
  FY2024/FY2022 grounding reproduced leaf-for-leaf for all four cities (see
  `133-REDERIVATION.md` for the full per-city breakdown).
- Two documented, label-only Oro Valley cosmetic quirks (raw-PDF glyph-split rendering
  — "Tran s it" / "In teres t" / "in v es tmen ts", and a source-PDF "Integovernmental"
  typo) were dispositioned across 13 instances — in every instance the dollar **value**
  tied exactly; only the raw-PDF text label differed from the loader's cleaned label. 0
  un-dispositioned mismatches on the full run.

**Source-chain audit** (`scripts/verify-phase133-audit.mjs`) — (a)–(e) all PASS: 44/44
rows have non-null + correct-per-FY `source_url` + `source_date`; every distinct
`source_url` reachable (Oro Valley/Marana direct HTTP 200; South Tucson's four URLs
corroborated via Wayback Machine CDX after an anti-bot soft-404 on direct fetch — a
Rule-1 robustness generalization of the audit script, not a scope change); **0
`data_sources` residue**; no stale labels; all four municipalities + Pima County carry
population + 2024 provenance and correct `county_id` linkage to Pima.

**D-05 loader-hardening** (source-safe `treasury_sync_budget_tree` RPC, ephemeral
`data_sources` lifecycle, municipality-keyed pre-load delete) confirmed already-shipped
in Phase 132 — this phase verify-only, no fix branch triggered. An idempotent both-mode
smoke re-run (existing FY window only) netted 0 change (identical row counts + per-city
dollar sums before/after); the audit was re-run immediately after and still PASS.

Full log: `133-REDERIVATION.md`. Reproduce: `node scripts/verify-phase133-rederive.mjs`,
`node scripts/verify-phase133-audit.mjs`. $0 AI spend (no AI calls in either script).

### PIMA-08 — Chris live-app UAT sign-off (PASS)

Chris ran the formal `133-UAT-CHECKLIST.md` against the live app
**https://treasurytracker.empowered.vote** on **2026-07-17** — **34/34 scenarios PASS**:

- **Baseline (D-07), all four munis + Pima County:** 2-level icicle drill-down
  (`Current`/`Debt service` → children), Money In/Out toggle, per-capita ($/resident)
  using each city's pinned 2024 population (Oro Valley 48,855 / Marana 62,380 /
  Sahuarita 37,448 / South Tucson 4,535), source chips resolving to the correct-per-FY
  ACFR, `US → Arizona → Pima County → <municipality>` breadcrumb, and the Cities-in-County
  panel listing all five munis (Tucson + the four new) together under Pima.
- **Extra (D-08):** Arizona state node regression (v2.14 ACFR undisturbed); year switcher
  + honest per-FY labels across FY2024/FY2021/FY2019; Oro Valley's `-table`
  glyph-cleanup labels (Transit / Interest / investments) display cleanly with values
  intact; South Tucson FY2023/FY2024 absence renders as a clean empty state (no
  broken/empty render, no phantom zero row).

See `133-UAT-CHECKLIST.md` for the full per-scenario record and sign-off.

### PIMA-09 — Essentials tether confirmed (PASS)

**Determine-then-confirm (D-09):** `scripts/verify-phase133-tether.mjs` pre-determined,
from the live `coverage.json` (fetched 2026-07-17, `fetched_ok`, generated
`2026-07-17T17:10:21.568Z`), that **all four municipalities are COVERED** — Oro Valley
(GEOID `0451600`), Marana (`0444270`), Sahuarita (`0462140`), South Tucson (`0468850`) —
icon expected on all four banners, **no cross-repo gap** (D-10 not triggered for any of
the four). Chris's live UAT (scenarios g1–g5) **confirmed the prediction**: the
Essentials tethered icon renders on all four municipality banners and deep-links each
correctly into Essentials. Prediction + verdict: `133-TETHER-VERDICT.md`.

## External-service note (unchanged from 129/130)

The icicle / Money-In visual render runs through the external `ev-accounts-api` (not in
this repo) via `src/data/dataLoader.ts`, which is why the visual render is UAT-confirmed
by a human (PIMA-08) rather than machine-asserted. The DB data shape was machine-verified
in Phase 132 and independently re-derived at $0 in this phase (PIMA-07).

## Outstanding Gaps

None. No new data, no new FYs (South Tucson FY2023/FY2024 not yet published — honest
boundary), no schema/RPC/frontend change. Deferred items (Pima County's own budget,
all-funds view, salaries, additional Maricopa/other AZ cities) remain out of scope per
`.planning/REQUIREMENTS.md` (Future Requirements / Out of Scope).

## Result

**Phase 133 PASSED — 3/3 requirements verified (PIMA-07, PIMA-08, PIMA-09).** This closes
the v2.18 Pima County Municipalities milestone.
