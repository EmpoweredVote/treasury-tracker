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
 *
 * ⚠ THE HOUSE RULE IN THIS MODULE IS: REFUSE, NEVER REINTERPRET. A whole-branch
 * review found five places that quietly substituted a plausible value for an
 * unexpected input — a typo'd scope relabelled itself, a typo'd section
 * returned $0, an unknown dataset type became "Expenditures", a non-ISO date
 * yielded an in-range-but-wrong month, and a stray quote deleted the rest of
 * the file. Every one of them ties at $0 while being wrong. Functions here
 * throw.
 */

import { execFileSync } from 'node:child_process';

import { NY_FUND_PREFIXES, GOVERNMENTAL_TYPES } from '../data/nyOscFundPrefixes.mjs';
import { resolvePython } from './pythonBin.mjs';

export const ERA_OLD = '1995-2012';
export const ERA_NEW = '2013-2026';

/** The years the archive actually covers. `readYear` refuses anything else. */
export const ARCHIVE_FIRST_YEAR = 1995;
export const ARCHIVE_LAST_YEAR = 2026;

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
 * ⚠⚠ THE ERA BOUNDARY IS A LABEL TRAP, AND IT BITES TWICE.
 *
 * 1. CASE. `LEVEL_1_CATEGORY` is `GENERAL GOVERNMENT` before 2013 and `General
 *    Government` after.
 * 2. AMPERSAND. `LEVEL_2_CATEGORY` is `Interest & Penalties` before 2013 and
 *    `Interest and Penalties` after — $454,591,690.59 against $375,895,416.71.
 *    Case folding alone leaves these DISTINCT, so the first version of this
 *    function fixed level 1 and left every city with two parallel revenue
 *    sub-branches one level down.
 *
 * Either way the branch doubles while tying at EXACTLY $0, because a rename
 * moves no money. Same family as NYC's `Current Operations:` weld.
 *
 * ⚠ Capitals after a hyphen are PRESERVED: OSC publishes `Other Non-Property
 * Taxes`, and lowercasing the second half would make TT misquote the publisher
 * on every NY city page.
 */
const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on',
  'or', 'the', 'to', 'via', 'vs',
]);

/** Capitalise the first LETTER, so `(state)` becomes `(State)`. */
function capitaliseFirstLetter(s) {
  return s.replace(/[a-z]/, (c) => c.toUpperCase());
}

export function normLabel(s) {
  if (!s) return '';
  const words = String(s)
    .replace(/&/g, ' and ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w)
      ? w
      : w.split('-').map(capitaliseFirstLetter).join('-')))
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
 *
 * ⚠ `Object.hasOwn`, not a bare index — `NY_FUND_PREFIXES['constructor']`
 * would otherwise return a truthy inherited value and escape the null check.
 */
export function classifyPrefix(prefix) {
  if (!Object.hasOwn(NY_FUND_PREFIXES, prefix)) return null;
  const e = NY_FUND_PREFIXES[prefix];
  return { type: e.type, name: e.name };
}

/**
 * ⚠ DECIMAL, NOT INTEGER. The archive contains values like `-.29` (City of
 * Batavia A64601 FY2021) and `-1481.26` (Cortland A4389). An integer parse
 * throws or truncates on real rows.
 *
 * ⚠ ANCHORED REGEX, NOT `Number()`. Every AMOUNT in all 32 members matches
 * `-?\d*\.?\d+` or is empty, but `Number()` would also accept `0x10` as 16,
 * `1e5` as 100000 and `  ` as 0. Exponent notation is the realistic hazard: an
 * Excel round-trip emits `1.23457E+08`, which `Number()` parses SUCCESSFULLY
 * with lost precision rather than throwing.
 *
 * ⚠ `undefined` THROWS; `''` is zero. They are different facts: undefined
 * means the column was absent or the row was short — a structural failure that
 * must not silently become $0 — while a blank cell is the publisher's own nil.
 */
const AMOUNT_RE = /^-?(?:\d+\.?\d*|\.\d+)$/;

export function parseAmount(v) {
  if (v === undefined) throw new Error('non-numeric amount: undefined (column missing?)');
  if (v === null) return 0;
  const s = String(v).trim();
  if (s === '') return 0;
  if (!AMOUNT_RE.test(s)) throw new Error(`non-numeric amount: ${JSON.stringify(v)}`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`non-finite amount: ${JSON.stringify(v)}`);
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
 *
 * ⚠ ITEMS SHARING A KEY ARE MERGED. `d` is a label, not an identity: Albany
 * FY2021 general-fund expenditure has 49 distinct (L1, L2, object) keys and 21
 * of them repeat, with `Employee Benefits / Unclassified / Employee Benefits`
 * appearing 31 times. Emitting 31 identically-named siblings gives a reader no
 * way to tell them apart, so they are summed into one.
 *
 * ⚠ `total` IS DERIVED FROM THE TREE, not accumulated row-by-row. Row order
 * and grouped order are different summation orders and give different doubles
 * for decimal cents (measured: 709.3499999999999 vs 709.35). Task 10 writes
 * `total` as the row total and `tree` as the hierarchy; if they are computed
 * separately a reader can see the header figure disagree with the icicle.
 */
export function buildNyTree(rows) {
  const l1s = new Map();

  for (const r of rows) {
    const a = parseAmount(r.AMOUNT);
    if (a === 0) continue;

    const n1 = normLabel(r.LEVEL_1_CATEGORY) || 'Unclassified';
    const n2 = normLabel(r.LEVEL_2_CATEGORY) || 'Unclassified';
    const d = normLabel(r.OBJECT_OF_EXPENDITURE) || 'Total';

    if (!l1s.has(n1)) l1s.set(n1, new Map());
    const l2s = l1s.get(n1);
    if (!l2s.has(n2)) l2s.set(n2, new Map());
    const items = l2s.get(n2);
    items.set(d, (items.get(d) ?? 0) + a);
  }

  const tree = [...l1s.entries()].map(([n1, l2s]) => {
    const c = [...l2s.entries()].map(([n2, items]) => {
      const i = [...items.entries()].map(([d, a]) => ({ d, a }));
      return { n: n2, a: i.reduce((s, x) => s + x.a, 0), i };
    });
    return { n: n1, a: c.reduce((s, k) => s + k.a, 0), c };
  });

  return { tree, total: tree.reduce((s, n) => s + n.a, 0) };
}

/**
 * ⚠⚠ PER ENTITY, PER YEAR. NY cities do NOT share one calendar -- FY2024 alone
 * shows five year-ends (Dec 31, Jun 30, Mar 31, Jul 31, May 31). Carrying one
 * month across the state is exactly the FYSM `NOT NULL DEFAULT 1` defect that
 * lied on ~18,700 rows, and a gate asserting every city shares a month would
 * be asserting conformity to a hardcode rather than measuring anything.
 *
 * ⚠ NEVER carry a target month between entities.
 *
 * ⚠⚠ THE FORMAT IS ASSERTED, NOT SLICED. Fixed offsets with only a 1..12 range
 * check accepted `1/1/2024` as FEBRUARY and `20240101` as OCTOBER — in range,
 * silently wrong, and given this repo's FYSM history that is the worst
 * available failure. Verified against the archive: FISCAL_YEAR_END is
 * zero-padded MM/DD in 100% of FY1995-2012 rows and PERIOD_START is
 * YYYY-MM-DD in 100% of FY2013-2026 rows.
 */
const PERIOD_START_RE = /^\d{4}-(\d{2})-\d{2}$/;
const FISCAL_YEAR_END_RE = /^(\d{2})\/\d{2}$/;

export function fiscalYearStartMonth(row) {
  if (row.PERIOD_START !== undefined && row.PERIOD_START !== '') {
    const m = PERIOD_START_RE.exec(String(row.PERIOD_START));
    if (!m) throw new Error(`unrecognised PERIOD_START format: ${JSON.stringify(row.PERIOD_START)}`);
    const month = Number(m[1]);
    if (month < 1 || month > 12) throw new Error(`PERIOD_START month out of range: ${row.PERIOD_START}`);
    return month;
  }
  if (row.FISCAL_YEAR_END !== undefined && row.FISCAL_YEAR_END !== '') {
    const m = FISCAL_YEAR_END_RE.exec(String(row.FISCAL_YEAR_END));
    if (!m) throw new Error(`unrecognised FISCAL_YEAR_END format: ${JSON.stringify(row.FISCAL_YEAR_END)}`);
    const endMonth = Number(m[1]);
    if (endMonth < 1 || endMonth > 12) throw new Error(`FISCAL_YEAR_END month out of range: ${row.FISCAL_YEAR_END}`);
    return (endMonth % 12) + 1;
  }
  throw new Error(`no fiscal period on row: ${JSON.stringify(row).slice(0, 120)}`);
}

export const ARCHIVE_PATH = 'docs/NY/city_all_years.zip';
export const ARCHIVE_URL =
  'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/city_all_years.zip';

/**
 * Minimal RFC4180 reader — the OSC files quote fields containing commas.
 *
 * ⚠⚠ AN UNTERMINATED QUOTE THROWS. It used to put the parser into quote mode
 * for the rest of the file: every remaining row collapsed into one giant
 * single-field row, and a `rows.filter(r => r.length > 1)` line then deleted
 * that too. `readYear` returned a SHORT row set with no error, and the loader
 * would have written a truncated year that ties perfectly against itself.
 *
 * ⚠ Single-field rows are KEPT. That filter was also discarding legitimate
 * one-column rows; emptiness is now tested explicitly.
 */
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
  if (inQ) throw new Error('unterminated quote in CSV — the file is truncated or malformed');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Columns `readYear` depends on. A missing one is a structural failure. */
const REQUIRED_COLUMNS = Object.freeze([
  'CALENDAR_YEAR', 'MUNICIPAL_CODE', 'ENTITY_NAME', 'COUNTY', 'ACCOUNT_CODE',
  'ACCOUNT_CODE_NARRATIVE', 'LEVEL_1_CATEGORY', 'LEVEL_2_CATEGORY',
  'OBJECT_OF_EXPENDITURE', 'AMOUNT',
]);

/**
 * Pull one year's CSV out of the archive and return only the revenue and
 * expenditure rows, era-normalised.
 *
 * ⚠ `GL`/`FBNP` (modern) and `BALANCE SHEET`/`CHANGE IN EQUITY` (old) are
 * dropped here. In FY2024 they are 7,663 of 20,234 rows; sweeping them into a
 * revenue or expenditure tree double-counts badly. Dropping them also removes
 * every K and W schedule row, which appear nowhere else.
 *
 * ⚠⚠ THE COLUMNS ARE VALIDATED FIRST. Without that, a renamed `AMOUNT` column
 * made every `get()` return undefined, every amount 0, every zero dropped —
 * and the function returned an EMPTY TREE WITH A $0 TOTAL AND NO ERROR.
 *
 * ⚠ The python call passes the zip path and member as `sys.argv`, never
 * interpolated into the `-c` program, and runs under `-I` so a planted
 * `zipfile.py` beside the archive cannot be imported. Keep it that way.
 */
export function readYear(zipPath, year) {
  if (!Number.isInteger(year) || year < ARCHIVE_FIRST_YEAR || year > ARCHIVE_LAST_YEAR) {
    throw new Error(
      `no such year ${year} — the archive covers FY${ARCHIVE_FIRST_YEAR}-FY${ARCHIVE_LAST_YEAR}`);
  }
  const member = `${year}_City.csv`;
  let text;
  try {
    text = execFileSync(resolvePython(), ['-I', '-c',
      'import sys,zipfile;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode("utf-8-sig",errors="replace"))',
      zipPath, member,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(
      `could not read ${member} from ${zipPath} `
      + `(the archive covers FY${ARCHIVE_FIRST_YEAR}-FY${ARCHIVE_LAST_YEAR}): ${err.message}`);
  }

  const grid = parseCsv(text);
  if (grid.length === 0) throw new Error(`${member} is empty`);
  const header = grid[0];
  eraForHeader(header); // throws on an unrecognised header

  const ix = Object.fromEntries(header.map((h, i) => [h, i]));
  const missing = REQUIRED_COLUMNS.filter((c) => ix[c] === undefined);
  if (missing.length) {
    throw new Error(`${member} is missing required column(s): ${missing.join(', ')}`);
  }
  const get = (r, k) => (ix[k] === undefined ? undefined : r[ix[k]]);

  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    if (r.length !== header.length) {
      throw new Error(
        `${member} row ${i + 1} has ${r.length} fields, expected ${header.length}`);
    }
    const raw = {
      ACCOUNT_CODE_SECTION: get(r, 'ACCOUNT_CODE_SECTION'),
      FINANCIAL_STATEMENT: get(r, 'FINANCIAL_STATEMENT'),
      PERIOD_START: get(r, 'PERIOD_START'),
      FISCAL_YEAR_END: get(r, 'FISCAL_YEAR_END'),
    };
    const section = sectionOf(raw);
    if (section === 'OTHER') continue;

    const fiscalYear = Number(get(r, 'CALENDAR_YEAR'));
    if (!Number.isInteger(fiscalYear)) {
      throw new Error(`${member} row ${i + 1}: CALENDAR_YEAR is not an integer`);
    }

    out.push({
      municipalCode: get(r, 'MUNICIPAL_CODE'),
      entityName: get(r, 'ENTITY_NAME'),
      county: get(r, 'COUNTY'),
      fiscalYear,
      accountCode: get(r, 'ACCOUNT_CODE'),
      accountCodeNarrative: get(r, 'ACCOUNT_CODE_NARRATIVE'),
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

const LEGAL_SECTIONS = Object.freeze(new Set(['REVENUE', 'EXPENDITURE']));
const LEGAL_SCOPES = Object.freeze(new Set(['general_fund', 'total_governmental']));

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
 * ⚠ The unknown scan covers ALL funds in the section, not just the
 * governmental ones. That is deliberate and conservative: an unrecognised
 * prefix means the file changed, and TT should not quietly decide the change
 * does not concern it. It does mean a future unrecognised ENTERPRISE prefix
 * would blank a governmental total it never belonged in — an acceptable trade
 * for a loud alarm, but say so rather than discover it.
 *
 * `general_fund` is unaffected: `A` is unambiguous, and that branch returns
 * before the scan runs.
 *
 * ⚠ BOTH ARGUMENTS ARE VALIDATED. A typo'd scope used to fall through to the
 * governmental branch and then be LABELLED total_governmental regardless of
 * what the caller asked for; a typo'd section returned a silent $0
 * indistinguishable from a genuinely missing city-year.
 */
export function aggregateCityYear(rows, { section, scope }) {
  if (!LEGAL_SECTIONS.has(section)) {
    throw new Error(`unknown section ${JSON.stringify(section)} — expected REVENUE or EXPENDITURE`);
  }
  if (!LEGAL_SCOPES.has(scope)) {
    throw new Error(
      `unknown fund scope ${JSON.stringify(scope)} — expected general_fund or total_governmental`);
  }

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

export const SOURCE_PREFIX = 'New York OSC Annual Financial Report';
export const SOURCE_URL = 'https://www.osc.ny.gov/local-government/data';

const SCOPE_FACE = {
  general_fund: 'General Fund',
  total_governmental: 'Total Governmental',
};
const DATASET_FACE = {
  operating: 'Expenditures',
  revenue: 'Revenues',
};

/**
 * ⚠ The scope is IN THE NAME. `treasury_sync_city_budget` keys on
 * fund_scope + basis, and the axis registries key on this string, so the two
 * scopes must be distinguishable as text or one silently relabels the other.
 *
 * ⚠⚠ EVERY ARGUMENT IS VALIDATED, because every way of getting this string
 * wrong is silent. A `datasetType` fallback of `'Expenditures'` turned
 * sourceNameFor('Revenue', …) into an expenditures label on revenue data, with
 * a matching registry entry and a clean `actual` basis stamp. A `NaN` fiscal
 * year produced `FYNaN`, which matches NONE of the three registry patterns —
 * losing fund_scope, basis AND audit_grade to `unknown` at once instead of
 * failing loudly.
 */
export function sourceNameFor(datasetType, fiscalYear, scope) {
  const face = DATASET_FACE[datasetType];
  if (!face) {
    throw new Error(
      `unknown dataset type ${JSON.stringify(datasetType)} — expected operating or revenue`);
  }
  const scopeFace = SCOPE_FACE[scope];
  if (!scopeFace) throw new Error(`unknown fund scope for source name: ${JSON.stringify(scope)}`);
  if (!Number.isInteger(fiscalYear)
      || fiscalYear < ARCHIVE_FIRST_YEAR || fiscalYear > ARCHIVE_LAST_YEAR) {
    throw new Error(
      `fiscal year ${fiscalYear} is not an integer in `
      + `FY${ARCHIVE_FIRST_YEAR}-FY${ARCHIVE_LAST_YEAR}`);
  }
  return `${SOURCE_PREFIX} — ${face}, ${scopeFace} (FY${fiscalYear} actual, self-reported)`;
}

/**
 * Pre-flight the roster before a seeder writes anything.
 *
 * ⚠⚠ THIS RUNS BEFORE THE FIRST WRITE, NOT INSIDE THE LOOP. The guard used to
 * live in the write loop, so a `New York` entry at roster position 40 would
 * have created 39 municipalities before refusing. TT already holds New York
 * City from its own ACFRs (PR #243); creating a second one is the single
 * destructive outcome available here.
 */
export function assertRosterHasNoNyc(entities) {
  const seen = new Set();
  for (const e of entities) {
    if (/new york/i.test(e.name)) {
      throw new Error(
        `REFUSING: roster contains "${e.name}" — New York City is loaded from its own ACFRs `
        + 'and is absent from this source by design');
    }
    if (seen.has(e.municipalCode)) {
      throw new Error(`REFUSING: duplicate municipal code ${e.municipalCode} in the roster`);
    }
    seen.add(e.municipalCode);
  }
}
