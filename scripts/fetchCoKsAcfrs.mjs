/**
 * Fetch the Colorado + Kansas ACFRs for Knight session 7b.
 *
 * NO SHEBANG — tests import `pdfPathFor`.
 *
 * Usage:
 *   node scripts/fetchCoKsAcfrs.mjs --out _acfr-work/coks
 *   node scripts/fetchCoKsAcfrs.mjs --out _acfr-work/coks --entity wichita
 *   node scripts/fetchCoKsAcfrs.mjs --out _acfr-work/coks --entity boulder --fy 2019
 *
 * Four entities, three access routes — see scripts/data/coKsAcfrSources.mjs for
 * why each is what it is.
 *
 * ⚠ EVERY DOWNLOAD IS VERIFIED, NOT ASSUMED. A 200 carrying a PDF proves
 * nothing about WHICH document arrived: this fetcher checks the magic bytes and
 * then, separately, `verifyCoKsAcfrYears.mjs` reads the fiscal year off each
 * cover page. Wichita's archive ids are not ordered by year (FY2018 is ADID 56
 * while FY2017 is 57), so a mis-mapped id would otherwise load one year's money
 * under another year's label and tie perfectly at every stage.
 *
 * ⚠ documents.bouldercolorado.gov serves an INCOMPLETE TLS CHAIN — curl fails
 * with exit 60 there, the Ohio AOS shape. Not used: Boulder city comes from FAC.
 */

import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { CO_KS_WINDOWS, documentUrlFor } from './data/coKsAcfrSources.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0 Safari/537.36';

export function pdfPathFor(dir, entityKey, fiscalYear) {
  return join(dir, `${entityKey}-${fiscalYear}.pdf`);
}

async function download(url, dest) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'application/pdf,*/*',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
        },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // ⚠ A 200 is not a PDF. An error page served with status 200 would
      // otherwise be written to disk and fail much later, in the parser.
      if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new Error(`not a PDF (starts ${JSON.stringify(buf.subarray(0, 16).toString('latin1'))})`);
      }
      writeFileSync(dest, buf);
      return buf.length;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => { setTimeout(r, 2000 * (attempt + 1)); });
    }
  }
  return 0;
}

export async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: '_acfr-work/coks' },
      entity: { type: 'string' },
      fy: { type: 'string' },
      force: { type: 'boolean', default: false },
    },
  });
  mkdirSync(values.out, { recursive: true });

  const entities = values.entity ? [values.entity] : Object.keys(CO_KS_WINDOWS);
  let got = 0; let skipped = 0; const failures = [];

  for (const key of entities) {
    const years = CO_KS_WINDOWS[key];
    if (!years) throw new Error(`Unknown entity ${key}`);
    for (const fy of years) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const dest = pdfPathFor(values.out, key, fy);
      if (!values.force && existsSync(dest) && statSync(dest).size > 0) { skipped += 1; continue; }
      const url = documentUrlFor(key, fy);
      if (!url) { failures.push(`${key} FY${fy}: no URL in the manifest`); continue; }
      try {
        const bytes = await download(url, dest);
        got += 1;
        console.log(`  ${key} FY${fy}  ${(bytes / 1e6).toFixed(1)} MB`);
      } catch (err) {
        failures.push(`${key} FY${fy}: ${err.message}  (${url})`);
        console.log(`  FAILED ${key} FY${fy} — ${err.message}`);
      }
    }
  }

  console.log(`\nFetched ${got}, already present ${skipped}, failed ${failures.length}.`);
  for (const f of failures) console.log(`  ! ${f}`);
  // ⚠ Reported, never silently tolerated — but a missing year is a gap to
  // record, not a reason to discard the documents that did arrive.
  if (got === 0 && skipped === 0) {
    console.error('REFUSING: nothing was fetched at all.');
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fetchCoKsAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
