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

import { execFileSync } from 'node:child_process';

import { NY_FUND_PREFIXES, GOVERNMENTAL_TYPES } from '../data/nyOscFundPrefixes.mjs';
import { resolvePython } from './pythonBin.mjs';

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

/** The fund is the leading run of capitals on the account code. */
export function fundPrefixOf(accountCode) {
  const m = /^([A-Z]+)/.exec(String(accountCode || ''));
  return m ? m[1] : '';
}

/**
 * ⚠ Returns null for anything the ARM-backed registry does not cover. Null is
 * a CORRECT outcome, not a shortfall: the caller must drive that city-year's
 * total_governmental to `unknown`, never sum without the fund. Omitting a
 * governmental fund understates; including a proprietary one overstates. The
 * destructive direction is "declare two cities comparable".
 */
export function classifyPrefix(prefix) {
  const e = NY_FUND_PREFIXES[prefix];
  return e ? { type: e.type, name: e.name } : null;
}

/**
 * ⚠ DECIMAL, NOT INTEGER. The archive contains values like `-.29` (City of
 * Batavia A64601 FY2021) and `-1481.26` (Cortland A4389). An integer parse
 * throws or truncates on real rows.
 *
 * ⚠ A non-numeric amount THROWS. Coercing it to 0 would silently delete money.
 */
export function parseAmount(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (s === '') return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`non-numeric amount: ${JSON.stringify(v)}`);
  return n;
}

/**
 * LEVEL_1_CATEGORY -> LEVEL_2_CATEGORY -> OBJECT_OF_EXPENDITURE.
 *
 * ⚠⚠ Items carry `a` (actual_amount) and NEVER `aa` (approved_amount). OSC
 * publishes closed-year actuals only; emitting `aa: 0` would assert an adopted
 * budget of zero, which is false -- the adopted figure is UNKNOWN, not zero.
 * Absent means unknown. See tests/budgetTreeItemContract.test.mjs for what
 * `_treasury_insert_tree` does with each key; the a/aa inversion cost TT eight
 * PRs and left approved_amount NULL on ~18,700 rows.
 *
 * ⚠ Negative amounts are KEPT -- they are genuine contra entries (refunds,
 * corrections), ~28 a year across the archive. Only exact zeros are dropped.
 */
export function buildNyTree(rows) {
  const l1s = new Map();
  let total = 0;

  for (const r of rows) {
    const a = parseAmount(r.AMOUNT);
    if (a === 0) continue;

    const n1 = normLabel(r.LEVEL_1_CATEGORY) || 'Unclassified';
    const n2 = normLabel(r.LEVEL_2_CATEGORY) || 'Unclassified';
    const d = normLabel(r.OBJECT_OF_EXPENDITURE) || 'Total';

    if (!l1s.has(n1)) l1s.set(n1, new Map());
    const l2s = l1s.get(n1);
    if (!l2s.has(n2)) l2s.set(n2, []);
    l2s.get(n2).push({ d, a });
    total += a;
  }

  const tree = [...l1s.entries()].map(([n1, l2s]) => {
    const c = [...l2s.entries()].map(([n2, items]) => ({
      n: n2,
      a: items.reduce((s, i) => s + i.a, 0),
      i: items,
    }));
    return { n: n1, a: c.reduce((s, k) => s + k.a, 0), c };
  });

  return { tree, total };
}

/**
 * ⚠⚠ PER ENTITY, PER YEAR. NY cities do NOT share one calendar -- FY2024 alone
 * shows five year-ends (Dec 31, Jun 30, Mar 31, Jul 31, May 31). Carrying one
 * month across the state is exactly the FYSM `NOT NULL DEFAULT 1` defect that
 * lied on ~18,700 rows, and a gate asserting every city shares a month would
 * be asserting conformity to a hardcode rather than measuring anything.
 *
 * ⚠ NEVER carry a target month between entities.
 */
export function fiscalYearStartMonth(row) {
  if (row.PERIOD_START) {
    const m = Number(String(row.PERIOD_START).slice(5, 7));
    if (m >= 1 && m <= 12) return m;
  }
  if (row.FISCAL_YEAR_END) {
    const endMonth = Number(String(row.FISCAL_YEAR_END).slice(0, 2));
    if (endMonth >= 1 && endMonth <= 12) return (endMonth % 12) + 1;
  }
  throw new Error(`no fiscal period on row: ${JSON.stringify(row).slice(0, 120)}`);
}

export const ARCHIVE_PATH = 'docs/NY/city_all_years.zip';
export const ARCHIVE_URL =
  'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/city_all_years.zip';

/** Minimal RFC4180 reader — the OSC files quote fields containing commas. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

/**
 * Pull one year's CSV out of the archive and return only the revenue and
 * expenditure rows, era-normalised.
 *
 * ⚠ `GL`/`FBNP` (modern) and `BALANCE SHEET`/`CHANGE IN EQUITY` (old) are
 * dropped here. In FY2024 they are 7,663 of 20,234 rows; sweeping them into a
 * revenue or expenditure tree double-counts badly. Dropping them also removes
 * every K and W schedule row, which appear nowhere else.
 */
export function readYear(zipPath, year) {
  const member = `${year}_City.csv`;
  const text = execFileSync(resolvePython(), ['-I', '-c',
    'import sys,zipfile;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode("utf-8-sig",errors="replace"))',
    zipPath, member,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });

  const grid = parseCsv(text);
  const header = grid[0];
  eraForHeader(header); // throws on an unrecognised header
  const ix = Object.fromEntries(header.map((h, i) => [h, i]));
  const get = (r, k) => (ix[k] === undefined ? undefined : r[ix[k]]);

  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const raw = {
      ACCOUNT_CODE_SECTION: get(r, 'ACCOUNT_CODE_SECTION'),
      FINANCIAL_STATEMENT: get(r, 'FINANCIAL_STATEMENT'),
      PERIOD_START: get(r, 'PERIOD_START'),
      FISCAL_YEAR_END: get(r, 'FISCAL_YEAR_END'),
    };
    const section = sectionOf(raw);
    if (section === 'OTHER') continue;

    out.push({
      municipalCode: get(r, 'MUNICIPAL_CODE'),
      entityName: get(r, 'ENTITY_NAME'),
      county: get(r, 'COUNTY'),
      fiscalYear: Number(get(r, 'CALENDAR_YEAR')),
      fundPrefix: fundPrefixOf(get(r, 'ACCOUNT_CODE')),
      section,
      fiscalYearStartMonth: fiscalYearStartMonth(raw),
      LEVEL_1_CATEGORY: get(r, 'LEVEL_1_CATEGORY'),
      LEVEL_2_CATEGORY: get(r, 'LEVEL_2_CATEGORY'),
      OBJECT_OF_EXPENDITURE: get(r, 'OBJECT_OF_EXPENDITURE'),
      AMOUNT: get(r, 'AMOUNT'),
    });
  }
  return out;
}

/**
 * Aggregate one city-year to one scope.
 *
 * ⚠⚠ UNKNOWN IS A CORRECT OUTCOME. If any revenue/expenditure row in the
 * city-year carries a prefix the ARM-backed registry cannot classify, the
 * `total_governmental` scope is reported as `unknown` rather than summed
 * without that fund. Omitting a governmental fund understates the total;
 * including a proprietary one overstates it. Both are wrong, and the
 * destructive direction is "declare two cities comparable".
 *
 * `general_fund` is unaffected: `A` is unambiguous.
 */
export function aggregateCityYear(rows, { section, scope }) {
  const inSection = rows.filter((r) => r.section === section);

  if (scope === 'general_fund') {
    const { tree, total } = buildNyTree(inSection.filter((r) => r.fundPrefix === 'A'));
    return { scope, tree, total, unknownPrefixes: [] };
  }

  const unknown = [...new Set(
    inSection.map((r) => r.fundPrefix).filter((p) => classifyPrefix(p) === null),
  )].sort();
  if (unknown.length) return { scope: 'unknown', tree: [], total: 0, unknownPrefixes: unknown };

  const govt = inSection.filter((r) => GOVERNMENTAL_TYPES.has(classifyPrefix(r.fundPrefix).type));
  const { tree, total } = buildNyTree(govt);
  return { scope: 'total_governmental', tree, total, unknownPrefixes: [] };
}
