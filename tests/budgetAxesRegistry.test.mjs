import { describe, it, expect } from 'vitest';
import { BASIS, BASIS_VALUES, REPORTING_ENTITY, REPORTING_ENTITY_VALUES, validateAxisRegistry, classifyAxis }
  from '../scripts/lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { REPORTING_ENTITY_REGISTRY } from '../scripts/data/reportingEntityRegistry.mjs';

const basisOf = (s) => classifyAxis(s, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).value;
const entityOf = (s) => classifyAxis(s, REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES, REPORTING_ENTITY.UNKNOWN).value;

describe('registries are well-formed', () => {
  it('basis registry validates', () => {
    expect(validateAxisRegistry(BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).ok).toBe(true);
  });
  it('reporting-entity registry validates', () => {
    expect(validateAxisRegistry(REPORTING_ENTITY_REGISTRY, REPORTING_ENTITY_VALUES, REPORTING_ENTITY.UNKNOWN).ok).toBe(true);
  });
});

describe('basis classification', () => {
  it('SCO is actual, all four strings', () => {
    expect(basisOf('CA State Controller - Expenditures')).toBe('actual');
    expect(basisOf('CA State Controller - Revenues')).toBe('actual');
    expect(basisOf('CA State Controller - County Expenditures')).toBe('actual');
    expect(basisOf('CA State Controller - County Revenues')).toBe('actual');
  });
  it('does NOT claim publicpay, which is a different SCO programme', () => {
    expect(basisOf('CA State Controller — Government Compensation in California (publicpay.ca.gov)'))
      .toBe('unknown');
  });
  it('city budget documents are adopted', () => {
    expect(basisOf('Long Beach General Fund Operating Budget FY2025')).toBe('adopted');
    expect(basisOf('Oakland General Purpose Fund Operating Budget FY2024')).toBe('adopted');
    expect(basisOf('Bakersfield Operating Budget FY2025')).toBe('adopted');
    expect(basisOf('Santa Ana General Fund Revenue Budget FY2023')).toBe('adopted');
  });
  it('audited year-end sources are actual', () => {
    expect(basisOf('WA State Auditor — Spokane Annual Financial Report FY2024 (General Fund, Expenditure by Function)')).toBe('actual');
    expect(basisOf('Utah State ACFR — General Fund (FY2024 actual, GAAP basis)')).toBe('actual');
    expect(basisOf('Ohio Auditor of State Summarized Annual Financial Reports')).toBe('actual');
    expect(basisOf('Minnesota Office of the State Auditor')).toBe('actual');
  });
  it('MA stays unknown -- not probed', () => {
    expect(basisOf('Newton — MA DLS General Fund Revenue by Source')).toBe('unknown');
  });
  it('city-adopted-budget-doc\'s unguarded "Budget FY####" tail alternative matches with no keyword present -- pinning intended, not accidental, behaviour', () => {
    expect(basisOf('Some City Adopted Budget FY2025')).toBe('adopted');
  });
});

describe('reporting entity classification', () => {
  it('MN OSA consolidates component units', () => {
    expect(entityOf('Minnesota Office of the State Auditor')).toBe('incl_component_units');
  });
  it('ACFR extracts are the primary government', () => {
    expect(entityOf('Utah State ACFR — General Fund (FY2024 actual, GAAP basis)')).toBe('primary_government');
  });
  it('WA SAO is the primary government', () => {
    expect(entityOf('WA State Auditor — Spokane Annual Financial Report FY2024 (General Fund, Expenditure by Function)'))
      .toBe('primary_government');
  });
  // ⚠⚠ THESE TWO USED TO ASSERT `unknown`, WITH THE REASON IN THE TEST NAME:
  // "EXPECTED primary_government but columbus.gov returned 403" and "not
  // probed". Both were true when written and neither was re-checked. On
  // 2026-11-03 columbus.gov simply answered, and the CA document turned out to
  // be in docs/ on the path the fund-scope entry already cited. A test that
  // pins the ABSENCE of evidence is pinning a measurement with a date on it —
  // it stops a silent regression, and it also quietly freezes a gap in place.
  it('Ohio AOS is the primary government — the AOS tab IS the audited fund statement', () => {
    // Columbus FY2025 and FY2024 both tie to the dollar, and under GASB 34 a
    // discretely presented component unit cannot be in a fund statement.
    expect(entityOf('Ohio Auditor of State Summarized Annual Financial Reports'))
      .toBe('primary_government');
  });
  it('CA SCO cities and county expenditures are the primary government', () => {
    expect(entityOf('CA State Controller - Expenditures')).toBe('primary_government');
    expect(entityOf('CA State Controller - Revenues')).toBe('primary_government');
    expect(entityOf('CA State Controller - County Expenditures')).toBe('primary_government');
  });
  it('⛔ CA SCO COUNTY REVENUES stays unknown, and this one is not a gap to close casually', () => {
    // The only CA SCO half whose reconciliation is NOT a dollar tie: a
    // 7,807,552 residue (0.547%). First 5 Stanislaus — the discretely presented
    // component unit the figure must exclude — has program revenues of
    // 10,623,616, the SAME ORDER as that residue, so the arithmetic cannot
    // separate "excluded" from "partly inside". The expenditure half had a $6
    // residue against an 11.7M unit and could.
    // ⚠ Do not flip this because its three siblings are classified. It needs a
    // county whose discretely presented unit is large relative to the revenue
    // residue, or the residue decomposed to the line.
    expect(entityOf('CA State Controller - County Revenues')).toBe('unknown');
  });
});
