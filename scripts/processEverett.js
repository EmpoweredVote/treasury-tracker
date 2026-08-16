#!/usr/bin/env node
/**
 * Loads City of Everett, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0664).
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
 * FISCAL-YEAR WINDOW: 19 years, FY2004-FY2024 less FY2005 and FY2010. Both
 * exclusions carry no usable text layer -- their statement pages return ONLY the
 * SAO page furniture, the same class as Spokane FY2012 and Vancouver FY2004 --
 * and they are NOT consecutive, so the milestone's floor rule is not triggered
 * and no deviation is claimed. All 38 combinations tie at exactly $0 on ONE
 * config, with zero residues.
 *
 * ⚠ AMOUNTS ARE WHOLE DOLLARS (units=1), like Spokane, Vancouver and Kent,
 * unlike Tacoma and Bellevue. The tie gate is unit-invariant, so the roster's
 * per-capita band is the only guard that fires on a wrong multiplier.
 *
 * ⚠ THE BAND IS EVERETT'S OWN, and that matters here more than anywhere else in
 * this milestone: Everett runs $488-$1,399 per resident, so Kent's [220, 2000]
 * -- its nearest neighbour in this cohort by size and by units -- would have
 * REJECTED FY2024 outright. A band is re-derived per entity, never inherited.
 *
 * THE PLAINEST ISSUER OF THE SIX: a flat revenue side with no group heading in
 * any year, zero incomplete rows, zero valueless rows on the revenue side, and
 * exactly one candidate statement page in every readable year. See
 * scripts/extractEverett.py for the probe evidence behind each of those.
 *
 * Usage:
 *   node scripts/processEverett.js --dry-run
 *   node scripts/processEverett.js
 *   node scripts/processEverett.js --fy 2024
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { EVERETT_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');
const E = getEntity('Everett');

if (!E.fiscalYears) throw new Error('Everett has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand) throw new Error('Everett has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift apart.
// Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !EVERETT_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in EVERETT_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // One extractor for the whole 19-year window. The statement shape is identical
  // in FY2004 and FY2024; what varies across this corpus is DOCUMENT quality,
  // not statement structure.
  extractorFor: makeExtractorSelector('extractEverett.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(EVERETT_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nEverett: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
