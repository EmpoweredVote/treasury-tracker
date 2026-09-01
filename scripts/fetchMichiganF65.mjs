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
 * ⚠⚠ That catalogue FEDERATES across Socrata domains, and "looks like Michigan"
 * is NOT the filter. The same query returns Virginia datasets AND NINE
 * `mi-treasury.data.socrata.com` datasets named `2016 F65 DATA` — a Michigan
 * Treasury Socrata domain carrying an older, differently-shaped F-65 extract
 * with no unit-type split. Every ID below was filtered on the EXACT domain
 * `metadata.domain === 'data.michigan.gov'` before being written down.
 *
 * ⚠ All 80 IDs (16 years x 5 unit types) were re-verified against the live
 * catalogue on 2026-09-01: 0 mismatches.
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
  Village: Object.freeze({
    2010: 'vh2c-y5ec', 2011: 'sxyd-rwhd', 2012: 'mma8-cmwq', 2013: '8hd5-gm5u',
    2014: 'r6vq-38j5', 2015: 'hdzx-qsna', 2016: 'e2m4-zmqx', 2017: 'eib5-ncft',
    2018: '5dib-kfan', 2019: '64cq-jwnn', 2020: 'mk56-e2kz', 2021: '66nf-2st7',
    2022: 'gk28-wfc8', 2023: 'rafs-6syg', 2024: '3iva-dwqi', 2025: '6djr-uu4w',
  }),
  // ⚠⚠ PART 1 AND PART 2 ARE DISJOINT SETS OF TOWNSHIPS, NOT TWO HALVES OF ONE
  // FORM. Measured over all sixteen years: Part 1 covers 577 municodes, Part 2
  // covers 663, and the OVERLAP IS ZERO — no township ever appears in both, in
  // any year. Their union is exactly 1,240, which is exactly the number of
  // townships the Census counts in Michigan.
  //
  // Reading only one part would silently halve the roster; joining them per unit
  // would double every township's money. Read both, as two independent sources
  // of whole filings.
  'Township Part 1': Object.freeze({
    2010: 'pnw6-t8wy', 2011: '7cgj-agee', 2012: 'ib8r-rq84', 2013: 'tw4k-3htr',
    2014: '9xfa-6yac', 2015: '8d3y-5432', 2016: 'c5td-jruv', 2017: '23jd-8567',
    2018: 'i8yj-a6wn', 2019: 'ng2v-ag57', 2020: '7xnn-wam2', 2021: 'cg5q-azzy',
    2022: '89gq-qqsi', 2023: 'tv4s-drxf', 2024: 'eqsx-hk2h', 2025: 'kav9-mfb3',
  }),
  'Township Part 2': Object.freeze({
    2010: 'x444-nw2p', 2011: 'fnim-ewqv', 2012: 'vjwv-gisb', 2013: 'isds-hgy8',
    2014: 'ydpv-4wdc', 2015: 'vcs3-7my4', 2016: 'dvfg-jbue', 2017: '5uxf-rba5',
    2018: 'hiiw-ik72', 2019: 'm8cx-grfm', 2020: '6dn8-wrne', 2021: 'pspc-gtks',
    2022: '85ts-jhs2', 2023: '3qs9-7jii', 2024: 'bd8e-bqvw', 2025: '2see-6c92',
  }),
});

/**
 * ⚠⚠ ONE PUBLISHED DATASET CANNOT BE READ AT ALL, AND IT FAILS LOUDLY.
 *
 * In `FY2016 F65 Village` the `field_name` column is a COPY OF `field_data`:
 * every row carries the amount where the form's grid coordinate belongs.
 * Measured over the whole dataset — **83,274 of 83,274 rows, 100%** — and ZERO
 * rows hold a `T{table}R{row}C{column}` value. Socrata therefore types the
 * column `number`, which is why the server-side `starts_with(field_name, 'T1R')`
 * filter returns HTTP 400 rather than rows: the type mismatch is the symptom,
 * the missing coordinate is the defect. It is the only one of the 80 datasets
 * whose `field_name` is not `text`.
 *
 * ⚠⚠ THIS IS NOT RECOVERABLE BY DROPPING THE FILTER. `dedupeFilingRows` keys on
 * `field_name` + `group`, so with the amount in that column two genuinely
 * different line items that happen to share a figure inside one fund would be
 * collapsed as a duplicate — silently deleting real money. The grid coordinate
 * is also the only thing giving the form's rows their published ORDER.
 *
 * So the 251 village filings of FY2016 are NOT LOADED. Each of those villages
 * keeps its other fifteen years. ⚠ The unit ROSTER is still read from this
 * dataset — `municode`, `lu_name` and `fiscalendmonth` are all intact, and the
 * roster query does not touch `field_name`.
 */
export const UNUSABLE_DATASETS = Object.freeze([
  Object.freeze({
    unitType: 'Village',
    fiscalYear: 2016,
    datasetId: 'e2m4-zmqx',
    why: 'field_name is a copy of field_data on all 83,274 rows — the T/R/C grid '
      + 'coordinate the extraction and the dedup key both depend on is absent',
  }),
]);

export function datasetIsUsable(unitType, fiscalYear) {
  return !UNUSABLE_DATASETS.some(
    (d) => d.unitType === unitType && d.fiscalYear === Number(fiscalYear));
}

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
