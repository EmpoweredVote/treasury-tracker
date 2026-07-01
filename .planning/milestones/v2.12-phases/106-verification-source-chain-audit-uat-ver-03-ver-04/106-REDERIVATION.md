# 106 — Independent Re-Derivation Log (VER-03 Part a)

**Phase:** 106-verification-source-chain-audit-uat-ver-03-ver-04 — Plan 106-01
**Method:** D-02 blind re-extraction from source ACFR PDFs via `pdftotext -table`, zero loader imports
**Harness:** `scripts/verify-phase106-rederive.mjs` (imports only Node built-ins; no `process*.js`)
**Tolerance:** D-03 exact-0 bar (no numeric tolerance band — each non-zero delta must be explained or fixed in-phase)
**Executed:** 2026-06-30
**Result:** **24/24 exact ties — 0 deltas, 0 failures, harness exits 0**

---

## Headline Verdict

**24/24 exact ties, delta = $0 on every check. VER-03 part (a) SATISFIED.**

All 12 sampled FY-state combinations were independently re-extracted from their source ACFR PDFs
and matched the live `treasury.budgets` total_budget value at exactly $0 delta for both the
`revenue` and `operating` dataset types. No in-phase data fix was needed (D-05 not triggered).

---

## Sample Definition (D-01)

The v2.12 surface added by Phases 104 and 105:
- **CA deepened:** FY2008–FY2019 (+12 FYs added by Phase 104)
- **NY deepened:** FY2003–FY2014 (+12 FYs added by Phase 104)
- **FL deepened:** FY2021 (+1 FY added by Phase 104; also a negative-clamp year)
- **PA new:** FY2016–FY2025 (new state, Phase 105)
- **IL new:** FY2021–FY2025 (new state, Phase 105; FY2022 is a negative-clamp year)

**Risk-weighted sample selection (D-01: bookends + random middles + every negative-clamp year):**

| State | FY | Role | Rationale |
|-------|----|------|-----------|
| CA | FY2008 | Deepened bookend (oldest) | Oldest CA deepened year; CAFR-path URL |
| CA | FY2013 | Random middle (D-01 discretion) | Arithmetic middle of FY2008–FY2019 window (year 6/12) |
| CA | FY2019 | Deepened bookend (newest deepened) | Boundary between CAFR and ACFR URL paths |
| NY | FY2003 | Deepened bookend (oldest) | Oldest NY deepened year; exercises x1,000,000 millions scaling |
| NY | FY2009 | Random middle (D-01 discretion) | Year 7/12 of FY2003–FY2014; recession revenue dip from FY2008 |
| NY | FY2014 | Deepened bookend (newest deepened) | Newest NY deepened year boundary |
| FL | FY2021 | Only deepened FY + negative-clamp year | Only FL year added; "Investment earnings (losses)" = -$398,287K |
| PA | FY2016 | Bookend (oldest) | PA window floor; hyphen URL pattern |
| PA | FY2025 | Bookend (newest) | PA window ceiling; %20 URL pattern |
| IL | FY2021 | Bookend (oldest) | IL window floor; no Bookmarked suffix |
| IL | FY2022 | Negative-clamp year | "Interest and other investment income" = -$197,857K |
| IL | FY2025 | Bookend (newest) | IL window ceiling; Bookmarked suffix |

**Total: 12 FY targets × 2 dataset types (revenue + operating) = 24 checks.**

**Random-middle-year documentation (D-01 reproducibility):**
- CA FY2013: arithmetic middle of the 12-year FY2008–FY2019 deepened window (year 6/12 = FY2013).
- NY FY2009: early-middle (year 7/12 of FY2003–FY2014); selected because it also exercises the
  recession-year revenue dip ($40,228M vs. FY2008 $45,423M), making it a harder test case.

**Negative-clamp year notes (D-03 exact-0 bar applies to the printed root total):**
- FL FY2021: "Investment earnings (losses)" = -$398,287K. The P2 clamp renders this as 0 in the
  icicle with label "(net loss — shown at 0)". The **printed root total** $46,989,188K already nets
  the negative, and this is what `total_budget` stores. The bar is the printed root total.
- IL FY2022: "Interest and other investment income" = -$197,857K. Same mechanism — root total
  $73,204,339K nets the negative, matching `total_budget`. Bar is the printed root total.
- Note: No NY/CA market-loss negative-clamp years exist in the FY2003–FY2014 / FY2008–FY2019
  windows per the 104-DEEPEN-GAPLOG (all GF revenue/expenditure categories positive in those ranges).

---

## Per-FY Re-Derivation Table

All values in dollars (printed units multiplied by the state's unit multiplier).

| State | FY | Dataset | Independent re-extracted total | Live DB total_budget | Delta | Disposition |
|-------|----|---------|-------------------------------|----------------------|-------|-------------|
| CA | 2008 | revenue | $97,774,378,000 | $97,774,378,000 | $0 | PASS — exact tie |
| CA | 2008 | operating | $98,975,042,000 | $98,975,042,000 | $0 | PASS — exact tie |
| CA | 2013 | revenue | $99,379,153,000 | $99,379,153,000 | $0 | PASS — exact tie (random middle) |
| CA | 2013 | operating | $90,114,980,000 | $90,114,980,000 | $0 | PASS — exact tie (random middle) |
| CA | 2019 | revenue | $140,503,627,000 | $140,503,627,000 | $0 | PASS — exact tie |
| CA | 2019 | operating | $129,113,153,000 | $129,113,153,000 | $0 | PASS — exact tie |
| NY | 2003 | revenue | $29,250,000,000 | $29,250,000,000 | $0 | PASS — exact tie (x1,000,000 millions scaling) |
| NY | 2003 | operating | $40,910,000,000 | $40,910,000,000 | $0 | PASS — exact tie (x1,000,000 millions scaling) |
| NY | 2009 | revenue | $40,228,000,000 | $40,228,000,000 | $0 | PASS — exact tie (random middle; recession dip) |
| NY | 2009 | operating | $56,630,000,000 | $56,630,000,000 | $0 | PASS — exact tie (random middle) |
| NY | 2014 | revenue | $48,459,000,000 | $48,459,000,000 | $0 | PASS — exact tie |
| NY | 2014 | operating | $59,782,000,000 | $59,782,000,000 | $0 | PASS — exact tie |
| FL | 2021 | revenue | $46,989,188,000 | $46,989,188,000 | $0 | PASS — exact tie (negative-clamp: bar = printed root total netting -$398,287K) |
| FL | 2021 | operating | $37,277,963,000 | $37,277,963,000 | $0 | PASS — exact tie |
| PA | 2016 | revenue | $56,741,506,000 | $56,741,506,000 | $0 | PASS — exact tie |
| PA | 2016 | operating | $56,135,869,000 | $56,135,869,000 | $0 | PASS — exact tie |
| PA | 2025 | revenue | $92,414,817,000 | $92,414,817,000 | $0 | PASS — exact tie |
| PA | 2025 | operating | $94,758,255,000 | $94,758,255,000 | $0 | PASS — exact tie |
| IL | 2021 | revenue | $63,136,008,000 | $63,136,008,000 | $0 | PASS — exact tie |
| IL | 2021 | operating | $59,523,406,000 | $59,523,406,000 | $0 | PASS — exact tie |
| IL | 2022 | revenue | $73,204,339,000 | $73,204,339,000 | $0 | PASS — exact tie (negative-clamp: bar = printed root total netting -$197,857K) |
| IL | 2022 | operating | $62,089,769,000 | $62,089,769,000 | $0 | PASS — exact tie |
| IL | 2025 | revenue | $78,342,927,000 | $78,342,927,000 | $0 | PASS — exact tie |
| IL | 2025 | operating | $75,456,922,000 | $75,456,922,000 | $0 | PASS — exact tie |

**All 24 checks: delta = $0. No explained exceptions. No in-phase fixes needed.**

---

## Source Documents Used (D-02 blind re-extraction)

URLs encoded independently from `103-DEEPEN-SOURCES.md` and `103-PA-IL-SOURCES.md`.
No `process*.js` loader code was read during re-extraction.

| State | FYs | PDF source URL pattern | Units |
|-------|-----|------------------------|-------|
| CA | 2008, 2013, 2019 | `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf` (NN=08,13,19) | thousands |
| NY | 2003, 2009, 2014 | `https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-{YYYY}.pdf` | millions |
| FL | 2021 | `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-2021-state-of-florida-annual-comprehensive-financial-report.pdf` | thousands |
| PA | 2016 | `https://www.pa.gov/content/dam/copapwp-pagov/en/budget/documents/publications-and-reports/annualfinancialreport/june-30-2016-acfr.pdf` (hyphen) | thousands |
| PA | 2025 | `https://www.pa.gov/content/dam/copapwp-pagov/en/budget/documents/publications-and-reports/annualfinancialreport/june-30-2025%20acfr.pdf` (%20 space) | thousands |
| IL | 2021 | `https://illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR/ACFR%20Final%202021.pdf` | thousands |
| IL | 2022 | `https://illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR/ACFR%20Final%20FY%202022.pdf` | thousands |
| IL | 2025 | `https://illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR/ACFR%20Final%202025%20-%20Bookmarked.pdf` | thousands |

**T-106-01 soft-404 guard applied:** CA SCO fetches filtered by `Content-Type: application/pdf`
AND payload >= 1 MB. All 3 CA PDFs returned valid application/pdf content (2.7 MB, 3.3 MB, 5.1 MB).

---

## Extraction Method (D-02)

For each sampled FY:
1. **Download** the source ACFR PDF from the URL above (no loader code consulted).
2. **Run** `pdftotext -table -f {start} -l {end} {pdf} -` on the Governmental Funds Statement
   of Revenues, Expenditures and Changes in Fund Balances pages.
3. **Re-key** the General Fund column independently: find the `Total revenues` and
   `Total expenditures` lines; extract the first numeric token (GF column = first column).
4. **Multiply** by the state unit multiplier (NY ×1,000,000; all others ×1,000).
5. **Diff** against `treasury.budgets.total_budget` for (municipality_id, fiscal_year, dataset_type).
6. **PASS** iff `abs(delta) === 0` exactly (D-03 — no tolerance band).

Statement: Always the **Governmental Funds Statement of Revenues, Expenditures and Changes in
Fund Balances — General Fund column** (GAAP). NOT the government-wide Statement of Activities,
NOT the budgetary comparison schedule.

---

## Disposition of Non-Zero Deltas

**None.** All 24 checks tie at exact $0. D-05 in-phase fix protocol not triggered.

No numeric tolerance band exists in the disposition logic (D-03 strictly enforced).

---

## Harness Verification Command

```bash
cd /c/treasury-tracker
node .claude/worktrees/agent-a84e263068c53bc05/scripts/verify-phase106-rederive.mjs
# OR from main repo after merge:
node scripts/verify-phase106-rederive.mjs
```

Expected output: `PASS -- All 24 Phase 106 re-derivation checks tie at exact delta=0`
Expected exit code: `0`

---

*Generated: 2026-06-30 | Phase 106 Plan 01 | VER-03 part (a) | 24/24 exact ties*
