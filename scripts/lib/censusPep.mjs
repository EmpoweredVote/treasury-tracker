/**
 * Census Bureau Population Estimates Program (PEP) readers.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * Two file families, both free bulk downloads with no key:
 *
 *   sub-est2024_<ss>.csv      one state's SUBCOUNTY places
 *                             https://www2.census.gov/programs-surveys/popest/
 *                               datasets/2020-2024/cities/totals/
 *   co-est2024-alldata.csv    every county in the country
 *                             https://www2.census.gov/programs-surveys/popest/
 *                               datasets/2020-2024/counties/totals/
 *
 * ── ⚠⚠ THE NAME FIELD IS QUOTED AND CONTAINS COMMAS ────────────────────────
 *
 * This module exists because a `line.split(',')` reader is WRONG on these files
 * and fails almost silently. Florida's place file carries
 *
 *     162,12,000,34132,...,"Islamorada, Village of Islands village",Florida,7127,...
 *
 * so a naive split yields 17 cells against 16 headers. The NAME reads as the
 * truncated `"Islamorada`, and — the part that actually moves a number —
 * **every column after NAME shifts by one**, so `POPESTIMATE2024` returns the
 * 2023 estimate. Islamorada would have loaded with a population one year stale
 * and nothing would have failed.
 *
 * scripts/buildMiStatewideEntities.mjs carries a naive reader with the comment
 * "These two files have no quoted commas in the columns used here." That was
 * true of Michigan's file and is FALSE of Florida's. A per-file assumption
 * about quoting is not a property of the format, so this reader does not make
 * one — and `readPepCsv` ASSERTS the cell count against the header count, so a
 * file that violates the expectation fails loudly instead of shifting a column.
 *
 * ── ⚠ SUMLEV, AND WHY 162 IS NOT ENOUGH ────────────────────────────────────
 *
 *   040  state total
 *   050  county (in the county file)
 *   157  place PART within one county   — carries a real COUNTY code
 *   162  whole INCORPORATED PLACE       — COUNTY is always '000'
 *   170  consolidated city
 *   061  minor civil division (townships)
 *
 * A whole-place row (162) is the population, but it cannot say which county the
 * place is in: its COUNTY field is `000`. The county comes from the place's
 * 157 rows, and a place with MORE THAN ONE of them straddles a county line.
 */

import { readFileSync } from 'node:fs';

/**
 * Split one CSV line, honouring double-quoted fields and `""` escapes.
 *
 * Returns raw cell strings with surrounding quotes removed and no trimming
 * beyond that — a Census NAME may legitimately end in a designator word and
 * trimming is the caller's business.
 */
export function splitCsvLine(line) {
  const out = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cell); cell = '';
    } else cell += ch;
  }
  out.push(cell);
  if (inQuotes) throw new Error(`unterminated quoted field in CSV line: ${line.slice(0, 80)}...`);
  return out;
}

/**
 * Read a PEP CSV into plain objects.
 *
 * ⚠ Asserts every row's cell count equals the header count. A shifted column is
 * the failure mode this whole module exists to prevent, and it is invisible in
 * the output — so it must be impossible to reach, not merely unlikely.
 */
export function readPepCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error(`${path}: no data rows`);
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length !== headers.length) {
      throw new Error(`${path} line ${i + 1}: ${cells.length} cells against `
        + `${headers.length} headers — a shifted column would silently return another `
        + `year's estimate. Line starts: ${lines[i].slice(0, 90)}`);
    }
    const row = {};
    for (let c = 0; c < headers.length; c++) row[headers[c]] = cells[c];
    rows.push(row);
  }
  return rows;
}

/** SUMLEV constants, named so a call site never carries a bare string. */
export const SUMLEV = Object.freeze({
  state: '040',
  county: '050',
  placePart: '157',
  wholePlace: '162',
  consolidatedCity: '170',
  minorCivilDivision: '061',
});

/**
 * The type designator Census appends to a place name.
 *
 * ⚠⚠ IT IS NOT SAFE TO STRIP THIS. Census lowercases the designator even when
 * the type word is part of the government's legal name, so "Everglades city"
 * is the City of Everglades City and "Bal Harbour village" is the Village of
 * Bal Harbour — the same rendering for two different facts. Stripping the tail
 * gives "Everglades", which names no Florida municipality.
 *
 * Michigan learned the same thing from the other direction: eight Michigan
 * villages are genuinely named `... City`, and stripping the word dropped them
 * from the load with no figure ever being wrong.
 *
 * So this exists ONLY to make a fuzzy CANDIDATE key for matching, never to
 * produce a display name. Take the display name from the publisher.
 */
export const PLACE_DESIGNATOR_RE = /\s+(city|town|village|borough|municipality|CDP)$/i;

/** A normalised key for matching only — never shown to a reader. */
export function placeMatchKey(name) {
  return String(name).replace(PLACE_DESIGNATOR_RE, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Exact normalised key, designator KEPT — for names like "Everglades City". */
export function exactMatchKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Index one state's place file.
 *
 * @returns {{wholeByName: Map<string, object>, partsByPlace: Map<string, object[]>}}
 *   `wholeByName` is keyed by the VERBATIM Census NAME, so it is unambiguous;
 *   `partsByPlace` is keyed by PLACE code and holds every county part.
 */
export function indexPlaces(path) {
  const rows = readPepCsv(path);
  const wholeByName = new Map();
  const partsByPlace = new Map();
  for (const r of rows) {
    if (r.SUMLEV === SUMLEV.wholePlace) {
      if (wholeByName.has(r.NAME)) {
        throw new Error(`${path}: two SUMLEV-162 rows both named "${r.NAME}" — `
          + 'the Census name is not a unique key in this file and the join needs a PLACE code');
      }
      wholeByName.set(r.NAME, r);
    } else if (r.SUMLEV === SUMLEV.placePart) {
      if (!partsByPlace.has(r.PLACE)) partsByPlace.set(r.PLACE, []);
      partsByPlace.get(r.PLACE).push(r);
    }
  }
  return { wholeByName, partsByPlace };
}

/** One state's counties from the national county file, keyed by verbatim CTYNAME. */
export function indexCounties(path, stateFips) {
  const rows = readPepCsv(path);
  const byName = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== SUMLEV.county || r.STATE !== stateFips) continue;
    if (byName.has(r.CTYNAME)) throw new Error(`${path}: duplicate county "${r.CTYNAME}" in state ${stateFips}`);
    byName.set(r.CTYNAME, r);
  }
  return byName;
}

/**
 * Which county does a place belong to, and does it straddle?
 *
 * `PRIMGEO_FLAG` marks the primary county part where Census sets it. ⚠ It is 0
 * on every Michigan SUMLEV-157 row, so it cannot be relied on nationally; when
 * no part is flagged this falls back to the LARGEST part by population and says
 * so, because that is a choice a reader deserves to see rather than a fact.
 *
 * @returns {{countyFips:string, straddles:boolean, parts:number, basis:string}|null}
 */
export function countyForPlace(partsByPlace, placeCode, popField = 'POPESTIMATE2024') {
  const parts = partsByPlace.get(placeCode);
  if (!parts || parts.length === 0) return null;
  if (parts.length === 1) {
    return { countyFips: parts[0].COUNTY, straddles: false, parts: 1, basis: 'sole county part' };
  }
  const flagged = parts.filter((p) => p.PRIMGEO_FLAG === '1');
  if (flagged.length === 1) {
    return { countyFips: flagged[0].COUNTY, straddles: true, parts: parts.length, basis: 'PRIMGEO_FLAG' };
  }
  const largest = [...parts].sort((a, b) => Number(b[popField] || 0) - Number(a[popField] || 0))[0];
  return {
    countyFips: largest.COUNTY,
    straddles: true,
    parts: parts.length,
    basis: 'largest county part by population (no PRIMGEO_FLAG set)',
  };
}
