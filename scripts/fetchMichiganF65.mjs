/**
 * Fetch Michigan Form F-65 filings for the session-7a entities.
 *
 * NO SHEBANG — tests/miF65Load.test.mjs imports `DATASETS` to prove every year
 * in the load window has a dataset id. A `#!` on any module a test imports
 * breaks `npm test` on Windows (project_wa_cities_01).
 *
 * Usage:
 *   node scripts/fetchMichiganF65.mjs --out _acfr-work/mi
 *   node scripts/fetchMichiganF65.mjs --out _acfr-work/mi --fy 2024
 *
 * ── ACCESS: THE CLEANEST THE CAMPAIGN HAS SEEN, AFTER FLORIDA ───────────────
 *
 * The Michigan Treasury publishes the F-65 on the state's Socrata portal: a
 * plain anonymous GET, no key, no terms gate, no WAF, JSON out. One dataset per
 * fiscal year per unit type, FY2010-FY2025 with no gaps — sixteen years, the
 * deepest unbroken reach in this campaign.
 *
 * ⚠ The dataset IDs are NOT derivable from the year, so they are declared here
 * rather than rebuilt — the same reason `acfrGfLoad` reads a manifest. They were
 * enumerated from the catalogue API:
 *   https://data.michigan.gov/api/catalog/v1?q=F65&limit=200
 * ⚠ That catalogue FEDERATES across Socrata domains — the same query returns
 * Connecticut and New York datasets — so every ID below was filtered on
 * `metadata.domain === 'data.michigan.gov'` before being written down.
 *
 * ⚠ michigan.gov's WWW host sits behind a WAF that 403s a plain fetch (the
 * Charlotte/Akamai shape); `data.michigan.gov` does not. Only the PDF
 * instructions need browser headers, and those are not fetched here.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { MI_ENTITIES, MI_LOAD_WINDOW } from './data/miKnightEntities.mjs';

export const PORTAL = 'https://data.michigan.gov';
export const CATALOG_URL = 'https://data.michigan.gov/api/catalog/v1?q=F65&limit=200';

/** Socrata dataset ids, verified to live on data.michigan.gov. */
export const DATASETS = Object.freeze({
  City: Object.freeze({
    2010: 'aumu-55m7', 2011: 'vfx2-3cz6', 2012: '63ba-be73', 2013: 'v7qr-uym9',
    2014: 'jqfh-6z6b', 2015: '2pc2-rasj', 2016: '9cs3-yf47', 2017: 'tzgc-djn2',
    2018: '2b2b-imsd', 2019: '6wkq-hjsz', 2020: 'ftqd-yq8b', 2021: 'ewes-8xpg',
    2022: 'qwus-vujt', 2023: 'xyp3-pw2b', 2024: 'vk42-auzg', 2025: 'ii3e-hrra',
  }),
  County: Object.freeze({
    2010: 'uj46-zghe', 2011: 'uzsm-huuv', 2012: '7h2t-dw63', 2013: 'fz4e-fjjf',
    2014: '39ft-b5r2', 2015: '27u5-tyhc', 2016: '4v3w-u6bh', 2017: '8pgd-dgmu',
    2018: '39pz-juri', 2019: 'qdhd-chsz', 2020: '3b83-ypyz', 2021: 'vpup-727t',
    2022: 'augd-8jqd', 2023: 'sem3-w6wy', 2024: 'gwey-cypv', 2025: 'f6yh-g753',
  }),
});

export function datasetFor(unitType, fiscalYear) {
  return DATASETS[unitType]?.[fiscalYear] ?? null;
}

/** ⚠ Filter on `municode`, the publisher's stable key — never on `lu_name`. */
export function rowsUrl(datasetId, municode) {
  return `${PORTAL}/resource/${datasetId}.json`
    + `?$where=${encodeURIComponent(`municode='${municode}'`)}&$limit=5000`;
}

async function getJson(url, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      if (i < attempts - 1) await new Promise((r) => { setTimeout(r, 1500 * (i + 1)); });
    }
  }
  throw last;
}

export async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: '_acfr-work/mi' },
      fy: { type: 'string' },
      entity: { type: 'string' },
    },
  });
  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: MI_LOAD_WINDOW.last - MI_LOAD_WINDOW.first + 1 },
      (_, i) => MI_LOAD_WINDOW.first + i);
  const entities = values.entity
    ? MI_ENTITIES.filter((e) => e.key === values.entity)
    : MI_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);

  mkdirSync(values.out, { recursive: true });
  let files = 0;
  let empty = 0;
  for (const ent of entities) {
    for (const fy of years) {
      const id = datasetFor(ent.unitType, fy);
      if (!id) { console.log(`  no dataset for ${ent.unitType} FY${fy}`); continue; }
      const rows = await getJson(rowsUrl(id, ent.municode));
      // ⚠ A zero-row fetch is REPORTED, never written as an empty filing that a
      // later stage could read as "filed nothing".
      if (!rows.length) { empty += 1; console.log(`  EMPTY ${ent.key} FY${fy} (${id})`); continue; }
      const path = join(values.out, `${ent.key}-${fy}.json`);
      writeFileSync(path, JSON.stringify({
        entityKey: ent.key,
        municode: ent.municode,
        unitType: ent.unitType,
        fiscalYear: fy,
        datasetId: id,
        sourceUrl: `${PORTAL}/d/${id}`,
        fetchedAt: new Date().toISOString(),
        rows,
      }, null, 0));
      files += 1;
      console.log(`  ${ent.key} FY${fy} -> ${rows.length} rows (${id})`);
    }
  }
  console.log(`\nWrote ${files} filings to ${values.out} (${empty} empty).`);
  if (files === 0) {
    console.error('REFUSING: nothing was fetched.');
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fetchMichiganF65.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
