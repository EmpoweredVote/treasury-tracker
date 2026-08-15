import { describe, it, expect } from 'vitest';
import {
  decodeMsDate, searchReportsUrl, entityLookupUrl, reportFileUrl, classifyReport,
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
