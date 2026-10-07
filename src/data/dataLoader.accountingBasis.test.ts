import { describe, it, expect } from 'vitest';
import { transformAPIResponse } from './dataLoader';

/**
 * ⚠⚠ THE AXIS WAS BUILT AND THEN NEVER REACHED A READER.
 *
 * `accounting_basis` shipped as a database column, a registry, a stamper, a
 * vocabulary and a chip — and `src/data/dataLoader.ts` did not map it, so the
 * value stopped here and `ScopeLabel`'s `accountingBasis` prop was dead code.
 * Duvall's rows said `cash` in the database and said nothing at all on the
 * page.
 *
 * ⚠ The live API does not return the field YET (`ev-accounts-api` selects
 * budget columns one by one and has not been updated). That is exactly why
 * ABSENT must normalise to `unknown` rather than `undefined`: the frontend can
 * ship first, the chip renders nothing, and no reader is shown a claim that is
 * not there. It is the same contract `audit_grade` and `fund_scope` already
 * have, for the same reason.
 */
describe('transformAPIResponse — accounting_basis', () => {
  const row = (extra: Record<string, unknown> = {}) => ({
    id: 'b1', fiscal_year: 2024, dataset_type: 'revenue', total_budget: 7074922,
    data_source: 'WA State Auditor — Duvall Annual Financial Report FY2024 (General Fund, Revenue by Source)',
    ...extra,
  });

  it('carries a cash basis through to the metadata', () => {
    const out = transformAPIResponse(row({ accounting_basis: 'cash' }), []);
    expect(out.metadata.accountingBasis).toBe('cash');
  });

  it('carries gaap and modified_cash through unchanged', () => {
    expect(transformAPIResponse(row({ accounting_basis: 'gaap' }), []).metadata.accountingBasis)
      .toBe('gaap');
    expect(transformAPIResponse(row({ accounting_basis: 'modified_cash' }), []).metadata.accountingBasis)
      .toBe('modified_cash');
  });

  it('reads an ABSENT field as unknown, never undefined', () => {
    // ⚠ This is the live case today and will be until the API ships the
    // column. `undefined` would make the chip's `!= null` guard pass and then
    // index ACCOUNTING_BASIS_COPY with undefined.
    const out = transformAPIResponse(row(), []);
    expect(out.metadata.accountingBasis).toBe('unknown');
  });

  it('reads null and an unrecognised value as unknown, never as a claim', () => {
    // ⚠⚠ NEVER INVENT A BASIS. A value this build does not recognise must
    // degrade to "not established" — asserting a measurement basis TT has not
    // read is the precise thing this axis exists to prevent.
    expect(transformAPIResponse(row({ accounting_basis: null }), []).metadata.accountingBasis)
      .toBe('unknown');
    expect(transformAPIResponse(row({ accounting_basis: 'tax_basis' }), []).metadata.accountingBasis)
      .toBe('unknown');
    expect(transformAPIResponse(row({ accounting_basis: 42 }), []).metadata.accountingBasis)
      .toBe('unknown');
  });

  it('does not disturb the four axes already mapped', () => {
    const out = transformAPIResponse(row({
      accounting_basis: 'cash', fund_scope: 'general_fund', basis: 'actual',
      reporting_entity: 'primary_government', audit_grade: 'audited_ocboa',
    }), []);
    expect(out.metadata.fundScope).toBe('general_fund');
    expect(out.metadata.basis).toBe('actual');
    expect(out.metadata.reportingEntity).toBe('primary_government');
    expect(out.metadata.auditGrade).toBe('audited_ocboa');
    expect(out.metadata.accountingBasis).toBe('cash');
  });
});
