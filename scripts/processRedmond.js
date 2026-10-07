#!/usr/bin/env node
/**
 * Loads City of Redmond, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0425).
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
 * FISCAL-YEAR WINDOW: 11 years, FY2011-FY2024 less FY2017-FY2019. All 22
 * combinations tie at exactly $0 on ONE config, with zero residues.
 *
 * ⚠⚠ THE WINDOW IS NARROWER THAN THE READABLE CORPUS, DELIBERATELY. FY2006-
 * FY2010 parse fine and are excluded by the floor rule's era-split clause --
 * the statement stops splitting across two pages at FY2011, and FY2006
 * captions itself differently again. See the spec §2.1.1 and the extractor's
 * docstring. THE ROSTER IS THE ONLY AUTHORITY ON THE WINDOW; this driver takes
 * `fiscalYears` from it and must never discover years from disk, because the
 * five policy-excluded PDFs sit in the same directory as the eleven loaded
 * ones and would extract and tie perfectly if asked.
 *
 * ⚠ FY2017-FY2019 are excluded for a different reason: a +29 cipher whose
 * money digits are absent from the stream. A ciphered page is NOT an empty
 * page -- it yields spurious small numbers, including negatives -- so nothing
 * downstream can infer those years are unloadable. Keeping them out is this
 * roster window's job and the audit's zero-rows assertion is what proves it.
 *
 * ⚠ AMOUNTS ARE WHOLE DOLLARS (units=1), like Spokane, Vancouver, Kent and
 * Everett, unlike Tacoma and Bellevue. The tie gate is unit-invariant, so the
 * roster's per-capita band is the only guard that fires on a wrong multiplier.
 *
 * ⚠ THE BAND IS REDMOND'S OWN. Bellevue [400, 4500] and Kent [220, 2000] are
 * its King County neighbours and neither is usable here -- a band is
 * re-derived per entity from its observed spread, never inherited.
 *
 * Usage:
 *   node scripts/processRedmond.js --dry-run
 *   node scripts/processRedmond.js
 *   node scripts/processRedmond.js --fy 2024
 */
import { loadEntity, makeExtractorSelector, parseTargetFY } from './lib/waSaoLoad.mjs';
import { REDMOND_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const E = getEntity('Redmond');

// ⚠ `!E.fiscalYears` is NOT enough: `[]` is truthy. An empty window would sail
// past a presence check, load nothing, fail nothing, print "0 loaded, 0 failed"
// and exit 0 — a silent no-op reported as success.
if (!E.fiscalYears?.length) throw new Error('Redmond has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand?.length) throw new Error('Redmond has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift apart.
// Without this the same mistake surfaces deep inside loadEntity as a
// requireSourceUrl throw, after the run has already started writing.
const missingArns = E.fiscalYears.filter((fy) => !REDMOND_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in REDMOND_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

// ⚠ The converse drift is the dangerous one here, and it is NOT symmetric with
// the check above. An ARN pinned for a year the roster does not load would
// quietly make a policy-excluded year loadable the moment anyone widened
// `fiscalYears` -- and five of Redmond's exclusions are perfectly readable.
const strayArns = Object.keys(REDMOND_ARNS).map(Number)
  .filter((fy) => !E.fiscalYears.includes(fy));
if (strayArns.length) {
  throw new Error(`REDMOND_ARNS pins FY ${strayArns.join(', ')}, which the roster does not load — ` +
    `every pinned ARN must correspond to a loaded year.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // ONE extractor for the whole 11-year window. The statement shape is
  // identical in FY2011 and FY2024; the two-page era below FY2011 is outside
  // the window precisely so that no second config is needed.
  extractorFor: makeExtractorSelector('extractRedmond.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(REDMOND_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  // Throws on --fy=, a bare --fy, a non-numeric year or 0 — every one of which
  // used to degrade silently into a full delete-and-republish of all 11 years.
  targetFY: parseTargetFY(argv),
});

console.log(`\nRedmond: ${loaded} loaded, ${failed} failed.`);
// ⚠ The non-zero branch cannot actually be reached: loadEntity THROWS when a
// year fails unless `allowPartial` is set, and this descriptor never sets it.
// Kept as a belt in case that ever changes — but do not read it as evidence
// that a partial load is tolerated here. It is not.
process.exit(failed ? 1 : 0);
