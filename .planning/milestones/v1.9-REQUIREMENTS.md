# Requirements — v1.9 MA County-City Linking

## Milestone Goal

Surface county context for MA municipalities — seed 5 active MA county entities, link cities to their counties, load budget data for those county governments, and show county breadcrumb + city panels in the live app.

**Key scope decisions:**
- 5 active counties with budget data: Barnstable, Bristol, Dukes, Norfolk, Plymouth
- Nantucket: no county row (consolidated town-county, same as SF D-06 precedent — city row covers its government)
- 9 dissolved counties: skip entirely (getCities() HAVING filter would hide them anyway)
- Cities in dissolved county jurisdictions: county_id remains NULL
- Zero frontend or API changes needed — county pattern already ships for LA County

---

## v1.9 Requirements

### County — Entity Seeding and City Linking

- [ ] **COUNTY-01**: 5 MA county municipality rows seeded in DB (Barnstable County, Bristol County, Dukes County, Norfolk County, Plymouth County — entity_type='county', state='MA', with 2024 Census population)
- [ ] **COUNTY-02**: All MA cities in those 5 counties have county_id FK set to the corresponding county row
- [ ] **COUNTY-03**: County breadcrumb chip appears on MA city pages for all cities linked via county_id (zero frontend changes — wiring already exists)

### Data — County Government Budget

- [x] **DATA-01**: Operating budget loaded for Barnstable County (FY2024 or latest available from capecod.gov)
- [x] **DATA-02**: Operating budget loaded for Bristol County (from countyofbristol.net)
- [x] **DATA-03**: Operating budget loaded for Dukes County (Martha's Vineyard — from dukescounty.gov)
- [x] **DATA-04**: Operating budget loaded for Norfolk County (from norfolkcounty.org)
- [x] **DATA-05**: Operating budget loaded for Plymouth County (from plymouthcountyma.gov)

### UI — County Pages

- [ ] **UI-01**: CitiesInCountyPanel visible on each of the 5 county pages, listing all linked MA cities as "Available now" chips (zero frontend changes — component already data-driven)
- [ ] **UI-02**: Per-capita ($/resident) displays correctly on county pages using loaded Census 2024 county population (zero frontend changes — auto-activates when population > 0)

### Enrichment — County Category Descriptions

- [ ] **ENRICH-01**: Budget categories enriched for all 5 active MA counties using county-scoped descriptions (municipality_id = county uuid, NOT municipality_id IS NULL — never universalize county enrichments)

---

## Future Requirements

*Not in v1.9 scope — tracked for future milestones.*

- Nantucket County entity (consolidated government; defer until a design solution exists)
- Navigation-only county pages for 9 dissolved counties (requires getCities() API change)
- Revenue budget data for any MA county
- State breadcrumb above county ("Massachusetts →" before county name)
- Cross-county comparison views
- County-level historical trends

---

## Out of Scope

- **9 dissolved MA counties** (Berkshire, Essex, Franklin, Hampden, Hampshire, Middlesex, Suffolk, Worcester) — no county rows seeded; cities in these counties retain county_id=NULL
- **Nantucket County row** — consolidated town-county government (same as SF D-06); existing Nantucket city row covers its government
- **Frontend code changes** — EntitySwitcher, CitiesInCountyPanel, App.tsx, ev-accounts-api already handle county entities generically
- **Revenue budgets for MA counties** — lower priority; defer to v2.0
- **All-funds / requirements data** — not applicable to MA county governments

---

## Traceability

*Filled in by roadmap.*

| REQ-ID | Phase |
|--------|-------|
| COUNTY-01 | Phase 40 |
| COUNTY-02 | Phase 40 |
| COUNTY-03 | Phase 40 |
| DATA-01 | Phase 41 |
| DATA-02 | Phase 41 |
| DATA-03 | Phase 41 |
| DATA-04 | Phase 41 |
| DATA-05 | Phase 41 |
| UI-01 | Phase 40 (auto) |
| UI-02 | Phase 40 (auto) |
| ENRICH-01 | Phase 42 |

---

*Requirements defined: 2026-06-10*
*Milestone: v1.9 MA County-City Linking*
