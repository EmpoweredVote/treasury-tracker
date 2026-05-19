#!/usr/bin/env node
/**
 * Massachusetts DLS Gateway Scraper
 *
 * Scrapes MA Division of Local Services (DLS) Gateway report pages and
 * extracts Schedule A financial data for all 351 MA municipalities.
 *
 * Zero AI API cost — pure HTTP + HTML/Excel parsing.
 *
 * Strategy:
 *   1. GET the report page (page 1 data already in initial response + rdDataCache)
 *   2. POST Excel export using rdDataCache → parse with exceljs (one request per year)
 *   3. Fall back to HTML pagination (8 pages via AJAX POST) if Excel export fails
 *
 * Usage:
 *   node scripts/scrapeMaDLS.js --list
 *   node scripts/scrapeMaDLS.js --explore --report special-revenue
 *   node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2025
 *   node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2025 --type Revenues
 *   node scripts/scrapeMaDLS.js --scrape --all --fy 2025
 *   node scripts/scrapeMaDLS.js --seed --file scripts/output/ma_dls_special-revenue_2025.json
 *   node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2025.json
 *
 * Env vars:
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'exceljs';
const { Workbook } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
mkdirSync(OUTPUT_DIR, { recursive: true });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_URL = 'https://dls-gw.dor.state.ma.us/reports/rdpage.aspx';
const USER_AGENT = 'EmpoweredVote-TreasuryTracker/1.0 (contact: jadams@empowered.vote)';
const DELAY_MS = 1500;

// ── Report definitions ───────────────────────────────────────────────────────
// rdreport values and tableID for Excel export.
// Run --explore on unknown reports to discover tableID.
const REPORTS = [
  {
    name: 'special-revenue',
    label: 'Schedule A — Special Revenue Funds',
    rdreport: 'ScheduleA.Special_Rev_Funds.SpecialRevFunds',
    tableID: 'xtFedGrants',         // id of the <table> in the HTML
    exportFilename: 'fedgrants',
    datasetType: 'operating',       // expenditures from special revenue funds
    supportsType: true,             // has Expenditures/Revenues toggle
  },
  {
    name: 'gf-expenditures',
    label: 'General Fund Expenditures by Function',
    rdreport: 'ScheduleA.GF.ExpendituresByFunctionMain',  // best guess — verify with --explore
    tableID: 'xtGFExp',
    exportFilename: 'gfexp',
    datasetType: 'operating',
    supportsType: false,
  },
  {
    name: 'revenue-by-source',
    label: 'General Fund Revenue by Source',
    rdreport: 'RevenueBySource.RBS.RevbySourceMAIN',
    tableID: 'xtRBS',
    exportFilename: 'revbysource',
    datasetType: 'revenue',
    supportsType: false,
  },
];

// ── HTTP helpers ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getPage(url, cookies = '') {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,*/*',
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from GET ${url}`);
  return { html: await resp.text(), cookies: parseCookies(resp.headers) };
}

async function postPage(url, params, cookies = '') {
  // Build URLSearchParams supporting multi-value arrays: { iclMuni: ['Abington','Acton',...] }
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(val => body.append(k, val));
    else if (v != null) body.append(k, String(v));
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/vnd.ms-excel,*/*',
      Cookie: cookies,
      'X-Requested-With': 'XMLHttpRequest',
      Referer: url,
    },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from POST ${url}`);
  const contentType = resp.headers.get('content-type') || '';
  return { contentType, bytes: Buffer.from(await resp.arrayBuffer()), cookies: parseCookies(resp.headers) };
}

function parseCookies(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  return raw.map(c => c.split(';')[0]).join('; ');
}

// ── HTML extraction helpers ──────────────────────────────────────────────────

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#160;/g, ' ').replace(/&#\d+;/g, '')
    .trim();
}

function extractRdDataCache(html) {
  const m = html.match(/rdDataCache=(\d+)/);
  return m ? m[1] : null;
}

/** Extract the value of a named <select> dropdown. */
function extractSelectOptions(html, name) {
  const m = html.match(new RegExp(`<select[^>]+name="${name}"[^>]*>([\\s\\S]*?)<\\/select>`, 'i'));
  if (!m) return [];
  return [...m[1].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/gi)]
    .map(o => ({ value: o[1], label: o[2].trim() }));
}

/** Extract all <input type="checkbox" name="iclMuni"> values (municipality names). */
function extractCheckboxValues(html, name) {
  return [...html.matchAll(new RegExp(`<input[^>]+type="checkbox"[^>]+name="${name}"[^>]*>`, 'gi'))]
    .map(m => {
      const v = m[0].match(/value="([^"]+)"/i);
      return v ? v[1] : null;
    })
    .filter(Boolean);
}

/** Parse all data rows from the named table in HTML. Returns { headers, rows }. */
function parseTable(html, tableId) {
  const lower = html.toLowerCase();
  const start = html.indexOf(`id="${tableId}"`);
  if (start === -1) return null;
  // Case-insensitive search backwards for the opening <table tag
  const tableStart = lower.lastIndexOf('<table', start);
  if (tableStart === -1) return null;
  const tableEnd = lower.indexOf('</table>', tableStart);
  const tableHtml = html.slice(tableStart, tableEnd + 8);

  const thMatches = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
  const headers = thMatches.map(m => stripTags(m[1]));

  const trMatches = [...tableHtml.matchAll(/<tr[^>]*Row="\d+"[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows = trMatches.map(tr => {
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    return cells.map(c => stripTags(c[1]));
  }).filter(r => r.length > 0);

  return { headers, rows };
}

function parseAmount(v) {
  if (!v || v === '-' || v === '') return 0;
  return parseFloat(String(v).replace(/[,$\s]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Excel export ─────────────────────────────────────────────────────────────

async function tryExcelExport(report, rdDataCache, formFields, cookies) {
  const exportUrl = `${BASE_URL}?rdReport=${report.rdreport}&rdReportFormat=NativeExcel&rdExportTableID=${report.tableID}&rdExportFilename=${report.exportFilename}&rdDataCache=${rdDataCache}`;
  console.log(`   Trying Excel export...`);

  try {
    // Use a fresh fetch so AWSALB cookie rotation doesn't affect our sticky session
    const resp = await fetch(exportUrl, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookies,
      },
      body: new URLSearchParams({ rdDataCache }).toString(),
    });
    const contentType = resp.headers.get('content-type') || '';
    const bytes = Buffer.from(await resp.arrayBuffer());

    if (contentType.includes('excel') || contentType.includes('spreadsheet') ||
        contentType.includes('octet-stream')) {
      console.log(`   Excel export success: ${(bytes.length / 1024).toFixed(0)} KB`);
      return { bytes };
    }

    console.log(`   Excel export returned HTML — falling back to HTML scraping`);
    return null;
  } catch (err) {
    console.log(`   Excel export failed: ${err.message} — falling back to HTML scraping`);
    return null;
  }
}

async function parseExcelBytes(bytes, report) {
  const wb = new Workbook();
  await wb.xlsx.load(bytes);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('No worksheet in Excel export');

  const headers = [];
  const rows = [];

  ws.eachRow((row, rowNumber) => {
    const cells = row.values.slice(1).map(v =>
      v == null ? '' : (typeof v === 'object' && v.richText ? v.richText.map(r => r.text).join('') : String(v))
    );
    if (rowNumber === 1) {
      headers.push(...cells);
    } else {
      rows.push(cells);
    }
  });

  return { headers, rows };
}

// ── HTML pagination fallback ─────────────────────────────────────────────────

async function scrapeViaHtml(report, rdDataCache, formFields, cookies, html1) {
  console.log('   Using HTML pagination fallback...');

  // Parse page 1 from initial response
  const page1 = parseTable(html1, report.tableID);
  if (!page1) {
    const debugFile = join(OUTPUT_DIR, `debug_${report.name}_p1.html`);
    writeFileSync(debugFile, html1);
    throw new Error(`Table "${report.tableID}" not found in HTML. Saved to ${debugFile}`);
  }

  const { headers, rows: allRows } = page1;
  console.log(`   Page 1: ${allRows.length} rows, headers: ${headers.join(' | ')}`);

  // Detect total pages
  const pageNrs = [...html1.matchAll(/xtFedGrants-PageNr=(\d+)/g)].map(m => parseInt(m[1]));
  const maxPage = pageNrs.length > 0 ? Math.max(...pageNrs) : 1;
  console.log(`   Total pages: ${maxPage}`);

  // Fetch pages 2..N via AJAX GET (replicates rdAjaxRequest() JS calls in the page).
  // IMPORTANT: AWSALB sticky-session cookies rotate with every response — using the rotated
  // cookie routes to a different backend that doesn't have the rdDataCache in memory.
  // Always use the original cookies from the initial GET.
  for (let page = 2; page <= maxPage; page++) {
    await sleep(DELAY_MS);
    console.log(`   Page ${page}/${maxPage}...`);

    const ajaxParams = new URLSearchParams({
      rdReport: report.rdreport,
      [`${report.tableID}-PageNr`]: String(page),
      rdDataCache,
      rdShowModes: '',
      rdSort: '',
      rdNewPageNr: 'True1',
      rdAjaxCommand: 'RefreshElement',
      rdDataTablePaging: 'True',
      rdRefreshElementID: report.tableID,
      rdRequestForwarding: 'Form',
    });
    const ajaxUrl = `${BASE_URL}?${ajaxParams}`;
    const { html: pageHtml } = await getPage(ajaxUrl, cookies); // keep original cookies always

    const tableData = parseTable(pageHtml, report.tableID);
    if (tableData && tableData.rows.length > 0) {
      allRows.push(...tableData.rows);
      console.log(`     +${tableData.rows.length} rows (total: ${allRows.length})`);
    } else {
      console.log(`     ⚠️  No data table on page ${page}`);
      writeFileSync(join(OUTPUT_DIR, `debug_${report.name}_p${page}.html`), pageHtml);
    }
  }

  return { headers, rows: allRows };
}

// ── Core scrape logic ────────────────────────────────────────────────────────

async function scrapeReport(report, fiscalYear, amountType = 'Expenditures') {
  const reportUrl = `${BASE_URL}?rdreport=${report.rdreport}`;
  console.log(`\n📥  ${report.label}`);
  console.log(`    FY${fiscalYear}${report.supportsType ? ` — ${amountType}` : ''}`);

  // Step 1: GET the page (establishes session, page 1 data already present)
  console.log('    Step 1: GET initial page...');
  const { html: html1, cookies } = await getPage(reportUrl);
  const rdDataCache = extractRdDataCache(html1);
  const yearOpts = extractSelectOptions(html1, 'islYear');
  const municValues = extractCheckboxValues(html1, 'iclMuni');

  console.log(`    rdDataCache: ${rdDataCache || '⚠️  NOT FOUND'}`);
  console.log(`    Municipalities in form: ${municValues.length}`);
  console.log(`    Years available: ${yearOpts.map(o => o.value).join(', ')}`);

  if (!rdDataCache) {
    throw new Error('Could not extract rdDataCache — page structure may have changed');
  }

  const fyAvailable = yearOpts.some(o => o.value === String(fiscalYear));
  if (yearOpts.length > 0 && !fyAvailable) {
    throw new Error(`FY${fiscalYear} not available. Options: ${yearOpts.map(o => o.value).join(', ')}`);
  }

  // Build form fields — iclMuni as array so postPage uses .append() for each value
  const formFields = {
    rdreport: report.rdreport,
    islYear: String(fiscalYear),
    ...(report.supportsType ? { islAmountType: amountType } : {}),
    iclMuni: municValues,           // array → multi-value POST params
    [`${report.tableID}-PageNr`]: '1',
    rdShowElementHistory: '',
  };

  let headers, rows;

  // Step 2: Try Excel export first (fastest — all 351 rows in one request)
  await sleep(DELAY_MS);
  const excelResult = await tryExcelExport(report, rdDataCache, formFields, cookies);

  if (excelResult) {
    const excelFile = join(OUTPUT_DIR, `raw_${report.name}_${fiscalYear}.xlsx`);
    writeFileSync(excelFile, excelResult.bytes);
    console.log(`    Raw Excel saved → ${excelFile}`);

    try {
      const parsed = await parseExcelBytes(excelResult.bytes, report);
      headers = parsed.headers;
      rows = parsed.rows;
      console.log(`    Parsed ${rows.length} rows from Excel`);
    } catch (err) {
      console.log(`    Excel parse error: ${err.message} — falling back to HTML`);
      await sleep(DELAY_MS);
      const result = await scrapeViaHtml(report, rdDataCache, formFields, cookies, html1);
      headers = result.headers;
      rows = result.rows;
    }
  } else {
    // Step 3: HTML pagination fallback
    await sleep(DELAY_MS);
    const result = await scrapeViaHtml(report, rdDataCache, formFields, cookies, html1);
    headers = result.headers;
    rows = result.rows;
  }

  // Normalise records
  const records = [];
  for (const row of rows) {
    if (!row || row.length < 3) continue;
    // Expect DOR Code in col 0, Municipality in col 1, FY in col 2
    const dorCode = row[0]?.trim();
    const municipality = row[1]?.trim();
    const fy = parseInt(row[2]) || fiscalYear;
    if (!dorCode || !municipality || !/^\d+$/.test(dorCode)) continue;

    const record = { dorCode, municipality, fiscalYear: fy };
    for (let i = 3; i < headers.length; i++) {
      if (headers[i]) record[headers[i]] = parseAmount(row[i]);
    }
    records.push(record);
  }

  const amountCols = headers.slice(3).filter(h => h && h !== 'Total Revenues' && h !== 'Total Expenditures');
  console.log(`\n    Valid records: ${records.length}`);
  console.log(`    Columns: ${amountCols.join(', ')}`);
  if (records[0]) console.log(`    Sample: ${JSON.stringify(records[0]).slice(0, 120)}`);

  const outFile = join(OUTPUT_DIR, `ma_dls_${report.name}_${fiscalYear}${report.supportsType ? `_${amountType.toLowerCase()}` : ''}.json`);
  writeFileSync(outFile, JSON.stringify({ report: report.name, fiscalYear, amountType, headers, records }, null, 2));
  console.log(`\n    ✅ Saved ${records.length} records → ${outFile}`);

  return { headers, records };
}

// ── Explore mode ─────────────────────────────────────────────────────────────

async function exploreReport(report) {
  const url = `${BASE_URL}?rdreport=${report.rdreport}`;
  console.log(`\n🔍  ${report.label}`);
  console.log(`    URL: ${url}`);

  let html, cookies;
  try {
    ({ html, cookies } = await getPage(url));
  } catch (err) {
    console.log(`    ❌ GET failed: ${err.message}`);
    return;
  }

  const htmlFile = join(OUTPUT_DIR, `explore_${report.name}.html`);
  writeFileSync(htmlFile, html);
  console.log(`    Page size: ${(html.length / 1024).toFixed(1)} KB → ${htmlFile}`);

  const rdDataCache = extractRdDataCache(html);
  const yearOpts = extractSelectOptions(html, 'islYear');
  const typeOpts = extractSelectOptions(html, 'islAmountType');
  const municValues = extractCheckboxValues(html, 'iclMuni');

  console.log(`    rdDataCache: ${rdDataCache || 'NOT FOUND'}`);
  console.log(`    Years: ${yearOpts.map(o => o.value).join(', ') || 'none found'}`);
  console.log(`    Types: ${typeOpts.map(o => o.label).join(', ') || 'none found'}`);
  console.log(`    Municipalities (checkboxes): ${municValues.length}`);
  if (municValues.length > 0) console.log(`    Sample: ${municValues.slice(0, 5).join(', ')} ...`);

  // Try to parse the table already in page 1
  const tableData = parseTable(html, report.tableID);
  if (tableData) {
    console.log(`\n    Table "${report.tableID}" found!`);
    console.log(`    Headers: ${tableData.headers.join(' | ')}`);
    console.log(`    Rows on page 1: ${tableData.rows.length}`);
    if (tableData.rows[0]) console.log(`    Row 1: ${tableData.rows[0].join(' | ')}`);
  } else {
    console.log(`\n    ⚠️  Table "${report.tableID}" NOT found in initial HTML`);
    // List all table IDs in the page
    const tableIds = [...html.matchAll(/id="(xt\w+)"/g)].map(m => m[1]);
    if (tableIds.length > 0) console.log(`    Table IDs found: ${[...new Set(tableIds)].join(', ')}`);
  }

  // Show export URL template
  if (rdDataCache) {
    const exportUrl = `${BASE_URL}?rdReport=${report.rdreport}&rdReportFormat=NativeExcel&rdExportTableID=${report.tableID}&rdExportFilename=${report.exportFilename}&rdDataCache=${rdDataCache}`;
    console.log(`\n    Excel export URL: ${exportUrl}`);
  }

  // Look for AJAX pagination pattern
  const ajaxPages = [...html.matchAll(/rdAjaxRequest\(['"](rdReport=[^'"]+)['"]\)/g)]
    .map(m => decodeURIComponent(m[1].replace(/&amp;/g, '&')));
  if (ajaxPages.length > 0) {
    console.log(`\n    AJAX pagination calls found: ${ajaxPages.length}`);
    console.log(`    Sample: ${ajaxPages[0].slice(0, 120)}`);
  }
}

// ── Seed municipalities ──────────────────────────────────────────────────────

async function seedMunicipalities(supabase, records) {
  const unique = new Map();
  for (const r of records) {
    if (!unique.has(r.municipality)) unique.set(r.municipality, r.dorCode);
  }

  console.log(`\n🌱  Seeding ${unique.size} MA municipalities...`);
  let inserted = 0, skipped = 0, errored = 0;

  for (const [name, dorCode] of unique) {
    const { data: existing } = await supabase
      .schema('treasury')
      .from('municipalities')
      .select('id')
      .eq('name', name)
      .eq('state', 'MA')
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const { error } = await supabase.schema('treasury').from('municipalities').insert({
      name,
      state: 'MA',
      entity_type: 'city',
      metadata: { dor_code: dorCode },
    });

    if (error) { console.log(`    ⚠️  ${name}: ${error.message}`); errored++; }
    else inserted++;
  }

  console.log(`    Inserted: ${inserted} | Skipped (existing): ${skipped} | Errors: ${errored}`);
}

// ── Load to Supabase ─────────────────────────────────────────────────────────

async function loadToSupabase(supabase, report, fiscalYear, records, headers) {
  const { data: municipalities, error: mErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('state', 'MA');

  if (mErr) throw new Error(`Could not fetch municipalities: ${mErr.message}`);

  const municMap = new Map(municipalities.map(m => [m.name, m.id]));
  const amountCols = headers.slice(3).filter(h => h && !h.toLowerCase().startsWith('total'));

  console.log(`\n📤  Loading ${records.length} records into Supabase...`);
  console.log(`    Amount columns: ${amountCols.join(', ')}`);

  let loaded = 0, skipped = 0;

  for (const record of records) {
    const municId = municMap.get(record.municipality);
    if (!municId) {
      if (skipped === 0) console.log(`    ⚠️  No DB record for "${record.municipality}" — run --seed first`);
      skipped++;
      continue;
    }

    // Find or create a data source for this municipality
    const { data: existingDs } = await supabase
      .schema('treasury')
      .from('data_sources')
      .select('id')
      .eq('municipality_id', municId)
      .eq('api_type', 'ma-dls')
      .eq('dataset_type', report.datasetType)
      .maybeSingle();

    let dsId = existingDs?.id;

    if (!dsId) {
      const { data: newDs, error: dsErr } = await supabase
        .schema('treasury')
        .from('data_sources')
        .insert({
          municipality_id: municId,
          name: `${record.municipality} — MA DLS ${report.label}`,
          api_type: 'ma-dls',
          dataset_type: report.datasetType,
          base_url: BASE_URL,
          column_mapping: { rdreport: report.rdreport, tableID: report.tableID },
          fiscal_years: [fiscalYear],
        })
        .select('id')
        .single();

      if (dsErr) {
        console.log(`    ❌ ${record.municipality} data source: ${dsErr.message}`);
        skipped++;
        continue;
      }
      dsId = newDs.id;
    }

    // Build compact budget tree: one category per amount column
    let total = 0;
    const tree = [];
    for (const col of amountCols) {
      const amount = record[col] || 0;
      if (amount === 0) continue;
      total += amount;
      tree.push({ n: col, a: amount, i: [{ d: col, a: amount, aa: null, f: 'General Fund', e: null }] });
    }
    tree.sort((a, b) => b.a - a.a);

    if (tree.length === 0) { skipped++; continue; }

    const { error } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: dsId,
      p_fiscal_year: fiscalYear,
      p_dataset_type: report.datasetType,
      p_total: total,
      p_tree: tree,
      p_row_count: tree.length,
      p_triggered_by: 'ma_dls_scraper',
    });

    if (error) { console.log(`    ❌ ${record.municipality}: ${error.message}`); skipped++; }
    else {
      loaded++;
      if (loaded % 50 === 0) console.log(`    ... ${loaded} loaded`);
    }
  }

  console.log(`\n    ✅ Loaded: ${loaded} | Skipped: ${skipped}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      list:    { type: 'boolean' },
      explore: { type: 'boolean' },
      scrape:  { type: 'boolean' },
      all:     { type: 'boolean', short: 'a' },
      seed:    { type: 'boolean' },
      load:    { type: 'boolean' },
      report:  { type: 'string',  short: 'r' },
      fy:      { type: 'string' },
      type:    { type: 'string' },   // Expenditures or Revenues
      file:    { type: 'string',  short: 'f' },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  console.log('\n🏛️  MA DLS Gateway Scraper  (zero AI API cost)\n');

  if (values.list) {
    console.log('Available reports:\n');
    REPORTS.forEach(r => {
      console.log(`  --report ${r.name}`);
      console.log(`    ${r.label}`);
      console.log(`    rdreport=${r.rdreport}  tableID=${r.tableID}`);
      console.log(`    dataset type: ${r.datasetType}  supports type toggle: ${r.supportsType}\n`);
    });
    console.log('Years:  2002–2025');
    return;
  }

  if (values.explore) {
    const toExplore = values.report
      ? REPORTS.filter(r => r.name === values.report)
      : REPORTS;
    for (const r of toExplore) {
      await exploreReport(r);
      await sleep(DELAY_MS * 2);
    }
    return;
  }

  if (values.scrape) {
    const fiscalYear = parseInt(values.fy) || 2025;
    const amountType = values.type || 'Expenditures';
    const toScrape = values.all
      ? REPORTS
      : REPORTS.filter(r => r.name === values.report);

    if (toScrape.length === 0) {
      console.error('No report selected. Use --report <name> or --all. Use --list to see options.');
      process.exit(1);
    }

    const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

    for (const report of toScrape) {
      try {
        const result = await scrapeReport(report, fiscalYear, amountType);
        if (result && !values['dry-run'] && supabase) {
          await loadToSupabase(supabase, report, fiscalYear, result.records, result.headers);
        }
      } catch (err) {
        console.error(`    ❌ ${report.name}: ${err.message}`);
      }
      await sleep(DELAY_MS * 2);
    }
    return;
  }

  if (values.seed && values.file) {
    if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { records } = JSON.parse(readFileSync(values.file, 'utf8'));
    await seedMunicipalities(supabase, records);
    return;
  }

  if (values.load && values.file) {
    if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { report: reportName, fiscalYear, headers, records } = JSON.parse(readFileSync(values.file, 'utf8'));
    const report = REPORTS.find(r => r.name === reportName);
    if (!report) { console.error(`Unknown report: ${reportName}`); process.exit(1); }

    console.log(`Loading: ${report.label}, FY${fiscalYear}, ${records.length} records`);
    if (!values['dry-run']) {
      await loadToSupabase(supabase, report, fiscalYear, records, headers);
    } else {
      console.log('(dry run)');
      console.log('Sample:', JSON.stringify(records.slice(0, 2), null, 2));
    }
    return;
  }

  console.log('Usage:');
  console.log('  node scripts/scrapeMaDLS.js --list');
  console.log('  node scripts/scrapeMaDLS.js --explore --report special-revenue');
  console.log('  node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2025');
  console.log('  node scripts/scrapeMaDLS.js --scrape --all --fy 2025');
  console.log('  node scripts/scrapeMaDLS.js --seed --file scripts/output/ma_dls_special-revenue_2025.json');
  console.log('  node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2025.json');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
