#!/usr/bin/env node
/**
 * City of Colorado Springs, CO — General Fund operating (expenditure-by-
 * function) + revenue (revenue-by-source), FY2012–FY2025, ACTUAL (ACFR GAAP
 * basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units guard,
 * sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2012–FY2025, fourteen years, 28 rows. Every year ties at
 * exactly $0 in both modes, and every figure is confirmed against an
 * independent coordinate reader by `scripts/verify-colorado.mjs`.
 *
 * The city publishes 27 reports (FY1999–FY2025) and all 27 are downloaded by
 * `fetchColorado.mjs`. THIRTEEN are not loaded, for one proven reason:
 *
 *   FY1999–FY2011 — IMAGE-ONLY SCANS. `pdftotext` returns ZERO characters for
 *     FY1999–FY2008 across the entire document, 9,213 for FY2009 and 4,683 for
 *     FY2010 (on 243- and 251-page reports). FY2011 has a partial text layer
 *     (185,590 characters) but no page that qualifies as the governmental-funds
 *     statement — its financial-statement pages are among the scanned ones.
 *
 *     There is no text layer to parse, so this is an upstream publishing fact
 *     rather than an extraction failure, and no config value reaches it.
 *     Recovering the era needs OCR, which is a decision about introducing a
 *     transcription step into a provenance chain that is currently byte-exact —
 *     deliberately out of scope here rather than quietly attempted.
 *
 * Amounts are printed in WHOLE DOLLARS (units=1) — like El Paso County, and
 * unlike Austin (thousands). The tie gate cannot see a units error, so the
 * per-capita guard is what holds it: FY2024 revenue is ~$752/capita.
 *
 * Note the statement this reads is Exhibit 4 (GOVERNMENTAL FUNDS, GAAP), NOT
 * Exhibit 6 (GENERAL FUND — BUDGET AND ACTUAL, budgetary basis, four pages).
 * See `scripts/extractColoradoSprings.py` for how the decoy is excluded.
 *
 * Usage:
 *   node scripts/processColoradoSprings.js --dry-run
 *   node scripts/processColoradoSprings.js --mode revenue --fy 2024
 *   node scripts/processColoradoSprings.js
 */

import { run } from './lib/acfrGfLoad.mjs';

const FYS = Array.from({ length: 14 }, (_, i) => 2012 + i); // 2012..2025

await run({
  entityLabel: 'City of Colorado Springs',
  muniName: 'Colorado Springs',
  entityType: 'city',
  state: 'CO',
  pdfDir: 'docs/ColoradoSprings',
  filePattern: /^colorado-springs-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractColoradoSprings.py',
  datasetIdPrefix: 'colorado-springs-acfr-gf',
  baseUrl: 'https://coloradosprings.gov/accounting/page/annual-comprehensive-financial-report-acfr',
  fys: FYS,
  // CALENDAR fiscal year — January 1 to December 31. Both Colorado entities
  // close on December 31, unlike the Oct-Sep Texas pair that shares this lib.
  fyEndMonthDay: '12-31',
  fiscalYearStartMonth: 1,
  seedScript: 'scripts/seedColorado.mjs',
  fetchScript: 'scripts/fetchColorado.mjs',
});
