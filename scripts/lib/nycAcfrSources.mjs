// NO SHEBANG -- a test guards this for everything under scripts/lib/.
/**
 * Per-fiscal-year NYC ACFR locations (NYC Comptroller).
 *
 * All 24 years FY2002-FY2025 were probed on 2026-10-09; every one returned
 * HTTP 200. THREE naming eras, and casing is load-bearing: `cafr2015.pdf`
 * 404s while `CAFR2015.pdf` is 200, and the reverse holds for 2010.
 *
 * ⚠⚠ FY2025 CANNOT BE DERIVED FROM ITS YEAR. It is `ACFR-2025-7-28-2026.pdf`
 * -- a date stamp unrelated to the fiscal year. Any future year must be LOOKED
 * UP and added to ONE_OFFS or the era table, never constructed. A loader that
 * extends the `ACFR-{YYYY}` rule to FY2026 will 404, or worse, silently fetch
 * a document for the wrong period.
 */

export const NYC_ACFR_BASE = 'https://comptroller.nyc.gov/wp-content/uploads/documents/';

/** FY2002..FY2025. FY2001 is deliberately absent -- see `nycAcfrFilename`. */
export const NYC_FYS = Array.from({ length: 24 }, (_, i) => 2002 + i);

/** Years whose filename follows no pattern. Verified individually. */
const ONE_OFFS = new Map([
  [2025, 'ACFR-2025-7-28-2026.pdf'],
]);

export function nycAcfrFilename(fy) {
  if (!Number.isInteger(fy)) {
    throw new TypeError(`fiscal year must be an integer, got ${JSON.stringify(fy)}`);
  }
  const oneOff = ONE_OFFS.get(fy);
  if (oneOff) return oneOff;
  if (fy === 2001) {
    throw new RangeError(
      'FY2001 is out of window: its book is pre-GASB-34 and its General Fund '
      + 'expenditures miss the printed total by -7,348,865 (thousands). Its '
      + 'figures are readable from the FY2002 book but are RESTATED and '
      + 'disagree with what FY2001 itself printed. See spec section 3.1.');
  }
  if (fy >= 2021 && fy <= 2024) return `ACFR-${fy}.pdf`;
  if (fy >= 2012 && fy <= 2020) return `CAFR${fy}.pdf`;
  if (fy >= 2002 && fy <= 2011) return `cafr${fy}.pdf`;
  throw new RangeError(
    `No known NYC ACFR filename convention for FY${fy}. Do not guess -- look it `
    + 'up on comptroller.nyc.gov and add it to ONE_OFFS or extend the era table. '
    + 'FY2025 is proof the pattern is not safe to extrapolate.');
}

export function nycAcfrUrl(fy) {
  return `${NYC_ACFR_BASE}${nycAcfrFilename(fy)}`;
}
