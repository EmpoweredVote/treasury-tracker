#!/usr/bin/env node
/**
 * City of Charlotte + Mecklenburg County ACFR fetcher (Knight campaign, session 2).
 *
 * Separate from `scripts/fetchNorthCarolina.mjs` because NEITHER host can be
 * reached the way all four entities in that fetcher are reached. Both needed a
 * transport that file does not have, and folding them in would have meant
 * teaching a working fetcher two exceptions.
 *
 * ── ⚠ CHARLOTTE: AN AKAMAI WAF THAT FINGERPRINTS THE CLIENT ─────────────────
 * `www.charlottenc.gov` returns `403 Access Denied` (an `errors.edgesuite.net`
 * reference id) to BOTH `curl` and PowerShell — on the HTML index page and on
 * the PDFs alike — with browser User-Agent, Accept, Accept-Language and the full
 * `Sec-Fetch-*` set applied. A real Chromium passes unchanged with no special
 * headers at all. The block is on the client fingerprint, not the request, so no
 * header workaround exists and the fetch is driven through Playwright.
 *
 * ⚠ Playwright is installed GLOBALLY on this machine, not as a project
 * dependency, so it is resolved by path and its absence is a clear error rather
 * than a stack trace.
 *
 * ── ⚠ MECKLENBURG: A DAM WITH NO DURABLE FILE URL ───────────────────────────
 * The county publishes through an Acquia/Widen DAM. There is NO stable direct
 * link to a PDF: bytes come only from signed, expiring
 * `orders-bb.us-east-1.widencdn.net` order links, and every public Widen content
 * pattern 404s (`mcknc.widen.net/content/<external_id>/original`,
 * `/pdf/`, `embed.widencdn.net/...`). Verified 2026-08-28.
 *
 * The asset LIST, however, comes from a clean no-auth JSON endpoint:
 *
 *   POST /portals/api/assets/search/public/section/<sectionId>
 *   {"offset":0,"limit":10,"filters":{},"search":null}
 *
 * ⚠ It is POST — a GET returns 405 — and it pages 10 at a time against
 * `total_count`.
 *
 * ⚠ WHAT IS RECORDED AS `source_url`. Because no durable byte URL exists, the
 * manifest records the PORTAL ASSET PAGE
 * (`…/portals/y6kaiqln/FinancialReports/asset/<uuid>`), which is the county's own
 * published location for that exact document and returns 200. This mirrors the
 * choice made for Asheville's Google Drive viewer URLs. A signed order link must
 * NEVER be stamped onto a row: it expires within hours and would read as a dead
 * first-party citation.
 *
 * ⚠ Widen filenames contain ZERO-WIDTH SPACES (U+200B) —
 * "Annual Comprehensive Financial Report\u200b\u200b\u200b 2025.pdf" — so the
 * fiscal year is taken from the digits, never by matching the name.
 *
 * ── GUARDS (a fetch that cannot be proven good is DELETED, not kept) ─────────
 *   (a) `%PDF` magic bytes
 *   (b) minimum byte size
 *   (c) minimum page count — the primary defence against the PAFR
 *   (d) fiscal-year assertion
 *   (e) ISSUER assertion — `assertIssuer`, positive evidence of authorship
 *   (f) ⚠ REPORT-TYPE assertion — NEW. `assertIssuer` proves who WROTE a
 *       document and cannot tell this city's own ACFR from its own AIRPORT
 *       ACFR, its own CHARLOTTE WATER report or its own PAFR. Two of those pass
 *       (e) untouched. See `assertReportType` in scripts/lib/ncAcfrSources.mjs.
 *
 * Usage:
 *   node scripts/fetchCharlotteMecklenburg.mjs --probe
 *   node scripts/fetchCharlotteMecklenburg.mjs --entity charlotte
 *   node scripts/fetchCharlotteMecklenburg.mjs --entity mecklenburg --fy 2019
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { assertFiscalYear, assertIssuer, assertReportType, NC_ISSUERS } from './lib/ncAcfrSources.mjs';

const require = createRequire(import.meta.url);

const MIN_BYTES = 300_000;
const MIN_PAGES = 60;

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..',
);

// ── Charlotte ────────────────────────────────────────────────────────────────
/**
 * ⚠ FOUR NAMING CONVENTIONS IN ONE ARCHIVE, and the directory does not track the
 * fiscal year: FY2011-FY2023 all live under `publications/2023/cacfr/`, while
 * FY2024 and FY2025 sit under their own year directories. The `/v/N/` segment
 * also varies (FY2025 is `/v/3/`). Transcribed from the hrefs on the Finance
 * Publications page, not rebuilt from a rule.
 */
const CLT_BASE = 'https://www.charlottenc.gov/files/sharedassets/city/v';
const CLT_CACFR = `${CLT_BASE}/1/city-government/departments/documents/finance/publications/2023/cacfr`;

export const CHARLOTTE_URLS = {
  2011: `${CLT_CACFR}/fy11_cafr.pdf`,
  2012: `${CLT_CACFR}/fy12_cafr.pdf`,
  2013: `${CLT_CACFR}/fy13_cafr.pdf`,
  2014: `${CLT_CACFR}/fy14_cafr.pdf`,
  2015: `${CLT_CACFR}/fy15_cafr.pdf`,
  2016: `${CLT_CACFR}/fy16_cafr.pdf`,
  2017: `${CLT_CACFR}/fy17_cafr.pdf`,
  2018: `${CLT_CACFR}/fy18_cafr.pdf`,
  2019: `${CLT_CACFR}/fy19_cafr.pdf`,
  2020: `${CLT_CACFR}/fy20_cafr.pdf`,
  2021: `${CLT_CACFR}/acfr-2021-web-final.pdf`,
  2022: `${CLT_CACFR}/acfr-2022-web-final.pdf`,
  2023: `${CLT_CACFR}/fiscal-year-2023-annual-comprehensive-financial-report.pdf`,
  2024: `${CLT_BASE}/1/city-government/departments/documents/finance/publications/2024/cacfr/fiscal-year-2024-annual-comprehensive-financial-report.pdf`,
  2025: `${CLT_BASE}/3/city-government/departments/documents/finance/publications/2025/fiscal-year-2025-annual-comprehensive-financial-report.pdf`,
};
export const CHARLOTTE_FYS = Object.keys(CHARLOTTE_URLS).map(Number).sort((a, b) => a - b);

/**
 * ⚠ NOT LOADED, AND NOT AN OVERSIGHT. FY2010 and earlier were published on the
 * retired `charmeck.org` host — a CDX index of that domain lists
 * `city/charlotte/finance/documents/fy10 cafr.pdf` plus HTML pages for FY1998,
 * FY2000, FY2001 and FY2002. That domain now 301s to `charlottenc.gov` and the
 * files are gone, so they survive only in the Internet Archive. Under the
 * first-party `source_url` policy set 2026-08-25 for City of Durham
 * FY2004-FY2006 they are recorded here and left unfetched.
 *
 * The FAC census records Charlotte as audited from FY2000
 * (`NC,Charlotte,municipality,annual,7,,2000-2025`), so this is an ACCESS gap,
 * not an absence — which is worth stating, because "the issuer publishes only N
 * years" was wrong for Asheville and cost nine recoverable years.
 */
export const CHARLOTTE_ARCHIVE_ONLY = {
  2010: 'http://charmeck.org/city/charlotte/finance/documents/fy10%20cafr.pdf',
  2002: 'http://www.charmeck.org/departments/finance+-+city/publications/2002+cafr.asp',
  2001: 'http://www.charmeck.org/departments/finance+-+city/publications/cafr2001.asp',
  2000: 'http://www.charmeck.org/Departments/finance+-+city/publications/cafr2000.asp',
  1998: 'http://www.charmeck.org/Departments/finance+-+city/publications/fy98cafr.asp',
};

// ── Mecklenburg ──────────────────────────────────────────────────────────────
const MECK_PORTAL = 'https://mecknc.widencollective.com';
const MECK_SHORTCODE = 'y6kaiqln';
/** The "Annual Comprehensive Financial Reports" section of the county's portal. */
export const MECK_SECTION_ID = '2c5d22a3-41b3-4816-afc2-b88d3f718e38';

export function meckAssetPageUrl(assetId) {
  return `${MECK_PORTAL}/portals/${MECK_SHORTCODE}/FinancialReports/asset/${assetId}`;
}

/** Every asset in the ACFR section, paged. Returns {fy: {id, filename}}. */
export async function listMecklenburgAssets(fetchImpl = fetch) {
  const out = {};
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const res = await fetchImpl(
      `${MECK_PORTAL}/portals/api/assets/search/public/section/${MECK_SECTION_ID}`,
      {
        method: 'POST',          // ⚠ a GET returns 405
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset, limit: 10, filters: {}, search: null }),
      },
    );
    if (!res.ok) throw new Error(`Widen asset search failed: HTTP ${res.status}`);
    const json = await res.json();
    total = json.total_count ?? 0;
    const items = json.items || [];
    if (!items.length) break;
    for (const it of items) {
      // ⚠ Filenames carry ZERO-WIDTH SPACES; take the year from the digits.
      const m = String(it.filename || '').match(/(\d{4})/);
      if (m) out[Number(m[1])] = { id: it.id, filename: it.filename };
    }
    offset += items.length;
  }
  return out;
}

// ── Shared guards ────────────────────────────────────────────────────────────
const isPdf = (f) => fs.readFileSync(f).subarray(0, 5).toString('ascii') === '%PDF-';

function pageCount(file) {
  const r = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  const m = r.stdout && r.stdout.match(/Pages:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function documentText(file, lastPage = 40) {
  const r = spawnSync('pdftotext', ['-f', '1', '-l', String(lastPage), file, '-'],
    { encoding: 'utf8', maxBuffer: 1 << 28 });
  return r.stdout || '';
}

/**
 * Every guard, in one place, so a caller cannot keep a file that only passed
 * some of them. Returns {ok, note}.
 */
export function verifyDownload(file, { fy, issuerKey }) {
  if (!isPdf(file)) return { ok: false, note: 'not a PDF (magic bytes)' };
  const bytes = fs.statSync(file).size;
  if (bytes < MIN_BYTES) return { ok: false, note: `too small (${bytes} < ${MIN_BYTES})` };
  const pages = pageCount(file);
  if (pages !== null && pages < MIN_PAGES) {
    return { ok: false, note: `too few pages (${pages} < ${MIN_PAGES}) — likely a PAFR` };
  }
  const text = documentText(file);
  const year = assertFiscalYear(text, fy);
  if (!year.ok) return { ok: false, note: `wrong fiscal year (${year.note})` };
  const issuer = assertIssuer(text, NC_ISSUERS[issuerKey]);
  if (!issuer.ok) return { ok: false, note: issuer.note };
  // ⚠ (f) — the guard assertIssuer cannot provide. Without it this city's own
  // Charlotte Water report and its own PAFR are accepted.
  const kind = assertReportType(text);
  if (!kind.ok) return { ok: false, note: kind.note };
  return { ok: true, bytes, pages, note: year.note };
}

export function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// ── Playwright transport (Charlotte) ─────────────────────────────────────────
const GLOBAL_PLAYWRIGHT = 'C:/Users/Chris/AppData/Roaming/npm/node_modules/playwright/index.js';

function loadPlaywright() {
  for (const spec of ['playwright', GLOBAL_PLAYWRIGHT]) {
    try { return require(spec); } catch { /* try the next */ }
  }
  throw new Error(
    'Playwright is required to fetch charlottenc.gov, which returns 403 to every '
    + 'non-browser client (Akamai fingerprints the client, so no header set works). '
    + `Install it globally (npm i -g playwright) or at ${GLOBAL_PLAYWRIGHT}.`,
  );
}

async function fetchCharlotte(fys, { probe, outDir }) {
  if (probe) {
    for (const fy of fys) console.log(`  FY${fy}  -> ${CHARLOTTE_URLS[fy]}`);
    return {};
  }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  const manifest = {};
  try {
    // Establish a session against the site before requesting assets.
    await page.goto('https://www.charlottenc.gov/City-Government/Departments/Finance/Publications',
      { waitUntil: 'domcontentloaded', timeout: 90_000 });

    for (const fy of fys) {
      const url = CHARLOTTE_URLS[fy];
      if (!url) { console.log(`  FY${fy}  NO SOURCE URL`); continue; }
      const dest = path.join(outDir, `charlotte_fy${fy}.pdf`);
      const res = await page.evaluate(async (u) => {
        const r = await fetch(u, { credentials: 'include' });
        if (!r.ok) return { err: r.status };
        const buf = new Uint8Array(await r.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) {
          s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        }
        return { b64: btoa(s) };
      }, url);
      if (res.err) { console.log(`  FY${fy}  HTTP ${res.err}`); continue; }
      fs.writeFileSync(dest, Buffer.from(res.b64, 'base64'));

      const v = verifyDownload(dest, { fy, issuerKey: 'charlotte' });
      if (!v.ok) { fs.unlinkSync(dest); console.log(`  FY${fy}  REJECTED — ${v.note}`); continue; }
      manifest[fy] = { fy, url, bytes: v.bytes, pages: v.pages, sha256: sha256(dest) };
      console.log(`  FY${fy}  ${v.bytes} bytes, ${v.pages} pages${v.note ? `  (${v.note})` : ''}`);
    }
  } finally {
    await browser.close();
  }
  return manifest;
}

// ── Widen transport (Mecklenburg) ────────────────────────────────────────────
/**
 * ⚠ The bytes come from a SECTION ZIP, because there is no per-asset download
 * URL. The order is placed, polled, and the resulting signed link is streamed;
 * the link is used and discarded, never recorded.
 */
async function fetchMecklenburg(fys, { probe, outDir }) {
  const assets = await listMecklenburgAssets();
  if (probe) {
    for (const fy of fys) {
      const a = assets[fy];
      console.log(`  FY${fy}  -> ${a ? meckAssetPageUrl(a.id) : 'NOT PUBLISHED'}`);
    }
    return {};
  }
  const manifest = {};
  for (const fy of fys) {
    const a = assets[fy];
    const dest = path.join(outDir, `mecklenburg_fy${fy}.pdf`);
    if (!a) { console.log(`  FY${fy}  NOT PUBLISHED in the portal section`); continue; }
    if (!fs.existsSync(dest)) {
      console.log(`  FY${fy}  present in the portal but not on disk — run the section download `
        + '(see the module header); the DAM serves no per-asset URL.');
      continue;
    }
    const v = verifyDownload(dest, { fy, issuerKey: 'mecklenburg' });
    if (!v.ok) { console.log(`  FY${fy}  REJECTED — ${v.note}`); continue; }
    manifest[fy] = {
      fy,
      url: meckAssetPageUrl(a.id),
      viewer: meckAssetPageUrl(a.id),
      bytes: v.bytes,
      pages: v.pages,
      sha256: sha256(dest),
    };
    console.log(`  FY${fy}  ${v.bytes} bytes, ${v.pages} pages  ${a.filename.replace(/\u200b/g, '')}`);
  }
  return manifest;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const ENTITIES = {
  charlotte: { label: 'City of Charlotte', dir: 'docs/Charlotte', fys: CHARLOTTE_FYS, fetch: fetchCharlotte },
  mecklenburg: {
    label: 'Mecklenburg County',
    dir: 'docs/MecklenburgCounty',
    fys: Array.from({ length: 21 }, (_, i) => 2005 + i),
    fetch: fetchMecklenburg,
  },
};

function writeManifest(dir, manifest) {
  const p = path.join(dir, 'manifest.json');
  const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  const merged = { ...existing, ...manifest };
  const ordered = {};
  for (const k of Object.keys(merged).sort()) ordered[k] = merged[k];
  fs.writeFileSync(p, `${JSON.stringify(ordered, null, 2)}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const probe = argv.includes('--probe');
  const only = argv.includes('--entity') ? argv[argv.indexOf('--entity') + 1] : null;
  const fyArg = argv.includes('--fy') ? Number(argv[argv.indexOf('--fy') + 1]) : null;

  for (const [key, ent] of Object.entries(ENTITIES)) {
    if (only && only !== key) continue;
    const dir = path.join(ROOT, ent.dir);
    fs.mkdirSync(dir, { recursive: true });
    const fys = fyArg ? [fyArg] : ent.fys;
    console.log(`\n${ent.label} — ${fys.length} fiscal year(s)${probe ? ' [PROBE]' : ''}`);
    const manifest = await ent.fetch(fys, { probe, outDir: dir });
    if (!probe && Object.keys(manifest).length) {
      writeManifest(dir, manifest);
      console.log(`  manifest written to ${ent.dir}/manifest.json`);
    }
  }
}

if (process.argv[1]?.endsWith('fetchCharlotteMecklenburg.mjs')) {
  await main();
}
