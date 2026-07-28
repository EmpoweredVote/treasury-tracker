# Phase 137 — Verification + Live UAT: SUMMARY

**Date:** 2026-07-28 · **Requirements:** MAD-08 ✅ · MAD-09 ✅ (Chris, 14/16 on sight; the two exceptions resolved below)
**DB writes:** none — this phase only reads and checks. One code change shipped: the source-chip copy fix.

## MAD-08 — blind re-derivation + source-chain audit ✅

### Independence of the re-derivation

Phase 136's handoff was explicit: re-derive from the XLSX **independently of `loadWICMREB.js`**, because reusing its parsing would only prove self-consistency. `scripts/rederiveWICMREB.py` does that:

| axis | loader (Phase 135/136) | this re-derivation |
|---|---|---|
| language | Node | Python 3.14 |
| XLSX reader | ExcelJS | openpyxl |
| column grouping | loader's registry | rebuilt here, then asserted against the workbook's own printed subtotals |
| comparison target | — | production over PostgREST |

Nothing is hand-transcribed on either side.

### Source bytes

All five workbooks re-fetched from the pinned per-year URLs: **HTTP 200 on 5/5**, and every file **sha256-identical** to the copies Phase 136 loaded. The URLs are durable and the bytes are the bytes that were loaded.

```
17417cb9…982e  CMREB2020.xlsx     14d79ce7…00ed  CMREB2023.xlsx
f1b0d4ff…8f86  CMREB2021.xlsx     bad4cf53…7b13  CMREB2024.xlsx
095e3e73…ad0f  CMREB2022.xlsx
```

### Result — 20/20 at exactly $0

Every row, every category, both entities, all five years:

| entity | rows | totals | every category | population |
|---|---|---|---|---|
| Madison, WI | 10 | Δ$0 | Δ$0 (16 rev / 16 exp) | 291,037 = workbook |
| Dane County, WI | 10 | Δ$0 | Δ$0 (14 rev / 14 exp) | 599,930 = workbook |

The nine printed-subtotal identities were re-proved on all ten entity-years, and — separately — the leaf set actually loaded was proved to sum to the printed `Subtotal-General Revenues` / `Sub-total Expenditure`. Categories with a zero amount are correctly absent from the DB rather than stored as $0 rows (Madison drops 2 expenditure leaves, Dane 2 revenue + 4 expenditure); the comparison checks set membership both ways, so an extra or missing category would have failed.

Reproduce from the repo root (exit 0 only if every delta is exactly $0):

```
mkdir -p _wi-recon && cd _wi-recon
for y in 2020 2021 2022 2023 2024; do curl -O "https://www.revenue.wi.gov/SLFReportscotvc/CMREB$y.xlsx"; done
cd .. && PYTHONIOENCODING=utf-8 py -3 scripts/rederiveWICMREB.py
```

Needs Python + `openpyxl`, and reads `.env` for the PostgREST credentials. The workbooks are untracked (`_wi-recon/` is gitignored); the script is tracked, because the verification has to be re-runnable by someone who isn't me.

### Source-chain audit — clean

| check | result |
|---|---|
| rows / categories / line items | 20 / 300 / 0 |
| `data_source` label | the unaudited-MFR string on **20/20**, no variants |
| `source_url` | present on 20/20, **per-year** (CY2021 row → `CMREB2021.xlsx`), all live |
| `source_date` | = 12-31 of the fiscal year on 20/20 |
| `fiscal_year_start_month` | 1 on 20/20 |
| `period_label` | NULL on 20/20 (deliberate — MAD-06) |
| `data_source_id` | NULL on 20/20 — matches every recently-onboarded entity (Tucson, Bend, Gresham, the Pima four) under the WR-05 ephemeral lifecycle; durable provenance rides on `source_url` |
| residue | 0 leftover `data_sources` rows for WI |
| duplicates | 0 — rows = distinct (FY, dataset) for every Madison-named entity |
| stale labels | 0 — one distinct `data_source` per entity |
| categories | 0 blank names, 0 null/non-positive amounts, 0 null percentages, all depth 0, no orphan parents |
| enrichment coverage | 61/61 (entity × link_key) resolve — 100% |
| bleed | 0 universal rows naming a WI jurisdiction (2 regex hits are `virginia general fund …` keys, where the key itself is jurisdiction-bound — correct) |

### Verified through production, not just the database

The live API (`api.empowered.vote`) serves both entities correctly:

- Madison CY2024 → operating **$758,792,098**, revenue **$649,501,230**; Dane CY2024 → **$782,417,277** / **$664,674,994**. The unaudited label and the per-year XLSX URL are both present in `data_source_info`.
- **Scoped enrichment wins over universal.** Madison's largest line, `Conservation and Development` ($125.7M), resolves to **"Housing & Economic Development" (source=`official`)** — *not* the universal AI row's "Sustainability & Environment". This was the highest-risk item in Phase 136's work; it is now confirmed end-to-end in production rather than inferred from the table.
- All three WI entities appear in `/treasury/cities` with `Madison.county_id → Dane County`, so the breadcrumb and Cities-in-County data are in place. Visual confirmation is MAD-09.
- Money In needs no flag: `resolveEffectiveDataset` derives availability from the rows themselves, and revenue rows exist for all five years.

### Two source-side spikes — explained, not defects

Madison CY2023→CY2024 expenditure **+32%**, and Dane County CY2022→CY2023 **+33.4%** then −8.1%. Both are explained by columns the loader deliberately excludes:

- **Madison** — `Other Transportation` +$89.1M and `Conservation and Development` +$51.3M. CMREB distributes capital outlay across activity lines (135-RECON), so a capital-heavy year lands inside the function totals. CY2024 is also the year MAD-01 reconciled to the City's audited ACFR at 1.36%, so the high year is the *audit-checked* one.
- **Dane County** — `Debt Service – Principal` $48.6M → **$180.1M** → $58.7M. In the same year `Other Financing Sources` jumps $140.6M → **$430.9M** while GO debt rises only $511M → $681M: a **refunding**. The refunding proceeds are correctly excluded from revenue, but the principal retired with them stays inside the expenditure total.

That asymmetry is worth stating plainly because it will recur across Wisconsin: **in a refunding year, CMREB's expenditure total includes debt principal paid off with borrowed money.** It is not a loader bug — GAAP governmental-funds reporting does the same thing — but a reader comparing Dane 2023 to Dane 2024 is not comparing like with like. Candidate follow-up for the fan-out.

---

## Finding — the source chip claimed a fetch date it cannot have — FIXED 2026-07-28

**Not caused by this milestone; surfaced by its audit. Flagged as a Chris decision, then fixed on request.**

MAD-06 deliberately sets `source_date` to *the period described*, never the fetch date. The API maps that field to `data_source_info.fetchedAt`, and `SourceChip.tsx:28` renders it as:

> Wisconsin DOR County and Municipal Revenues and Expenditures (unaudited MFR) **· fetched 2024-12-31** ↗

The CY2024 workbook was fetched on 2026-07-27 and did not exist on 2024-12-31. The same string is in the `aria-label`, so screen readers get it too.

**Blast radius: 1,801 budget rows across 67 entities** have `source_date` on or before their own fiscal-year end — including Bend FY2006, whose chip claims it was "fetched 2006-06-30", the last day of the year the ACFR reports on. Wisconsin's 20 rows are a small part of it.

For a project whose core value is that every displayed figure is real and sourced, a false provenance claim in the provenance UI is the wrong defect to carry.

**Applied** (Chris's call, 2026-07-28) — the value *is* a source date, so:

- `SourceChip.tsx` — `· fetched {date}` → **`· as of {date}`**, and the same correction in the `aria-label`, so screen readers get the truthful string too.
- Both doc comments rewritten. The old one — *"ISO date or timestamp of when the data was fetched from the source"* — is how the bug got written in the first place; the replacement states the field is a period-end/publication date and cites the Bend FY2006 case, so the next reader can't repeat it.
- `types/budget.ts` — noted that the API's `fetchedAt` field name is historical and carries `budgets.source_date`.

Truthful for every source, federal included: nothing else in `src/` rendered "fetched". No data change — the stored dates were always right, only the word describing them was wrong. `tsc --noEmit` clean, 35/35 tests pass. (`npm run lint` is a known-broken gate in this repo and was not used.)

**Left alone deliberately:** the prop is still named `fetchDate` and the API field is still `fetchedAt`. Renaming them is a ~10-call-site mechanical change plus an API-repo change, and it is the trap that produced this bug — worth doing, but as its own follow-up rather than widening a diff that lands right before UAT.

## Also noted (no action)

- `hero_image_url` is NULL for **all 2,476** municipalities — the column is unused project-wide; banners come from the shared bucket + Wikipedia fallback. Not a WI gap.
- `budgets.updated_at` / `created_at` are NULL project-wide — not maintained. Out of scope.

---

## MAD-09 — Chris UAT ✅ (2026-07-28)

**14 of 16 items passed on sight.** Two exceptions, both resolved below; neither is a data defect.

### Item 15 — Essentials tether absent on Madison: confirmed cross-repo coverage gap, no TT change

MAD-09 anticipated this outcome and permits it, provided the absence is *documented* rather than shrugged at. It is, and the cause is unambiguous — Essentials' own published catalog:

```
GET https://essentials.empowered.vote/coverage.json   (generatedAt 2026-07-28T05:16Z)
  cities:   144  →  WI entries: 0
  counties:  19  →  WI entries: 0
  states:    50  →  WI: {"label":"Wisconsin","abbrev":"WI"}
```

Wisconsin exists in Essentials only as a **state**. There is no Madison, WI or Dane County, WI record, so there is nothing for TT to deep-link to and `essentialsCoverage.ts` correctly resolves `null`. **TT behaved exactly as designed** — the v2.16 contract says a missing catalog entry degrades to no icon so the hero banner always paints, and that is what happened.

The fix belongs in the **Essentials** repo (`C:/transparent motivations/essentials`), not here: Madison, WI and Dane County, WI need coverage records before the reciprocal icon can appear. Logged as a follow-up. **No TT code change — per the requirement, this ticks.**

### Item 16 — the corrected chip was not yet live

Chris was reading production, where the chip still said "fetched": the fix was committed to `plan/v2.20-madison-wi`, and that branch was **nine commits ahead of `main` and never deployed**. Verified against the deployed bundle rather than assumed:

```
/assets/index-uaxYDfoY.js →  `· fetched ${l}`   (old string still shipping)
```

Shipped by merging the milestone branch to `main`; Netlify builds `main` and serves `dist`. Rebuild verified before pushing: **0 occurrences of `· fetched`, 2 of `· as of`**, aria-label reads `, as of ${l}`.

> **Build note, not a defect.** `npm run build` failed locally on `SiteFooter is not exported by @empoweredvote/ev-ui` — a stale local `node_modules` pinned at **0.9.8** against a `^0.10.0` requirement. `package-lock.json` already resolves 0.10.0, so CI was never affected; `npm install` fixed it and the build passed. The resulting lock diff was pure `peer`-flag churn and was discarded rather than committed.

## Follow-ups leaving this phase

| # | item | where |
|---|---|---|
| 1 | **Madison, WI + Dane County, WI missing from Essentials coverage** — blocks the reciprocal tether icon | Essentials repo, not TT |
| 2 | `fetchDate` prop / `fetchedAt` API field still named for a retrieval time they never carried — the trap that produced the chip defect | TT + EV-Accounts API |
| 3 | **CMREB expenditure includes debt principal retired with borrowed money** in a refunding year (Dane CY2023: $180M debt service against $431M of excluded Other Financing Sources). Not a bug — GAAP governmental funds does the same — but it makes year-over-year reading misleading, and it will recur statewide | `WI-CITIES-01` |
| 4 | Ohio county `OI_Demographics` column offsets still unverified (carried from Phase 136) | `loadOhioAOS.js` |

## Handoff

**Both requirements signed. Phase 137 complete, and with it v2.20** — Madison, WI and Dane County, WI are live, fully re-derived, honestly labelled as unaudited, and navigable under Dane County.

## Artifacts

- `scripts/rederiveWICMREB.py` — the independent re-derivation (tracked; workbooks are not)
- `.planning/phases/137-verification-uat/137-UAT-CHECKLIST.md`
