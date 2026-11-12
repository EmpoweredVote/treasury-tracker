/**
 * Fetch the Reno + Washoe County ACFRs and record what served each file.
 *
 * NO SHEBANG — tests import `manifestPath` and `probe`.
 *
 * Usage:
 *   node scripts/fetchNevadaAcfrs.mjs            # fetch both, write manifests
 *   node scripts/fetchNevadaAcfrs.mjs --entity reno --check
 *
 * ⚠⚠ THE MANIFEST IS THE PROVENANCE, AND IT IS WRITTEN BY WHOEVER TOUCHED THE
 * BYTES. `scripts/lib/acfrGfLoad.mjs` refuses to load a fiscal year with no
 * manifest entry, because a URL rebuilt later from a naming rule is a guess
 * about where a file came from rather than a record of it. Travis County is
 * the worked example: its filenames switch from `-cafr.pdf` to `-acfr.pdf`
 * mid-series and no rule should be asked to know that.
 *
 * ⛔ RENO MAKES THE POINT SHARPLY. Its CivicPlus document estate
 * (`/home/showpublisheddocument/<id>/<ticks>`) returned 404 after the 2026
 * migration to Revize, while web search still serves those URLs. A manifest
 * built from search results would record addresses that were already dead.
 * See `scripts/data/nvAcfrSources.mjs`.
 *
 * ── WHAT IT REFUSES ─────────────────────────────────────────────────────────
 *
 * A 200 is not proof: a WAF page, a login wall and a themed 404 all arrive as
 * `200 text/html`. Reno's own 404 is 187KB of styled HTML. So a file is only
 * accepted when it answers `application/pdf` AND begins with `%PDF`, and the
 * extracted text must reach a floor — an image-only scan has pages and bytes
 * and nothing a reader or a parser can use.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { NV_ENTITIES, nvEntityByKey } from './data/nvAcfrEntities.mjs';
import { NV_ACFR_SOURCES, NV_WINDOWS } from './data/nvAcfrSources.mjs';
import { PDF_DIR, pdfPathFor } from './extractNvAll.mjs';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..',
);

/** A real browser's headers; several government WAFs refuse a bare client. */
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Below this, the "text layer" is page furniture and the statements are images. */
export const MIN_CHARS_PER_PAGE = 200;

export function manifestPath(entityKey) {
  return path.join(ROOT, 'docs', PDF_DIR[entityKey], 'manifest.json');
}

/** Pages and extracted-text density, via poppler — the same tools that parse it. */
export function probe(pdfPath) {
  const info = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const pages = Number((/^Pages:\s+(\d+)/m.exec(info.stdout || '') || [])[1] || 0);
  const text = spawnSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const chars = (text.stdout || '').replace(/\s+/g, '').length;
  return { pages, charsPerPage: pages ? Math.round(chars / pages) : 0 };
}

async function fetchOne(url, destPath) {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  const ctype = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`HTTP ${res.status} (${ctype})`);
  const buf = Buffer.from(await res.arrayBuffer());
  // ⚠ Content-type AND magic bytes. Either alone is forgeable by a themed
  // error page; Reno's 404 is 187KB of HTML served with a 404, and some hosts
  // serve the same body with a 200.
  if (!/application\/pdf/i.test(ctype)) throw new Error(`content-type ${ctype || '(none)'}, not a PDF`);
  if (buf.subarray(0, 4).toString('latin1') !== '%PDF') {
    throw new Error(`body does not begin %PDF (starts ${JSON.stringify(buf.subarray(0, 16).toString('latin1'))})`);
  }
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, buf);
  return { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

async function main() {
  const { values } = parseArgs({
    options: { entity: { type: 'string' }, check: { type: 'boolean', default: false } },
  });
  const entities = values.entity
    ? [nvEntityByKey(values.entity)].filter(Boolean)
    : [...NV_ENTITIES];
  if (!entities.length) {
    console.error(`No such entity: ${values.entity}`);
    process.exitCode = 1;
    return;
  }

  const failures = [];
  for (const ent of entities) {
    const urls = NV_ACFR_SOURCES[ent.key] || {};
    const manifest = {};
    console.log(`\n${ent.name}, ${ent.state}`);
    for (const fy of NV_WINDOWS[ent.key] || []) {
      const url = urls[fy];
      const dest = path.join(ROOT, pdfPathFor('docs', ent.key, fy));
      if (!url) { failures.push(`${ent.name} FY${fy}: no URL declared`); continue; }
      try {
        let bytes; let sha256;
        if (values.check && existsSync(dest)) {
          const buf = readFileSync(dest);
          bytes = buf.length;
          sha256 = createHash('sha256').update(buf).digest('hex');
        } else {
          ({ bytes, sha256 } = await fetchOne(url, dest));
        }
        const { pages, charsPerPage } = probe(dest);
        if (charsPerPage < MIN_CHARS_PER_PAGE) {
          throw new Error(`text layer too thin (${charsPerPage} chars/page over ${pages} pages) — image-only scan?`);
        }
        manifest[fy] = { fy, url, bytes, pages, charsPerPage, sha256 };
        console.log(`  FY${fy}  ${String(bytes).padStart(9)}b  ${String(pages).padStart(4)}pp  `
          + `${String(charsPerPage).padStart(5)} chars/pp  ${sha256.slice(0, 12)}`);
      } catch (e) {
        failures.push(`${ent.name} FY${fy}: ${e.message}`);
        console.error(`  FY${fy}  FAILED — ${e.message}`);
      }
    }
    if (Object.keys(manifest).length) {
      writeFileSync(manifestPath(ent.key), `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`  -> ${path.relative(ROOT, manifestPath(ent.key))} (${Object.keys(manifest).length} entries)`);
    }
  }

  if (failures.length) {
    console.error(`\n❌ ${failures.length} document(s) could not be recorded:`);
    for (const f of failures) console.error(`   ${f}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✅ every declared document fetched, verified as a PDF, and recorded.');
}

// ⚠ `process.exitCode`, never `process.exit()` — it races a keep-alive socket.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('fetchNevadaAcfrs.mjs')) {
  main().catch((e) => { console.error(`\n❌ ${e.message}`); process.exitCode = 1; });
}
