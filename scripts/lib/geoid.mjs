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
    idx.set(countyKey(r.CTYNAME), r.COUNTY);
  }
  return idx;
}

export function resolveCounty(index, stateFips, storedName) {
  const county = index.get(countyKey(storedName));
  return county
    ? hit(stateFips + county, BASIS.county)
    : miss(`no county match for "${storedName}"`);
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

export function buildPlaceIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    // ⚠ 162 ONLY. A 157 row is a place PART and repeats its parent's PLACE
    // code, so admitting one manufactures an ambiguity out of a single real
    // place and nulls a match that was never in doubt.
    if (r.SUMLEV !== '162') continue;
    const k = placeKey(r.NAME);
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(r.STATE + r.PLACE);
  }
  return idx;
}

export function resolvePlace(index, storedName) {
  const candidates = [
    placeKey(storedName),
    ...PLACE_DESIGNATORS.map((d) => placeKey(storedName + ' ' + d)),
  ];
  for (const k of candidates) {
    const set = index.get(k);
    if (!set) continue;
    if (set.size > 1) {
      return miss(`ambiguous place match for "${storedName}": ${[...set].join(', ')}`);
    }
    return hit([...set][0], BASIS.place);
  }
  return miss(`no place match for "${storedName}"`);
}
