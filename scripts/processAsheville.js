#!/usr/bin/env node
/**
 * City of Asheville, NC — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2009–FY2025 where readable, ACTUAL (ACFR GAAP
 * basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2009–FY2012, FY2014–FY2018 and FY2021–FY2025 — fourteen years,
 * 28 rows.
 *
 * ⚠ NINE OF THOSE YEARS ARE NOT ON THE CITY'S CURRENT PAGE. It lists only
 * FY2021 onward, which is why this entity first shipped as a five-year series.
 * The earlier Google Drive ids were recovered from WAYBACK SNAPSHOTS OF THE
 * CITY'S OWN PAGE, and the files themselves are STILL LIVE on Drive — the city
 * removed the links, not the documents. The archive was used only to DISCOVER
 * the addresses; every byte is fetched from the city's own Drive at load time
 * and `source_url` records that live first-party URL, never a web.archive.org
 * one.
 *
 * ⚠ FIVE YEARS EXIST AND STILL CANNOT BE LOADED, each diagnosed rather than
 * shrugged at (see ASHEVILLE_EXCLUDED in scripts/lib/ncAcfrSources.mjs):
 *
 *   FY2007  IMAGE-ONLY SCAN — 292 characters of text in 183 pages
 *   FY2008  IMAGE-ONLY SCAN — 172 characters of text in 172 pages
 *   FY2013  HYBRID SCAN — only 18 of 240 pages carry text, and the fund
 *           statements are not among them
 *   FY2019  DELETED FROM DRIVE — HTTP 404
 *   FY2020  DELETED FROM DRIVE — HTTP 404
 *
 * FY2019/FY2020 are a different kind of gap from anything else in this
 * milestone: those documents were published and are now GONE. Every other id
 * from the same snapshots still resolves, so this is deletion by the city, not
 * rot in the archive.
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

// Written out rather than generated so the three gaps are visible in the
// source, not implied by a filter. FY2013 sits INSIDE the run.
const FYS = [2009, 2010, 2011, 2012, 2014, 2015, 2016, 2017, 2018,
  2021, 2022, 2023, 2024, 2025];

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
