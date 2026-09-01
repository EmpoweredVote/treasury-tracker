/**
 * Bulk-fetch the Michigan F-65 for the statewide sweep.
 *
 * NO SHEBANG — kept importable.
 *
 * Usage:
 *   node scripts/fetchMiStatewideF65.mjs --out _acfr-work/mi-sweep/filings
 *
 * Writes one `<key>-<fy>.json` per entity-year, byte-compatible with what
 * scripts/fetchMichiganF65.mjs writes, so the loader reads either.
 *
 * ── WHY BULK ───────────────────────────────────────────────────────────────
 *
 * The session-7a fetcher asks for one entity-year at a time, which is right for
 * two entities and wrong for 364: it would be 5,775 requests against a public
 * portal that is doing us a favour. This pulls each of the 32 datasets ONCE,
 * server-side filtered to the rows the loader actually reads, and splits the
 * result by municode locally.
 *
 * ⚠⚠ THE SERVER-SIDE FILTER IS THE RISK, so it is deliberately WIDE. It keeps
 * every row of tables T1 and T2 rather than naming the groups it wants, because
 * a group filter would have to encode the exact spelling of `General Fund` and
 * `All Other Governmental Funds` on a portal that has already been caught
 * changing the TYPE of `municode` between years. The loader — which has the
 * group logic and the tests — does the narrowing. A fetcher that pre-decides
 * what matters is a fetcher that can silently drop a fund.
 *
 * ⚠⚠ JOIN ON A ZERO-PADDED MUNICODE. FY2020's City dataset emits `012010` where
 * every other year emits `12010`; splitting on the raw value would file 18
 * cities' FY2020 under an entity that does not exist.
 *
 * ⚠ A dataset that returns zero rows for an entity is REPORTED, never written as
 * an empty filing a later stage could read as "filed nothing".
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import { DATASETS, PORTAL } from './fetchMichiganF65.mjs';
import { MI_STATEWIDE_ENTITIES, MI_STATEWIDE_LOAD_WINDOW } from './data/miStatewideEntities.mjs';

const PAGE = 50000;

/** Tables T1 (Revenue) and T2 (Expenditure) — the only money flows TT loads. */
export function pageUrl(datasetId, offset) {
  const where = encodeURIComponent("starts_with(field_name, 'T1R') OR starts_with(field_name, 'T2R')");
  return `${PORTAL}/resource/${datasetId}.json?$where=${where}`
    + `&$limit=${PAGE}&$offset=${offset}&$order=:id`;
}

async function getJson(url, attempts = 5) {
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

export async function fetchDataset(datasetId) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const batch = await getJson(pageUrl(datasetId, offset));
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

export function canonicalMunicode(raw) {
  const digits = String(raw ?? '').trim();
  if (!/^[0-9]{1,6}$/.test(digits)) return null;
  return digits.padStart(6, '0');
}

async function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: '_acfr-work/mi-sweep/filings' },
      fy: { type: 'string' },
    },
  });
  mkdirSync(values.out, { recursive: true });

  const byCode = new Map(MI_STATEWIDE_ENTITIES.map((e) => [e.municode, e]));
  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: MI_STATEWIDE_LOAD_WINDOW.last - MI_STATEWIDE_LOAD_WINDOW.first + 1 },
      (_, i) => MI_STATEWIDE_LOAD_WINDOW.first + i);

  let files = 0; let skipped = 0; let unknown = 0;
  for (const unitType of ['City', 'County']) {
    for (const fy of years) {
      const id = DATASETS[unitType]?.[fy];
      if (!id) throw new Error(`no dataset id for ${unitType} FY${fy}`);
      const rows = await fetchDataset(id);

      const grouped = new Map();
      for (const r of rows) {
        const code = canonicalMunicode(r.municode);
        if (!code) continue;
        grouped.set(code, [...(grouped.get(code) ?? []), r]);
      }

      let wrote = 0;
      for (const [code, unitRows] of grouped) {
        const ent = byCode.get(code);
        // A unit outside the roster (wrong type for this dataset, or an
        // entity-year the census contradicted) is skipped, and counted.
        if (!ent || ent.unitType !== unitType) { unknown += 1; continue; }
        if (!ent.fiscalYears.includes(fy)) { skipped += 1; continue; }
        writeFileSync(join(values.out, `${ent.key}-${fy}.json`), JSON.stringify({
          entityKey: ent.key,
          municode: ent.municode,
          unitType,
          fiscalYear: fy,
          datasetId: id,
          sourceUrl: `${PORTAL}/d/${id}`,
          fetchedAt: new Date().toISOString(),
          rows: unitRows,
        }, null, 0));
        wrote += 1; files += 1;
      }
      console.log(`  ${unitType} FY${fy}: ${rows.length} rows -> ${wrote} filings`);
    }
  }
  console.log(`\nfilings written : ${files}`);
  console.log(`entity-years skipped (excluded by the census audit): ${skipped}`);
  console.log(`municodes not in the roster (other unit types): ${unknown}`);
  if (files === 0) { console.error('REFUSING: no filings written.'); return 1; }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((c) => process.exit(c));
}
