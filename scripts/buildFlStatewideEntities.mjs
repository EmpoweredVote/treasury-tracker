/**
 * Turn the derived Florida roster into the loadable statewide entity module.
 *
 * NO SHEBANG — kept importable; tests import `facCandidatesFor` and `resolveGuard`.
 *
 * Usage:
 *   node scripts/buildFlStatewideRoster.mjs           # stage 1, first
 *   node scripts/buildFlStatewideEntities.mjs         # stage 2, this file
 *
 * Writes scripts/data/flStatewideEntities.mjs.
 *
 * Stage 2 joins two outside sources onto the publisher's roster: the Census
 * Bureau for the display name's population and county, and the Federal Audit
 * Clearinghouse for an independent check on the fiscal month.
 *
 * ── ⚠⚠ NAME AND POPULATION COME FROM THE SAME CENSUS ROW ───────────────────
 *
 * `treasury_ensure_municipality` keys on (name, state, entity_type), so a name
 * paired with the wrong government's population is a defect that moves $0 and
 * survives every tie test. Each entity resolves to exactly ONE Census row and
 * takes its population from that row; the generator then asserts no two
 * entities claimed the same Census row.
 *
 * ⚠ The DISPLAY NAME, unlike Michigan's, comes from the PUBLISHER rather than
 * the Census. Michigan took the Census name because its F-65 spelled the same
 * unit several ways; Florida's LOGERx name is **stable across all 14 published
 * years for all 479 codes** (asserted in stage 1), while the Census name cannot
 * be used verbatim — it lowercases the type designator even when the type word
 * is part of the legal name, so "Everglades city" and "Bal Harbour village" are
 * the same rendering of two different facts. See scripts/data/flCensusAliases.mjs.
 *
 * ── ⚠ THE FAC GUARD TAKES CANDIDATE NAMES, NOT ONE SPELLING ────────────────
 *
 * The federal audit record does not spell Florida's municipalities the way
 * LOGERx does, and it is not even self-consistent: Everglades City files as
 * **"Everglades City"** in 1999-2014 and as **"Everglades"** in 2023-2024 — two
 * FAC entries, one government. Bal Harbour files as "Bal Harbour Village";
 * Miami Shores and Estero file bare.
 *
 * A single guessed spelling would silently find nothing, and `censusGuard`
 * returns `{ok:true}` when it cannot find an entity — silence reading as
 * agreement is the `Saint Louis County` defect. So every entity carries a
 * CANDIDATE LIST and the rule is explicit:
 *
 *   • any candidate CONTRADICTS the published month  -> refuse the row
 *   • at least one agrees and none contradicts       -> CONFIRMED
 *   • no candidate is covered at all                 -> UNVERIFIED, and said so
 *
 * ⚠ Volusia County is why the middle case is not "the first hit wins": FAC holds
 * TWO Volusia rows, month 10 for 1998-2025 and month 7 for 2024, so FY2024 is a
 * census-internal contradiction. `censusMonthFor` reports it as a changeover
 * year and resolves nothing, which is correct — Florida counties are statutorily
 * October and the publisher's own FYE for that filing is 9/30.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { indexPlaces, indexCounties, placeMatchKey, exactMatchKey } from './lib/censusPep.mjs';
import {
  FL_CENSUS_ALIASES, FL_ALIAS_BY_LOGERX_NAME, FL_COUNTY_ALIASES,
  FL_COUNTY_ALIAS_BY_LOGERX_NAME, FL_DISSOLVED, FL_DISSOLVED_BY_LOGERX_NAME,
  FL_EXISTING_TT_NAMES, FL_CONSOLIDATED,
} from './data/flCensusAliases.mjs';
import { censusMonthFor } from './lib/facFiscalYearCensus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROSTER = path.join(ROOT, '_acfr-work/fl-sweep/roster.json');
const PLACES_CSV = path.join(ROOT, '_acfr-work/sub-est2024_12.csv');
const COUNTIES_CSV = path.join(ROOT, '_acfr-work/co-est2024-alldata.csv');
const OUT = path.join(ROOT, 'scripts/data/flStatewideEntities.mjs');

export const FL_STATE = 'FL';
export const FL_STATE_FIPS = '12';
export const POP_FIELD = 'POPESTIMATE2024';

/**
 * The names to try against the federal audit census, most specific first.
 *
 * Deduplicated and order-stable. Counties are spelled `<Name> County` by FAC for
 * all 66, verified against the census file.
 */
export function facCandidatesFor({ entityType, unitName, displayName, censusName }) {
  if (entityType === 'county') return [`${unitName} County`];
  const bare = censusName ? String(censusName).replace(/\s+(city|town|village|CDP)$/i, '') : null;
  return [...new Set([displayName, unitName, bare].filter(Boolean))];
}

/**
 * Resolve the FAC guard for one entity-year over its candidate names.
 *
 * @param {string[]} candidates
 * @param {number} month  the month the PUBLISHER states
 * @returns {{status:'confirmed'|'unverified'|'conflict', month?:number, via?:string, why?:string}}
 */
export function resolveGuard(candidates, month, fiscalYear, lookup = censusMonthFor) {
  const misses = [];
  let agreedVia = null;
  for (const name of candidates) {
    const seen = lookup(FL_STATE, name, fiscalYear);
    if (seen.unknown) { misses.push(`${name}: ${seen.unknown}`); continue; }
    if (Number(seen.month) !== Number(month)) {
      return {
        status: 'conflict',
        why: `the federal audit record for "${name}" reports month ${seen.month} in FY${fiscalYear}, `
          + `but the publisher's own FYE gives month ${month}`,
      };
    }
    if (!agreedVia) agreedVia = name;
  }
  if (agreedVia) return { status: 'confirmed', month, via: agreedVia };
  return { status: 'unverified', why: misses[0] || 'no candidate name is covered by the census' };
}

function main() {
  const { values } = parseArgs({ options: { roster: { type: 'string' }, out: { type: 'string' } } });
  const rosterPath = values.roster ? path.resolve(ROOT, values.roster) : DEFAULT_ROSTER;
  const out = values.out ? path.resolve(ROOT, values.out) : OUT;

  const roster = JSON.parse(readFileSync(rosterPath, 'utf8'));
  if (roster.problems && roster.problems.length) {
    throw new Error(`${path.relative(ROOT, rosterPath)} reports ${roster.problems.length} unresolved `
      + 'problem(s). Fix stage 1 before generating entities.');
  }

  const { wholeByName, partsByPlace } = indexPlaces(PLACES_CSV);
  const countiesByName = indexCounties(COUNTIES_CSV, FL_STATE_FIPS);
  const countyNameByFips = new Map();
  for (const [name, row] of countiesByName) countyNameByFips.set(row.COUNTY, name);

  /**
   * Candidate index over the CENSUS place file.
   *
   * ⚠⚠ THE DESIGNATOR IS STRIPPED FROM THE CENSUS NAME ONLY, NEVER FROM THE
   * LOGERx NAME. Both keys are registered for each Census row — the verbatim
   * name and the designator-stripped stem — and the lookup uses the LOGERx name
   * VERBATIM against both.
   *
   * The first draft of this generator stripped the designator from the LOGERx
   * side too, which turned `Cooper City` into `cooper`, `Panama City` into
   * `panama` and `Lake City` into `lake`, and lost **16 municipalities whose
   * names genuinely end in a type word** — the exact defect
   * scripts/lib/censusPep.mjs and scripts/data/flCensusAliases.mjs are written
   * to prevent, committed in the one direction neither of them was watching.
   * It also collided `Melbourne Village` onto `Melbourne city`, which would have
   * shown a village of 761 the population of a city of 88,000.
   */
  const byCensusKey = new Map();
  const register = (key, row) => {
    if (!byCensusKey.has(key)) byCensusKey.set(key, []);
    const bucket = byCensusKey.get(key);
    if (!bucket.includes(row)) bucket.push(row);
  };
  for (const [name, row] of wholeByName) {
    register(exactMatchKey(name), row);
    register(placeMatchKey(name), row);
  }

  const problems = [];
  const aliasUsed = new Set();
  const countyAliasUsed = new Set();
  const dissolvedUsed = new Set();
  const claimedCensusRow = new Map();
  const entities = [];

  for (const ent of roster.entities) {
    const years = Object.keys(ent.years).map(Number).sort((a, b) => a - b);
    const alias = FL_ALIAS_BY_LOGERX_NAME.get(ent.unitName) || null;
    const dissolved = ent.entityType === 'city'
      ? (FL_DISSOLVED_BY_LOGERX_NAME.get(ent.unitName) || null)
      : null;

    let displayName;
    let censusRow = null;
    let censusName = null;

    // ⚠ A dissolved government has no Census row by design. It still loads.
    if (dissolved) {
      dissolvedUsed.add(dissolved.logerxName);
      const last = years[years.length - 1];
      if (last > dissolved.lastFiscalYear) {
        problems.push(`${dissolved.displayName} is recorded as dissolved after FY${dissolved.lastFiscalYear}, `
          + `but the roster has it filing through FY${last}. The premise is wrong — do not extend the series.`);
      }
      const monthsByYear = {}; const branchByYear = {}; const guardByYear = {};
      let confirmed = 0; let unverified = 0;
      const candidates = [dissolved.displayName, ent.unitName].filter((v, i, a) => a.indexOf(v) === i);
      for (const y of years) {
        const yr = ent.years[String(y)];
        monthsByYear[y] = yr.month;
        branchByYear[y] = yr.branch;
        const g = resolveGuard(candidates, yr.month, y);
        guardByYear[y] = g.status;
        if (g.status === 'conflict') problems.push(`FY${y} ${dissolved.displayName}: ${g.why}.`);
        else if (g.status === 'confirmed') confirmed++; else unverified++;
      }
      entities.push({
        key: dissolved.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        code: ent.code,
        name: dissolved.displayName,
        entityType: 'city',
        unitType: ent.unitType,
        unitName: ent.unitName,
        censusName: null,
        facCandidates: candidates,
        population: null,
        countyDbName: dissolved.countyDbName,
        countyNote: dissolved.why,
        dissolved: true,
        lastFiscalYear: dissolved.lastFiscalYear,
        fiscalYears: years,
        monthsByYear,
        branchByYear,
        guardByYear,
        monthConfirmedYears: confirmed,
        monthUnverifiedYears: unverified,
      });
      continue;
    }

    if (ent.entityType === 'county') {
      const cAlias = FL_COUNTY_ALIAS_BY_LOGERX_NAME.get(ent.unitName) || null;
      if (cAlias) {
        countyAliasUsed.add(cAlias.logerxName);
        displayName = cAlias.displayName;
        censusName = cAlias.censusName;
      } else {
        displayName = `${ent.unitName} County`;
        censusName = displayName;
      }
      censusRow = countiesByName.get(censusName) || null;
      if (!censusRow) {
        problems.push(`${displayName}: no Census county row (looked for CTYNAME "${censusName}"). `
          + 'Add a hand-verified entry to FL_COUNTY_ALIASES.');
        censusName = null;
      }
    } else {
      if (alias) {
        aliasUsed.add(alias.logerxName);
        displayName = alias.displayName;
        censusRow = wholeByName.get(alias.censusName) || null;
        censusName = alias.censusName;
        if (!censusRow) {
          problems.push(`${ent.unitName}: alias points at Census NAME "${alias.censusName}", which is not in `
            + `${path.relative(ROOT, PLACES_CSV)}. The alias is stale.`);
        }
      } else {
        displayName = ent.unitName;
        // ⚠ The LOGERx name goes in VERBATIM. See the note on `byCensusKey`.
        const hits = byCensusKey.get(exactMatchKey(ent.unitName)) || [];
        if (hits.length === 1) { censusRow = hits[0]; censusName = hits[0].NAME; }
        else if (hits.length === 0) {
          problems.push(`${ent.unitType}|${ent.unitName} (code ${ent.code}): no Census place row. `
            + 'Add a hand-verified entry to scripts/data/flCensusAliases.mjs.');
        } else {
          problems.push(`${ent.unitType}|${ent.unitName}: ${hits.length} Census place rows match `
            + `(${hits.map((h) => h.NAME).join(', ')}) — ambiguous, needs an alias.`);
        }
      }
    }

    if (!censusRow) continue;

    // ⚠ One Census row, one entity. A row claimed twice means a name is about to
    // carry another government's population.
    const rowKey = `${censusRow.SUMLEV}:${censusRow.STATE}:${censusRow.COUNTY}:${censusRow.PLACE ?? ''}:${censusRow.NAME}`;
    if (claimedCensusRow.has(rowKey)) {
      problems.push(`Census row "${censusRow.NAME}" claimed by BOTH ${claimedCensusRow.get(rowKey)} and `
        + `${displayName} — one of them would show the other's population.`);
    } else claimedCensusRow.set(rowKey, displayName);

    const population = Number(censusRow[POP_FIELD]);
    if (!Number.isFinite(population) || population < 0) {
      problems.push(`${displayName}: Census ${POP_FIELD} is ${JSON.stringify(censusRow[POP_FIELD])}`);
      continue;
    }

    // ── County link, for cities only.
    let countyDbName = null;
    let countyNote = null;
    if (ent.entityType === 'city') {
      const parts = partsByPlace.get(censusRow.PLACE);
      if (!parts || !parts.length) {
        countyNote = 'no Census county-part row, so no county could be derived';
      } else {
        const flagged = parts.filter((p) => p.PRIMGEO_FLAG === '1');
        const chosen = flagged.length === 1
          ? flagged[0]
          : [...parts].sort((a, b) => Number(b[POP_FIELD] || 0) - Number(a[POP_FIELD] || 0))[0];
        const cName = countyNameByFips.get(chosen.COUNTY) || null;
        if (parts.length > 1) {
          countyNote = `straddles ${parts.length} counties `
            + `(${parts.map((p) => `${countyNameByFips.get(p.COUNTY) || p.COUNTY}:${p[POP_FIELD]}`).join(', ')}); `
            + `linked to ${cName} by ${flagged.length === 1 ? 'PRIMGEO_FLAG' : 'largest population part'}`;
        }
        // ⚠⚠ Duval County has no AFR filing because Jacksonville IS the county
        // government, so no TT county row exists for Duval to link to. Leaving
        // the link null and SAYING WHY beats pointing at a row that isn't there.
        if (cName && FL_CONSOLIDATED[cName]) {
          countyNote = `${countyNote ? `${countyNote}; ` : ''}county is ${cName}, which files no AFR — `
            + `${FL_CONSOLIDATED[cName]}`;
        } else if (cName) {
          countyDbName = cName;
        }
      }
    }

    // ── The fiscal month, per year, with the FAC guard resolved per year.
    const monthsByYear = {};
    const branchByYear = {};
    const guardByYear = {};
    let confirmed = 0; let unverified = 0;
    const candidates = facCandidatesFor({ ...ent, displayName, censusName });
    for (const y of years) {
      const yr = ent.years[String(y)];
      monthsByYear[y] = yr.month;
      branchByYear[y] = yr.branch;
      const g = resolveGuard(candidates, yr.month, y);
      guardByYear[y] = g.status;
      if (g.status === 'conflict') {
        problems.push(`FY${y} ${displayName}: ${g.why}. Refusing to generate a month the federal `
          + 'audit record contradicts.');
      } else if (g.status === 'confirmed') confirmed++;
      else unverified++;
    }

    entities.push({
      key: displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      code: ent.code,
      name: displayName,
      entityType: ent.entityType,
      unitType: ent.unitType,
      unitName: ent.unitName,
      censusName,
      facCandidates: candidates,
      population,
      countyDbName,
      ...(countyNote ? { countyNote } : {}),
      fiscalYears: years,
      monthsByYear,
      branchByYear,
      guardByYear,
      monthConfirmedYears: confirmed,
      monthUnverifiedYears: unverified,
    });
  }

  // ── Assertions that must hold before this file is written.
  for (const a of FL_CENSUS_ALIASES.filter((x) => !aliasUsed.has(x.logerxName))) {
    problems.push(`municipal alias "${a.logerxName}" matched no roster entity — it is stale. `
      + 'A declared exception that excludes nothing is worse than none.');
  }
  for (const a of FL_COUNTY_ALIASES.filter((x) => !countyAliasUsed.has(x.logerxName))) {
    problems.push(`county alias "${a.logerxName}" matched no roster entity — it is stale.`);
  }
  for (const d of FL_DISSOLVED.filter((x) => !dissolvedUsed.has(x.logerxName))) {
    problems.push(`dissolved entry "${d.logerxName}" matched no roster entity — it is stale.`);
  }

  const nameCounts = new Map();
  for (const e of entities) nameCounts.set(e.name, (nameCounts.get(e.name) || 0) + 1);
  for (const [n, c] of nameCounts) {
    if (c > 1) problems.push(`display name "${n}" is used by ${c} entities — the database keys on it.`);
  }

  const produced = new Set(entities.map((e) => e.name));
  for (const n of FL_EXISTING_TT_NAMES) {
    if (!produced.has(n)) {
      problems.push(`⚠⚠ "${n}" already exists in treasury.municipalities but this registry does NOT `
        + 'reproduce it. Loading would create a second row and orphan its existing budget rows.');
    }
  }

  // Every city must have resolved a county, or carry a stated reason.
  for (const e of entities) {
    if (e.entityType === 'city' && !e.countyDbName && !e.countyNote) {
      problems.push(`${e.name}: no county link and no reason given.`);
    }
  }

  const cities = entities.filter((e) => e.entityType === 'city');
  const counties = entities.filter((e) => e.entityType === 'county');
  const entityYears = entities.reduce((s, e) => s + e.fiscalYears.length, 0);
  const conf = entities.reduce((s, e) => s + e.monthConfirmedYears, 0);
  const unv = entities.reduce((s, e) => s + e.monthUnverifiedYears, 0);
  const straddlers = entities.filter((e) => e.countyNote && e.countyNote.startsWith('straddles'));
  const unrecorded = entities.flatMap((e) => Object.entries(e.branchByYear)
    .filter(([, b]) => b === 'branch-unrecorded').map(([y]) => `FY${y} ${e.name}`));

  console.log(`\nFlorida statewide entities — from ${path.relative(ROOT, rosterPath)}`);
  console.log(`  entities:     ${entities.length}  (${cities.length} cities, ${counties.length} counties)`);
  console.log(`  entity-years: ${entityYears}`);
  console.log(`  aliases used: ${aliasUsed.size}/${FL_CENSUS_ALIASES.length} municipal, `
    + `${countyAliasUsed.size}/${FL_COUNTY_ALIASES.length} county`);
  console.log(`  county links: ${cities.filter((e) => e.countyDbName).length}/${cities.length} cities linked`);
  const gone = entities.filter((e) => e.dissolved);
  console.log(`  dissolved:    ${gone.length} (loaded with NULL population, series ends at dissolution)`);
  for (const g of gone) console.log(`      ${g.name} — last FY${g.lastFiscalYear}; ${g.countyNote}`);
  console.log(`  straddlers:   ${straddlers.length}`);
  for (const s of straddlers) console.log(`      ${s.name}: ${s.countyNote}`);
  const noCounty = cities.filter((e) => !e.countyDbName);
  console.log(`  cities with NO county row to link to: ${noCounty.length}`);
  for (const c of noCounty) console.log(`      ${c.name} — ${c.countyNote}`);
  console.log(`  fiscal month:  ${conf} FAC-CONFIRMED, ${unv} unverified (publisher's FYE stands)`);
  console.log(`  audit branch:  ${entityYears - unrecorded.length} audit-reconciled, ${unrecorded.length} unrecorded`);
  for (const u of unrecorded) console.log(`      ⚠ ${u}`);

  if (problems.length) {
    console.error(`\n  ⚠⚠ ${problems.length} PROBLEM(S) — nothing written:`);
    for (const p of problems) console.error(`      ${p}`);
    process.exit(1);
  }

  const header = `/**
 * Florida statewide sweep — every CITY and COUNTY that filed an Annual
 * Financial Report with Florida DFS in FY${roster.window.first}-FY${roster.window.last}.
 *
 * ⚠⚠ GENERATED by scripts/buildFlStatewideEntities.mjs from a roster derived by
 * scripts/buildFlStatewideRoster.mjs. Do not hand-edit; change a generator or
 * scripts/data/flCensusAliases.mjs and re-run both stages.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⚠⚠ \`code\` IS THE JOIN KEY, NEVER \`name\`. Florida has both a
 * \`County|Palm Beach\` (100050) and a \`City|Palm Beach\` (200287, the Town of
 * Palm Beach). \`unitType\`/\`unitName\` exist because the DFS oracle report
 * carries no entity code and is keyed by (Unit Type, Unit Name).
 *
 * ⚠ \`monthsByYear\` and \`branchByYear\` are PER YEAR because both are properties
 * of the individual filing, not of the government. The month is the publisher's
 * own \`FYE\` field; \`guardByYear\` records whether the federal audit record
 * independently confirmed it, and \`unverified\` is NOT agreement.
 *
 * ⚠ \`name\` and \`population\` come from the SAME Census PEP Vintage 2024 row, and
 * the generator asserts no two entities claim one row — so a name can never
 * carry another government's population.
 *
 * ⚠ Duval County is absent on purpose: Jacksonville is a consolidated
 * city-county and files as the county government. Its municipalities carry a
 * \`countyNote\` instead of a county link.
 */

export const FL_STATEWIDE_LOAD_WINDOW = Object.freeze({ first: ${roster.window.first}, last: ${roster.window.last} });

/** ⚠ FY${roster.window.last} is PARTIAL — presence is recorded per entity per year, never assumed. */
export const FL_PARTIAL_YEARS = Object.freeze([${roster.window.last}]);

export const FL_STATE = '${FL_STATE}';

/** ${entities.length} entities — ${cities.length} cities, ${counties.length} counties — ${entityYears} entity-years. */
export const FL_STATEWIDE_ENTITIES = Object.freeze(`;

  writeFileSync(out, `${header}${JSON.stringify(entities, null, 1)});

/** Look one up by LOGERx code. */
export function flEntityByCode(code) {
  return FL_STATEWIDE_ENTITIES.find((e) => e.code === String(code)) || null;
}
`);
  console.log(`\n  ✅ wrote ${path.relative(ROOT, out)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(); } catch (e) { console.error(`\n${e.message}`); process.exit(1); }
}
