---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
fixed_at: 2026-07-02T21:20:00Z
review_path: .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 114: Code Review Fix Report

**Fixed at:** 2026-07-02T21:20:00Z
**Source review:** .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (fix_scope: critical_warning — WR-01..WR-07; 0 Critical)
- Fixed: 7
- Skipped: 0

All fixes were made in an isolated git worktree on a temp branch, verified per-fix (node --check + full `--dry-run` re-runs of every affected loader), committed atomically per finding, then fast-forwarded onto `main` (8d23efa → 6f393c4). Working tree left clean; worktree, temp branch, and recovery sentinel all removed.

## Fixed Issues

### WR-01: UT FY2020 trailing-space category name

**Files modified:** `scripts/processUTAcfr.js`
**Commit:** 5176f38
**Applied fix:** Removed the trailing space from `'Health and Environmental Quality '` in the FY2020 EXPENDITURES block so the label matches every other UT year. **Production data corrected in place:** ran `node scripts/processUTAcfr.js --fy 2020` live (idempotent (muni,fy,'operating') key); verified by read-only select that the FY2020 `budget_categories` row now reads exactly `"Health and Environmental Quality"` (byte-identical to FY2019/FY2021) with total intact ($8,079,513,000), source stamp intact, and 0 `data_sources` residue. The generator's buildTree was also hardened with `cat.name.trim()` (see generator note below).

### WR-02: AL "Interest and Other Changes" FY2018–2025 — VERIFIED as the genuine source label; no data change

**Files modified:** `scripts/processALAcfr.js` (comment only)
**Commit:** 6cfc208
**Applied fix:** Verified against the pdftotext output in `_acfr-work/al/AL2016.txt`–`AL2025.txt` per the review's instruction: the Governmental Funds Statement of Rev/Exp/Changes in Fund Balances **genuinely prints "Interest and Other Changes" from FY2018 onward** — the GF values on those exact lines (255, 244, 233, 247, 808, 928, 1,058, 1,305 thousands) match the loader year-for-year. Crucially, *other* statements in the same PDFs (government-wide, fiduciary, component-unit pages) still print "Charges" correctly, and surrounding words on the same page decode correctly — so this is Alabama's own caption typo copied forward for 8 years, not a glyph/extraction defect. FY2002–FY2017 print "Charges" on the same statement, matching the loader. **No label or production data change** (production rows are faithful transcriptions of the printed source). Added a four-line comment at the FY2018 block documenting the verification so the flip is never "corrected" to Charges or re-opened.

### WR-03: KY header comment claimed FY2023 NASBO row is replaced

**Files modified:** `scripts/processKYAcfr.js`, `scripts/processKYRevenueAcfr.js`
**Commit:** 2020925
**Applied fix:** Operating header line 8 now reads "…for FY2024 only; FY2023 NASBO row intentionally retained (see HONEST HOLE below); other FYs net-new." Note the revenue file's line 8 did NOT carry the review's quoted text (it says "Revenue is NEW … pure insert" — the reviewer's "same text at :8" was inexact); adapted per fix_strategy by appending "; FY2023 intentionally absent (see HONEST HOLE below)" there instead. Both now consistent with 114-02-KY-LOADLOG.md.

### WR-04: Ephemeral data_sources row leaked on every error path

**Files modified:** all 10 — `scripts/process{SC,KY,UT,AL,LA}{Acfr,RevenueAcfr}.js`
**Commit:** fba8977
**Applied fix:** Wrapped the per-FY write loop in `try { … } finally { if (!dryRun && ds) await supabase…delete().eq('id', ds.id); }` and converted every in-loop `process.exit(2)` (validation, RPC error, RPC-payload error, stamp failure, missing-row) to a thrown `Error` carrying the FY, so the finally block always deletes the ephemeral row before `main().catch` exits 2. A one-off failed run can no longer leave permanent residue.

### WR-05: parseArgs strict:false let a mistyped --dry-run perform a live production write

**Files modified:** all 10 loaders
**Commit:** abb37f5
**Applied fix:** `strict: true, allowPositionals: false`. Negative-tested: `node scripts/processSCAcfr.js --dryrun` now exits 2 with `Fatal: Unknown option '--dryrun'` before any Supabase client is created; legitimate `--dry-run` and `--fy` still work.

### WR-06: Per-year validation inside the write loop could abort mid-run leaving a partial load

**Files modified:** all 10 loaders
**Commit:** 97dfa1c
**Applied fix:** Added an up-front gate immediately after `years` is computed (before the Supabase client and data_sources row exist): `for (const fy of years) { if (DATA[fy] && !validate(fy)) { …; process.exit(2); } }` (DATA = EXPENDITURES or REVENUE per file). Removed the now-redundant in-loop validate. Negative-tested on a scratch copy with a corrupted FY2019 total (diff −100 > tolerance 10): aborts with exit 2 before any write-path output.

### WR-07: Stamp-lookup select error swallowed and misreported as a missing row

**Files modified:** all 10 loaders
**Commit:** 6f393c4
**Applied fix:** Destructured `error: selErr` from the budgets stamp-lookup `maybeSingle()` and added `if (selErr) throw new Error(\`FY${fy} stamp lookup failed: ${selErr.message}\`);` before the `bud?.id` check — transient network/DB errors now surface with their real message (and trigger the WR-04 finally cleanup) instead of the misleading "Could not find FY{fy} budget row" path.

## Verification

- **Per-fix:** re-read + `node --check` on every touched file; full `--dry-run` of all 10 loaders after every template-level change.
- **Final (post-WR-07, from main tree at 6f393c4):** all 10 loaders `--dry-run` exit 0 with every FY tying PASS — SC 24/24, KY 23/23 (FY2023 honest hole), UT 7/7, AL 24/24, LA 24/24 (per dataset, operating + revenue each).
- **Live path exercised with final template code:** `node scripts/processUTAcfr.js --fy 2020` (idempotent re-run) — RPC write, stamp lookup (WR-07 path), source stamp, and try/finally cleanup (WR-04 path) all succeeded; read-only select confirmed row totals/stamp/label intact and 0 data_sources residue.

## Generator mirrored (not committed — gitignored)

All template-level fixes were mirrored into `_acfr-work/gen_state.py` so Phase 115+ generated states are born fixed: `strict: true, allowPositionals: false` (WR-05), up-front all-years validation gate (WR-06), try/finally ephemeral cleanup with exits→throws (WR-04), `error: selErr` stamp-lookup check (WR-07), and `cat.name.trim()` in buildTree (WR-01 hardening). Verified with `ast.parse` — parses clean. `_acfr-work/` is gitignored, so this change lives only on disk by design.

## Notes for verifier

- WR-01 and the WR-04..07 template changes touched the live write path; the UT FY2020 live re-run above is the production-path proof. The other 9 loaders' live paths are byte-identical template code (verified by uniform codemod with asserted occurrence counts).
- WR-02 required no production change — the 8 "Changes" rows in production are faithful to the printed source.
- Info findings (IN-01..IN-07) were out of scope (fix_scope: critical_warning) and remain open; IN-04's shared-lib extraction is the natural Phase 115 home for them.

---

_Fixed: 2026-07-02T21:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
