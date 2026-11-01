/**
 * Census FIPS geoid derivation for TT entities.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * PURE: no I/O, no network, no database. Callers parse the Census PEP files
 * (scripts/lib/censusPep.mjs) and hand the rows in. That is what makes every
 * rule here testable from a small committed fixture.
 *
 * ── THE SHAPE EVERY RESOLVER RETURNS ───────────────────────────────────────
 *
 *   { geoid: string|null, basis: string|null, reason: string|null }
 *
 * so a driver can tally outcomes without special-casing a tier. A null geoid
 * ALWAYS carries a reason; a non-null geoid ALWAYS carries a basis. The two
 * travel together because a value with no provenance cannot later be told
 * apart from a guess — the same argument that put `basis` on budgets.
 *
 * ── ⚠⚠ NULL IS A CORRECT ANSWER; A WRONG GEOID IS NOT ──────────────────────
 *
 * Every resolver refuses to choose between candidates. A missing geoid costs a
 * consumer one link; a wrong one points a reader at another government's
 * budget while looking authoritative — which is the failure the `?entity=`
 * Bloomington fallback made, and the reason it was removed.
 */

/**
 * abbrev -> 2-digit state FIPS. TEXT, because '01' is not 1: an integer column
 * or a parsed number eats the leading zero and Alabama becomes Alaska's
 * neighbour in a sort and nothing anywhere throws.
 *
 * ⚠ Verified against a committed Census slice by tests/geoidMatch.test.mjs —
 * this table is not trusted on its own.
 */
export const STATE_FIPS = Object.freeze({
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25',
  MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32',
  NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
  OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47',
  TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55',
  WY: '56',
});

/** The only legal `geoid_basis` strings. The DB CHECK and the verifier both
 *  restate this set; all three must agree. */
export const BASIS = Object.freeze({
  state: 'static-state-fips',
  county: 'census-pep-050-exact',
  place: 'census-pep-162-exact',
  township: 'census-pep-061-county-scoped',
  // ⚠ New England: a town that exists ONLY as an MCD, matched by name within
  // the state because its stored name carries no county to scope by.
  mcdState: 'census-pep-061-state-scoped',
});

const hit = (geoid, basis) => ({ geoid, basis, reason: null });
const miss = (reason) => ({ geoid: null, basis: null, reason });

/** A state's geoid is its 2-digit FIPS — static, and the only tier that needs
 *  no Census lookup. */
export function resolveState(abbrev) {
  const fips = STATE_FIPS[abbrev];
  return fips ? hit(fips, BASIS.state) : miss(`no state FIPS for abbrev ${abbrev}`);
}

// ── County (SUMLEV 050) ─────────────────────────────────────────────────────

/**
 * Normalise a county name for MATCHING ONLY — never for display.
 *
 * ⚠ The trailing jurisdiction word is dropped from BOTH sides so the
 * non-"County" states behave: Louisiana files parishes, Alaska files boroughs
 * and census areas, and a few places are legally a "City and Borough". TT and
 * Census do not always agree on which of those words they carry.
 */
function countyKey(name) {
  return String(name)
    .replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Index one state's counties from the national county file: name -> 3-digit
 *  COUNTY code. Scoped to a state because county names repeat across states. */
export function buildCountyIndex(rows, stateFips) {
  const idx = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '050' || r.STATE !== stateFips) continue;
    // ⚠ CTYNAME exists in the COUNTY file (co-est2024-alldata.csv). The place
    // file names its rows NAME instead, so handing this function a sub-est file
    // used to build one bogus entry keyed "undefined" and then miss every
    // county — an empty index that looks like a state with no counties rather
    // than like the wrong file. Fail loudly instead.
    if (r.CTYNAME === undefined) {
      throw new Error(
        'buildCountyIndex: SUMLEV-050 row has no CTYNAME — this looks like the '
        + 'place file (sub-est), not the county file (co-est2024-alldata.csv)'
      );
    }
    idx.set(countyKey(r.CTYNAME), r.COUNTY);
  }
  return idx;
}

export function resolveCounty(index, stateFips, storedName) {
  for (const variant of nameVariants(storedName)) {
    const county = index.get(countyKey(variant));
    if (county) return hit(stateFips + county, BASIS.county);
  }
  return miss(`no county match for "${storedName}"`);
}

// ── Place tier (SUMLEV 162) ─────────────────────────────────────────────────

/**
 * The designators Census appends to a place NAME, lowercased.
 *
 * ⚠⚠ THESE ARE APPENDED TO THE TT NAME, NEVER STRIPPED FROM THE CENSUS NAME.
 *
 * Census lowercases the designator even when the type word is part of the
 * government's legal name, so "Everglades city" is the City of Everglades City
 * and "Bal Harbour village" is the Village of Bal Harbour — one rendering for
 * two different facts. Stripping the tail gives "Everglades", which names no
 * Florida municipality, and eight Michigan villages are genuinely named
 * "... City" and vanish the same way.
 */
const PLACE_DESIGNATORS = [
  'city', 'town', 'village', 'borough', 'municipality',
  'urban county', 'metro government', 'consolidated government',
];

/**
 * The two types whose Census designator must AGREE, not merely be preferred.
 *
 * ⚠⚠ ONLY THESE TWO, and the limit is measured, not cautious. In MCD states a
 * town is a county subdivision and a village is a place; they share a name
 * constantly (the village of Adams sits inside the town of Adams) and they are
 * different governments with different budgets. Letting either fall through to
 * the other's designator produced 255 duplicate geoids in New York alone.
 *
 * ⚠ Everywhere else TT's `entity_type` is a COARSE LABEL that legitimately
 * disagrees with the Census designator — Florida's "Alford" is `city` in TT and
 * "Alford town" in the Census, as are 142 more FL cities, 21 CA cities and 14
 * TX municipalities. Making those strict refused 183 entities that had always
 * been matched correctly, so `city`, `municipality` and `borough` keep the
 * preferred-first order they have always had.
 */
const STRICT_TYPES = new Set(['town', 'village']);

function placeKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The shapes TT stores that Census does not, as alternative raw names.
 *
 * Each is a real, observed divergence, not a speculative one:
 *   "City of Wichita"          TT keeps the formal style; Census says "Wichita city"
 *   "Addison, Somerset County" PA disambiguates same-named boroughs by county,
 *                              the same convention MI uses for townships
 *   "North Saint Paul"         Census abbreviates to "North St. Paul"
 *   "Mt. Healthy"              and spells out where TT abbreviates
 *   "King & Queen County"      Census writes "and"
 *
 * ⚠ These only ADD candidates. Nothing here rewrites the stored name, and a
 * variant that matches nothing costs a failed map lookup and no more.
 */
function nameVariants(storedName) {
  const seen = new Set();
  const out = [];
  const add = (n) => {
    const t = String(n).trim();
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  };

  let base = String(storedName);
  add(base);

  // Drop a "…, X County" disambiguation suffix.
  const comma = base.lastIndexOf(',');
  if (comma !== -1 && /\s*County\s*$/i.test(base.slice(comma + 1))) {
    base = base.slice(0, comma).trim();
    add(base);
  }

  // Drop a formal "City of " / "Town of " / "Village of " prefix.
  const stripped = base.replace(/^(City|Town|Village|Borough|Township) of\s+/i, '');
  if (stripped !== base) add(stripped);

  // Saint <-> St., Mount <-> Mt., & -> and, on every candidate so far.
  for (const n of [...out]) {
    add(n.replace(/\bSt\.?\s+/gi, 'Saint '));
    add(n.replace(/\bSaint\s+/gi, 'St. '));
    add(n.replace(/\bMt\.?\s+/gi, 'Mount '));
    add(n.replace(/\bMount\s+/gi, 'Mt. '));
    add(n.replace(/\s*&\s*/g, ' and '));
  }
  return out;
}

/** Census's trailing designator, for splitting a NAME into bare + designator. */
const TRAILING_DESIGNATOR_RE = new RegExp(
  '\\s+(' + PLACE_DESIGNATORS.join('|') + ')$', 'i',
);

/**
 * Index whole places TWICE — by bare name and by full name.
 *
 * ⚠⚠ WHY TWO. Matching on one key alone is wrong in opposite directions:
 *
 *   full-name only   TT stores "Elizabeth"; Census stores "Elizabeth town".
 *                    A bare TT name never matches.
 *   bare-name only   Census renders the City of Everglades City as
 *                    "Everglades city", so stripping gives "Everglades",
 *                    which names no Florida municipality.
 *
 * And generating `TT name + designator` against a FULL-name index collides two
 * real places: "Elizabeth" + "town" keys identically to the town actually
 * named "Elizabethtown". Indiana's two towns both claimed geoid 1820674 on the
 * first national run — caught only by the verifier's uniqueness check.
 *
 * So: bare index answers the common case exactly, full index answers the
 * designator-in-the-legal-name case, and neither manufactures the other's
 * collision. `resolvePlace` tries bare FIRST.
 */
export function buildPlaceIndex(rows) {
  const byBare = new Map();
  const byFull = new Map();
  for (const r of rows) {
    // ⚠ 162 ONLY. A 157 row is a place PART and repeats its parent's PLACE
    // code, so admitting one manufactures an ambiguity out of a single real
    // place and nulls a match that was never in doubt.
    if (r.SUMLEV !== '162') continue;
    const geoid = r.STATE + r.PLACE;
    const desig = (TRAILING_DESIGNATOR_RE.exec(r.NAME) || [null, ''])[1].toLowerCase();
    const bare = r.NAME.replace(TRAILING_DESIGNATOR_RE, '');

    const bk = placeKey(bare) + '|' + desig;
    if (!byBare.has(bk)) byBare.set(bk, new Set());
    byBare.get(bk).add(geoid);

    const fk = placeKey(r.NAME);
    if (!byFull.has(fk)) byFull.set(fk, new Set());
    byFull.get(fk).add(geoid);
  }
  return { byBare, byFull };
}

/**
 * Index places BY COUNTY, from the SUMLEV-157 place-PART rows.
 *
 * ⚠ 157 is the only row that carries a real COUNTY for a place — a whole-place
 * 162 row always reads COUNTY '000'. A place straddling a county line has
 * several 157 rows, which is why this maps to a Set and not a single geoid.
 */
export function buildPlaceCountyIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '157') continue;
    const geoid = r.STATE + r.PLACE;
    // ⚠ Keyed under BOTH the full and bare name, because resolvePlace reaches
    // here from either index and hands over whichever key matched.
    for (const n of [r.NAME, r.NAME.replace(TRAILING_DESIGNATOR_RE, '')]) {
      const k = r.COUNTY + '|' + placeKey(n);
      if (!idx.has(k)) idx.set(k, new Set());
      idx.get(k).add(geoid);
    }
  }
  return idx;
}

/**
 * Resolve a place-tier entity.
 *
 * `opts.placeCountyIndex` + `opts.countyIndex` enable county disambiguation:
 * Pennsylvania has genuinely DISTINCT boroughs sharing a name across counties
 * — Centerville in Crawford County and Centerville in Washington County are two
 * different governments — and TT disambiguates them in the stored name, the
 * same convention MI uses for townships. Without the county the matcher must
 * refuse; with it, refusing would be throwing away the answer.
 *
 * ⚠ The county is consulted ONLY to break a tie that already exists. It never
 * widens a search, so it cannot turn a clean miss into a match.
 */
export function resolvePlace(index, storedName, opts = {}) {
  const { byBare, byFull } = index;

  // ⚠⚠ THE DESIGNATOR MUST AGREE — it is part of the identity, not a hint.
  // Pennsylvania has a Franklin BOROUGH in Cambria County and a Franklin CITY
  // in Venango County, and with a fixed order starting at 'city' the borough
  // matched the city and both claimed 4227456. Preferring the entity's own
  // type fixed that pair but still FELL THROUGH to every other designator,
  // which is how 255 New York towns took their village's place record: a town
  // is a county subdivision there, a village is a place, they share a name,
  // and they are different governments with different budgets.
  //
  // ⚠ If the census has no place of the entity's own kind, the right answer is
  // that there is NO PLACE — the MCD layer then gets its turn. That is also
  // what sends Massachusetts' "Agawam Town" to its MCD rather than to the
  // city-form place record of the same name.
  //
  // ⚠ An UNKNOWN type stays permissive. Missing metadata is not evidence that
  // a designator is wrong, and refusing everything would turn one gap into two.
  const preferred = String(opts.entityType || '').toLowerCase();
  const ordered = STRICT_TYPES.has(preferred)
    ? [preferred]
    : [
      ...PLACE_DESIGNATORS.filter((d) => d === preferred),
      ...PLACE_DESIGNATORS.filter((d) => d !== preferred),
    ];

  for (const variant of nameVariants(storedName)) {
    const k = placeKey(variant);
    // Bare-name index first, designator-scoped, preferred type leading.
    for (const d of ordered) {
      const set = byBare.get(k + '|' + d);
      if (!set) continue;
      if (set.size > 1) {
        const picked = disambiguateByCounty(k, set, storedName, opts);
        if (picked) return hit(picked, BASIS.place);
        return miss(`ambiguous place match for "${storedName}": ${[...set].join(', ')}`);
      }
      return hit([...set][0], BASIS.place);
    }
  }

  // Then the full-name index, for a legal name that ends in a designator word.
  for (const variant of nameVariants(storedName)) {
    const set = byFull.get(placeKey(variant));
    if (!set) continue;
    if (set.size > 1) {
      const picked = disambiguateByCounty(placeKey(variant), set, storedName, opts);
      if (picked) return hit(picked, BASIS.place);
      return miss(`ambiguous place match for "${storedName}": ${[...set].join(', ')}`);
    }
    return hit([...set][0], BASIS.place);
  }

  return miss(`no place match for "${storedName}"`);
}

/** Narrow an ambiguous place match using the county named in the stored name.
 *  Returns a geoid only when exactly one candidate sits in that county. */
function disambiguateByCounty(key, candidates, storedName, opts) {
  const { placeCountyIndex, countyIndex } = opts;
  if (!placeCountyIndex || !countyIndex) return null;

  const comma = storedName.lastIndexOf(',');
  if (comma === -1) return null;
  const countyHalf = storedName.slice(comma + 1).trim();
  if (!/County$/i.test(countyHalf)) return null;

  const countyFips = countyIndex.get(countyKey(countyHalf));
  if (!countyFips) return null;

  const inCounty = placeCountyIndex.get(countyFips + '|' + key);
  if (!inCounty) return null;
  const narrowed = [...candidates].filter((g) => inCounty.has(g));
  return narrowed.length === 1 ? narrowed[0] : null;
}

// ── Township / minor civil division (SUMLEV 061) ────────────────────────────

/** Matches a Census MCD name that is genuinely a township. */
const CENSUS_TOWNSHIP_RE = /\s+(charter\s+)?township$/i;
/** Matches the township designator on a TT-stored name. */
const STORED_TOWNSHIP_RE = /\s+(Charter\s+)?Township$/i;

function townshipKey(bareName) {
  return String(bareName).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Index one state's TOWNSHIPS: `${COUNTY}|${name}` -> 10-digit MCD geoid.
 *
 * ⚠⚠ THE DESIGNATOR IS REQUIRED HERE, NOT STRIPPED — the inverse of the place
 * tier above, and the single rule this whole tier depends on.
 *
 * In an MCD state an incorporated city is ALSO a county subdivision, so
 * "Adrian city" and "Adrian township" are both SUMLEV-061 rows in Lenawee
 * County. Admitting anything that is not literally a township collapses the
 * pair onto one key and the matcher then has two candidate geoids for one
 * township. Measured against Michigan: 105 false ambiguities with the
 * designator normalised away, 0 with it required.
 */
export function buildMcdIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '061') continue;
    if (!CENSUS_TOWNSHIP_RE.test(r.NAME)) continue;
    const k = r.COUNTY + '|' + townshipKey(r.NAME.replace(CENSUS_TOWNSHIP_RE, ''));
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(r.STATE + r.COUNTY + r.COUSUB);
  }
  return idx;
}

/**
 * Resolve a township from its TT-stored name.
 *
 * TT stores Michigan townships as "Acme Township, Grand Traverse County" —
 * both halves in one string. The county half is what makes 117 township names
 * naming 302 townships unambiguous; without it the name alone is not a key.
 */
export function resolveTownship(mcdIndex, countyIndex, stateFips, storedName) {
  const comma = storedName.lastIndexOf(',');
  if (comma === -1) {
    return miss(`township name carries no county: "${storedName}"`);
  }
  const twpHalf = storedName.slice(0, comma).replace(STORED_TOWNSHIP_RE, '').trim();
  const countyHalf = storedName.slice(comma + 1).trim();

  const county = countyIndex.get(countyKey(countyHalf));
  if (!county) return miss(`no county match for "${countyHalf}"`);

  // ⚠ The same name divergences the place tier normalises apply here too — PA
  // writes "Mt Joy Township" where Census spells "Mount Joy township". Leaving
  // them out of this tier made one spelling resolve as a borough and fail as a
  // township, for no reason a reader could see.
  let set = null;
  for (const variant of nameVariants(twpHalf)) {
    set = mcdIndex.get(county + '|' + townshipKey(variant));
    if (set) break;
  }
  if (!set) return miss(`no township match for "${twpHalf}" in county ${county}`);
  if (set.size > 1) {
    return miss(`ambiguous township match for "${storedName}": ${[...set].join(', ')}`);
  }
  return hit([...set][0], BASIS.township);
}


// ── New England: a town that is an MCD and not a place ──────────────────────

/**
 * Index every MCD in a state by name alone.
 *
 * ⚠⚠ WHY THIS TIER EXISTS. Massachusetts files 351 SUMLEV-061 MCDs and only
 * 58 SUMLEV-162 places, so most MA towns have NO place FIPS at all — Census
 * renders Amherst as "Amherst Town city", a 061 row with no 162 counterpart.
 * No amount of designator-appending finds a row that is not there.
 *
 * The lesson generalises past Massachusetts: THE TIER IS A PROPERTY OF THE
 * STATE'S CENSUS STRUCTURE, NOT OF TT's `entity_type` LABEL. The same holds
 * for CT, RI, NH, VT and ME.
 *
 * ⚠ Unlike buildMcdIndex this does NOT require a township designator, because
 * a New England town is not a township — and it is keyed by name alone
 * because the stored name carries no county to scope by. Both relaxations are
 * safe only because this is a FALLBACK, tried after the place lookup misses,
 * and because an ambiguous name still resolves to null.
 */
export function buildMcdStateIndex(rows) {
  const byBare = new Map();
  const byFull = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '061') continue;
    const geoid = r.STATE + r.COUNTY + r.COUSUB;
    // ⚠⚠ SPLIT THE DESIGNATOR OFF, exactly as buildPlaceIndex does, and for
    // the same reason. Keying the whole name makes "German town" key as
    // `germantown`, which is also what TT's "Germantown" keys as — two real
    // New York towns in different counties, one geoid. Separating the parts
    // gives `german|town` and `germantown|town`.
    const desig = (TRAILING_DESIGNATOR_RE.exec(r.NAME) || [null, ''])[1].toLowerCase();
    const bare = r.NAME.replace(TRAILING_DESIGNATOR_RE, '');
    const bk = placeKey(bare) + '|' + desig;
    if (!byBare.has(bk)) byBare.set(bk, new Set());
    byBare.get(bk).add(geoid);

    for (const variant of nameVariants(r.NAME)) {
      const fk = placeKey(variant);
      if (!byFull.has(fk)) byFull.set(fk, new Set());
      byFull.get(fk).add(geoid);
    }
  }
  return { byBare, byFull };
}

export function resolveMcdByState(index, storedName, opts = {}) {
  const { byBare, byFull } = index;
  const type = String(opts.entityType || '').toLowerCase();

  // ⚠⚠ A VILLAGE IS A PLACE, NEVER A COUNTY SUBDIVISION. New York villages sit
  // INSIDE a same-named town, so offering them the MCD layer handed both
  // governments one geoid — 15 of the 255 duplicates on 2026-10-31. If the
  // place layer could not name a village, the answer is that it is unnamed.
  if (type === 'village') {
    return miss(`no MCD match for "${storedName}": a village is a place, not a county subdivision`);
  }

  // ⚠ The designator is tried PREFERRED-FIRST and then permissively here,
  // unlike resolvePlace which requires agreement. Massachusetts is why: it
  // files its city-form towns as "Amherst Town city", a `city` designator on a
  // government TT types `town`. Demanding agreement would drop 300+ MA towns.
  const ordered = PLACE_DESIGNATORS.includes(type)
    ? [type, ...PLACE_DESIGNATORS.filter((d) => d !== type)]
    : [...PLACE_DESIGNATORS];

  const take = (set) => {
    if (set.size > 1) return miss(`ambiguous MCD match for "${storedName}": ${[...set].join(', ')}`);
    return hit([...set][0], BASIS.mcdState);
  };

  // 1. The name as stored, against bare+designator. Nothing is fused into the
  //    bare key, so a manufactured designator cannot collide with a real name.
  for (const variant of nameVariants(storedName)) {
    for (const d of ordered) {
      const set = byBare.get(placeKey(variant) + '|' + d);
      if (set) return take(set);
    }
  }
  // 2. Then the Massachusetts shape, where "Town" belongs to the NAME. Tried
  //    only after every plain reading has missed, so "Beekman" can never be
  //    read as "Beekmantown" while a real "Beekman town" exists.
  for (const variant of nameVariants(storedName)) {
    for (const d of ordered) {
      const set = byBare.get(placeKey(variant + ' Town') + '|' + d);
      if (set) return take(set);
    }
  }
  // 3. Last, a legal name that ends in its own designator.
  for (const variant of nameVariants(storedName)) {
    const set = byFull.get(placeKey(variant));
    if (set) return take(set);
  }
  return miss(`no MCD match for "${storedName}"`);
}

// ── Composing two lookups ───────────────────────────────────────────────────

/**
 * Take a second lookup's answer ONLY when the first was a clean miss.
 *
 * ⚠⚠ THE WHOLE POINT IS THE AMBIGUITY GUARD. Every resolver above refuses to
 * choose between two real governments, and a looser second lookup run over the
 * same name would quietly undo that refusal by picking one. An ambiguous
 * primary is returned untouched and the fallback is never even called.
 *
 * ⚠ The fallback is a THUNK because building its index costs a file fetch.
 * Nothing is downloaded for an entity the base vintage already answered.
 *
 * Two callers, both in backfillGeoids.mjs: the New England MCD fallback, and
 * the forward Census vintage that names a government incorporated after the
 * base vintage was cut.
 *
 * @param {{geoid: string|null, basis: string|null, reason: string|null}} primary
 * @param {null | (() => {geoid: string|null, basis: string|null, reason: string|null})} fallback
 */
export function preferResolved(primary, fallback) {
  if (primary.geoid) return primary;
  if (!fallback) return primary;
  if (primary.reason?.startsWith('ambiguous')) return primary;
  const alt = fallback();
  // ⚠ The PRIMARY reason survives a fallback that also missed: "no place match
  // for X" names the lookup that was supposed to work.
  return alt.geoid ? alt : primary;
}

/**
 * What applying a regenerated backfill would actually do, per tuple.
 *
 * ⚠⚠ THE FILE IS NOT A LIST OF CHANGES. It is every resolution the matcher can
 * make, so most tuples restate a value the database already holds. Writing it
 * blind hides the one case that matters: a geoid moving to a DIFFERENT
 * government, which is what a matcher defect looks like from the outside
 * (Elizabeth/Elizabethtown IN, Franklin/Franklin PA — both wrote the wrong
 * government and were invisible to a count, a length check and a basis check).
 *
 * `toWrite` is fills plus basis-only corrections — deliberately NOT changes.
 * A caller that wants those must ask for them after reading them.
 *
 * @param {Array<{id: string, geoid: string, basis: string}>} tuples
 * @param {Map<string, {geoid: string|null, basis: string|null}>} current
 */
export function classifyGeoidWrites(tuples, current) {
  const out = {
    fill: [], same: [], change: [], basisOnly: [], absent: [], collision: [], toWrite: [],
  };

  // ⚠⚠⚠ A COLLISION LIVES BETWEEN ROWS, SO NO PER-ROW CHECK CAN SEE IT. The
  // 2026-10-31 fill wrote 255 duplicate geoids — 514 NY rows, each a village
  // and its containing town claiming one government — past an applier that
  // checked only that the tuples' IDs were distinct, which they were.
  const heldBy = new Map(); // geoid -> entity id that already holds it
  for (const [id, now] of current) if (now.geoid != null) heldBy.set(now.geoid, id);
  const proposals = new Map(); // geoid -> how many tuples want it
  for (const t of tuples) proposals.set(t.geoid, (proposals.get(t.geoid) ?? 0) + 1);

  for (const t of tuples) {
    const now = current.get(t.id);
    // ⚠ Absent is not "null geoid": the entity itself is gone from the table,
    // so there is nothing to update and an UPDATE would silently affect 0 rows.
    if (!now) { out.absent.push(t); continue; }
    // An entity keeping the value it already has cannot collide with itself.
    if (now.geoid === t.geoid) {
      if (now.basis !== t.basis) { out.basisOnly.push({ ...t, from: now.basis }); out.toWrite.push(t); }
      else out.same.push(t);
      continue;
    }
    // ⚠ Taking a geoid another entity holds, or that a second tuple also
    // wants, means the matcher cannot say which government this is. NEITHER
    // side is written: picking one is how a reader lands on the wrong budget.
    const owner = heldBy.get(t.geoid);
    if ((owner && owner !== t.id) || proposals.get(t.geoid) > 1) {
      out.collision.push({ ...t, heldBy: owner ?? null });
      continue;
    }
    if (now.geoid == null) { out.fill.push(t); out.toWrite.push(t); continue; }
    out.change.push({ ...t, from: now.geoid, to: t.geoid });
  }
  return out;
}

/**
 * Drop every update whose geoid another update also claims.
 *
 * ⚠⚠ ALL CLAIMANTS GO, not the duplicates after the first. Two entities
 * claiming one government means the matcher is wrong about at least one of
 * them and cannot say which, so keeping either is a coin flip that looks
 * authoritative. Null is a correct answer; a wrong geoid is not.
 *
 * ⚠ Measured 2026-10-31: this removes 514 of 10,413 — New York villages and
 * the towns that contain them, which share a name. The generator resolved both
 * to one place (or one MCD) and nothing downstream could tell them apart.
 *
 * @param {Array<[string, string, string]>} updates [id, geoid, basis] tuples
 */
export function dropCollidingGeoids(updates) {
  const claims = new Map();
  for (const [, geoid] of updates) claims.set(geoid, (claims.get(geoid) ?? 0) + 1);
  const kept = [];
  const collided = [];
  for (const u of updates) (claims.get(u[1]) > 1 ? collided : kept).push(u);
  return { kept, collided };
}

/**
 * Index one state's county subdivisions by COUNTY, bare name and designator.
 *
 * ⚠ Distinct from buildMcdIndex, which admits only Census names ending in
 * "township" and so has never been able to see New York, where every MCD is
 * named "X town". This one takes every 061 row.
 *
 * ⚠ The designator is split off rather than fused, for the reason
 * buildMcdStateIndex now documents: fusing makes "German town" collide with
 * the town actually named "Germantown".
 */
export function buildMcdCountyIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '061') continue;
    const desig = (TRAILING_DESIGNATOR_RE.exec(r.NAME) || [null, ''])[1].toLowerCase();
    const bare = r.NAME.replace(TRAILING_DESIGNATOR_RE, '');
    const k = `${r.COUNTY}|${placeKey(bare)}|${desig}`;
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(r.STATE + r.COUNTY + r.COUSUB);
  }
  return idx;
}

/**
 * Resolve a town to its MCD using the county TT already stores in the name.
 *
 * ⭐ THE COUNTY IS NOT GUESSED — it is read from the stored name, exactly as
 * resolveTownship does. New York has two towns named Albion, in Orleans and
 * Oswego; a state-scoped lookup can only call that ambiguous and return null,
 * while TT has carried "Albion, Orleans County" all along.
 *
 * ⚠ A village is refused here for the same reason as in resolveMcdByState: a
 * village is a place, and the only MCD of its name is the town around it.
 */
export function resolveMcdByCounty(index, countyIndex, storedName, opts = {}) {
  const type = String(opts.entityType || '').toLowerCase();
  if (type === 'village') {
    return miss(`no MCD match for "${storedName}": a village is a place, not a county subdivision`);
  }
  const comma = storedName.lastIndexOf(',');
  if (comma === -1 || !/\s*County\s*$/i.test(storedName.slice(comma + 1))) {
    return miss(`no county in the stored name "${storedName}"`);
  }
  const county = countyIndex.get(countyKey(storedName.slice(comma + 1).trim()));
  if (!county) return miss(`no county match for "${storedName.slice(comma + 1).trim()}"`);

  const ordered = PLACE_DESIGNATORS.includes(type)
    ? [type, ...PLACE_DESIGNATORS.filter((d) => d !== type)]
    : [...PLACE_DESIGNATORS];

  for (const variant of nameVariants(storedName.slice(0, comma).trim())) {
    for (const d of ordered) {
      const set = index.get(`${county}|${placeKey(variant)}|${d}`);
      if (!set) continue;
      if (set.size > 1) {
        return miss(`ambiguous MCD match for "${storedName}": ${[...set].join(', ')}`);
      }
      return hit([...set][0], BASIS.township);
    }
  }
  return miss(`no MCD match for "${storedName}" in county ${county}`);
}
