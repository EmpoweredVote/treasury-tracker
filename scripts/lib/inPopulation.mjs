/**
 * Indiana population join — roster governments to Census PEP 2024.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * ── ⚠⚠ WHY THIS DOES NOT USE `exactMatchKey` ───────────────────────────────
 *
 * `censusPep.exactMatchKey` strips every non-alphanumeric character, which
 * DELETES SPACES. Census `Elizabeth town` and roster `Elizabethtown` therefore
 * collapse to the same key — and they are two real, different Indiana
 * governments: Elizabeth (Harrison County, 201) and Elizabethtown (Bartholomew
 * County, 417). A first attempt matched Elizabethtown to Elizabeth's row, gave
 * it the wrong population, and reported ZERO ambiguities because nothing checked
 * whether two governments had claimed one census row.
 *
 * `wordKey` below keeps word boundaries, so the two stay distinct. The cost is
 * that `LaPorte` no longer matches `La Porte city`; that residue is handled by a
 * DECLARED, OBSERVED alias registry keyed on the census PLACE code rather than
 * by loosening the key until the wrong things match again.
 *
 * ⚠ `exactMatchKey` is still used by scripts/buildFlStatewideEntities.mjs. The
 * collision class is latent there. FLAGGED, not fixed here.
 *
 * ── THE OTHER TRAP, FROM FOUR STATES ───────────────────────────────────────
 *
 * NEVER strip a type word from the ROSTER name. `Clay City` is the town's real
 * name; strip the trailing "City" and it matches nothing, or worse, matches
 * `Clay`. Florida's `Everglades City`, Pennsylvania's `OIL CITY` and eight
 * Michigan villages genuinely named `... City` are the same trap. Indiana has
 * fourteen, seven of which are TOWNS. Stripping is done on the CENSUS side only,
 * exactly ONE designator, never repeatedly.
 */

import { SUMLEV, PLACE_DESIGNATOR_RE } from './censusPep.mjs';

const POP_FIELD = 'POPESTIMATE2024';

/**
 * Lowercase, punctuation-free, but WORD BOUNDARIES PRESERVED.
 * ⚠ The space is load-bearing — see the Elizabeth/Elizabethtown note above.
 */
export function wordKey(s) {
  // ⚠ AN APOSTROPHE IS NOT A WORD BOUNDARY. Census prints `Prince's Lakes town`
  // and Gateway prints `PRINCES LAKES`; mapping every non-alphanumeric to a
  // space yields `prince s lakes` vs `princes lakes` and loses a real match.
  // Apostrophes are DELETED; everything else that is not alphanumeric becomes a
  // separator. Deleting the apostrophe cannot recreate the Elizabeth /
  // Elizabethtown collision, which is about SPACES.
  return String(s).toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Census name minus exactly ONE trailing designator. Never repeatedly. */
export function stripOneDesignator(name) {
  return String(name).replace(PLACE_DESIGNATOR_RE, '');
}

/**
 * Join the roster to the Census files.
 *
 * Driven from the ROSTER, never from the census — the South Carolina lesson:
 * driving the join from a national census invents governments that do not exist
 * (`SC,Bertie County`, which is in North Carolina).
 *
 * @returns {{matched: object[], problems: string[], declaredAbsent: string[]}}
 */
export function joinIndianaPopulations({
  roster, placeRows = [], countyRows = [], partRows = null, aliases = [], absent = [],
}) {
  const problems = [];
  const whole = placeRows.filter((r) => r.SUMLEV === SUMLEV.wholePlace);
  const parts = partRows ?? placeRows.filter((r) => r.SUMLEV === SUMLEV.placePart);

  const byPlaceCode = new Map(whole.map((r) => [r.PLACE, r]));
  const partsByPlace = new Map();
  for (const p of parts) {
    if (!partsByPlace.has(p.PLACE)) partsByPlace.set(p.PLACE, []);
    partsByPlace.get(p.PLACE).push(p);
  }

  // Census-side candidate index: the verbatim name AND the name minus one
  // designator both point at the row.
  const candidates = new Map();
  const addCandidate = (k, row) => {
    if (!k) return;
    if (!candidates.has(k)) candidates.set(k, []);
    if (!candidates.get(k).includes(row)) candidates.get(k).push(row);
  };
  for (const r of whole) {
    addCandidate(wordKey(r.NAME), r);
    addCandidate(wordKey(stripOneDesignator(r.NAME)), r);
  }

  const countyByName = new Map(countyRows.map((r) => [r.CTYNAME, r]));
  const fipsByCountyName = new Map(
    countyRows.map((r) => [wordKey(String(r.CTYNAME).replace(/ County$/i, '')), r.COUNTY]));

  const aliasByName = new Map(aliases.map((a) => [a.name, a]));
  const absentByName = new Map(absent.map((a) => [a.name, a]));
  const aliasUsed = new Set();
  const absentUsed = new Set();

  // ⚠⚠ A DECLARED EXCEPTION THAT NAMES NOTHING EXCLUDES NOTHING. Every alias
  // must point at a census row that exists, checked before the join runs so a
  // well-formed but wrong PLACE code cannot sit inert.
  for (const a of aliases) {
    if (!byPlaceCode.has(a.placeCode)) {
      problems.push(`alias "${a.name}": no census place with PLACE ${a.placeCode}`);
    }
  }

  const matched = [];
  for (const e of roster) {
    if (absentByName.has(e.name)) {
      absentUsed.add(e.name);
      const stillThere = candidates.get(wordKey(e.name));
      if (stillThere?.length) {
        problems.push(
          `"${e.name}" is declared absent, but the census file has it `
          + `(${stillThere.map((r) => r.NAME).join(', ')}) — load it instead`);
      }
      continue;
    }

    if (e.entityType === 'county') {
      const row = countyByName.get(e.name);
      if (!row) { problems.push(`county "${e.name}": no census county row`); continue; }
      matched.push(mk(e, row, `county ${row.CTYNAME}`, `C${row.COUNTY}`, problems));
      continue;
    }

    const alias = aliasByName.get(e.name);
    if (alias) {
      const row = byPlaceCode.get(alias.placeCode);
      if (!row) continue; // already reported above
      aliasUsed.add(e.name);
      matched.push(mk(e, row, `alias -> ${row.NAME}`, row.PLACE, problems));
      continue;
    }

    let hits = candidates.get(wordKey(e.name)) ?? [];
    let via = `census ${hits[0]?.NAME ?? ''}`;
    if (hits.length > 1) {
      const fips = fipsByCountyName.get(wordKey(e.countyName));
      const narrowed = hits.filter(
        (h) => (partsByPlace.get(h.PLACE) ?? []).some((p) => p.COUNTY === fips));
      if (narrowed.length === 1) { hits = narrowed; via = `census ${hits[0].NAME} (by county)`; }
    }
    if (hits.length === 1) {
      matched.push(mk(e, hits[0], via, hits[0].PLACE, problems));
    } else if (hits.length === 0) {
      problems.push(`"${e.name}" (${e.entityType}, ${e.countyName}): no census place, and no declared alias or absence`);
    } else {
      problems.push(`"${e.name}": ambiguous — ${hits.map((h) => `${h.NAME}/${h.PLACE}`).join(' | ')}`);
    }
  }

  // ⚠⚠ INJECTIVITY. One census row may back at most one government. Without
  // this, Elizabethtown silently took Elizabeth's population while the
  // ambiguity count read zero.
  const byCensusId = new Map();
  for (const m of matched) {
    if (!byCensusId.has(m.censusId)) byCensusId.set(m.censusId, []);
    byCensusId.get(m.censusId).push(m.name);
  }
  for (const [id, names] of byCensusId) {
    if (names.length > 1) {
      problems.push(`census row ${id} is claimed by more than one government: ${names.join(', ')}`);
    }
  }

  // ⚠ A declared exception that is never exercised rots into dead permission —
  // the South Carolina residue rule. Both registries are checked.
  for (const a of aliases) {
    if (!aliasUsed.has(a.name)) problems.push(`alias "${a.name}" was never matched — not observed, so it is stale`);
  }
  for (const a of absent) {
    if (!absentUsed.has(a.name)) problems.push(`declared absence "${a.name}" was never matched — not observed, so it is stale`);
  }

  return { matched, problems, declaredAbsent: [...absentUsed] };
}

function mk(entity, row, via, censusId, problems) {
  const population = Number(row[POP_FIELD]);
  if (!Number.isFinite(population) || population <= 0) {
    problems.push(`"${entity.name}": non-positive population ${row[POP_FIELD]} from ${via}`);
  }
  return {
    key: entity.key,
    name: entity.name,
    entityType: entity.entityType,
    countyName: entity.countyName,
    population,
    via,
    censusId,
  };
}
