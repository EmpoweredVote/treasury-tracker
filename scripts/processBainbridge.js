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
 * FISCAL-YEAR WINDOW (18 years, deliberately not `Object.keys(BAINBRIDGE_ARNS)`)
 * ------------------------------------------------------------------------------
 * FY2004, 2005, 2007, 2008 and FY2012-FY2025. FOUR fiscal years in the
 * FY2004-FY2025 span cannot be loaded, all four for source-document reasons
 * and none for a parser reason:
 *   * FY2006 -- the only filing (ARN 73415) is an image-only scan. No ARN in
 *     BAINBRIDGE_ARNS.
 *   * FY2009 -- statement pages are digit-bearing but ciphered (broken
 *     embedded font, no usable ToUnicode CMap); Task 6's bounded
 *     contiguous-offset decode found no substitution map that tied. No ARN in
 *     BAINBRIDGE_ARNS.
 *   * FY2010 (ARN 1006518) -- FOUND IN TASK 8. The governmental-funds
 *     statement is PDF page 28 and its text layer is rendered through a broken
 *     embedded font with a constant +29 byte shift ("&,7<2)%$,1%5,'*(,6/$1'"
 *     decodes to "CITY OF BAINBRIDGE ISLAND"). The LABELS decode; the MONEY
 *     DOES NOT -- a byte scan of the page finds zero control or high
 *     characters, so the digits are absent from the stream entirely rather
 *     than mis-mapped. Same defect class as Kitsap FY2017-2019. plain /
 *     -table / -layout / -raw all behave identically. The only readable GF
 *     detail in that filing is the budget-basis Budgetary Comparison Schedule
 *     -- General Fund on page 68 (Streets follows at page 69), which must NOT
 *     be published under a GAAP label.
 *     (Task 8 review, closed: this bullet originally miscited PDF page 57 and
 *     page 128 -- page 57 is a clean-text Revenue Obligation Debt note and the
 *     filing has only 72 pages total. Verified directly against the PDF; the
 *     substance of the finding is unchanged.)
 *   * FY2011 (ARN 1008424) -- FOUND IN TASK 8. The two governmental-funds
 *     statement pages (25-26) carry ONLY the SAO page footer in their text
 *     layer; `pdfimages -list` shows the statement bodies are CCITT stencil
 *     SCANS. Same class as FY2006. No pdftotext flag recovers image content.
 * FY2010 and FY2011 keep their ARNs in BAINBRIDGE_ARNS (the files were fetched
 * and passed the fetch-time content guard, which cannot see a per-page font
 * defect) but are excluded here. That is fine: the ARN manifest only has to
 * answer for years actually loaded, and the assertion below proves it does --
 * important because requireSourceUrl() in waSaoLoad.mjs HARD THROWS on a falsy
 * URL (the generic SAO fallback was deliberately removed), so an FY listed here
 * without an ARN would abort the run rather than publish an unsourced row.
 *
 * TWO EXTRACTORS, NOT ONE
 * ------------------------
 * FY2004/2005/2007/2008 print a genuinely different expenditure tree (no
 * `Current` parent; `Debt service:` is itself a parent) and need
 * extractBainbridgeEarly.py. FY2012+ uses extractBainbridge.py. CityConfig is
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
  2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
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
  // the whole 18-year window while still catching a 1000x units error in
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
