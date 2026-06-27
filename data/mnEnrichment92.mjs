// Phase 92 — Minnesota Enrichment Parity (inline-authored, $0; NO paid API path).
//
// Strategy (D-02): MN category trees are 3-LEVEL-WHERE-NATURAL, covering depth 0/1/2.
// There are 136 distinct composite live keys (25 depth-0 + 72 depth-1 + 39 depth-2).
// The separator is `|`; the CONCEPTS map is keyed by the NORMALIZED LAST SEGMENT of
// each composite key (everything after the final `|`, lowercased). The loader
// (scripts/loadMNEnrichment92.mjs) expands this map to one universal row per live
// composite key (name_key = the full composite). The coverage gate runs over all
// 136 live keys (each must resolve its last segment to a CONCEPT — abort on any miss).
//
// Voice (D-03): concept-level, "local government" perspective. State- and entity-neutral:
// no locality names, no $ figures, no MN-specific facts. Prefer "local governments" /
// "the local government" over "the city" / "Minnesota". Catch-all / unallocated entries
// are honest — not invented specifics.
//
// The `current` and `capital` concepts recur at every function's deepest level — they
// get generic operating-vs-investment descriptions reused across all function parents.

export const SOURCE = 'ai';

// ~90 last-segment concepts covering every leaf in the 136-key MN live vocabulary.
// Each entry: { plain_name, short_description, description, tags:[...], confidence }
export const CONCEPTS = {

  // ──────────────────────────────────────────────────────────────────────────────────
  // GENERIC CURRENT / CAPITAL leaves (reused at every function's deepest split)
  // ──────────────────────────────────────────────────────────────────────────────────

  'current': {
    plain_name: 'Current Expenditures',
    short_description: 'Day-to-day operating spending on salaries, supplies, and routine services.',
    description: 'Day-to-day operating expenditures for the function — including personnel wages and benefits, supplies, contracts, and other recurring costs needed to deliver the service each year. Distinct from capital outlay, which acquires or improves long-lived assets.',
    tags: ['current expenditures', 'operating', 'personnel', 'services'],
    confidence: 'high',
  },

  'capital': {
    plain_name: 'Capital Outlay',
    short_description: 'Spending on equipment, construction, and long-lived assets for the function.',
    description: 'Capital outlay for the function — spending on acquiring, constructing, or significantly improving long-lived assets such as buildings, vehicles, equipment, and infrastructure. Capital spending creates assets used over multiple years, as distinct from recurring operating expenses.',
    tags: ['capital outlay', 'equipment', 'construction', 'infrastructure'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // DEPTH-0: Top-level revenue groups
  // ──────────────────────────────────────────────────────────────────────────────────

  'taxes': {
    plain_name: 'Taxes',
    short_description: 'All local tax revenue — property, sales, franchise, and special taxes.',
    description: 'All tax revenue received by the local government — including property taxes, sales taxes, franchise and utility taxes, tax increment financing captures, hotel/motel taxes, gambling taxes, and other special levies. Taxes are the primary own-source revenue for most local governments.',
    tags: ['taxes', 'revenue', 'property tax', 'local tax'],
    confidence: 'high',
  },

  'special assessments': {
    plain_name: 'Special Assessments',
    short_description: 'Charges on specific properties that directly benefit from a local improvement.',
    description: 'Charges levied on property owners who receive a direct, special benefit from a public improvement — such as a street paving, sidewalk, sewer extension, or street lighting district — proportional to the benefit each property receives.',
    tags: ['special assessments', 'property', 'improvements', 'revenue'],
    confidence: 'high',
  },

  'licenses and permits': {
    plain_name: 'Licenses & Permits',
    short_description: 'Fees for regulatory licenses and building/development permits.',
    description: 'Revenue from licenses and permits the local government issues — building permits, business licenses, liquor licenses, and similar regulatory charges. Fees generally reflect the administrative cost of reviewing and approving applications.',
    tags: ['licenses', 'permits', 'fees', 'revenue'],
    confidence: 'high',
  },

  'intergovernmental': {
    plain_name: 'Intergovernmental Revenue',
    short_description: 'Grants and aid from federal, state, and other local governments.',
    description: 'Revenue received from federal, state, and other local governments — including formula-based grants, categorical program grants, and aid distributions. Intergovernmental revenue is often the second-largest revenue source for local governments and may fund both operating programs and capital projects.',
    tags: ['intergovernmental', 'grants', 'state aid', 'federal aid', 'revenue'],
    confidence: 'high',
  },

  'charges for services': {
    plain_name: 'Charges for Services',
    short_description: 'Fees paid by users for specific local services.',
    description: 'Fees that residents, businesses, and other users pay for specific services — such as public safety contracts, facility admission charges, recreation program fees, utilities, inspection fees, and administrative charges. The user pays in proportion to the service received.',
    tags: ['charges for services', 'fees', 'user fees', 'revenue'],
    confidence: 'high',
  },

  'fines and forfeits': {
    plain_name: 'Fines & Forfeits',
    short_description: 'Court fines, penalties, and forfeitures.',
    description: 'Revenue from court fines, penalties, and forfeitures — for example traffic citations, parking fines, code-violation penalties, and administrative fines. A modest, variable revenue source that reflects enforcement and regulatory activity.',
    tags: ['fines', 'forfeits', 'penalties', 'revenue'],
    confidence: 'high',
  },

  'interest earnings': {
    plain_name: 'Interest Earnings',
    short_description: 'Interest earned on the local government\'s invested cash and deposits.',
    description: 'Interest the local government earns on its cash deposits, investments, and short-term securities. Varies with prevailing interest rates and the level of cash available for investment at a given time.',
    tags: ['interest', 'investment income', 'revenue'],
    confidence: 'high',
  },

  'all other revenue': {
    plain_name: 'All Other Revenue',
    short_description: 'A catch-all for miscellaneous revenue not classified elsewhere.',
    description: 'A catch-all for revenue that does not fit the other named categories — such as insurance recoveries, contributions, refunds, rents, and other minor or one-time inflows. Typically a small share of total revenue.',
    tags: ['other revenue', 'miscellaneous', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // TAXES depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'propertytaxes': {
    plain_name: 'Property Taxes',
    short_description: 'Taxes on the assessed value of real estate and property.',
    description: 'Taxes on the assessed value of property — real estate (land and buildings). Property taxes are typically the single largest source of own-source tax revenue for local governments, set by a levy that funds budgeted services.',
    tags: ['property tax', 'real estate', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'tax increments': {
    plain_name: 'Tax Increment Financing',
    short_description: 'Captured property tax growth from redevelopment districts.',
    description: 'Revenue captured from the incremental growth in property tax value within a designated redevelopment or tax increment financing (TIF) district. The increment is used to finance infrastructure and development improvements within that district rather than flowing to general operating accounts.',
    tags: ['tax increment', 'TIF', 'redevelopment', 'taxes'],
    confidence: 'high',
  },

  'franchisefees': {
    plain_name: 'Franchise Fees',
    short_description: 'Fees paid by utility companies for the right to use public rights-of-way.',
    description: 'Fees paid by utility and telecommunications providers — such as electric, gas, cable, and telephone companies — for the right to install infrastructure in public streets and rights-of-way. Negotiated through franchise agreements with the local government.',
    tags: ['franchise fees', 'utilities', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'salestax': {
    plain_name: 'Sales Tax',
    short_description: 'Local sales tax on retail purchases.',
    description: 'Revenue from a local sales tax levied on retail sales of goods and certain services. May be a locally approved rate or a local share of a broader tax collected and distributed back to local governments by the state.',
    tags: ['sales tax', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'hotelmoteltax': {
    plain_name: 'Hotel/Motel Tax',
    short_description: 'Tax on lodging stays at hotels and motels.',
    description: 'A tax on short-term lodging stays at hotels, motels, and similar hospitality facilities. Often used to fund tourism promotion, convention facilities, or other visitor-services activities.',
    tags: ['hotel motel tax', 'lodging tax', 'hospitality', 'taxes'],
    confidence: 'high',
  },

  'gamblingtax': {
    plain_name: 'Gambling Tax',
    short_description: 'Tax on lawful gambling activity.',
    description: 'Revenue from taxes on licensed lawful gambling activity — such as pull-tabs, bingo, and other permitted games of chance conducted by eligible organizations. A relatively minor and variable revenue source for local governments that permit such activity.',
    tags: ['gambling tax', 'lawful gambling', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'graveltax': {
    plain_name: 'Gravel Tax',
    short_description: 'Tax on gravel extraction within the jurisdiction.',
    description: 'Revenue from a tax on the extraction of gravel or other aggregate materials within the local government\'s jurisdiction. Applies primarily to jurisdictions with active aggregate mining operations.',
    tags: ['gravel tax', 'extraction', 'taxes', 'revenue'],
    confidence: 'high',
  },

  'wheelagetax': {
    plain_name: 'Wheelage Tax',
    short_description: 'Per-vehicle annual fee levied on registered motor vehicles.',
    description: 'An annual fee levied on motor vehicles registered in the jurisdiction, collected at vehicle registration. Revenue is typically dedicated to transportation and road-related purposes.',
    tags: ['wheelage tax', 'vehicle fee', 'transportation', 'taxes'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // INTERGOVERNMENTAL depth-1: grant sub-groups
  // ──────────────────────────────────────────────────────────────────────────────────

  'federal grants': {
    plain_name: 'Federal Grants',
    short_description: 'Grants received from the federal government.',
    description: 'Grants and aid received from federal government programs — including community development, education, transportation, human services, emergency management, and other federally funded categorical programs. Federal grants typically carry requirements on how the funds are used.',
    tags: ['federal grants', 'intergovernmental', 'grants', 'revenue'],
    confidence: 'high',
  },

  'state grants': {
    plain_name: 'State Grants',
    short_description: 'Grants, aid, and shared revenues received from the state.',
    description: 'Grants, formula-based aid, tax credits, and shared revenues received from state government programs — including general purpose aid, categorical program grants, tax base equalization programs, and other state transfers to local governments.',
    tags: ['state grants', 'state aid', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  'county/local grants': {
    plain_name: 'County & Local Grants',
    short_description: 'Grants and aid received from county and other local governments.',
    description: 'Grants and intergovernmental payments received from county governments, other municipalities, and special districts — including county highway grants, local economic development funds, and other cooperative arrangements among local governments.',
    tags: ['county grants', 'local grants', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // FEDERAL GRANTS depth-2 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'federal cdbg grants': {
    plain_name: 'Federal CDBG Grants',
    short_description: 'Community Development Block Grant funding from the federal government.',
    description: 'Community Development Block Grant (CDBG) funding received from the federal government. CDBG grants support a range of community development activities — including housing rehabilitation, public facilities, infrastructure, and services for low- and moderate-income residents.',
    tags: ['CDBG', 'community development', 'federal grants', 'housing'],
    confidence: 'high',
  },

  'federal education grants': {
    plain_name: 'Federal Education Grants',
    short_description: 'Federal grants for education programs.',
    description: 'Federal grants supporting education-related programs administered or funded by the local government — such as school readiness, early childhood programs, and other federally funded education assistance.',
    tags: ['federal grants', 'education', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  'federal transportation grants': {
    plain_name: 'Federal Transportation Grants',
    short_description: 'Federal grants for transportation and road programs.',
    description: 'Federal grants for transportation infrastructure and programs — including road construction, bridge repair, transit projects, and other federally funded transportation assistance.',
    tags: ['federal grants', 'transportation', 'infrastructure', 'revenue'],
    confidence: 'high',
  },

  'federal human services grants': {
    plain_name: 'Federal Human Services Grants',
    short_description: 'Federal grants for social services and human services programs.',
    description: 'Federal grants for social and human services programs — including income assistance, child welfare, elderly services, disability programs, and other federally funded human services.',
    tags: ['federal grants', 'human services', 'social services', 'revenue'],
    confidence: 'high',
  },

  'federal emergency management aid': {
    plain_name: 'Federal Emergency Management Aid',
    short_description: 'Federal aid for emergency management and disaster response.',
    description: 'Federal aid for emergency management activities — including disaster preparedness, hazard mitigation, response, and recovery. Typically administered through federal emergency management programs and activated in response to declared emergencies.',
    tags: ['federal grants', 'emergency management', 'disaster', 'revenue'],
    confidence: 'high',
  },

  'fedcoronavirusrelieffunds': {
    plain_name: 'Federal Coronavirus Relief Funds',
    short_description: 'Federal pandemic relief funding.',
    description: 'Federal funds received through pandemic-era relief programs to help local governments address the economic and public health effects of the COVID-19 pandemic. These funds supported a range of eligible expenditures including public health response, revenue loss replacement, and infrastructure.',
    tags: ['federal grants', 'coronavirus', 'pandemic relief', 'revenue'],
    confidence: 'high',
  },

  'all other federal grants': {
    plain_name: 'All Other Federal Grants',
    short_description: 'Miscellaneous federal grants not classified under another program.',
    description: 'Federal grants and aid that do not fall under the other named federal grant categories. A catch-all for smaller or one-time federal program awards.',
    tags: ['federal grants', 'other grants', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // STATE GRANTS depth-2 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'state local government aid': {
    plain_name: 'State Local Government Aid',
    short_description: 'Unrestricted state aid distributed to local governments based on need and tax capacity.',
    description: 'Unrestricted state aid distributed to local governments — a formula-based program that offsets disparities in local tax base and service needs, allowing local governments to provide adequate services without placing excessive burdens on local property taxpayers. Funds flow into the general fund with no categorical restrictions.',
    tags: ['state aid', 'LGA', 'state grants', 'intergovernmental'],
    confidence: 'high',
  },

  'state market value credit real': {
    plain_name: 'State Market Value Credit — Real Property',
    short_description: 'State credit program reducing property tax burden on homesteads and other real property.',
    description: 'A state program that reimburses local governments for credits applied to reduce the property tax burden on residential homesteads and other real property. The state provides the credit to the local government in lieu of the homeowner paying the full levy.',
    tags: ['state grants', 'market value credit', 'property tax', 'homestead'],
    confidence: 'high',
  },

  'state market value credit ag': {
    plain_name: 'State Market Value Credit — Agricultural',
    short_description: 'State credit reducing property tax burden on agricultural land.',
    description: 'A state program that reimburses local governments for credits applied to reduce the property tax burden on agricultural land. Similar to the homestead market value credit but specifically for qualifying agricultural property.',
    tags: ['state grants', 'market value credit', 'agricultural', 'property tax'],
    confidence: 'high',
  },

  'state taconite homestead credit': {
    plain_name: 'State Taconite Homestead Credit',
    short_description: 'State credit reducing property taxes in iron-range jurisdictions.',
    description: 'A state credit program that reduces property taxes for homestead property owners in jurisdictions affected by taconite production. Provided to eligible local governments in lieu of the full property tax payment by qualifying homeowners.',
    tags: ['state grants', 'taconite', 'homestead credit', 'property tax'],
    confidence: 'high',
  },

  'statetownaid': {
    plain_name: 'State Town Aid',
    short_description: 'State aid distributed to townships.',
    description: 'State aid distributed to township governments to support basic local services. A formula-based program providing general fiscal support to townships.',
    tags: ['state grants', 'town aid', 'township', 'intergovernmental'],
    confidence: 'high',
  },

  'state taconite aids': {
    plain_name: 'State Taconite Aids',
    short_description: 'State aid to jurisdictions with taconite production impacts.',
    description: 'State aid distributed to local governments in areas with significant taconite mining and production activity. Provides fiscal support to compensate for the costs and impacts associated with heavy industrial activity.',
    tags: ['state grants', 'taconite', 'industrial aid', 'intergovernmental'],
    confidence: 'high',
  },

  'state county program aid': {
    plain_name: 'State County Program Aid',
    short_description: 'State aid to county governments for program costs.',
    description: 'State aid distributed to county governments to support the cost of delivering state-mandated and locally elected programs. Helps counties fund social services and other programs where state and local responsibilities overlap.',
    tags: ['state grants', 'county program aid', 'CPA', 'intergovernmental'],
    confidence: 'high',
  },

  'state manufactured home homestead credit': {
    plain_name: 'State Manufactured Home Homestead Credit',
    short_description: 'State credit reducing property taxes on manufactured homes.',
    description: 'A state credit program that reduces the property tax burden on qualifying manufactured home homesteads. The state reimburses local governments for credits applied to eligible manufactured home owners\' tax bills.',
    tags: ['state grants', 'manufactured home', 'homestead credit', 'property tax'],
    confidence: 'high',
  },

  'state attached machinery aid': {
    plain_name: 'State Attached Machinery Aid',
    short_description: 'State aid compensating for agricultural machinery property tax exemptions.',
    description: 'State aid to local governments to compensate for the property tax exemption on attached agricultural machinery. Helps offset the lost levy capacity when qualifying farm equipment is excluded from taxable value.',
    tags: ['state grants', 'agricultural machinery', 'property tax', 'intergovernmental'],
    confidence: 'high',
  },

  'state disparity reduction aid': {
    plain_name: 'State Disparity Reduction Aid',
    short_description: 'State aid reducing tax rate disparities across local jurisdictions.',
    description: 'State aid targeted at reducing disparities in effective tax rates across local jurisdictions — helps lower-tax-capacity governments provide services without imposing disproportionately high property tax rates on their residents.',
    tags: ['state grants', 'disparity reduction', 'equalization', 'intergovernmental'],
    confidence: 'high',
  },

  'state transportation grants': {
    plain_name: 'State Transportation Grants',
    short_description: 'State grants for roads, highways, and transportation programs.',
    description: 'State grants and aid for transportation infrastructure — including road construction and maintenance, bridge programs, and other transportation assistance distributed to local governments.',
    tags: ['state grants', 'transportation', 'roads', 'infrastructure'],
    confidence: 'high',
  },

  'state human service grants': {
    plain_name: 'State Human Service Grants',
    short_description: 'State grants for human and social service programs.',
    description: 'State grants and reimbursements to local governments for delivering human and social services — including income support, child protection, elderly services, and other state-mandated or state-funded programs administered locally.',
    tags: ['state grants', 'human services', 'social services', 'intergovernmental'],
    confidence: 'high',
  },

  'state criminal justice aid': {
    plain_name: 'State Criminal Justice Aid',
    short_description: 'State aid for law enforcement and criminal justice.',
    description: 'State aid distributed to local governments for law enforcement and criminal justice activities — helping fund police services, court programs, and corrections-related costs.',
    tags: ['state grants', 'criminal justice', 'law enforcement', 'intergovernmental'],
    confidence: 'high',
  },

  'state pera aid': {
    plain_name: 'State PERA Aid',
    short_description: 'State aid to offset local pension system contribution costs.',
    description: 'State aid distributed to local governments to help offset their required contributions to the public employee retirement system. Reduces the direct burden on local budgets from pension obligations.',
    tags: ['state grants', 'PERA', 'pensions', 'intergovernmental'],
    confidence: 'high',
  },

  'state highway grants': {
    plain_name: 'State Highway Grants',
    short_description: 'State grants for highway construction and maintenance.',
    description: 'State grants to local governments for highway and road construction, maintenance, and improvement programs. May include formula-based distributions and competitive project grants.',
    tags: ['state grants', 'highways', 'transportation', 'roads'],
    confidence: 'high',
  },

  'state education grants': {
    plain_name: 'State Education Grants',
    short_description: 'State grants for education programs administered by local government.',
    description: 'State grants for education-related programs administered by local governments — such as early childhood programs, community education, and other education initiatives funded at the state level and delivered locally.',
    tags: ['state grants', 'education', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  'state police aid': {
    plain_name: 'State Police Aid',
    short_description: 'State aid to local governments for police services.',
    description: 'State aid distributed to local governments to help fund local police and law enforcement services. Provides general fiscal support for public safety operations.',
    tags: ['state grants', 'police aid', 'law enforcement', 'intergovernmental'],
    confidence: 'high',
  },

  'statelpa': {
    plain_name: 'State LPA Aid',
    short_description: 'State Local Performance Aid distributed to local governments.',
    description: 'State Local Performance Aid distributed to local governments as a fiscal support program. Provides general-purpose support to eligible jurisdictions.',
    tags: ['state grants', 'LPA', 'state aid', 'intergovernmental'],
    confidence: 'medium',
  },

  'statehaca': {
    plain_name: 'State HACA Aid',
    short_description: 'State Homestead Agricultural Credit Aid.',
    description: 'State Homestead Agricultural Credit Aid (HACA) — a state reimbursement program that compensated local governments for credits applied to reduce property taxes on homestead and agricultural property. A legacy program that was part of the broader state property tax aid and credit system.',
    tags: ['state grants', 'HACA', 'homestead', 'property tax'],
    confidence: 'medium',
  },

  'all other state grants': {
    plain_name: 'All Other State Grants',
    short_description: 'Miscellaneous state grants and aid not classified elsewhere.',
    description: 'State grants, aids, and reimbursements that do not fall under the other named state grant categories. A catch-all for smaller or one-time state program awards.',
    tags: ['state grants', 'other grants', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // COUNTY/LOCAL GRANTS depth-2 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'county highway grants': {
    plain_name: 'County Highway Grants',
    short_description: 'Grants from the county for highway and road programs.',
    description: 'Grants and pass-through funds received from county governments for road and highway construction, maintenance, and improvement programs. Reflects intergovernmental cooperation on shared transportation infrastructure.',
    tags: ['county grants', 'highways', 'transportation', 'intergovernmental'],
    confidence: 'high',
  },

  'all other county grants': {
    plain_name: 'All Other County Grants',
    short_description: 'Miscellaneous grants from the county not classified elsewhere.',
    description: 'Grants and intergovernmental payments received from county governments that do not fall under the highway grant category. A catch-all for miscellaneous county-to-local transfers.',
    tags: ['county grants', 'other grants', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  'local irrrb grants': {
    plain_name: 'Local IRRRB Grants',
    short_description: 'Grants from the Iron Range Resources & Rehabilitation Board.',
    description: 'Grants received from the Iron Range Resources and Rehabilitation Board (IRRRB), a state agency that promotes economic development and community improvement in northeastern iron-range communities. Funds may support infrastructure, community facilities, or economic development projects.',
    tags: ['IRRRB', 'iron range', 'local grants', 'economic development'],
    confidence: 'high',
  },

  'all other local grants': {
    plain_name: 'All Other Local Grants',
    short_description: 'Miscellaneous grants from other local governments.',
    description: 'Grants and intergovernmental payments received from other local governments and special districts that do not fall under another named category. Reflects cooperative arrangements among neighboring jurisdictions.',
    tags: ['local grants', 'other grants', 'intergovernmental', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // CHARGES FOR SERVICES depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'general government fees': {
    plain_name: 'General Government Fees',
    short_description: 'Fees charged for general administrative services.',
    description: 'Fees collected for general government administrative services — such as document copies, record searches, application processing, certification fees, and other charges for routine government services.',
    tags: ['general government fees', 'service charges', 'fees', 'revenue'],
    confidence: 'high',
  },

  'police and fire contracts': {
    plain_name: 'Police & Fire Contracts',
    short_description: 'Contract revenue for providing police or fire services to other jurisdictions.',
    description: 'Revenue from contracts under which the local government provides police or fire protection services to neighboring jurisdictions, townships, or other entities. Reflects shared-service or joint-powers arrangements for public safety delivery.',
    tags: ['police contracts', 'fire contracts', 'service charges', 'public safety'],
    confidence: 'high',
  },

  'other public safety fees': {
    plain_name: 'Other Public Safety Fees',
    short_description: 'Fees charged for public safety services other than police and fire contracts.',
    description: 'Charges for public safety services not covered under police/fire contracts — such as alarm permit fees, inspection fees, special event security charges, and other public safety-related service charges.',
    tags: ['public safety fees', 'service charges', 'fees', 'revenue'],
    confidence: 'high',
  },

  'street and highway fees': {
    plain_name: 'Street & Highway Fees',
    short_description: 'Fees charged for street and highway services.',
    description: 'Charges for street and highway-related services — such as street lighting assessments, right-of-way permits, and other fees associated with road and transportation services provided by the local government.',
    tags: ['street fees', 'highway fees', 'service charges', 'revenue'],
    confidence: 'high',
  },

  'sanitation fees': {
    plain_name: 'Sanitation Fees',
    short_description: 'Fees charged for refuse collection, recycling, and sanitation services.',
    description: 'Charges collected from residents and businesses for refuse collection, recycling, and other sanitation services. These fees recover the operating cost of waste management programs delivered by the local government.',
    tags: ['sanitation fees', 'refuse', 'recycling', 'service charges'],
    confidence: 'high',
  },

  'library fees': {
    plain_name: 'Library Fees',
    short_description: 'Fees collected for library services and materials.',
    description: 'Charges collected for library services — such as overdue fines, printing charges, meeting room rentals, and other library-related fees. Typically a small offset to the cost of providing public library services.',
    tags: ['library fees', 'service charges', 'fees', 'revenue'],
    confidence: 'high',
  },

  'park and recreation fees': {
    plain_name: 'Park & Recreation Fees',
    short_description: 'Fees for park programs, facilities, and recreation services.',
    description: 'Charges collected from participants in park and recreation programs — including facility rentals, athletic league fees, program registration, admission fees, and other charges for parks and recreation services.',
    tags: ['park fees', 'recreation fees', 'service charges', 'revenue'],
    confidence: 'high',
  },

  'airport fees': {
    plain_name: 'Airport Fees',
    short_description: 'Fees and charges for airport services and facilities.',
    description: 'Revenue from fees charged at locally operated airports — including landing fees, hangar rental, fuel surcharges, terminal fees, and other airport-related service charges. Applies to local governments that operate general aviation or regional airport facilities.',
    tags: ['airport fees', 'aviation', 'service charges', 'revenue'],
    confidence: 'high',
  },

  'transit fees': {
    plain_name: 'Transit Fees',
    short_description: 'Fares and fees for local transit services.',
    description: 'Revenue from fares, passes, and other charges for locally operated transit services — such as bus routes, dial-a-ride, or other passenger transportation programs. Transit fees offset a portion of the full cost of delivering transit service.',
    tags: ['transit fees', 'fares', 'transportation', 'service charges'],
    confidence: 'high',
  },

  'cemetery fees': {
    plain_name: 'Cemetery Fees',
    short_description: 'Fees for burial and cemetery services.',
    description: 'Charges for burial lots, interment services, grave markers, and other cemetery-related services operated by the local government. Recovers a portion of the cost of maintaining and operating a public cemetery.',
    tags: ['cemetery fees', 'burial', 'service charges', 'revenue'],
    confidence: 'high',
  },

  'tnwatercharge': {
    plain_name: 'Township Water Charges',
    short_description: 'Service charges for township water supply operations.',
    description: 'Charges collected by township governments for water supply or utility services. A service charge to recover costs of operating water-related services where applicable.',
    tags: ['water charges', 'township', 'utility', 'service charges'],
    confidence: 'medium',
  },

  'edahrasvccharge': {
    plain_name: 'EDA/HRA Service Charges',
    short_description: 'Service charges from economic development and housing authority activities.',
    description: 'Charges and fees associated with economic development authority (EDA) and housing and redevelopment authority (HRA) activities — such as loan administration fees, development fees, and other charges for economic and housing development services.',
    tags: ['EDA', 'HRA', 'service charges', 'economic development'],
    confidence: 'high',
  },

  'all other service charges': {
    plain_name: 'All Other Service Charges',
    short_description: 'Miscellaneous service fees not classified elsewhere.',
    description: 'A catch-all for service charges and fees that do not fall under the other named service charge categories. Covers miscellaneous charges for local government services.',
    tags: ['other service charges', 'miscellaneous', 'fees', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // FINES AND FORFEITS depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'adminfines': {
    plain_name: 'Administrative Fines',
    short_description: 'Fines assessed administratively for code and ordinance violations.',
    description: 'Fines levied through administrative processes for violations of local codes and ordinances — such as property maintenance violations, nuisance abatements, and other regulatory infractions handled outside of the court system.',
    tags: ['administrative fines', 'code enforcement', 'fines', 'revenue'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // DEPTH-0: Top-level expenditure functions
  // ──────────────────────────────────────────────────────────────────────────────────

  'general government': {
    plain_name: 'General Government',
    short_description: 'Central administration — governing body, finance, and support services.',
    description: 'The central administration and support functions of the local government — the elected governing board, the administrator or manager, finance and accounting, legal counsel, records management, information technology, and other shared support services. Typically one of the foundational cost centers of local government.',
    tags: ['general government', 'administration', 'finance', 'governing body'],
    confidence: 'high',
  },

  'public safety': {
    plain_name: 'Public Safety',
    short_description: 'Services that protect lives and property — police, fire, and emergency services.',
    description: 'The full range of services that protect the safety of residents and their property — law enforcement, fire suppression, emergency medical services, corrections, and other protective services. Public safety is often the largest or second-largest expenditure function for local governments.',
    tags: ['public safety', 'police', 'fire', 'emergency'],
    confidence: 'high',
  },

  'streets & highways': {
    plain_name: 'Streets & Highways',
    short_description: 'Road and street maintenance, construction, and transportation infrastructure.',
    description: 'Spending on the local road and street network — including routine maintenance, snow and ice removal, street lighting, engineering, construction, and capital improvements. Keeps the local transportation infrastructure safe and functional for residents and businesses.',
    tags: ['streets', 'highways', 'roads', 'transportation'],
    confidence: 'high',
  },

  'sanitation': {
    plain_name: 'Sanitation',
    short_description: 'Refuse collection, recycling, and waste management services.',
    description: 'Spending on refuse collection, recycling, and other sanitation services provided by the local government. Includes both the day-to-day operating costs and capital investments for waste management infrastructure.',
    tags: ['sanitation', 'refuse', 'recycling', 'waste management'],
    confidence: 'high',
  },

  'human services': {
    plain_name: 'Human Services',
    short_description: 'Social services, income support, and assistance for residents in need.',
    description: 'Programs and services that support residents in need — including income assistance, child and family services, elderly and disability programs, social work, and other human services. Often delivered under intergovernmental arrangements with state-funded programs administered locally.',
    tags: ['human services', 'social services', 'income maintenance', 'welfare'],
    confidence: 'high',
  },

  'health': {
    plain_name: 'Health',
    short_description: 'Public health programs, disease prevention, and health services.',
    description: 'Public health programs funded by the local government — including disease prevention, environmental health, health inspections, clinics, and health promotion. Often delivered in partnership with state health agencies and supported by a mix of local, state, and federal funding.',
    tags: ['health', 'public health', 'disease prevention', 'health services'],
    confidence: 'high',
  },

  'library': {
    plain_name: 'Library',
    short_description: 'Public library operations, collections, and facilities.',
    description: 'Spending on the operation of public library services — including staffing, collections, programming, building operations, and capital improvements. Libraries provide free public access to information, educational resources, and community meeting space.',
    tags: ['library', 'public library', 'education', 'community'],
    confidence: 'high',
  },

  'park & recreation': {
    plain_name: 'Parks & Recreation',
    short_description: 'Parks, open space, recreation facilities, and programming.',
    description: 'Programs and facilities for parks, trails, open space, athletic facilities, recreation centers, and community programs. Provides recreational opportunities for residents and supports community health and quality of life.',
    tags: ['parks', 'recreation', 'open space', 'community'],
    confidence: 'high',
  },

  'housing & urban redevelopment': {
    plain_name: 'Housing & Urban Redevelopment',
    short_description: 'Housing programs, redevelopment, and urban renewal activities.',
    description: 'Spending on affordable housing programs, urban redevelopment, and community renewal activities — including housing rehabilitation, blight removal, economic development projects, and programs administered through economic development or housing authorities.',
    tags: ['housing', 'redevelopment', 'urban renewal', 'community development'],
    confidence: 'high',
  },

  'economic development': {
    plain_name: 'Economic Development',
    short_description: 'Programs that support business attraction, retention, and economic vitality.',
    description: 'Spending on programs that attract businesses, retain employers, and support the economic vitality of the community — including business development assistance, tax increment financing administration, enterprise zones, and other economic development activities.',
    tags: ['economic development', 'business', 'community development', 'growth'],
    confidence: 'high',
  },

  'conservation of natural resources': {
    plain_name: 'Conservation of Natural Resources',
    short_description: 'Programs protecting natural resources, environmental quality, and open lands.',
    description: 'Spending on conservation and protection of natural resources — including environmental monitoring, wetland protection, natural area management, and other programs that protect the natural environment within and around the community.',
    tags: ['conservation', 'natural resources', 'environment', 'open lands'],
    confidence: 'high',
  },

  'airport': {
    plain_name: 'Airport',
    short_description: 'Operations and capital investment at a locally owned airport.',
    description: 'Spending on the operation and improvement of a locally owned or operated airport facility. Includes day-to-day operations (staffing, utilities, maintenance) and capital improvements to runways, hangars, and terminal facilities.',
    tags: ['airport', 'aviation', 'transportation', 'infrastructure'],
    confidence: 'high',
  },

  'transit': {
    plain_name: 'Transit',
    short_description: 'Local transit services — buses, dial-a-ride, and passenger transportation.',
    description: 'Spending on locally operated passenger transit services — including fixed-route bus service, demand-responsive transit, and other transportation options for residents. Transit services often receive operating subsidies from local, state, and federal sources.',
    tags: ['transit', 'bus', 'transportation', 'passenger services'],
    confidence: 'high',
  },

  'cemetery': {
    plain_name: 'Cemetery',
    short_description: 'Operations and maintenance of a publicly owned cemetery.',
    description: 'Spending on the operation and maintenance of a publicly owned cemetery — including grounds maintenance, interment services, records management, and capital improvements. Public cemeteries provide a community service for residents.',
    tags: ['cemetery', 'burial', 'grounds maintenance', 'community services'],
    confidence: 'high',
  },

  'education': {
    plain_name: 'Education',
    short_description: 'Local government contributions to education programs.',
    description: 'Local government spending on education programs and services — including contributions to community education, early childhood programs, and other education initiatives operated or funded at the local level.',
    tags: ['education', 'community education', 'early childhood', 'learning'],
    confidence: 'high',
  },

  'other & unallocated': {
    plain_name: 'Other & Unallocated',
    short_description: 'Spending not assigned to another function — including pension, insurance, and miscellaneous.',
    description: 'Spending that does not fit a specific service function — including unallocated pension and insurance costs, all other current expenditures not otherwise classified, all other capital outlay, and enterprise fund capital. A catch-all that reflects costs shared across the organization or not attributable to a single program.',
    tags: ['other', 'unallocated', 'pension', 'insurance', 'miscellaneous'],
    confidence: 'high',
  },

  'debt service': {
    plain_name: 'Debt Service',
    short_description: 'Payments on principal and interest for outstanding bonds and long-term debt.',
    description: 'Payments required to service the local government\'s outstanding debt — principal repayments on bonds and other long-term borrowings, interest costs, and related fiscal charges. Debt service is a fixed, mandatory obligation that reflects prior capital investment decisions.',
    tags: ['debt service', 'bonds', 'principal', 'interest', 'finance'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // GENERAL GOVERNMENT depth-2 leaves (under general government|current)
  // ──────────────────────────────────────────────────────────────────────────────────

  'governing board current expend': {
    plain_name: 'Governing Board',
    short_description: 'Operating costs of the elected governing board.',
    description: 'Day-to-day operating costs for the elected governing board — including compensation (if any), administrative support, meeting costs, and related expenses for the policy-making body of the local government.',
    tags: ['governing board', 'elected officials', 'general government', 'administration'],
    confidence: 'high',
  },

  'administration and finance current expend': {
    plain_name: 'Administration & Finance',
    short_description: 'Central administration, finance, and support services.',
    description: 'Operating costs for central administrative and financial functions — including the administrator/manager office, finance and accounting, human resources, information technology, and other shared organizational support services.',
    tags: ['administration', 'finance', 'general government', 'support services'],
    confidence: 'high',
  },

  'all other general government current expend': {
    plain_name: 'All Other General Government',
    short_description: 'General government operating costs not in governing board or administration.',
    description: 'A catch-all for general government operating costs that are not classified under the governing board or administration-and-finance sub-functions — such as legal services, assessor operations, elections, and other general government activities.',
    tags: ['general government', 'other', 'administration', 'operating'],
    confidence: 'high',
  },

  'general government capital outlay': {
    plain_name: 'General Government Capital Outlay',
    short_description: 'Capital spending on general government facilities and equipment.',
    description: 'Capital outlay for general government — spending on facilities, vehicles, technology infrastructure, and equipment used to support central administration and government operations.',
    tags: ['general government', 'capital outlay', 'equipment', 'facilities'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // PUBLIC SAFETY depth-1 sub-functions
  // ──────────────────────────────────────────────────────────────────────────────────

  'police/sheriff': {
    plain_name: 'Police / Sheriff',
    short_description: 'Law enforcement — patrol, investigations, and traffic enforcement.',
    description: 'Law enforcement services provided by the local police department or sheriff — patrol, criminal investigation, traffic enforcement, community policing, and related law enforcement support. Typically the largest component of local public safety spending.',
    tags: ['police', 'sheriff', 'law enforcement', 'public safety'],
    confidence: 'high',
  },

  'corrections': {
    plain_name: 'Corrections',
    short_description: 'Detention, incarceration, and corrections services.',
    description: 'Spending on correctional facilities and services operated by the local government — including detention centers, jails, and related corrections programs. Primarily a county function; may be minimal or absent for city governments.',
    tags: ['corrections', 'jail', 'detention', 'public safety'],
    confidence: 'high',
  },

  'ambulance': {
    plain_name: 'Ambulance Services',
    short_description: 'Emergency medical services and ambulance operations.',
    description: 'Emergency medical services (EMS) and ambulance operations provided by the local government — including emergency response, paramedic services, and patient transport. May be operated jointly with fire services or as a standalone program.',
    tags: ['ambulance', 'EMS', 'emergency medical', 'public safety'],
    confidence: 'high',
  },

  'fire': {
    plain_name: 'Fire Protection',
    short_description: 'Fire suppression, fire prevention, and emergency response.',
    description: 'Fire suppression, fire prevention, fire inspection, and emergency response services — staffed by career firefighters, volunteer companies, or a combination. Protects lives and property from fire and related hazards.',
    tags: ['fire', 'fire protection', 'emergency response', 'public safety'],
    confidence: 'high',
  },

  'all other public safety': {
    plain_name: 'All Other Public Safety',
    short_description: 'Public safety services not classified under police, fire, ambulance, or corrections.',
    description: 'Public safety spending that does not fall under police/sheriff, fire, ambulance, or corrections — such as emergency management, building inspection, animal control, civil defense, and other protective services.',
    tags: ['other public safety', 'emergency management', 'building inspection', 'public safety'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // STREETS & HIGHWAYS depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'street & highway administration': {
    plain_name: 'Street & Highway Administration',
    short_description: 'Administrative costs for managing the streets and highways program.',
    description: 'Administrative and overhead costs for the streets and highways program — including supervision, engineering support, and program management costs that support the overall street maintenance and construction operation.',
    tags: ['streets', 'highway administration', 'roads', 'transportation'],
    confidence: 'high',
  },

  'street & highway maintenance': {
    plain_name: 'Street & Highway Maintenance',
    short_description: 'Routine maintenance of roads, streets, and related infrastructure.',
    description: 'Routine maintenance of roads, streets, and related transportation infrastructure — including pothole repairs, crack sealing, drainage maintenance, guardrail upkeep, sign replacement, and other day-to-day upkeep to keep the road network safe and functional.',
    tags: ['street maintenance', 'roads', 'pavement', 'transportation'],
    confidence: 'high',
  },

  'snow and ice removal': {
    plain_name: 'Snow & Ice Removal',
    short_description: 'Plowing, salting, and clearing streets during winter conditions.',
    description: 'Operations to plow, salt, and clear streets, sidewalks, and public areas during winter weather. A critical local service in cold-weather climates — costs vary significantly with snowfall levels and storm frequency.',
    tags: ['snow removal', 'ice removal', 'winter maintenance', 'streets'],
    confidence: 'high',
  },

  'street & highway engineering': {
    plain_name: 'Street & Highway Engineering',
    short_description: 'Engineering and design services for road projects.',
    description: 'Engineering, design, and technical services for street and highway projects — including traffic studies, project design, construction oversight, and related technical work for road and infrastructure improvements.',
    tags: ['engineering', 'streets', 'roads', 'transportation'],
    confidence: 'high',
  },

  'street lighting': {
    plain_name: 'Street Lighting',
    short_description: 'Operation and maintenance of public street lighting.',
    description: 'Operating and maintenance costs for public street lighting — including electricity, lamp replacement, pole maintenance, and related expenses for lighting the public road network. Supports traffic safety and community security.',
    tags: ['street lighting', 'streets', 'electricity', 'transportation'],
    confidence: 'high',
  },

  'street & highway construction': {
    plain_name: 'Street & Highway Construction',
    short_description: 'Capital construction of new roads and major street improvements.',
    description: 'Capital spending on constructing new roads, major road reconstruction, and significant improvements to the street and highway network. These projects are typically funded in part by state and federal transportation grants.',
    tags: ['street construction', 'roads', 'capital', 'infrastructure'],
    confidence: 'high',
  },

  'all other street & highway capital outlay': {
    plain_name: 'All Other Street & Highway Capital',
    short_description: 'Other capital spending on streets and highways not classified elsewhere.',
    description: 'Capital outlay for streets and highway infrastructure that does not fall under the street construction category — such as bridge improvements, traffic signal upgrades, sidewalk extensions, and other miscellaneous transportation capital projects.',
    tags: ['streets capital', 'other capital', 'roads', 'infrastructure'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // SANITATION depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'refuse collection and disposal current expend': {
    plain_name: 'Refuse Collection & Disposal',
    short_description: 'Operating costs for refuse collection and waste disposal.',
    description: 'Day-to-day operating costs for refuse collection, recycling pickup, and waste disposal services — including personnel, vehicles, containers, and disposal contracts. The primary component of local sanitation spending.',
    tags: ['refuse collection', 'waste disposal', 'sanitation', 'recycling'],
    confidence: 'high',
  },

  'all other sanitation current expend': {
    plain_name: 'All Other Sanitation',
    short_description: 'Sanitation operating costs not classified under refuse collection.',
    description: 'A catch-all for sanitation operating costs not covered under refuse collection and disposal — such as hazardous waste programs, street cleaning, and other sanitation-related activities.',
    tags: ['sanitation', 'other sanitation', 'waste management', 'operating'],
    confidence: 'high',
  },

  'sanitation capital outlay': {
    plain_name: 'Sanitation Capital Outlay',
    short_description: 'Capital spending on sanitation infrastructure and equipment.',
    description: 'Capital spending for sanitation programs — including waste-handling equipment, vehicles, transfer station improvements, and other long-lived assets for the solid waste and sanitation function.',
    tags: ['sanitation capital', 'equipment', 'capital outlay', 'waste management'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // HUMAN SERVICES depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'human service income maintenance': {
    plain_name: 'Human Services — Income Maintenance',
    short_description: 'Benefit assistance and income support programs.',
    description: 'Income maintenance and benefit assistance programs — providing financial support to residents who qualify for assistance with basic living costs. These programs are typically state-mandated and administered locally, with a mix of state and federal funding.',
    tags: ['income maintenance', 'human services', 'benefits', 'social services'],
    confidence: 'high',
  },

  'human services social services': {
    plain_name: 'Human Services — Social Services',
    short_description: 'Social work, case management, and community support services.',
    description: 'Social services programs providing direct support to residents — including child welfare, family services, elderly programs, disability services, and community case management. Delivered by local government social workers and community-based providers.',
    tags: ['social services', 'human services', 'child welfare', 'family services'],
    confidence: 'high',
  },

  'all other human services current expenditures': {
    plain_name: 'All Other Human Services',
    short_description: 'Human services operating costs not in income maintenance or social services.',
    description: 'A catch-all for human services operating costs that do not fall under income maintenance or social services — such as public health nursing, community mental health contributions, and other miscellaneous human services.',
    tags: ['other human services', 'human services', 'community services', 'operating'],
    confidence: 'high',
  },

  'human services capital outlay': {
    plain_name: 'Human Services Capital Outlay',
    short_description: 'Capital spending on human services facilities and equipment.',
    description: 'Capital outlay for human services programs — including facility improvements, vehicles, and equipment used in delivering social and human services programs.',
    tags: ['human services capital', 'capital outlay', 'equipment', 'facilities'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // DEBT SERVICE depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'bond principal payments': {
    plain_name: 'Bond Principal Payments',
    short_description: 'Scheduled repayments of outstanding bond principal.',
    description: 'Payments that retire the principal balance of outstanding bonds. Bond principal payments are scheduled, mandatory obligations that reduce the total long-term debt of the local government over time.',
    tags: ['bond principal', 'debt repayment', 'debt service', 'finance'],
    confidence: 'high',
  },

  'other long-term debt principal payments': {
    plain_name: 'Other Long-term Debt Principal',
    short_description: 'Principal payments on long-term debt other than bonds.',
    description: 'Principal payments on long-term obligations other than general obligation or revenue bonds — such as notes payable, installment purchase agreements, capital leases, and other financing arrangements.',
    tags: ['debt principal', 'long-term debt', 'debt service', 'finance'],
    confidence: 'high',
  },

  'interest payments & fiscal charges': {
    plain_name: 'Interest & Fiscal Charges',
    short_description: 'Interest on outstanding debt plus related fiscal agent fees.',
    description: 'Interest costs paid on outstanding bonds and other long-term borrowings, along with related fiscal agent fees and charges. Reflects the ongoing carrying cost of previously incurred debt and is a fixed, mandatory expenditure.',
    tags: ['interest', 'fiscal charges', 'debt service', 'finance'],
    confidence: 'high',
  },

  // ──────────────────────────────────────────────────────────────────────────────────
  // OTHER & UNALLOCATED depth-1 leaves
  // ──────────────────────────────────────────────────────────────────────────────────

  'unallocated pension costs': {
    plain_name: 'Unallocated Pension Costs',
    short_description: 'Pension and retirement contribution costs not assigned to a specific function.',
    description: 'Pension and retirement system contribution costs that are reported centrally rather than allocated to specific service functions. Reflects the local government\'s required contributions to employee pension plans, recorded as an organization-wide cost.',
    tags: ['pension', 'retirement', 'employee benefits', 'unallocated'],
    confidence: 'high',
  },

  'unallocated insurance costs': {
    plain_name: 'Unallocated Insurance Costs',
    short_description: 'Insurance and risk management costs not assigned to a specific function.',
    description: 'Insurance premiums and risk management costs recorded centrally rather than allocated to individual service functions — including property and casualty insurance, liability insurance, and workers\' compensation costs shared across the organization.',
    tags: ['insurance', 'risk management', 'employee benefits', 'unallocated'],
    confidence: 'high',
  },

  'all other current expend': {
    plain_name: 'All Other Current Expenditures',
    short_description: 'Operating costs not assigned to any other function or category.',
    description: 'A catch-all for operating expenditures that do not fit any of the named functional categories — miscellaneous costs, transfers among funds, and other current spending that does not have a specific functional home.',
    tags: ['other expenditures', 'miscellaneous', 'operating', 'unallocated'],
    confidence: 'high',
  },

  'all other capital outlay': {
    plain_name: 'All Other Capital Outlay',
    short_description: 'Capital spending not assigned to a specific function.',
    description: 'Capital outlay that is not assigned to a specific service function — including shared facilities improvements, organization-wide technology investments, and other capital spending that spans multiple programs.',
    tags: ['other capital', 'capital outlay', 'miscellaneous', 'unallocated'],
    confidence: 'high',
  },

  'capital outlay for enterprise funds': {
    plain_name: 'Capital Outlay for Enterprise Funds',
    short_description: 'Capital spending transferred to enterprise fund operations.',
    description: 'Capital outlay funded from governmental funds but directed toward enterprise fund activities — such as water utilities, electric utilities, or other business-type operations. Represents governmental fund support for locally operated enterprise services.',
    tags: ['enterprise funds', 'capital outlay', 'utilities', 'governmental funds'],
    confidence: 'high',
  },

  'tnwaterco': {
    plain_name: 'Township Water Capital Outlay',
    short_description: 'Capital spending on township water supply operations.',
    description: 'Capital outlay by township governments for water supply infrastructure improvements. A capital-side analog to township water charges, covering infrastructure investment in township water operations.',
    tags: ['water capital', 'township', 'utility', 'capital outlay'],
    confidence: 'medium',
  },

};

// Canonical last-segment key list for offline tests and documentation.
export const EXPECTED_CONCEPTS = Object.keys(CONCEPTS);
