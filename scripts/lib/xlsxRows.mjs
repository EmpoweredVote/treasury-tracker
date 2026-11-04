/**
 * Reading an XLSX or CSV export into rows, and keying each row for dedup.
 *
 * ⚠⚠⚠ MOVED OUT OF scripts/bulkLoadXLSX.js UNCHANGED so that anything measuring
 * the loader measures THE LOADER. The dedup key is the one thing here that
 * decides whether a published figure matches its source, and a measurement that
 * re-implemented the parse or the hash would be measuring something else and
 * would agree with the loader only by luck.
 *
 * `hashRow` becomes `transactions.source_row_id`, and
 * `treasury_sync_transactions` does ON CONFLICT (budget_id, source_row_id) DO
 * NOTHING — so two rows that hash alike are ONE row in the database.
 */
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';

// ── Download ───────────────────────────────────────────────────────────
export async function downloadXLSX(url) {
  // Local file support for manual exports (e.g., Plano)
  if (url.startsWith('file://')) {
    const filePath = decodeURIComponent(url.replace(/^file:\/\/\/?/, '').replace(/\//g, path.sep || '\\'));
    console.log('  Reading local file: ' + filePath);
    return readFileSync(filePath);
  }
  if (!url.startsWith('http')) {
    console.log('  Reading local file: ' + url);
    return readFileSync(url);
  }
  let resp = null;
  try {
    resp = await fetch(url, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (e) {
    console.warn('  fetch() threw (' + e.message + ') — retrying with curl');
  }

  if (resp && resp.ok) {
    const contentType = resp.headers.get('content-type') || '';
    // ⚠ HTML is a REFUSAL, not a warning. A WAF block page and a login wall
    // both arrive as 200 text/html, and handing one to ExcelJS yields zero rows
    // — which reads as "the publisher removed the data" rather than "we were
    // blocked". Other types are only warned about: some sources legitimately
    // serve csv or octet-stream.
    if (contentType.includes('text/html')) {
      throw new Error(
        'Download returned HTML, not a spreadsheet: ' + url + ' (content-type "' + contentType + '"). ' +
        'This is a block page or an error page, not data. Refusing to parse it as a workbook.',
      );
    }
    if (!contentType.includes('spreadsheet') && !contentType.includes('excel') && !contentType.includes('octet-stream')) {
      console.warn('  Warning: unexpected content-type "' + contentType + '" — may not be XLSX');
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  // ⚠⚠⚠ THIS LOADER COULD NOT DOWNLOAD McKINNEY AT ALL. mckinneytexas.org's WAF
  // refuses Node with a flat 403 — not for want of headers: the identical
  // User-Agent, Sec-Fetch trio, Referer and Accept all still 403 from fetch()
  // while curl is let straight through, so it is the TLS/client fingerprint
  // being matched, not anything we can set. Every reload of a source TT
  // publishes would have failed at the first byte, which makes "durable against
  // a reload" moot.
  //
  // curl is already how this repo fetches from hosts that block us (see
  // fetchInCountyAcfrs.mjs, fetchScCityWaveAcfrs.mjs and a dozen others).
  console.warn('  fetch() refused (HTTP ' + (resp ? resp.status : 'none') + ') — retrying with curl');
  return downloadViaCurl(url);
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Fetch with curl, which some publishers' WAFs allow where Node is refused.
 *
 * ⚠ Verified by MAGIC BYTES, not content-type. A block page served as 200
 * text/html is the failure mode this guards, and the content-type is exactly
 * what such a page lies about. Every XLSX is a zip, so it starts `PK`.
 */
function downloadViaCurl(url) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tt-xlsx-'));
  const file = path.join(dir, 'download.bin');
  const args = ['-sS', '-L', '--max-time', '600', '-o', file];
  for (const [k, v] of Object.entries(BROWSER_HEADERS)) args.push('-H', k + ': ' + v);
  args.push(url);

  const r = spawnSync('curl', args, { encoding: 'utf8' });
  if (r.error) throw new Error('curl is not available to retry ' + url + ': ' + r.error.message);
  if (r.status !== 0) throw new Error('curl failed for ' + url + ': ' + (r.stderr || 'exit ' + r.status));

  const buf = readFileSync(file);
  rmSync(dir, { recursive: true, force: true });

  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    const head = buf.slice(0, 200).toString('utf8').replace(/\s+/g, ' ');
    throw new Error(
      'curl fetched ' + buf.length + ' bytes from ' + url + ' that are not a zip/XLSX ' +
      '(starts: "' + head + '"). A block page, not data — refusing to parse it.',
    );
  }
  return buf;
}


// ── CSV parsing helpers ─────────────────────────────────────────────
export function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseCSV(buffer) {
  const lines = buffer.toString('utf8').split(/\r?\n/);
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  let blankSkipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { blankSkipped++; continue; }
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      const val = values[idx]?.trim() ?? null;
      obj[h] = val === '' ? null : val;
    });
    rows.push(obj);
  }

  return { headers, rows, blankSkipped, headerDupeSkipped: 0 };
}

// ── Parse helper ──────────────────────────────────────────────────
export async function parseXLSX(buffer, cm = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  const headerRow = cm.header_row || 1;

  let headers = [];
  const rows = [];
  let blankSkipped = 0;
  let headerDupeSkipped = 0;

  worksheet.eachRow((row, rowNumber) => {
    // CRITICAL: ExcelJS row.values[0] is always null (1-indexed) — slice(1)
    const values = row.values.slice(1);

    if (rowNumber < headerRow) return; // skip title rows before header row

    if (rowNumber === headerRow) {
      // Normalize header row
      headers = values.map(v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_'));
      return;
    }

    // Skip blank rows
    if (values.every(v => v == null || v === '')) {
      blankSkipped++;
      return;
    }

    // Build row object, convert special ExcelJS cell types
    const obj = {};
    headers.forEach((h, i) => {
      let val = values[i] ?? null;

      // Convert ExcelJS Date objects to ISO date string
      if (val instanceof Date) {
        val = val.toISOString().slice(0, 10);
      }
      // Flatten rich-text cell objects to plain string
      else if (val && typeof val === 'object' && val.richText) {
        val = val.richText.map(t => t.text).join('');
      }
      // Flatten hyperlink objects to their text/value
      else if (val && typeof val === 'object' && val.text !== undefined) {
        val = val.text;
      }
      // Flatten formula cells to their computed result
      else if (val && typeof val === 'object' && val.formula !== undefined) {
        val = val.result ?? null;
        if (val instanceof Date) val = val.toISOString().slice(0, 10);
      }

      obj[h] = val;
    });

    // Skip header-duplicate rows (row where column values match the header names)
    if (headers.some(h => h && String(obj[h] ?? '').toLowerCase() === h)) {
      headerDupeSkipped++;
      return;
    }

    // Skip footer/summary rows: first column contains 'total', 'subtotal', 'grand total', etc.
    const firstVal = String(obj[headers[0]] ?? '').trim().toLowerCase();
    if (firstVal === 'total' || firstVal === 'subtotal' || firstVal === 'grand total' || firstVal === 'totals') {
      blankSkipped++;
      return;
    }

    rows.push(obj);
  });

  return { headers, rows, blankSkipped, headerDupeSkipped };
}

// ── SHA-256 row hash ──────────────────────────────────────────────
export function hashRow(obj) {
  // Sort keys BEFORE JSON.stringify to ensure deterministic hash across runs
  const sorted = Object.keys(obj).sort().reduce((acc, k) => {
    acc[k] = obj[k] instanceof Date ? obj[k].toISOString() : obj[k];
    return acc;
  }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── Amount parser ───────────────────────────────────────────────────
export function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  // Strip $, commas; convert parenthetical negatives (123) → -123
  return parseFloat(String(v).replace(/[$,]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Dedup policy ─────────────────────────────────────────────────────────────

/**
 * The `source_row_id` for every row in a file, in order.
 *
 * ⚠⚠⚠ WHY THIS IS NOT JUST hashRow(). `treasury_sync_transactions` inserts
 * ON CONFLICT (budget_id, source_row_id) DO NOTHING, so two rows that key alike
 * become ONE row in the database. A content hash therefore reads "every
 * published column matches" as "this is the same row" — which is right when a
 * publisher exports a line twice, and WRONG when a government genuinely does
 * the same thing twice.
 *
 * McKinney bought four police Tahoes at $52,962.25 on one purchase order: four
 * identical lines, of which TT kept one. Measured across its four registers the
 * loss is $2,821,382.19, and the publisher's own `Total` row proves it to the
 * cent.
 *
 * ⚠⚠ BUT THE ANSWER IS PER PUBLISHER, WHICH IS WHY THIS IS OPT-IN. Plano prints
 * a DocumentNumber, and its largest repeated groups repeat that too — document
 * 16038 pays TMRS $3,482,404.02 twice on one day. A city does not pay its
 * pension fund the same amount twice in one February payment; that is export
 * duplication, and collapsing it is correct. Switching Plano to 'occurrence'
 * would inflate it by about $25M. Default stays 'content'.
 *
 * ⚠ `occurrence` leaves the FIRST of a group keyed exactly as 'content' does,
 * and only suffixes the second and later copies. So turning the policy on for a
 * source ADDS its missing rows on the next load rather than re-keying the rows
 * already stored — no force-reload required, and no duplicate if one happens.
 *
 * ⚠⚠ MUST BE COMPUTED OVER THE WHOLE FILE. The loader sends rows to the RPC in
 * chunks of 500; counting occurrences inside a chunk would give two identical
 * rows in different chunks the same key and collapse them anyway.
 */
export function rowKeys(rows, policy = 'content') {
  const hashes = rows.map(hashRow);
  if (policy !== 'occurrence') return hashes;
  const seen = new Map();
  return hashes.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h}#${n}`;
  });
}
