// NO SHEBANG — see scripts/lib/nyOsc.mjs.
/**
 * NY fund letter -> fund type for TOWNS, VILLAGES and COUNTIES, from OSC's
 * Accounting and Reporting Manual.
 *
 * Spec: docs/superpowers/specs/2026-10-19-ny-towns-villages-counties-design.md §4
 *
 * ⚠⚠ THE THIRD NY REGISTRY, AND IT IS A PARAMETER FOR A REASON. New York
 * publishes THREE manuals and the same letter does not mean the same thing in
 * all of them: `C` is a school district's GOVERNMENTAL food-service fund, a
 * city's absent code, and (here) the unused head of the `C_` Miscellaneous
 * family. Never reuse a registry across publications — see
 * scripts/data/nyOscFundPrefixes.mjs (cities) and
 * scripts/data/nyOscSchoolFundPrefixes.mjs (districts).
 *
 * ── ⚠⚠⚠ THE TABLE THIS IS READ FROM CANNOT BE READ WITH `pdftotext -layout` ──
 *
 * ARM ch. 5 "Classification and Coding" prints the authoritative fund/alpha-code
 * table on printed pages 18-19 (PDF page index 19-20). `-layout` emits the Fund
 * column and the Alpha Code column as two INDEPENDENT vertical runs that do not
 * line up row-for-row. Read naively it pairs `Highway-Part-Town` with `FX`,
 * `Road Machinery` with `G`, and `Special Districts` with `SF` — all wrong, all
 * plausible, none of them raising anything.
 *
 * Read by GLYPH Y-CENTRE instead (pdfplumber, 2.5pt tolerance) every row pairs
 * on one baseline:
 *
 *     y= 591.0  County Road@190           | D@412
 *     y= 604.1  Highway-Town-Wide@190     | DA@409
 *     y= 511.4  Workers' Compensation@161 | S@413
 *
 * ⭐ The alignment is confirmed TWENTY-FIVE WAYS: it reproduces every entry the
 * CITY registry derived independently from ch. 4 prose citations (CB CD CL CM
 * CP CR CT CU FX G L H PN V EA EE EF EH EI EL EM EP ER ES ET EW M MS TC TE K
 * W). A misaligned reading could not reproduce twenty-five known answers.
 *
 * ── ⚠⚠⚠ `S` IS NOT THE SPECIAL-DISTRICT FAMILY ─────────────────────────────
 *
 * `S_` is Special Districts and is GOVERNMENTAL. Bare `S` is Workers'
 * Compensation and is PROPRIETARY. It carries 6,214 revenue/expenditure lines
 * across all 31 years, in counties only. Classified by its letter it would
 * inflate every New York county's Total Governmental for the entire series,
 * tying at $0 against itself the whole way.
 *
 * ── ⚠ `SP` IS PARK AND `ST` IS PUBLIC PARKING ──────────────────────────────
 *
 * The opposite of the guess that `CP` = Parking and `EP` = Parking invite.
 *
 * ── ⚠⚠ `CS`, `EB`, `C`, `F` AND `T` ARE DELIBERATELY ABSENT ────────────────
 *
 * None is in the 2021 ARM. `CS` in particular has already been investigated at
 * length for the cities and the obvious fix (CS was renamed MS) TESTED AND
 * DISPROVED — see the note in scripts/data/nyOscFundPrefixes.mjs. Do not add
 * any of them without new evidence. Measured cost, FY1995-FY2025:
 *
 *     Town     808 of 28,480 entity-years (2.84%)   CS 807 · EB 3 · T 1
 *     Village  651 of 16,774 entity-years (3.88%)   CS 650 · F 1 · C 1
 *     County   171 of  1,766 entity-years (9.68%)   CS 166 · EB 5
 *
 * Every one of them is FY1995-FY2001. Those entity-years publish
 * `total_governmental` = `unknown` rather than a total that is silently short
 * or silently inflated. `general_fund` is unaffected.
 *
 * ── ⚠ ONE REGISTRY FOR ALL THREE CLASSES, NOT THREE ────────────────────────
 *
 * The ARM restricts some funds to one class, and those restrictions are
 * FALSIFIABLE. Tested across all 6.5M revenue/expenditure lines:
 *
 *     S  "can only be used by counties"   County 6,214 · Town 0 · Village 0  ✅
 *     DM "(County Only)"                  County 20,452 · else 0            ✅
 *     B, DB "(Town Only)"                 Town 259,199 / 210,738 · else 0   ✅
 *     D  "(County Only)"                  County 46,942 · TOWN 9            ⚠
 *     DA "(Town Only)"                    Town 519,264 · COUNTY 1           ⚠
 *
 * TEN lines in six and a half million break the rule. Both strays are
 * governmental funds, so neither changes a classification — but a per-class
 * registry would have blanked ten entity-years over a filer's typo on a fund
 * whose TYPE is not in doubt. Blanking is not free, so the registry is shared
 * and the restriction is recorded in the citation instead of enforced.
 */

const ARM4 = 'OSC Accounting and Reporting Manual ch. 4, Funds and Supplemental Schedules';
const ARM5 = 'OSC Accounting and Reporting Manual ch. 5, Classification and Coding, '
  + 'the fund/alpha-code table (printed pp. 18-19), read by glyph coordinates';

export const NY_MUNICIPAL_FUND_PREFIXES = Object.freeze({
  // ── Governmental: general ───────────────────────────────────────────────
  A: {
    type: 'general',
    name: 'General Fund',
    citation: `${ARM4}: "General Fund (A) — the principal operating fund of a local government. It includes all financial resources not accounted for and reported in another fund and is used to account for the ordinary day-to-day operations financed through taxes and other general revenues."`,
  },

  // ── Governmental: special revenue ────────────────────────────────────────
  //
  // ⚠ ARM ch. 4 states the rule for this whole block in one sentence: "Funds
  // that are legally mandated to be kept separately (e.g., town highway,
  // county road, county road machinery, town special districts, and sewer
  // funds) should be reported as special revenue funds."
  B: {
    type: 'special_revenue',
    name: 'General Fund Town-Outside-Village',
    citation: `${ARM4}, under "Special Revenue Funds include -": "General Fund Town-Outside-Village (B) — used by towns which contain a village(s) to record transactions which are required by statute to be charged to the area of the town outside the village(s)." TOWN ONLY, and measured so: 259,199 lines, all towns.`,
  },
  CB: {
    type: 'special_revenue',
    name: 'Housing Authority',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include Housing Authority (CB)…"`,
  },
  CD: {
    type: 'special_revenue',
    name: 'Special Grant',
    citation: `${ARM4}: "Special Grant Fund (CD) — accounts for federal and State grants such as Community Development Block Grants, the Workforce Investment Act and the Section 8 Rental Assistance Program."`,
  },
  CL: {
    type: 'special_revenue',
    name: 'Refuse and Garbage',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include … Refuse and Garbage (CL)"`,
  },
  CM: {
    type: 'special_revenue',
    name: 'Miscellaneous',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include … Miscellaneous (CM)"`,
  },
  CN: {
    type: 'special_revenue',
    name: 'Health Related Facilities',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include … Health Related Facilities (CN)". ⚠ ABSENT from the city registry — no city has ever filed one. Counties only here, 126 lines FY2008-2018.`,
  },
  CP: {
    type: 'special_revenue',
    name: 'Parking',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include … Parking (CP)"`,
  },
  CR: {
    type: 'special_revenue',
    name: 'Recreation',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include … Recreation (CR)"`,
  },
  CT: {
    type: 'special_revenue',
    name: 'Transportation',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include … Transportation (CT)"`,
  },
  CU: {
    type: 'special_revenue',
    name: 'Urban Renewal',
    citation: `${ARM4}: "Miscellaneous Funds (C_) include … Urban Renewal (CU)"`,
  },

  D: {
    type: 'special_revenue',
    name: 'County Road',
    citation: `${ARM4}: "County Road Fund (County Only) (D) — required by New York State Highway Law Section 114 and accounts for salaries and expenditures of the county highway superintendent's office, maintenance of county roads and bridges, snow removal and construction and reconstruction of county roads." ⚠ "County Only" is the manual's rule and NINE town lines (FY1995-1999) break it; the fund type is not in doubt either way.`,
  },
  DA: {
    type: 'special_revenue',
    name: 'Highway, Town-Wide',
    citation: `${ARM4}: "Highway Fund (Town Only) (DA/DB) — established pursuant to Highway Law Section 141 … For towns without a village, all transactions would be recorded in the highway town-wide fund (DA)." ⚠ ONE county line (FY1997) breaks the "Town Only" rule.`,
  },
  DB: {
    type: 'special_revenue',
    name: 'Highway, Part-Town',
    citation: `${ARM4}: "Highway Law Section 277 requires that expenditures for repairs and improvements be financed by the area outside the village (DB or also commonly referred to as the highway part-town fund) … a town with a village must maintain two highway funds, town-wide (DA) and part-town (DB)."`,
  },
  DM: {
    type: 'special_revenue',
    name: 'Road Machinery',
    citation: `${ARM4}: "Road Machinery Fund (County Only) (DM) — required by Highway Law Section 133 and accounts for purchases, repairs and maintenance of highway machinery, tools and equipment…" ⚠ Note the alternative the same paragraph offers: "In lieu of this fund, an internal service fund (M) may be used for machinery" — M is PROPRIETARY and excluded, DM is not.`,
  },

  FX: {
    type: 'special_revenue',
    name: 'Water',
    citation: `${ARM4}: "Water Fund (FX) — accounts for water operations as a governmental fund… Water operations may also be accounted for using an enterprise fund."`,
  },
  G: {
    type: 'special_revenue',
    name: 'Sewer',
    citation: `${ARM4}: "Sewer Fund (G) — accounts for sewer operations as a governmental fund… Sewer operations may also be accounted for using an enterprise fund."`,
  },
  L: {
    type: 'special_revenue',
    name: 'Public Library',
    citation: `${ARM4}: "Public Library Fund (L) — accounts for transactions of a library established and supported, in whole or in part, by real property taxes… New York State Education Law Section 259, which provides that all moneys received from taxes or other public sources for library purposes shall be kept in a separate fund."`,
  },

  // ── Governmental: special districts (S_) ─────────────────────────────────
  //
  // ⚠⚠ `S_` IS THE FAMILY. BARE `S` IS WORKERS' COMPENSATION AND IS
  // PROPRIETARY — it is declared far below, with the other proprietary funds,
  // deliberately NOT beside these.
  SD: {
    type: 'special_revenue',
    name: 'Special District — Drainage',
    citation: `${ARM4}: "Special District Funds (S_) include Drainage (SD), Fire Protection (SF), Lighting (SL), Miscellaneous (SM), Park (SP), Refuse and Garbage (SR), Sewer (SS), Public Parking (ST) and Water (SW) — account for those transactions for operation and maintenance of legally created special districts. A separate fund must be maintained for each special district."`,
  },
  SF: {
    type: 'special_revenue',
    name: 'Special District — Fire Protection',
    citation: `${ARM4}: Special District Funds (S_) … "Fire Protection (SF)"`,
  },
  SL: {
    type: 'special_revenue',
    name: 'Special District — Lighting',
    citation: `${ARM4}: Special District Funds (S_) … "Lighting (SL)"`,
  },
  SM: {
    type: 'special_revenue',
    name: 'Special District — Miscellaneous',
    citation: `${ARM4}: Special District Funds (S_) … "Miscellaneous (SM)"`,
  },
  SP: {
    type: 'special_revenue',
    name: 'Special District — Park',
    // ⚠ PARK, not Parking. ST is Public Parking. Confirmed on one baseline:
    // `Park@226 | SP@409` and `Public Parking@226 | ST@409`.
    citation: `${ARM4}: Special District Funds (S_) … "Park (SP)" — ⚠ Park, NOT Parking; Public Parking is ST.`,
  },
  SR: {
    type: 'special_revenue',
    name: 'Special District — Refuse and Garbage',
    citation: `${ARM4}: Special District Funds (S_) … "Refuse and Garbage (SR)"`,
  },
  SS: {
    type: 'special_revenue',
    name: 'Special District — Sewer',
    citation: `${ARM4}: Special District Funds (S_) … "Sewer (SS)"`,
  },
  ST: {
    type: 'special_revenue',
    name: 'Special District — Public Parking',
    citation: `${ARM4}: Special District Funds (S_) … "Public Parking (ST)" — ⚠ Public Parking, NOT Park; Park is SP.`,
  },
  SW: {
    type: 'special_revenue',
    name: 'Special District — Water',
    citation: `${ARM4}: Special District Funds (S_) … "Water (SW)"`,
  },

  // ── Governmental: the remaining three ───────────────────────────────────
  H: {
    type: 'capital_projects',
    name: 'Capital Projects',
    citation: `${ARM4}: "Capital Projects Fund (H) — used to account for and report financial resources that are restricted, committed or assigned to expenditure for capital outlays… A capital projects fund must be used if the acquisition or construction is financed in whole or in part from the proceeds of obligations."`,
  },
  V: {
    type: 'debt_service',
    name: 'Debt Service',
    citation: `${ARM5}: "Debt Service | V", printed under Governmental Funds.`,
  },
  PN: {
    type: 'permanent',
    name: 'Permanent',
    citation: `${ARM4}: "Permanent Fund (PN) — used to account for and report resources that are restricted to the extent that only earnings, not principal, may be used for purposes that benefit the local government or its residents."`,
  },

  // ── Proprietary — EXCLUDED from total_governmental ───────────────────────
  EA: { type: 'enterprise', name: 'Airports', citation: `${ARM4}: "Enterprise Funds (E_) include Airports (EA)…"` },
  EE: { type: 'enterprise', name: 'Electric Utilities', citation: `${ARM4}: "Enterprise Funds (E_) include … Electric Utilities (EE)"` },
  EF: { type: 'enterprise', name: 'Health Related Facilities', citation: `${ARM4}: "Enterprise Funds (E_) include … Health Related Facilities (EF)"` },
  EH: { type: 'enterprise', name: 'Hospitals', citation: `${ARM4}: "Enterprise Funds (E_) include … Hospitals (EH)"` },
  EI: { type: 'enterprise', name: 'Infirmaries', citation: `${ARM4}: "Enterprise Funds (E_) include … Infirmaries (EI)"` },
  EL: { type: 'enterprise', name: 'Refuse and Garbage', citation: `${ARM4}: "Enterprise Funds (E_) include … Refuse and Garbage (EL)"` },
  EM: { type: 'enterprise', name: 'Miscellaneous', citation: `${ARM4}: "Enterprise Funds (E_) include … Miscellaneous (EM)"` },
  EP: { type: 'enterprise', name: 'Parking', citation: `${ARM4}: "Enterprise Funds (E_) include … Parking (EP)"` },
  ER: { type: 'enterprise', name: 'Recreation', citation: `${ARM4}: "Enterprise Funds (E_) include … Recreation (ER)"` },
  ES: { type: 'enterprise', name: 'Sewer', citation: `${ARM4}: "Enterprise Funds (E_) include … Sewer (ES)"; "Sewer operations may also be accounted for using an enterprise fund."` },
  ET: { type: 'enterprise', name: 'Transportation', citation: `${ARM4}: "Enterprise Funds (E_) include … Transportation (ET)"` },
  EW: { type: 'enterprise', name: 'Water', citation: `${ARM4}: "Enterprise Funds (E_) include … Water (EW)"; "Water operations may also be accounted for using an enterprise fund."` },

  M: {
    type: 'internal_service',
    name: 'Internal Service',
    citation: `${ARM4}: "Internal Service Fund (M) — used to account for and report any activity that provides goods or services to other funds, departments or agencies of the primary government… on a cost reimbursement basis."`,
  },
  MS: {
    type: 'internal_service',
    name: 'Self-Insurance',
    citation: `${ARM4}, printed inside the Proprietary Funds block between Internal Service and the Fiduciary heading: "Self-Insurance (MS) — accounts for insurance coverage when the governing body has decided to have a self-insurance program on an actuarial basis."`,
  },
  S: {
    // ⚠⚠⚠ READ THE MODULE HEADER BEFORE TOUCHING THIS ENTRY. It is one letter
    // away from the governmental S_ family and it is NOT part of it.
    type: 'internal_service',
    name: "Workers' Compensation",
    citation: `${ARM4}, the entry immediately after Self-Insurance and inside the Proprietary Funds block: "Workers Compensation Fund (S) — used to account for workers' compensation risk-sharing pools. This fund can only be used by counties and should be reported as an internal service fund." ⭐ The restriction is corroborated by the data without exception: 6,214 revenue/expenditure lines, every one of them a county, in all 31 years.`,
  },

  // ── Fiduciary — EXCLUDED ─────────────────────────────────────────────────
  TC: {
    type: 'fiduciary',
    name: 'Custodial',
    citation: `${ARM4}: "Custodial Fund (TC) — used to account for any remaining fiduciary activities that are not required to be reported in a private-purpose trust fund."`,
  },
  TE: {
    type: 'fiduciary',
    name: 'Private-Purpose Trust',
    citation: `${ARM4}: "Private-Purpose Trust Fund (TE) — used to account for trust arrangements where the government itself is not a beneficiary…"`,
  },
  TA: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM4}: "Fiduciary funds are provided to account for moneys received by the local government which must be held for purposes other than operation of the local government or which must be paid to other governments or persons." ⚠ NOT OBSERVED in the town, village or county archives (0 lines); carried because the city registry carries it on the same citation and a future appearance should classify rather than blank.`,
  },
  TN: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM4}: Fiduciary Funds — "moneys received by the local government which must be held…". A retired code: Town FY1995-2002, Village FY1995-2003, County FY1995-2001.`,
  },
  TX: {
    type: 'fiduciary',
    name: 'Trust and Agency',
    citation: `${ARM4}: Fiduciary Funds — "moneys received by the local government which must be held…". A retired code: Town FY1995-2002, Village FY1995-2003, County FY1995-2002.`,
  },

  // ── Not funds at all — EXCLUDED ──────────────────────────────────────────
  //
  // ⚠ K and W appear ONLY in balance-sheet rows, which the section filter in
  // readYear() already drops. They are declared so nobody "fixes" their
  // absence by inventing a fund.
  K: {
    type: 'schedule',
    name: 'Schedule of Non-Current Governmental Assets',
    citation: `${ARM4}: "Non-Current Governmental Assets (K) — used to account for capital assets of a government not accounted for through specific proprietary funds or fiduciary funds and their related accumulated depreciation."`,
  },
  W: {
    type: 'schedule',
    name: 'Schedule of Non-Current Governmental Liabilities',
    citation: `${ARM4}: "Non-Current Governmental Liabilities (W) — used to account for the unmatured general long-term debt and liabilities of a government which is not recorded as a liability in another fund."`,
  },
});

/**
 * The fund types that make up `total_governmental`.
 *
 * ⚠ Identical membership to the cities' set, and separately declared on
 * purpose: the two publications are allowed to diverge, and a shared constant
 * would make a future divergence invisible.
 */
export const MUNICIPAL_GOVERNMENTAL_TYPES = Object.freeze(new Set([
  'general', 'special_revenue', 'capital_projects', 'debt_service', 'permanent',
]));
