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
/**
 * Split one CSV line into fields.
 *
 * ── ⚠⚠⚠ A QUOTE ONLY OPENS A FIELD AT THE FIELD'S START ─────────────────────
 *
 * This used to flip `inQuotes` on ANY `"`, anywhere. That is not CSV, and it
 * cost Plano real money. Its register writes inch marks in unquoted
 * descriptions —
 *
 *     ...,GLAND FIELD LOK D.I. 6"       ,1826350,PV,Municipal Warehouse,NORTH,910.8000
 *
 * — so the `"` opened a quoted field that never closed, and the whole rest of
 * the line collapsed into `description`. The row then had NO fund, NO payee
 * and NO amount, and was stored at $0.00.
 *
 * ⚠ MEASURED on FY2024: 455 lines carry an unbalanced inch mark; the
 * publisher's own file totals $462,672,864.36 over 29,557 rows while TT held
 * $461,886,142.73 over 28,863 — 694 rows and $786,721.63 gone.
 *
 * ⚠⚠ The file is otherwise CORRECT CSV: every field that contains a comma IS
 * quoted ("CAREY, JAMES"), all 7,036 of them. So the fix is not to abandon
 * quote handling, it is to apply the actual rule — a `"` is a delimiter only
 * as the first character of a field, and a literal everywhere else. Escaped
 * doubling (`""`) inside a quoted field still works.
 */
export function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let atFieldStart = true;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes) {
        // `""` inside a quoted field is one literal quote.
        if (line[i + 1] === '"') { current += '"'; i++; }
        // ⚠⚠ A closing quote must be followed by the delimiter or the end of
        // the line. Plano writes `"6"X15CM Paper Ruler, White PK "` — an inch
        // mark immediately after the OPENING quote, inside a field that also
        // contains a comma. Treating that `"` as the close split the field and
        // shifted every later column by one, which put "ARROW" in the amount.
        else if (line[i + 1] === undefined || line[i + 1] === ',') { inQuotes = false; }
        else { current += ch; }
      } else if (atFieldStart) {
        inQuotes = true;
      } else {
        // ⚠ An inch mark, not a delimiter. This is the whole fix.
        current += ch;
      }
      atFieldStart = false;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      atFieldStart = true;
    } else {
      current += ch;
      atFieldStart = false;
    }
  }
  result.push(current);
  return result;
}

/**
 * Is this buffer an XLSX workbook?
 *
 * ⚠⚠ CONTENT, NOT THE URL. The loader used to pick its parser with
 * `url.endsWith('.csv')`, which works only while every publisher is polite
 * about file extensions. Plano's own register serves CSV from
 *
 *   ReportExport.aspx?ET=AP&Detail=T&A=-1&...&SD=10/1/2022&ED=9/30/2023
 *
 * — a query string with no suffix at all — and a suffix test hands that CSV
 * straight to the XLSX parser.
 *
 * Every XLSX is a zip, so it starts `PK`. That is the same magic-byte reasoning
 * downloadViaCurl already uses to catch a WAF block page served as 200
 * text/html, and for the same reason: content-type is exactly what a wrong
 * response lies about.
 */
export function looksLikeXlsx(buffer) {
  return buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/**
 * ⚠ Guard the OTHER direction too. Without this, an HTML error page fed to the
 * CSV parser yields a header row of nonsense and zero data rows — a silent
 * empty load — where the XLSX parser would at least have thrown.
 */
export function looksLikeHtml(buffer) {
  const head = buffer.slice(0, 512).toString('utf8').trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<?xml');
}

/**
 * Rebuild a line that quote-aware parsing could not read, using the column
 * count the header already told us.
 *
 * ── ⚠⚠ WHY A FIXED-SCHEMA FALLBACK IS LEGITIMATE ────────────────────────────
 *
 * Some of Plano's fields are malformed CSV that no parser can read correctly
 * on its own, because the quoting is genuinely ambiguous:
 *
 *     "L" Reference Scale Reversible      decorative quotes, no inner comma
 *     "Slide Entry, 30", Tube Slide  "    an inch mark AND a comma
 *     "Platform-14x24", Approach Step"    the same shape again
 *
 * What rescues them is that the file has a KNOWN WIDTH. Split naively on every
 * comma and the arithmetic is forced: any surplus commas must live inside one
 * field, and the field they belong to is the one that opens with a quote.
 *
 * ⚠ Returns null when the arithmetic does NOT force an answer, so an
 * unreadable line is reported rather than guessed at. Guessing is how a
 * publisher's row quietly becomes a different row.
 */
export function repairFixedWidthRow(line, width) {
  const naive = line.split(',');
  if (naive.length === width) return naive;
  if (naive.length < width) return null;

  const surplus = naive.length - width;
  const j = naive.findIndex((f) => f.startsWith('"'));
  if (j === -1) return null;
  const merged = naive.slice(j, j + surplus + 1).join(',');
  return [...naive.slice(0, j), merged, ...naive.slice(j + surplus + 1)];
}

/** Strip the wrapping quotes of a field that both opens and closes with one. */
function unwrap(value) {
  const v = value ?? '';
  return v.length > 1 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
}

export function parseCSV(buffer) {
  const lines = buffer.toString('utf8').split(/\r?\n/);
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  let blankSkipped = 0;
  // ⚠ Counted and RETURNED, never swallowed. A line this function had to
  // reconstruct, or could not read at all, is exactly the kind of thing that
  // silently cost Plano 694 rows and $786,721.63.
  let repaired = 0;
  let unreadable = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { blankSkipped++; continue; }
    let values = splitCSVLine(line);
    if (values.length !== headers.length) {
      const fixed = repairFixedWidthRow(line, headers.length);
      if (fixed) { values = fixed.map(unwrap); repaired++; } else { unreadable++; }
    }
    const obj = {};
    headers.forEach((h, idx) => {
      const val = values[idx]?.trim() ?? null;
      obj[h] = val === '' ? null : val;
    });
    rows.push(obj);
  }

  return { headers, rows, blankSkipped, headerDupeSkipped: 0, repaired, unreadable };
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
