#!/usr/bin/env node
/**
 * Loads Kitsap County, WA General Fund rows (operating + revenue) from the WA
 * State Auditor's bound financial statements (MCAG 0132).
 *
 * Thin driver over scripts/lib/waSaoLoad.mjs -- every guard (FY-vs-filename
 * cross-check, $0 tie gate, mapped-total == computed_total, sanity ceiling,
 * per-capita band, source_url validation, ephemeral data_sources lifecycle)
 * lives in that shared core. This file is descriptor + argv only.
 *
 * FISCAL-YEAR WINDOW (18 years, deliberately not `Object.keys(KITSAP_ARNS)`)
 * ---------------------------------------------------------------------------
 * FY2004-FY2016 and FY2020-FY2024. Excluded:
 *   * FY2017, FY2018, FY2019 -- SOURCE-DOCUMENT font defect. pdftotext (any
 *     flag) decodes the basic-financial-statements section of these three
 *     PDFs through a constant +29 byte shift; the statement pages carry
 *     labels but no usable digits. Not a parser bug, and not recoverable
 *     from a per-city CONFIG. Their ARNs remain in KITSAP_ARNS (the files
 *     were fetched and classified) but they are never loaded.
 *   * FY2025 -- not yet audited; no filing exists.
 * KITSAP_ARNS is therefore a SUPERSET of this list, which is fine: the ARN
 * lookup only ever needs to answer for years actually loaded. The assertion
 * below proves it answers for every one of them, because requireSourceUrl()
 * in waSaoLoad.mjs HARD THROWS on a falsy URL rather than falling back to a
 * generic SAO origin.
 *
 * Usage:
 *   node scripts/processKitsap.js --dry-run
 *   node scripts/processKitsap.js
 *   node scripts/processKitsap.js --fy 2024
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { KITSAP_ARNS } from './fetchBainbridgeKitsap.mjs';
import { reportFileUrl } from './lib/waSao.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');

const FISCAL_YEARS = [
  2004, 2005, 2006, 2007, 2008, 2009,
  2010, 2011, 2012, 2013, 2014, 2015, 2016,
  2020, 2021, 2022, 2023, 2024,
];

const missingArns = FISCAL_YEARS.filter(fy => !KITSAP_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in KITSAP_ARNS for FY ${missingArns.join(', ')} -- ` +
    `FISCAL_YEARS and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: 'Kitsap County',
  // One extractor for the whole window -- no era overrides, unlike Bainbridge.
  extractorFor: makeExtractorSelector('extractKitsap.py'),
  pdfDir: 'docs/KitsapCounty',
  pdfPrefix: 'kitsap',
  fiscalYears: FISCAL_YEARS,
  // WA OFM April 1, 2025 official estimate -- the same figure seeded by
  // scripts/seedBainbridgeKitsap.mjs (Filter=1 county row, line 183).
  population: 288_900,
  // Seattle's [500, 25000] would REJECT a CORRECT Kitsap load: Kitsap GF runs
  // ~$444/resident, because most county services run through enterprise and
  // special-revenue funds outside the General Fund. [100, 10000] passes every
  // real year while still catching a 1000x units error (units=1 here).
  perCapitaBand: [100, 10_000],
  datasetIdPrefix: 'kitsap-sao-gf',
  sourceUrlFor: fy => reportFileUrl(KITSAP_ARNS[fy]),
  // Kitsap GF runs in the low hundreds of millions; 2B is ~10x the largest
  // observed year.
  sanityMax: 2_000_000_000,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nKitsap County: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
