/**
 * Fetch Pennsylvania DCED Municipal Statistics statewide extracts.
 *
 * NO SHEBANG — kept importable; tests import `formFields` and `looksLikeXls`.
 *
 * Usage:
 *   node scripts/fetchPaDced.mjs                          # both reports, FY2015-2024
 *   node scripts/fetchPaDced.mjs --year 2024
 *   node scripts/fetchPaDced.mjs --report StatewideCountyAfr --year 2023
 *   node scripts/fetchPaDced.mjs --out _acfr-work/pa/xls
 *
 * Then convert, because ExcelJS cannot open BIFF8 at all:
 *   python scripts/tools/xlsToXlsx.py _acfr-work/pa/xls _acfr-work/pa/xlsx --check
 *
 * ⚠ This existed only as an ad-hoc script in the gitignored work directory until
 * the statewide sweep. A cache that cannot be reproduced from the repository is
 * not a source; it is a local artefact.
 *
 * ── ⚠⚠ IT LOOKS EXACTLY LIKE THE COLORADO DOLA TRAP AND IT IS NOT ──────────
 *
 * `apps.dced.pa.gov/munstats-public/` is ASP.NET WebForms with `__VIEWSTATE` and
 * an embedded Microsoft SSRS ReportViewer. Every framework signal says
 * stateful-app-behind-a-gate, which is what makes Colorado's DOLA compendium
 * unfetchable.
 *
 * **`btnDisplay` streams the file directly.** The POST response is
 * `application/vnd.ms-excel` with `Content-Disposition: attachment` and OLE2
 * magic bytes. No report session, no ExecutionID, no export handshake, no auth,
 * no API key, no ToS gate.
 *
 * Second consecutive campaign session where a ViewState app was not its
 * framework (Georgia's was a navigator over static .xls). **Probe before
 * classifying an app by its framework.**
 *
 * ── ⚠⚠ SAVE THE RESPONSE AS A BUFFER, AND FINGERPRINT IT ───────────────────
 *
 * Reading the response as text turns every high byte into U+FFFD. The file is
 * still ~1.5 MB and still "looks" like a page, so nothing downstream complains
 * until the parse produces nonsense. Only the first bytes reveal the truth, so
 * `looksLikeXls` checks the OLE2 magic `d0cf11e0a1b11ae1` and the fetch refuses
 * anything else. ⚠ Never trust Content-Type: fingerprint the bytes.
 *
 * ── ⚠⚠ THE BYTES CHANGE ON EVERY FETCH AND THE CONTENT DOES NOT ────────────
 *
 * DCED generates each workbook on demand and stamps it, so re-fetching the SAME
 * report-year yields a different md5 every time. Measured on
 * `StatewideCountyAfr_2024`, cached 2026-08-29 against a fresh pull 2026-09-03:
 * two different digests, and then **zero differences in content** — same 67
 * rows, same 60 approved, identical revenue and expenditure on every one.
 *
 * So a checksum is NOT a freshness or integrity test for this source. Comparing
 * digests would report drift on every run and hide real drift in the noise.
 * Compare the PARSED CONTENT instead, which is what
 * scripts/buildPaStatewideEntities.mjs reads anyway.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, '_acfr-work/pa/xls');

export const BASE = 'https://apps.dced.pa.gov/munstats-public/';

/** The two statewide extracts, and their published shapes. */
export const REPORTS = Object.freeze({
  StatewideMuniAfr: { rows: 2572, cols: 71, label: 'municipalities' },
  StatewideCountyAfr: { rows: 67, cols: 128, label: 'counties' },
});

/**
 * ⚠ FY2015 IS THE FLOOR THIS PARSER SUPPORTS, not the earliest year DCED serves.
 * DCED offers 1996 onward, but the pre-2015 extract is a DIFFERENT REPORT: the
 * 2005 municipal file shares only 8 of 2023's 71 column names and has no
 * `Municipality ID`, no `Pending/Approved` and no `Total Revenues`. Fetching it
 * succeeds and parsing it does not.
 */
export const FIRST_YEAR = 2015;
export const LAST_YEAR = 2024;

/** OLE2 / BIFF8 magic. */
export const XLS_MAGIC = 'd0cf11e0a1b11ae1';

export function looksLikeXls(buf) {
  return Buffer.isBuffer(buf) && buf.length > 8 && buf.subarray(0, 8).toString('hex') === XLS_MAGIC;
}

/**
 * Pull one `value="..."` out of a rendered ASP.NET page by element id.
 * ⚠ Deliberately not a regex over the whole document: `__VIEWSTATE` runs to tens
 * of kilobytes and a greedy pattern is both slow and easy to get wrong.
 */
export function fieldValue(html, id) {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) return '';
  const rest = html.slice(at);
  const v = rest.indexOf('value="');
  if (v < 0) return '';
  const after = rest.slice(v + 7);
  const end = after.indexOf('"');
  return end < 0 ? '' : after.slice(0, end);
}

/** The POST body that makes `btnDisplay` stream the workbook. */
export function formFields(html, year) {
  const fd = new URLSearchParams();
  fd.set('__VIEWSTATE', fieldValue(html, '__VIEWSTATE'));
  fd.set('__VIEWSTATEGENERATOR', fieldValue(html, '__VIEWSTATEGENERATOR'));
  const ev = fieldValue(html, '__EVENTVALIDATION');
  if (ev) fd.set('__EVENTVALIDATION', ev);
  fd.set('__EVENTTARGET', '');
  fd.set('__EVENTARGUMENT', '');
  fd.set('ctl00$ContentPlaceHolder1$ddREPORTING_YEAR', String(year));
  fd.set('ctl00$ContentPlaceHolder1$btnDisplay', 'Display');
  return fd;
}

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EmpoweredVote-Treasury/1.0',
};

export async function fetchOne(report, year, outDir, { force = false } = {}) {
  const out = path.join(outDir, `${report}_${year}.xls`);
  if (!force && existsSync(out) && statSync(out).size > 0) {
    return { out, skipped: true, bytes: statSync(out).size };
  }
  const url = `${BASE}ReportInformation2.aspx?report=${report}`;

  const get = await fetch(url, { headers: UA });
  if (!get.ok) throw new Error(`${report} ${year}: GET ${get.status}`);
  const html = await get.text();

  // ⚠ The ViewState is per-session; the cookie must be carried to the POST.
  const cookie = (get.headers.getSetCookie ? get.headers.getSetCookie() : [get.headers.get('set-cookie')])
    .filter(Boolean).map((c) => c.split(';')[0]).join('; ');

  const post = await fetch(url, {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: formFields(html, year).toString(),
    redirect: 'follow',
  });
  if (!post.ok) throw new Error(`${report} ${year}: POST ${post.status}`);

  // ⚠⚠ A BUFFER, never text.
  const buf = Buffer.from(await post.arrayBuffer());
  if (!looksLikeXls(buf)) {
    throw new Error(`${report} ${year}: response is not an OLE2 workbook `
      + `(magic ${buf.subarray(0, 8).toString('hex')}, ${buf.length} bytes, `
      + `content-type ${post.headers.get('content-type')}). DCED served a PAGE, not a file — `
      + 'most likely the year is not offered for this report.');
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(out, buf);
  return { out, bytes: buf.length, contentType: post.headers.get('content-type') };
}

async function main() {
  const { values } = parseArgs({
    options: {
      report: { type: 'string' },
      year: { type: 'string' },
      out: { type: 'string' },
      force: { type: 'boolean' },
    },
  });
  const outDir = values.out ? path.resolve(ROOT, values.out) : DEFAULT_OUT;
  const reports = values.report ? [values.report] : Object.keys(REPORTS);
  for (const r of reports) {
    if (!REPORTS[r]) throw new Error(`Unknown report ${JSON.stringify(r)} — expected ${Object.keys(REPORTS).join(' or ')}`);
  }
  const years = values.year
    ? [Number(values.year)]
    : Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

  console.log(`\nPA DCED Municipal Statistics — ${reports.join(' + ')}, FY${years[0]}-FY${years[years.length - 1]}`);
  console.log(`  Out: ${path.relative(ROOT, outDir)}\n`);

  let got = 0; let skipped = 0;
  for (const report of reports) {
    for (const year of years) {
      const r = await fetchOne(report, year, outDir, { force: values.force });
      if (r.skipped) { skipped++; continue; }
      got++;
      console.log(`  ${path.basename(r.out)}  ${(r.bytes / 1048576).toFixed(2)} MB  ${r.contentType}`);
    }
  }
  console.log(`\n  fetched ${got}, already cached ${skipped}`);
  console.log('\n  Next — ExcelJS cannot read BIFF8, so convert before parsing:');
  console.log('      python scripts/tools/xlsToXlsx.py _acfr-work/pa/xls _acfr-work/pa/xlsx --check');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
