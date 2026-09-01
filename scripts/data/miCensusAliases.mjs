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

/**
 * ⚠⚠ TOWNSHIP AND VILLAGE ALIASES ARE KEYED ON THE MUNICODE, NOT THE NAME.
 *
 * The registry above is keyed on the F-65 name because a Michigan CITY name is
 * unique statewide. A township name is not, and neither key would work here:
 *
 *   • `AuSable` names TWO different governments — `Au Sable charter township`
 *     in Iosco County (351020) and `Au Sable township` in Roscommon County
 *     (721010). One name, two units, two Census rows.
 *   • `LeRoy` and `St Charles` each name BOTH a township and a village
 *     (671070/673020 and 731210/733050).
 *
 * A name-keyed entry would silently resolve one of each pair to the other's
 * Census row — the St. Joseph trap again, and the seventh time this campaign has
 * met that shape. The municode is the publisher's own stable key and is unique
 * by construction, so it is what these are keyed on.
 *
 * ⚠ Values are the EXACT Census `NAME`, read from the published files on
 * 2026-09-01: townships from SUMLEV 061 of `sub-est2024_26.csv`, villages from
 * SUMLEV 162 of the same file. All fifteen are abbreviation or word-spacing
 * differences, with one exception noted below.
 */
export const MI_TV_CENSUS_ALIASES = Object.freeze({
  // Townships — `St`/`Mt` written short by the F-65 and long by the Census.
  '111180': 'St. Joseph charter township', // Berrien
  '151130': 'St. James township', //          Charlevoix
  '491110': 'St. Ignace township', //         Mackinac
  '731210': 'St. Charles township', //        Saginaw
  '741220': 'St. Clair township', //          St. Clair
  '091110': 'Mount Forest township', //       Bay
  '561140': 'Mount Haley township', //        Midland
  // Townships — one word to the F-65, two to the Census.
  '351020': 'Au Sable charter township', //   Iosco    ⚠ see AuSable note above
  '721010': 'Au Sable township', //           Roscommon ⚠ the other AuSable
  '581090': 'La Salle township', //           Monroe
  '671070': 'Le Roy township', //             Osceola
  // ⚠⚠ THE ONE ENTRY WHERE THE BASE WORD ITSELF DIFFERS, not just its spacing.
  // The F-65 files Chippewa County's township as `Drummond Island Township`; the
  // Census names it `Drummond township`. They are the same government — the
  // township is the one that covers Drummond Island — and Chippewa's only other
  // near name is `Detour township`, a different unit that files separately as
  // municode 171040. Written down rather than matched, because no normalising
  // rule connects the two and a fuzzy one would reach `Detour`.
  '171060': 'Drummond township', //           Chippewa
  // Villages.
  '673020': 'Le Roy village', //              Osceola
  '733050': 'St. Charles village', //         Saginaw
  // ⚠ The Census name contains the word `Village` as part of the place name, so
  // stripping the type word leaves `De Tour Village`, which is correct.
  '173010': 'De Tour Village village', //     Chippewa
});

/** Strip the Census trailing type word to get a display name. */
export function displayFromCensusName(censusName) {
  return String(censusName ?? '')
    .replace(/\s+(city|village|town|borough|CDP)$/i, '')
    .trim();
}

/**
 * Turn a Census township `NAME` into TT's display form.
 * `Comstock charter township` -> `Comstock Charter Township`.
 */
export function displayFromCensusTownship(censusName) {
  return String(censusName ?? '')
    .replace(/\s+charter\s+township$/i, ' Charter Township')
    .replace(/\s+township$/i, ' Township')
    .trim();
}
