#!/usr/bin/env node
/**
 * Municipality of Anchorage, AK ACFR fetcher.
 *
 * Downloads the Controller's Annual Comprehensive Financial Reports into the
 * gitignored `docs/Anchorage/`, which `extractAnchorageAK.py` then reads, and
 * writes a `manifest.json` recording the URL that actually served each file.
 *
 * The per-year URLs live in `scripts/lib/akAcfrSources.mjs` — a lib rather than
 * here so tests can import them without importing a shebang module. Anchorage
 * uses FIVE filename conventions across thirteen years, so nothing is rebuilt
 * from a naming rule.
 *
 * GUARDS (a fetch that cannot be proven good is DELETED, not kept)
 *   (a) `%PDF` magic bytes — catches a viewer shell or error page named `.pdf`.
 *   (b) minimum byte size — catches truncated transfers and error stubs.
 *   (c) minimum page count via `pdfinfo` — catches an opinion-letter-only file
 *       standing in for a full report (the King County trap from v2.21).
 *   (d) fiscal-year assertion — the report's own text must name the fiscal year
 *       the manifest claims. A MISS is reported, never treated as proof of a
 *       wrong year; only a positive hit on a DIFFERENT plausible year fails.
 *   (e) ⚠⚠ TEXT-LAYER DENSITY — Anchorage-specific and the reason this series
 *       starts at FY2012. muni.org's FY2001-2011 reports are image-only scans
 *       at 1-48 chars/page against 2,499-2,804 for FY2012+. A scan passes (a),
 *       (b) and (c) intact and yields an EMPTY extraction, so density is
 *       measured here and a thin file is rejected at fetch time rather than
 *       surfacing as a mystery downstream.
 *
 * ⚠ Guard (e) catches an EMPTY text layer, not a GARBLED one. The companion
 * failure — a dense but garbled OCR layer that clears a chars/page gate and is
 * still unusable — is covered downstream by the extractor's $0 tie gate, which
 * cannot tie on noise. Both are needed; neither subsumes the other.
 *
 * Usage:
 *   node scripts/fetchAnchorage.mjs                 # all published years
 *   node scripts/fetchAnchorage.mjs --fy 2024
 *   node scripts/fetchAnchorage.mjs --probe         # resolve only, no download
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { ANCHORAGE_FYS, anchorageUrl, KNOWN_DOCUMENT_GAPS } from './lib/akAcfrSources.mjs';

const MIN_BYTES = 300_000;
const MIN_PAGES = 40;
/**
 * ⚠ Threshold, not a measurement. Anchorage's own corpus separates by two
 * orders of magnitude — 48 chars/page at the worst readable-looking scan
 * against 2,499 at the thinnest born-digital year — so 400 sits in empty space
 * rather than near either cluster. It is the same figure the ACFR corpus gate
 * uses elsewhere in this repo.
 */
const MIN_CHARS_PER_PAGE = 400;
const UA = 'Mozilla/5.0 (compatible; EmpoweredVote-TreasuryTracker/1.0; +https://treasurytracker.empowered.vote)';

const DIR = 'docs/Anchorage';
const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

const fileFor = (fy) => `anchorage-${fy}-acfr.pdf`;

function manifestPath(dir) { return path.join(dir, 'manifest.json'); }

function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(manifestPath(dir), 'utf8')); } catch { return {}; }
}

function writeManifest(dir, manifest) {
  const ordered = {};
  for (const k of Object.keys(manifest).sort()) ordered[k] = manifest[k];
  fs.writeFileSync(manifestPath(dir), `${JSON.stringify(ordered, null, 2)}\n`);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// -- Guards -------------------------------------------------------------------
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

/** Guard (e). Returns chars/page, or null when pdftotext could not run. */
function charsPerPage(file, pages) {
  if (!pages) return null;
  const r = spawnSync('pdftotext', [file, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) return null;
  return Math.round(r.stdout.length / pages);
}

/**
 * The report's own text must name the fiscal year the manifest claims.
 *
 * Anchorage closes DECEMBER 31, so the caption is "December 31, <FY>" — the
 * month/day gap is `\s*` because pdftotext drops the space in some renderings,
 * which is how a King County report once loaded under the wrong year.
 *
 * A MISS is reported and allowed; a positive hit on a DIFFERENT year in
 * [FY-1, FY+1] with no hit on the claimed year is a hard failure.
 */
function assertFiscalYear(file, fy) {
  const r = spawnSync('pdftotext', ['-f', '1', '-l', '30', file, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) return { ok: true, note: 'pdftotext failed — year unverified' };
  const text = r.stdout;
  const hit = (y) => new RegExp(`December\\s*31,?\\s*${y}`, 'i').test(text)
    || new RegExp(`(fiscal\\s+year|year\\s+ended)[^.]{0,40}${y}`, 'i').test(text);
  if (hit(fy)) return { ok: true };
  const wrong = [fy - 1, fy + 1].filter(hit);
  if (wrong.length) return { ok: false, note: `names FY${wrong.join('/')} but not FY${fy}` };
  return { ok: true, note: 'MISS — no fiscal-year caption found (not proof of a wrong year)' };
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { ok: true, servedUrl: res.url || url, bytes: buf.length };
}

async function fetchYear(fy, { probe }) {
  const dir = path.join(ROOT, DIR);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, fileFor(fy));

  const url = anchorageUrl(fy);
  if (!url) { console.log(`  FY${fy}  RESOLVE FAILED — not in ANCHORAGE_URL`); return null; }
  if (probe) { console.log(`  FY${fy}  -> ${url}`); return null; }

  const got = await download(url, dest);
  if (!got.ok) { console.log(`  FY${fy}  DOWNLOAD FAILED — ${got.reason}`); return null; }

  const drop = (why) => {
    fs.rmSync(dest, { force: true });
    console.log(`  FY${fy}  REJECTED — ${why}`);
    return null;
  };
  if (!isPdf(dest)) return drop('not a PDF (magic bytes)');
  if (got.bytes < MIN_BYTES) return drop(`${got.bytes} bytes < ${MIN_BYTES}`);
  const pages = pageCount(dest);
  if (pages !== null && pages < MIN_PAGES) return drop(`${pages} pages < ${MIN_PAGES}`);

  const cpp = charsPerPage(dest, pages);
  if (cpp !== null && cpp < MIN_CHARS_PER_PAGE) {
    return drop(`${cpp} chars/page < ${MIN_CHARS_PER_PAGE} — image-only scan, not extractable`);
  }

  const year = assertFiscalYear(dest, fy);
  if (!year.ok) return drop(`fiscal-year assertion: ${year.note}`);

  console.log(`  FY${fy}  ok  ${String(got.bytes).padStart(9)} bytes  ${String(pages).padStart(3)}p`
    + `  ${String(cpp).padStart(5)} chars/page${year.note ? `  (${year.note})` : ''}`);
  return { fy, url: got.servedUrl, bytes: got.bytes, pages, charsPerPage: cpp, sha256: sha256(dest) };
}

async function main() {
  const { values } = parseArgs({
    options: { fy: { type: 'string' }, probe: { type: 'boolean', default: false } },
  });

  const fys = values.fy ? [Number(values.fy)] : [...ANCHORAGE_FYS];
  console.log(`Municipality of Anchorage, AK — ${fys.length} fiscal year(s)`);

  const dir = path.join(ROOT, DIR);
  const manifest = readManifest(dir);
  let ok = 0;
  for (const fy of fys) {
    const rec = await fetchYear(fy, { probe: values.probe });
    if (rec) { manifest[String(fy)] = rec; ok += 1; }
  }
  if (!values.probe) writeManifest(dir, manifest);

  const gaps = Object.entries(KNOWN_DOCUMENT_GAPS);
  if (gaps.length) {
    console.log(`\nDECLARED DOCUMENT GAPS (${gaps.length}) — published but not extractable, never $0:`);
    for (const [fy, why] of gaps) console.log(`  - FY${fy}: ${why}`);
  }

  console.log(`\nFetched ${ok}/${fys.length}.`);
  // ⚠⚠ A gate that measured nothing must FAIL, not pass.
  if (!values.probe && ok === 0) {
    console.error('REFUSING: nothing fetched.');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
