# v2.0 Federal — Data Recon Findings

**Date:** 2026-06-12. All findings verified live this date (not from model memory).
Raw samples in `.planning/v2.0-recon/samples/`.

---

## Source verification results

| Source | Status | Notes |
|---|---|---|
| Treasury Fiscal Data API | ✅ Live, no key | MTS tables 1/4/5/9, Debt to the Penny, Interest Expense all verified. Data current through **May 2026** (FY2026 month 8). `page[size]` must be URL-encoded (`page%5Bsize%5D`). |
| USAspending API | ✅ Live, no key | `/v2/references/toptier_agencies/` (111 agencies) and `/v2/spending/` explorer verified, incl. drill budget_function → federal_account (151 accounts under function 800). |
| OMB Historical Tables | ✅ Live download | FY2027 edition at `whitehouse.gov/omb/information-resources/budget/historical-tables/` (note: URL moved from `/omb/budget/`). xlsx files parse cleanly with openpyxl. Needs browser User-Agent header. |
| GovInfo BUDGET collection | ✅ Page live | API requires free key (`govinfo.gov/api-signup`). |
| Congress.gov API | ✅ Live, key required | Free instant signup at `api.congress.gov`. Returns clean `API_KEY_MISSING` error without one. **Action: Chris signs up.** |
| House Clerk roll-call XML | ✅ Live, no key | `clerk.house.gov/evs/2025/roll001.xml` → 200. |
| Senate roll-call XML | ✅ Live, no key | `senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00001.xml` → 200. |
| CBO | ⚠️ **Bot-blocked** | Entire cbo.gov domain returns 403 to non-browser clients (even with browser UA on curl). Files need manual browser download, or skip — OMB/MTS cover the same figures. CBO's unique value (written program descriptions) needs an alternate fetch path. |
| GAO | ⚠️ **Bot-blocked** | gao.gov 403 to curl. DoD audit citations may need manual collection or WebFetch-style fetcher. Not blocking — needed only for opacity-flag content, low volume. |

## Sourced headline figures (pinned during recon)

| Figure | Value | Source |
|---|---|---|
| FY2025 receipts (actual) | $5,236.4B | OMB Hist Table 1.1, FY2027 edition |
| FY2025 outlays (actual) | $7,011.1B | OMB Hist Table 1.1 |
| FY2025 deficit (actual) | $1,774.7B | OMB Hist Table 1.1 |
| FY2025 discretionary outlays | $1,875.1B (Defense $893.6B / Nondefense $981.5B) | OMB Hist Table 8.1 |
| FY2025 mandatory outlays | ~$4,165.9B | OMB Hist Table 8.1 (verify exact column mapping at load time) |
| FY2025 net interest | ~$970B (residual: 7011.1 − 1875.1 − 4165.9) | OMB Hist Table 8.1 |
| FY2026 FYTD outlays (thru May) | $4,901.9B | MTS Table 9, record_date 2026-05-31 |
| FY2026 FYTD receipts (thru May) | $3,655.6B | MTS Table 9 |
| FY2026 FYTD Net Interest | $722.7B — **exceeds** National Defense $630.9B | MTS Table 9 |
| Total public debt outstanding | $39.213T | Debt to the Penny, 2026-06-10 |

Split confirms the brief's instinct: Mandatory ≈ 59% / Discretionary ≈ 27% / Net Interest ≈ 14%.

## Data structure findings

### MTS Table 9 (outlays by function) — the cleanest "what it's for" lens
- One table = receipts by source AND net outlays by ~20 budget functions, monthly + FYTD + prior FYTD in every row.
- Flat-ish: `sequence_level_nbr` 1–3, easy to load. ~33 rows per month.
- Functions match USAspending budget_function codes → drill-down compatible.

### MTS Table 5 (outlays by agency) — the "who spends it" lens
- ~800 rows/month, hierarchy 5 levels deep (L1 dept → L2 bureau → L3+ accounts) via `parent_id`/`sequence_level_nbr`/`line_code_nbr`.
- Parent rows have null amounts; totals appear as separate `Total--X` rows **at mixed levels** (e.g. "Total--Operation and Maintenance" under DoD sits beside "Total--Department of Agriculture"). Loader must walk parent_id, not trust "Total--" prefix.
- Gross outlays / applicable receipts / net outlays all present.

### USAspending spending explorer
- FY2025 "total" = **$10.3T — obligations, NOT outlays**; includes an "Unreported Data" line ($206.9B). Never mix these numbers with MTS outlays. Use for drill-down structure (function → agency → federal_account → program_activity → object_class) and award detail, not headline figures.
- `toptier_agencies` gives outlay_amount, budget_authority, % of total, and **congressional_justification_url per agency** — useful for Tier 1 explainer fetch-then-summarize.

### OMB Historical Tables
- Table 1.1: receipts/outlays/deficit 1789→2031 (estimates beyond 2025). Table 8.1: outlays by BEA category (mandatory/discretionary/net interest) 1962→2031. In millions, xlsx, stable layout.
- This is the **canonical source for the first split** and for multi-decade context lines.

### Money In structure (MTS Table 9 receipts section, FYTD 2026)
- Individual income taxes $1,912.5B; payroll ("Employment and General Retirement") $1,183.7B; corporate $209.8B; customs duties $188.6B; excise $67.3B; estate/gift $28.0B; misc $21.3B.
- Supports the earmarked-vs-general-fund framing directly.

## IA decisions (made with Chris, 2026-06-12)

1. **Headline year: FY2025 actuals** ($7,011B outlays, OMB-sourced, final). FY2026 FYTD appears as a secondary "this year so far" live strip from MTS.
2. **Landing view: proportional Mandatory / Discretionary / Net Interest bands** with a permanent receipts-vs-outlays deficit context strip. No default deep icicle.
3. **Lenses: function lens is the default drill** ("what it's for", ~20 categories); agency lens ("who spends it") available as a toggle. Single mental model on first load.
4. **Outlays consistently** (MTS/OMB), choice documented visibly in-app. USAspending obligations used only for drill-down structure, never headline figures.

## Decisions this recon supports (for IA discussion)

1. **Outlays, consistently, from MTS/OMB** — USAspending obligations differ by trillions; the choice matters and must be documented visibly in-app.
2. **First split = Mandatory/Discretionary/Net Interest** from OMB 8.1 — data is clean, annual, back to 1962.
3. **Two-lens drill (function / agency)** — both lenses verified loadable from MTS monthly with consistent FYTD figures.
4. **FY2025 actuals as the headline year**, FY2026 FYTD as "live" view — both available now.
5. Congress.gov key signup is the only user action needed before Phase F (program origins).
6. CBO/GAO bot-blocking: plan manual-download fallback for the handful of documents needed (low volume, one-time).
