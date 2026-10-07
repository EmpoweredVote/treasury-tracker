import { describe, it, expect } from 'vitest';
import { planStamps } from '../scripts/stampAccountingBasis.mjs';

const REDMOND = 'WA State Auditor — Redmond Annual Financial Report FY2024 (General Fund, Revenue by Source)';
const DUVALL = 'WA State Auditor — Duvall Annual Financial Report FY2024 (General Fund, Revenue by Source)';
const BROWN = 'Brown County ACFR — General Fund Revenue by Source (FY2023 actual, modified cash basis)';

const row = (over = {}) => ({
  id: 'r1', data_source: REDMOND, source_url: 'https://portal.sao.wa.gov/x', accounting_basis: 'unknown', ...over,
});

describe('planStamps', () => {
  it('stamps a matched, sourced row', () => {
    const out = planStamps([row()]);
    expect(out).toEqual([{ id: 'r1', accounting_basis: 'gaap', entryId: 'wa-sao-gaap' }]);
  });

  it('stamps Duvall cash, never gaap', () => {
    const out = planStamps([row({ id: 'd1', data_source: DUVALL })]);
    expect(out[0].accounting_basis).toBe('cash');
  });

  it('distinguishes modified cash from cash', () => {
    const out = planStamps([row({ id: 'b1', data_source: BROWN })]);
    expect(out[0].accounting_basis).toBe('modified_cash');
  });

  // ⚠⚠ A basis claim whose justifying document cannot be retrieved is an
  // unfalsifiable statement about a government's books. stampAuditGrade
  // refuses the same way, and the database enforces it for grades.
  it('REFUSES a row with no source_url, however well it matches', () => {
    expect(planStamps([row({ source_url: null })])).toEqual([]);
    expect(planStamps([row({ source_url: '' })])).toEqual([]);
    expect(planStamps([row({ source_url: '   ' })])).toEqual([]);
  });

  // ⚠ Sources absent from the registry are LEFT ALONE, not defaulted. Silence
  // about measurement is the honest output — and a bulk default is the exact
  // failure this axis exists to prevent.
  it('leaves an unmatched source alone rather than defaulting it', () => {
    expect(planStamps([row({ data_source: 'Ohio AOS — whatever' })])).toEqual([]);
    expect(planStamps([row({ data_source: null })])).toEqual([]);
  });

  it('never emits the unknown value — that would be a write with no meaning', () => {
    const out = planStamps([row(), row({ id: 'd1', data_source: DUVALL }), row({ id: 'x', data_source: 'nope' })]);
    expect(out.every((p) => p.accounting_basis !== 'unknown')).toBe(true);
  });

  it('is pure — it does not mutate its input', () => {
    const input = [row()];
    const before = JSON.stringify(input);
    planStamps(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
