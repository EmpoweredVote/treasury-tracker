/**
 * ⚠⚠⚠ `transactions` WAS MISSING FROM THE ALLOW-LIST, AND THAT HID A FLEET.
 *
 * Until 2026-11-07 `SWITCHABLE_DATASETS` held three types and the string
 * 'transactions' appeared NOWHERE in the app's dataset handling. Every check
 * and demand register was served by the API and unreachable on the page —
 * McKinney's 94-root FY2024 tree, Frisco's 31 a year, West Hollywood's eight
 * years and LA City's $24.5B. The type union said the value could not occur,
 * so no compiler error ever pointed at the gap.
 *
 * The symptom was quiet and plausible: `?entity=west-hollywood-ca&year=2026` —
 * a year whose ONLY dataset is the demand register — fell through to FY2025's
 * State Controller budget. The URL said 2026 and the page said 2025.
 */
import { describe, it, expect } from 'vitest';
import { resolveEffectiveDataset } from './resolveDataset';

describe('resolveEffectiveDataset', () => {
  it('keeps a requested dataset the year actually has', () => {
    expect(resolveEffectiveDataset(['operating', 'revenue'], 'revenue')).toBe('revenue');
    expect(resolveEffectiveDataset(['operating', 'transactions'], 'transactions')).toBe('transactions');
  });

  it('offers the Payments dataset where it exists', () => {
    expect(resolveEffectiveDataset(['transactions'], 'transactions')).toBe('transactions');
  });

  /** ⭐ The West Hollywood FY2026 case, exactly: a register-only year. */
  it('falls back to Payments when it is the only dataset for the year', () => {
    expect(resolveEffectiveDataset(['transactions'], null)).toBe('transactions');
    expect(resolveEffectiveDataset(['transactions'], undefined)).toBe('transactions');
  });

  /**
   * ⚠⚠ ORDER IS BEHAVIOUR. `transactions` is last in the preference list, so
   * adding it must not change what ANY existing entity-year lands on.
   */
  it('still prefers operating, then revenue, then salaries', () => {
    expect(resolveEffectiveDataset(['transactions', 'operating'], null)).toBe('operating');
    expect(resolveEffectiveDataset(['transactions', 'revenue'], null)).toBe('revenue');
    expect(resolveEffectiveDataset(['transactions', 'salaries'], null)).toBe('salaries');
    expect(resolveEffectiveDataset(['transactions', 'salaries', 'revenue', 'operating'], null))
      .toBe('operating');
  });

  it('falls back when the requested dataset is not available that year', () => {
    expect(resolveEffectiveDataset(['operating'], 'transactions')).toBe('operating');
    expect(resolveEffectiveDataset(['revenue'], 'transactions')).toBe('revenue');
  });

  /**
   * ⚠ A register TT cannot break down does not carry `dataset_type =
   * 'transactions'` in the database at all — Bloomington's 11 years are
   * `transactions_misattributed_source` (migration 20261107250000). An
   * unrecognised type must never be offered, which is the same mechanism the
   * VA APA revenue rows rely on.
   */
  it('never activates an unrecognised dataset type', () => {
    expect(resolveEffectiveDataset(['transactions_misattributed_source'], 'transactions_misattributed_source'))
      .toBe('operating');
    expect(resolveEffectiveDataset(['all_funds_requirements'], 'all_funds_requirements')).toBe('operating');
    expect(resolveEffectiveDataset(['operating'], '<script>')).toBe('operating');
    expect(resolveEffectiveDataset([], 'garbage')).toBe('operating');
  });
});
