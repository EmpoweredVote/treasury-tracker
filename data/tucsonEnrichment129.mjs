// Phase 129 Plan 03 — Tucson category enrichment concept map (inline-authored, $0; NO paid API).
//
// Explicit hand-authored map keyed by exact budget_categories.link_key (== name_key), one entry
// per key this plan is responsible for authoring. Two scopes:
//   - scope: 'universal'  -> written with municipality_id = NULL (shareable GAAP/CAFR concept,
//     generic text, no $ figures, no city/entity names).
//   - scope: 'tucson'     -> written with municipality_id = <Tucson id> (era-specific/ambiguous
//     labels that are Tucson's own printed-statement quirk, not a general concept).
//
// Keys NOT in this map may still be "covered" if a prior loader (e.g. CA parity / MN / Ohio)
// already shipped a generic universal row for that exact name_key — the loader's coverage gate
// checks the live DB first, and only consults this map for keys not already covered. This map is
// intentionally NOT exhaustive over Tucson's full live worklist; it is exhaustive over the residual
// this plan must author.
export const TUCSON_ENRICHMENT = {
  'current': {
    scope: 'universal',
    plain_name: 'Current Operations',
    short_description: 'Day-to-day government operating costs, distinct from capital outlay and debt service.',
    description: "The Governmental Funds Statement's \"Current\" classification covers ordinary, recurring operating costs — public safety, general government, and other year-to-year departmental spending — as opposed to one-time capital construction (Capital Outlay/Capital Projects) or long-term debt payments (Debt Service). It is typically the largest expenditure category in a general fund.",
    tags: ['operations', 'general-fund', 'expenditures'],
    confidence: 'high',
  },
  'use of money and property': {
    scope: 'universal',
    plain_name: 'Investment & Property Income',
    short_description: 'Income earned on invested cash and property, such as interest and rents.',
    description: "Revenue earned from the government's own financial and physical assets — interest earned on invested cash balances, along with rents, royalties, and other income from government-owned property. This revenue can rise or fall with interest rates and market conditions.",
    tags: ['revenue', 'investment-income', 'interest'],
    confidence: 'high',
  },
  'federal grants and contributions': {
    scope: 'universal',
    plain_name: 'Federal Grants',
    short_description: 'Money the federal government sends for specific programs and services.',
    description: 'Revenue passed through from the federal government to fund specific programs, services, or projects — typically restricted to the purpose for which it was granted. Federal grant funding can vary year to year based on program eligibility and federal appropriations.',
    tags: ['revenue', 'intergovernmental', 'federal-grants'],
    confidence: 'high',
  },
  'other agencies': {
    scope: 'universal',
    plain_name: 'Other Government Agencies',
    short_description: 'Revenue received from other government agencies for shared programs or services.',
    description: 'Intergovernmental revenue received from other government agencies — such as state, county, or partner-agency reimbursements for shared programs, services, or joint projects. Distinct from federal grants, which are tracked separately.',
    tags: ['revenue', 'intergovernmental'],
    confidence: 'medium',
  },
  'contributions from outside sources': {
    scope: 'universal',
    plain_name: 'Outside Contributions',
    short_description: 'Donations and contributions from private or non-governmental sources.',
    description: 'Revenue from private donations, sponsorships, or contributions from non-governmental outside parties — supporting specific programs, events, or projects rather than general operations. Usually a small share of total revenue.',
    tags: ['revenue', 'contributions', 'donations'],
    confidence: 'medium',
  },
  // Tucson-scoped: era-specific merged/ambiguous printed-statement labels (128-02 deferred item).
  // Not a general concept — a single fiscal year's statement combined two normally-separate lines.
  'contributions from outside miscellaneous': {
    scope: 'tucson',
    plain_name: 'Outside Contributions & Miscellaneous',
    short_description: "A combined revenue line for outside contributions and miscellaneous receipts in this year's statement.",
    description: "In this fiscal year's printed statement, the \"Contributions from Outside\" and \"Miscellaneous\" revenue lines were combined into a single reported figure rather than shown separately, as in most other years. This is a presentation choice by the source document, not a change in what the money is for.",
    tags: ['revenue', 'contributions', 'miscellaneous'],
    confidence: 'medium',
  },
  'developer fees - - use of money and property': {
    scope: 'tucson',
    plain_name: 'Developer Fees & Property Income',
    short_description: "A combined revenue line for developer fees and investment/property income in this year's statement.",
    description: "In this fiscal year's printed statement, \"Developer Fees\" and \"Use of Money and Property\" (investment and rental income) were combined into a single reported revenue line rather than shown separately, as in most other years. This is a presentation choice by the source document, not a change in what the money is for.",
    tags: ['revenue', 'developer-fees', 'investment-income'],
    confidence: 'medium',
  },
};

export const EXPECTED_KEYS = Object.keys(TUCSON_ENRICHMENT);
