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
 * ⚠ Returns null for anything the given registry does not cover. Null is a
 * CORRECT outcome, not a shortfall: the caller must drive that entity-year's
 * total_governmental to `unknown`, never sum without the fund. Omitting a
 * governmental fund understates; including a proprietary one overstates. The
 * destructive direction is "declare two entities comparable".
 *
 * ⚠⚠ THE REGISTRY IS A PARAMETER because NY has TWO publications. The same
 * letter means different things: `C` is a city's absent code and a district's
 * GOVERNMENTAL food-service fund. Defaulting to the city table keeps every
 * existing caller unchanged.
 *
 * ⚠ `Object.hasOwn`, not a bare index — `registry['constructor']` would
 * otherwise return a truthy inherited value and escape the null check.
 */
export function classifyPrefix(prefix, registry = NY_FUND_PREFIXES) {
  if (!Object.hasOwn(registry, prefix)) return null;
  const e = registry[prefix];
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

export const SCHOOL_ARCHIVE_PATH = 'docs/NY/school_all_years.zip';
export const SCHOOL_ARCHIVE_URL =
  'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/schooldistrict_all_years.zip';
/** The districts file FY1995-FY2026; FY2026 is partial and not loaded. */
export const SCHOOL_FIRST_YEAR = 1995;
export const SCHOOL_LAST_YEAR = 2026;

/**
 * The five OSC publications, by the member-class token in `{year}_{Class}.csv`.
 *
 * Spec: docs/superpowers/specs/2026-10-19-ny-towns-villages-counties-design.md §2
 *
 * ⚠⚠ `firstYear`/`lastYear` ARE THE ARCHIVE'S EXTENT, not the load window.
 * They exist so `readYear` refuses a year the file cannot contain. What TT
 * chooses to LOAD is narrower and lives in the loader — FY2026 is refused for
 * every class (§3.1), and for towns and counties the FY2026 member is empty
 * anyway.
 *
 * ⚠ Before this table the range check was a ternary over City-vs-everything
 * else, so `readYear(zip, year, 'Town')` silently borrowed the SCHOOL range.
 * It happened to be the same numbers; a table makes that a fact rather than a
 * coincidence.
 */
export const NY_OSC_ARCHIVES = Object.freeze({
  City: {
    path: ARCHIVE_PATH,
    url: ARCHIVE_URL,
    firstYear: ARCHIVE_FIRST_YEAR,
    lastYear: ARCHIVE_LAST_YEAR,
    entityType: 'city',
  },
  SchoolDistrict: {
    path: SCHOOL_ARCHIVE_PATH,
    url: SCHOOL_ARCHIVE_URL,
    firstYear: SCHOOL_FIRST_YEAR,
    lastYear: SCHOOL_LAST_YEAR,
    entityType: 'school_district',
  },
  Town: {
    path: 'docs/NY/town_all_years.zip',
    url: 'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/town_all_years.zip',
    firstYear: 1995,
    lastYear: 2026,
    entityType: 'town',
    sourceKey: 'NY_OSC_TOWN',
    namePrefix: 'Town of ',
  },
  Village: {
    path: 'docs/NY/village_all_years.zip',
    url: 'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/village_all_years.zip',
    firstYear: 1995,
    lastYear: 2026,
    entityType: 'village',
    sourceKey: 'NY_OSC_VILLAGE',
    namePrefix: 'Village of ',
  },
  County: {
    path: 'docs/NY/county_all_years.zip',
    url: 'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/county_all_years.zip',
    firstYear: 1995,
    lastYear: 2026,
    entityType: 'county',
    sourceKey: 'NY_OSC_COUNTY',
    namePrefix: 'County of ',
  },
});

/** The three classes this town/village/county load covers. */
export const MUNICIPAL_CLASSES = Object.freeze(['Town', 'Village', 'County']);

/** ⚠ FY2026 is refused for every class — spec §3.1. */
export const MUNICIPAL_FIRST_YEAR = 1995;
export const MUNICIPAL_LAST_YEAR = 2025;

export function archiveFor(memberClass) {
  const a = NY_OSC_ARCHIVES[memberClass];
  if (!a) {
    throw new Error(
      `unknown NY OSC member class ${JSON.stringify(memberClass)} — expected one of `
      + Object.keys(NY_OSC_ARCHIVES).join(', '));
  }
  return a;
}

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
export function readYear(zipPath, year, memberClass = 'City') {
  // ⚠ Range-checked against THIS class's archive, from NY_OSC_ARCHIVES. An
  // unknown class throws rather than defaulting to some other publication's
  // range.
  const { firstYear: first, lastYear: last } = archiveFor(memberClass);
  if (!Number.isInteger(year) || year < first || year > last) {
    throw new Error(`no such year ${year} — the archive covers FY${first}-FY${last}`);
  }
  const member = `${year}_${memberClass}.csv`;
  let text;
  try {
    text = execFileSync(resolvePython(), ['-I', '-c',
      'import sys,zipfile;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode("utf-8-sig",errors="replace"))',
      zipPath, member,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(
      `could not read ${member} from ${zipPath} `
      + `(the archive covers FY${first}-FY${last}): ${err.message}`);
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
      // ⚠ READ, NEVER USED TO TYPE AN ENTITY. The entity type comes from WHICH
      // FILE the row is in; this is the publisher's own word and is only ever
      // asserted against that. See the municipal loader's CLASS assertion and
      // project_pick_up_next's "never type an entity from the publisher's own
      // City/Town word". Optional: `get()` yields undefined if the column is
      // absent, which must not be a structural failure.
      classDescription: get(r, 'CLASS_DESCRIPTION'),
      // ⚠ The raw period bounds, so a caller can prove a filing covers a full
      // year. Three villages filed 213-day stubs and one a 425-day period
      // (spec §6); published as a year they would show a cliff that never
      // happened. Only the 2013+ era has them — see assertFullFiscalPeriod.
      periodStart: get(r, 'PERIOD_START'),
      periodEnd: get(r, 'PERIOD_END'),
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
export function aggregateCityYear(
  rows,
  { section, scope, registry = NY_FUND_PREFIXES, governmentalTypes = GOVERNMENTAL_TYPES },
) {
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
    inSection.map((r) => r.fundPrefix).filter((p) => classifyPrefix(p, registry) === null),
  )].sort();
  if (unknown.length) return { scope: 'unknown', tree: [], total: 0, unknownPrefixes: unknown };

  const govt = inSection.filter(
    (r) => governmentalTypes.has(classifyPrefix(r.fundPrefix, registry).type));
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

export const SCHOOL_SOURCE_PREFIX = 'New York OSC School District Annual Financial Report';

/**
 * ⚠ A SEPARATE prefix from the cities'. The two registries are anchored at
 * both ends, so a district row under a city-shaped string would be claimed by
 * nothing and land with fund_scope, basis AND audit_grade all `unknown`.
 */
export function schoolSourceNameFor(datasetType, fiscalYear, scope) {
  const face = DATASET_FACE[datasetType];
  if (!face) {
    throw new Error(
      `unknown dataset type ${JSON.stringify(datasetType)} — expected operating or revenue`);
  }
  const scopeFace = SCOPE_FACE[scope];
  if (!scopeFace) throw new Error(`unknown fund scope for source name: ${JSON.stringify(scope)}`);
  if (!Number.isInteger(fiscalYear)
      || fiscalYear < SCHOOL_FIRST_YEAR || fiscalYear > SCHOOL_LAST_YEAR) {
    throw new Error(`fiscal year ${fiscalYear} is not an integer in `
      + `FY${SCHOOL_FIRST_YEAR}-FY${SCHOOL_LAST_YEAR}`);
  }
  return `${SCHOOL_SOURCE_PREFIX} — ${face}, ${scopeFace} (FY${fiscalYear} actual, self-reported)`;
}

/**
 * Source-name prefixes for the town, village and county AFRs.
 *
 * ⚠⚠ DISTINCT FROM THE CITIES', THOUGH IT IS THE SAME REPORT. Towns, villages
 * and counties file the same AFR under the same manual as the 61 cities, so
 * the cities' string would resolve fund_scope, basis and audit_grade
 * correctly — and would still be wrong. Those three registry entries carry
 * evidence prose ABOUT CITIES ("All 61 cities carry an A fund", "392,234
 * revenue/expenditure lines"), and the Total Governmental fund list genuinely
 * differs by class: towns use B/DA/DB/S_, counties use D/DM/S, villages use
 * none of them. A town inheriting that string would publish a provenance claim
 * nobody ever measured about towns.
 *
 * ⚠ The registry patterns are anchored at BOTH ends, so
 * `^New York OSC Annual Financial Report —` cannot claim
 * `New York OSC Town Annual Financial Report —` or the reverse. A test asserts
 * that cross-claim is impossible for all four NY families.
 */
export const MUNICIPAL_SOURCE_PREFIXES = Object.freeze({
  Town: 'New York OSC Town Annual Financial Report',
  Village: 'New York OSC Village Annual Financial Report',
  County: 'New York OSC County Annual Financial Report',
});

/**
 * ⚠ EVERY ARGUMENT IS VALIDATED, for the reasons spelled out on
 * `sourceNameFor`: a silent dataset-type fallback once turned a revenue row
 * into an expenditures label with a matching registry entry and a clean basis
 * stamp, and a NaN year produced `FYNaN`, which matches none of the three
 * registry patterns and loses fund_scope, basis AND audit_grade at once.
 */
export function municipalSourceNameFor(memberClass, datasetType, fiscalYear, scope) {
  const prefix = MUNICIPAL_SOURCE_PREFIXES[memberClass];
  if (!prefix) {
    throw new Error(
      `unknown member class ${JSON.stringify(memberClass)} — expected `
      + `${MUNICIPAL_CLASSES.join(', ')}`);
  }
  const face = DATASET_FACE[datasetType];
  if (!face) {
    throw new Error(
      `unknown dataset type ${JSON.stringify(datasetType)} — expected operating or revenue`);
  }
  const scopeFace = SCOPE_FACE[scope];
  if (!scopeFace) throw new Error(`unknown fund scope for source name: ${JSON.stringify(scope)}`);
  if (!Number.isInteger(fiscalYear)
      || fiscalYear < MUNICIPAL_FIRST_YEAR || fiscalYear > MUNICIPAL_LAST_YEAR) {
    throw new Error(
      `fiscal year ${fiscalYear} is not an integer in `
      + `FY${MUNICIPAL_FIRST_YEAR}-FY${MUNICIPAL_LAST_YEAR}`);
  }
  return `${prefix} — ${face}, ${scopeFace} (FY${fiscalYear} actual, self-reported)`;
}

/**
 * Is this entity-year ONE filing, covering ONE full twelve-month period?
 *
 * ⚠⚠⚠ IT TAKES THE WHOLE ENTITY-YEAR, NOT ONE ROW, AND THAT IS THE WHOLE
 * POINT. A per-row version of this check shipped and was wrong: Village of
 * Schoharie files BOTH `2019-06-01..2020-05-31` (365 days) AND
 * `2020-06-01..2020-12-31` (213 days) under CALENDAR_YEAR 2020. The first row
 * is the full year, so a first-row check PASSES — and the loader then sums
 * both periods into one total and publishes NINETEEN MONTHS AS A YEAR. Nothing
 * raises; the figure merely becomes ~58% too large, and it ties against itself.
 *
 * Three village-years are shaped like that, all fiscal-calendar transitions:
 *
 *     Village of Schoharie   FY2020   365d + 213d
 *     Village of Kiryas Joel FY2021   364d + 213d
 *     Village of Middleburgh FY2021   364d + 213d
 *
 * and one more carries a single 425-day period (Village of Bloomingburg
 * FY2023). All four are refused.
 *
 * ⚠ The 12-month half is NOT kept on its own. TT has no surface that says
 * which months a figure covers, so keeping one of the publisher's two filings
 * would mean TT silently choosing which one a reader sees — reinterpretation,
 * which this module does not do. The refusal is reported by name instead.
 *
 * ⚠ Returns `{ ok: true, checked: false }` for the 1995-2012 era, which
 * publishes no period bounds. That is not a silent pass: a transition REQUIRES
 * FISCAL_YEAR_END to change, and across every entity and every consecutive
 * pair of old-era years there are ZERO changes in all three classes. The old
 * era is affirmatively clean, not merely unchecked.
 */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FULL_YEAR_DAYS = Object.freeze(new Set([364, 365, 366]));

export function fiscalPeriodLength(row) {
  const s = row.periodStart;
  const e = row.periodEnd;
  if (!s || !e) return null; // old era — no bounds published
  if (!ISO_DATE_RE.test(String(s))) {
    throw new Error(`unrecognised PERIOD_START format: ${JSON.stringify(s)}`);
  }
  if (!ISO_DATE_RE.test(String(e))) {
    throw new Error(`unrecognised PERIOD_END format: ${JSON.stringify(e)}`);
  }
  // ⚠ UTC, not local. `new Date('2021-06-01')` is UTC midnight, but a
  // local-time constructor would straddle a DST boundary and yield 212.95
  // days, which floors to 212 and turns a clean comparison into an off-by-one.
  const ms = Date.parse(`${e}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/**
 * @param {object[]} rows  EVERY revenue/expenditure row of one entity-year
 * @returns {{ok: boolean, checked: boolean, periods: string[], days: number[], why: string|null}}
 */
export function isFullFiscalPeriod(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  if (list.length === 0) {
    throw new Error('isFullFiscalPeriod needs at least one row of the entity-year');
  }

  const seen = new Map(); // "start..end" -> days
  for (const r of list) {
    if (!r.periodStart || !r.periodEnd) continue;
    const k = `${r.periodStart}..${r.periodEnd}`;
    if (!seen.has(k)) seen.set(k, fiscalPeriodLength(r));
  }

  if (seen.size === 0) {
    return { ok: true, checked: false, periods: [], days: [], why: null };
  }

  const periods = [...seen.keys()];
  const days = [...seen.values()];

  if (seen.size > 1) {
    return {
      ok: false,
      checked: true,
      periods,
      days,
      why: `${seen.size} distinct fiscal periods filed under one CALENDAR_YEAR — `
        + 'summing them would publish more than twelve months as a year',
    };
  }

  const [d] = days;
  if (!FULL_YEAR_DAYS.has(d)) {
    return {
      ok: false,
      checked: true,
      periods,
      days,
      why: `the filed period is ${d} days, not a full year`,
    };
  }
  return { ok: true, checked: true, periods, days, why: null };
}

/**
 * Pre-flight a town/village/county roster before a seeder writes anything.
 *
 * ⚠⚠ THIS IS NOT `assertRosterHasNoNyc`, AND REUSING THAT ONE HERE IS A BUG.
 * It refuses any name matching /new york/i, and the village roster contains
 * **New York Mills**, a real government in Oneida County. New York City cannot
 * collide with these classes in the first place — it is a `city`, and
 * treasury_ensure_municipality keys on (name, state, entity_type) — so the
 * guard that matters here is the one on the roster's own internal consistency.
 */
export function assertMunicipalRoster(entities, memberClass) {
  const { entityType } = archiveFor(memberClass);
  const codes = new Set();
  const names = new Set();
  for (const e of entities) {
    if (e.entityType !== entityType) {
      throw new Error(
        `REFUSING: "${e.name}" is typed ${e.entityType}, but the ${memberClass} `
        + `archive may only produce ${entityType}`);
    }
    if (codes.has(e.municipalCode)) {
      throw new Error(`REFUSING: duplicate municipal code ${e.municipalCode} in the roster`);
    }
    codes.add(e.municipalCode);
    // ⚠⚠ THE COLLISION IS THE WHOLE POINT. treasury_ensure_municipality keys on
    // (name, state, entity_type), so two governments sharing a display name
    // collapse into ONE row carrying both budgets. Ten town names are each
    // shared by two towns; the generator county-qualifies them, and this
    // asserts it worked BEFORE the first write rather than after.
    const k = e.name.toLowerCase();
    if (names.has(k)) {
      throw new Error(
        `REFUSING: two ${entityType}s would both be named "${e.name}" — `
        + 'county-qualification did not separate them, and loading would collapse '
        + 'two governments into one entity');
    }
    names.add(k);
    if (k === 'new york') {
      throw new Error(`REFUSING: roster contains a government named "${e.name}"`);
    }
  }
}

/**
 * The never-overwrite guard, as a decision this time instead of an expression
 * buried in a loader that cannot be imported.
 *
 * True when `key` already holds a row that THIS loader family did not write —
 * i.e. another publisher's figure that must be preserved.
 *
 * @param {Map<string, string|null>} existing  key -> that row's `data_source`
 */
export function isForeignRow(existing, key, prefix) {
  // ⚠⚠ PRESENCE, NOT TRUTHINESS. `existing` maps key -> that row's
  // `data_source`, and a real row can carry NULL or ''. Testing `prior &&` made
  // such a row look ABSENT, so the loader overwrote it and still reported
  // "0 skipped by the never-overwrite guard" — a silent overwrite of another
  // publisher's figure, reported as a clean run.
  if (!existing.has(key)) return false;
  // A row of unknown provenance is preserved, exactly as '' is by the
  // `String(... || '')` form the other six loaders use.
  return !String(existing.get(key) ?? '').startsWith(prefix);
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
