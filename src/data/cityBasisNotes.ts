/**
 * Per-city basis disclosure notes (Phase 58-03, D-08).
 *
 * A curated, sourced map of basis-change notes for cities whose displayed
 * budget series mixes bases across the year axis. Every entry carries a
 * SourceChip-compatible source_name / source_url / source_date — no entry
 * ships without a source (always-sourced ground rule, T-58-03).
 *
 * Display gate: this map is keyed by "${city name}|${state}" (e.g.
 * "Long Beach|CA"). A city absent from this map gets NO note; the component
 * renders nothing, so pure-SCO cities, Los Angeles (pure-custom), counties,
 * and federal pages are completely unaffected (additive pattern).
 *
 * Entries are authored ONLY for cities that genuinely mix bases as a result
 * of Phase 58 layering SCO all-governmental-funds history beneath their
 * existing General-Fund / transaction custom recent years (D-04):
 *   - Long Beach (CA): GF operating + revenue FY2025–26 (custom) over SCO all-funds FY2003–2024
 *   - West Hollywood (CA): Demand Register transaction data FY2018–26 (custom) over SCO all-funds FY2003–2024
 *
 * Entry shape mirrors ComparabilitySource from src/types/budget.ts.
 */

import type { ComparabilitySource } from '../types/budget';

export interface CityBasisNote {
  /** One-sentence intro shown above the sourced entry (optional). */
  intro?: string;
  /** Sourced note entries — each one renders with a SourceChip. */
  entries: ComparabilitySource[];
}

/**
 * Keyed by "${city name}|${state abbreviation}".
 * Import this in the render site and look up `cityBasisNotes[key]`.
 * If the lookup returns undefined, render nothing (no note for that city).
 */
export const cityBasisNotes: Record<string, CityBasisNote> = {
  /**
   * Long Beach, CA
   * Custom GF operating + revenue for FY2025–2026 (city published budget),
   * layered over SCO all-governmental-funds history FY2003–2024.
   */
  'Long Beach|CA': {
    intro:
      'Budget figures for earlier years and recent years come from different reporting bases. ' +
      'Totals are not directly comparable across that seam.',
    entries: [
      {
        title: 'Years shown on different reporting bases',
        text:
          'FY2003–2024 figures are drawn from the CA State Controller ByTheNumbers ' +
          'all-governmental-funds dataset — a comprehensive view that includes the ' +
          'General Fund, enterprise funds, debt service, and all other city funds. ' +
          'FY2025–2026 figures are from the city\'s published General Fund budget, ' +
          'which covers core city services only. Because the scope of funds differs, ' +
          'a year-over-year comparison across this boundary will reflect the basis ' +
          'change, not a real spending change.',
        source_name: 'CA State Controller — ByTheNumbers Expenditures',
        source_url: 'https://bythenumbers.sco.ca.gov/d/ju3w-4gxp',
        source_date: '2026-06-16',
      },
    ],
  },

  /**
   * West Hollywood, CA
   * Custom Demand Register transaction data for FY2018–2026,
   * layered over SCO all-governmental-funds history FY2003–2024.
   */
  'West Hollywood|CA': {
    intro:
      'Budget figures for earlier years and recent years come from different reporting bases. ' +
      'Totals are not directly comparable across that seam.',
    entries: [
      {
        title: 'Years shown on different reporting bases',
        text:
          'FY2003–2024 figures are drawn from the CA State Controller ByTheNumbers ' +
          'all-governmental-funds dataset — a comprehensive view that includes the ' +
          'General Fund, enterprise funds, debt service, and all other city funds. ' +
          'FY2018–2026 figures are from the city\'s Demand Register transaction data, ' +
          'which reflects actual expenditure transactions rather than an adopted budget ' +
          'appropriation and covers the city\'s operating activity. Because the scope ' +
          'and methodology differ, a year-over-year comparison across this boundary ' +
          'will reflect the basis change, not a real spending change.',
        source_name: 'CA State Controller — ByTheNumbers Expenditures',
        source_url: 'https://bythenumbers.sco.ca.gov/d/ju3w-4gxp',
        source_date: '2026-06-16',
      },
    ],
  },
};
