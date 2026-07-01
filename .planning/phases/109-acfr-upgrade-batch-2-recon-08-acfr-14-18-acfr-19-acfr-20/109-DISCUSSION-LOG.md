# Phase 109: ACFR Upgrade — Batch 2 (TN, CT, WI, WA, MI) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 109-acfr-upgrade-batch-2-recon-08-acfr-14-18-acfr-19-acfr-20
**Areas discussed:** History depth, MI September-30 handling, Extractor approach

---

## History Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full attempt, drop+log holes (match 108) | Attempt fullest window per state — TN FY2009–2025, push CT/WI into deep enumerable histories (FY1988/FY2000), loading every year that ties, logging holes. 108's D-01. | ✓ |
| Verified windows only | Load only recon-extraction-verified windows (TN FY2009–2025, CT/WI/WA/MI recent-only). Lower risk/effort; deep history deferred. | |
| Full for TN, verified for the rest | TN full 17yr; cap CT/WI/WA/MI at verified recent windows. Middle ground. | |

**User's choice:** Full attempt, drop+log holes (match 108)
**Notes:** The 108 generalized parser (which recovered bonus years for MA→19yr and NC→14yr) makes the deep windows tractable. Honesty guard from 108 D-01 applies: attempt every year, never force a bad tie; deep CT/WI enumerable-but-unverified years self-limit by extraction success (no artificial floor).

---

## MI September-30 handling

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated processMIAcfr.js + honest relabel | MI-specific loader: fiscal_year_start_month=10, source_date={FY}-09-30, FY labels aligned to NASBO calendar-year designation, GF=Fund 10; prominently relabel the ~3.56× federal-passthrough divergence. Recon's recommended approach. | ✓ |
| Reuse generalized parser with MI config | Extend maAcfrExtract.mjs with MI's Sep-30 date config rather than a bespoke loader. | |

**User's choice:** Dedicated processMIAcfr.js + honest relabel
**Notes:** MI is the tranche's one structural exception (Sep-30 FY-end vs Jun-30 everywhere else) and the largest scope divergence (~$30.3B Medicaid/ARP federal passthrough inside GAAP GF). The dedicated loader may still wrap the generalized parser core (Claude's discretion) as long as the Sep-30 semantics hold.

---

## Extractor approach

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse generalized parser for all 5 | Default all states to extractGovFundGeneralColumn (GF-column-only, exact per-FY tie). Avoids the multi-column-sum trap (CT 7-col) and makes deep TN/CT/WI windows feasible. | ✓ |
| Parser default, hand-transcribe as fallback | Prefer the parser but allow per-state hand-transcription where layout defeats it. | |

**User's choice:** Reuse generalized parser for all 5
**Notes:** This is the 108 mold evolution — the shared parser (built for MA, reused for NC) replaced pure hand-transcription. Hand-transcription remains an implicit fallback only if a state's layout defeats the parser (as MA's dept-level lines needed special handling in 108).

## Claude's Discretion

- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l` bounds, `-table` cleanup).
- Ordering of the 5 per-state plans (109-01..05); whether revenue + spend are one plan-step or two per state.
- Whether MI's dedicated loader is a fresh file or a thin MI-configured wrapper around the parser core.
- Load-time recon-correction (URL/structure re-verification) is expected, not a deviation.

## Deferred Ideas

- Pre-verified-window history: WA pre-FY2020, MI pre-FY2019, TN pre-FY2009, CT pre-FY1988, WI pre-FY2000 (future deepening pass; deep CT FY1988+/WI FY2000+ enumerable history is in-scope this phase via D-01 attempt+drop/log).
- Batch-1 honest holes carried from 108 (MA FY2001/2002/2004/2005/2014/2021) — future MA deepening pass.
