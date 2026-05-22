#!/usr/bin/env node
/**
 * Prosper Revenue PDF Extractor
 *
 * Extracts General Fund revenue line items from Prosper ACFR PDFs (FY2023, FY2024, FY2025)
 * using pdftotext — no AI/API calls, pure text parsing.
 *
 * Targets the "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCE — GENERAL FUND —
 * BUDGET AND ACTUAL" section in each ACFR, which provides clean 3-column layout
 * (Original Budget / Final Budget / Actual) with minimal pdftotext alignment artifacts.
 *
 * Avoids the all-funds governmental statement, which splits across two pdftotext page-blocks
 * with no label alignment on the right-column block (per 12-RESEARCH.md Pitfall 1).
 *
 * Validation: extracted General Fund actual total is compared against a hardcoded expected value
 * (±20%). Load is blocked if validation fails.
 *
 * Usage:
 *   node scripts/processProsperjRevenuePDF.js                  # all three FYs
 *   node scripts/processProsperjRevenuePDF.js --fy 2025        # single FY
 *   node scripts/processProsperjRevenuePDF.js --dry-run        # parse + print, no DB writes
 *   node scripts/processProsperjRevenuePDF.js --verbose        # log parse decisions to stderr
 *   node scripts/processProsperjRevenuePDF.js --no-cache       # re-download even if cached
 *   node scripts/processProsperjRevenuePDF.js --pdf /path/f.pdf --fy 2025  # local file override
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Per-FY configuration ───────────────────────────────────────────────────────
// PDF URLs: each FY uses its own ACFR PDF (Phase 9 seeded FY2023/FY2024 with wrong Item/682 URL)
const PDF_URLS = {
  2025: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682',
  2024: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/574',
  2023: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/489',
};

// Cache paths — script downloads here if not present (or if --no-cache)
const CACHE_PATHS = {
  2025: 'C:/tmp/prosper_acfr_fy2025.pdf',
  2024: 'C:/tmp/prosper_acfr_fy2024.pdf',
  2023: 'C:/tmp/prosper_acfr_fy2023.pdf',
};

// Expected General Fund actual totals from each ACFR's Budget-and-Actual statement.
// Source: direct pdftotext inspection of each ACFR (12-01 execution, 2026-05-21).
//   FY2025 "REVENUES ... $ 23,102,540" — General Fund Budget-and-Actual, actual column
//   FY2024 "REVENUES ... $ 20,579,402" — General Fund Budget-and-Actual, actual column
//   FY2023 "REVENUES ... $ 23,634,916" — General Fund Budget-and-Actual, actual column
const EXPECTED_TOTALS = {
  2025: 23_102_540,
  2024: 20_579_402,
  2023: 23_634_916,
};

// 20% tolerance — if extracted sum deviates more than this, validation fails
const TOLERANCE = 0.20;

// ── parseMoney ─────────────────────────────────────────────────────────────────
// Handles negatives in parens, $ signs, commas (standard pattern across all loaders)
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '-') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── downloadPDF ────────────────────────────────────────────────────────────────
async function downloadPDF(url, dest) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/pdf,*/*' },
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText} downloading ${url}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`Downloaded ${url} → ${dest} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

// ── extractPdfText ─────────────────────────────────────────────────────────────
function extractPdfText(pdfPath) {
  const text = execSync(`pdftotext -layout "${pdfPath}" -`, {
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
  });
  // Strip form-feed characters that pdftotext inserts at page boundaries
  return text.split('\n').map(l => l.startsWith('\x0c') ? l.slice(1) : l);
}

// ── findRevenueSection ────────────────────────────────────────────────────────
// Finds the General Fund Budget-and-Actual statement for revenue extraction.
//
// The ACFR contains two STATEMENT OF REVENUES sections:
//   1. All-funds governmental statement (wide, split across page-blocks — DO NOT USE for line items)
//   2. General Fund Budget-and-Actual (3 columns, clean layout — PRIMARY TARGET)
//
// Target anchor (ALL-CAPS):
//   "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCE"
//   followed by "GENERAL FUND" within 5 lines
//   followed by "BUDGET AND ACTUAL" within 10 lines
//
// Returns { idx, revenueTotal } where idx is the line index of the REVENUES header row
// (with the dollar values), and revenueTotal is the actual column value from that header.
// Returns { idx: -1 } if not found.
function findRevenueSection(lines, verbose) {
  for (let i = 0; i < lines.length; i++) {
    // Match the section title (ALL CAPS, Prosper-specific)
    if (!/STATEMENT OF REVENUES, EXPENDITURES/.test(lines[i])) continue;

    // Must be the General Fund version (not all-funds governmental)
    let foundGF = false;
    let foundBA = false;
    let revenuesIdx = -1;

    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const t = lines[j].trim();
      if (/^GENERAL FUND\s*$/.test(t)) foundGF = true;
      if (/^BUDGET AND ACTUAL\s*$/.test(t)) foundBA = true;
      // The REVENUES header row has dollar signs — that's where we start parsing
      if (foundGF && foundBA && /REVENUES/.test(lines[j]) && /\$/.test(lines[j])) {
        revenuesIdx = j;
        break;
      }
    }

    if (foundGF && foundBA && revenuesIdx >= 0) {
      // Extract the actual total from the REVENUES header row (rightmost $ value)
      const revLine = lines[revenuesIdx];
      const allVals = [...revLine.matchAll(/\$\s*([\d,]+)/g)].map(m => parseMoney(m[1]));
      const revenueTotal = allVals.length > 0 ? allVals[allVals.length - 1] : null;
      if (verbose) console.error(`[section-found] Line ${i}: GF Budget-and-Actual, REVENUES row at line ${revenuesIdx}, total=${revenueTotal}`);
      return { idx: revenuesIdx, revenueTotal };
    }
  }
  return { idx: -1, revenueTotal: null };
}

// ── parseRevenueLines ─────────────────────────────────────────────────────────
// Parses revenue line items from the General Fund Budget-and-Actual statement.
//
// Layout in pdftotext -layout output (3-column: Original / Final / Actual):
//
//   REVENUES     $ 23,332,018 $ 23,370,581 $ 23,102,540  ← total header row (skip)
//   Property taxes                                        ← label-only (pendingRow)
//   Sales and use taxes   12,903,535  12,308,897  11,879,599  ← label+values
//   Franchise fees                                        ← label-only (pendingRow)
//   Licenses and permits   3,334,932   3,614,869   3,722,110  ← label+values
//   ...
//   Total revenues    950,000    800,000    719,230       ← stop (continuation artifact)
//   EXPENDITURES                                          ← stop
//
// The "pendingRow" pattern: a label-only line (no values) is a category title whose
// values appear on the NEXT line with values. When we see a label-only line, we store it;
// if the next data line has values, emit a row using the stored label.
//
// revenueTotal: the actual total from the REVENUES header row. Used as an upper cap
//   to reject garbled continuation lines whose values exceed the total (FY2023 artifact).
//
// Returns: array of { label, originalBudget, finalBudget, actual }
function parseRevenueLines(lines, startIdx, revenueTotal, verbose) {
  const rows = [];
  let pendingLabel = null;

  // Regex to find comma-grouped numbers (thousands separators)
  const MONEY_RE = /\(?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d{4,})\s*\)?/g;

  // Extract label (text before first money indicator)
  function getLabel(line) {
    const m = /\$\s*\d|\(\s*\d|\d{1,3}(?:,\d{3})/.exec(line);
    if (!m) return line.trim();
    return line.slice(0, m.index).trim();
  }

  // Extract all money values from a line (right-to-left: [original, final, actual])
  function getValues(line) {
    const matches = [...line.matchAll(MONEY_RE)];
    return matches.map(m => parseMoney(m[0])).filter(v => v !== null);
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // Stop at EXPENDITURES section header
    if (/^EXPENDITURES\b/i.test(t)) {
      if (verbose) console.error(`[stop] Line ${i}: reached EXPENDITURES`);
      break;
    }

    // Stop at Total revenues (not a line item — used for validation reference only)
    if (/^\s*Total revenues\b/i.test(line)) {
      if (verbose) console.error(`[skip-total] Line ${i}: "Total revenues" — not a line item`);
      continue;
    }

    // Stop at Total Revenues (alternate casing)
    if (/^\s*Total Revenues\b/.test(line)) {
      if (verbose) console.error(`[skip-total] Line ${i}: "Total Revenues" — not a line item`);
      continue;
    }

    // Skip blanks, page markers, column headers, section titles
    if (!t) continue;
    if (/^STATEMENT OF|^FOR THE YEAR|^REVENUES\s*$|^Page \d+|GAAP Basis|Original\s*$|Final\s*$|Actual\s*$/i.test(t)) continue;
    if (/^Budget\s*$|^Amounts\s*$/i.test(t)) continue;
    if (/Town of Prosper|TOWN OF PROSPER/i.test(t)) continue;
    // Skip the REVENUES header line (has $ signs and large numbers — it's the section total)
    if (/^REVENUES\b/.test(t) && /\$/.test(line)) continue;

    const label = getLabel(line);
    const values = getValues(line);
    const hasValues = values.length >= 1;

    // Label-only line (no dollar amounts) — could be a pendingRow trigger
    if (!hasValues) {
      if (label && label.length > 1 && !/^\$/.test(label)) {
        // Flush any prior pending (orphaned label with no values)
        if (pendingLabel) {
          if (verbose) console.error(`[skip-no-amount] L${i}: orphaned label "${pendingLabel}" — no values found`);
          pendingLabel = null;
        }
        pendingLabel = label;
        if (verbose) console.error(`[pending] L${i}: "${label}" (awaiting values)`);
      }
      continue;
    }

    // Line has values — determine the label
    let effectiveLabel = label;
    if (!label || label.length < 2) {
      // No label on this line — use pendingLabel if available
      if (pendingLabel) {
        effectiveLabel = pendingLabel;
        pendingLabel = null;
        if (verbose) console.error(`[merged] L${i}: used pending label "${effectiveLabel}" for values`);
      } else {
        if (verbose) console.error(`[skip-no-label] L${i}: values with no label — skipping`);
        continue;
      }
    } else {
      // This line has both label and values
      // If we had a pendingLabel AND this line has its own label+values,
      // the pendingLabel was a standalone category header (emit it separately? No — skip it)
      if (pendingLabel) {
        if (verbose) console.error(`[skip-no-amount] L${i}: pending label "${pendingLabel}" never got values — skipping it`);
        pendingLabel = null;
      }
    }

    // Skip known non-items
    if (/^EXPENDITURES|^OTHER FINANCING|^NET CHANGE|^FUND BALANCE|^Excess|^Total\b/i.test(effectiveLabel)) continue;
    if (/^CHANGE IN FUND|^FUND BALANCES/i.test(effectiveLabel)) break;

    // The three columns are: [original_budget, final_budget, actual]
    // Use last value as actual (rightmost column)
    const actual   = values.length >= 1 ? values[values.length - 1] : null;
    const finalBudget = values.length >= 2 ? values[values.length - 2] : null;
    const originalBudget = values.length >= 3 ? values[values.length - 3] : null;

    if (actual === null || actual === 0) {
      if (verbose) console.error(`[skip-zero] L${i}: "${effectiveLabel}" — actual is null/0`);
      continue;
    }

    // Reject implausibly large values: any individual item should be ≤ the REVENUES total.
    // This catches garbled continuation lines from the all-funds table (e.g. FY2023 Miscellaneous
    // label picks up a $47M Contributions row from the adjacent governmental statement).
    if (revenueTotal && Math.abs(actual) > Math.abs(revenueTotal) * 1.05) {
      if (verbose) console.error(`[skip-overflow] L${i}: "${effectiveLabel}" actual=${actual} exceeds REVENUES total (${revenueTotal}) — garbled line, skipping`);
      continue;
    }

    rows.push({ label: effectiveLabel, originalBudget, finalBudget, actual });
    if (verbose) console.error(`[row] L${i}: "${effectiveLabel}" orig=${originalBudget} final=${finalBudget} actual=${actual}`);
  }

  return rows;
}

// ── buildTree ─────────────────────────────────────────────────────────────────
// Builds the JSON tree for the treasury_sync_budget_tree RPC.
// Revenue rows are structured under "General Fund Revenue" department.
// Format mirrors processRevenuePDF.js buildTree().
function buildTree(rows) {
  const tree = new Map();
  let total = 0;

  for (const row of rows) {
    const approved = Number(row.originalBudget) || 0;
    const actual   = row.actual != null ? Number(row.actual) : null;

    if (approved === 0 && (actual === null || actual === 0)) continue;

    const dept = 'General Fund Revenue';
    const cat  = row.label || 'Revenue';

    if (!tree.has(dept)) tree.set(dept, new Map());
    if (!tree.get(dept).has(cat)) tree.get(dept).set(cat, []);
    tree.get(dept).get(cat).push({
      d: cat,
      a: approved,
      aa: actual,
      f: 'General Fund',
      e: null,
    });
    total += approved;
  }

  const jsonTree = [];
  for (const [deptName, cats] of tree) {
    let deptTotal = 0;
    const children = [];
    for (const [catName, items] of cats) {
      const catTotal = items.reduce((s, item) => s + item.a, 0);
      deptTotal += catTotal;
      children.push({ n: catName, a: catTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: deptName, a: deptTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);

  return { jsonTree, total };
}

// ── validateTotal ─────────────────────────────────────────────────────────────
// Compares the sum of extracted actual values against the hardcoded expected total.
// Returns true if within TOLERANCE, false otherwise.
// If expected is null, validation is skipped (with a warning) and returns true.
function validateTotal(extractedActual, expected, fyLabel) {
  console.log(`\n  Validation (${fyLabel}):`);
  console.log(`    Extracted actual total: $${Math.round(extractedActual).toLocaleString()}`);

  if (expected == null) {
    console.warn(`    WARNING: No expected total for ${fyLabel} — skipping validation, proceeding with load`);
    return true;
  }

  console.log(`    Expected total:         $${Math.round(expected).toLocaleString()}`);
  const diff = Math.abs(extractedActual - expected) / expected;
  const pct  = (diff * 100).toFixed(1);
  console.log(`    Difference:             ${pct}% (tolerance: ${(TOLERANCE * 100).toFixed(0)}%)`);

  if (diff <= TOLERANCE) {
    console.log(`    Result:                 PASS`);
    return true;
  } else {
    console.log(`    Result:                 FAIL (exceeds ${(TOLERANCE * 100).toFixed(0)}% tolerance)`);
    return false;
  }
}

// ── processFY ────────────────────────────────────────────────────────────────
// Orchestrates the full extract → validate → load pipeline for one fiscal year.
// Returns { fy, passed, total, rowCount, dsId }
async function processFY(supabase, muniId, fiscalYear, opts) {
  const { dryRun, verbose, noCache, pdfOverride } = opts;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Processing Prosper FY${fiscalYear}`);
  console.log('─'.repeat(70));

  // ── Step 1: Resolve PDF path ──────────────────────────────────────────────
  let pdfPath;
  if (pdfOverride) {
    pdfPath = pdfOverride;
    console.log(`Using PDF override: ${pdfPath}`);
  } else {
    pdfPath = CACHE_PATHS[fiscalYear];
    const cacheExists = fs.existsSync(pdfPath);
    if (!cacheExists || noCache) {
      const url = PDF_URLS[fiscalYear];
      if (!url) {
        console.error(`No PDF URL configured for FY${fiscalYear} — skipping`);
        return { fy: fiscalYear, passed: false, total: 0, rowCount: 0, dsId: null };
      }
      console.log(`Downloading FY${fiscalYear} PDF...`);
      try {
        // Ensure cache directory exists
        const dir = path.dirname(pdfPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await downloadPDF(url, pdfPath);
      } catch (e) {
        console.error(`Download failed for FY${fiscalYear}: ${e.message}`);
        return { fy: fiscalYear, passed: false, total: 0, rowCount: 0, dsId: null };
      }
    } else {
      console.log(`Using cached PDF: ${pdfPath}`);
    }
  }

  // ── Step 2: Extract text ──────────────────────────────────────────────────
  console.log('Running pdftotext...');
  let lines;
  try {
    lines = extractPdfText(pdfPath);
  } catch (e) {
    console.error(`pdftotext failed for FY${fiscalYear}: ${e.message.slice(0, 200)}`);
    return { fy: fiscalYear, passed: false, total: 0, rowCount: 0, dsId: null };
  }
  console.log(`  Lines extracted: ${lines.length}`);

  // ── Step 3: Find revenue section ──────────────────────────────────────────
  const { idx: sectionIdx, revenueTotal: headerTotal } = findRevenueSection(lines, verbose);
  if (sectionIdx < 0) {
    console.error(`Section not found for FY${fiscalYear} — could not locate GF Budget-and-Actual REVENUES row`);
    // Print context around likely section for debugging
    const ctxStart = lines.findIndex(l => /STATEMENT OF REVENUES, EXPENDITURES/.test(l));
    if (ctxStart >= 0) {
      console.error(`  Context around line ${ctxStart}:`);
      lines.slice(ctxStart, Math.min(ctxStart + 20, lines.length)).forEach((l, i) => {
        console.error(`  L${ctxStart + i}: ${l}`);
      });
    }
    return { fy: fiscalYear, passed: false, total: 0, rowCount: 0, dsId: null };
  }
  console.log(`  Revenue section found at line ${sectionIdx}, header total=$${headerTotal?.toLocaleString() ?? '?'}`);

  // ── Step 4: Parse revenue lines ───────────────────────────────────────────
  const rows = parseRevenueLines(lines, sectionIdx + 1, headerTotal, verbose);
  console.log(`  Revenue rows parsed: ${rows.length}`);

  if (rows.length === 0) {
    console.error(`No revenue rows extracted for FY${fiscalYear}`);
    return { fy: fiscalYear, passed: false, total: 0, rowCount: 0, dsId: null };
  }

  // Print parsed rows
  console.log('\n  Line items:');
  console.log('  ' + '─'.repeat(60));
  for (const row of rows) {
    const origStr   = row.originalBudget != null ? `$${Math.round(row.originalBudget).toLocaleString()}` : '—';
    const actualStr = row.actual != null ? `$${Math.round(row.actual).toLocaleString()}` : '—';
    console.log(`  ${row.label.padEnd(38)} orig: ${origStr.padStart(12)}   actual: ${actualStr.padStart(12)}`);
  }
  console.log('  ' + '─'.repeat(60));

  // ── Step 5: Validate ──────────────────────────────────────────────────────
  // Use original budget total for the approved_amount in the tree,
  // and actual total for the validation check.
  const actualTotal = rows.reduce((s, r) => s + (r.actual || 0), 0);
  const origTotal   = rows.reduce((s, r) => s + (r.originalBudget || 0), 0);
  const expected    = EXPECTED_TOTALS[fiscalYear] ?? null;

  const valid = validateTotal(actualTotal, expected, `Prosper FY${fiscalYear}`);
  if (!valid) {
    console.error(`  VALIDATION FAILED — skipping load for FY${fiscalYear}. Data NOT written to DB.`);
    return { fy: fiscalYear, passed: false, total: origTotal, rowCount: rows.length, dsId: null };
  }

  // ── Step 6: Build JSON tree ───────────────────────────────────────────────
  const { jsonTree, total } = buildTree(rows);
  console.log(`\n  Tree built: ${jsonTree.length} dept(s), ${rows.length} items, total=$${Math.round(total).toLocaleString()}`);

  if (dryRun) {
    console.log('  (dry-run — skipping DB writes)');
    return { fy: fiscalYear, passed: true, total, rowCount: rows.length, dsId: 'dry-run' };
  }

  // ── Step 7: Look up existing data_source row ──────────────────────────────
  // Phase 9 seeder created these rows — do NOT create new ones
  const { data: ds, error: dsErr } = await supabase.schema('treasury').from('data_sources')
    .select('id, last_synced_at')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy' + fiscalYear)
    .eq('dataset_type', 'revenue')
    .maybeSingle();

  if (dsErr) {
    console.error(`data_sources lookup error for FY${fiscalYear}: ${dsErr.message}`);
    return { fy: fiscalYear, passed: false, total, rowCount: rows.length, dsId: null };
  }
  if (!ds?.id) {
    console.error(`data_source row not found for Prosper revenue FY${fiscalYear} — Phase 9 seeder must have run first`);
    return { fy: fiscalYear, passed: false, total, rowCount: rows.length, dsId: null };
  }
  console.log(`  data_source: ${ds.id}`);

  // ── Step 8: Update base_url (fix Phase 9 seeded wrong URLs for FY2023/FY2024) ─
  const correctUrl = PDF_URLS[fiscalYear];
  const { error: urlErr } = await supabase.schema('treasury').from('data_sources')
    .update({ base_url: correctUrl })
    .eq('id', ds.id);
  if (urlErr) {
    console.warn(`  WARNING: Could not update base_url for FY${fiscalYear}: ${urlErr.message}`);
  } else {
    console.log(`  base_url updated to: ${correctUrl}`);
  }

  // ── Step 9: Clear prior rows (idempotency) ────────────────────────────────
  const { error: delErr1 } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  const { error: delErr2 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muniId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', 'revenue')
    .is('data_source_id', null);

  if (delErr1) throw new Error(`Delete (by data_source_id) failed: ${delErr1.message}`);
  if (delErr2) throw new Error(`Delete (orphaned revenue rows) failed: ${delErr2.message}`);
  console.log('  Prior revenue rows cleared');

  // ── Step 10: Call treasury_sync_budget_tree RPC ───────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'revenue',
    p_total:          total,
    p_tree:           jsonTree,
    p_row_count:      rows.length,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr) throw new Error(`RPC error for FY${fiscalYear}: ${rpcErr.message}`);
  if (rpcResult?.error) throw new Error(`RPC returned error for FY${fiscalYear}: ${rpcResult.error}`);

  const inserted = rpcResult?.rows_inserted ?? rows.length;
  console.log(`  Loaded ${inserted} rows for FY${fiscalYear}`);

  // ── Step 11: Set last_synced_at ────────────────────────────────────────────
  const { error: syncErr } = await supabase.schema('treasury').from('data_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', ds.id);
  if (syncErr) throw new Error(`last_synced_at update failed: ${syncErr.message}`);
  console.log(`  last_synced_at set for data_source ${ds.id}`);

  return { fy: fiscalYear, passed: true, total, rowCount: rows.length, dsId: ds.id };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run':  { type: 'boolean', default: false },
      'verbose':  { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
      'pdf':      { type: 'string'  },  // override PDF path (requires --fy)
      'fy':       { type: 'string'  },  // process only this year (e.g. --fy 2025)
    },
    strict: false,
  });

  const dryRun    = opts['dry-run'];
  const verbose   = opts['verbose'];
  const noCache   = opts['no-cache'];
  const pdfOverride = opts['pdf'];
  const fyFilter  = opts['fy'] ? parseInt(opts['fy'], 10) : null;

  if (pdfOverride && !fyFilter) {
    console.error('--pdf requires --fy (specify which fiscal year this PDF is for)');
    process.exit(2);
  }

  // ── Supabase client ────────────────────────────────────────────────────────
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Municipality lookup ───────────────────────────────────────────────────
  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Prosper').single();
  if (muniErr || !muni) {
    console.error('Could not find Prosper municipality:', muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id})`);

  // ── Determine which FYs to process ────────────────────────────────────────
  const allFYs = [2023, 2024, 2025];
  const targetFYs = fyFilter ? [fyFilter] : allFYs;

  for (const fy of targetFYs) {
    if (!PDF_URLS[fy]) {
      console.error(`FY${fy} is not configured in this script`);
      process.exit(2);
    }
  }

  // ── Process each FY independently ─────────────────────────────────────────
  const results = [];
  for (const fy of targetFYs) {
    try {
      const result = await processFY(supabase, muni.id, fy, {
        dryRun,
        verbose,
        noCache,
        pdfOverride: fyFilter === fy ? pdfOverride : undefined,
      });
      results.push(result);
    } catch (e) {
      console.error(`\nFatal error processing FY${fy}: ${e.message}`);
      results.push({ fy, passed: false, total: 0, rowCount: 0, dsId: null });
      // Continue to next FY
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log('FY    Status   Total (orig budget)   Row count   data_source_id');
  console.log('─'.repeat(70));
  for (const r of results) {
    const status   = r.passed ? 'PASS' : 'FAIL';
    const totalStr = r.total ? `$${Math.round(r.total).toLocaleString()}` : '—';
    const dsStr    = r.dsId || '—';
    console.log(`${r.fy}  ${status.padEnd(7)}  ${totalStr.padStart(18)}   ${String(r.rowCount).padStart(9)}   ${dsStr}`);
  }
  console.log('─'.repeat(70));

  const allPassed = results.every(r => r.passed);
  const anyPassed = results.some(r => r.passed);
  if (allPassed) {
    console.log('\nAll fiscal years passed validation and loaded successfully.');
  } else if (anyPassed) {
    const failed = results.filter(r => !r.passed).map(r => `FY${r.fy}`).join(', ');
    console.log(`\nPartial success — ${failed} failed validation or load. See output above.`);
  } else {
    console.error('\nAll fiscal years failed. No data was written to the database.');
    process.exit(2);
  }

  if (dryRun) {
    console.log('(dry-run mode — no data was written to the database)');
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(2);
});
