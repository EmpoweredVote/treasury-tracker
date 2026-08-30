/**
 * City of Columbia, SC — General Fund ACFR load (Knight session 6a).
 *
 * South Carolina's FIRST city in TT, and one of only two SC entities the
 * statewide bulk source cannot produce: RFA's Local Government Finance Report
 * publishes each county's municipalities only as a COMBINED "Cities only" block
 * ("*Cities Include: Arcadia Lakes, Blythewood, Columbia, Eastover, and Forest
 * Acres"). So this city comes from its own audited statements.
 *
 * ⚠ FY2019 IS DELIBERATELY ABSENT. Both available copies are scans and the only
 * text layer is defective OCR (`20 ,775,337`, `Slate government`). Reported as a
 * gap, never written as $0. See scripts/data/scAcfrSources.mjs.
 *
 * ⚠ Documents were retrieved through the Federal Audit Clearinghouse, which
 * serves the complete audited package with no key and no WAF at a permanent
 * report id. `baseUrl` still cites the city's own publication page, which is
 * where a reader goes; the per-year report ids are recorded in scAcfrSources.mjs
 * so any figure can be reproduced byte-for-byte.
 *
 * ⚠ `-layout` MISREADS THIS ISSUER AND TIES AT $0 WHILE DOING SO. The pairing
 * was settled against pdfplumber glyph coordinates, not against the tie — see
 * scripts/extractColumbiaSC.py.
 *
 * Usage:
 *   node scripts/processColumbiaSC.js --dry-run
 *   node scripts/processColumbiaSC.js
 */

import { run } from './lib/acfrGfLoad.mjs';
import { COLUMBIA_LOAD_YEARS, COLUMBIA_PUBLICATION_PAGE } from './data/scAcfrSources.mjs';

run({
  entityLabel: 'City of Columbia',
  muniName: 'Columbia',
  entityType: 'city',
  state: 'SC',
  pdfDir: '_acfr-work/sc/acfr/columbia',
  // ⚠ Anchored at both ends. `columbia_2019_firstparty.pdf` sits in the same
  // directory and must NOT match; nor may any myrtlebeach_* file.
  filePattern: /^columbia_(\d{4})\.pdf$/i,
  extractScript: 'scripts/extractColumbiaSC.py',
  datasetIdPrefix: 'columbia-sc-acfr-gf',
  baseUrl: COLUMBIA_PUBLICATION_PAGE,
  fys: [...COLUMBIA_LOAD_YEARS],
  // July 1 - June 30. ACTIVELY confirmed by the FAC census
  // (`SC,Columbia,municipality,annual,7,,1998-2001 2003-2025`) and by every
  // statement page's own caption, "Year Ended June 30".
  // ⚠ The publisher of the bulk source warns SC city years are NOT uniform
  // ("Fiscal Year ended on or before June 30"), so this is evidence, not a
  // default. ⚠ The census also holds Columbia MO at month 10 — join on state.
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedSouthCarolinaCities.mjs',
});
