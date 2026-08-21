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

  // ── The sixteen entity-published city/state ACFR families ─────────────────
  // Evidence for all four entries below:
  // docs/superpowers/plans/ACFR-GF-CLASSIFICATION-RECON.md (2026-08-19).
  //
  // Method is `state-acfr-gf`'s and `tx-local-acfr-gf`'s: these filings ARE the
  // source the loaders read, so the reconciliation is not against a second
  // reporter — it establishes WHICH COLUMN of the statement the stored figure
  // is, read by pdfplumber glyph coordinates rather than the `pdftotext -table`
  // path every one of these extractors uses. 54 of 54 readable probes matched
  // the printed FIRST (General Fund) column EXACTLY, and every General Fund
  // share of Total Governmental landed between 19.9% and 86.9% — nowhere near
  // the ~100% a mislabelled total-governmental figure would show.
  //
  // ⚠ Grouped by source family, but UNLIKE state-acfr-gf every member family was
  // probed individually — this is not two probes standing in for fifty
  // publishers. Patterns enumerate their entities so an unreconciled future load
  // lands `unknown` instead of inheriting a claim.
  {
    id: 'or-city-acfr-gf',
    match: /^City of (Bend|Sherwood|Beaverton|Hillsboro|Tualatin|Cornelius|Tigard) ACFR — General Fund /,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'Seven Oregon cities, each its own ACFR governmental-funds Statement of Revenues, '
              + 'Expenditures and Changes in Fund Balances, two fiscal years apiece (Sherwood '
              + 'three): Bend FY2006+FY2025, Sherwood FY2015+FY2024+FY2025, Beaverton '
              + 'FY2020+FY2025, Hillsboro FY2021+FY2025, Cornelius FY2022+FY2025, Tigard '
              + 'FY2022+FY2025, Tualatin FY2021. Full table: ACFR-GF-CLASSIFICATION-RECON.md §1.2.',
      figures: 'Stored equals the printed General Fund column EXACTLY (factor 1, whole dollars) in '
             + 'every probe. Examples with the Total Governmental discriminator from the same row: '
             + 'BEND FY2006 revenue 26,414,845 of 63,344,172 total governmental (41.7%), '
             + 'expenditures 14,236,241 of 71,632,573 (19.9%). SHERWOOD FY2025 17,725,106 of '
             + '31,416,090 (56.4%) and 20,034,416 of 47,362,405 (42.3%). BEAVERTON FY2025 '
             + '84,105,297 of 146,520,756 (57.4%) and 83,828,091 of 141,834,528 (59.1%). TIGARD '
             + 'FY2022 43,753,463 of 70,854,718 (61.8%) and 30,516,074 of 53,825,413 (56.7%). '
             + 'CORNELIUS FY2025 10,826,496 of 14,881,042 (72.8%) and 15,037,256 of 17,297,870 '
             + '(86.9%). TUALATIN FY2021 20,825,943 of 29,742,455 (70.0%) and 23,895,226 of '
             + '42,029,042 (56.9%). HILLSBORO FY2025 175,243,196 of 263,710,906 (66.5%) and '
             + '165,543,779 of 220,973,329 (74.9%) — Hillsboro splits its fund columns across two '
             + 'pages, so its total came from the continued page via the additive identity in '
             + 'RECON §1.3, which returned exactly ONE candidate row on each side. '
             + '⚠ DISCLOSED: Tualatin has ONE verified year, not two (RECON §4) — its FY2025 title '
             + 'wrap defeats the oracle and pdfplumber is pathologically slow on its FY2022/FY2023 '
             + 'files; its other four years rest on the extractor\'s own $0 tie gate.',
    },
  },

  {
    id: 'az-muni-acfr-gf',
    match: /^(City of Tucson|Marana|Oro Valley|Sahuarita|South Tucson) ACFR — General Fund /,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'Five Arizona municipalities, each its own ACFR governmental-funds Statement of '
              + 'Revenues, Expenditures and Changes in Fund Balances, two fiscal years apiece: '
              + 'Tucson FY2015+FY2024, Marana FY2019+FY2024, Oro Valley FY2019+FY2024, Sahuarita '
              + 'FY2019+FY2024, South Tucson FY2019+FY2022 (South Tucson titles its filing "Annual '
              + 'Financial Report"). Full table: ACFR-GF-CLASSIFICATION-RECON.md §1.2.',
      figures: 'Stored equals the printed General Fund column EXACTLY (factor 1, whole dollars) in '
             + 'every probe. TUCSON FY2024 revenue 773,493,270 of 1,373,161,136 total governmental '
             + '(56.3%), expenditures 648,657,363 of 1,262,441,832 (51.4%); FY2015 468,385,932 of '
             + '723,796,248 (64.7%) and 422,167,515 of 766,150,387 (55.1%). MARANA FY2024 '
             + '94,153,099 of 151,204,836 (62.3%) and 59,821,670 of 116,985,368 (51.1%). SAHUARITA '
             + 'FY2024 32,166,628 of 51,310,948 (62.7%) and 23,924,397 of 45,006,746 (53.2%); '
             + 'FY2019 17,760,711 of 27,426,685 (64.8%) and 15,763,375 of 29,842,748 (52.8%). '
             + 'SOUTH TUCSON FY2022 6,201,468 of 9,539,140 (65.0%) and 5,883,806 of 8,865,838 '
             + '(66.4%). ORO VALLEY FY2024 59,077,316 of 80,149,319 (73.7%) and 50,170,504 of '
             + '91,241,735 (55.0%) — Oro Valley splits its fund columns across two pages, so its '
             + 'total came from the continued page via the additive identity in RECON §1.3, which '
             + 'returned exactly ONE candidate row on each side.',
    },
  },

  {
    id: 'seattle-city-acfr-gf',
    match: /^City of Seattle ACFR — General Fund /,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'City of Seattle ACFRs FY2024 and FY2025, governmental-funds Statement of '
              + 'Revenues, Expenditures and Changes in Fund Balances (statement pages 56 and 59). '
              + 'Separate from the `wa-sao` entry, which covers rows sourced from the WA State '
              + 'Auditor portal — these are the city\'s own publication. '
              + 'ACFR-GF-CLASSIFICATION-RECON.md §1.2.',
      figures: 'FY2025 (IN THOUSANDS, factor 1000) — printed General Fund column: Total Revenues '
             + '2,407,090 and Total Expenditures 2,300,612, matching the stored $2,407,090,000 and '
             + '$2,300,612,000 EXACTLY. Total Governmental columns are 3,826,477 and 3,699,453, so '
             + 'the stored figure is 62.9% / 62.2% of total governmental. FY2024 matches its '
             + 'printed General Fund column exactly on both sides as well. '
             + '⚠ Seattle FY2009 and FY2010 could NOT be read and are not counted as evidence: '
             + 'that era prints "Page 1 of 2" between "...AND CHANGES" and "IN FUND BALANCES", so '
             + 'no title regex spans the wrap — the same defect acfrGF.py documents, and the reason '
             + 'Seattle\'s own extractor identifies its statement by the `B-4` schedule id.',
    },
  },

  {
    id: 'state-acfr-gf-by-name',
    match: /^State of (Minnesota|Ohio|Virginia) ACFR — General Fund/,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'Three state ACFRs, each its governmental-funds Statement of Revenues, '
              + 'Expenditures and Changes in Fund Balances, two fiscal years apiece: Minnesota '
              + 'FY2008+FY2025, Ohio FY2020+FY2025, Virginia FY2022+FY2025. These are the SAME '
              + 'document class as `state-acfr-gf` and the same conclusion; they need their own '
              + 'entry only because their data_source strings read "State of Minnesota ACFR — …" '
              + 'rather than "… State ACFR — …", so that entry\'s pattern never matched them. '
              + 'ACFR-GF-CLASSIFICATION-RECON.md §1.2.',
      figures: 'All in THOUSANDS (factor 1000), all matching the printed General Fund column '
             + 'EXACTLY. MINNESOTA FY2025 revenue 35,478,861 of 60,581,559 total governmental '
             + '(58.6%), expenditures 35,114,726 of 61,668,498 (56.9%); FY2008 16,600,864 of '
             + '26,686,484 (62.2%) and 16,086,550 of 27,064,691 (59.4%). Minnesota\'s columns are '
             + 'printed GENERAL | FEDERAL | NONMAJOR | TOTAL and it labels its revenue subtotal '
             + '"Net Revenues", not "Total Revenues". OHIO FY2025 49,343,227 of 87,078,671 (56.7%) '
             + 'and 49,447,475 of 91,951,477 (53.8%). VIRGINIA FY2025 31,593,096 of 67,935,968 '
             + '(46.5%) and 34,099,267 of 71,193,478 (47.9%). Ohio and Virginia split their fund '
             + 'columns across two pages; both totals came from the continued page via the additive '
             + 'identity in RECON §1.3, one candidate row each. '
             + '⚠ Minnesota FY2008 nearly went the other way: its dot leaders run THROUGH the '
             + 'figures ("$......1..6..,.6.0..0..,.8..6..4"), so the General Fund token was '
             + 'unparseable and the leftmost readable number was the FEDERAL column, 6,271,343. '
             + 'The column identity 16,600,864 + 6,271,343 + 3,814,277 = 26,686,484 is what pins '
             + 'the General Fund value (RECON §1.4).',
    },
  },

  {
    // AUSTIN-TRAVIS-01. 76 rows / 76 strings (Austin 32 + Travis 44), measured
    // 2026-08-19.
    //
    // ⚠ ANCHORED TO THE TWO ENTITY NAMES ON PURPOSE. The tempting general
    // pattern, / ACFR — General Fund/, matches 1,784 rows: the 1,448 already
    // owned by state-acfr-gf, these 76, and 260 rows across SIXTEEN other city
    // and state ACFR families (Bend 36, State of Minnesota 36, Seattle 34,
    // Sherwood 22, Tucson 20, …) that no reconciliation covers. Those stay
    // `unknown`: this entry's evidence is the Austin and Travis statements, and
    // nobody has read Bend's. A future Texas city ACFR load therefore lands
    // `unknown` until it is evidenced, which is the correct failure direction.
    id: 'tx-local-acfr-gf',
    match: /^(City of Austin|Travis County) ACFR — General Fund /,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'THREE probes across two Texas entities, each the governmental-funds Statement of '
              + 'Revenues, Expenditures and Changes in Fund Balances: City of Austin FY2024 '
              + '(docs/Austin/austin-2024-acfr.pdf p.50, Exhibit B-2) and FY2015 '
              + '(austin-2015-acfr.pdf p.50), and Travis County FY2024 '
              + '(docs/TravisCounty/travis-2024-acfr.pdf pp.58-59). NOTE: these filings ARE the '
              + 'source the loader read, so the reconciliation is not against a second reporter — '
              + 'it establishes WHICH COLUMN of the statement the stored figure is, which is the '
              + 'question that decides scope. Same method as state-acfr-gf and wa-sao. '
              + 'Full working: docs/superpowers/plans/AUSTIN-TRAVIS-01-SCOPE-RECON.md §1.',
      figures: 'AUSTIN FY2024 (thousands) — printed General Fund column: Total revenues 1,280,826 '
             + 'and Total expenditures 1,347,127, matching the stored $1,280,826,000 and '
             + '$1,347,127,000 EXACTLY. Total Governmental columns are 2,216,395 and 2,881,179, so '
             + 'the stored figure is 57.8% / 46.8% of total governmental; columns sum exactly '
             + '(1,280,826 + 935,569 = 2,216,395; 1,347,127 + 1,534,052 = 2,881,179). '
             + 'AUSTIN FY2015 (thousands, the earlier of Austin\'s two label eras) — General Fund '
             + '736,921 and 878,869, stored exactly; Total Governmental 1,066,268 and 1,296,816 '
             + '(69.1% / 67.8%); columns sum exactly. '
             + 'TRAVIS FY2024 (WHOLE DOLLARS) — printed General column: Total revenues '
             + '1,030,822,292 and Total expenditures 888,757,389, stored EXACTLY. Total '
             + 'Governmental is 1,309,590,625 and 1,318,378,253 (78.7% / 67.4%); all seven fund '
             + 'columns sum to those totals exactly on both sides. '
             + 'Candidate scopes rejected: total_governmental is off by 42.2%/53.2% (Austin FY2024), '
             + '30.9%/32.2% (Austin FY2015) and 21.3%/32.6% (Travis FY2024); all_funds further '
             + 'still, since neither statement contains any proprietary fund (Austin Energy, '
             + 'Austin Water, the airport, Travis\'s TCHFC and internal service funds are all '
             + 'outside it). The two entities print in DIFFERENT units — Austin "(In thousands)", '
             + 'Travis whole dollars — so the tie also confirms the loader normalised units per '
             + 'document rather than assuming one scale, which the $0 tie gate cannot see.',
    },
  },

  {
    // CO-SPRINGS-EPC-01. 64 rows / 64 strings (Colorado Springs 28 + El Paso
    // County 36), measured 2026-08-21.
    //
    // WARNING ANCHORED TO THE TWO ENTITY NAMES, for the same reason
    // tx-local-acfr-gf is: the general / ACFR - General Fund/ pattern claims
    // ~1,850 rows across eighteen families nobody has reconciled. A future
    // Colorado ACFR load therefore lands `unknown` until it is evidenced, which
    // is the correct failure direction.
    //
    // WARNING "El Paso County" is also a TEXAS county. This pattern matches the
    // DATA_SOURCE STRING this milestone's loader writes, and no Texas El Paso
    // rows exist in the table; were they loaded later under a colliding label
    // they would need splitting by municipality_id rather than by this string.
    id: 'co-local-acfr-gf',
    match: /^(City of Colorado Springs|El Paso County) ACFR — General Fund /,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'FIVE probes across two Colorado entities, each the governmental-funds Statement '
              + 'of Revenues, Expenditures and Changes in Fund Balances: City of Colorado Springs '
              + 'FY2024 (docs/ColoradoSprings/colorado-springs-2024-acfr.pdf p.56, Exhibit 4) and '
              + 'FY2016 (colorado-springs-2016-acfr.pdf p.51), and El Paso County FY2024 '
              + '(docs/ElPasoCounty/el-paso-county-2024-acfr.pdf p.50), FY2020 (p.44) and FY2012 '
              + '(p.40). NOTE: these filings ARE the source the loader read, so the reconciliation '
              + 'is not against a second reporter - it establishes WHICH COLUMN of the statement '
              + 'the stored figure is, which is the question that decides scope. Same method as '
              + 'state-acfr-gf, wa-sao and tx-local-acfr-gf. Full working: '
              + 'docs/superpowers/plans/CO-SPRINGS-EPC-01-CLOSEOUT.md section 6.',
      figures: 'All figures WHOLE DOLLARS (both entities print full figures; neither says '
             + '"in thousands"). Read by scripts/acfrPrintedTotal.py, which reads only the printed '
             + 'TOTAL cell from pdfplumber glyph coordinates and shares no code with either '
             + 'loader. '
             + 'COLORADO SPRINGS FY2024 - printed General Fund column: Total revenues 371,035,085 '
             + 'and Total expenditures 422,363,896, matching the stored figures EXACTLY. Total '
             + 'Governmental columns are 613,764,319 and 661,715,191, so the stored figure is '
             + '60.5% / 63.8% of total governmental; the columns sum exactly '
             + '(371,035,085 + 73,271,800 + 169,457,434 = 613,764,319 and '
             + '422,363,896 + 65,931,505 + 173,419,790 = 661,715,191). '
             + 'COLORADO SPRINGS FY2016 - General Fund 233,693,029 and 246,212,379, stored '
             + 'exactly; Total Governmental 387,980,606 and 400,060,465 (60.2% / 61.5%); columns '
             + 'sum exactly. '
             + 'EL PASO COUNTY FY2024 - General Fund 308,220,434 and 289,511,043, stored exactly; '
             + 'Total Governmental 478,645,790 and 459,853,042 (64.4% / 63.0%); all six fund '
             + 'columns sum exactly on both sides. FY2020 - 358,327,750 and 322,185,041, stored '
             + 'exactly (74.0% / 65.3% of 484,486,536 and 493,042,013). FY2012 - 118,451,903 and '
             + '123,652,632, stored exactly (49.9% / 49.8% of 237,301,973 and 248,369,807). '
             + 'Candidate scopes rejected: total_governmental is off by 39.5%/36.2% (Springs '
             + 'FY2024), 39.8%/38.5% (Springs FY2016), 35.6%/37.0% (El Paso FY2024) and '
             + '50.1%/50.2% (El Paso FY2012) - the El Paso early years are the clearest '
             + 'discriminator, where the General Fund is barely half of total governmental. '
             + 'all_funds is further still: neither statement contains any proprietary fund, and '
             + 'Colorado Springs Utilities - a ~$1B enterprise operation reported in the same '
             + 'ACFR - is entirely outside the governmental-funds statement, which is why an '
             + 'all_funds reading of this city would be off by a multiple rather than a margin.',
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
