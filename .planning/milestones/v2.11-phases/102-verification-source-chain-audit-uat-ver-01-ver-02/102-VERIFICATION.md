---
phase: 102-verification-source-chain-audit-uat-ver-01-ver-02
status: passed
verified: 2026-06-29
method: goal-backward (inline — this is itself the verification phase; results are first-party + Chris-signed)
---

# Phase 102 Verification — Verification + Source-Chain Audit + UAT

**Phase goal:** Prove the v2.11 ACFR upgrade is real, independently sourced, and residue-free across the whole 50-node cohort, then earn Chris's live sign-off.

**Verdict: PASS.** All three ROADMAP success criteria met; both requirements (VER-01, VER-02) satisfied.

## Success criteria (goal-backward)

### SC1 — Independent reconciliation from each state's own ACFR (not loader self-report)
**MET.** `scripts/verify-phase102-rederive.mjs` (102-01) re-reads the printed GF "Total revenues"/"Total expenditures" from each ACFR PDF via its own `pdftotext -table` pass (imports zero `process*.js` loaders) and compares to the stored `treasury.budgets` totals. **16/16 checks PASS with delta = $0 (exact)** — newest displayed FY + oldest bookend × {revenue, operating} for CA/TX/NY/FL. No rounding fallback needed.

### SC2 — Full 50-node cohort source-chain audit clean; every displayed row basis-labelled; NASBO states still pass
**MET.** `scripts/verify-phase102-cohort-audit.mjs` (102-02) exits 0 with **7/7 invariants PASS**:
- INV-1 NULL-basis: 200/200 state rows carry data_source + source_url + source_date.
- INV-2 residue: **0** stale state `*-gf-*` data_sources (145 deleted — 98 legacy/ACFR-mirror + 47 `*-gf-operating-nasbo` per D-05; un-scoped check proves genuine 0 residue).
- INV-3 out-of-window: 0. INV-4 dup: 0. INV-5 orphan: 0.
- INV-6 ACFR-GAAP-on-4: 58/58 CA/TX/NY/FL operating+revenue rows GAAP-labelled.
- INV-7 NASBO-untouched: 86 rows across 43 NASBO states intact, NASBO provenance, operating-only.

### SC3 — Live-app UAT across the 4 upgraded nodes + Chris sign-off
**MET.** 102-03: prod deploy live (HTTP 200); NY FY2024 Money In $93.894B with 6 by-source rows; FL FY2022 clamp labels ("(net loss — shown at 0)"); honest ACFR-GAAP basis labels; source chips (url + date) via data_source_info; Colorado (NASBO) Money In disabled + deep-link fallback. **Chris signed off 2026-06-29.**

## Deviations
- **D-05 residue correction (Chris-approved):** the initial 102-02 run kept the 47 `*-gf-operating-nasbo` rows and scoped them out of INV-2. Verified all state budgets use text-stamp provenance (data_source_id=null; source chips render from the text stamp, unaffected), surfaced the divergence to Chris, who chose to delete them. The 47 were deleted (0-row guarded) and INV-2 un-scoped → genuine 0 residue. (commit 7eba1b7)

## Scope notes (not defects)
- Empty `hierarchy` field on the budgets-list endpoint is an unused denormalized column; the app renders trees from `/treasury/budgets/{id}/categories` (verified populated).
- Flat revenue-tree no-drill-down + TX GR-Fund ~3× NASBO scale = accepted limitations, not defects.
- Coverage windows frozen as loaded (D-11); deeper history deferred to the "State ACFR Long Tail" follow-up.

## Evidence honesty
VER-02 evidence was gathered at the production API/data + code layer (Claude drives, per D-08); visual confirmation + sign-off authority was Chris's. Chris signed off.
