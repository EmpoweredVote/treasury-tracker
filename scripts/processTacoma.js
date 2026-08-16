#!/usr/bin/env node
/**
 * Loads City of Tacoma, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0610).
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
 * FISCAL-YEAR WINDOW: 19 years, FY2003-FY2024 less FY2011, FY2018 and FY2021.
 * All three exclusions are source-document defects -- statement pages with no
 * usable text layer, FY2018 plainly showing the constant +29 byte shift that
 * v2.22 proved unrecoverable. FY2025 is excluded for source timing: only an
 * opinion letter has been released. See scripts/extractTacoma.py for the
 * evidence and scripts/lib/waRoster.mjs for the window itself.
 *
 * ⚠ AMOUNTS ARE IN THOUSANDS (units=1000 in the extractor). The tie gate is
 * unit-invariant and cannot catch a wrong multiplier, so the per-capita band
 * below is the only guard that fires on it.
 *
 * Usage:
 *   node scripts/processTacoma.js --dry-run
 *   node scripts/processTacoma.js
 *   node scripts/processTacoma.js --fy 2024
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { TACOMA_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');
const E = getEntity('Tacoma');

if (!E.fiscalYears) throw new Error('Tacoma has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand) throw new Error('Tacoma has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift
// apart. Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !TACOMA_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in TACOMA_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // One extractor for the whole window -- no era overrides, despite Tacoma
  // restating its statement twice. See extractTacoma.py for why one config
  // spans all three eras, and for the measurement that proves it.
  extractorFor: makeExtractorSelector('extractTacoma.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(TACOMA_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nTacoma: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
