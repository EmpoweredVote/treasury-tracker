/**
 * NO SHEBANG — a test imports this module for its pure helpers, and the repo
 * forbids a shebang on anything a test imports (tests/waSao.test.mjs). It is
 * still run directly: `node scripts/<name>` needs no shebang on Windows.
 *
 * Hawaii's four counties — ACFR fetcher (Federal Audit Clearinghouse).
 *
 * Downloads each county's audited annual report into the gitignored
 * `docs/HiCounties/<key>/`, and writes a per-county `manifest.json` recording
 * the URL a reader can cite plus its sha256.
 *
 * Why FAC rather than four county websites is in `scripts/lib/hiCountySources.mjs`
 * and, measured, in the design doc §7.2: Honolulu's page answered only after
 * 30.7 seconds and names three fiscal years, Maui's never mentions an ACFR at
 * all, and Hawaii County's and Kaua'i's return 403 to every client tried.
 *
 * GUARDS (a fetch that cannot be proven good is DELETED, not kept)
 *   (a) `%PDF` magic bytes — catches an error page or viewer shell named `.pdf`.
 *   (b) minimum byte size — catches truncated transfers and error stubs.
 *   (c) minimum page count via `pdfinfo` — catches an opinion-letter-only file
 *       standing in for a full report.
 *   (d) text-layer density — an image-only scan passes (a)-(c) intact and
 *       yields an EMPTY extraction.
 *   (e) ⚠⚠ AUDITEE IDENTITY — the document's own text must name this county.
 *       299 Hawaii auditees file at FAC and only FOUR are general-purpose local
 *       governments; `Department of Water, County of Kauai` is a component unit
 *       with its own EIN. The PDF is the arbiter, never the index.
 *   (f) ⚠⚠ FISCAL-YEAR ASSERTION — the document's own text must name the year
 *       the roster claims. A MISS is reported, never treated as proof of a
 *       wrong year; a positive hit on a DIFFERENT plausible year is fatal.
 *
 * ⚠⚠⚠ (e) IS THE ONLY GUARD THAT CATCHES A CIPHERED TEXT LAYER. Alaska had
 * three — Sitka FY2018, Bristol Bay FY2024, Yakutat FY2018 — whose embedded
 * fonts carry a broken ToUnicode map, so every glyph extracts as a wrong
 * character. They read at ~1,650-1,900 chars/page, so (d) sees a healthy text
 * layer and waves them through. A ciphered page yields spurious NUMBERS, not
 * an empty tree. PDF producer metadata does NOT predict them.
 *
 * Usage:
 *   node scripts/fetchHiCounties.mjs                  # all four, all years
 *   node scripts/fetchHiCounties.mjs --entity honolulu
 *   node scripts/fetchHiCounties.mjs --entity maui --fy 2024
 *   node scripts/fetchHiCounties.mjs --probe          # resolve only
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import {
  HI_COUNTIES, FAC_ROSTER, countyByKey, fysFor, documentUrlFor, assertCitable,
} from './lib/hiCountySources.mjs';

// ⚠ Floors are a crude tripwire, not the real protection — (d), (e) and (f)
// are. MEASURED across the 36 filings that passed, 2026-10-29:
//
//     bytes        1,047,577 (Kauai FY2017)  ..  29,228,255 (Hawaii FY2020)
//     pages              189 (Maui FY2025)   ..         376 (Honolulu FY2023)
//     chars/page       1,779 (Hawaii FY2017) ..       2,208 (Maui FY2022)
//
// The two REJECTED Hawaii County filings read 238 and 250 chars/page — an
// order of magnitude below the healthy band, which is what an image-only scan
// looks like. These floors sit below every observed good file.
const MIN_BYTES = 200_000;
const MIN_PAGES = 30;
const MIN_CHARS_PER_PAGE = 400;
const UA = 'Mozilla/5.0 (compatible; EmpoweredVote-TreasuryTracker/1.0; +https://treasurytracker.empowered.vote)';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BASE_DIR = 'docs/HiCounties';

const fileFor = (key, fy) => `${key}-${fy}-acfr.pdf`;

/**
 * Distinctive text each county prints on its own cover page.
 *
 * ⚠⚠ ANCHORED AT A LINE START (`^`, multiline). A bare substring search for
 * "county of kauai" is satisfied by `DEPARTMENT OF WATER, COUNTY OF KAUAI` —
 * a component unit that files its own Single Audit under its own EIN. The
 * anchor is what separates the county from its own utility.
 *
 * ⚠ `\s+` between words because `pdftotext -table` spreads a centred title
 * across wide gaps: Honolulu FY2025 extracts as
 * "CITY       AND    COUNTY       OF  HONOLULU".
 *
 * ⚠⚠⚠ THE ʻOKINA IS A BACKTICK (U+0060) IN THESE DOCUMENTS. Kaua'i's own ACFR
 * prints `County of Kaua`i, Hawai`i` — not U+02BB, not a curly quote, not an
 * apostrophe. A character class that omitted the backtick rejected ALL NINE
 * Kaua'i filings as "ciphered or the wrong document", which is exactly what a
 * clean corpus looks like when the guard is wrong about one character. Every
 * variant the issuers use is accepted, and the ʻokina is optional because the
 * same county also prints `COUNTY OF KAUAI` plain.
 */
const OKINA = "[`\\u02BB\\u2018\\u2019']?";
const IDENTITY = {
  honolulu: /^\s*city\s+and\s+county\s+of\s+honolulu/im,
  hawaii: new RegExp(`^\\s*county\\s+of\\s+hawai${OKINA}i`, 'im'),
  maui: /^\s*county\s+of\s+maui/im,
  kauai: new RegExp(`^\\s*county\\s+of\\s+kaua${OKINA}i`, 'im'),
};

/** Text that means we landed on a DIFFERENT government with a similar name. */
const NOT_IDENTITY = /department\s+of\s+water|housing\s+authority|school\s+district|board\s+of\s+water\s+supply/i;

export function identityPattern(key) {
  const re = IDENTITY[key];
  if (!re) throw new Error(`No identity pattern for '${key}' — not a Hawaii county government.`);
  return re;
}

/**
 * Guard (f). All four counties close JUNE 30, so the caption to look for is
 * "June 30, <FY>". The month/day gap is `\s*` because pdftotext drops the
 * space in some renderings — that is how a King County report once loaded as
 * the wrong year.
 *
 * ⚠ A comparative statement names two years ("YEARS ENDED JUNE 30, 2025 AND
 * 2024"). That is fine: this asks whether the document names the year we
 * REQUESTED, and never infers the year from the document.
 */
export function assertFiscalYear(text, fy) {
  return new RegExp(`June\\s*30,?\\s*${fy}`, 'i').test(text)
    || new RegExp(`(fiscal\\s+year|year\\s+ended|years\\s+ended)[^.]{0,40}${fy}`, 'i').test(text);
}

/** Guard (f) with the reason, for the drop message. */
function fiscalYearVerdict(text, fy) {
  if (assertFiscalYear(text, fy)) return { ok: true };
  const wrong = [fy - 1, fy + 1].filter((y) => assertFiscalYear(text, y));
  if (wrong.length) return { ok: false, note: `names FY${wrong.join('/')} but not FY${fy}` };
  return { ok: true, note: 'MISS — no fiscal-year caption found (not proof of a wrong year)' };
}

/**
 * One manifest entry.
 *
 * ⚠⚠⚠ `url` IS WHAT `acfrGfLoad.mjs` STAMPS AS `source_url` (it reads
 * `manifest[fy].url`), so it is the CITABLE FAC permalink — the string this
 * fetcher requested — and never `res.url`.
 *
 * Everywhere else in this repo the fetcher records the URL that actually
 * served the bytes, because a URL rebuilt from a naming rule can be wrong
 * (Travis County's filenames switch from `-cafr.pdf` to `-acfr.pdf` mid-series).
 * That rule is right there and WRONG HERE:
 *
 *   app.fac.gov/dissemination/report/pdf/<report_id>
 *     -> 302 -> s3-us-gov-west-1.amazonaws.com/...?X-Amz-Expires=30&X-Amz-Signature=...
 *
 * Thirty SECONDS. It was stamped onto 253 Alaska borough rows across two loads
 * and was unusable to a reader before the load that wrote it had finished. No
 * gate reads a source_url, so every other check stayed green.
 */
export function manifestEntryFor(key, fy, { servedUrl, sha256: digest, bytes, pages, charsPerPage }) {
  const url = documentUrlFor(key, fy);
  if (!url) {
    throw new Error(`${key} did not file FY${fy} — no filing in the FAC roster, so there is nothing to cite.`);
  }
  const rec = FAC_ROSTER[key][String(fy)];
  return {
    fy,
    url: assertCitable(url),
    servedUrl,
    report_id: rec.report_id,
    auditee_name: rec.name,
    bytes,
    pages,
    charsPerPage,
    sha256: digest,
  };
}

function manifestPath(dir) { return path.join(dir, 'manifest.json'); }
function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(manifestPath(dir), 'utf8')); } catch { return {}; }
}
function writeManifest(dir, m) {
  const ordered = {};
  for (const k of Object.keys(m).sort()) ordered[k] = m[k];
  fs.writeFileSync(manifestPath(dir), `${JSON.stringify(ordered, null, 2)}\n`);
}
function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function isPdf(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(5);
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  return buf.toString('latin1').startsWith('%PDF');
}

function pageCount(file) {
  const r = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const m = /^Pages:\s+(\d+)/m.exec(r.stdout);
  return m ? Number(m[1]) : null;
}

function firstPagesText(file, pages = 40) {
  const r = spawnSync('pdftotext', ['-f', '1', '-l', String(pages), file, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return r.status === 0 ? r.stdout : '';
}

function charsPerPageOf(file, pages) {
  if (!pages) return null;
  const r = spawnSync('pdftotext', [file, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) return null;
  return Math.round(r.stdout.length / pages);
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { ok: true, servedUrl: res.url || url, bytes: buf.length };
}

async function fetchYear(ent, fy, { probe }) {
  const dir = path.join(ROOT, BASE_DIR, ent.key);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, fileFor(ent.key, fy));

  const url = documentUrlFor(ent.key, fy);
  if (!url) { console.log(`    FY${fy}  RESOLVE FAILED — not in the roster`); return null; }
  if (probe) { console.log(`    FY${fy}  -> ${url}`); return null; }

  const got = await download(url, dest);
  if (!got.ok) { console.log(`    FY${fy}  DOWNLOAD FAILED — ${got.reason}`); return null; }

  const drop = (why) => {
    fs.rmSync(dest, { force: true });
    console.log(`    FY${fy}  REJECTED — ${why}`);
    return null;
  };
  if (!isPdf(dest)) return drop('not a PDF (magic bytes)');
  if (got.bytes < MIN_BYTES) return drop(`${got.bytes} bytes < ${MIN_BYTES}`);
  const pages = pageCount(dest);
  if (pages !== null && pages < MIN_PAGES) return drop(`${pages} pages < ${MIN_PAGES}`);
  const cpp = charsPerPageOf(dest, pages);
  if (cpp !== null && cpp < MIN_CHARS_PER_PAGE) {
    return drop(`${cpp} chars/page < ${MIN_CHARS_PER_PAGE} — image-only scan`);
  }

  const head = firstPagesText(dest);
  if (!identityPattern(ent.key).test(head)) {
    return drop(`cover text does not name ${ent.name} (ciphered text layer, or the wrong document)`);
  }
  // ⚠ A county's ACFR legitimately MENTIONS its water department (a component
  // unit), so this only fires when the identity stem is ALSO absent from the
  // opening pages — i.e. we landed on the component unit's own filing.
  if (NOT_IDENTITY.test(head) && !identityPattern(ent.key).test(head.slice(0, 4000))) {
    return drop('cover text names a different government (water/housing/school)');
  }

  const year = fiscalYearVerdict(head, fy);
  if (!year.ok) return drop(`fiscal-year assertion: ${year.note}`);

  const entry = manifestEntryFor(ent.key, fy, {
    servedUrl: got.servedUrl, sha256: sha256File(dest), bytes: got.bytes, pages, charsPerPage: cpp,
  });
  console.log(`    FY${fy}  ok  ${String(got.bytes).padStart(9)}b ${String(pages).padStart(3)}p `
    + `${String(cpp).padStart(5)} c/p  ${entry.report_id}${year.note ? `  (${year.note})` : ''}`);
  return entry;
}

async function main() {
  const { values } = parseArgs({
    options: {
      entity: { type: 'string' },
      fy: { type: 'string' },
      probe: { type: 'boolean', default: false },
    },
  });

  const ents = values.entity
    ? HI_COUNTIES.filter((c) => c.key === values.entity)
    : [...HI_COUNTIES];
  if (!ents.length) throw new Error(`No Hawaii county matched ${values.entity}`);

  let ok = 0; let attempted = 0;
  const failures = [];

  for (const ent of ents) {
    console.log(`\n${ent.name} (${ent.entityType}) — ${ent.legalName}`);
    const dir = path.join(ROOT, BASE_DIR, ent.key);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = readManifest(dir);
    for (const fy of fysFor(ent.key)) {
      if (values.fy && Number(values.fy) !== fy) continue;
      attempted += 1;
      const rec = await fetchYear(ent, fy, { probe: values.probe });
      if (rec) { manifest[String(fy)] = rec; ok += 1; }
      else if (!values.probe) failures.push(`${ent.key} FY${fy}`);
    }
    if (!values.probe) writeManifest(dir, manifest);
  }

  console.log(`\nFetched ${ok}/${attempted}.`);
  if (failures.length) {
    console.log(`FAILURES (${failures.length}) — reported, never written as $0:`);
    for (const f of failures) console.log(`  ! ${f}`);
  }
}

// ⚠ Only run when invoked directly, so the test can import the guards.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

export { countyByKey };
