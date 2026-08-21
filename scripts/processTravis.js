#!/usr/bin/env node
/**
 * Travis County, TX — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2004–FY2025, ACTUAL (ACFR GAAP basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2004–FY2025, twenty-two years, 44 rows — the entire published
 * corpus, with no exclusions. Every year ties at exactly $0 in both modes.
 * FY2003 and earlier are not published on the county's transparency portal
 * (both `fy2003-acfr.pdf` and `fy2003-cafr.pdf` return HTTP 404); that is an
 * upstream absence, not an extraction failure.
 *
 * Amounts are printed in WHOLE DOLLARS (units=1) — unlike the City of Austin
 * inside this same county, which prints in thousands. The two entities loaded
 * in this milestone deliberately differ on that, and the tie gate cannot tell
 * them apart, so the loader's per-capita guard is what holds the difference in
 * place.
 *
 * Note the honest structural absence in the early years: FY2004–FY2011 emit no
 * `Debt service` category because the county's General Fund reported no
 * general-fund debt service in those years. The shared extractor drops
 * childless parents rather than publishing an empty node.
 *
 * Usage:
 *   node scripts/processTravis.js --dry-run
 *   node scripts/processTravis.js --mode operating --fy 2025
 *   node scripts/processTravis.js
 */

import { run } from './lib/acfrGfLoad.mjs';

const FYS = Array.from({ length: 22 }, (_, i) => 2004 + i); // 2004..2025

await run({
  entityLabel: 'Travis County',
  muniName: 'Travis County',
  entityType: 'county',
  pdfDir: 'docs/TravisCounty',
  filePattern: /^travis-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractTravis.py',
  datasetIdPrefix: 'travis-acfr-gf',
  baseUrl: 'https://tctransparency.traviscountytx.gov/FinancialDocuments',
  fys: FYS,
  state: 'TX',
  // October 1 - September 30. Stated here rather than defaulted in the shared
  // lib, which now also serves two calendar-year Colorado entities.
  fyEndMonthDay: '09-30',
  fiscalYearStartMonth: 10,
  seedScript: 'scripts/seedAustinTravis.mjs',
  fetchScript: 'scripts/fetchAustinTravis.mjs',
});
