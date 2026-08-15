/**
 * WA State Auditor ReportSearch client, generic over MCAG.
 *
 * NO SHEBANG, deliberately. This is a pure library -- it exports only and is
 * never executed directly. A `#!/usr/bin/env node` line here broke `npm test`
 * on any Windows checkout: git's core.autocrlf rewrites the file to CRLF, and
 * Vite's shebang strip matches `#!.*\n`, where `.` excludes `\r`. The shebang
 * therefore survived the transform and the file reached the parser starting
 * with `#`, failing the whole suite with a bare "SyntaxError: Invalid or
 * unexpected token" naming no line. The sibling `waSaoLoad.mjs` has no shebang
 * and never failed, which is what isolated it. Do not add one back; put
 * shebangs on entry-point scripts (`scripts/*.mjs` with a main guard), not on
 * anything a test imports.
 *
 * Endpoint facts, each established by probing and each load-bearing:
 *  - SearchReports reads `pageNumber`, NOT `page`.
 *  - SearchReports 500s unless ALL SEVEN of the boolean filters are present,
 *    even though six of them are irrelevant to a financial-report query.
 *  - Audit periods arrive as `/Date(<epoch-ms>)/`. String-slicing that format
 *    silently truncates; it must be parsed.
 *  - Plain curl/fetch with a browser UA is enough. No WAF fight, no Chromium.
 *
 * The report-type NAMES are inverted for FY2014+: the type literally called
 * "Annual Comprehensive Financial Report" is a 4-5 page auditor's opinion
 * letter, while "Financial and Federal" / "Financial" carries the full bound
 * statements. Never select by type name -- use classifyReport().
 */
const BASE = 'https://portal.sao.wa.gov/ReportSearch/Home';

export const SAO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Upgrade-Insecure-Requests': '1',
};

export function decodeMsDate(value) {
  if (typeof value !== 'string') return null;
  const m = /\/Date\((-?\d+)/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1])).getUTCFullYear();
}

export function entityLookupUrl(nameStartsWith) {
  const u = new URL(`${BASE}/GetEntities`);
  u.searchParams.set('NameStartsWith', nameStartsWith);
  return u.href;
}

export function searchReportsUrl(mcag, pageNumber = 1) {
  const u = new URL(`${BASE}/SearchReports`);
  u.searchParams.set('MCAGList', mcag);
  u.searchParams.set('pageNumber', String(pageNumber));
  // All seven are required or the endpoint 500s. Do not prune this list.
  for (const [k, v] of Object.entries({
    HasFindings: 'false', StateGovernment: 'false', LocalGovernment: 'true',
    PerformanceAudits: 'false', SpecialInvestigations: 'false',
    UseOfDeadlyForceInvestigation: 'false', PoliceCertificationAudit: 'false',
  })) u.searchParams.set(k, v);
  return u.href;
}

export function reportFileUrl(arn) {
  const u = new URL(`${BASE}/ViewReportFile`);
  u.searchParams.set('arn', String(arn));
  u.searchParams.set('isFinding', 'false');
  u.searchParams.set('sp', 'false');
  return u.href;
}

const MIN_STATEMENT_PAGES = 40;

/**
 * Content guard. An opinion-letter-only report and an image-only scan are both
 * rejected here rather than downstream, so a bad year fails loudly at fetch
 * time instead of producing a plausible-looking empty extraction.
 *
 * The "Reconciliation of the Statement of Revenues, Expenditures..." line is
 * a decoy that appears in every report including the 4-page letters, so it is
 * excluded before the anchor test rather than after.
 */
export function classifyReport(pageCount, text) {
  if (!(pageCount >= MIN_STATEMENT_PAGES)) {
    return { ok: false, reason: `page count ${pageCount} < ${MIN_STATEMENT_PAGES} (opinion letter, not statements)` };
  }
  const anchored = String(text)
    .split('\n')
    .filter(l => !/reconciliation/i.test(l))
    .some(l => /statement of revenues,?\s+expenditures/i.test(l));
  if (!anchored) {
    return { ok: false, reason: 'no governmental funds statement anchor found (image-only scan?)' };
  }
  return { ok: true, reason: 'statements present' };
}

export async function fetchReportPdf(arn) {
  const res = await fetch(reportFileUrl(arn), { headers: SAO_HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ARN ${arn}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Magic-number check, not status code: a miss can answer 200 with HTML.
  if (buf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error(`ARN ${arn}: not a PDF (${buf.length}B)`);
  }
  return buf;
}
