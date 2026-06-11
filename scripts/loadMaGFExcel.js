#!/usr/bin/env node
/**
 * Massachusetts General Fund Excel Loader
 *
 * Loads MA Division of Local Services General Fund Expenditure and Revenue
 * data from local Excel files into the treasury database.
 *
 * Source files:  docs/MA/GenFundExpenditures{YYYY}.xlsx  (dataset_type: operating)
 *                docs/MA/GenFundRevenues{YYYY}.xlsx       (dataset_type: revenue)
 *
 * Data provenance: uses api_type 'ma-dls-excel', distinct from portal-scraped
 * 'ma-dls' rows which are preserved as cross-check artifacts. The --clean flag
 * removes budget rows linked to the portal-scraped data_sources before loading,
 * preventing duplicates while keeping the data_source rows for future use.
 *
 * Usage:
 *   node scripts/loadMaGFExcel.js                       # load all files
 *   node scripts/loadMaGFExcel.js --type expenditures   # only operating data
 *   node scripts/loadMaGFExcel.js --type revenues       # only revenue data
 *   node scripts/loadMaGFExcel.js --fy 2025             # single year
 *   node scripts/loadMaGFExcel.js --dry-run             # preview, no DB writes
 *   node scripts/loadMaGFExcel.js --clean               # purge portal-scraped MA
 *                                                       # budget rows first, then load
 *   node scripts/loadMaGFExcel.js --reset-progress      # clear checkpoint file
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'exceljs';
const { Workbook } = pkg;

const __dirname  = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR   = join(__dirname, '..', 'docs', 'MA');
const OUTPUT_DIR = join(__dirname, 'output');
const PROGRESS_FILE = join(OUTPUT_DIR, 'ma_gf_excel_progress.json');

// ── Report config ─────────────────────────────────────────────────────────────

const REPORT_TYPES = {
  expenditures: {
    filePrefix:  'GenFundExpenditures',
    datasetType: 'operating',
    label:       'MA General Fund Expenditures',
    totalCol:    'Total Expenditures',
  },
  revenues: {
    filePrefix:  'GenFundRevenues',
    datasetType: 'revenue',
    label:       'MA General Fund Revenues',
    totalCol:    'Total Revenues',
  },
};

// ── Checkpoint helpers (LOAD-02 pattern) ──────────────────────────────────────

function readProgress() {
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return {}; }
}

function writeProgress(p) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ── Excel parsing ─────────────────────────────────────────────────────────────

async function parseExcel(filePath, totalColName) {
  const wb = new Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  // exceljs row.values has a leading null at index 0 — slice it off
  const headers   = ws.getRow(1).values.slice(1);
  const amountCols = headers.slice(3).filter(h => h && h !== totalColName);

  const records = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const vals    = row.values.slice(1);
    const dorCode = String(vals[0] ?? '').trim();
    const name    = String(vals[1] ?? '').trim();
    const fy      = Number(vals[2]);
    if (!dorCode || !/^\d+$/.test(dorCode)) return; // skip totals row

    const record = { dorCode, name, fiscalYear: fy };
    amountCols.forEach((col, i) => { record[col] = Number(vals[i + 3]) || 0; });
    records.push(record);
  });

  return { records, amountCols };
}

// ── File discovery ────────────────────────────────────────────────────────────

function discoverFiles(typeFilter, fyFilter) {
  const allFiles = readdirSync(DOCS_DIR).filter(f => f.endsWith('.xlsx'));
  const result   = [];

  for (const [typeName, cfg] of Object.entries(REPORT_TYPES)) {
    if (typeFilter && typeFilter !== typeName) continue;
    allFiles
      .filter(f => f.startsWith(cfg.filePrefix))
      .forEach(f => {
        const fy = parseInt(f.replace(cfg.filePrefix, '').replace('.xlsx', ''), 10);
        if (!isNaN(fy) && (!fyFilter || fy === fyFilter))
          result.push({ typeName, cfg, fy, file: join(DOCS_DIR, f) });
      });
  }

  // Oldest year first so fiscal_years arrays accumulate in chronological order
  result.sort((a, b) => a.fy - b.fy || a.typeName.localeCompare(b.typeName));
  return result;
}

// ── Pre-flight: remove portal-scraped MA budget rows ─────────────────────────
// Keeps api_type='ma-dls' data_source rows intact (future cross-check use)
// but clears budget rows and resets fiscal_years so there are no duplicates.

async function cleanPortalScrapedRows(supabase, typeFilter) {
  const datasetTypes = typeFilter
    ? [REPORT_TYPES[typeFilter].datasetType]
    : ['operating', 'revenue'];

  console.log('\n🧹  Cleaning portal-scraped MA budget rows (api_type: ma-dls)...');

  // Fetch MA municipality IDs once (subquery builders aren't supported by .in())
  const { data: maMunis, error: mErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id')
    .eq('state', 'MA');
  if (mErr) { console.error(`  ❌ municipalities lookup: ${mErr.message}`); return; }
  const maMuniIds = maMunis.map(m => m.id);

  for (const datasetType of datasetTypes) {
    // Collect data_source IDs for MA cities with api_type 'ma-dls'
    const { data: dsList, error: dsErr } = await supabase
      .schema('treasury')
      .from('data_sources')
      .select('id')
      .eq('api_type', 'ma-dls')
      .eq('dataset_type', datasetType)
      .in('municipality_id', maMuniIds);

    if (dsErr) { console.error(`  ❌ data_sources lookup (${datasetType}): ${dsErr.message}`); continue; }
    if (!dsList?.length) { console.log(`  ✓  No ma-dls ${datasetType} data_sources found — nothing to clean`); continue; }

    const dsIds = dsList.map(d => d.id);

    // Delete budget rows (budget_categories cascade-delete via FK)
    const { error: bErr, count } = await supabase
      .schema('treasury')
      .from('budgets')
      .delete({ count: 'exact' })
      .in('data_source_id', dsIds);

    if (bErr) { console.error(`  ❌ budgets delete (${datasetType}): ${bErr.message}`); continue; }
    console.log(`  ✓  Deleted ${count ?? '?'} ${datasetType} budget rows (+ cascade budget_categories)`);

    // Reset fiscal_years to [] so the data_source rows are clean for future portal runs
    const { error: fyErr } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update({ fiscal_years: [] })
      .in('id', dsIds);

    if (fyErr) console.log(`  ⚠️  fiscal_years reset (${datasetType}): ${fyErr.message}`);
    else console.log(`  ✓  Reset fiscal_years on ${dsIds.length} ma-dls ${datasetType} data_source rows`);
  }
}

// ── Load one file ─────────────────────────────────────────────────────────────

async function loadFile(supabase, { typeName, cfg, fy, file }, municMap, progress, dryRun) {
  const fileName = file.split(/[\\/]/).pop();
  console.log(`\n📂  ${fileName}  (${cfg.datasetType}, FY${fy})`);

  const { records, amountCols } = await parseExcel(file, cfg.totalCol);
  console.log(`    ${records.length} city records | ${amountCols.length} categories`);

  const progressKey    = `${typeName}:${fy}`;
  const alreadyLoaded  = new Set(progress[progressKey] || []);
  let loaded = 0, skipped = 0, errors = 0, checkpointSkipped = 0;

  for (const record of records) {
    if (alreadyLoaded.has(record.dorCode)) { checkpointSkipped++; continue; }

    const municId = municMap.get(record.name);
    if (!municId) {
      if (skipped === 0) console.log(`    ⚠️  No DB row for "${record.name}" — skipping`);
      skipped++;
      continue;
    }

    // Build budget tree — same structure as scrapeMaDLS.js loadToSupabase
    let total = 0;
    const tree = [];
    for (const col of amountCols) {
      const amount = record[col] || 0;
      if (amount === 0) continue;
      total += amount;
      tree.push({ n: col, a: amount, i: [{ d: col, a: amount, aa: null, f: 'General Fund', e: null }] });
    }
    tree.sort((a, b) => b.a - a.a);

    if (tree.length === 0) {
      // City has all-zero amounts for this year — checkpoint it so re-runs skip it
      alreadyLoaded.add(record.dorCode);
      progress[progressKey] = [...alreadyLoaded];
      writeProgress(progress);
      skipped++;
      continue;
    }

    if (dryRun) {
      loaded++;
      if (loaded <= 3) console.log(`    [dry-run] ${record.name} total=$${total.toLocaleString()} categories=${tree.length}`);
      continue;
    }

    // Find or create data_source row (api_type: 'ma-dls-excel')
    const { data: existingDs, error: dsErr } = await supabase
      .schema('treasury')
      .from('data_sources')
      .select('id, fiscal_years')
      .eq('municipality_id', municId)
      .eq('api_type', 'ma-dls-excel')
      .eq('dataset_type', cfg.datasetType)
      .maybeSingle();

    if (dsErr) { console.log(`    ❌ ${record.name} ds lookup: ${dsErr.message}`); errors++; continue; }

    let dsId = existingDs?.id;

    if (!dsId) {
      const { data: newDs, error: createErr } = await supabase
        .schema('treasury')
        .from('data_sources')
        .insert({
          municipality_id: municId,
          name:            `${record.name} — ${cfg.label}`,
          api_type:        'ma-dls-excel',
          dataset_type:    cfg.datasetType,
          base_url:        'https://www.mass.gov/orgs/division-of-local-services',
          column_mapping:  { source: 'xlsx', filePrefix: cfg.filePrefix },
          fiscal_years:    [fy],
        })
        .select('id')
        .single();

      if (createErr) { console.log(`    ❌ ${record.name} ds create: ${createErr.message}`); errors++; continue; }
      dsId = newDs.id;
    } else {
      // Append fiscal year without duplicating (LOAD-03 pattern)
      const existing = Array.isArray(existingDs.fiscal_years) ? existingDs.fiscal_years : [];
      if (!existing.includes(fy)) {
        const { error: fyErr } = await supabase
          .schema('treasury')
          .from('data_sources')
          .update({ fiscal_years: [...existing, fy] })
          .eq('id', dsId);
        if (fyErr) console.log(`    ⚠️  ${record.name} fiscal_years: ${fyErr.message}`);
      }
    }

    const { error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: dsId,
      p_fiscal_year:    fy,
      p_dataset_type:   cfg.datasetType,
      p_total:          total,
      p_tree:           tree,
      p_row_count:      tree.length,
      p_triggered_by:   'bulk_load',
    });

    if (rpcErr) {
      console.log(`    ❌ ${record.name}: ${rpcErr.message}`);
      errors++;
    } else {
      loaded++;
      alreadyLoaded.add(record.dorCode);
      progress[progressKey] = [...alreadyLoaded];
      writeProgress(progress);
      if (loaded % 50 === 0) console.log(`    ... ${loaded} loaded`);
    }
  }

  console.log(`    ✅ Loaded: ${loaded} | Skipped: ${skipped} | Errors: ${errors}${checkpointSkipped ? ` | Checkpoint-skipped: ${checkpointSkipped}` : ''}`);
  return { loaded, skipped, errors, checkpointSkipped };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      type:              { type: 'string' },
      fy:                { type: 'string' },
      'dry-run':         { type: 'boolean' },
      'clean':           { type: 'boolean' },
      'reset-progress':  { type: 'boolean' },
    },
    strict: false,
  });

  const typeFilter = values.type;
  const fyFilter   = values.fy ? parseInt(values.fy, 10) : undefined;
  const dryRun     = values['dry-run'] ?? false;
  const clean      = values['clean'] ?? false;
  const reset      = values['reset-progress'] ?? false;

  if (typeFilter && !REPORT_TYPES[typeFilter]) {
    console.error(`Unknown --type "${typeFilter}". Use: expenditures, revenues`);
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (reset) {
    writeProgress({});
    console.log('Progress file reset.');
  }

  if (clean && !dryRun) {
    await cleanPortalScrapedRows(supabase, typeFilter);
  }

  // Load MA municipality map once (name → id)
  const { data: munis, error: mErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('state', 'MA');
  if (mErr) { console.error('Cannot load municipalities:', mErr.message); process.exit(1); }
  const municMap = new Map(munis.map(m => [m.name, m.id]));
  console.log(`Loaded ${municMap.size} MA municipalities from DB.`);

  const files = discoverFiles(typeFilter, fyFilter);
  if (files.length === 0) {
    console.log('No matching files found in docs/MA/.');
    process.exit(0);
  }

  const yearRange = `FY${files[0].fy}–FY${files[files.length - 1].fy}`;
  console.log(`\nFound ${files.length} file(s) to process  (${yearRange})${dryRun ? '  [DRY RUN]' : ''}`);

  const progress = readProgress();
  const totals   = { loaded: 0, skipped: 0, errors: 0, checkpointSkipped: 0 };

  for (const f of files) {
    const r = await loadFile(supabase, f, municMap, progress, dryRun);
    totals.loaded            += r.loaded;
    totals.skipped           += r.skipped;
    totals.errors            += r.errors;
    totals.checkpointSkipped += r.checkpointSkipped;
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  TOTAL  Loaded: ${totals.loaded} | Skipped: ${totals.skipped} | Errors: ${totals.errors}`);
  if (totals.checkpointSkipped > 0)
    console.log(`         Checkpoint-skipped: ${totals.checkpointSkipped} (already in DB)`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error(err); process.exit(1); });
