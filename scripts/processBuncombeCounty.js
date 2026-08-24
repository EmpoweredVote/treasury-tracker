#!/usr/bin/env node
/**
 * Buncombe County, NC — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2008 + FY2011–FY2025, ACTUAL (ACFR GAAP
 * basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2008 and FY2011–FY2025, sixteen years, 32 rows.
 *
 * ⚠ THE FY2009/FY2010 GAP IS AN UPSTREAM ABSENCE, DIAGNOSED. The county's
 * legacy asset host serves `CAFR<yy>.pdf`, and every two-digit year from 05 to
 * 25 was probed: FY2008 and FY2011–FY2019 return 200, and FY2005–FY2007,
 * FY2009, FY2010 and FY2020+ return 404 with a 1,245-byte body. The naming
 * variants `cafr09`, `CAFR2009` and `CAFR_09` were probed too and also 404. The
 * modern `financial-reports/<span>/` scheme starts at FY2020 and the
 * DocumentCenter index starts at FY2015, so neither reaches back over the gap.
 * Those two years are not published anywhere the county exposes.
 *
 * ⚠ A visitor sees FY2008 and then a jump to FY2011 with nothing explaining
 * why — the same accepted-not-fixed gap CO-SPRINGS-EPC-01 recorded for El Paso
 * County FY2006–08. A per-year "published but not machine-readable / not
 * published" note would close it and does not exist yet.
 *
 * READER: `pdftotext -table`, via `scripts/extractBuncombeCounty.py`. This
 * county has no diagnosed `-table` column defect, so it stays on the shared
 * reader; coordinates are applied only as an independent CROSS-CHECK in
 * `scripts/verify-nc.mjs`.
 *
 * ⚠ It DOES need `exclude_ignore=('reconciliation', 'net position')`. FY2011–
 * FY2018 print the government-wide reconciliation at the FOOT OF THE FUND
 * STATEMENT ITSELF, so the genuine primary page carries two words `_EXCLUDE`
 * treats as proof a page is NOT the primary statement. Without the override
 * those eight years report "statement not found" and the county's series has a
 * hole through its middle. Because this WIDENS which pages can qualify, the
 * verifier re-derives every year through the coordinate reader, which finds its
 * own page independently.
 *
 * ⚠ ISSUER: Buncombe County and BUNCOMBE COUNTY SCHOOLS (the Board of
 * Education) each publish an ACFR, both saying "Buncombe County" and "June 30"
 * on the cover. The fetcher's authorship guard is what keeps the school
 * board's report out of this entity; see `scripts/lib/ncAcfrSources.mjs`.
 *
 * Amounts are printed in WHOLE DOLLARS (units=1). FY2025 lands at roughly
 * $1,510/capita spending on a population of 279,210.
 *
 * Usage:
 *   node scripts/processBuncombeCounty.js --dry-run
 *   node scripts/processBuncombeCounty.js --mode operating --fy 2015
 *   node scripts/processBuncombeCounty.js
 */

import { run } from './lib/acfrGfLoad.mjs';

// FY2009 and FY2010 are absent upstream — see the header. Written out rather
// than generated so the gap is visible in the source, not implied by a filter.
const FYS = [2008, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
  2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

await run({
  entityLabel: 'Buncombe County',
  muniName: 'Buncombe County',
  entityType: 'county',
  pdfDir: 'docs/BuncombeCounty',
  filePattern: /^buncombe-county-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractBuncombeCounty.py',
  datasetIdPrefix: 'buncombe-county-acfr-gf',
  baseUrl: 'https://www.buncombenc.gov/224/Finance',
  fys: FYS,
  state: 'NC',
  // July 1 - June 30 (N.C.G.S. 159-8(b)).
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedNorthCarolina.mjs',
  fetchScript: 'scripts/fetchNorthCarolina.mjs',
});
