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
});

describe('reporting entity classification', () => {
  it('MN OSA consolidates component units', () => {
    expect(entityOf('Minnesota Office of the State Auditor')).toBe('incl_component_units');
  });
  it('ACFR extracts are the primary government', () => {
    expect(entityOf('Utah State ACFR — General Fund (FY2024 actual, GAAP basis)')).toBe('primary_government');
  });
  it('Ohio stays unknown -- EXPECTED primary_government but columbus.gov returned 403', () => {
    expect(entityOf('Ohio Auditor of State Summarized Annual Financial Reports')).toBe('unknown');
  });
  it('CA SCO stays unknown -- not probed', () => {
    expect(entityOf('CA State Controller - Expenditures')).toBe('unknown');
  });
});
