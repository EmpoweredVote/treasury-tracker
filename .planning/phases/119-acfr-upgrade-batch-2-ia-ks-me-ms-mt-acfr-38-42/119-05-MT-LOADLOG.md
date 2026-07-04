# 119-05 Montana ACFR Load Log (ACFR-42)

Montana state node `6e085a8b-97e3-479d-8879-9bb7ff4f9fb1` upgraded from NASBO operating-only
to full State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function), **FY2015–FY2025
(11 years, zero honest holes)**. Loaded live 2026-07-04.

## Load Disposition

| FY | Operating (expenditure) $ | Revenue $ | Tie | Source filename |
|----|---------------------------|-----------|-----|-----------------|
| 2015 | 2,109,168,000 | 2,122,413,000 | $0 both | `Documents/2015.pdf` |
| 2016 | 2,226,225,000 | 2,039,879,000 | $0 both | `Documents/2016_ACFR.pdf` |
| 2017 | 2,315,122,000 | 2,065,370,000 | $0 both | `Documents/FY17_ACFR.pdf` |
| 2018 | 2,220,270,000 | 2,265,331,000 | $0 both | `Documents/Montana-CAFR-2018-web-version-protected.pdf` |
| 2019 | 2,273,659,000 | 2,450,704,000 | $0 both | `Documents/2019-ACFR-Web-protected-002.pdf` |
| 2020 | 2,305,354,000 | 2,443,134,000 | $0 both | `Documents/2020-Montana-ACFR.pdf` |
| 2021 | 2,352,529,000 | 2,848,663,000 | $0 both | `Documents/Final-Montana-ACFR---2021-wo-signature.pdf` |
| 2022 | 2,401,873,000 | 3,663,543,000 | $0 both | `Documents/Final-Montana-ACFR-2022-wo-signature.pdf` |
| 2023 | 2,689,563,000 | 2,995,228,000 | $0 both | `Montana-ACFR-2023-Final-w_-sig-on-file.pdf` |
| 2024 | 2,754,747,000 | 3,380,852,000 | $0 both | `Montana-ACFR-2024-sig-on-file.pdf` |
| 2025 | 2,947,803,000 | 3,453,804,000 | $0 both | `Montana-ACFR-2025-sig-on-file1.pdf` |

**Bookend confirmations (GENERAL column revenues, recon-declared):** FY2025 = $3,453,804,000 ✅,
FY2016 = $2,039,879,000 ✅ — exact $0 diff, and every interior year tied on the first
extraction pass on BOTH the revenue and expenditure sides.

**FYs skipped / honest holes:** NONE within the window. **FY2015 disposition:** the recon's
clean window was FY2016–FY2025 with FY2015 flagged as a *load-time re-attempt candidate* (listed
on the archive as `2015.pdf` but not bookend-tied during recon). FY2015 downloaded cleanly
(7.3 MB real PDF, June-30 FY-end) and tied at $0 diff on both sides on the first pass, so it is
**INCLUDED** — the durable window is FY2015–FY2025 (11 years). The archive's earliest listed file
is `2015.pdf`; pre-FY2015 is a future extension candidate if an older archive is found.

## Annual-vs-biennial resolution (D-03/D-09 pre-flagged risk — RESOLVED)

Montana adopts its **budget** biennially but publishes **GAAP financials annually** — every FY
2015–2025 has its own individually-signed single-year ACFR on `doa.mt.gov/SFSD/ACFR-PAFR`, each
cover reading "FOR THE FISCAL YEAR ENDED JUNE 30, {YYYY}". Each FY was loaded as a distinct
single-year actual; no biennium was split or doubled, and no FY-attribution exception was
triggered. June-30 FY-end confirmed.

## NASBO replacement (in place)

MT held exactly 2 pre-load NASBO operating rows (`data_source_id` NULL):

| FY | Pre-load NASBO operating | Loaded ACFR operating (expenditure) | Ratio |
|----|--------------------------|-------------------------------------|-------|
| 2023 | $2,617,000,000 | $2,689,563,000 | ~1.03× |
| 2024 | $2,684,000,000 | $2,754,747,000 | ~1.03× |

Both replaced in place at the same `(6e085a8b, fy, 'operating')` RPC key — post-load there is
**exactly one operating row per FY, zero rows carrying a "NASBO" label**. No revenue rows existed
pre-load; all 11 revenue rows are net-new.

## Accept-and-relabel scope divergence (~1.29×, ACFR-42)

The recon's ~1.29× figure is FY2025 GAAP GF **revenue** ($3,453,804K) vs FY2024 NASBO GF
($2,684,000K). The mechanism (confirmed at load): Montana books Federal revenue overwhelmingly to
a **separate "Federal Special Revenue" major fund column** ($4,309,139K Federal line in FY2025) —
the General column's own Federal line is only $22,186K FY2025 — so the GAAP General Fund stays
close to NASBO's own-source budgetary scope (same mechanism as Maine). The operating-side
replacement ratio is even tighter (~1.03×, above). Divergence is honest and GAAP-correct, recorded
here and carried on the GAAP-basis `data_source` label on every row.

## Extractor fix discovered here (shared, reusable)

MT's revenue section header prints as **"REVENUES (Note 14)"** — the trailing statement-note
reference defeated `extract_gf.py`'s exact-match section-header test, silently skipping the entire
revenue section (expenditures, plain "EXPENDITURES", tied fine — the diagnostic tell was
`rev_total None` with `exp_tie True`). Fixed generically: strip any trailing parenthetical from a
candidate header line before matching (reusable for any future state; item lines like "Investment
earnings (losses)" reduce to a non-header token, so no false section trigger). `rev_boundary='Charges
for services'` clears the single "Taxes:" sub-heading after the six tax lines (SC/MS precedent).

## Idempotency + residue (LOAD-01)

Re-ran `processMTAcfr.js --fy 2025` and `processMTRevenueAcfr.js --fy 2025` live a second time:
row counts stayed at 11 operating + 11 revenue (no duplication), totals unchanged — **0 net
change**. Post-run `treasury.data_sources` residue for `mt-acfr-gf-operating` /
`mt-acfr-gf-revenue` = **0 rows** (ephemeral lifecycle self-cleaned). Money In auto-enabled (11
revenue rows present). Cohort spot-check: AK 20/20, MS 22/22 operating/revenue rows, both 0 NASBO
— unchanged.

## No negative lines

Full-cohort negative scan across all 11 years: **no negative GF line** on either side
("Investment earnings (losses)" positive throughout — FY2025 +$156,745K / FY2016 +$5,703K /
FY2015 +$3,650K). The P2 clamp (`clampForRender`) stays wired per ACFR-32 but is unexercised for MT.

---

## Batch-2 close-out

All 5 Batch-2 states are loaded and independently DB-verified:

| Plan | State | Req | Window | Op/Rev rows |
|------|-------|-----|--------|-------------|
| 119-01 | Iowa | ACFR-38 | FY2002–2025 (FY2008 hole) | 23 / 23 |
| 119-02 | Kansas | ACFR-39 | FY2019–2025 | 7 / 7 |
| 119-03 | Maine | ACFR-40 | FY2002–2025 | 24 / 24 |
| 119-04 | Mississippi | ACFR-41 | FY2003–2024 | 22 / 22 |
| 119-05 | Montana | ACFR-42 | FY2015–2025 | 11 / 11 |

Batch 2 (IA/KS/ME/MS/MT) is complete and handed to **Phase 124** for independent re-derivation +
cohort audit + Chris UAT. Milestone v2.15 continues with Batch 3 (Ph120: NE/NV/NH/NM/ND) and
Batch 4 (Ph121: OK/RI/SD/VT/WV/WY), then Ph123 retires NASBO to fallback-only.
