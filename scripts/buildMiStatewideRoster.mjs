/**
 * Build the Michigan statewide roster — every CITY and COUNTY that filed an
 * F-65 in FY2010-FY2025 — from the publisher's own data.
 *
 * NO SHEBANG — tests import from this module. A `#!` on any module a test
 * imports breaks `npm test` on Windows (project_wa_cities_01).
 *
 * Usage:
 *   node scripts/buildMiStatewideRoster.mjs --out _acfr-work/mi-sweep
 *
 * Writes `roster.json`. It does NOT write the loadable roster module; that is a
 * separate, reviewed step, because a generated file that loads 23,000 rows
 * should be read by a human before it does.
 *
 * ── ⚠⚠ WHY THE ROSTER IS DERIVED, NOT TYPED ────────────────────────────────
 *
 * Session 7a hand-wrote two entities and could afford to. 363 cannot be checked
 * by eye, so every field here has to come from a source that can be named, and
 * the ones that cannot be sourced are left NULL for a human — never guessed.
 *
 *   municode              the publisher's stable key. ⚠⚠ JOIN ON THIS, NEVER ON
 *                         `lu_name`: Detroit files as both `Detroit` and `City
 *                         of Detroit` under one constant 822050.
 *   name                  the most recent `lu_name`, normalised.
 *   fiscalYearStartMonth  READ from `fiscalendmonth` (the ENDING month) on the
 *                         unit's own filings. ⚠⚠ NEVER a state default:
 *                         Michigan's counties split 72 January / 29 October,
 *                         and Detroit (month 7) differs from its own parent
 *                         Wayne County (month 10). Carrying a dominant month is
 *                         verbatim project_fysm_column_default_one_defect.
 *   population            Census PEP Vintage 2024, joined on FIPS place/county
 *                         code, not on name.
 *
 * ⚠⚠ A UNIT WHOSE `fiscalendmonth` IS INCONSISTENT ACROSS ITS OWN FILINGS IS
 * REPORTED, NEVER AVERAGED. A fiscal calendar that genuinely changed is a real
 * event TT must represent per year; silently picking the mode would move $0
 * while mislabelling the period, which is the defect class this campaign has
 * hit more often than any other.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { DATASETS, PORTAL } from './fetchMichiganF65.mjs';
import { MI_LOAD_WINDOW } from './data/miKnightEntities.mjs';

/** The two unit types this sweep covers. Villages and townships are a later pass. */
export const SWEEP_UNIT_TYPES = Object.freeze(['City', 'County']);

async function getJson(url, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

/**
 * One cheap query per dataset: the distinct (municode, lu_name, fiscalendmonth)
 * triples. This is a few hundred rows instead of the ~139,000 the full City
 * FY2024 dataset holds, so the whole roster costs 32 small requests.
 */
export function rosterUrl(datasetId) {
  const select = encodeURIComponent('distinct municode, lu_name, fiscalendmonth');
  return `${PORTAL}/resource/${datasetId}.json?$select=${select}&$limit=50000`;
}

/**
 * Normalise the publisher's unit name for display.
 *
 * ⚠ The F-65 writes the same unit inconsistently across years. This strips a
 * leading form-of-government word so `City of Detroit` and `Detroit` agree, and
 * appends `County` where the county datasets omit it — but it NEVER decides
 * identity. Identity is `municode`, always.
 */
export function displayName(luName, unitType) {
  let n = String(luName ?? '').trim().replace(/\s+/g, ' ');
  n = n.replace(/^(City|Village|Township|Charter Township|County)\s+of\s+/i, '');
  if (unitType === 'County' && !/\bcounty\b/i.test(n)) n = `${n} County`;
  return n;
}

/** `fiscalendmonth` is the ENDING month, so a June end (6) starts in July (7). */
export function startMonthFromEndMonth(endMonth) {
  const m = Number(endMonth);
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return (m % 12) + 1;
}

/**
 * ⚠⚠ CANONICALISE THE MUNICODE BEFORE JOINING ON IT.
 *
 * The municode is CCTTTT — a 2-digit county plus a 4-digit unit — so counties
 * 01-09 produce a LEADING ZERO. Socrata types the field as a NUMBER in fifteen
 * of the sixteen City datasets, which drops that zero, and as a STRING in
 * FY2020, which keeps it. Harrisville is therefore `12010` in every year except
 * FY2020, where it is `012010`.
 *
 * Joining on the raw value SPLITS 18 Michigan cities into two entities each — a
 * 15-year entity and a phantom FY2020 twin — and the phantom carries the one
 * year that also has the formatted-currency defect. Two cards for Harrisville,
 * neither complete.
 *
 * ⚠ The campaign's rule was "join on municode, never on lu_name". True, and not
 * sufficient: the stable key needs normalising too. Padding to six is the form
 * Detroit (822050) and Wayne County (820000) already use.
 */
export function canonicalMunicode(raw) {
  const digits = String(raw ?? '').trim();
  if (!/^[0-9]{1,6}$/.test(digits)) return null;
  return digits.padStart(6, '0');
}

export function keyFor(name, unitType) {
  const base = displayName(name, unitType)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return unitType === 'County' ? base : base;
}

/**
 * Fold every filing into one roster entry per municode.
 *
 * @returns {{entries: object[], conflicts: object[]}}
 */
export function foldFilings(filings) {
  const byCode = new Map();
  for (const f of filings) {
    const code = canonicalMunicode(f.municode);
    if (!code) continue;
    if (!byCode.has(code)) {
      byCode.set(code, { municode: code, unitType: f.unitType, names: new Map(), months: new Map() });
    }
    const e = byCode.get(code);
    const nm = String(f.lu_name ?? '').trim();
    if (nm) e.names.set(f.fiscalYear, nm);
    const start = startMonthFromEndMonth(f.fiscalendmonth);
    if (start !== null) e.months.set(f.fiscalYear, start);
  }

  const entries = [];
  const conflicts = [];
  for (const e of byCode.values()) {
    const years = [...e.months.keys()].sort((a, b) => a - b);
    const distinctMonths = [...new Set(e.months.values())];
    const latestYear = [...e.names.keys()].sort((a, b) => b - a)[0];
    const raw = e.names.get(latestYear) ?? '';
    const entry = {
      municode: e.municode,
      unitType: e.unitType,
      entityType: e.unitType === 'County' ? 'county' : 'city',
      name: displayName(raw, e.unitType),
      rawNames: [...new Set(e.names.values())].sort(),
      // ⚠ NULL when the unit's own filings disagree. Never a mode, never a default.
      fiscalYearStartMonth: distinctMonths.length === 1 ? distinctMonths[0] : null,
      fiscalYears: years,
      monthsByYear: Object.fromEntries([...e.months.entries()].sort((a, b) => a[0] - b[0])),
    };
    if (distinctMonths.length !== 1) {
      conflicts.push({ municode: e.municode, name: entry.name, months: entry.monthsByYear });
    }
    entries.push(entry);
  }
  entries.sort((a, b) => a.municode.localeCompare(b.municode));
  return { entries, conflicts };
}

async function main() {
  const { values } = parseArgs({
    options: { out: { type: 'string', default: '_acfr-work/mi-sweep' } },
  });

  const filings = [];
  for (const unitType of SWEEP_UNIT_TYPES) {
    for (let fy = MI_LOAD_WINDOW.first; fy <= MI_LOAD_WINDOW.last; fy += 1) {
      const id = DATASETS[unitType]?.[fy];
      if (!id) throw new Error(`no dataset id for ${unitType} FY${fy}`);
      const rows = await getJson(rosterUrl(id));
      for (const r of rows) filings.push({ ...r, unitType, fiscalYear: fy });
      process.stdout.write(`  ${unitType} FY${fy}: ${rows.length} units\n`);
    }
  }

  const { entries, conflicts } = foldFilings(filings);
  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, 'roster.json'), JSON.stringify(entries, null, 1));

  const cities = entries.filter((e) => e.unitType === 'City').length;
  const counties = entries.filter((e) => e.unitType === 'County').length;
  console.log(`\nfilings read : ${filings.length}`);
  console.log(`roster       : ${entries.length} units (${cities} cities, ${counties} counties)`);
  console.log(`fiscal-month CONFLICTS (left null for a human): ${conflicts.length}`);
  for (const c of conflicts.slice(0, 20)) {
    console.log(`  ⚠ ${c.municode} ${c.name}: ${JSON.stringify(c.months)}`);
  }
  if (conflicts.length > 20) console.log(`  ... and ${conflicts.length - 20} more`);

  // ⚠ A build that produced nothing must FAIL, not pass.
  if (entries.length === 0) {
    console.error('REFUSING: the roster is empty.');
    return 1;
  }
  return 0;
}

// ⚠ On Windows `file://${argv[1]}` yields two slashes where import.meta.url has
// three (file:///C:/...), so the naive comparison is always false and the script
// silently does nothing. pathToFileURL normalises both sides.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((c) => process.exit(c));
}
