/**
 * City of Myrtle Beach, SC — General Fund ACFR load (Knight session 6a).
 *
 * The second SC entity the statewide bulk source cannot produce: RFA folds it
 * into Horry County's combined "Cities only" block alongside Atlantic Beach,
 * Aynor, Briarcliffe Acres, Conway, Loris, North Myrtle Beach and Surfside
 * Beach. So this city comes from its own audited statements.
 *
 * ⚠ FY2018 IS THE CITY'S OWN COPY, NOT THE FAC ONE. FAC stores a scan whose OCR
 * layer fuses four revenue line items into one row and misses the tie by exactly
 * $1 (64,439,897 against a printed 64,439,896) — a "small delta" tolerance would
 * have shipped it with four categories destroyed. The city's copy ties at $0
 * with clean labels. Its CDN 403s a bare curl and serves the file to a request
 * carrying browser `Sec-Fetch-*` headers and a Referer.
 *
 * ⚠ The statement spans two physical pages; the General Fund column is entirely
 * on the first, and rows blank there are genuine zeros whose money sits in the
 * special revenue funds on the second. See scripts/extractMyrtleBeach.py.
 *
 * ⚠ HIGH PER-CAPITA IS CORRECT HERE. FY2024 General Fund revenue is $96.1M for
 * 40,535 residents, about $2,372 a head — roughly double a typical city, because
 * this is a resort economy whose General Fund is carried by tourism ($44.6M of
 * licences and permits against $33.7M of property taxes). The loader's
 * per-capita guard is the only check that can catch a wrong `units`, so it is
 * worth stating why this entity sits high in its band legitimately.
 *
 * Usage:
 *   node scripts/processMyrtleBeach.js --dry-run
 *   node scripts/processMyrtleBeach.js
 */

import { run } from './lib/acfrGfLoad.mjs';
import { MYRTLE_BEACH_LOAD_YEARS, MYRTLE_BEACH_PUBLICATION_PAGE } from './data/scAcfrSources.mjs';

run({
  entityLabel: 'City of Myrtle Beach',
  muniName: 'Myrtle Beach',
  entityType: 'city',
  state: 'SC',
  pdfDir: '_acfr-work/sc/acfr/myrtlebeach',
  // ⚠ Anchored. `mb18.pdf` (the raw first-party download) must not match, and
  // North Myrtle Beach is a DIFFERENT government that also files.
  filePattern: /^myrtlebeach_(\d{4})\.pdf$/i,
  extractScript: 'scripts/extractMyrtleBeach.py',
  datasetIdPrefix: 'myrtle-beach-acfr-gf',
  baseUrl: MYRTLE_BEACH_PUBLICATION_PAGE,
  fys: [...MYRTLE_BEACH_LOAD_YEARS],
  // July 1 - June 30, ACTIVELY confirmed by the FAC census
  // (`SC,Myrtle Beach,municipality,annual,7,,1998-2025`) and by each statement's
  // own "Year Ended June 30" caption.
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedSouthCarolinaCities.mjs',
});
