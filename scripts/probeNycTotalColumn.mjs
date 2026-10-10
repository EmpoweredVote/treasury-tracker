#!/usr/bin/env node
/**
 * Does `acfrGF.py`'s own `target_column='last'` reproduce a $0 tie on NYC?
 *
 * Spec section 5.3 left this open ON PURPOSE. The 2026-10-09 spike proved the
 * SOURCE ties, but it did so with a throwaway reader that took the right-most
 * token on each row. `acfrGF.py` resolves 'last' differently -- its `ordinal`
 * strategy counts dash-runs and its `positional` strategy cannot anchor an
 * all-dash column -- so the spike's result does NOT transfer by assumption.
 *
 * ⚠⚠ THE HARD CASE IS FY2015-FY2018. Each prints exactly ONE five-cell row,
 * always `Public safety and judicial`, where the Adjustments/Eliminations cell
 * is EMPTY rather than dashed. A reader that trusts token count drops it:
 *
 *     FY2015  9,129,695   FY2017  10,058,916
 *     FY2016  9,652,787   FY2018  10,418,804   (thousands)
 *
 * Exit 0 = `-table` reproduces and NYC stays on the shared reader.
 * Exit 3 = a DIAGNOSED mechanical failure; move the entity to the coordinate
 *          reader, for a reason written into the wrapper.
 *
 * ⚠⚠ DO NOT CHOOSE PER YEAR WHICHEVER READER TIED. That is curve-fitting --
 * the error that got the LA-01 scope verdict retracted. The choice is made per
 * ENTITY, on a stated reason.
 *
 * Usage:
 *   node scripts/probeNycTotalColumn.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolvePython } from './lib/pythonBin.mjs';
import { NYC_FYS } from './lib/nycAcfrSources.mjs';

// The four years whose Total Governmental expenditure the naive reader lost,
// and by exactly how much. Asserted, not merely watched.
const BLANK_CELL_YEARS = new Map([
  [2015, 9_129_695_000],
  [2016, 9_652_787_000],
  [2017, 10_058_916_000],
  [2018, 10_418_804_000],
]);

const python = resolvePython();
const failures = [];
let checks = 0;

for (const fy of NYC_FYS) {
  for (const mode of ['revenue', 'operating']) {
    checks += 1;
    const r = spawnSync(python, [
      'scripts/extractNYC.py', `docs/NYC/nyc-${fy}-acfr.pdf`,
      '--mode', mode, '--scope', 'total',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    if (r.status !== 0) {
      failures.push(`FY${fy} ${mode}: extractor exit ${r.status} ${(r.stderr || '').slice(0, 200)}`);
      continue;
    }
    let d;
    try { d = JSON.parse(r.stdout); } catch {
      failures.push(`FY${fy} ${mode}: unparseable extractor output`);
      continue;
    }
    if (d.tie_delta !== 0) {
      failures.push(`FY${fy} ${mode}: tie_delta ${d.tie_delta} `
        + `(computed ${d.computed_total} vs printed ${d.printed_total})`);
      continue;
    }

    // ⚠ The tie alone does not prove the blank-cell row was READ -- it proves
    // the sum matched the printed total. Assert the row is present at its known
    // value, so a reader that dropped it AND lost the same amount somewhere
    // else could not pass quietly.
    if (mode === 'operating' && BLANK_CELL_YEARS.has(fy)) {
      const want = BLANK_CELL_YEARS.get(fy);
      const found = findNode(d.tree, 'Public safety and judicial');
      if (!found) {
        failures.push(`FY${fy} operating: 'Public safety and judicial' MISSING -- the blank Adjustments cell dropped the row`);
      } else if (found.a !== want) {
        failures.push(`FY${fy} operating: 'Public safety and judicial' = ${found.a}, expected ${want}`);
      }
    }
    console.log(`FY${fy} ${mode}: tie $0  printed=${d.printed_total}`);
  }
}

function findNode(node, name) {
  for (const c of node.c || []) {
    if (c.n === name) return c;
    const hit = findNode(c, name);
    if (hit) return hit;
  }
  return null;
}

if (failures.length) {
  console.error(`\n${failures.length} of ${checks} checks FAILED:`);
  for (const f of failures) console.error('  ' + f);
  console.error('\n-table does not reproduce on this entity for the total column.');
  process.exit(3);
}
console.log(`\n${checks}/${checks} total-governmental checks tie at $0, `
  + 'and all four blank-cell years read Public safety and judicial at its '
  + 'printed value. -table reproduces.');
