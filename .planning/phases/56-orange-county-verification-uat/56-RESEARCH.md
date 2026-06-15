# Phase 56: Orange County Verification + UAT — Research

**Researched:** 2026-06-15
**Domain:** Data reconciliation, ACFR spot-checking, live-app UAT verification
**Confidence:** HIGH (DB queries confirmed, component code read, ACFR sources located)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Reconciliation basis + tolerance):** Spot-check each sampled OC figure against the SAME basis in the city's published ACFR / adopted budget — compare adopted General Fund budget to published adopted GF total, audited actuals to actuals. Pass within ~1–2%. Record a short definitional note wherever bases differ (adopted-vs-actuals, General Fund vs. all-funds). Honest and achievable given the known definition drift between source documents.
- **D-02 (Sample scope):** Representative sample of ~6–8 OC cities: the largest by budget + both custom-sourced cities (Anaheim, Santa Ana) + a couple of small cities. Check the latest fiscal year + one historical year. Cover operating + revenue datasets. Salaries already reconciled to GCC in Phase 55 — not re-checked here.
- **D-03 (UAT checklist):** Sign-off covers: (1) City → county breadcrumb chain works. (2) County page → CitiesInCountyPanel lists all 34 OC cities and links work. (3) Salaries tab appears on covered cities and renders the names-free Dept→Position tree. (4) Per-capita display works for OC cities. (5) Custom-sourced Anaheim / Santa Ana render correctly (operating + revenue unchanged). App URL: https://treasurytracker.empowered.vote
- **D-04 (Discrepancy handling):** Definitional mismatches are documented as sourced known-variances and PASS; only genuine load errors (wrong total, wrong year, wrong mapping) open a fix within this phase.

### Claude's Discretion

- Verification methodology/automation: a `verify-phase56.mjs` DB-probe script is the established precedent (cf. `scripts/verify-phase32.mjs` / `verify-phase33.mjs` / `verify-phase34.mjs`) plus a documented `56-VERIFICATION.md` / UAT artifact recording the per-city checks, figures, deltas, and definitional notes.
- Exact 6–8 city sample selection (per D-02 rule) and which historical year to use.
- Where to source each city's published ACFR / adopted budget figure (official city finance pages), and the exact figure cited per check.
- The reconciliation probe SQL/queries against schema `treasury`.

### Deferred Ideas (OUT OF SCOPE)

- Exhaustive all-34-city ACFR reconciliation — spot-check sample only (D-02); could be a future deeper-audit pass if desired.
- Any data corrections beyond genuine load errors (e.g. re-loading to a different basis, adding missing years) — out of scope; document as variance (D-04) and revisit in a future phase if warranted.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | Orange County city budget totals are spot-checked against published ACFRs / adopted budgets and pass, with the checks documented | DB probe confirms totals; ACFR/adopted budget sources located for recommended sample cities; definitional note protocol established (all-funds vs. GF basis difference) |
| VER-02 | The breadcrumb chain and Cities-in-Orange-County panel are verified end-to-end in the live app, with Chris UAT sign-off | Component code read (Breadcrumb.tsx, CitiesInCountyPanel.tsx); 34-city county_id linkage confirmed from DB; Phase 54 human gate precedent established |
</phase_requirements>

---

## Summary

Phase 56 is a verification + UAT phase: no new code, no new data. It closes the v2.2 milestone by independently confirming the accuracy of already-loaded Orange County data and getting Chris's sign-off on the OC navigation experience.

The verification work has two distinct parts. First, DB-probe automation: a `verify-phase56.mjs` script (following the established `verify-phase32/33/34.mjs` pattern) queries `treasury.budgets` for sampled OC cities and asserts coverage, source attribution, and year-range presence. Second, manual ACFR reconciliation: for each sampled city, the researcher opens the city's published ACFR or adopted budget PDF, reads the corresponding total (same basis: all-government-funds expenditures from the City Financial Transactions Report), records the figure, computes delta, and documents any definitional note. Third, live-app UAT: Chris navigates the five checklist surfaces at https://treasurytracker.empowered.vote and signs off.

A critical definitional fact discovered during research: the CA State Controller ByTheNumbers expenditure feed (`/d/ju3w-4gxp`) is the **City Financial Transactions Report — all government funds**, not General Fund only. Anaheim FY2024: SCO total $1.640B vs. Anaheim's published adopted General Fund budget of ~$462M (FY2023-24 Budget In Brief). The reconciliation plan MUST compare SCO all-funds totals to the corresponding all-funds (total government expenditures) figure in each city's ACFR — NOT the General Fund summary page. The definitional note in every row should state: "SCO ByTheNumbers = all government funds (City Financial Transactions Report); compared to ACFR Statement of Revenues, Expenditures, and Changes in Fund Balances — All Governmental Funds."

**Primary recommendation:** Write a single `verify-phase56.mjs` DB-probe that covers the automatable assertions (coverage, attribution, year range, county_id presence), then produce a separate `56-VERIFICATION.md` documenting the per-city ACFR spot-checks and the UAT sign-off.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DB-probe reconciliation assertions | Backend (DB) | — | `treasury.budgets` / `treasury.municipalities` queried directly via Supabase REST; no frontend involved |
| ACFR figure sourcing | External (published PDFs) | — | City finance pages; human reads PDF, records figure |
| Live-app nav UAT | Browser / Client | Frontend Server | Chris navigates https://treasurytracker.empowered.vote; Breadcrumb + CitiesInCountyPanel render from API |
| Discrepancy classification | Human judgment | — | D-04 definitional vs. genuine-error distinction requires human review |
| Sign-off artifact | Documentation | — | VERIFICATION.md records all checks; Chris provides UAT sign-off |

---

## Sample Selection (D-02)

### Recommended 7-City Sample

Based on DB query of all 34 OC cities ranked by FY2024 operating budget total (query run 2026-06-15 against production `treasury` schema):

| Rank | City | FY2024 Operating | FY2019 Operating | Source | Rationale |
|------|------|-----------------|-----------------|--------|-----------|
| 1 | Anaheim | $1,640,316,917 | $1,382,753,742 | ByTheNumbers (FY2024); custom (FY2025+) | **Mandatory** — custom-sourced for FY2025/26; largest city; highest-risk |
| 5 | Santa Ana | $414,022,680 | $535,376,778 | Custom (FY2023–2026) | **Mandatory** — fully custom-sourced; second highest-risk |
| 2 | Irvine | $656,013,821 | $370,794,817 | ByTheNumbers | **Include** — 2nd largest; already canary-verified in Phase 53; good benchmark |
| 3 | Huntington Beach | $464,376,984 | $323,441,057 | ByTheNumbers | **Include** — 3rd largest; already spot-checked in Phase 53 (FY2019 exact match) |
| 4 | Newport Beach | $444,327,078 | $305,659,186 | ByTheNumbers | **Include** — 4th largest; not yet independently checked |
| 34 | Villa Park | $6,111,009 | $6,024,779 | ByTheNumbers | **Small city** — smallest budget in OC; tests small-city handling |
| 33 | Laguna Woods | $10,051,862 | $7,763,978 | ByTheNumbers | **Small city** — 2nd smallest; distinct from Villa Park (separate ACFR source) |

**Historical year:** FY2019 for all ByTheNumbers cities (available in DB, not already spot-checked; provides cross-year coverage per D-02). For Santa Ana, use FY2019 (ByTheNumbers) and FY2024 (custom source — independent reconciliation against adopted budget doc).

**Coverage:** 2 custom-sourced (mandatory) + 3 largest ByTheNumbers + 2 small ByTheNumbers = 7 cities. Operating + revenue both checked for each. Satisfies D-02.

### DB City IDs (for probe SQL)

| City | municipality_id |
|------|----------------|
| Anaheim | `7fbdd013-69c9-41fb-a87d-c9ca7b3cdeb5` |
| Santa Ana | `2dc65052-aa62-4a3c-a5c0-eea78dfe9ad3` |
| Irvine | `17f0abc4-751f-4609-adcd-d6274ed33269` |
| Huntington Beach | `d0b51865-2581-4091-8d4c-18e2a2750657` |
| Newport Beach | `a091a210-e017-47df-ba65-5e2bf43c95c8` |
| Villa Park | `ce99c02d-b889-4c38-832d-face172b5a8c` |
| Laguna Woods | `3a25551e-5a40-40a7-ac72-3e6938695f40` |
| Orange County entity | `65e7c643-5829-4821-9537-f8595bce61ab` |

---

## ACFR / Adopted Budget Sources

### Critical Definitional Note (applies to ALL cities)

[VERIFIED: DB probe + Anaheim Budget In Brief comparison]

The CA State Controller ByTheNumbers expenditure dataset (`/d/ju3w-4gxp`) is the **City Financial Transactions Report — all government funds combined**, not General Fund only.

Evidence: Anaheim FY2024 in DB = $1,640,316,917 (SCO all-funds). Anaheim FY2023-24 adopted General Fund budget per official "Budget In Brief" = ~$462M. The difference (~$1.18B) reflects enterprise funds, capital projects, debt service, and other non-GF funds that the SCO CTR includes.

**Reconciliation approach:** For each sampled city, the implementer must locate the ACFR's "Statement of Revenues, Expenditures, and Changes in Fund Balances — All Governmental Funds" (or "Government-Wide Statement of Activities") total, NOT the General Fund summary. Document the specific ACFR table used in the definitional note column of VERIFICATION.md.

For Anaheim/Santa Ana custom-sourced years (Anaheim FY2025/2026; Santa Ana FY2023-2026), the comparison figure is from the city's own adopted budget document (the original load source), checking that the stored total matches the document total.

### Per-City Source Locations

| City | ACFR / Budget Source | Available FY | URL / Path | Basis to Match |
|------|---------------------|-------------|------------|----------------|
| Anaheim | Financial Reports & Documents page | FY2022-23 ACFR confirmed; FY2023-24 likely available | https://www.anaheim.net/2846/Financial-Reports-Documents — Archive: https://www.anaheim.net/Archive.aspx?AMID=37 | All-governmental-funds expenditures from ACFR |
| Anaheim (FY2025/26 custom) | Anaheim Budget In Brief / Adopted Budget document | FY2023-24 Budget In Brief confirms ~$462M GF (distinct from SCO $1.64B) | https://www.anaheim.net/DocumentCenter/View/55990/Budget-In-Brief-23-24-Final | Original load source doc — cross-check custom totals |
| Santa Ana | Adopted Budget Book (city website) | FY2023-24 and FY2024-25 confirmed available | https://www.santa-ana.org/budget/ — FY2023-24: https://www.santa-ana.org/documents/fy-2023-24-adopted-budget-book-june-20th-2023/ | All-governmental-funds expenditures OR adopted budget total |
| Irvine | City Financial Reports page | FY2023-24 expected available | https://www.cityofirvine.org/administrative-services-department/financial-reports (redirects to cityofirvine.gov) | ACFR all-governmental-funds expenditures |
| Huntington Beach | Finance / Budget & Financial Reports page | FY2022-23 ACFR confirmed via OC Auditor; FY2023-24 likely on city site | https://www.huntingtonbeachca.gov/departments/finance/budget_financial_reports.php | ACFR all-governmental-funds expenditures |
| Newport Beach | Annual Comprehensive Financial Reports page | FY2023-24 and FY2024-25 confirmed available via OC Auditor | https://www.newportbeachca.gov/government/departments/finance/annual-comprehensive-financial-reports | ACFR all-governmental-funds expenditures |
| Villa Park | Finance Department page | FY2023-24 expected | https://villapark.org/Departments/Finance | ACFR all-governmental-funds expenditures |
| Laguna Woods | Audit Reports page | FY2023-24 and FY2024-25 confirmed available | https://www.cityoflagunawoods.org/audit-reports/ — Direct: https://www.lagunawoods.gov/wp-content/uploads/2025/12/Annual-Comprehensive-Financial-Report-FY-2024-25.pdf | ACFR all-governmental-funds expenditures |

[ASSUMED] FY2023-24 ACFRs for Irvine, Huntington Beach, and Villa Park — confirmed as expected available from web search but not directly fetched/verified during research. Implementer must locate and download these PDFs during plan execution.

[CITED: https://www.anaheim.net/DocumentCenter/View/55990/Budget-In-Brief-23-24-Final] Anaheim FY2023-24 Budget In Brief confirms ~$462M General Fund adopted budget total (distinct from $1.640B SCO all-funds figure in DB for FY2024).

[CITED: https://www.santa-ana.org/budget/] Santa Ana adopted budget books available for FY2023-24 and FY2024-25.

[CITED: https://www.cityoflagunawoods.org/audit-reports/] Laguna Woods FY2023-24 ACFR confirmed available; FY2024-25 also available.

[CITED: ocauditor.gov] OC Auditor hosts independent copies of city ACFRs; HB FY2022-23 confirmed at https://ocauditor.gov/wp-content/uploads/2024/01/City-of-HB-Audited-FS-ended-6-30-23.pdf

### Tolerance and Pass/Fail Protocol (D-01)

- **Pass threshold:** delta within ~1–2% of the ACFR total
- **Definitional note required:** whenever basis differs between SCO and ACFR (e.g., adopted vs. actuals, all-funds vs. all-governmental-funds)
- **Genuine load error triggers fix:** wrong total digit, wrong fiscal year mapping, wrong city mapped
- **Definitional variance documents as PASS:** SCO all-funds vs. ACFR all-governmental-funds scope differences (e.g., enterprise fund treatment differences) are expected and documented, not errors

---

## DB Probe Design (verify-phase56.mjs)

### Pattern (follows verify-phase34.mjs)

The script follows the established pattern exactly:

1. Load `.env` / `.env.local` for `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
2. Use Node.js native `https.request` with `Accept-Profile: treasury` header (NOT `@supabase/supabase-js` — verify-phase34 uses `createClient` from supabase-js but verify-phase34's DB section actually uses raw `https.request` for the FY=9999 check)
3. Pass/fail with `[PASS]`/`[FAIL]` prefix pattern, `results[]` accumulator, exit 0/1
4. DB schema: `treasury` (set via `Accept-Profile: treasury` header on PostgREST requests)
5. Use `content-range` header for count queries (HEAD request + `Prefer: count=exact`)

### Automatable Assertions for VER-01 / VER-02

| Gap ID | Assertion | SQL/Query | Auto? |
|--------|-----------|-----------|-------|
| 56-01-01 | All 34 OC cities have county_id = OC entity | `municipalities WHERE county_id = '65e7c643-…' AND entity_type = 'city'` — count = 34 | Yes |
| 56-01-02 | All 34 OC cities have operating rows for FY2003–2024 | `budgets WHERE municipality_id IN (34 ids) AND fiscal_year IN (2003..2024) AND dataset_type = 'operating'` — count ≥ 33×22 | Yes |
| 56-01-03 | All 34 OC cities have revenue rows for FY2003–2024 | Same as 56-01-02 with dataset_type = 'revenue' | Yes |
| 56-01-04 | ByTheNumbers rows have correct durable source_url | `budgets WHERE source_url NOT LIKE '%/d/ju3w-4gxp%' AND source_url IS NOT NULL AND dataset_type = 'operating'` — count = 0 | Yes |
| 56-01-05 | Anaheim/Santa Ana custom rows preserved | Anaheim: 4 rows (FY2025-26 op+rev) with NULL source_url; Santa Ana: 8+ rows (FY2023-26 op+rev) with NULL source_url | Yes |
| 56-01-06 | Sampled city FY2024 operating totals match known verified values | Irvine FY2024 op = $656,013,821; HB FY2019 op = $323,441,057 | Yes — assert previously-verified exact values |
| 56-01-07 | Salaries coverage: all 34 OC cities have salaries rows | `budgets WHERE municipality_id IN (34 ids) AND dataset_type = 'salaries'` — count = 34 | Yes |
| 56-01-08 | REQUIREMENTS.md marks VER-01, VER-02 as [x] complete | File content check post-verification | Yes (post-sign-off) |
| 56-02-01 | ACFR spot-check: sampled 7 cities pass within 1–2% | Manual ACFR PDF lookup per city | No — human judgment |
| 56-03-01 | Live-app UAT: 5 nav surfaces confirmed by Chris | Navigate app, confirm breadcrumb + panel + salaries + per-capita + Anaheim/Santa Ana | No — human only |

### Key DB Query Patterns

```javascript
// Count OC cities
GET /rest/v1/municipalities?county_id=eq.65e7c643-5829-4821-9537-f8595bce61ab&entity_type=eq.city&select=id
Headers: Accept-Profile: treasury, Prefer: count=exact
Method: HEAD → parse content-range

// Get sampled city totals for exact-match assertions
GET /rest/v1/budgets?municipality_id=in.(id1,id2,...)&fiscal_year=in.(2024,2019)&dataset_type=eq.operating&select=municipality_id,fiscal_year,total_budget,source_url
Headers: Accept-Profile: treasury

// Check Anaheim/Santa Ana custom rows
GET /rest/v1/budgets?municipality_id=eq.<id>&source_url=is.null&dataset_type=in.(operating,revenue)&select=municipality_id,fiscal_year,dataset_type,total_budget
Headers: Accept-Profile: treasury
```

### Known DB Values (from probe run 2026-06-15)

These are confirmed exact values to assert in the probe:

| City | FY | Dataset | DB Total |
|------|----|---------|----------|
| Irvine | 2024 | operating | $656,013,821 |
| Huntington Beach | 2019 | operating | $323,441,057 |
| Anaheim | 2024 | operating | $1,640,316,917 (ByTheNumbers) |
| Anaheim | 2025 | operating | $490,937,159 (custom) |
| Santa Ana | 2024 | operating | $414,022,680 (custom) |
| Santa Ana | 2024 | revenue | $400,947,213 (custom) |
| Newport Beach | 2024 | operating | $444,327,078 |
| Villa Park | 2024 | operating | $6,111,009 |
| Laguna Woods | 2024 | operating | $10,051,862 |

---

## Navigation Components Under UAT

### Breadcrumb.tsx

[VERIFIED: codebase grep] Located at `src/components/Breadcrumb.tsx`. Renders a flat `BreadcrumbItem[]` array as `<nav>` with `/`-delimited items. Items with `onClick` render as `<button>` (clickable); items without `onClick` render as `<span>` (current page, non-clickable). The `aria-current="page"` attribute marks the last item. The breadcrumb chain (US → California → Orange County → City) is populated by App.tsx/routing logic, not by this component itself.

**UAT verification approach:** Navigate to any OC city page (e.g., Irvine). Confirm breadcrumb renders: `United States / California / Orange County / Irvine`. Click `Orange County` — confirm navigation to OC county page. Click `California` — confirm navigation to CA state page.

### CitiesInCountyPanel.tsx

[VERIFIED: codebase grep] Located at `src/components/CitiesInCountyPanel.tsx`. Renders based on `municipalities.filter(m => m.county_id === county.id && m.entity_type === 'city')`. Cities with `available_datasets.length > 0` appear under "Available now (N)" section with clickable buttons; cities without data appear under "Coming soon (N)" as non-clickable spans. Both sections sorted alphabetically.

**UAT verification approach:** Navigate to Orange County page. Confirm "Cities in Orange County" panel renders. Count "Available now" — should be 34 (all 34 OC cities have data). Confirm a sample of city links navigate correctly (at minimum Irvine, Anaheim, Santa Ana, Villa Park).

**Key concern:** All 34 OC cities have `available_datasets.length > 0` (all have operating + revenue + salaries rows from Phases 53–55). The "Coming soon" section should be empty for OC. The Phase 54 human-gate check (operator-approved Irvine/Huntington Beach + county page) already confirmed this — UAT confirms it remains true post-Phase 55 salaries addition.

### Salaries Tab

The salaries tab renders the Dept→Position tree from `dataset_type='salaries'` rows. All 34 OC cities have salaries loaded (Phase 55). UAT check: navigate to 2-3 OC cities (including Irvine — SC-4 verified), confirm the Salaries tab appears and shows department/position breakdown. Dept names show normalized labels (e.g., "Public Works" from `Pw`, "Human Resources" from `Hum Res`) per Phase 55 normalizeDeptLabel fix.

---

## Architecture Patterns

### Verification Artifact Pattern

Every phase produces two verification outputs:

1. **`verify-phaseXX.mjs`** — automated DB-probe script run by the verifier (not the implementer). Exits 0 on all pass, 1 on any fail. Located in `scripts/`.
2. **`XX-VERIFICATION.md`** — human-readable verification report documenting: goal achievement, must-haves, per-city ACFR spot-check table, UAT sign-off, decisions honored, deviations.

For Phase 56, the `56-VERIFICATION.md` must include:
- A per-city reconciliation table (7 rows × 2 years × 2 datasets = ~28 checks)
- A "Definitional Notes" section explaining the SCO all-funds vs. ACFR basis difference
- A "UAT Sign-Off" section with Chris's explicit approval per D-03 checklist

### VERIFICATION.md Reconciliation Table Template

```markdown
## ACFR Spot-Checks

| City | FY | Dataset | DB Total | ACFR / Budget Source | ACFR Figure | Delta | Delta % | Result | Definitional Note |
|------|----|---------|----------|--------------------|-------------|-------|---------|--------|-------------------|
| Irvine | 2024 | operating | $656,013,821 | Irvine ACFR FY2023-24, Stmt GF | $xxx | $x | x% | PASS | SCO all-gov-funds vs ACFR [page/table ref] |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
```

### Recommended Project Structure

No new project files or directories needed. Phase 56 produces:

```
scripts/
└── verify-phase56.mjs        # New — automated DB-probe
.planning/phases/56-orange-county-verification-uat/
├── 56-CONTEXT.md             # Existing
├── 56-RESEARCH.md            # This file
├── 56-PLAN.md                # Planner produces
├── 56-VERIFICATION.md        # Executor produces during implementation
└── 56-UAT-SIGNOFF.md         # Or section within VERIFICATION.md — Chris signs off
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB connectivity in verify script | Custom fetch wrapper | Native `node:https` + `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` with `Accept-Profile: treasury` header | Established pattern in verify-phase34.mjs; no extra deps |
| ACFR PDF parsing | PDF scraping code | Human reads ACFR PDF directly | ACFRs are binary PDFs; fetching via WebFetch returns binary content (confirmed during research); human reads the relevant Statement page |
| All-funds figure computation | SQL aggregation | Read `treasury.budgets.total_budget` directly | Phase 53 loader already aggregated and stored the total in `total_budget`; no re-aggregation needed |
| City ranking lookup | Additional API call | Use pre-queried rankings in this RESEARCH.md | All 34 cities ranked by FY2024 operating budget (from probe run 2026-06-15) |

---

## Common Pitfalls

### Pitfall 1: Comparing SCO totals to General Fund figures

**What goes wrong:** The researcher opens an ACFR, goes straight to the "General Fund" summary table, reads the GF expenditure total (~$400-500M for Irvine), compares to SCO total ($656M), and concludes there is a $156M discrepancy — flagging a load error that doesn't exist.

**Why it happens:** ACFRs organize financials by fund. The General Fund summary is the most prominent table. SCO ByTheNumbers is all-government-funds combined.

**How to avoid:** Always use the "Statement of Revenues, Expenditures, and Changes in Fund Balances — All Governmental Funds" or the "Government-Wide Statement of Activities" (all activities column) as the comparison figure. Document which ACFR table was used in the definitional note column.

**Warning signs:** Delta > 30% is a strong signal the wrong basis was used (not a load error). Delta of exactly GF/all-funds ratio for that city is a definitional mismatch.

### Pitfall 2: Expecting Anaheim FY2024 to match custom-source docs

**What goes wrong:** Researcher looks for Anaheim FY2024 in the custom-source document (which covers FY2025/2026 only), finds the total doesn't match, raises a discrepancy.

**Why it happens:** Anaheim has a split: FY2003-2024 from SCO ByTheNumbers; FY2025-2026 from custom source. The custom-source document is for FY2025/2026 only.

**How to avoid:** For Anaheim, reconcile FY2024 against the Anaheim ACFR (all-governmental-funds). For Anaheim FY2025/2026, check the custom source doc. The DB shows `source_url = NULL` for FY2025/2026 (custom) and `source_url = ...ju3w-4gxp` for FY2024 and earlier.

### Pitfall 3: Adopted budget vs. actuals basis mismatch

**What goes wrong:** For cities where only the adopted budget is easily findable (vs. a full ACFR), adopted budget differs from actual expenditures. SCO reports actuals (what was spent). Cities often spend less than their adopted budget.

**Why it happens:** ACFRs report actuals; adopted budget documents report authorized spending. These differ by year-end surplus/deficit.

**How to avoid:** Prefer the ACFR (actuals) over adopted budget (authorized) for comparison to SCO actuals. If only adopted budget is available, document this in the definitional note and accept a wider tolerance (actuals typically run 3-8% under adopted budget for California cities). This is a known-variance, not a load error (D-04).

### Pitfall 4: Santa Ana FY2019 source confusion

**What goes wrong:** Verifier checks Santa Ana FY2019 in DB ($535,376,778 operating) and finds `source_url` pointing to ByTheNumbers — assumes it should be from custom source.

**Why it happens:** Santa Ana's custom-sourced data only covers FY2023-2026. FY2019 was loaded from ByTheNumbers (correctly — no collision).

**How to avoid:** Santa Ana FY2019 should be reconciled against the Santa Ana FY2019 ACFR (all-governmental-funds), same as any ByTheNumbers city. DB `source_url` for FY2019 = `bythenumbers.sco.ca.gov/d/ju3w-4gxp` — correct.

### Pitfall 5: CitiesInCountyPanel "Available now" count ≠ 34

**What goes wrong:** Panel shows fewer than 34 cities in "Available now" — appears to be a bug.

**Why it happens:** Panel filters on `available_datasets.length > 0`. If any OC city's municipality record in the API response has empty `available_datasets`, it falls into "Coming soon."

**How to avoid:** If count < 34 in "Available now", check whether the API response for that city includes dataset rows. This would be a data integrity issue (city has budget rows in DB but API doesn't return datasets) — investigate `getCities()` query in treasuryService.ts before filing a bug.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CAFR (Comprehensive Annual Financial Report) | ACFR (Annual Comprehensive Financial Report) | GASB re-branding ~2021 | Same document, new acronym; both terms appear on city websites — search for both |
| Manual city data collection | SCO ByTheNumbers bulk pipeline | Phase 52 (2026-06-14) | 34 cities loaded in one command; spot-check only needed now |
| Round-trip verification (re-read source, re-load, compare) | Independent verification (read ACFR, compare to stored total) | Phase 56 design decision | Catches semantic errors in addition to pipeline bugs |

---

## Runtime State Inventory

Step 2.5 SKIPPED — Phase 56 is a verification + UAT phase with no rename, refactor, or migration. No runtime state to inventory.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `verify-phase56.mjs` | Yes (inferred from prior phases) | v18+ (proj uses ESM/top-level await) | — |
| `SUPABASE_URL` in `.env` | DB probe | Yes | kxsdzaojfaibhuzmclfq.supabase.co | — |
| `SUPABASE_SERVICE_KEY` in `.env` | DB probe | Yes | Valid (confirmed by probe run 2026-06-15) | — |
| Live app at https://treasurytracker.empowered.vote | UAT | Assumed yes (Phase 54 operator used it for human gate) | — | — |
| City ACFR PDFs | ACFR spot-check | Confirmed for Laguna Woods (direct URL), Newport Beach, Santa Ana; assumed for Irvine, HB, Anaheim, Villa Park | FY2023-24 | OC Auditor mirror may host copies for some cities |
| Browser | UAT | Yes (Chris's local browser) | Any modern browser | — |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** If a city's FY2023-24 ACFR is not yet published (possible for Irvine, Villa Park — smaller cities sometimes lag), fall back to FY2022-23 ACFR for that city, document the year difference in the definitional note, and accept the delta vs. FY2024 DB row as a year-basis variance.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js native (no test runner — same as all prior verify-phase scripts) |
| Config file | None — standalone script |
| Quick run command | `node scripts/verify-phase56.mjs` |
| Full suite command | Same — single script covers all automatable assertions |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Auto? |
|--------|----------|-----------|-------------------|-------|
| VER-01 | 34 OC cities exist with county_id = OC entity | DB assertion | `node scripts/verify-phase56.mjs` (gap 56-01-01) | Yes |
| VER-01 | All 34 cities have operating rows FY2003-2024 | DB assertion | `node scripts/verify-phase56.mjs` (gap 56-01-02) | Yes |
| VER-01 | All 34 cities have revenue rows FY2003-2024 | DB assertion | `node scripts/verify-phase56.mjs` (gap 56-01-03) | Yes |
| VER-01 | ByTheNumbers rows have durable source_url | DB assertion | `node scripts/verify-phase56.mjs` (gap 56-01-04) | Yes |
| VER-01 | Anaheim/Santa Ana custom rows preserved | DB assertion | `node scripts/verify-phase56.mjs` (gap 56-01-05) | Yes |
| VER-01 | Known-good city/year totals assert exactly | DB assertion | `node scripts/verify-phase56.mjs` (gap 56-01-06) | Yes |
| VER-01 | ACFR spot-check: 7 cities pass within 1-2% | Manual ACFR PDF review | n/a — human reads ACFR, records in VERIFICATION.md | Human |
| VER-01 | All 34 cities have salaries rows | DB assertion | `node scripts/verify-phase56.mjs` (gap 56-01-07) | Yes |
| VER-02 | Breadcrumb chain works (city → county → state) | Live-app UAT | n/a — Chris navigates https://treasurytracker.empowered.vote | Human |
| VER-02 | CitiesInCountyPanel lists all 34 OC cities | Live-app UAT | n/a — Chris counts "Available now" on OC county page | Human |
| VER-02 | Salaries tab present + renders on covered cities | Live-app UAT | n/a — Chris checks 2-3 OC city pages | Human |
| VER-02 | Per-capita display works on OC cities | Live-app UAT | n/a — Chris confirms $/resident shown | Human |
| VER-02 | Anaheim / Santa Ana render correctly | Live-app UAT | n/a — Chris navigates both cities | Human |
| VER-02 | Chris UAT sign-off | Explicit sign-off | n/a — recorded in VERIFICATION.md | Human |

### Sampling Rate

- **Phase gate:** `node scripts/verify-phase56.mjs` must exit 0 AND human ACFR checks documented AND Chris UAT sign-off recorded in VERIFICATION.md before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/verify-phase56.mjs` — does not exist; must be created in Wave 0 of planning
- [ ] `.planning/phases/56-orange-county-verification-uat/56-VERIFICATION.md` — does not exist; produced during implementation

The automated gap checks (56-01-01 through 56-01-08) can all be defined up front since the DB state is known. The human gaps (ACFR spot-check + UAT) are documented in VERIFICATION.md during execution.

---

## Security Domain

This phase introduces no new endpoints, code, or schema changes. It is read-only verification. Security domain is not applicable to this phase.

The `verify-phase56.mjs` script is read-only (no writes to DB). SUPABASE_SERVICE_KEY is used for schema selection only — consistent with all prior verify-phase scripts.

---

## Open Questions

1. **Anaheim FY2023-24 ACFR availability**
   - What we know: Anaheim ACFR Archive page (`anaheim.net/Archive.aspx?AMID=37`) lists recent reports; FY2022-23 ACFR confirmed. FY2023-24 (ended June 30, 2024) would normally be published by December 2024 — likely available by research date.
   - What's unclear: Exact PDF URL for FY2023-24 ACFR (page returned binary/too large for WebFetch).
   - Recommendation: Implementer visits `https://www.anaheim.net/Archive.aspx?AMID=37` directly and downloads the most recent ACFR PDF; look for "FY 2023-24" or "Year Ended June 30, 2024."

2. **Villa Park FY2023-24 ACFR**
   - What we know: Villa Park Finance page (`villapark.org/Departments/Finance`) confirmed to exist. Villa Park is a very small city ($6.1M operating budget); their ACFR may be produced by a shared service or county auditor.
   - What's unclear: Whether FY2023-24 ACFR is independently published or part of a joint report.
   - Recommendation: If Villa Park FY2023-24 ACFR is not findable within 15 minutes, fall back to FY2022-23 ACFR for that city's reconciliation check (document year difference in definitional note).

3. **SCO ByTheNumbers dataset basis documentation**
   - What we know: The DB comparison ($1.640B Anaheim FY2024 SCO vs. $462M adopted GF) confirms SCO is all-funds. The dataset description at data.ca.gov says "City Financial Transactions Report" but doesn't explicitly say "all funds."
   - What's unclear: Whether SCO CTR is strictly all governmental funds, or includes enterprise/internal service funds too.
   - Recommendation: Note in VERIFICATION.md that the SCO CTR appears to be all-funds (governmental + proprietary) based on magnitude evidence; this is the largest known variance source; any delta ≤ 5% vs. ACFR governmental funds total should be accepted as within-basis-definition tolerance.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Irvine, Huntington Beach, Villa Park FY2023-24 ACFRs are available on their city finance pages | ACFR Sources | Low risk — if unavailable, fall back to FY2022-23 ACFR; document year difference |
| A2 | All 34 OC cities appear in "Available now" in CitiesInCountyPanel (i.e., all have available_datasets > 0 in API response) | Nav Components | Low risk — Phase 54 human gate already verified for Irvine/HB; Phase 55 added salaries for all 34 |
| A3 | Node.js is installed on the execution machine (for verify-phase56.mjs) | Environment | Low risk — all prior verify scripts use same runtime |
| A4 | SCO ByTheNumbers CTR = all government funds (not just General Fund) | Definitional Note | Medium risk if wrong — however, magnitude evidence is conclusive ($1.64B vs. $462M GF for Anaheim) |

**If this table is empty:** Not empty — four assumed claims flagged above for implementer awareness.

---

## Sources

### Primary (HIGH confidence)

- Production Treasury DB (direct query 2026-06-15) — 34 OC cities confirmed, budget totals confirmed, source_url patterns confirmed
- `scripts/verify-phase34.mjs` — DB-probe pattern to mirror (code read)
- `src/components/Breadcrumb.tsx` + `CitiesInCountyPanel.tsx` — component code read directly
- `.planning/phases/53-orange-county-operating-revenue-load/53-01-SUMMARY.md` + `53-VERIFICATION.md` — load results and verification methodology
- `.planning/phases/54-orange-county-entity-linking-enrichment/54-VERIFICATION.md` — county_id linking + Phase 54 human gate results
- `.planning/phases/55-statewide-city-salaries-integration/55-COVERAGE.md` — OC salaries coverage + SC-4 reconciliation
- `docs/socal-county-onboarding.md` — locked conventions (source attribution, never-overwrite)

### Secondary (MEDIUM confidence)

- https://www.anaheim.net/DocumentCenter/View/55990/Budget-In-Brief-23-24-Final — Anaheim FY2023-24 Budget In Brief (~$462M GF adopted); confirms SCO all-funds vs. GF distinction
- https://www.cityoflagunawoods.org/audit-reports/ — Laguna Woods ACFR archive; FY2023-24 and FY2024-25 confirmed available
- https://www.santa-ana.org/budget/ — Santa Ana adopted budget books; FY2023-24 confirmed
- https://www.newportbeachca.gov/government/departments/finance/annual-comprehensive-financial-reports — Newport Beach ACFR page confirmed; FY2024-25 ACFR hosted at OC Auditor

### Tertiary (LOW confidence — marked [ASSUMED])

- Irvine ACFR FY2023-24 availability — city site redirected during research; assumed available based on description from Financial Reports page
- Huntington Beach ACFR FY2023-24 — search confirmed FY2022-23 at OC Auditor; FY2023-24 inferred as available from finance dept page
- Villa Park ACFR FY2023-24 — Finance page confirmed to exist; specific ACFR availability unverified

---

## Metadata

**Confidence breakdown:**

- Sample selection: HIGH — based on direct DB query of all 34 OC cities with FY2024 + FY2019 operating totals; all 34 city IDs confirmed
- DB probe design: HIGH — pattern directly mirrors verified existing scripts; DB totals confirmed
- ACFR source locations: MEDIUM — Laguna Woods and Santa Ana confirmed directly; Anaheim partially confirmed (Budget In Brief); others require implementer navigation
- Definitional note (SCO all-funds basis): HIGH — magnitude evidence conclusive; Anaheim $1.64B SCO vs. $462M GF adopted Budget In Brief is a 3.5× difference
- UAT checklist: HIGH — component code read; Phase 54 human gate precedent established
- Nav component behavior: HIGH — CitiesInCountyPanel.tsx code confirms filter logic; county_id linkage confirmed from DB (34/34 cities)

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (city ACFR URLs stable; DB state stable; component code unchanged)
