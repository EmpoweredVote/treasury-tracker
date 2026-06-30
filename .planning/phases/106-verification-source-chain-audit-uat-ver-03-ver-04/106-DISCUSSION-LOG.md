# Phase 106: Verification + Source-Chain Audit + UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 106-verification-source-chain-audit-uat-ver-03-ver-04
**Areas discussed:** Re-derivation coverage, Re-derivation method, Tolerance/"explained", UAT anchor set, Discrepancy/fix policy, Hole verdict

---

## Re-derivation Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Risk-weighted sample | Bookends per deepened state + every negative-clamp year + PA/IL bookends + 1–2 random middle years. ~15–20 ties. | ✓ |
| Exhaustive (all added FYs) | Every added state-FY-dataset, ~80 ties. Max confidence, ~5× the surface. | |
| Bookends + negatives only | ~10 ties; leans on load-time validate() for middle years. | |

**User's choice:** Risk-weighted sample
**Notes:** Matches Phase 102's intent (16/16) scaled to v2.12's larger added surface without re-doing all ~40+ datasets. Random-middle-year selection is Claude's discretion but must be documented for reproducibility.

---

## Re-derivation Method (independence)

| Option | Description | Selected |
|--------|-------------|----------|
| Blind re-extract from PDF | Re-run pdftotext -table and re-key the GF column from scratch WITHOUT reading the loader map, then diff vs DB. | ✓ |
| Compare loader-map vs PDF | Read the loader map and check against the PDF visually. Weaker — anchors on the map's numbers. | |
| DB-vs-printed-total only | Confirm DB root total = ACFR printed grand total. Catches gross errors, not line-item typos. | |

**User's choice:** Blind re-extract from PDF
**Notes:** The only method that catches a transposed-digit transcription error; the loader's own validate() checks the map against itself. The Phase 102 standard.

---

## Tolerance / "explained"

| Option | Description | Selected |
|--------|-------------|----------|
| Exact, else explain-or-fix | Exact 0-delta bar; any delta is documented-explanation (restatement/rounding/units) or fixed in-phase. No silent band. | ✓ |
| Fixed % tolerance band | Accept deltas under a threshold (±0.5% / ±$10M) without individual explanation. | |
| Exact only, zero exceptions | Any delta is a fail to fix, even a documented restatement. | |

**User's choice:** Exact, else explain-or-fix
**Notes:** Operationalizes VER-03's "within an explained tolerance" as documented-explanation-or-fix, NOT a numeric band (a band can absorb a real error — the 105 WR-03 concern).

---

## UAT Anchor Set

| Option | Description | Selected |
|--------|-------------|----------|
| Full representative set | PA recent+deep, IL recent+FY2022, NY deep floor (×millions), CA FY2008 floor, FL FY2021 negative, + NASBO control. ~8 anchors. | ✓ |
| New-states + negatives focus | PA + IL + every negative-clamp year only. | |
| One-per-state quick tour | One FY per touched state + a NASBO control. ~6 checks. | |
| You build the list | Claude proposes full candidate list, user picks. | |

**User's choice:** Full representative set
**Notes:** Each anchor checks revenue-by-source + spending-by-function + basis label + source chip + Money In. The NASBO control state is a regression guard that the cohort wasn't disturbed.

---

## Discrepancy / Fix Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Fix data/source errors in-phase; defer cosmetic | Data-correctness + source-chain defects fixed before sign-off (F-97-01 precedent); cosmetic/code-quality logged. | ✓ |
| Fix everything in-phase | Block sign-off until every finding of any severity resolved. | |
| Log all, defer fixes | 106 only audits + reports; all fixes go to a follow-up phase. | |

**User's choice:** Fix data/source errors in-phase; defer cosmetic
**Notes:** Matches Phase 97/102. The 105 code-review WR-01/03/04/05 items are explicitly deferred-not-gated.

---

## Hole Verdict (logged 104 deepening gaps)

| Option | Description | Selected |
|--------|-------------|----------|
| PASS if logged + honest in UI | Hole passes if recorded in the 104 gap log with a reason AND the UI renders the non-contiguous window honestly (no interpolation); audit confirms gap log matches DB. | ✓ |
| PASS but re-attempt first | Re-try extraction on each logged-skipped FY during 106; load if it now ties, else accept as logged PASS. | |
| Flag every hole | Any missing FY must be resolved or explicitly waived before sign-off. | |

**User's choice:** PASS if logged + honest in UI
**Notes:** Honors Phase 104 D-02. An honest, disclosed hole is not a defect; do not re-litigate gaps 104 judged unrecoverable.

---

## Claude's Discretion

- Exact random-middle-year selection within the risk-weighted sample (document which were chosen).
- Exact pdftotext invocation per state/year for blind re-extraction.
- Cohort-audit SQL / query structure (reuse/adapt Phase 102).
- Plan structure / batching for the phase.

## Deferred Ideas

- CA FY2002–FY2007 variant-naming extension (deferred at Phase 104, stays deferred).
- 105 code-review non-blocking follow-ups: WR-01 (clamp root-vs-child invariant), WR-03 (validate() tolerance), WR-04 (arg parsing / dry-run safety), WR-05 (non-atomic data_sources upsert).
- REQUIREMENTS.md traceability hygiene: 4 REQ-IDs (ACFRX-01, ACFRX-02, VOTES-01, SRCSTD-01) in body but missing from Traceability table — reconcile at milestone closeout.
