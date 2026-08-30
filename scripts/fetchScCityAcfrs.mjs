/**
 * Fetch the Columbia and Myrtle Beach ACFRs and write their provenance manifests.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Knight session 6a. Writes:
 *   _acfr-work/sc/acfr/columbia/columbia_<fy>.pdf        + manifest.json
 *   _acfr-work/sc/acfr/myrtlebeach/myrtlebeach_<fy>.pdf  + manifest.json
 *
 * ⚠ ONE DIRECTORY PER ENTITY, NOT ONE SHARED ONE. `acfrGfLoad.readManifest`
 * keys the manifest by fiscal year alone, so two entities sharing a directory
 * would silently overwrite each other's provenance and attribute one city's
 * document URL to the other's rows.
 *
 * ⭐ THE DOCUMENTS COME FROM THE FEDERAL AUDIT CLEARINGHOUSE, and that is the
 * transferable find of this session. FAC serves the COMPLETE audited package as
 * a PDF with NO API KEY, NO AUTH and NO WAF, at a permanent per-report id, back
 * to at least FY2016. It would have solved session 2's two hardest access
 * problems — charlottenc.gov's Akamai WAF (which needed a real Chromium) and
 * Mecklenburg's Widen DAM (which has no durable file URL at all) — and it
 * answers Richland County's site here, which 403s curl AND PowerShell.
 * ⚠ The metadata API at api.fac.gov DOES need `X-Api-Key: DEMO_KEY`; the PDF
 * endpoint needs nothing.
 *
 * ⚠ The manifest records the URL THAT SERVED THE BYTES, which for most years is
 * the FAC dissemination URL and for Myrtle Beach FY2018 is the city's own CDN.
 * That is the point of the manifest — Travis is the precedent, where filenames
 * switch from `-cafr` to `-acfr` mid-series and a rebuilt URL would be a guess.
 * The `source_url` stamped on the loaded rows is the city's publication page,
 * which is a different question: where a READER goes, not where the bytes came
 * from.
 *
 * Usage:
 *   node scripts/fetchScCityAcfrs.mjs            # skips files already present
 *   node scripts/fetchScCityAcfrs.mjs --force
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  FAC_PDF_BASE, COLUMBIA_FAC_REPORTS, MYRTLE_BEACH_FAC_REPORTS,
  COLUMBIA_LOAD_YEARS, MYRTLE_BEACH_LOAD_YEARS, FIRST_PARTY_OVERRIDES,
} from './data/scAcfrSources.mjs';

const ROOT = process.cwd();
const BASE = path.join(ROOT, '_acfr-work', 'sc', 'acfr');

/**
 * ⚠ The city CDN serving Myrtle Beach FY2018 403s a bare curl and passes a
 * request carrying browser `Sec-Fetch-*` headers plus a Referer — the same
 * workaround the Oregon cities needed. FAC needs none of this.
 */
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
};

/** Page count via pdfinfo, for the manifest only. 0 if pdfinfo is unavailable. */
function pageCount(file) {
  const r = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  const m = /^Pages:\s+(\d+)/m.exec(r.stdout || '');
  return m ? Number(m[1]) : 0;
}

const ENTITIES = [
  { slug: 'columbia', years: COLUMBIA_LOAD_YEARS, reports: COLUMBIA_FAC_REPORTS },
  { slug: 'myrtlebeach', years: MYRTLE_BEACH_LOAD_YEARS, reports: MYRTLE_BEACH_FAC_REPORTS },
];

function urlFor(slug, fy, reports) {
  const override = FIRST_PARTY_OVERRIDES[`${slug}_${fy}`];
  return override ?? `${FAC_PDF_BASE}/${reports[fy]}`;
}

export async function main() {
  const { values } = parseArgs({ options: { force: { type: 'boolean', default: false } } });

  for (const { slug, years, reports } of ENTITIES) {
    const dir = path.join(BASE, slug);
    mkdirSync(dir, { recursive: true });
    const manifest = {};

    for (const fy of years) {
      const url = urlFor(slug, fy, reports);
      const file = path.join(dir, `${slug}_${fy}.pdf`);

      if (values.force || !existsSync(file) || statSync(file).size === 0) {
        const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
        if (!res.ok) throw new Error(`${slug} FY${fy}: HTTP ${res.status} from ${url}`);
        const buf = Buffer.from(await res.arrayBuffer());
        // ⚠ A WAF's HTML error page is a 200 with the wrong bytes. Check the magic.
        if (buf.subarray(0, 4).toString('latin1') !== '%PDF') {
          throw new Error(`${slug} FY${fy}: not a PDF (starts ${JSON.stringify(buf.subarray(0, 16).toString('latin1'))}) from ${url}`);
        }
        writeFileSync(file, buf);
        console.log(`  fetch ${slug} FY${fy}  ${buf.length.toLocaleString()} bytes  <- ${url}`);
      } else {
        console.log(`  have  ${slug} FY${fy}  (${statSync(file).size.toLocaleString()} bytes)`);
      }

      // ⚠ The manifest entry is an OBJECT with `.url`; a bare string is read as
      // an unattributed row and refused. `sha256` is what makes a loaded figure
      // reproducible from the exact bytes years later — the point of recording
      // provenance at all.
      const bytes = readFileSync(file);
      manifest[fy] = {
        fy,
        url,
        bytes: bytes.length,
        pages: pageCount(file),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    }

    const mPath = path.join(dir, 'manifest.json');
    writeFileSync(mPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`  wrote ${mPath} (${Object.keys(manifest).length} years)\n`);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fetchScCityAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
