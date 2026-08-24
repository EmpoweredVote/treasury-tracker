#!/usr/bin/env node
/**
 * City of Asheville, NC — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2021–FY2025, ACTUAL (ACFR GAAP basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2021–FY2025, five years, 10 rows — the entire published corpus.
 * This is deliberately the SHORTEST series in the milestone: the city hosts
 * nothing earlier than FY2021 on its ACFR page, and chasing older reports
 * through the legacy site or the Wayback Machine was scoped OUT of
 * NC-DURHAM-AVL-01 rather than attempted and quietly abandoned. Asheville will
 * therefore show a five-year chart next to Durham County's twenty-one.
 *
 * ⚠ READER: COORDINATES, via `scripts/extractAshevilleCoords.py`, for the WHOLE
 * ENTITY. The FY2021 and FY2022 PDFs set character spacing such that
 * `pdftotext -table` splits every word on the statement page ("A d valo rem
 * taxes", "T o t a l e xpe ndit ure s"), so neither the labels nor the printed
 * totals that QUALIFY the page can be matched. Loading FY2023–FY2025 through
 * `-table` and only the two broken years through coordinates would be
 * CURVE-FITTING; `-table` is kept as an INDEPENDENT CROSS-CHECK on the three
 * years it can read, and `scripts/verify-nc.mjs` requires agreement.
 *
 * ⚠ FY2021 is published TWICE on the city's page — once as the ACFR and once
 * as the Uniform Guidance "Compliance Audit", which names the same fiscal year
 * and would pass a naive year check. Only the ACFR is in the manifest; see
 * `ASHEVILLE_REJECTED_IDS` in `scripts/lib/ncAcfrSources.mjs`.
 *
 * Amounts are printed in WHOLE DOLLARS (units=1). FY2025 lands at roughly
 * $1,680/capita spending on a population of 94,992.
 *
 * Usage:
 *   node scripts/processAsheville.js --dry-run
 *   node scripts/processAsheville.js --mode revenue --fy 2022
 *   node scripts/processAsheville.js
 */

import { run } from './lib/acfrGfLoad.mjs';

const FYS = [2021, 2022, 2023, 2024, 2025];

await run({
  entityLabel: 'City of Asheville',
  muniName: 'Asheville',
  entityType: 'city',
  pdfDir: 'docs/Asheville',
  filePattern: /^asheville-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractAshevilleCoords.py',
  datasetIdPrefix: 'asheville-acfr-gf',
  baseUrl: 'https://www.ashevillenc.gov/department/finance/comprehensive-annual-financial-reports/',
  fys: FYS,
  state: 'NC',
  // July 1 - June 30 (N.C.G.S. 159-8(b)).
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedNorthCarolina.mjs',
  fetchScript: 'scripts/fetchNorthCarolina.mjs',
});
