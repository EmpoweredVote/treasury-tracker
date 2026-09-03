/**
 * Florida entity-years where DFS's own two published reports DISAGREE.
 *
 * NO SHEBANG — tests import this module.
 *
 * ── ⚠⚠ WHAT THIS LIST IS ────────────────────────────────────────────────────
 *
 * The oracle for this family is DFS's `TOTALREVEXPDEBT` report, computed outside
 * the detail reports and published separately. For 6,382 of 6,396 city and
 * county entity-years the full parse of the detail report reproduces it TO THE
 * CENT, for revenue and expenditure both.
 *
 * For the fourteen below it does not — and the difference is NOT in our read.
 * Every one of them has **DFS's total ABOVE the detail report**, never below,
 * and the row counts in the drift years are normal for the entity (Brooksville
 * files 45 expenditure rows in FY2024 against 46 in FY2023). The detail
 * workbooks are structurally intact; they simply do not contain all the money
 * the totals report counts.
 *
 * ⚠ Twelve of the fourteen are counties whose REVENUE ties exactly at $0 while
 * only expenditures fall short, which is itself evidence the parse is sound: the
 * same code, the same workbook and the same fund columns reproduce one published
 * figure exactly and the other not at all.
 *
 * ── WHY THESE ARE NOT LOADED ────────────────────────────────────────────────
 *
 * The oracle proves the READ, never the SCOPE and not even the TRUTH. Where the
 * publisher contradicts itself we cannot prove the read, so a tree built from
 * the detail report would understate the government's spending by a figure we
 * can name but not explain — up to $553,871 for Okeechobee County FY2014 and
 * $24.3M for Fort Myers Beach FY2024's revenue. TT does not publish a figure it
 * cannot stand behind, and it does not quietly widen a gate to make one fit.
 *
 * ⚠⚠ THIS IS A DECLARED EXCLUSION, SO IT MUST NAME SOMETHING. Michigan shipped
 * an exclusion entry that was well-formed, named a real unit, and excluded
 * nothing — found only by reconciling the drop count against the registry. So
 * `scripts/loadFlStatewide.mjs` asserts that every entry here ACTUALLY drifts
 * when its year is processed, with the delta stated, and fails if one has gone
 * stale. A drift that is NOT on this list stays fatal.
 *
 * Deltas are DFS's figure MINUS the parsed figure, in dollars.
 */

/** @typedef {{code:string, name:string, fiscalYear:number, expDelta:number, revDelta:number}} FlOracleDrift */

/** @type {FlOracleDrift[]} */
export const FL_ORACLE_DRIFT = [
  { code: '100047', name: "Okeechobee County", fiscalYear: 2014, expDelta: 553871, revDelta: 0 },
  { code: '100063', name: "Union County", fiscalYear: 2014, expDelta: 107, revDelta: 0 },
  { code: '100039', name: "Liberty County", fiscalYear: 2015, expDelta: 1663, revDelta: 0 },
  { code: '100047', name: "Okeechobee County", fiscalYear: 2015, expDelta: 234542, revDelta: 0 },
  { code: '100014', name: "DeSoto County", fiscalYear: 2016, expDelta: 10502, revDelta: 0 },
  { code: '100015', name: "Dixie County", fiscalYear: 2016, expDelta: 294353, revDelta: 0 },
  { code: '100014', name: "DeSoto County", fiscalYear: 2017, expDelta: 10588, revDelta: 0 },
  { code: '100014', name: "DeSoto County", fiscalYear: 2018, expDelta: 10838, revDelta: 0 },
  { code: '100047', name: "Okeechobee County", fiscalYear: 2018, expDelta: 259533, revDelta: 0 },
  { code: '100014', name: "DeSoto County", fiscalYear: 2019, expDelta: 122679, revDelta: 0 },
  { code: '100047', name: "Okeechobee County", fiscalYear: 2019, expDelta: 308395, revDelta: 0 },
  { code: '100060', name: "Sumter County", fiscalYear: 2019, expDelta: 166, revDelta: 0 },
  { code: '200044', name: "Brooksville", fiscalYear: 2024, expDelta: 15028098, revDelta: 20788478 },
  { code: '200112', name: "Fort Myers Beach", fiscalYear: 2024, expDelta: 0, revDelta: 24346526 },
];

/** `"<code>|<fiscalYear>"` -> entry. */
export const FL_ORACLE_DRIFT_BY_KEY = new Map(
  FL_ORACLE_DRIFT.map((d) => [`${d.code}|${d.fiscalYear}`, d]),
);

export function declaredDriftFor(code, fiscalYear) {
  return FL_ORACLE_DRIFT_BY_KEY.get(`${code}|${fiscalYear}`) || null;
}
