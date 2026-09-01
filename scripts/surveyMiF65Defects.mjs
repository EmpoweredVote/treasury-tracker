/**
 * Survey the whole Michigan sweep for subtotal-vs-leaves defects, WITHOUT
 * loading anything.
 *
 * NO SHEBANG — kept importable.
 *
 * Usage:
 *   node scripts/surveyMiF65Defects.mjs --dir _acfr-work/mi-sweep/filings
 *
 * ── WHY A SURVEY BEFORE A REGISTRY ─────────────────────────────────────────
 *
 * `lib/michiganF65.mjs` throws when a published subtotal does not equal its own
 * leaves, and `KNOWN_DUPLICATED_DETAIL` declares the exceptions ONE AT A TIME,
 * with exact amounts. That is the right mechanism and it was sized for two
 * entities: session 7a declared three roots in one Detroit filing.
 *
 * At 364 units nobody knows how many there are, and the answer changes what to
 * do. If it is a handful, they get declared individually as before. If it is
 * hundreds, declaring them one by one is still exact but the SHAPE matters more
 * than the list — a defect appearing in 5% of filings is a property of the FORM,
 * not of a few filers, and that belongs in the record.
 *
 * ⚠ This script never decides. It counts, groups by ratio, and prints. The
 * ratio is the diagnostic: session 7a's Detroit case was EXACTLY 2.000, which is
 * a duplication artifact rather than an arithmetic error, and a different ratio
 * would be a different defect needing different handling.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  buildFiling, filingChecks, dedupeFilingRows, SCOPES, CATEGORY_REVENUE, CATEGORY_EXPENDITURE,
} from './lib/michiganF65.mjs';
import { entityByKey } from './data/miStatewideEntities.mjs';

const CATEGORIES = [CATEGORY_REVENUE, CATEGORY_EXPENDITURE];

const PARSE = /^F-65 subtotal does not equal its own leaves: (.+?) \[(.+?)\] (\w+) (\S+) (.+?) — leaves ([\d.-]+) vs published ([\d.-]+)$/;

function main() {
  const { values } = parseArgs({
    options: { dir: { type: 'string', default: '_acfr-work/mi-sweep/filings' } },
  });
  const files = readdirSync(values.dir).filter((f) => f.endsWith('.json')).sort();

  let filings = 0; let clean = 0;
  const defects = [];
  const otherErrors = [];

  for (const file of files) {
    const filing = JSON.parse(readFileSync(join(values.dir, file), 'utf8'));
    const entity = entityByKey(filing.entityKey);
    if (!entity) { otherErrors.push(`${file}: unknown entity`); continue; }
    filings += 1;
    // ⚠⚠ DEDUPLICATE FIRST, EXACTLY AS `readFiling` DOES. Nineteen of the
    // township filings are emitted TWICE by the portal, and left alone every
    // leaf sum doubles while the published subtotals stay right — which reads
    // as the Detroit FY2015 duplicated-detail defect and is NOT it. A survey
    // that skips the dedupe reports 19 filings as broken and would have had
    // them declared, SUPPRESSING A CORRECT BREAKDOWN.
    let rows = filing.rows;
    try { ({ rows } = dedupeFilingRows(filing.rows, `${entity.name} FY${filing.fiscalYear}`)); }
    catch (err) { otherErrors.push(`${entity.name} FY${filing.fiscalYear}: ${err.message}`); continue; }
    let hadDefect = false;
    for (const category of CATEGORIES) {
      for (const scope of [SCOPES.general_fund, SCOPES.total_governmental]) {
        try {
          const context = `${entity.name} FY${filing.fiscalYear}`;
          const built = buildFiling(rows, {
            category, scope, context, municode: filing.municode, fiscalYear: filing.fiscalYear,
          });
          // ⚠⚠ THE LOADER RUNS THESE TOO, AND THEY CATCH A DIFFERENT CLASS.
          // `buildFiling` throws when a subtotal disagrees with its own leaves;
          // `filingChecks` asserts the published GRAND TOTAL exists and that
          // operating + financing reconciles to it. Fifteen township filings
          // passed the first and failed the second, and because this survey
          // once ran only the first it reported them as clean — the load found
          // them instead. A survey that runs different gates than the load is
          // not a survey of the load.
          for (const c of filingChecks({ category, scope, built, context })) {
            if (!c.ok) throw new Error(`filingCheck ${c.kind}: ${c.id} `
              + `expected ${c.expected} actual ${c.actual}`);
          }
        } catch (err) {
          const m = PARSE.exec(err.message);
          if (!m) { otherErrors.push(`${entity.name} FY${filing.fiscalYear}: ${err.message}`); hadDefect = true; continue; }
          const leaves = Number(m[6]); const published = Number(m[7]);
          defects.push({
            municode: entity.municode, name: entity.name, fiscalYear: filing.fiscalYear,
            scope: m[2], category: m[3], field: m[4], root: m[5], leaves, published,
            ratio: published === 0 ? null : leaves / published,
          });
          hadDefect = true;
        }
      }
    }
    if (!hadDefect) clean += 1;
  }

  console.log(`filings surveyed : ${filings}`);
  console.log(`filings CLEAN    : ${clean}`);
  console.log(`filings WITH a subtotal defect: ${filings - clean}`
    + `  (${(100 * (filings - clean) / filings).toFixed(2)}%)`);
  console.log(`defect occurrences: ${defects.length}`);
  console.log(`other errors      : ${otherErrors.length}`);

  const byRatio = new Map();
  for (const d of defects) {
    const k = d.ratio === null ? 'published=0'
      : (Math.abs(d.ratio - Math.round(d.ratio)) < 1e-9 ? `exactly ${Math.round(d.ratio)}.000×` : 'non-integer');
    byRatio.set(k, (byRatio.get(k) ?? 0) + 1);
  }
  console.log('\nleaves ÷ published:');
  for (const [k, n] of [...byRatio.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${n}`);
  }

  const units = new Set(defects.map((d) => d.municode));
  console.log(`\ndistinct units affected: ${units.size}`);
  const byUnit = new Map();
  for (const d of defects) byUnit.set(d.name, (byUnit.get(d.name) ?? 0) + 1);
  for (const [n, c] of [...byUnit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${n}: ${c}`);
  }
  for (const e of otherErrors.slice(0, 10)) console.log(`  ⚠ OTHER: ${e}`);

  console.log(`\nnon-integer ratios (each one is a DIFFERENT defect class):`);
  for (const d of defects.filter((x) => x.ratio !== null
      && Math.abs(x.ratio - Math.round(x.ratio)) >= 1e-9).slice(0, 15)) {
    console.log(`  ${d.name} FY${d.fiscalYear} ${d.category} ${d.root}: `
      + `${d.leaves} vs ${d.published} (${d.ratio.toFixed(4)}×)`);
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
