// Task 11 -- Bainbridge Island, WA + Kitsap County, WA category enrichment
// (inline-authored, $0; NO paid API path).
//
// Hand-authored maps keyed by the exact treasury.budget_categories.link_key
// (== category_enrichment.name_key). Every row is written SCOPED to one
// municipality_id -- never NULL/universal -- because the category_enrichment
// unique index is NULLS DISTINCT, so a NULL-scoped row is treated as a
// universal default and bleeds onto every other city in the app (see
// auto-memory reference_category_enrichment_nulls_distinct.md). Bainbridge and
// Kitsap share most of their economic-concept names ("property taxes",
// "charges for services", "current"), and the fund-scope caveat is different
// for each, so each entity gets its own row under its own id.
//
// Content rules followed throughout (no exceptions):
//   1. NO `$` figures and no year-specific amounts. Each row is reused across
//      up to 18 fiscal years; a hardcoded number would go stale silently. The
//      loader hard-fails on any `$<digit>` in authored text.
//   2. No locality bleed -- a Bainbridge row never names Kitsap County or any
//      other WA municipality, and vice versa. The loader hard-fails on this.
//   3. The General-Fund-only limitation is stated EXPLICITLY on every row, per
//      entity, naming that entity's own excluded funds. Task 11 requires a
//      reader to see this rather than discover it.
//
// ── ERA-LABEL VARIANTS ──────────────────────────────────────────────────────
// The same underlying line renames itself partway through the window. Every
// variant gets its own row so every year renders an explanation, and the copy
// is deliberately IDENTICAL across variants so a reader comparing two fiscal
// years does not see one source described two different ways. Confirmed
// DISJOINT in the loaded data (no year carries both), which is what makes them
// a rename rather than two different sources:
//   Bainbridge  'interest' FY2004-2008          -> 'interest and investment revenue' FY2012-2025
//   Bainbridge  'other taxes' FY2004-2020       -> 'sales, business, and excise taxes' FY2021-2025
//   Kitsap      'intergovernmental' FY2004-2016 -> 'intergovernmental service' FY2020-2024
//   Kitsap      'licenses and permits' FY2004-2016 -> 'licenses & permits' FY2020-2024
//   Kitsap      'miscellaneous' FY2004-2016     -> 'miscellaneous revenues' FY2020-2024
//
// ── SOURCES FOR THE FUND-SCOPE CLAIMS ───────────────────────────────────────
// Not asserted from general knowledge. Both were read out of the filings:
//   * Bainbridge Island FY2025 (WA SAO ARN 1040282), Statement of Revenues,
//     Expenditures and Changes in Fund Balance -- Governmental Funds, PDF p.23:
//     the governmental-fund columns are General / Street / Construction /
//     Non-Major Funds / Total. The same filing's fund descriptions name the
//     Water Fund, the Sewer Fund and the Storm & Surface Water Management
//     (SSWM) Fund as Enterprise Funds, i.e. proprietary funds reported outside
//     the governmental-funds statement entirely.
//   * Kitsap County FY2024 (WA SAO ARN 1038058): the enterprise funds are the
//     Sanitary Sewer, Solid Waste and Surface Water utilities -- "The principal
//     operating revenues of the enterprise funds are collection fees for solid
//     waste and use charges for sewer and surface water." The governmental-fund
//     columns on the statement page show the General Fund alongside separate
//     special revenue funds.

const BI_GF_CAVEAT =
  'These figures cover the General Fund only. Bainbridge Island also reports ' +
  'street, construction and other non-major governmental funds outside the ' +
  'General Fund, and its water, sewer and storm & surface water utilities are ' +
  'run as separate enterprise funds that are not part of this view at all. ' +
  'General Fund spending is therefore a large share of what the city does, ' +
  'but not all of it.';

const KC_GF_CAVEAT =
  'These figures cover the General Fund only. Kitsap County runs its sanitary ' +
  'sewer, solid waste and surface water utilities as enterprise funds outside ' +
  'the General Fund, and reports road and other special revenue funds ' +
  'separately as well. County services are unusually spread across those other ' +
  'funds, so the General Fund is a smaller share of total county activity than ' +
  'a reader might expect.';

const BI_SOURCE =
  'Reported in the City of Bainbridge Island\'s annual financial statements as ' +
  'filed with and published by the Washington State Auditor.';

const KC_SOURCE =
  'Reported in Kitsap County\'s annual financial statements as filed with and ' +
  'published by the Washington State Auditor.';

const CONF = 'high';

/** Assemble a description: what it is, then the fund-scope limit, then provenance. */
const body = (what, caveat, source) => `${what}\n\n${caveat}\n\n${source}`;

// ═══════════════════════════════════════════════════════════════════════════
// BAINBRIDGE ISLAND -- 23 keys (13 operating, 10 revenue)
// ═══════════════════════════════════════════════════════════════════════════
export const BAINBRIDGE_ENRICHMENT = {
  // ── Operating: the modern-era (FY2012+) tree ─────────────────────────────
  'current': {
    plain_name: 'Current Operations',
    short_description: 'Day-to-day General Fund operating costs across all city departments, as distinct from construction projects and debt payments.',
    description: body(
      'The "Current" grouping covers the city\'s ordinary, recurring operating spending -- policing, planning, parks and recreation, municipal court, road maintenance charged to the General Fund, and general administration -- as opposed to one-time capital construction (Capital Outlay) or repaying borrowed money (Debt Service). In the fiscal years that use this grouping it is by far the largest expenditure category, and its sub-categories break it out by function.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['operations', 'general fund', 'city services', 'expenditures'],
    confidence: CONF,
  },
  'capital outlay': {
    plain_name: 'Capital Outlay',
    short_description: 'One-time spending on physical assets -- buildings, road and facility construction, vehicles and equipment.',
    description: body(
      'Capital Outlay is money spent to build or buy long-lived physical things rather than to run services day to day: facility construction and improvements, road and infrastructure work paid from the General Fund, vehicles, and major equipment. It moves up and down far more sharply year to year than operating costs do, because a single project can land in one fiscal year, so a jump here usually reflects project timing rather than a change in the cost of running the city.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['capital', 'construction', 'equipment', 'expenditures'],
    confidence: CONF,
  },
  'debt service': {
    plain_name: 'Debt Service',
    short_description: 'Repayment of money the city has borrowed -- both the principal and the interest.',
    description: body(
      'Debt Service is what the city pays each year on money it has already borrowed, typically through bonds issued to finance long-lived capital projects. It combines repayment of the amount borrowed (principal) with the cost of borrowing it (interest). In the fiscal years that report a single combined line, both parts are included here; other years split them into separate lines.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['debt', 'bonds', 'interest', 'expenditures'],
    confidence: CONF,
  },
  'debt service - principal': {
    plain_name: 'Debt Service — Principal',
    short_description: 'The portion of debt payments that repays the amount originally borrowed.',
    description: body(
      'This is the part of the city\'s annual debt payment that pays down the original borrowed amount, separate from the interest charged on it. Paying principal reduces what the city still owes; paying interest does not. Not every fiscal year in this record reports a principal payment from the General Fund, so a missing year here means none was reported on that year\'s statement rather than that the figure is unknown.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['debt', 'principal', 'bonds', 'expenditures'],
    confidence: CONF,
  },
  'debt service - interest': {
    plain_name: 'Debt Service — Interest',
    short_description: 'The portion of debt payments that is the cost of borrowing, separate from repaying the loan itself.',
    description: body(
      'This is the interest the city pays on outstanding debt -- the price of borrowing, as distinct from repaying the borrowed amount itself, which is reported as principal. Interest generally declines over the life of a bond as the balance is paid down, so a steady fall in this line across years usually reflects an ageing debt portfolio rather than reduced borrowing costs.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['debt', 'interest', 'bonds', 'expenditures'],
    confidence: CONF,
  },
  // ── Operating: the early-era (FY2004-FY2008) function tree ───────────────
  'general government': {
    plain_name: 'General Government',
    short_description: 'Central administration — the city manager, council, finance, legal, human resources and elections support.',
    description: body(
      'General Government covers the city\'s central administrative machinery rather than a service delivered directly to residents: the city council and city manager, finance and budgeting, legal services, human resources, records, information technology and general facilities. It is the overhead that lets every other department function, which is why it appears in every year of the record.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['administration', 'general government', 'city services', 'expenditures'],
    confidence: CONF,
  },
  'judicial': {
    plain_name: 'Judicial',
    short_description: 'The municipal court — hearings, case processing and court administration.',
    description: body(
      'Judicial covers the operation of the city\'s municipal court: judges and court staff, case processing, hearings on traffic and misdemeanour matters, and the administration that supports them. It is reported separately from Public Safety because a court is deliberately independent of the police function whose cases it hears.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['courts', 'judicial', 'justice', 'expenditures'],
    confidence: CONF,
  },
  'public safety': {
    plain_name: 'Public Safety',
    short_description: 'Police services, emergency response and related public protection functions.',
    description: body(
      'Public Safety covers policing and related protective services -- patrol officers, investigations, dispatch and emergency response, and the equipment and training behind them. It is usually the single largest function in a city General Fund, because it is labour-intensive and is funded almost entirely from general tax revenue rather than from fees charged to users.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['public safety', 'police', 'emergency', 'expenditures'],
    confidence: CONF,
  },
  'physical environment': {
    plain_name: 'Physical Environment',
    short_description: 'Environmental and natural-resource work — shoreline, stormwater planning, conservation and related programmes.',
    description: body(
      'Physical Environment is a Washington state reporting category covering work on the natural and built environment: shoreline and critical-areas management, conservation programmes, environmental planning and review, and related permitting support. On an island jurisdiction this category carries real weight, since shoreline and groundwater management are core local responsibilities.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['environment', 'conservation', 'planning', 'expenditures'],
    confidence: CONF,
  },
  'transportation': {
    plain_name: 'Transportation',
    short_description: 'Roads, streets and traffic — maintenance, signage, and related transport services charged to the General Fund.',
    description: body(
      'Transportation covers street and road work funded through the General Fund: maintenance and repair, signs and striping, traffic management, and related engineering. Much city road work is often accounted for in a separate street fund rather than the General Fund, so this line reflects only the transportation activity the General Fund itself carried in that year.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['transportation', 'roads', 'streets', 'expenditures'],
    confidence: CONF,
  },
  'economic environment': {
    plain_name: 'Economic Environment',
    short_description: 'Community and economic development — land-use planning, permitting, and housing and economic programmes.',
    description: body(
      'Economic Environment is a Washington state reporting category covering community and economic development: long-range and land-use planning, development review and permitting, building inspection, housing programmes and economic development activity. It is the function most directly connected to how and where a community is allowed to grow.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['planning', 'development', 'permitting', 'expenditures'],
    confidence: CONF,
  },
  'health and human services': {
    plain_name: 'Health and Human Services',
    short_description: 'Public health and social service programmes supported by the city.',
    description: body(
      'Health and Human Services covers public health and social support activity carried by the city -- typically contributions to county or regional health programmes, human services grants, and support for community organisations serving residents in need. In Washington, most direct public health delivery sits with county and state government, so a city line here is usually modest and largely contractual.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['health', 'human services', 'social services', 'expenditures'],
    confidence: CONF,
  },
  'culture and recreation': {
    plain_name: 'Culture and Recreation',
    short_description: 'Parks, recreation programmes, trails and cultural activity.',
    description: body(
      'Culture and Recreation covers parks and open space, recreation programmes and facilities, trails, and support for cultural and community activity. It is the most visible discretionary spending in most city budgets, which also makes it one of the first categories affected when General Fund revenue tightens.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['parks', 'recreation', 'culture', 'expenditures'],
    confidence: CONF,
  },

  // ── Revenue ──────────────────────────────────────────────────────────────
  'property taxes': {
    plain_name: 'Property Taxes',
    short_description: 'Taxes levied on the assessed value of land and buildings — the most stable major revenue the city collects.',
    description: body(
      'Property taxes are charged against the assessed value of real property in the city and are the steadiest large revenue source a Washington city has, because assessed values and the levy are set annually and move slowly. State law caps how fast a regular levy may grow without voter approval, so this line typically rises gradually rather than tracking the local property market.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['taxes', 'property tax', 'revenue'],
    confidence: CONF,
  },
  // Era variants of the SAME line -- identical copy, deliberately.
  'other taxes': {
    plain_name: 'Sales, Business and Excise Taxes',
    short_description: 'Local sales tax plus business, utility and excise taxes — the revenue that moves most with the economy.',
    description: body(
      'This line collects the city\'s tax revenue other than property tax: the local share of retail sales tax, utility and business taxes, and excise taxes such as those on real estate transactions. Unlike property tax it responds quickly to economic conditions and to the local property market, so it is usually the most volatile major revenue line -- the one that falls first in a downturn and recovers first afterwards. The printed label for this line changed during the period covered here (earlier statements call it "Other Taxes", later ones "Sales, Business, and Excise Taxes"); it is the same underlying revenue, described the same way in both.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['taxes', 'sales tax', 'excise tax', 'revenue'],
    confidence: CONF,
  },
  'sales, business, and excise taxes': {
    plain_name: 'Sales, Business and Excise Taxes',
    short_description: 'Local sales tax plus business, utility and excise taxes — the revenue that moves most with the economy.',
    description: body(
      'This line collects the city\'s tax revenue other than property tax: the local share of retail sales tax, utility and business taxes, and excise taxes such as those on real estate transactions. Unlike property tax it responds quickly to economic conditions and to the local property market, so it is usually the most volatile major revenue line -- the one that falls first in a downturn and recovers first afterwards. The printed label for this line changed during the period covered here (earlier statements call it "Other Taxes", later ones "Sales, Business, and Excise Taxes"); it is the same underlying revenue, described the same way in both.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['taxes', 'sales tax', 'excise tax', 'revenue'],
    confidence: CONF,
  },
  'licenses and permits': {
    plain_name: 'Licenses and Permits',
    short_description: 'Fees for building permits, business licences and other municipal authorisations.',
    description: body(
      'Licenses and Permits is what the city collects for granting permission: building and construction permits, land-use and development applications, business licences, and similar authorisations. Because it is driven by construction and development activity, it tends to rise and fall with the building cycle rather than with the size of the population.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['permits', 'licenses', 'development', 'revenue'],
    confidence: CONF,
  },
  'intergovernmental': {
    plain_name: 'Intergovernmental Revenue',
    short_description: 'Money received from other governments — state shared revenues, grants and payments under agreements.',
    description: body(
      'Intergovernmental revenue is money that reaches the city from other governments rather than directly from residents: state-shared revenues distributed under formula, federal and state grants, and payments from other local governments under service agreements. Grant-driven years can produce sharp one-off increases in this line, so a spike here often reflects a single award rather than a lasting change in the city\'s finances.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['grants', 'intergovernmental', 'state revenue', 'revenue'],
    confidence: CONF,
  },
  'charges for services': {
    plain_name: 'Charges for Services',
    short_description: 'Fees paid by the people who use a specific city service, rather than by taxpayers generally.',
    description: body(
      'Charges for Services is revenue the city earns by charging the users of particular services -- plan review and inspection fees, recreation programme fees, administrative and record charges, and services provided to other agencies under contract. It differs from a tax in that it is paid by the person receiving the service rather than by the community as a whole.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['fees', 'service charges', 'revenue'],
    confidence: CONF,
  },
  'fees and fines': {
    plain_name: 'Fees and Fines',
    short_description: 'Court fines, traffic penalties and related enforcement revenue.',
    description: body(
      'Fees and Fines is revenue from enforcement rather than from service delivery: municipal court fines, traffic and parking penalties, and associated fees and forfeitures. It is a small revenue line for most cities, and its purpose is regulatory -- it exists to deter conduct rather than to fund operations, so a decline here is not necessarily a bad outcome.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['fines', 'court', 'enforcement', 'revenue'],
    confidence: CONF,
  },
  // Era variants of the SAME line -- identical copy, deliberately.
  'interest': {
    plain_name: 'Interest and Investment Revenue',
    short_description: 'Earnings on the cash and reserves the city holds between collecting money and spending it.',
    description: body(
      'Governments hold cash between the point they collect it and the point they spend it, and that balance is invested in low-risk instruments in the meantime. This line is what those balances earn. It tracks prevailing interest rates closely, so it can change dramatically from year to year without anything about the city\'s own finances having changed. The printed label for this line varies across the years covered here ("Interest" in the earlier statements, "Interest and Investment Revenue" in the later ones); it is the same underlying revenue.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['interest', 'investments', 'revenue'],
    confidence: CONF,
  },
  'interest and investment revenue': {
    plain_name: 'Interest and Investment Revenue',
    short_description: 'Earnings on the cash and reserves the city holds between collecting money and spending it.',
    description: body(
      'Governments hold cash between the point they collect it and the point they spend it, and that balance is invested in low-risk instruments in the meantime. This line is what those balances earn. It tracks prevailing interest rates closely, so it can change dramatically from year to year without anything about the city\'s own finances having changed. The printed label for this line varies across the years covered here ("Interest" in the earlier statements, "Interest and Investment Revenue" in the later ones); it is the same underlying revenue.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['interest', 'investments', 'revenue'],
    confidence: CONF,
  },
  'other revenues': {
    plain_name: 'Other Revenues',
    short_description: 'Miscellaneous receipts that do not belong to any of the named revenue categories.',
    description: body(
      'Other Revenues is the residual line on the revenue statement: rents and leases, contributions and donations, insurance recoveries, asset sales and other one-off receipts that do not fit the named categories. It is genuinely miscellaneous by design, so an unusual year here is normally traceable to a single transaction rather than to a trend.',
      BI_GF_CAVEAT, BI_SOURCE),
    tags: ['miscellaneous', 'other revenue', 'revenue'],
    confidence: CONF,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// KITSAP COUNTY -- 15 keys (3 operating, 12 revenue)
// ═══════════════════════════════════════════════════════════════════════════
export const KITSAP_ENRICHMENT = {
  // ── Operating ────────────────────────────────────────────────────────────
  'current': {
    plain_name: 'Current Operations',
    short_description: 'Day-to-day General Fund operating costs across county departments, as distinct from construction projects and debt payments.',
    description: body(
      'The "Current" grouping covers the county\'s ordinary, recurring operating spending -- the sheriff\'s office, the courts and prosecutor, the jail, elections and records, assessment and treasury, and general administration -- as opposed to one-time capital construction (Capital Outlay) or repaying borrowed money (Debt Service). Its sub-categories break the total out by function, and it is the dominant expenditure category in every year of this record.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['operations', 'general fund', 'county services', 'expenditures'],
    confidence: CONF,
  },
  'capital outlay': {
    plain_name: 'Capital Outlay',
    short_description: 'One-time spending on physical assets — buildings, facilities, vehicles and major equipment.',
    description: body(
      'Capital Outlay is money spent to build or buy long-lived physical things rather than to run services day to day: facility construction and improvement, vehicles, and major equipment. It swings sharply from year to year because a single project can land entirely within one fiscal year, so movement in this line usually reflects project timing rather than any change in the cost of running the county.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['capital', 'construction', 'equipment', 'expenditures'],
    confidence: CONF,
  },
  'debt service': {
    plain_name: 'Debt Service',
    short_description: 'Repayment of money the county has borrowed — both the principal and the interest.',
    description: body(
      'Debt Service is what the county pays each year on money it has already borrowed, typically through bonds issued to finance long-lived capital projects. It combines repayment of the borrowed amount (principal) with the cost of borrowing it (interest). Not every year in this record reports debt service from the General Fund -- county debt is frequently carried in the specific funds that own the financed assets instead -- so a missing year means none was reported on that year\'s statement.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['debt', 'bonds', 'interest', 'expenditures'],
    confidence: CONF,
  },

  // ── Revenue ──────────────────────────────────────────────────────────────
  'property taxes': {
    plain_name: 'Property Taxes',
    short_description: 'Taxes levied on the assessed value of land and buildings — the county’s steadiest major revenue.',
    description: body(
      'Property taxes are charged against the assessed value of real property and are the most stable large revenue a Washington county collects, because assessed values and the levy are set annually and move slowly. State law limits how fast a regular levy may grow without voter approval, so this line usually rises gradually rather than tracking the property market. Counties depend on it more heavily than cities do, since they have fewer alternative taxing powers.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['taxes', 'property tax', 'revenue'],
    confidence: CONF,
  },
  'retail sales & use taxes': {
    plain_name: 'Retail Sales and Use Taxes',
    short_description: 'The county’s share of sales tax on retail purchases — the revenue that moves most with the economy.',
    description: body(
      'This is the county\'s share of the tax charged on retail sales and on the use of goods bought untaxed elsewhere. It responds quickly to consumer spending and to economic conditions generally, which makes it the most volatile of the county\'s major revenues: it falls first in a downturn and recovers first afterwards, in contrast to the property tax beside it.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['taxes', 'sales tax', 'revenue'],
    confidence: CONF,
  },
  'other taxes': {
    plain_name: 'Other Taxes',
    short_description: 'Tax revenue other than property and retail sales taxes — excise, utility and similar local taxes.',
    description: body(
      'Other Taxes collects the county\'s tax revenue that is neither property tax nor retail sales and use tax: excise taxes including those on real estate transactions, utility and leasehold taxes, and other locally imposed taxes. Individually these are small, but several of them track property transactions and so move with the housing market rather than with general economic activity.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['taxes', 'excise tax', 'revenue'],
    confidence: CONF,
  },
  // Era variants of the SAME line -- identical copy, deliberately.
  'licenses and permits': {
    plain_name: 'Licenses and Permits',
    short_description: 'Fees for building permits, land-use approvals and other county authorisations.',
    description: body(
      'Licenses and Permits is what the county collects for granting permission: building and construction permits, land-use and development applications, and various licences it is responsible for issuing. Because it is driven by construction and development in unincorporated areas, it rises and falls with the building cycle rather than with population. The printed label varies across the years covered here ("Licenses and Permits" in the earlier statements, "Licenses & Permits" in the later ones); it is the same underlying revenue.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['permits', 'licenses', 'development', 'revenue'],
    confidence: CONF,
  },
  'licenses & permits': {
    plain_name: 'Licenses and Permits',
    short_description: 'Fees for building permits, land-use approvals and other county authorisations.',
    description: body(
      'Licenses and Permits is what the county collects for granting permission: building and construction permits, land-use and development applications, and various licences it is responsible for issuing. Because it is driven by construction and development in unincorporated areas, it rises and falls with the building cycle rather than with population. The printed label varies across the years covered here ("Licenses and Permits" in the earlier statements, "Licenses & Permits" in the later ones); it is the same underlying revenue.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['permits', 'licenses', 'development', 'revenue'],
    confidence: CONF,
  },
  // Era variants of the SAME line -- identical copy, deliberately.
  'intergovernmental': {
    plain_name: 'Intergovernmental Revenue',
    short_description: 'Money received from other governments — state shared revenues, grants and payments under service agreements.',
    description: body(
      'Intergovernmental revenue is money reaching the county from other governments rather than directly from residents: state-shared revenues distributed under formula, federal and state grants, and payments from cities and other local governments for services the county performs on their behalf. Counties act as service providers to other jurisdictions far more than cities do, so this is a substantial line rather than an incidental one. The printed label varies across the years covered here ("Intergovernmental" in the earlier statements, "Intergovernmental Service" in the later ones); it is the same underlying revenue.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['grants', 'intergovernmental', 'state revenue', 'revenue'],
    confidence: CONF,
  },
  'intergovernmental service': {
    plain_name: 'Intergovernmental Revenue',
    short_description: 'Money received from other governments — state shared revenues, grants and payments under service agreements.',
    description: body(
      'Intergovernmental revenue is money reaching the county from other governments rather than directly from residents: state-shared revenues distributed under formula, federal and state grants, and payments from cities and other local governments for services the county performs on their behalf. Counties act as service providers to other jurisdictions far more than cities do, so this is a substantial line rather than an incidental one. The printed label varies across the years covered here ("Intergovernmental" in the earlier statements, "Intergovernmental Service" in the later ones); it is the same underlying revenue.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['grants', 'intergovernmental', 'state revenue', 'revenue'],
    confidence: CONF,
  },
  'charges for services': {
    plain_name: 'Charges for Services',
    short_description: 'Fees paid by the people and agencies that use a specific county service.',
    description: body(
      'Charges for Services is revenue the county earns by charging the users of particular services: recording and filing fees, court and clerk charges, planning and inspection fees, and services provided to cities and other agencies under contract. It differs from a tax in that it is paid by the party receiving the service rather than by the community as a whole, and for a county a large part of it comes from other governments buying county services.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['fees', 'service charges', 'revenue'],
    confidence: CONF,
  },
  'fines & forfeits': {
    plain_name: 'Fines and Forfeits',
    short_description: 'Court fines, penalties and forfeited property or bail.',
    description: body(
      'Fines and Forfeits is revenue from enforcement rather than service delivery: fines imposed by the county\'s courts, civil and traffic penalties, and forfeited bail or property. It is a small share of county revenue, and it exists to deter conduct rather than to fund operations, so a fall in this line is not in itself a sign of financial trouble.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['fines', 'court', 'enforcement', 'revenue'],
    confidence: CONF,
  },
  'investment earnings': {
    plain_name: 'Investment Earnings',
    short_description: 'Earnings on the cash and reserves the county holds between collecting money and spending it.',
    description: body(
      'Governments hold cash between the point they collect it and the point they spend it, and that balance is invested in low-risk instruments in the meantime. This line is what those balances earn. It follows prevailing interest rates closely, so it can change dramatically from one year to the next without anything about the county\'s own finances having changed -- the near-zero rate years and the sharp rebound afterwards are both visible in this record.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['interest', 'investments', 'revenue'],
    confidence: CONF,
  },
  // Era variants of the SAME line -- identical copy, deliberately.
  'miscellaneous': {
    plain_name: 'Miscellaneous Revenues',
    short_description: 'Residual receipts that do not belong to any of the named revenue categories.',
    description: body(
      'This is the residual line on the revenue statement: rents and leases, contributions and donations, insurance recoveries, asset sales and other one-off receipts that do not fit the named categories. It is genuinely miscellaneous by design, so an unusual year here normally traces to a single transaction rather than to a trend. The printed label varies across the years covered here ("Miscellaneous" in the earlier statements, "Miscellaneous Revenues" in the later ones); it is the same underlying revenue.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['miscellaneous', 'other revenue', 'revenue'],
    confidence: CONF,
  },
  'miscellaneous revenues': {
    plain_name: 'Miscellaneous Revenues',
    short_description: 'Residual receipts that do not belong to any of the named revenue categories.',
    description: body(
      'This is the residual line on the revenue statement: rents and leases, contributions and donations, insurance recoveries, asset sales and other one-off receipts that do not fit the named categories. It is genuinely miscellaneous by design, so an unusual year here normally traces to a single transaction rather than to a trend. The printed label varies across the years covered here ("Miscellaneous" in the earlier statements, "Miscellaneous Revenues" in the later ones); it is the same underlying revenue.',
      KC_GF_CAVEAT, KC_SOURCE),
    tags: ['miscellaneous', 'other revenue', 'revenue'],
    confidence: CONF,
  },
};

export const BAINBRIDGE_EXPECTED_KEYS = Object.keys(BAINBRIDGE_ENRICHMENT);
export const KITSAP_EXPECTED_KEYS = Object.keys(KITSAP_ENRICHMENT);
