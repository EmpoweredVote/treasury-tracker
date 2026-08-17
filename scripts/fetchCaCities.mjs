/**
 * CA-CITIES-01 ACFR fetcher.
 *
 * California has NO State Auditor portal — no single host serving every city's
 * audited filings from one API. That portal is the entire reason WA-CITIES-01
 * was cheap per entity, and none of it transfers: each city here is its own
 * site, its own URL scheme, its own document layout. So this file is a manifest
 * of pinned per-city, per-year URLs rather than a client for a registry.
 *
 * NO SHEBANG — see scripts/verify-ca-recon.mjs for why the whole cohort avoids
 * them. Run as `node scripts/fetchCaCities.mjs --city Modesto`.
 *
 * Usage:
 *   node scripts/fetchCaCities.mjs --city Modesto [--force]
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cityByName } from './lib/caRoster.mjs';

/**
 * Modesto publishes through a CivicPlus ArchiveCenter. The item id is stable per
 * document and the fiscal year in the title is the SPAN ("FY 2024-25"), so the
 * TT fiscal year is the ENDING year — confirmed against each document's own
 * period sentence ("Year Ended June 30, 2025"), never inferred from the title.
 *
 * Recon 2026-08-16: plain GET works, no Sec-Fetch-* WAF workaround needed (that
 * was an Oregon-cities requirement and does not apply here).
 */
const MODESTO_ITEMS = {
  2025: 4510, 2024: 4280, 2023: 3987, 2022: 3679, 2021: 3512, 2020: 3274,
  2019: 3076, 2018: 2859, 2017: 2684, 2016: 2365, 2015: 2285, 2014: 139,
  2013: 140, 2012: 141, 2011: 142, 2010: 143, 2009: 144, 2008: 145,
  2007: 124, 2006: 125, 2005: 126, 2004: 127, 2003: 128, 2002: 129,
  // Below the loadable window but pinned so the recon record is reproducible:
  2001: 130, 2000: 131, 1999: 132, 1998: 133, 1997: 134, 1996: 135, 1995: 136,
};

const MANIFESTS = {
  Modesto: (fy) =>
    MODESTO_ITEMS[fy] && `https://www.modestogov.com/ArchiveCenter/ViewFile/Item/${MODESTO_ITEMS[fy]}`,
  // Stockton, Irvine, Santa Clarita, Chula Vista land in Tasks 9–12.
};

async function main() {
  const argv = process.argv.slice(2);
  const cityName = argv[argv.indexOf('--city') + 1];
  const force = argv.includes('--force');

  const city = cityByName(cityName);
  if (!city) throw new Error(`unknown city: ${cityName}`);
  const urlFor = MANIFESTS[city.name];
  if (!urlFor) throw new Error(`${city.name} has no manifest yet — its recon task has not run`);
  if (!city.fys.length) throw new Error(`${city.name} has no fiscal years in the roster`);

  mkdirSync(city.docDir, { recursive: true });

  for (const fy of city.fys) {
    const dest = path.join(city.docDir, `${city.pdfPrefix}-fy${fy}.pdf`);
    if (existsSync(dest) && !force) { console.log(`FY${fy} present, skipping`); continue; }
    const url = urlFor(fy);
    if (!url) { console.warn(`FY${fy} has no pinned URL — skipped`); continue; }

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`FY${fy}: HTTP ${resp.status} from ${url}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.subarray(0, 4).toString() !== '%PDF') {
      throw new Error(`FY${fy}: not a PDF (got ${buf.subarray(0, 16).toString('latin1')})`);
    }
    writeFileSync(dest, buf);
    console.log(`FY${fy}: ${buf.length.toLocaleString()} bytes -> ${dest}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
