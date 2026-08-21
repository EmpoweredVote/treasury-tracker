#!/usr/bin/env node
/**
 * El Paso County, CO — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2005 + FY2009–FY2025, ACTUAL (ACFR GAAP
 * basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units guard,
 * sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2005 and FY2009–FY2025, eighteen years, 36 rows. Every year ties
 * at exactly $0 in both modes.
 *
 * ── THIS ENTITY USES THE COORDINATE EXTRACTOR, NOT acfrGF.py ────────────────
 * `extractScript` is `scripts/extractElPasoCountyCoords.py` (pdfplumber glyph
 * coordinates), because BOTH of acfrGF's column strategies fail on this corpus
 * for two separately identified reasons — each confirmed by arithmetic that
 * lands on the dollar:
 *
 *   positional  `-table` renders the General Fund column at TWO character
 *               offsets; FY2020's four dropped rows sum to exactly its
 *               7,761,496 tie delta.
 *   ordinal     the county prints its TABOR refund INSIDE the revenue label
 *               ("Sales taxes net of $4,477,783 TABOR limitation"), so the
 *               first column slot IS that figure; FY2024's delta is exactly
 *               122,194,544 − 4,477,783 = 117,716,761.
 *
 * Selecting per-year whichever strategy happened to tie $0 would have been
 * curve-fitting. Instead the coordinate reader is used throughout, and
 * `verify-colorado.mjs` cross-checks it against acfrGF on every year where
 * acfrGF ties — 30 of these 36 rows — plus `acfrPrintedTotal.py` on all of
 * them. `scripts/extractElPasoCounty.py` (the acfrGF wrapper) is retained
 * precisely to BE that cross-check, and is not what loads.
 *
 * The county publishes 26 reports (FY2000–FY2025), all downloaded by
 * `fetchColorado.mjs`. EIGHT are not loaded, in two eras with two diagnosed
 * causes:
 *
 *   FY2000–FY2004 (5 years) — IMAGE-ONLY SCANS. `pdftotext` returns zero
 *     characters for all five; there is no text layer. Needs OCR.
 *
 *   FY2006–FY2008 (3 years) — A DIFFERENT STATEMENT. These years title it
 *     "Statement of Revenues and Changes in Fund Balances" (no "Expenditures"),
 *     and split the fund columns HORIZONTALLY ACROSS TWO PAGES: General / Road
 *     and Bridge / Human Services on one page, Capital Projects / Other /
 *     Total on the next. The page also letter-spaces its own column headers
 *     ("S e r v ic e s"). The page-qualifying rule and the single-page column
 *     model are both wrong for that era — a separate build, not a config change.
 *     FY2005 is a third shape again, and it reads cleanly.
 *
 * Amounts are printed in WHOLE DOLLARS (units=1). FY2024 General Fund revenue
 * is ~$409/capita, which is what the per-capita guard checks — the tie gate
 * cannot see a 1000x error.
 *
 * Usage:
 *   node scripts/processElPasoCounty.js --dry-run
 *   node scripts/processElPasoCounty.js --mode operating --fy 2020
 *   node scripts/processElPasoCounty.js
 */

import { run } from './lib/acfrGfLoad.mjs';

// FY2005, then FY2009-FY2025. The gap is FY2006-FY2008 (different statement)
// and the pre-FY2005 scans; see the header for both diagnoses.
const FYS = [2005, ...Array.from({ length: 17 }, (_, i) => 2009 + i)];

await run({
  entityLabel: 'El Paso County',
  muniName: 'El Paso County',
  entityType: 'county',
  state: 'CO',
  pdfDir: 'docs/ElPasoCounty',
  filePattern: /^el-paso-county-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractElPasoCountyCoords.py',
  datasetIdPrefix: 'el-paso-county-acfr-gf',
  baseUrl: 'https://admin.elpasoco.com/financial-services/budget-finance/annual-comprehensive-financial-reports/',
  fys: FYS,
  // CALENDAR fiscal year — January 1 to December 31.
  fyEndMonthDay: '12-31',
  fiscalYearStartMonth: 1,
  seedScript: 'scripts/seedColorado.mjs',
  fetchScript: 'scripts/fetchColorado.mjs',
});
