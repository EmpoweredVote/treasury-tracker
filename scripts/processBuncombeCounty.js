#!/usr/bin/env node
/**
 * Buncombe County, NC — General Fund operating (expenditure-by-function) +
 * revenue (revenue-by-source), FY2008–FY2025, ACTUAL (ACFR GAAP
 * basis).
 *
 * Thin driver over `scripts/lib/acfrGfLoad.mjs`, which carries the write path
 * and the five guards (tie gate, fiscal-year assertion, per-capita units
 * guard, sanity ceiling, idempotence).
 *
 * FY WINDOW: FY2008–FY2025, eighteen years, 36 rows — UNBROKEN.
 *
 * ⚠ THIS SERIES HAD A TWO-YEAR HOLE, AND THE HOLE WAS A NAMING GAP, NOT AN
 * ABSENCE. FY2009 and FY2010 were first recorded as "not published anywhere the
 * county exposes", on the evidence that every two-digit year was probed against
 * the flat `cafr/CAFR<yy>.pdf` scheme and both 404. That was true of the SCHEME.
 * Asking the archive what the county used to publish turned up a FOURTH naming
 * convention — a per-year subdirectory with a different filename in each one:
 *
 *     FY2007  cafr07/CAFR2007.pdf   (4-digit year)
 *     FY2009  cafr09/cafr.pdf       (no year at all)
 *     FY2010  cafr10/CAFR10.pdf     (2-digit year)
 *
 * All of them are LIVE on the county's own host. The archive was used only to
 * learn the convention existed; every byte is fetched first-party.
 *
 * ⚠ FY2007 IS RETRIEVABLE AND STILL EXCLUDED — see BUNCOMBE_EXCLUDED in
 * scripts/lib/ncAcfrSources.mjs. Its largest revenue line, `Ad valorem taxes`
 * at $139,141,442, produces NO TOKEN in either reader, and its font has a
 * broken ToUnicode CMap. The figure is arithmetically forced by the printed
 * total (246,360,973 - 107,219,531), and it is still not loaded: recovering a
 * line item by subtracting the rest from the total is DERIVING a figure, not
 * reading one, and it would tie at $0 by construction so the tie gate would
 * confirm nothing.
 *
 * FY2005 and FY2006 were never published — the archive's full index of
 * `common/finance/cafr/*` contains exactly four subdirectories.
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

// FY2008-FY2025, unbroken. FY2007 is retrievable but unreadable and FY2005/06
// were never published — see the header and BUNCOMBE_EXCLUDED.
const FYS = Array.from({ length: 18 }, (_, i) => 2008 + i); // 2008..2025

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
