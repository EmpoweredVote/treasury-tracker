# Phase 110 Verification — Verification + Source-Chain Audit + UAT (VER-05, VER-06)

**Verified:** 2026-07-01 · **Method:** goal-backward against the 3 ROADMAP success criteria; all assertions from live harness runs + live-DB checks + Chris's live-app UAT
**status: passed**

**Phase goal:** Every upgraded state is independently reconciled, the full cohort stays clean, and Chris signs off in the live app.

## Success Criterion 1 — Loader-independent blind re-derivation, exact $0 (not loader self-report)

`scripts/verify-phase110-rederive.mjs` (imports ZERO loaders, ZERO maAcfrExtract parser; own
statement locator + GF-column re-key) blind-re-extracted the printed GF totals from 26 source
ACFR PDFs and diffed against live `treasury.budgets`:

- **49/49 FY-dataset checks tie at exactly $0** — bookends (oldest FY + FY2025) × both datasets
  for all 10 states, 3 documented random middles (MA FY2016, NC FY2019, TN FY2017), all 4 clamp
  years (MD FY2022, CT FY2013, WI FY2013, WA FY2022 — printed root nets the negative, matching
  stored total_budget).
- Exact-0 bar, no tolerance band; NJ full-dollars unit and MI Sep-30 FY keys confirmed.
- Log: `110-REDERIVATION.md` (includes the honesty record of 4 harness-side false deltas that
  were locator bugs, fixed in-harness — DB correct throughout). Harness exits 0. **PASS**

## Success Criterion 2 — Full 50-node cohort audit clean; NASBO states pass; idempotent re-run 0 rows

`scripts/verify-phase110-cohort-audit.mjs` (read-only, exit 0/2) — **10/10 invariants PASS**:

- 0 NULL-basis (506/506 rows carry data_source + source_url + source_date), 0 residue,
  0 out-of-window (19 ACFR windows + NASBO 2023–2024), 0 dup, 0 orphan.
- 19 ACFR states = 444 rows all ACFR-GAAP-labelled, 0 NASBO labels; 31 un-upgraded NASBO states
  untouched (exactly 2 NASBO operating rows each; CO control confirmed).
- INV-8 window-integrity: each tranche-2 state's exact FY set matches its loadlog (MA 19,
  NC 14 post-colon-fix; holes MA FY2014/FY2021/FY2001-02/04-05 + CT FY2006 absent BY DESIGN);
  INV-9 MI Sep-30 semantics (14/14 rows); INV-10 GA F-97-01 supersede ($59,893,783,000, 0 NASBO).
- Idempotency: NJ FY2025 re-run "Loaded 0 rows" ×2; MI FY2025 re-run DB-verified 0 net change.
- WR-05 residue re-check (the v2.12 lesson, now a mandatory step): 20 unreferenced
  `*-acfr-gf-*` data_sources artifacts found and deleted in one guarded pass (Phase 106 D-05
  precedent); re-run clean. Report: `110-COHORT-AUDIT.md`. **PASS**

## Success Criterion 3 — Live-app UAT, representative sample, Chris sign-off

`110-UAT-CHECKLIST.md` — production confirmed HTTP 200; 11 anchors (one per upgraded state, each
exercising a distinct verified risk case + the CO NASBO regression control), each checking
revenue-by-source + spending-by-function + basis label + source chip + Money In:

- **Chris signed off "all pass" 2026-07-01 — 11/11 anchors PASS, 0 defects.** Highlights
  exercised live: NJ $61B magnitude (dollars unit), MA hole honesty (year selector skips
  FY2014/FY2021), GA supersede ($59.9B not $29.3B), all 3 clamp labels rendered "(net loss —
  shown at 0)" with roots intact, MI 2025-09-30 source date + 3.5× relabel, CO Money-In-disabled
  fallback. Checklist frontmatter `status: passed`. **PASS**

## Requirements coverage

| Req | Result |
|-----|--------|
| VER-05 | ✅ Complete — independent re-derivation 49/49 exact $0 (Plan 01) + cohort audit 10/10 clean, idempotent, basis-labelled, NASBO states pass (Plan 02) |
| VER-06 | ✅ Complete — live-app UAT 11/11 all-pass, Chris sign-off recorded (Plan 03) |

## Notable deviations (all documented in plan SUMMARYs)

1. MA/NC windows corrected per post-plan loadlog UPDATEs (colon fix): MA 19 FYs (FY2003–2025),
   NC 14 FYs (FY2012–2025) — tranche-2 total 250 rows, not the 242 in the plan drafts.
2. Harness locator whitespace-normalization fix (4 WI false deltas, self-caught; no data change).
3. MI idempotency reports "Loaded 1" (RPC update-in-place) vs NJ's "Loaded 0 rows" — DB-asserted
   0 net change; reporting difference only.

## Follow-ups (logged, not gating)

- WR-05 loader debt stands: every `process*Acfr.js` run re-creates its 2 unreferenced
  data_sources rows; future audits will re-flag them until the loaders' upsert is made atomic
  (or the vestigial entry write is removed). Cosmetic — display provenance is text-stamped.
- Recoverable holes for a future deepening pass: MA FY2001/02/04/05/14/21, CT FY2006 (OCR),
  NJ pre-2020, CT/WI pre-2002 (pre-GASB-34 extractor + basis label).
