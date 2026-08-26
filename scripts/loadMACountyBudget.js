#!/usr/bin/env node
/**
 * MA County Budget Loader
 *
 * Loads operating budget data for MA county governments via the
 * treasury_sync_budget_tree RPC. Follows processGresham.js pattern exactly.
 *
 * Usage:
 *   node scripts/loadMACountyBudget.js --county plymouth --dry-run
 *   node scripts/loadMACountyBudget.js --county norfolk --dry-run
 *   node scripts/loadMACountyBudget.js --county plymouth
 *
 * Requires: Python 3 + pdfplumber (pip install pdfplumber)
 * Requires: 5 MA county municipality rows seeded via seedMACountyLinks.js (Phase 40)
 *
 * Security (T-41-03): spawnSync with args array (no shell injection); pdfPath
 *   comes from controlled COUNTY_CONFIG, not user input.
 * Security (T-41-04): api_type hardcoded as 'pdf_download' in upsertDataSource.
 * Security (T-41-06): entity_type='county' filter in ensureMunicipality prevents
 *   city municipality_id mismatch.
 */

import { spawnSync }     from 'node:child_process';
import { createClient }  from '@supabase/supabase-js';
import { parseArgs }     from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import path              from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
// ⚠ treasury_sync_budget_tree takes NO month parameter — it copies
// `fiscal_year_start_month` off the `data_sources` row, and BOTH columns are
// declared NOT NULL DEFAULT 1. Leaving it unset is what put these county rows on
// a January fiscal year. The statute and the two charter checks are in the library.
import { CORRECT_MONTH as MA_FY_START_MONTH } from './lib/maFiscalCalendar.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Load .env / .env.local (inline-comment stripping from seedMACountyLinks.js) ──
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');   // strip inline comments
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore missing files */ }
  }
}
loadEnv();

// ── Supabase client ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CLI args ──────────────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  options: {
    county:    { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
  strict: false,
});

// ── County configuration ──────────────────────────────────────────────────────
// Bristol PDF filename has a literal apostrophe — store exact filename
const COUNTY_CONFIG = {
  barnstable: { name: 'Barnstable County', pdf: 'barnstable-fy25.pdf',                    fy: 2025, sanityMax: 30_000_000 },
  bristol:    { name: 'Bristol County',    pdf: "FY'25 Proposed Bristol County Budget.pdf", fy: 2025, sanityMax: 40_000_000 },
  dukes:      { name: 'Dukes County',      pdf: 'dukes-fy24-audit.pdf',                    fy: 2024, sanityMax:  5_000_000 },
  norfolk:    { name: 'Norfolk County',    pdf: 'norfolk-fy26.pdf',                         fy: 2026, sanityMax: 50_000_000 },
  plymouth:   { name: 'Plymouth County',   pdf: 'plymouth-fy25.pdf',                        fy: 2025, sanityMax: 20_000_000 },
};

// ── Python extractor invocation ───────────────────────────────────────────────
function extractPDF(pdfPath, countyKey) {
  const pyScript  = path.join(ROOT, 'scripts', 'extractMACounties.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const result    = spawnSync(pythonBin, [pyScript, pdfPath, '--county', countyKey], {
    maxBuffer: 8 * 1024 * 1024,
    encoding:  'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`extractMACounties.py failed (exit ${result.status}): ${result.stderr}`);
  }
  if (result.stderr) {
    // Forward extractor diagnostics to our stderr
    process.stderr.write(result.stderr);
  }
  return JSON.parse(result.stdout);
}

// ── Municipality lookup (county only) ────────────────────────────────────────
async function ensureMunicipality(countyName) {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', countyName)
    .eq('state', 'MA')
    .eq('entity_type', 'county')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error(`  ${countyName} not found — run seedMACountyLinks.js first`);
  process.exit(2);
}

// ── Build budget tree (flat dept nodes) ──────────────────────────────────────
function buildBudgetTree(rows) {
  const nodes = rows
    .filter(r => r.amount > 0)
    .map(r => ({
      n: r.department,
      a: r.amount,
      i: [{ d: r.department, a: r.amount, aa: null, f: null, e: null }],
    }));
  nodes.sort((a, b) => b.a - a.a);
  const total = nodes.reduce((s, n) => s + n.a, 0);
  return { tree: nodes, total };
}

// ── Upsert data source row ────────────────────────────────────────────────────
async function upsertDataSource(muniId, countyName, fiscalYear, pdfUrl) {
  const src = {
    name:            `${countyName} Operating Budget FY${fiscalYear}`,
    api_type:        'pdf_download',   // NOT 'ma-dls' — county PDFs are not DLS data
    dataset_type:    'operating',
    dataset_id:      `fy${fiscalYear}`,
    base_url:        pdfUrl ?? '',
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
    // Mass. Gen. Laws ch. 35 § 16 — "The fiscal year of each county shall be the
    // year beginning with July first". Barnstable's Home Rule Charter § 5-1 and
    // the Dukes County FY2027 hearing notice agree; § 16 carries no
    // "notwithstanding charters" clause, so both were checked individually.
    fiscal_year_start_month: MA_FY_START_MONTH,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fy${fiscalYear}`)
    .eq('dataset_type', 'operating')
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) console.error('  data_source update error:', error.message);
    return data;
  }
  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) console.error('  data_source insert error:', error.message);
  return data;
}

// ── Load fiscal year via treasury_sync_budget_tree RPC ───────────────────────
async function loadFiscalYear(muniId, countyName, fiscalYear, pdfUrl, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, countyName, fiscalYear, pdfUrl);
  if (!ds?.id) { console.error('    data_source upsert failed'); return false; }
  console.log(`    data_source: ${ds.id}`);

  // Idempotency: clear existing budget rows before re-inserting
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  if (delErr) { console.error('    Pre-load delete failed:', delErr.message); return false; }

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'operating',
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const countyKey = args.county?.toLowerCase();
  if (!countyKey || !COUNTY_CONFIG[countyKey]) {
    console.error('Usage: node loadMACountyBudget.js --county <barnstable|bristol|dukes|norfolk|plymouth>');
    process.exit(1);
  }

  const config  = COUNTY_CONFIG[countyKey];
  const pdfPath = path.join(ROOT, 'docs', 'MA-Counties', config.pdf);
  const dryRun  = args['dry-run'] ?? false;

  console.log(`\n${config.name} FY${config.fy}${dryRun ? ' [dry-run]' : ''}`);
  console.log('─'.repeat(50));

  if (!existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  // Live load: look up municipality_id; dry-run skips DB
  const muniId = dryRun ? null : await ensureMunicipality(config.name);

  // Extract budget rows from PDF
  let rows;
  try {
    rows = extractPDF(pdfPath, countyKey);
  } catch (e) {
    console.error('Extract failed:', e.message.slice(0, 300));
    process.exit(1);
  }

  if (!rows.length) {
    console.error('No rows extracted — check extractor');
    process.exit(1);
  }

  const { tree, total } = buildBudgetTree(rows);

  // Sanity check — warn in dry-run, abort in live
  if (total > config.sanityMax) {
    const msg = `SANITY FAIL: $${total.toLocaleString()} exceeds cap $${config.sanityMax.toLocaleString()}`;
    if (dryRun) {
      console.warn(msg);
    } else {
      console.error(msg);
      process.exit(1);
    }
  }

  // Print summary
  console.log(`\n  Total: $${total.toLocaleString()} (${rows.length} depts)`);
  console.log(`  Top departments:`);
  for (const n of tree.slice(0, 8)) {
    console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
  }
  if (tree.length > 8) console.log(`    … +${tree.length - 8} more`);

  if (dryRun) {
    console.log(`\n  [dry-run] No DB writes`);
  } else {
    console.log(`\n  Loading to DB...`);
    await loadFiscalYear(muniId, config.name, config.fy, '', tree, total, tree.length);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
