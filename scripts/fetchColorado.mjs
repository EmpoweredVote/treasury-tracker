#!/usr/bin/env node
/**
 * City of Colorado Springs + El Paso County, CO ACFR fetcher.
 *
 * Downloads both entities' Annual Comprehensive Financial Reports into the
 * gitignored `docs/ColoradoSprings/` and `docs/ElPasoCounty/` directories,
 * which `extractColoradoSprings.py` / `extractElPasoCounty.py` then read.
 *
 * The two hosts' URL shapes and their traps — Colorado Springs' viewer-shell
 * (the published link is an HTML page named `.pdf`) and El Paso's three-way
 * filename drift — live in `scripts/lib/coAcfrSources.mjs`, in a lib rather
 * than here so the tests can import them without importing a shebang module.
 *
 * GUARDS (a fetch that cannot be proven good is DELETED, not kept)
 *   (a) `%PDF` magic bytes — catches the viewer-shell trap, which affects
 *       every one of Colorado Springs' 27 published links.
 *   (b) minimum byte size — catches truncated transfers and error stubs.
 *   (c) minimum page count via `pdfinfo` — catches an opinion-letter-only file
 *       standing in for a full report (the King County trap from v2.21).
 *   (d) fiscal-year assertion — the report's own text must name the fiscal year
 *       claimed by the manifest, so a mislabeled or re-pointed asset cannot be
 *       loaded under the wrong year. A MISS is reported, never treated as
 *       proof of a wrong year (Austin ciphers its header digit glyphs); only a
 *       positive hit on a DIFFERENT plausible year is a hard failure.
 *
 * Usage:
 *   node scripts/fetchColorado.mjs                        # both, all years
 *   node scripts/fetchColorado.mjs --entity springs
 *   node scripts/fetchColorado.mjs --entity elpaso --fy 2024
 *   node scripts/fetchColorado.mjs --probe                # resolve only, no download
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  CS_VIEWER_SLUGS, csViewerUrl, csAssetUrlFromShell,
  EPC_FYS, epcUrls,
} from './lib/coAcfrSources.mjs';

const MIN_BYTES = 300_000;
const MIN_PAGES = 40;
const UA = 'Mozilla/5.0 (compatible; EmpoweredVote-TreasuryTracker/1.0; +https://treasurytracker.empowered.vote)';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

/**
 * Per-entity provenance manifest, written next to the PDFs as `manifest.json`.
 *
 * The loaders read this rather than rebuilding a URL from a naming rule, so the
 * `source_url` stamped onto a budgets row is the URL that actually served the
 * bytes that were parsed. Colorado Springs makes reconstruction impossible
 * rather than merely unwise: its FY2022+ assets live under a Drupal directory
 * named for the UPLOAD MONTH (`/system/files/2025-07/...`).
 *
 * `sha256` pins the exact file. A re-published ACFR (issuers do silently
 * replace them) changes the digest, so a re-fetch is visible instead of
 * appearing as an unexplained figure change downstream.
 */
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

/**
 * The report's own text must name the fiscal year the manifest claims.
 *
 * Both entities close DECEMBER 31, so the caption to look for is
 * "December 31, <FY>" (the month/day gap is `\s*` because pdftotext drops the
 * space in some renderings — that is how a King County report once loaded as
 * the wrong year). Read from the first 30 pages: title page, transmittal
 * letter and table of contents.
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
  return { ok: true, note: `MISS — no fiscal-year caption found (not proof of a wrong year)` };
}

// -- Download -----------------------------------------------------------------
async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { ok: true, servedUrl: res.url || url, bytes: buf.length };
}

/**
 * Resolve a Colorado Springs fiscal year to its real asset URL by reading the
 * viewer shell. Never falls back to the viewer URL itself: that URL returns
 * HTTP 200 with HTML, so treating it as the asset would write 27 HTML files
 * named `.pdf` and only guard (a) would stand between that and a load.
 */
async function resolveSpringsAsset(fy) {
  const viewer = csViewerUrl(fy);
  if (!viewer) return { ok: false, reason: `FY${fy} is not in CS_VIEWER_SLUGS` };
  const res = await fetch(viewer, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `viewer page HTTP ${res.status}` };
  const asset = csAssetUrlFromShell(await res.text());
  if (!asset) return { ok: false, reason: 'viewer shell named no .pdf asset' };
  return { ok: true, urls: [asset], viewer };
}

const ENTITIES = {
  springs: {
    label: 'City of Colorado Springs, CO',
    dir: 'docs/ColoradoSprings',
    fys: Object.keys(CS_VIEWER_SLUGS).map(Number).sort((a, b) => a - b),
    resolve: resolveSpringsAsset,
    file: (fy) => `colorado-springs-${fy}-acfr.pdf`,
  },
  elpaso: {
    label: 'El Paso County, CO',
    dir: 'docs/ElPasoCounty',
    fys: EPC_FYS,
    resolve: async (fy) => ({ ok: true, urls: epcUrls(fy) }),
    file: (fy) => `el-paso-county-${fy}-acfr.pdf`,
  },
};

async function fetchYear(ent, fy, { probe }) {
  const dir = path.join(ROOT, ent.dir);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, ent.file(fy));

  const resolved = await ent.resolve(fy);
  if (!resolved.ok) { console.log(`  FY${fy}  RESOLVE FAILED — ${resolved.reason}`); return null; }
  if (probe) { console.log(`  FY${fy}  -> ${resolved.urls[0]}`); return null; }

  for (const url of resolved.urls) {
    const dl = await download(url, dest);
    if (!dl.ok) continue;

    if (!isPdf(dest)) {
      // The Colorado Springs viewer-shell trap, or an error page served with 200.
      fs.unlinkSync(dest);
      console.log(`  FY${fy}  NOT A PDF (${dl.bytes} bytes of non-PDF) — discarded: ${url}`);
      continue;
    }
    if (dl.bytes < MIN_BYTES) {
      fs.unlinkSync(dest);
      console.log(`  FY${fy}  TOO SMALL (${dl.bytes} < ${MIN_BYTES}) — discarded: ${url}`);
      continue;
    }
    const pages = pageCount(dest);
    if (pages !== null && pages < MIN_PAGES) {
      fs.unlinkSync(dest);
      console.log(`  FY${fy}  TOO FEW PAGES (${pages} < ${MIN_PAGES}) — discarded: ${url}`);
      continue;
    }
    const fyCheck = assertFiscalYear(dest, fy);
    if (!fyCheck.ok) {
      fs.unlinkSync(dest);
      console.log(`  FY${fy}  WRONG FISCAL YEAR (${fyCheck.note}) — discarded: ${url}`);
      continue;
    }

    console.log(`  FY${fy}  OK  ${(dl.bytes / 1e6).toFixed(1)}MB  ${pages ?? '?'}pp`
      + `${fyCheck.note ? `  [${fyCheck.note}]` : ''}`);
    return { fy, url: dl.servedUrl, viewer: resolved.viewer, bytes: dl.bytes, pages, sha256: sha256(dest) };
  }
  console.log(`  FY${fy}  NO CANDIDATE PASSED THE GUARDS (${resolved.urls.length} tried)`);
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const only = arg('--entity');
  const targetFY = arg('--fy') ? Number(arg('--fy')) : null;
  const probe = argv.includes('--probe');

  let failures = 0;
  for (const [name, ent] of Object.entries(ENTITIES)) {
    if (only && only !== name) continue;
    const years = targetFY ? [targetFY] : ent.fys;
    console.log(`\n=== ${ent.label} — ${years.length} year(s)${probe ? ' [PROBE]' : ''}`);
    const manifest = readManifest(path.join(ROOT, ent.dir));
    let ok = 0;
    for (const fy of years) {
      const entry = await fetchYear(ent, fy, { probe });
      if (entry) { manifest[fy] = entry; ok++; } else if (!probe) { failures++; }
    }
    if (!probe) {
      writeManifest(path.join(ROOT, ent.dir), manifest);
      console.log(`  ${ok}/${years.length} downloaded; manifest written to ${ent.dir}/manifest.json`);
    }
  }
  if (failures) console.log(`\n${failures} year(s) did not produce a usable file — see the lines above.`);
}

await main();
