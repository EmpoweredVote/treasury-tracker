#!/usr/bin/env node
/**
 * Virginia APA Comparative Report — BATCH driver (v2.7 Phase 80/81 — VALOAD-01/02/04/03)
 *
 * Iterates the Phase 79 single-locality loader (scripts/loadVAComparativeReport.js) over the
 * report's full roster: all 38 independent cities (§0), 95 counties (§1), and 37 towns (§2)
 * for a fiscal year, writing operating + revenue + per-capita for each, idempotently and
 * fully sourced.
 *
 * The loader and its parse/write path are already proven (Phase 79). This driver adds only:
 *   1. enumerateRoster()        — segment the report into cities / counties / towns by the
 *                                 "No." column resetting to 1 (CONTEXT 80 D-03).
 *   2. the city/county loop      — display-name + entity_type rules (CONTEXT 80 D-05):
 *                                 cities stored bare / entity_type=city; counties stored as
 *                                 "<name> County" / entity_type=county. The XLSX MATCH name
 *                                 stays the bare col-2 value; section-scoped lookup keeps
 *                                 homonym counties (Fairfax/Franklin/Richmond/Roanoke) from
 *                                 colliding with the same-named city (CONTEXT 80 D-04).
 *   3. the town branch (Phase 81) — towns stored bare / entity_type=town / sectionIndex=2.
 *                                 Safe because there are zero town↔city bare-name collisions,
 *                                 and the 6 town↔county overlaps (Bedford, Culpeper, Orange,
 *                                 Pulaski, Tazewell, Wise) don't collide because counties carry
 *                                 the "County" suffix (CONTEXT 81 D-02).
 *
 * Usage:
 *   node scripts/loadVAComparativeReportBatch.js --file _va-recon/fy2024-comparative-report.xlsx --fy 2024 --dry-run
 *   node scripts/loadVAComparativeReportBatch.js --file _va-recon/fy2024-comparative-report.xlsx --fy 2024 --entity-type county --limit 3 --dry-run
 *   node scripts/loadVAComparativeReportBatch.js --file _va-recon/fy2024-comparative-report.xlsx --fy 2024 --entity-type town --dry-run
 *   node scripts/loadVAComparativeReportBatch.js --file _va-recon/fy2024-comparative-report.xlsx --fy 2024            # live (needs .env SUPABASE_SERVICE_KEY)
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import {
  cellNum,
  cellText,
  findHeaderRow,
  importLocality,
  getSupabase,
} from './loadVAComparativeReport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Segment the report's locality roster from Exhibit C. Sections appear in the uniform order
 * Cities → Counties → Towns; the "No." column (col 1) resets to 1 at the start of each.
 * Rows with a non-numeric col-1 (section headers, footnotes, "Total", "Grand Total") are skipped.
 * Returns ordered bare col-2 names: { cities, counties, towns }.
 */
export function enumerateRoster(workbook) {
  const ws = workbook.getWorksheet('Exhibit C');
  if (!ws) throw new Error('Exhibit C sheet missing');
  const hdr = findHeaderRow(ws);
  const sections = [[], [], []]; // 0=cities, 1=counties, 2=towns
  let section = -1;
  for (let r = hdr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const no = cellNum(row.getCell(1));
    if (!Number.isFinite(no)) continue;      // skip header/footnote rows (no reset)
    if (no === 1) section += 1;              // No. reset → next section
    if (section < 0 || section > 2) continue;
    const name = cellText(row.getCell(2));
    // Section "Total"/"Grand Total" summary rows carry a numeric col-1 (the section count,
    // e.g. 38/95/37/170) so they survive the numeric filter — exclude them by name.
    if (!name || /^total$|^grand total$/i.test(name)) continue;
    sections[section].push(name);
  }
  return { cities: sections[0], counties: sections[1], towns: sections[2] };
}

/** Resolve the per-FY source_url from scripts/vaApaDatasets.json (CONTEXT 80 D-07). */
export function sourceUrlForFY(fiscalYear) {
  try {
    const manifest = JSON.parse(readFileSync(join(__dirname, 'vaApaDatasets.json'), 'utf8'));
    const entry = (manifest.years || []).find((y) => Number(y.fiscal_year) === Number(fiscalYear));
    return entry ? (entry.xlsxUrl || entry.datasetUrl || null) : null;
  } catch {
    return null;
  }
}

/**
 * Build the city+county work list for a fiscal year and load each via importLocality.
 * opts: { file, fiscalYear, sourceUrl, entityTypes=['city','county'], dryRun, limit, sourceDate }
 * Returns { results, counts: { loaded, skipped, errored }, processed }.
 */
export async function loadVAComparativeReportBatch(opts) {
  const {
    file,
    fiscalYear,
    entityTypes = ['city', 'county'],
    dryRun = false,
    limit = null,
    sourceDate = new Date().toISOString().slice(0, 10),
  } = opts;
  const sourceUrl = opts.sourceUrl || sourceUrlForFY(fiscalYear);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const roster = enumerateRoster(wb);

  // Build the work list: cities bare / §0; counties "<name> County" / §1; towns bare / §2.
  const work = [];
  if (entityTypes.includes('city')) {
    for (const name of roster.cities) {
      work.push({ matchName: name, displayName: name, entityType: 'city', sectionIndex: 0 });
    }
  }
  if (entityTypes.includes('county')) {
    for (const name of roster.counties) {
      work.push({ matchName: name, displayName: `${name} County`, entityType: 'county', sectionIndex: 1 });
    }
  }
  if (entityTypes.includes('town')) {
    // Towns stored bare (no suffix) / entity_type='town' / sectionIndex=2 (CONTEXT 81 D-02).
    // Zero town↔city bare-name collisions; 6 town↔county overlaps are safe because counties
    // carry the "County" suffix (Bedford County ≠ Bedford, etc.).
    for (const name of roster.towns) {
      work.push({ matchName: name, displayName: name, entityType: 'town', sectionIndex: 2 });
    }
  }
  const workList = limit != null ? work.slice(0, limit) : work;

  console.log(`\nVA APA Comparative Report — BATCH FY${fiscalYear}${dryRun ? '  [dry-run]' : ''}`);
  console.log(`  Roster: ${roster.cities.length} cities, ${roster.counties.length} counties, ${roster.towns.length} towns`);
  console.log(`  Loading: ${workList.length} localities [${entityTypes.join(', ')}]${limit != null ? ` (limit ${limit})` : ''}`);
  console.log(`  Source: Virginia APA Comparative Report | url=${sourceUrl || '(none)'} | date=${sourceDate}\n`);

  const supabase = dryRun ? null : await getSupabase();
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const results = [];
  const counts = { loaded: 0, skipped: 0, absent: 0, errored: 0 };

  for (const w of workList) {
    try {
      const s = await importLocality(supabase, wb, {
        ...w, state: 'VA', fiscalYear, sourceUrl, sourceDate, dryRun,
      });
      results.push(s);
      let status;
      if (s.absent) {
        status = 'absent — no FY' + fiscalYear + ' data';
        counts.absent += 1;
      } else if (dryRun) {
        status = 'dry-run';
      } else {
        // importDataset returns null on a never-overwrite skip; non-null on a write.
        const wrote = (s.operating != null) || (s.revenue != null);
        status = wrote ? 'loaded' : 'skipped(never-overwrite)';
        counts[wrote ? 'loaded' : 'skipped'] += 1;
      }
      const mark = s.absent ? '·' : '✓';
      console.log(`  ${mark} ${w.displayName.padEnd(24)} op ${fmt(s.operatingTotal).padStart(16)}  rev ${fmt(s.revenueTotal).padStart(16)}  pop ${s.population ?? '—'}  [${status}]`);
    } catch (e) {
      counts.errored += 1;
      results.push({ displayName: w.displayName, entityType: w.entityType, error: e.message });
      console.error(`  ✗ ${w.displayName} — ERROR: ${e.message}`);
    }
  }

  console.log(`\nSummary FY${fiscalYear}: ${workList.length} processed | loaded ${counts.loaded} | skipped(never-overwrite) ${counts.skipped} | absent(no report data) ${counts.absent} | errored ${counts.errored}${dryRun ? '  (dry-run — no writes)' : ''}`);
  return { results, counts, processed: workList.length };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      fy: { type: 'string' },
      'source-url': { type: 'string' },
      'source-date': { type: 'string' },
      'entity-type': { type: 'string' }, // comma list, e.g. "city,county"; default both
      limit: { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
  });
  if (!values.file || !values.fy) {
    console.error('Required: --file <xlsx> --fy <YYYY> [--entity-type city|county] [--limit N] [--dry-run]');
    process.exit(1);
  }
  const entityTypes = values['entity-type']
    ? values['entity-type'].split(',').map((s) => s.trim()).filter(Boolean)
    : ['city', 'county'];

  await loadVAComparativeReportBatch({
    file: values.file,
    fiscalYear: parseInt(values.fy, 10),
    sourceUrl: values['source-url'] || null,
    sourceDate: values['source-date'] || undefined,
    entityTypes,
    limit: values.limit != null ? parseInt(values.limit, 10) : null,
    dryRun: !!values['dry-run'],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
