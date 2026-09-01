/**
 * Michigan sweep — the twelve units whose F-65 name does not equal its Census
 * PEP name, resolved one at a time and written down.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ⚠⚠ AN EXPLICIT REGISTRY, NOT A NORMALISER. A rule like "expand Mt to Mount,
 * insert a period after St" would resolve all twelve — and it would also be a
 * tolerance, applied blind, to 364 units nobody re-checked. This campaign's
 * standing rule is "never a tolerance where an exact registry will do", and the
 * registry is twelve lines a human can read in a minute.
 *
 * ⚠⚠ THE TRAP THIS AVOIDS: `St Joseph` and `St Joseph County` are DIFFERENT
 * GOVERNMENTS — a city of 7,930 and a county of 61,171 — and the F-65 spells the
 * city with a period (`St. Joseph`, via `City of St. Joseph`) while spelling
 * `St Clair` without one. A fuzzy matcher that collapsed punctuation could pair
 * a city with its county's population and move $0 while being wrong by 8×. It is
 * the Saint-Louis-County shape again, in its sixth appearance in this campaign.
 *
 * ⚠ Every value below was read from the published Census files on 2026-08-31:
 *   places   _acfr-work/mi-sweep/sub-est2024_26.csv (SUMLEV 162)
 *   counties _acfr-work/co-est2024-alldata.csv      (SUMLEV 050, STNAME Michigan)
 * Vintage 2024 — the same program and vintage as the NC, FL, GA, PA, IN and
 * session-7a Michigan entities, so all populations remain comparable.
 */

/**
 * F-65 roster name -> the exact Census `NAME`, including its trailing type word.
 * The generator strips that trailing word for display, so the name TT shows and
 * the population TT stores come from the same Census row by construction.
 */
export const MI_CENSUS_ALIASES = Object.freeze({
  // Abbreviations the F-65 writes short and the Census writes long.
  'Sault Ste Marie': 'Sault Ste. Marie city',
  'Mt Morris': 'Mount Morris city',
  'Mt Pleasant': 'Mount Pleasant city',
  'St Ignace': 'St. Ignace city',
  'St Louis': 'St. Louis city',
  'St Clair': 'St. Clair city',
  'St Clair Shores': 'St. Clair Shores city',
  // ⚠ Counties, kept separate from the like-named cities above and below.
  'St Clair County': 'St. Clair County',
  'St Joseph County': 'St. Joseph County',
  // ⚠ Three units the F-65 files under a village-flavoured name while the Census
  // classifies them as incorporated places. `the Village of ...` is the
  // publisher's own string, lower-case article included.
  'the Village of Douglas': 'Douglas city',
  'the Village of Clarkston': 'Village of Clarkston city',
  'Grosse Pointe Shores City of the Village': 'Village of Grosse Pointe Shores city',
});

/** Strip the Census trailing type word to get a display name. */
export function displayFromCensusName(censusName) {
  return String(censusName ?? '')
    .replace(/\s+(city|village|town|borough|CDP)$/i, '')
    .trim();
}
