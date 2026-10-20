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
    if (f[iSum] !== '162' || f[iState] !== stateFips) continue;
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
  return out;
}

/** The path to a vintage's cached file for a state, or null if it is absent. */
export function vintageFile(root, vintage, stateFips) {
  const p = `${root}/cache/sub-est${vintage}_${stateFips}.csv`;
  return existsSync(p) ? p : null;
}
