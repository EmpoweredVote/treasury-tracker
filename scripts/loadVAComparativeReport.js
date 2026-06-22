#!/usr/bin/env node
/**
 * Virginia APA Comparative Report Loader (v2.7 Phase 79 — VASRC-01)
 *
 * Parses the Virginia Auditor of Public Accounts "Comparative Report of Local
 * Government Revenues and Expenditures" XLSX into the tracker's budget tree for a
 * single locality and writes it to Supabase via the existing budget RPCs.
 *
 * Mirrors scripts/loadUtahTransparency.js (the closest analog): same {n,a,c} tree
 * contract, same treasury_ensure_municipality + treasury_sync_city_budget write path,
 * same pre-skip never-overwrite guard (treasury_sync_city_budget is NOT source-safe —
 * see auto-memory project_sync_city_budget_not_source_safe). Swaps the BigQuery fetch
 * for an exceljs XLSX parse.
 *
 * Trees (CONTEXT 79 D-01/D-02):
 *   - Expenditure ('operating'): function -> activity, 2 levels.
 *       top  = the functions in Exhibit C (General Government Administration, Judicial
 *              Administration, Public Safety, Public Works, Health and Human Services,
 *              Education, Parks/Recreation/Cultural, Community Development, Non-Departmental)
 *       leaf = each function's activities, pulled from its sub-exhibit (Exhibit C1..C8).
 *       total = Exhibit C "Total Expenditures".
 *   - Revenue ('revenue'): source -> sub-source, 2 levels.
 *       top  = General Property Taxes, Other Local Taxes, Permits/Fees, Fines & Forfeitures,
 *              Charges for Services, Revenue from Use of Money & Property, Miscellaneous.
 *       leaf = sub-sources (property-tax breakout from Exhibit B; other-local-taxes from
 *              Exhibit B2; use-of-money Interest/Rental).
 *       total = Exhibit B "Total Local Revenue".
 *       (Intergovernmental aid — Exhibit B1 — is intentionally excluded this phase: it is
 *        not local revenue, the report headlines "Total Local Revenue", and including it
 *        would imply a false surplus vs. the expenditure side. Revisit for an all-sources view.)
 *
 * Parsing rule (recon — auto-memory reference_virginia_apa_comparative_report):
 *   A value column is a NODE when its next non-empty header is "Per Capita". This single
 *   rule extracts functions (Exhibit C), activities (sub-exhibits), and revenue sources
 *   (Exhibit B) without tripping on the duplicate "Interest"/"Total" labels. Grouped sources
 *   expand by scanning LEFT through their raw-$ detail columns until a derived
 *   (Per Capita / Percent) column is hit. Only raw-dollar columns are read; derived columns
 *   (Per Capita, Percent of Average/Revenue) and exceljs formula objects are ignored.
 *
 * Per-capita population (D-04): each FY's own "Population Estimates July <YYYY>" (Exhibit H).
 * Source stamping (D-05): data_source='Virginia APA Comparative Report'; source_url = the
 * per-FY data.virginia.gov dataset/XLSX URL (--source-url); source_date = fetch date.
 *
 * Usage:
 *   node scripts/loadVAComparativeReport.js --file <xlsx> --locality Alexandria --fy 2024 --dry-run
 *   node scripts/loadVAComparativeReport.js --file <xlsx> --locality "Falls Church" --state VA --entity-type city --fy 2024 --source-url <url>
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

export const DATA_SOURCE_NAME = 'Virginia APA Comparative Report';

// ── Cell helpers ──────────────────────────────────────────────────────────────
/** Raw numeric value of a cell; handles exceljs formula objects ({result}). NaN if non-numeric. */
export function cellNum(cell) {
  if (cell == null) return NaN;
  const v = cell.value;
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.result === 'number') return v.result;
    return NaN; // formula w/o cached numeric result, richText, etc. — never a raw-$ value
  }
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Plain text of a cell (richText-aware), whitespace-collapsed. */
export function cellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').replace(/\s+/g, ' ').trim();
    if (v.text != null) return String(v.text).replace(/\s+/g, ' ').trim();
    if (v.result != null) return String(v.result).replace(/\s+/g, ' ').trim();
    return '';
  }
  return String(v).replace(/\s+/g, ' ').trim();
}

const isDerived = (label) =>
  !label || /per\s*capita|percent|^census$|^population$|memo only|sources of funds/i.test(label);

/** First row whose column 1 reads "No." — the column-header row in every exhibit. */
function findHeaderRow(ws) {
  for (let r = 1; r <= Math.min(ws.rowCount, 12); r++) {
    if (/^no\.?$/i.test(cellText(ws.getRow(r).getCell(1)))) return r;
  }
  throw new Error(`Header row ("No.") not found in sheet ${ws.name}`);
}

/** First data row (below header) whose column 2 matches the locality name (case-insensitive). */
function findLocalityRow(ws, headerRow, name) {
  const want = name.trim().toLowerCase();
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    if (cellText(ws.getRow(r).getCell(2)).toLowerCase() === want) return ws.getRow(r);
  }
  throw new Error(`Locality "${name}" not found in sheet ${ws.name}`);
}

/** Ordered list of {col, label} for non-empty header cells (col >= 3). */
function headerCells(ws, headerRow) {
  const out = [];
  const row = ws.getRow(headerRow);
  for (let c = 3; c <= ws.columnCount; c++) {
    const label = cellText(row.getCell(c));
    if (label) out.push({ col: c, label });
  }
  return out;
}

/**
 * Node columns = value columns whose NEXT non-empty header is "Per Capita".
 * Scans left-to-right, stops at (and excludes) the column matching stopRe.
 * Returns [{col, label}].
 */
function extractNodeCols(ws, headerRow, stopRe) {
  const cells = headerCells(ws, headerRow);
  const out = [];
  for (let i = 0; i < cells.length; i++) {
    const { col, label } = cells[i];
    if (stopRe.test(label)) break;
    const next = cells[i + 1];
    if (next && /^per\s*capita$/i.test(next.label)) out.push({ col, label });
  }
  return out;
}

/** Raw-$ detail columns immediately left of a grouped-source column (scan-left until derived). */
function leftDetailCols(ws, headerRow, sourceCol) {
  const row = ws.getRow(headerRow);
  const out = [];
  for (let c = sourceCol - 1; c >= 3; c--) {
    const label = cellText(row.getCell(c));
    if (isDerived(label)) break;
    out.push({ col: c, label });
  }
  return out.reverse();
}

// ── Expenditure tree (Exhibit C + C1..C8) ───────────────────────────────────────
export function buildExpenditureTree(workbook, localityName) {
  const ws = workbook.getWorksheet('Exhibit C');
  if (!ws) throw new Error('Exhibit C sheet missing');
  const hdr = findHeaderRow(ws);
  const dataRow = findLocalityRow(ws, hdr, localityName);

  const funcs = extractNodeCols(ws, hdr, /total expenditures/i);
  const tree = [];
  for (const f of funcs) {
    const a = cellNum(dataRow.getCell(f.col));
    if (!Number.isFinite(a) || a === 0) continue;
    const name = f.label.replace(/\s*\(Exhibit [^)]*\)\s*/i, '').trim();
    const node = { n: name, a };
    // Drill into the sub-exhibit referenced in the function header, e.g. "(Exhibit C-3)" -> "Exhibit C3".
    const m = f.label.match(/Exhibit\s+C-?\s*(\d)/i);
    if (m) {
      // Sub-exhibit drill is best-effort: some functions (e.g. Education for cities with a
      // dependent/fiscally-separate school division) don't list the locality in their
      // sub-exhibit, or the sheet is shaped differently. On any lookup failure, leave the
      // function as a LEAF — the Exhibit C function total stays correct, only the activity
      // breakdown is omitted.
      try {
        const sub = workbook.getWorksheet(`Exhibit C${m[1]}`);
        if (sub) {
          const subHdr = findHeaderRow(sub);
          const subRow = findLocalityRow(sub, subHdr, localityName);
          const acts = extractNodeCols(sub, subHdr, /^total$/i);
          const children = [];
          for (const act of acts) {
            const av = cellNum(subRow.getCell(act.col));
            if (Number.isFinite(av) && av !== 0) children.push({ n: act.label, a: av });
          }
          if (children.length) {
            children.sort((x, y) => y.a - x.a);
            node.c = children;
          }
        }
      } catch { /* leaf fallback */ }
    }
    tree.push(node);
  }
  tree.sort((x, y) => y.a - x.a);

  const totalCol = headerCells(ws, hdr).find((h) => /total expenditures/i.test(h.label));
  const total = totalCol ? cellNum(dataRow.getCell(totalCol.col)) : tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

// ── Revenue tree (Exhibit B + B2) ───────────────────────────────────────────────
export function buildRevenueTree(workbook, localityName) {
  const ws = workbook.getWorksheet('Exhibit B');
  if (!ws) throw new Error('Exhibit B sheet missing');
  const hdr = findHeaderRow(ws);
  const dataRow = findLocalityRow(ws, hdr, localityName);
  const groupRow = ws.getRow(hdr - 1); // row 5: merged group headers (e.g. "Revenue from Use of Money and Property")

  const sources = extractNodeCols(ws, hdr, /total local revenue/i);
  const tree = [];
  for (const s of sources) {
    const a = cellNum(dataRow.getCell(s.col));
    if (!Number.isFinite(a) || a === 0) continue;

    let name = s.label.replace(/\s*\(Exhibit [^)]*\)\s*/i, '').replace(/^total\s+/i, '').trim();
    let children = [];

    if (/other local taxes/i.test(s.label)) {
      // Expand from Exhibit B2.
      const b2 = workbook.getWorksheet('Exhibit B2');
      if (b2) {
        const b2Hdr = findHeaderRow(b2);
        const b2Row = findLocalityRow(b2, b2Hdr, localityName);
        for (const col of extractNodeColsOrLeaf(b2, b2Hdr, /total revenues/i)) {
          const cv = cellNum(b2Row.getCell(col.col));
          if (Number.isFinite(cv) && cv !== 0) children.push({ n: col.label, a: cv });
        }
      }
    } else {
      // Scan-left detail columns (property-tax breakout, use-of-money Interest/Rental).
      const detail = leftDetailCols(ws, hdr, s.col);
      for (const d of detail) {
        const cv = cellNum(dataRow.getCell(d.col));
        if (Number.isFinite(cv) && cv !== 0) children.push({ n: d.label, a: cv });
      }
      // If the source header is a bare "Total", name it from the group header (row 5).
      if (/^total$/i.test(s.label)) {
        const g = cellText(groupRow.getCell(s.col));
        if (g) name = g;
      }
    }

    const node = { n: name, a };
    if (children.length > 1) {
      children.sort((x, y) => y.a - x.a);
      node.c = children;
    }
    tree.push(node);
  }
  tree.sort((x, y) => y.a - x.a);

  const totalCol = headerCells(ws, hdr).find((h) => /total local revenue/i.test(h.label));
  const total = totalCol ? cellNum(dataRow.getCell(totalCol.col)) : tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

/** Like extractNodeCols but for B2 where every tax column is a leaf (no Per-Capita between them);
 *  returns all raw-$ label columns up to the stop column. */
function extractNodeColsOrLeaf(ws, headerRow, stopRe) {
  const cells = headerCells(ws, headerRow);
  const out = [];
  for (const { col, label } of cells) {
    if (stopRe.test(label)) break;
    if (!isDerived(label)) out.push({ col, label });
  }
  return out;
}

// ── Population (Exhibit H) ───────────────────────────────────────────────────────
export function localityPopulation(workbook, localityName) {
  const ws = workbook.getWorksheet('Exhibit H');
  if (!ws) return null;
  const hdr = findHeaderRow(ws);
  const dataRow = findLocalityRow(ws, hdr, localityName);
  const popCol = headerCells(ws, hdr).find((h) => /population estimates july/i.test(h.label));
  if (!popCol) return null;
  const v = cellNum(dataRow.getCell(popCol.col));
  return Number.isFinite(v) ? v : null;
}

// ── Supabase write path (mirrors loadUtahTransparency importEntityData) ──────────
let _supabase = null;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY (set it in .env). Use --dry-run for a no-write parse.'); process.exit(1); }
  _supabase = createClient(url, key);
  return _supabase;
}

/** Read-only never-overwrite guard: returns the conflicting row if a DIFFERENT source owns it. */
async function findConflictingBudget(supabase, municipalityId, fiscalYear, datasetType) {
  const { data, error } = await supabase
    .schema('treasury').from('budgets')
    .select('id, data_source')
    .eq('municipality_id', municipalityId).eq('fiscal_year', fiscalYear).eq('dataset_type', datasetType)
    .limit(1);
  if (error) throw new Error(`Budget lookup failed: ${error.message}`);
  const existing = data && data[0];
  if (!existing) return null;
  return existing.data_source && existing.data_source !== DATA_SOURCE_NAME ? existing : null;
}

async function importDataset(supabase, municipalityId, fiscalYear, datasetType, tree, total, sourceUrl, sourceDate) {
  const conflict = await findConflictingBudget(supabase, municipalityId, fiscalYear, datasetType);
  if (conflict) {
    console.log(`  SKIP ${datasetType} FY${fiscalYear} — existing ${conflict.data_source} data preserved (never-overwrite)`);
    return null;
  }
  const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id: municipalityId,
    p_fiscal_year: fiscalYear,
    p_dataset_type: datasetType,
    p_total: total,
    p_tree: tree,
    p_row_count: tree.length,
    p_data_source_name: DATA_SOURCE_NAME,
    p_source_url: sourceUrl,
    p_source_date: sourceDate,
  });
  if (error) { console.error(`  RPC error (${datasetType}): ${error.message}`); return null; }
  return data;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      locality: { type: 'string' },
      state: { type: 'string' },
      'entity-type': { type: 'string' },
      fy: { type: 'string' },
      'source-url': { type: 'string' },
      'source-date': { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
  });

  if (!values.file || !values.locality || !values.fy) {
    console.error('Required: --file <xlsx> --locality <name> --fy <YYYY> [--dry-run]');
    process.exit(1);
  }
  const fiscalYear = parseInt(values.fy, 10);
  const state = values.state || 'VA';
  const entityType = values['entity-type'] || 'city';
  const sourceUrl = values['source-url'] || null;
  const sourceDate = values['source-date'] || new Date().toISOString().slice(0, 10);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(values.file);

  const exp = buildExpenditureTree(wb, values.locality);
  const rev = buildRevenueTree(wb, values.locality);
  const pop = localityPopulation(wb, values.locality);

  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  console.log(`\nVA APA Comparative Report — ${values.locality} (${state}) FY${fiscalYear}${values['dry-run'] ? '  [dry-run]' : ''}`);
  console.log(`  Source: ${DATA_SOURCE_NAME} | url=${sourceUrl || '(none)'} | date=${sourceDate}`);
  console.log(`  Population (Exhibit H July est.): ${pop == null ? '(none)' : pop.toLocaleString('en-US')}`);
  console.log(`  Operating (expenditure) total: ${fmt(exp.total)}  — ${exp.tree.length} functions`);
  for (const n of exp.tree) console.log(`     ${n.n}: ${fmt(n.a)}${n.c ? `  (${n.c.length} activities)` : ''}`);
  console.log(`  Revenue (local) total: ${fmt(rev.total)}  — ${rev.tree.length} sources`);
  for (const n of rev.tree) console.log(`     ${n.n}: ${fmt(n.a)}${n.c ? `  (${n.c.length} sub-sources)` : ''}`);

  if (values['dry-run']) { console.log('\nDry-run — no writes.'); return; }

  const supabase = await getSupabase();
  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: values.locality, p_state: state, p_entity_type: entityType, p_population: pop || 0,
  });
  if (munErr) { console.error(`Municipality error: ${munErr.message}`); process.exit(1); }

  await importDataset(supabase, municipalityId, fiscalYear, 'operating', exp.tree, exp.total, sourceUrl, sourceDate);
  await importDataset(supabase, municipalityId, fiscalYear, 'revenue', rev.tree, rev.total, sourceUrl, sourceDate);
  console.log(`\n✅ ${values.locality} FY${fiscalYear} imported.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
