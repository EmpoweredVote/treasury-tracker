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

// ⚠⚠ A CASH-BASIS BARS FILER IS A SMALL DOCUMENT. Duvall's ten filings run
// 27-34 pages (54 for the biennial one, which carries two years), against
// 76-188 for a GAAP city. 40 rejected every single one of them. This floor
// applies ONLY to the BARS caption, so a GAAP city's 33-page opinion letter is
// still refused at 40 -- that asymmetry is the whole point and is tested.
const MIN_BARS_STATEMENT_PAGES = 20;

// The GAAP caption. Every WA city in this roster except Duvall prints it.
const GAAP_ANCHOR = /statement of revenues,?\s+expenditures/i;

// The BARS regulatory-basis caption. ⚠ `Fiduciary Fund Resources and Uses
// Arising from Cash Transactions` is printed in EVERY Duvall report and is a
// different statement reporting custodial money. It is excluded by line, the
// same way the Reconciliation decoy is, rather than being allowed to qualify a
// document that carries no governmental-funds statement at all.
const BARS_ANCHOR = /fund resources and uses arising from cash transactions/i;

/**
 * Content guard. An opinion-letter-only report and an image-only scan are both
 * rejected here rather than downstream, so a bad year fails loudly at fetch
 * time instead of producing a plausible-looking empty extraction.
 *
 * The "Reconciliation of the Statement of Revenues, Expenditures..." line is
 * a decoy that appears in every report including the 4-page letters, so it is
 * excluded before the anchor test rather than after.
 *
 * ⚠ THE ANCHOR DECIDES THE FLOOR, not the other way round. Checking the page
 * count first would reject a BARS filing before anything ever looked at what
 * it is -- which is exactly what happened to all ten of Duvall's.
 */
export function classifyReport(pageCount, text) {
  const lines = String(text).split('\n');

  // ⚠⚠ THE QUALIFIER IS READ FROM THE ANCHOR LINE *PLUS THE LINE ABOVE IT*.
  //
  // Both captions this function must refuse are STACKED on the page --
  // `Fiduciary` over `Fund Resources and Uses...`, `Reconciliation of the` over
  // `Statement of Revenues...`. Whether the qualifier ends up on the same
  // extracted line as the anchor is a property of the TEXT LAYER, not of the
  // document: `pdftotext` splits one stacked caption differently between
  // issuers, and between years of the same issuer.
  //
  // Read per-line, both exclusions are defeated by a wrap, and the failure is
  // silent and expensive -- custodial money published under a General Fund
  // label, or a reconciliation schedule read as the statement. Both tie at $0.
  //
  // ⚠ The window is ONE line, deliberately. It is wide enough for a two-line
  // stacked caption and narrow enough that an unrelated earlier line cannot
  // disqualify a real statement. A document whose statement appears more than
  // once (contents page and the statement itself) still matches at the real
  // occurrence, because every line is tested.
  const caption = (i) => `${lines[i - 1] ?? ''} ${lines[i]}`;
  const anchoredBy = (re, disqualifier) =>
    lines.some((l, i) => re.test(l) && !disqualifier.test(caption(i)));

  const gaap = anchoredBy(GAAP_ANCHOR, /reconciliation/i);
  // ⚠ `reconciliation` disqualifies the BARS anchor too: the original filtered
  // those lines out before EITHER test, and narrowing that here would be an
  // unrelated behaviour change smuggled into a wrap fix.
  const bars = anchoredBy(BARS_ANCHOR, /fiduciary|reconciliation/i);
  if (!gaap && !bars) {
    return { ok: false, reason: 'no governmental funds statement anchor found (image-only scan?)' };
  }
  // A document carrying the GAAP caption is held to the GAAP floor even if it
  // also carries the BARS one: the stricter floor wins, never the looser.
  const floor = gaap ? MIN_STATEMENT_PAGES : MIN_BARS_STATEMENT_PAGES;
  if (!(pageCount >= floor)) {
    return { ok: false, reason: `page count ${pageCount} < ${floor} (opinion letter, not statements)` };
  }
  return { ok: true, reason: gaap ? 'statements present' : 'BARS cash-basis statements present' };
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
