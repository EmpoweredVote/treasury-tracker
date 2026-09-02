/**
 * Audit the F-65's self-reported `fiscalendmonth` against the FEDERAL AUDIT
 * CLEARINGHOUSE census, for every Michigan unit in the sweep — cities, counties,
 * villages and townships.
 *
 * NO SHEBANG — kept importable.
 *
 * Usage:
 *   node scripts/auditMiF65FiscalMonths.mjs --roster _acfr-work/mi-sweep/roster.json
 *
 * ── ⚠⚠ WHY THIS RUNS BEFORE THE LOAD, NOT AFTER ────────────────────────────
 *
 * `fiscal_year_start_month` is the field this project has got wrong more often
 * than any other, and every one of those defects moved $0 and passed every tie
 * test. A wrong month is invisible to arithmetic: the figures are right, the
 * PERIOD they are labelled with is wrong.
 *
 * Session 7a read the month from each filing's own `fiscalendmonth` and checked
 * it against a hand-written roster constant, which was safe for two entities.
 * At 364 units nobody can eyeball it, so the check has to be against an
 * INDEPENDENT source — and TT already holds one: the FAC census, derived from
 * the units' own Single Audit filings.
 *
 * The roster build already found four units whose F-65 month CHANGES mid-series.
 * Spot-checking three of them against the census showed the F-65 disagreeing
 * with the audited record — including Lapeer County, which the census reports as
 * month 1 for 1998-2025 while the F-65 claims month 10 from FY2022. That is not
 * a calendar change faithfully recorded; it is one of the two sources being
 * wrong, and it has to be quantified before 23,000 rows are keyed on it.
 *
 * ⚠ ABSENCE OF CENSUS COVERAGE IS NOT AGREEMENT. `censusGuard` returns ok:true
 * when it has no evidence, which is correct for a guard and useless for a
 * measurement. This counts UNCOVERED separately and never folds it into the
 * agreement rate.
 */

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import { censusMonthFor } from './lib/facFiscalYearCensus.mjs';

const STATE = 'MI';

/**
 * The name to look a unit up under, or `null` to refuse the lookup entirely.
 *
 * ⚠⚠ A UNIT CARRYING `facCensusName: null` IS REFUSED, NOT UNCOVERED. The FAC
 * census records no county, so `Grant Township, MI` there could be any of the
 * eleven Michigan townships of that name, and `Bedford Township` is already two
 * of them merged into a single entry carrying two different months. Looking
 * those up by bare name would let one government's federal filing confirm or
 * contradict another's calendar — and a WRONG CONFIRMATION is worse than no
 * evidence, because it reads as a check that passed.
 */
export function defaultLookupName(unit) {
  if ('facCensusName' in unit) return unit.facCensusName;
  return unit.censusName ?? unit.name;
}

/**
 * @returns {{agree: number, conflict: number, uncovered: number, refused: number,
 *            details: object[]}}
 */
export function auditRoster(roster, censusLookup = censusMonthFor, lookupNameFor = defaultLookupName) {
  let agree = 0, conflict = 0, uncovered = 0, refused = 0;
  const details = [];
  for (const unit of roster) {
    const lookup = lookupNameFor(unit);
    for (const [fyStr, month] of Object.entries(unit.monthsByYear ?? {})) {
      const fy = Number(fyStr);
      if (!lookup) { refused += 1; continue; }
      const seen = censusLookup(STATE, lookup, fy);
      if (seen?.unknown) { uncovered += 1; continue; }
      if (Number(month) === Number(seen?.month)) { agree += 1; continue; }
      conflict += 1;
      details.push({
        municode: unit.municode,
        name: unit.name,
        unitType: unit.unitType,
        fiscalYear: fy,
        f65Month: Number(month),
        censusMonth: Number(seen?.month),
      });
    }
  }
  return { agree, conflict, uncovered, refused, details };
}

async function main() {
  const { values } = parseArgs({
    options: {
      roster: { type: 'string' },
      // ⚠ Default to the GENERATED ENTITIES, because those carry
      // `facCensusName` and are what actually loads. The raw roster has no
      // ambiguity information, so auditing it would report a coverage this
      // load does not have.
      entities: { type: 'boolean', default: true },
    },
  });
  const roster = values.roster
    ? JSON.parse(readFileSync(values.roster, 'utf8'))
    : (await import('./data/miStatewideEntities.mjs')).MI_STATEWIDE_ENTITIES;
  const {
    agree, conflict, uncovered, refused, details,
  } = auditRoster(roster);
  const checked = agree + conflict;

  console.log(`roster units        : ${roster.length}`);
  console.log(`entity-years        : ${agree + conflict + uncovered + refused}`);
  console.log(`  census AGREES     : ${agree}`);
  console.log(`  census CONFLICTS  : ${conflict}`);
  console.log(`  census UNCOVERED  : ${uncovered}   (no evidence — never counted as agreement)`);
  console.log(`  lookup REFUSED    : ${refused}   (name is not unambiguous — see defaultLookupName)`);
  if (checked > 0) {
    console.log(`agreement where measurable: ${(100 * agree / checked).toFixed(1)}%`);
  }

  const byUnit = new Map();
  for (const d of details) {
    const k = `${d.municode} ${d.name}`;
    byUnit.set(k, [...(byUnit.get(k) ?? []), d]);
  }
  console.log(`\nunits with ANY conflict: ${byUnit.size}`);
  for (const [k, ds] of [...byUnit.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
    const yrs = ds.map((d) => d.fiscalYear).sort((a, b) => a - b);
    console.log(`  ⚠ ${k} (${ds[0].unitType}): F-65 says ${ds[0].f65Month}, census says `
      + `${ds[0].censusMonth} — FY${yrs[0]}-${yrs[yrs.length - 1]} (${ds.length} years)`);
  }
  if (byUnit.size > 25) console.log(`  ... and ${byUnit.size - 25} more units`);

  // ⚠ A measurement that measured nothing must FAIL, not pass.
  if (checked === 0) {
    console.error('\nREFUSING: no entity-year could be checked against the census.');
    return 1;
  }
  return conflict > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((c) => process.exit(c));
}
