# 122-01 — California DEEP-05 Load Log

**Executed:** 2026-07-05 (inline, no subagents). **Node:** California STATE `e1007bf5-bac9-4b1c-878e-f6834885f850` (upgraded in place). **$0 AI spend** — `curl` + `pdftotext -table` (poppler 4.00) + `extract_gf.py` only.

## Load Disposition

| FY | URL (Files-ARD/CAFR/) | Rev tie | Exp tie | Op total ($) | Rev total ($) | Op leaves | Rev leaves |
|----|------------------------|---------|---------|--------------|---------------|-----------|------------|
| 2002 | `2002_cafr02.pdf` | **$0 ✅** | $0 ✅ | 73,900,709,000 | **63,942,875,000** | 11 | 13 |
| 2003 | `2003_cafr03.pdf` | $0 ✅ | $0 ✅ | 76,571,568,000 | 66,133,497,000 | 11 | 12 |
| 2004 | `2004_cafr04.pdf` | $0 ✅ | $0 ✅ | 73,714,298,000 | 74,692,896,000 | 11 | 13 |
| 2005 | `2005_cafr05.pdf` | $0 ✅ | $0 ✅ | 80,367,868,000 | 84,280,930,000 | 11 | 12 |
| 2006 | `cafr06.pdf` | $0 ✅ | $0 ✅ | 89,196,958,000 | 93,412,784,000 | 11 | 12 |
| 2007 | `cafr07.pdf` | $0 ✅ | $0 ✅ | 96,186,583,000 | **96,309,497,000** | 11 | 12 |

**Bookends (recon-confirmed, re-verified live):** FY2002 Total revenues **$63,942,875K** and FY2007 **$96,309,497K** both tie at exact $0 (extract_gf.py `rev_tie=True`, `exp_tie=True` on all 6 years). Totals stored **full dollars** (printed thousands ×1,000), matching the pre-existing FY2008–FY2025 rows. No `UNITS` constant.

**Window:** CA extended from FY2008–FY2025 → **FY2002–FY2025 (24 contiguous years)**. No interior holes.

## Honest floor
- **CA ≤FY2001:** documented durable soft-404 floor (SCO returns HTTP-200 `text/html` for every naming variant). **Not attempted, not faked.** FY2002 is the deepest durable tie-able year and is the GASB-34 first year (modern "Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds", column header "General").

## Basis / P2 clamp
- **No pre-GASB-34 flag** — FY2002+ is modern GASB-34 layout, identical shape to FY2008+; `pre34Extract.mjs` not used.
- **No negative GF line** in any of FY2002–FY2007 (investment/interest income positive throughout: FY2002 $768M … FY2007 $562M) → the `clampForRender` P2 path is wired but does not fire for these years. Checked every year, not just bookends.
- Older CA function names transcribed verbatim (e.g. `Resources`, `Correctional programs`, `Tax relief`, `Business and transportation`, `Principal retirement` / `Bond and commercial paper retirement`) — these differ from the modern FY2008+ names and are kept as printed.

## Idempotency + residue (LOAD-01)
- **Idempotency:** re-ran CA `--fy 2002` (op + rev) live → **0 net change** (op 73,900,709,000 / 12 nodes; rev 63,942,875,000 / 14 nodes — identical before/after; no duplicate leaves).
- **data_sources residue:** revenue loader uses the **ephemeral** lifecycle (create → RPC → delete-at-end) → **0 `ca-acfr-gf-revenue` rows** (correct, 0 residue). Operating loader keeps exactly **1** persistent registry row (`ca-acfr-gf-operating`, `fiscal_years` now 24 incl. 2002–2007) — one row per dataset_id, not residue. Cohort-wide 0 orphan/duplicate rows.
- Budget rows carry text-stamp provenance (`data_source` label + `source_url` + `source_date`); `data_source_id` is null by design (matches pre-existing FY2008–FY2025 rows).

## Pre-existing window untouched
- FY2008 op = 98,975,042,000, FY2025 op = 221,826,907,000, FY2008 rev = 97,774,378,000, FY2025 rev = 221,591,201,000 — all **byte-identical** to the pre-load baseline (loaded per-FY via `--fy`, so FY2008–FY2025 rows were never re-written).

## Money In
- CA retains revenue rows (now FY2002–FY2025) → Money In stays enabled (data-driven, no frontend change).

## Deviation (D-02, resolved)
- The ROADMAP phase text ("CA pre-FY2020") was stale v2.11 language; Phase 104 already deepened CA to FY2008. Recon (117-DEEPEN-SOURCES.md) corrected the premise; this load digs below the actual FY2008 floor to FY2002. Recorded here per Rule-1.

**Local PDFs** in gitignored `_acfr-tmp/ca/` (not committed).
