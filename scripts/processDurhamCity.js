#!/usr/bin/env node
/**
 * City of Durham, NC — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2009–FY2024, ACTUAL (ACFR GAAP basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2009–FY2024, sixteen years, 32 rows — the entire published
 * corpus, with no exclusions. Every year ties at exactly $0 in both modes
 * through the `-table` reader.
 *
 * FY2025 is an UPSTREAM ABSENCE, not an extraction failure: as of 2026-08-24
 * the city has published its FY2025 *Citizens* Financial Report but not its
 * FY2025 ACFR. ⚠ Those two documents sit adjacent on the same index page and
 * the citizens report is the shorter, glossier one — see
 * `scripts/lib/ncAcfrSources.mjs` for why this milestone never filters on
 * filenames.
 *
 * ⚠ AN HONEST STRUCTURAL ABSENCE, CHECKED RATHER THAN ASSUMED. FY2016–FY2021
 * publish only ONE expenditure category (`Current`) where the surrounding years
 * publish two. The city's General Fund prints a DASH for both `Principal` and
 * `Interest and other charges` in those years — its debt service sat in a
 * separate Debt Service Fund — and the six `Current` children sum exactly to
 * the printed `Total expenditures`, so no money is missing. Confirmed by BOTH
 * readers independently (`-table` reports them in `zero_rows`; the coordinate
 * reader reports `cell: "dash"`), because "a category vanished for six years
 * and the tie still passed" is precisely the shape a mis-parse takes. The
 * shared extractor drops a childless parent rather than publishing an empty
 * node, which is why the count changes rather than a $0 category appearing.
 *
 * READER: `pdftotext -table`, via `scripts/extractDurhamCity.py`. This city has
 * no diagnosed `-table` defect, so it stays on the shared reader; the
 * coordinate reader is applied only as an independent CROSS-CHECK in
 * `scripts/verify-nc.mjs`, never as a substitute chosen per year.
 *
 * Amounts are printed in WHOLE DOLLARS (units=1), as they are for all four NC
 * entities in this milestone. The tie gate structurally cannot confirm that —
 * it compares a sum against a printed total read through the same multiplier —
 * so the loader's per-capita guard is what holds it in place. FY2024 lands at
 * roughly $857/capita spending on a population of 301,870; a 1000x slip would
 * land near $857k/capita and be rejected.
 *
 * Usage:
 *   node scripts/processDurhamCity.js --dry-run
 *   node scripts/processDurhamCity.js --mode operating --fy 2024
 *   node scripts/processDurhamCity.js
 */

import { run } from './lib/acfrGfLoad.mjs';

const FYS = Array.from({ length: 16 }, (_, i) => 2009 + i); // 2009..2024

await run({
  entityLabel: 'City of Durham',
  muniName: 'Durham',
  entityType: 'city',
  pdfDir: 'docs/DurhamCity',
  filePattern: /^durham-city-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractDurhamCity.py',
  datasetIdPrefix: 'durham-city-acfr-gf',
  baseUrl: 'https://www.durhamnc.gov/4232/Previous-City-of-Durham-Financial-Report',
  fys: FYS,
  state: 'NC',
  // July 1 - June 30, the statutory fiscal year for every North Carolina local
  // unit (N.C.G.S. 159-8(b)). Stated here rather than defaulted in the shared
  // lib, which also serves Oct-Sep Texas and calendar-year Colorado entities.
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedNorthCarolina.mjs',
  fetchScript: 'scripts/fetchNorthCarolina.mjs',
});
