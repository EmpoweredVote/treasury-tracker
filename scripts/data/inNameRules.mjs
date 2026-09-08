/**
 * Indiana Gateway unit name -> TT display name and `entity_type`.
 *
 * NO SHEBANG — tests/inNameRules.test.mjs imports this module.
 *
 * Pure and dependency-free, so every trap below is tested without a database or
 * a 443 MB download. Everything here was measured against the live all-years
 * City/Town + County extracts on 2026-09-07: 660 governments, 119 cities, 449
 * towns, 92 counties.
 *
 * ── ⚠⚠ NEVER STRIP A TRAILING TYPE WORD ────────────────────────────────────
 *
 * Gateway names a unit `<NAME> CIVIL CITY`, `<NAME> CIVIL TOWN` or
 * `<NAME> COUNTY`. Strip only THAT — the publisher's own two-word suffix — and
 * never a bare trailing `CITY` or `TOWN`.
 *
 * **FOURTEEN Indiana governments have "City" inside their actual name, and
 * SEVEN of them are TOWNS:**
 *
 *   cities  HARTFORD CITY · MICHIGAN CITY · TELL CITY · UNION CITY · GAS CITY
 *           OAKLAND CITY · COLUMBIA CITY
 *   towns   CLAY CITY · SWITZ CITY · MONROE CITY · ROME CITY
 *           STATE LINE CITY · CAMBRIDGE CITY · FOUNTAIN CITY
 *
 * A trailing-`CITY` rule turns `CLAY CITY CIVIL TOWN` into `Clay`, and would
 * type it as a city on the way. This is the Everglades City / OIL CITY trap
 * (Florida and Pennsylvania) for the third time — see the sweep notes — and
 * Indiana has it in BOTH directions at once.
 *
 * ── ⚠ EIGHT UNITS USE A DIFFERENT NAMING FORM ENTIRELY ─────────────────────
 *
 * The suffix covers 116 of 119 cities, 444 of 449 towns and all 92 counties.
 * The other eight are prefix-form or bare:
 *
 *   CITY OF GREENDALE · CITY OF JONESBORO · CITY OF AUSTIN
 *   TOWN OF BORDEN · TOWN OF CROWS NEST · TOWN OF NORTH CROWS NEST
 *   TOWN OF WEST BADEN SPRINGS
 *   LEO-CEDARVILLE                        (no type word at all)
 *
 * ⚠ `CITY OF AUSTIN` is Austin, INDIANA. TT already holds Austin, TEXAS as a
 * `city`; they differ by state so `treasury_ensure_municipality` keeps them
 * apart, but do not "fix" one into the other.
 *
 * ── ⚠ `entity_type` COMES FROM `afr_unit_type`, NOT FROM THE NAME ───────────
 *
 * Chris's call 2026-09-07: 449 CIVIL TOWN -> `town`, 119 CIVIL CITY -> `city`,
 * following the `village` (MI, #124) and `borough` (PA, #133) precedent of
 * keeping the publisher's own legal class rather than flattening into `city`.
 *
 * ⚠ Measured: 0 of 568 cities/towns share a base name, so entity_type is NOT
 * load-bearing for identity in Indiana — nothing would merge if they were
 * flattened. This is a fidelity choice, and it is recorded as one.
 *
 * ⚠⚠ Ellettsville is `city` in TT today and is `ELLETTSVILLE CIVIL TOWN` here.
 * `treasury_ensure_municipality` keys on (name, state, ENTITY_TYPE), so it must
 * be retyped in the same change or the sweep creates a SECOND Ellettsville.
 */

/** `afr_unit_type` -> TT entity_type. Read from the publisher, never inferred. */
export const UNIT_TYPE_MAP = Object.freeze({
  1: 'county',
  2: 'city',
  3: 'town',
});

/**
 * Names whose conventional Indiana spelling is NOT naive title case.
 *
 * ⚠ Keyed on the BARE upper-case name (after the suffix is stripped). Measured
 * exhaustively against all 660: these four are the only ones, and
 * `assertExceptionsAreObserved` refuses if any of them stops appearing — a
 * declared exception that names nothing excludes nothing (the PA Oil City and
 * Michigan municode lessons).
 *
 * ⚠ `DUBOIS` is deliberately ABSENT: Indiana's Dubois County really is spelled
 * "Dubois", so naive title case is already right. Pennsylvania's DuBois CITY is
 * not — see scripts/data/paNameRules.mjs. Same letters, different answer, two
 * states.
 */
export const TITLE_CASE_EXCEPTIONS = Object.freeze({
  MCCORDSVILLE: 'McCordsville',
  DEKALB: 'DeKalb',
  LAPORTE: 'LaPorte',
  LAGRANGE: 'LaGrange',
});

/**
 * Strip Gateway's own type wording, and nothing else.
 * ⚠ The suffix pattern requires the word CIVIL, so a bare trailing CITY or TOWN
 * that is part of the name survives.
 */
export function bareName(gatewayName) {
  let s = String(gatewayName ?? '').trim();
  s = s.replace(/\s+CIVIL\s+(?:CITY|TOWN)$/i, '');
  s = s.replace(/\s+COUNTY$/i, '');
  s = s.replace(/^(?:CITY|TOWN)\s+OF\s+/i, '');
  return s.trim();
}

/**
 * Title-case one word, preserving an internal apostrophe or hyphen segment.
 * ⚠ Applied per hyphen/space segment so LEO-CEDARVILLE becomes Leo-Cedarville
 * rather than Leo-cedarville.
 */
function titleWord(w) {
  return w.replace(/[A-Za-z']+/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

/**
 * The TT display name for a Gateway unit.
 *
 * Counties keep the word County — TT stores `Allen County`, matching every other
 * state — while cities and towns do not.
 */
export function displayName(gatewayName, entityType) {
  const bare = bareName(gatewayName);
  if (!bare) throw new Error(`REFUSING: ${JSON.stringify(gatewayName)} reduces to an empty name`);
  const key = bare.toUpperCase();
  const cased = TITLE_CASE_EXCEPTIONS[key] ?? titleWord(bare);
  return entityType === 'county' ? `${cased} County` : cased;
}

/** entity_type for a Gateway row, from `afr_unit_type`. Throws on anything else. */
export function entityTypeFor(afrUnitType) {
  const t = UNIT_TYPE_MAP[Number(afrUnitType)];
  if (!t) {
    // ⚠ A silent default here would file a school corporation or a library as a
    // city. The City/Town and County extracts should contain only 1, 2 and 3.
    throw new Error(`REFUSING: afr_unit_type ${JSON.stringify(afrUnitType)} is not a `
      + `city, town or county (expected one of ${Object.keys(UNIT_TYPE_MAP).join(', ')})`);
  }
  return t;
}

/**
 * ⚠⚠ A DECLARED EXCEPTION THAT NAMES NOTHING EXCLUDES NOTHING.
 *
 * Refuses if any TITLE_CASE_EXCEPTIONS key is absent from the roster actually
 * read. Three prior occurrences: PA's Oil City entry carried a wrong id, a
 * Michigan exclusion named a different township, and an SC residue registry
 * declared an amount that was never observed. Each was well-formed, plausible
 * and inert.
 */
export function assertExceptionsAreObserved(bareUpperNames) {
  const seen = new Set(bareUpperNames);
  const unobserved = Object.keys(TITLE_CASE_EXCEPTIONS).filter((k) => !seen.has(k));
  if (unobserved.length) {
    throw new Error(`REFUSING: these TITLE_CASE_EXCEPTIONS match no unit in the roster, so they `
      + `exclude nothing: ${unobserved.join(', ')}. Re-measure rather than deleting the assertion.`);
  }
  return true;
}
