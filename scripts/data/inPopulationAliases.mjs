/**
 * Indiana population join — the declared residue.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * 648 of Indiana's 660 governments join to Census PEP 2024 on the name alone.
 * The twelve that do not are declared HERE, individually, with the reason and
 * the census PLACE code — never patched by loosening the match key until the
 * misses disappear, because a looser key is what made `Elizabethtown` take
 * `Elizabeth town`'s population in the first draft.
 *
 * ⚠⚠ KEYED ON THE CENSUS `PLACE` CODE, NOT ON A NAME. A name is not a stable
 * identifier — that is the whole reason this file exists. The loader asserts
 * the code resolves to a real census row BEFORE the join runs, so a well-formed
 * but wrong code cannot sit here inert. `reference_michigan_treasury_f65`
 * records the same defect from the other end: a declared exclusion naming a
 * municode that belonged to a DIFFERENT township excluded nothing at all.
 *
 * ⚠⚠ EVERY ENTRY MUST BE OBSERVED. An alias that never matches, or an absence
 * the census file contradicts, FAILS the load. South Carolina's rule: a
 * declared residue that is not observed rots into dead permission.
 *
 * ⚠ EVERY ONE OF THE NINE ALIASES WAS CHECKED AGAINST THE ROSTER'S OWN COUNTY,
 * not merely against a similar name. All nine agree; that check is what makes
 * this a reading rather than a guess.
 */

/**
 * Roster name -> census PLACE code, where the two publishers spell the same
 * government differently. Population comes from the census row named here.
 */
export const IN_POPULATION_ALIASES = Object.freeze([
  // ── Census spaces the article, Gateway does not ───────────────────────────
  { name: 'LaPorte', placeCode: '42246', censusName: 'La Porte city', county: 'LaPorte',
    reason: 'Census prints "La Porte city"; Gateway prints "LAPORTE CIVIL CITY". Same city, and NOT LaPorte County, which joins separately against the county file.' },
  { name: 'Lacrosse', placeCode: '40662', censusName: 'La Crosse town', county: 'LaPorte',
    reason: 'Census "La Crosse town" vs Gateway "LACROSSE CIVIL TOWN".' },
  { name: 'Lapaz', placeCode: '42192', censusName: 'La Paz town', county: 'Marshall',
    reason: 'Census "La Paz town" vs Gateway "LAPAZ CIVIL TOWN".' },
  { name: 'Lafontaine', placeCode: '40842', censusName: 'La Fontaine town', county: 'Wabash',
    reason: 'Census "La Fontaine town" vs Gateway "LAFONTAINE CIVIL TOWN".' },

  // ── Census expands the abbreviation ───────────────────────────────────────
  { name: 'Mt. Carmel', placeCode: '51354', censusName: 'Mount Carmel town', county: 'Franklin',
    reason: 'Census expands "Mt." to "Mount". Population 78 — Indiana\'s smallest incorporated town in this load.' },
  { name: 'Mt. Ayr', placeCode: '51336', censusName: 'Mount Ayr town', county: 'Newton',
    reason: 'Census expands "Mt." to "Mount".' },

  // ── The publisher drops part of the legal name ────────────────────────────
  // ⚠ These are the INVERSE of the type-word trap. Here the government's real
  // name ends in "City" and it is GATEWAY that has dropped it, so no rule keyed
  // on either side's suffix can fix them — only a declared pair can.
  { name: 'Parker', placeCode: '57978', censusName: 'Parker City town', county: 'Randolph',
    reason: 'The town is legally Parker City; Gateway files it as "PARKER CIVIL TOWN". A TOWN whose name ends in "City".' },
  { name: 'Windfall', placeCode: '84806', censusName: 'Windfall City town', county: 'Tipton',
    reason: 'The town is legally Windfall City; Gateway files it as "WINDFALL CIVIL TOWN". Also a TOWN named "... City".' },
  { name: 'Pines', placeCode: '76256', censusName: 'Town of Pines town', county: 'Porter',
    reason: 'The town is legally "Town of Pines" — the designator is part of the name, and Census prints it twice ("Town of Pines town"). Gateway files it as "PINES CIVIL TOWN".' },
]);

/**
 * Governments with NO census place of any SUMLEV. They keep population 0, which
 * reads as "not known" rather than as a measurement.
 *
 * ⚠ Verified by a case-insensitive search of the WHOLE file, not just the
 * SUMLEV-162 rows: zero hits each. The loader re-checks and FAILS if the census
 * file turns out to cover one of them after all.
 */
export const IN_POPULATION_NO_CENSUS_PLACE = Object.freeze([
  { name: 'Victoria Woods', county: 'Warrick',
    reason: 'No row of any SUMLEV in sub-est2024_18.csv. ⚠ Gateway prints this unit as "Victoria Woods Civil Town" in MIXED CASE while every other unit name in the extract is upper case, which suggests a recent incorporation the 2024 vintage does not yet carry.' },
  { name: 'Fredericksburg', county: 'Washington',
    reason: 'No row of any SUMLEV in sub-est2024_18.csv. ⚠ Also the ONE roster government with no budget rows at all — it filed only FY2011, outside the loaded FY2012-FY2024 window.' },
  { name: 'Hardinsburg', county: 'Washington',
    reason: 'No row of any SUMLEV in sub-est2024_18.csv.' },
]);

export default IN_POPULATION_ALIASES;
