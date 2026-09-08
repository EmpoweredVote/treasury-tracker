/**
 * The Indiana statewide roster: every city, town and county Gateway files an
 * Annual Financial Report for.
 *
 * NO SHEBANG — tests/inStatewideRoster.test.mjs imports this module.
 *
 * ── ⭐ SWAP THE ROSTER, NOT THE LOADER ──────────────────────────────────────
 *
 * `loadIndianaGateway.mjs` was proven on four entities (PR #113) and its read is
 * regression-verified against a fresh fetch (#149: 78/78 rows, 11,283/11,283
 * oracle checks). This module produces the SAME entity shape for all 660, so the
 * statewide sweep reuses that one write path and cannot drift from the code that
 * was proven. South Carolina's `--statewide` did the same for 46 counties.
 *
 * ── ⚠⚠ THE KEY IS `sboa_id`, NOT (cnty_cd, unit_code) ──────────────────────
 *
 * Measured over the all-years City/Town + County extracts, 2026-09-07:
 *
 *     distinct sboa_id                            660
 *     sboa_id mapping to >1 (cnty_cd, unit_code)    0
 *     sboa_id carrying >1 unit_name                 0
 *     sboa_id carrying >1 afr_unit_type             0
 *
 * ⚠ (cnty_cd, unit_code) is unique WITHIN these two extracts — 0 collisions in
 * all 15 years — so the pair is safe for the accumulator's row filter, which is
 * what PR #113 uses. But it is NOT unique in the `All` unit-type extract: 77 keys
 * there carry two governments each, four of them a town sharing with a fire
 * district, an airport, a transit authority or a township. **The moment anyone
 * fetches `All` or adds townships/libraries/special districts, the pair stops
 * identifying a government.** So identity here is `sboa_id` and the row filter
 * additionally asserts `afr_unit_type`.
 *
 * ── ⚠⚠ COVERAGE IS A PROPERTY OF THE YEAR ──────────────────────────────────
 *
 * Distinct governments filing, per year, measured:
 *
 *     year  2011 2012 2013 2014 2015 2016 2017 2018 2019 2020 2021 2022 2023 2024 2025
 *     city   565  560  558  558  553  553  557  561  560  562  562  561  560  552  553
 *     county  92   92   92   89   87   90   91   92   92   91   92   92   92   92   91
 *
 * Never assert "all 92 counties" for a given year. Each entity carries the exact
 * set of years it appears in, so a missing year is a REPORTED gap in the source
 * rather than a silent one — the Gary FY2015 rule from PR #113.
 */

import { join } from 'node:path';
import { eachRow, need, pad } from './inGateway.mjs';
import {
  bareName, displayName, entityTypeFor, assertExceptionsAreObserved,
} from '../data/inNameRules.mjs';

/** The two extracts that between them hold exactly the cities, towns and counties. */
export const ROSTER_EXTRACTS = Object.freeze([
  { file: 'rec_city_ALL.txt', expectTypes: ['city', 'town'] },
  { file: 'rec_county_ALL.txt', expectTypes: ['county'] },
]);

/** A stable slug for an entity, from its SBOA id — the only stable identifier. */
export function entityKey(sboaId) {
  const s = String(sboaId ?? '').trim();
  if (!/^\d{2}-\d{3}\.\d{2}$/.test(s)) {
    // ⚠ Format measured on all 660: NN-NNN.NN. A key derived from a malformed id
    // would be well-formed and wrong, which is the worst shape for an identifier.
    throw new Error(`REFUSING: sboa_id ${JSON.stringify(sboaId)} is not the NN-NNN.NN form`);
  }
  return `in-${s.replace('.', '-')}`;
}

/**
 * Fold Gateway rows into one entry per government.
 * Pure — takes already-parsed rows, so it is testable without the 443 MB corpus.
 *
 * Each row is `{ year, cntyCd, cntyDescription, unitCode, sboaId, afrUnitType, unitName }`.
 */
export function buildRoster(rows) {
  const byId = new Map();
  for (const r of rows) {
    const sboaId = String(r.sboaId ?? '').trim();
    // ⚠ A blank sboa_id cannot be identified, so it is COUNTED and reported
    // rather than dropped silently or folded into a neighbour.
    if (!sboaId) continue;
    const entityType = entityTypeFor(r.afrUnitType);
    const countyCode = pad(r.cntyCd, 2);
    const unitCode = pad(r.unitCode, 4);
    const name = displayName(r.unitName, entityType);

    let e = byId.get(sboaId);
    if (!e) {
      e = {
        key: entityKey(sboaId),
        sboaId,
        name,
        state: 'IN',
        entityType,
        countyCode,
        unitCode,
        countyName: String(r.cntyDescription ?? '').trim(),
        gatewayName: String(r.unitName ?? '').trim(),
        years: [],
      };
      byId.set(sboaId, e);
    }
    // ⚠⚠ An sboa_id that changes name, type or code between years is a different
    // government wearing the same id. Measured: 0 of 660 do. Assert it anyway —
    // this is the check that would catch the publisher renumbering, which is
    // exactly what `Fund_code` did (Lake County FY2022, $735,638,546).
    if (e.name !== name || e.entityType !== entityType
        || e.countyCode !== countyCode || e.unitCode !== unitCode) {
      throw new Error(`REFUSING: sboa_id ${sboaId} is not stable — `
        + `${e.entityType} ${e.name} (${e.countyCode}|${e.unitCode}) `
        + `vs ${entityType} ${name} (${countyCode}|${unitCode})`);
    }
    const y = Number(r.year);
    if (Number.isFinite(y) && !e.years.includes(y)) e.years.push(y);
  }

  const roster = [...byId.values()];
  for (const e of roster) e.years.sort((a, b) => a - b);

  // ⚠⚠ The exceptions assertion is NOT here, deliberately. It belongs to the
  // STATEWIDE roster (see readRosterFromExtracts): asserting it inside the
  // generic fold makes `buildRoster` unusable on any subset, because no small
  // set contains McCordsville, DeKalb, LaPorte AND LaGrange. Its own tests
  // caught that. A guard placed where it cannot be satisfied is a guard people
  // delete.

  // ⚠⚠ The municipality key is (name, state, entity_type). Two governments landing
  // on one key would share a row and both their budgets. Measured: 660 of 660 are
  // distinct — assert it, because the name rule is what makes it true.
  const keys = new Map();
  for (const e of roster) {
    const k = `${e.name}|${e.state}|${e.entityType}`;
    if (keys.has(k)) {
      throw new Error(`REFUSING: ${keys.get(k).sboaId} (${keys.get(k).gatewayName}) and `
        + `${e.sboaId} (${e.gatewayName}) both reduce to "${k}" — one would overwrite the other`);
    }
    keys.set(k, e);
  }

  return roster.sort((a, b) => a.sboaId.localeCompare(b.sboaId));
}

/** Stream the two roster extracts and fold them. */
export async function readRosterFromExtracts(dir) {
  const rows = [];
  const seenTypes = new Map();
  for (const g of ROSTER_EXTRACTS) {
    let n = 0;
    await eachRow(join(dir, g.file), (r, ix) => {
      n++;
      const afrUnitType = String(r[need(ix, 'afr_unit_type')]).trim();
      const t = entityTypeFor(afrUnitType);
      if (!seenTypes.has(g.file)) seenTypes.set(g.file, new Set());
      seenTypes.get(g.file).add(t);
      rows.push({
        year: String(r[need(ix, 'year')]).trim(),
        cntyCd: r[need(ix, 'cnty_cd')],
        cntyDescription: r[need(ix, 'cnty_description')],
        unitCode: r[need(ix, 'unit_code')],
        sboaId: r[need(ix, 'sboa_id')],
        afrUnitType,
        unitName: r[need(ix, 'unit_name')],
      });
    });
    // ⚠ A gate that can measure nothing must fail, not pass.
    if (n === 0) throw new Error(`REFUSING: ${g.file} yielded 0 data rows`);
    // ⚠ And the County extract must not contain cities, nor vice versa — that
    // would mean the download was made with the wrong unit type.
    const got = [...seenTypes.get(g.file)].sort();
    const unexpected = got.filter((x) => !g.expectTypes.includes(x));
    if (unexpected.length) {
      throw new Error(`REFUSING: ${g.file} contains ${unexpected.join(', ')} — `
        + `expected only ${g.expectTypes.join(', ')}. Was it fetched with the right unit type?`);
    }
  }
  const roster = buildRoster(rows);
  // ⚠ A declared exception that names nothing excludes nothing. Asserted HERE,
  // on the full statewide roster, which is the only set where all four
  // TITLE_CASE_EXCEPTIONS can be expected to appear.
  assertExceptionsAreObserved(roster.map((e) => bareName(e.gatewayName).toUpperCase()));
  return roster;
}

/** Per-year coverage, so a thin year is reported rather than discovered later. */
export function coverageByYear(roster) {
  const out = new Map();
  for (const e of roster) {
    for (const y of e.years) {
      if (!out.has(y)) out.set(y, { city: 0, town: 0, county: 0 });
      out.get(y)[e.entityType] += 1;
    }
  }
  return new Map([...out].sort((a, b) => a[0] - b[0]));
}
