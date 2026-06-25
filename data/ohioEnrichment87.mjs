// Phase 87 — Ohio Enrichment Parity (inline-authored, $0; NO paid API path).
//
// Strategy (Phase 87): Ohio's budget category vocabulary is FIXED and standardized
// statewide by the Auditor of State Summarized Annual Financial Reports (GAAP + CASH/MOD
// bases; cities + counties). It is a small closed set — 52 distinct name_keys at depth 0
// (Ohio trees are FLAT — no depth-1 composites). Enrichment is an EXPLICIT hand-authored map
// keyed by exact name_key (one accurate row per key), NOT a heuristic router with fallback.
//
// All text is strictly CONCEPT-LEVEL and ENTITY- AND STATE-NEUTRAL: it must read correctly for
// an Ohio city, county, AND (for shared keys like "police", "property taxes") for a CA or VA
// locality too. NO locality names, NO dollar figures, NO Ohio-specific facts. Prefer
// "the local government" / "local government" over "the city". Every row is UNIVERSAL
// (municipality_id IS NULL), so bleed-safety holds by construction.
//
// Synonym clusters (GAAP vs CASH/MOD vs city vs county terminology for the same concept):
//   in-lieu taxes: payment in lieu of taxes / receipts in lieu of taxes / revenue in lieu of taxes
//   intergovernmental: intergovernmental / intergovernmental revenues / intergovernmental expenditures
//     NOTE: 'intergovernmental' is shared by both revenue and expenditure trees in Ohio. It appears
//     once in the map with description that covers both contexts (money received from or paid to
//     other governments). EXPECTED_KEYS matches the live distinct key count.
//   catch-all: other / other receipts / other revenues / other disbursements / other expenditures
//   debt service: principal retirement / debt service principal retirement;
//                 interest and fiscal charges / debt service interest and fiscal charges;
//                 bond issuance costs / debt service bond issuance costs; debt service other
//   public safety (GAAP city vs CASH/MOD vs county):
//     police / fire / security of persons and property (+ ...police / ...fire / ...other) / public safety
//   governance: general government / legislative and executive / general government legislative
//               and executive / judicial / general government judicial
//   health: health / public health
//
// Key count: 17 revenue + 35 operating = 52 named; 'intergovernmental' is shared between revenue
// and expenditure trees but is ONE distinct name_key → EXPECTED_KEYS has 51 entries (51 distinct keys).
//
// Authoring model:
//   OHIO_ENRICHMENT — object keyed by exact name_key → { plain_name, short_description,
//                     description, tags:[...], confidence }
//   EXPECTED_KEYS   — canonical key array; single source of truth for the loader's 100%
//                     coverage gate (scripts/loadOhioEnrichment87.mjs ABORTS on any unmapped
//                     live key — there is no fallback) and for the offline tests.

export const SOURCE = 'ai';

export const OHIO_ENRICHMENT = {
  // ──────────────────────── REVENUE — depth-0 (17 keys) ────────────────────────
  // Note: 'intergovernmental' also appears in expenditure; one shared entry covers both.

  'charges for services': {
    plain_name: 'Service Charges',
    short_description: 'Fees paid for specific local services.',
    description: 'Fees that residents, businesses, and other users pay for specific services — such as utilities, recreation programs, inspection and permitting services, and administrative charges. The user pays in proportion to the service received.',
    tags: ['service charges', 'fees', 'user fees', 'revenue'],
    confidence: 'high',
  },

  'contributions and donations': {
    plain_name: 'Contributions & Donations',
    short_description: 'Voluntary gifts, grants, and contributions to the local government.',
    description: 'Voluntary contributions and donations received by the local government — including private gifts, foundation grants, and contributions from other organizations or individuals that are not exchange transactions.',
    tags: ['contributions', 'donations', 'grants', 'revenue'],
    confidence: 'high',
  },

  'fines and forfeitures': {
    plain_name: 'Fines & Forfeitures',
    short_description: 'Court fines, penalties, and forfeitures.',
    description: 'Revenue from court fines, penalties, and forfeitures — for example traffic and parking citations and code-violation penalties. A modest, variable revenue source that reflects enforcement activity.',
    tags: ['fines', 'forfeitures', 'penalties', 'revenue'],
    confidence: 'high',
  },

  'income taxes': {
    plain_name: 'Income Taxes',
    short_description: 'Local tax on earned income and net profits.',
    description: 'A local tax levied on the wages, salaries, and net profits of residents and businesses. For many local governments this is the single largest source of tax revenue.',
    tags: ['income tax', 'wage tax', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'interest': {
    plain_name: 'Interest Income',
    short_description: 'Interest the local government earns on its invested cash and balances.',
    description: 'Interest the local government earns on its invested cash, deposits, and short-term securities. Varies with prevailing interest rates and the level of idle cash on hand.',
    tags: ['interest', 'investment income', 'revenue'],
    confidence: 'high',
  },

  // 'intergovernmental' is shared — see the entry in the OPERATING section below.

  'intergovernmental revenues': {
    plain_name: 'Intergovernmental Revenues',
    short_description: 'Grants, shared taxes, and payments received from other governments.',
    description: 'Revenue received from federal, state, or other local governments — including grants, shared taxes, and formula-based aid distributions. Often funds specific programs, mandated services, or capital projects.',
    tags: ['intergovernmental', 'grants', 'state aid', 'revenue'],
    confidence: 'high',
  },

  'licenses and permits': {
    plain_name: 'Licenses & Permits',
    short_description: 'Fees for regulatory licenses and building permits.',
    description: 'Revenue from licenses and permits — building permits, business licenses, and similar regulatory charges. Fees generally reflect the cost of reviewing and approving applications.',
    tags: ['licenses', 'permits', 'fees', 'revenue'],
    confidence: 'high',
  },

  'other receipts': {
    plain_name: 'Other Receipts',
    short_description: 'A catch-all for miscellaneous revenue not classified elsewhere.',
    description: 'A catch-all for revenue receipts that do not fall into the named categories — such as refunds, insurance recoveries, and other minor or one-time inflows. Typically a small share of total revenue.',
    tags: ['other', 'miscellaneous', 'receipts', 'revenue'],
    confidence: 'high',
  },

  'other revenues': {
    plain_name: 'Other Revenues',
    short_description: 'A catch-all for miscellaneous revenue not classified elsewhere.',
    description: 'A catch-all for revenues that do not fall into the named categories — such as recovered costs, refunds, insurance proceeds, and other minor or one-time inflows. Typically a small share of total revenue.',
    tags: ['other', 'miscellaneous', 'revenues', 'revenue'],
    confidence: 'high',
  },

  'payment in lieu of taxes': {
    plain_name: 'Payment in Lieu of Taxes',
    short_description: 'Compensation paid by tax-exempt property owners in place of property taxes.',
    description: 'Payments made by property owners who are exempt from regular property taxes — such as state agencies, universities, or nonprofits — as compensation to the local government for services provided to their properties.',
    tags: ['payment in lieu of taxes', 'PILOT', 'property tax equivalent', 'revenue'],
    confidence: 'high',
  },

  'property taxes': {
    plain_name: 'Property Taxes',
    short_description: 'Taxes on the assessed value of real estate and personal property.',
    description: 'Taxes on the assessed value of property — real estate (land and buildings) and certain personal property. Property taxes are typically one of the largest sources of local tax revenue.',
    tags: ['property tax', 'real estate', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'receipts in lieu of taxes': {
    plain_name: 'Receipts in Lieu of Taxes',
    short_description: 'Receipts paid by tax-exempt entities in place of regular taxes.',
    description: 'Receipts paid by entities whose property is exempt from regular taxation — such as government-owned utilities or other public agencies — as an alternative contribution to local government costs.',
    tags: ['receipts in lieu of taxes', 'PILOT', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'rentals': {
    plain_name: 'Rental Income',
    short_description: 'Income from renting locally owned property to others.',
    description: 'Income the local government receives by renting buildings, land, or equipment it owns to tenants or other users. A modest, asset-based revenue source that varies with market conditions and property availability.',
    tags: ['rentals', 'rent', 'property income', 'revenue'],
    confidence: 'high',
  },

  'revenue in lieu of taxes': {
    plain_name: 'Revenue in Lieu of Taxes',
    short_description: 'Revenue received in place of regular taxes on exempt property or activity.',
    description: 'Revenue received from parties whose activities or property are exempt from regular taxation — provided as a substitute contribution to local government costs. Similar in concept to payment in lieu of taxes.',
    tags: ['revenue in lieu of taxes', 'PILOT', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'sales taxes': {
    plain_name: 'Sales Taxes',
    short_description: 'Local share of the sales tax on retail purchases.',
    description: 'Revenue from local sales taxes levied on retail purchases of goods and certain services. May be a locally set rate or the local share of a broader state-collected tax distributed back to local governments.',
    tags: ['sales tax', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'special assessments': {
    plain_name: 'Special Assessments',
    short_description: 'Charges levied on specific properties that benefit from a local improvement.',
    description: 'Charges levied on property owners who receive a direct, special benefit from a public improvement — such as a new sidewalk, sewer line, or street paving — proportional to the benefit each property receives.',
    tags: ['special assessments', 'property', 'improvements', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────── OPERATING/EXPENDITURE — depth-0 (35 keys) ──────────────────────

  'basic utility service': {
    plain_name: 'Basic Utility Service',
    short_description: 'Essential utility operations — water, sewer, and related basic services.',
    description: 'Expenditures for basic utility services the local government provides or funds — typically water distribution, sewage treatment, or essential utility operations. Covers service delivery costs and capital maintenance for core utility infrastructure.',
    tags: ['utilities', 'water', 'sewer', 'basic services'],
    confidence: 'high',
  },

  'bond issuance costs': {
    plain_name: 'Bond Issuance Costs',
    short_description: 'Fees and costs incurred when selling bonds to borrow money.',
    description: 'One-time costs associated with issuing bonds — such as underwriting fees, legal expenses, and rating agency charges. These costs are recognized when debt is issued to finance capital projects.',
    tags: ['debt', 'bond issuance', 'borrowing costs', 'finance'],
    confidence: 'high',
  },

  'capital outlay': {
    plain_name: 'Capital Outlay',
    short_description: 'Spending on long-lived assets — land, buildings, equipment, and infrastructure.',
    description: 'Spending on the acquisition, construction, or major improvement of capital assets — land, buildings, vehicles, equipment, and infrastructure. Capital outlay creates assets used over multiple years, as distinct from recurring operating expenses.',
    tags: ['capital outlay', 'infrastructure', 'equipment', 'capital spending'],
    confidence: 'high',
  },

  'community and economic development': {
    plain_name: 'Community & Economic Development',
    short_description: 'Planning, zoning, housing, and programs that guide growth and economic vitality.',
    description: 'Programs that shape how the local community grows and thrives — land-use planning and zoning, economic development, housing programs, and community redevelopment. Often partly supported by grant funding from state and federal sources.',
    tags: ['community development', 'economic development', 'planning', 'housing'],
    confidence: 'high',
  },

  'conservation and recreation': {
    plain_name: 'Conservation & Recreation',
    short_description: 'Parks, open space, recreation programs, and natural resource conservation.',
    description: 'Programs and facilities for parks, open space, trails, recreation centers, and natural resource conservation. Provides recreational opportunities for residents and protects environmental assets of the community.',
    tags: ['parks', 'recreation', 'conservation', 'open space'],
    confidence: 'high',
  },

  'debt service bond issuance costs': {
    plain_name: 'Debt Service — Bond Issuance Costs',
    short_description: 'Issuance costs for bonds classified within the debt service function.',
    description: 'Fees and transaction costs incurred when issuing bonds, classified within the debt service function. These one-time costs are part of the overall cost of borrowing for capital projects.',
    tags: ['debt service', 'bond issuance', 'borrowing costs', 'finance'],
    confidence: 'high',
  },

  'debt service interest and fiscal charges': {
    plain_name: 'Debt Service — Interest & Fiscal Charges',
    short_description: 'Interest paid on outstanding debt plus related fiscal fees.',
    description: 'The interest cost the local government pays on its outstanding bonds and other long-term borrowings, along with related fiscal agent fees and charges. Reflects the ongoing cost of debt previously incurred to finance capital projects.',
    tags: ['debt service', 'interest', 'fiscal charges', 'finance'],
    confidence: 'high',
  },

  'debt service other': {
    plain_name: 'Debt Service — Other',
    short_description: 'Debt service payments not classified as principal, interest, or issuance costs.',
    description: 'Debt service expenditures that do not fall into the principal retirement, interest, or bond issuance cost categories — such as premium payments, arbitrage rebates, or other miscellaneous debt-related costs.',
    tags: ['debt service', 'other', 'finance'],
    confidence: 'medium',
  },

  'debt service principal retirement': {
    plain_name: 'Debt Service — Principal Retirement',
    short_description: 'Repayment of the principal on outstanding bonds and loans.',
    description: 'Payments that retire the principal balance of outstanding bonds, notes, or other long-term debt. Principal retirement reduces the total debt obligation of the local government and is a mandatory, scheduled expenditure.',
    tags: ['debt service', 'principal', 'debt repayment', 'finance'],
    confidence: 'high',
  },

  'fire': {
    plain_name: 'Fire Protection',
    short_description: 'Fire suppression, fire prevention, and emergency response.',
    description: 'Fire suppression, fire prevention, fire inspection, and emergency response services — staffed by career firefighters, volunteer companies, or a combination. Protects lives and property from fire and related hazards.',
    tags: ['fire', 'fire protection', 'emergency response', 'public safety'],
    confidence: 'high',
  },

  'general government': {
    plain_name: 'General Government',
    short_description: 'Central administration — the governing body, finance, law, and support services.',
    description: 'The central administration of the local government — the elected governing body, the administrator or manager, finance and accounting, legal counsel, records, and other support services that keep the organization running. Typically funded from the general fund.',
    tags: ['general government', 'administration', 'finance', 'governing body'],
    confidence: 'high',
  },

  'general government judicial': {
    plain_name: 'General Government — Judicial',
    short_description: 'Court and judicial functions within the general government category.',
    description: 'Court and judicial functions classified within general government — such as the local share of court operations, the clerk of courts, and related judicial support services.',
    tags: ['judicial', 'courts', 'general government', 'administration'],
    confidence: 'high',
  },

  'general government legislative and executive': {
    plain_name: 'General Government — Legislative & Executive',
    short_description: 'The elected governing body and the executive administrator.',
    description: 'The legislative and executive functions of the local government — the elected council, commission, or board that sets policy and adopts the budget, and the administrator or executive responsible for carrying out those policies.',
    tags: ['legislative', 'executive', 'governing body', 'general government'],
    confidence: 'high',
  },

  'health': {
    plain_name: 'Health',
    short_description: 'Public health programs, disease prevention, and health services.',
    description: 'Public health programs funded by the local government — including disease prevention, clinics, environmental health, and health promotion. Often delivered in partnership with state health agencies and supported by a mix of local, state, and federal funding.',
    tags: ['health', 'public health', 'disease prevention', 'health services'],
    confidence: 'high',
  },

  'human services': {
    plain_name: 'Human Services',
    short_description: 'Social services, benefit programs, and support for vulnerable residents.',
    description: 'Social service programs and benefit assistance for residents in need — including income support, child and family services, elderly and disability programs, and community social support. Funded by a mix of local, state, and federal money.',
    tags: ['human services', 'social services', 'benefits', 'welfare'],
    confidence: 'high',
  },

  // 'intergovernmental' is shared between revenue and expenditure trees.
  // One entry covers both contexts (payments received from OR made to other governments).
  'intergovernmental': {
    plain_name: 'Intergovernmental',
    short_description: 'Payments or transfers between the local government and other governments.',
    description: 'Transactions between the local government and other governmental entities — either revenue received from (grants, shared taxes, and state aid from federal, state, or other local governments) or expenditures paid to (transfers and contributions to other governmental entities). The direction of flow determines whether this is a revenue source or an expenditure.',
    tags: ['intergovernmental', 'grants', 'state aid', 'transfers'],
    confidence: 'high',
  },

  'intergovernmental expenditures': {
    plain_name: 'Intergovernmental Expenditures',
    short_description: 'Payments and contributions made to other governmental entities.',
    description: 'Expenditures transferred to or on behalf of other governmental entities — including state agencies, other local governments, and special districts. Reflects obligations under intergovernmental agreements or mandated transfers.',
    tags: ['intergovernmental', 'expenditures', 'transfers', 'other governments'],
    confidence: 'high',
  },

  'interest and fiscal charges': {
    plain_name: 'Interest & Fiscal Charges',
    short_description: 'Interest paid on outstanding debt plus related fiscal fees.',
    description: 'Interest costs the local government pays on its outstanding bonds and other borrowings, along with related fiscal agent fees and charges. Reflects the ongoing carrying cost of previously incurred debt.',
    tags: ['interest', 'fiscal charges', 'debt', 'finance'],
    confidence: 'high',
  },

  'judicial': {
    plain_name: 'Judicial',
    short_description: 'Court operations and judicial services.',
    description: 'The local government\'s share of court operations and judicial services — including the courts, the clerk of courts, and related judicial support. Courts handle legal matters affecting residents, businesses, and the local government itself.',
    tags: ['judicial', 'courts', 'justice', 'legal'],
    confidence: 'high',
  },

  'legislative and executive': {
    plain_name: 'Legislative & Executive',
    short_description: 'The elected governing body and the executive administrator.',
    description: 'The legislative and executive branch of the local government — the elected board, council, or commission that enacts policy and adopts the budget, and the executive office responsible for implementing those decisions.',
    tags: ['legislative', 'executive', 'governing body', 'administration'],
    confidence: 'high',
  },

  'leisure time activities': {
    plain_name: 'Leisure Time Activities',
    short_description: 'Parks, recreation, and programs for residents\' leisure and well-being.',
    description: 'Programs and facilities that support residents\' leisure, recreation, and well-being — parks, athletic facilities, recreation centers, sports leagues, cultural events, and similar quality-of-life amenities.',
    tags: ['leisure', 'recreation', 'parks', 'community'],
    confidence: 'high',
  },

  'other': {
    plain_name: 'Other',
    short_description: 'Expenditures not classified under another named function.',
    description: 'A catch-all for expenditures that do not fall under any of the other named functions or programs. May include miscellaneous costs, transfers, contingencies, or items that span multiple categories.',
    tags: ['other', 'miscellaneous', 'expenditures'],
    confidence: 'high',
  },

  'other disbursements': {
    plain_name: 'Other Disbursements',
    short_description: 'Miscellaneous disbursements not classified elsewhere.',
    description: 'A catch-all for disbursements that are not classified under the other named categories — such as refunds, special payments, or miscellaneous outflows recorded in the modified or cash accounting basis.',
    tags: ['other', 'disbursements', 'miscellaneous', 'expenditures'],
    confidence: 'high',
  },

  'other expenditures': {
    plain_name: 'Other Expenditures',
    short_description: 'Miscellaneous expenditures not assigned to another category.',
    description: 'Expenditures that do not fit the other named function or program categories — including miscellaneous costs, shared services, or items that cross departmental lines without a clear single home.',
    tags: ['other', 'expenditures', 'miscellaneous'],
    confidence: 'high',
  },

  'police': {
    plain_name: 'Police',
    short_description: 'Law enforcement — patrol, investigations, and traffic enforcement.',
    description: 'Law enforcement provided by the local police department — patrol, criminal investigation, traffic enforcement, community policing, and related law enforcement support. Typically one of the largest areas of local operating spending.',
    tags: ['police', 'law enforcement', 'public safety', 'patrol'],
    confidence: 'high',
  },

  'principal retirement': {
    plain_name: 'Principal Retirement',
    short_description: 'Repayment of the principal on bonds and long-term debt.',
    description: 'Payments that reduce the principal balance of outstanding bonds, loans, or other long-term borrowings. Principal retirement is a scheduled, mandatory obligation that reduces the local government\'s total debt over time.',
    tags: ['principal', 'debt repayment', 'debt service', 'finance'],
    confidence: 'high',
  },

  'public health': {
    plain_name: 'Public Health',
    short_description: 'Public health programs — disease prevention, clinics, and environmental health.',
    description: 'Public health programs administered or funded by the local government — including communicable disease prevention, immunizations, health clinics, and environmental health inspections. Typically operated in partnership with state health authorities.',
    tags: ['public health', 'health', 'disease prevention', 'environmental health'],
    confidence: 'high',
  },

  'public safety': {
    plain_name: 'Public Safety',
    short_description: 'All services that protect people and property — police, fire, and emergency services.',
    description: 'The full range of services that protect lives and property — law enforcement, fire suppression, emergency medical services, emergency management, and related protective services. Usually one of the largest expenditure areas for a local government.',
    tags: ['public safety', 'police', 'fire', 'emergency'],
    confidence: 'high',
  },

  'public services': {
    plain_name: 'Public Services',
    short_description: 'General local services provided to the community.',
    description: 'General public services provided by the local government to residents and the broader community — covering day-to-day government operations and community service functions that do not fall under more specific program areas.',
    tags: ['public services', 'community services', 'general services'],
    confidence: 'medium',
  },

  'public works': {
    plain_name: 'Public Works',
    short_description: 'Roads, streets, bridges, facilities, and physical infrastructure maintenance.',
    description: 'Maintenance and improvement of the local government\'s physical infrastructure — roads, streets, bridges, public buildings, and grounds. Keeps the community\'s core infrastructure safe and functional.',
    tags: ['public works', 'infrastructure', 'roads', 'streets'],
    confidence: 'high',
  },

  'security of persons and property': {
    plain_name: 'Security of Persons & Property',
    short_description: 'Protective services — policing, fire, and related security functions.',
    description: 'The broad category of services that protect the safety and security of residents and their property — encompassing law enforcement, fire protection, and related protective functions. Used in some accounting bases as the overarching public-safety category.',
    tags: ['security', 'public safety', 'police', 'fire'],
    confidence: 'high',
  },

  'security of persons and property fire': {
    plain_name: 'Security of Persons & Property — Fire',
    short_description: 'Fire protection classified within the security of persons and property category.',
    description: 'Fire suppression, fire prevention, and emergency response services classified within the security-of-persons-and-property function. Protects lives and property from fire and related hazards.',
    tags: ['fire', 'fire protection', 'security', 'public safety'],
    confidence: 'high',
  },

  'security of persons and property other': {
    plain_name: 'Security of Persons & Property — Other',
    short_description: 'Other protective services within the security of persons and property category.',
    description: 'Protective services within the security-of-persons-and-property category that are not police or fire — such as emergency management, animal control, building inspection, or other safety-related programs.',
    tags: ['security', 'public safety', 'other protection', 'emergency management'],
    confidence: 'medium',
  },

  'security of persons and property police': {
    plain_name: 'Security of Persons & Property — Police',
    short_description: 'Law enforcement classified within the security of persons and property category.',
    description: 'Law enforcement services — patrol, criminal investigation, and traffic enforcement — classified within the security-of-persons-and-property function. Protects the safety of residents and their property.',
    tags: ['police', 'law enforcement', 'security', 'public safety'],
    confidence: 'high',
  },

  'transportation': {
    plain_name: 'Transportation',
    short_description: 'Roads, streets, bridges, and transportation infrastructure.',
    description: 'Spending on transportation infrastructure and services — including road and street maintenance, bridge repair, traffic signals, and related transportation programs. Keeps the local road network safe and functional for residents and businesses.',
    tags: ['transportation', 'roads', 'streets', 'infrastructure'],
    confidence: 'high',
  },
};

// Canonical key list — single source of truth for the coverage gate + tests.
// Revenue: 17 keys (minus 'intergovernmental' which is shared — that entry lives under operating)
// Operating: 35 keys (includes the shared 'intergovernmental')
// Total distinct keys: 51 (52 named - 1 shared 'intergovernmental').
// IMPORTANT: If the live DB only emits 'intergovernmental' once (one distinct key covering both
// revenue and operating trees), this 51-key list is correct. If the loader's live-key derivation
// surfaces a count different from EXPECTED_KEYS, the coverage gate will identify any gaps.
export const EXPECTED_KEYS = Object.keys(OHIO_ENRICHMENT);
