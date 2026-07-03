---
phase: 115-deepening-recoverable-holes-pre-gasb-34-extractor-deep-02-de
verified: 2026-07-03T15:46:09Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Pre-GASB-34 basis label is visibly distinct from the GAAP label in the live app UI"
    addressed_in: "Phase 116"
    evidence: "Phase 116 success criterion 3: 'Live-app UAT across a representative sample of upgraded states + deepened history years (revenue-by-source, spending-by-function, basis labels incl. pre-GASB-34, source chips, Money In, year selector reaching deepened years) — Chris sign-off.'"
---

# Phase 115: Deepening — Recoverable Holes + Pre-GASB-34 Extractor Verification Report

**Phase Goal:** The v2.13 recoverable history holes are filled — modern-era gaps (MA FY2001/02/04/05/14/21, CT FY2006 OCR, NJ pre-FY2020) plus CT/WI pre-GASB-34 years via a new extractor with an honest basis label — or documented unrecoverable.
**Verified:** 2026-07-03T15:46:09Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a data-loading/ETL phase, not a UI feature phase. Verification was performed by (1) reading all three PLAN/SUMMARY/LOADLOG files, (2) independently querying the live Supabase `treasury.budgets` table (read-only) for all four state nodes (NJ, CT, WI, MA) and comparing every returned row's `total_budget` and `data_source` against the values claimed in each loadlog, (3) independently re-running all 8 touched loaders in `--dry-run` mode (no writes) and comparing console TIE/SKIP output against the loadlogs, (4) independently querying `treasury.data_sources` for residue on the `nj-acfr-%`, `ct-acfr-%`, `wi-acfr-%`, `ma-acfr-%` dataset_id patterns, and (5) grepping the touched files for required artifact patterns, debt markers, and the WR-05 code-review finding. No live writes were performed. All independent checks matched the SUMMARY/LOADLOG claims exactly — no discrepancies found.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A pre-GASB-34 extractor (`scripts/pre34Extract.mjs`) exists, is committed, parses the "Combined Statement...All Governmental Fund Types" format, and rejects sibling confounders | ✓ VERIFIED | File exists (173 lines, exceeds min_lines:60), exports `extractPre34GeneralFund(text)` at line 123, anchors on `/Combined Statement of Revenues,?\s+Expenditures,?\s+and\s+Changes in Fund Balances/i` + `/All Governmental Fund Types/i` within a widened window, requires a genuine Revenues:/Total Revenues/Expenditures:/Total Expenditures sequence to reject ToC/statistical-table false matches (per 115-02-CT-WI-LOADLOG.md confounder-rejection section, independently spot-checked against the code) |
| 2 | Every pre-GASB-34 row carries a distinct, honest basis label separate from the GAAP label on the same node | ✓ VERIFIED | Independent DB query: CT FY1988-2001 rows carry `"Connecticut State CAFR — General Fund (FY{fy} actual, pre-GASB-34 combined statement basis)"`; CT FY2002+ carries `"...State ACFR...GAAP basis)"` — visibly distinct on the same node. Same pattern independently confirmed for WI FY2000-2001 (pre-34) vs FY2002+ (GAAP), and MA FY2001 (pre-34) vs all other MA years (GAAP). NJ has no pre-34 rows (correctly — NJ's archive edge is FY2002, GASB-34's first year) |
| 3 | MA FY2001/02/04/05/14/21 recovered or documented unrecoverable with reason | ✓ VERIFIED | Independent dry-run of `processMAAcfr.js` (no args) reproduces the loadlog exactly: `FY2001: TIE`, `FY2002: SKIP (statement not parseable)`, `FY2003: TIE` (pre-existing), `FY2004: SKIP (exp sum ≠ total, diff > TOL)`, `FY2005: SKIP (same)`, `FY2014: TIE`, `FY2021: SKIP (statement not parseable)`. 115-03-MA-LOADLOG.md documents specific root causes for all 4 unrecovered years (dot-leader digit-interleaving corruption for 2002/04/05; document-wide font-cipher corruption for 2021) with diagnostic evidence (byte samples, gap-length audits) |
| 4 | CT FY2006 recovered via free OCR path, ties to printed GF totals, carries normal GAAP label | ✓ VERIFIED | Independent DB query: CT FY2006 present, `total_budget=13,924,122,000`, `data_source` contains `"GAAP basis"` (distinct from adjacent pre-34 FY2001/GAAP FY2007). Independent dry-run `--fy 2006` reproduces `TIE (12 functions, diff 0) Total Exp $13,924,122,000` exactly. Loadlog documents OCR provenance (pdftoppm 300dpi + tesseract 5.4, page 40/164, all 21 leaf rows cross-tied against printed row totals) |
| 5 | NJ pre-FY2020 years recovered, tying exactly, or documented unrecoverable | ✓ VERIFIED | Independent DB query: NJ has 24 continuous operating + 24 revenue rows, FY2002-2025, 0 holes. Independent dry-run of both NJ loaders reproduces every total exactly. NJ correctly has no pre-GASB-34 boundary (its archive's earliest year, FY2002, is already GASB-34-format) — loadlog documents this as the archive's own edge, not an omission |
| 6 | CT/WI pre-GASB-34 years load via the extractor as deep as durable URLs allow, each tying to printed totals | ✓ VERIFIED | Independent dry-run: CT 38/38 years (FY1988-2025) TIE with diff 0 on every pre-34 year; WI 26/26 years (FY2000-2025) TIE within TOL=5 (WI FY2001 diff -2, documented as the same GAAP-rounding class already present in WI's modern series). WI pre-FY2000 explicitly out-of-scope (4-section multi-file era) and recorded as such, not silently dropped |
| 7 | All deepening writes are idempotent + never-overwrite; existing modern-era rows untouched; re-run writes 0 rows | ✓ VERIFIED (DB state + dry-run corroborate; live re-run not independently re-executed per instructions) | Independent DB query confirms every modern-era row's `total_budget` matches the loadlogs' claimed pre/post baselines exactly (spot-checked NJ FY2024=59,174,201,425; CT FY2024=23,588,666,000/FY2025=25,072,796,000; WI FY2024=35,985,572,000; MA FY2024=52,754,896,000 — all match). Dry-run re-derivation of all 4 states' full year ranges reproduces the same totals with 0 discrepancy, consistent with idempotent UPDATE-in-place. Live write-based re-run test was not independently re-executed (verifier instructed not to perform live writes) — this sub-claim rests on the loadlog's documented re-run evidence, corroborated by the dry-run reproducibility and the residue check below |
| 8 | 0 `data_sources` residue for nj-acfr-%/ct-acfr-%/wi-acfr-%/ma-acfr-% dataset_ids | ✓ VERIFIED | Independent live query of `treasury.data_sources` confirms 0 rows for all four `%-acfr-%` patterns, matching every loadlog's claim |
| 9 | Requirements DEEP-02, DEEP-03, DEEP-04 accounted for, no orphans | ✓ VERIFIED | REQUIREMENTS.md maps all three to Phase 115, marked `[x]` complete. PLAN frontmatter: 115-01 declares DEEP-03; 115-02 declares DEEP-02/DEEP-03/DEEP-04; 115-03 declares DEEP-03. All three IDs are covered by at least one plan; no REQUIREMENTS.md ID mapped to Phase 115 is absent from any plan's `requirements:` field |

**Score:** 9/9 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Basis label (incl. pre-GASB-34) visually confirmed distinct in the live app UI | Phase 116 | Phase 116 success criterion 3 explicitly names "basis labels incl. pre-GASB-34" as part of its live-app UAT scope. The underlying plumbing (frontend renders `data_source`/`data_source_info` generically, already used for GAAP labels since Phase 108) is unchanged by this phase and applies to any string value in the `data_source` column, so this is a rendering mechanism that already exists — only the live-app visual sign-off is explicitly deferred by the roadmap itself, not a gap introduced by this phase |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/pre34Extract.mjs` | Reusable pre-GASB-34 extractor, exports `extractPre34GeneralFund`, contains "All Governmental Fund Types", min 60 lines | ✓ VERIFIED | 173 lines; export confirmed at line 123; anchor string present (5 occurrences) |
| `scripts/processNJAcfr.js` | Extended with pre-FY2020 URL map, contains "fr.shtml" | ✓ VERIFIED | Contains "fr.shtml" (3x); dry-run confirms 24 years TIE |
| `scripts/processNJRevenueAcfr.js` | Same, contains "clampForRender" | ✓ VERIFIED | Contains "clampForRender" (3x); dry-run confirms 24 years TIE |
| `scripts/processCTAcfr.js` | Pre-34 + FY2006 OCR routing, contains "pre-GASB-34" | ✓ VERIFIED | Contains "pre-GASB-34" (5x); dry-run confirms 38 years TIE |
| `scripts/processWIAcfr.js` | Pre-34 routing, contains "pre-GASB-34" | ✓ VERIFIED | Contains "pre-GASB-34" (4x); dry-run confirms 26 years TIE |
| `scripts/maAcfrExtract.mjs` | Per-year handling for FY2014/2021 anchor variants, contains "extractMAGeneralFund" | ✓ VERIFIED | Function present (3 occurrences); dry-run confirms FY2014 recovered |
| `scripts/processMAAcfr.js` | Recovered years + basis label, contains "clampForRender" | ✓ VERIFIED | Contains "clampForRender" (3x); dry-run confirms FY2001 pre-34 label + FY2014 GAAP |
| `115-01-NJ-LOADLOG.md` | Per-FY disposition, units verification, idempotency/residue evidence | ✓ VERIFIED | Contains "Load Disposition" table for all 24 FYs, units-verification section, idempotency section |
| `115-02-CT-WI-LOADLOG.md` | Per-FY disposition CT+WI, OCR evidence, basis-label proof | ✓ VERIFIED | Contains "Load Disposition" tables, OCR provenance section, basis-label spot-check table |
| `115-03-MA-LOADLOG.md` | Per-FY disposition for all 6 holes, regression table | ✓ VERIFIED | Contains "Load Disposition" table covering all 6 target FYs + regression table for 19 pre-existing years |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `pre34Extract.mjs` | `processCTAcfr.js`/`processWIAcfr.js`/`processMAAcfr.js` | import for pre-34 years only | ✓ WIRED | Grep + dry-run confirm CT FY1988-2001, WI FY2000-2001, and MA FY2001 route through the shared extractor and produce distinct pre-34-labelled rows; modern years unaffected |
| NJ/CT/WI/MA loaders | `treasury.budgets` | `treasury_sync_budget_tree` RPC + post-RPC stamp UPDATE | ✓ WIRED | Independent DB read confirms all rows present with correct totals + labels + source_url/source_date populated |
| pre34Extract.mjs lookahead widening | CT/WI dependent loaders | strict-superset regression | ✓ WIRED (no regression) | Independent dry-run of CT (38/38) and WI (26/26) after the 115-03 widening confirms 0 regression |

### Data-Flow Trace (Level 4)

Not applicable in the traditional sense (this phase has no rendering component) — the equivalent trace is DB-row-to-loader-output, performed above: independent DB query values were compared byte-for-byte against independent dry-run re-derivation values for all 4 states across all fiscal years, with 100% agreement.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| NJ loader dry-run reproduces DB totals | `node scripts/processNJAcfr.js --dry-run` | All 24 years printed, totals match DB exactly | ✓ PASS |
| CT loader dry-run reproduces DB totals, 38/38 TIE | `node scripts/processCTAcfr.js --dry-run` | 38 years, diff 0 on every year | ✓ PASS |
| WI loader dry-run reproduces DB totals, 26/26 TIE | `node scripts/processWIAcfr.js --dry-run` | 26 years, all within TOL=5 | ✓ PASS |
| MA loader dry-run reproduces DB totals + honest holes | `node scripts/processMAAcfr.js --dry-run` | FY2001/2014 TIE; FY2002/2004/2005/2021 SKIP (matches loadlog) | ✓ PASS |
| CT FY2006 OCR-embedded year ties in isolation | `node scripts/processCTAcfr.js --dry-run --fy 2006` | `TIE (12 functions, diff 0) $13,924,122,000` | ✓ PASS |
| `data_sources` residue = 0 for all 4 states | Supabase query `like dataset_id, '%-acfr-%'` | 0 rows for nj/ct/wi/ma patterns | ✓ PASS |
| `--fy` value validation (Phase-114 hardening) | `node scripts/processNJAcfr.js --fy 1999 --dry-run` | Exit 2, "not a loadable fiscal year" message | ✓ PASS |
| Strict parseArgs (Phase-114 hardening) | `node scripts/processNJAcfr.js --dryrun` (typo) | Exit 2, "Unknown option '--dryrun'" | ✓ PASS |
| Revenue-side dry-runs for all 4 states | `node scripts/process{NJ,CT,WI,MA}RevenueAcfr.js --dry-run` | All reproduce loadlog totals/holes exactly | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEEP-02 | 115-02 | Pre-GASB-34 extractor with honest basis label | ✓ SATISFIED | `pre34Extract.mjs` committed, working, basis label distinct in DB (independently verified) |
| DEEP-03 | 115-01, 115-02, 115-03 | Modern-era hole recovery (MA/CT2006/NJ) | ✓ SATISFIED | NJ 0 holes; CT2006 recovered; MA 2/6 recovered with 4/6 documented unrecoverable (per the requirement's own "or documented unrecoverable" clause) |
| DEEP-04 | 115-02 | CT/WI pre-GASB-34 years via the extractor | ✓ SATISFIED | CT 14 pre-34 years + WI 2 pre-34 years, all tying, independently reproduced via dry-run |

No orphaned requirements — REQUIREMENTS.md maps only DEEP-02/03/04 to Phase 115, and all three appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/processNJAcfr.js` | 29-30 | Comment references `isolateNJStatement()` "below" — function does not exist anywhere in committed code (confirmed via grep; only exists as prose in `115-01-NJ-LOADLOG.md`) | ℹ️ Info (code-review WR-05, carried forward) | Does not falsify any must_have (NJ's data is correctly extracted and tied — independently verified in DB); a future maintainer extending NJ would need to reconstruct the false-positive guard from the loadlog rather than the code. Not a blocker per the environment notes' guidance that review findings are advisory unless they falsify a must_have |
| 6 loader files (CT/WI/MA pairs) | various | `process.exit(2)` inside `try` bypasses `finally` ephemeral-cleanup (WR-01); source-stamp update error unchecked (WR-02) | ℹ️ Info (code-review, advisory) | Self-healing on next run (delete-by-dataset_id pre-step) and does not affect the actual loads performed in this phase (independently confirmed 0 residue, correct labels in DB for every row written). Per environment notes, these error-path defects don't falsify the phase's must_haves for the loads actually performed |

No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found in any of the 10 touched files.

### Human Verification Required

None required to determine phase status. The one item that benefits from human eyes (basis-label visual distinctness in the live app) is explicitly assigned to Phase 116's UAT scope by the roadmap itself (see Deferred Items above), not left ambiguous by this phase.

### Gaps Summary

No gaps. All 9 derived observable truths (roadmap's 4 success criteria + phase-level DB/idempotency/requirements truths) verified independently against the live database and via independent dry-run re-execution of every touched loader — not merely SUMMARY.md self-report. One item (live-app visual confirmation of basis labels) is correctly deferred to Phase 116 per the roadmap's own success-criteria split, not a gap in this phase.

---

_Verified: 2026-07-03T15:46:09Z_
_Verifier: Claude (gsd-verifier)_
