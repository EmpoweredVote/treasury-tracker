/**
 * CA Statewide City Salaries Loader
 *
 * Fetches position-level payroll data for any California city from the CA State
 * Controller's Government Compensation in California (GCC) raw CSV export at
 * gcc.sco.ca.gov, and loads into Supabase as a Department → Position tree.
 *
 * Source: CA State Controller — Government Compensation in California
 *         https://publicpay.ca.gov → https://gcc.sco.ca.gov
 * Data:   gcc.sco.ca.gov/RawExport/{YEAR}_City.zip (no paywall, static ZIP)
 *
 * Usage:
 *   node scripts/loadCASalaries.js --city "Irvine" --fy 2024
 *   node scripts/loadCASalaries.js --city "Anaheim" --fy 2024 --fy 2023 --dry-run
 *   node scripts/loadCASalaries.js --city "Newport Beach" --fy 2024 --dry-run
 *
 * Env vars:
 *   SUPABASE_URL         Supabase project URL
 *   SUPABASE_SERVICE_KEY Service role key (or SUPABASE_SERVICE_ROLE_KEY)
 *
 * Decisions:
 *   D-01: Position is always the leaf — no individual names are ever exposed.
 *         The GCC statewide source contains no name columns (confirmed spike).
 *   D-02: Total Compensation = TotalWages + TotalRetirementAndHealthContribution.
 *   D-03: Per-position metadata carries avg base / avg overtime+other / avg benefits.
 *   D-04: Multi-year capable (repeatable --fy). Default: [2024].
 *   D-06: Cities missing for a year simply produce no salaries row for that year.
 *
 * Multi-employer-row handling (Claude's Discretion):
 *   A city may appear with multiple EmployerName spellings (rare) or identical
 *   EmployerName rows for different departments. The filter is case-insensitive
 *   exact match on EmployerName against the --city argument (trimmed). All rows
 *   passing the filter are aggregated into a single Department → Position tree
 *   for the city. This mirrors how the LA County loader aggregates all pages for
 *   a single entity.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

// ── Env / Supabase setup ────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
// ⚠ Do NOT hard-exit at import time. This module is imported by its unit tests,
// which run in CI with no Supabase key — a top-level process.exit(1) takes the
// whole vitest worker down with "process.exit unexpectedly called with 1". The
// CLI entry point at the bottom enforces the key instead, so running the loader
// for real still fails fast and loud.
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ── GCC constants (from 55-SPIKE-FINDINGS.md — do NOT re-derive) ────────────

const GCC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const GCC_ZIP_URL = (year) => `https://gcc.sco.ca.gov/RawExport/${year}_City.zip`;

// ── GCC CSV field indices (0-based, from spike findings Section 2.2) ─────────

const COL_YEAR            = 0;
const COL_EMPLOYER_TYPE   = 1;
const COL_EMPLOYER_NAME   = 2;
const COL_DEPT            = 3;
const COL_POSITION        = 4;
// Skipping 5-10 (ElectedOfficial, Judicial, OtherPositions, MinSal, MaxSal, ReportedBaseWage)
const COL_REGULAR_PAY     = 11;  // base pay (D-03)
const COL_OVERTIME_PAY    = 12;  // overtime (D-03)
const COL_LUMP_SUM_PAY    = 13;  // other pay component (D-03)
const COL_OTHER_PAY       = 14;  // other pay component (D-03)
const COL_TOTAL_WAGES     = 15;  // sum of cols 11-14
const COL_TOTAL_BENEFITS  = 20;  // TotalRetirementAndHealthContribution (D-02 / D-03)
// COL_EMPLOYER_COUNTY = 25 (available for future county-scoped queries)

const DATA_SOURCE_NAME = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)';

// ── Department label normalization (gap-closure, 2026-06-15) ──────────────────
//
// GCC carries the department name each city self-reports in DepartmentOrSubdivision.
// Many cities submit terse abbreviations (e.g. Irvine reports "Pw Sust", "Hum Res",
// "City Cnl"), which are accurate but not citizen-readable. We expand ONLY a small,
// auditable set of HIGH-confidence, unambiguous whole-token abbreviations and apply a
// smart Title Case that preserves acronyms and roman numerals. Genuinely ambiguous
// codes (e.g. "Com Eng", "Pd Sustainability", "Citycnl2") are left exactly as-reported
// — expanding them would be guessing, which violates the never-fabricate ground rule
// (D-01). This map is statewide-safe: a city that doesn't use these tokens is untouched.
const DEPT_TOKEN_EXPANSIONS = {
  pw:    'Public Works',
  sust:  'Sustainability',
  trsp:  'Transportation',
  hum:   'Human',
  res:   'Resources',
  cnl:   'Council',
  admin: 'Administrative',
};

// Roman numerals (I–X) seen in titles like "Dispatcher II" — keep uppercase, never Title Case to "Ii".
const ROMAN_NUMERAL = /^(i{1,3}|iv|v|vi{0,3}|ix|x)$/i;

/**
 * Normalize a self-reported department label for display.
 * - Expands only the approved high-confidence abbreviation tokens above.
 * - Preserves existing acronyms (already-uppercase tokens of 2–4 chars) and roman numerals.
 * - Title-cases remaining ordinary words; leaves unrecognized codes as-reported.
 * Never invents meaning for ambiguous tokens (D-01).
 */
export function normalizeDeptLabel(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return 'UNKNOWN';
  return trimmed
    .split(/\s+/)
    .map((tok) => {
      const key = tok.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(DEPT_TOKEN_EXPANSIONS, key)) {
        return DEPT_TOKEN_EXPANSIONS[key];
      }
      if (ROMAN_NUMERAL.test(tok)) return tok.toUpperCase();
      if (/^[A-Z0-9]{2,4}$/.test(tok)) return tok; // preserve existing acronyms (IT, HR, GIS…)
      return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    })
    .join(' ');
}

// ── Money parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a monetary cell into a finite Number.
 * Strips currency symbols, thousands separators, and whitespace before parsing so
 * a quoted value like "1,234.56" is not silently truncated to 1 by parseFloat (WR-01).
 * Unparseable cells are warned about and treated as 0.
 */
export function parseMoney(raw) {
  if (raw == null || raw === '') return 0;
  const cleaned = String(raw).replace(/[$,\s]/g, '');
  if (cleaned === '') return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    console.warn(`  Non-numeric money cell: ${JSON.stringify(raw)}`);
    return 0;
  }
  return n;
}

// ── CSV parser (handles quoted fields with embedded commas/newlines) ──────────

/**
 * Parse a single CSV line, handling RFC 4180 quoting.
 * Returns an array of field strings (quotes stripped, trimmed).
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse a full CSV string into an array of string-array rows.
 * Skips blank lines. First row is the header (returned as row 0).
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trimEnd(); // preserve internal spaces
    if (trimmed.length === 0) continue;
    rows.push(parseCSVLine(trimmed));
  }
  return rows;
}

// ── ZIP extractor (node built-in: zlib) ─────────────────────────────────────

import { inflateRawSync } from 'node:zlib';

/**
 * Synchronous CSV extractor from a ZIP buffer.
 * Walks local file headers; handles stored (0) and deflated (8) compression.
 */
function extractCsvFromZipSync(zipBuffer) {
  let offset = 0;

  while (offset + 30 < zipBuffer.length) {
    const sig = zipBuffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // Not a local file header

    const gpFlag       = zipBuffer.readUInt16LE(offset + 6);
    const compression  = zipBuffer.readUInt16LE(offset + 8);
    const compSize     = zipBuffer.readUInt32LE(offset + 18);

    // General-purpose bit 3 (0x08) = streamed entry: the local-header comp/uncomp
    // sizes are 0 and the real sizes live in a trailing data descriptor. This extractor
    // reads sizes from the local header, so it would mis-extract an empty buffer. Fail
    // loudly rather than silently gapping every city (WR-03).
    if (gpFlag & 0x08) {
      const fnLenPeek = zipBuffer.readUInt16LE(offset + 26);
      const namePeek  = zipBuffer.slice(offset + 30, offset + 30 + fnLenPeek).toString('utf8');
      throw new Error(`ZIP entry ${namePeek} uses a data descriptor (streamed); compSize is in the trailing descriptor and is unsupported by this extractor.`);
    }
    const uncompSize   = zipBuffer.readUInt32LE(offset + 22);
    const fnLen        = zipBuffer.readUInt16LE(offset + 26);
    const extraLen     = zipBuffer.readUInt16LE(offset + 28);
    const fileName     = zipBuffer.slice(offset + 30, offset + 30 + fnLen).toString('utf8');

    const dataStart    = offset + 30 + fnLen + extraLen;
    const compressedData = zipBuffer.slice(dataStart, dataStart + compSize);

    if (fileName.toLowerCase().endsWith('.csv')) {
      let uncompressed;
      if (compression === 0) {
        uncompressed = compressedData;
      } else if (compression === 8) {
        uncompressed = inflateRawSync(compressedData);
      } else {
        throw new Error(`Unsupported ZIP compression method ${compression} for ${fileName}`);
      }
      return { fileName, data: uncompressed };
    }

    offset = dataStart + compSize;
  }

  throw new Error('No .csv file found in ZIP archive');
}

// ── GCC fetch layer ──────────────────────────────────────────────────────────

/**
 * Download the annual GCC City ZIP for a given year, extract the CSV,
 * parse it, and filter rows to the specified city name.
 *
 * Node 24's built-in fetch (undici) gets HTTP 403 from the GCC server due to
 * Cloudflare TLS fingerprint filtering (curl returns 200 with the same UA).
 * We use curl via execSync — same User-Agent, same URL, $0 cost, no new dep.
 *
 * @param {number} year  Calendar year (2009–2024)
 * @param {string} city  City name as it appears in EmployerName (e.g. "Irvine")
 * @returns {Array}      Filtered row arrays (one per employee-position record)
 */
async function fetchCityRows(year, city) {
  const url = GCC_ZIP_URL(year);
  console.log(`  Downloading ${url} ...`);

  // Node's fetch gets 403 (Cloudflare TLS fingerprint); curl with the browser
  // UA returns 200. Use execSync with a 120 s timeout and 100 MB buffer.
  let zipBuf;
  try {
    zipBuf = execSync(
      `curl -s -A "${GCC_UA}" "${url}"`,
      { maxBuffer: 100 * 1024 * 1024, timeout: 120_000 }
    );
  } catch (err) {
    throw new Error(`curl download failed for ${year}: ${err.message}`);
  }

  // Verify we got a real ZIP (not an HTML error page)
  if (zipBuf.length < 1000 || zipBuf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(
      `GCC returned non-ZIP response for ${year} (${zipBuf.length} bytes). ` +
      'The file may have moved or Cloudflare may have blocked the request.'
    );
  }

  console.log(`  Downloaded ${(zipBuf.length / 1024 / 1024).toFixed(1)} MB ZIP`);

  const { fileName, data } = extractCsvFromZipSync(zipBuf);
  const csvText = data.toString('utf8');
  console.log(`  Extracted ${fileName} (${(csvText.length / 1024 / 1024).toFixed(1)} MB)`);

  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    console.log(`  CSV is empty — no data for ${year}`);
    return [];
  }

  // Row 0 is header; skip it. Filter by EmployerName (case-insensitive exact match).
  const cityNorm = city.trim().toLowerCase();
  const filtered = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 21) continue; // Malformed / short row
    const employerName = (row[COL_EMPLOYER_NAME] || '').trim().toLowerCase();
    if (employerName === cityNorm) {
      filtered.push(row);
    }
  }

  console.log(`  ${filtered.length.toLocaleString()} records for ${city} in ${year}`);
  return filtered;
}

// ── Tree builder ─────────────────────────────────────────────────────────────

/**
 * Build the compact n/a/c/i Department → Position tree from GCC city rows.
 *
 * Position is always the leaf (D-01). No individual names — the GCC source
 * has no name columns, and the loader never exposes a names-on path.
 *
 * Total Compensation = TotalWages + TotalRetirementAndHealthContribution (D-02).
 * Zero-comp rows are skipped (mirrors LA County loader).
 *
 * Each position leaf carries a metadata object (D-03):
 *   avgBase        — average RegularPay per employee
 *   avgOvertimeOther — average (OvertimePay + LumpSumPay + OtherPay) per employee
 *   avgBenefits    — average TotalRetirementAndHealthContribution per employee
 *   count          — employee count for this position title in this department
 *
 * @param {Array[]} rows  Filtered GCC CSV rows for one city/year
 * @returns {{ tree: Object[], total: number }}
 */
function buildTree(rows) {
  const depts = new Map(); // dept name → Map<position name, posEntry>

  for (const row of rows) {
    const dept = normalizeDeptLabel(row[COL_DEPT]); // expand approved abbreviations + smart Title Case (D-01: no fabrication)
    const pos  = (row[COL_POSITION] || 'Unknown Position').trim() || 'Unknown Position';

    // D-02: Total Compensation = TotalWages + TotalRetirementAndHealthContribution
    const totalWages    = parseMoney(row[COL_TOTAL_WAGES]);
    const totalBenefits = parseMoney(row[COL_TOTAL_BENEFITS]);
    const totalComp     = totalWages + totalBenefits;

    // Skip zero-comp records (unpaid board members, partial-year officials, etc.)
    if (totalComp === 0) continue;

    // D-03 components
    const base  = parseMoney(row[COL_REGULAR_PAY]);
    const ot    = parseMoney(row[COL_OVERTIME_PAY]);
    const lump  = parseMoney(row[COL_LUMP_SUM_PAY]);
    const other = parseMoney(row[COL_OTHER_PAY]);
    const otOth = ot + lump + other;

    if (!depts.has(dept)) depts.set(dept, new Map());
    const posMap = depts.get(dept);

    if (!posMap.has(pos)) {
      posMap.set(pos, {
        total: 0,
        count: 0,
        sumBase: 0,
        sumOtOth: 0,
        sumBenefits: 0,
      });
    }
    const entry = posMap.get(pos);
    entry.total       += totalComp;
    entry.count       += 1;
    entry.sumBase     += base;
    entry.sumOtOth    += otOth;
    entry.sumBenefits += totalBenefits;
  }

  // Convert to compact n/a/c tree
  let grandTotal = 0;
  const tree = [];

  for (const [deptName, posMap] of depts) {
    let deptTotal = 0;
    const children = [];

    for (const [posName, entry] of posMap) {
      const count = entry.count;
      deptTotal += entry.total;

      // D-03 per-position metadata (averages)
      const m = {
        avgBase:          count > 0 ? Math.round(entry.sumBase     / count) : 0,
        avgOvertimeOther: count > 0 ? Math.round(entry.sumOtOth    / count) : 0,
        avgBenefits:      count > 0 ? Math.round(entry.sumBenefits / count) : 0,
        count,
      };

      // Position leaf: NO `i` array (D-01 — Position is the leaf, no names)
      children.push({
        n: `${posName} (${count})`,
        a: entry.total,
        m,
      });
    }

    children.sort((a, b) => b.a - a.a);
    grandTotal += deptTotal;
    tree.push({ n: deptName, a: deptTotal, c: children });
  }

  tree.sort((a, b) => b.a - a.a);
  return { tree, total: grandTotal };
}

// ── Supabase sync ─────────────────────────────────────────────────────────────

async function syncYear(municipalityId, year, rows, dryRun) {
  console.log(`\n  Building tree...`);
  const { tree, total } = buildTree(rows);

  const deptCount = tree.length;
  const posCount  = tree.reduce((s, d) => s + d.c.length, 0);
  const rowCount  = rows.length;

  console.log(`  ${deptCount} departments, ${posCount} positions, ${rowCount.toLocaleString()} employee records`);
  console.log(`  Total compensation: $${Math.round(total).toLocaleString()}`);

  if (dryRun) {
    console.log('  (dry run — skipping Supabase write)');
    console.log('  Top 5 departments:');
    for (const d of tree.slice(0, 5)) {
      console.log(`    ${d.n}: $${Math.round(d.a).toLocaleString()} (${d.c.length} positions)`);
    }
    return true;
  }

  console.log('  Syncing to Supabase...');
  const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id: municipalityId,
    p_fiscal_year:     year,
    p_dataset_type:    'salaries',
    p_total:           total,
    p_tree:            tree,
    p_row_count:       rowCount,
    p_data_source_name: DATA_SOURCE_NAME,
    // GCC is a W-2-based CALENDAR-year report, so month 1 — not the 7 the
    // RPC used to hardcode. Authority in lib/loaderFiscalCalendars.mjs.
    p_fiscal_year_start_month: monthForSource(DATA_SOURCE_NAME),
  });

  if (error) {
    console.error(`  RPC error: ${error.message}`);
    return false;
  }

  console.log(`  Inserted ${data?.rows_inserted ?? '?'} rows`);
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      city:      { type: 'string' },
      fy:        { type: 'string', short: 'y', multiple: true },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  const city = values.city ? values.city.trim() : null;
  if (!city) {
    console.error('\nUsage: node scripts/loadCASalaries.js --city <name> [--fy <year>] [--dry-run]');
    console.error('  --city     (required) California city name, e.g. "Irvine"');
    console.error('  --fy       Fiscal/calendar year(s) to load (repeatable); default: 2024');
    console.error('  --dry-run  Print computed totals without writing to Supabase\n');
    process.exit(1);
  }

  const fiscalYears = values.fy ? values.fy.map(Number) : [2024];
  // Reject non-numeric --fy up front (e.g. a letter-O typo) so a NaN year can't flow
  // into the GCC URL and surface as a confusing generic "Fetch error" (WR-04).
  if (fiscalYears.some(y => !Number.isInteger(y))) {
    console.error('--fy must be integer year(s), e.g. --fy 2024');
    process.exit(1);
  }
  const dryRun      = values['dry-run'] ?? false;

  console.log('\nCA Statewide City Salaries Loader');
  console.log(`  City         : ${city}`);
  console.log(`  Fiscal years : ${fiscalYears.join(', ')}`);
  console.log(`  Dry run      : ${dryRun}`);
  console.log(`  Source       : ${DATA_SOURCE_NAME}\n`);

  // Resolve municipality ID for the --city argument.
  // OC cities already exist (Phase 53/54) — RESOLVE ONLY, never create. We do a
  // read-only lookup against treasury.municipalities and FAIL CLOSED when there is
  // no exact (case-insensitive) pre-existing match. Using an ensure/upsert RPC here
  // would silently create a phantom municipality on a typo/wrong-state input and
  // write real GCC payroll into it (CR-01). A direct table read prevents that.
  const { data: muni, error: munErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id,name')
    .eq('state', 'CA')
    .eq('entity_type', 'city')
    .ilike('name', city) // exact-ish, case-insensitive — no wildcards
    .maybeSingle();
  if (munErr) {
    console.error('Municipality lookup failed:', munErr.message);
    process.exit(1);
  }
  if (!muni) {
    console.error(`Municipality "${city}" (CA) not found. Will NOT create. Aborting.`);
    process.exit(1);
  }
  const municipalityId = muni.id;
  console.log(`Resolved "${city}" → ${muni.name} (${municipalityId})`);

  // Track non-D-06 failures so a partially-loaded DB exits non-zero (WR-05). A "city
  // genuinely absent for that year" (D-06) is NOT a failure; a fetch/RPC error is.
  let hadFailures = false;

  for (const fy of fiscalYears) {
    console.log(`\nYear ${fy}`);
    let rows;
    try {
      rows = await fetchCityRows(fy, city);
    } catch (err) {
      console.error(`  Fetch error for ${fy}: ${err.message}`);
      hadFailures = true;
      continue;
    }

    if (rows.length === 0) {
      console.log(`  No records found for ${city} in ${fy} — skipping (D-06)`);
      continue;
    }

    const ok = await syncYear(municipalityId, fy, rows, dryRun);
    if (!ok) hadFailures = true;
  }

  if (hadFailures) {
    console.error('\nCompleted with failures — DB load is INCOMPLETE.');
    process.exit(1);
  }

  console.log('\nDone.\n');
}

// Run main() only when executed directly — not when imported (e.g. by sweepOCSalaries.js,
// which reuses normalizeDeptLabel so both scripts share one normalization source of truth).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  main().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
