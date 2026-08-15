#!/usr/bin/env node
/**
 * Loads City of Bainbridge Island, WA General Fund rows (operating + revenue)
 * from the WA State Auditor's bound financial statements.
 *
 * Thin driver over scripts/lib/waSaoLoad.mjs -- every guard (FY-vs-filename
 * cross-check, $0 tie gate, mapped-total == computed_total, sanity ceiling,
 * per-capita band, source_url validation, ephemeral data_sources lifecycle)
 * lives in that shared core. This file is descriptor + argv only.
 *
 * FISCAL-YEAR WINDOW (20 years, deliberately not `Object.keys(BAINBRIDGE_ARNS)`)
 * ------------------------------------------------------------------------------
 * FY2004, 2005, 2007, 2008 and FY2010-FY2025. Two years are absent from the
 * WA SAO set entirely and are documented upstream:
 *   * FY2006 -- the only filing (ARN 73415) is an image-only scan.
 *   * FY2009 -- statement pages are digit-bearing but ciphered (broken
 *     embedded font, no usable ToUnicode CMap); Task 6's bounded
 *     contiguous-offset decode found no substitution map that tied.
 * Neither year has an ARN in BAINBRIDGE_ARNS, so FISCAL_YEARS and the ARN
 * lookup agree by construction -- important because requireSourceUrl() in
 * waSaoLoad.mjs HARD THROWS on a falsy URL (the generic SAO fallback was
 * deliberately removed), so an FY listed here without an ARN would abort the
 * run rather than publish an unsourced row. The assertion below makes that
 * agreement explicit instead of implicit.
 *
 * TWO EXTRACTORS, NOT ONE
 * ------------------------
 * FY2004/2005/2007/2008 print a genuinely different expenditure tree (no
 * `Current` parent; `Debt service:` is itself a parent) and need
 * extractBainbridgeEarly.py. FY2010+ uses extractBainbridge.py. CityConfig is
 * one tree shape per config, not an era-aware switch, so the era split is
 * expressed here via makeExtractorSelector().
 *
 * Usage:
 *   node scripts/processBainbridge.js --dry-run
 *   node scripts/processBainbridge.js
 *   node scripts/processBainbridge.js --fy 2025
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { BAINBRIDGE_ARNS } from './fetchBainbridgeKitsap.mjs';
import { reportFileUrl } from './lib/waSao.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');

const FISCAL_YEARS = [
  2004, 2005, 2007, 2008,
  2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
  2020, 2021, 2022, 2023, 2024, 2025,
];

// FY2004/2005/2007/2008 -> the early-era tree shape. Everything else -> modern.
const EARLY_ERA = { 2004: 'extractBainbridgeEarly.py', 2005: 'extractBainbridgeEarly.py',
                    2007: 'extractBainbridgeEarly.py', 2008: 'extractBainbridgeEarly.py' };

// Fail fast and locally if the FY window and the ARN manifest ever drift apart
// (e.g. a future year added to one and not the other). Without this the same
// mistake would surface deep inside loadEntity as a requireSourceUrl throw
// after the run had already started writing.
const missingArns = FISCAL_YEARS.filter(fy => !BAINBRIDGE_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in BAINBRIDGE_ARNS for FY ${missingArns.join(', ')} -- ` +
    `FISCAL_YEARS and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: 'Bainbridge Island',
  extractorFor: makeExtractorSelector('extractBainbridge.py', EARLY_ERA),
  pdfDir: 'docs/BainbridgeIsland',
  pdfPrefix: 'bainbridge',
  fiscalYears: FISCAL_YEARS,
  // WA OFM April 1, 2025 official estimate -- the same figure seeded by
  // scripts/seedBainbridgeKitsap.mjs (Filter=4 city row, line 186).
  population: 25_530,
  // Seattle's [500, 25000] does NOT transfer. Bainbridge GF runs roughly
  // $700-1,600/resident across the window; [100, 10000] is wide enough for
  // the whole 20-year window while still catching a 1000x units error in
  // either direction (units=1 here, not Seattle/King County's 1000).
  perCapitaBand: [100, 10_000],
  datasetIdPrefix: 'bainbridge-sao-gf',
  sourceUrlFor: fy => reportFileUrl(BAINBRIDGE_ARNS[fy]),
  // Bainbridge GF runs in the tens of millions; 500M is ~10x the largest
  // observed year, so it catches a units/column catastrophe without ever
  // tripping on real growth.
  sanityMax: 500_000_000,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nBainbridge Island: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
