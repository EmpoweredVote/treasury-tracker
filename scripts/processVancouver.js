#!/usr/bin/env node
/**
 * Loads City of Vancouver, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0247).
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
 * FISCAL-YEAR WINDOW: 19 years, FY2005-FY2023. Both exclusions sit at the ENDS
 * of the available span rather than inside it -- FY2004 is an image-only scan
 * and FY2024's statement has no money digits at all -- so no year inside the
 * window is skipped. FY2025 does not exist: the SAO holds no City of Vancouver
 * filing for it. See scripts/extractVancouver.py for the evidence.
 *
 * ⚠ AMOUNTS ARE WHOLE DOLLARS (units=1), like Spokane and unlike Tacoma. The
 * tie gate is unit-invariant, so the roster's per-capita band is the only guard
 * that fires on a wrong multiplier -- and it is re-derived for Vancouver.
 *
 * TWO REGISTERED SOURCE-ROUNDING CASES, both FY2008: each side of that
 * statement prints a total exactly one dollar BELOW the sum of its own printed
 * components. Adjudicated off the rendered page image at 200dpi, never off the
 * text layer, and registered as EXACT deltas rather than a tolerance.
 *
 * Usage:
 *   node scripts/processVancouver.js --dry-run
 *   node scripts/processVancouver.js
 *   node scripts/processVancouver.js --fy 2023
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { VANCOUVER_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');
const E = getEntity('Vancouver');

if (!E.fiscalYears) throw new Error('Vancouver has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand) throw new Error('Vancouver has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift
// apart. Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !VANCOUVER_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in VANCOUVER_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // One extractor for the whole 19-year window. Vancouver renames its capital
  // line (`Capital projects` -> `Capital outlay`) and its expenditure
  // functions mid-span, but the tree shape never changes and it prints its
  // indentation throughout -- see extractVancouver.py.
  extractorFor: makeExtractorSelector('extractVancouver.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(VANCOUVER_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nVancouver: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
