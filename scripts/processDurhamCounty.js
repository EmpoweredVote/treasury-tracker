#!/usr/bin/env node
/**
 * Durham County, NC — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2005–FY2025, ACTUAL (ACFR GAAP basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2005–FY2025, twenty-one years, 42 rows — the entire published
 * corpus, with no exclusions. This is the deepest series in the milestone.
 *
 * ⚠ READER: COORDINATES, via `scripts/extractDurhamCountyCoords.py`, for the
 * WHOLE ENTITY. `pdftotext -table` renders this county's General Fund column at
 * two different character positions in FY2006–FY2011, dropping four to six rows
 * per year; FY2008's four dropped rows sum to 8,630,391, which is exactly the
 * tie delta `-table` reports for it. Loading the fifteen readable years through
 * `-table` and only the six broken ones through coordinates would be
 * CURVE-FITTING — picking per year whichever strategy happened to tie, the
 * error that got the LA-01 scope verdict retracted. `-table` is kept as an
 * INDEPENDENT CROSS-CHECK on the fifteen years it can still read, and
 * `scripts/verify-nc.mjs` requires the two readers to agree to the dollar and
 * names the six rows that rest on one reader alone.
 *
 * Nesting is read from the printed glyph indentation rather than declared, so
 * this entity needs no `parents` / `root_leaves` config at all. That matters
 * because a tie proves arithmetic and never structure.
 *
 * Amounts are printed in WHOLE DOLLARS (units=1). FY2025 lands at roughly
 * $1,672/capita spending on a population of 343,628.
 *
 * Usage:
 *   node scripts/processDurhamCounty.js --dry-run
 *   node scripts/processDurhamCounty.js --mode revenue --fy 2008
 *   node scripts/processDurhamCounty.js
 */

import { run } from './lib/acfrGfLoad.mjs';

const FYS = Array.from({ length: 21 }, (_, i) => 2005 + i); // 2005..2025

await run({
  entityLabel: 'Durham County',
  muniName: 'Durham County',
  entityType: 'county',
  pdfDir: 'docs/DurhamCounty',
  filePattern: /^durham-county-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractDurhamCountyCoords.py',
  datasetIdPrefix: 'durham-county-acfr-gf',
  baseUrl: 'https://dconc.gov/Finance/Financial-Reports',
  fys: FYS,
  state: 'NC',
  // July 1 - June 30 (N.C.G.S. 159-8(b)).
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedNorthCarolina.mjs',
  fetchScript: 'scripts/fetchNorthCarolina.mjs',
});
