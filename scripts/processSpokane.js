#!/usr/bin/env node
/**
 * Loads City of Spokane, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0724).
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
 * FISCAL-YEAR WINDOW: 20 years, FY2004-FY2024 less FY2012. That one exclusion
 * is a source-document defect -- its statement pages carry no text layer at
 * all, returning only the SAO page furniture. FY2025 is excluded for source
 * timing: the only filing released so far is a Contracted CPA report. Both are
 * recorded with their evidence in scripts/extractSpokane.py and the window
 * itself lives in scripts/lib/waRoster.mjs.
 *
 * ⚠ AMOUNTS ARE WHOLE DOLLARS (units=1), the OPPOSITE of Tacoma in the same
 * milestone. The tie gate is unit-invariant and cannot catch a wrong
 * multiplier, so the roster's per-capita band is the only guard that fires on
 * it -- and it is re-derived for Spokane, not inherited from Tacoma.
 *
 * Usage:
 *   node scripts/processSpokane.js --dry-run
 *   node scripts/processSpokane.js
 *   node scripts/processSpokane.js --fy 2024
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { SPOKANE_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');
const E = getEntity('Spokane');

if (!E.fiscalYears) throw new Error('Spokane has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand) throw new Error('Spokane has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift
// apart. Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !SPOKANE_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in SPOKANE_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // One extractor for the whole 20-year window. Spokane drifts its spelling
  // twice (`Capital outlay`/`outlays`, colon/no-colon group headings) and
  // renames its expenditure functions mid-span, but none of that is an era
  // split: see extractSpokane.py for why one config absorbs all of it.
  extractorFor: makeExtractorSelector('extractSpokane.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(SPOKANE_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nSpokane: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
