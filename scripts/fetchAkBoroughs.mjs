#!/usr/bin/env node
/**
 * Alaska's organized boroughs — ACFR fetcher (Federal Audit Clearinghouse).
 *
 * Downloads each borough's audited annual report into the gitignored
 * `docs/AkBoroughs/<key>/`, and writes a per-borough `manifest.json` recording
 * the URL that actually served each file plus its sha256.
 *
 * Why FAC rather than six borough websites, and the three FAC identity traps
 * this cohort trips, are documented in `scripts/lib/akBoroughSources.mjs`.
 *
 * GUARDS (a fetch that cannot be proven good is DELETED, not kept)
 *   (a) `%PDF` magic bytes — catches an error page or viewer shell named `.pdf`.
 *   (b) minimum byte size — catches truncated transfers and error stubs.
 *   (c) minimum page count via `pdfinfo` — catches an opinion-letter-only file
 *       standing in for a full report (the King County trap from v2.21).
 *   (d) text-layer density — an image-only scan passes (a)-(c) intact and
 *       yields an EMPTY extraction. Anchorage's FY2001-2011 era is exactly this.
 *   (e) ⚠⚠ AUDITEE IDENTITY — the document's own text must name this borough.
 *       FAC name/EIN joins are unsafe in this cohort (Fairbanks FY2024 carries
 *       another entity's EIN), so the PDF is the arbiter, not the index.
 *   (f) ⚠⚠ FISCAL-YEAR ASSERTION — the document's own text must name the year
 *       the roster claims. A MISS is reported, never treated as proof of a
 *       wrong year; a positive hit on a DIFFERENT plausible year is fatal.
 *
 * ⚠ (e) and (f) are the point of this script. The roster is assembled from an
 * index with three known identity defects; these two guards are what convert it
 * into something safe to load.
 *
 * Usage:
 *   node scripts/fetchAkBoroughs.mjs                      # all six, all years
 *   node scripts/fetchAkBoroughs.mjs --entity kodiak
 *   node scripts/fetchAkBoroughs.mjs --entity kpb --fy 2024
 *   node scripts/fetchAkBoroughs.mjs --probe              # resolve only
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { AK_BOROUGHS, FAC_ROSTER, boroughByKey, fysFor, documentUrlFor, assertCitable } from './lib/akBoroughSources.mjs';

const MIN_BYTES = 300_000;
const MIN_PAGES = 40;
const MIN_CHARS_PER_PAGE = 400;
const UA = 'Mozilla/5.0 (compatible; EmpoweredVote-TreasuryTracker/1.0; +https://treasurytracker.empowered.vote)';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BASE_DIR = 'docs/AkBoroughs';

const fileFor = (key, fy) => `${key}-${fy}-acfr.pdf`;

/**
 * Distinctive text each borough prints on its own cover page. Deliberately the
 * SHORTEST unambiguous stem, because the formal name varies across years
 * ("MAT-SU BOROUGH" vs "MATANUSKA-SUSITNA BOROUGH") and pdftotext can letter-space.
 */
const IDENTITY = {
  matsu: /matanuska[-\s–]?susitna|mat[-\s]?su\s+borough/i,
  fnsb: /fairbanks\s+north\s+star\s+borough/i,
  kpb: /kenai\s+peninsula\s+borough/i,
  juneau: /city\s+and\s+borough\s+of\s+juneau/i,
  kgb: /ketchikan\s+gateway\s+borough/i,
  kodiak: /kodiak\s+island\s+borough/i,
  northslope: /north\s+slope\s+borough/i,
  nwarctic: /northwest\s+arctic\s+borough/i,
  petersburg: /petersburg\s+borough/i,
  // ⚠ `and` OR `&`: Wrangell's FY2025 filing is indexed as "CITY & BOROUGH OF
  // WRANGELL" while every earlier year spells it out. Sitka takes the same
  // allowance so one issuer's house style cannot reject a good document.
  sitka: /city\s*(?:and|&)\s*borough\s+of\s+sitka/i,
  wrangell: /city\s*(?:and|&)\s*borough\s+of\s+wrangell/i,
  aleutianseast: /aleutians\s+east\s+borough/i,
};

/** Text that means we landed on a DIFFERENT government with a similar name. */
const NOT_IDENTITY = /school\s+district|housing\s+authority|health\s+care\s+foundation|housing\s+initiatives/i;

function manifestPath(dir) { return path.join(dir, 'manifest.json'); }
function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(manifestPath(dir), 'utf8')); } catch { return {}; }
}
function writeManifest(dir, m) {
  const ordered = {};
  for (const k of Object.keys(m).sort()) ordered[k] = m[k];
  fs.writeFileSync(manifestPath(dir), `${JSON.stringify(ordered, null, 2)}\n`);
}
function sha256(file) {
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

function charsPerPage(file, pages) {
  if (!pages) return null;
  const r = spawnSync('pdftotext', [file, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) return null;
  return Math.round(r.stdout.length / pages);
}

/**
 * Guard (f). All six boroughs close JUNE 30, so the caption to look for is
 * "June 30, <FY>". The month/day gap is `\s*` because pdftotext drops the space
 * in some renderings — that is how a King County report once loaded as the
 * wrong year.
 */
function assertFiscalYear(text, fy) {
  const hit = (y) => new RegExp(`June\\s*30,?\\s*${y}`, 'i').test(text)
    || new RegExp(`(fiscal\\s+year|year\\s+ended)[^.]{0,40}${y}`, 'i').test(text);
  if (hit(fy)) return { ok: true };
  const wrong = [fy - 1, fy + 1].filter(hit);
  if (wrong.length) return { ok: false, note: `names FY${wrong.join('/')} but not FY${fy}` };
  return { ok: true, note: 'MISS — no fiscal-year caption found (not proof of a wrong year)' };
}

/**
 * ⚠⚠ THE MANIFEST RECORDS THE URL WE REQUESTED, NOT `res.url`.
 *
 * Everywhere else in this repo the fetcher records the URL that ACTUALLY
 * SERVED the bytes, because a URL rebuilt from a naming rule can be wrong
 * (Travis County's filenames switch from `-cafr.pdf` to `-acfr.pdf` mid-series).
 * That rule is right there and WRONG HERE, and it shipped a dead link on every
 * Alaska borough row:
 *
 *   app.fac.gov/dissemination/report/pdf/<report_id>
 *     -> 302 -> s3-us-gov-west-1.amazonaws.com/...?X-Amz-Expires=30&X-Amz-Signature=...
 *
 * `res.url` after `redirect: 'follow'` is that PRESIGNED S3 OBJECT, and its own
 * query string says `X-Amz-Expires=30`. Thirty SECONDS. It was stamped onto 139
 * rows in #299 as `source_url` and was unusable to a reader before the load
 * that wrote it had finished.
 *
 * The requested URL is not a guess: `documentUrlFor()` builds it from the
 * report_id the roster carries, it is the exact string this function fetched,
 * and the fetch succeeding is the proof that it resolves. The served URL is
 * kept as `servedUrl` for the record and is NEVER what a reader is offered.
 */
async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { ok: true, requestedUrl: url, servedUrl: res.url || url, bytes: buf.length };
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
  const cpp = charsPerPage(dest, pages);
  if (cpp !== null && cpp < MIN_CHARS_PER_PAGE) {
    return drop(`${cpp} chars/page < ${MIN_CHARS_PER_PAGE} — image-only scan`);
  }

  const head = firstPagesText(dest);
  if (!IDENTITY[ent.key].test(head)) return drop(`cover text does not name ${ent.name}`);
  // ⚠ A borough's ACFR legitimately MENTIONS its school district (a component
  // unit), so this only fires when the identity stem is ALSO absent — i.e. we
  // landed on the school district's own filing.
  if (NOT_IDENTITY.test(head) && !IDENTITY[ent.key].test(head.slice(0, 4000))) {
    return drop('cover text names a different government (school/housing/health)');
  }

  const year = assertFiscalYear(head, fy);
  if (!year.ok) return drop(`fiscal-year assertion: ${year.note}`);

  const rec = FAC_ROSTER[ent.key][String(fy)];
  console.log(`    FY${fy}  ok  ${String(got.bytes).padStart(9)}b ${String(pages).padStart(3)}p `
    + `${String(cpp).padStart(5)} c/p  ${rec.report_id}${year.note ? `  (${year.note})` : ''}`);
  return {
    // ⚠ `url` is what the loader stamps as `source_url`, so it is the CITABLE
    // FAC endpoint. See `download`'s note: `servedUrl` expires in 30 seconds.
    fy, url: assertCitable(got.requestedUrl), servedUrl: got.servedUrl,
    report_id: rec.report_id, auditee_name: rec.name,
    bytes: got.bytes, pages, charsPerPage: cpp, sha256: sha256(dest),
  };
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
    ? AK_BOROUGHS.filter((b) => b.key === values.entity)
    : [...AK_BOROUGHS];
  if (!ents.length) throw new Error(`No borough matched ${values.entity}`);

  let ok = 0; let attempted = 0;
  const failures = [];

  for (const ent of ents) {
    console.log(`\n${ent.name} (${ent.entityType})`);
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
  // ⚠⚠ A gate that measured nothing must FAIL, not pass.
  if (!values.probe && ok === 0) {
    console.error('REFUSING: nothing fetched.');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
