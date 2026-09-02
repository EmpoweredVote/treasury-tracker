/**
 * Turn the derived roster into the loadable Michigan statewide entity module.
 *
 * NO SHEBANG — kept importable.
 *
 * Usage:
 *   node scripts/buildMiStatewideEntities.mjs --roster _acfr-work/mi-sweep/roster.json
 *
 * Writes scripts/data/miStatewideEntities.mjs.
 *
 * ── ⚠⚠ NAME AND POPULATION COME FROM THE SAME CENSUS ROW ───────────────────
 *
 * The display name is the CENSUS name, not the F-65's. Two reasons, and the
 * second is the load-bearing one:
 *
 *  1. The F-65 spells the same unit differently across years (`Detroit` /
 *     `City of Detroit`) and inconsistently between units (`St. Joseph` with a
 *     period, `St Clair` without).
 *  2. `treasury_ensure_municipality` keys on NAME. Taking the name and the
 *     population from ONE Census row makes it impossible for TT to show a name
 *     matched to a different government's population — the failure that would
 *     otherwise pair the city of St. Joseph (7,930) with St. Joseph County
 *     (61,171) while moving $0.
 *
 * ⚠ Detroit and Wayne County already exist in TT under exactly these names, so
 * the sweep re-uses their rows rather than creating duplicates. The generator
 * ASSERTS that, because a silent rename would orphan 142 existing rows.
 *
 * ── ⚠⚠ UNITS WHOSE MONTH THE FEDERAL AUDIT RECORD CONTRADICTS ──────────────
 *
 * `scripts/auditMiF65FiscalMonths.mjs` measured the F-65's self-reported
 * `fiscalendmonth` against the FAC census: 2,141 entity-years agree, 27
 * conflict, 3,634 are uncovered. 98.8% where measurable — but the 27 are real
 * disagreements with the units' own Single Audit filings, and Lapeer County is
 * the sharpest: the census reports month 1 for 1998-2025 while the F-65 claims
 * month 10 from FY2022.
 *
 * Those entity-years are EXCLUDED, per year and not per unit, and declared. A
 * wrong fiscal month moves $0 and passes every tie test, which is exactly why
 * this project has shipped that defect more often than any other.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { parse } from 'node:path';

import {
  MI_CENSUS_ALIASES, MI_TV_CENSUS_ALIASES, displayFromCensusName, displayFromCensusTownship,
} from './data/miCensusAliases.mjs';
import { censusMonthFor, readEvidence } from './lib/facFiscalYearCensus.mjs';
import { UNUSABLE_DATASETS } from './fetchMichiganF65.mjs';

const PLACES_CSV = '_acfr-work/mi-sweep/sub-est2024_26.csv';
const COUNTIES_CSV = '_acfr-work/co-est2024-alldata.csv';
const OUT = 'scripts/data/miStatewideEntities.mjs';

/**
 * ⚠⚠ THE MUNICODE'S COUNTY HALF IS AN ALPHABETICAL INDEX, NOT A FIPS CODE.
 *
 * The municode is `CCTTTT`. `CC` runs 01-83 in alphabetical county order, while
 * Michigan's county FIPS codes are the ODD numbers 001-165 — so the mapping is
 * `fips = 2 * CC - 1`. Alcona is CC 01 / FIPS 001; Wayne is CC 82 / FIPS 163.
 *
 * ⚠ This is DERIVED, so it was verified rather than assumed: applied to all 83
 * county municodes in the roster and checked against the Census county names, it
 * matched 83 of 83 (the two apparent misses are only `St Clair` vs `St. Clair`,
 * which the alias registry already covers).
 *
 * It matters because township names are NOT unique in Michigan — `Grant
 * Township` names eleven different governments — so the Census join has to be
 * scoped to the county, and the municode is the only place the county is stated.
 */
export function countyFipsFromMunicode(municode) {
  const cc = Number(String(municode ?? '').slice(0, 2));
  if (!Number.isInteger(cc) || cc < 1 || cc > 83) return null;
  return String(cc * 2 - 1).padStart(3, '0');
}

function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const head = lines[0].split(',');
  return lines.slice(1).map((l) => {
    // These two files have no quoted commas in the columns used here.
    const cells = l.split(',');
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

export function loadCensus() {
  const places = new Map();
  // ⚠⚠ TOWNSHIPS ARE A DIFFERENT SUMMARY LEVEL AND A DIFFERENT KEY. Places
  // (SUMLEV 162) are unique by name statewide; MINOR CIVIL DIVISIONS (SUMLEV
  // 061) are not — 117 township names are shared by 302 townships, and `Grant
  // township` names eleven of them. A name-keyed map would silently keep one row
  // and hand ten other governments its population. So townships are keyed on
  // (county FIPS, name), which the Census file states directly.
  const townships = new Map();
  const countyNameByFips = new Map();
  for (const r of readCsv(PLACES_CSV)) {
    if (r.SUMLEV === '162') places.set(r.NAME.trim(), Number(r.POPESTIMATE2024));
    if (r.SUMLEV === '050') countyNameByFips.set(r.COUNTY, r.NAME.trim());
    if (r.SUMLEV === '061' && / township$/i.test(r.NAME)) {
      townships.set(`${r.COUNTY}|${r.NAME.trim().toLowerCase()}`, {
        name: r.NAME.trim(), population: Number(r.POPESTIMATE2024),
      });
    }
  }
  const counties = new Map();
  for (const r of readCsv(COUNTIES_CSV)) {
    if (r.SUMLEV !== '050' || r.STNAME !== 'Michigan') continue;
    counties.set(r.CTYNAME.trim(), Number(r.POPESTIMATE2024));
  }
  // How many Michigan townships share each display name — the ambiguity measure
  // the FAC lookup below refuses on.
  const townshipNameCounts = new Map();
  for (const t of townships.values()) {
    const d = displayFromCensusTownship(t.name);
    townshipNameCounts.set(d, (townshipNameCounts.get(d) ?? 0) + 1);
  }
  return { places, counties, townships, countyNameByFips, townshipNameCounts };
}

/**
 * Resolve one roster unit to its Census row.
 *
 * ⚠ The name and the population always come from the SAME Census row, so TT can
 * never show one government's name beside another's population.
 *
 * @returns {{censusName: string, name: string, population: number, countyName?: string}|null}
 */
export function resolveCensus(unit, census) {
  const {
    places, counties, townships, countyNameByFips,
  } = census;
  if (unit.entityType === 'county') {
    const key = MI_CENSUS_ALIASES[unit.name] ?? unit.name;
    if (!counties.has(key)) return null;
    return { censusName: key, name: key, population: counties.get(key) };
  }

  const fips = countyFipsFromMunicode(unit.municode);
  const countyName = countyNameByFips.get(fips) ?? null;
  const base = unit.baseName ?? unit.name;

  if (unit.entityType === 'township') {
    if (!countyName) return null;
    const aliased = MI_TV_CENSUS_ALIASES[unit.municode];
    // ⚠ Charter first: `Comstock charter township` and a plain `Comstock
    // township` are different rows, and only one of them exists in any county.
    const keys = aliased
      ? [aliased.toLowerCase()]
      : [`${base} charter township`.toLowerCase(), `${base} township`.toLowerCase()];
    for (const k of keys) {
      const hit = townships.get(`${fips}|${k}`);
      if (hit) {
        // ⚠⚠ THE COUNTY IS PART OF THE NAME, NOT AN ANNOTATION.
        // `treasury_ensure_municipality` keys on the name, so bare township
        // names would merge 302 governments into 117 entities and silently
        // interleave their budgets.
        return {
          censusName: hit.name,
          name: `${displayFromCensusTownship(hit.name)}, ${countyName}`,
          population: hit.population,
          countyName,
        };
      }
    }
    return null;
  }

  if (unit.entityType === 'village') {
    const key = MI_TV_CENSUS_ALIASES[unit.municode] ?? `${base} village`;
    if (!places.has(key)) return null;
    return {
      censusName: key, name: displayFromCensusName(key), population: places.get(key), countyName,
    };
  }

  // Cities. ⚠ The ` village` fallback is deliberate and load-bearing: Michigan
  // has no City of Manchester, but the F-65 files municode 812019 as `City of
  // Manchester` from FY2020. The Census knows it only as `Manchester village`.
  const alias = MI_CENSUS_ALIASES[unit.name];
  if (alias) {
    if (!places.has(alias)) return null;
    return {
      censusName: alias, name: displayFromCensusName(alias), population: places.get(alias), countyName,
    };
  }
  for (const suffix of [' city', ' village']) {
    const key = `${unit.name}${suffix}`;
    if (places.has(key)) {
      return {
        censusName: key, name: displayFromCensusName(key), population: places.get(key), countyName,
      };
    }
  }
  return null;
}

/**
 * The name to look this unit up under in the FEDERAL AUDIT CLEARINGHOUSE census
 * — or `null` when that census cannot answer for it without guessing.
 *
 * ⚠⚠ THE FAC CENSUS CARRIES NO COUNTY, SO ITS TOWNSHIP NAMES ARE AMBIGUOUS.
 * `Bedford Township` appears in it TWICE with DIFFERENT months (month 7 in 1998,
 * month 1 in 2023) because Michigan has more than one Bedford Township, and
 * `buildCensus()` keys on the name alone — so it merges two governments into one
 * entry and the merge then reads as a fiscal-year CHANGE that never happened.
 *
 * Consulting it by bare name would let one township's federal filing confirm,
 * contradict, or invent a changeover year for ten others. That is the Wayne
 * city/county trap, eleven ways over, on the one column this project has got
 * wrong more often than any other.
 *
 * So a unit consults the census ONLY when its name means exactly one Michigan
 * government AND the census holds exactly one row for it. Everything else is
 * REFUSED — reported separately from genuinely uncovered, and never as agreement.
 *
 * ⚠ Villages are safe on a bare name for a measured reason, not an assumed one:
 * all 129 FAC rows matching a Michigan village name are kind `municipality`, so
 * the census never files a Michigan township under a bare name.
 */
export function facLookupName(entityType, resolved, census, facRowCounts) {
  // ⚠ Cities and counties keep the name the FY2026-08 sweep proved: the Census
  // DISPLAY name, which is what the FAC census's own entity names match.
  if (entityType === 'city' || entityType === 'county') return resolved.name;
  const bare = entityType === 'township'
    ? displayFromCensusTownship(resolved.censusName)
    : displayFromCensusName(resolved.censusName);
  if (entityType === 'township' && (census.townshipNameCounts.get(bare) ?? 0) > 1) return null;
  if ((facRowCounts.get(bare) ?? 0) > 1) return null;
  return bare;
}

/** How many rows the FAC census holds per Michigan entity name. */
export function facRowCountsForMI() {
  const counts = new Map();
  for (const r of readEvidence('MI')) counts.set(r.entity, (counts.get(r.entity) ?? 0) + 1);
  return counts;
}

/**
 * ⚠ Per YEAR, not per unit. A unit with one contradicted year keeps its other
 * fifteen; excluding the whole unit would throw away good data to punish a bad
 * row, and excluding nothing would publish a period the audited record denies.
 */
export function excludedYears(unit) {
  const out = [];
  // ⚠⚠ A REFUSED LOOKUP IS NOT AN AGREEMENT. `facCensusName` is null when the
  // federal census cannot name this government unambiguously; there is then no
  // evidence either way, and inventing one from a shared name is exactly the
  // defect this guard exists to prevent.
  const lookup = unit.facCensusName;
  if (!lookup) return out;
  for (const [fyStr, month] of Object.entries(unit.monthsByYear ?? {})) {
    const fy = Number(fyStr);
    const seen = censusMonthFor('MI', lookup, fy);
    if (seen?.unknown) continue;
    if (Number(month) !== Number(seen?.month)) out.push({ fiscalYear: fy, f65: Number(month), census: Number(seen?.month) });
  }
  return out;
}

/**
 * ⚠⚠ Entity-years excluded for a reason OTHER than the fiscal-month audit.
 *
 * Marysville FY2016's published subtotals disagree with its own leaves by
 * amounts that are not a duplication: TOTAL STATE GRANTS is 1.0278x (999,832 vs
 * 972,812) and TOTAL GENERAL GOVERNMENT is 1.3952x (1,277,429 vs 915,606). The
 * other twelve subtotal defects in the sweep are all EXACTLY 2.000x and are
 * declared in lib/michiganF65.mjs, which keeps the verified subtotal and
 * suppresses the contradicted detail. That handling rests on the leaves being a
 * duplicate of each other, which is visibly untrue here.
 *
 * So the year is dropped rather than explained. Marysville keeps its other 15.
 *
 * ⚠ Found by scripts/surveyMiF65Defects.mjs, which ran all 5,775 filings before
 * anything was loaded — 5,768 clean, 99.88%.
 */
export const EXCLUDED_ENTITY_YEARS = Object.freeze([
  Object.freeze({
    municode: '742030', fiscalYear: 2016, name: 'Marysville',
    why: 'published subtotals disagree with their own leaves at 1.0278x and 1.3952x. '
      + 'Its 316 keys are each present ONCE, so this is not the duplicate-filing case — '
      + 'the filing simply does not add up, and nothing here can say which figure is wrong',
  }),
  // ⚠⚠ Emitted TWICE by the portal, like four other filings — but unlike them,
  // some keys carry DIFFERENT amounts in the two copies. dedupeFilingRows()
  // throws rather than pick one, because no basis exists for preferring either.
  Object.freeze({
    municode: '632055', fiscalYear: 2018, name: 'Farmington Hills',
    why: 'duplicate filing whose copies disagree on 3 of 264 keys',
  }),
  Object.freeze({
    municode: '420000', fiscalYear: 2016, name: 'Keweenaw County',
    why: 'duplicate filing whose copies disagree on 21 of 246 keys',
  }),
  // ⚠ Filed the Expenditure table and NO Revenue table at all — 130 rows, every
  // one T2. TT's model pairs a revenue and an expenditure series per year, and
  // there is no revenue here to pair.
  //
  // ⚠ This drops a perfectly good expenditure series to avoid publishing a
  // revenue one that does not exist. The alternative — teaching the loader to
  // write a single face — is a real change for one entity-year in 5,772, and
  // writing $0 revenue is not an alternative at all: it would state that Auburn
  // received nothing in FY2019.
  Object.freeze({
    municode: '092010', fiscalYear: 2019, name: 'Auburn',
    why: 'the filing contains no Revenue table — 130 rows, all T2 (Expenditure)',
  }),

  // ══ THE VILLAGE + TOWNSHIP SWEEP, 2026-09-01 ══════════════════════════════
  //
  // 39 entity-years of 23,397 (0.17%). Found the same way as the four above:
  // `surveyMiF65Defects.mjs` ran EVERY filing through `buildFiling()` before
  // anything loaded, and this analysis then re-ran them the way `readFiling`
  // does — WITH `dedupeFilingRows` — because the survey's 58 failures include
  // 19 whole-filing repeats that the loader collapses losslessly.
  //
  // ⚠ Reading the survey's ratios alone would have declared those 19 as
  // duplicated detail and SUPPRESSED A CORRECT BREAKDOWN. Same trap as the
  // FY2026-08 sweep, same answer: read the rows, not the ratio.

  // ── 22 filings: A SUBTOTAL PUBLISHED WITHOUT ITS BREAKDOWN ────────────────
  //
  // ⚠⚠ Every leaf of one or more roots is ABSENT — `field_data` is null, which
  // is not the same as zero — while the root's own subtotal carries a figure.
  // Algansee Township FY2012 states TOTAL FEDERAL GRANTS of 140,180 above eight
  // leaves that are all empty.
  //
  // ⚠ 15 of the 22 are Branch County townships in FY2012 alone, so this is a
  // filing-software artifact rather than 22 independent accidents.
  //
  // ⭐ THE MONEY IS RECOVERABLE AND IS DELIBERATELY NOT RECOVERED HERE. In 21 of
  // the 22, the filing's own category subtotals still sum EXACTLY to its
  // published grand total, so the category figures are corroborated and only the
  // within-category detail is missing; TT already renders childless roots
  // (Detroit FY2015). Publishing them would need a new rule in
  // lib/michiganF65.mjs — "all leaves absent" is a different fact from "leaves
  // disagree" — and that is a change to proven extraction code for 22 filings in
  // 23,397. It belongs to its own session, with its own gates.
  // ⚠ Yankee Springs FY2015 is the exception: its revenue subtotals do NOT sum
  // to its grand total (1,282,158 vs 876,107), so that one is simply broken.
  Object.freeze({
    municode: '041010', fiscalYear: 2012, name: 'Alpena Township, Alpena County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '081160', fiscalYear: 2015, name: 'Yankee Springs Township, Barry County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121010', fiscalYear: 2012, name: 'Algansee Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121020', fiscalYear: 2012, name: 'Batavia Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121040', fiscalYear: 2012, name: 'Bronson Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121050', fiscalYear: 2012, name: 'Butler Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121060', fiscalYear: 2012, name: 'California Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121070', fiscalYear: 2012, name: 'Coldwater Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121080', fiscalYear: 2012, name: 'Gilead Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121090', fiscalYear: 2012, name: 'Girard Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121100', fiscalYear: 2012, name: 'Kinderhook Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121110', fiscalYear: 2012, name: 'Matteson Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121120', fiscalYear: 2012, name: 'Noble Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121130', fiscalYear: 2012, name: 'Ovid Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121140', fiscalYear: 2012, name: 'Quincy Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121150', fiscalYear: 2012, name: 'Sherwood Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '121160', fiscalYear: 2012, name: 'Union Township, Branch County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '321110', fiscalYear: 2012, name: 'Hume Township, Huron County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '521130', fiscalYear: 2013, name: 'Richmond Township, Marquette County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '611020', fiscalYear: 2013, name: 'Casnovia Township, Muskegon County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '731260', fiscalYear: 2013, name: 'Tittabawassee Township, Saginaw County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  Object.freeze({
    municode: '791200', fiscalYear: 2015, name: 'Vassar Township, Tuscola County',
    why: 'a published subtotal whose leaves are ALL ABSENT (not zero) — the '
      + 'publisher filed the category total and no breakdown',
  }),
  // ── 6 filings: SUBTOTALS THAT DISAGREE WITH THEIR OWN LEAVES ──────────────
  //
  // The Marysville FY2016 class. Not a duplication — the ratios are arbitrary —
  // so nothing here can say which of the two published figures is wrong.
  // ⚠ Winterfield FY2015 is the extreme: TOTAL TAX REVENUES of 12.34 above
  // leaves summing to 9,808.34, which is 794x. Loading either number would be a
  // guess.
  Object.freeze({
    municode: '121030', fiscalYear: 2012, name: 'Bethel Township, Branch County',
    why: 'published subtotals disagree with their own leaves at TOTAL TAX '
      + 'REVENUES 0.9196x',
  }),
  Object.freeze({
    municode: '151150', fiscalYear: 2015, name: 'Wilson Township, Charlevoix County',
    why: 'published subtotals disagree with their own leaves at TOTAL '
      + 'FEDERAL GRANTS 0.0203x',
  }),
  Object.freeze({
    municode: '181160', fiscalYear: 2015, name: 'Winterfield Township, Clare County',
    why: 'published subtotals disagree with their own leaves at TOTAL TAX '
      + 'REVENUES 794.8412x',
  }),
  Object.freeze({
    municode: '211010', fiscalYear: 2016, name: 'Baldwin Township, Delta County',
    why: 'published subtotals disagree with their own leaves at TOTAL PUBLIC '
      + 'WORKS 1.1610x',
  }),
  Object.freeze({
    municode: '671020', fiscalYear: 2016, name: 'Cedar Township, Osceola County',
    why: 'published subtotals disagree with their own leaves at TOTAL '
      + 'LICENSES AND PERMITS 2.1111x, TOTAL RECREATION AND CULTURE 9.9244x',
  }),
  Object.freeze({
    municode: '741150', fiscalYear: 2015, name: 'Ira Township, St. Clair County',
    why: 'published subtotals disagree with their own leaves at TOTAL TAX '
      + 'REVENUES 0.9894x',
  }),
  // ── 9 filings: THE FY2020 FORMATTING DEFECT, IN ITS BROKEN FORM ───────────
  //
  // ⚠⚠ FY2020 is the year the publisher emitted currency as `"$290,017,002.00"`
  // instead of a bare number — `parseAmount` strips `$` and `,` and reads those
  // correctly. In these nine filings the formatting produced a CELL WITH NO
  // NUMBER IN IT: the bare string `"$"`, or `".00"`, or `".0"`.
  //
  // ⚠ `parseAmount` THROWS rather than coercing, which is the whole point:
  // `Number(x) || 0` would load each of these as a $0 line item and every
  // subtotal check would still pass, because a missing leaf and a zero leaf are
  // indistinguishable once coerced.
  Object.freeze({
    municode: '061030', fiscalYear: 2020, name: 'Au Gres Township, Arenac County',
    why: 'FY2020 formatting defect: an amount is the bare string "$"',
  }),
  Object.freeze({
    municode: '091050', fiscalYear: 2020, name: 'Garfield Township, Bay County',
    why: 'FY2020 formatting defect: an amount is the bare string "$"',
  }),
  Object.freeze({
    municode: '181110', fiscalYear: 2020, name: 'Lincoln Township, Clare County',
    why: 'FY2020 formatting defect: an amount is the bare string "$"',
  }),
  Object.freeze({
    municode: '251180', fiscalYear: 2020, name: 'Vienna Charter Township, Genesee County',
    why: 'FY2020 formatting defect: an amount is the bare string "$"',
  }),
  Object.freeze({
    municode: '311010', fiscalYear: 2020, name: 'Adams Township, Houghton County',
    why: 'FY2020 formatting defect: an amount is the bare string "$"',
  }),
  Object.freeze({
    municode: '331080', fiscalYear: 2020, name: 'Leslie Township, Ingham County',
    why: 'FY2020 formatting defect: an amount is the bare string ".0"',
  }),
  Object.freeze({
    municode: '531080', fiscalYear: 2020, name: 'Logan Township, Mason County',
    why: 'FY2020 formatting defect: an amount is the bare string "."',
  }),
  Object.freeze({
    municode: '633080', fiscalYear: 2020, name: 'Leonard',
    why: 'FY2020 formatting defect: an amount is the bare string ".00"',
  }),
  Object.freeze({
    municode: '761200', fiscalYear: 2020, name: 'Moore Township, Sanilac County',
    why: 'FY2020 formatting defect: an amount is the bare string "$"',
  }),
  // ── 2 filings: A DUPLICATE WHOSE COPIES DISAGREE ──────────────────────────
  //
  // Emitted twice by the portal, like the others `dedupeFilingRows` collapses —
  // but some keys carry DIFFERENT amounts in the two copies, so there is no
  // basis for preferring either. It throws rather than pick one.
  // ⚠ Joins Farmington Hills FY2018 and Keweenaw County FY2016 from the
  // FY2026-08 city sweep, which are the same shape.
  Object.freeze({
    municode: '323080', fiscalYear: 2014, name: 'Sebewaing',
    why: 'duplicate filing whose copies disagree',
  }),
  Object.freeze({
    municode: '731010', fiscalYear: 2013, name: 'Albee Township, Saginaw County',
    why: 'duplicate filing whose copies disagree',
  }),

  // ── 15 filings the SUBTOTAL SURVEY COULD NOT SEE ──────────────────────────
  //
  // ⚠⚠ A PRE-LOAD SURVEY THAT RUNS DIFFERENT GATES THAN THE LOAD IS NOT A
  // PRE-LOAD SURVEY. `surveyMiF65Defects.mjs` ran `buildFiling()` on all 23,397
  // filings and called them 99.75% clean — but the LOADER also runs
  // `filingChecks()`, which asserts that a published grand total EXISTS and that
  // operating + financing reconciles to it. Fifteen filings passed the first and
  // failed the second, and they only surfaced in the dry run.
  // ⭐ The survey now runs `filingChecks` too. Fixed here, in this sweep.
  Object.freeze({
    municode: '053020', fiscalYear: 2022, name: 'Central Lake',
    why: 'the filing contains no Revenue table — 110 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '181030', fiscalYear: 2017, name: 'Freeman Township, Clare County',
    why: 'the MIRROR of the Auburn case — 46 Revenue rows and effectively '
      + 'no Expenditure table (6 rows, no TOTAL EXPENDITURES), so there '
      + 'is no spending series to pair with the revenue one',
  }),
  Object.freeze({
    municode: '191080', fiscalYear: 2017, name: 'Essex Township, Clinton County',
    why: 'the filing contains no Revenue table — 86 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '331040', fiscalYear: 2021, name: 'Delhi Charter Township, Ingham County',
    why: 'the filing contains no Revenue table — 119 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '443060', fiscalYear: 2017, name: 'North Branch',
    why: 'the filing contains no Revenue table — 94 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '443060', fiscalYear: 2019, name: 'North Branch',
    why: 'the filing contains no Revenue table — 114 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '501030', fiscalYear: 2021, name: 'Chesterfield Township, Macomb County',
    why: 'the filing contains no Revenue table — 129 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '561150', fiscalYear: 2017, name: 'Porter Township, Midland County',
    why: 'the filing contains no Revenue table — 74 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '631200', fiscalYear: 2013, name: 'Southfield Township, Oakland County',
    why: 'the filing contains no Revenue table — 290 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '631240', fiscalYear: 2021, name: 'White Lake Charter Township, Oakland County',
    why: 'the filing contains no Revenue table — 132 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '731060', fiscalYear: 2021, name: 'Bridgeport Charter Township, Saginaw County',
    why: 'the filing contains no Revenue table — 130 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '741030', fiscalYear: 2013, name: 'Burtchville Township, St. Clair County',
    why: 'the filing contains no Revenue table — 290 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '741040', fiscalYear: 2022, name: 'Casco Township, St. Clair County',
    why: 'the filing contains no Revenue table — 89 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '821070', fiscalYear: 2021, name: 'Plymouth Charter Township, Wayne County',
    why: 'the filing contains no Revenue table — 147 rows, all T2 '
      + '(Expenditure). The Auburn FY2019 class: TT pairs a revenue and '
      + 'an expenditure series per year, and writing $0 revenue would '
      + 'state that the township received nothing',
  }),
  Object.freeze({
    municode: '731270', fiscalYear: 2016, name: 'Zilwaukee Township, Saginaw County',
    why: 'operating + financing does not reconcile to the published total: '
      + '69,261 vs a published 68,601, a 660 difference. Not a '
      + 'subtotal-vs-leaves defect — every root ties its own leaves — so '
      + 'nothing here can say which figure is wrong',
  }),
]);

/**
 * ⚠⚠ ONE GOVERNMENT THAT THE PUBLISHER MOVED BETWEEN FORMS, AND RE-KEYED.
 *
 * The Village of Manchester (Washtenaw County) files as municode 813030 on the
 * VILLAGE form for FY2010-FY2019 and as municode 812019 on the CITY form, named
 * `City of Manchester`, from FY2020. It is one government, and treating the two
 * codes as two units would give a reader two half-length cards — the same
 * phantom-twin defect the municode zero-padding fix exists to prevent, arriving
 * by a different route.
 *
 * ⚠ It was verified rather than inferred, on four independent facts:
 *   • The years are DISJOINT and CONTIGUOUS: FY2010-2019 and FY2020-2025.
 *   • The fiscal calendar never moves — `fiscalendmonth` 6 (a July start) on
 *     every filing of both codes.
 *   • The money is continuous across the handover: General Fund revenue runs
 *     1,376,675 (FY2018) / 1,423,356 (FY2019, village form) / 1,440,439
 *     (FY2020, city form) / 1,467,397 (FY2021).
 *   • MICHIGAN HAS NO CITY OF MANCHESTER. The Census knows only `Manchester
 *     village`, so `City of Manchester` is the publisher's label, not a fact
 *     about the government.
 *
 * ⚠ It is also the ONLY such pair in the state. Every (county, base name) pair
 * held by two municodes was checked: 203 exist, 202 of them are a township
 * filing alongside a like-named city or village IN THE SAME YEARS — genuinely
 * different governments — and exactly one has zero year overlap.
 *
 * ⚠⚠ THE ENTITY TYPE IS `village`, WHICH CORRECTS AN EXISTING TT ROW.
 * `treasury_ensure_municipality` keys on (name, state, ENTITY_TYPE), so leaving
 * the existing row at `city` and writing `village` here would create a SECOND
 * municipality and split the series that this entry exists to join. The
 * accompanying migration moves that one row to `village`; its id does not
 * change, so its 24 existing FY2020-2025 budget rows stay attached and no
 * figure moves.
 */
export const MI_MUNICODE_CONTINUATIONS = Object.freeze([
  Object.freeze({
    canonical: '812019',
    absorbs: '813030',
    name: 'Manchester',
    entityType: 'village',
    why: 'the Village of Manchester filed on the Village form as 813030 through FY2019 '
      + 'and on the City form as 812019 from FY2020 — one government, two codes',
  }),
]);

/**
 * Fold each declared continuation's absorbed unit into its canonical one.
 *
 * ⚠ Overlapping years would mean the two codes are NOT one government after all,
 * so that stops the build rather than picking a filing.
 */
export function applyContinuations(roster, continuations = MI_MUNICODE_CONTINUATIONS) {
  const byCode = new Map(roster.map((u) => [u.municode, u]));
  const dropped = new Set();
  for (const c of continuations) {
    const keep = byCode.get(c.canonical);
    const gone = byCode.get(c.absorbs);
    if (!keep || !gone) {
      throw new Error(`continuation ${c.canonical}<-${c.absorbs}: both municodes must be in the roster`);
    }
    const clash = keep.fiscalYears.filter((y) => gone.fiscalYears.includes(y));
    if (clash.length) {
      throw new Error(`continuation ${c.canonical}<-${c.absorbs} overlaps in FY${clash.join(', ')} — `
        + 'two codes filing the SAME year are two governments, not one');
    }
    keep.municodes = [c.canonical, c.absorbs];
    keep.entityType = c.entityType;
    keep.unitTypeByYear = Object.fromEntries([
      ...keep.fiscalYears.map((y) => [y, keep.unitType]),
      ...gone.fiscalYears.map((y) => [y, gone.unitType]),
    ]);
    keep.fiscalYears = [...keep.fiscalYears, ...gone.fiscalYears].sort((a, b) => a - b);
    keep.monthsByYear = { ...keep.monthsByYear, ...gone.monthsByYear };
    dropped.add(c.absorbs);
  }
  return roster.filter((u) => !dropped.has(u.municode));
}

export function keyFor(name, entityType) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return entityType === 'county' ? slug : slug;
}

function main() {
  const { values } = parseArgs({
    options: { roster: { type: 'string', default: '_acfr-work/mi-sweep/roster.json' } },
  });
  const roster = applyContinuations(JSON.parse(readFileSync(values.roster, 'utf8')));
  const census = loadCensus();
  const facRowCounts = facRowCountsForMI();

  const entities = [];
  const unresolved = [];
  const excluded = [];
  const refused = [];
  const seenKeys = new Map();

  for (const unit of roster) {
    const res = resolveCensus(unit, census);
    if (!res) { unresolved.push(unit); continue; }
    const facCensusName = facLookupName(unit.entityType, res, census, facRowCounts);
    if (!facCensusName) refused.push({ municode: unit.municode, name: res.name });
    const withCensus = { ...unit, censusName: res.name, facCensusName };
    const drops = excludedYears(withCensus);
    const dropSet = new Set(drops.map((d) => d.fiscalYear));
    for (const x of EXCLUDED_ENTITY_YEARS) {
      if ((unit.municodes ?? [unit.municode]).includes(x.municode)) dropSet.add(x.fiscalYear);
    }
    // ⚠⚠ A YEAR WHOSE WHOLE DATASET IS UNREADABLE. FY2016 Village publishes the
    // amount in `field_name` where the grid coordinate belongs, on all 83,274 of
    // its rows, so its 251 filings cannot be read at all. Dropping the year here
    // — rather than letting the fetcher come back empty — keeps the roster's
    // own account of what it covers true.
    for (const d of UNUSABLE_DATASETS) {
      for (const [fy, ut] of Object.entries(unit.unitTypeByYear
        ?? Object.fromEntries(unit.fiscalYears.map((y) => [y, unit.unitType])))) {
        if (ut === d.unitType && Number(fy) === d.fiscalYear) dropSet.add(Number(fy));
      }
    }
    if (drops.length) excluded.push({ municode: unit.municode, name: res.name, drops });

    const years = (unit.fiscalYears ?? []).filter((y) => !dropSet.has(y));
    if (years.length === 0) continue;

    const key = keyFor(res.name, unit.entityType);
    if (seenKeys.has(key)) {
      throw new Error(`duplicate entity key ${key}: ${seenKeys.get(key)} and ${unit.municode}`);
    }
    seenKeys.set(key, unit.municode);

    entities.push({
      key,
      name: res.name,
      municode: unit.municode,
      // ⚠ Every code this government has filed under. One entry for all but the
      // declared continuations; the loader accepts any of them.
      municodes: unit.municodes ?? [unit.municode],
      unitType: unit.unitType,
      // ⚠ The unit type PER YEAR, because a continuation changes form mid-series.
      unitTypeByYear: unit.unitTypeByYear
        ?? Object.fromEntries(unit.fiscalYears.map((y) => [y, unit.unitType])),
      entityType: unit.entityType,
      censusName: res.name,
      // ⚠ null means the FEDERAL census cannot name this unit unambiguously.
      // The loader's guard reads THIS, never `censusName`.
      facCensusName,
      population: res.population,
      fiscalYears: years,
      monthsByYear: Object.fromEntries(
        Object.entries(unit.monthsByYear).filter(([y]) => !dropSet.has(Number(y)))),
    });
  }

  // ⚠⚠ Detroit and Wayne County already hold 142 rows in TT under these exact
  // names. A rename here would orphan them behind a duplicate entity.
  for (const [municode, expected] of [['822050', 'Detroit'], ['820000', 'Wayne County']]) {
    const e = entities.find((x) => x.municode === municode);
    if (!e) throw new Error(`the session-7a entity ${municode} fell out of the roster`);
    if (e.name !== expected) {
      throw new Error(`${municode} would be renamed ${expected} -> ${e.name}, orphaning its existing rows`);
    }
  }

  const totalYears = entities.reduce((n, e) => n + e.fiscalYears.length, 0);
  const n = (t) => entities.filter((e) => e.entityType === t).length;
  const body = `${HEADER}
export const MI_STATEWIDE_LOAD_WINDOW = Object.freeze({ first: 2010, last: 2025 });

/** ${entities.length} units — ${n('city')} cities, ${n('county')} counties, `
    + `${n('village')} villages, ${n('township')} townships — ${totalYears} entity-years. */
export const MI_STATEWIDE_ENTITIES = Object.freeze(${JSON.stringify(entities, null, 1)}.map(Object.freeze));

export function entityByMunicode(municode) {
  const key = String(municode ?? '').trim().padStart(6, '0');
  // ⚠ Matches ANY code the government has filed under, not just the canonical
  // one — the Village of Manchester filed as 813030 before FY2020 and 812019
  // after, and both must reach the same entity.
  return MI_STATEWIDE_ENTITIES.find((e) => e.municodes.includes(key)) ?? null;
}

export function entityByKey(key) {
  return MI_STATEWIDE_ENTITIES.find((e) => e.key === key) ?? null;
}
`;
  writeFileSync(OUT, body);

  console.log(`roster units      : ${roster.length}`);
  console.log(`entities written  : ${entities.length}  (${totalYears} entity-years)`);
  console.log(`  cities ${n('city')} · counties ${n('county')} · villages ${n('village')} · townships ${n('township')}`);
  console.log(`unresolved (no Census match, EXCLUDED): ${unresolved.length}`);
  for (const u of unresolved) console.log(`  ⚠ ${u.municode} ${u.entityType} ${u.name}`);
  // ⚠ Reported on its own line because "the federal census cannot answer for
  // this unit" is a different fact from "the federal census has no row", and
  // folding the two together would overstate how much of this load is checked.
  console.log(`FAC lookup REFUSED (name is not unambiguous): ${refused.length}`);
  console.log(`units with EXCLUDED years (census contradicts the F-65): ${excluded.length}`);
  for (const e of excluded) {
    console.log(`  ⚠ ${e.municode} ${e.name}: dropped FY`
      + e.drops.map((d) => `${d.fiscalYear}(F-65 ${d.f65} vs census ${d.census})`).join(', '));
  }
  console.log(`\nwrote ${OUT}`);
  if (entities.length === 0) { console.error('REFUSING: no entities.'); return 1; }
  return 0;
}

const HEADER = `/**
 * Michigan statewide sweep — every CITY and COUNTY that filed an F-65 in
 * FY2010-FY2025, with the entity-years the federal audit record contradicts
 * already removed.
 *
 * ⚠⚠ GENERATED by scripts/buildMiStatewideEntities.mjs. Do not hand-edit; change
 * the generator or scripts/data/miCensusAliases.mjs and re-run.
 *
 * NO SHEBANG — tests import this module.
 *
 * ⚠⚠ \`municode\` IS THE JOIN KEY AND IT IS ZERO-PADDED TO SIX. The F-65 emits it
 * as a NUMBER in fifteen of the sixteen City datasets and as a STRING in FY2020,
 * so Harrisville is \`12010\` everywhere except FY2020, where it is \`012010\`.
 * Joining on the raw value splits 18 cities into a 15-year entity and a phantom
 * FY2020 twin.
 *
 * ⚠⚠ \`monthsByYear\` IS PER YEAR because four units changed fiscal calendar
 * mid-series. Write the month for the year being loaded, never one constant per
 * unit — a wrong month moves $0 and passes every tie test.
 *
 * ⚠ \`name\` and \`population\` come from the SAME Census PEP Vintage 2024 row, so
 * a name can never be paired with another government's population. See
 * scripts/data/miCensusAliases.mjs for the twelve units whose F-65 spelling
 * differs, and the St. Joseph city/county trap it exists to avoid.
 */
`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(main());
}
