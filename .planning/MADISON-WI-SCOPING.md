# MAD-01 — Madison, WI City Onboarding: Scoping Brief

**Status:** PROMOTED → milestone **v2.20 Madison, WI + Dane County Onboarding** (Phases 135–137), started 2026-07-27. Locked decisions: **Madison + Dane County only** (statewide fan-out deferred to `WI-CITIES-01`) · Dane County is a **full entity**, not nav-only · **all-governmental-funds** basis as the source defines it · **unaudited** provenance must be labelled. See `.planning/REQUIREMENTS.md` (MAD-01..09) + `.planning/ROADMAP.md`.
**Captured:** 2026-07-27 (from a live source probe — every figure below was re-derived from the downloaded workbooks, not read off a summary)
**Requirement:** MAD-01 — bring the City of Madison, Wisconsin onto Treasury Tracker at city parity (operating + revenue, sourced, per-capita, enriched) beneath a new **Dane County** navigation node under the existing Wisconsin state node.
**Locked decision (Chris, 2026-07-27):** scope = **Madison + a Dane County nav node**, with the loader written generically so a statewide fan-out is a flag flip rather than a rewrite.

---

## Bottom line

Madison is **not a one-off city load — it is a statewide bulk source** in the proven Ohio-AOS / MN-OSA / VA-APA mold. Wisconsin DOR publishes *County and Municipal Revenues and Expenditures* (Bulletin 124) as a free, no-auth **XLSX covering every municipality in the state**, with revenue-by-source and expenditure-by-function columns and **printed subtotal columns that act as a built-in tie gate**.

Nothing is blocked. Wisconsin already exists as a state node (52 rows, v2.14 ACFR lineage). No WI city or county is loaded yet, so Madison + Dane County are both new nodes.

The single genuine caveat is provenance grade: **this data is unaudited self-reported MFR filings**, not audited GAAP like the state-ACFR work. See §4.

**Anchor figures (Madison, CY2024, all re-derived):** population **291,037** · revenue (Subtotal-General Revenues) **$649,501,230** · expenditure (Sub-total Expenditure) **$758,792,098** · governmental funds only.

---

## 0. Source probe (2026-07-27) — VERIFIED, best case

Downloaded all five published workbooks (`CMREB2020`–`CMREB2024.xlsx`, ~0.7–0.9 MB each, free, no auth, direct URL pattern) and parsed them with `openpyxl`.

**Layout — identical across all five years.** Four sheets: `Cities` (190 rows), `Villages` (412–417), `Towns` (1,242–1,247), `Counties` (72). 54 columns, single header row, one row per municipality. Flat: categories are *columns*, not a nested tree.

> ⚠️ `openpyxl`'s `max_row` is inflated by trailing blank padding (claims 1,851 for a 190-row `Cities` sheet). Filter on the `Municipality` cell being non-empty, never trust `max_row`.

**Identity checks — the reason this source is safe.** Nine subtotal identities were re-derived from the component columns and compared to the printed subtotal columns, for **every row of every sheet in every year**:

```
9,608 rows × 9 identities = 86,472 checks → ZERO failures
```

This is a free, exact tie gate of exactly the kind `extractGresham.py` had to have one retrofitted (commit 593792a). A loader that asserts these identities cannot silently mis-parse a row.

**Layout trap found and resolved.** `Total Miscellaneous Revenues` is **narrower than its column position implies** — it covers only the two columns immediately before it (`Interest Income` + `Other Revenues`). The four columns `Licenses and Permits`, `Fines, Forfeits and Penalties`, `Public Charges for Services` and `Intergovernmental Charges for Services` are *direct* children of `Subtotal-General Revenues`, not members of `Total Miscellaneous`. Assuming otherwise produces equal-and-opposite deltas (±$56,381,522 on Madison 2024) that look like two broken subtotals but are one bad grouping. The source's own §III.B.8 line definition confirms it: *"Total Miscellaneous Revenues – sum of the two lines above."*

**Verified column map** (0-indexed, `Cities` sheet; same in all four sheets):

| Role | Cols | Notes |
|------|------|-------|
| Identity | 0–5 | CountyCode, MuniCode, MuniTypeCode, CountyName, **Municipality**, **Population** |
| Revenue leaves | 6,7,8,9 · 11 · 12,13,14,15,16 · 18,19,20,21 · 22,23 | **16 leaves**: 4 tax · Special Assessments · 5 intergovernmental · 4 direct-charge · Interest + Other |
| Revenue subtotals (do **not** load as leaves) | 10, 17, 24, 25 | Total Taxes · Total Inter Government · Total Miscellaneous · **Subtotal-General Revenues** ← revenue tree total |
| Excluded | 26, 27 | Other Financing Sources (debt proceeds, inter-fund transfers, refunding, asset sales) + its grand total |
| Expenditure leaves | 28–43 · 45,46 | 16 functions + 2 debt-service lines |
| Expenditure subtotals | 44, 47, 48 | Sub-total Op & Capital · Total Debt Service · **Sub-total Expenditure** ← expenditure tree total |
| Excluded | 49, 50 | Other Financing Uses + its grand total |
| Context only | 51,52,53 | Total GO Debt · Propriety [sic] Funds Revenues / Expenses (enterprise funds) |

Column *names* contain source typos to match literally, not fix: `Highway Maintainence`, `Road- Related Facilities` (space after hyphen), `Propriety Funds`.

---

## 1. Source assessment

| Source | What it gives | Format | Auth | Fit |
|--------|---------------|--------|------|-----|
| **WI DOR CMREB** (Bulletin 124) | Rev-by-source + exp-by-function, **all 1,921 WI municipalities + 72 counties**, CY2020–CY2024 | XLSX + PDF | none | ✅ **Primary** — statewide, icicle-grade, built-in tie gate |
| **City of Madison ACFR** (cityofmadison.com/finance) | Audited GAAP governmental-funds statements; **FY2015–FY2025 archive live** | PDF | none | Secondary — audited, and deeper history than CMREB. See §4 + §6 |
| **WI DOA state ACFR** | State-level only | PDF | none | ❌ Already covered by the WI state node |
| **Madison adopted budget books** | Adopted (not actual) operating + capital | PDF | none | ❌ Different basis; would break one-basis comparability |

**Direct URL pattern (both verified HTTP 200):**
`https://www.revenue.wi.gov/SLFReportscotvc/CMREB<YYYY>.xlsx` (note: **upper-case** `CMREB` for the XLSX; the PDF is lower-case `cmreb<YYYY>.pdf`)

---

## 2. Basis, scope and provenance (from the bulletin's own front matter)

- **Fund scope:** governmental fund types — *"the general fund, capital project fund, special revenue fund, and debt service fund."* Includes capital outlay in every activity line. **Excludes county enterprises**; enterprise + internal-service funds appear as separate context columns.
- **Fiscal year = calendar year.** WI municipalities are on a Jan–Dec year, so CY2024 = FY2024 with no FY-end ambiguity (contrast Gresham's Jun-30 and Michigan's Sep-30).
- **Basis:** MFR filings as reported. **`"CMRE data is unaudited"`** — DOR collects and verifies, and where a municipality did not file, DOR *"requested an independent accounting firm to compile the report using the municipality's records,"* so coverage is complete.
- **DOR's own comparability caveat:** expenditure variances between municipalities *"may be due to factors such as level of efficiency and economy, **differences in accounting practices**, organizational structures, service levels…"*
- **Rounding:** the bulletin warns *"some totals may differ insignificantly."* Our 86,472-check sweep found **zero** discrepancies, so no source-rounding registry is needed today — but the loader should carry the same exact-delta registry pattern as `lib/acfrGF.py` / `extractGresham.py` in case a future year drifts.
- **Transit note:** Madison's $115.3M `Other Transportation` includes Metro Transit — §III.C.1 puts *"mass transit"* in that line. So transit sits inside governmental funds here even though Madison issues separate audited Metro Transit statements. Expect this to raise the city's apparent spend vs. a GF-only view.

---

## 3. Pipeline fit — clone `loadOhioAOS.js`

Ohio AOS is the same shape (statewide XLSX, flat category columns, per-entity rows) and its decisions map 1:1:

| Ohio AOS decision | Wisconsin equivalent |
|---|---|
| Revenue = flat 1-level tree of source columns; total = printed "Total" col | Revenue leaves (15); total = `Subtotal-General Revenues` |
| Expenditure = flat tree of function cols **including** debt service | 16 functions + 2 debt-service lines; total = `Sub-total Expenditure` |
| **D-04b: exclude Other Financing Sources/Uses** and fund-balance lines | Exclude cols 26/27 and 49/50 — WI's definition (*"proceeds of long-term debt, inter-fund transfers…"*) is exactly what D-04b excludes |
| Both trees FLAT, leaf nodes only | Same — inherits the known no-drill-down limit (`project_flat_source_icicle_limitation`) |

Files (three, all mirroring existing scripts):

1. **`scripts/seedWisconsinMadison.js`** — Madison city + Dane County nodes. Mirror `seedTucsonArizona.js` (idempotent select-by-name → insert/update; `data_sources` owned by the loader, not the seeder). Population from the workbook itself (col 5), which is DOA-estimated and already per-year.
2. **`scripts/loadWICMREB.js`** — the loader. Mirror `loadOhioAOS.js` structure incl. `cellNum`/`cellText` helpers. Must assert the nine identities per row and abort on any failure. `--entity-type city|county` (cf. the Utah `--entity-type county` lesson) and `--municipality` / `--all` so the statewide fan-out is a flag, not a rewrite.
3. **No Python extractor needed** — XLSX, not PDF. This is strictly less work than Tucson or Gresham.

Reuse as-is: `treasury_sync_budget_tree`, the never-overwrite pre-skip guard (`treasury_sync_city_budget` is **not** source-safe — see `project_sync_city_budget_not_source_safe`), per-FY `data_sources` + `source_url`/`source_date` stamping.

---

## 4. The one real decision: unaudited MFR vs. audited ACFR

CMREB is unaudited self-reported data. Every state row in TT is audited-ACFR GAAP as of v2.15, and the Tucson/Pima/Oregon city rows are audited city ACFRs. Loading Madison from CMREB therefore introduces a **lower provenance grade than any city currently in TT**.

Three defensible answers, in preference order:

- **(a) CMREB now, labelled honestly.** Fastest, statewide-ready, exact tie gate. Requires the `data_source` label and any UI provenance text to say *unaudited, self-reported to WI DOR* — not "audited" or bare "GAAP". Relevant to SRCSTD-01.
- **(b) Madison from its own ACFR; CMREB only for the statewide fan-out.** Highest fidelity for Madison and reaches back to FY2015, but means two bases inside Wisconsin — the exact problem the Oregon work fought to avoid ("all 7 Oregon cities now on one basis").
- **(c) Both, as separate `dataset_type`s.** Most complete, most surface area, and invites apples-to-oranges comparison in the UI.

**Recommendation: (a),** with a Phase-1 reconciliation of Madison CMREB-vs-ACFR to quantify the gap before committing. If they tie closely, (a) is clearly right and the ACFR becomes a future deepening path; if they diverge materially, that finding itself decides between (b) and (c).

---

## 5. Proposed scope — v2.20, Phases 135–137

- **Phase 135 — Recon + seed.** Reconcile Madison CMREB CY2024 against the city's own FY2024 ACFR (governmental funds) and record the delta and its cause. Seed Madison + Dane County. Decide §4 on the evidence.
- **Phase 136 — Loader + load.** `loadWICMREB.js` with the nine-identity gate; load Madison + Dane County, CY2020–CY2024, revenue + operating (~20 budget rows). Per-capita, enrichment, provenance stamped.
- **Phase 137 — Verify.** Blind re-derivation of every loaded row from the workbook, cohort audit, Essentials/CTC tether check on Madison's banner (v2.16/v2.19 mechanism), Chris UAT.

**Effort: low.** No PDF extractor, no auth, no WAF workaround, no biennial-budget trap, exact tie gate already proven. The genuinely new work is the seeder, one loader, and the §4 judgement call.

---

## 6. Open questions

1. **§4 basis call** — settle in Phase 135 on reconciliation evidence.
2. **Statewide fan-out** — deliberately deferred, not rejected. 190 cities + 72 counties (~2,620 rows) is nearly free once the loader exists; Chris chose Madison + Dane first. Villages/towns (1,659 more entities, many under $1M) is a separate browse-dilution question — cf. the CityGrid 1,144-municipality render incident (`project_posthog_session_replay_freeze`).
3. **History depth** — CMREB starts at CY2020. Pre-2020 bulletins exist as PDF (and via wistatedocuments.org) but were **not** probed for XLSX; Madison's ACFR reaches FY2015. Out of scope for v2.20.
4. **Dane County population** — the workbook lists 599,930 for Dane, and the bulletin warns a county's figure *"may be higher than the sum of the populations of the towns, villages and cities listed"* because of cross-county municipalities. Take the county figure as given; do not derive it.

## 7. Cost / safety

$0 — free public XLSX, no API, no AI inference. Well inside the $5 gate (`feedback_api_cost_threshold`). Public-record municipal finance only. Writes are additive (two new municipalities); no existing row is touched, so the never-overwrite guard should not trip at all.

---

## Appendix — sources

- WI DOR landing page — https://www.revenue.wi.gov/Pages/Report/county-municipal-revenues-expenditures.aspx
- CMREB XLSX (CY2020–CY2024) — `https://www.revenue.wi.gov/SLFReportscotvc/CMREB<YYYY>.xlsx`
- CMREB 2024 PDF (Bulletin 124, definitions + basis statements quoted above) — https://www.revenue.wi.gov/SLFReportscotvc/cmreb2024.pdf
- City of Madison financial statements (FY2015–FY2025 ACFR archive) — https://www.cityofmadison.com/finance/accounting/financial-statements
- Statutory authority for the data release — sec. 73.10(2) Wis. Stats.
