#!/usr/bin/env node
/**
 * Prosper Revenue PDF Extractor — All Governmental Funds
 *
 * Extracts revenue data from ALL governmental fund Budget-and-Actual sections in
 * Prosper ACFR PDFs (FY2023, FY2024, FY2025) using pdftotext — no AI/API calls.
 *
 * Prior version (Phase 12-01) only captured General Fund revenues (~$23M). This
 * version expands to all governmental fund B&A schedules to reach the correct total
 * of ~$83M (FY2023), ~$102M (FY2024), ~$108M (FY2025).
 *
 * Strategy:
 *  - General Fund: parse individual revenue line items (clean 3-column layout)
 *  - Other funds with B&A schedules: extract "Total revenues" actual (4-column layout)
 *  - Capital Projects Fund: no B&A (budgeted over project life) — derived as remainder
 *  - Escrow Fund: no legally adopted budget — no B&A, effectively $0
 *
 * Validation: extracted sum compared against all-funds governmental statement total
 *   parsed from the combining statement right-block row (±20% tolerance).
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
const PDF_URLS = {
  2025: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682',
  2024: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/574',
  2023: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/489',
};

const CACHE_PATHS = {
  2025: 'C:/tmp/prosper_acfr_fy2025.pdf',
  2024: 'C:/tmp/prosper_acfr_fy2024.pdf',
  2023: 'C:/tmp/prosper_acfr_fy2023.pdf',
};

// Expected TOTAL GOVERNMENTAL revenues from the all-funds combining statement.
// Source: right-block "Total revenues" row of STATEMENT OF REVENUES, EXPENDITURES
// AND CHANGES IN FUND BALANCES - GOVERNMENTAL FUNDS in each ACFR.
//   FY2025 line: "  20,621,096  [...]  108,416,768" (Capital Projects col | Total col)
//   FY2024 line: "  17,682,899  [...]  101,863,293" (Capital Projects col | Total col)
//   FY2023 line: "  2,352,134  [blank]  224,206  [blank]  83,186,603" (CP | ARPA | Total)
const EXPECTED_TOTALS = {
  2025: 108_416_768,
  2024: 101_863_293,
  2023:  83_186_603,
};

// 20% tolerance — if extracted sum deviates more than this, validation fails
const TOLERANCE = 0.20;

// ── parseMoney ─────────────────────────────────────────────────────────────────
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
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText} downloading ${url}`);
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
  return text.split('\n').map(l => l.startsWith('\x0c') ? l.slice(1) : l);
}

// ── getValues ─────────────────────────────────────────────────────────────────
// Extract all money values (comma-grouped integers or decimals) from a line.
const MONEY_RE = /\(?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d{4,})\s*\)?/g;

function getValues(line) {
  return [...line.matchAll(MONEY_RE)].map(m => parseMoney(m[0])).filter(v => v !== null);
}

// ── getLabel ──────────────────────────────────────────────────────────────────
function getLabel(line) {
  const m = /\$\s*\d|\(\s*\d|\d{1,3}(?:,\d{3})/.exec(line);
  if (!m) return line.trim();
  return line.slice(0, m.index).trim();
}

// ── findAllBASections ──────────────────────────────────────────────────────────
// Finds ALL Budget-and-Actual sections in the PDF.
// Returns array of: { fundName, sectionLine, revenuesLine, revenueHeaderActual, is4col }
//
// Each section is anchored by:
//   "STATEMENT/SCHEDULE OF REVENUES, EXPENDITURES" + fund name + "BUDGET AND ACTUAL"
//   followed by a "REVENUES  $ ... $ ... $ ..." line
//
// is4col: true if the REVENUES header row has 4 values (4th = variance), false if 3 (GF).
function findAllBASections(lines, verbose) {
  const sections = [];

  for (let i = 0; i < lines.length; i++) {
    // Match section title
    if (!/(?:STATEMENT|SCHEDULE) OF REVENUES, EXPENDITURES/.test(lines[i])) continue;

    // Find fund name (within next 5 lines, ALL CAPS or mixed)
    let fundName = null;
    let foundBA = false;

    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      const t = lines[j].trim();
      if (!t) continue;

      // "BUDGET AND ACTUAL" or "BUDGET AND ACTUAL" (sometimes indented)
      if (/BUDGET AND ACTUAL/.test(t)) {
        foundBA = true;
        continue;
      }

      // Skip boilerplate lines
      if (/^FOR THE YEAR|^TOWN OF PROSPER|^SCHEDULE OF|^STATEMENT OF|^CHANGES IN FUND/i.test(t)) continue;

      // The fund name is typically in ALL CAPS or Title Case
      if (!foundBA && !fundName && t.length > 2 && !/^\d/.test(t)) {
        // Accept any non-numeric line as fund name (first non-blank, non-boilerplate)
        fundName = t.replace(/\s+/g, ' ');
      }
    }

    if (!fundName || !foundBA) continue;

    // Find the REVENUES header line (has $ signs)
    let revenuesLine = -1;
    let revenueHeaderActual = null;
    let is4col = false;

    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      const t = lines[j].trim();
      if (/^REVENUES\b/.test(t) && /\$/.test(lines[j])) {
        revenuesLine = j;
        const vals = getValues(lines[j]);
        if (vals.length >= 3) {
          // Check if last value is in parens (= negative variance → 4-column layout)
          const lastRaw = lines[j].match(/\([\d,]+\)\s*$/)?.['0'];
          if (lastRaw || vals.length >= 4) {
            // 4-column: [orig, final, actual, variance]
            is4col = true;
            revenueHeaderActual = vals[vals.length - 2]; // 3rd from left = actual (2nd from right)
          } else {
            // 3-column: [orig, final, actual] — General Fund layout
            is4col = false;
            revenueHeaderActual = vals[vals.length - 1];
          }
        } else if (vals.length >= 1) {
          revenueHeaderActual = vals[vals.length - 1];
        }
        break;
      }
    }

    if (revenuesLine < 0) continue;

    if (verbose) console.error(`[section] L${i+1}: "${fundName}" B&A found, REVENUES at L${revenuesLine+1}, headerActual=${revenueHeaderActual}, 4col=${is4col}`);

    sections.push({ fundName, sectionLine: i, revenuesLine, revenueHeaderActual, is4col });
  }

  return sections;
}

// ── parseGFFundRevenues ────────────────────────────────────────────────────────
// Parses detailed line items from the General Fund Budget-and-Actual statement.
// Returns array of { label, originalBudget, finalBudget, actual }
// (Same logic as the original single-fund extractor, now refactored as a function.)
function parseGFFundRevenues(lines, startIdx, revenueTotal, verbose) {
  const rows = [];
  let pendingLabel = null;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // Stop at EXPENDITURES
    if (/^EXPENDITURES\b/i.test(t)) {
      if (verbose) console.error(`[GF-stop] L${i+1}: EXPENDITURES`);
      break;
    }

    // Skip "Total revenues" row — not a line item
    if (/^\s*Total\s+[Rr]evenues?\b/.test(line)) {
      if (verbose) console.error(`[GF-skip-total] L${i+1}`);
      continue;
    }

    // Skip blanks and boilerplate
    if (!t) continue;
    if (/^(?:STATEMENT OF|FOR THE YEAR|REVENUES\s*$|Page \d+|GAAP Basis|Original\s*$|Final\s*$|Actual\s*$|Budget\s*$|Amounts\s*$)/i.test(t)) continue;
    if (/Town of Prosper|TOWN OF PROSPER/i.test(t)) continue;
    // Skip the REVENUES header line itself (has $ sign with large number)
    if (/^REVENUES\b/.test(t) && /\$/.test(line)) continue;

    const label = getLabel(line);
    const values = getValues(line);
    const hasValues = values.length >= 1;

    if (!hasValues) {
      if (label && label.length > 1 && !/^\$/.test(label)) {
        if (pendingLabel && verbose) console.error(`[GF-orphan] L${i+1}: pending "${pendingLabel}" → no values`);
        pendingLabel = label;
        if (verbose) console.error(`[GF-pending] L${i+1}: "${label}"`);
      }
      continue;
    }

    let effectiveLabel = label;
    if (!label || label.length < 2) {
      if (pendingLabel) {
        effectiveLabel = pendingLabel;
        pendingLabel = null;
        if (verbose) console.error(`[GF-merged] L${i+1}: used pending "${effectiveLabel}"`);
      } else {
        if (verbose) console.error(`[GF-skip-nolabel] L${i+1}: values with no label`);
        continue;
      }
    } else {
      if (pendingLabel) {
        if (verbose) console.error(`[GF-drop-pending] L${i+1}: pending "${pendingLabel}" had no values`);
        pendingLabel = null;
      }
    }

    // Skip known non-items
    if (/^EXPENDITURES|^OTHER FINANCING|^NET CHANGE|^FUND BALANCE|^Excess|^Total\b/i.test(effectiveLabel)) continue;
    if (/^CHANGE IN FUND|^FUND BALANCES/i.test(effectiveLabel)) break;

    // GF = 3 columns [orig, final, actual]; actual = rightmost
    const actual         = values.length >= 1 ? values[values.length - 1] : null;
    const finalBudget    = values.length >= 2 ? values[values.length - 2] : null;
    const originalBudget = values.length >= 3 ? values[values.length - 3] : null;

    if (actual === null || actual === 0) {
      if (verbose) console.error(`[GF-skip-zero] L${i+1}: "${effectiveLabel}" actual=null/0`);
      continue;
    }

    // Overflow guard: reject individual items > REVENUES total * 1.05
    if (revenueTotal && Math.abs(actual) > Math.abs(revenueTotal) * 1.05) {
      if (verbose) console.error(`[GF-overflow] L${i+1}: "${effectiveLabel}" actual=${actual} > total — skipping`);
      continue;
    }

    rows.push({ label: effectiveLabel, originalBudget, finalBudget, actual });
    if (verbose) console.error(`[GF-row] L${i+1}: "${effectiveLabel}" orig=${originalBudget} final=${finalBudget} actual=${actual}`);
  }

  return rows;
}

// ── parseNonGFFundTotal ────────────────────────────────────────────────────────
// Extracts revenue line items and "Total revenues" actual for a non-GF fund B&A.
//
// Non-GF funds use 4-column layout: [orig, final, actual, variance]
//
// Key insight: the REVENUES header row for non-GF funds shows the FIRST revenue
// line item (e.g. property taxes or sales taxes), NOT the section total. This differs
// from General Fund where the REVENUES header shows the total.
//
// Therefore: the revenueHeaderActual (passed in from findAllBASections) is the first
// item's actual value, and must be included in the running sum.
//
// "Total revenues" label handling:
//   A) ≥3 values on same line → actual = 3rd value (or 2nd-from-right if last is variance)
//   B) 0 values on label line → continuation on next non-blank line → same extraction
//   C) 1-2 values (variance or partial) → ALSO look at next non-blank line for full values
//
// Returns { total, items: [{label, originalBudget, finalBudget, actual}] }
function parseNonGFFundTotal(lines, revenuesLine, fundName, revenueHeaderActual, is4col, verbose) {
  const items = [];
  let totalFromLabel = null;
  let pendingLabel = null;

  // Include the REVENUES header row as the first revenue item (taxes/impact fees etc.)
  // The header label is typically a major tax category (sales taxes, property taxes, impact fees)
  // We use a generic label since we don't know the exact category without more context.
  if (revenueHeaderActual !== null && revenueHeaderActual > 0) {
    // Determine label from context: look at the line following the REVENUES header
    // which may have the first category label
    let firstItemLabel = 'Taxes and fees';
    const nextLine = lines[revenuesLine + 1] || '';
    const nextLabel = getLabel(nextLine);
    if (nextLabel && nextLabel.length > 1 && !getValues(nextLine).length) {
      // Label-only line right after REVENUES header = first category label
      firstItemLabel = nextLabel;
    }

    // Also check: for funds where REVENUES header has 4-col, extract budget values
    const headerVals = getValues(lines[revenuesLine]);
    let headerOrig = null, headerFinal = null;
    if (headerVals.length >= 4 || (headerVals.length >= 3 && is4col)) {
      headerOrig  = headerVals[0];
      headerFinal = headerVals[1];
    } else if (headerVals.length >= 3) {
      headerOrig  = headerVals[0];
      headerFinal = headerVals[1];
    }

    items.push({
      label: firstItemLabel,
      originalBudget: headerOrig ?? 0,
      finalBudget: headerFinal ?? 0,
      actual: revenueHeaderActual,
    });
    if (verbose) console.error(`[nonGF-${fundName}] L${revenuesLine + 1}: REVENUES header item "${firstItemLabel}" actual=${revenueHeaderActual}`);
  }

  // Scan from the line after REVENUES header until EXPENDITURES
  const sectionLines = [];
  for (let i = revenuesLine + 1; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (/^EXPENDITURES\b/i.test(t)) break;
    if (/^CHANGE IN FUND/i.test(t)) break;
    sectionLines.push({ lineNo: i + 1, line, t });
  }

  if (verbose) console.error(`[nonGF-${fundName}] section has ${sectionLines.length} lines before EXPENDITURES`);

  // ── Helper: extract "total revenues" actual from a line or continuation ────
  function extractTotalRevenuesFromLine(lineIdx) {
    const { line } = sectionLines[lineIdx];
    const vals = getValues(line);

    if (vals.length >= 3) {
      const lastIsNeg = /\(\s*[\d,]+\s*\)\s*$/.test(line.trim());
      if (vals.length >= 4 || lastIsNeg) {
        return { total: vals[2], skipNext: false };
      } else {
        return { total: vals[vals.length - 1], skipNext: false };
      }
    }

    // 0, 1, or 2 values on label line — look at next non-blank line for continuation
    let j = lineIdx + 1;
    while (j < sectionLines.length && !sectionLines[j].t) j++;
    if (j < sectionLines.length) {
      const nextLine = sectionLines[j].line;
      const nextVals = getValues(nextLine);
      if (nextVals.length >= 3) {
        const lastIsNeg = /\(\s*[\d,]+\s*\)\s*$/.test(nextLine.trim());
        if (nextVals.length >= 4 || lastIsNeg) {
          if (verbose) console.error(`[nonGF-${fundName}] L${sectionLines[j].lineNo}: Total revenues continuation (4col) actual=${nextVals[2]}`);
          return { total: nextVals[2], skipNext: j };
        } else {
          if (verbose) console.error(`[nonGF-${fundName}] L${sectionLines[j].lineNo}: Total revenues continuation (3col) actual=${nextVals[nextVals.length - 1]}`);
          return { total: nextVals[nextVals.length - 1], skipNext: j };
        }
      } else if (nextVals.length >= 1 && vals.length === 0) {
        // Only 1-2 values on continuation — could be variance-only, skip
        if (verbose) console.error(`[nonGF-${fundName}] L${sectionLines[j].lineNo}: Total revenues continuation has only ${nextVals.length} values — skipping`);
      }
    }

    return { total: null, skipNext: false };
  }

  let i = 0;
  while (i < sectionLines.length) {
    const { lineNo, line, t } = sectionLines[i];

    if (!t) { i++; continue; }

    // Skip boilerplate
    if (/^(?:FOR THE YEAR|TOWN OF PROSPER|Original\s*$|Final\s*$|Actual\s*$|Budget\s*$|Amounts\s*$|GAAP Basis|Positive\s*$|\(Negative\)\s*$|Variance|Budgetary)/i.test(t)) {
      i++; continue;
    }

    const values = getValues(line);
    const label = getLabel(line);

    // Handle "Total revenues" / "Total Revenue" / "Total Revenues" labeled lines
    if (/^\s*Total\s+[Rr]evenues?\b/i.test(line)) {
      const { total, skipNext } = extractTotalRevenuesFromLine(i);
      if (total !== null) {
        totalFromLabel = total;
        if (verbose) console.error(`[nonGF-${fundName}] L${lineNo}: Total revenues → actual=${totalFromLabel}`);
      } else {
        if (verbose) console.error(`[nonGF-${fundName}] L${lineNo}: Total revenues — could not extract actual`);
      }
      if (skipNext !== false) i = skipNext;
      i++;
      continue;
    }

    // Parse individual revenue item
    if (values.length >= 1) {
      let effectiveLabel = label;
      if (!label || label.length < 2) {
        if (pendingLabel) {
          effectiveLabel = pendingLabel;
          pendingLabel = null;
        } else {
          // Values with no label — skip (likely overflow from adjacent table or variance-only)
          i++; continue;
        }
      } else {
        if (pendingLabel) {
          if (verbose) console.error(`[nonGF-${fundName}] L${lineNo}: pending "${pendingLabel}" got no values — orphan`);
          pendingLabel = null;
        }
      }

      // Skip non-revenue items (Other Financing Sources, Fund Balance, etc.)
      if (/^(?:EXPENDITURES|OTHER FINANCING|NET CHANGE|FUND BALANCE|Excess|CHANGE IN FUND|Transfers?\s+(?:in|out)|Total\s+other|Total\s+expenditures|Total\s+financing|Issuance|Premium|Payment|Insurance)/i.test(effectiveLabel)) {
        i++; continue;
      }

      // Determine actual from column position:
      // 4-column: [orig, final, actual, variance] → actual = values[2]
      // 3-column: [orig, final, actual] → actual = values[2] or values[-1]
      // 2-column: [something, actual] → actual = values[1]
      // 1-column: only variance or partial → actual = values[0] (may be wrong)
      let actual, originalBudget, finalBudget;
      const lastIsNeg = /\(\s*[\d,]+\s*\)\s*$/.test(line.trim());

      if (values.length >= 4 || (values.length === 3 && lastIsNeg)) {
        actual         = values[2];
        finalBudget    = values[1];
        originalBudget = values[0];
      } else if (values.length === 3) {
        actual         = values[2];
        finalBudget    = values[1];
        originalBudget = values[0];
      } else if (values.length === 2) {
        // Could be [orig, actual] or [final, actual] or [actual, variance]
        // Use 2nd value as actual (more conservative)
        actual         = values[1];
        originalBudget = values[0];
      } else {
        // Single value: if it's in parentheses it's variance — skip
        if (lastIsNeg) { i++; continue; }
        // Otherwise treat as actual (small funds like Court Security investment income)
        actual = values[0];
      }

      if (actual !== null && actual !== 0) {
        // Skip if this label is the same as the first item we already added from the header
        const alreadyAdded = items.length > 0 &&
          (effectiveLabel === items[0].label ||
           (Math.abs(actual - items[0].actual) < 1 && actual !== 0));

        if (!alreadyAdded) {
          items.push({ label: effectiveLabel, originalBudget: originalBudget ?? 0, finalBudget: finalBudget ?? 0, actual });
          if (verbose) console.error(`[nonGF-${fundName}] L${lineNo}: item "${effectiveLabel}" actual=${actual}`);
        } else {
          if (verbose) console.error(`[nonGF-${fundName}] L${lineNo}: skip duplicate "${effectiveLabel}" actual=${actual} (already in header item)`);
        }
      }
    } else {
      // Label-only line
      if (t && t.length > 1 && !/^\$/.test(t)) {
        if (pendingLabel) {
          if (verbose) console.error(`[nonGF-${fundName}] L${lineNo}: orphan pending "${pendingLabel}"`);
        }
        pendingLabel = t;
      }
    }

    i++;
  }

  // Compute sum of all extracted items (including header item)
  const sumOfItems = items.reduce((s, r) => s + (r.actual || 0), 0);

  // Best total = max of (totalFromLabel, sumOfItems)
  // "Total revenues" label value is the most reliable when the layout is clean.
  // sumOfItems may be higher for funds where the label total is partial/garbled (TIRZ 1).
  let total;
  if (totalFromLabel !== null && totalFromLabel > 0) {
    total = Math.max(totalFromLabel, sumOfItems);
    if (verbose && Math.abs(totalFromLabel - sumOfItems) > 1000) {
      console.error(`[nonGF-${fundName}] label total=${totalFromLabel} vs items sum=${sumOfItems} → using max=${total}`);
    }
  } else {
    total = sumOfItems;
    if (verbose) console.error(`[nonGF-${fundName}] no label total found, using items sum=${sumOfItems}`);
  }

  return { total, items };
}

// ── extractAllFundsTotal ───────────────────────────────────────────────────────
// Extracts the total governmental revenues from the all-funds combining statement.
//
// The STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES -
// GOVERNMENTAL FUNDS has a right-block page that shows:
//   Capital Projects | Escrow | Nonmajor | Total
//
// The "Total revenues" row in the right block shows:
//   <Capital Projects total>  [blanks]  <Grand Total>
//
// The Grand Total (rightmost number on that line) is the total governmental revenues.
//
// Returns the total as a number, or null if not found.
function extractAllFundsTotal(lines, verbose) {
  // Find the STATEMENT OF REVENUES... GOVERNMENTAL FUNDS section
  let stmtLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/STATEMENT OF REVENUES, EXPENDITURES/.test(lines[i]) &&
        /GOVERNMENTAL FUNDS/.test(lines[i + 1] || '') ||
        (/STATEMENT OF REVENUES/.test(lines[i]) && /CHANGES IN FUND BALANCE/.test(lines[i]) &&
         /GOVERNMENTAL FUNDS/.test(lines[i + 1] || '')) ||
        // Two-line version
        (i > 0 && /CHANGES IN FUND BALANCE/.test(lines[i]) &&
         /GOVERNMENTAL FUNDS/.test(lines[i + 1] || '') &&
         /STATEMENT OF REVENUES/.test(lines[i - 1] || ''))) {
      stmtLine = i;
      break;
    }
  }

  // Alternative: find the right-block header "Capital Projects ... Escrow ... Nonmajor ... Total"
  // within ~100 lines of the first STATEMENT OF REVENUES occurrence
  let rightBlockHeader = -1;
  const stmtStart = stmtLine >= 0 ? stmtLine : 0;
  for (let i = stmtStart; i < Math.min(stmtStart + 200, lines.length); i++) {
    if (/Capital\s+Projects?/.test(lines[i]) && /Nonmajor/i.test(lines[i] + (lines[i+1] || ''))) {
      rightBlockHeader = i;
      if (verbose) console.error(`[allFunds] Right-block header at L${i+1}: ${lines[i].trim()}`);
      break;
    }
    // For FY2023: 'Capital    Escrow    ARPA    Nonmajor    Governmental'
    if (/Capital/.test(lines[i]) && /Escrow/.test(lines[i]) && /Governmental/.test(lines[i] + (lines[i+1] || ''))) {
      rightBlockHeader = i;
      if (verbose) console.error(`[allFunds] Right-block header (FY2023 style) at L${i+1}: ${lines[i].trim()}`);
      break;
    }
  }

  if (rightBlockHeader < 0) {
    if (verbose) console.error(`[allFunds] Could not find right-block header`);
    return null;
  }

  // Scan forward for "Total revenues" row or the large summary number.
  // The Total revenues row is within ~45 lines of the right-block header.
  //
  // Strategy:
  //   1. FIRST, look for a 2-column row (CP | Total): this is the cleanest signal.
  //      Return on FIRST 2-col match to avoid scanning into expenditures.
  //   2. FALLBACK: if no 2-col row found, collect 3-col candidates (FY2023 ARPA structure)
  //      and return the largest.
  //   3. FALLBACK: single large number.
  //
  // Note: stop scanning at EXPENDITURES to avoid picking up expenditure totals.
  let fallback3col = null;
  let fallback1col = null;
  for (let i = rightBlockHeader + 1; i < Math.min(rightBlockHeader + 50, lines.length); i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Stop if we hit EXPENDITURES (we've gone too far into the statement)
    if (/^EXPENDITURES\b/i.test(line.trim())) break;
    if (/^\s*Total\s+expenditures\b/i.test(line.trim())) break;

    // Extract all 5+ digit numbers from the line
    const nums = [...line.matchAll(/[\d,]{5,}/g)].map(m => parseInt(m[0].replace(/,/g, ''), 10));

    // 2-number row: Capital Projects | Total Governmental
    // This is the most reliable match — return immediately on first qualifying 2-col row.
    if (nums.length === 2 && nums[1] > nums[0] && nums[1] > 50_000_000) {
      if (verbose) console.error(`[allFunds] L${i+1}: Total revenues (2-col) — CP=${nums[0].toLocaleString()} Total=${nums[1].toLocaleString()}`);
      return nums[1];
    }

    // FY2023: 3 numbers (Capital Projects, ARPA, Total Governmental)
    // e.g. "2,352,134  -  224,206  -  83,186,603"
    // Collect as fallback (don't return early — a 2-col row may appear later).
    if (nums.length === 3 && nums[2] > nums[0] && nums[2] > 50_000_000) {
      if (verbose) console.error(`[allFunds] L${i+1}: candidate 3-col — CP=${nums[0].toLocaleString()} mid=${nums[1].toLocaleString()} Total=${nums[2].toLocaleString()}`);
      if (fallback3col === null || nums[2] > fallback3col) fallback3col = nums[2];
      continue;
    }

    // Single large number (> 50M, < 500M) = total
    if (nums.length === 1 && nums[0] > 50_000_000 && nums[0] < 500_000_000) {
      if (verbose) console.error(`[allFunds] L${i+1}: candidate 1-col — Total=${nums[0].toLocaleString()}`);
      if (fallback1col === null || nums[0] > fallback1col) fallback1col = nums[0];
      continue;
    }
  }

  // No 2-col row found — use best fallback
  if (fallback3col !== null) {
    if (verbose) console.error(`[allFunds] Using 3-col fallback: ${fallback3col.toLocaleString()}`);
    return fallback3col;
  }
  if (fallback1col !== null) {
    if (verbose) console.error(`[allFunds] Using 1-col fallback: ${fallback1col.toLocaleString()}`);
    return fallback1col;
  }

  if (verbose) console.error(`[allFunds] Could not find total revenues row after right-block header`);
  return null;
}

// ── buildTree ─────────────────────────────────────────────────────────────────
// Builds the JSON tree for treasury_sync_budget_tree RPC.
// Each fund becomes a "department". Within each fund, revenue line items are categories.
// For funds where we only have a total (no line items), create a single category entry.
function buildTree(fundResults) {
  const jsonTree = [];
  let grandTotal = 0;

  for (const { fundName, items, total } of fundResults) {
    // Determine line items to use
    let lineItems = items;
    if (!lineItems || lineItems.length === 0) {
      // Single line item = the total itself
      lineItems = [{
        label: 'Total revenues',
        originalBudget: 0,
        finalBudget: 0,
        actual: total,
      }];
    }

    const dept = fundName;
    let deptTotal = 0;
    const catMap = new Map();

    for (const row of lineItems) {
      const approved = Number(row.originalBudget) || 0;
      const actual   = row.actual != null ? Number(row.actual) : null;

      if (approved === 0 && (actual === null || actual === 0)) continue;

      const cat = row.label || 'Revenue';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat).push({
        d: cat,
        // ⚠ a -> actual_amount, aa -> approved_amount.
        a: actual,
        aa: approved,
        f: fundName,
        e: null,
      });
      deptTotal += approved;
    }

    if (catMap.size === 0) continue;

    const children = [];
    for (const [catName, catItems] of catMap) {
      const catTotal = catItems.reduce((s, item) => s + item.a, 0);
      children.push({ n: catName, a: catTotal, i: catItems });
    }
    children.sort((a, b) => b.a - a.a);

    jsonTree.push({ n: dept, a: deptTotal, c: children });
    grandTotal += deptTotal;
  }

  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total: grandTotal };
}

// ── validateTotal ─────────────────────────────────────────────────────────────
function validateTotal(extractedActual, expected, fyLabel) {
  console.log(`\n  Validation (${fyLabel}):`);
  console.log(`    Extracted actual total: $${Math.round(extractedActual).toLocaleString()}`);

  if (expected == null) {
    console.warn(`    WARNING: No expected total — skipping validation`);
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
async function processFY(supabase, muniId, fiscalYear, opts) {
  const { dryRun, verbose, noCache, pdfOverride } = opts;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Processing Prosper FY${fiscalYear} — All Governmental Funds`);
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

  // ── Step 3: Find all B&A sections ────────────────────────────────────────
  const sections = findAllBASections(lines, verbose);
  console.log(`  B&A sections found: ${sections.length}`);

  if (sections.length === 0) {
    console.error(`No B&A sections found for FY${fiscalYear}`);
    return { fy: fiscalYear, passed: false, total: 0, rowCount: 0, dsId: null };
  }

  // ── Step 4: Extract revenues from each fund section ───────────────────────
  const fundResults = [];
  let totalActual = 0;
  let totalRowCount = 0;

  for (const section of sections) {
    const { fundName, revenuesLine, revenueHeaderActual, is4col } = section;

    let fundData;

    if (/GENERAL FUND/i.test(fundName)) {
      // Use detailed line-item parser for General Fund
      const gfRows = parseGFFundRevenues(lines, revenuesLine + 1, revenueHeaderActual, verbose);
      const gfActual = gfRows.reduce((s, r) => s + (r.actual || 0), 0);
      console.log(`  [General Fund] ${gfRows.length} items, actual=$${Math.round(gfActual).toLocaleString()}`);
      fundData = { fundName: 'General Fund', items: gfRows, total: gfActual };
    } else {
      // Use total-only parser for other funds
      const result = parseNonGFFundTotal(lines, revenuesLine, fundName, verbose);
      const { total, items } = result;

      if (total <= 0 && verbose) {
        console.error(`  [${fundName}] WARNING: extracted total=${total} — could be parsing issue`);
      }

      // Normalize fund name for display
      const displayName = fundName
        .replace(/TOWN OF PROSPER,?\s*TEXAS/i, '')
        .replace(/SCHEDULE OF REVENUES.*$/i, '')
        .trim();

      console.log(`  [${displayName}] total actual=$${Math.round(total).toLocaleString()}  (${items.length} items extracted)`);
      fundData = { fundName: displayName, items, total };
    }

    fundResults.push(fundData);
    totalActual += fundData.total;
    totalRowCount += Math.max(fundData.items.length, 1);
  }

  console.log(`\n  Fund breakdown:`);
  console.log('  ' + '─'.repeat(65));
  for (const fr of fundResults) {
    console.log(`  ${fr.fundName.padEnd(45)} $${Math.round(fr.total).toLocaleString().padStart(16)}`);
  }
  console.log('  ' + '─'.repeat(65));
  console.log(`  ${'TOTAL (extracted)'.padEnd(45)} $${Math.round(totalActual).toLocaleString().padStart(16)}`);

  // ── Step 5: Derive Capital Projects Fund (no B&A) ─────────────────────────
  // Capital Projects Fund is budgeted over project life — no annual B&A statement.
  // Derive from: Total Governmental - sum of all B&A fund actuals.
  const allFundsTotal = extractAllFundsTotal(lines, verbose);
  let capitalProjectsActual = null;

  if (allFundsTotal !== null) {
    capitalProjectsActual = allFundsTotal - totalActual;
    if (capitalProjectsActual > 0) {
      console.log(`  ${'Capital Projects Fund (derived)'.padEnd(45)} $${Math.round(capitalProjectsActual).toLocaleString().padStart(16)}`);
      fundResults.push({
        fundName: 'Capital Projects Fund',
        items: [{ label: 'Capital revenue', originalBudget: 0, finalBudget: 0, actual: capitalProjectsActual }],
        total: capitalProjectsActual,
      });
      totalActual += capitalProjectsActual;
      totalRowCount += 1;
    } else if (capitalProjectsActual < 0) {
      console.warn(`  WARNING: Derived Capital Projects actual is negative (${capitalProjectsActual.toLocaleString()}) — B&A sum may exceed all-funds total`);
    } else {
      console.log(`  Capital Projects Fund: $0 (derived)`);
    }
  } else {
    console.warn(`  WARNING: Could not extract all-funds total — Capital Projects Fund revenues not added`);
    // Fall back to EXPECTED_TOTALS for validation
  }

  console.log(`  ${'TOTAL (with Capital Projects)'.padEnd(45)} $${Math.round(totalActual).toLocaleString().padStart(16)}`);

  // ── Step 6: Validate ──────────────────────────────────────────────────────
  const expected = EXPECTED_TOTALS[fiscalYear] ?? null;
  const valid = validateTotal(totalActual, expected, `Prosper FY${fiscalYear}`);

  if (!valid) {
    console.error(`  VALIDATION FAILED — skipping load for FY${fiscalYear}. Data NOT written to DB.`);
    return { fy: fiscalYear, passed: false, total: totalActual, rowCount: totalRowCount, dsId: null };
  }

  // ── Step 7: Build JSON tree ───────────────────────────────────────────────
  const { jsonTree, total: budgetTotal } = buildTree(fundResults);
  // totalActual is the all-governmental-funds actual revenue total (the correct DB value).
  // budgetTotal is the sum of original budgets from the tree (used for tree rendering only).
  console.log(`\n  Tree built: ${jsonTree.length} fund(s), ${totalRowCount} items`);
  console.log(`  Budget total (tree): $${Math.round(budgetTotal).toLocaleString()}`);
  console.log(`  Actual revenue total: $${Math.round(totalActual).toLocaleString()}`);

  if (dryRun) {
    console.log('  (dry-run — skipping DB writes)');
    return { fy: fiscalYear, passed: true, total: totalActual, rowCount: totalRowCount, dsId: 'dry-run' };
  }

  // ── Step 8: Look up existing data_source row ──────────────────────────────
  const { data: ds, error: dsErr } = await supabase.schema('treasury').from('data_sources')
    .select('id, last_synced_at')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy' + fiscalYear)
    .eq('dataset_type', 'revenue')
    .maybeSingle();

  if (dsErr) {
    console.error(`data_sources lookup error for FY${fiscalYear}: ${dsErr.message}`);
    return { fy: fiscalYear, passed: false, total: totalActual, rowCount: totalRowCount, dsId: null };
  }
  if (!ds?.id) {
    console.error(`data_source row not found for Prosper revenue FY${fiscalYear} — Phase 9 seeder must have run first`);
    return { fy: fiscalYear, passed: false, total: totalActual, rowCount: totalRowCount, dsId: null };
  }
  console.log(`  data_source: ${ds.id}`);

  // ── Step 9: Update base_url ───────────────────────────────────────────────
  const correctUrl = PDF_URLS[fiscalYear];
  const { error: urlErr } = await supabase.schema('treasury').from('data_sources')
    .update({ base_url: correctUrl })
    .eq('id', ds.id);
  if (urlErr) console.warn(`  WARNING: Could not update base_url: ${urlErr.message}`);
  else console.log(`  base_url updated to: ${correctUrl}`);

  // ── Step 10: Clear prior rows (idempotency) ───────────────────────────────
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

  // ── Step 11: Call treasury_sync_budget_tree RPC ───────────────────────────
  // p_total = totalActual (all-governmental-funds actual revenues) — this is what
  // gets stored in budgets.total_budget and displayed in the UI.
  // budgetTotal (original budget sum) is embedded in the tree for the breakdown view.
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'revenue',
    p_total:          totalActual,
    p_tree:           jsonTree,
    p_row_count:      totalRowCount,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr) throw new Error(`RPC error for FY${fiscalYear}: ${rpcErr.message}`);
  if (rpcResult?.error) throw new Error(`RPC returned error for FY${fiscalYear}: ${rpcResult.error}`);

  const inserted = rpcResult?.rows_inserted ?? totalRowCount;
  console.log(`  Loaded ${inserted} rows for FY${fiscalYear}`);

  // ── Step 12: Set last_synced_at ───────────────────────────────────────────
  const { error: syncErr } = await supabase.schema('treasury').from('data_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', ds.id);
  if (syncErr) throw new Error(`last_synced_at update failed: ${syncErr.message}`);
  console.log(`  last_synced_at set for data_source ${ds.id}`);

  return { fy: fiscalYear, passed: true, total: totalActual, rowCount: totalRowCount, dsId: ds.id };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run':  { type: 'boolean', default: false },
      'verbose':  { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
      'pdf':      { type: 'string'  },
      'fy':       { type: 'string'  },
    },
    strict: false,
  });

  const dryRun      = opts['dry-run'];
  const verbose     = opts['verbose'];
  const noCache     = opts['no-cache'];
  const pdfOverride = opts['pdf'];
  const fyFilter    = opts['fy'] ? parseInt(opts['fy'], 10) : null;

  if (pdfOverride && !fyFilter) {
    console.error('--pdf requires --fy (specify which fiscal year this PDF is for)');
    process.exit(2);
  }

  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Prosper').single();
  if (muniErr || !muni) {
    console.error('Could not find Prosper municipality:', muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id})`);

  const allFYs = [2023, 2024, 2025];
  const targetFYs = fyFilter ? [fyFilter] : allFYs;

  for (const fy of targetFYs) {
    if (!PDF_URLS[fy]) {
      console.error(`FY${fy} is not configured in this script`);
      process.exit(2);
    }
  }

  const results = [];
  for (const fy of targetFYs) {
    try {
      const result = await processFY(supabase, muni.id, fy, {
        dryRun, verbose, noCache,
        pdfOverride: fyFilter === fy ? pdfOverride : undefined,
      });
      results.push(result);
    } catch (e) {
      console.error(`\nFatal error processing FY${fy}: ${e.message}`);
      results.push({ fy, passed: false, total: 0, rowCount: 0, dsId: null });
    }
  }

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
    console.log(`\nPartial success — ${failed} failed. See output above.`);
  } else {
    console.error('\nAll fiscal years failed. No data was written to the database.');
    process.exit(2);
  }

  if (dryRun) console.log('(dry-run mode — no data was written to the database)');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(2);
});
