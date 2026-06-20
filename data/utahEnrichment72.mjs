// Phase 72 — Utah Parity Enrichment data (inline-authored, $0; no paid API path).
//
// Utah's budget taxonomy diverges from CA SCO: operating/revenue categories are
// organized FUND-first (depth-0 = fund names, depth-1 = `fund|department`), so the
// CA CONCEPTS library (department-oriented) does not cover Utah FUND names. This module
// authors a FRESH Utah fund concept library (UTAH_FUND_CONCEPTS) plus a fresh
// county-government department concept set (UTAH_COUNTY_CONCEPTS) the city-oriented CA
// library lacks. The loader (scripts/loadUtahEnrichment72.mjs) REUSES the CA CONCEPTS +
// ROUTE_RULES for overlapping department names and merges UTAH_COUNTY_CONCEPTS on top.
//
// All text is strictly CATEGORY-LEVEL and UNIVERSAL (municipality_id IS NULL): no city
// names, no dollar figures, no entity-specific facts. Bleed-safety holds by construction
// (D-72-07). Authored inline at $0 — there is no AI API path here (SC#3).
//
// Voice (D-72-04): purpose + money source + a light "separate pot of money" framing for
// funds, matching the CONCEPTS shape in caParityEnrichment61.mjs.
//
// Authoring model (mirrors Phase 61):
//   UTAH_FUND_CONCEPTS   — one generic plain-language description per governmental fund type.
//   UTAH_COUNTY_CONCEPTS — county-government departments not in the CA city library.
//   UTAH_FUND_ROUTES     — ordered [needle, fundConceptId]; first match wins; general_fund fallback.
//   UTAH_DEPT_EXTRA_ROUTES — ordered [needle, countyConceptId]; tried AHEAD of CA ROUTE_RULES so
//                            county semantics win (CA rules mis-map e.g. assessor→finance, sheriff→police).

// ─── Utah fund concept library (generic, citizen-friendly, bleed-safe) ──────────────
export const UTAH_FUND_CONCEPTS = {
  general_fund:    { plain_name: 'General Fund', short_description: "The government's main account for everyday services.", description: "The general fund is the main, flexible 'pot' of money that pays for most everyday services — things like police, fire, parks, and administration. It is funded mostly from taxes (property, sales, and others) and is the account residents most often think of as 'the budget'.", tags: ['general fund','operations','taxes','budget'], confidence: 'high' },
  special_revenue: { plain_name: 'Special Revenue Funds', short_description: 'Money set aside for a specific, restricted purpose.', description: "Special revenue funds are separate pots of money that can only be spent on a particular purpose — for example road money, grant money, or class-C road taxes. Keeping them separate from the general fund ensures restricted dollars are used only as the law or grant requires.", tags: ['special revenue','restricted','grants','budget'], confidence: 'high' },
  debt_service:    { plain_name: 'Debt Service Fund', short_description: 'Pays principal and interest on borrowed money.', description: "The debt service fund is the account used to make scheduled principal and interest payments on money the government has borrowed — typically bonds issued to build long-lived facilities. Paying debt service on time protects the government's credit rating.", tags: ['debt service','bonds','interest','finance'], confidence: 'high' },
  capital_projects:{ plain_name: 'Capital Projects Fund', short_description: 'Money for building long-lived facilities and infrastructure.', description: "The capital projects fund is a separate pot of money for building or buying long-lasting assets — buildings, roads, parks, and major equipment — rather than day-to-day operations. It is often funded by bonds, grants, and dedicated capital reserves.", tags: ['capital projects','construction','infrastructure','budget'], confidence: 'high' },
  enterprise:      { plain_name: 'Enterprise Funds', short_description: 'Self-supporting services paid for by user fees.', description: "Enterprise funds run government services like a business — water, sewer, or other utilities that charge customers for what they use and aim to cover their own costs from those fees rather than from taxes. Kept separate so each service pays its own way.", tags: ['enterprise','utility','fees','self-supporting'], confidence: 'high' },
  water_fund:      { plain_name: 'Water Fund', short_description: 'Drinking-water service paid for by water rates.', description: "The water fund pays for treating and delivering drinking water — sourcing, treatment, distribution, metering, and billing. It is an enterprise paid for mainly by customer water rates rather than the general fund.", tags: ['water','utility','enterprise','infrastructure'], confidence: 'high' },
  sewer_fund:      { plain_name: 'Sewer & Wastewater Fund', short_description: 'Wastewater collection and treatment, paid by sewer charges.', description: "The sewer fund pays for the sanitary sewer system — collection pipes, pump stations, and wastewater (water reclamation) treatment. It is an enterprise funded by sewer service charges rather than taxes.", tags: ['sewer','wastewater','utility','enterprise'], confidence: 'high' },
  stormwater_fund: { plain_name: 'Stormwater Fund', short_description: 'Manages rain runoff and drainage, paid by stormwater fees.', description: "The stormwater fund pays to manage rain runoff and drainage — storm drains, channels, and water-quality programs that reduce flooding and pollution. It is typically funded by a stormwater utility fee rather than the general fund.", tags: ['stormwater','drainage','utility','enterprise'], confidence: 'high' },
  internal_service:{ plain_name: 'Internal Service Funds', short_description: 'Shared support services billed to other departments.', description: "Internal service funds account for support services one part of the government provides to the rest — such as fleet, insurance/risk, or technology. Costs are recovered by charging the departments that use them, rather than from a direct tax.", tags: ['internal service','support','shared services','overhead'], confidence: 'high' },
  permanent_fund:  { plain_name: 'Permanent Funds', short_description: 'Principal is preserved; only earnings are spent.', description: "A permanent fund holds money whose principal must be kept intact — only the investment earnings may be spent, and usually only for a specified purpose (such as perpetual care of a cemetery). It is a restricted, long-term endowment-style account.", tags: ['permanent fund','endowment','restricted','finance'], confidence: 'medium' },
  trust_agency:    { plain_name: 'Trust & Agency Funds', short_description: 'Money the government holds on behalf of others.', description: "Trust and agency (fiduciary) funds hold money the government is safekeeping for someone else — deposits, bonds, or amounts collected for another agency. The money is not the government's to spend on its own programs; it is held and passed through.", tags: ['trust','agency','fiduciary','custodial'], confidence: 'medium' },
  grants_fund:     { plain_name: 'Grants Fund', short_description: 'Restricted money received from grants.', description: "The grants fund tracks money received from federal, state, or other grants. Because grant dollars are restricted to the program they fund, they are kept in a separate pot so spending can be matched to each grant's rules and reporting.", tags: ['grants','restricted','intergovernmental','budget'], confidence: 'high' },
  cdbg_fund:       { plain_name: 'CDBG Fund', short_description: 'Federal Community Development Block Grant money.', description: "The CDBG fund tracks federal Community Development Block Grant dollars, which support neighborhood improvement, housing, and services primarily for lower-income residents. The money is federal and restricted to eligible community-development uses.", tags: ['cdbg','federal','community development','grants'], confidence: 'high' },
  bc_road:         { plain_name: 'B&C Road Fund', short_description: 'State gas-tax money dedicated to local roads.', description: "The B&C (Class B & C) road fund holds the share of state gas-tax revenue Utah distributes to local governments for streets and roads. The money is restricted to building and maintaining the local road network.", tags: ['roads','streets','gas tax','restricted'], confidence: 'high' },
  ramp_tax:        { plain_name: 'RAMP Tax Fund', short_description: 'Local sales-tax money for recreation, arts, and parks.', description: "A RAMP (Recreation, Arts, Museums, and Parks) fund holds revenue from a small dedicated local sales tax voters approved to support recreation, arts, museum, and park programs. The money is restricted to those community purposes.", tags: ['ramp','recreation','arts','parks'], confidence: 'medium' },
  impact_fee:      { plain_name: 'Impact Fee Funds', short_description: "Developer fees that pay for growth's added infrastructure.", description: "Impact fee funds hold one-time fees charged on new development to help pay for the additional infrastructure that growth requires. By law the money is restricted to the specific type of capacity it was collected for, and kept separate from operating budgets.", tags: ['impact fees','development','infrastructure','restricted'], confidence: 'high' },
  police_impact_fee:{ plain_name: 'Police Impact Fees', short_description: 'Developer fees dedicated to police facilities for growth.', description: "Police impact fees are one-time charges on new development restricted to paying for the added police facilities and capacity that growth requires. Held separately so the money is used only for that purpose.", tags: ['impact fees','police','development','restricted'], confidence: 'high' },
  fire_impact_fee: { plain_name: 'Fire Impact Fees', short_description: 'Developer fees dedicated to fire facilities for growth.', description: "Fire impact fees are one-time charges on new development restricted to paying for the added fire and emergency facilities and capacity that growth requires. Held separately so the money is used only for that purpose.", tags: ['impact fees','fire','development','restricted'], confidence: 'high' },
  sewer_impact_fee:{ plain_name: 'Sewer Impact Fees', short_description: 'Developer fees dedicated to sewer capacity for growth.', description: "Sewer impact fees are one-time charges on new development restricted to paying for the added sewer collection and treatment capacity that growth requires. Held separately so the money is used only for that purpose.", tags: ['impact fees','sewer','development','restricted'], confidence: 'high' },
  wastewater_impact_fee:{ plain_name: 'Wastewater Impact Fees', short_description: 'Developer fees dedicated to wastewater capacity for growth.', description: "Wastewater impact fees are one-time charges on new development restricted to paying for the added wastewater (sewer) treatment capacity that growth requires. Held separately so the money is used only for that purpose.", tags: ['impact fees','wastewater','development','restricted'], confidence: 'high' },
  redevelopment_agency:{ plain_name: 'Redevelopment / RDA', short_description: 'Uses property-tax growth to revitalize an area.', description: "A redevelopment agency (RDA) and its community-reinvestment areas use the growth in property-tax value within a defined district (tax increment) to fund improvements and economic revitalization in that area. The money is restricted to projects in the district.", tags: ['redevelopment','rda','tax increment','economic development'], confidence: 'medium' },
  economic_development_agency:{ plain_name: 'Economic Development Agency', short_description: 'Funds business growth, jobs, and area revitalization.', description: "An economic development agency or fund supports attracting and keeping businesses, creating jobs, and revitalizing commercial areas. It is often supported by tax-increment or dedicated revenues and kept separate so the money is used for economic-development purposes.", tags: ['economic development','business','jobs','redevelopment'], confidence: 'medium' },
  building_authority:{ plain_name: 'Building Authority', short_description: 'A financing entity that builds and leases public facilities.', description: "A municipal or local building authority is a financing entity that issues bonds to build public facilities and then leases them back to the government. It is a mechanism for financing buildings; its fund accounts for the construction and the lease/debt payments.", tags: ['building authority','financing','bonds','capital'], confidence: 'medium' },
  ambulance_fund:  { plain_name: 'Ambulance Fund', short_description: 'Emergency medical transport, paid by service charges.', description: "The ambulance fund pays for emergency medical transport service. It is typically run as an enterprise supported by charges billed for ambulance service and insurance reimbursements rather than the general fund.", tags: ['ambulance','ems','enterprise','public safety'], confidence: 'medium' },
  e911_dispatch:   { plain_name: 'Emergency 911 Dispatch Fund', short_description: '911 call-taking and dispatch, funded by phone surcharges.', description: "The emergency 911 dispatch fund pays for the call center that answers 911 calls and dispatches police, fire, and medical units. It is supported in part by a dedicated surcharge on phone lines restricted to emergency communications.", tags: ['911','dispatch','public safety','emergency'], confidence: 'medium' },
  fleet_fund:      { plain_name: 'Fleet Management Fund', short_description: 'Vehicles and equipment, billed to user departments.', description: "The fleet management fund buys, fuels, and maintains the government's vehicles and heavy equipment. It is usually an internal service fund that recovers its costs by charging the departments that use the vehicles.", tags: ['fleet','vehicles','internal service','equipment'], confidence: 'medium' },
  library_fund:    { plain_name: 'Library Fund', short_description: 'Public library service, often with a dedicated tax.', description: "The library fund pays for public library service — collections, programs, and computer/internet access. It is sometimes a separate fund supported by a dedicated library property tax in addition to general-fund support.", tags: ['library','education','community','restricted'], confidence: 'medium' },
};

// ─── Utah county-government concept library (not in the CA city CONCEPTS) ────────────
export const UTAH_COUNTY_CONCEPTS = {
  assessor:        { plain_name: 'County Assessor', short_description: 'Values property for tax purposes.', description: "The county assessor determines the taxable value of real and personal property across the county. Those assessed values are the basis property taxes are calculated on, so the office supports the largest revenue source for local governments and schools.", tags: ['assessor','property tax','valuation','county'], confidence: 'high' },
  recorder:        { plain_name: 'County Recorder', short_description: 'Keeps official records of property and documents.', description: "The county recorder maintains the official public record of land ownership and documents — deeds, mortgages, liens, and surveys. The office safeguards property records and makes them available to the public, often partly funded by recording fees.", tags: ['recorder','property records','deeds','county'], confidence: 'high' },
  sheriff:         { plain_name: 'County Sheriff', short_description: 'County law enforcement and the jail.', description: "The county sheriff is the county's chief law-enforcement office — patrol in unincorporated areas, courthouse security, serving legal process, and (in most counties) operating the county jail. It is usually one of the largest parts of a county budget.", tags: ['sheriff','law enforcement','jail','county'], confidence: 'high' },
  surveyor:        { plain_name: 'County Surveyor', short_description: 'Maintains official survey and boundary records.', description: "The county surveyor establishes and preserves official land-survey monuments and boundary records, and reviews subdivision plats for accuracy. The office helps ensure property boundaries and public infrastructure are correctly located.", tags: ['surveyor','boundaries','survey','county'], confidence: 'medium' },
  clerk_auditor:   { plain_name: 'County Clerk / Auditor', short_description: 'Elections, records, budgets, and county accounting.', description: "In many Utah counties the clerk and auditor functions are combined — running elections and keeping official records (clerk) and preparing the budget, accounting, and financial reporting (auditor). A central support office that safeguards public funds and the public record.", tags: ['clerk','auditor','elections','finance'], confidence: 'high' },
  commission:      { plain_name: 'County Commission / Council', short_description: 'The elected governing body of the county.', description: "The county commission or council is the elected body that sets county policy, adopts the budget and ordinances, and represents residents. This line funds the offices and operations of county legislative leadership.", tags: ['commission','council','elected','governance'], confidence: 'high' },
  justice_court:   { plain_name: 'Justice Court', short_description: 'Local court for misdemeanors and small cases.', description: "A justice court is a local court that handles class B and C misdemeanors, small claims, traffic, and similar matters within its jurisdiction. It is funded from the general fund and from fines and fees the court collects.", tags: ['justice court','court','judicial','public safety'], confidence: 'high' },
  childrens_justice_center:{ plain_name: "Children's Justice Center", short_description: 'Coordinated support for child-abuse cases.', description: "A Children's Justice Center provides a safe, child-friendly place where law enforcement, prosecutors, and child-welfare staff coordinate the investigation and support of child-abuse cases. It is funded from a mix of state, county, and grant dollars.", tags: ['children','justice','victim services','county'], confidence: 'medium' },
  non_departmental:{ plain_name: 'Non-Departmental', short_description: 'Government-wide costs not tied to one department.', description: "Costs that belong to the government as a whole rather than a single department — items such as insurance, transfers between funds, retiree obligations, and shared services. Grouped separately so individual departments are not over-charged.", tags: ['non-departmental','overhead','government-wide','budget'], confidence: 'high' },
};

// ─── Ordered fund router (first match wins). general_fund is the fund fallback. ──────
// Order: most-specific needles first (impact-fee variants before generic 'impact fee';
// 'water reclamation'/'wastewater' before 'water'; named agencies before generic terms).
export const UTAH_FUND_ROUTES = [
  ['wastewater impact', 'wastewater_impact_fee'],
  ['sewer impact', 'sewer_impact_fee'],
  ['police impact', 'police_impact_fee'],
  ['fire impact', 'fire_impact_fee'],
  ['impact fee', 'impact_fee'],
  ['impact fees', 'impact_fee'],
  ['b&c', 'bc_road'],
  ['class c', 'bc_road'],
  ['class b', 'bc_road'],
  ['ramp', 'ramp_tax'],
  ['redevelopment', 'redevelopment_agency'],
  ['rda', 'redevelopment_agency'],
  ['community reinvestment', 'redevelopment_agency'],
  ['tax increment', 'redevelopment_agency'],
  ['economic development', 'economic_development_agency'],
  ['cdbg', 'cdbg_fund'],
  ['grant', 'grants_fund'],
  ['debt service', 'debt_service'],
  ['capital project', 'capital_projects'],
  ['capital', 'capital_projects'],
  ['special revenue', 'special_revenue'],
  ['internal service', 'internal_service'],
  ['permanent', 'permanent_fund'],
  ['trust', 'trust_agency'],
  ['fiduciary', 'trust_agency'],
  ['stormwater', 'stormwater_fund'],
  ['storm water', 'stormwater_fund'],
  ['storm drain', 'stormwater_fund'],
  ['storm', 'stormwater_fund'],
  ['water reclamation', 'sewer_fund'],
  ['reclamation', 'sewer_fund'],
  ['wastewater', 'sewer_fund'],
  ['sewer', 'sewer_fund'],
  ['water', 'water_fund'],
  ['ambulance', 'ambulance_fund'],
  ['emergency 911', 'e911_dispatch'],
  ['911', 'e911_dispatch'],
  ['dispatch', 'e911_dispatch'],
  ['building authority', 'building_authority'],
  ['fleet', 'fleet_fund'],
  ['library', 'library_fund'],
  ['enterprise', 'enterprise'],
  ['general fund', 'general_fund'],
];

// ─── Ordered county-dept router (tried AHEAD of CA ROUTE_RULES for the dept portion) ──
// CA ROUTE_RULES mis-map county terms for city semantics (assessor→finance, sheriff→police);
// these route them to the correct county concept first. First match wins.
export const UTAH_DEPT_EXTRA_ROUTES = [
  ["children's justice", 'childrens_justice_center'],
  ['childrens justice', 'childrens_justice_center'],
  ['justice court', 'justice_court'],
  ['assessor', 'assessor'],
  ['recorder', 'recorder'],
  ['surveyor', 'surveyor'],
  ['sheriff', 'sheriff'],
  ['clerk/auditor', 'clerk_auditor'],
  ['clerk-auditor', 'clerk_auditor'],
  ['clerk auditor', 'clerk_auditor'],
  ['clerk & auditor', 'clerk_auditor'],
  ['auditor', 'clerk_auditor'],
  ['commission', 'commission'],
  ['non-departmental', 'non_departmental'],
  ['non departmental', 'non_departmental'],
  ['nondepartmental', 'non_departmental'],
];
