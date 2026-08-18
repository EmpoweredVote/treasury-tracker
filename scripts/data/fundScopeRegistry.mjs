/**
 * SCOPE-01 source→scope registry.
 *
 * One entry per source family. Each entry carries the independent document it was
 * reconciled against; `scripts/lib/fundScope.mjs` refuses to classify from an
 * entry whose `evidence` is missing or a placeholder, so an unevidenced claim is
 * structurally incapable of reaching the database.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * ── HOW TO ADD AN ENTRY ─────────────────────────────────────────────────────
 * An entry is created when its evidence is, never before. Do NOT pre-write
 * entries "ready to fill in": a `scope` sitting next to `evidence: null` is a
 * guess waiting for someone to delete a null, and the whole milestone exists
 * because that guess was already made once.
 *
 *   1. Reconcile ONE entity-year against an independent document.
 *   2. Write the reconciliation into docs/superpowers/plans/SCOPE-01-RECON.md.
 *   3. Add the entry here, `evidence.document` naming that document and
 *      `evidence.figures` carrying the figures that actually matched.
 *   4. Commit alone, so a wrong classification is revertible by itself.
 *
 * ⚠ MATCH PATTERNS ARE ANCHORED TO EXACT STRINGS, deliberately. `/^CA State
 * Controller/` looks reasonable and is a bug: it also claims 7,682
 * publicpay.ca.gov salaries rows that no reconciliation covers. A pattern that
 * claims more rows than SCOPE-01-RECON.md §1.2 records is over-matching — fix the
 * pattern, do not accept the count.
 *
 * ⚠ ORDER IS PRECEDENCE. `classify()` takes the first match, so a specific
 * pattern must sit above a more general one.
 *
 * Evidence of record: docs/superpowers/plans/SCOPE-01-RECON.md
 */

import { SCOPE } from '../lib/fundScope.mjs';

/** @type {import('../lib/fundScope.mjs').RegistryEntry[]} */
export const FUND_SCOPE_REGISTRY = [
  {
    id: 'ca-sco-city-exp',
    match: /^CA State Controller - Expenditures$/,
    scope: SCOPE.ALL_FUNDS,
    evidence: {
      document: 'City of Modesto FY2024 ACFR (via CA-CITIES-01 Task 6; CA-CITIES-01-RECON.md)',
      figures: 'ACFR Total Governmental $291,641,122 + SCO enterprise & ISF $296,400,946 '
             + '= $588,042,068, equal to SCO\'s reported total $588,042,068 — ties to the dollar. '
             + 'ACFR General Fund alone is $191,311,703, so the SCO figure is NOT General Fund. '
             + 'Corroborated structurally: SCO\'s Modesto FY2024 tree carries Water, Sewer, Solid '
             + 'Waste, Airport and Other Enterprise Funds plus an Internal Service Fund at root '
             + 'level, all outside the General Fund.',
    },
  },

  {
    id: 'ca-sco-city-rev',
    match: /^CA State Controller - Revenues$/,
    scope: SCOPE.ALL_FUNDS,
    evidence: {
      document: 'City of Modesto FY2024 ACFR, governmental-funds Statement of Revenues, '
              + 'Expenditures and Changes in Fund Balances (docs/Modesto/modesto-fy2024.pdf p.81)',
      figures: 'ACFR Total Governmental revenue $322,089,879 + SCO enterprise & ISF revenue '
             + '$321,804,947 (Internal Service 117,449,007 + Water 92,984,900 + Sewer 74,992,280 '
             + '+ Solid Waste 17,525,194 + Other 16,688,643 + Airport 2,164,923) = $643,894,826, '
             + 'equal to SCO\'s reported total $643,894,826 — ties to the dollar. ACFR General '
             + 'Fund revenue alone is $225,256,710, so the SCO figure is NOT General Fund. The '
             + 'PDF\'s five governmental columns sum internally to 322,089,879, confirming the '
             + 'Total Governmental column was read correctly.',
    },
  },

  {
    id: 'ca-sco-county-exp',
    match: /^CA State Controller - County Expenditures$/,
    scope: SCOPE.ALL_FUNDS,
    evidence: {
      document: 'County of Stanislaus FY2024 ACFR, governmental-funds Statement of Revenues, '
              + 'Expenditures and Changes in Fund Balances, p.23 '
              + '(docs/StanislausCounty/stanislaus-county-fy2024.pdf)',
      figures: 'ACFR Total Governmental expenditures $1,194,047,359 + SCO enterprise & ISF '
             + '$207,325,063 (Internal Service 150,843,496 + Hospital 34,690,202 + Solid Waste '
             + '14,472,400 + Other 7,318,965) = $1,401,372,422 vs SCO\'s reported total '
             + '$1,401,372,428 — a $6 difference on $1.4bn (0.0000%). ACFR General Fund '
             + 'expenditures alone are $391,233,183, 72.1% below the SCO figure. Candidate '
             + 'scopes: all_funds off by 0.0000%, total_governmental by 14.79%, general_fund by '
             + '72.08%. The ACFR\'s six governmental columns sum internally to 1,194,047,359, '
             + 'confirming the Total Governmental column was read correctly.',
    },
  },

  {
    id: 'ca-sco-county-rev',
    match: /^CA State Controller - County Revenues$/,
    scope: SCOPE.ALL_FUNDS,
    // ⚠ The ONLY entry in this registry that does not rest on a dollar tie. It
    // rests on structural evidence plus a 0.55% residue decomposed to the line.
    // See RECON §4.3 for the full argument and how to overturn it.
    evidence: {
      document: 'County of Stanislaus FY2024 ACFR, governmental-funds Statement of Revenues, '
              + 'Expenditures and Changes in Fund Balances, p.23 '
              + '(docs/StanislausCounty/stanislaus-county-fy2024.pdf)',
      figures: 'ACFR Total Governmental revenue $1,201,293,821 + SCO enterprise & ISF revenue '
             + '$218,811,429 = $1,420,105,250 vs SCO\'s reported total $1,427,912,802 — a '
             + '$7,807,552 residue, 0.547%. NOT a dollar tie, but decisive between candidates: '
             + 'all_funds off by 0.547%, total_governmental by 15.87%, general_fund by 67.04%. '
             + 'The residue decomposes across seven revenue taxonomies with MIXED signs (5 SCO-'
             + 'higher, 3 SCO-lower) — the signature of reclassification between two schedules, '
             + 'not of an absent fund: Intergovernmental +8,859,881, Special Benefit Assessments '
             + '+4,364,511 (no ACFR counterpart line), Taxes +1,333,566, Fines +332,469, Use of '
             + 'money +105,356, Licenses -17,922, Miscellaneous -3,166,533, Charges -4,003,776. '
             + 'Structural evidence, independent of the arithmetic: the stored SCO row carries '
             + 'Internal Service $153,803,323, Hospital Enterprise $40,685,163, Solid Waste '
             + 'Enterprise $18,055,105 and Other Enterprise $6,267,838 as ROOT categories — '
             + '$218.8M of funds that cannot appear in a General Fund figure.',
    },
  },

  {
    id: 'state-acfr-gf',
    match: / State ACFR — General Fund/,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'TWO independent state ACFRs, both the governmental-funds Statement of Revenues, '
              + 'Expenditures and Changes in Fund Balances: State of Utah FY2024 '
              + '(docs/Utah/utah-state-fy2024-acfr.pdf p.43) and State of Connecticut FY2024 '
              + '(docs/Connecticut/ct-state-fy2024-acfr.pdf p.36). Both expressed in thousands.',
      figures: 'UTAH FY2024 — printed General Fund column: Total Revenues 11,209,884 and Total '
             + 'Expenditures 12,493,247 (thousands), matching the stored $11,209,884,000 and '
             + '$12,493,247,000 EXACTLY. Its Total Governmental columns are 23,669,654 and '
             + '22,596,317, so the stored figure is 47.4% / 55.3% of total governmental. '
             + 'CONNECTICUT FY2024 — printed General column: Total Revenues 25,084,660 and Total '
             + 'Expenditures 23,588,666 (thousands), matching the stored $25,084,660,000 and '
             + '$23,588,666,000 EXACTLY. Its Total Governmental columns are 38,395,042 and '
             + '39,662,421, so the stored figure is 65.3% / 59.5% of total governmental. '
             + 'In both documents the General Fund is the FIRST numeric column. Utah was chosen '
             + 'deliberately as the cohort\'s flagged-complication state — its income-tax revenue '
             + 'is constitutionally earmarked into a separate major fund (Income Tax, 8,095,776) '
             + 'that the printed General Fund column excludes — and Connecticut as an ordinary '
             + 'one, so the mold is confirmed on both the hard and the easy case.',
    },
  },

  {
    id: 'wa-sao',
    match: /^WA State Auditor — /,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'TWO WA entities, each its Statement of Revenues, Expenditures and Changes in Fund '
              + 'Balance — Governmental Funds: City of Spokane FY2019 '
              + '(docs/Spokane/spokane-2019-acfr.pdf) and City of Tacoma FY2019 '
              + '(docs/Tacoma/tacoma-2019-acfr.pdf). NOTE: these filings ARE the source the '
              + 'loader read from portal.sao.wa.gov, so the reconciliation is not against a '
              + 'second reporter — it establishes WHICH COLUMN of the statement the stored figure '
              + 'is, which is the question that decides scope. Same method as state-acfr-gf.',
      figures: 'SPOKANE FY2019 (whole dollars, FY ends Dec 31) — printed General Fund column: '
             + 'Total Revenues 225,490,050 and Total Expenditures 181,995,259, matching the stored '
             + 'figures EXACTLY. Total Governmental columns are 339,439,583 and 342,378,490, so '
             + 'the stored figure is 66.4% / 53.2% of total governmental; the columns sum exactly '
             + '(225,490,050 + 5,966,857 + 107,982,676 = 339,439,583). Independently corroborated '
             + 'by the same document\'s budgetary comparison schedule, whose ACTUAL column reads '
             + 'the same two figures. '
             + 'TACOMA FY2019 (thousands) — printed "General Fund #0010" column: Total Revenues '
             + '210,733 and Total Expenditures 227,841, matching the stored $210,733,000 and '
             + '$227,841,000 EXACTLY. Total Governmental Funds columns are 341,682 and 376,377, '
             + 'so 61.7% / 60.5%; columns sum exactly. The two probes print in DIFFERENT units '
             + '(dollars vs thousands), so the tie also confirms the loader normalised units '
             + 'per document rather than assuming one scale.',
    },
  },

  {
    id: 'mn-osa',
    match: /^Minnesota Office of the State Auditor/,
    scope: SCOPE.TOTAL_GOVERNMENTAL,
    // ⚠ The first total_governmental entry, and it comes with a KNOWN
    // reporting-entity caveat: MN OSA consolidates HRA/EDA/TIF component units
    // that city ACFRs present outside the primary government. The fund types are
    // exact; the entity boundary is wider. SCOPE-02 owns the `reporting_entity`
    // column that models this (Chris's decision, 2026-08-17). See RECON §4.7.
    evidence: {
      document: 'City of Bloomington, MN FY2022 audited ACFR governmental-funds statement '
              + '(docs/BloomingtonMN/bloomington-mn-fy2022-acfr.pdf), cross-read against the free '
              + 'source workbook docs/MN/cired_22_data.xlsx (the exact source_url stored on the '
              + 'rows). Bloomington FY2022 is GAAPInd=-1, i.e. GAAP basis per '
              + 'scripts/mnCityBasis.json, so a GAAP ACFR is the right comparator.',
      figures: 'PROVENANCE: stored revenue $148,267,637 = workbook col 74 "Total Revenues" and '
             + 'stored operating $155,969,565 = col 144 "Total Expenditures", exactly; the loader '
             + 'correctly avoids col 81 "& Other Sources" (211,077,612) and col 149 "& Other Uses" '
             + '(189,352,385). '
             + 'SCOPE, established STRUCTURALLY rather than by a tie: (1) enterprise funds are '
             + 'EXCLUDED — they sit on a separate Enterprise Funds sheet, 7 Bloomington '
             + 'enterprises totalling $55,331,114 operating revenue with Water and Sewer alone at '
             + '$33,011,125, none of which appears in the $148M (the governmental revenue tree has '
             + 'no water/sewer line and Total Charges for Services is only $7,189,968), so this is '
             + 'NOT all_funds; (2) it far exceeds the General Fund — $30,579,352 total capital '
             + 'outlay, $17,844,362 street construction, $16,887,344 tax increments, $12,153,560 '
             + 'HRA, $13,839,313 EDA — so it is NOT general_fund. Therefore all governmental '
             + 'funds. '
             + 'KNOWN RESIDUE, reporting-entity not fund-type: vs the ACFR, MN OSA is +21.7% on '
             + 'revenue ($121,826,437) and +16.6% on expenditures ($133,719,576), because OSA '
             + 'consolidates HRA/EDA/TIF component units the ACFR presents separately '
             + '(Bloomington HRA+EDA expenditures $29,375,216 vs a $22,249,989 gap). Systematic: '
             + 'of 852 cities, 514 (60.3%) carry at least one of those lines; statewide TIF is '
             + '2.91% of revenues and HRA+EDA 7.04% of expenditures, though ~17-22% for TIF-heavy '
             + 'Bloomington. SCOPE-02 models this as `reporting_entity`.',
    },
  },

  {
    id: 'oh-aos',
    match: /^Ohio Auditor of State/,
    scope: SCOPE.TOTAL_GOVERNMENTAL,
    evidence: {
      document: 'The source workbook itself, downloaded free: '
              + 'docs/OhioAOS/City_2024_GAAP_Summarized.XLSX (the exact source_url stored on the '
              + 'rows). This is the STRONGEST discriminator available anywhere in this registry — '
              + 'the same publisher prints the General Fund and the Total Governmental Funds '
              + 'columns as SEPARATE TABS of one file, so which one TT loaded is a fact, not an '
              + 'inference. Corroborates the loader header and the locked v2.8 scope decision '
              + '("general-government only, enterprise funds deferred to OHENT-01").',
      figures: 'The two tabs self-describe in their own row-2 banners: SOREACIFB_General = '
             + '"Summary of Unaudited Data from the Statement of Revenues, Expenditures and '
             + 'Changes in Fund Balances - Governmental Funds - General Fund"; SOREACIFB_TotalGov '
             + '= "... - Governmental Funds - Total Governmental Funds". '
             + 'CITY OF COLUMBUS FY2024 (row 57 of both tabs): General Fund revenue $1,429,123,000 '
             + 'and expenditures $1,168,730,000; Total Governmental revenue $2,166,549,000 and '
             + 'expenditures $2,477,440,000. The stored figures are $2,166,549,000 and '
             + '$2,477,440,000 — i.e. TotalGov col 16 and col 35 EXACTLY, and 51.6% / 112.0% above '
             + 'the General Fund figures. '
             + 'Enterprise is EXCLUDED: it lives in separate SOREACINP_* tabs — Columbus Water '
             + '$268,151,000 + Sewer $361,624,000 + Electric $93,535,000 + Landfill $0 = '
             + '$723,310,000, none of it inside the $2,166,549,000. So not all_funds. '
             + 'NOTE the workbook says "Unaudited Data" — Ohio AOS is unaudited Hinkle-system '
             + 'actuals, which is a data-quality caveat, not a scope one. '
             + 'REPORTING ENTITY: expected primary_government, because each tab restates the '
             + 'entity\'s OWN governmental-funds statement rather than re-aggregating from a state '
             + 'chart of accounts the way MN OSA does — but UNCONFIRMED, as columbus.gov returned '
             + 'HTTP 403 to a scripted ACFR fetch. SCOPE-02 to settle it.',
    },
  },

  // ── MASSACHUSETTS DLS ───────────────────────────────────────────────────────
  // Three entries, one evidence base: docs/superpowers/plans/MA-01-RECON.md.
  //
  // ⚠ THE SOURCE FILES ARE IN THIS REPO. docs/MA/GenFund{Expenditures,Revenues}
  // {YYYY}.xlsx, FY2002-2025, loaded by scripts/loadMaGFExcel.js with an explicit
  // totalCol. The scope question was answered by READING THE COLUMNS, not by
  // inferring from an ACFR — and every loaded row FY2020-2025 was compared back
  // to its workbook cell (operating 2,095/2,095 exact, revenue 2,096/2,106).
  //
  // ⚠ THE TWO DLS PRODUCTS ARE NOT SYMMETRIC. GenFundRevenues folds
  // "Other Financing Sources" and "Transfers" INTO its total; GenFundExpenditures
  // has no transfers column at all. So MA revenue includes transfers IN while MA
  // expenditure excludes transfers OUT, and the difference between them is NOT a
  // surplus for any of the 351 municipalities. That is a presentation hazard, not
  // a scope one — both products are General Fund products either way.
  //
  // ⚠ PRECISION IS TOWN-DEPENDENT, and the evidence below says so rather than
  // quoting the best case. UMAS is applied with local judgement: Lexington's
  // budgetary reconciliation carries Enterprise Fund indirect cost transfers, BAN
  // transfers and an OPEB contribution transfer that Natick's does not. The
  // expenditure tie is exact on Natick and ~0.34% on Lexington; the revenue tie
  // holds at 0.017%-0.10% on both. Revenue is the more robust of the two.

  {
    id: 'ma-dls-gf-exp',
    match: / — MA General Fund Expenditures$/,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'Two independent towns, both of which run their own K-12 school department '
              + '(the schools line is where UMAS and GAAP diverge most, so a regional-district '
              + 'town would not exercise it): Town of Natick FY2016/FY2024 Basic Financial '
              + 'Statements (natickma.gov/DocumentCenter/View/{5113,21443}) and Town of Lexington '
              + 'FY2023-25 Audited Financial Statements '
              + '(lexingtonma.gov/DocumentCenter/View/{13089,16407,17397}). Source workbooks '
              + 'docs/MA/GenFundExpenditures{YYYY}.xlsx.',
      figures: 'The workbook has TEN expenditure category columns (General Government, Public '
             + 'Safety, Education, Public Works, Human Services, Culture and Recreation, Fixed '
             + 'Costs, Intergov Assessments, Other Expenditures, Debt Service) and NO transfers '
             + 'column, summing to Total Expenditures. '
             + 'NATICK FY2024, read from the labelled schedule "SCHEDULE OF REVENUES, '
             + 'EXPENDITURES AND CHANGES IN FUND BALANCE - BUDGET AND ACTUAL (NON-GAAP BUDGETARY '
             + 'BASIS)": TOTAL EXPENDITURES Original 196,075,913 | Final 197,642,755 | ACTUAL '
             + '185,379,535 | Encumbrances 10,922,891 | Variance 1,340,329. DLS total 185,379,533 '
             + '— $2 apart. FY2016 is $1 apart. So DLS follows the ACTUAL column, EXCLUDING '
             + 'encumbrances and continuing appropriations. 18 of 19 audited years land within '
             + '0.33% (FY2018 is a scanned PDF with no text layer and was not verified). '
             + 'LEXINGTON FY2024, read from its named "Budgetary Basis" reconciliation line: '
             + 'budgetary expenditures 272,537,067 less its stated encumbrances 8,616,082 = '
             + '263,920,985 vs DLS 264,827,741 — 0.34%. FY2023 is also 0.34%; FY2025 INVERTS '
             + '(DLS exceeds the ACFR budgetary total, which excluding encumbrances cannot '
             + 'produce). Natick\'s $2 is therefore the BEST CASE, not the rule. '
             + 'The scope conclusion does not rest on that precision: at every tie the General '
             + 'Fund is the only candidate, and the figure reconciles to the ACFR\'s GENERAL FUND '
             + 'budgetary statement on two independent towns. '
             + 'The largest bridging item to GAAP is MTRS on-behalf payments (Natick FY2021 '
             + '$25,099,907, Lexington FY2024 $24,376,703) — the Commonwealth paying the town\'s '
             + 'teacher pensions, which GAAP books as both a revenue and an expenditure and the '
             + 'budgetary basis excludes. '
             + '⚠ COVERS THE FY2021-2025 ROWS PREVIOUSLY LABELLED "MA DLS Schedule A — Special '
             + 'Revenue Funds". That label was FALSE and is corrected to this one: those 1,560 '
             + 'rows carry figures byte-identical to GenFundExpenditures{YYYY}.xlsx, the GENERAL '
             + 'FUND workbook. The label came from scripts/scrapeMaDLS.js taking the DLS Gateway '
             + 'report name; the figures came from the Excel loader.',
    },
  },

  {
    id: 'ma-dls-gf-rev',
    match: / — MA General Fund Revenues$/,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'Same two towns and same source family as ma-dls-gf-exp; source workbooks '
              + 'docs/MA/GenFundRevenues{YYYY}.xlsx. MA-01-RECON.md §4, §4b.',
      figures: 'The workbook has ELEVEN revenue columns summing to Total Revenues, and TWO of '
             + 'them are NOT revenue: "Other Financing Sources" and "Transfers". It is the '
             + 'REVENUE-PROPER subtotal (total less those two) that corresponds to the ACFR\'s '
             + 'General Fund budgetary-basis actual Total Revenues. '
             + 'NATICK FY2021: Taxes 132,457,936 + Service Charges 2,919,915 + Licenses and '
             + 'Permits 2,268,209 + Federal 100,000 + State 14,524,987 + Other Governments 42,831 '
             + '+ Special Assessments 2,131 + Fines 38,610 + Miscellaneous 1,654,311 = '
             + '154,008,930; then + Other Financing Sources 355,000 + Transfers 6,019,182 = '
             + '160,383,112, the stored figure. ACFR budgetary actual Total Revenues 154,137,719 '
             + '— 0.084%. FY2022 reads 162,201,959 against revenue-proper 162,243,865, 0.026%, '
             + 'both from the named "Budgetary Basis as Reported" line. '
             + 'LEXINGTON FY2023/24/25: revenue-proper 271,198,447 / 288,444,793 / 301,218,597 vs '
             + 'ACFR budgetary revenues 271,245,502 / 288,174,636 / 301,053,298 — 0.017% / 0.094% '
             + '/ 0.055%. CONTROL: the RAW DLS total misses by 1.280% and 1.327% in FY2023-24, so '
             + 'the decomposition is doing real work and is not a fitted result. '
             + 'Across 18 readable Natick years, revenue-proper lands within 0.5% in 18/18 '
             + '(median 0.102%) where the raw total manages 12/18 (median 0.383%) and in FY2012, '
             + 'FY2017 and FY2019 has NO number anywhere in the ACFR within 1%. '
             + '⚠ CALIBRATION: each ACFR holds 560-1,140 distinct numbers above $1M with only '
             + '~2-4 within 1% of any target, so a lone close number proves nothing. Two '
             + 'proximity matches during this recon were coincidences — one landed on an '
             + 'expenditure subtotal, one on a Total OPEB Liability. Every figure quoted here was '
             + 'read from a labelled line.',
    },
  },

  {
    id: 'ma-dls-gf-rev-by-source',
    match: / — MA DLS General Fund Revenue by Source$/,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'Identical source and reconciliation to ma-dls-gf-rev — the same '
              + 'docs/MA/GenFundRevenues{YYYY}.xlsx workbooks, differing only in the label a '
              + 'later load vintage stamped. Kept as its own entry rather than relabelled '
              + 'because, unlike the Special Revenue Funds string, THIS LABEL IS TRUE: the '
              + 'workbook really is General Fund revenue broken out by source. MA-01-RECON.md '
              + '§4, §4b.',
      figures: 'Covers FY2021-2025, the years the Lexington confirmation is drawn from, so the '
             + 'ties quoted in ma-dls-gf-rev (0.017% / 0.094% / 0.055%) are ties against THIS '
             + 'entry\'s rows specifically. Verified byte-exact against the workbooks for '
             + 'FY2020-2025: 2,096 of 2,106 rows match their workbook cell to the cent. '
             + '⚠ The 10 that do not are rows where the WORKBOOK HOLDS 0 and the database holds '
             + 'a figure — FY2024 Holyoke $205,834,091 and Hudson $107,521,743, plus 8 in FY2025. '
             + 'Those towns had not filed when the workbook was captured, so those particular '
             + 'figures came from the portal scrape and are NOT covered by this reconciliation. '
             + 'They are classified with the rest — Chris\'s explicit decision on 2026-08-18, not '
             + 'a default — because the SOURCE is the same DLS General Fund product and scope is '
             + 'a property of the source. The FIGURES remain unreconciled; the caveat is recorded '
             + 'here so it survives the decision rather than being erased by it.',
    },
  },

  // ── NOT YET EVIDENCED ─────────────────────────────────────────────────────
  // Deliberately absent, each for a stated reason. RECON §1.8 tracks what each
  // one owes. The three siblings of the entry above are worth naming here because
  // their absence looks like an oversight and is not:
  //
  //   CA State Controller - Revenues            10,446 rows — the Modesto tie is
  //     an EXPENDITURE reconciliation. Revenues being all-funds too is very
  //     likely, which is exactly why it needs its own tie: a confident guess is
  //     still a guess. (RECON §2.2)
  //   CA State Controller - County Revenues      1,188 rows — SCO *Counties*
  //   CA State Controller - County Expenditures  1,188 rows   Annual Report, a
  //     different report with its own fund structure. Modesto is a city, so the
  //     tie says nothing about either. Needs a county probe.
  //
  // Everything else — publicpay (7,682), VA APA, Transparent Utah, the
  // state/local ACFR families, Texas's "General Revenue Fund" — is Task 4.
  // (MN OSA, Ohio AOS and MA DLS have since been evidenced and are entries above.)
];

export default FUND_SCOPE_REGISTRY;
