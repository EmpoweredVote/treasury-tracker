# Phase 109 Verification — ACFR Upgrade Batch 2 (TN, CT, WI, WA, MI)

**Verified:** 2026-07-01 · **Method:** goal-backward against the 4 ROADMAP success criteria, live-DB assertions via mcp__supabase-local
**status: passed**

## Success Criterion 1 — Each Batch-2 state on ACFR GAAP rev+spend, as deep as cleanly extractable, every FY tying to its GF column total

| State | Window loaded | Yrs | Holes | Bookend ties |
|-------|--------------|-----|-------|--------------|
| TN | FY2009–FY2025 | 17 | 0 | 35,473,625K / 22,201,193K — $0/$0 ✅ |
| CT | FY2002–FY2025 | 23 | FY2006 (scanned); pre-2002 pre-GASB-34 | 26,074,183K / 20,776,288K — $0/$0 ✅ |
| WI | FY2002–FY2025 | 24 | pre-2002 pre-GASB-34 | 38,655,598K / 27,866,801K — $0/$0 ✅ |
| WA | FY2020–FY2025 | 6 | 0 (pre-2020 deferred per recon) | 55,775,958K / 38,977,410K — $0/$0 ✅ |
| MI | FY2019–FY2025 | 7 | 0 (pre-2019 unavailable) | 53,788,610K (+1K documented rounding) / 39,920,656K — ✅ |

**77 state-FYs loaded** (154 rows: 77 operating + 77 revenue), every FY gated by the exact GF-column tie (TOL=5K documented-GAAP-rounding only). All extraction via the shared parser `extractGovFundGeneralColumn` / `…Positional` (D-02) — GF column only, never a multi-column sum (CT's 7-column and MI's Fund-code layouts included). **PASS**

## Success Criterion 2 — NASBO replaced in place idempotently + never-overwrite; existing ACFR nodes + un-upgraded NASBO states untouched

- Per-state DB checks: 0 NASBO labels remain on any of the 5 nodes; one operating row per (state, FY); 0 dup keys.
- Idempotency: FY2025 re-run per state (both loaders) → 0 net change, all 5 states.
- Full 50-state cohort check: **19 ACFR states** (14 pre-109 + the 5 Batch-2), **31 clean NASBO states** (exactly 2 NASBO operating rows each), **0 anomalies**. **PASS**

## Success Criterion 3 — Scope divergence relabelled honestly (ACFR-19); negative years render via P2 clamp (ACFR-20)

- Relabels recorded per state against pre-load NASBO baselines: TN ~1.51×, CT ~1.14×, WI ~1.74×, WA ~1.72×, MI ~3.4–3.56× (tranche's largest, ~$30.3B federal-agency passthrough). All rows GAAP-basis-labelled (0 non-GAAP labels in DB).
- **P2 clamp triggered on 6 year-instances and verified live in DB**: CT FY2013 (Investment Earnings −$2,100K), WI FY2011/12/13 (Interest Income −$1,037K/−$1,282K/−$838K), WA FY2021/22 (Investment income (loss) −$12,899K/−$216,940K). Each renders 0 with "(net loss — shown at 0)" label, parent total intact. TN/MI: no negatives (as recon predicted). **PASS**

## Success Criterion 4 — Every displayed row basis-labelled + durably sourced; Money In auto-enables

- 0 unsourced rows (all 154 have source_url + source_date); all data_source labels carry "GAAP basis".
- MI D-03: all 14 rows source_date = {FY}-09-30, fiscal_year_start_month = 10 (0 violations).
- Money In: every upgraded node has ≥1 revenue row (data-driven auto-enable). **PASS**

## Requirements coverage
RECON-08 ✅ (cohort check) · ACFR-14 TN ✅ · ACFR-15 CT ✅ · ACFR-16 WI ✅ · ACFR-17 WA ✅ · ACFR-18 MI ✅ · ACFR-19 ✅ (5 relabels recorded) · ACFR-20 ✅ (6 live clamp instances).

## Notable deviations (all within Claude's-Discretion load-time-correction scope)
1. **Parser evolution ×3** (maAcfrExtract.mjs): positional extractor (TN blank-GF-cells), case-insensitive header (MI all-caps), "(Note NN)" stripping (MI). Token-order path untouched; TN/CT/WI regression-checked.
2. **tn.gov requires browser UA** (connection reset on plain curl) — baked into loaders.
3. **CT/WI deep windows end at FY2002** — the pre-GASB-34 boundary (Combined-Statement format + different basis), honestly not force-parsed (D-01 self-limit).
4. WI FY2002–2003 lowercase `cafr` filenames (recon pattern corrected at load).

## Hand-off to Phase 110
Loader-independent blind re-derivation (bookends + newest FY per state), 50-node cohort source-chain audit, live UAT (incl. the 5 new Money In views + the MI Sep-30 label + the 6 clamped categories + the MI 3.5× jump for Chris's sign-off).
