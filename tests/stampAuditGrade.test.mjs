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

  /**
   * ⚠⚠ MN OSA WAS unverified and unstamped; as of 2026-09-04 it is a BRANCHING
   * entry — the audit duty follows the entity's statutory class, not the source
   * string. `planStamps` therefore has to pass the row's entity context through.
   */
  it('stamps MN OSA per BRANCH, using the entity context on the row', () => {
    const url = 'https://osa.state.mn.us/x.xlsx';
    const plan = (context) => planStamps([{ id: 'r6', data_source: MN, source_url: url, context }])[0];

    // § 6.481 subd. 2 — a county audit is unconditional.
    expect(plan({ entityType: 'county', name: 'Ramsey', fiscalYear: 2021 }).audit_grade)
      .toBe('compiled_from_audited');
    // § 471.697(c) — a city over 2,500 files audited statements with the OSA.
    expect(plan({ entityType: 'city', name: 'Duluth', fiscalYear: 2021 }).audit_grade)
      .toBe('compiled_from_audited');
    // § 471.698 — a fifth-class city has NO audit duty at all.
    expect(plan({ entityType: 'city', name: 'Ada', fiscalYear: 2021 }).audit_grade)
      .toBe('self_reported_unaudited');
  });

  /**
   * ⚠⚠ THE DIRECTION THAT MATTERS. A row reaching the stamper WITHOUT context —
   * an older caller, a municipality that failed to join — must never be graded
   * `compiled_from_audited`. It falls to the weaker branch, so the worst case is
   * under-stating assurance.
   */
  it('never grades an MN row audited without the evidence to support it', () => {
    const rows = [
      { id: 'n1', data_source: MN, source_url: 'https://x' },                       // no context
      { id: 'n2', data_source: MN, source_url: 'https://x', context: null },
      { id: 'n3', data_source: MN, source_url: 'https://x',
        context: { entityType: 'city', name: 'Nowhere', fiscalYear: 2021 } },
      { id: 'n4', data_source: MN, source_url: 'https://x',
        context: { entityType: 'city', name: 'Ada', fiscalYear: 1875 } },
    ];
    for (const r of planStamps(rows)) expect(r.audit_grade).toBe('self_reported_unaudited');
    expect(planStamps(rows)).toHaveLength(4);
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
    // ⚠ 'b' is now KEPT — MN classifies since 2026-09-04, at its weaker branch
    // because this row carries no entity context.
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'd']);
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
