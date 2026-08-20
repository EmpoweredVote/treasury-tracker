/**
 * SCOPE-02 source→reporting_entity registry.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * ⚠ EXPECTED IS NOT EVIDENCED. Ohio AOS is expected to be primary_government —
 * each tab restates the entity's own governmental-funds statement rather than
 * re-aggregating from a state chart of accounts the way MN OSA does — but
 * columbus.gov returned HTTP 403 to a scripted ACFR fetch, so there is no
 * document and therefore no entry. Same for CA SCO and VA APA.
 *
 * Spec: docs/superpowers/specs/2026-08-17-scope-02-design.md §1
 */

import { REPORTING_ENTITY } from '../lib/budgetAxes.mjs';

/** @type {import('../lib/budgetAxes.mjs').AxisEntry[]} */
export const REPORTING_ENTITY_REGISTRY = [
  {
    id: 'mn-osa',
    match: /^Minnesota Office of the State Auditor/,
    value: REPORTING_ENTITY.INCL_COMPONENT_UNITS,
    evidence: {
      document: 'City of Bloomington MN FY2022 ACFR vs MN OSA cired_22_data.xlsx (SCOPE-01-RECON §4.7)',
      figures: 'OSA revenue $148,267,637 vs ACFR total governmental $121,826,437 (+21.7%); the gap is HRA/EDA/TIF component units the ACFR presents separately. Systematic: 514 of 852 MN cities carry nonzero TIF/HRA/EDA; ~7% of statewide expenditures, ~17-22% for TIF-heavy cities.',
    },
  },
  {
    id: 'state-acfr-gf',
    match: / State ACFR — General Fund/,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'State ACFRs; Utah FY2024 p.43, Connecticut FY2024 p.36 (SCOPE-01-RECON §4.5)',
      figures: 'The figure read is the printed General Fund column of the primary government\'s governmental-funds statement; component units are presented discretely elsewhere in the same document.',
    },
  },
  {
    // AUSTIN-TRAVIS-01. 76 rows, measured 2026-08-19. Anchored to the two entity
    // names — see the fund-scope entry of the same id.
    id: 'tx-local-acfr-gf',
    match: /^(City of Austin|Travis County) ACFR — General Fund /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'Note 1 (Reporting Entity) and the Overview of the Financial Statements in the '
              + 'City of Austin FY2024 and Travis County FY2024 ACFRs '
              + '(AUSTIN-TRAVIS-01-SCOPE-RECON.md §3)',
      figures: 'The stored figure is the printed General Fund column of the FUND financial '
             + 'statements. Under GASB 34 discretely presented component units appear only in the '
             + 'government-wide statements, in their own separate column, so they cannot be in it. '
             + 'Austin states this outright for its NINE discrete units (ABLE, ACE, Austin Transit '
             + 'Partnership, Sobriety Center, Rally Austin, three housing LPs, Waller Creek LGC): '
             + '"data from these units are shown separately from data of the City". Corroboration '
             + 'on the BLENDED units, which are inside the primary government\'s funds by GASB 34 '
             + 'exactly as they are for wa-sao and state-acfr-gf: Austin\'s Note 1 names a '
             + '"Reporting Fund" per blended unit and none of the named ones is the General Fund — '
             + 'Austin Energy (major PROPRIETARY fund), Austin Housing Finance Corporation '
             + '(nonmajor SPECIAL REVENUE fund), Urban Renewal Agency (nonmajor SPECIAL REVENUE '
             + 'fund). Travis\'s blended units are eight governmental entities plus TCHFC, reported '
             + 'in BUSINESS-TYPE activities via an enterprise fund; its General Fund is one of six '
             + 'major governmental funds. Contrast mn-osa, which is incl_component_units because '
             + 'the OSA re-aggregates HRA/EDA/TIF the city ACFR presents separately (+21.7% on '
             + 'Bloomington FY2022) — nothing of that kind happens here, the figure is read FROM '
             + 'the ACFR\'s own fund statement.',
    },
  },
  {
    id: 'wa-sao',
    match: /^WA State Auditor — /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'WA SAO filings; Spokane FY2019, Tacoma FY2019 (SCOPE-01-RECON §4.6)',
      figures: 'The stored figure equals the printed General Fund column of the primary government\'s governmental-funds statement, tied exactly on both sides in two different units.',
    },
  },
];
