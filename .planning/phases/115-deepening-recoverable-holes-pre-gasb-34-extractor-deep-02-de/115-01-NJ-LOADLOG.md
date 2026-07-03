# 115-01 — New Jersey Deepening Load Log (Pre-FY2020 Recovery)

**State:** New Jersey (node `91f310a1-bec9-404a-9825-82b1106c911f`)
**Loaders:** `scripts/processNJAcfr.js` (operating), `scripts/processNJRevenueAcfr.js` (revenue)
**Window before this phase:** FY2020–FY2025 (6 years, loaded Phase 108)
**Window after this phase:** FY2002–FY2025 (24 years) — **0 honest holes, 0 pre-GASB-34 boundary hit**
**Units:** DOLLARS (UNITS=1) — confirmed for EVERY year FY2002–FY2025, no thousands-era override needed
**Spend:** $0 (free nj.gov PDFs, pdftotext -table, no paid AI)

---

## GASB-34 boundary — NOT hit in this window

NJ adopted GASB 34 in **FY2002**, its first ACFR reporting year under the modern model. Every
candidate year enumerated from `nj.gov/treasury/omb/fr.shtml` (FY2002 through FY2019) prints the
SAME modern "STATEMENT OF REVENUES, EXPENDITURES[,] AND CHANGES IN FUND BALANCES — GOVERNMENTAL
FUNDS" statement with GENERAL FUND as the 1st column — confirmed directly in the FY2002 text
(`_acfr-work/nj/NJ2002.txt:2437`). There is **no pre-GASB-34 "Combined Statement of Revenues,
Expenditures, and Changes in Fund Balances — All Governmental Fund Types" format anywhere in NJ's
available online archive** — the OMB landing page's earliest linked report is FY2002. Per DEEP-03
scope (pre-34 NJ years are out of scope; DEEP-04 names only CT/WI for the pre-34 extractor), this
loader stops honestly at the archive's own edge (FY2002), not at a format boundary — there is
nothing older to omit.

## URL enumeration (load-time discovery from `nj.gov/treasury/omb/fr.shtml`)

Names shift by era, enumerated directly from the landing page's `<a href>` list (never derived):

| Era | URL pattern |
|-----|-------------|
| FY2002–FY2007 | `{YY}fr/pdf/{YY}FR.pdf` (e.g. `02fr/pdf/02FR.pdf`) |
| FY2008–FY2015 | `{YY}fr/pdf/fullfr{YYYY}.pdf` |
| FY2016–FY2017 | `{YY}fr/pdf/fullfr.pdf` (year suffix dropped) |
| FY2018 | `18fr/FR 2018 Secured Final.pdf` (space; %20-encoded at fetch time) |
| FY2019 | `19fr/NJFR2019 Complete.pdf` (space; %20-encoded) |
| FY2020–FY2024 | `{YY}fr/NJFRFY{YYYY}Complete.pdf` (Phase 108, unchanged) |
| FY2025 | `25fr/NJFY2025Complete.pdf` (FR infix dropped, unchanged) |

All 18 pre-FY2020 PDFs downloaded to `_acfr-work/nj/NJ{YYYY}.pdf`, passed the soft-404 guard
(`%PDF-` magic + >500KB), and extracted cleanly via `pdftotext -table` (font warnings only, no
fatal errors; text yield 970KB–1.3MB per file).

## Extraction discipline — false-positive statement match found and fixed

NJ's ACFR contains THREE statements sharing enough header vocabulary ("General Fund" +
"Governmental Funds") to false-match the shared extractor's (`maAcfrExtract.mjs`) loose
`/General/` + `/Governmental Funds/i` heuristic when scanning the whole document from line 1500:

1. **The true GAAP statement** — "STATEMENT OF REVENUES, EXPENDITURES[,] AND CHANGES IN FUND
   BALANCES" / "GOVERNMENTAL FUNDS" (bare titles, no prefix) — General Fund | Property Tax Relief
   Fund | Non-Major Governmental Funds | Total Governmental Funds.
2. **"BUDGETARY COMPARISON SCHEDULE — MAJOR GOVERNMENTAL FUNDS"** — General Fund on a BUDGETARY
   basis (Original Budget / Final Budget / Actual (Budgetary Basis) / Variance columns) — NOT GAAP.
3. **"NON-MAJOR GOVERNMENTAL FUNDS — BY FUND TYPE"** and **"COMBINING STATEMENT OF REVENUES…"** —
   no General Fund column at all (Special Revenue/Debt Service/Capital Projects columns).

An initial test run tied FY2004 against statement #2 (Budgetary Comparison Schedule) by coincidence
— a genuinely wrong, non-GAAP total that happened to satisfy the sum-ties-total gate. **This would
have loaded budgetary-basis figures mislabelled as GAAP-basis** had it gone undetected. Root-caused
by inspecting `r.statementLine` and diffing against the manually-read true statement.

**Fix:** `isolateNJStatement()` anchors on the exact bare title
`/^\s*STATEMENT\s+OF\s+REVENUES,\s*EXPENDITURES,?\s+AND\s+CHANGES\s+IN\s+FUND\s+BALANCES\s*$/i`
(whitespace-tolerant — FY2007's title has an inserted `pdftotext -table` gap between "IN" and "FUND
BALANCES") followed within 5 lines by a bare `GOVERNMENTAL FUNDS` subtitle (not "MAJOR…" /
"NON-MAJOR…" / "COMBINING…"-prefixed), takes the FIRST such match (confirmed the correct one in
every year FY2002–FY2025), and hands a scoped ~250-line snippet (padded to satisfy the shared
extractor's line-1500 offset convention) to `extractGovFundGeneralColumn` / positional fallback.
This was **verified to reproduce the existing FY2020–FY2025 embedded totals exactly** (bookend
regression, $0 delta on both revenue and expenditure) before being used to derive the newly-tied
FY2002–FY2019 categories.

FY2002–FY2003 needed the **positional fallback** (a `pdftotext -table` artifact renders the "$"
glyph as a bare `--` immediately ahead of every dollar figure — including populated columns — so
token-order parsing misassigns cells; the positional extractor's nearest-anchor-column assignment
handles it correctly). FY2004–FY2025 tie on token order.

## Load Disposition

All 24 FYs (FY2002–FY2025) extracted from the Governmental Funds *Statement of Revenues,
Expenditures, and Changes in Fund Balances* — GENERAL FUND column (1st of 4) — and tie **exactly
($0 diff)** to the printed General-Fund Total for both revenues and expenditures.

| FY | Operating (Total Exp, $) | Revenue (Total Rev, $) | Tie | Extraction mode | Note |
|----|--------------------------|------------------------|-----|------------------|------|
| 2002 | 24,075,099,379 | 21,939,257,600 | $0 / $0 ✅ | positional | archive edge (earliest available) |
| 2003 | 26,489,239,411 | 24,559,781,706 | $0 / $0 ✅ | positional | |
| 2004 | 26,360,090,205 | 24,788,219,646 | $0 / $0 ✅ | token-order | false-positive statement caught + fixed here |
| 2005 | 27,234,312,016 | 25,706,389,910 | $0 / $0 ✅ | token-order | |
| 2006 | 27,221,313,749 | 27,666,686,164 | $0 / $0 ✅ | token-order | |
| 2007 | 29,151,155,987 | 28,512,867,194 | $0 / $0 ✅ | token-order | title has an inserted mid-word gap (regex hardened) |
| 2008 | 30,149,621,957 | 29,150,698,861 | $0 / $0 ✅ | token-order | |
| 2009 | 30,673,226,648 | 29,178,277,740 | $0 / $0 ✅ | token-order | Investment earnings −$11,876,353 (financial-crisis year) — P2 clamp fires |
| 2010 | 32,638,456,069 | 30,777,686,614 | $0 / $0 ✅ | token-order | |
| 2011 | 31,678,836,835 | 30,463,289,923 | $0 / $0 ✅ | token-order | |
| 2012 | 32,665,260,823 | 30,321,619,383 | $0 / $0 ✅ | token-order | |
| 2013 | 33,378,008,930 | 31,717,076,713 | $0 / $0 ✅ | token-order | |
| 2014 | 35,251,534,135 | 33,956,924,494 | $0 / $0 ✅ | token-order | |
| 2015 | 37,344,818,389 | 36,771,269,050 | $0 / $0 ✅ | token-order | one-off "Contributory life insurance payment" line |
| 2016 | 36,158,959,713 | 34,509,156,828 | $0 / $0 ✅ | token-order | "Component Units and Port Authority" revenue category first appears |
| 2017 | 34,119,271,433 | 35,797,914,706 | $0 / $0 ✅ | token-order | |
| 2018 | 34,216,874,006 | 36,406,974,967 | $0 / $0 ✅ | token-order | |
| 2019 | 35,606,424,579 | 38,590,165,700 | $0 / $0 ✅ | token-order | one-off "Current refunding bonds escrow payment" line |
| 2020 | 36,563,705,440 | 38,768,977,008 | $0 / $0 ✅ | token-order | Phase 108 (unchanged, re-verified via the same isolate+extract path) |
| 2021 | 43,197,990,156 | 48,182,629,272 | $0 / $0 ✅ | token-order | Phase 108 (unchanged) |
| 2022 | 50,311,616,860 | 57,510,588,567 | $0 / $0 ✅ | token-order | Phase 108 (unchanged) |
| 2023 | 53,640,149,629 | 61,016,633,737 | $0 / $0 ✅ | token-order | Phase 108 (unchanged) |
| 2024 | 59,174,201,425 | 60,554,040,145 | $0 / $0 ✅ | token-order | Phase 108 (unchanged, spot-year for baseline check) |
| 2025 | 59,603,886,014 | 60,979,024,211 | $0 / $0 ✅ | token-order | Phase 108 (unchanged, latest bookend) |

Both old and new bookends reproduced exactly: FY2025 rev 60,979,024,211 ✅ (Phase 108), FY2002 rev
21,939,257,600 ✅ (new earliest year).

## Units verification per era

Per-capita expenditure sanity across the FULL window (rough historical NJ population estimates for
FY2002–FY2019; actual 2024-vintage POPULATION=9,288,994 used for FY2020+ in the loader):

| Era | Per-capita expenditure range |
|-----|-------------------------------|
| FY2002–FY2009 | $2,832–$3,526/person |
| FY2010–FY2019 | $3,514–$4,196/person |
| FY2020–FY2025 | $3,936–$6,417/person |

All values fall comfortably inside the $2k–$8k/person sanity band with no discontinuity at any
year boundary — confirming **UNITS=1 (dollars)** holds for the entire FY2002–FY2025 window (no
thousands-era override needed; a 1000× units error would have produced obviously-wrong
per-capita figures in the $2M–$4M/person range, easily caught by this gate).

## P2 clamp (ACFR-20)

**FY2009 Investment earnings = −$11,876,353** (the 2008–2009 financial crisis year) is the ONLY
negative category across the full FY2002–FY2025 window (on either the revenue or expenditure
side). `clampForRender` renders it at $0 with the label `"Investment earnings (net loss — shown at
0)"`; the true signed value is preserved in the loader's console output. DB-confirmed post-load
(`budget_categories` row for NJ FY2009 revenue: `amount: 0`, label carries the "(net loss — shown
at 0)" suffix). No other negative lines anywhere else in the window.

## NASBO replacement / new-vs-replaced accounting

This phase adds NET-NEW years only — FY2020–FY2025 (already ACFR GAAP since Phase 108) are
untouched. No NASBO rows existed for any of the newly-recovered FY2002–FY2019 years (the NJ state
node had no data prior to FY2020 before this phase).

## Idempotency (never-overwrite) + 0 residue

**Baseline (before this phase's live loads):**
- NJ node: 12 rows (6 operating + 6 revenue), FYs 2020–2025 only
- FY2024 operating `total_budget` = 59,174,201,425
- FY2024 revenue `total_budget` = 60,554,040,145
- `treasury.data_sources` rows for `nj-acfr-%` dataset_ids: **0**

**Live-loaded** all 18 new years, one `--fy` at a time, for both operating and revenue (36 loader
invocations total — never a full multi-year run, so FY2020–FY2025 could not be touched by
construction).

**Post-load (after all 18 years × 2 datasets):**
- NJ node: 48 rows (24 operating + 24 revenue), FYs 2002–2025 continuous
- FY2020–FY2025 rows: **identical** row-for-row to baseline (all 6 operating + 6 revenue totals
  match exactly; spot-verified every year, not just FY2024)
- FY2024 operating `total_budget` = 59,174,201,425 (**unchanged**)
- FY2024 revenue `total_budget` = 60,554,040,145 (**unchanged**)
- All 18 new years: `data_source` contains `"GAAP basis"`, `source_url` + `source_date` stamped
- `treasury.data_sources` rows for `nj-acfr-%` dataset_ids: **0** (ephemeral lifecycle held)

**Re-run test (FY2010, both loaders, run a second time live):**
- Pre-rerun: operating 24 rows / revenue 24 rows; FY2010 operating `total_budget` =
  32,638,456,069, `budget_categories` count = 12 (1 root + 11 children)
- Post-rerun: operating 24 rows / revenue 24 rows (unchanged); FY2010 operating `total_budget` =
  32,638,456,069 (unchanged), `budget_categories` count = 12 (unchanged) — **0 net change**
- `treasury_sync_budget_tree` RPC key (muni, fy, dataset_type) → UPDATE-in-place, confirmed
  idempotent
- `treasury.data_sources` rows for `nj-acfr-%` after re-run: **0**

## Cohort untouched (loader can only resolve name='New Jersey')

Spot-checked three other ACFR cohort nodes after the full NJ deepening load — all unchanged from
their pre-existing loadlogs:

| Node | operating | revenue | Verdict |
|------|-----------|---------|---------|
| California | 18 | 18 | unchanged (FY2008–2025) ✅ |
| Alabama | 24 | 24 | unchanged (FY2002–2025, Phase 114) ✅ |
| Connecticut | 23 | 23 | unchanged (FY2002–2025 minus FY2006 hole, Phase 109) ✅ |

Both NJ loaders resolve only `name='New Jersey', state='NJ', entity_type='state'` — they cannot
structurally write to any other node. (Phase 116 runs the authoritative full 50-node cohort audit.)

## Money In

NJ already had 6 `dataset_type='revenue'` rows from Phase 108 ("Money In" already auto-enabled);
this phase adds 18 more revenue years into the SAME series (FY2002–FY2019), extending the existing
view with no frontend change required.

## Phase-114 hardening applied

Both loaders were touched, so the Phase-114 hardening pattern was applied per the
fix-while-touching rule (no fleet-wide sweep):
- **WR-01** — `parseArgs({ strict: true, allowPositionals: false })`: `--dryrun` (typo) now exits 2
  with `Unknown option '--dryrun'` instead of silently live-loading.
- **WR-01 (re-review)** — `--fy` value validated against the data map before any work: `--fy 1999`
  exits 2 with the loadable-years message instead of a silent no-op.
- **WR-06** — every target year validated (`validate(fy)`) BEFORE the Supabase client / ephemeral
  `data_sources` row exist, so a failing year aborts before any write, never mid-run.
- **WR-04** — the per-FY write loop runs inside `try { } finally { }`; all `process.exit(2)` calls
  inside the loop converted to thrown errors, guaranteeing the ephemeral `data_sources` cleanup
  runs even on a mid-run failure.
- **WR-07** — the post-RPC `budgets` select error is now surfaced (`throw` on `selErr`) rather than
  silently falling through to "row not found".

Verified: `node --check` on both files, `--dry-run` 24/24 PASS on both, `--dryrun` (typo) exits 2,
`--fy 1999` exits 2 — all before any live write was attempted.
