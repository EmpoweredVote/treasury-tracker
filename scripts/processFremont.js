#!/usr/bin/env node
/**
 * Fremont General Fund Budget Loader
 *
 * Extracts General Fund operating and revenue data from Fremont Proposed/Adopted
 * Operating Budget PDFs using pdfplumber (Python, zero AI cost). Loads both
 * datasets into treasury_sync_budget_tree RPC for each fiscal year found.
 *
 * Each PDF contains up to 3 year columns:
 *   Adopted FY N-1  |  Est Actual FY N-1  |  Proposed FY N
 *
 * FY N-1: approved_amount = Adopted, actual_amount = Est Actual
 * FY N:   approved_amount = Proposed, actual_amount = null
 *
 * Data values in the PDF are in thousands of dollars; this script converts to
 * full dollar amounts.
 *
 * Usage:
 *   node scripts/processFremont.js              # all PDFs in docs/Fremont/
 *   node scripts/processFremont.js --dry-run    # parse and print, no DB writes
 *   node scripts/processFremont.js --pdf "docs/Fremont/FY 202425 Proposed Operating Budget.pdf"
 *
 * Requires: Python 3 + pdfplumber  (pip install pdfplumber)
 */

import { execSync }        from 'node:child_process';
import { createClient }    from '@supabase/supabase-js';
import { parseArgs }       from 'node:util';
import { readdirSync }     from 'node:fs';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tax revenue line item names — grouped under a "Taxes" parent category
const TAX_ITEMS = new Set([
  'Property Tax', 'Sales Tax', 'Business Tax', 'Hotel/Motel Tax',
  'Property Transfer Tax', 'Paramedic Tax',
]);

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractFremont.py');
  const raw = execSync(`python "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// ── Parse money (amounts are in thousands in the PDF) ─────────────────────────
function toFullDollars(thousands) {
  return Math.round(thousands * 1000);
}

// ── Build tree for operating (expenditure) data ───────────────────────────────
function buildOperatingTree(expenditureItems, approvedIdx, actualIdx) {
  const nodes = [];
  let total = 0;

  for (const item of expenditureItems) {
    const approved = toFullDollars(item.amounts[approvedIdx]);
    const actual   = actualIdx !== null ? toFullDollars(item.amounts[actualIdx]) : null;

    nodes.push({
      n: item.name,
      a: approved,
      // ⚠ aa -> approved_amount, a -> actual_amount in _treasury_insert_tree. The NODE
      // `a` above is the rollup (correctly the adopted figure); the ITEM `a` is the
      // ACTUAL. This was emitted the other way round, filing the adopted budget as an
      // actual and the Est Actual as the budget.
      i: [{ d: item.name, a: actual, aa: approved, f: 'General Fund', e: null }],
    });
    total += approved;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Build tree for revenue data (taxes grouped under one parent) ──────────────
function buildRevenueTree(revenueItems, approvedIdx, actualIdx) {
  const taxItems    = [];
  let   taxTotal    = 0;
  const nonTaxItems = [];
  let   nonTaxTotal = 0;

  for (const item of revenueItems) {
    const approved = toFullDollars(item.amounts[approvedIdx]);
    const actual   = actualIdx !== null ? toFullDollars(item.amounts[actualIdx]) : null;
    // ⚠ a -> actual_amount, aa -> approved_amount. See buildOperatingTree above.
    const lineItem = { d: item.name, a: actual, aa: approved, f: 'General Fund', e: null };

    if (TAX_ITEMS.has(item.name)) {
      taxItems.push(lineItem);
      taxTotal += approved;
    } else {
      nonTaxItems.push(lineItem);
      nonTaxTotal += approved;
    }
  }

  const tree = [];
  if (taxItems.length) {
    tree.push({ n: 'Taxes', a: taxTotal, i: taxItems });
  }
  if (nonTaxItems.length) {
    tree.push({ n: 'Non-Tax Revenue', a: nonTaxTotal, i: nonTaxItems });
  }

  const total = taxTotal + nonTaxTotal;
  return { tree, total };
}

// ── Ensure Fremont municipality exists; return its id ─────────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Fremont')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  const { data: created, error } = await supabase.schema('treasury')
    .from('municipalities')
    .insert({
      name:            'Fremont',
      state:           'CA',
      entity_type:     'city',
      population:      228192,
      population_year: 2024,
    })
    .select('id, name')
    .single();

  if (error) {
    console.error('  Failed to create municipality:', error.message);
    process.exit(2);
  }
  console.log(`  Municipality created: ${created.name} (${created.id})`);
  return created.id;
}

// ── Upsert a data_source record ───────────────────────────────────────────────
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const src = {
    name:            `Fremont ${datasetType === 'operating' ? 'Operating' : 'Revenue'} Budget FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `fy${fiscalYear}`,
    base_url:        'file://' + pdfAbsPath.replace(/\\/g, '/'),
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fy${fiscalYear}`)
    .eq('dataset_type', datasetType)
    .maybeSingle();

  if (existing?.id) {
    const { data } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    return data;
  }
  const { data } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  return data;
}

// ── Load one (fiscal year, dataset type) ─────────────────────────────────────
async function loadFiscalYear(muniId, pdfAbsPath, fiscalYear, datasetType, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath);
  if (!ds?.id) { console.error('    data_source upsert failed'); return false; }
  console.log(`    data_source: ${ds.id}`);

  // Clear existing rows for this data source + any orphaned rows
  await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muniId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType)
    .is('data_source_id', null);

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   datasetType,
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)         { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error)     { console.error('    RPC error (returned):', rpc.error); return false; }

  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
  return true;
}

// ── Process one PDF ───────────────────────────────────────────────────────────
async function processPDF(pdfAbsPath, muniId, dryRun) {
  console.log(`\n  PDF: ${path.basename(pdfAbsPath)}`);

  let pages;
  try {
    pages = extractPDF(pdfAbsPath);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 200));
    return;
  }

  if (!pages.length) {
    console.warn('  No General Fund Summary table found — skipping');
    return;
  }

  for (const page of pages) {
    const { col_types: colTypes, fiscal_years: fiscalYears, revenue_items, expenditure_items } = page;
    console.log(`  Page ${page.page_num}: columns [${colTypes.join(', ')}] → FY [${fiscalYears.join(', ')}]`);

    // Group: for each unique fiscal year, find which column index is the approved amount
    // and which (if any) is the actual amount.
    // Rules:
    //   adopted/proposed → approvedIdx (first one wins per FY)
    //   actual           → actualIdx
    //   revised          → ignored (interim amendment, not what was adopted)
    const fyMap = new Map(); // fy → { approvedIdx, actualIdx }
    for (let i = 0; i < colTypes.length; i++) {
      const fy = fiscalYears[i];
      if (!fyMap.has(fy)) fyMap.set(fy, { approvedIdx: null, actualIdx: null });
      const entry = fyMap.get(fy);
      if ((colTypes[i] === 'adopted' || colTypes[i] === 'proposed') && entry.approvedIdx === null) {
        entry.approvedIdx = i;
      } else if (colTypes[i] === 'actual') {
        entry.actualIdx = i;
      }
      // 'revised' intentionally skipped
    }

    for (const [fy, { approvedIdx, actualIdx }] of fyMap) {
      if (approvedIdx === null) continue;

      // ── Operating ──────────────────────────────────────────────────────────
      const { tree: opTree, total: opTotal } = buildOperatingTree(expenditure_items, approvedIdx, actualIdx);

      console.log(`\n  FY${fy} Operating — $${opTotal.toLocaleString()} total`);
      for (const n of opTree.slice(0, 6)) {
        console.log(`    ${n.n}: $${Math.abs(n.a).toLocaleString()}${n.a < 0 ? ' (savings offset)' : ''}`);
      }
      if (opTree.length > 6) console.log(`    … +${opTree.length - 6} more`);

      if (!dryRun && muniId) {
        await loadFiscalYear(muniId, pdfAbsPath, fy, 'operating', opTree, opTotal, expenditure_items.length);
      }

      // ── Revenue ────────────────────────────────────────────────────────────
      const { tree: revTree, total: revTotal } = buildRevenueTree(revenue_items, approvedIdx, actualIdx);

      console.log(`\n  FY${fy} Revenue — $${revTotal.toLocaleString()} total`);
      for (const group of revTree) {
        console.log(`    ${group.n}: $${group.a.toLocaleString()} (${group.i.length} items)`);
        for (const li of group.i) {
          console.log(`      ${li.d}: $${li.a.toLocaleString()}`);
        }
      }

      if (!dryRun && muniId) {
        await loadFiscalYear(muniId, pdfAbsPath, fy, 'revenue', revTree, revTotal, revenue_items.length);
      }
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      pdf:       { type: 'string' },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];

  // Discover PDFs
  const pdfDir = path.join(ROOT, 'docs', 'Fremont');
  let pdfPaths;
  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) { console.error('No PDFs found in docs/Fremont/'); process.exit(1); }
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Fremont Budget Loader${dryRun ? ' (dry-run)' : ''}`);
  console.log(`PDFs to process: ${pdfPaths.length}`);

  let muniId = null;
  if (!dryRun) {
    muniId = await ensureMunicipality();
  }

  for (const p of pdfPaths) {
    await processPDF(p, muniId, dryRun);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
