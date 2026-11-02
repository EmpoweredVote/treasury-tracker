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
 *   - Revenue ('revenue'): origin -> source -> sub-source, 3 levels.
 *       top  = Local Revenue · Revenue from the Commonwealth · Revenue from the Federal
 *              Government — Exhibit A's own decomposition of "Total Revenue".
 *       mid  = under Local Revenue: General Property Taxes, Other Local Taxes, Permits/Fees,
 *              Fines & Forfeitures, Charges for Services, Revenue from Use of Money &
 *              Property, Miscellaneous (Exhibit B). Under the two intergovernmental
 *              branches: aid type (Exhibit B1).
 *       leaf = sub-sources (property-tax breakout from Exhibit B; other-local-taxes from
 *              Exhibit B2; use-of-money Interest/Rental).
 *       total = Exhibit A "Total Revenue", asserted equal to the sum of the three branches.
 *
 *   ⭐ INTERGOVERNMENTAL AID WAS ADDED 2026-11-02. Until then this loader read Exhibit B
 *   alone and published "Total LOCAL Revenue" — a revenue-SOURCE subset, which ran from
 *   59.6% (Newport News) to 102.3% (Loudoun) of the matching expenditure figure purely by
 *   how aid-dependent the locality is. Those 304 rows were hidden as
 *   dataset_type='revenue_local_only' rather than shown as a locality's revenue.
 *   The original note here argued that including aid "would imply a false surplus vs. the
 *   expenditure side"; it inverts in practice — EXCLUDING it manufactured an apparent ~40%
 *   deficit for the localities most dependent on state education aid. SCOPE-01-RECON §4.9.
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
import { monthForSource } from './lib/loaderFiscalCalendars.mjs';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

import { ensureMunicipality } from './lib/ensureMunicipality.mjs';
import { classifySyncResult } from './lib/rpcResult.mjs';
import { assertRegisteredFamily } from './lib/registeredFamilies.mjs';
export const DATA_SOURCE_NAME = 'Virginia APA Comparative Report';

/**
 * The axes every row in this family carries, classified in #320 against the
 * APA's own "Notes to the Comparative Report".
 *
 * ⚠ They are passed to treasury_sync_city_budget on every write because they
 * are half of its lookup key — see the note at the call site. If this family is
 * ever re-classified, these two constants and the stamped rows must move
 * TOGETHER, or the next run duplicates instead of updating.
 */
export const FUND_SCOPE = 'governmental_operating';
export const BASIS = 'actual';

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
export function findHeaderRow(ws) {
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

/**
 * Section-scoped locality lookup (Phase 80 — homonym safety, CONTEXT 80 D-04).
 *
 * Every exhibit lists localities in three numbered sections in the same order:
 *   section 0 = Cities, 1 = Counties, 2 = Towns.
 * The "No." column (col 1) RESETS to 1 at the start of each section, so a new
 * section begins exactly when a data row's No. is numeric 1. Rows whose col-1 is
 * NON-numeric (section headers like "County of:", footnotes, "Total", "Grand Total")
 * are skip-rows — they neither advance nor reset the section. This works uniformly
 * across sheets that have no "Total" delimiter rows (e.g. Exhibit H), which is why we
 * segment by No.-reset, not by "Total" rows.
 *
 * Required because Virginia has city/county homonyms (Fairfax, Franklin, Richmond,
 * Roanoke): the global findLocalityRow returns the first top-down match (the §0 city),
 * so a county lookup must be scoped to section 1.
 */
export function findLocalityRowInSection(ws, headerRow, name, sectionIndex) {
  const want = name.trim().toLowerCase();
  let section = -1;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const no = cellNum(row.getCell(1));
    if (!Number.isFinite(no)) continue;        // header / footnote / Total — skip, no reset
    if (no === 1) section += 1;                 // No. reset → next section
    if (section > sectionIndex) break;          // walked past the target section
    if (section !== sectionIndex) continue;
    if (cellText(row.getCell(2)).toLowerCase() === want) return row;
  }
  throw new Error(`Locality "${name}" not found in section ${sectionIndex} of sheet ${ws.name}`);
}

/** Resolve a locality row: global first-match when sectionIndex is null/undefined (Phase 79
 *  backward-compat), else scoped to the given section (Phase 80 homonym-safe). */
function locateLocalityRow(ws, headerRow, name, sectionIndex) {
  return sectionIndex == null
    ? findLocalityRow(ws, headerRow, name)
    : findLocalityRowInSection(ws, headerRow, name, sectionIndex);
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
export function buildExpenditureTree(workbook, localityName, sectionIndex) {
  const ws = workbook.getWorksheet('Exhibit C');
  if (!ws) throw new Error('Exhibit C sheet missing');
  const hdr = findHeaderRow(ws);
  const dataRow = locateLocalityRow(ws, hdr, localityName, sectionIndex);

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
          const subRow = locateLocalityRow(sub, subHdr, localityName, sectionIndex);
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
  // The "Total Expenditures" cell is a formula (= sum of the function columns). Some localities
  // (chronic late-filers) ship with zero data and an UNCACHED total formula → cellNum returns NaN;
  // fall back to summing the function nodes so an empty locality reports 0, not NaN (CONTEXT 80 D-04).
  let total = totalCol ? cellNum(dataRow.getCell(totalCol.col)) : NaN;
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total };
}

// ── Revenue tree (Exhibit A total · B + B2 local · B1 intergovernmental) ────────
/**
 * The LOCAL branch — Exhibit B "Total Local Revenue" and its sub-sources.
 *
 * This was the whole revenue tree until 2026-11-02. It is now one of three
 * branches under the Exhibit A "Total Revenue" figure; see buildRevenueTree.
 */
function buildLocalRevenueBranch(workbook, localityName, sectionIndex) {
  const ws = workbook.getWorksheet('Exhibit B');
  if (!ws) throw new Error('Exhibit B sheet missing');
  const hdr = findHeaderRow(ws);
  const dataRow = locateLocalityRow(ws, hdr, localityName, sectionIndex);
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
        const b2Row = locateLocalityRow(b2, b2Hdr, localityName, sectionIndex);
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
  let total = totalCol ? cellNum(dataRow.getCell(totalCol.col)) : NaN;
  if (!Number.isFinite(total)) total = tree.reduce((s, n) => s + n.a, 0);
  return { children: tree, total };
}

/**
 * The two INTERGOVERNMENTAL branches, read from Exhibit B-1.
 *
 * ⚠⚠⚠ STOP AT "Total from the Federal Government". The two columns that follow
 * it — "Total State/Federal Expenditures Made on Behalf of the Local
 * Government" — are NOT revenue to the locality. Note 1.B: they "represent
 * funds spent directly by the state that do not flow through the local
 * government's accounting records", and Exhibit A's own Total Revenue excludes
 * them. A naive sum of every B-1 column adds them and breaks the tie: for
 * Virginia Beach FY2024 that is 3,225,136 + 3,838,084 = 7,063,221 of money the
 * locality never received, which would be published as its revenue.
 *
 * ⚠ Each branch's total is the PUBLISHER'S own total column, not a sum of the
 * leaves — and the two are asserted equal, so a column appearing or moving
 * between editions fails here rather than silently re-pointing a leaf.
 *
 * ⚠ "Payments in Lieu of Taxes" appears in BOTH branches, once for the state
 * and once for the federal government. That is correct and is why the branches
 * carry it as a child rather than the tree carrying it at top level.
 */
export function buildIntergovernmentalBranches(workbook, localityName, sectionIndex) {
  const ws = workbook.getWorksheet('Exhibit B1');
  if (!ws) throw new Error('Exhibit B1 sheet missing');
  const hdr = findHeaderRow(ws);
  const dataRow = locateLocalityRow(ws, hdr, localityName, sectionIndex);
  const cells = headerCells(ws, hdr);

  const cwIdx = cells.findIndex((c) => /total from the commonwealth/i.test(c.label));
  const fedIdx = cells.findIndex((c) => /total from the federal government/i.test(c.label));
  if (cwIdx < 0 || fedIdx < 0 || fedIdx <= cwIdx) {
    throw new Error(
      `Exhibit B1 layout unrecognised for ${localityName}: expected "Total from the `
      + `Commonwealth" then "Total from the Federal Government" (found at ${cwIdx}, ${fedIdx})`);
  }

  const branch = (name, leafCells, totalCell) => {
    const children = [];
    for (const { col, label } of leafCells) {
      const v = cellNum(dataRow.getCell(col));
      if (Number.isFinite(v) && v !== 0) children.push({ n: tidy(label), a: v });
    }
    const stated = cellNum(dataRow.getCell(totalCell.col));
    const sum = children.reduce((s, c) => s + c.a, 0);
    if (Number.isFinite(stated) && Math.abs(sum - stated) > 1) {
      throw new Error(
        `Exhibit B1 "${name}" for ${localityName}: the leaf columns sum to ${sum} but the `
        + `publisher's own total is ${stated}. A column has moved or been added — fix the `
        + 'column selection, do not accept the difference.');
    }
    const node = { n: name, a: Number.isFinite(stated) ? stated : sum };
    if (children.length > 1) { children.sort((x, y) => y.a - x.a); node.c = children; }
    return node;
  };

  return [
    branch('Revenue from the Commonwealth', cells.slice(0, cwIdx), cells[cwIdx]),
    branch('Revenue from the Federal Government', cells.slice(cwIdx + 1, fedIdx), cells[fedIdx]),
  ];
}

/** Collapse the newlines the APA embeds in header cells ("Non-\nCategorical State Aid"). */
const tidy = (s) => String(s).replace(/\s+/g, ' ').trim();

/**
 * The whole revenue tree: local + from the Commonwealth + from the federal government.
 *
 * ⭐⭐ THE TOTAL IS CHECKED AGAINST EXHIBIT A, which publishes the same figure
 * independently of B and B-1. Exhibit A's columns are
 *   Local Revenue | From the Commonwealth | Federal Pass-Through | Direct Federal Aid
 * summing to "Total Revenue", while B-1 cuts the same intergovernmental money by
 * AID TYPE instead. Two different cuts of one quantity, so agreeing is real
 * evidence rather than arithmetic restated. Virginia Beach FY2024:
 *   1,524,028,455 + 724,366,750 + 147,293,060 + 86,346,998 = 2,482,035,263
 * and 147,293,060 + 86,346,998 = 233,640,058 = B-1's federal total.
 *
 * ⚠ Exhibit A's Total Revenue deliberately EXCLUDES "Non-Revenue Receipts" and
 * "Transfers from Other Funds" — those two are added to it to reach "Total
 * Sources Available", which is a different quantity and not what we publish.
 * Note 2 (Exhibit A): non-revenue receipts are "collections that are not
 * anticipated for support of normal operations", and a transfer in is this
 * government's own money moved between its funds, not revenue raised.
 */
export function buildRevenueTree(workbook, localityName, sectionIndex) {
  const local = buildLocalRevenueBranch(workbook, localityName, sectionIndex);
  const intergov = buildIntergovernmentalBranches(workbook, localityName, sectionIndex);

  const localNode = { n: 'Local Revenue', a: local.total };
  if (local.children.length > 1) localNode.c = local.children;

  const tree = [localNode, ...intergov].filter((n) => Number.isFinite(n.a) && n.a !== 0);
  tree.sort((x, y) => y.a - x.a);
  const total = tree.reduce((s, n) => s + n.a, 0);

  const stated = totalRevenueFromExhibitA(workbook, localityName, sectionIndex);
  if (stated != null && Math.abs(stated - total) > 1) {
    throw new Error(
      `${localityName}: the revenue tree sums to ${total} but Exhibit A "Total Revenue" is `
      + `${stated} (difference ${stated - total}). Nothing was written. Exhibit A is the `
      + 'independent check on B + B-1 — reconcile it, never publish the difference.');
  }
  return { tree, total, statedTotal: stated };
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

// ── Population (Exhibit H, with Exhibit A fallback for towns) ────────────────────
/**
 * Read population for a locality.
 *
 * Primary path: Exhibit H "Population Estimates July <YYYY>" (cities + counties).
 * Fallback path: Exhibit A — used when Exhibit H returns null (towns have no Exhibit H section).
 *   Exhibit A layout: header row identified by "No." in col 1; locality name in col 4
 *   ("Locality / City of:"); population in col 2 ("Population (Note 1-B)").
 *   Section-scoped by the same No.-reset pattern (§2 for towns, CONTEXT 81 D-03).
 * Returns null (not throw) if the locality is absent from both exhibits.
 */
export function localityPopulation(workbook, localityName, sectionIndex) {
  const ws = workbook.getWorksheet('Exhibit H');
  if (ws) {
    const hdr = findHeaderRow(ws);
    // Population is optional: some localities present in the expenditure/revenue exhibits are
    // absent from Exhibit H (e.g. Covington/Alleghany, whose FY2024 school activity was unallocated
    // per the report footnote). Missing population must not abort the load — fall through to Exhibit A.
    let dataRow;
    try {
      dataRow = locateLocalityRow(ws, hdr, localityName, sectionIndex);
    } catch {
      dataRow = null;
    }
    if (dataRow) {
      const popCol = headerCells(ws, hdr).find((h) => /population estimates july/i.test(h.label));
      if (popCol) {
        const v = cellNum(dataRow.getCell(popCol.col));
        if (Number.isFinite(v)) return v;
      }
    }
  }

  // Exhibit A fallback — towns (and any locality absent from Exhibit H).
  // Exhibit A: name in col 4, population in col 2, section-scoped by No.-reset in col 1.
  return townPopulationFromExhibitA(workbook, localityName, sectionIndex);
}

/**
 * Read population from Exhibit A for a locality in the given section.
 * Exhibit A has a non-standard layout: col 1 = "No.", col 2 = population
 * ("Population (Note 1-B)"), col 4 = locality name ("Locality / City of:").
 * The section index (No.-reset) is the same §0/§1/§2 scheme as the other exhibits.
 * Returns null if the locality is absent from Exhibit A or the sheet is missing.
 */
export function exhibitARowFor(workbook, localityName, sectionIndex) {
  const ws = workbook.getWorksheet('Exhibit A');
  if (!ws) return null;
  const hdr = findHeaderRow(ws);
  const want = localityName.trim().toLowerCase();
  // ⚠⚠ SECTION-LESS CALLS MUST STILL FIND THE ROW. `locateLocalityRow` has
  // always fallen back to a global first-match when sectionIndex is null
  // (the Phase 79 backward-compat path), and this function did not — so
  // `0 !== undefined` skipped every row and it returned null. Harmless while
  // the only caller was the population fallback, which always passes a
  // section; NOT harmless once buildRevenueTree started using it to verify the
  // total, because a null here means the Exhibit A check SILENTLY DOES NOT RUN
  // and the tree publishes unchecked. Caught by the backward-compat test.
  const sectionless = sectionIndex == null;
  let section = -1;
  for (let r = hdr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const no = cellNum(row.getCell(1));
    if (!Number.isFinite(no)) continue;       // header / footnote / Total — skip
    if (no === 1) section += 1;               // No. reset → next section
    if (!sectionless) {
      if (section > sectionIndex) break;      // past target section
      if (section !== sectionIndex) continue;
    }
    // Col 4 is the locality name in Exhibit A.
    const name = cellText(row.getCell(4));
    if (!name || /^total$|^grand total$/i.test(name)) continue;
    if (name.toLowerCase() === want) return { ws, hdr, row };
  }
  return null;
}

export function townPopulationFromExhibitA(workbook, localityName, sectionIndex) {
  const hit = exhibitARowFor(workbook, localityName, sectionIndex);
  if (!hit) return null;
  // Col 2 is the population.
  const v = cellNum(hit.row.getCell(2));
  return Number.isFinite(v) ? v : null;
}

/**
 * Exhibit A's own "Total Revenue" for a locality — the independent check on the
 * B + B-1 tree. Returns null when the locality or the column is absent, which
 * leaves buildRevenueTree unverified rather than failing it: a town missing
 * from Exhibit A is a real case (the population fallback above exists for the
 * opposite reason) and must not block a load whose branches already reconcile
 * against their own publisher totals.
 *
 * ⚠ Anchored `^total revenue$`. "Percent of Revenue" and "Total Sources
 * Available" are both adjacent and neither is this figure.
 */
export function totalRevenueFromExhibitA(workbook, localityName, sectionIndex) {
  const hit = exhibitARowFor(workbook, localityName, sectionIndex);
  if (!hit) return null;
  const col = headerCells(hit.ws, hit.hdr).find((h) => /^total revenue$/i.test(tidy(h.label)));
  if (!col) return null;
  const v = cellNum(hit.row.getCell(col.col));
  return Number.isFinite(v) ? v : null;
}

/**
 * ⚠ THIS LIVES HERE, NOT IN backfillVaIntergovernmentalRevenue.mjs, BECAUSE
 * THAT FILE CARRIES A SHEBANG. A `#!` on any module a test imports breaks
 * `npm test` on Windows and tests/waSao.test.mjs fails the whole suite for it
 * — which is exactly how this function got moved. This module has no shebang
 * and is already imported by tests.
 *
 */
/**
 * TT stores counties under their display name ("Albemarle County"); the APA
 * workbook lists them under the bare name inside its county section. Cities
 * and towns match as stored.
 *
 * ⚠ The section index is what makes this safe. Virginia has city/county
 * homonyms — Fairfax, Franklin, Richmond, Roanoke — so "Richmond" alone is
 * ambiguous and only (name, section) identifies a row.
 */
export function workbookName(name, entityType) {
  return entityType === 'county' ? name.replace(/\s+County$/i, '') : name;
}


// ── Supabase write path (mirrors loadUtahTransparency importEntityData) ──────────
/** entity_type → report section index (Cities §0, Counties §1, Towns §2). */
export const ENTITY_TYPE_SECTION = { city: 0, county: 1, town: 2 };

let _supabase = null;
export async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY (set it in .env). Use --dry-run for a no-write parse.'); process.exit(1); }
  _supabase = createClient(url, key);
  return _supabase;
}

/** Read-only never-overwrite guard: returns the conflicting row if a DIFFERENT source owns it. */
export async function findConflictingBudget(supabase, municipalityId, fiscalYear, datasetType) {
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

export async function importDataset(supabase, municipalityId, fiscalYear, datasetType, tree, total, sourceUrl, sourceDate) {
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
    // ⚠⚠⚠ THESE TWO ARE THE UPDATE-VS-INSERT KEY, NOT DECORATION.
    // treasury_sync_city_budget looks its target up on
    // (municipality_id, fiscal_year, dataset_type, fund_scope, basis) and
    // DEFAULTS both axes to 'unknown'. This loader omitted them, which was
    // correct while every VA row was unknown/unknown — and stopped being
    // correct the moment #320 stamped the family on 2026-11-02. From that
    // merge until this line, a re-run would have matched nothing, taken the
    // INSERT branch, and written 608 duplicates while reporting success.
    // Nothing would have warned: `findConflictingBudget` above checks
    // data_source, which is NOT in the lookup key.
    // tests/syncCityBudgetAxisKey.test.mjs moved this loader from its EXEMPT
    // list to REQUIRED in the same commit.
    p_fund_scope: FUND_SCOPE,
    p_basis: BASIS,
    // Va. Code § 15.2-2500 for counties, cities and towns >= 3,500 or holding a
    // separate school division; the Town of Wise charter § 4.2 for the one town
    // that clause does not reach. All 161 entities run July–June. Authority in
    // lib/loaderFiscalCalendars.mjs.
    p_fiscal_year_start_month: monthForSource(DATA_SOURCE_NAME),
  });
  if (error) { console.error(`  RPC error (${datasetType}): ${error.message}`); return null; }
  // ⚠⚠ THE RPC REPORTS FAILURE INSIDE A SUCCESSFUL POSTGREST CALL. `error`
  // above is the TRANSPORT error only; a refusal travels in `data` as
  // {error: …} and supabase-js hands back error: null. Returning `data` here
  // handed a refused write back as if it were a written one. See
  // lib/rpcResult.mjs and tests/rpcRefusalIsHeard.test.mjs.
  const outcome = classifySyncResult(data);
  if (!outcome.ok) throw new Error(`${datasetType} FY${fiscalYear}: ${outcome.message}`);
  return data;
}

/**
 * Build + write one locality's operating + revenue datasets (the unit the Phase 80 batch
 * driver loops). Decouples the XLSX MATCH name (bare col-2 value) from the DB DISPLAY name
 * (counties stored as "<name> County", CONTEXT 80 D-05). Reuses the never-overwrite guard
 * + per-FY source stamping via importDataset.
 *
 * opts: { matchName, displayName, entityType='city', state='VA', fiscalYear, sourceUrl,
 *         sourceDate, sectionIndex, dryRun }
 * Returns a summary object (always), with per-dataset write/skip status when not dryRun.
 */
export async function importLocality(supabase, workbook, opts) {
  const {
    matchName,
    displayName = matchName,
    entityType = 'city',
    state = 'VA',
    fiscalYear,
    sourceUrl = null,
    sourceDate = new Date().toISOString().slice(0, 10),
    dryRun = false,
    // ⚠ Which datasets to WRITE. Both by default, which is what a fresh
    // onboarding wants. The Exhibit B-1 backfill passes ['revenue'] so it
    // touches exactly the 304 rows whose figures are meant to change and
    // leaves the 304 operating rows — and their source_date — alone. Keeping
    // a re-run's blast radius to the rows it is actually correcting is worth
    // one option; the alternative is 304 untouched figures taking a new
    // source_date for no reason anyone could later explain.
    datasets = ['operating', 'revenue'],
  } = opts;
  const sectionIndex = opts.sectionIndex != null ? opts.sectionIndex : ENTITY_TYPE_SECTION[entityType];

  const exp = buildExpenditureTree(workbook, matchName, sectionIndex);
  const rev = buildRevenueTree(workbook, matchName, sectionIndex);
  const population = localityPopulation(workbook, matchName, sectionIndex);

  const summary = {
    displayName, matchName, entityType, fiscalYear,
    operatingTotal: exp.total, revenueTotal: rev.total, population,
    expFunctions: exp.tree.length, revSources: rev.tree.length,
  };

  // Absent locality: the report lists the row but ships zero data (chronic late-filer whose
  // audited financials hadn't reached the APA at publication). Do NOT write a $0 budget or
  // create a phantom municipality — skip cleanly and let the caller record it (CONTEXT 80 D-04).
  if (!(exp.total > 0) && !(rev.total > 0)) {
    summary.absent = true;
    return summary;
  }

  if (dryRun) return summary;

  const { id: municipalityId } = await ensureMunicipality(supabase, {
    name: displayName, state: state, entityType: entityType, population: population || 0,
  });

  summary.municipalityId = municipalityId;
  summary.datasetsWritten = [...datasets];
  if (datasets.includes('operating')) {
    summary.operating = await importDataset(supabase, municipalityId, fiscalYear, 'operating', exp.tree, exp.total, sourceUrl, sourceDate);
  }
  if (datasets.includes('revenue')) {
    summary.revenue = await importDataset(supabase, municipalityId, fiscalYear, 'revenue', rev.tree, rev.total, sourceUrl, sourceDate);
  }
  return summary;
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

  const sectionIndex = ENTITY_TYPE_SECTION[entityType];
  const exp = buildExpenditureTree(wb, values.locality, sectionIndex);
  const rev = buildRevenueTree(wb, values.locality, sectionIndex);
  const pop = localityPopulation(wb, values.locality, sectionIndex);

  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  console.log(`\nVA APA Comparative Report — ${values.locality} (${state}) FY${fiscalYear}${values['dry-run'] ? '  [dry-run]' : ''}`);
  console.log(`  Source: ${DATA_SOURCE_NAME} | url=${sourceUrl || '(none)'} | date=${sourceDate}`);
  console.log(`  Population (Exhibit H July est.): ${pop == null ? '(none)' : pop.toLocaleString('en-US')}`);
  console.log(`  Operating (expenditure) total: ${fmt(exp.total)}  — ${exp.tree.length} functions`);
  for (const n of exp.tree) console.log(`     ${n.n}: ${fmt(n.a)}${n.c ? `  (${n.c.length} activities)` : ''}`);
  console.log(`  Revenue total: ${fmt(rev.total)}  — ${rev.tree.length} origins` + (rev.statedTotal == null ? "  (Exhibit A has no row for this locality — tree unverified)" : "  = Exhibit A Total Revenue"));
  for (const n of rev.tree) console.log(`     ${n.n}: ${fmt(n.a)}${n.c ? `  (${n.c.length} sub-sources)` : ''}`);

  if (values['dry-run']) { console.log('\nDry-run — no writes.'); return; }

  const supabase = await getSupabase();
  // ⚠ The registry preflight. The plan named this loader alongside Ohio and
  // Utah and it was missed — on the one source this gate was dogfooded
  // against, which is the kind of omission a reviewer catches and the author
  // does not. It sits after the dry-run return, because a dry run writes
  // nothing and must stay runnable on an unclassified source: that is exactly
  // how you inspect a family before classifying it.
  await assertRegisteredFamily(supabase, DATA_SOURCE_NAME, { fiscalYears: [fiscalYear] });
  await importLocality(supabase, wb, {
    matchName: values.locality, displayName: values.locality, entityType, state,
    fiscalYear, sourceUrl, sourceDate, sectionIndex,
  });
  console.log(`\n✅ ${values.locality} FY${fiscalYear} imported.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
