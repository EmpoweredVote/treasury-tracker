/**
 * Census place files across VINTAGES, so a government the current vintage
 * cannot name can still be typed by the newest vintage that can.
 *
 * ⚠⚠ TT types an entity from the census and never from the word a publisher
 * prints — DCA's designator contradicts the census in 20 of 530 Georgia
 * municipalities, so a government typed from the publisher's string would be
 * typed wrong twenty times over. But the file TT reads is Vintage 2024, and a
 * 2024 vintage cannot name a government that stopped existing before 2024. So
 * the discipline that protects every live entity silently refuses every dead
 * one: no type, therefore no entity, therefore no rows.
 *
 * This module keeps the discipline without losing them: the type still comes
 * from the census, and the vintage that supplied it is recorded alongside.
 *
 * ⚠ `cache/` holds Vintage 2024 for 26 states and nothing older, so every
 * state TT has loaded has the same blind spot Georgia had. Run
 * `scripts/fetchCensusVintages.mjs <stateFips>` before relying on the ladder.
 */
import { readFileSync, existsSync } from 'node:fs';

export const squash = (s) => s.toLowerCase().replace(/\s+/g, '');

/**
 * Read one vintage's SUMLEV=162 incorporated places for a state.
 *
 * ⚠⚠ COLUMNS ARE READ BY HEADER NAME. The 2013 layout has no `PRIMGEO_FLAG`,
 * so every index after `CONCIT` shifts by one: `NAME` is index 7 in 2013 and
 * index 8 from 2014 on. A positional read returns the STNAME column, which
 * types four Georgia governments as "Georgia" — and does it silently.
 *
 * ⚠ SUMLEV 157 rows are place-within-county PARTS (`McRae-Helena city (pt.)`,
 * which appears twice in the 2019 Georgia file) and are excluded; admitting
 * them invents places that do not exist.
 */
export function readPlaceVintage(file, { vintage, stateFips }) {
  // ⚠⚠ ZERO-PAD. The census FILENAME carries the bare fips
  // (`sub-est2024_4.csv`) while the STATE column INSIDE is padded (`04`).
  // Comparing them as strings matches nothing, and the empty map that came
  // back made `resolvePlace` refuse every government in the state with
  // "named by no vintage" — a total failure wearing the words of a measured
  // refusal. It would have hit AL, AK, AZ, AR, CA, CO and CT; CA and CO are
  // live. Found by the cross-state audit, not by a test.
  const want = String(stateFips).padStart(2, '0');
  const text = readFileSync(file, 'latin1');
  const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(',').map((c) => c.trim());
  const ix = (n) => {
    const i = cols.indexOf(n);
    if (i < 0) throw new Error(`${file}: no ${n} column — header is ${head}`);
    return i;
  };
  const iSum = ix('SUMLEV');
  const iState = ix('STATE');
  const iPlace = ix('PLACE');
  const iName = ix('NAME');
  const iPop = ix(`POPESTIMATE${vintage}`);

  const out = new Map();
  for (const line of lines) {
    const f = line.split(',');
    if (f[iSum] !== '162' || f[iState].padStart(2, '0') !== want) continue;
    const name = f[iName].trim();
    const m = name.match(/^(.*) (city|town|village|borough)$/);
    out.set(squash(name), {
      censusName: name,
      base: m ? m[1] : name,
      censusType: m ? m[2] : null,
      placeFips: f[iPlace],
      population: Number(f[iPop]),
      vintage,
    });
  }
  // ⚠⚠ AN EMPTY PLACE MAP IS NEVER A LEGITIMATE ANSWER FOR A REAL STATE FILE.
  // Returning one silently is what turned a two-character padding bug into
  // seven states' worth of "this government never existed". An empty result
  // is a question, never an answer.
  if (!out.size) {
    throw new Error(`${file}: no SUMLEV=162 rows for state ${want} — wrong file, wrong fips, or a layout change`);
  }
  return out;
}

/** The path to a vintage's cached file for a state, or null if it is absent. */
export function vintageFile(root, vintage, stateFips) {
  const p = `${root}/cache/sub-est${vintage}_${stateFips}.csv`;
  return existsSync(p) ? p : null;
}

export const DEFAULT_LADDER = Object.freeze([2024, 2019, 2014, 2013]);

/**
 * Load each vintage's places for a state, newest first.
 *
 * ⚠⚠ A vintage whose file is absent is RETURNED IN `missing`, never silently
 * skipped. Forgetting the fetch must not read as "this government never
 * existed" — that is the exact failure this module exists to prevent.
 */
export function loadLadder(root, stateFips, vintages = DEFAULT_LADDER) {
  const ladders = [];
  const missing = [];
  for (const v of vintages) {
    const file = vintageFile(root, v, stateFips);
    if (!file) { missing.push(v); continue; }
    ladders.push({ vintage: v, places: readPlaceVintage(file, { vintage: v, stateFips }) });
  }
  return { ladders, missing };
}

/**
 * Match one publisher name inside ONE vintage, by the measured cascade.
 *
 * ⚠ `legal` is tried BEFORE `retyped` so a place legally named "... City"
 * (Peachtree City, Garden City, Mountain City) can never be re-typed into
 * something else. Eleven Georgia places need this — the PA `GROVE CITY BORO`
 * trap, live in Georgia.
 */
function matchIn(places, publisherName) {
  const m = publisherName.match(/^(.*) (City|Town)$/);
  const base = m ? m[1] : publisherName;
  const typ = m ? m[2].toLowerCase() : null;

  if (typ) {
    const hit = places.get(squash(`${base} ${typ}`));
    if (hit) return { ...hit, how: 'suffix' };
  }
  for (const t of ['city', 'town']) {
    const hit = places.get(squash(`${publisherName} ${t}`));
    if (hit) return { ...hit, how: 'legal' };
  }
  if (typ) {
    const other = typ === 'city' ? 'town' : 'city';
    const hit = places.get(squash(`${base} ${other}`));
    if (hit) return { ...hit, how: 'retyped' };
  }
  return null;
}

/**
 * Resolve a publisher's name to the NEWEST vintage that names the government.
 *
 * Newest-first is the point: the most recent vintage naming a government is
 * the most current statement of its legal type. A government the current
 * vintage still names resolves at 2024 and nothing about it changes.
 */
export function resolvePlace(publisherName, { ladders, missing = [] }) {
  const tried = [];
  for (const { vintage, places } of ladders) {
    tried.push(vintage);
    const hit = matchIn(places, publisherName);
    if (hit) {
      return {
        censusName: hit.censusName,
        base: hit.base,
        entityType: hit.censusType ?? 'city',
        placeFips: hit.placeFips,
        population: hit.population,
        vintage,
        how: hit.how,
      };
    }
  }
  if (missing.length) {
    return {
      why: `${JSON.stringify(publisherName)} is named by no vintage of ${tried.join(', ') || '(none)'}, `
        + `and vintage ${missing.join(', ')} is not present — run `
        + 'scripts/fetchCensusVintages.mjs before concluding it cannot be named',
      tried,
      missing,
    };
  }
  return {
    why: `${JSON.stringify(publisherName)} is named by no vintage of ${tried.join(', ')}`,
    tried,
    missing,
  };
}
