import { describe, it, expect } from 'vitest';
import { gradeFor, AUDIT_GRADE_REGISTRY } from '../scripts/data/auditGradeRegistry.mjs';
import { FUND_SCOPES, sourceNameFor } from '../scripts/loadNYCAcfrs.mjs';
import { NYC_FYS } from '../scripts/lib/nycAcfrSources.mjs';

describe('NYC rows are graded from the opinion that was actually read', () => {
  // ⚠ Every one of the 24 books was checked for an unmodified opinion by
  // scripts/verify-nyc-db.mjs CHECK 3. Without a registry entry those rows are
  // born `audit_grade = 'unknown'` and TT's largest city shows the same
  // assurance as an unverified self-reported PDF -- which spec section 6.2
  // explicitly says is not what shipped.
  it('grades every one of the 96 data_source strings as audited GAAP', () => {
    const ungraded = [];
    for (const fy of NYC_FYS) {
      for (const scope of FUND_SCOPES) {
        for (const mode of ['revenue', 'operating']) {
          const label = sourceNameFor(mode, fy, scope);
          const { value } = gradeFor(label);
          if (value !== 'audited_gaap') ungraded.push(`${label} -> ${value}`);
        }
      }
    }
    expect(ungraded).toEqual([]);
  });

  it('carries evidence naming the documents that were read', () => {
    // ⚠ `gradeFor` returns only {value, entryId}; the evidence lives on the
    // registry entry, so assert it there rather than inventing a contract.
    const { entryId } = gradeFor(sourceNameFor('revenue', 2024, 'general_fund'));
    expect(entryId).toBe('nyc-acfr');
    const entry = AUDIT_GRADE_REGISTRY.find((e) => e.id === 'nyc-acfr');
    expect(entry.evidence.document).toMatch(/ALL 24 documents \(FY2002-FY2025\)/);
    // The FY2018 interleaved opinion page is a known hazard; the evidence must
    // say so rather than imply 24 clean reads.
    expect(entry.evidence.document).toMatch(/FY2018/);
  });

  // ⚠ The window is pinned at BOTH ends. An unanchored prefix would also claim
  // a future NYC ACFR year whose opinion nobody has read -- the trap the
  // Charlotte entry documents.
  it('does NOT claim a year outside the window that was read', () => {
    const future = 'New York City ACFR — General Fund Revenue by Source (FY2026 actual, GAAP basis)';
    expect(gradeFor(future).value).not.toBe('audited_gaap');
    const before = 'New York City ACFR — General Fund Revenue by Source (FY2001 actual, GAAP basis)';
    expect(gradeFor(before).value).not.toBe('audited_gaap');
  });
});
