#!/usr/bin/env node
/**
 * Revenue PDF Extractor — McKinney, Allen, Frisco
 *
 * Extracts General Fund revenue data from operating budget PDFs using
 * pdftotext + regex. No AI/Haiku API calls.
 *
 * Handles two PDF formats:
 *   "mckinney" — "STATEMENT OF GENERAL FUND REVENUES" (McKinney, Allen FY<=2025)
 *                Columns: Actual FY-2 | Actual FY-1 | Orig Budget | EOY Estimate | Adopted Budget
 *   "frisco"   — "GENERAL FUND SCHEDULE OF REVENUES" (Frisco, Allen FY2026)
 *                Columns: Actual FY-2 | Actual FY-1 | Orig Budget | Revised | Adopted Budget
 *
 * Usage:
 *   node scripts/processRevenuePDF.js                        # all cities/years
 *   node scripts/processRevenuePDF.js --city McKinney        # one city
 *   node scripts/processRevenuePDF.js --city McKinney --fy 2025
 *   node scripts/processRevenuePDF.js --dry-run
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TMP = process.env.TEMP || process.env.TMP || 'C:/tmp';

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PDF source catalogue ──────────────────────────────────────────────────────
// Each entry: { city, fiscalYear, url, format }
// format: 'mckinney' = Statement of GF Revenues; 'frisco' = GF Schedule of Revenues
const SOURCES = [
  // McKinney — FY2021-FY2025 budget PDFs, consistent "Statement of GF Revenues" format
  { city: 'McKinney', fy: 2021, url: 'https://www.mckinneytexas.org/ArchiveCenter/ViewFile/Item/2255', format: 'mckinney' },
  { city: 'McKinney', fy: 2022, url: 'https://www.mckinneytexas.org/ArchiveCenter/ViewFile/Item/2458', format: 'mckinney' },
  { city: 'McKinney', fy: 2023, url: 'https://www.mckinneytexas.org/ArchiveCenter/ViewFile/Item/2545', format: 'mckinney' },
  { city: 'McKinney', fy: 2024, url: 'https://www.mckinneytexas.org/ArchiveCenter/ViewFile/Item/2636', format: 'mckinney' },
  { city: 'McKinney', fy: 2025, url: 'https://www.mckinneytexas.org/ArchiveCenter/ViewFile/Item/2716', format: 'mckinney' },
  // Allen — FY2026 adopted budget PDF contains Actual FY23+FY24 and Budget FY25+FY26
  // We load FY2026 (Adopted) with FY24 actuals as actual_amount
  { city: 'Allen', fy: 2026, url: 'https://cms3.revize.com/revize/allentx/Documents/Departments/Finance/Financial%20Transparency/Budget/Adopted%20Budget/FY%202025-2026%20City%20of%20Allen%20Annual%20Budget.pdf', format: 'allen' },
  // Frisco — FY2026 adopted budget PDF contains Actual FY23+FY24 and Budget FY25+FY26
  { city: 'Frisco', fy: 2026, url: 'https://www.friscotexas.gov/DocumentCenter/View/39479/Budget-Fiscal-Year-26-PDF', format: 'frisco' },
];

// ── Money parser ──────────────────────────────────────────────────────────────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim().replace(/\s/g, '');
  if (!t || t === '-' || t === '--') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── Download a URL to a temp file ─────────────────────────────────────────────
async function downloadPDF(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/pdf,*/*' },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' downloading ' + url);
  await pipeline(res.body, createWriteStream(dest));
}

// ── Detect column layout ──────────────────────────────────────────────────────
function detectColumns(headerLines) {
  let typeLine = null, yearLine = null;
  for (const line of headerLines) {
    if (!typeLine && (/\bActual\b/.test(line)) && (/\bBudget\b|\bAdopted\b/.test(line))) typeLine = line;
    if (!yearLine) {
      const matches = line.match(/FY\s*\d{2,4}(?:-\d{2,4})?/g);
      if (matches && matches.length >= 2) yearLine = line;
    }
    if (typeLine && yearLine) break;
  }
  if (!yearLine) return null;

  const yearRe = /FY\s*\d{2,4}(?:-\d{2,4})?/g;
  const years = [];
  let m;
  while ((m = yearRe.exec(yearLine)) !== null) years.push({ str: m[0], pos: m.index });
  if (years.length < 3) return null;

  const colPositions = years.map(y => y.pos);

  // Parse fiscal year numbers from year strings (e.g. "FY 24-25" -> 2025, "FY 22-23" -> 2023)
  function parseYearStr(s) {
    const digits = s.replace(/FY\s*/i, '');
    if (digits.includes('-')) {
      const parts = digits.split('-');
      const prefix = parseInt(parts[0], 10);
      const suffix = parseInt(parts[1], 10);
      if (prefix < 100) {
        const base = prefix >= 90 ? 1900 : 2000;
        return base + suffix;
      }
      return prefix * 100 + suffix; // e.g. 2024 from "2024-2025" typo
    }
    const n = parseInt(digits, 10);
    return n < 100 ? (n >= 90 ? 1900 + n : 2000 + n) : n;
  }

  const fyNums = years.map(y => parseYearStr(y.str));

  // Identify column types by proximity to type header words
  const TYPE_WORDS = ['Revised', 'EOY', 'End-of-Year', 'Estimate', 'Original', 'Adopted', 'Actual'];
  const colTypes = colPositions.map(pos => {
    if (!typeLine) return 'Actual';
    let best = 'Actual', bestDist = Infinity;
    for (const word of TYPE_WORDS) {
      const re = new RegExp('\\b' + word + '\\b', 'g');
      let wm;
      while ((wm = re.exec(typeLine)) !== null) {
        const d = Math.abs(wm.index - pos);
        if (d < bestDist) { bestDist = d; best = word; }
      }
    }
    return best;
  });

  // We want: adopted budget col (rightmost "Adopted" or last "Budget") and
  // its preceding EOY/Revised col as actual_amount
  let adoptedIdx = colTypes.lastIndexOf('Adopted');
  if (adoptedIdx < 0) adoptedIdx = colTypes.length - 1; // fallback: last col

  // EOY/Revised is the column just before adopted
  const eoyIdx = adoptedIdx - 1;

  return { colPositions, colTypes, fyNums, adoptedIdx, eoyIdx, colCount: years.length };
}

// ── Extract values from a line ────────────────────────────────────────────────
function extractValues(line, colInfo) {
  const { colPositions } = colInfo;
  const dataStart = colPositions[0] - 2;
  const dataEnd   = colPositions[colPositions.length - 1] + 22;
  const result    = new Array(colPositions.length).fill(null);

  // Midpoint-based zone assignment
  const zones = colPositions.map((lo, i) => ({
    lo: i === 0 ? lo - 2 : Math.round((colPositions[i - 1] + lo) / 2),
    hi: i + 1 < colPositions.length ? Math.round((lo + colPositions[i + 1]) / 2) : lo + 22,
  }));

  const numRe = /\(?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\s*\)?/g;
  let nm;
  while ((nm = numRe.exec(line)) !== null) {
    const pos = nm.index;
    if (pos < dataStart || pos >= dataEnd) continue;
    for (let i = 0; i < colPositions.length; i++) {
      if (pos >= zones[i].lo && pos < zones[i].hi) {
        if (result[i] === null) result[i] = parseMoney(nm[0]);
        break;
      }
    }
  }
  return result;
}

// ── McKinney format parser ────────────────────────────────────────────────────
// "STATEMENT OF GENERAL FUND REVENUES"
// McKinney spreads column headers across 3 lines so we detect column positions
// from the first full data row (4+ comma-grouped numbers) instead.
// Some categories (Franchise Fees) have actuals on one line and budget values on
// a blank-label continuation line — handled via a pendingRow pattern.
function parseMcKinneyFormat(lines) {
  // Find section (not TOC entry)
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('STATEMENT OF GENERAL FUND REVENUES')) continue;
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      if (/FY\s*\d{2}/.test(lines[j])) { start = i; break; }
    }
    if (start >= 0) break;
  }
  if (start < 0) return null;

  // Collect section lines — stop before Transfers section or expenditures
  const sectionLines = [];
  for (let i = start; i < lines.length && sectionLines.length < 250; i++) {
    const t = lines[i].trim();
    if (sectionLines.length > 5 && (
      /^STATEMENT OF GENERAL FUND EXPENDITURES/.test(t) ||
      /^OVERVIEW OF GENERAL FUND/.test(t) ||
      /^Total Revenues and Transfers/.test(t) ||
      /^Transfers\b/.test(t)
    )) break;
    sectionLines.push(lines[i]);
  }

  // Detect column positions from first data row with 4+ comma-grouped numbers
  const commaNumRe = /\d{1,3}(?:,\d{3})+/g;
  let colPositions = null;
  for (const line of sectionLines.slice(3, 50)) {
    const matches = [...line.matchAll(commaNumRe)];
    if (matches.length >= 4) {
      colPositions = matches.map(m => m.index);
      break;
    }
  }
  if (!colPositions) return null;

  // McKinney layout: [Actual FY-2, Actual FY-1, Orig Budget, EOY Estimate, Adopted Budget]
  // (% change column at end does not have comma-grouped numbers so it's excluded)
  const adoptedIdx = colPositions.length - 1;
  const eoyIdx     = colPositions.length - 2;

  // Midpoint-based zones for value assignment
  const zones = colPositions.map((lo, i) => ({
    lo: i === 0 ? 0 : Math.round((colPositions[i - 1] + lo) / 2),
    hi: i + 1 < colPositions.length
      ? Math.round((lo + colPositions[i + 1]) / 2)
      : lo + 20,
  }));

  function extractCommaValues(line) {
    const values = new Array(colPositions.length).fill(null);
    for (const m of line.matchAll(/\(?\$? ?\d{1,3}(?:,\d{3})+\s*\)?/g)) {
      const pos = m.index;
      for (let i = 0; i < zones.length; i++) {
        if (pos >= zones[i].lo && pos < zones[i].hi && values[i] === null) {
          values[i] = parseMoney(m[0]);
          break;
        }
      }
    }
    return values;
  }

  // Label = everything before the first number indicator (dollar sign, paren, or comma-grouped digit)
  // Also strip trailing percentage/numeric noise (e.g. "  -1.5%")
  function getLabel(line) {
    const m = /\$\s*\d|\(\s*\d|\d{1,3}(?:,\d{3})+/.exec(line);
    return line.slice(0, m ? m.index : line.length)
      .replace(/\s+[-\d.]+%?\s*$/, '').trim();
  }

  // Get fiscal year: max "FY XX-YY" year seen in the first 15 header lines
  let adoptedFY = null;
  for (const line of sectionLines.slice(0, 15)) {
    for (const m of line.matchAll(/FY\s*\d{2}-(\d{2})/g)) {
      const suffix = parseInt(m[1], 10);
      const fy = suffix < 50 ? 2000 + suffix : 1900 + suffix;
      if (!adoptedFY || fy > adoptedFY) adoptedFY = fy;
    }
  }

  // Categories with sub-items: capture sub-items instead of the category total
  const TOP_CATS = new Set(['Taxes', 'Licenses & Permits', 'Charges and Fines', 'Other Revenues']);
  const SKIP_RE  = /^Total\b|^TOTAL\b|^BEGINNING\b|^REVENUES$/;

  let currentDept = 'General Fund Revenue';
  const rows = [];
  let pendingRow = null;

  function flushPending() {
    if (!pendingRow) return;
    const adopted = pendingRow.values[adoptedIdx] ?? null;
    const actual  = pendingRow.values[eoyIdx]     ?? null;
    if ((adopted !== null || actual !== null) && !(adopted === 0 && actual === 0)) {
      rows.push({
        department:      pendingRow.dept,
        category:        pendingRow.cat,
        approved_amount: adopted,
        actual_amount:   actual,
        fund: 'General Fund',
      });
    }
    pendingRow = null;
  }

  for (const line of sectionLines) {
    const t = line.trim();
    if (!t) continue;
    if (/^STATEMENT OF|City of McKinney|Annual Budget|^Page \d+|Return to Top/.test(t)) continue;
    if (/\bActual\b|\bBudget\b|\bAdopted\b|\bEstimate\b/.test(t) && !/\d{5,}/.test(t)) continue;
    if (/^FY\s*\d{2}/.test(t) && !/\d{5,}/.test(t)) continue;
    if (/% of Chg|EOY\s*\//i.test(t)) continue;

    const values  = extractCommaValues(line);
    const hasData = values.some(v => v !== null);
    const label   = getLabel(line);
    const isSubItem = /^[ \t]{4}/.test(line);

    // Blank-label continuation: merge into pending row
    if (!label && hasData) {
      if (pendingRow) {
            for (let i = 0; i < values.length; i++) {
          if (values[i] !== null && pendingRow.values[i] === null)
            pendingRow.values[i] = values[i];
        }
      }
      continue;
    }

    flushPending();

    if (!label) continue;
    if (SKIP_RE.test(label)) continue;
    if (/^FY\s*\d{2}/.test(label)) continue;

    // Non-indented labels update department
    if (!isSubItem) currentDept = label;

    if (!hasData) continue;

    // Category totals (sub-items carry the real detail)
    if (TOP_CATS.has(label) && !isSubItem) continue;

    pendingRow = { dept: currentDept, cat: label, values };
  }
  flushPending();

  return { rows, fiscalYear: adoptedFY, colInfo: { colCount: colPositions.length, adoptedIdx, eoyIdx } };
}

// ── Frisco format parser ──────────────────────────────────────────────────────
// "GENERAL FUND SCHEDULE OF REVENUES"
// Columns: Actual FY-2 | Actual FY-1 | Orig Budget | Revised | Adopted Budget
//
// Frisco uses deeply-indented (>10 spaces) subtotal lines for each category:
//   "           Ad Valorem Tax  114,380,038 ... 151,126,852"
//   "                     Other Taxes  2,505,743 ... 2,871,214"
//   "                                      83,987,442 ... 92,482,247"  ← continuation
// We ONLY capture those deeply-indented TOP_CAT subtotal lines.
// The continuation overwrite (not null-guard) is needed because Frisco puts the
// real adopted total on the second line, not the first.
function parseFriscoFormat(lines) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('GENERAL FUND SCHEDULE OF REVENUES')) continue;
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      if (/FY\s*\d{2}/.test(lines[j])) { start = i; break; }
    }
    if (start >= 0) break;
  }
  if (start < 0) return null;

  const sectionLines = [];
  for (let i = start; i < lines.length && sectionLines.length < 200; i++) {
    const t = lines[i].trim();
    if (sectionLines.length > 5 && (
      /^GENERAL FUND SUMMARY EXPENDITURE/.test(t) ||
      /^EXPENDITURES\b/.test(t)
    )) break;
    sectionLines.push(lines[i]);
  }

  // Detect column positions from first data row with 4+ comma-grouped numbers
  const commaNumRe = /\d{1,3}(?:,\d{3})+/g;
  let colPositions = null;
  for (const line of sectionLines.slice(3, 50)) {
    const matches = [...line.matchAll(commaNumRe)];
    if (matches.length >= 4) {
      colPositions = matches.map(m => m.index);
      break;
    }
  }
  if (!colPositions) return null;

  const adoptedIdx = colPositions.length - 1;
  const eoyIdx     = colPositions.length - 2;

  function getLabel(line) {
    const m = /\$\s*\d|\(\s*\d|\d{1,3}(?:,\d{3})+/.exec(line);
    return line.slice(0, m ? m.index : line.length)
      .replace(/\s+[-\d.]+%?\s*$/, '').trim();
  }

  // Frisco subtotals use compact spacing that breaks zone-midpoint assignment.
  // We only need adoptedIdx (last value) and eoyIdx (second-to-last value).
  function extractLastNValues(line) {
    const all = [...line.matchAll(/\(?\$? ?\d{1,3}(?:,\d{3})+\s*\)?/g)].map(m => parseMoney(m[0]));
    const result = new Array(colPositions.length).fill(null);
    if (all.length >= 1) result[adoptedIdx] = all[all.length - 1];
    if (all.length >= 2) result[eoyIdx]     = all[all.length - 2];
    return result;
  }

  let adoptedFY = null;
  for (const line of sectionLines.slice(0, 15)) {
    for (const m of line.matchAll(/FY\s*(\d{2})/g)) {
      const suffix = parseInt(m[1], 10);
      const fy = suffix < 50 ? 2000 + suffix : 1900 + suffix;
      if (!adoptedFY || fy > adoptedFY) adoptedFY = fy;
    }
  }

  const TOP_CATS = new Set(['Ad Valorem Tax', 'Other Taxes', 'Permits/Licenses', 'Fees', 'Other']);

  const rows = [];
  let pendingRow = null;
  // Frisco layout: some subtotals have the adopted/EOY columns on a blank-label line
  // BEFORE the label line (e.g. Fees: blank line has cols[3,4], label line has cols[0,1,2]).
  // We buffer those orphan blank-line values and merge when the deep-indent TOP_CAT label arrives.
  let blankLineBuffer = null;

  function flushPending() {
    if (!pendingRow) return;
    const adopted = pendingRow.values[adoptedIdx] ?? null;
    const actual  = pendingRow.values[eoyIdx]     ?? null;
    if ((adopted !== null || actual !== null) && !(adopted === 0 && actual === 0)) {
      rows.push({
        department:      'General Fund Revenue',
        category:        pendingRow.cat,
        approved_amount: adopted,
        actual_amount:   actual,
        fund: 'General Fund',
      });
    }
    pendingRow = null;
  }

  for (const line of sectionLines) {
    const t = line.trim();
    if (!t) continue;
    if (/^GENERAL FUND SCHEDULE OF REVENUES|City of Frisco|Annual Budget|^Page \d+|Return to Top|CITY OF/.test(t)) continue;
    if (/\bActual\b|\bBudget\b|\bAdopted\b|\bRevised\b|\bOriginal\b/.test(t) && !/\d{5,}/.test(t)) continue;
    if (/^FY\s*\d{2}/.test(t) && !/\d{5,}/.test(t)) continue;

    const values  = extractLastNValues(line);
    const hasData = values.some(v => v !== null);
    const label   = getLabel(line);

    if (!label && hasData) {
      if (pendingRow) {
        // Continuation after label: OVERWRITE (e.g. Other Taxes — line 2 has real totals)
        for (let i = 0; i < values.length; i++) {
          if (values[i] !== null) pendingRow.values[i] = values[i];
        }
      } else {
        // Blank-label before label: buffer for look-ahead merge (e.g. Fees — adopted cols before label)
        blankLineBuffer = values;
      }
      continue;
    }

    // Labeled line — capture buffer before resetting, then flush prior pending
    const buffered = blankLineBuffer;
    blankLineBuffer = null;
    flushPending();

    if (!label) continue;
    if (/^Total\b/.test(label)) break;

    const isDeepIndent = /^ {10,}/.test(line);

    // Only capture deeply-indented TOP_CAT lines (the authoritative subtotals)
    if (!isDeepIndent || !TOP_CATS.has(label)) continue;

    pendingRow = { cat: label, values };
    // Merge look-ahead buffer with OVERWRITE priority — the buffer holds the real
    // adopted/EOY totals when those columns appear on the blank line before the label.
    if (buffered) {
      for (let i = 0; i < buffered.length; i++) {
        if (buffered[i] !== null) pendingRow.values[i] = buffered[i];
      }
    }
  }
  flushPending();

  return { rows, fiscalYear: adoptedFY, colInfo: { colCount: colPositions.length, adoptedIdx, eoyIdx } };
}

// ── Allen format parser ───────────────────────────────────────────────────────
// "REVENUE - DETAIL"
// Columns: 2023-2024 ACTUAL | 2024-2025 ORIGINAL | 2024-2025 AMENDED | 2025-2026 BUDGET
// ALL_CAPS no-data labels are category/dept headers.
// Subtotal lines contain "SUBTOTAL" and are skipped.
// Items use ~14-space indent.
function parseAllenFormat(lines) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('REVENUE - DETAIL')) continue;
    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
      // Allen uses ACTUAL/ORIGINAL/AMENDED/BUDGET headers on the same or nearby line
      if (/\b(ACTUAL|ORIGINAL|BUDGET)\b/.test(lines[j])) { start = i; break; }
    }
    if (start >= 0) break;
  }
  if (start < 0) return null;

  const sectionLines = [];
  for (let i = start; i < lines.length && sectionLines.length < 300; i++) {
    const t = lines[i].trim();
    if (sectionLines.length > 10 && (
      /^EXPENDITURE\s*-\s*DETAIL/.test(t) ||
      /^TOTAL REVENUES\b/.test(t) ||
      /^Total Revenues\b/.test(t) ||
      /^TOTAL OPERATING REVENUE\b/.test(t)
    )) break;
    sectionLines.push(lines[i]);
  }

  // Count columns from first row with 4 comma-grouped numbers (for colInfo display only)
  const commaNumRe = /\d{1,3}(?:,\d{3})+/g;
  let colCount = 4;
  for (const line of sectionLines.slice(3, 60)) {
    const matches = [...line.matchAll(commaNumRe)];
    if (matches.length >= 4) { colCount = matches.length; break; }
  }

  const adoptedIdx = colCount - 1;
  const eoyIdx     = colCount - 2;

  function getLabel(line) {
    const m = /\$\s*\d|\(\s*\d|\d{1,3}(?:,\d{3})+/.exec(line);
    return line.slice(0, m ? m.index : line.length)
      .replace(/\s+[-\d.]+%?\s*$/, '').trim();
  }

  // Allen items span two page sections with different column positions.
  // We always take last value = adopted, second-to-last = EOY — simpler and correct.
  function extractLastNValues(line) {
    const all = [...line.matchAll(/\(?\$? ?\d{1,3}(?:,\d{3})+\s*\)?/g)].map(m => parseMoney(m[0]));
    const result = new Array(colCount).fill(null);
    if (all.length >= 1) result[adoptedIdx] = all[all.length - 1];
    if (all.length >= 2) result[eoyIdx]     = all[all.length - 2];
    return result;
  }

  // Adopted fiscal year: look for 4-digit year pattern in header area
  let adoptedFY = null;
  for (const line of sectionLines.slice(0, 5)) {
    for (const m of line.matchAll(/(\d{4})-\d{4}/g)) {
      const fy = parseInt(m[1], 10) + 1;
      if (!adoptedFY || fy > adoptedFY) adoptedFY = fy;
    }
  }
  // Allen header uses "ACTUAL/ORIGINAL/AMENDED/BUDGET" without year numbers —
  // adoptedFY will be null; main() falls back to src.fy

  // SUBTOTAL (anywhere in label) and TOTAL REVENUES are skipped
  const SKIP_RE = /SUBTOTAL|^TOTAL\b|^REVENUES$/i;

  let currentDept = 'General Fund Revenue';
  const rows = [];
  let pendingRow = null;

  function flushPending() {
    if (!pendingRow) return;
    const adopted = pendingRow.values[adoptedIdx] ?? null;
    const actual  = pendingRow.values[eoyIdx]     ?? null;
    if ((adopted !== null || actual !== null) && !(adopted === 0 && actual === 0)) {
      rows.push({
        department:      pendingRow.dept,
        category:        pendingRow.cat,
        approved_amount: adopted,
        actual_amount:   actual,
        fund: 'General Fund',
      });
    }
    pendingRow = null;
  }

  for (const line of sectionLines) {
    const t = line.trim();
    if (!t) continue;
    // Skip page headers, section labels, and year-range header lines
    if (/^REVENUE\s*-\s*DETAIL|CITY OF ALLEN|Annual BUDGET|^Page \d+|Return to Top/.test(t)) continue;
    if (/^REVENUE$|^GENERAL FUND$/.test(t)) continue;
    if (/\d{4}-\d{4}/.test(t) && !/\d{6,}/.test(t)) continue;
    if (/\bACTUAL\b|\bBUDGET\b|\bAMENDED\b|\bORIGINAL\b/.test(t) && !/\d{5,}/.test(t)) continue;
    if (/^\d+\s/.test(t)) continue;  // page-number lines like "46  CITY OF ALLEN..."

    const values  = extractLastNValues(line);
    const hasData = values.some(v => v !== null);
    const label   = getLabel(line);

    if (!label && hasData) {
      if (pendingRow) {
        for (let i = 0; i < values.length; i++) {
          if (values[i] !== null && pendingRow.values[i] === null)
            pendingRow.values[i] = values[i];
        }
      }
      continue;
    }

    flushPending();

    if (!label) continue;
    if (SKIP_RE.test(label)) {
      // "NEXT_CAT  SUBTOTAL  $..." — update currentDept to the next section name
      const m = /^([A-Z][A-Z\s&\/\-]+?)\s+SUBTOTAL\b/i.exec(label);
      if (m) currentDept = m[1].trim();
      continue;
    }

    // ALL_CAPS no-data lines are department/category headers
    if (!hasData && /^[A-Z][A-Z\s&\/\-]+$/.test(label)) {
      currentDept = label;
      continue;
    }

    if (!hasData) continue;

    pendingRow = { dept: currentDept, cat: label, values };
  }
  flushPending();

  return { rows, fiscalYear: adoptedFY, colInfo: { colCount, adoptedIdx, eoyIdx } };
}

// ── Parse a PDF file ──────────────────────────────────────────────────────────
function parsePDF(filePath, format) {
  let text;
  try {
    text = execSync('pdftotext -layout "' + filePath + '" -', {
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch (e) {
    console.error('  pdftotext error:', e.message.slice(0, 200));
    return null;
  }
  const lines = text.split('\n');
  if (format === 'allen')  return parseAllenFormat(lines);
  if (format === 'frisco') return parseFriscoFormat(lines);
  return parseMcKinneyFormat(lines);
}

// ── Build JSON tree ───────────────────────────────────────────────────────────
function buildTree(rows) {
  const tree = new Map();
  let total = 0;
  for (const row of rows) {
    const approved = Number(row.approved_amount) || 0;
    const actual   = row.actual_amount != null ? Number(row.actual_amount) : null;
    if (approved === 0 && (actual === null || actual === 0)) continue;
    const dept = row.department || 'Unknown';
    const cat  = row.category   || 'General';
    if (!tree.has(dept)) tree.set(dept, new Map());
    if (!tree.get(dept).has(cat)) tree.get(dept).set(cat, []);
    tree.get(dept).get(cat).push({ d: cat, a: approved, aa: actual, f: row.fund || null, e: null });
    total += approved;
  }
  const jsonTree = [];
  for (const [deptName, cats] of tree) {
    let deptTotal = 0;
    const children = [];
    for (const [catName, items] of cats) {
      const catTotal = items.reduce((s, i) => s + i.a, 0);
      deptTotal += catTotal;
      children.push({ n: catName, a: catTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: deptName, a: deptTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total };
}

// ── Upsert data_source ────────────────────────────────────────────────────────
async function upsertDataSource(muniId, city, fiscalYear, url) {
  const src = {
    name:            city + ' Revenue FY' + fiscalYear,
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'fy' + fiscalYear,
    base_url:        url,
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy' + fiscalYear)
    .eq('dataset_type', 'revenue')
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

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      city:      { type: 'string' },
      fy:        { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const dryRun     = opts['dry-run'];
  const filterCity = opts.city?.toLowerCase();
  const filterFY   = opts.fy ? parseInt(opts.fy, 10) : null;

  // Load municipalities
  const { data: munis } = await supabase.schema('treasury').from('municipalities')
    .select('id, name').in('name', ['McKinney', 'Allen', 'Frisco']);
  const muniMap = Object.fromEntries((munis || []).map(m => [m.name, m.id]));

  const sources = SOURCES.filter(s =>
    (!filterCity || s.city.toLowerCase() === filterCity) &&
    (!filterFY   || s.fy === filterFY)
  );

  let totalRows = 0;

  for (const src of sources) {
    const muniId = muniMap[src.city];
    if (!muniId) { console.error('Municipality not found: ' + src.city); continue; }

    console.log('── ' + src.city + ' FY' + src.fy + ' (' + src.format + ') ──────────────────────────────────────');

    // Download PDF
    const tmpFile = path.join(TMP, src.city.toLowerCase() + '_fy' + src.fy + '.pdf');
    process.stdout.write('  Downloading... ');
    try {
      await downloadPDF(src.url, tmpFile);
      console.log('done');
    } catch (e) {
      console.error('\n  Download failed: ' + e.message);
      continue;
    }

    // Parse
    const parsed = parsePDF(tmpFile, src.format);
    if (!parsed || !parsed.rows.length) {
      console.error('  Parse failed or no rows found');
      continue;
    }

    const { rows, fiscalYear, colInfo } = parsed;
    const { jsonTree, total } = buildTree(rows);

    // Use the fiscal year from the PDF, not the source catalogue (they may differ for multi-year PDFs)
    const loadFY = fiscalYear ?? src.fy;

    console.log('  Fiscal year loaded:  ' + loadFY);
    console.log('  Columns detected:    ' + colInfo.colCount + ' (Adopted[' + colInfo.adoptedIdx + '] EOY[' + colInfo.eoyIdx + '])');
    console.log('  Line items parsed:   ' + rows.length);
    console.log('  Total revenue:       $' + Math.round(total).toLocaleString());
    for (const dept of jsonTree) {
      console.log('    ' + dept.n + ': $' + Math.round(dept.a).toLocaleString() + ' (' + dept.c.length + ' items)');
    }

    if (dryRun) { console.log('  (dry-run — skipping DB)\n'); continue; }
    if (!loadFY) { console.error('  No fiscal year — skipping\n'); continue; }

    const ds = await upsertDataSource(muniId, src.city, loadFY, src.url);
    if (!ds?.id) { console.error('  data_source upsert failed'); continue; }
    console.log('  data_source: ' + ds.id);

    const { error: delErr } = await supabase.schema('treasury').from('budgets')
      .delete().eq('data_source_id', ds.id).eq('fiscal_year', loadFY);
    if (delErr) { console.error('  Clear failed:', delErr.message); continue; }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year:    loadFY,
      p_dataset_type:   'revenue',
      p_total:          total,
      p_tree:           jsonTree,
      p_row_count:      rows.length,
      p_triggered_by:   'bulk_load',
    });

    if (rpcErr)           { console.error('  RPC error:', rpcErr.message); continue; }
    if (rpcResult?.error) { console.error('  RPC error (returned):', rpcResult.error); continue; }

    const inserted = rpcResult?.rows_inserted ?? 0;
    console.log('  Loaded ' + inserted + ' rows for FY' + loadFY + '\n');
    totalRows += inserted;
  }

  console.log('\nDone. Total rows loaded: ' + totalRows);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
