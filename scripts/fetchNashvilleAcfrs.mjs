/**
 * Fetch Metro Nashville's ACFRs and write the provenance manifest.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Knight session 6b. Writes `_acfr-work/tn/acfr/nashville_<fy>.pdf` plus a
 * `manifest.json` recording the URL, byte count, page count and sha256 of each
 * file actually parsed.
 *
 * ⚠ THE URLS ARE NOT DERIVABLE. They carry the month Metro uploaded them and the
 * naming changes three times across the decade (`CAFR2016.pdf`,
 * `ACFRFY21_01_21_2022_Upload.pdf`,
 * `2022_Annual_Comprehensive_Financial_Report_Final_Published_06062023.pdf`).
 * This is the Travis case the manifest exists for — a rebuilt URL would be a
 * guess about where the naming boundary falls.
 *
 * ⚠ `sha256` is what makes a loaded figure reproducible from the exact bytes
 * years later, which is the point of recording provenance at all.
 *
 * Usage:
 *   node scripts/fetchNashvilleAcfrs.mjs           # skips files already present
 *   node scripts/fetchNashvilleAcfrs.mjs --force
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { NASHVILLE_ACFR_URLS, NASHVILLE_LOAD_YEARS } from './data/tnKnightEntities.mjs';

const DIR = path.join(process.cwd(), '_acfr-work', 'tn', 'acfr');

/** Page count via pdfinfo, for the manifest only. 0 if pdfinfo is unavailable. */
function pageCount(file) {
  const r = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  const m = /^Pages:\s+(\d+)/m.exec(r.stdout || '');
  return m ? Number(m[1]) : 0;
}

export async function main() {
  const { values } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
  mkdirSync(DIR, { recursive: true });
  const manifest = {};

  for (const fy of NASHVILLE_LOAD_YEARS) {
    const url = NASHVILLE_ACFR_URLS[fy];
    if (!url) throw new Error(`No URL recorded for FY${fy}`);
    const file = path.join(DIR, `nashville_${fy}.pdf`);

    if (values.force || !existsSync(file) || statSync(file).size === 0) {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`FY${fy}: HTTP ${res.status} from ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // ⚠ A WAF's HTML error page is a 200 with the wrong bytes. Check the magic.
      if (buf.subarray(0, 4).toString('latin1') !== '%PDF') {
        throw new Error(`FY${fy}: not a PDF from ${url}`);
      }
      writeFileSync(file, buf);
      console.log(`  fetch FY${fy}  ${buf.length.toLocaleString()} bytes`);
    } else {
      console.log(`  have  FY${fy}  (${statSync(file).size.toLocaleString()} bytes)`);
    }

    const bytes = readFileSync(file);
    manifest[fy] = {
      fy,
      url,
      bytes: bytes.length,
      pages: pageCount(file),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }

  const mPath = path.join(DIR, 'manifest.json');
  writeFileSync(mPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`  wrote ${mPath} (${Object.keys(manifest).length} years)`);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fetchNashvilleAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
