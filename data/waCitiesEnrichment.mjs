// Task 12 -- WA-CITIES-01 category enrichment for Tacoma, Spokane, Vancouver,
// Bellevue, Kent and Everett (inline-authored, $0; NO paid API path).
//
// Keyed by the exact treasury.budget_categories.link_key (== name_key). Every
// row is written SCOPED to one municipality_id -- never NULL/universal -- because
// the category_enrichment unique index is NULLS DISTINCT, so a NULL-scoped row is
// treated as a universal default and bleeds its text onto every other city in the
// app (see auto-memory reference_category_enrichment_nulls_distinct.md). These
// six cities share almost every economic-concept name -- "taxes", "licenses and
// permits", "current" -- while the FUND-SCOPE CAVEAT differs for each, which is
// exactly why scoping matters here rather than being a formality.
//
// ── HOW THE COPY IS ASSEMBLED, AND WHY ──────────────────────────────────────
// A CONCEPT table holds the city-neutral "what this line is", and each city
// supplies its own caveat and provenance. Two consequences, both deliberate:
//
//   * ERA-LABEL VARIANTS GET IDENTICAL COPY BY CONSTRUCTION. When a line renames
//     itself partway through a window, every variant maps to the SAME concept, so
//     a reader comparing two fiscal years cannot see one source described two
//     different ways. Doing this by hand across 93 keys would drift.
//   * the concept text never names a locality, so the loader's cross-locality
//     guard has nothing to trip over, and the city-specific claims live only in
//     the caveat, where they are sourced.
//
// Every variant family below was confirmed DISJOINT in the loaded data (no fiscal
// year carries two members), which is what makes it a rename rather than two
// different sources:
//
//   Tacoma    capital outlay FY2003-2024        / capital expenditures FY2012-2016
//   Tacoma    charges for services              / charges for goods and services
//   Tacoma    fines and forfeitures / fines and forfeits / fines and penalties
//   Tacoma    intergovernmental revenue / intergovernmental revenues / intergovernmental
//   Tacoma    miscellaneous revenues            / miscellaneous
//   Tacoma    interest / interest and other earnings / investment earnings
//   Spokane   capital outlay FY2004-2011        / capital outlays FY2013-2024
//   Spokane   interest income / net increase (decrease) in fair value ... / net inc(dec) in market value ...
//   Vancouver fines and forfeits FY2005-2013    / fines and penalties FY2014-2023
//   Vancouver interest earnings FY2005-2007     / investment earnings FY2008-2023
//   Bellevue  "and" -> "&" across six names in FY2023 (its last loaded year)
//   Bellevue  interest and assessment interest/penalties / interest and penalties / interest & penalties
//
// ⚠ ONE FAMILY IS A SPLIT, NOT A RENAME, and is treated as such: Vancouver
// reports `other taxes` through FY2018 and then reports `business & occupation
// taxes` and `excise taxes` as two separate lines from FY2019. Giving all three
// identical copy would tell a reader they are the same line, which they are not,
// so each carries its own text and `other taxes` says what became of it.
//
// ── SOURCES FOR THE FUND-SCOPE CLAIMS ───────────────────────────────────────
// Not asserted from general knowledge. Each city's governmental-fund columns and
// its named enterprise funds were read out of that city's OWN filing:
//
//   Tacoma FY2024 (SAO ARN 1038208): the governmental-funds statement columns are
//     General Fund #0010 / Trans Capital & Engineering Fund #1060 / Other
//     Governmental / Total. Its proprietary-funds statement names Solid Waste
//     #4200, Wastewater #4300, Water #4600 and Power #4700 as enterprise funds.
//   Spokane FY2024 (ARN 1038150): columns are General Fund / American Recovery
//     Plan Funds / Other Governmental / Total. Enterprise funds are Water/Sewer,
//     Solid Waste and other enterprise funds.
//   Vancouver FY2023 (ARN 1035588): columns are Consolidated General / Fire /
//     Street / Capital Improvement / American Rescue Plan Act, plus non-major.
//     Enterprise funds are the Consolidated Water Sewer Fund and Parking Services.
//   Bellevue FY2023 (ARN 1035619): the statement runs two pages beginning with
//     General Fund and Operating Grants, Donations & Special Reserves. Note:
//     "The city maintains three major enterprise funds: the Storm and Surface
//     Water Utility Fund, the Water Utility Fund," and the Sewer Utility Fund.
//   Kent FY2024 (ARN 1038659): columns are General / Street / Capital Resources /
//     Special Assessments / Street Capital Projects / Facility Capital Projects /
//     Non-major / Total. Enterprise funds are the Water, Sewer and Drainage
//     utilities, the Golf Complex and Solid Waste.
//   Everett FY2024 (ARN 1038217): columns are General / Emergency Medical
//     Services / General Government Special Projects / Other Governmental /
//     Total. Enterprise funds are the Water & Sewer Utility and Transit.

const CONF = 'high';

// ── Per-city fund-scope caveats, each naming that city's OWN funds ──────────
const CAVEAT = {
  Tacoma:
    'These figures cover the General Fund only. Tacoma reports its Transportation '
    + 'Capital & Engineering fund and a range of other governmental funds separately, '
    + 'and it runs its water, wastewater, solid waste and electric power utilities as '
    + 'enterprise funds that sit outside this view entirely. Those utilities are '
    + 'large, so the General Fund is a much smaller share of everything the city '
    + 'handles than its size alone suggests.',
  Spokane:
    'These figures cover the General Fund only. Spokane reports federal recovery '
    + 'money and a range of other governmental funds separately, and it runs its '
    + 'combined water and sewer utility and its solid waste utility as enterprise '
    + 'funds outside the General Fund. City services paid for through those '
    + 'utilities do not appear here at all.',
  Vancouver:
    'These figures cover the General Fund only. Vancouver reports its fire, street '
    + 'and capital improvement funds separately, along with federal recovery money '
    + 'and other non-major governmental funds, and it runs its combined water and '
    + 'sewer utility and its parking services as enterprise funds outside the '
    + 'General Fund. Fire service in particular is funded outside this view, which '
    + 'makes the General Fund a narrower picture here than in many cities.',
  Bellevue:
    'These figures cover the General Fund only. Bellevue reports operating grants, '
    + 'donations and special reserves separately from the General Fund, along with '
    + 'other governmental funds, and it runs three utilities -- storm and surface '
    + 'water, water, and sewer -- as enterprise funds that are not part of this view. '
    + 'General Fund spending is a large share of what the city does day to day, but '
    + 'not all of it.',
  Kent:
    'These figures cover the General Fund only. Kent reports its street fund, '
    + 'capital resources fund, special assessments and several capital projects '
    + 'funds separately, and it runs its water, sewer and drainage utilities, its '
    + 'golf complex and solid waste as enterprise funds outside the General Fund. '
    + 'A good deal of the city\'s capital work is therefore accounted for elsewhere.',
  Everett:
    'These figures cover the General Fund only. Everett reports its emergency '
    + 'medical services fund and a general government special projects fund '
    + 'separately, along with other governmental funds, and it runs its combined '
    + 'water and sewer utility and its transit system as enterprise funds outside '
    + 'the General Fund. Transit and utility costs therefore do not appear here.',
};

const SOURCE = (city) =>
  `Reported in the City of ${city}'s annual financial statements as filed with and `
  + 'published by the Washington State Auditor.';

/** what it is, then the fund-scope limit, then provenance. */
const body = (what, city) => `${what}\n\n${CAVEAT[city]}\n\n${SOURCE(city)}`;

// ═══════════════════════════════════════════════════════════════════════════
// CONCEPTS -- city-neutral. Era variants of one line share a concept, so their
// copy is identical by construction rather than by care.
// ═══════════════════════════════════════════════════════════════════════════
const CONCEPT = {
  current: {
    plain_name: 'Current Operations',
    short_description: 'Day-to-day General Fund operating costs across all city departments, as distinct from construction projects and debt payments.',
    what: 'The "Current" grouping covers the city\'s ordinary, recurring operating spending -- policing and fire response, municipal court, planning and permitting, parks and recreation, and general administration -- as opposed to one-time capital construction or repaying borrowed money. It is normally by far the largest expenditure grouping, and its sub-categories break it out by function so you can see which services the money went to.',
    tags: ['operations', 'general fund', 'city services', 'expenditures'],
  },
  capitalOutlay: {
    plain_name: 'Capital Outlay',
    short_description: 'One-time spending on physical assets -- buildings, infrastructure, vehicles and major equipment.',
    what: 'Capital Outlay is money spent to build or buy long-lived physical things rather than to run services day to day: facility construction and improvements, infrastructure work charged to the General Fund, vehicles, and major equipment. It moves up and down far more sharply from year to year than operating costs do, because a single project can land inside one fiscal year, so a jump here usually reflects project timing rather than any change in the cost of running the city.',
    tags: ['capital', 'construction', 'equipment', 'expenditures'],
  },
  debtService: {
    plain_name: 'Debt Service',
    short_description: 'Repayment of money the city has borrowed -- both the principal and the interest.',
    what: 'Debt Service is what the city pays each year on money it has already borrowed, typically through bonds issued to finance long-lived capital projects. It combines repayment of the amount borrowed (principal) with the cost of borrowing it (interest). Years that report a single combined line include both parts here; other years split them into separate lines beneath this grouping. A year showing nothing here does not mean the city has no debt -- only that no General Fund debt payment was reported for that year.',
    tags: ['debt', 'bonds', 'interest', 'expenditures'],
  },

  taxes: {
    plain_name: 'Taxes',
    short_description: 'The city\'s own tax revenue -- property, retail sales and use, utility and business taxes.',
    what: 'Taxes are the largest source of General Fund money for most cities and the part residents contribute most directly. The grouping normally combines property tax, retail sales and use tax, taxes on utility services, and business taxes; where the statement breaks those out, the sub-categories show each one. Sales tax tends to move with the local economy from year to year, while property tax is comparatively steady because it is set against assessed values under state limits.',
    tags: ['taxes', 'revenue', 'property tax', 'sales tax'],
  },
  propertyTaxes: {
    plain_name: 'Property Taxes',
    short_description: 'Tax charged on the assessed value of land and buildings in the city.',
    what: 'Property tax is levied against the assessed value of real property in the city. It is the steadiest major revenue source a Washington city has, because state law caps how fast a regular levy can grow from one year to the next regardless of what property values do. That stability is why it usually moves in a smooth line while sales-tax revenue swings with the economy.',
    tags: ['taxes', 'property tax', 'revenue'],
  },
  salesUseTaxes: {
    plain_name: 'Sales and Use Taxes',
    short_description: 'The city\'s share of retail sales tax, plus use tax on goods bought untaxed elsewhere.',
    what: 'This is the city\'s portion of the retail sales tax collected on taxable purchases, together with use tax on goods brought into the city without sales tax having been paid. It is the most economically sensitive large revenue source a city has: it rises with consumer and construction activity and falls quickly in a downturn, which is why a sharp move here usually reflects the economy rather than any decision by the city.',
    tags: ['taxes', 'sales tax', 'revenue', 'economy'],
  },
  businessOccupationTaxes: {
    plain_name: 'Business & Occupation Taxes',
    short_description: 'Tax on business activity in the city, generally charged on gross receipts.',
    what: 'A business and occupation tax is charged on business activity conducted in the city, typically measured on gross receipts rather than profit. Because it is assessed on revenue rather than earnings, it tends to track the volume of local commercial activity fairly directly. This city reports it as its own line in the later years of this series; earlier years fold it into a broader "Other Taxes" line.',
    tags: ['taxes', 'business tax', 'revenue'],
  },
  exciseTaxes: {
    plain_name: 'Excise Taxes',
    short_description: 'Taxes charged on specific transactions or activities rather than on income or property generally.',
    what: 'Excise taxes are levied on particular transactions or activities -- real estate sales, certain utilities and services, and similar specific bases -- rather than on property or income across the board. Individually modest, together they are a meaningful part of the tax base, and the real-estate component in particular moves with the property market. This city reports it as its own line in the later years of this series; earlier years fold it into a broader "Other Taxes" line.',
    tags: ['taxes', 'excise tax', 'revenue'],
  },
  otherTaxes: {
    plain_name: 'Other Taxes',
    short_description: 'Tax revenue other than property and retail sales tax -- business, utility and excise taxes grouped together.',
    what: 'This line groups the tax revenue that is neither property tax nor retail sales tax: taxes on business activity, taxes on utility services, and excise taxes on specific transactions such as real estate sales. In the later years of this series the city stopped reporting a single combined line and began reporting business and occupation taxes and excise taxes separately, so those two lines carry forward what this one used to cover.',
    tags: ['taxes', 'business tax', 'utility tax', 'revenue'],
  },
  taxesSpecialAssessments: {
    plain_name: 'Taxes & Special Assessments',
    short_description: 'The city\'s tax revenue together with assessments charged to specific properties that benefit from an improvement.',
    what: 'This line combines the city\'s general tax revenue -- property, retail sales and use, utility and business taxes -- with special assessments. A special assessment differs from a tax in who pays it: it is charged to the particular properties that benefit from a specific public improvement, rather than to everyone. Reporting them together means this single line covers both the broad tax base and those narrower, project-specific charges.',
    tags: ['taxes', 'special assessments', 'revenue'],
  },

  licensesPermits: {
    plain_name: 'Licenses & Permits',
    short_description: 'Fees for permission to build, operate a business, or carry on a regulated activity.',
    what: 'Licenses and permits are what the city charges to authorise and inspect regulated activity: building and construction permits, business licences, and various trade and animal licences. Building-permit revenue is the volatile part -- it rises and falls with local construction, so this line is a reasonable rough indicator of development activity in the city, though it is set to recover the cost of review and inspection rather than to raise general revenue.',
    tags: ['licenses', 'permits', 'revenue', 'development'],
  },
  intergovernmental: {
    plain_name: 'Intergovernmental Revenue',
    short_description: 'Money received from other governments -- federal and state grants, state-shared revenue, and payments from neighbouring jurisdictions.',
    what: 'Intergovernmental revenue is money that reaches the city from another government rather than from its own taxpayers directly: federal and state grants, revenue the state collects and shares with cities, and payments under contracts with neighbouring jurisdictions and special districts. Much of it is restricted to a particular purpose, so a large figure here does not mean a large amount of freely spendable money. Grant timing also makes this line lumpy from year to year.',
    tags: ['grants', 'intergovernmental', 'federal', 'state', 'revenue'],
  },
  chargesForServices: {
    plain_name: 'Charges for Services',
    short_description: 'Fees paid by the people who use a specific city service, rather than by taxpayers generally.',
    what: 'Charges for services are what the city collects from the users of particular services: recreation programme and facility fees, plan review and inspection charges, public-safety service fees, and administrative charges. They shift part of a service\'s cost onto the people who use it rather than onto the tax base as a whole, so this line tends to reflect both how much the city charges and how heavily its services are used.',
    tags: ['fees', 'charges', 'revenue', 'services'],
  },
  finesForfeitures: {
    plain_name: 'Fines & Forfeitures',
    short_description: 'Money from penalties -- court fines, traffic and parking citations, and forfeited property or bail.',
    what: 'Fines and forfeitures are penalty revenue: fines imposed by the municipal court, traffic and parking citations, code-enforcement penalties, and forfeited bail or property. It is a small share of General Fund revenue in almost every city. It is worth reading as an enforcement measure rather than a funding one -- the amount moves with citation and prosecution volumes, and courts set penalties to deter conduct, not to raise money.',
    tags: ['fines', 'court', 'penalties', 'revenue'],
  },
  miscellaneous: {
    plain_name: 'Other Revenue',
    short_description: 'Revenue that does not fit the named categories -- reimbursements, small recoveries and one-off receipts.',
    what: 'This grouping collects the General Fund revenue that does not belong to any of the named sources: reimbursements from other funds and outside parties, recoveries, proceeds from disposing of surplus items, and assorted one-off receipts. Individually these are small, and a noticeable jump in this line usually means one unusual transaction landed in that year rather than any change in the city\'s ordinary income.',
    tags: ['miscellaneous', 'revenue', 'other'],
  },
  investmentEarnings: {
    plain_name: 'Investment Earnings',
    short_description: 'Interest and other income the city earns on the cash it holds.',
    what: 'Cities hold cash between collecting revenue and spending it, and invest those balances -- conservatively, under state rules on what a public body may buy. This line is the income those balances earn. It follows interest rates far more than anything the city does: the same portfolio produces very different figures in a high-rate year and a near-zero-rate one, so a swing here is usually a rate story rather than a city one.',
    tags: ['interest', 'investments', 'revenue'],
  },
  fairValueChange: {
    plain_name: 'Change in Investment Value',
    short_description: 'The paper gain or loss from revaluing the city\'s investments at year-end market prices.',
    what: 'Accounting rules require the city to report its investments at market value each year, so this line records the change in that value -- not cash received. It can be negative, and a negative figure does not mean money was lost: when interest rates rise, the market value of bonds already held falls, even though those bonds still pay out in full if held to maturity. Reading this line as income or loss in the ordinary sense will mislead; it is a revaluation.',
    tags: ['investments', 'fair value', 'revenue', 'accounting'],
  },
  rent: {
    plain_name: 'Rent & Lease Income',
    short_description: 'Income from renting or leasing out city-owned property and facilities.',
    what: 'This line is what the city earns by letting others use property it owns: leases on land and buildings, facility and room rentals, and similar arrangements. It is normally a small and fairly steady revenue source, tied to the specific properties the city holds and the terms of the leases in force, rather than to the wider economy.',
    tags: ['rent', 'leases', 'property', 'revenue'],
  },
  judgmentsSettlements: {
    plain_name: 'Judgments & Settlements',
    short_description: 'Money received from legal judgments and settled claims in the city\'s favour.',
    what: 'This line records amounts the city receives through litigation or settled claims -- damages recovered, insurance and liability settlements, and similar resolutions. It is inherently irregular: it depends entirely on which cases concluded in a given year, so it can be absent for several years and then appear as a substantial figure once. It should not be read as recurring revenue.',
    tags: ['legal', 'settlements', 'revenue', 'one-time'],
  },
  assessmentInterestPenalties: {
    plain_name: 'Interest & Penalties',
    short_description: 'Interest and late-payment penalties charged on overdue taxes and special assessments.',
    what: 'This line is the interest and penalty revenue that arises when taxes and special assessments are paid late, together with interest owed on assessment instalments spread over time. It is distinct from investment income, which the city reports separately: this is a charge on late or instalment payers, not a return on the city\'s own cash. It is a small line whose size follows the volume of overdue accounts.',
    tags: ['interest', 'penalties', 'assessments', 'revenue'],
  },
  premiumsContributions: {
    plain_name: 'Premiums & Contributions',
    short_description: 'Contributions received into city programmes, including self-insurance premiums charged internally.',
    what: 'This line records premiums and contributions paid into city programmes -- most often amounts charged to city departments and participants to fund self-insurance and benefit arrangements, along with outside contributions to particular programmes. Its size follows the design of those programmes and how their costs are apportioned, rather than any tax or fee decision.',
    tags: ['premiums', 'contributions', 'insurance', 'revenue'],
  },
  contributionsDonations: {
    plain_name: 'Contributions & Donations',
    short_description: 'Gifts and donated money or property received by the city.',
    what: 'This line records money and property given to the city -- donations to parks, libraries and public-safety programmes, and contributions toward specific projects. It is a small and irregular revenue source by nature: a single substantial gift can make one year stand out, so a jump here reflects a particular donation rather than any change in the city\'s ordinary income.',
    tags: ['donations', 'contributions', 'gifts', 'revenue'],
  },
  priorPeriodAdjustment: {
    plain_name: 'Prior Period Cost Allocation Adjustment',
    short_description: 'A one-year correction to how costs charged between city funds had been allocated in earlier years.',
    what: 'This line appears in a single fiscal year of this series and records a correction to cost allocations made in earlier years -- an adjustment to how shared costs had been charged between the city\'s funds, recognised once when it was identified. It is a bookkeeping correction rather than new money, and it does not recur in any other year of this series.',
    tags: ['adjustment', 'accounting', 'one-time', 'revenue'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LIVE KEY -> CONCEPT, per city. Every key here was read out of production, not
// guessed; the loader re-derives the same list and aborts on any key it cannot
// find below.
// ═══════════════════════════════════════════════════════════════════════════
const KEYS = {
  Tacoma: {
    'current': 'current',
    'capital outlay': 'capitalOutlay',
    'capital expenditures': 'capitalOutlay',
    'debt service': 'debtService',
    'taxes': 'taxes',
    'licenses and permits': 'licensesPermits',
    'intergovernmental': 'intergovernmental',
    'intergovernmental revenue': 'intergovernmental',
    'intergovernmental revenues': 'intergovernmental',
    'charges for services': 'chargesForServices',
    'charges for goods and services': 'chargesForServices',
    'fines and forfeitures': 'finesForfeitures',
    'fines and forfeits': 'finesForfeitures',
    'fines and penalties': 'finesForfeitures',
    'miscellaneous': 'miscellaneous',
    'miscellaneous revenues': 'miscellaneous',
    'interest': 'investmentEarnings',
    'interest and other earnings': 'investmentEarnings',
    'investment earnings': 'investmentEarnings',
  },
  Spokane: {
    'current': 'current',
    'capital outlay': 'capitalOutlay',
    'capital outlays': 'capitalOutlay',
    'debt service': 'debtService',
    'taxes': 'taxes',
    'licenses and permits': 'licensesPermits',
    'intergovernmental': 'intergovernmental',
    'charges for services': 'chargesForServices',
    'fines and forfeitures': 'finesForfeitures',
    'miscellaneous': 'miscellaneous',
    'interest income': 'investmentEarnings',
    'net increase (decrease) in fair value of investments': 'fairValueChange',
    'net inc(dec) in market value of investments': 'fairValueChange',
  },
  Vancouver: {
    'current': 'current',
    'capital outlay': 'capitalOutlay',
    'debt service': 'debtService',
    'property taxes': 'propertyTaxes',
    'sales and use taxes': 'salesUseTaxes',
    'business & occupation taxes': 'businessOccupationTaxes',
    'excise taxes': 'exciseTaxes',
    'other taxes': 'otherTaxes',
    'license and permits': 'licensesPermits',
    'intergovernmental': 'intergovernmental',
    'charges for services': 'chargesForServices',
    'fines and forfeits': 'finesForfeitures',
    'fines and penalties': 'finesForfeitures',
    'miscellaneous': 'miscellaneous',
    'interest earnings': 'investmentEarnings',
    'investment earnings': 'investmentEarnings',
    'rents and royalties': 'rent',
    'contributions/donations': 'contributionsDonations',
    'prior period cost allocation adjustment': 'priorPeriodAdjustment',
  },
  Bellevue: {
    'current': 'current',
    'capital outlay': 'capitalOutlay',
    'debt service': 'debtService',
    'taxes and special assessments': 'taxesSpecialAssessments',
    'taxes & special assessments': 'taxesSpecialAssessments',
    'licenses and permits': 'licensesPermits',
    'licenses & permits': 'licensesPermits',
    'intergovernmental': 'intergovernmental',
    'service charges and fees': 'chargesForServices',
    'service charges & fees': 'chargesForServices',
    'fines and forfeitures': 'finesForfeitures',
    'fines & forfeitures': 'finesForfeitures',
    'other': 'miscellaneous',
    'net change in fair value of investments': 'fairValueChange',
    'rent': 'rent',
    'judgments and settlements': 'judgmentsSettlements',
    'judgments & settlements': 'judgmentsSettlements',
    'interest and assessment interest/penalties': 'assessmentInterestPenalties',
    'interest and penalties': 'assessmentInterestPenalties',
    'interest & penalties': 'assessmentInterestPenalties',
    'premiums/contributions': 'premiumsContributions',
  },
  Kent: {
    'current': 'current',
    'capital outlay': 'capitalOutlay',
    'debt service': 'debtService',
    'taxes': 'taxes',
    'licenses and permits': 'licensesPermits',
    'intergovernmental revenue': 'intergovernmental',
    'charges for services': 'chargesForServices',
    'fines and forfeitures': 'finesForfeitures',
    'miscellaneous revenue': 'miscellaneous',
  },
  Everett: {
    'current': 'current',
    'capital outlay': 'capitalOutlay',
    'debt service': 'debtService',
    'taxes': 'taxes',
    'licenses and permits': 'licensesPermits',
    'intergovernmental revenues': 'intergovernmental',
    'charges for services': 'chargesForServices',
    'fines and forfeits': 'finesForfeitures',
    'other revenues': 'miscellaneous',
    'rent and lease revenue': 'rent',
    'interest earnings': 'investmentEarnings',
    'unrealized gains/losses': 'fairValueChange',
  },
};

/** Build one city's map: key -> the enrichment row body, with that city's caveat. */
function mapFor(city) {
  const out = {};
  for (const [key, conceptName] of Object.entries(KEYS[city])) {
    const c = CONCEPT[conceptName];
    if (!c) throw new Error(`${city}: key "${key}" names unknown concept "${conceptName}"`);
    out[key] = {
      plain_name: c.plain_name,
      short_description: c.short_description,
      description: body(c.what, city),
      tags: c.tags,
      confidence: conceptName === 'priorPeriodAdjustment' ? 'medium' : CONF,
    };
  }
  return out;
}

export const TACOMA_ENRICHMENT = mapFor('Tacoma');
export const SPOKANE_ENRICHMENT = mapFor('Spokane');
export const VANCOUVER_ENRICHMENT = mapFor('Vancouver');
export const BELLEVUE_ENRICHMENT = mapFor('Bellevue');
export const KENT_ENRICHMENT = mapFor('Kent');
export const EVERETT_ENRICHMENT = mapFor('Everett');

export const TACOMA_EXPECTED_KEYS = Object.keys(KEYS.Tacoma).sort();
export const SPOKANE_EXPECTED_KEYS = Object.keys(KEYS.Spokane).sort();
export const VANCOUVER_EXPECTED_KEYS = Object.keys(KEYS.Vancouver).sort();
export const BELLEVUE_EXPECTED_KEYS = Object.keys(KEYS.Bellevue).sort();
export const KENT_EXPECTED_KEYS = Object.keys(KEYS.Kent).sort();
export const EVERETT_EXPECTED_KEYS = Object.keys(KEYS.Everett).sort();

/** The phrase every row must carry, asserted by the loader. */
export const CAVEAT_MARKER = 'These figures cover the General Fund only.';
