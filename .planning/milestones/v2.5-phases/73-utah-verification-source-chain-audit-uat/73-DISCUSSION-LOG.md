# Phase 73: Utah Verification + Source-Chain Audit + UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 73-utah-verification-source-chain-audit-uat
**Areas discussed:** ACFR recon sample, UAT entity spread, Pre-existing $-leak rows, Durability bar + salaries

---

## Area selection

All 4 surfaced gray areas selected for discussion. The rest (read-only method, prod DB target, $0/free sources, guided-UAT-with-blocking-checkpoint format, 3-plan wave shape) were locked from the Phase 67/62 closeout precedent without re-asking.

---

## ACFR recon sample

| Option | Description | Selected |
|--------|-------------|----------|
| 1 city + 1 county | Provo + Salt Lake County — first-ever UT county ACFR recon + clean city cross-read | ✓ |
| 2 cities + 1 county | SLC + Provo + Salt Lake County — adds SLC airport-fund volatility stress-test | |
| 1 city + 2 counties | Provo + Salt Lake + Utah County — max county-tier coverage | |

**User's choice:** 1 city + 1 county — Provo + Salt Lake County.
**Notes:** SLC + Provo were already operator-reconciled in Phase 69; the untested tier is county governments (70-02 deferred county recon to Phase 73). Provo gives a clean baseline-aligned cross-read; Salt Lake County is the largest/most material county and the milestone's first county ACFR recon.

---

## UAT entity spread

| Option | Description | Selected |
|--------|-------------|----------|
| SLC-anchored | SLC + Salt Lake County (4-city panel) + West Valley City + St. George (Washington Co.) | ✓ |
| Provo-anchored | Provo + Utah County (3 cities) + Orem + Ogden (Weber Co.) | |
| Max breadth (5 entities) | SLC + Provo + Salt Lake + Utah County + Washington — longest walkthrough | |

**User's choice:** SLC-anchored — Salt Lake City, Salt Lake County, West Valley City, St. George.
**Notes:** Exercises a multi-city Cities-in-County panel (Salt Lake County, 4 cities) AND a single-city county (Washington/St. George), the airport-heavy SLC icicle + salaries, a "keeps City" display name (West Valley City) and a renamed one (St. George).

---

## Pre-existing $-leak rows

| Option | Description | Selected |
|--------|-------------|----------|
| Document as follow-up | Honor read-only rule; audit flags the 4 rows + recommends a cleanup follow-up; no writes | ✓ |
| Fix now as exception | 1-line bleed cleanup inside the closeout; breaks read-only purity | |

**User's choice:** Document as follow-up.
**Notes:** The 4 rows (parking meter, harbor/port, sewer, solid waste) are pre-existing 2026-03-28 AI enrichment, NOT Phase 72 output. Keeping Phase 73 100% read-only; the fix becomes its own tracked item.

---

## Durability bar + salaries

| Option | Description | Selected |
|--------|-------------|----------|
| Bare domain passes | transparent.utah.gov on every row meets the durable bar; 0 NULL/fragile/residue; salaries share it | ✓ |
| Require deeper deep-links | Flag bare domain insufficient — would fail the load + reopen Phases 69–72 | |

**User's choice:** Bare domain passes.
**Notes:** Utah's uniform single-domain attribution (`https://transparent.utah.gov` on budgets AND salaries) is the Utah norm, not a gap — unlike CA's `/d/` deep links + publicpay split. Audit also re-asserts the names-free PII guard (0 PII tokens across the 120 salary rows' stored hierarchy).

---

## Claude's Discretion

- Exact ACFR statement line used as the basis-matched comparator per entity (Provo, Salt Lake County) + the tolerance band + the chosen recon FY per entity.
- Order of audit probes.
- Precise UAT checklist wording/ordering and the exact FY each step lands on, within the locked entity set + coverage.

## Deferred Ideas

- 4 pre-existing $-leak enrichment rows → bleed-safety cleanup follow-up (D-73-07).
- Any recon variance / render defect found → documented follow-up, not fixed here.
- 124 deferred single-city salary dept enrichments + 77 generic general_fund fallthroughs (Phase 72 long tail).
- v2.4 follow-ups (SoCal ACFR cross-read; FUP-01..03).
- Milestone retrospective + archive → /gsd-complete-milestone after Phase 73 closes.
