/**
 * ⚠ NO SHEBANG. tests/mckinneyLabels.test.mjs imports `rowsToMap` from this
 * file, and Vite's shebang strip corrupts a test-imported module — a guard in
 * tests/waSao.test.mjs enforces it. Run it with `node scripts/...` as usual.
 *
 * Extract McKinney's own department code -> name map from its Adopted Budget
 * Worksheets, and write it to scripts/data/mckinneyDepartments.json.
 *
 *   node scripts/extractMcKinneyDepartments.mjs            # fetch + extract
 *   node scripts/extractMcKinneyDepartments.mjs --check     # fail if JSON is stale
 *
 * ⚠⚠ WHY A SEPARATE ARTEFACT. The check register names no department (see
 * scripts/lib/mckinneyLabels.mjs). The Adopted Budget Worksheet does, in its
 * `Expenditure Budget` sheet, where the account number `fund-dept-object` sits
 * beside a `Department` and a `Division` column. Committing the extracted map
 * means the labels in the database can be traced to a published document and
 * re-derived by anyone, instead of living only in a migration nobody can audit.
 *
 * ⚠ mckinneytexas.org 403s a plain curl. The Sec-Fetch headers below are the
 * workaround first needed for the Oregon cities; keep them together.
 */
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts', 'data', 'mckinneyDepartments.json');
const CACHE = join(ROOT, 'cache', 'mckinney');

/** Archive.aspx?AMID=97 — "Adopted Budget Worksheets", one per fiscal year. */
export const WORKSHEETS = {
  2022: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2462',
  2023: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2535',
  2024: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2624',
  2025: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2707',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  Referer: 'https://www.mckinneytexas.org/Archive.aspx?AMID=97',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/** `001-4306-453.81-01` -> `4306`. Leading zeros stripped so `0000` -> `0`. */
export function departmentCode(accountNumber) {
  if (typeof accountNumber !== 'string') return null;
  const m = /^(\d{3})-(\d{4})-/.exec(accountNumber.trim());
  if (!m) return null;
  return { fund: m[1], code: m[2].replace(/^0+(?=\d)/, '') };
}

/**
 * Read worksheet rows into `{ code: { dept, div, fund } }`.
 *
 * Each row is `[Account Number, Fund, Department, Division]`.
 *
 * ⚠⚠ A code that resolves to TWO different (Department, Division) pairs is a
 * REFUSAL, not a majority vote. The whole value of this map is that it is the
 * publisher's unambiguous answer; if the publisher contradicts itself we must
 * see it rather than average it away. All four years are currently clean.
 *
 * ⚠ `div` is null when the worksheet leaves it blank or writes `-`, which is
 * what NON-DEPARTMENTAL (9999) does. An earlier pass required a non-empty
 * Division and so silently dropped 9999 — the second-largest root in some
 * years. Requiring a field the publisher legitimately omits is a way to lose
 * exactly the rows that matter most.
 *
 * ⚠⚠⚠ THIS IS A PURE FUNCTION OVER ROWS, and `extractSheet` is a four-line
 * adapter onto it, because a test that builds its own inputs proves nothing
 * about the step that reads the file. The San Jose repair passed 22 tests with
 * the entire fix reverted for exactly that reason. tests/mckinneyLabels.test.mjs
 * drives this with verbatim rows from the published worksheet.
 */
export function rowsToMap(rows) {
  const map = {};
  const seen = new Map();
  for (const row of rows) {
    const parsed = departmentCode(text(row[0]));
    if (!parsed) continue;
    const dept = text(row[2]);
    if (!dept) continue;
    let div = text(row[3]);
    if (div === '-') div = null;
    const fund = text(row[1]);

    const key = `${dept}\u0000${div ?? ''}`;
    if (!seen.has(parsed.code)) seen.set(parsed.code, new Set());
    seen.get(parsed.code).add(key);
    if (!map[parsed.code]) map[parsed.code] = { dept, div, fund };
  }

  const ambiguous = [...seen].filter(([, v]) => v.size > 1);
  if (ambiguous.length) {
    const shown = ambiguous.slice(0, 3)
      .map(([c, v]) => `${c}: ${[...v].map((s) => s.replace('\u0000', ' / ')).join('  |  ')}`);
    throw new Error(
      `${ambiguous.length} McKinney department code(s) carry MORE THAN ONE name in the same ` +
      `worksheet. The map is only trustworthy because the publisher is unambiguous; it is not.` +
      `\n  ${shown.join('\n  ')}`,
    );
  }
  return map;
}

/** Adapter: an ExcelJS worksheet -> the row arrays `rowsToMap` judges. */
export function extractSheet(worksheet) {
  const rows = [];
  worksheet.eachRow((row) => rows.push([1, 2, 3, 4].map((i) => cell(row, i))));
  return rowsToMap(rows);
}

function cell(row, i) {
  const v = row.getCell(i).value;
  if (v && typeof v === 'object') return v.result ?? v.text ?? v.richText?.map((r) => r.text).join('') ?? null;
  return v;
}
function text(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function workbookFor(fy, url) {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `worksheet-${fy}.xlsx`);
  if (!existsSync(path)) {
    process.stdout.write(`  fetching FY${fy} ... `);
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`FY${fy} ${url} -> HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || '';
    if (!type.includes('spreadsheet')) {
      throw new Error(`FY${fy} returned ${type}, not a spreadsheet — the WAF probably served HTML.`);
    }
    writeFileSync(path, buf);
    process.stdout.write(`${(buf.length / 1024).toFixed(0)} KB\n`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  return wb;
}

async function main() {
  const check = process.argv.includes('--check');
  const byYear = {};
  for (const [fy, url] of Object.entries(WORKSHEETS)) {
    const wb = await workbookFor(fy, url);
    const sheet = wb.getWorksheet('Expenditure Budget');
    if (!sheet) throw new Error(`FY${fy}: no "Expenditure Budget" sheet (got ${wb.worksheets.map((w) => w.name).join(', ')})`);
    const map = extractSheet(sheet);
    const n = Object.keys(map).length;
    if (n < 80) throw new Error(`FY${fy}: only ${n} department codes — the sheet layout has moved.`);
    byYear[fy] = map;
    console.log(`  FY${fy}: ${n} department codes named by the publisher`);
  }

  const payload = {
    _source: 'City of McKinney, Adopted Budget Worksheets (Archive.aspx?AMID=97), "Expenditure Budget" sheet',
    _urls: WORKSHEETS,
    _extracted: new Date().toISOString().slice(0, 10),
    _note: 'Publisher strings verbatim and ALL CAPS. Casing is applied at label time by scripts/lib/mckinneyLabels.mjs.',
    byYear,
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  if (check) {
    const have = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    const strip = (s) => s.replace(/"_extracted": "[^"]*"/, '');
    if (strip(have) !== strip(json)) {
      console.error('❌ scripts/data/mckinneyDepartments.json is stale — re-run without --check.');
      process.exitCode = 1;
      return;
    }
    console.log('✅ committed map matches the publisher worksheets');
    return;
  }

  writeFileSync(OUT, json);
  console.log(`\nwrote ${OUT}`);
}

// ⚠ `file://${argv[1]}` does NOT match import.meta.url on Windows — Node emits
// `file:///C:/...` with three slashes, so the naive guard silently runs nothing
// and the script "succeeds" having done no work. pathToFileURL is the portable
// comparison.
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
