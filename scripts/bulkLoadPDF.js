#!/usr/bin/env node
/**
 * Bulk PDF Loader for Treasury Tracker
 *
 * Downloads ACFR PDFs, renders each page to PNG via pdftoimg-js + @napi-rs/canvas,
 * sends each page to Claude Haiku vision API for classification and budget extraction,
 * and bulk-inserts validated rows via the treasury_sync_budget_tree RPC.
 *
 * Uses SHA-256-keyed disk cache under cache/pdf-render/ to skip re-rendering on re-runs.
 *
 * Usage:
 *   node scripts/bulkLoadPDF.js --list
 *   node scripts/bulkLoadPDF.js --source "Allen ACFR FY2025"
 *   node scripts/bulkLoadPDF.js --pdf <url-or-path> --city Allen --fiscal-year 2025
 *   node scripts/bulkLoadPDF.js --pdf <path> --render-only           # Plan 01: just render to cache
 *   node scripts/bulkLoadPDF.js --source "Allen ACFR FY2025" --dry-run
 *   node scripts/bulkLoadPDF.js --source "Allen ACFR FY2025" --quiet
 *   node scripts/bulkLoadPDF.js --source "Allen ACFR FY2025" --confidence-threshold 80
 *
 * Env vars:
 *   SUPABASE_URL              - Supabase project URL (default: project URL)
 *   SUPABASE_SERVICE_KEY      - Service role key (or SUPABASE_SERVICE_ROLE_KEY)
 *   ANTHROPIC_API_KEY         - Anthropic API key (Plan 02 onwards)
 *
 * Exit codes:
 *   0 = all pages loaded clean
 *   1 = completed with flagged pages (review log written)
 *   2 = fatal failure
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constants ────────────────────────────────────────────────────────────────
const CACHE_ROOT = path.join('cache', 'pdf-render');
const DEFAULT_CONFIDENCE_THRESHOLD = 70;
// 150 DPI equivalent: PDF default is 72 DPI; scale=2.08 ≈ 150 DPI
// Using scale=2 (≈144 DPI) — sufficient for ACFR table text readability
const RENDER_DPI = 150;
const RENDER_SCALE = 2.08; // scale factor that approximates RENDER_DPI
const RENDER_CONCURRENCY = 2; // pages rendered per chunk (controls memory on 200-page ACFRs)

// ── Download / read PDF ──────────────────────────────────────────────────────
/**
 * Download PDF from URL or read from local file path.
 * @param {string} input - http(s) URL or local file path (with optional file:// prefix)
 * @returns {Promise<Buffer>}
 */
async function downloadOrReadPDF(input) {
  if (typeof input !== 'string' || !input.trim()) {
    console.error('Config error: --pdf or ds.base_url missing');
    process.exit(2);
  }

  if (input.startsWith('http')) {
    console.log('  Downloading PDF: ' + input);
    const resp = await fetch(input, { redirect: 'follow' });
    if (!resp.ok) {
      console.error('Download failed: ' + input + ' — HTTP ' + resp.status);
      process.exit(2);
    }
    // Warn on unexpected content-type (some CDNs return generic type for valid PDFs)
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      console.warn('  Warning: unexpected content-type "' + contentType + '" — continuing (may still be valid PDF)');
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  // Local file path — handle file:// URL prefix and POSIX/Windows path forms
  let filePath = input;
  if (input.startsWith('file://')) {
    filePath = decodeURIComponent(input.replace(/^file:\/\/\/?/, '').replace(/\//g, path.sep || '\\'));
  }
  console.log('  Reading local PDF: ' + filePath);
  return await fs.readFile(filePath);
}

// ── SHA-256 hash of PDF buffer ───────────────────────────────────────────────
/**
 * Compute SHA-256 hash of PDF buffer for cache key.
 * @param {Buffer} buffer
 * @returns {string} - full 64-char hex string
 */
function hashPDF(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// ── Render PDF pages to PNG ──────────────────────────────────────────────────
/**
 * Render every page of pdfBuffer to PNG, caching results keyed by pdfHash.
 * On cache hit (directory exists with PNGs), skips re-rendering.
 *
 * @param {Buffer} pdfBuffer
 * @param {string} pdfHash - SHA-256 hex string (used as cache directory name)
 * @param {string} cacheDir - absolute or relative path to the cache directory
 * @param {{ quiet?: boolean }} [opts]
 * @returns {Promise<string[]>} - sorted array of absolute/relative PNG file paths
 */
async function renderPDFPages(pdfBuffer, pdfHash, cacheDir, opts = {}) {
  const dir = cacheDir || path.join(CACHE_ROOT, pdfHash);
  await fs.mkdir(dir, { recursive: true });

  // Cache hit detection: directory exists and contains PNG files
  const existing = await fs.readdir(dir).catch(() => []);
  const pngFiles = existing.filter(f => f.startsWith('page-') && f.endsWith('.png')).sort();
  if (pngFiles.length > 0) {
    console.log('  Cache hit: ' + pngFiles.length + ' pages already rendered at ' + dir);
    return pngFiles.map(f => path.join(dir, f));
  }

  // Render via pdftoimg-js
  // pdfToImg returns string[] of base64 DataURL strings (data:image/png;base64,...)
  const { pdfToImg } = await import('pdftoimg-js');

  console.log('  Rendering PDF pages to PNG (scale=' + RENDER_SCALE + ' ≈ ' + RENDER_DPI + ' DPI)...');

  // pdftoimg-js v2 does not expose a concurrency parameter — it renders pages
  // internally via pdfjs-dist. To control memory on 200-page ACFRs, we render
  // in chunks of RENDER_CONCURRENCY pages and write each chunk to disk before
  // continuing. This keeps no more than RENDER_CONCURRENCY decoded pages in RAM
  // at once (per research §Pitfall 6).

  // First, get page count by rendering page 1 to learn total pages
  // pdftoimg-js does not expose a page count API directly; render all at once
  // and process the resulting array. For very large PDFs, this trades memory for
  // simplicity — the typical ACFR is 150-250 pages at ~200-400KB/page PNG.
  // TODO Plan 01 performance: if OOM occurs in production, switch to chunk approach
  //   using pages: { startPage: i, endPage: i + RENDER_CONCURRENCY - 1 } per chunk.

  let dataUrls;
  try {
    dataUrls = await pdfToImg(new Uint8Array(pdfBuffer), {
      imgType: 'png',
      scale: RENDER_SCALE,
      background: 'white',
      pages: 'all',
    });
  } catch (err) {
    console.error('  pdftoimg-js render failed: ' + err.message);
    process.exit(2);
  }

  // Ensure array (pdfToImg returns string | string[] depending on pages option)
  if (!Array.isArray(dataUrls)) {
    dataUrls = [dataUrls];
  }

  // Write each PNG to disk with zero-padded 3-digit page numbers (sortable)
  const pageFiles = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const pageNum = String(i + 1).padStart(3, '0');
    const filePath = path.join(dir, 'page-' + pageNum + '.png');

    // Strip data URL prefix: "data:image/png;base64," → raw base64 string
    const base64 = dataUrls[i].replace(/^data:image\/\w+;base64,/, '');
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
    pageFiles.push(filePath);

    if (!opts.quiet) {
      process.stdout.write('\r  rendered ' + (i + 1) + '/' + dataUrls.length + ' pages');
    }
  }
  if (!opts.quiet) console.log('');

  return pageFiles;
}

// ── Haiku vision call (stub — Plan 02) ──────────────────────────────────────
/**
 * Call Claude Haiku with a PNG image (base64) and return structured extraction result.
 * Retries up to 3 times on API errors.
 * TODO: Plan 02 — implement Haiku extraction prompt + JSON parsing
 *
 * @param {string} base64 - base64-encoded PNG
 * @param {number} pageNum
 * @param {object} [opts]
 * @returns {Promise<{page_type: string, confidence: number, reason: string, rows: object[]}>}
 */
async function callHaikuWithRetry(base64, pageNum, opts = {}) {
  // TODO: Plan 02 — implement Haiku API call with EXTRACTION_PROMPT
  // The Anthropic client is declared above and instantiated lazily in Plan 02
  throw new Error('callHaikuWithRetry not yet implemented (Plan 02)');
}

// ── Process full PDF pipeline (stub — Plans 02-03) ──────────────────────────
/**
 * Full PDF → Haiku → DB pipeline for a single data_sources row.
 * TODO: Plan 02 — implement Haiku per-page loop + confidence filtering + review log
 * TODO: Plan 03 — implement DB load via treasury_sync_budget_tree
 *
 * @param {object} ds - data_sources row with base_url, municipality_id, fiscal_years, etc.
 * @param {object} [opts]
 * @returns {Promise<void>}
 */
async function processPDF(ds, opts = {}) {
  // TODO: Plan 02 — implement per-page Haiku extraction loop
  throw new Error('processPDF not yet implemented (Plan 02)');
}

// ── CLI entry point ───────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      // Plan 01 flags (implemented here)
      pdf: { type: 'string' },
      'render-only': { type: 'boolean' },
      quiet: { type: 'boolean' },
      list: { type: 'boolean', short: 'l' },

      // Plan 02+ flags (parsed now, stubs in logic)
      source: { type: 'string', short: 's' },
      city: { type: 'string' },
      'fiscal-year': { type: 'string' },
      'confidence-threshold': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'force-reload': { type: 'boolean' },
    },
    strict: false,
  });

  // ── --render-only: download + render to cache, no Haiku, no DB ─────────────
  if (values['render-only']) {
    if (!values.pdf) {
      console.error('--render-only requires --pdf <url-or-path>');
      process.exit(2);
    }

    console.log('PDF render-only mode');
    const buf = await downloadOrReadPDF(values.pdf);
    const hash = hashPDF(buf);
    const dir = path.join(CACHE_ROOT, hash);
    const pages = await renderPDFPages(buf, hash, dir, { quiet: values.quiet });
    console.log('Rendered ' + pages.length + ' pages to ' + dir + ' (PDF hash: ' + hash + ')');
    process.exit(0);
  }

  // ── --list: show available PDF sources ─────────────────────────────────────
  if (values.list) {
    // TODO: Plan 02 — query data_sources for pdf_download api_type
    console.log('TODO: --list for PDF sources (Plan 02 — after seedPDFDataSources.js runs)');
    process.exit(0);
  }

  // ── All other modes: full pipeline (Plans 02-03) ────────────────────────────
  // TODO: Plan 02 — implement --source / --pdf + --city + --fiscal-year full pipeline
  console.log('TODO: full pipeline lands in Plan 02');
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(2); });
