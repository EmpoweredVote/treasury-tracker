#!/usr/bin/env node
/**
 * Florida DFS — LOGERx public system-report fetcher (Knight campaign, session 3).
 *
 * Florida's Department of Financial Services publishes every local government's
 * Annual Financial Report through LOGERx (Local Government Electronic Reporting
 * in XBRL). The recon for this session is written up in
 * `.planning/KNIGHT-COMMUNITIES-PROGRESS.md`; the two facts this fetcher exists
 * to exploit are:
 *
 *   1. The AFR data is `compiled_from_audited` for entities that filed an audit —
 *      DFS staff "reconciles the AFR to the provided audited financial
 *      statements" before the filing becomes *Verified by DFS*.
 *   2. The public reports are reachable by an ANONYMOUS POST. No key, no login,
 *      no ToS gate, no stateful session — unlike the Colorado DOLA shape.
 *
 * ── THE ENDPOINT ────────────────────────────────────────────────────────────
 *
 *   POST https://logerx.myfloridacfo.gov/api/document/systemReport
 *   {"afrYear":2023,"reportFormat":"EXCEL","reportName":"REVENUEDETAILREPORT"}
 *   -> {"mimeType":"application/vnd...sheet","content":"<base64 xlsx>","documentId":null}
 *
 * `reportFormat` is an enum — EXCEL | PDF | XHTML | IXBRL. "XLSX" is rejected
 * with a GraphQL variable error, which is why the constant below is EXCEL.
 *
 * ── ⚠ WHAT IS RECORDED AS `source_url` ──────────────────────────────────────
 *
 * There is NO durable URL for a generated report — the bytes come from a POST
 * with a JSON body, and the response carries no document id. The stable
 * first-party citation is therefore the public reports page a human would use to
 * regenerate the very same workbook:
 *
 *   https://logerx.myfloridacfo.gov/LogerX/PublicReportsMenu
 *
 * This is the same choice made for Mecklenburg County's Widen DAM in session 2,
 * where signed expiring links were the only byte source and the portal asset
 * page was cited instead. The exact request that produced each file is recorded
 * in the manifest so the citation is reproducible rather than merely plausible.
 *
 * ── ⚠ ADMIN-FLAGGED REPORTS ARE NOT FETCHED ─────────────────────────────────
 *
 * `adminOnly` in the LOGERx bundle is a UI flag, not an access control: the
 * `*UNCERTIFIED` variants ("includes unverified data") answer anonymously too.
 * They are deliberately NOT in REPORTS below. TT loads the public, verified
 * reports — that is both the right data and the right boundary.
 *
 * ── ⚠ WHY BOTH COMPLIANCE REPORTS ARE FETCHED ───────────────────────────────
 *
 * The audit flag that decides a row's `audit_grade` lives in the compliance
 * reports' `Audit Received Date` / `Audit Completion Date` columns. Fetching
 * only `PUBLICCOMPLIANTGOVS` would be a silent defect: it lists entities that
 * filed WITHIN the nine-month deadline. A late filer is in
 * `PUBLICNONCOMPLIANTGOVS` instead — 571 entities in FY2023 — and those rows
 * carry audit dates just the same. Reading only the compliant report would grade
 * every late-but-audited government down to the DEW branch. The two are UNIONED.
 *
 * Usage:
 *   node scripts/fetchFloridaDFS.mjs --from 2012 --to 2025
 *   node scripts/fetchFloridaDFS.mjs --year 2023 --reports EXPENDITUREDETAILREPORT
 *   node scripts/fetchFloridaDFS.mjs --from 2012 --to 2025 --out docs/fl-dfs
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const API_BASE = 'https://logerx.myfloridacfo.gov/api';
export const SYSTEM_REPORT_ENDPOINT = `${API_BASE}/document/systemReport`;

/**
 * The durable, first-party citation for every row this campaign loads from DFS.
 * See the header note — a generated report has no URL of its own.
 */
export const SOURCE_URL = 'https://logerx.myfloridacfo.gov/LogerX/PublicReportsMenu';

/** `reportFormat` is a server-side enum; EXCEL is the only one we parse. */
export const REPORT_FORMAT = 'EXCEL';

/**
 * The public (`adminOnly: false`) reports this campaign uses.
 *
 * `from` is the publisher's own `effectiveYear` for that report, read out of the
 * LOGERx bundle's report catalogue. Requesting a year below it is not an error —
 * it returns an empty or partial workbook — so the range is enforced here rather
 * than discovered by a confusing parse failure downstream.
 */
export const REPORTS = {
  REVENUEDETAILREPORT:    { from: 2012, note: 'Revenue by account x fund, all entities' },
  EXPENDITUREDETAILREPORT:{ from: 2012, note: 'Expenditure by function x object x fund' },
  TOTALREVEXPDEBT:        { from: 2012, note: 'Per-entity total revenues, expenditures, debt — the ORACLE' },
  PUBLICCOMPLIANTGOVS:    { from: 2012, note: 'On-time filers: AFR + audit receipt dates, FYE' },
  PUBLICNONCOMPLIANTGOVS: { from: 2012, note: 'Late filers: same columns — MUST be unioned with the above' },
};

/** Latest fiscal year LOGERx will answer for. Beyond this the workbook is empty. */
export const MAX_YEAR = 2025;

/**
 * Fetch one system report and return its raw bytes.
 *
 * Throws on a non-200, on a GraphQL validation error (which arrives as HTTP 500
 * with a `message` naming the offending variable), and on a response with no
 * `content` — all three are failures that must not be mistaken for an empty year.
 *
 * @param {string} reportName
 * @param {number} afrYear
 * @param {{fetchImpl?: typeof fetch, timeoutMs?: number}} [opts]
 * @returns {Promise<{bytes: Buffer, mimeType: string, payload: object}>}
 */
export async function fetchSystemReport(reportName, afrYear, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const payload = { afrYear: Number(afrYear), reportFormat: REPORT_FORMAT, reportName };

  const res = await fetchImpl(SYSTEM_REPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  });

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch {
    throw new Error(`${reportName} FY${afrYear}: response was not JSON (HTTP ${res.status})`);
  }

  // A GraphQL validation failure arrives as HTTP 500 with a useful `message`.
  if (!res.ok || body.code) {
    const msg = String(body.message || `HTTP ${res.status}`).split('\n')[0];
    throw new Error(`${reportName} FY${afrYear}: ${msg}`);
  }
  if (!body.content) {
    throw new Error(`${reportName} FY${afrYear}: response carried no content`);
  }

  return { bytes: Buffer.from(body.content, 'base64'), mimeType: body.mimeType || '', payload };
}

/**
 * XLSX files are ZIP archives. A truncated or error-page response would still
 * base64-decode, so the magic bytes are checked before anything is written —
 * the session-2 rule that a fetch which cannot be proven good is not kept.
 */
export function assertXlsx(bytes, label) {
  if (bytes.length < 1024) throw new Error(`${label}: only ${bytes.length} bytes — not a workbook`);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error(`${label}: missing PK zip magic — not an XLSX`);
  }
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** `docs/*` is gitignored, so cached workbooks stay out of the repo by default. */
export const DEFAULT_OUT_DIR = 'docs/fl-dfs';
export const MANIFEST_PATH = 'scripts/data/floridaDfsDatasets.json';

export function fileNameFor(reportName, year) {
  return `${reportName}-${year}.xlsx`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      from:    { type: 'string' },
      to:      { type: 'string' },
      year:    { type: 'string' },
      reports: { type: 'string' },
      out:     { type: 'string' },
      force:   { type: 'boolean' },
    },
  });

  const out = values.out || DEFAULT_OUT_DIR;
  const names = values.reports ? values.reports.split(',').map((s) => s.trim()) : Object.keys(REPORTS);
  for (const n of names) {
    if (!REPORTS[n]) {
      console.error(`Unknown report "${n}". Known: ${Object.keys(REPORTS).join(', ')}`);
      process.exit(1);
    }
  }

  const from = values.year ? Number(values.year) : Number(values.from || 2012);
  const to   = values.year ? Number(values.year) : Number(values.to   || MAX_YEAR);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    console.error('Required: --from <YYYY> --to <YYYY>, or --year <YYYY>');
    process.exit(1);
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(root, out);
  mkdirSync(outDir, { recursive: true });

  const manifestPath = join(root, MANIFEST_PATH);
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { source: 'Florida Department of Financial Services — LOGERx public system reports',
        source_url: SOURCE_URL, endpoint: SYSTEM_REPORT_ENDPOINT, datasets: [] };

  const fetchedAt = new Date().toISOString().slice(0, 10);
  let wrote = 0, skipped = 0;

  for (const reportName of names) {
    for (let year = Math.max(from, REPORTS[reportName].from); year <= Math.min(to, MAX_YEAR); year++) {
      const label = `${reportName} FY${year}`;
      const dest = join(outDir, fileNameFor(reportName, year));
      if (existsSync(dest) && !values.force) { skipped++; continue; }

      let got;
      try {
        got = await fetchSystemReport(reportName, year, { timeoutMs: 300_000 });
        assertXlsx(got.bytes, label);
      } catch (e) {
        console.error(`  FAIL ${label}: ${e.message}`);
        continue;
      }

      writeFileSync(dest, got.bytes);
      const digest = sha256(got.bytes);
      const idx = manifest.datasets.findIndex((d) => d.report === reportName && d.fiscal_year === year);
      const entry = {
        report: reportName,
        fiscal_year: year,
        file: `${out}/${fileNameFor(reportName, year)}`,
        bytes: got.bytes.length,
        sha256: digest,
        request: got.payload,
        url: SOURCE_URL,
        fetched: fetchedAt,
      };
      if (idx >= 0) manifest.datasets[idx] = entry; else manifest.datasets.push(entry);
      wrote++;
      console.log(`  ok   ${label}  ${(got.bytes.length / 1024).toFixed(0)} KiB  ${digest.slice(0, 12)}`);
    }
  }

  manifest.datasets.sort((a, b) => a.report.localeCompare(b.report) || a.fiscal_year - b.fiscal_year);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n${wrote} fetched, ${skipped} already present. Manifest: ${MANIFEST_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
