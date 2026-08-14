// Task 12 -- Seattle, WA + King County, WA category enrichment (inline-authored, $0; NO paid API).
//
// Explicit hand-authored maps keyed by exact treasury.budget_categories.link_key
// (== category_enrichment.name_key). Every row here is written SCOPED to one
// municipality_id -- never NULL/universal -- because the category_enrichment
// unique index is NULLS DISTINCT (a NULL-scoped row is treated as a universal
// default and bleeds onto every other city in the app; see auto-memory
// reference_category_enrichment_nulls_distinct.md). Seattle and King County
// share several economic-concept names (e.g. "taxes", "charges for services"),
// but each gets its OWN row under its own municipality_id with entity-specific
// copy (fund-scope caveat text differs; Seattle's FY2018 structural-break note
// is Seattle-only).
//
// Era-label variants: the same underlying revenue source is sometimes reported
// under two or three different printed-statement labels across fiscal years.
// Every variant key gets its own row so every year renders an explanation, and
// the copy is IDENTICAL/consistent across variants so a reader comparing two
// fiscal years does not see the same source described two different ways:
//   - Seattle: "concessions, parking fees and space rent" (no Oxford comma,
//     used in later years) / "concessions, parking fees, and space rent"
//     (with the Oxford comma) / "parking fees and space rent" (the shorter
//     FY2009-era form) are the SAME source.
//   - King County: "investment gains" / "investment gains (losses)" are the
//     SAME source (the wording changed year to year; the concept did not).
//
// Content rules followed throughout (no exceptions):
//   1. No `$` figures, no year-specific dollar amounts -- rows are reused
//      across 17 (Seattle) / 8 (King County) fiscal years and a hardcoded
//      number would go stale silently.
//   2. No locality bleed -- Seattle rows never mention King County (or any
//      other city/county); King County rows never mention Seattle.
//   3. The General-Fund-only fund-scope caveat appears on all three depth-0
//      OPERATING categories (current / capital outlay / debt service) for
//      each entity, using each entity's own named non-GF funds.
//   4. Seattle's FY2018 General-Fund jump (Department of Education and Early
//      Learning Fund converted INTO the General Fund that year -- FY2018
//      ACFR Note 17, p.149; fund description p.173) is noted ONLY on
//      Seattle's `current` row. No equivalent claim is made for King County
//      (its largest year-over-year move was under 15%, i.e. not a structural
//      break worth flagging).

const SEATTLE_GF_CAVEAT =
  'These figures cover the General Fund only. Seattle also operates City ' +
  'Light, Seattle Public Utilities and a major Transportation fund outside ' +
  'the General Fund, so this reflects roughly a quarter of total city spending.';

const KING_COUNTY_GF_CAVEAT =
  "These figures cover the General Fund only. King County's Metro Transit " +
  'and wastewater treatment operate as enterprise funds outside the General ' +
  'Fund and are not included here.';

export const SEATTLE_ENRICHMENT = {
  // ── Operating (3) ──────────────────────────────────────────────────────
  'current': {
    plain_name: 'Current Operations',
    short_description: 'Day-to-day General Fund operating costs -- police, fire, parks, libraries and other city departments -- distinct from capital projects and debt payments.',
    description:
      'The "Current" classification in Seattle\'s General Fund covers ordinary, recurring departmental operating spending -- public safety, parks and recreation, libraries, general government and other year-to-year city services -- as opposed to one-time capital construction (Capital Outlay) or long-term debt payments (Debt Service). It is the largest expenditure category in the General Fund in most years.\n\n' +
      SEATTLE_GF_CAVEAT + '\n\n' +
      "Seattle's General Fund operating total rises sharply between FY2017 and FY2018. This is not a data error: the city's Department of Education and Early Learning Fund was converted into the General Fund that year, as documented in Seattle's FY2018 Annual Comprehensive Financial Report (Note 17).",
    tags: ['operations', 'general-fund', 'expenditures', 'seattle'],
    confidence: 'high',
  },
  'capital outlay': {
    plain_name: 'Capital Outlay',
    short_description: 'One-time General Fund spending on capital projects and equipment, distinct from day-to-day operations.',
    description:
      'Capital Outlay covers General Fund spending on capital projects, land, buildings and major equipment purchases -- one-time investments rather than recurring operating costs. It is typically much smaller than Current operating spending because Seattle finances most large capital projects (streets, utilities, parks capital work) through dedicated capital funds and bond proceeds outside the General Fund.\n\n' +
      SEATTLE_GF_CAVEAT,
    tags: ['expenditures', 'capital-outlay', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'debt service': {
    plain_name: 'Debt Service',
    short_description: "General Fund payments of principal and interest on the city's outstanding debt.",
    description:
      "Debt Service covers General Fund payments of principal and interest on bonds and other long-term debt the city has issued. It reflects the cost of past borrowing, not current-year operating or capital decisions -- and rises or falls as the city issues new debt or pays down existing obligations.\n\n" +
      SEATTLE_GF_CAVEAT,
    tags: ['expenditures', 'debt-service', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  // ── Revenue (9, including 3 era-label variants of one source) ───────────
  'taxes': {
    plain_name: 'Taxes',
    short_description: 'General Fund tax revenue -- property, sales, business and utility taxes collected citywide.',
    description:
      "The largest revenue source for Seattle's General Fund, combining property taxes, retail sales taxes, the business and occupation tax, and utility taxes the city levies on its own and private utilities. From FY2021 forward, Seattle's financial statements break this total out by individual tax type; in earlier years it is reported as a single combined figure.",
    tags: ['revenue', 'taxes', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'licenses and permits': {
    plain_name: 'Licenses & Permits',
    short_description: 'Fees charged for business licenses, building permits and other regulatory permits.',
    description:
      'Revenue from fees the city charges for business licenses, construction and building permits, and other regulatory approvals. This revenue tends to track the pace of local business activity and construction.',
    tags: ['revenue', 'licenses', 'permits', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'grants, shared revenues, and contributions': {
    plain_name: 'Grants, Shared Revenues & Contributions',
    short_description: 'Money the General Fund receives from federal, state and other government sources, plus outside contributions.',
    description:
      "Intergovernmental revenue the General Fund receives from federal and state grants, state-shared revenues (the state's share of certain taxes distributed to cities), and contributions from other outside sources. This category can vary from year to year based on grant awards and state appropriations.",
    tags: ['revenue', 'intergovernmental', 'grants', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'charges for services': {
    plain_name: 'Charges for Services',
    short_description: 'Fees the city charges for services it provides directly, such as recreation programs, permit review and other city services billed to users.',
    description:
      'Revenue from fees charged for specific General Fund services the city provides -- for example, recreation program fees, plan review and inspection charges, and other services billed directly to the people or businesses that use them, as opposed to general tax revenue.',
    tags: ['revenue', 'charges-for-services', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'fines and forfeits': {
    plain_name: 'Fines & Forfeits',
    short_description: 'Revenue from traffic and parking fines, code-violation penalties, and forfeited property.',
    description:
      'Revenue from fines and penalties -- including traffic and parking citations, municipal code violations, and forfeited cash or property from court proceedings. This is typically a small share of total General Fund revenue.',
    tags: ['revenue', 'fines', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'program income, interest, and miscellaneous revenues': {
    plain_name: 'Program Income, Interest & Miscellaneous',
    short_description: "Interest earnings on invested cash plus other revenue that doesn't fit the city's other named categories.",
    description:
      "A combined revenue line covering interest earned on the city's invested General Fund cash balances, income from specific city programs, and other miscellaneous revenue that does not fit elsewhere in the city's revenue classification. Because it bundles several smaller sources, it can move with both interest-rate conditions and one-off receipts.",
    tags: ['revenue', 'interest', 'miscellaneous', 'general-fund', 'seattle'],
    confidence: 'medium',
  },
  // Era-label variants of the SAME revenue source -- identical copy on purpose.
  'concessions, parking fees and space rent': {
    plain_name: 'Concessions, Parking Fees & Space Rent',
    short_description: 'Revenue from parking fees, concession agreements and rent for city-owned space.',
    description:
      'Revenue from parking fees, revenue-sharing concession agreements (such as vendors operating on city property), and rent charged for space in city-owned buildings and facilities. Seattle\'s financial statements have used slightly different wording for this same revenue source across years -- "Parking Fees and Space Rent" in early years, and "Concessions, Parking Fees and Space Rent" (with or without an Oxford comma) in later years -- but it is the same underlying revenue source in every case.',
    tags: ['revenue', 'parking', 'concessions', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'concessions, parking fees, and space rent': {
    plain_name: 'Concessions, Parking Fees & Space Rent',
    short_description: 'Revenue from parking fees, concession agreements and rent for city-owned space.',
    description:
      'Revenue from parking fees, revenue-sharing concession agreements (such as vendors operating on city property), and rent charged for space in city-owned buildings and facilities. Seattle\'s financial statements have used slightly different wording for this same revenue source across years -- "Parking Fees and Space Rent" in early years, and "Concessions, Parking Fees and Space Rent" (with or without an Oxford comma) in later years -- but it is the same underlying revenue source in every case.',
    tags: ['revenue', 'parking', 'concessions', 'general-fund', 'seattle'],
    confidence: 'high',
  },
  'parking fees and space rent': {
    plain_name: 'Concessions, Parking Fees & Space Rent',
    short_description: 'Revenue from parking fees, concession agreements and rent for city-owned space.',
    description:
      'Revenue from parking fees, revenue-sharing concession agreements (such as vendors operating on city property), and rent charged for space in city-owned buildings and facilities. Seattle\'s financial statements have used slightly different wording for this same revenue source across years -- "Parking Fees and Space Rent" in early years, and "Concessions, Parking Fees and Space Rent" (with or without an Oxford comma) in later years -- but it is the same underlying revenue source in every case.',
    tags: ['revenue', 'parking', 'concessions', 'general-fund', 'seattle'],
    confidence: 'high',
  },
};

export const KING_COUNTY_ENRICHMENT = {
  // ── Operating (3) ──────────────────────────────────────────────────────
  'current': {
    plain_name: 'Current Operations',
    short_description: 'Day-to-day General Fund operating costs -- sheriff, courts, elections, public health and other county departments -- distinct from capital projects and debt payments.',
    description:
      'The "Current" classification in King County\'s General Fund covers ordinary, recurring departmental operating spending -- law and justice, general government, public health and other year-to-year county services -- as opposed to one-time capital construction (Capital Outlay) or long-term debt payments (Debt Service). It is the largest expenditure category in the General Fund in most years.\n\n' +
      KING_COUNTY_GF_CAVEAT,
    tags: ['operations', 'general-fund', 'expenditures', 'king-county'],
    confidence: 'high',
  },
  'capital outlay': {
    plain_name: 'Capital Outlay',
    short_description: 'One-time General Fund spending on capital projects and equipment, distinct from day-to-day operations.',
    description:
      "Capital Outlay covers General Fund spending on capital projects, land, buildings and major equipment purchases -- one-time investments rather than recurring operating costs. King County finances most large capital projects, including its transit and wastewater infrastructure, through dedicated enterprise and capital funds outside the General Fund.\n\n" +
      KING_COUNTY_GF_CAVEAT,
    tags: ['expenditures', 'capital-outlay', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'debt service': {
    plain_name: 'Debt Service',
    short_description: "General Fund payments of principal and interest on the county's outstanding debt.",
    description:
      "Debt Service covers General Fund payments of principal and interest on bonds and other long-term debt King County has issued. It reflects the cost of past borrowing, not current-year operating or capital decisions -- and rises or falls as the county issues new debt or pays down existing obligations.\n\n" +
      KING_COUNTY_GF_CAVEAT,
    tags: ['expenditures', 'debt-service', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  // ── Revenue (9, including 2 era-label variants of one source) ───────────
  'taxes': {
    plain_name: 'Taxes',
    short_description: 'General Fund tax revenue -- property, sales and other taxes collected countywide.',
    description:
      "The largest revenue source for King County's General Fund, primarily property taxes plus the county's share of sales and other local taxes. Property tax revenue for Washington counties is subject to state-law limits on annual growth.",
    tags: ['revenue', 'taxes', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'licenses and permits': {
    plain_name: 'Licenses & Permits',
    short_description: 'Fees charged for licenses and permits the county issues, such as building and land-use permits in unincorporated areas.',
    description:
      'Revenue from fees the county charges for licenses and permits it issues -- including building and land-use permits in unincorporated King County. This revenue tends to track the pace of development activity.',
    tags: ['revenue', 'licenses', 'permits', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'intergovernmental revenues': {
    plain_name: 'Intergovernmental Revenues',
    short_description: 'Money the General Fund receives from federal, state and other government sources.',
    description:
      "Revenue the General Fund receives from federal and state grants and state-shared revenues -- for example, the state's distribution of certain taxes or program funding passed through to the county. This category can vary from year to year based on grant awards and state appropriations.",
    tags: ['revenue', 'intergovernmental', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'charges for services': {
    plain_name: 'Charges for Services',
    short_description: 'Fees the county charges for services it provides directly, such as recording documents, court services and other county services billed to users.',
    description:
      'Revenue from fees charged for specific General Fund services the county provides -- for example, recording and licensing fees, court-related charges, and other services billed directly to the people or businesses that use them, as opposed to general tax revenue.',
    tags: ['revenue', 'charges-for-services', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'fines and forfeits': {
    plain_name: 'Fines & Forfeits',
    short_description: 'Revenue from court fines, code-violation penalties, and forfeited property.',
    description:
      "Revenue from fines and penalties imposed through the county's courts and code-enforcement processes, along with forfeited cash or property from legal proceedings. This is typically a small share of total General Fund revenue.",
    tags: ['revenue', 'fines', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'interest earnings': {
    plain_name: 'Interest Earnings',
    short_description: "Interest income earned on the county's invested General Fund cash balances.",
    description:
      "Revenue earned from interest on the county's invested cash balances. This revenue rises and falls with prevailing interest rates and the size of the balances the county has on hand to invest, independent of tax policy or service levels.",
    tags: ['revenue', 'interest', 'investment-income', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  // Era-label variants of the SAME revenue source -- identical copy on purpose.
  'investment gains': {
    plain_name: 'Investment Gains (Losses)',
    short_description: "Gains or losses on the market value of the county's investment portfolio, separate from interest earnings.",
    description:
      'Reflects the change in market value of securities held in King County\'s investment portfolio -- a gain when the portfolio\'s value rises, a loss when it falls -- separate from the interest income reported under Interest Earnings. Because it tracks market prices, this figure can swing between positive and negative from year to year and is reported as "Investment Gains" in some years and "Investment Gains (Losses)" in others; both labels refer to the same line.',
    tags: ['revenue', 'investment-gains', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'investment gains (losses)': {
    plain_name: 'Investment Gains (Losses)',
    short_description: "Gains or losses on the market value of the county's investment portfolio, separate from interest earnings.",
    description:
      'Reflects the change in market value of securities held in King County\'s investment portfolio -- a gain when the portfolio\'s value rises, a loss when it falls -- separate from the interest income reported under Interest Earnings. Because it tracks market prices, this figure can swing between positive and negative from year to year and is reported as "Investment Gains" in some years and "Investment Gains (Losses)" in others; both labels refer to the same line.',
    tags: ['revenue', 'investment-gains', 'general-fund', 'king-county'],
    confidence: 'high',
  },
  'miscellaneous revenues': {
    plain_name: 'Miscellaneous Revenues',
    short_description: "Other General Fund revenue that doesn't fit the county's other named categories.",
    description:
      "A catch-all revenue line covering General Fund receipts that don't fit elsewhere in the county's revenue classification -- such as one-off reimbursements or minor recurring receipts. Because it bundles several smaller, unrelated sources, it can vary from year to year.",
    tags: ['revenue', 'miscellaneous', 'general-fund', 'king-county'],
    confidence: 'medium',
  },
};

export const SEATTLE_EXPECTED_KEYS = Object.keys(SEATTLE_ENRICHMENT);
export const KING_COUNTY_EXPECTED_KEYS = Object.keys(KING_COUNTY_ENRICHMENT);
