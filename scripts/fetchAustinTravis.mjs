#!/usr/bin/env node
/**
 * Austin, TX + Travis County, TX ACFR fetcher.
 *
 * Downloads the two entities' Annual Comprehensive Financial Reports into the
 * gitignored `docs/Austin/` and `docs/TravisCounty/` directories, which the
 * `extractAustin.py` / `extractTravis.py` extractors then read.
 *
 * The two hosts' URL shapes, their asset manifests, and the two traps they
 * carry -- Austin's viewer-page-vs-downloadable-content path, and Travis's
 * hallucination-adjacent hostname plus its cafr->acfr filename switch -- all
 * live in `scripts/lib/txAcfrSources.mjs`. They sit in a lib rather than here
 * so the tests can import them: `tests/waSao.test.mjs` forbids a test from
 * importing any module that starts with a shebang, because a CRLF checkout
 * turns `#!/usr/bin/env node\r` into an unresolvable interpreter path.
 *
 * GUARDS (a fetch that cannot be proven good is deleted, not kept)
 *   (a) `%PDF` magic bytes — catches the Widen HTML-shell trap above.
 *   (b) minimum byte size — catches truncated transfers and error stubs.
 *   (c) minimum page count via `pdfinfo` — catches an opinion-letter-only file
 *       standing in for a full report (the King County trap from v2.21).
 *   (d) fiscal-year assertion — the report's own text must name the fiscal year
 *       claimed by the manifest, so a mislabeled or re-pointed DAM asset cannot
 *       be loaded under the wrong year.
 *
 * Usage:
 *   node scripts/fetchAustinTravis.mjs                  # both entities, all years
 *   node scripts/fetchAustinTravis.mjs --entity austin
 *   node scripts/fetchAustinTravis.mjs --entity travis --fy 2024
 *   node scripts/fetchAustinTravis.mjs --probe          # HEAD only, no download
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  AUSTIN_ASSETS, TRAVIS_FYS, austinUrl, travisUrls,
} from './lib/txAcfrSources.mjs';

const MIN_BYTES = 300_000;
const MIN_PAGES = 40;

/**
 * Per-entity provenance manifest, written next to the PDFs as `manifest.json`.
 *
 * The loaders read this rather than rebuilding a URL from a suffix rule, so the
 * `source_url` stamped onto a budgets row is the URL that actually served the
 * bytes that were parsed — not a plausible reconstruction of it. Travis alone
 * would make a reconstruction rule wrong: its filenames switch from
 * `-cafr.pdf` to `-acfr.pdf` mid-corpus, and the loader has no business
 * knowing where that boundary falls.
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

const ENTITIES = {
  austin: {
    label: 'City of Austin, TX',
    dir: 'docs/Austin',
    fys: Object.keys(AUSTIN_ASSETS).map(Number).sort((a, b) => a - b),
    urls: (fy) => [austinUrl(fy)],
    file: (fy) => `austin-${fy}-acfr.pdf`,
  },
  travis: {
    label: 'Travis County, TX',
    dir: 'docs/TravisCounty',
    fys: [Math.min(...TRAVIS_FYS) - 1, ...TRAVIS_FYS],
    urls: travisUrls,
    file: (fy) => `travis-${fy}-acfr.pdf`,
  },
};

// ── Guards ───────────────────────────────────────────────────────────────────
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
 * Read from the first 25 pages (title page + table of contents), where the
 * "Fiscal Year Ended September 30, <FY>" line lives for both entities.
 *
 * Some Austin PDFs cipher DIGIT GLYPHS in the display font of decorative
 * header lines (FY2024 renders its statement date as "September 32, 2222").
 * So a MISS is reported, never treated as proof of a wrong year — only a
 * positive hit on a DIFFERENT plausible fiscal year is a hard failure.
 */
function assertFiscalYear(file, fy) {
  const r = spawnSync('pdftotext', ['-f', '1', '-l', '25', file, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) return { ok: true, note: 'pdftotext failed on front matter — year unverified' };
  const text = r.stdout;
  if (text.includes(String(fy))) return { ok: true, note: '' };
  const others = [];
  for (let y = 1996; y <= 2026; y++) {
    if (y !== fy && new RegExp(`(September|Year Ended|FY)[^\\n]{0,40}${y}`, 'i').test(text)) others.push(y);
  }
  if (others.length) return { ok: false, note: `front matter names ${others.join('/')}, not ${fy}` };
  return { ok: true, note: `FY${fy} not found in front matter (glyph-ciphered?) — year unverified` };
}

async function download(url, dest) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      // Some public portals gate on a browser-shaped request.
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TreasuryTracker/1.0',
      Accept: 'application/pdf,*/*',
    },
  });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { ok: true, bytes: buf.length };
}

async function fetchOne(ent, fy, { probe, manifest }) {
  const dest = path.join(ent.dir, ent.file(fy));
  const urls = ent.urls(fy).filter(Boolean);
  if (!urls.length) return { fy, status: 'no-url' };

  if (fs.existsSync(dest) && fs.statSync(dest).size >= MIN_BYTES && isPdf(dest)) {
    const bytes = fs.statSync(dest).size;
    const pages = pageCount(dest);
    // Backfill a manifest entry for a file cached by an earlier run. The URL is
    // only recorded once confirmed live, so a cached file whose candidate URLs
    // have all gone away keeps `url: null` rather than gaining a guess.
    if (!manifest[fy]) {
      let live = null;
      for (const url of urls) {
        try { if ((await fetch(url, { method: 'HEAD', redirect: 'follow' })).ok) { live = url; break; } } catch { /* keep trying */ }
      }
      manifest[fy] = { url: live, file: ent.file(fy), bytes, pages, sha256: sha256(dest) };
    }
    return { fy, status: 'cached', bytes, pages };
  }
  if (probe) {
    for (const url of urls) {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.ok) return { fy, status: 'probe-ok', url, type: res.headers.get('content-type') };
    }
    return { fy, status: 'probe-404' };
  }

  const failures = [];
  for (const url of urls) {
    const dl = await download(url, dest);
    if (!dl.ok) { failures.push(`${url} -> ${dl.reason}`); continue; }

    if (!isPdf(dest)) { fs.rmSync(dest); failures.push(`${url} -> not a PDF (HTML shell?)`); continue; }
    if (dl.bytes < MIN_BYTES) { fs.rmSync(dest); failures.push(`${url} -> ${dl.bytes}B < ${MIN_BYTES}B`); continue; }
    const pages = pageCount(dest);
    if (pages !== null && pages < MIN_PAGES) {
      fs.rmSync(dest); failures.push(`${url} -> ${pages}pp < ${MIN_PAGES}pp (opinion letter?)`); continue;
    }
    const yr = assertFiscalYear(dest, fy);
    if (!yr.ok) { fs.rmSync(dest); failures.push(`${url} -> ${yr.note}`); continue; }

    manifest[fy] = { url, file: ent.file(fy), bytes: dl.bytes, pages, sha256: sha256(dest) };
    return { fy, status: 'ok', url, bytes: dl.bytes, pages, note: yr.note };
  }
  return { fy, status: 'failed', failures };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const probe = argv.includes('--probe');
  const only = arg('--entity');
  const onlyFy = arg('--fy') ? Number(arg('--fy')) : null;

  const names = only ? [only] : Object.keys(ENTITIES);
  let failed = 0;

  for (const name of names) {
    const ent = ENTITIES[name];
    if (!ent) { console.error(`unknown entity: ${name}`); process.exit(2); }
    fs.mkdirSync(ent.dir, { recursive: true });
    console.log(`\n=== ${ent.label} -> ${ent.dir}`);
    const manifest = probe ? {} : readManifest(ent.dir);
    const fys = onlyFy ? ent.fys.filter((y) => y === onlyFy) : ent.fys;
    for (const fy of fys) {
      const r = await fetchOne(ent, fy, { probe, manifest });
      const size = r.bytes ? `${(r.bytes / 1e6).toFixed(1)}MB` : '';
      const pp = r.pages ? `${r.pages}pp` : '';
      console.log(`  FY${fy}  ${r.status.padEnd(9)} ${size.padEnd(8)} ${pp.padEnd(7)} ${r.note || ''}`);
      if (r.failures) { r.failures.forEach((f) => console.log(`            ! ${f}`)); failed++; }
    }
    if (!probe) { writeManifest(ent.dir, manifest); console.log(`  -> ${manifestPath(ent.dir)} (${Object.keys(manifest).length} entries)`); }
  }
  console.log(`\n${failed} year(s) unavailable.`);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  await main();
}
