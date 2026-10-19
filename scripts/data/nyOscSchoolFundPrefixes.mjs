// NO SHEBANG — see scripts/lib/nyOsc.mjs.
/**
 * NY SCHOOL DISTRICT fund letter -> fund type.
 *
 * ⚠⚠ THIS IS A DIFFERENT PUBLICATION FROM THE CITY REGISTRY, NOT A COPY OF IT.
 * `nyOscFundPrefixes.mjs` cites the Accounting and Reporting Manual for
 * Counties, Cities, Towns, Villages, Libraries and Soil and Water Conservation
 * Districts. School districts have their OWN manual, and the two disagree about
 * the same letters. Evidence of record:
 * `docs/NY/osc-arm-school-districts.pdf`.
 *
 * ⚠⚠ `C` IS THE TRAP. For a CITY, food service and similar fee-based
 * operations sit in an `E_` ENTERPRISE fund and are EXCLUDED from
 * total_governmental. For a DISTRICT the manual lists "School Food Service
 * Programs  C" under SPECIAL REVENUE, which is governmental and INCLUDED.
 * 278,779 rows ride on it. Carrying the city instinct across understates every
 * district with a lunch program.
 *
 * ⚠ Districts have NO enterprise and NO internal service funds at all.
 *
 * ⚠ `CS`, `TN` and `B` occur in FY1995-FY2012 and are NOT in the manual's
 * table, so they are deliberately absent: 3,762 of 43,163 total_governmental
 * cells (8.71%) publish `unknown`, every one of them before FY2013. `CS` is
 * retired in the CITY data over the same era and the obvious CS->MS rename was
 * tested there and DISPROVED — do not re-litigate it from this side without
 * new evidence. See scripts/data/nyOscFundPrefixes.mjs.
 */

const ARM = 'OSC Accounting and Reporting Manual for School Districts, '
  + '"The following funds are provided for school districts in New York State"';

export const NY_SCHOOL_FUND_PREFIXES = Object.freeze({
  // ── Governmental ────────────────────────────────────────────────────────
  A: { type: 'general', name: 'General',
    citation: `${ARM}: Governmental Funds — "General  A".` },
  C: { type: 'special_revenue', name: 'School Food Service Programs',
    citation: `${ARM}: Governmental Funds, Special Revenue — "School Food Service Programs  C". ⚠ GOVERNMENTAL for a district; the equivalent city activity is an E_ enterprise fund.` },
  CM: { type: 'special_revenue', name: 'Miscellaneous Revenue',
    citation: `${ARM}: Governmental Funds, Special Revenue — "Miscellaneous Revenue  CM".` },
  F: { type: 'special_revenue', name: 'Special Aid',
    citation: `${ARM}: Governmental Funds, Special Revenue — "Special Aid  F".` },
  L: { type: 'special_revenue', name: 'Public Library',
    citation: `${ARM}: Governmental Funds, Special Revenue — "Public Library  L".` },
  H: { type: 'capital_projects', name: 'Capital Projects',
    citation: `${ARM}: Governmental Funds — "Capital Projects  H".` },
  PN: { type: 'permanent', name: 'Permanent',
    citation: `${ARM}: Governmental Funds — "Permanent  PN".` },
  V: { type: 'debt_service', name: 'Debt Service',
    citation: `${ARM}: Governmental Funds — "Debt Service  V".` },

  // ── Fiduciary — EXCLUDED ─────────────────────────────────────────────────
  TC: { type: 'fiduciary', name: 'Custodial',
    citation: `${ARM}: Fiduciary Funds — "Custodial  TC"; "Custodial Funds (TC) - used to account for any remaining fiduciary activities".` },
  TE: { type: 'fiduciary', name: 'Private-Purpose Trust',
    citation: `${ARM}: Fiduciary Funds — "Private-Purpose Trust  TE".` },
});

/** The fund types that make up `total_governmental` for a school district. */
export const SCHOOL_GOVERNMENTAL_TYPES = Object.freeze(new Set([
  'general', 'special_revenue', 'capital_projects', 'permanent', 'debt_service',
]));
