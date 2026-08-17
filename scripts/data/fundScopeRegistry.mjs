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
  // Everything else — MN OSA (21,794), MA DLS's four sub-families (16,816),
  // Ohio AOS (6,616), publicpay (7,682), VA APA, Transparent Utah, WA SAO, the
  // state/local ACFR families, Texas's "General Revenue Fund" — is Task 4.
];

export default FUND_SCOPE_REGISTRY;
