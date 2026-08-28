import { describe, it, expect } from 'vitest';
import { planStamps } from '../scripts/stampAuditGrade.mjs';

const OH = 'Ohio Auditor of State Summarized Annual Financial Reports';
const MN = 'Minnesota Office of the State Auditor City/County Finances Report';
const SCO_EXP = 'CA State Controller - Expenditures';

describe('planStamps', () => {
  it('plans a stamp for a registered source with a source_url', () => {
    const out = planStamps([{ id: 'r1', data_source: OH, source_url: 'https://ohioauditor.gov/x.XLSX' }]);
    expect(out).toEqual([{ id: 'r1', audit_grade: 'self_reported_unaudited', entryId: 'oh-aos-summarized' }]);
  });

  it('plans stamps for the CA SCO series', () => {
    const out = planStamps([{ id: 'r2', data_source: SCO_EXP, source_url: 'https://bythenumbers.sco.ca.gov/x' }]);
    expect(out).toEqual([{ id: 'r2', audit_grade: 'self_reported_unaudited', entryId: 'ca-sco-city-exp' }]);
  });

  // ⚠ Refusing to stamp is the SAFE direction. A grade with no retrievable
  // document behind it is exactly what budgets_graded_rows_need_a_source_url
  // rejects at the database — this keeps the script from even attempting it.
  it('refuses to stamp a row with no source_url', () => {
    expect(planStamps([{ id: 'r3', data_source: OH, source_url: null }])).toEqual([]);
    expect(planStamps([{ id: 'r4', data_source: OH, source_url: '' }])).toEqual([]);
    expect(planStamps([{ id: 'r5', data_source: OH, source_url: '   ' }])).toEqual([]);
  });

  // ⚠ MN OSA is unverified, so it must NOT be stamped even though its rows are
  // otherwise perfectly good. Silence about assurance is the honest output.
  it('does not stamp the unverified MN OSA source', () => {
    expect(planStamps([{ id: 'r6', data_source: MN, source_url: 'https://osa.state.mn.us/x.xlsx' }]))
      .toEqual([]);
  });

  it('skips unregistered sources', () => {
    expect(planStamps([{ id: 'r7', data_source: 'Nope FY2026', source_url: 'https://x' }])).toEqual([]);
  });

  it('skips null and missing data_source', () => {
    expect(planStamps([{ id: 'r8', data_source: null, source_url: 'https://x' }])).toEqual([]);
    expect(planStamps([{ id: 'r9', source_url: 'https://x' }])).toEqual([]);
  });

  it('handles a mixed batch, keeping only the stampable rows', () => {
    const out = planStamps([
      { id: 'a', data_source: OH, source_url: 'https://x' },
      { id: 'b', data_source: MN, source_url: 'https://x' },
      { id: 'c', data_source: OH, source_url: null },
      { id: 'd', data_source: SCO_EXP, source_url: 'https://y' },
    ]);
    expect(out.map((r) => r.id)).toEqual(['a', 'd']);
  });

  it('is a pure function — it does not mutate its input', () => {
    const rows = [{ id: 'r10', data_source: OH, source_url: 'https://x' }];
    const snapshot = JSON.parse(JSON.stringify(rows));
    planStamps(rows);
    expect(rows).toEqual(snapshot);
  });

  it('returns an empty plan for an empty batch', () => {
    expect(planStamps([])).toEqual([]);
  });
});
