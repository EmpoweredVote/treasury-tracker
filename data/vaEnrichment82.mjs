// Phase 82 — Virginia Parity Enrichment (inline-authored, $0; NO paid API path).
//
// Strategy (Chris, 2026-06-23): Virginia's category vocabulary is FIXED and standardized
// statewide by the APA Comparative Report (Exhibit C functions + sub-exhibit activities;
// Exhibit B revenue sources). It is a small closed set — 73 distinct name_keys. So enrichment
// is an EXPLICIT hand-authored map keyed by exact name_key (one accurate row per key), NOT a
// heuristic router with fallback (that was Phase 72's approach for Utah's unbounded fund names).
//
// All text is strictly CONCEPT-LEVEL and ENTITY- AND STATE-NEUTRAL: it must read correctly for
// a Virginia city, county, AND town, and (for the keys shared with other states) for a CA city
// or MA town too. NO locality names, NO dollar figures, NO entity-specific facts. Prefer
// "the locality" / "local government" over "the city". Every row is UNIVERSAL
// (municipality_id IS NULL), so bleed-safety holds by construction.
//
// Authoring model:
//   VA_ENRICHMENT — object keyed by exact name_key → { plain_name, short_description,
//                   description, tags:[...], confidence }, matching the CONCEPTS voice in
//                   data/caParityEnrichment61.mjs.
//   EXPECTED_KEYS — the canonical 73-key list; the single source of truth for the loader's
//                   100% coverage gate (scripts/loadVAEnrichment82.mjs ABORTS on any unmapped
//                   live key — there is no fallback) and for the offline tests.
//
// name_key = budget_categories.link_key: depth-0 = plain function/source; depth-1 = "parent|child"
// composite (function|activity or source|subsource). The two "interest" composites are written
// distinctly: tax-penalty interest vs investment interest. The "miscellaneous" revenue row is a
// genuine catch-all — explicitly NOT "Information Technology" (corrects a stale shared universal).

export const SOURCE = 'ai';

export const VA_ENRICHMENT = {
  // ───────────────────────── OPERATING — functions (depth-0) ─────────────────────────
  'general government administration': {
    plain_name: 'General Government',
    short_description: 'Central administration — the governing body, finance, taxes, elections, and legal/HR.',
    description: 'The locality\'s central administration: the elected governing body, the administrator or manager, finance and accounting, budgeting, tax assessment and collection, elections, legal, human resources, and information technology. Funded mainly from the general fund.',
    tags: ['general government', 'administration', 'finance', 'elections'],
    confidence: 'high',
  },
  'judicial administration': {
    plain_name: 'Courts & Justice',
    short_description: 'The local share of the court system — courts, the clerk, and the prosecutor.',
    description: 'The local share of the justice system — the circuit, general district, and juvenile courts, the clerk of court, the commonwealth\'s attorney (prosecutor), and related court services. In Virginia the Commonwealth runs the judiciary, so localities mainly fund facilities and certain staff.',
    tags: ['judicial', 'courts', 'justice', 'prosecutor'],
    confidence: 'high',
  },
  'public safety': {
    plain_name: 'Public Safety',
    short_description: 'Police/sheriff, fire and rescue, jails, inspections, and emergency services.',
    description: 'The services that protect people and property — law enforcement (sheriff or police), fire and rescue/EMS, jails and detention, building and code inspections, and emergency management. Usually one of the largest functions, paid mostly from the general fund.',
    tags: ['public safety', 'police', 'fire', 'emergency'],
    confidence: 'high',
  },
  'public works': {
    plain_name: 'Public Works',
    short_description: 'Maintains streets, buildings, and grounds, and handles trash and sanitation.',
    description: 'Maintains the physical assets the locality is responsible for — streets, sidewalks, public buildings, and grounds — and provides refuse and sanitation services. In Virginia most county roads are state-maintained, while cities and towns generally maintain their own streets.',
    tags: ['public works', 'infrastructure', 'streets', 'sanitation'],
    confidence: 'high',
  },
  'health and human services': {
    plain_name: 'Health & Human Services',
    short_description: 'Public health, social services and benefits, and community behavioral health.',
    description: 'The local share of public health, social services (benefit programs, eligibility, and child and family welfare), and community behavioral health. Funded by a mix of local, state, and federal money.',
    tags: ['health', 'human services', 'social services', 'welfare'],
    confidence: 'high',
  },
  'education': {
    plain_name: 'Education',
    short_description: 'The locality\'s funding for public schools.',
    description: 'The local government\'s spending on public education — primarily the local appropriation transferred to the public school division, which in Virginia is a separate fiscal entity with its own budget. Often the single largest area of local spending.',
    tags: ['education', 'schools', 'public schools'],
    confidence: 'high',
  },
  'parks, recreation, and cultural': {
    plain_name: 'Parks, Recreation & Culture',
    short_description: 'Parks, recreation programs, public libraries, and cultural activities.',
    description: 'Maintains parks and recreation facilities, runs recreation programs, operates public libraries, and supports cultural and arts activities for residents.',
    tags: ['parks', 'recreation', 'libraries', 'culture'],
    confidence: 'high',
  },
  'community development': {
    plain_name: 'Community Development',
    short_description: 'Planning and zoning, economic development, environment, and extension programs.',
    description: 'Guides how the locality grows — land-use planning and zoning, economic development, environmental management, and cooperative extension (agriculture and family programs). Often partly supported by permit and program fees.',
    tags: ['community development', 'planning', 'economic development', 'environment'],
    confidence: 'high',
  },
  'non- departmental': {
    plain_name: 'Non-Departmental',
    short_description: 'Shared costs not assigned to a single department.',
    description: 'Costs budgeted centrally rather than within one department — items such as insurance, contributions to outside agencies, debt-related transfers, and other shared or miscellaneous expenses that span the whole organization.',
    tags: ['non-departmental', 'shared costs', 'administration'],
    confidence: 'medium',
  },
  'virginia general fund budget': {
    plain_name: 'Virginia General Fund (Spending)',
    short_description: 'The Commonwealth of Virginia\'s state-level General Fund spending, by program area.',
    description: 'State-level spending from the Commonwealth of Virginia\'s General Fund, grouped into broad program areas such as education, health and human services, and public safety. This is the statewide budget, distinct from any local government.',
    tags: ['virginia', 'state budget', 'general fund', 'spending'],
    confidence: 'high',
  },

  // ───────────────────── OPERATING — function|activity (depth-1) ─────────────────────
  'community development|cooperative extension program': {
    plain_name: 'Cooperative Extension',
    short_description: 'Local share of Virginia Cooperative Extension — agriculture, 4-H, and family programs.',
    description: 'The local share of Virginia Cooperative Extension — practical education in agriculture, 4-H youth development, and family and consumer sciences, delivered in partnership with Virginia Tech and Virginia State University.',
    tags: ['cooperative extension', 'agriculture', '4-H', 'community development'],
    confidence: 'high',
  },
  'community development|environmental management': {
    plain_name: 'Environmental Management',
    short_description: 'Protects natural resources — stormwater, conservation, and environmental compliance.',
    description: 'Programs that protect natural resources and manage the environment — stormwater management, soil and water conservation, and environmental compliance and cleanup.',
    tags: ['environment', 'stormwater', 'conservation', 'community development'],
    confidence: 'high',
  },
  'community development|planning and community development': {
    plain_name: 'Planning & Development',
    short_description: 'Land-use planning, zoning, and programs that guide growth and economic development.',
    description: 'Land-use planning, zoning, and the review of development proposals, together with economic development and housing programs that guide how the locality grows. Often partly fee-supported.',
    tags: ['planning', 'zoning', 'economic development', 'housing'],
    confidence: 'high',
  },
  'general government administration|board of elections': {
    plain_name: 'Elections',
    short_description: 'The electoral board and voter registrar — registration, polling, and elections.',
    description: 'Runs local elections — the electoral board and the general registrar handle voter registration, polling places, ballots, and election administration.',
    tags: ['elections', 'voter registration', 'general government'],
    confidence: 'high',
  },
  'general government administration|general and financial administration': {
    plain_name: 'General & Financial Administration',
    short_description: 'The back office — manager, finance, budgeting, tax assessment/collection, HR, and IT.',
    description: 'The core administrative back office — the administrator or manager, finance and accounting, budgeting, tax assessment and collection, procurement, human resources, and information technology that keep the local government running.',
    tags: ['administration', 'finance', 'budget', 'human resources'],
    confidence: 'high',
  },
  'general government administration|legislative': {
    plain_name: 'Governing Body',
    short_description: 'The elected board or council that sets policy and adopts the budget.',
    description: 'The elected governing body — a board of supervisors or a city or town council — that sets local policy, passes ordinances, and adopts the budget, together with the clerk who supports it.',
    tags: ['governing body', 'legislative', 'council', 'board of supervisors'],
    confidence: 'high',
  },
  'health and human services|behavioral health and developmental services': {
    plain_name: 'Behavioral Health',
    short_description: 'Community mental health, substance-use, and developmental-disability services.',
    description: 'Community mental health, substance-use, and developmental-disability services, often delivered through a regional community services board. Funded by a mix of local, state, and federal money.',
    tags: ['behavioral health', 'mental health', 'developmental services', 'human services'],
    confidence: 'high',
  },
  'health and human services|health': {
    plain_name: 'Public Health',
    short_description: 'The local health department — disease prevention, clinics, and environmental health.',
    description: 'The local health department — disease prevention, immunizations, clinics, and environmental health inspections — typically operated jointly with the Virginia Department of Health.',
    tags: ['public health', 'health department', 'human services'],
    confidence: 'high',
  },
  'health and human services|income support benefits social services': {
    plain_name: 'Social Services & Benefits',
    short_description: 'The local social services department — benefit programs and family support.',
    description: 'The local department of social services — eligibility for benefit programs (such as food, cash, and medical assistance), child protective services, foster care, and family support. Largely funded by state and federal money passed through the locality.',
    tags: ['social services', 'benefits', 'child welfare', 'human services'],
    confidence: 'high',
  },
  'judicial administration|commonwealth\'s attorney': {
    plain_name: 'Prosecutor (Commonwealth\'s Attorney)',
    short_description: 'The locally elected prosecutor who brings criminal cases for the Commonwealth.',
    description: 'The commonwealth\'s attorney — the locally elected prosecutor who reviews charges and prosecutes criminal cases on behalf of the Commonwealth of Virginia.',
    tags: ['prosecutor', 'commonwealth\'s attorney', 'judicial', 'criminal justice'],
    confidence: 'high',
  },
  'judicial administration|courts': {
    plain_name: 'Courts & Clerk',
    short_description: 'The local share of the courts, the clerk of court, and court support.',
    description: 'The local share of the court system — circuit, general district, and juvenile and domestic relations courts, the clerk of the circuit court, magistrates, and court support services.',
    tags: ['courts', 'clerk of court', 'judicial', 'justice'],
    confidence: 'high',
  },
  'parks, recreation, and cultural|cultural enrichment': {
    plain_name: 'Cultural Programs',
    short_description: 'Support for the arts, museums, historic sites, and cultural events.',
    description: 'Support for cultural life — the arts, museums, historic sites, and community cultural events. Funded from the general fund, grants, and admissions.',
    tags: ['culture', 'arts', 'museums', 'recreation'],
    confidence: 'high',
  },
  'parks, recreation, and cultural|parks and recreation': {
    plain_name: 'Parks & Recreation',
    short_description: 'Parks, athletic fields, recreation centers, and recreation programs.',
    description: 'Maintains parks, trails, athletic fields, and community and recreation centers, and runs recreation programs for residents of all ages. Partly supported by program and facility fees.',
    tags: ['parks', 'recreation', 'programs', 'open space'],
    confidence: 'high',
  },
  'parks, recreation, and cultural|public libraries': {
    plain_name: 'Public Libraries',
    short_description: 'The public library system — collections, programs, and computer access.',
    description: 'Operates the public library system — physical and digital collections, programs, and computer and internet access. Funded from the general fund and sometimes state library aid.',
    tags: ['libraries', 'education', 'community', 'recreation'],
    confidence: 'high',
  },
  'public safety|correction and detention': {
    plain_name: 'Jails & Detention',
    short_description: 'Local and regional jails, juvenile detention, and inmate services.',
    description: 'Funds local and regional jails, juvenile detention, and inmate custody and services. In Virginia many jails are operated regionally by several localities together.',
    tags: ['jail', 'detention', 'corrections', 'public safety'],
    confidence: 'high',
  },
  'public safety|fire and rescue services': {
    plain_name: 'Fire & Rescue',
    short_description: 'Fire suppression, rescue, and emergency medical services.',
    description: 'Fire suppression, rescue, fire prevention, and emergency medical services, staffed by career firefighters, volunteer companies, or both.',
    tags: ['fire', 'rescue', 'ems', 'public safety'],
    confidence: 'high',
  },
  'public safety|inspections': {
    plain_name: 'Building Inspections',
    short_description: 'Building, electrical, plumbing, and property-maintenance code inspection.',
    description: 'Inspects construction and property to enforce the building code and related electrical, plumbing, and property-maintenance standards. Largely funded by permit and plan-review fees.',
    tags: ['inspections', 'building code', 'permits', 'public safety'],
    confidence: 'high',
  },
  'public safety|law enforcement and traffic control': {
    plain_name: 'Law Enforcement',
    short_description: 'Policing by the sheriff or police department — patrol, investigations, traffic.',
    description: 'Law enforcement provided by the sheriff\'s office or a police department — patrol, criminal investigation, and traffic enforcement. Typically one of the largest parts of the public-safety budget.',
    tags: ['law enforcement', 'police', 'sheriff', 'public safety'],
    confidence: 'high',
  },
  'public safety|other protection': {
    plain_name: 'Other Protection',
    short_description: 'Other protective services — emergency management, animal control, and dispatch.',
    description: 'Other protective services not covered by police, fire, jails, or inspections — such as emergency management, animal control, and emergency (E-911) communications and dispatch.',
    tags: ['emergency management', 'animal control', 'e-911', 'public safety'],
    confidence: 'high',
  },
  'public works|maintenance of general buildings and grounds': {
    plain_name: 'Buildings & Grounds',
    short_description: 'Upkeep of public buildings, facilities, and grounds.',
    description: 'Maintains public buildings, facilities, and grounds — custodial service, repairs, mechanical systems, and landscaping — so they stay safe and usable.',
    tags: ['buildings', 'grounds', 'facilities', 'public works'],
    confidence: 'high',
  },
  'public works|maintenance of highways, streets, bridges, and sidewalks': {
    plain_name: 'Streets & Roads',
    short_description: 'Maintenance of roads, streets, bridges, sidewalks, signals, and lighting.',
    description: 'Maintains the roads, streets, bridges, sidewalks, traffic signals, and street lighting the locality is responsible for. In Virginia, cities and towns generally maintain their own streets, while most county roads are maintained by the state.',
    tags: ['streets', 'roads', 'bridges', 'public works'],
    confidence: 'high',
  },
  'public works|sanitation and waste removal': {
    plain_name: 'Trash & Sanitation',
    short_description: 'Garbage and recycling collection, disposal, and landfill operations.',
    description: 'Provides garbage and recycling collection and disposal, including transfer stations and landfill operations. Often supported in part by refuse service fees.',
    tags: ['sanitation', 'waste', 'recycling', 'public works'],
    confidence: 'high',
  },
  'virginia general fund budget|education': {
    plain_name: 'State Education',
    short_description: 'The Commonwealth\'s General Fund spending on education.',
    description: 'The Commonwealth of Virginia\'s General Fund spending on education — state aid to local public school divisions and support for public colleges and universities. The largest area of the state General Fund.',
    tags: ['virginia', 'state budget', 'education', 'schools'],
    confidence: 'high',
  },
  'virginia general fund budget|general government': {
    plain_name: 'State General Government',
    short_description: 'The Commonwealth\'s spending on central state operations and administration.',
    description: 'The Commonwealth of Virginia\'s General Fund spending on the central operations of state government — administration, the legislature, the executive, and general government services.',
    tags: ['virginia', 'state budget', 'general government'],
    confidence: 'high',
  },
  'virginia general fund budget|health and human services': {
    plain_name: 'State Health & Human Services',
    short_description: 'The Commonwealth\'s General Fund spending on health and social programs.',
    description: 'The Commonwealth of Virginia\'s General Fund spending on health and human services — including Medicaid, public health, behavioral health, and social services programs.',
    tags: ['virginia', 'state budget', 'health', 'human services'],
    confidence: 'high',
  },
  'virginia general fund budget|natural resources and commerce': {
    plain_name: 'State Natural Resources & Commerce',
    short_description: 'The Commonwealth\'s spending on natural resources, agriculture, and commerce.',
    description: 'The Commonwealth of Virginia\'s General Fund spending on natural resources and the environment, agriculture, and economic and commerce programs.',
    tags: ['virginia', 'state budget', 'natural resources', 'commerce'],
    confidence: 'medium',
  },
  'virginia general fund budget|other programs': {
    plain_name: 'Other State Programs',
    short_description: 'Commonwealth General Fund spending outside the other named program areas.',
    description: 'Commonwealth of Virginia General Fund spending that does not fall under the other named program areas — including transportation and other general government support.',
    tags: ['virginia', 'state budget', 'other programs'],
    confidence: 'medium',
  },
  'virginia general fund budget|public safety and corrections': {
    plain_name: 'State Public Safety & Corrections',
    short_description: 'The Commonwealth\'s spending on state police, prisons, and the courts.',
    description: 'The Commonwealth of Virginia\'s General Fund spending on public safety and corrections — the state police, state prisons and corrections, and the judicial system.',
    tags: ['virginia', 'state budget', 'public safety', 'corrections'],
    confidence: 'high',
  },

  // ───────────────────────── REVENUE — sources (depth-0) ─────────────────────────
  'general property taxes': {
    plain_name: 'Property Taxes',
    short_description: 'Taxes on the assessed value of real estate and personal property.',
    description: 'Taxes on the assessed value of property — real estate (land and buildings) and personal property such as vehicles and business equipment. Usually the largest single source of local revenue.',
    tags: ['property tax', 'real estate', 'personal property', 'taxes'],
    confidence: 'high',
  },
  'other local taxes': {
    plain_name: 'Other Local Taxes',
    short_description: 'Local taxes besides property — sales, meals, lodging, business, and utility taxes.',
    description: 'Local taxes other than property taxes — including the local sales tax, meals and lodging taxes, business license taxes, and consumer utility taxes, each authorized under state law.',
    tags: ['local taxes', 'sales tax', 'meals tax', 'taxes'],
    confidence: 'high',
  },
  'permits, privilege fees, and regulatory licenses': {
    plain_name: 'Permits & Licenses',
    short_description: 'Fees for permits and regulatory licenses.',
    description: 'Revenue from permits and regulatory licenses — building permits, business and professional licenses, and similar regulatory charges. A modest, fee-based revenue source.',
    tags: ['permits', 'licenses', 'fees', 'revenue'],
    confidence: 'high',
  },
  'fines and forfeitures': {
    plain_name: 'Fines & Forfeitures',
    short_description: 'Court fines, penalties, and forfeitures.',
    description: 'Revenue from court fines, penalties, and forfeitures — for example traffic and parking citations and code-violation penalties. A modest, variable revenue source.',
    tags: ['fines', 'forfeitures', 'penalties', 'revenue'],
    confidence: 'high',
  },
  'revenue from use of money and property': {
    plain_name: 'Money & Property Income',
    short_description: 'Interest on investments and rent or sale of property.',
    description: 'Non-tax income the locality earns from its own assets — interest on invested cash and rent or sale of locally owned property. Varies with interest rates and property activity.',
    tags: ['interest', 'rent', 'investment income', 'revenue'],
    confidence: 'high',
  },
  'charges for services': {
    plain_name: 'Service Charges',
    short_description: 'Fees paid for specific local services.',
    description: 'Fees that residents and users pay for specific services — such as utilities, recreation programs, emergency medical transport, and court or administrative charges. The user pays in proportion to the service received.',
    tags: ['service charges', 'fees', 'user fees', 'revenue'],
    confidence: 'high',
  },
  'miscellaneous': {
    plain_name: 'Miscellaneous Revenue',
    short_description: 'A catch-all for revenue that does not fit the other categories.',
    description: 'A catch-all for revenue that does not fit the named categories — such as refunds, recovered costs, donations, and other minor or one-time receipts. Typically a small share of total revenue.',
    tags: ['miscellaneous', 'other revenue', 'recoveries', 'revenue'],
    confidence: 'high',
  },
  'virginia general fund revenue': {
    plain_name: 'Virginia General Fund (Revenue)',
    short_description: 'The Commonwealth of Virginia\'s state-level General Fund revenue.',
    description: 'State-level revenue for the Commonwealth of Virginia\'s General Fund, drawn mostly from statewide taxes such as the individual income tax and the sales and use tax. This is the statewide budget, distinct from any local government.',
    tags: ['virginia', 'state revenue', 'general fund', 'taxes'],
    confidence: 'high',
  },

  // ─────────────── REVENUE — general property taxes|subsource (depth-1) ───────────────
  'general property taxes|real property': {
    plain_name: 'Real Estate Tax',
    short_description: 'Tax on the assessed value of land and buildings.',
    description: 'A tax on the assessed value of real estate — land and buildings. Typically the single largest local tax and a stable, predictable revenue source.',
    tags: ['real estate tax', 'property tax', 'taxes'],
    confidence: 'high',
  },
  'general property taxes|personal property - general': {
    plain_name: 'Personal Property Tax',
    short_description: 'Tax on tangible personal property such as vehicles and business equipment.',
    description: 'A tax on tangible personal property — chiefly motor vehicles, but also boats, trailers, and business equipment. In Virginia, the state partly reimburses localities for the tax on personal vehicles.',
    tags: ['personal property tax', 'vehicle tax', 'taxes'],
    confidence: 'high',
  },
  'general property taxes|personal property - mobile home': {
    plain_name: 'Mobile Home Tax',
    short_description: 'Personal property tax on manufactured and mobile homes.',
    description: 'The personal property tax assessed on manufactured and mobile homes. A small, specialized portion of the property tax.',
    tags: ['mobile home tax', 'personal property tax', 'taxes'],
    confidence: 'high',
  },
  'general property taxes|public service corporations': {
    plain_name: 'Utility Property Tax',
    short_description: 'Property tax on public service companies, assessed by the state.',
    description: 'Property tax on public service corporations — railroads, electric, gas, water, and telecommunications companies — whose property is assessed centrally by the state and taxed locally.',
    tags: ['public service corporations', 'utility property', 'property tax'],
    confidence: 'high',
  },
  'general property taxes|machinery and tools': {
    plain_name: 'Machinery & Tools Tax',
    short_description: 'Local property tax on manufacturing machinery and tools.',
    description: 'A local property tax on the machinery and tools used in manufacturing, mining, and certain other businesses, taxed at a separate, often lower rate than other property.',
    tags: ['machinery and tools', 'business tax', 'property tax'],
    confidence: 'high',
  },
  'general property taxes|merchants\' capital': {
    plain_name: 'Merchants\' Capital Tax',
    short_description: 'Local property tax on merchants\' business inventory and capital.',
    description: 'A local property tax on the capital of merchants — chiefly business inventory. Only some Virginia localities levy it, as an alternative to the business license tax.',
    tags: ['merchants capital', 'business tax', 'inventory', 'property tax'],
    confidence: 'medium',
  },
  'general property taxes|penalties': {
    plain_name: 'Tax Penalties',
    short_description: 'Penalties charged on late or unpaid taxes.',
    description: 'Penalty charges added to taxes that are paid late or left unpaid. A small enforcement-related portion of property tax revenue.',
    tags: ['penalties', 'late payment', 'property tax'],
    confidence: 'high',
  },
  'general property taxes|interest': {
    plain_name: 'Tax Interest',
    short_description: 'Interest charged on delinquent (overdue) taxes.',
    description: 'Interest charged on delinquent, overdue taxes until they are paid. This is interest the locality collects from late taxpayers — distinct from interest the locality earns on its own invested cash.',
    tags: ['interest', 'delinquent taxes', 'property tax'],
    confidence: 'high',
  },

  // ─────────────── REVENUE — other local taxes|subsource (depth-1) ───────────────
  'other local taxes|local sales and use taxes': {
    plain_name: 'Local Sales Tax',
    short_description: 'The local share of the sales and use tax on retail purchases.',
    description: 'The locality\'s share of the sales and use tax collected on retail purchases. The state collects it statewide and returns the local portion, making it a significant local revenue source.',
    tags: ['sales tax', 'local taxes', 'taxes'],
    confidence: 'high',
  },
  'other local taxes|consumer utility taxes': {
    plain_name: 'Utility Tax',
    short_description: 'Tax on consumer utility bills such as electricity, gas, and water.',
    description: 'A tax on consumer utility service — electricity, natural gas, and water — usually appearing as a small line item on the utility bill.',
    tags: ['utility tax', 'consumer utility', 'local taxes'],
    confidence: 'high',
  },
  'other local taxes|business license taxes': {
    plain_name: 'Business License Tax (BPOL)',
    short_description: 'The local business, professional, and occupational license tax.',
    description: 'The business, professional, and occupational license (BPOL) tax — a local tax on businesses, generally based on gross receipts, paid for the privilege of doing business in the locality.',
    tags: ['business license', 'bpol', 'gross receipts', 'local taxes'],
    confidence: 'high',
  },
  'other local taxes|motor vehicle license taxes': {
    plain_name: 'Vehicle License Tax',
    short_description: 'The local license fee for registering motor vehicles.',
    description: 'A local license fee for registering motor vehicles within the locality — historically tied to a vehicle decal. Distinct from the personal property tax on the vehicle\'s value.',
    tags: ['vehicle license', 'car tax', 'local taxes'],
    confidence: 'high',
  },
  'other local taxes|restaurant food taxes': {
    plain_name: 'Meals Tax',
    short_description: 'Tax on prepared food and meals sold by restaurants.',
    description: 'A tax on prepared food and meals sold by restaurants and similar businesses. A common local revenue source paid mostly by diners and visitors.',
    tags: ['meals tax', 'restaurant tax', 'food', 'local taxes'],
    confidence: 'high',
  },
  'other local taxes|hotel and motel room taxes': {
    plain_name: 'Lodging Tax',
    short_description: 'Transient occupancy tax on hotel, motel, and short-term stays.',
    description: 'A transient occupancy tax on hotel, motel, and short-term lodging stays. Paid largely by visitors and often used to support tourism.',
    tags: ['lodging tax', 'hotel tax', 'transient occupancy', 'local taxes'],
    confidence: 'high',
  },
  'other local taxes|recordation and will taxes': {
    plain_name: 'Recordation Tax',
    short_description: 'Taxes on recording deeds, mortgages, and wills.',
    description: 'Taxes collected when legal documents are recorded — chiefly deeds, mortgages, and wills. Revenue rises and falls with real estate activity.',
    tags: ['recordation tax', 'deeds', 'local taxes'],
    confidence: 'high',
  },
  'other local taxes|tobacco taxes': {
    plain_name: 'Tobacco Tax',
    short_description: 'Local tax on cigarettes and tobacco products.',
    description: 'A local excise tax on cigarettes and other tobacco products. A small, specialized revenue source levied by some localities.',
    tags: ['tobacco tax', 'cigarette tax', 'local taxes'],
    confidence: 'high',
  },
  'other local taxes|admission taxes': {
    plain_name: 'Admissions Tax',
    short_description: 'Tax on admission charges to events and entertainment.',
    description: 'A tax on admission charges to events and entertainment, such as concerts, shows, and attractions. Levied by some localities.',
    tags: ['admissions tax', 'entertainment', 'local taxes'],
    confidence: 'medium',
  },
  'other local taxes|bank stock taxes': {
    plain_name: 'Bank Franchise Tax',
    short_description: 'Tax on the net capital of banks.',
    description: 'The bank franchise tax — a local tax on the net capital of banks operating in the locality, paid in lieu of certain other taxes on those institutions.',
    tags: ['bank franchise tax', 'bank stock', 'local taxes'],
    confidence: 'medium',
  },
  'other local taxes|franchise license taxes': {
    plain_name: 'Franchise Tax',
    short_description: 'Taxes and fees on franchises such as cable and right-of-way use.',
    description: 'Taxes and fees charged for franchises and the use of public rights-of-way — for example cable television franchises. A small, contract-based revenue source.',
    tags: ['franchise tax', 'right-of-way', 'cable', 'local taxes'],
    confidence: 'medium',
  },
  'other local taxes|coal, oil, and gas taxes': {
    plain_name: 'Coal, Oil & Gas Tax',
    short_description: 'Local severance and license taxes on coal, oil, and gas production.',
    description: 'Local severance and license taxes on the production of coal, oil, and natural gas. Relevant chiefly to localities with extraction industries.',
    tags: ['severance tax', 'coal', 'oil and gas', 'local taxes'],
    confidence: 'medium',
  },
  'other local taxes|other local taxes': {
    plain_name: 'Other Local Taxes',
    short_description: 'Local taxes not separately itemized.',
    description: 'Local taxes that are not broken out into the named categories — smaller or miscellaneous local levies grouped together for reporting.',
    tags: ['other local taxes', 'miscellaneous', 'local taxes'],
    confidence: 'medium',
  },

  // ─────── REVENUE — revenue from use of money and property|subsource (depth-1) ───────
  'revenue from use of money and property|interest': {
    plain_name: 'Investment Interest',
    short_description: 'Interest the locality earns on its invested cash and balances.',
    description: 'Interest the locality earns on its own invested cash and bank balances. This is income the locality earns on its money — distinct from interest charged to taxpayers on overdue taxes.',
    tags: ['interest', 'investment income', 'money and property'],
    confidence: 'high',
  },
  'revenue from use of money and property|rental and sale of property': {
    plain_name: 'Rent & Property Sales',
    short_description: 'Income from renting or selling locally owned property.',
    description: 'Income the locality receives from renting out or selling property it owns — such as building leases, land rents, and proceeds from surplus property sales.',
    tags: ['rent', 'property sales', 'money and property'],
    confidence: 'high',
  },

  // ─────────────── REVENUE — virginia general fund revenue|subsource (depth-1) ───────────────
  'virginia general fund revenue|individual income tax': {
    plain_name: 'State Individual Income Tax',
    short_description: 'The Commonwealth\'s tax on individual income.',
    description: 'The Commonwealth of Virginia\'s tax on the income of individuals — the largest single source of the state General Fund.',
    tags: ['virginia', 'income tax', 'state revenue', 'taxes'],
    confidence: 'high',
  },
  'virginia general fund revenue|sales and use tax': {
    plain_name: 'State Sales Tax',
    short_description: 'The statewide portion of the sales and use tax.',
    description: 'The statewide portion of the sales and use tax on retail purchases that flows to the Commonwealth of Virginia\'s General Fund. A major source of state revenue.',
    tags: ['virginia', 'sales tax', 'state revenue', 'taxes'],
    confidence: 'high',
  },
  'virginia general fund revenue|corporate income tax': {
    plain_name: 'State Corporate Income Tax',
    short_description: 'The Commonwealth\'s tax on corporate net income.',
    description: 'The Commonwealth of Virginia\'s tax on the net income of corporations doing business in the state. A smaller and more variable source of state General Fund revenue.',
    tags: ['virginia', 'corporate income tax', 'state revenue', 'taxes'],
    confidence: 'high',
  },
  'virginia general fund revenue|other taxes and fees': {
    plain_name: 'Other State Taxes & Fees',
    short_description: 'State General Fund revenue from other taxes and fees.',
    description: 'Commonwealth of Virginia General Fund revenue from taxes and fees other than the individual, sales, and corporate taxes — such as insurance premium taxes, recordation taxes, and miscellaneous levies.',
    tags: ['virginia', 'state revenue', 'taxes', 'fees'],
    confidence: 'medium',
  },
};

// Canonical 73-key list — single source of truth for the coverage gate + tests.
export const EXPECTED_KEYS = Object.keys(VA_ENRICHMENT);
