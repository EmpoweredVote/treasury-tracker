# TUC-01 — Tucson, AZ City Onboarding: Scoping Brief

**Status:** PROMOTED → milestone **v2.17 Tucson, AZ City Onboarding** (Phases 128–130), started 2026-07-10. Locked decisions: **General Fund** basis · history **as deep as ACFRs cleanly tie** · **seed a Pima County** navigation node. See `.planning/REQUIREMENTS.md` (TUC-01..09) + `.planning/ROADMAP.md`.
**Captured:** 2026-07-10 (from a live source-availability probe)
**Requirement:** TUC-01 — bring the City of Tucson, Arizona onto Treasury Tracker at city parity (operating + revenue, sourced, per-capita, enriched), linked under the existing Arizona state node.

---

## Bottom line

Tucson is a **low-to-moderate one-off city load** on the proven `seed → pdfplumber extract → treasury_sync_budget_tree` pipeline (Gresham / Fresno / Oakland / San Jose lineage). Nothing is blocked, the source is free and public, and Arizona already exists as a state node (v2.14 ACFR), so Tucson slots in cleanly. The **only real decisions** are (a) which source to lead with — the city ACFR (GAAP actuals) vs. the OpenGov adopted-budget book — and (b) whether to seed a Pima County linking node or attach Tucson directly under Arizona. There is **no statewide AZ shortcut**: unlike OH/VA/MN, this buys us Tucson alone, not "all AZ cities."

**Anchor figures (grounding):** FY2025 Adopted total (all funds) **>$2.4B**; **General Fund $749.3M** (FY2024 $749.2M); population **~542,000** (2024, AZ's 2nd-largest city).

---

## 0. FY2024 ACFR layout probe (2026-07-10) — BEST-CASE

Downloaded the FY2024 ACFR (236 pp, 5.2 MB, free, no auth) and extracted with **`pdftotext -table`** — the exact tool the state-ACFR loaders already use. The governmental-funds **Statement of Revenues, Expenditures and Changes in Fund Balances** (printed p.30) reads out **cleanly, column-aligned**:

- **Columns:** General Fund · Mass Transit · Disaster Relief · Section 115 Pension Trust · Non-Major Governmental · **Total Governmental Funds** — all correctly separated.
- **GF revenue-by-source (10 rows):** Taxes $405.0M, Other agencies $243.3M, Charges for services $59.4M, Licenses/permits $35.7M, Use of money & property $15.0M, Misc $6.4M, Fines $5.4M, Fed grants $2.6M, Contributions $0.66M, (Developer fees $0 in GF). **Sum ties to printed Total revenues $773,493,270 at exactly $0.**
- **GF expenditure-by-function (nested):** Current → {Public safety & justice $296.8M, Community enrichment & development $70.4M, Support services $118.8M, General government $39.9M, Elected & official $33.5M}; Capital outlay $23.2M; Capital projects $6.1M; Debt service → {Principal $41.3M, Interest $18.5M, Fiscal agent fees $0.02M}. **Sum ties to printed Total expenditures $648,657,363 at exactly $0.**
- Excess $124,835,907 ties ($773,493,270 − $648,657,363). Total Governmental Funds bookend also clean (rev $1,373,161,136 / exp $1,262,441,832).

**Verdict: this is the easy end of the range** — closer to the state-ACFR extractor pattern (clean `-table` columns) than the messier city-pdfplumber cases. `-layout` mode scrambles the multi-fund columns; **`-table` mode is the answer** and is already in our toolbox.

Minor handling only: one wrapped row label ("Community enrichment and / development"), `$`/blank cells in the non-GF columns, and the 2-level expenditure nesting (Current / Debt service parents). A GF **budget-to-actual** schedule is also present (budget $753.1M vs actual $648.7M) if we ever want adopted-vs-actual context.

**Implication for §5:** the extractor is small and low-risk. Multi-year = one ACFR PDF per FY, same statement layout each year.

---

## 1. Source assessment

| Source | What it gives | Format | Auth | Fit |
|--------|---------------|--------|------|-----|
| **City ACFR** (tucsonaz.gov) | Governmental-funds revenue-by-source + expenditure-by-function, GAAP actuals; multi-year archive live (FY2024 published, back several years) | PDF | none | **Primary candidate** — GAAP actuals, consistent with how state + most cities are now sourced |
| **OpenGov "Budget Book"** (stories.opengov.com/tucsonaz) | Adopted budget by fund / department / category, multiple FYs; structured, human-readable | HTML story (+ backing PDFs on tucsonaz.gov) | none | Cleaner for the *adopted budget* view; may expose a data feed worth a quick probe |
| **AZ Auditor General** (azauditor.gov) | AELR expenditure-limit forms only — **not** a rich rev-by-source/function tree | PDF forms | none | ❌ Not icicle-grade; no statewide comparative dataset |
| **openbooks.az.gov** transparency portal | Transaction-level, opt-in cities | portal | none | Out of scope; participation/coverage unverified |

**Conclusion:** Tucson is a per-city ACFR (or adopted-budget) extract, exactly like the CA/OR one-offs — **not** a batch load. No new source infrastructure required.

## 2. Pipeline fit (model on existing scripts)

Three files, all mirroring an existing city:

1. **`scripts/seedTucsonArizona.js`** — municipality upsert (name=Tucson, state=AZ, entity_type=city, population ~542,000 / 2024). Copy `seedGreshamOregon.js` verbatim in structure (idempotent select-by-name→insert/update; data_source rows owned by the processor, not the seeder).
2. **`scripts/extractTucson.py`** — pdfplumber/pdftotext extractor with `--mode operating|revenue`. This is the only genuinely new work; effort is entirely a function of the Tucson PDF's table layout.
3. **`scripts/processTucson.js`** — loads the extracted tree via `treasury_sync_budget_tree` (the source-safe RPC — **never** `treasury_sync_city_budget`, per the never-overwrite convention). Copy `processGresham.js`; keep its security posture (controlled `docs/Tucson/` readdir, spawnSync args-array, per-FY data_source lifecycle, total-sanity assert).

PDFs land in `docs/Tucson/` (gitignored, worktree-unsafe — load on `main`, not in a worktree, per the v2.15 loader notes).

## 3. Data-model / linking decision

Tucson is a city in **Pima County**, which is **not currently loaded**. Two options:

- **(A) Attach Tucson directly under Arizona** (US → Arizona → Tucson). Simplest; matches how single OR cities render. No county node.
- **(B) Seed a Pima County linking node** (US → Arizona → Pima County → Tucson), mirroring the CA `county_id` model + Cities-in-County panel.

**Recommendation: (A) for the milestone**, note (B) as a follow-up. A lone city doesn't justify a county node; add Pima later if/when more AZ cities arrive.

## 4. Proposed scope (single small milestone or a 2–3 phase slice)

- **Phase 1 — Source + extractor.** Download 2–3 FYs of the chosen source into `docs/Tucson/`; build `extractTucson.py`; dry-run validate that the operating total ties the published GF (or all-funds) figure and revenue ties its statement total. Seed the municipality.
- **Phase 2 — Load + enrich.** Live-load operating + revenue via `processTucson.js`; author bleed-safe universal/city-scoped `category_enrichment` for Tucson's vocabulary inline at $0 (delete-then-insert, NULLS-DISTINCT-safe).
- **Phase 3 — Verify + UAT.** Independent re-derivation of the loaded totals vs. the source document ($0 delta target); source-chain audit (every row carries `source_url`); Chris live-app UAT (icicle, Money In/Out, per-capita ~$/resident, source chips).

## 5. Effort estimate

**Low end of the single-city range — the layout probe (§0) came back best-case.** The `pdftotext -table` extract is clean and ties at $0, so the extractor is close to the existing state-ACFR pattern rather than the messier pdfplumber city cases. No new infrastructure, no auth, free source, $0 AI spend (deterministic extract + inline enrichment, consistent with the API-cost guardrail). Realistically a **compact 3-phase slice** (source+extractor → load+enrich → verify+UAT), each phase small. Lead source resolved: **City ACFR GAAP** (probe confirms it's the clean one and it matches how the state + recent cities are sourced).

## 6. Open questions / decisions before planning

1. **Lead source:** ~~ACFR vs OpenGov~~ **RESOLVED by §0 probe → City ACFR GAAP** (clean `-table` extract, ties $0, matches state + recent-city sourcing). Optional: layer the OpenGov adopted book for forward-year context later.
2. **History depth:** how many fiscal years? (ACFR archive supports several; adopted books cover recent FYs.)
3. **Linking:** direct-under-Arizona (A, recommended) vs. seed Pima County node (B)?
4. **All-funds vs. General-Fund scope** for the headline number (GF $749.3M vs. all-funds >$2.4B) — pick one basis and label it honestly, as with the CA GF-vs-all-funds cities.

## 7. Cost / safety

Free public PDFs; `$0`/no paid AI (deterministic extraction + inline enrichment). ACFR/adopted-budget replaces nothing else (Tucson is net-new). Source-safe RPC only. Load on `main` (docs are gitignored → worktree-unsafe).

---

## Appendix — sources

- Tucson ACFRs (multi-year): https://www.tucsonaz.gov/Departments/Business-Services-Department/Accounting-and-Finance/Annual-Comprehensive-Financial-Reports
- FY2024 ACFR (PDF): https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/cot-2024-annual-comprehensive-financial-report.pdf
- FY24/25 OpenGov Budget Book: https://stories.opengov.com/tucsonaz/bc8d4ab7-57be-4de3-9da6-e3229f81f2d3/published/OM7oNQVea
- Budget Highlights / City Overview (FY2025): https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/budget-book-2025/5.1-budget-highlights.pdf
- AZ Auditor General — Cities & Towns: https://www.azauditor.gov/reports-publications/cities-towns
- AZ Financial Transparency Portal: https://openbooks.az.gov/
