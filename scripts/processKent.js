#!/usr/bin/env node
/**
 * Loads City of Kent, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0401).
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
 * FISCAL-YEAR WINDOW: 18 years, FY2004-FY2024 less FY2019, FY2020 and FY2023.
 * All three exclusions carry no usable text layer (+29 shift, money digits
 * absent). Every one of the 36 combinations ties at exactly $0 on ONE config.
 *
 * ⚠ FY2019 AND FY2020 ARE CONSECUTIVE, and the milestone's floor rule says two
 * consecutive unreadable years END the window -- which would have stopped Kent
 * at FY2021 and published three years. The window below the gap was taken
 * instead, as an EXPLICIT, APPROVED DEVIATION: the rule's stated purpose is
 * "never extend a window by doing not-easy work to make the row count look
 * better", and reading below FY2019 needed no work at all -- the fifteen years
 * below the gap parse on the same config as the three above it. Measured, not
 * assumed. See scripts/extractKent.py and the recon doc.
 *
 * ⚠ AMOUNTS ARE WHOLE DOLLARS (units=1), like Spokane and Vancouver, unlike
 * Tacoma and Bellevue. The tie gate is unit-invariant, so the roster's
 * per-capita band is the only guard that fires on a wrong multiplier.
 *
 * THE RICHEST REVENUE TREE IN THE COHORT: five parent groups, with
 * `Fines and forfeitures` the one ungrouped source. See the extractor for why
 * the member suffixes are narrower than they look like they should be.
 *
 * Usage:
 *   node scripts/processKent.js --dry-run
 *   node scripts/processKent.js
 *   node scripts/processKent.js --fy 2023
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { KENT_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');
const E = getEntity('Kent');

if (!E.fiscalYears) throw new Error('Kent has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand) throw new Error('Kent has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift
// apart. Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !KENT_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in KENT_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // One extractor for the whole 18-year window, spanning the FY2019-FY2020
  // gap. The five revenue parents and their children are the same in FY2004 as
  // in FY2024; only a few child labels are renamed. What varies across this
  // corpus is DOCUMENT quality, not statement structure.
  extractorFor: makeExtractorSelector('extractKent.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(KENT_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nKent: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
