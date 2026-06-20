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
  cemetery:        { plain_name: 'Cemetery Fund', short_description: 'Operates and maintains a public cemetery.', description: "The cemetery fund pays to operate and maintain a public cemetery — burials, grounds, and records. It is supported by plot sales and service fees, and often includes a perpetual-care portion whose earnings fund long-term upkeep.", tags: ['cemetery','perpetual care','grounds','fees'], confidence: 'medium' },
  telecom:         { plain_name: 'Telecommunications / Fiber Fund', short_description: 'City-owned broadband or fiber service.', description: "The telecommunications or fiber fund pays for a government-owned broadband network — building and operating fiber infrastructure and internet service. It is run as an enterprise supported by subscriber charges rather than taxes.", tags: ['telecom','fiber','broadband','enterprise'], confidence: 'medium' },
  tourism:         { plain_name: 'Tourism Fund', short_description: 'Promotes visitors and events, funded by hotel/tourism tax.', description: "The tourism fund supports attracting visitors, conventions, and events — marketing, festivals, and visitor facilities. It is typically funded by a transient-room (hotel) or tourism tax restricted to promoting tourism.", tags: ['tourism','events','hotel tax','restricted'], confidence: 'medium' },
  contingency:     { plain_name: 'Contingency / Disaster Fund', short_description: 'Reserve money for emergencies and disasters.', description: "A contingency or disaster fund sets aside reserve money for emergencies — floods, earthquakes, or other unforeseen events — and 'rainy day' stabilization. The money is held in reserve and spent only when an emergency or shortfall requires it.", tags: ['contingency','reserve','disaster','rainy day'], confidence: 'medium' },
  special_assessment:{ plain_name: 'Special Assessment / District', short_description: 'Charges on benefiting properties for local improvements.', description: "A special assessment area, special improvement district (SID/SSD), or special service district funds a specific local benefit — lighting, roads, or maintenance — through charges on the properties that benefit. Paid only by those properties, not the general taxpayer.", tags: ['special assessment','district','property','restricted'], confidence: 'medium' },
  fund_accounting: { plain_name: 'Fund Accounting / Clearing', short_description: 'An accounting structure, not a spending program.', description: "This is an accounting construct rather than a spending program — for example a clearing or payroll pass-through account, or a reporting 'account group' used to organize the books. It exists to keep the financial records balanced and does not fund services directly.", tags: ['accounting','clearing','fund structure','finance'], confidence: 'low' },
};

// Service-type fund names that are best described by the shared CA department/utility
// CONCEPTS library (reused verbatim — bleed-safe). needle → CONCEPTS id. Checked in
// resolveFund after UTAH_FUND_ROUTES and before the general dept fallthrough.
export const UTAH_FUND_TO_DEPT = [
  ['solid waste', 'solid_waste'], ['garbage', 'solid_waste'], ['sanitation', 'solid_waste'],
  ['landfill', 'solid_waste'], ['refuse', 'solid_waste'], ['recycl', 'solid_waste'], ['waste and recyl', 'solid_waste'],
  ['electric', 'electric'], ['power', 'electric'],
  ['golf', 'recreation'], ['pool', 'recreation'], ['fitness', 'recreation'], ['rec center', 'recreation'],
  ['ice sheet', 'recreation'], ['sports', 'recreation'], ['aquatic', 'recreation'], ['recreation', 'recreation'],
  ['transit', 'transit'], ['transportation', 'transit'],
  ['parking', 'parking'],
  ['airport', 'airport_dept'],
  ['housing', 'housing'], ['homebuyer', 'housing'], ['home program', 'housing'], ['rental rehab', 'housing'],
  ['homeless', 'housing'], ['home consortium', 'housing'], ['housing consortium', 'housing'],
  ['arts', 'cultural_arts'], ['theat', 'cultural_arts'], ['cultural', 'cultural_arts'], ['museum', 'cultural_arts'],
  ['arena', 'cultural_arts'], ['concert', 'cultural_arts'], ['celebration center', 'cultural_arts'],
  ['forfeiture', 'police'], ['drug seizure', 'police'], ['narcotic', 'police'], ['strike force', 'police'],
  ['crime', 'police'], ['restitution', 'police'], ['victim', 'police'], ['task force', 'police'],
  ['public health', 'public_health'], ['health department', 'public_health'], ['aging', 'public_health'],
  ['opioid', 'public_health'], ['council on aging', 'public_health'],
  ['insurance', 'risk_management'], ['risk', 'risk_management'],
  ['streetlight', 'streets'], ['street light', 'streets'],
  ['animal', 'animal_services'], ['weed abatement', 'code_enforcement'], ['demolition', 'code_enforcement'],
  ['paramedic', 'fire'], ['ambulance', 'fire'],
];

// ─── Utah county-government concept library (not in the CA city CONCEPTS) ────────────
export const UTAH_COUNTY_CONCEPTS = {
  assessor:        { plain_name: 'County Assessor', short_description: 'Values property for tax purposes.', description: "The county assessor determines the taxable value of real and personal property across the county. Those assessed values are the basis property taxes are calculated on, so the office supports the largest revenue source for local governments and schools.", tags: ['assessor','property tax','valuation','county'], confidence: 'high' },
  recorder:        { plain_name: 'County Recorder', short_description: 'Keeps official records of property and documents.', description: "The county recorder maintains the official public record of land ownership and documents — deeds, mortgages, liens, and surveys. The office safeguards property records and makes them available to the public, often partly funded by recording fees.", tags: ['recorder','property records','deeds','county'], confidence: 'high' },
  sheriff:         { plain_name: 'County Sheriff', short_description: 'County law enforcement and the jail.', description: "The county sheriff is the county's chief law-enforcement office — patrol in unincorporated areas, courthouse security, serving legal process, and (in most counties) operating the county jail. It is usually one of the largest parts of a county budget.", tags: ['sheriff','law enforcement','jail','county'], confidence: 'high' },
  surveyor:        { plain_name: 'County Surveyor', short_description: 'Maintains official survey and boundary records.', description: "The county surveyor establishes and preserves official land-survey monuments and boundary records, and reviews subdivision plats for accuracy. The office helps ensure property boundaries and public infrastructure are correctly located.", tags: ['surveyor','boundaries','survey','county'], confidence: 'medium' },
  clerk_auditor:   { plain_name: 'County Clerk / Auditor', short_description: 'Elections, records, budgets, and county accounting.', description: "In many Utah counties the clerk and auditor functions are combined — running elections and keeping official records (clerk) and preparing the budget, accounting, and financial reporting (auditor). A central support office that safeguards public funds and the public record.", tags: ['clerk','auditor','elections','finance'], confidence: 'high' },
  commission:      { plain_name: 'Commission / Council', short_description: 'The elected governing body or a formal board/commission.', description: "Funds the offices and operations of the governing body — for a county, the elected commission or council that sets policy, adopts the budget and ordinances, and represents residents; more generally, a formal board or commission charged with governance.", tags: ['commission','council','elected','governance'], confidence: 'medium' },
  justice_court:   { plain_name: 'Justice Court', short_description: 'Local court for misdemeanors and small cases.', description: "A justice court is a local court that handles class B and C misdemeanors, small claims, traffic, and similar matters within its jurisdiction. It is funded from the general fund and from fines and fees the court collects.", tags: ['justice court','court','judicial','public safety'], confidence: 'high' },
  childrens_justice_center:{ plain_name: "Children's Justice Center", short_description: 'Coordinated support for child-abuse cases.', description: "A Children's Justice Center provides a safe, child-friendly place where law enforcement, prosecutors, and child-welfare staff coordinate the investigation and support of child-abuse cases. It is funded from a mix of state, county, and grant dollars.", tags: ['children','justice','victim services','county'], confidence: 'medium' },
  non_departmental:{ plain_name: 'Non-Departmental', short_description: 'Government-wide costs not tied to one department.', description: "Costs that belong to the government as a whole rather than a single department — items such as insurance, transfers between funds, retiree obligations, and shared services. Grouped separately so individual departments are not over-charged.", tags: ['non-departmental','overhead','government-wide','budget'], confidence: 'high' },
};

// ─── Ordered fund router (first match wins). general_fund is the fund fallback. ──────
// Order: most-specific needles first (impact-fee variants before generic 'impact fee';
// 'water reclamation'/'wastewater' before 'water'; named agencies before generic terms).
export const UTAH_FUND_ROUTES = [
  // Impact fees (specific before generic)
  ['wastewater impact', 'wastewater_impact_fee'],
  ['sewer impact', 'sewer_impact_fee'],
  ['police impact', 'police_impact_fee'],
  ['police dept impact', 'police_impact_fee'],
  ['fire impact', 'fire_impact_fee'],
  ['fire dept impact', 'fire_impact_fee'],
  ['impact fee', 'impact_fee'],
  ['impact fees', 'impact_fee'],
  // Roads (state gas-tax shared revenue)
  ['b&c', 'bc_road'],
  ['class c', 'bc_road'],
  ['class b', 'bc_road'],
  ['c-road', 'bc_road'],
  ['b road', 'bc_road'],
  ['corridor preservation', 'bc_road'],
  // Recreation/arts local sales tax
  ['ramp', 'ramp_tax'],
  ['rap tax', 'ramp_tax'],
  ['parc', 'ramp_tax'],
  // Redevelopment / community reinvestment / economic dev project areas
  ['redevelopment', 'redevelopment_agency'],
  ['rda', 'redevelopment_agency'],
  ['community reinvestment', 'redevelopment_agency'],
  ['tax increment', 'redevelopment_agency'],
  ['cra', 'redevelopment_agency'],
  ['cda', 'redevelopment_agency'],
  ['eda', 'economic_development_agency'],
  ['econ dev', 'economic_development_agency'],
  ['economic dev', 'economic_development_agency'],
  ['economic development', 'economic_development_agency'],
  ['business dev', 'economic_development_agency'],
  ['cbia', 'redevelopment_agency'],
  ['cbid', 'redevelopment_agency'],
  ['downtown alliance', 'redevelopment_agency'],
  ['project area', 'redevelopment_agency'],
  ['tourism', 'tourism'],
  // Grants / federal community development
  ['cdbg', 'cdbg_fund'],
  ['c.d.b.g', 'cdbg_fund'],
  ['community development block', 'cdbg_fund'],
  ['grant', 'grants_fund'],
  ['slfrf', 'grants_fund'],
  // Debt / bonds (catch the SLC bond-series tail)
  ['debt service', 'debt_service'],
  ['go series', 'debt_service'],
  ['g.o.', 'debt_service'],
  ['general obligation', 'debt_service'],
  ['sales tax revenue bond', 'debt_service'],
  ['sales tax 20', 'debt_service'],
  ['sales tax series', 'debt_service'],
  ['series bond', 'debt_service'],
  ['bond fund', 'debt_service'],
  ['refunding', 'debt_service'],
  ['refundig', 'debt_service'],
  ['master lease', 'debt_service'],
  ['lba', 'building_authority'],
  ['building authority', 'building_authority'],
  // Capital
  ['cip', 'capital_projects'],
  ['capital improvement', 'capital_projects'],
  ['capital project', 'capital_projects'],
  ['capital', 'capital_projects'],
  ['building cap', 'capital_projects'],
  ['construction fund', 'capital_projects'],
  // Special assessment / districts
  ['special assessment', 'special_assessment'],
  ['special improvement', 'special_assessment'],
  ['special service district', 'special_assessment'],
  ['special serv', 'special_assessment'],
  ['spec serv', 'special_assessment'],
  ['ssd', 'special_assessment'],
  ['sid ', 'special_assessment'],
  ['saa', 'special_assessment'],
  ['assessment area', 'special_assessment'],
  ['lighting district', 'special_assessment'],
  ['service district', 'special_assessment'],
  // Other fund families
  ['special revenue', 'special_revenue'],
  ['internal service', 'internal_service'],
  ['permanent', 'permanent_fund'],
  ['perpetual care', 'cemetery'],
  ['perpetuity', 'cemetery'],
  ['cemetery', 'cemetery'],
  ['trust', 'trust_agency'],
  ['fiduciary', 'trust_agency'],
  ['custodial', 'trust_agency'],
  ['escrow', 'trust_agency'],
  ['agency fund', 'trust_agency'],
  // Utilities / enterprise services
  ['stormwater', 'stormwater_fund'],
  ['storm water', 'stormwater_fund'],
  ['storm drain', 'stormwater_fund'],
  ['drainage', 'stormwater_fund'],
  ['storm', 'stormwater_fund'],
  ['water reclamation', 'sewer_fund'],
  ['reclamation', 'sewer_fund'],
  ['wastewater', 'sewer_fund'],
  ['sewer', 'sewer_fund'],
  ['irrigation', 'water_fund'],
  ['secondary water', 'water_fund'],
  ['water', 'water_fund'],
  ['telecom', 'telecom'],
  ['fiber', 'telecom'],
  ['ambulance', 'ambulance_fund'],
  ['emergency 911', 'e911_dispatch'],
  ['911', 'e911_dispatch'],
  ['dispatch', 'e911_dispatch'],
  ['fleet', 'fleet_fund'],
  ['vehicle management', 'fleet_fund'],
  ['vehicle replacement', 'fleet_fund'],
  ['library', 'library_fund'],
  // Contingency / disaster / accounting artifacts
  ['flood', 'contingency'],
  ['disaster', 'contingency'],
  ['earthquake', 'contingency'],
  ['rainy day', 'contingency'],
  ['contingency', 'contingency'],
  ['account group', 'fund_accounting'],
  ['clearing', 'fund_accounting'],
  ['payroll', 'fund_accounting'],
  ['termination pool', 'fund_accounting'],
  ['fixed asset', 'fund_accounting'],
  ['governmental immunity', 'fund_accounting'],
  ['governmental full accrual', 'fund_accounting'],
  ['enterprise', 'enterprise'],
  ['general fund', 'general_fund'],
  ['general', 'general_fund'],
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
  // NOTE: 'non-departmental' is intentionally NOT routed here — it is a generic budget
  // grouping (not a county office), so it inherits the existing generic Non-Departmental
  // universal row (EXPLICIT_ROWS) rather than forcing a county-scoped overwrite.
];
