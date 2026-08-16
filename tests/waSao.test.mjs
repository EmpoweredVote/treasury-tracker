import { describe, it, expect, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeMsDate, searchReportsUrl, entityLookupUrl, reportFileUrl, classifyReport,
  fetchReportPdf,
} from '../scripts/lib/waSao.mjs';

describe('decodeMsDate', () => {
  it('decodes a /Date(ms)/ string to its year', () => {
    // 2024-01-01T00:00:00Z
    expect(decodeMsDate('/Date(1704067200000)/')).toBe(2024);
  });
  it('decodes a negative (pre-1970) epoch without throwing', () => {
    expect(decodeMsDate('/Date(-86400000)/')).toBe(1969);
  });
  it('returns null for a non-date string rather than guessing', () => {
    expect(decodeMsDate('2024-01-01')).toBeNull();
    expect(decodeMsDate(null)).toBeNull();
  });
});

describe('searchReportsUrl', () => {
  // The endpoint 500s unless ALL SEVEN booleans are present, and it reads
  // `pageNumber`, not `page`. Both facts are load-bearing, so they are asserted.
  const REQUIRED = ['HasFindings', 'StateGovernment', 'LocalGovernment',
    'PerformanceAudits', 'SpecialInvestigations',
    'UseOfDeadlyForceInvestigation', 'PoliceCertificationAudit'];

  it('includes all seven required boolean params', () => {
    const u = new URL(searchReportsUrl('0461'));
    for (const k of REQUIRED) expect(u.searchParams.has(k)).toBe(true);
  });
  it('uses pageNumber, not page', () => {
    const u = new URL(searchReportsUrl('0461'));
    expect(u.searchParams.get('pageNumber')).toBe('1');
    expect(u.searchParams.has('page')).toBe(false);
  });
  it('passes the MCAG via MCAGList', () => {
    expect(new URL(searchReportsUrl('0132')).searchParams.get('MCAGList')).toBe('0132');
  });
});

describe('entityLookupUrl / reportFileUrl', () => {
  it('builds the entity lookup with the name as a query param', () => {
    expect(new URL(entityLookupUrl('Kitsap County')).searchParams.get('NameStartsWith'))
      .toBe('Kitsap County');
  });
  it('builds the report file url with isFinding=false', () => {
    const u = new URL(reportFileUrl(1040282));
    expect(u.searchParams.get('arn')).toBe('1040282');
    expect(u.searchParams.get('isFinding')).toBe('false');
  });
});

describe('classifyReport', () => {
  // SAO's report-type NAMES are inverted for FY2014+: the type called
  // "Annual Comprehensive Financial Report" is a 4-5pp opinion letter while
  // "Financial and Federal" carries the statements. So selection is by
  // CONTENT. This is the guard that would have caught King County in v2.21.
  const STMT = 'Statement of Revenues, Expenditures, and Changes in Fund Balance\n'
             + 'Governmental Funds\nTotal Revenues 24,379,173';

  it('accepts a long report containing a governmental funds statement', () => {
    expect(classifyReport(76, STMT).ok).toBe(true);
  });
  it('rejects a short opinion letter even if it mentions the statement', () => {
    expect(classifyReport(4, STMT).ok).toBe(false);
    expect(classifyReport(4, STMT).reason).toMatch(/page count/i);
  });
  it('rejects a long report with no statement anchor (an image-only scan)', () => {
    const r = classifyReport(52, 'Independent Auditor\'s Report');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/statement/i);
  });
  it('does not accept a Reconciliation line as the statement anchor', () => {
    const r = classifyReport(80,
      'Reconciliation of the Statement of Revenues, Expenditures and Changes in Fund Balance');
    expect(r.ok).toBe(false);
  });
});

describe('fetchReportPdf', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  // A WAF/redirect miss can answer 200 with an HTML page instead of a PDF.
  // The magic-number check must catch that even though the status is ok.
  it('throws when the server answers HTTP 200 with an HTML body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from('<html><body>Not found</body></html>'),
    });
    await expect(fetchReportPdf(1234567)).rejects.toThrow(/not a PDF/i);
  });

  it('throws on a non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchReportPdf(1234567)).rejects.toThrow(/HTTP 404/);
  });

  it('resolves with the buffer when the body is a real PDF', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from('%PDF-1.4 fake but valid magic bytes'),
    });
    const buf = await fetchReportPdf(1234567);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
});

/**
 * REGRESSION GUARD for a whole-suite outage, not a style preference.
 *
 * `scripts/lib/waSao.mjs` shipped with a `#!/usr/bin/env node` line. On a
 * Windows checkout git's core.autocrlf rewrites the file to CRLF, and Vite's
 * shebang strip matches `#!.*\n` -- `.` does not match `\r`, so the shebang
 * survived, the parser saw a leading `#`, and EVERY test in this file
 * disappeared behind a bare "SyntaxError: Invalid or unexpected token" that
 * named no file position. It cost a real debugging session to localise, and it
 * would have hit any fresh clone on Windows.
 *
 * ⚠ THE ORIGINAL SCOPE WAS TOO NARROW, AND IT LET THE SAME BUG THROUGH AGAIN.
 * This guard covered `scripts/lib/` only, and explicitly exempted entry-point
 * scripts "with a main guard" on the reasoning that nothing imports them. Task 13
 * then imported `scripts/loadWaCitiesEnrichment.mjs` for its pure guard functions,
 * its shebang survived the merge to `main`, and 14 tests vanished from a suite that
 * still reported "passed" -- the branch green, `main` not, exactly as before.
 *
 * The directory was only ever a proxy. The real invariant is: NO .mjs FILE THAT A
 * TEST IMPORTS MAY START WITH `#!`. That is derived below from the test files'
 * own import statements rather than hard-coded, so it cannot rot the way an
 * allowlist would, and it extends automatically to a file the moment a test
 * starts importing it.
 */
describe('no module a test imports starts with a shebang', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));

  it('scripts/lib modules never carry one (they are libraries, never executed)', () => {
    const libDir = path.join(root, 'scripts', 'lib');
    const offenders = readdirSync(libDir)
      .filter((f) => f.endsWith('.mjs'))
      .filter((f) => readFileSync(path.join(libDir, f), 'utf8').startsWith('#!'));
    expect(offenders).toEqual([]);
  });

  it('nor does any module imported by a test, wherever it lives', () => {
    const testDir = path.join(root, 'tests');
    const imported = new Set();
    for (const f of readdirSync(testDir).filter((x) => /\.(test\.)?mjs$/.test(x))) {
      const src = readFileSync(path.join(testDir, f), 'utf8');
      for (const m of src.matchAll(/from\s+'(\.\.?\/[^']+)'/g)) {
        const resolved = path.resolve(testDir, m[1]);
        if (resolved.endsWith('.mjs')) imported.add(resolved);
      }
    }
    // The set must be non-empty, or this test passes vacuously.
    expect(imported.size).toBeGreaterThan(0);
    const offenders = [...imported]
      .filter((p) => existsSync(p) && readFileSync(p, 'utf8').startsWith('#!'))
      .map((p) => path.relative(root, p).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });
});
