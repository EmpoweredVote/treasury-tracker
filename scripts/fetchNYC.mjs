#!/usr/bin/env node
/**
 * Fetch every in-window NYC ACFR to docs/NYC/.
 *
 * First-party only -- every byte comes from comptroller.nyc.gov. Skips a file
 * that already exists so re-runs are cheap. `docs/*` is gitignored, so nothing
 * here is committed.
 *
 * Usage:
 *   node scripts/fetchNYC.mjs
 *   node scripts/fetchNYC.mjs --fy 2024
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { NYC_FYS, nycAcfrUrl } from './lib/nycAcfrSources.mjs';

const DIR = 'docs/NYC';
const arg = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };
const only = arg('--fy');
const fys = only ? [Number(only)] : NYC_FYS;

await mkdir(DIR, { recursive: true });

let fetched = 0;
let skipped = 0;
for (const fy of fys) {
  const dest = `${DIR}/nyc-${fy}-acfr.pdf`;
  try {
    await access(dest);
    skipped += 1;
    continue;
  } catch { /* not present -- fetch it */ }

  // ⚠ Resolved BEFORE the network call, so an unknown year fails on the source
  // map's refusal rather than on a 404 that looks like a transient outage.
  const url = nycAcfrUrl(fy);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FY${fy}: HTTP ${res.status} for ${url}`);
    process.exit(2);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // A WAF error page is ~91KB of HTML and returns 200 on some hosts. An ACFR
  // is never under 500KB; refuse anything that small rather than extract it.
  if (buf.length < 500_000 || buf.subarray(0, 5).toString() !== '%PDF-') {
    console.error(`FY${fy}: not a PDF (${buf.length} bytes) from ${url}`);
    process.exit(2);
  }
  await writeFile(dest, buf);
  console.log(`FY${fy}: ${(buf.length / 1e6).toFixed(1)} MB -> ${dest}`);
  fetched += 1;
}
console.log(`\n${fetched} fetched, ${skipped} already present.`);
