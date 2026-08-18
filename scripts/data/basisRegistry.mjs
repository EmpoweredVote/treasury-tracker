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
      figures: 'Reported prior-year collections; 0.547% residue decomposed across seven taxonomies with mixed signs.',
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
