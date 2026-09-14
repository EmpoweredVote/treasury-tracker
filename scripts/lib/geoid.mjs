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

  // ⚠ The entity's OWN type picks which designator is tried first. Pennsylvania
  // has a Franklin BOROUGH in Cambria County and a Franklin CITY in Venango
  // County; with a fixed designator order starting at 'city', the borough
  // matched the city and both claimed 4227456.
  const preferred = String(opts.entityType || '').toLowerCase();
  const ordered = [
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
  const idx = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '061') continue;
    for (const variant of nameVariants(r.NAME)) {
      const k = placeKey(variant);
      if (!idx.has(k)) idx.set(k, new Set());
      idx.get(k).add(r.STATE + r.COUNTY + r.COUSUB);
    }
  }
  return idx;
}

export function resolveMcdByState(index, storedName) {
  const candidates = [];
  for (const variant of nameVariants(storedName)) {
    candidates.push(placeKey(variant));
    for (const d of PLACE_DESIGNATORS) candidates.push(placeKey(variant + ' ' + d));
    candidates.push(placeKey(variant + ' Town'));
    for (const d of PLACE_DESIGNATORS) candidates.push(placeKey(variant + ' Town ' + d));
  }
  for (const k of candidates) {
    const set = index.get(k);
    if (!set) continue;
    if (set.size > 1) {
      return miss(`ambiguous MCD match for "${storedName}": ${[...set].join(', ')}`);
    }
    return hit([...set][0], BASIS.mcdState);
  }
  return miss(`no MCD match for "${storedName}"`);
}
