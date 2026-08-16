#!/usr/bin/env node
/**
 * Loads City of Bellevue, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0374).
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
 * FISCAL-YEAR WINDOW: 12 years, the SHORTEST in this milestone -- FY2008-FY2023
 * less FY2011, FY2014, FY2017 and FY2019. Every gap is a source-document
 * defect, not a config limit: nine of the twenty-one filings have no readable
 * statement despite all twenty-one passing the fetch-time content guard.
 * FY2004-FY2007 are four CONSECUTIVE image-only scans, which is what ends the
 * window at FY2008 under the floor rule. See scripts/extractBellevue.py.
 *
 * ⚠ AMOUNTS ARE IN THOUSANDS (units=1000), like Tacoma and unlike Spokane and
 * Vancouver. The tie gate is unit-invariant, so the roster's per-capita band is
 * the only guard that fires on a wrong multiplier -- and Bellevue's band is the
 * highest in the cohort ($904-$2,011/resident), so copying any neighbour's
 * would have rejected a correct load outright.
 *
 * ⚠ THE TREE SHAPE IS INVERTED relative to every other WA entity: `Capital
 * outlay:` is a PARENT with function children, not a valued root leaf. See the
 * extractor for why reading it the other way still ties at $0.
 *
 * ELEVEN REGISTERED SOURCE-ROUNDING CASES, the most of any entity here, and
 * structural rather than sloppy: a thousands-denominated statement rounds each
 * component independently, so their sum need not equal the separately-rounded
 * printed total. Every one was adjudicated by rendering the page at 200dpi and
 * re-adding the General Fund column off the IMAGE, and registered as an EXACT
 * delta rather than a tolerance.
 *
 * Usage:
 *   node scripts/processBellevue.js --dry-run
 *   node scripts/processBellevue.js
 *   node scripts/processBellevue.js --fy 2023
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { BELLEVUE_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');
const E = getEntity('Bellevue');

if (!E.fiscalYears) throw new Error('Bellevue has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand) throw new Error('Bellevue has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift
// apart. Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !BELLEVUE_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in BELLEVUE_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // One extractor for the whole 12-year window. Bellevue's statement is
  // remarkably stable across it -- same eleven revenue sources, same three
  // parent characters, same functions -- so the config needs no era handling
  // at all. What varies is the DOCUMENT quality, not the statement.
  extractorFor: makeExtractorSelector('extractBellevue.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(BELLEVUE_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nBellevue: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
