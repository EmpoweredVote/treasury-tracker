#!/usr/bin/env node
/**
 * Pima County Cities Budget Loader — General Fund operating
 * (expenditure-by-function) + revenue (revenue-by-source), FY2019-FY2024
 * (South Tucson FY2019-FY2022), ACTUAL (ACFR GAAP basis).
 *
 * Phase 132-02 (PIMA-05). Consumes `scripts/extractAcfrGF.py` (Phase 131) and
 * loads exclusively through the source-safe `treasury_sync_budget_tree` RPC —
 * never treasury_sync_city_budget (overwrites + keeps stale labels; see memory
 * project_sync_city_budget_not_source_safe). Modeled on processTucson.js.
 *
 * Cities (all Pima County, AZ; linked under the existing Pima node by
 * seedPimaMunicipalities.js, Phase 132-01):
 *   Oro Valley, Marana, Sahuarita  — FY2019-FY2024
 *   South Tucson                   — FY2019-FY2022 (FY23-24 not yet published)
 *
 * Provenance: ephemeral data_sources (one per city+dataset_type, created at run
 * start, deleted at run end — WR-05), durable per-FY source_url (canonical
 * origin URL from 131-RECON.md; retrieved via Wayback/ADE mirror because the
 * origins WAF-block automation) + source_date = fiscal-year end (June 30).
 *
 * Oro Valley label cleanup (resolves the Phase 131 deferred cosmetic): OV's
 * newer PDFs render some glyphs space-separated under `pdftotext -table`
 * ("Tran s it", "In teres t", ...). OV_LABEL_FIXES maps those exact strings to
 * their correct labels at tree-map time. Values/ties are already correct; this
 * only fixes display labels, and only for Oro Valley.
 *
 * ENVIRONMENT NOTE (this machine): `python` on PATH is the Microsoft Store
 * app-execution-alias stub; the working launcher is `py -3`. extractPDF()
 * detects win32 and uses `py -3`.
 *
 * Usage:
 *   node scripts/processPimaCities.js --dry-run              # operating, all cities/FYs
 *   node scripts/processPimaCities.js --revenue --dry-run
 *   node scripts/processPimaCities.js                        # LIVE operating, all
 *   node scripts/processPimaCities.js --revenue             # LIVE revenue, all
 *   node scripts/processPimaCities.js --city OroValley --fy 2024   # narrow (retry loop)
 *
 * Requires: `pdftotext -table` (poppler); the four munis seeded via
 *   scripts/seedPimaMunicipalities.js (Phase 132-01) first.
 */

import { spawnSync, execSync } from 'node:child_process';
import { createClient }        from '@supabase/supabase-js';
import { parseArgs }           from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                    from 'node:path';
import { fileURLToPath }       from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(path.join(ROOT, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent — ignore */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SANITY_MAX   = 500_000_000; // these are towns — a GF total > $500M is implausible

// ── Per-city config (canonical origin source_urls from 131-RECON.md) ──────────
const CITIES = {
  OroValley: {
    muniName: 'Oro Valley', slug: 'orovalley', population: 48855,
    fys: [2019, 2020, 2021, 2022, 2023, 2024],
    urls: {
      2019: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-oro-valley-az-comprehensive-annual-financial-report-fye-06-30-2019.pdf',
      2020: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-cafr-20-final.pdf',
      2021: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-acfr-21-final-1.pdf',
      2022: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-of-oro-valley-az-annual-comprehensive-financial-report-fye-6-30-2022.pdf',
      2023: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-of-oro-valley-annual-comprehensive-financial-report-fye-06-30-2023.pdf',
      2024: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-acfr-24.pdf',
    },
  },
  Marana: {
    muniName: 'Marana', slug: 'marana', population: 62380,
    fys: [2019, 2020, 2021, 2022, 2023, 2024],
    urls: {
      2019: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/attachments_co15061000018356399_ka1k7fxxra6nxlutydef_fy2019cafrelectronic.pdf',
      2020: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/finalfy20cafr.pdf',
      2021: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/finalmaranaacfrfy21.pdf',
      2022: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/unsecurefinalmaranaacfrfy22.pdf',
      2023: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/7htpvn1rosfbkwjzqgdj_finalfy23acfr.pdf',
      2024: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/2024-town-of-marana-acfr-final.pdf',
    },
  },
  Sahuarita: {
    muniName: 'Sahuarita', slug: 'sahuarita', population: 37448,
    fys: [2019, 2020, 2021, 2022, 2023, 2024],
    urls: {
      2019: 'https://sahuaritaaz.gov/DocumentCenter/View/4956',
      2020: 'https://sahuaritaaz.gov/DocumentCenter/View/6361',
      2021: 'https://sahuaritaaz.gov/DocumentCenter/View/7162',
      2022: 'https://sahuaritaaz.gov/DocumentCenter/View/8597',
      2023: 'https://sahuaritaaz.gov/DocumentCenter/View/10080',
      2024: 'https://sahuaritaaz.gov/DocumentCenter/View/11908',
    },
  },
  SouthTucson: {
    muniName: 'South Tucson', slug: 'southtucson', population: 4535,
    fys: [2019, 2020, 2021, 2022],
    urls: {
      2019: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/4463/annual_financial_report_fye_6-30-2019.pdf',
      2020: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/20_south_tucson-afr.pdf',
      2021: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2021.pdf',
      2022: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2022.pdf',
    },
  },
};

// ── Oro Valley -table glyph-spacing label fixes (exact-string, OV only) ───────
const OV_LABEL_FIXES = {
  'Tran s it': 'Transit',
  'In teres t': 'Interest',
  'Integovernmental': 'Intergovernmental',
  'Net increase/(decrease) in fair value of in v es tmen ts': 'Net increase/(decrease) in fair value of investments',
  'Net increase/(decrease) in fair value of inves tments': 'Net increase/(decrease) in fair value of investments',
};
function fixLabel(dirKey, label) {
  if (dirKey === 'OroValley' && OV_LABEL_FIXES[label]) return OV_LABEL_FIXES[label];
  return label;
}

// ── Resolve PDF directory (worktree-safe) ─────────────────────────────────────
function resolvePdfDir(dirKey) {
  const candidate = path.join(ROOT, 'docs', dirKey);
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', dirKey);
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* ignore */ }
  return candidate;
}

// ── Discover PDFs by FY from a controlled readdir (filenames <Dir>-FY<year>.pdf) ─
function discoverPdfsByFY(pdfDir, dirKey) {
  if (!existsSync(pdfDir)) return new Map();
  const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const map = new Map();
  const re = new RegExp(`^${dirKey}-FY(\\d{4})\\.pdf$`, 'i');
  for (const f of files) {
    const m = f.match(re);
    if (m) map.set(parseInt(m[1], 10), path.join(pdfDir, f));
  }
  return map;
}

// ── Run the generalized Python extractor, return parsed JSON (or throw) ───────
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractAcfrGF.py');
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin ? ['-3', pyScript, pdfPath, '--mode', mode] : [pyScript, pdfPath, '--mode', mode];
  const result = spawnSync(pythonBin, args, { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`extractAcfrGF.py failed (exit ${result.status}) for ${pdfPath} [--mode ${mode}]: ` +
      `${(result.stderr || result.error?.message || '').slice(0, 500)}`);
  }
  return JSON.parse(result.stdout);
}

// ── Map extractor {n,a,c:[...]} tree to RPC {n,a,i:[{d,a,aa,f,e}]} shape ──────
function toBudgetTree(extractorTree, mode, dirKey) {
  const rootChildren = extractorTree.c || [];
  let mapped;
  if (mode === 'revenue') {
    mapped = rootChildren.map(child => {
      const n = fixLabel(dirKey, child.n);
      return { n, a: child.a, i: [{ d: n, a: child.a, aa: null, f: null, e: null }] };
    });
  } else {
    mapped = rootChildren.map(child => {
      const n = fixLabel(dirKey, child.n);
      if (Array.isArray(child.c) && child.c.length) {
        return { n, a: child.a, i: child.c.map(gc => {
          const d = fixLabel(dirKey, gc.n);
          return { d, a: gc.a, aa: null, f: null, e: null };
        }) };
      }
      return { n, a: child.a, i: [{ d: n, a: child.a, aa: null, f: null, e: null }] };
    });
  }
  const total = mapped.reduce((s, node) => s + node.a, 0);
  const rowCount = mapped.reduce((s, node) => s + node.i.length, 0);
  return { tree: mapped, total, rowCount };
}

function dataSourceLabel(muniName, fy, datasetType) {
  const kind = datasetType === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function';
  return `${muniName} ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

async function resolveMuni(supabase, muniName) {
  const { data, error } = await supabase.schema('treasury').from('municipalities')
    .select('id, name').eq('name', muniName).eq('state', 'AZ').eq('entity_type', 'city').maybeSingle();
  if (error) { console.error(`  ERROR resolving ${muniName}:`, error.message); process.exit(2); }
  if (!data?.id) { console.error(`  ${muniName}, AZ (city) not found — run scripts/seedPimaMunicipalities.js first`); process.exit(2); }
  return data;
}

async function createEphemeralDataSource(supabase, city, muniId, datasetType) {
  const datasetId = `${city.slug}-acfr-gf-${datasetType === 'revenue' ? 'revenue' : 'operating'}`;
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const payload = {
    name: `${city.muniName} General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: city.urls[city.fys[city.fys.length - 1]],
    fiscal_years: city.fys,
    municipality_id: muniId,
  };
  await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', datasetId);
  const { data, error } = await supabase.schema('treasury').from('data_sources').insert(payload).select().single();
  if (error) { console.error('  data_source insert failed:', error.message); process.exit(2); }
  console.log(`  data_source created (ephemeral): ${data.id} [${datasetId}]`);
  return data;
}

async function deleteEphemeralDataSource(supabase, dsId) {
  const { error } = await supabase.schema('treasury').from('data_sources').delete().eq('id', dsId);
  if (error) console.error('  WARNING: ephemeral data_source cleanup failed:', error.message);
}

async function loadFiscalYear(supabase, city, muniId, dsId, fy, datasetType, tree, total, rowCount) {
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType);
  if (delErr) { console.error('    Pre-load delete failed:', delErr.message); return false; }

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: dsId, p_fiscal_year: fy, p_dataset_type: datasetType,
    p_total: total, p_tree: tree, p_row_count: rowCount, p_triggered_by: 'bulk_load',
  });
  if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} line items (budget_id ${rpc?.budget_id})`);

  const { data: bud, error: budErr } = await supabase.schema('treasury').from('budgets')
    .select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType).maybeSingle();
  if (budErr || !bud?.id) { console.error('    Could not find budget row to stamp:', budErr?.message ?? '(no row)'); return false; }
  const { error: stampErr } = await supabase.schema('treasury').from('budgets').update({
    source_url: city.urls[fy], source_date: `${fy}-06-30`, data_source: dataSourceLabel(city.muniName, fy, datasetType),
  }).eq('id', bud.id);
  if (stampErr) { console.error('    Source stamp failed:', stampErr.message); return false; }
  console.log(`    Stamped source_url + source_date=${fy}-06-30`);
  return true;
}

async function processCityMode(supabase, dirKey, city, muniId, dryRun, mode, targetFY, pdfsByFY) {
  const datasetType = mode === 'revenue' ? 'revenue' : 'operating';
  const years = (targetFY ? [targetFY] : city.fys).filter(fy => city.fys.includes(fy));

  let ds = null;
  if (!dryRun) ds = await createEphemeralDataSource(supabase, city, muniId, datasetType);
  try {
    for (const fy of years) {
      const pdfPath = pdfsByFY.get(fy);
      console.log(`\n── ${city.muniName} FY${fy} ${mode} ${'─'.repeat(30)}`);
      if (!pdfPath) throw new Error(`No PDF for ${dirKey} FY${fy} in docs/${dirKey}/ — aborting`);

      const extracted = extractPDF(pdfPath, mode);
      if (extracted.tie_delta !== 0) throw new Error(`TIE FAILURE ${dirKey} FY${fy} (${mode}): delta ${extracted.tie_delta}`);

      const { tree, total, rowCount } = toBudgetTree(extracted.tree, mode, dirKey);
      if (total !== extracted.computed_total)
        throw new Error(`Mapped total ${total} != extractor computed_total ${extracted.computed_total}`);
      if (total > SANITY_MAX)
        throw new Error(`SANITY FAIL ${dirKey} FY${fy}: total $${total.toLocaleString()} exceeds $500M ceiling`);

      console.log(`  Total: $${total.toLocaleString()}  (${tree.length} categories, ${rowCount} line items)`);
      console.log(`  Per-capita: $${(total / city.population).toFixed(2)}/resident`);
      for (const n of tree) {
        const suffix = n.i.length > 1 ? ` (${n.i.length}: ${n.i.map(i => i.d).join(', ')})` : '';
        console.log(`    ${n.n}: $${n.a.toLocaleString()}${suffix}`);
      }
      if (dryRun) { console.log(`  [dry-run] no DB write`); continue; }

      const ok = await loadFiscalYear(supabase, city, muniId, ds.id, fy, datasetType, tree, total, rowCount);
      if (!ok) throw new Error(`${dirKey} FY${fy} (${mode}) load failed — aborting`);
    }
  } finally {
    if (!dryRun && ds) {
      await deleteEphemeralDataSource(supabase, ds.id);
      console.log(`\ndata_source ${ds.id} deleted (ephemeral cleanup — 0 residue)`);
    }
  }
}

async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      revenue:   { type: 'boolean', default: false },
      city:      { type: 'string' },
      fy:        { type: 'string' },
    }, strict: false,
  });
  const dryRun   = opts['dry-run'];
  const mode     = opts.revenue ? 'revenue' : 'operating';
  const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const only     = opts.city || null;

  const dirKeys = Object.keys(CITIES).filter(k => !only || k.toLowerCase() === only.toLowerCase());
  if (!dirKeys.length) { console.error(`Unknown --city ${only}. Known: ${Object.keys(CITIES).join(', ')}`); process.exit(1); }

  console.log(`Pima Cities Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]  cities: ${dirKeys.join(', ')}`);

  let supabase = null;
  if (!dryRun) {
    if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  for (const dirKey of dirKeys) {
    const city = CITIES[dirKey];
    const pdfDir = resolvePdfDir(dirKey);
    const pdfsByFY = discoverPdfsByFY(pdfDir, dirKey);
    console.log(`\n════ ${city.muniName} ════  PDFs: ${[...pdfsByFY.keys()].sort().join(', ') || '(none)'}`);
    let muniId = null;
    if (!dryRun) { const m = await resolveMuni(supabase, city.muniName); muniId = m.id; console.log(`  municipality: ${m.id}`); }
    await processCityMode(supabase, dirKey, city, muniId, dryRun, mode, targetFY, pdfsByFY);
  }
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
