#!/usr/bin/env node
/**
 * North Carolina ACFR fetcher — City of Durham, Durham County,
 * City of Asheville, Buncombe County.
 *
 * Downloads all four entities' Annual Comprehensive Financial Reports into the
 * gitignored `docs/DurhamCity/`, `docs/DurhamCounty/`, `docs/Asheville/` and
 * `docs/BuncombeCounty/` directories that the `extract*.py` readers consume.
 *
 * The four hosts' URL shapes and their traps — Durham's non-monotonic
 * DocumentCenter ids, Durham County's five naming conventions and its
 * misspelled FY2025 filename, Asheville's Google Drive viewer pages, and
 * Buncombe's three-host patchwork with the GFOA rename inside it — live in
 * `scripts/lib/ncAcfrSources.mjs`, in a lib rather than here so the tests can
 * import them without importing a shebang module.
 *
 * GUARDS (a fetch that cannot be proven good is DELETED, not kept)
 *   (a) `%PDF` magic bytes — catches Google Drive's viewer page and its
 *       virus-scan interstitial, both of which return HTTP 200 with HTML.
 *   (b) minimum byte size — catches truncated transfers and error stubs.
 *       (Every 404 on media.buncombenc.gov returns HTTP 404 with a 1,245-byte
 *       body, but dconc.gov and DocumentCenter are less consistent.)
 *   (c) minimum page count via `pdfinfo` — the primary defence against the
 *       POPULAR ANNUAL FINANCIAL REPORT, which all four issuers publish
 *       alongside the ACFR under a confusingly similar name. A PAFR is
 *       20-40 glossy pages; an ACFR is 120+.
 *   (d) fiscal-year assertion — the report's own text must name the fiscal
 *       year the manifest claims. A MISS is reported, never treated as proof
 *       of a wrong year; only a positive hit on a DIFFERENT plausible year is
 *       a hard failure.
 *   (e) ⚠ ISSUER assertion — NEW IN THIS MILESTONE. The report must name the
 *       entity it is being loaded for, and must NOT name a known confusable
 *       neighbour. Buncombe County and BUNCOMBE COUNTY SCHOOLS (the Board of
 *       Education) both publish an ACFR, both say "BUNCOMBE COUNTY, NORTH
 *       CAROLINA" on the cover, both close June 30, and the schools' report
 *       ranks ABOVE the county's in web search. Guards (a)-(d) all pass on the
 *       wrong one. Nothing but the issuer's own name separates them.
 *
 * Usage:
 *   node scripts/fetchNorthCarolina.mjs                          # all four
 *   node scripts/fetchNorthCarolina.mjs --entity buncombe
 *   node scripts/fetchNorthCarolina.mjs --entity durham-county --fy 2014
 *   node scripts/fetchNorthCarolina.mjs --probe                  # resolve only
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  NC_ENTITIES, ashevilleViewerUrl, assertFiscalYear, assertIssuer, NC_ISSUERS,
} from './lib/ncAcfrSources.mjs';

const MIN_BYTES = 300_000;
const MIN_PAGES = 60;
const UA = 'Mozilla/5.0 (compatible; EmpoweredVote-TreasuryTracker/1.0; +https://treasurytracker.empowered.vote)';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..',
);

/**
 * Per-entity provenance manifest written next to the PDFs as `manifest.json`.
 * The loaders read this rather than rebuilding a URL from a naming rule, so the
 * `source_url` stamped onto a budgets row is the URL that actually served the
 * bytes that were parsed. `sha256` pins the exact file, so a silently
 * re-published ACFR shows up as a digest change rather than as an unexplained
 * figure movement downstream.
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

/** First `pages` pages as text: title page, transmittal letter, contents. */
function frontMatter(file, pages = 30) {
  const r = spawnSync('pdftotext', ['-f', '1', '-l', String(pages), file, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return r.status === 0 ? r.stdout : null;
}

// -- Download -----------------------------------------------------------------
async function download(url, dest) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  } catch (e) {
    return { ok: false, reason: `network error: ${e.message}` };
  }
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { ok: true, servedUrl: res.url || url, bytes: buf.length };
}

async function fetchYear(name, ent, fy, { probe }) {
  const dir = path.join(ROOT, ent.dir);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, ent.file(fy));

  const urls = ent.urls(fy);
  if (!urls.length) { console.log(`  FY${fy}  NO SOURCE URL in the manifest`); return null; }
  if (probe) { console.log(`  FY${fy}  -> ${urls[0]}${urls.length > 1 ? `  (+${urls.length - 1} fallback)` : ''}`); return null; }

  for (const url of urls) {
    const dl = await download(url, dest);
    if (!dl.ok) continue;

    if (!isPdf(dest)) {
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
      console.log(`  FY${fy}  TOO FEW PAGES (${pages} < ${MIN_PAGES}) — likely a PAFR — discarded: ${url}`);
      continue;
    }

    const text = frontMatter(dest);
    const fyCheck = assertFiscalYear(text, fy);
    if (!fyCheck.ok) {
      fs.unlinkSync(dest);
      console.log(`  FY${fy}  WRONG FISCAL YEAR (${fyCheck.note}) — discarded: ${url}`);
      continue;
    }
    const issuerCheck = assertIssuer(text, NC_ISSUERS[name]);
    if (!issuerCheck.ok) {
      fs.unlinkSync(dest);
      console.log(`  FY${fy}  ${issuerCheck.note} — discarded: ${url}`);
      continue;
    }

    const notes = [fyCheck.note, issuerCheck.note].filter(Boolean);
    console.log(`  FY${fy}  OK  ${(dl.bytes / 1e6).toFixed(1)}MB  ${pages ?? '?'}pp`
      + `${notes.length ? `  [${notes.join('; ')}]` : ''}`);
    return {
      fy,
      url: dl.servedUrl,
      viewer: name === 'asheville' ? ashevilleViewerUrl(fy) : undefined,
      bytes: dl.bytes,
      pages,
      sha256: sha256(dest),
    };
  }
  console.log(`  FY${fy}  NO CANDIDATE PASSED THE GUARDS (${urls.length} tried)`);
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const only = arg('--entity');
  const targetFY = arg('--fy') ? Number(arg('--fy')) : null;
  const probe = argv.includes('--probe');

  const missing = [];
  for (const [name, ent] of Object.entries(NC_ENTITIES)) {
    if (only && only !== name) continue;
    const years = targetFY ? [targetFY] : ent.fys;
    console.log(`\n=== ${ent.label} — ${years.length} year(s)${probe ? ' [PROBE]' : ''}`);
    const manifest = readManifest(path.join(ROOT, ent.dir));
    let ok = 0;
    for (const fy of years) {
      const entry = await fetchYear(name, ent, fy, { probe });
      if (entry) { manifest[fy] = entry; ok++; } else if (!probe) { missing.push(`${ent.label} FY${fy}`); }
    }
    if (!probe) {
      writeManifest(path.join(ROOT, ent.dir), manifest);
      console.log(`  ${ok}/${years.length} downloaded; manifest written to ${ent.dir}/manifest.json`);
    }
  }
  if (missing.length) {
    console.log(`\n${missing.length} year(s) did not produce a usable file:`);
    for (const m of missing) console.log(`  - ${m}`);
  }
}

await main();
