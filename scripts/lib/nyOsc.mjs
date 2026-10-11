// NO SHEBANG — a `#!` on any module a test imports breaks `npm test` on Windows,
// and a test guards it (commit 40aa706, and see tests/waSao.test.mjs).
/**
 * NY OSC Local Government Financial Data — pure readers.
 *
 * Spec: docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md
 *
 * ⚠⚠ THIS SOURCE IS TWO REPORTS. Files 1995-2012 and 2013-2026 do not share a
 * column set. The era is read off the HEADER, never off the filename, so a file
 * renamed or re-dated cannot silently pick the wrong parser. Same class of trap
 * as PA DCED's pre-2015 report and Ohio AOS's county-vs-city workbooks.
 */

export const ERA_OLD = '1995-2012';
export const ERA_NEW = '2013-2026';

export function eraForHeader(header) {
  const cols = new Set(header);
  if (cols.has('ACCOUNT_CODE_SECTION') && cols.has('PERIOD_END')) return ERA_NEW;
  if (cols.has('FINANCIAL_STATEMENT') && cols.has('FISCAL_YEAR_END')) return ERA_OLD;
  throw new Error(`unrecognised NY OSC header: ${header.join(',')}`);
}

/**
 * Which statement a row belongs to.
 *
 * ⚠ Only REVENUE and EXPENDITURE are ever loaded. `GL`/`FBNP` (modern) and
 * `BALANCE SHEET`/`CHANGE IN EQUITY` (old) are balance-sheet and fund-balance
 * rows — 7,663 of 20,234 rows in FY2024 alone. Sweeping them into a revenue or
 * expenditure tree double-counts badly.
 */
export function sectionOf(row) {
  const neu = row.ACCOUNT_CODE_SECTION;
  if (neu) return neu === 'REVENUE' || neu === 'EXPENDITURE' ? neu : 'OTHER';
  const fs = row.FINANCIAL_STATEMENT || '';
  if (fs.includes('REVENUES')) return 'REVENUE';
  if (fs.includes('EXPENDITURES')) return 'EXPENDITURE';
  return 'OTHER';
}

/**
 * ⚠⚠ THE ERA BOUNDARY IS A LABEL-CASING TRAP.
 *
 * `LEVEL_1_CATEGORY` is `GENERAL GOVERNMENT` before 2013 and `General
 * Government` after. Loaded as published, every city grows two parallel icicle
 * branches across FY2012/FY2013 and every category appears twice -- while
 * tying at EXACTLY $0, because casing moves no money. Same family as NYC's
 * `Current Operations:` weld, which published a category called
 * `Current Operations General government` at a perfect tie.
 *
 * Both eras normalise to the modern era's Title Case.
 */
const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on',
  'or', 'the', 'to', 'via', 'vs',
]);

export function normLabel(s) {
  if (!s) return '';
  const words = String(s).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
