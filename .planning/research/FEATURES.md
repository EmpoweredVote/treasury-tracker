# Feature Landscape: MA County-City Linking (v1.9)

**Domain:** County government pages in a financial transparency app; MA-specific county structure
**Researched:** 2026-06-10
**Confidence:** HIGH for MA government structure and existing codebase patterns; MEDIUM for UX recommendations (based on industry analysis, not A/B testing)

---

## Context: What Already Exists

This milestone adds to a working system. These features are ALREADY SHIPPED and must not be re-built:

| Feature | Shipped In | Notes |
|---------|-----------|-------|
| County breadcrumb chip on city pages | v1.5 (Phase 25) | "Los Angeles County →" chip navigates to county page |
| CitiesInCountyPanel on county pages | v1.5 (Phase 25) | "Available now" / "Coming soon" city chips |
| county_id FK on municipalities table | v1.5 (Phase 25) | Self-referential UUID FK; 88 LA County cities linked |
| Per-capita display on any entity | v1.3 | Activates when entity.population > 0 |
| EntitySwitcher grouped by state/type | v1.6 | ENTITY_TYPE_LABELS already includes "Counties" group |
| Budget visualization (icicle/bars) | v1.0+ | Same component used for all entity types |

The county page is not a separate page — it is the same App.tsx budget view loaded with entity_type='county'. The CitiesInCountyPanel renders below the budget when `entity_type === 'county'`. Everything reuses the existing single-page architecture.

---

## MA County Government Reality Check

Massachusetts has 14 counties. Their government status materially affects what this milestone builds:

### Active County Governments (6 total; 5 in this milestone's budget scope)

| County | Status | Budget Scope | Notes |
|--------|--------|-------------|-------|
| Barnstable | Active (home rule charter) | YES — load budget | Cape Cod regional government; ~$24M operating, manages ~$80M across 146 funds including grants |
| Bristol | Active | YES — load budget | Government "remains substantially unchanged" |
| Dukes | Active (modern county charter) | YES — load budget | Martha's Vineyard; ~$1.6M county budget (very small); 7 towns |
| Nantucket | Active (consolidated town-county) | YES — load budget | Single consolidated municipality; unique structure |
| Norfolk | Active | YES — load budget | Has county treasurer; FY23 budget available |
| Plymouth | Active | OUT OF SCOPE for v1.9 | Has active commissioners, budget published FY2015-FY2026; deferred to future milestone |

**Why Plymouth is excluded from budget scope:** PROJECT.md explicitly defers Plymouth. It has data but was not prioritized for this milestone.

### Abolished/Navigation-Only County Governments (9 for this milestone)

| County | Abolished | Navigation Use |
|--------|----------|---------------|
| Berkshire | July 1, 2000 | Geographic grouping for western MA cities |
| Essex | July 1, 1999 | Groups Salem, Lawrence, Lowell-area cities |
| Franklin | 1997 | Rural western MA towns |
| Hampden | July 1, 1998 | Groups Springfield-area cities |
| Hampshire | January 1, 1999 | Groups Northampton, Amherst |
| Middlesex | 1997 | Largest abolished county; groups Cambridge, Lowell, Somerville |
| Plymouth | (active but budget deferred) | Navigation-only for v1.9 |
| Suffolk | July 1, 1999 | Groups Boston, Chelsea, Revere, Winthrop |
| Worcester | July 1, 1998 | Groups Worcester and central MA cities |

**Important distinction:** These counties still exist as geographic regions. Elected sheriffs, registers of deeds, and district attorneys still serve under the county name. They just have no county government budget to display.

---

## Question 1: What Do Users Expect on a County Government Page?

### Table Stakes (must have — page feels broken without these)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| County name in hero/header | Orientation — user must know where they are | Low | Same hero pattern as city pages |
| Budget visualization (icicle/bars) | Core app function — same as any other entity | Low | Reuses existing BudgetVisualization component |
| Dataset tabs (Operating / Revenue) | Same as city pages — users expect this | Low | Reuses DatasetTabs; only show tabs with available data |
| Year selector | Users expect to explore history | Low | Reuses YearSelector |
| Plain language summary | Core differentiator of this app | Low | PlainLanguageSummary already handles any entity |
| Per-capita display | App already does this; county has population | Low | Activates automatically when population > 0 is loaded |
| CitiesInCountyPanel | The whole point of a county page — see which cities belong | Low | Already built and shipping for LA County |
| Breadcrumb back-navigation from county page | Users arrive from a city; need to go back | Low | Breadcrumb already exists; county pages have no county parent, so breadcrumb just shows county name + dataset |

### Differentiators (valued but not expected)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Category enrichment on county budget categories | Plain-language descriptions of county spending lines | Medium | County categories differ from city categories; need separate enrichment run |
| State breadcrumb above county | "Massachusetts → Barnstable County → Budget" navigation | Low | Would require state entity as a parent; not in v1.9 scope |
| Population context in CitiesInCountyPanel | Show population for each city chip | High | Would clutter the panel; defer |

### Anti-Features (do not build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Separate county page component | Needless duplication; the single-page architecture already handles counties | Load county as selected entity — same App.tsx renders correctly |
| "County government dissolved" banner on active county pages | Confusing; all 5 budget counties ARE active | Only show dissolved-county messaging on navigation-only county pages |
| Per-capita comparison between county and its cities | Misleading — county budget serves different functions than city budget; different denominators | Show county per-capita and city per-capita independently |
| Multi-year per-capita trend on county pages | Already out of scope for all entities (single-vintage population) | Single per-capita figure only |

---

## Question 2: Navigation-Only Counties — Should They Appear in the Entity Picker?

### Recommendation: YES, appear in entity picker — but clearly differentiated

**Rationale:**

1. **The picker already groups by entity_type.** Navigation-only counties will appear under "Massachusetts → Counties" in EntitySwitcher. The grouping itself signals what they are.

2. **The filter `available_datasets.length > 0` in EntitySwitcher already hides entities with no data.** Navigation-only counties with zero budget rows will NOT appear in the picker at all — the existing filter handles this automatically.

3. **This means the real question is: should navigation-only counties have a page at all?**

   - If they have zero available_datasets, the EntitySwitcher will hide them. Users who navigate to a navigation-only county (via a city breadcrumb) will see the county page with only the CitiesInCountyPanel and no budget content.
   - This is the correct behavior: users click "Middlesex County →" on a Cambridge city page, land on a county page that shows all Cambridge-area cities but has no budget to display, with a clear message explaining why.

4. **For the breadcrumb specifically:** Navigation-only counties MUST be in the municipalities table and linked via county_id. The city breadcrumb chip reads from `municipalities.find(m => m.id === city.county_id)`. This works whether or not the county has budget data.

### Implementation Pattern for Navigation-Only County Pages

When `entity_type === 'county'` and `available_datasets.length === 0`:

- **Show:** Hero banner with county name, CitiesInCountyPanel with all linked cities
- **Show:** Explanatory text: "Middlesex County's government was abolished in 1997. This page shows the cities and towns in Middlesex County that are available in Treasury Tracker."
- **Hide:** Budget visualization, DatasetTabs, YearSelector, PlainLanguageSummary — none of these make sense with no data
- **Do not show:** An error state or "data not found" — this is intentional, not a failure

**The EntitySwitcher filter means navigation-only counties are picker-invisible unless searched by name.** Users arrive only via city breadcrumb navigation, which is the correct and intended flow.

---

## Question 3: UX for Active County Budget + City List

### Page Layout Recommendation (top to bottom)

For an active county government page (has budget data), the page should render in this order:

1. **Hero banner** — county name, Wikipedia hero image (same as cities)
2. **Controls bar** — EntitySwitcher (to switch away), YearSelector, budget search if enriched
3. **Breadcrumb** — just the county name + "Budget" (no county parent since no state-county linking in this milestone)
4. **PlainLanguageSummary** — "Barnstable County is spending $24.3M in FY2025. That's $1,460 per resident." Plain language lead
5. **DatasetTabs** — Operating / Revenue (only show tabs with actual data)
6. **Budget visualization** — icicle bars, same as any entity
7. **CategoryList** — spending breakdown with enrichment if available
8. **CitiesInCountyPanel** — "Cities in Barnstable County" — available / coming soon chips

**Key decision: CitiesInCountyPanel goes BELOW the budget, not above it.**

Rationale: The county IS a government entity with its own budget. The budget is the primary content. The city list is contextual — it answers "what jurisdictions are in this county?" after you've seen the county's own financials. Putting the city list first would make the page feel like a directory rather than a financial transparency page.

This is exactly how the LA County page already works — CitiesInCountyPanel renders below budget in App.tsx (line 956-963).

### CitiesInCountyPanel for MA Counties

The existing panel design (available now / coming soon chips) works perfectly for MA:

- For **Barnstable County**: shows Cape Cod towns — all 351 MA cities have budget data, so all Barnstable County towns will show as "Available now"
- For **navigation-only counties**: shows the same panel layout; the panel IS the entire meaningful content
- No changes needed to the component itself

### "Dissolved county" page handling

For the 9 navigation-only counties, App.tsx should gracefully handle `entity_type === 'county'` with no budget data:

```
if (entity_type === 'county' && available_datasets.length === 0) {
  // Don't show: DatasetTabs, YearSelector, BudgetVisualization, PlainLanguageSummary
  // Do show: hero banner, dissolution notice, CitiesInCountyPanel
}
```

The dissolution notice text should be factual and brief:
- "Berkshire County's government was abolished by the Commonwealth in 2000. This page shows cities and towns in Berkshire County with budgets available in Treasury Tracker."
- Do not call it "dissolved" (that implies legal merger); use "abolished" — the accurate MA term.

---

## Question 4: What Existing Apps Do County-City Linking Well?

### OpenGov (opengov.com)

**Confidence: MEDIUM** — based on public product pages and known customer demos

OpenGov provides county budget transparency portals for 2,000+ governments. Their county pages:
- Show budget breakdown with charts and graphs
- Allow filtering by fund, department, fiscal year
- County pages are independent — there is no built-in county-to-city navigation linking
- Cities that also use OpenGov have their own separate portals; no unified cross-jurisdictional navigation

**Takeaway for Treasury Tracker:** OpenGov has the same limitation as most tools — each entity is siloed. Treasury Tracker's county-city linking (breadcrumb + CitiesInCountyPanel) is a genuine differentiator. No major competitor does this out of the box.

### ClearGov (cleargov.com)

**Confidence: MEDIUM** — based on public marketing and Madison County (NY) news coverage

ClearGov offers a cloud-based budget transparency tool with department narratives and multi-year trend charts. Their county pages show spending breakdowns and allow citizen exploration. Like OpenGov, each entity is standalone — no cross-jurisdictional navigation to member cities.

**Takeaway:** Same limitation as OpenGov. Treasury Tracker's approach of showing city breadcrumbs back to the county and the county's city panel is differentiated.

### MA-Specific: MassBudget.org

**Confidence: MEDIUM**

MassBudget (Massachusetts Budget and Policy Center) tracks state-level MA budget data but does not provide county or city-level financial transparency tools. No county-city navigation pattern to learn from here.

### MA-Specific: MA DLS Databank / Gateway

The existing MA DLS portal (dlsgateway.dor.state.ma.us) provides Schedule A data per municipality but has no visualization layer and no county-city navigation. It is a raw data portal, not a UX model.

### Key insight from landscape survey

No existing financial transparency tool provides the "county as a hub for navigating its member cities" pattern that Treasury Tracker has built for LA County. The CityInCountyPanel + breadcrumb pattern is industry-leading for this use case. The design is already correct — apply it to MA counties.

---

## Question 5: Budget Categories Typical for MA County Governments

### Active MA County Government Categories

Based on Barnstable County (most documented) and general MA county government structure:

**Operating spending categories (typical for active MA counties):**
| Category | Notes |
|----------|-------|
| County Commissioners / Administration | Governance and administrative overhead |
| Registry of Deeds | Property records; major revenue generator for some counties |
| Treasurer / Finance | Financial management |
| Cape Cod Commission / Regional Planning | Barnstable-specific; equivalent: regional planning agencies |
| Health & Environment | Water quality labs, public health functions |
| Human Services | Social services, senior services |
| Public Safety | Emergency planning, coordination with sheriffs |
| Facilities / Operations | Building maintenance, county infrastructure |
| Information Technology | IT services for county operations |
| Agriculture / Extension | Cooperative extension (4-H, farming programs) |
| Dredge / Infrastructure Enterprise Funds | Barnstable-specific; waterway maintenance |

**Revenue categories (typical for active MA counties):**
| Category | Notes |
|----------|-------|
| Registry of Deeds Fees | Real estate transaction fees; often the largest county revenue source |
| State Assessments | State payments to counties for services |
| Municipal Assessments | Assessments on member towns/cities |
| Federal Grants | ARPA, CDBG, emergency management grants |
| Departmental Revenue | Fees from health labs, dredge services, etc. |
| Investment Income | Interest on reserves |

### Key difference from city budgets

MA county budgets are much smaller and simpler than city budgets. Barnstable County's general fund is ~$24M — comparable to a small MA town budget, not a city. Dukes County's budget is only ~$1.6M. The 9 DLS categories used for city budgets (Federal Grants, Tax Levy, State Aid, etc.) do NOT apply to county budgets — county revenue comes from deed fees and municipal assessments, not property tax levies.

**Implication for enrichment:** County budget categories will need their own enrichment run after data is loaded. Universal enrichment for MA DLS city categories does not apply to county categories. The Barnstable County enrichment should be county-specific, not universalized (since each active county has its own department structure).

### Nantucket special case

Nantucket is a consolidated town-county government. Its "county" budget IS its town budget — there is no separate county layer. The town/county entity publishes a unified budget. For Treasury Tracker purposes, Nantucket county and Nantucket town may effectively be the same entity.

---

## Feature Dependencies on Existing Code

| New Feature | Depends On | Status |
|-------------|-----------|--------|
| MA county rows in municipalities table | county_id FK already exists (v1.5) | Ready |
| MA cities linked via county_id | 351 MA cities already in DB | Need UPDATE to set county_id |
| County breadcrumb on MA city pages | Breadcrumb already reads countyEntity from municipalities list | Works as soon as county_id is set |
| CitiesInCountyPanel on MA county pages | Component already built and rendering for county entity_type | Works as soon as county rows exist |
| Budget data on 5 active MA county pages | Budget visualization already handles any entity | Need data load scripts |
| Per-capita on MA county pages | PlainLanguageSummary shows per-capita when population > 0 | Need Census population for counties |
| Navigation-only county page (no budget) | App.tsx currently assumes budget data exists when entity is selected | Needs guard for county + no datasets |
| EntitySwitcher visibility | available_datasets.length > 0 filter already hides data-less entities | Navigation-only counties auto-hidden |

---

## MVP Feature Set for v1.9

### Must Have (milestone success criteria per PROJECT.md)

1. **14 MA county rows seeded** — entity_type='county', state='MA', Census population
2. **351 MA cities linked via county_id FK** — enables breadcrumb and CitiesInCountyPanel
3. **Budget data loaded for 5 active MA counties** — Barnstable, Bristol, Dukes, Nantucket, Norfolk
4. **County breadcrumb on MA city pages** — zero frontend changes required once county_id is set
5. **CitiesInCountyPanel on MA county pages** — zero frontend changes required once county rows exist
6. **Per-capita on MA county pages** — requires county Census population (SUMLEV=050 from Census)

### Should Have (adds real UX value, not blocking)

7. **Navigation-only county page graceful state** — dissolved county message + CitiesInCountyPanel, no fake "no data" error
8. **Category enrichment for 5 active county budgets** — plain-language descriptions; run after budget data loads

### Defer (not in v1.9 scope per PROJECT.md)

- Plymouth County budget data (has active government; deprioritized)
- State breadcrumb above county ("Massachusetts →" before "Barnstable County →")
- Cross-county comparison views
- Enterprise fund audit across counties

---

## Sources

- Massachusetts Secretary of State: https://www.sec.state.ma.us/divisions/cis/government/gov-county.htm — county government status (MEDIUM confidence)
- Wikipedia List of Counties in Massachusetts: https://en.wikipedia.org/wiki/List_of_counties_in_Massachusetts — abolition dates (HIGH confidence)
- Barnstable County Q1 FY2025 Financial Report: https://www.capecod.gov/2024/10/23/barnstable-county-reports-strong-q1-fy2025-financial-results-continuing-positive-momentum/ — budget categories and scale (MEDIUM confidence)
- Norfolk County Budget: https://norfolkcounty.org/county_budget/ — FY2023 budget documents exist (MEDIUM confidence)
- Plymouth County Revenue and Budgets: https://www.plymouthcountyma.gov/217/Revenues-and-Budgets — active budget FY2015-FY2026 (MEDIUM confidence)
- Codebase inspection: `src/App.tsx` lines 454-493 (countyEntity derivation, breadcrumb logic), lines 956-963 (CitiesInCountyPanel render) — HIGH confidence
- Codebase inspection: `src/components/CitiesInCountyPanel.tsx` — existing component filters by county_id and entity_type — HIGH confidence
- Codebase inspection: `src/components/EntitySwitcher.tsx` lines 69 (available_datasets filter) — HIGH confidence
- Martha's Vineyard Times: https://www.mvtimes.com/2015/06/13/dukes-county-commissioners-agree-on-1-6-county-budget/ — Dukes County ~$1.6M budget scale (MEDIUM confidence)
