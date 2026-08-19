import { describe, it, expect } from 'vitest';
import { resolveEffectiveDataset } from '../src/utils/resolveDataset';

/**
 * REGRESSION: every fallback branch returned 'operating' WITHOUT checking that
 * operating was available for that year.
 *
 * Landing on Brockton MA, whose latest year (FY2025) has a revenue row but no
 * operating row, produced "Unable to load budget data" and
 *   No budget found for Brockton 2025 (operating) in the displayed series …
 * because the resolver handed back a dataset the entity does not have, and the
 * loader then asked the API for a row that cannot exist.
 *
 * Nine entities were in that state: eight MA towns that had not filed FY2025
 * expenditures when the DLS workbook was captured (Brockton, Florida, Gill,
 * Gosnold, Holyoke, Hopedale, Hudson, Orange) and — the control that proves this
 * predates any of the MA work — Allen TX at FY2026.
 */
describe('resolveEffectiveDataset', () => {
  it('keeps a requested dataset that is available', () => {
    expect(resolveEffectiveDataset(['operating', 'revenue'], 'revenue')).toBe('revenue');
    expect(resolveEffectiveDataset(['operating', 'salaries'], 'salaries')).toBe('salaries');
  });

  it('defaults to operating when nothing is requested AND operating exists', () => {
    expect(resolveEffectiveDataset(['operating', 'revenue'], null)).toBe('operating');
    expect(resolveEffectiveDataset(['operating'], undefined)).toBe('operating');
  });

  // ── the bug ───────────────────────────────────────────────────────────────
  it('does NOT return operating when the year has no operating row — the Brockton case', () => {
    // Brockton FY2025: revenue only. Nothing requested, so branch 1 fired.
    expect(resolveEffectiveDataset(['revenue'], null)).toBe('revenue');
  });

  it('does not fall back to operating from an unavailable request either', () => {
    // Branch 3 had the same hole: ?dataset=salaries on a revenue-only year.
    expect(resolveEffectiveDataset(['revenue'], 'salaries')).toBe('revenue');
  });

  it('rejects garbage but still lands on something that exists', () => {
    // The static allow-list must keep doing its job — arbitrary query values
    // never reach state — without reintroducing the unavailable-operating bug.
    expect(resolveEffectiveDataset(['revenue'], '<script>')).toBe('revenue');
    expect(resolveEffectiveDataset(['salaries'], 'nonsense')).toBe('salaries');
  });

  it('prefers operating whenever it IS available, whatever else is present', () => {
    // Preserves the established default so no existing page changes behaviour.
    expect(resolveEffectiveDataset(['salaries', 'revenue', 'operating'], null)).toBe('operating');
    expect(resolveEffectiveDataset(['revenue', 'operating'], 'bogus')).toBe('operating');
  });

  it('ignores non-switchable types when choosing a fallback', () => {
    // all_funds_requirements and federal_agency are filtered by the caller, but
    // the resolver must not pick one even if it slips through.
    expect(resolveEffectiveDataset(['all_funds_requirements', 'revenue'], null)).toBe('revenue');
    expect(resolveEffectiveDataset(['federal_agency'], null)).toBe('operating');
  });

  it('returns operating when there is nothing at all, so the caller shows an empty state', () => {
    expect(resolveEffectiveDataset([], null)).toBe('operating');
    expect(resolveEffectiveDataset([], 'revenue')).toBe('operating');
  });
});
