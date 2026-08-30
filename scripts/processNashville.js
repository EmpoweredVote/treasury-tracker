/**
 * Metro Nashville — General Fund ACFR load (Knight session 6b).
 *
 * TENNESSEE'S FIRST LOCAL ENTITY IN TT. One consolidated government, typed
 * `city` with `county_id` NULL (spec §4.5).
 *
 * ⚠⚠ THE STATEWIDE BULK SOURCE CANNOT SERVE THIS ENTITY. The TN Comptroller's
 * TAG export is fund/account/object-level for all 95 counties FY2007-2025, from
 * the division that audits 91 of them — and Davidson is one of the four audited
 * by a CPA firm instead, present at TOTAL ONLY (one revenue and one expenditure
 * row per year). Its FY2025 also splits the school department out of the primary
 * government, so that single series would render a fake $1.4B collapse. See
 * scripts/extractNashville.py.
 *
 * ⚠ Bytes come from nashville.gov FIRST-PARTY — Metro serves its own PDFs with
 * no WAF, so unlike session 6a's South Carolina cities the Federal Audit
 * Clearinghouse is not needed here. FAC report ids are still recorded in
 * scripts/data/tnKnightEntities.mjs as a second route and as the independent
 * fiscal-period evidence.
 *
 * ⚠ Every positive amount on these statement pages carries a stray trailing `)`
 * while genuine negatives use a leading `(`. `acfrGF.parse_money` distinguishes
 * them correctly; `tests/tnNashville.test.mjs` pins it, because getting it wrong
 * is a whole-entity sign inversion with no arithmetic symptom.
 *
 * Usage:
 *   node scripts/processNashville.js --dry-run
 *   node scripts/processNashville.js
 */

import { run } from './lib/acfrGfLoad.mjs';
import { NASHVILLE_LOAD_YEARS, NASHVILLE_PUBLICATION_PAGE } from './data/tnKnightEntities.mjs';

run({
  entityLabel: 'Metro Nashville',
  muniName: 'Nashville-Davidson',
  entityType: 'city',
  state: 'TN',
  pdfDir: '_acfr-work/tn/acfr',
  filePattern: /^nashville_(\d{4})\.pdf$/i,
  extractScript: 'scripts/extractNashville.py',
  datasetIdPrefix: 'nashville-davidson-acfr-gf',
  baseUrl: NASHVILLE_PUBLICATION_PAGE,
  fys: [...NASHVILLE_LOAD_YEARS],
  // July 1 - June 30. Stated on EVERY statement page ("For the Year Ended June
  // 30, <year>") and independently confirmed by the live FAC record for auditee
  // 0000193991, whose fy_end_date is June 30 in all ten audit years.
  // ⚠ NOT taken from the repo's FAC census: Nashville is absent from it because
  // classifyAuditee() returns null for "THE METROPOLITAN GOVERNMENT OF ..." — a
  // systematic blind spot for consolidated governments, filed as a follow-up.
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
  seedScript: 'scripts/seedNashville.mjs',
  fetchScript: 'scripts/fetchNashvilleAcfrs.mjs',
});
