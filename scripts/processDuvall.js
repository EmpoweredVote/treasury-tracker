#!/usr/bin/env node
/**
 * Loads City of Duvall, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's annual financial reports (MCAG 0391).
 *
 * ⚠⚠ DUVALL IS THE FIRST NON-GAAP ENTITY IN THIS ROSTER. It reports on the
 * BARS regulatory basis and its auditor issues TWO opinions in one report:
 * UNMODIFIED on that regulatory basis and ADVERSE on U.S. GAAP. The rows this
 * driver writes are therefore `audit_grade = audited_ocboa` and
 * `accounting_basis = cash` — audited, and not GAAP. `audited_gaap` here would
 * be a false public claim about a document that explicitly denies GAAP.
 *
 * Thin driver over scripts/lib/waSaoLoad.mjs -- every guard (FY-vs-filename
 * cross-check, $0 tie gate, mapped-total == computed_total, sanity ceiling,
 * per-capita band, source_url validation, ephemeral data_sources lifecycle)
 * lives in that shared core. This file is descriptor + argv only.
 *
 * The fiscal-year window, population, per-capita band and sanity ceiling all
 * come from scripts/lib/waRoster.mjs rather than being restated here, so the
 * loader and the three verification harnesses cannot drift apart.
 *
 * FISCAL-YEAR WINDOW: 10 years, FY2016-FY2025, from NINE documents. All 20
 * combinations resolve; 18 tie at exactly $0 and FY2025's two carry the
 * registered $1 deltas described in scripts/extractDuvall.py.
 *
 * ⚠⚠ ONE DOCUMENT CARRIES TWO YEARS. Duvall is audited BIENNIALLY and ARN
 * 1036127 holds a complete statement for FY2022 AND FY2023. It is saved under
 * both filenames with identical bytes, and the statement is chosen by its own
 * printed `For the Year Ended December 31, <FY>`. Measured: that document
 * prints FY2023 FIRST, so the library's default "earliest qualifying page"
 * rule would have published FY2023's money under the FY2022 label — inverted
 * from the obvious guess, and a $0 tie either way.
 *
 * ⚠⚠ THE MEMO COLUMN IS PRINTED FIRST. `Total for All Funds (Memo Only)` is
 * column 0; `001 General Fund` is column 1. A target_column=0 default would
 * publish all-funds money under a General Fund label and tie at $0 — FY2024
 * revenue 28,652,633 instead of 7,074,922.
 *
 * ⚠ THE WINDOW IS NARROWER THAN THE READABLE CORPUS, DELIBERATELY. FY2010-
 * FY2015 parse fine on a different config and are excluded by the floor rule's
 * era-split clause: the statement's shape changes between FY2015 and FY2016
 * (the BARS code moves onto the label's line) and the pre-2016 era prints
 * CENTS. THE ROSTER IS THE ONLY AUTHORITY ON THE WINDOW; this driver takes
 * `fiscalYears` from it and must never discover years from disk.
 *
 * ⚠ AMOUNTS ARE WHOLE DOLLARS (units=1). The tie gate is unit-invariant, so
 * the roster's per-capita band is the only guard that fires on a wrong
 * multiplier.
 *
 * ⚠ THE BAND IS DUVALL'S OWN, [230, 1900], derived from its measured
 * $463.77-$949.08 spread. Redmond's [450, 3700] is its King County neighbour
 * and would have REJECTED six of Duvall's twenty combinations — a band is
 * re-derived per entity from its observed spread, never inherited.
 *
 * Usage:
 *   node scripts/processDuvall.js --dry-run
 *   node scripts/processDuvall.js
 *   node scripts/processDuvall.js --fy 2024
 */
import { loadEntity, makeExtractorSelector, parseTargetFY } from './lib/waSaoLoad.mjs';
import { DUVALL_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const E = getEntity('Duvall');

// ⚠ `!E.fiscalYears` is NOT enough: `[]` is truthy. An empty window would sail
// past a presence check, load nothing, fail nothing, print "0 loaded, 0 failed"
// and exit 0 — a silent no-op reported as success.
if (!E.fiscalYears?.length) throw new Error('Duvall has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand?.length) throw new Error('Duvall has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift apart.
// Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !DUVALL_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in DUVALL_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

// ⚠ The converse drift is the dangerous one, and it is NOT symmetric with the
// check above. An ARN pinned for a year the roster does not load would quietly
// make a policy-excluded year loadable the moment anyone widened
// `fiscalYears` -- and SIX of Duvall's exclusions are perfectly readable.
//
// ⚠⚠ THIS GUARD MUST NOT BE WRITTEN AS "EVERY ARN IS UNIQUE". Duvall is
// audited BIENNIALLY, so ARN 1036127 legitimately appears under BOTH FY2022
// and FY2023 — that is the biennial case, and it is expected. What is asserted
// is the direction that actually matters: every PINNED fiscal year is a LOADED
// fiscal year.
const strayArns = Object.keys(DUVALL_ARNS).map(Number)
  .filter((fy) => !E.fiscalYears.includes(fy));
if (strayArns.length) {
  throw new Error(`DUVALL_ARNS pins FY ${strayArns.join(', ')}, which the roster does not load — ` +
    `every pinned ARN must correspond to a loaded year.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // ONE extractor for the whole 10-year window. The statement shape is
  // identical in FY2016 and FY2025; the pre-FY2016 era, which would need its
  // own config, is outside the window precisely so that no second config is
  // needed.
  extractorFor: makeExtractorSelector('extractDuvall.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(DUVALL_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  // Throws on --fy=, a bare --fy, a non-numeric year or 0 — every one of which
  // used to degrade silently into a full delete-and-republish of all years.
  targetFY: parseTargetFY(argv),
});

console.log(`\nDuvall: ${loaded} loaded, ${failed} failed.`);
// ⚠ The non-zero branch cannot actually be reached: loadEntity THROWS when a
// year fails unless `allowPartial` is set, and this descriptor never sets it.
process.exit(failed ? 1 : 0);
