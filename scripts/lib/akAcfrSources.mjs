/**
 * Municipality of Anchorage, AK ACFR — per-year document provenance.
 *
 * NO SHEBANG — library module; tests import it.
 *
 * Alaska's FIRST local government in TT. The AK STATE node already exists
 * (FY2006-2025, `processAKAcfr.js`) and nothing here touches it.
 *
 * ── ⚠⚠ ANCHORAGE IS A UNIFIED MUNICIPALITY — IT IS ALSO THE COUNTY ─────────
 *
 * The Municipality of Anchorage is a unified home-rule municipality: city and
 * borough consolidated into ONE government. There is no separate "Anchorage
 * Borough" filing and no second entity to create.
 *
 * It is loaded as `city`, following TT's own precedent for consolidated
 * city-counties — San Francisco CA and Philadelphia PA are both `city` today.
 *
 * ⚠⚠ Do NOT type it `borough`. In TT `borough` means the 949 PENNSYLVANIA
 * boroughs, a city-like unit; an Alaska borough is a county-equivalent. One
 * label for both would conflate them in the county children panel. And
 * `entity_type` is identity-load-bearing, so a later retype MINTS A DUPLICATE
 * rather than moving the row.
 *
 * ⚠ For whoever extends this to the rest of Alaska: the state has 19 ORGANIZED
 * boroughs plus 11 census areas. The census areas are statistical only and have
 * NO government, so Alaska's county layer is 19 loadable governments, not the
 * 30 county-equivalents a census vintage names.
 *
 * ── ⚠ FISCAL YEAR: CALENDAR YEAR. THE STATE'S IS NOT ──────────────────────
 *
 * Anchorage closes December 31. The State of Alaska closes JUNE 30. Two fiscal
 * calendars inside one state — `processAKAcfr.js`'s month must never be carried
 * onto a local AK entity. `assertConfig` in acfrGfLoad.mjs cross-checks
 * `fyEndMonthDay` against `fiscalYearStartMonth` so a slip fails at startup.
 *
 * ── ⚠⚠ THE SERIES FLOOR IS FY2012, AND IT IS A TEXT-LAYER FLOOR ───────────
 *
 * muni.org publishes back to FY2001, but FY2001-FY2011 are image-only scans.
 * Measured on the publisher's own copies (`pdftotext` chars ÷ `pdfinfo` pages):
 *
 *     FY2012-FY2024    2,499 - 2,804 chars/page    born-digital
 *     FY2009, FY2008      48 and 37 chars/page     scan
 *     FY2010, FY2011           7 chars/page        scan
 *     FY2005, FY2001           1 char  per page    scan
 *
 * The break falls exactly where muni.org switches from four section PDFs per
 * year (FY2001-2011) to one complete report (FY2012+), so it is an ERA rather
 * than a handful of bad uploads — the same shape as Colorado Springs FY1999-2011.
 *
 * Recovering the era means OCR, i.e. introducing a transcription step into a
 * provenance chain that is otherwise byte-exact. Deliberately out of scope and
 * declared below rather than quietly attempted. NEVER written as $0.
 */

/**
 * Anchorage posts one complete ACFR per year under the Controller's ACFR
 * folder. ⚠ The filenames are NOT derivable — "Complete 2013 CAFR.pdf",
 * "2014 CAFR.pdf", "2019 MOA CAFR.pdf", "Municipality of Anchorage ACFR 22.pdf"
 * and "...ACFR 2024 (S).pdf" are five different conventions in thirteen years.
 * Read off the publisher's own listing, never rebuilt from a rule.
 */
export const ANCHORAGE_URL = Object.freeze({
  2012: 'https://www.muni.org/Departments/finance/controller/ACFR/2012%20CAFR.pdf',
  2013: 'https://www.muni.org/Departments/finance/controller/ACFR/Complete%202013%20CAFR.pdf',
  2014: 'https://www.muni.org/Departments/finance/controller/ACFR/2014%20CAFR.pdf',
  2015: 'https://www.muni.org/Departments/finance/controller/ACFR/Complete%202015%20CAFR.pdf',
  2016: 'https://www.muni.org/Departments/finance/controller/ACFR/Complete%202016%20CAFR.pdf',
  2017: 'https://www.muni.org/Departments/finance/controller/ACFR/2017%20CAFR.pdf',
  2018: 'https://www.muni.org/Departments/finance/controller/ACFR/2018%20CAFR.pdf',
  2019: 'https://www.muni.org/Departments/finance/controller/ACFR/2019%20MOA%20CAFR.pdf',
  2020: 'https://www.muni.org/Departments/finance/controller/ACFR/2020%20MOA%20Annual%20Report-%20Final%20Web%20Version%20w%20Cover-%2010.15.21.pdf',
  2021: 'https://www.muni.org/Departments/finance/controller/ACFR/2021%20MOA%20ACFR.pdf',
  2022: 'https://www.muni.org/Departments/finance/controller/ACFR/Municipality%20of%20Anchorage%20ACFR%2022.pdf',
  2023: 'https://www.muni.org/Departments/finance/controller/ACFR/2023%20MOA%20ACFR.pdf',
  2024: 'https://www.muni.org/Departments/finance/controller/ACFR/Municipality%20of%20Anchorage%20ACFR%202024%20(S).pdf',
});

/** The fiscal years this entity can be loaded for. */
export const ANCHORAGE_FYS = Object.freeze(Object.keys(ANCHORAGE_URL).map(Number).sort());

/**
 * Published by muni.org but NOT loadable. Cause recorded per year so the gap is
 * explained rather than merely absent. Reported at load time; never $0.
 */
export const KNOWN_DOCUMENT_GAPS = Object.freeze({
  2001: 'image-only scan (1 char/page) — muni.org posts FY2001-2011 as four section PDFs',
  2002: 'image-only scan — muni.org section PDFs',
  2003: 'image-only scan — muni.org section PDFs',
  2004: 'image-only scan — muni.org section PDFs',
  2005: 'image-only scan (1 char/page) — muni.org section PDFs',
  2006: 'image-only scan — muni.org section PDFs',
  2007: 'image-only scan — muni.org section PDFs',
  2008: 'image-only scan (37 chars/page) — muni.org section PDFs',
  2009: 'image-only scan (48 chars/page) — muni.org section PDFs',
  2010: 'image-only scan (7 chars/page) — muni.org section PDFs',
  2011: 'image-only scan (7 chars/page) — muni.org section PDFs',
});

/** The reader-facing publication page — what a budgets row cites. */
export const ANCHORAGE_PAGE =
  'https://www.muni.org/Departments/finance/controller/Pages/ACFR.aspx';

/** Resolve the fetch URL for one fiscal year, or null if not published. */
export function anchorageUrl(fiscalYear) {
  return ANCHORAGE_URL[Number(fiscalYear)] ?? null;
}
