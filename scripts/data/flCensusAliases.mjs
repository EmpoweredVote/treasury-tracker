/**
 * Florida — the municipalities whose LOGERx spelling does not reach its Census
 * row by name, declared one at a time.
 *
 * NO SHEBANG — tests import this module.
 *
 * 404 of Florida's 411 filing municipalities join their Census place row on the
 * name alone. These seven do not, and every one of them is the SAME hazard from
 * a different angle: **a type word that may or may not be part of the
 * government's name.**
 *
 * ── ⚠⚠ WHY THIS CANNOT BE A RULE ────────────────────────────────────────────
 *
 * Census lowercases the type designator it appends, and it does so EVEN WHEN THE
 * TYPE WORD IS PART OF THE LEGAL NAME. So the file contains
 *
 *     "Everglades city"        the City of Everglades City   -> "Everglades City"
 *     "Bal Harbour village"    the Village of Bal Harbour    -> "Bal Harbour"
 *
 * Two identical renderings, two different facts, and no way to tell them apart
 * from the string. Strip the tail by rule and Everglades City becomes
 * "Everglades", which names no Florida municipality; keep it by rule and Bal
 * Harbour gets a type word its name does not carry.
 *
 * Michigan hit this from the opposite side — eight Michigan villages are
 * genuinely named `... City`, and stripping the word dropped them from the load
 * **with no figure ever being wrong** (see `project_pick_up_next`). A silent
 * drop and a silently wrong label are the same class of defect: both move $0.
 *
 * So there is no rule here. There are seven declared, hand-verified facts, and
 * `scripts/buildFlStatewideEntities.mjs` fails if an eighth municipality ever
 * needs one, or if any entry here stops being used.
 *
 * ── DISPLAY NAMES ───────────────────────────────────────────────────────────
 *
 * TT names municipalities bare — `Miami`, never `City of Miami` — so the
 * display name is the government's name without a "Village of" / "City of"
 * article. Two of the seven need more than a bare stem:
 *
 *   • `Everglades City` keeps its type word: it IS the name.
 *   • `Islamorada, Village of Islands` and `Estero, The Villages of` are filed
 *     by LOGERx in an inverted, sort-key form. Islamorada's legal name really is
 *     "Islamorada, Village of Islands"; Estero's is "Village of Estero". Neither
 *     inverted string is a name a reader should be shown, so both are declared
 *     here rather than transcribed — the same deliberate, documented exception
 *     `stripAccountCode` takes for a machine code prefix.
 *
 * ⚠ `censusName` is the VERBATIM Census `NAME` field, quotes and commas
 * included, because that is the only unambiguous key into the place file.
 */

/**
 * @typedef {{logerxName:string, censusName:string, displayName:string, why:string}} FlCensusAlias
 */

/** @type {FlCensusAlias[]} */
export const FL_CENSUS_ALIASES = [
  {
    logerxName: 'Bal Harbour Village',
    censusName: 'Bal Harbour village',
    displayName: 'Bal Harbour',
    why: 'Village of Bal Harbour — LOGERx capitalises the type word into the name; the name is "Bal Harbour".',
  },
  {
    logerxName: 'Everglades City',
    censusName: 'Everglades city',
    displayName: 'Everglades City',
    why: '⚠ The type word IS the name. The City of Everglades City; "Everglades" names no Florida municipality.',
  },
  {
    logerxName: 'Islamorada, Village of Islands',
    censusName: 'Islamorada, Village of Islands village',
    displayName: 'Islamorada',
    why: 'Legal name is "Islamorada, Village of Islands"; displayed bare, as TT displays every municipality. '
      + '⚠ This is the row whose quoted comma breaks a split(",") CSV reader — see scripts/lib/censusPep.mjs.',
  },
  {
    logerxName: 'Estero, The Villages of',
    censusName: 'Estero village',
    displayName: 'Estero',
    why: 'Village of Estero. LOGERx files an inverted sort-key form; the government\'s name is Estero.',
  },
  {
    logerxName: 'Indian Creek Village',
    censusName: 'Indian Creek village',
    displayName: 'Indian Creek',
    why: 'Village of Indian Creek — type word is not part of the name.',
  },
  {
    logerxName: 'Lazy Lake Village',
    censusName: 'Lazy Lake village',
    displayName: 'Lazy Lake',
    why: 'Village of Lazy Lake — type word is not part of the name.',
  },
  {
    logerxName: 'Miami Shores Village',
    censusName: 'Miami Shores village',
    displayName: 'Miami Shores',
    why: 'Village of Miami Shores — type word is not part of the name.',
  },
];

/** LOGERx `Name` -> alias entry. */
export const FL_ALIAS_BY_LOGERX_NAME = new Map(FL_CENSUS_ALIASES.map((a) => [a.logerxName, a]));

/**
 * The three counties LOGERx spells without the punctuation their names carry.
 *
 * LOGERx files `Desoto`, `St Johns` and `St Lucie`; the counties are DeSoto,
 * St. Johns and St. Lucie, and that is how the Census names them and how a
 * reader should see them. 63 of the 66 counties need no entry.
 *
 * ⚠ This is the same class of exception as the seven municipalities above: a
 * declared, hand-verified fact rather than a punctuation-normalising rule, which
 * would also "fix" spellings that were never wrong.
 */
export const FL_COUNTY_ALIASES = [
  { logerxName: 'Desoto', censusName: 'DeSoto County', displayName: 'DeSoto County' },
  { logerxName: 'St Johns', censusName: 'St. Johns County', displayName: 'St. Johns County' },
  { logerxName: 'St Lucie', censusName: 'St. Lucie County', displayName: 'St. Lucie County' },
];

export const FL_COUNTY_ALIAS_BY_LOGERX_NAME = new Map(FL_COUNTY_ALIASES.map((a) => [a.logerxName, a]));

/**
 * ⚠ The seven Knight-session entities already in `treasury.municipalities`.
 *
 * `treasury_ensure_municipality` keys on (name, state, entity_type), so a
 * display name that drifts by one character creates a SECOND row and orphans the
 * 190 budget rows already hanging off the first. The generator asserts it
 * reproduces every one of these exactly — Michigan's generator does the same for
 * Detroit and Wayne County, for the same reason.
 */
export const FL_EXISTING_TT_NAMES = Object.freeze([
  'Bradenton',
  'Leon County',
  'Manatee County',
  'Miami',
  'Miami-Dade County',
  'Palm Beach County',
  'Tallahassee',
]);

/**
 * ⚠⚠ MUNICIPALITIES THAT DISSOLVED, AND THEREFORE HAVE NO 2024 POPULATION.
 *
 * Two Florida municipalities filed AFRs until they ceased to exist. They are
 * absent from the Census Vintage 2024 place file for the correct reason — the
 * governments are gone — and their LOGERx filing histories stop in exactly the
 * year each dissolution took effect:
 *
 *   Hastings      filed FY2012-FY2018   dissolved 2018, absorbed by St. Johns County
 *   Weeki Wachee  filed FY2012-FY2019   dissolved 2020, absorbed by Hernando County
 *
 * ⚠ THEIR FIGURES ARE STILL REAL, AUDITED AND ORACLED — 15 entity-years of them.
 * Dropping a government because it no longer exists would hide verified history,
 * which is what `feedback_milledgeville_rule` forbids. They load with a NULL
 * population (the honest value: there is no 2024 estimate for a government that
 * dissolved) and a stated reason, exactly as 17 municipalities already in TT do.
 *
 * ⚠ `lastFiscalYear` is asserted against the roster: if either ever files again,
 * the premise is wrong and the generator must fail rather than quietly extend a
 * dissolved government's series.
 */
export const FL_DISSOLVED = [
  {
    logerxName: 'Hastings',
    displayName: 'Hastings',
    lastFiscalYear: 2018,
    why: 'Dissolved 2018; the Town of Hastings was absorbed into St. Johns County. '
      + 'No Census Vintage 2024 population exists because the government does not.',
    countyDbName: 'St. Johns County',
  },
  {
    logerxName: 'Weeki Wachee',
    displayName: 'Weeki Wachee',
    lastFiscalYear: 2019,
    why: 'Dissolved 2020; the City of Weeki Wachee was absorbed into Hernando County. '
      + 'No Census Vintage 2024 population exists because the government does not.',
    countyDbName: 'Hernando County',
  },
];

export const FL_DISSOLVED_BY_LOGERX_NAME = new Map(FL_DISSOLVED.map((d) => [d.logerxName, d]));

/**
 * ⚠⚠ DUVAL COUNTY IS ABSENT FROM LOGERx AND THAT IS NOT A GAP.
 *
 * Florida has 67 counties; 66 file an AFR. Duval County's government was
 * consolidated with the City of Jacksonville in 1968, so Jacksonville — filed by
 * LOGERx as a `City` — IS the county government. Loading a Duval County row
 * would invent a government that does not exist, and reporting Duval as "missing
 * data" would be wrong in the other direction.
 */
export const FL_CONSOLIDATED = Object.freeze({
  'Duval County': 'consolidated with the City of Jacksonville in 1968; Jacksonville files as the county government',
});
