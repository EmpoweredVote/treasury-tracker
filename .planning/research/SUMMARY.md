# Research Summary: v1.3 Revenue Completion & Per-Capita Context

**Project:** Treasury Tracker
**Domain:** TX city population data, per-capita spending display, pdftotext revenue extraction
**Researched:** 2026-05-21
**Confidence:** HIGH

---

## Critical Findings

**1. Frontend per-capita display is already built — population in DB is the only unlock.**
`QuickFactsRow.tsx` and `PlainLanguageSummary.tsx` already read `entity.population` and display $/resident when `population > 0`. No frontend code needs to be written for the basic per-capita feature.

**2. Use Census Bureau flat CSV, NOT the Census API.**
`sub-est2024_48.csv` (Texas vintage 2024 estimates) — unauthenticated download, no API key. Filter `SUMLEV === '162'`, use `POPESTIMATE2024` column. The Census API explicitly does not serve current estimates for this vintage.

**3. Name normalization is required.**
Census names include suffixes: "Prosper town", "Celina city", "Princeton city". Must strip/normalize before matching to `municipalities.name`.

**4. Fast-growing cities need 2024 estimates — 2020 Census data produces 2-4x errors.**
Celina: ~16k (2020) vs. ~64k (2024). Princeton: ~11k (2020) vs. ~26k (2024). Using 2020 data inflates per-capita spending dramatically for these cities.

**5. Prosper/Celina revenue must be validated before enabling per-capita revenue display.**
Prior Haiku vision pipeline produced inflated revenue totals. pdftotext extraction must be validated against ACFR published totals (reject if >20% over) before per-capita revenue figures are shown.

**6. Schema path decision required before Phase 1.**
- Path A (fast): Add `population_year` column to existing `municipalities.population` — zero frontend changes, one migration, valid for v1.3
- Path B (recommended): New `municipality_populations` table with `municipality_id, population, pop_year, vintage, source` — correct long-term, enables multi-year history

---

## Stack Additions

| Addition | Purpose | Notes |
|----------|---------|-------|
| `scripts/loadTXPopulation.js` | Download Census CSV, parse, upsert to municipalities | Node 18+ fetch(), no new packages |
| Census flat CSV `sub-est2024_48.csv` | TX city population estimates (2024 vintage) | Unauthenticated download from Census Bureau |
| DB migration | Add `population_year` (Path A) or new table (Path B) | Decision required before execution |

No new npm packages. No new infrastructure. No new API credentials.

---

## Feature Table Stakes

**Must have (per-capita display):**
- Population year label on per-capita figures (e.g., "Based on 2024 Census estimate")
- Scope label: "Operating Budget" vs. "General Fund" — clarifies what the per-capita figure represents
- Per-capita restricted to most recent fiscal year for v1.3 (multi-year with single population vintage creates false "spending declining" trend)

**Should have:**
- Enterprise fund disclosure where applicable (Sachse vs. Dallas — audit which budgets include utility funds)

**Defer:**
- Cross-city per-capita comparison table
- Sub-category per-capita
- Multi-year population loading

---

## Top Pitfalls

1. **Wrong population vintage** — Celina grew 285% since 2020. If `POPESTIMATE2024` is not used, per-capita errors of 2-4x result. Detection: if Celina < 20k or Princeton < 25k after load, wrong vintage was used.

2. **Inflated Prosper/Celina revenue displayed as per-capita** — Gate per-capita revenue on pdftotext validation. Don't enable until DB total matches ACFR within 20%.

3. **No vintage year stored** — Add `population_year` from day one. Vintage 2025 data will release ~mid-2026 and you'll need to update.

4. **Richardson missing from population load** — Include Richardson in the population load even if its budget isn't yet loaded. Cities missing population produce inconsistent per-capita display.

5. **Multi-year per-capita false trend** — One population figure across FY2018–FY2026 makes fast-growing cities look like spending per resident is declining. Restrict per-capita to most recent FY for v1.3.

---

## Open Questions

| Question | Impact | Resolution |
|----------|--------|------------|
| Schema Path A vs. B? | HIGH | Decide before Phase 1 — affects all subsequent work |
| Richardson URL accessible? | HIGH | Was blocked in v1.2 — verify before committing to Phase 3 |
| Enterprise fund scope per city? | MEDIUM | Audit before cross-city per-capita comparison (deferred to v1.4+) |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Census CSV URL, column names, FIPS codes verified; frontend integration confirmed via source file audit |
| Features | HIGH | Milestone scope is concrete; deferred features are well-bounded |
| Architecture | HIGH | Schema tradeoffs clear; per-capita calculation placement unambiguous |
| Pitfalls | HIGH | Growth rates verified; Haiku inflation confirmed from Phase 9 context |

**Overall: HIGH** — unknowns are operational checks (Richardson URL, PDF extraction quality), not research gaps.

---

**Note:** `.planning/research/FEATURES.md` and `ARCHITECTURE.md` in this directory contain GiveButter donation UX research from a prior session. Valid for a future milestone but not relevant to v1.3.

---

*Research synthesized: 2026-05-21*
*Ready for roadmap: yes*
