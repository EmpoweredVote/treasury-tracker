#!/usr/bin/env node
/**
 * City of Austin, TX — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2010–FY2025, ACTUAL (ACFR GAAP basis).
 *
 * Thin driver over `scripts/lib/txAcfrLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2010–FY2025, sixteen years, 32 rows.
 *
 * Austin publishes 28 reports (FY1998–FY2025) and all 28 are downloaded by
 * `fetchAustinTravis.mjs`. Twelve are deliberately NOT loaded, in two distinct
 * eras, each excluded for a proven reason rather than a guess:
 *
 *   FY2002–FY2009 (8 years) — the statement is a FOUR-COLUMN COMPARATIVE
 *     layout (General Fund | Nonmajor | Total | prior-year Total), and
 *     `pdftotext -table` renders the General Fund column at TWO DIFFERENT
 *     character positions: rows carrying the `$` sign (Property taxes, Sales
 *     taxes) align at one offset and every other row at another, ~24 columns
 *     right. The shared module's positional anchoring takes its columns from
 *     the fully-populated `Total revenues` row, so the second group is
 *     assigned to the Nonmajor column and seven of nine revenue sources read
 *     as $0. FY2009 fails by $122,669 thousand — LOUDLY, which is the point.
 *     `-layout` does not rescue it: it shears values off their own labels.
 *     Recovering this era needs coordinate-based column isolation
 *     (pdfplumber), which is a separate extractor, not a config change.
 *
 *   FY1998–FY2001 (4 years) — pre-GASB-34 combined statements, and printed in
 *     WHOLE DOLLARS rather than thousands. Revenue extraction ties at exactly
 *     $0 for all four years while being 1000x wrong ($261 BILLION for FY1998),
 *     which is precisely the units trap `CityConfig.units` documents: the tie
 *     gate compares a sum against a printed total read through the same
 *     multiplier and cannot see the error. The loader's per-capita guard
 *     rejects them; they are excluded at the config level so the guard never
 *     has to. Operating fails outright on this era's different expenditure
 *     nesting ("Nondepartmental expenditures", and FY2001's "General Fund
 *     Expenditure by Function" schedule).
 *
 * Amounts are printed "(In thousands)" and scaled by the extractor
 * (units=1000) — see `scripts/extractAustin.py` for why that scaling cannot be
 * validated by the tie gate and is checked per-capita here instead.
 *
 * Usage:
 *   node scripts/processAustin.js --dry-run
 *   node scripts/processAustin.js --mode revenue --fy 2024
 *   node scripts/processAustin.js
 */

import { run } from './lib/txAcfrLoad.mjs';

const FYS = Array.from({ length: 16 }, (_, i) => 2010 + i); // 2010..2025

await run({
  entityLabel: 'City of Austin',
  muniName: 'Austin',
  entityType: 'city',
  pdfDir: 'docs/Austin',
  filePattern: /^austin-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractAustin.py',
  datasetIdPrefix: 'austin-acfr-gf',
  baseUrl: 'https://www.austintexas.gov/page/financial-reports',
  fys: FYS,
});
