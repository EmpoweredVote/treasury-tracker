/**
 * Fetch the Indiana Gateway Annual Financial Report extracts.
 *
 * NO SHEBANG — tests/indianaGatewayFetch.test.mjs imports this module, and a
 * shebang checked out with CRLF makes vitest's esbuild transform fail with
 * "SyntaxError: Invalid or unexpected token" on Windows only. The repo guards
 * that in tests/waSao.test.mjs, which is what caught it here. Same note as
 * scripts/lib/inGateway.mjs and scripts/loadIndianaGateway.mjs.
 *
 * Free, anonymous, no key, no ToS gate. Writes the six files
 * scripts/loadIndianaGateway.mjs expects, plus any extra report/unit-type pair
 * asked for on the command line.
 *
 * Usage:
 *   node scripts/fetchIndianaGateway.mjs --dir _acfr-work/in            # the six
 *   node scripts/fetchIndianaGateway.mjs --dir _acfr-work/in --probe    # options only
 *   node scripts/fetchIndianaGateway.mjs --dir _acfr-work/in \
 *        --report "Detailed Receipts" --unit-type Township --year 2024
 *
 * ── ⚠⚠ STREAMED TO DISK, NOT READ INTO A STRING ─────────────────────────────
 *
 * The city receipts file with year=All is ~122 MB / 616k lines and the county
 * side is comparable. `await res.text()` on six of those is how a fetch script
 * dies on the heap half way through, having proven nothing. Every response is
 * piped straight to a file and only the FIRST LINE is held in memory.
 *
 * ── ⚠⚠ THE OPTION LISTS ARE READ FROM THE PAGE, NEVER ASSUMED ───────────────
 *
 * Measured from the live page 2026-09-05, and two recorded claims were wrong:
 *
 *   DropDownListYear      2026..2012 + "All"   (SIXTEEN options — the earliest
 *                                              explicit year is 2012, NOT 2011)
 *   DropDownListUnitType  All County Township City/Town School Library Special
 *                                              (SEVEN — "Special" was unrecorded)
 *   RadComboBox1          Annual Financial Reports | Budget Data |
 *                         Entity Annual Report | School Extra-Curricular Accounts
 *   RadComboBox2          13 reports
 *
 * ⚠ So `--year All` is offered and works, but "All spans 2011-2025" is NOT what
 * the control says. `--probe` re-reads all four lists and prints them; run it
 * before trusting any of the above, and assert the value you are about to send
 * is actually on offer rather than discovering server-side that it is not.
 *
 * ⚠ `DropDownList1`, `DropDownList2` and `DropDownList3` on the same page belong
 * to a DIFFERENT form (property-tax billing by county — DropDownList3 is the
 * 92-county picker plus "All Counties" at -99). They are not part of the AFR
 * download and must not be sent with it.
 *
 * ── ⚠⚠ WHAT "IT WORKED" HAS TO MEAN ────────────────────────────────────────
 *
 * Gateway answers a malformed request with HTTP 200 and an HTML page. A fetcher
 * that checks only `res.ok` writes that page to disk under a .txt name and the
 * next stage reports "0 rows parsed" three steps away from the cause. So each
 * download is refused unless ALL of these hold:
 *
 *   1. content-type is not HTML
 *   2. the first line is pipe-delimited and carries EVERY column the loader
 *      needs for that report — by NAME, case-insensitively, because Gateway is
 *      inconsistent (`Receipt_Class_Name` vs `class_name`, `Fund_code` vs
 *      `fund_code`) and the four AFR reports do NOT share a column ORDER
 *   3. more than one line came back
 *   4. the file is not suspiciously small for a statewide extract
 *
 * ⚠ The served header is the ONLY authority on what columns exist.
 * `FileLayoutDocumentation_AFR.xls` is stamped "UPDATED 4/7/2020" and omits five
 * columns the files actually carry — `sboa_id`, `fund_name`, `section`,
 * `r_exceptions`, `d_exceptions` — plus `fund_code` on Cash and Investments.
 * See reference_indiana_gateway_afr.
 *
 * ⚠⚠ `sboa_id` is one of the columns the documentation omits, and it is the one
 * that matters most: `(cnty_cd, unit_code)` is NOT a unique government. 77 keys
 * in FY2024 carry two governments each, four of them a city or town sharing with
 * a fire district / airport / transit authority / township. Do not build a
 * roster on the pair.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, stat, open, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

export const GATEWAY_URL = 'https://gateway.ifionline.org/public/download.aspx';
const UA = 'EmpoweredVote-TreasuryTracker/1.0 (+https://treasurytracker.empowered.vote)';

/** Columns each report must carry for the loader to work. Checked by NAME. */
export const REQUIRED_COLUMNS = {
  'Detailed Receipts': [
    'year', 'cnty_cd', 'unit_code', 'sboa_id', 'afr_unit_type', 'unit_name',
    'ent_name', 'fund_code', 'unit_fund_number', 'fund_name',
    'receipt_class_name', 'receipt_code', 'receipt_name', 'amount',
  ],
  'Disbursements by Fund': [
    'year', 'cnty_cd', 'unit_code', 'sboa_id', 'afr_unit_type', 'unit_name',
    'ent_name', 'fund_code', 'unit_fund_number', 'fund_name',
    'class_name', 'disburse_code', 'disburse_name', 'amount',
  ],
  'Cash and Investments': [
    'year', 'cnty_cd', 'unit_code', 'sboa_id', 'afr_unit_type', 'unit_name',
    'ent_name', 'fund_code', 'unit_fund_number', 'fund_name',
    'beg_cash_inv', 'r_bal', 'd_bal', 'cash_bal',
  ],
};

/** The six the loader reads. `file` names match loadIndianaGateway.mjs. */
export const STANDARD_PULLS = [
  { report: 'Detailed Receipts', unitType: 'City/Town', year: 'All', file: 'rec_city_ALL.txt' },
  { report: 'Detailed Receipts', unitType: 'County', year: 'All', file: 'rec_county_ALL.txt' },
  { report: 'Disbursements by Fund', unitType: 'City/Town', year: 'All', file: 'disfund_city_ALL.txt' },
  { report: 'Disbursements by Fund', unitType: 'County', year: 'All', file: 'disfund_county_ALL.txt' },
  { report: 'Cash and Investments', unitType: 'City/Town', year: 'All', file: 'cash_city_ALL.txt' },
  { report: 'Cash and Investments', unitType: 'County', year: 'All', file: 'cash_county_ALL.txt' },
];

/** A statewide all-years extract below this is not a statewide all-years extract. */
const MIN_BYTES_ALL_YEARS = 2_000_000;

export function formValue(html, field) {
  const i = html.indexOf(`id="${field}"`);
  if (i === -1) return '';
  const rest = html.slice(i);
  const v = rest.indexOf('value="');
  if (v === -1) return '';
  const after = rest.slice(v + 7);
  const e = after.indexOf('"');
  return e === -1 ? '' : after.slice(0, e);
}

/** Read one <select>'s option VALUES out of the page. */
export function optionValues(html, selectId) {
  const i = html.indexOf(`id="ctl00_ContentPlaceHolder1_${selectId}"`);
  if (i === -1) return null;
  const seg = html.slice(i);
  const end = seg.indexOf('</select>');
  if (end === -1) return null;
  const body = seg.slice(0, end);
  const out = [];
  const re = /<option[^>]*?value="([^"]*)"[^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1] || m[2].trim());
  return out;
}

/** GET the form and return its tokens plus the four option lists. */
export async function readForm() {
  const res = await fetch(GATEWAY_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${GATEWAY_URL} -> HTTP ${res.status}`);
  const html = await res.text();
  const tokens = {
    __VIEWSTATE: formValue(html, '__VIEWSTATE'),
    __EVENTVALIDATION: formValue(html, '__EVENTVALIDATION'),
    __VIEWSTATEGENERATOR: formValue(html, '__VIEWSTATEGENERATOR'),
  };
  // ⚠ A missing ViewState means the page changed shape. Stop; do not POST a
  // form the server will answer with HTML that we then write to a .txt file.
  if (!tokens.__VIEWSTATE || !tokens.__EVENTVALIDATION) {
    throw new Error('REFUSING: no ASP.NET ViewState tokens — the page changed shape.');
  }
  return {
    tokens,
    cookie: res.headers.get('set-cookie') || '',
    options: {
      RadComboBox1: optionValues(html, 'RadComboBox1'),
      RadComboBox2: optionValues(html, 'RadComboBox2'),
      DropDownListUnitType: optionValues(html, 'DropDownListUnitType'),
      DropDownListYear: optionValues(html, 'DropDownListYear'),
    },
  };
}

/**
 * Assert the header line carries every column the report needs.
 * ⚠ Case-insensitive and by NAME. A positional check would pass on the
 * by-department report, whose cnty_cd and cnty_description are transposed.
 */
export function checkHeader(headerLine, report) {
  if (!headerLine || !headerLine.includes('|')) {
    return { ok: false, why: `first line is not pipe-delimited: ${JSON.stringify(String(headerLine).slice(0, 120))}` };
  }
  const have = new Set(headerLine.split('|').map((h) => h.trim().toLowerCase()).filter(Boolean));
  const need = REQUIRED_COLUMNS[report];
  if (!need) return { ok: true, columns: have.size, unchecked: true };
  const missing = need.filter((c) => !have.has(c));
  if (missing.length) return { ok: false, why: `header is missing ${missing.join(', ')}`, columns: have.size };
  return { ok: true, columns: have.size };
}

/** First line of a file, without reading the rest of it. */
async function firstLine(path) {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(64 * 1024);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    const text = buf.subarray(0, bytesRead).toString('utf8');
    const nl = text.search(/\r?\n/);
    return nl === -1 ? text : text.slice(0, nl);
  } finally {
    await fh.close();
  }
}

async function countLines(path) {
  const fh = await open(path, 'r');
  try {
    let lines = 0;
    const buf = Buffer.alloc(1 << 20);
    let pos = 0;
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
      if (!bytesRead) break;
      pos += bytesRead;
      for (let i = 0; i < bytesRead; i++) if (buf[i] === 10) lines++;
    }
    return lines;
  } finally {
    await fh.close();
  }
}

export async function download({ report, unitType, year, file, dir, form }) {
  const { tokens, cookie, options } = form;

  // ⚠ Assert the value is on offer BEFORE sending it. Gateway answers an
  // unknown value with HTTP 200 + HTML, which is the failure mode this whole
  // script exists to refuse.
  const offer = (list, value, label) => {
    if (list && !list.includes(value)) {
      throw new Error(`REFUSING: ${label}=${JSON.stringify(value)} is not offered. On offer: ${list.join(' | ')}`);
    }
  };
  offer(options.RadComboBox2, report, 'report');
  offer(options.DropDownListUnitType, unitType, 'unit-type');
  offer(options.DropDownListYear, String(year), 'year');

  const body = new URLSearchParams({
    ...tokens,
    'ctl00$ContentPlaceHolder1$RadComboBox1': 'Annual Financial Reports',
    'ctl00$ContentPlaceHolder1$RadComboBox2': report,
    'ctl00$ContentPlaceHolder1$DropDownListUnitType': unitType,
    'ctl00$ContentPlaceHolder1$DropDownListYear': String(year),
    'ctl00$ContentPlaceHolder1$button_download1': 'Download',
  });

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Cookie: cookie,
    },
    body: body.toString(),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`POST -> HTTP ${res.status}`);
  const ctype = res.headers.get('content-type') || '';
  if (/html/i.test(ctype)) {
    throw new Error(`REFUSING: Gateway answered with ${ctype} — the form parameters are wrong, `
      + 'and writing this to a .txt would surface three steps later as "0 rows parsed".');
  }
  if (!res.body) throw new Error('REFUSING: response had no body');

  const path = join(dir, file);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));

  const { size } = await stat(path);
  const header = await firstLine(path);
  const hdr = checkHeader(header, report);
  if (!hdr.ok) throw new Error(`REFUSING ${file}: ${hdr.why}`);
  const lines = await countLines(path);
  if (lines < 2) throw new Error(`REFUSING ${file}: ${lines} line(s) — a header with no data is not an extract`);
  if (String(year) === 'All' && size < MIN_BYTES_ALL_YEARS) {
    throw new Error(`REFUSING ${file}: ${size} bytes for a statewide all-years extract. `
      + 'Too small to be what was asked for.');
  }
  return {
    file, path, size, lines, columns: hdr.columns, header,
    disposition: res.headers.get('content-disposition'),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/in' },
      report: { type: 'string' },
      'unit-type': { type: 'string' },
      year: { type: 'string' },
      probe: { type: 'boolean', default: false },
      retries: { type: 'string', default: '3' },
    },
  });

  const form = await readForm();
  console.log('Indiana Gateway — options READ FROM THE PAGE, not assumed:');
  for (const [k, v] of Object.entries(form.options)) {
    console.log(`  ${k.padEnd(22)} ${v ? `${v.length}: ${v.join(' | ')}` : '(not a <select>)'}`);
  }
  if (values.probe) return;

  await mkdir(values.dir, { recursive: true });
  const pulls = values.report
    ? [{
        report: values.report,
        unitType: values['unit-type'] ?? 'All',
        year: values.year ?? 'All',
        file: `${values.report.replace(/[^A-Za-z0-9]+/g, '')}_${(values['unit-type'] ?? 'All').replace(/\W+/g, '')}_${values.year ?? 'All'}.txt`,
      }]
    : STANDARD_PULLS;

  const maxRetries = Number(values.retries);
  const done = [];
  let failed = 0;
  for (const p of pulls) {
    console.log(`\n── ${p.report} · ${p.unitType} · ${p.year} -> ${p.file}`);
    let lastErr = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // ⚠ Fresh tokens per attempt: a ViewState is single-use in practice and
        // a retry with a stale one comes back as HTML, i.e. as a DIFFERENT error
        // than the one being retried.
        const fresh = attempt === 1 ? form : await readForm();
        const r = await download({ ...p, dir: values.dir, form: fresh });
        console.log(`   ✅ ${(r.size / 1048576).toFixed(1)} MB · ${r.lines.toLocaleString()} lines · `
          + `${r.columns} columns · ${r.disposition ?? 'no disposition'}`);
        done.push(r);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.log(`   attempt ${attempt}/${maxRetries} failed: ${e.message}`);
      }
    }
    if (lastErr) { failed++; console.error(`   ✗ GAVE UP on ${p.file}: ${lastErr.message}`); }
  }

  console.log(`\n${done.length} of ${pulls.length} downloaded into ${values.dir}`);
  for (const r of done) {
    console.log(`  ${r.file.padEnd(24)} ${(r.size / 1048576).toFixed(1).padStart(7)} MB  ${r.lines.toLocaleString().padStart(10)} lines`);
  }

  /**
   * ── ⚠⚠ A MANIFEST, BECAUSE THE DOWNLOAD DIRECTORY MIXES VINTAGES ──────────
   *
   * Observed in `_acfr-work/in` on 2026-09-05: `disfund_county_ALL.txt` was 7
   * days older than the other files, left over from the PR #113 session (which
   * fetched via an uncommitted ad-hoc `gw.mjs` that checked nothing). Because
   * each download overwrites in place, a run where one file FAILS leaves the
   * previous run's copy sitting there, with the right name and a plausible size
   * — so the loader reads five files from today and one from a week ago and
   * nothing anywhere says so.
   *
   * This records what THIS run actually wrote. A consumer can then assert that
   * every file it opens belongs to one run, instead of trusting a filename.
   */
  if (!values.report) {
    const manifest = {
      _what: 'What one run of fetchIndianaGateway.mjs wrote. Assert against it before '
        + 'loading: a file present but absent here, or with a different size, is a '
        + 'LEFTOVER from an earlier fetch, not part of this one.',
      fetched_at: new Date().toISOString(),
      source_url: GATEWAY_URL,
      complete: failed === 0,
      files: Object.fromEntries(done.map((r) => [r.file, {
        size: r.size, lines: r.lines, columns: r.columns, header: r.header,
      }])),
    };
    const path = join(values.dir, 'gateway-manifest.json');
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`\nmanifest -> ${path} (complete: ${manifest.complete})`);
  }

  // ⚠ A fetch that half-worked must not exit 0. The next stage would read a
  // directory it believes is complete.
  if (failed) { console.error(`\n✗ ${failed} download(s) failed — the directory is INCOMPLETE.`); process.exit(1); }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('fetchIndianaGateway.mjs')) await main();
