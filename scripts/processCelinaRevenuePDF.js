#!/usr/bin/env node
/**
 * Celina FY2025 Revenue Extractor
 *
 * Extracts governmental fund revenues from Celina's FY2025 ACFR PDF using
 * pdftotext — no AI API calls, pure text parsing.
 *
 * Targets: "Statement of Revenues, Expenditures and Changes in Fund Balances"
 *           (sentence case, followed by "Governmental Funds" on the next line)
 *
 * PDF layout notes:
 *   The all-funds governmental statement has 7 fund columns + Total column.
 *   pdftotext -layout places the Total Governmental Funds column at char pos ~136-148.
 *   The General Fund column (leftmost) is at pos ~45-58.
 *   Some rows have the total on the labeled line; others have it on a continuation line.
 *   Continuation lines (no label) show remaining fund columns from the second page half.
 *   The "Total revenues" row provides the validation anchor ($129,568,278).
 *
 *   For each revenue line item:
 *     - Label detected from left-aligned text before first number
 *     - GF actual = value at pos ~45 (General Fund column)
 *     - Total adopted = value at pos >=130 on labeled line OR on next continuation line
 *     - If no total column value found anywhere, fall back to GF value
 *
 * Validation:
 *   Extracted total (sum of all line-item totals) must be within 20% of $129,568,278.
 *   If validation fails: prints comparison and exits without loading to DB.
 *
 * DB:
 *   Looks up data_source by composite key (municipality_id + pdf_download + fy2025 + revenue).
 *   Calls treasury_sync_budget_tree RPC with p_dataset_type='revenue'.
 *   Sets last_synced_at on success.
 *
 * Usage:
 *   node scripts/processCelinaRevenuePDF.js              # production (loads to DB)
 *   node scripts/processCelinaRevenuePDF.js --dry-run    # parse and print, no DB write
 *   node scripts/processCelinaRevenuePDF.js --verbose    # log parse decisions to stderr
 *   node scripts/processCelinaRevenuePDF.js --no-cache   # re-download even if cache exists
 *   node scripts/processCelinaRevenuePDF.js --pdf <path> # use local PDF file (skip download)
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL    = 'https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025';
const CACHE_PATH = 'C:/tmp/celina_acfr_fy2025.pdf';
const FISCAL_YEAR     = 2025;
const EXPECTED_TOTAL  = 129_568_278;  // Total Governmental Revenues from FY2025 ACFR
const TOLERANCE       = 0.20;         // 20% — hardcoded, not configurable

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Parse money token (handles negatives in parens) ──────────────────────────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '-') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── Extract numeric dollar values from a line with character positions ─────────
// Returns array of { value, pos } where pos is the character position of the
// FIRST DIGIT of the number (not leading spaces or $ sign).
// Only matches values with at least one comma (e.g., "1,234" or "1,234,567").
// Negative values in parens like "(1,234)" return the position of the opening paren.
function extractAllValues(line) {
  const results = [];
  // Regex matches:
  //   - Optional opening paren for negatives: \(?
  //   - Optional dollar sign: \$?
  //   - Number with comma separators: \d{1,3}(?:,\d{3})+
  //   - Optional closing paren: \)?
  // We use two patterns: one for paren-negatives and one for plain numbers
  // to ensure we get the correct position (position of digit/paren, not spaces)
  const re = /(\()?\$?(\d{1,3}(?:,\d{3})+)\)?/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const v = parseMoney(m[0]);
    if (v !== null) {
      // m.index is position of '(' or first digit
      results.push({ value: v, pos: m.index });
    }
  }
  return results;
}

// ── Get value in the "Total Governmental" column (pos >= 130) ─────────────────
// Returns { value, pos } or null if no value found at that position
function getTotalColumnValue(line) {
  const vals = extractAllValues(line);
  // Total Governmental column is at pos ~136 — look for any value at pos >= 130
  for (const v of vals) {
    if (v.pos >= 130) return v;
  }
  return null;
}

// ── Get value in the "General Fund" column (pos ~45-58) ───────────────────────
// Returns { value, pos } or null if no value found at that position
function getGFColumnValue(line) {
  const vals = extractAllValues(line);
  // GF column is at pos ~45-58 — look for first value in that range (or nearby)
  for (const v of vals) {
    if (v.pos >= 40 && v.pos <= 65) return v;
  }
  // Fallback: first value overall (for rows where GF is leftmost value)
  if (vals.length > 0) return vals[0];
  return null;
}

// ── Extract PDF text via pdftotext ────────────────────────────────────────────
function extractPdfText(pdfPath) {
  try {
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, {
      maxBuffer: 256 * 1024 * 1024,
      encoding: 'utf8',
    });
    // Strip form-feed characters that prefix new pages
    return text.split('\n').map(l => l.startsWith('\x0c') ? l.slice(1) : l);
  } catch (e) {
    console.error('pdftotext error:', e.message.slice(0, 300));
    return null;
  }
}

// ── Find the governmental funds revenue section ───────────────────────────────
// Looks for "Statement of Revenues, Expenditures and Changes in Fund Balances"
// (sentence case) followed by "Governmental Funds" within 10 lines.
// Returns the line index of the section start, or -1 if not found.
function findRevenueSection(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/Statement of Revenues, Expenditures and Changes in Fund Balances/.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        if (/Governmental Funds/.test(lines[j]) && !/Budget and Actual/.test(lines[j - 1] || '')) {
          return i;
        }
      }
    }
  }
  return -1;
}

// ── Parse revenue lines from the governmental funds statement ─────────────────
//
// Strategy:
//   Uses character-position-based column detection. The Total Governmental Funds
//   column is at pos >= 130. The General Fund column is at pos ~45-58.
//
//   For each labeled revenue line:
//   1. Extract the label (non-blank left-aligned text before first number)
//   2. GF actual = value at pos ~45-65 (General Fund column)
//   3. Total adopted = value at pos >= 130 on labeled line OR next continuation line
//   4. If no total column value found, fall back to GF value as adopted amount
//   5. Skip "Total revenues" (validation anchor only)
//   6. Skip label-only lines with no dollar amounts (log warning)
//
// The continuation lines (no label) show right-side fund columns (Parkland, Bond,
// Other Governmental, and Total) from the second pdftotext page block. Their total
// column value (pos >= 130) is used if the labeled line didn't have one.
//
// Returns array of { label, adoptedAmount, actualAmount }
function parseRevenueLines(lines, startIdx, verbose) {
  const rows = [];
  let inRevenues = false;
  let pendingLabel = null;
  let pendingGF = null;
  let pendingHasTotal = false;  // true if the label line already captured a total

  const nLines = lines.length;

  for (let i = startIdx; i < nLines; i++) {
    const line = lines[i];
    const t = line.trim();

    // Enter revenues section
    if (!inRevenues) {
      if (/^Revenues\s*$/.test(t)) {
        inRevenues = true;
        if (verbose) console.error(`[section-start] Line ${i}: Revenues section found`);
      }
      continue;
    }

    // Stop at Expenditures section
    if (/^Expenditures\b/i.test(t)) {
      if (verbose) console.error(`[section-end] Line ${i}: Expenditures section — stopping revenue parse`);
      break;
    }

    // Skip blank lines
    if (!t) continue;

    // Skip header/footer lines
    if (/^City of Celina|^For the Year Ended|^Statement of Revenues|^Governmental Funds|^Page \d+/.test(t)) continue;

    // Skip "Total revenues" — validation anchor only
    if (/^\s*Total revenues\b/i.test(t)) {
      if (verbose) console.error(`[skip-total] Line ${i}: "Total revenues" line — validation anchor only`);
      // Flush any pending label using GF as fallback before stopping
      if (pendingLabel !== null && !pendingHasTotal && pendingGF !== null) {
        if (verbose) console.error(`[fallback-gf] "${pendingLabel}" using GF=$${Math.round(pendingGF).toLocaleString()} as total (no total column found)`);
        rows.push({ label: pendingLabel, adoptedAmount: pendingGF, actualAmount: pendingGF });
        pendingLabel = null; pendingGF = null; pendingHasTotal = false;
      }
      continue;
    }

    // A labeled line starts with a letter at column 0 (not indented)
    const hasLabel = /^[A-Za-z]/.test(line);
    const gfVal = getGFColumnValue(line);
    const totalVal = getTotalColumnValue(line);

    if (hasLabel) {
      // Flush any pending label that had no total yet
      if (pendingLabel !== null && !pendingHasTotal) {
        if (pendingGF !== null) {
          if (verbose) console.error(`[fallback-gf] "${pendingLabel}" using GF=$${Math.round(pendingGF).toLocaleString()} as total (no total column found)`);
          rows.push({ label: pendingLabel, adoptedAmount: pendingGF, actualAmount: pendingGF });
        } else {
          if (verbose) console.error(`[warn-no-data] "${pendingLabel}" had no GF or total — skipping`);
        }
      }

      // Extract label: text before first number
      const labelMatch = /^([A-Za-z][^$\d(]*)/.exec(line);
      const rawLabel = labelMatch ? labelMatch[1].trim() : t.replace(/[\d,\s$()\-]+$/, '').trim();

      if (!rawLabel || rawLabel.length < 2) {
        pendingLabel = null; pendingGF = null; pendingHasTotal = false;
        continue;
      }

      if (!gfVal && !totalVal) {
        // Label-only line — no dollar amounts (label-only or all-dash row)
        if (verbose) console.error(`[warn-label-only] Line ${i}: "${rawLabel}" has no dollar amounts — skipping`);
        pendingLabel = null; pendingGF = null; pendingHasTotal = false;
        continue;
      }

      if (totalVal) {
        // Total column found on label line.
        // Sanity check: Total Governmental must be >= GF value (impossible otherwise).
        // If it fails, treat as if no total column was found — wait for continuation.
        const gfActual = gfVal ? gfVal.value : null;
        if (gfActual !== null && totalVal.value < gfActual) {
          if (verbose) console.error(`[label-sanity-fail] Line ${i}: "${rawLabel}" label-line total $${Math.round(totalVal.value).toLocaleString()} < GF $${Math.round(gfActual).toLocaleString()} — treating as no-total, waiting for continuation`);
          pendingLabel = rawLabel;
          pendingGF = gfActual;
          pendingHasTotal = false;
        } else {
          if (verbose) console.error(`[revenue] Line ${i}: "${rawLabel}" GF=${gfActual != null ? '$' + Math.round(gfActual).toLocaleString() : 'null'} Total=$${Math.round(totalVal.value).toLocaleString()}`);
          rows.push({ label: rawLabel, adoptedAmount: totalVal.value, actualAmount: gfActual ?? totalVal.value });
          pendingLabel = null; pendingGF = null; pendingHasTotal = false;
        }
      } else {
        // No total column on label line — save GF value and wait for continuation
        const gfActual = gfVal ? gfVal.value : null;
        pendingLabel = rawLabel;
        pendingGF = gfActual;
        pendingHasTotal = false;
        if (verbose) console.error(`[pending] Line ${i}: "${rawLabel}" GF=${gfActual ? '$' + Math.round(gfActual).toLocaleString() : 'null'} — waiting for total column`);
      }
    } else {
      // Unlabeled continuation line
      if (pendingLabel !== null && !pendingHasTotal && totalVal) {
        // Found a value in the total column position for pending label.
        // Sanity check: the Total Governmental value must be >= the GF value (since GF is one
        // of the funds that makes up Total). If it's less, the continuation column is misaligned —
        // fall back to using GF value as the adopted amount.
        const gfActual = pendingGF;
        const candidateTotal = totalVal.value;
        if (gfActual !== null && candidateTotal < gfActual) {
          if (verbose) console.error(`[continuation-sanity-fail] Line ${i}: "${pendingLabel}" continuation total $${Math.round(candidateTotal).toLocaleString()} < GF $${Math.round(gfActual).toLocaleString()} — using GF as fallback`);
          rows.push({ label: pendingLabel, adoptedAmount: gfActual, actualAmount: gfActual });
        } else {
          if (verbose) console.error(`[continuation-total] Line ${i}: "${pendingLabel}" gets Total=$${Math.round(candidateTotal).toLocaleString()}`);
          rows.push({ label: pendingLabel, adoptedAmount: candidateTotal, actualAmount: gfActual });
        }
        pendingLabel = null; pendingGF = null; pendingHasTotal = false;
      } else if (pendingLabel !== null && !pendingHasTotal) {
        // Continuation line has no total column — keep waiting
        if (verbose) console.error(`[skip-continuation] Line ${i}: no total column on continuation for "${pendingLabel}"`);
      } else {
        // Extra fund breakdown for a row already captured
        if (verbose) console.error(`[skip-extra] Line ${i}: extra fund column data — already captured row`);
      }
    }
  }

  // Final flush if any pending label remains
  if (pendingLabel !== null && !pendingHasTotal && pendingGF !== null) {
    if (verbose) console.error(`[fallback-gf-final] "${pendingLabel}" using GF=$${Math.round(pendingGF).toLocaleString()} as total (end of section)`);
    rows.push({ label: pendingLabel, adoptedAmount: pendingGF, actualAmount: pendingGF });
  }

  return rows;
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
// Format: [{n, a, c: [{n, a, i: [{d, a, aa, f, e}]}]}]
// department = "General Fund", fund = "Governmental Funds"
function buildTree(rows) {
  const department = 'General Fund';
  const fund = 'Governmental Funds';

  const children = [];
  let total = 0;

  for (const row of rows) {
    const a = Number(row.adoptedAmount) || 0;
    const aa = row.actualAmount != null ? Number(row.actualAmount) : null;
    if (a === 0 && (aa === null || aa === 0)) continue;

    children.push({
      n: row.label,
      a: a,
      i: [{
        d: row.label,
        a: a,
        aa: aa,
        f: fund,
        e: null,
      }],
    });
    total += a;
  }

  children.sort((a, b) => b.a - a.a);

  const jsonTree = [{
    n: department,
    a: total,
    c: children,
  }];

  return { jsonTree, total };
}

// ── Validate extracted total against expected ─────────────────────────────────
function validateTotal(extracted, expected) {
  const diff = Math.abs(extracted - expected) / expected;
  const pct = (diff * 100).toFixed(1);
  console.log(`Validation:`);
  console.log(`  Extracted:  $${Math.round(extracted).toLocaleString()}`);
  console.log(`  Expected:   $${Math.round(expected).toLocaleString()}`);
  console.log(`  Difference: ${pct}%  (tolerance: ${(TOLERANCE * 100).toFixed(0)}%)`);
  return diff <= TOLERANCE;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run':  { type: 'boolean', default: false },
      'verbose':  { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
      'pdf':      { type: 'string' },
    },
    strict: false,
  });

  const dryRun  = opts['dry-run'];
  const verbose = opts['verbose'];
  const noCache = opts['no-cache'];
  const pdfOverride = opts['pdf'];

  // ── Supabase client ──────────────────────────────────────────────────────────
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Municipality lookup ──────────────────────────────────────────────────────
  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Celina').single();
  if (muniErr || !muni) {
    console.error('Could not find Celina municipality:', muniErr?.message);
    process.exit(2);
  }
  const muniId = muni.id;
  console.log(`Municipality: ${muni.name} (${muniId})\n`);

  // ── Determine PDF path ────────────────────────────────────────────────────────
  let pdfPath;
  if (pdfOverride) {
    pdfPath = pdfOverride;
    if (!fs.existsSync(pdfPath)) {
      console.error(`--pdf path not found: ${pdfPath}`);
      process.exit(2);
    }
    console.log(`Using PDF override: ${pdfPath}`);
  } else {
    pdfPath = CACHE_PATH;
    const cacheExists = fs.existsSync(pdfPath);
    if (!cacheExists || noCache) {
      console.log(`Downloading PDF from ${PDF_URL} ...`);
      const resp = await fetch(PDF_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/pdf,*/*' },
      });
      if (!resp.ok) {
        console.error(`Download failed: HTTP ${resp.status} ${resp.statusText}`);
        process.exit(2);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      // Ensure cache directory exists
      const cacheDir = path.dirname(pdfPath);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(pdfPath, buf);
      console.log(`Saved to ${pdfPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
    } else {
      console.log(`Using cached PDF: ${pdfPath}`);
    }
  }

  // ── Extract PDF text ──────────────────────────────────────────────────────────
  console.log('Extracting text with pdftotext...');
  const lines = extractPdfText(pdfPath);
  if (!lines) {
    console.error('pdftotext failed');
    process.exit(2);
  }
  console.log(`  Total lines: ${lines.length}`);

  // ── Find governmental funds revenue section ───────────────────────────────────
  const sectionIdx = findRevenueSection(lines);
  if (sectionIdx < 0) {
    console.error('ERROR: Could not find "Statement of Revenues, Expenditures and Changes in Fund Balances" / Governmental Funds section');
    process.exit(2);
  }
  console.log(`  Section found at line ${sectionIdx}: "${lines[sectionIdx].trim().slice(0, 80)}"`);

  // ── Parse revenue lines ───────────────────────────────────────────────────────
  console.log('Parsing revenue lines...');
  const rows = parseRevenueLines(lines, sectionIdx, verbose);

  if (rows.length === 0) {
    console.error('ERROR: No revenue rows parsed from section');
    process.exit(2);
  }

  console.log(`  Revenue line items parsed: ${rows.length}`);

  // ── Print revenue line items ──────────────────────────────────────────────────
  console.log('\nRevenue Line Items:');
  console.log('─'.repeat(90));
  console.log(`${'Label'.padEnd(50)} ${'Total Gov. ($)'.padStart(18)}  ${'GF Actual ($)'.padStart(16)}`);
  console.log('─'.repeat(90));
  for (const row of rows) {
    const totalStr  = row.adoptedAmount != null ? Math.round(row.adoptedAmount).toLocaleString() : '—';
    const actualStr = row.actualAmount  != null ? Math.round(row.actualAmount).toLocaleString()  : '—';
    console.log(`${row.label.padEnd(50)} ${totalStr.padStart(18)}  ${actualStr.padStart(16)}`);
  }
  console.log('─'.repeat(90));

  // ── Build tree and compute total ──────────────────────────────────────────────
  const { jsonTree, total } = buildTree(rows);

  console.log(`\n${'TOTAL'.padEnd(50)} ${Math.round(total).toLocaleString().padStart(18)}\n`);

  // ── Validate ──────────────────────────────────────────────────────────────────
  const valid = validateTotal(total, EXPECTED_TOTAL);

  if (!valid) {
    console.error('\nVALIDATION FAILED — Celina FY2025 revenue NOT loaded to DB.');
    console.error('Extracted total is outside 20% tolerance of expected $129,568,278.');
    console.error('Check parse logic or PDF section detection. last_synced_at NOT set.');
    process.exit(2);
  }

  console.log('\nVALIDATION PASSED');

  if (dryRun) {
    console.log('\n(dry-run — skipping DB writes)');
    return;
  }

  // ── Data source lookup (composite key — do NOT create new row) ───────────────
  const { data: ds, error: dsErr } = await supabase.schema('treasury').from('data_sources')
    .select('id, last_synced_at')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy2025')
    .eq('dataset_type', 'revenue')
    .maybeSingle();

  if (dsErr) {
    console.error('data_sources lookup error:', dsErr.message);
    process.exit(2);
  }
  if (!ds) {
    console.error('ERROR: No data_source row found for Celina FY2025 revenue (composite key lookup failed).');
    console.error('Expected: municipality_id=' + muniId + ', api_type=pdf_download, dataset_id=fy2025, dataset_type=revenue');
    console.error('Run seedPDFDataSources.js first, or check that the row exists in treasury.data_sources.');
    process.exit(2);
  }
  console.log(`\ndata_source: ${ds.id} (last_synced_at: ${ds.last_synced_at || 'null'})`);

  // ── Update base_url on the data_source row ────────────────────────────────────
  const { error: urlErr } = await supabase.schema('treasury').from('data_sources')
    .update({ base_url: PDF_URL })
    .eq('id', ds.id);
  if (urlErr) {
    console.error('base_url update error:', urlErr.message);
    process.exit(2);
  }

  // ── Clear prior revenue rows ───────────────────────────────────────────────────
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('data_source_id', ds.id)
    .eq('fiscal_year', FISCAL_YEAR);
  if (delErr) {
    console.error('Delete prior rows error:', delErr.message);
    process.exit(2);
  }

  // ── Call treasury_sync_budget_tree RPC ─────────────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    FISCAL_YEAR,
    p_dataset_type:   'revenue',
    p_total:          total,
    p_tree:           jsonTree,
    p_row_count:      rows.length,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)           { console.error('RPC error:', rpcErr.message); process.exit(2); }
  if (rpcResult?.error) { console.error('RPC returned error:', rpcResult.error); process.exit(2); }

  const inserted = rpcResult?.rows_inserted ?? rows.length;
  console.log(`Loaded ${inserted} rows for FY${FISCAL_YEAR} (total $${Math.round(total).toLocaleString()})`);

  // ── Set last_synced_at ─────────────────────────────────────────────────────────
  const { error: syncErr } = await supabase.schema('treasury').from('data_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', ds.id);
  if (syncErr) {
    console.error('last_synced_at update error:', syncErr.message);
    process.exit(2);
  }
  console.log(`last_synced_at set for data_source ${ds.id}`);

  console.log(`\nDone. Celina FY${FISCAL_YEAR} revenue loaded successfully.`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
