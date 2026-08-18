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
    id: 'wa-sao',
    match: /^WA State Auditor — /,
    value: REPORTING_ENTITY.PRIMARY,
    evidence: {
      document: 'WA SAO filings; Spokane FY2019, Tacoma FY2019 (SCOPE-01-RECON §4.6)',
      figures: 'The stored figure equals the printed General Fund column of the primary government\'s governmental-funds statement, tied exactly on both sides in two different units.',
    },
  },
];
