# Phase 83: Verification + Source-Chain Audit + UAT (Virginia) — Context

**Gathered:** 2026-06-23
**Status:** Executed inline ($0, no subagents per [[feedback_no_research_subagents]]); mirrors the Phase 73 (Utah) / Phase 67 (SoCal) closeout shape.
**Source:** Harness plan-mode plan approved by Chris (`mellow-spinning-sonnet.md`).

<domain>
## Phase Boundary

The v2.7 Virginia milestone closeout. Independently verifies everything Phases 79–82 built (162 entities, 618 budget rows, 73 universal enrichment rows). Three deliverables across 3 plans:
- **83-01 (VAVER-01 part A):** ACFR reconciliation — Alexandria (city) + Fairfax County (county) basis-matched to their published ACFRs, documented/explained tolerance.
- **83-02 (VAVER-01 part B):** full-cohort source-chain durability audit + the one approved in-phase fix (10 state-node NULL source_url rows).
- **83-03 (VAVER-02):** guided live-app UAT (Alexandria + Fairfax County + Herndon) with Chris's blocking sign-off.
</domain>

<decisions>
## Implementation Decisions
- **D-83-01 (sample — LOCKED):** Alexandria + Fairfax County for ACFR recon.
- **D-83-02 (basis):** APA Comparative Report = modified-accrual governmental-funds (Exhibit C total expenditures; Exhibit B Total **Local** Revenue, intergovernmental B-1 excluded per Phase 79). Reconcile to the ACFR within a documented, **explained** tolerance — not penny-exact (Phase 73 precedent: ~±3–5%).
- **D-83-03 (durability bar):** `data.virginia.gov` dataset pages are stable, version-independent, citizen-openable — the durable-human-page bar.
- **D-83-04 (the one write — Chris-approved, "Fix in-phase"):** the 10 Virginia state-node rows had NULL source_url; stamp them with the Virginia DPB source (`https://www.dpb.virginia.gov/budget/`, recorded by `scripts/processVA.js`) so the full cohort is literal 0-NULL. Everything else read-only.
- **D-83-05 (UAT spread — LOCKED):** Alexandria (independent city, standalone), Fairfax County (county node + Localities-in-County panel), Herndon (town → Fairfax County breadcrumb). Pre-flight probe confirmed all three have op+rev FY2024 + correct linkage.
- **D-83-06 (UAT format):** Chris drives the live app at treasurytracker.empowered.vote ([[feedback_app_url]]); agent records pass/fail + sign-off at a blocking checkpoint.
- **D-83-07 (DB target):** production only; reads via mcp/`.env`; the single write applied + re-verified.
</decisions>

<canonical_refs>
- Precedent: `.planning/milestones/v2.5-phases/73-utah-verification-source-chain-audit-uat/` (73-CONTEXT, 73-VERIFICATION).
- `scripts/loadVAEnrichment82.mjs` (`findDollarLeaks`/`findLocalityLeaks`); `scripts/processVA.js` (state-node source).
- `.planning/ROADMAP.md` §Phase 83; `.planning/REQUIREMENTS.md` VAVER-01/02; [[reference_treasury_budgets_probe_columns]].
</canonical_refs>

<deferred>
- The 6 localities absent in all XLSX years (Colonial Heights/Emporia/Hopewell/Norton, Lee/Warren) + Covington/Alleghany null population — known Phase-80 gaps, picked up idempotently on a future re-run.
- Milestone retrospective + archive → `/gsd-complete-milestone` after Phase 83 closes.
</deferred>

---
*Phase: 83-verification-source-chain-audit-uat — context gathered 2026-06-23 (inline)*
