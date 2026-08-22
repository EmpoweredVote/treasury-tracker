/**
 * SCOPE-02 source→basis registry.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * ⚠ MATCH PATTERNS ARE ANCHORED PER STRING. `/^CA State Controller/` looks
 * reasonable and is a bug — it also claims 7,682 publicpay.ca.gov compensation
 * rows that no reconciliation covers. That trap cost SCOPE-01 a task to find; do
 * not reintroduce it here.
 *
 * ⚠ An entry is created when its evidence is, never before.
 *
 * Spec: docs/superpowers/specs/2026-08-17-scope-02-design.md §1
 */

import { BASIS } from '../lib/budgetAxes.mjs';

/** @type {import('../lib/budgetAxes.mjs').AxisEntry[]} */
export const BASIS_REGISTRY = [
  {
    id: 'ca-sco-city-exp',
    match: /^CA State Controller - Expenditures$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Cities Annual Report; reconciled against City of Modesto FY2024 ACFR (SCOPE-01-RECON §2.1)',
      figures: 'Governmental $291,641,122 + enterprise/ISF $296,400,946 = $588,042,068 = SCO reported total, to the dollar. A closed-year reported actual, not an appropriation.',
    },
  },
  {
    id: 'ca-sco-city-rev',
    match: /^CA State Controller - Revenues$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Cities Annual Report; City of Modesto FY2024 ACFR p.81 (SCOPE-01-RECON §4.1)',
      figures: '$322,089,879 + $321,804,947 = $643,894,826 = SCO reported total, to the dollar.',
    },
  },
  {
    id: 'ca-sco-county-exp',
    match: /^CA State Controller - County Expenditures$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Counties Annual Report; County of Stanislaus FY2024 ACFR p.23 (SCOPE-01-RECON §4.2)',
      figures: '$1,401,372,422 derived vs $1,401,372,428 reported — $6 on $1.4bn.',
    },
  },
  {
    id: 'ca-sco-county-rev',
    match: /^CA State Controller - County Revenues$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'SCO Counties Annual Report; County of Stanislaus FY2024 ACFR p.23 (SCOPE-01-RECON §4.3)',
      figures: '0.547% residue decomposed across eight taxonomies with mixed signs (five SCO-higher, three SCO-lower); a missing fund would subtract in one direction only, so this is a taxonomy difference, not an absent fund.',
    },
  },
  // ── The sixteen entity-published city/state ACFR families ─────────────────
  // 260 rows. Evidence: ACFR-GF-CLASSIFICATION-RECON.md §2. Patterns and row
  // counts are identical to the fund-scope entries of the same ids; see those
  // for the per-family probe tables.
  //
  // Shared basis argument: every stored figure is the printed General Fund
  // column of a governmental-funds Statement of Revenues, Expenditures and
  // Changes in Fund Balances — a year-end GAAP actual, tying exactly across 54
  // coordinate-verified probes. These are NOT appropriations: the same documents
  // present budget against actual in a separate budgetary comparison SCHEDULE,
  // and both the loading path (acfrGF.py `_EXCLUDE`) and the verifying path
  // (acfrPrintedTotal.py) refuse any page whose title carries "Budgetary" or
  // "Budget and Actual", so the budget schedule is structurally unreachable.
  // Latest year in any family is FY2025, closed 2025-06-30 for all sixteen.
  {
    id: 'or-city-acfr-gf',
    match: /^City of (Bend|Sherwood|Beaverton|Hillsboro|Tualatin|Cornelius|Tigard) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Seven Oregon cities\' own ACFRs, 15 coordinate-verified entity-years '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'Every probe ties exactly to the printed General Fund column of the audited '
             + 'governmental-funds statement for a CLOSED fiscal year — e.g. Bend FY2006 '
             + '26,414,845 / 14,236,241 and Beaverton FY2025 84,105,297 / 83,828,091.',
    },
  },
  {
    id: 'az-muni-acfr-gf',
    match: /^(City of Tucson|Marana|Oro Valley|Sahuarita|South Tucson) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Five Arizona municipalities\' own ACFRs, 10 coordinate-verified entity-years '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'Every probe ties exactly — e.g. Tucson FY2024 773,493,270 / 648,657,363 and '
             + 'Sahuarita FY2019 17,760,711 / 15,763,375. All closed June-30 fiscal years.',
    },
  },
  {
    id: 'seattle-city-acfr-gf',
    match: /^City of Seattle ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Seattle ACFRs FY2024 and FY2025 (ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'FY2025 General Fund column 2,407,090 / 2,300,612 (thousands) ties exactly to the '
             + 'stored $2,407,090,000 / $2,300,612,000. Audited, closed calendar-year period.',
    },
  },
  {
    id: 'state-acfr-gf-by-name',
    match: /^State of (Minnesota|Ohio|Virginia) ACFR — General Fund/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Minnesota, Ohio and Virginia state ACFRs, two fiscal years each '
              + '(ACFR-GF-CLASSIFICATION-RECON.md §1.2, §2)',
      figures: 'Every probe ties exactly in thousands — Minnesota FY2025 35,478,861 / 35,114,726, '
             + 'Ohio FY2025 49,343,227 / 49,447,475, Virginia FY2025 31,593,096 / 34,099,267. Same '
             + 'document class and basis conclusion as the existing state-acfr-gf entry.',
    },
  },
  {
    // AUSTIN-TRAVIS-01. 76 rows, measured 2026-08-19. Anchored to the two entity
    // names — see the fund-scope entry of the same id for why a general
    // / ACFR — General Fund/ pattern would wrongly claim 260 unreconciled rows.
    id: 'tx-local-acfr-gf',
    match: /^(City of Austin|Travis County) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Austin FY2024 + FY2015 and Travis County FY2024 ACFRs — audited, '
              + 'unmodified opinion, closed fiscal years (AUSTIN-TRAVIS-01-SCOPE-RECON.md §2)',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances — a year-end GAAP '
             + 'actual, tying exactly on both sides in all three probes. NOT an appropriation: the '
             + 'same documents present budget and actual in separate columns of a budgetary '
             + 'comparison SCHEDULE, and acfrGF.py excludes any page whose title carries '
             + '"Budgetary" or "Budget and Actual", so the budget schedule is structurally '
             + 'unreachable. The whole window is closed — FY2025 ended 2025-09-30 and both FY2025 '
             + 'reports are published and audited.',
    },
  },
  {
    // CO-SPRINGS-EPC-01. 64 rows, measured 2026-08-21. Anchored to the two
    // entity names - see the fund-scope entry of the same id.
    id: 'co-local-acfr-gf',
    match: /^(City of Colorado Springs|El Paso County) ACFR — General Fund /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'City of Colorado Springs FY2024 + FY2016 and El Paso County FY2024 + FY2020 + '
              + 'FY2012 ACFRs - audited, unmodified opinion, closed fiscal years '
              + '(CO-SPRINGS-EPC-01-CLOSEOUT.md section 6)',
      figures: 'Every stored figure is the printed General Fund column of the governmental-funds '
             + 'Statement of Revenues, Expenditures and Changes in Fund Balances - a year-end GAAP '
             + 'actual, tying exactly on both sides in all five probes. NOT an appropriation, and '
             + 'Colorado Springs is the reason to say so explicitly: its ACFR prints a SECOND '
             + 'statement with almost the same title - "GENERAL FUND / STATEMENT OF REVENUES, '
             + 'EXPENDITURES AND CHANGES IN FUND BALANCE / BUDGET AND ACTUAL" (Exhibit 6, four '
             + 'pages, Original | Final | Actual | Variance) - which IS budgetary basis. Loading '
             + 'that page instead would have put budget-basis figures under a GAAP-actual label '
             + 'with no arithmetic symptom. It is structurally unreachable: both readers exclude '
             + 'any page whose text carries "budget and actual" or "budgetary", and Exhibit 4 '
             + 'precedes Exhibit 6 in every year so the earliest-qualifying rule reaches it first. '
             + 'The whole window is closed - FY2025 ended 2025-12-31 and both FY2025 reports are '
             + 'published and audited.',
    },
  },
  {
    id: 'wa-sao',
    match: /^WA State Auditor — /,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'WA SAO annual financial reports; Spokane FY2019 and Tacoma FY2019 (SCOPE-01-RECON §4.6)',
      figures: 'Both tie exactly on both sides against the audited governmental-funds statement of a closed year.',
    },
  },
  {
    id: 'state-acfr-gf',
    match: / State ACFR — General Fund/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'State ACFRs; Utah FY2024 p.43 and Connecticut FY2024 p.36 (SCOPE-01-RECON §4.5)',
      figures: 'Both tie exactly on both sides. Every claimed row carries "GAAP basis" and "actual" in its own source string.',
    },
  },
  {
    id: 'mn-osa',
    match: /^Minnesota Office of the State Auditor/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'MN OSA cired_22_data.xlsx, Governmental Funds sheet (SCOPE-01-RECON §4.7)',
      figures: 'Bloomington FY2022 col 74 Total Revenues 148,267,637 and col 144 Total Expenditures 155,969,565 — year-end reported figures.',
    },
  },
  {
    id: 'oh-aos',
    match: /^Ohio Auditor of State/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'Ohio AOS City_2024_GAAP_Summarized.XLSX, SOREACIFB_TotalGov tab (SCOPE-01-RECON §4.8)',
      figures: 'Columbus FY2024 revenue $2,166,549,000 / expenditures $2,477,440,000 = stored exactly. Hinkle-system year-end actuals (unaudited, which is a quality caveat, not a basis one).',
    },
  },
  {
    id: 'ca-sco-derived-tg',
    match: /^Treasury Tracker derived: Total Governmental \(CA State Controller/,
    value: BASIS.ACTUAL,
    // ⚠ Placed ABOVE the adopted-budget catch-all. That entry matches on
    // /(Operating|Revenue|...).*Budget.../i and the derived labels contain
    // "Revenues", so ordering is what guarantees they can never be read as
    // adopted. (Checked: the catch-all also requires "Budget" at the end, which
    // these labels do not have — so this is belt and braces, not the only guard.)
    evidence: {
      document: 'Inherited, not asserted. Every derived row is computed from a CA State '
              + 'Controller all_funds row, and all 7,664 eligible parents were MEASURED as '
              + 'basis=actual uniformly — the derivation sums a subset of a parent\'s own root '
              + 'categories, so it cannot change the basis of the figure.',
      figures: 'The SCO Annual Report publishes year-end ACTUALS for a closed fiscal year, not '
             + 'appropriations; era B is FY2017+ and every such year has closed. Corroborated '
             + 'against audited statements at Cerritos FY2017 (69,951,331) and Lakewood FY2017 '
             + '(57,831,166), both of which are audited year-end GAAP actuals and both of which '
             + 'the derived figures reproduce exactly. See SCOPE-04-RECON.md.',
    },
  },
  {
    // Adopted budget documents. 165 rows / 129 strings / 30 entities, measured 2026-08-17.
    // Placed LAST so a more specific source above always wins.
    id: 'city-adopted-budget-doc',
    match: /(Operating|Revenue|General Fund|General Purpose Fund).*Budget( FY\d{4})?$|Budget FY\d{4}$/i,
    value: BASIS.ADOPTED,
    evidence: {
      document: 'The source documents themselves are adopted budgets — e.g. "Long Beach General Fund Operating Budget FY2025", "Oakland General Purpose Fund Operating Budget FY2024".',
      figures: 'Several carry FY2026, a fiscal year that has not closed, so they cannot be actuals. This is half of the -75% Long Beach seam: an adopted GF budget drawn as the continuation of an all-funds actuals series.',
    },
  },
];
